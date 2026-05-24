import { EventEmitter } from 'events'
import type { IndoorBikeData } from '../../shared/types'
import type { ITrainerDevice } from './device'
import { DEMO_DEVICE_IDS } from '../../shared/constants'

export { DEMO_DEVICE_IDS }

const TICK_MS = 250  // 4 Hz — typical FTMS update rate

export class DemoDevice extends EventEmitter implements ITrainerDevice {
  readonly id: string
  readonly name: string

  private timer: ReturnType<typeof setInterval> | null = null
  private readonly watts: number
  private readonly cadenceRaw: number
  private _stopped = false

  constructor(id: string, name: string, watts: number, baseRpm: number) {
    super()
    this.id = id
    this.name = name
    this.watts = watts
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
    const data: IndoorBikeData = {
      instantaneousPower: this._stopped ? 0 : Math.max(0, Math.round(this.watts + jitter() * this.watts * 0.08)),
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
    new DemoDevice('demo-trainer-1', 'Demo Trainer 1', 320, 96),
    new DemoDevice('demo-trainer-2', 'Demo Trainer 2', 160, 72)
  ]
}
