import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  EventData,
  EventPhase,
  EventConfig,
  Rider,
  RaceResult,
  BracketRound,
  BracketMatch
} from '@shared/types'
import { DEFAULT_DISTANCE_METRES, BRACKET_SIZE } from '@shared/constants'

interface EventState {
  event: EventData | null

  initEvent: (config: EventConfig) => void
  setEvent: (event: EventData) => void
  setPhase: (phase: EventPhase) => void
  setRiders: (riders: Rider[]) => void
  addRider: (rider: Rider) => void
  removeRider: (riderId: string) => void
  addQualifyingResult: (result: RaceResult) => void
  removeQualifyingResult: (riderId: string) => void
  generateBracket: () => void
  advanceBracket: (matchId: string, winnerId: string, raceResultId: string) => void
  setCurrentRaceId: (id: string | null) => void
  reset: () => void
}

function bracketPositions(size: number): number[] {
  if (size === 1) return [1]
  const half = bracketPositions(size / 2)
  return half.flatMap((s) => [s, size + 1 - s])
}

export function buildBracket(riders: Rider[]): BracketRound[] {
  const riderCount = riders.length
  const bracketSize = 8
  const positions = bracketPositions(bracketSize)

  const firstRound: BracketMatch[] = []
  const matchCount = bracketSize / 2

  for (let i = 0; i < matchCount; i++) {
    const topSeed = positions[i * 2]
    const bottomSeed = positions[i * 2 + 1]
    const topRider = topSeed <= riderCount ? riders[topSeed - 1] : null
    const bottomRider = bottomSeed <= riderCount ? riders[bottomSeed - 1] : null

    const winnerId = !topRider ? bottomRider?.id ?? null : !bottomRider ? topRider.id : null

    firstRound.push({
      id: nanoid(),
      round: 0,
      matchIndex: i,
      topRiderId: topRider?.id ?? null,
      bottomRiderId: bottomRider?.id ?? null,
      winnerId,
      raceResultId: null
    })
  }

  // Rounds 1 and 2 (semis and final) — TBD placeholders
  const round1: BracketMatch[] = []
  for (let i = 0; i < 2; i++) {
    round1.push({
      id: nanoid(),
      round: 1,
      matchIndex: i,
      topRiderId: null,
      bottomRiderId: null,
      winnerId: null,
      raceResultId: null
    })
  }

  const round2: BracketMatch[] = [
    {
      id: nanoid(),
      round: 2,
      matchIndex: 0,
      topRiderId: null,
      bottomRiderId: null,
      winnerId: null,
      raceResultId: null
    }
  ]

  // Auto-advance byes from round 0 into round 1
  const rounds: BracketRound[] = [
    { round: 0, matches: firstRound },
    { round: 1, matches: round1 },
    { round: 2, matches: round2 }
  ]

  for (const match of firstRound) {
    if (match.winnerId) {
      const nextMatchIndex = Math.floor(match.matchIndex / 2)
      const slot = match.matchIndex % 2 === 0 ? 'top' : 'bottom'
      const nextMatch = rounds[1].matches[nextMatchIndex]
      if (slot === 'top') nextMatch.topRiderId = match.winnerId
      else nextMatch.bottomRiderId = match.winnerId
    }
  }

  return rounds
}

