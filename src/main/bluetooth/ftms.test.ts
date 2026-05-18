import { describe, it, expect } from 'vitest'
import { parseIndoorBikeData } from './ftms'

// Helper to build an Indoor Bike Data buffer with specific fields
function buildBuffer(fields: {
  flags: number
  speed?: number       // uint16, 0.01 km/h
  avgSpeed?: number    // uint16
  cadence?: number     // uint16, 0.5 rpm
  avgCadence?: number  // uint16
  distance?: number    // uint24, metres
  resistance?: number  // int16
  power?: number       // int16, watts
}): Buffer {
  const bytes: number[] = []

  // Flags (2 bytes LE)
  bytes.push(fields.flags & 0xff, (fields.flags >> 8) & 0xff)

  // Instantaneous Speed (always present if More Data bit NOT set)
  const hasMoreData = (fields.flags & 0x0001) !== 0
  if (!hasMoreData) {
    const speed = fields.speed ?? 0
    bytes.push(speed & 0xff, (speed >> 8) & 0xff)
  }

  if (fields.flags & 0x0002) {
    const s = fields.avgSpeed ?? 0
    bytes.push(s & 0xff, (s >> 8) & 0xff)
  }

  if (fields.flags & 0x0004) {
    const c = fields.cadence ?? 0
    bytes.push(c & 0xff, (c >> 8) & 0xff)
  }

  if (fields.flags & 0x0008) {
    const c = fields.avgCadence ?? 0
    bytes.push(c & 0xff, (c >> 8) & 0xff)
  }

  if (fields.flags & 0x0010) {
    const d = fields.distance ?? 0
    bytes.push(d & 0xff, (d >> 8) & 0xff, (d >> 16) & 0xff)
  }

  if (fields.flags & 0x0020) {
    const r = fields.resistance ?? 0
    bytes.push(r & 0xff, (r >> 8) & 0xff)
  }

  if (fields.flags & 0x0040) {
    // int16 — handle negative via two's complement
    const p = fields.power ?? 0
    const val = p < 0 ? p + 65536 : p
    bytes.push(val & 0xff, (val >> 8) & 0xff)
  }

  return Buffer.from(bytes)
}

describe('parseIndoorBikeData', () => {
  it('parses speed-only packet (no optional fields)', () => {
    const buf = buildBuffer({ flags: 0x0000, speed: 2500 }) // 25.00 km/h
    const result = parseIndoorBikeData(buf)
    expect(result.instantaneousSpeed).toBe(2500)
    expect(result.instantaneousPower).toBe(0)
    expect(result.instantaneousCadence).toBe(0)
    expect(result.totalDistance).toBe(0)
  })

  it('parses packet with power only', () => {
    const buf = buildBuffer({ flags: 0x0040, speed: 1800, power: 250 })
    const result = parseIndoorBikeData(buf)
    expect(result.instantaneousPower).toBe(250)
    expect(result.instantaneousSpeed).toBe(1800)
  })

  it('parses negative power (resistance machine)', () => {
    const buf = buildBuffer({ flags: 0x0040, speed: 0, power: -10 })
    const result = parseIndoorBikeData(buf)
    expect(result.instantaneousPower).toBe(-10)
  })

  it('parses distance field (24-bit)', () => {
    // 250 metres
    const buf = buildBuffer({ flags: 0x0010, speed: 3000, distance: 250 })
    const result = parseIndoorBikeData(buf)
    expect(result.totalDistance).toBe(250)
  })

  it('parses large distance across byte boundaries', () => {
    // 100000 metres = 0x0186A0
    const buf = buildBuffer({ flags: 0x0010, speed: 0, distance: 100000 })
    const result = parseIndoorBikeData(buf)
    expect(result.totalDistance).toBe(100000)
  })

  it('parses cadence field', () => {
    // 180 rpm → stored as 360 (×2 encoding: value / 0.5)
    const buf = buildBuffer({ flags: 0x0004, speed: 0, cadence: 360 })
    const result = parseIndoorBikeData(buf)
    expect(result.instantaneousCadence).toBe(360)
  })

  it('parses all common fields together', () => {
    // flags: speed + cadence + distance + power = 0x0054 (bits 2, 4, 6)
    const flags = 0x0000 | 0x0004 | 0x0010 | 0x0040
    const buf = buildBuffer({
      flags,
      speed: 2000,
      cadence: 200,
      distance: 150,
      power: 300
    })
    const result = parseIndoorBikeData(buf)
    expect(result.instantaneousSpeed).toBe(2000)
    expect(result.instantaneousCadence).toBe(200)
    expect(result.totalDistance).toBe(150)
    expect(result.instantaneousPower).toBe(300)
  })

  it('skips average speed field correctly', () => {
    // flags: avg speed + power
    const flags = 0x0002 | 0x0040
    const buf = buildBuffer({ flags, speed: 1500, avgSpeed: 1400, power: 280 })
    const result = parseIndoorBikeData(buf)
    expect(result.instantaneousSpeed).toBe(1500)
    expect(result.instantaneousPower).toBe(280)
  })

  it('skips avg cadence and resistance fields correctly', () => {
    const flags = 0x0004 | 0x0008 | 0x0010 | 0x0020 | 0x0040
    const buf = buildBuffer({
      flags,
      speed: 3000,
      cadence: 180,
      avgCadence: 175,
      distance: 200,
      resistance: 5,
      power: 320
    })
    const result = parseIndoorBikeData(buf)
    expect(result.instantaneousCadence).toBe(180)
    expect(result.totalDistance).toBe(200)
    expect(result.instantaneousPower).toBe(320)
  })

  it('returns timestamp close to Date.now()', () => {
    const before = Date.now()
    const buf = buildBuffer({ flags: 0, speed: 0 })
    const result = parseIndoorBikeData(buf)
    const after = Date.now()
    expect(result.timestamp).toBeGreaterThanOrEqual(before)
    expect(result.timestamp).toBeLessThanOrEqual(after)
  })
})
