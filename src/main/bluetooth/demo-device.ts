import { EventEmitter } from 'events'
import type { IndoorBikeData } from '../../shared/types'
import type { ITrainerDevice } from './device'

const TICK_MS = 250  // 4 Hz — typical FTMS update rate
const FALSE_START_WATTS = 200  // burst emitted for first 3s of countdown
const FALSE_START_DURATION_S = 3

export const DEMO_DEVICE_IDS = ['demo-trainer-1', 'demo-trainer-2'] as const

export class DemoDevice extends EventEmitter implements ITrainerDevice {
  readonly id: string
  readonly name: string

  private timer: ReturnType<typeof setInterval> | null = null
  private readonly peakWatts: number
  private readonly baseRpm: number

  private countdownStartTime = 0  // set by onCountdownStart
  private raceGoTime = 0          // set by onRaceGo

  constructor(id: string, name: string, peakWatts: number, baseRpm: number) {
    super()
    this.id = id
    this.name = name
    this.peakWatts = peakWatts
    this.baseRpm = baseRpm
  }

  async connect(): Promise<void> {
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  async disconnect(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.emit('disconnect')
  }

  // Called by the manager when the countdown begins
  onCountdownStart(): void {
    this.countdownStartTime = Date.now()
    this.raceGoTime = 0
  }

  // Called by the manager when GO fires — resets integration
  onRaceGo(): void {
    this.raceGoTime = Date.now()
  }

  private tick(): void {
    let watts: number
    let cadenceRaw: number

    if (this.raceGoTime > 0) {
      // Racing: normal power ramp
      const t = (Date.now() - this.raceGoTime) / 1000
      const ramp = Math.min(1, t / 5)
      const base = 50 + (this.peakWatts - 50) * ramp
      watts = Math.max(0, Math.round(base + 20 * Math.sin(t * 1.7) + 10 * Math.sin(t * 3.1)))
      const rpm = this.baseRpm + 8 * ramp * Math.sin(t * 0.9)
      cadenceRaw = Math.round(rpm * 2)
    } else if (this.countdownStartTime > 0) {
      // Countdown: emit a FALSE_START_WATTS burst for first few seconds, then settle to 0W.
      // This lets dev mode demonstrate the false-start detection without real hardware.
      const elapsed = (Date.now() - this.countdownStartTime) / 1000
      watts = elapsed < FALSE_START_DURATION_S ? FALSE_START_WATTS : 0
      cadenceRaw = elapsed < FALSE_START_DURATION_S ? Math.round(this.baseRpm * 2) : 0
    } else {
      // Idle / connected but no race
      watts = 0
      cadenceRaw = 0
    }

    const data: IndoorBikeData = {
      instantaneousPower: watts,
      instantaneousSpeed: 0,
      instantaneousCadence: cadenceRaw,
      totalDistance: 0,
      timestamp: Date.now()
    }
    this.emit('data', data)
  }
}

export function createDemoDevices(): DemoDevice[] {
  return [
    new DemoDevice('demo-trainer-1', 'Demo Trainer 1', 280, 92),
    new DemoDevice('demo-trainer-2', 'Demo Trainer 2', 260, 88)
  ]
}
