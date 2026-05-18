import type { IndoorBikeData } from '../../shared/types'

/**
 * Parses the FTMS Indoor Bike Data characteristic (0x2A38).
 *
 * The characteristic begins with a 16-bit flags field (little-endian).
 * Each flag bit indicates whether an optional field follows. Fields are
 * packed tightly after the mandatory Instantaneous Speed field.
 *
 * Flags (bit positions):
 *   0: More Data (if set, Instantaneous Speed is NOT present — unusual, we assume it is)
 *   1: Average Speed present
 *   2: Instantaneous Cadence present
 *   3: Average Cadence present
 *   4: Total Distance present (uint24 LE, 3 bytes)
 *   5: Resistance Level present (sint16)
 *   6: Instantaneous Power present (sint16, watts)
 *   7: Average Power present (sint16)
 *   8: Expended Energy present (3 fields: 2+2+1 = 5 bytes)
 *   9: Heart Rate present (uint8)
 *  10: Metabolic Equivalent present (uint8)
 *  11: Elapsed Time present (uint16)
 *  12: Remaining Time present (uint16)
 */
export function parseIndoorBikeData(data: Buffer): IndoorBikeData {
  const flags = data.readUInt16LE(0)
  let offset = 2

  const hasMoreData = (flags & 0x0001) !== 0
  const hasAvgSpeed = (flags & 0x0002) !== 0
  const hasInstCadence = (flags & 0x0004) !== 0
  const hasAvgCadence = (flags & 0x0008) !== 0
  const hasTotalDistance = (flags & 0x0010) !== 0
  const hasResistance = (flags & 0x0020) !== 0
  const hasInstPower = (flags & 0x0040) !== 0

  // Instantaneous Speed — uint16 LE, units: 0.01 km/h
  // Present unless "More Data" flag is set (rare in practice)
  let instantaneousSpeed = 0
  if (!hasMoreData) {
    instantaneousSpeed = data.readUInt16LE(offset)
    offset += 2
  }

  if (hasAvgSpeed) offset += 2

  // Instantaneous Cadence — uint16 LE, units: 0.5 rpm
  let instantaneousCadence = 0
  if (hasInstCadence) {
    instantaneousCadence = data.readUInt16LE(offset)
    offset += 2
  }

  if (hasAvgCadence) offset += 2

  // Total Distance — uint24 LE, units: metres
  let totalDistance = 0
  if (hasTotalDistance) {
    const b0 = data.readUInt8(offset)
    const b1 = data.readUInt8(offset + 1)
    const b2 = data.readUInt8(offset + 2)
    totalDistance = b0 | (b1 << 8) | (b2 << 16)
    offset += 3
  }

  if (hasResistance) offset += 2

  // Instantaneous Power — sint16 LE, units: watts
  let instantaneousPower = 0
  if (hasInstPower) {
    instantaneousPower = data.readInt16LE(offset)
    offset += 2
  }

  return {
    instantaneousPower,
    instantaneousSpeed,
    instantaneousCadence,
    totalDistance,
    timestamp: Date.now()
  }
}