export const useEventStore = create<EventState>((set, _get) => ({
  event: null,

  initEvent: (config) => {
    const event: EventData = {
      id: nanoid(),
      config,
      riders: [],
      qualifyingResults: [],
      bracket: [],
      currentRaceId: null,
      phase: 'registration'
    }
    set({ event })
    window.electronAPI.saveEvent(event)
  },

  setEvent: (event) => set({ event }),

  setPhase: (phase) =>
    set((s) => {
      if (!s.event) return s
      const event = { ...s.event, phase }
      window.electronAPI.saveEvent(event)
      return { event }
    }),

  setRiders: (riders) =>
    set((s) => {
      if (!s.event) return s
      const event = { ...s.event, riders, phase: 'device-pairing' as EventPhase }
      window.electronAPI.saveEvent(event)
      return { event }
    }),

  addRider: (rider) =>
    set((s) => {
      if (!s.event) return s
      const riders = [...s.event.riders, rider]
      const event = { ...s.event, riders }
      window.electronAPI.saveEvent(event)
      return { event }
    }),

  removeRider: (riderId) =>
    set((s) => {
      if (!s.event) return s
      const riders = s.event.riders.filter((r) => r.id !== riderId)
      const qualifyingResults = s.event.qualifyingResults.filter(
        (r) => r.left?.riderId !== riderId && r.right?.riderId !== riderId
      )
      const event = { ...s.event, riders, qualifyingResults }
      window.electronAPI.saveEvent(event)
      return { event }
    }),

  addQualifyingResult: (result) =>
    set((s) => {
      if (!s.event) return s
      const qualifyingResults = [...s.event.qualifyingResults, result]
      const event = { ...s.event, qualifyingResults }
      window.electronAPI.saveEvent(event)
      return { event }
    }),

  removeQualifyingResult: (riderId) =>
    set((s) => {
      if (!s.event) return s
      const qualifyingResults = s.event.qualifyingResults.filter(
        (r) => r.left?.riderId !== riderId && r.right?.riderId !== riderId
      )
      const event = { ...s.event, qualifyingResults }
      window.electronAPI.saveEvent(event)
      return { event }
    }),

  generateBracket: () =>
    set((s) => {
      if (!s.event) return s
      // Sort riders by qualifying time
      const results = [...s.event.qualifyingResults].sort((a, b) => {
        const aTime = a.left?.finishTimeMs ?? a.right?.finishTimeMs ?? Infinity
        const bTime = b.left?.finishTimeMs ?? b.right?.finishTimeMs ?? Infinity
        return aTime - bTime
      })
      const sortedRiders = results.map((r, idx) => {
        const riderId = r.left?.riderId ?? r.right?.riderId ?? ''
        const rider = s.event!.riders.find((rd) => rd.id === riderId)
        return rider ? { ...rider, seed: idx + 1 } : null
      }).filter(Boolean) as Rider[]

      // Only the top BRACKET_SIZE riders advance to the bracket
      const bracketRiders = sortedRiders.slice(0, BRACKET_SIZE)
      const bracket = buildBracket(bracketRiders)
      const riders = s.event.riders.map((r) => {
        const seeded = sortedRiders.find((sr) => sr.id === r.id)
        return seeded ?? r
      })
      const event = { ...s.event, riders, bracket, phase: 'bracket' as EventPhase }
      window.electronAPI.saveEvent(event)
      return { event }
    }),

  advanceBracket: (matchId, winnerId, raceResultId) =>
    set((s) => {
      if (!s.event) return s
      const bracket = s.event.bracket.map((round) => ({
        ...round,
        matches: round.matches.map((m) => ({ ...m }))
      }))

      let match: BracketMatch | undefined
      let roundIdx = -1
      for (let r = 0; r < bracket.length; r++) {
        const found = bracket[r].matches.find((m) => m.id === matchId)
        if (found) {
          match = found
          roundIdx = r
          break
        }
      }

      if (!match) return s
      match.winnerId = winnerId
      match.raceResultId = raceResultId

      const nextRoundIdx = roundIdx + 1
      if (nextRoundIdx < bracket.length) {
        const nextMatchIndex = Math.floor(match.matchIndex / 2)
        const slot = match.matchIndex % 2 === 0 ? 'top' : 'bottom'
        const nextMatch = bracket[nextRoundIdx].matches[nextMatchIndex]
        if (nextMatch) {
          if (slot === 'top') nextMatch.topRiderId = winnerId
          else nextMatch.bottomRiderId = winnerId
        }
      }

      const isComplete =
        roundIdx === bracket.length - 1 && bracket[bracket.length - 1].matches.every((m) => m.winnerId)

      const event = {
        ...s.event,
        bracket,
        phase: isComplete ? ('complete' as EventPhase) : s.event.phase
      }
      window.electronAPI.saveEvent(event)
      return { event }
    }),

  setCurrentRaceId: (id) =>
    set((s) => {
      if (!s.event) return s
      const event = { ...s.event, currentRaceId: id }
      return { event }
    }),

  reset: () => {
    window.electronAPI.clearEvent()
    set({ event: null })
  }
}))

// Stable fallbacks — must be module-level constants so useSyncExternalStore
// always gets the same reference when event is null (prevents infinite re-render loops).
const EMPTY_RIDERS: Rider[] = []
const EMPTY_RESULTS: RaceResult[] = []
const EMPTY_BRACKET: BracketRound[] = []
const EMPTY_CONFIG: EventConfig = { name: '', distanceMetres: DEFAULT_DISTANCE_METRES }

// Selector helpers
export const selectCurrentEvent = (s: EventState) => s.event
export const selectPhase = (s: EventState) => s.event?.phase ?? 'setup'
export const selectRiders = (s: EventState): Rider[] => s.event?.riders ?? EMPTY_RIDERS
export const selectBracket = (s: EventState): BracketRound[] => s.event?.bracket ?? EMPTY_BRACKET
export const selectQualifyingResults = (s: EventState): RaceResult[] => s.event?.qualifyingResults ?? EMPTY_RESULTS
export const selectConfig = (s: EventState): EventConfig => s.event?.config ?? EMPTY_CONFIG
