import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  EventData,
  EventPhase,
  EventConfig,
  Rider,
  RaceResult,
  BracketRound,
  BracketMatch,
  BracketPool
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
  setRiderGender: (riderId: string, gender: 'M' | 'F') => void
  addQualifyingResult: (result: RaceResult) => void
  removeQualifyingResult: (riderId: string) => void
  addBracketResult: (result: RaceResult) => void
  moveRiderToEnd: (riderId: string) => void
  generateBracket: () => void
  generateCustomBracket: (names: string[]) => void
  advanceBracket: (matchId: string, winnerId: string, raceResultId: string, pool: BracketPool) => void
  setCurrentRaceId: (id: string | null) => void
  reset: () => void
}

function bracketPositions(size: number): number[] {
  if (size === 1) return [1]
  const half = bracketPositions(size / 2)
  return half.flatMap((s) => [s, size + 1 - s])
}

function propagateByes(rounds: BracketRound[]): void {
  for (let r = 0; r + 1 < rounds.length; r++) {
    for (const match of rounds[r].matches) {
      if (!match.winnerId) continue
      const nextIdx = Math.floor(match.matchIndex / 2)
      const slot = match.matchIndex % 2 === 0 ? 'top' : 'bottom'
      const next = rounds[r + 1].matches[nextIdx]
      if (!next) continue
      if (slot === 'top' && !next.topRiderId) next.topRiderId = match.winnerId
      if (slot === 'bottom' && !next.bottomRiderId) next.bottomRiderId = match.winnerId
    }
    // Auto-advance any match in round r+1 where the opposite feeder has no riders
    for (const match of rounds[r + 1].matches) {
      if (match.winnerId) continue
      const feedA = rounds[r].matches[match.matchIndex * 2]
      const feedB = rounds[r].matches[match.matchIndex * 2 + 1]
      const aEmpty = !feedA || (!feedA.topRiderId && !feedA.bottomRiderId)
      const bEmpty = !feedB || (!feedB.topRiderId && !feedB.bottomRiderId)
      if (match.topRiderId && bEmpty) match.winnerId = match.topRiderId
      else if (match.bottomRiderId && aEmpty) match.winnerId = match.bottomRiderId
    }
  }
}

