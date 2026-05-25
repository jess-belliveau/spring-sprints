export type Lane = 'left' | 'right'

export type EventPhase =
  | 'setup'
  | 'registration'
  | 'device-pairing'
  | 'qualifying'
  | 'qualifying-results'
  | 'bracket'
  | 'head-to-head'
  | 'free-pair'
  | 'complete'

export type RaceStatus = 'idle' | 'countdown' | 'racing' | 'finished'

// ── BLE ──────────────────────────────────────────────────────────────────────

export interface BLEDeviceInfo {
  id: string
  name: string
  rssi: number
}

export interface ConnectedDevice {
  lane: Lane
  device: BLEDeviceInfo
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
}

// ── FTMS ─────────────────────────────────────────────────────────────────────

export interface IndoorBikeData {
  instantaneousPower: number
  instantaneousSpeed: number
  instantaneousCadence: number
  totalDistance: number
  timestamp: number
}

// ── Race telemetry (IPC hot path) ────────────────────────────────────────────

export interface TelemetryFrame {
  lane: Lane
  raceId: string
  elapsedMs: number
  distanceCovered: number
  velocityMs: number
  instantWatts: number
  cadenceRpm: number
}

// ── Riders & results ─────────────────────────────────────────────────────────

export type BracketPool = 'M' | 'F' | 'Open'

export interface Rider {
  id: string
  name: string
  gender?: 'M' | 'F'
  seed?: number
}

export interface LaneResult {
  riderId: string
  lane: Lane
  finishTimeMs: number
  avgWatts: number
  maxWatts: number
  distanceMetres: number
}

export interface RaceResult {
  raceId: string
  type: 'qualifying' | 'bracket'
  round?: number
  matchIndex?: number
  startedAt: number
  left: LaneResult | null
  right: LaneResult | null
  winnerId?: string
}

// ── Bracket ──────────────────────────────────────────────────────────────────

export interface BracketMatch {
  id: string
  round: number
  matchIndex: number
  topRiderId: string | null
  bottomRiderId: string | null
  winnerId: string | null
  raceResultId: string | null
  isThirdPlace?: boolean
}

export interface BracketRound {
  round: number
  matches: BracketMatch[]
}

// ── Event ────────────────────────────────────────────────────────────────────

export interface EventConfig {
  name: string
  distanceMetres: number
}

export interface EventData {
  id: string
  config: EventConfig
  riders: Rider[]
  qualifyingResults: RaceResult[]
  bracketResults: RaceResult[]
  bracket: BracketRound[]     // M bracket (or combined for non-gender events)
  bracketF: BracketRound[]    // Women's bracket
  bracketOpen: BracketRound[] // Riders without gender
  currentRaceId: string | null
  phase: EventPhase
}

// ── Live race state ───────────────────────────────────────────────────────────

export interface LiveLaneState {
  riderId: string
  riderName: string
  distanceCovered: number
  velocityMs: number
  instantWatts: number
  cadenceRpm: number
  elapsedMs: number
  finished: boolean
  result: LaneResult | null
}

export interface ActiveRaceState {
  raceId: string
  status: RaceStatus
  countdownValue: number | null
  startedAt: number | null
  left: LiveLaneState | null
  right: LiveLaneState | null
}
