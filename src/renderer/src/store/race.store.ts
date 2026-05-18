import { create } from 'zustand'
import type { ActiveRaceState, Lane, LaneResult, LiveLaneState, TelemetryFrame } from '@shared/types'

interface RaceState {
  race: ActiveRaceState | null

  initRace: (raceId: string, left: { riderId: string; riderName: string } | null, right: { riderId: string; riderName: string } | null) => void
  setCountdown: (value: number | null) => void
  setRacing: () => void
  applyTelemetry: (frame: TelemetryFrame) => void
  setLaneFinished: (lane: Lane, result: LaneResult) => void
  resetRace: () => void
}

function makeLane(rider: { riderId: string; riderName: string }): LiveLaneState {
  return {
    riderId: rider.riderId,
    riderName: rider.riderName,
    distanceCovered: 0,
    instantWatts: 0,
    cadenceRpm: 0,
    elapsedMs: 0,
    finished: false,
    result: null
  }
}

export const useRaceStore = create<RaceState>((set) => ({
  race: null,

  initRace: (raceId, left, right) =>
    set({
      race: {
        raceId,
        status: 'countdown',
        countdownValue: 3,
        startedAt: null,
        left: left ? makeLane(left) : null,
        right: right ? makeLane(right) : null
      }
    }),

  setCountdown: (value) =>
    set((s) => {
      if (!s.race) return s
      return { race: { ...s.race, countdownValue: value } }
    }),

  setRacing: () =>
    set((s) => {
      if (!s.race) return s
      return {
        race: {
          ...s.race,
          status: 'racing',
          countdownValue: null,
          startedAt: Date.now()
        }
      }
    }),

  applyTelemetry: (frame) =>
    set((s) => {
      if (!s.race) return s
      const { status } = s.race
      if (status !== 'racing' && status !== 'countdown') return s
      const lane = frame.lane
      const existing = s.race[lane]
      if (!existing || existing.finished) return s
      return {
        race: {
          ...s.race,
          [lane]: {
            ...existing,
            // During countdown the main process sends distanceCovered=0; honour it
            // so position never advances before GO fires.
            distanceCovered: frame.distanceCovered,
            instantWatts: frame.instantWatts,
            cadenceRpm: frame.cadenceRpm,
            elapsedMs: frame.elapsedMs
          }
        }
      }
    }),

  setLaneFinished: (lane, result) =>
    set((s) => {
      if (!s.race) return s
      const existing = s.race[lane]
      if (!existing) return s
      const updatedLane: LiveLaneState = {
        ...existing,
        distanceCovered: result.distanceMetres,
        elapsedMs: result.finishTimeMs,
        finished: true,
        result
      }
      const newRace = { ...s.race, [lane]: updatedLane }
      const bothFinished =
        (newRace.left?.finished ?? true) && (newRace.right?.finished ?? true)
      return { race: { ...newRace, status: bothFinished ? 'finished' : 'racing' } }
    }),

  resetRace: () => set({ race: null })
}))