export function buildBracket(riders: Rider[]): BracketRound[] {
  const riderCount = riders.length
  if (riderCount === 0) return []

  let bracketSize = BRACKET_SIZE
  while (bracketSize < riderCount) bracketSize *= 2

  const positions = bracketPositions(bracketSize)
  const numRounds = Math.log2(bracketSize)
  const matchCount = bracketSize / 2

  const rounds: BracketRound[] = []

  const firstRound: BracketMatch[] = []
  for (let i = 0; i < matchCount; i++) {
    const topSeed = positions[i * 2]
    const bottomSeed = positions[i * 2 + 1]
    const topRider = topSeed <= riderCount ? riders[topSeed - 1] : null
    const bottomRider = bottomSeed <= riderCount ? riders[bottomSeed - 1] : null
    const winnerId = !topRider ? (bottomRider?.id ?? null) : !bottomRider ? topRider.id : null
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
  rounds.push({ round: 0, matches: firstRound })

  for (let r = 1; r < numRounds; r++) {
    const n = matchCount / Math.pow(2, r)
    rounds.push({
      round: r,
      matches: Array.from({ length: n }, (_, i) => ({
        id: nanoid(),
        round: r,
        matchIndex: i,
        topRiderId: null,
        bottomRiderId: null,
        winnerId: null,
        raceResultId: null
      }))
    })
  }

  propagateByes(rounds)

  // Only add 3rd place match when at least one SF needs to be played (≥3 real riders)
  if (numRounds >= 2 && riderCount >= 3) {
    rounds[rounds.length - 1].matches.push({
      id: nanoid(),
      round: numRounds - 1,
      matchIndex: 1,
      topRiderId: null,
      bottomRiderId: null,
      winnerId: null,
      raceResultId: null,
      isThirdPlace: true
    })
  }

  return rounds
}

function sortedRidersForPool(
  results: RaceResult[],
  riders: Rider[],
  pool: BracketPool
): Rider[] {
  const poolIds = new Set(
    riders
      .filter((r) => (pool === 'Open' ? !r.gender : r.gender === pool))
      .map((r) => r.id)
  )
  return results
    .filter((r) => {
      const id = r.left?.riderId ?? r.right?.riderId
      return id && poolIds.has(id)
    })
    .sort((a, b) => {
      const aT = a.left?.finishTimeMs ?? a.right?.finishTimeMs ?? Infinity
      const bT = b.left?.finishTimeMs ?? b.right?.finishTimeMs ?? Infinity
      return aT - bT
    })
    .map((r) => {
      const id = r.left?.riderId ?? r.right?.riderId ?? ''
      return riders.find((rd) => rd.id === id)!
    })
    .filter(Boolean)
}

function isDone(bracket: BracketRound[]): boolean {
  if (bracket.length === 0) return true
  return bracket[bracket.length - 1].matches.every((m) => m.winnerId)
}

export const useEventStore = create<EventState>((set, _get) => ({
  event: null,

  initEvent: (config) => {
    const event: EventData = {
      id: nanoid(),
      config,
      riders: [],
      qualifyingResults: [],
      bracketResults: [],
      bracket: [],
      bracketF: [],
      bracketOpen: [],
      currentRaceId: null,
      phase: 'registration'
    }
    set({ event })
    window.electronAPI.saveEvent(event)
  },

  setEvent: (event) => set({ event: { ...event, bracketF: event.bracketF ?? [], bracketOpen: event.bracketOpen ?? [], bracketResults: event.bracketResults ?? [] } }),

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

  setRiderGender: (riderId, gender) =>
    set((s) => {
      if (!s.event) return s
      const riders = s.event.riders.map((r) => (r.id === riderId ? { ...r, gender } : r))
      const event = { ...s.event, riders }
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

  addBracketResult: (result) =>
    set((s) => {
      if (!s.event) return s
      const bracketResults = [...s.event.bracketResults, result]
      const event = { ...s.event, bracketResults }
      window.electronAPI.saveEvent(event)
      return { event }
    }),

  moveRiderToEnd: (riderId) =>
    set((s) => {
      if (!s.event) return s
      const rider = s.event.riders.find((r) => r.id === riderId)
      if (!rider) return s
      const riders = [...s.event.riders.filter((r) => r.id !== riderId), rider]
      const event = { ...s.event, riders }
      window.electronAPI.saveEvent(event)
      return { event }
    }),

  generateBracket: () =>
    set((s) => {
      if (!s.event) return s
      const { riders, qualifyingResults } = s.event
      const anyGender = riders.some((r) => r.gender)

      if (!anyGender) {
        const sorted = sortedRidersForPool(qualifyingResults, riders, 'Open').map((r, i) => ({ ...r, seed: i + 1 }))
        const bracket = buildBracket(sorted.slice(0, BRACKET_SIZE))
        const updatedRiders = riders.map((r) => sorted.find((sr) => sr.id === r.id) ?? r)
        const event = { ...s.event, riders: updatedRiders, bracket, bracketF: [], bracketOpen: [], phase: 'bracket' as EventPhase }
        window.electronAPI.saveEvent(event)
        return { event }
      }

      const mSorted = sortedRidersForPool(qualifyingResults, riders, 'M').map((r, i) => ({ ...r, seed: i + 1 }))
      const fSorted = sortedRidersForPool(qualifyingResults, riders, 'F').map((r, i) => ({ ...r, seed: i + 1 }))
      const openSorted = sortedRidersForPool(qualifyingResults, riders, 'Open').map((r, i) => ({ ...r, seed: i + 1 }))

      const bracket = buildBracket(mSorted.slice(0, BRACKET_SIZE))
      const bracketF = buildBracket(fSorted.slice(0, BRACKET_SIZE))
      const bracketOpen = buildBracket(openSorted.slice(0, BRACKET_SIZE))

      const allSeeded = [...mSorted, ...fSorted, ...openSorted]
      const updatedRiders = riders.map((r) => allSeeded.find((sr) => sr.id === r.id) ?? r)

      const event = { ...s.event, riders: updatedRiders, bracket, bracketF, bracketOpen, phase: 'bracket' as EventPhase }
      window.electronAPI.saveEvent(event)
      return { event }
    }),

  generateCustomBracket: (names) =>
    set((s) => {
      if (!s.event) return s
      const riders: Rider[] = names.map((name) => ({ id: nanoid(), name }))
      const bracket = buildBracket(riders)
      const event = {
        ...s.event,
        riders,
        bracket,
        bracketF: [],
        bracketOpen: [],
        qualifyingResults: [],
        bracketResults: [],
        phase: 'bracket' as EventPhase
      }
      window.electronAPI.saveEvent(event)
      return { event }
    }),

  advanceBracket: (matchId, winnerId, raceResultId, pool) =>
    set((s) => {
      if (!s.event) return s

      const src = pool === 'M' ? s.event.bracket
        : pool === 'F' ? s.event.bracketF
        : s.event.bracketOpen

      const bracket = src.map((round) => ({
        ...round,
        matches: round.matches.map((m) => ({ ...m }))
      }))

      let match: BracketMatch | undefined
      let roundIdx = -1
      for (let r = 0; r < bracket.length; r++) {
        const found = bracket[r].matches.find((m) => m.id === matchId)
        if (found) { match = found; roundIdx = r; break }
      }
      if (!match) return s

      match.winnerId = winnerId
      match.raceResultId = raceResultId

      const nextRoundIdx = roundIdx + 1
      if (nextRoundIdx < bracket.length) {
        const nextMatchIdx = Math.floor(match.matchIndex / 2)
        const slot = match.matchIndex % 2 === 0 ? 'top' : 'bottom'
        const nextMatch = bracket[nextRoundIdx].matches[nextMatchIdx]
        if (nextMatch) {
          if (slot === 'top') nextMatch.topRiderId = winnerId
          else nextMatch.bottomRiderId = winnerId
        }

        const thirdPlaceMatch = bracket[nextRoundIdx].matches.find((m) => m.isThirdPlace)
        if (thirdPlaceMatch) {
          const loserId = match.topRiderId === winnerId ? match.bottomRiderId : match.topRiderId
          if (loserId) {
            if (slot === 'top' && !thirdPlaceMatch.topRiderId) thirdPlaceMatch.topRiderId = loserId
            else if (slot === 'bottom' && !thirdPlaceMatch.bottomRiderId) thirdPlaceMatch.bottomRiderId = loserId
          }
          // Auto-advance 3rd place only once ALL current-round matches are decided
          // (guards against premature advance when second SF hasn't run yet)
          const allFeedersDone = bracket[roundIdx].matches.every((m) => m.winnerId)
          if (allFeedersDone && !thirdPlaceMatch.winnerId) {
            if (thirdPlaceMatch.topRiderId && !thirdPlaceMatch.bottomRiderId)
              thirdPlaceMatch.winnerId = thirdPlaceMatch.topRiderId
            else if (thirdPlaceMatch.bottomRiderId && !thirdPlaceMatch.topRiderId)
              thirdPlaceMatch.winnerId = thirdPlaceMatch.bottomRiderId
          }
        }
      }

      const mB = pool === 'M' ? bracket : s.event.bracket
      const fB = pool === 'F' ? bracket : s.event.bracketF
      const oB = pool === 'Open' ? bracket : s.event.bracketOpen
      const isComplete = isDone(mB) && isDone(fB) && isDone(oB)

      const event = {
        ...s.event,
        bracket: pool === 'M' ? bracket : s.event.bracket,
        bracketF: pool === 'F' ? bracket : s.event.bracketF,
        bracketOpen: pool === 'Open' ? bracket : s.event.bracketOpen,
        phase: isComplete ? ('complete' as EventPhase) : s.event.phase
      }
      window.electronAPI.saveEvent(event)
      return { event }
    }),

  setCurrentRaceId: (id) =>
    set((s) => {
      if (!s.event) return s
      return { event: { ...s.event, currentRaceId: id } }
    }),

  reset: () => {
    window.electronAPI.clearEvent()
    set({ event: null })
  }
}))

// Stable fallbacks — module-level constants prevent infinite re-render loops when event is null
const EMPTY_RIDERS: Rider[] = []
const EMPTY_RESULTS: RaceResult[] = []
const EMPTY_BRACKET: BracketRound[] = []
const EMPTY_CONFIG: EventConfig = { name: '', distanceMetres: DEFAULT_DISTANCE_METRES }

export const selectCurrentEvent = (s: EventState) => s.event
export const selectPhase = (s: EventState) => s.event?.phase ?? 'setup'
export const selectRiders = (s: EventState): Rider[] => s.event?.riders ?? EMPTY_RIDERS
export const selectBracket = (s: EventState): BracketRound[] => s.event?.bracket ?? EMPTY_BRACKET
export const selectBracketF = (s: EventState): BracketRound[] => s.event?.bracketF ?? EMPTY_BRACKET
export const selectBracketOpen = (s: EventState): BracketRound[] => s.event?.bracketOpen ?? EMPTY_BRACKET
export const selectQualifyingResults = (s: EventState): RaceResult[] => s.event?.qualifyingResults ?? EMPTY_RESULTS
export const selectBracketResults = (s: EventState): RaceResult[] => s.event?.bracketResults ?? EMPTY_RESULTS
export const selectConfig = (s: EventState): EventConfig => s.event?.config ?? EMPTY_CONFIG
export const selectHasGenderSplit = (s: EventState): boolean =>
  s.event?.riders.some((r) => r.gender !== undefined) ?? false
