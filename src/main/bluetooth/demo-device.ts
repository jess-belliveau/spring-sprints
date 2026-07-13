import { EventEmitter } from 'events'
import type { IndoorBikeData } from '../../shared/types'
import type { ITrainerDevice } from './device'
import { DEMO_DEVICE_IDS } from '../../shared/constants'

export { DEMO_DEVICE_IDS }

const TICK_MS = 250  // 4 Hz — typical FTMS update rate

// Demo power wanders across this range so effects like hero mode get exercised
const WATTS_MIN = 400
const WATTS_MAX = 1200
const RETARGET_TICKS = 12   // pick a new target roughly every 3s
const APPROACH_RATE = 0.2   // fraction of the gap to the target closed per tick
const WATTS_JITTER = 40     // ± random noise per tick

export class DemoDevice extends EventEmitter implements ITrainerDevice {
  readonly id: string
  readonly name: string

  private timer: ReturnType<typeof setInterval> | null = null
  private currentWatts: number
  private targetWatts: number
  private ticksUntilRetarget = 0
  private readonly cadenceRaw: number
  private _stopped = false

  constructor(id: string, name: string, watts: number, baseRpm: number) {
    super()
    this.id = id
    this.name = name
    this.currentWatts = Math.min(WATTS_MAX, Math.max(WATTS_MIN, watts))
    this.targetWatts = this.currentWatts
    this.cadenceRaw = Math.round(baseRpm * 2)
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

  setStopped(stopped: boolean): void {
    this._stopped = stopped
  }

  private tick(): void {
    const jitter = () => (Math.random() - 0.5) * 2

    if (this.ticksUntilRetarget <= 0) {
      this.targetWatts = WATTS_MIN + Math.random() * (WATTS_MAX - WATTS_MIN)
      this.ticksUntilRetarget = RETARGET_TICKS
    }
    this.ticksUntilRetarget -= 1
    this.currentWatts += (this.targetWatts - this.currentWatts) * APPROACH_RATE

    const power = Math.min(
      WATTS_MAX,
      Math.max(WATTS_MIN, Math.round(this.currentWatts + jitter() * WATTS_JITTER))
    )

    const data: IndoorBikeData = {
      instantaneousPower: this._stopped ? 0 : power,
      instantaneousSpeed: 0,
      instantaneousCadence: this._stopped ? 0 : Math.max(0, Math.round(this.cadenceRaw + jitter() * 4)),
      totalDistance: 0,
      timestamp: Date.now()
    }
    this.emit('data', data)
  }
}

export function createDemoDevices(): DemoDevice[] {
  return [
    new DemoDevice('demo-trainer-1', 'Demo Trainer 1', 900, 96),
    new DemoDevice('demo-trainer-2', 'Demo Trainer 2', 500, 72)
  ]
}
