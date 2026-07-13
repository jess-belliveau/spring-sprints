export const DEFAULT_DISTANCE_METRES = 250

export const DEMO_DEVICE_IDS = ['demo-trainer-1', 'demo-trainer-2'] as const
export type DemoDeviceId = (typeof DEMO_DEVICE_IDS)[number]

export const FTMS_SERVICE_UUID = '1826'
export const INDOOR_BIKE_DATA_UUID = '2ad2'

export const TELEMETRY_THROTTLE_MS = 100

export const COUNTDOWN_SECONDS = 3

// Number of riders that advance from qualifying to the knockout bracket
export const BRACKET_SIZE = 8

// Hero mode: live watt readouts catch fire above these thresholds.
// Two escalating tiers per gender: [tier1, tier2] watts. Tune to taste.
export const HERO_THRESHOLDS_M: readonly [number, number] = [750, 1000]
export const HERO_THRESHOLDS_F: readonly [number, number] = [500, 750]
