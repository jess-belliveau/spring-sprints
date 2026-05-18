import { EventEmitter } from 'events'
import type { BrowserWindow } from 'electron'
import type { Lane, BLEDeviceInfo, LaneResult, TelemetryFrame } from '../../shared/types'
import { BluetoothDevice, type NoblePeripheral, type ITrainerDevice } from './device'
import { createDemoDevices, DEMO_DEVICE_IDS } from './demo-device'
import { IPC } from '../../shared/ipc-channels'
import { TELEMETRY_THROTTLE_MS } from '../../shared/constants'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const noble = require('@abandonware/noble')

// ── Physics model ─────────────────────────────────────────────────────────────
// Flat-road drag model: P = Crr·m·g·v + 0.5·CdA·ρ·v³
// Solve for v given P using Newton-Raphson, then pre-compute a lookup table.
const Crr = 0.004
const MASS_KG = 75
const G = 9.81
const CDA = 0.32
const RHO = 1.2
const VELOCITY_TAU_S = 2.0 // velocity smoothing time constant (seconds)
const MAX_DT_S = 2.0       // cap integration step to guard against stale gaps

function solveVelocity(power: number): number {
  if (power <= 0) return 0
  let v = Math.cbrt(power / (0.5 * CDA * RHO)) // rough cube-root initial guess
  for (let i = 0; i < 30; i++) {
    const f = Crr * MASS_KG * G * v + 0.5 * CDA * RHO * v * v * v - power
    const df = Crr * MASS_KG * G + 1.5 * CDA * RHO * v * v
    const dv = f / df
    v -= dv
    if (Math.abs(dv) < 1e-9) break
  }
  return Math.max(0, v)
}

// 0–2000 W table, 1 W resolution
const WATTS_TABLE: Float64Array = (() => {
  const t = new Float64Array(2001)
  for (let w = 0; w <= 2000; w++) t[w] = solveVelocity(w)
  return t
})()

function wattsToVelocity(watts: number): number {
  return WATTS_TABLE[Math.max(0, Math.min(2000, Math.round(watts)))]
}
// ─────────────────────────────────────────────────────────────────────────────

interface RaceWatcher {
  watts: number[]
  lastEmitTs: number
  velocityMs: number    // smoothed simulated velocity
  positionMetres: number
  lastDataTs: number
  finished: boolean
}

export class BluetoothManager extends EventEmitter {
  private getWindow: () => BrowserWindow | null
  private isDev: boolean
  private scanResults = new Map<string, unknown>()
  private demoDevices = new Map<string, ITrainerDevice>()
  private connectedDevices = new Map<Lane, ITrainerDevice>()
  private raceWatchers = new Map<Lane, RaceWatcher>()
  private currentRaceId: string | null = null
  private targetDistance = 0
  private raceStartTime = 0
  private countdownActive = false
  private scanning = false
  private nobleReady = false
  private scanPending = false // scan requested before noble was ready

  constructor(getWindow: () => BrowserWindow | null, isDev = false) {
    super()
    this.getWindow = getWindow
    this.isDev = isDev

    if (isDev) {
      for (const d of createDemoDevices()) {
        this.demoDevices.set(d.id, d)
      }
    }

    noble.on('stateChange', (state: string) => {
      this.nobleReady = state === 'poweredOn'
      if (this.nobleReady && this.scanPending) {
        this.scanPending = false
        this._startNobleScan()
      }
    })

    noble.on('discover', (peripheral: unknown) => {
      const p = peripheral as {
        id: string
        advertisement: { localName?: string; serviceUuids?: string[] }
        rssi: number
      }
      // Skip nameless peripherals — they're almost certainly not trainers
      if (!p.advertisement?.localName) return
      const info: BLEDeviceInfo = {
        id: p.id,
        name: p.advertisement.localName,
        rssi: p.rssi
      }
      this.scanResults.set(p.id, peripheral)
      this.send(IPC.BLUETOOTH_DEVICE_FOUND, info)
    })
  }

  private send(channel: string, data?: unknown): void {
    const win = this.getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }

  startScan(): void {
    // Always emit demo devices in dev mode so they appear alongside real hardware
    if (this.isDev) {
      for (const d of this.demoDevices.values()) {
        const info: BLEDeviceInfo = { id: d.id, name: d.name, rssi: -55 }
        this.send(IPC.BLUETOOTH_DEVICE_FOUND, info)
      }
    }

    if (this.scanning) return

    if (!this.nobleReady) {
      // Noble not ready yet — queue the scan; it will start once stateChange fires
      this.scanPending = true
      return
    }

    this._startNobleScan()
  }

  private _startNobleScan(): void {
    this.scanning = true
    this.scanResults.clear()
    // Scan without a service UUID filter — many trainers don't include the FTMS
    // UUID (0x1826) in their advertisement packet even though they support it.
    // We filter by device name presence in the discover handler instead.
    noble.startScanning([], false)
  }

  stopScan(): void {
    this.scanPending = false
    if (!this.scanning) return
    this.scanning = false
    noble.stopScanning()
  }

