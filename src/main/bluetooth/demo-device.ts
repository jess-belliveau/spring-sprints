import { EventEmitter } from 'events'
import type { IndoorBikeData } from '../../shared/types'
import type { ITrainerDevice } from './device'

const TICK_MS = 250  // 4 Hz — typical FTMS update rate

export const DEMO_DEVICE_IDS = ['demo-trainer-1', 'demo-trainer-2'] as const

export class DemoDevice extends EventEmitter implements ITrainerDevice {
  readonly id: string
  readonly name: string

  private timer: ReturnType<typeof setInterval> | null = null
  private startTime = 0
  private readonly peakWatts: number
  private readonly baseRpm: number

  constructor(id: string, name: string, peakWatts: number, baseRpm: number) {
    super()
    this.id = id
    this.name = name
    this.peakWatts = peakWatts
    this.baseRpm = baseRpm
  }

  async connect(): Promise<void> {
    this.startTime = Date.now()
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  async disconnect(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.emit('disconnect')
  }

  private tick(): void {
    const t = (Date.now() - this.startTime) / 1000

    // Ramp from 50W to peakWatts over ~5s, then hold with sinusoidal variation
    const ramp = Math.min(1, t / 5)
    const base = 50 + (this.peakWatts - 50) * ramp
    const watts = Math.max(0, Math.round(base + 20 * Math.sin(t * 1.7) + 10 * Math.sin(t * 3.1)))

    // Cadence: ramp up then hold, with gentle oscillation (stored as RPM × 2 per FTMS spec)
    const rpm = this.baseRpm + 8 * ramp * Math.sin(t * 0.9)
    const cadenceRaw = Math.round(rpm * 2)

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
