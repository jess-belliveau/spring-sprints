import { EventEmitter } from 'events'
import type { IndoorBikeData } from '../../shared/types'
import { parseIndoorBikeData } from './ftms'
import { FTMS_SERVICE_UUID, INDOOR_BIKE_DATA_UUID } from '../../shared/constants'

export interface ITrainerDevice extends EventEmitter {
  readonly id: string
  readonly name: string
  connect(): Promise<void>
  disconnect(): Promise<void>
  onCountdownStart?(): void
  onRaceGo?(): void
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const noble = require('@abandonware/noble')

export type NoblePeripheral = (typeof noble)['_peripherals'][string]

export class BluetoothDevice extends EventEmitter implements ITrainerDevice {
  readonly id: string
  readonly name: string
  private peripheral: NoblePeripheral
  private characteristic: unknown = null
  private _latestData: IndoorBikeData | null = null

  constructor(peripheral: NoblePeripheral) {
    super()
    this.peripheral = peripheral
    this.id = peripheral.id
    this.name = peripheral.advertisement?.localName || peripheral.id
  }

  get latestData(): IndoorBikeData | null {
    return this._latestData
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.peripheral.connect((err: Error | null) => {
        if (err) return reject(err)

        this.peripheral.discoverSomeServicesAndCharacteristics(
          [FTMS_SERVICE_UUID],
          [],  // discover all — some devices report full 128-bit UUIDs that won't match a short-UUID filter
          (discoverErr: Error | null, _services: unknown[], characteristics: unknown[]) => {
            if (discoverErr) return reject(discoverErr)

            // Match short UUID or full 128-bit UUID (some devices use the full form)
            const chars = characteristics as Array<{ uuid: string }>
            const char = chars.find((c) =>
              c.uuid === INDOOR_BIKE_DATA_UUID || c.uuid.endsWith(INDOOR_BIKE_DATA_UUID)
            )

            if (!char) {
              const found = chars.map((c) => c.uuid).join(', ') || 'none'
              return reject(new Error(`Indoor Bike Data characteristic not found. Found: ${found}`))
            }

            this.characteristic = char
            this.subscribeToData()
            resolve()
          }
        )
      })

      this.peripheral.once('disconnect', () => {
        this.emit('disconnect')
      })
    })
  }

  private subscribeToData(): void {
    const char = this.characteristic as {
      subscribe: (cb: (err: Error | null) => void) => void
      on: (event: string, cb: (data: Buffer) => void) => void
    }

    char.subscribe((err) => {
      if (err) {
        this.emit('error', err)
        return
      }
    })

    char.on('data', (data: Buffer) => {
      try {
        const parsed = parseIndoorBikeData(data)
        this._latestData = parsed
        this.emit('data', parsed)
      } catch (e) {
        // Malformed packet — skip silently
      }
    })
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      this.peripheral.disconnect(() => resolve())
    })
  }
}