  async connectToLane(deviceId: string, lane: Lane): Promise<void> {
    this.stopScan()

    const existing = this.connectedDevices.get(lane)
    if (existing) {
      await existing.disconnect().catch(() => {})
      this.connectedDevices.delete(lane)
    }

    const isDemoId = (DEMO_DEVICE_IDS as readonly string[]).includes(deviceId)
    let device: ITrainerDevice
    if (isDemoId) {
      const demo = this.demoDevices.get(deviceId)
      if (!demo) throw new Error(`Demo device ${deviceId} not found`)
      device = demo
    } else {
      const peripheral = this.scanResults.get(deviceId)
      if (!peripheral) throw new Error(`Device ${deviceId} not found in scan results`)
      device = new BluetoothDevice(peripheral as NoblePeripheral)
    }

    device.on('disconnect', () => {
      if (this.connectedDevices.get(lane) === device) {
        this.connectedDevices.delete(lane)
        this.send(IPC.BLUETOOTH_DEVICE_DISCONNECTED, { lane })
      }
    })

    device.on('data', (data) => {
      this.handleDeviceData(lane, data)
    })

    device.on('error', (err: Error) => {
      this.send(IPC.BLUETOOTH_DEVICE_ERROR, { lane, message: err.message })
    })

    await device.connect()
    this.connectedDevices.set(lane, device)

    const deviceInfo: BLEDeviceInfo = { id: device.id, name: device.name, rssi: 0 }
    this.send(IPC.BLUETOOTH_DEVICE_CONNECTED, { lane, device: deviceInfo })
  }

  async disconnectLane(lane: Lane): Promise<void> {
    const device = this.connectedDevices.get(lane)
    if (device) {
      await device.disconnect().catch(() => {})
      this.connectedDevices.delete(lane)
      this.send(IPC.BLUETOOTH_DEVICE_DISCONNECTED, { lane })
    }
  }

  startRaceMonitoring(raceId: string, distanceMetres: number, lanes: Lane[]): void {
    this.currentRaceId = raceId
    this.targetDistance = distanceMetres
    this.raceStartTime = 0     // set properly when raceGo() fires
    this.countdownActive = true
    this.raceWatchers.clear()

    for (const lane of lanes) {
      this.raceWatchers.set(lane, {
        watts: [],
        lastEmitTs: 0,
        velocityMs: 0,
        positionMetres: 0,
        lastDataTs: 0,
        finished: false
      })
    }

    for (const device of this.connectedDevices.values()) {
      device.onCountdownStart?.()
    }
  }

  raceGo(): void {
    this.countdownActive = false
    this.raceStartTime = Date.now()
    // Reset per-lane integration state so countdown pedaling doesn't carry over
    for (const watcher of this.raceWatchers.values()) {
      watcher.velocityMs = 0
      watcher.positionMetres = 0
      watcher.lastDataTs = 0
      watcher.watts = []
    }
    for (const device of this.connectedDevices.values()) {
      device.onRaceGo?.()
    }
  }

  stopRaceMonitoring(): void {
    this.currentRaceId = null
    this.countdownActive = false
    this.raceWatchers.clear()
  }

  private handleDeviceData(lane: Lane, data: import('../../shared/types').IndoorBikeData): void {
    const watcher = this.raceWatchers.get(lane)
    if (!watcher || watcher.finished || !this.currentRaceId) return

    const now = Date.now()

    if (this.countdownActive) {
      // During countdown: report live watts for the false-start check but don't
      // integrate position or accumulate race watts.
      const elapsed = this.raceStartTime > 0 ? now - this.raceStartTime : 0
      if (now - watcher.lastEmitTs >= TELEMETRY_THROTTLE_MS) {
        watcher.lastEmitTs = now
        this.send(IPC.RACE_TELEMETRY, {
          lane,
          raceId: this.currentRaceId,
          elapsedMs: elapsed,
          distanceCovered: 0,
          instantWatts: data.instantaneousPower,
          cadenceRpm: Math.round(data.instantaneousCadence * 0.5)
        })
      }
      return
    }

    // Simulate distance from power — trainer-reported distance/speed is not used.
    const targetV = wattsToVelocity(data.instantaneousPower)
    if (watcher.lastDataTs > 0) {
      const dtSec = Math.min((now - watcher.lastDataTs) / 1000, MAX_DT_S)
      // Time-constant EMA: alpha scales with dt so smoothing is frame-rate independent
      const alpha = 1 - Math.exp(-dtSec / VELOCITY_TAU_S)
      watcher.velocityMs = watcher.velocityMs * (1 - alpha) + targetV * alpha
      watcher.positionMetres += watcher.velocityMs * dtSec
    } else {
      watcher.velocityMs = targetV
    }
    watcher.lastDataTs = now

    watcher.watts.push(data.instantaneousPower)

    const elapsedMs = now - this.raceStartTime
    const distanceCovered = watcher.positionMetres

    if (now - watcher.lastEmitTs >= TELEMETRY_THROTTLE_MS) {
      watcher.lastEmitTs = now
      const frame: TelemetryFrame = {
        lane,
        raceId: this.currentRaceId,
        elapsedMs,
        distanceCovered,
        instantWatts: data.instantaneousPower,
        cadenceRpm: Math.round(data.instantaneousCadence * 0.5)
      }
      this.send(IPC.RACE_TELEMETRY, frame)
    }

    if (distanceCovered >= this.targetDistance) {
      watcher.finished = true
      const avgWatts =
        watcher.watts.length > 0
          ? Math.round(watcher.watts.reduce((a, b) => a + b, 0) / watcher.watts.length)
          : 0
      const maxWatts = watcher.watts.length > 0 ? Math.max(...watcher.watts) : 0

      const result: LaneResult = {
        riderId: '',
        lane,
        finishTimeMs: elapsedMs,
        avgWatts,
        maxWatts,
        distanceMetres: distanceCovered
      }
      this.send(IPC.RACE_FINISHED, { lane, result })
    }
  }

  destroy(): void {
    this.stopScan()
    this.connectedDevices.forEach((device) => device.disconnect().catch(() => {}))
    this.connectedDevices.clear()
    this.raceWatchers.clear()
    noble.removeAllListeners()
  }
}
