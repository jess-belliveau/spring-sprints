import { useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useEventStore, selectRiders, selectBracket, selectConfig } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { TrackDisplay } from '../components/TrackDisplay'
import { Countdown } from '../components/Countdown'
import { useAudio } from '../hooks/useAudio'
import type { LaneResult } from '@shared/types'

export function HeadToHead() {
  const riders = useEventStore(selectRiders)
  const bracket = useEventStore(selectBracket)
  const config = useEventStore(selectConfig)
  const currentRaceId = useEventStore((s) => s.event?.currentRaceId)
  const advanceBracket = useEventStore((s) => s.advanceBracket)
  const setPhase = useEventStore((s) => s.setPhase)

  const race = useRaceStore((s) => s.race)
  const initRace = useRaceStore((s) => s.initRace)
  const setCountdown = useRaceStore((s) => s.setCountdown)
  const setRacing = useRaceStore((s) => s.setRacing)
  const setLaneFinished = useRaceStore((s) => s.setLaneFinished)
  const resetRace = useRaceStore((s) => s.resetRace)

  const { playCountdownBeep, playFinishFanfare } = useAudio()
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const internalRaceIdRef = useRef<string>('')
  const resultsRef = useRef<Partial<Record<'left' | 'right', LaneResult>>>({})
  const fanfarePlayed = useRef(false)
  const heldRef = useRef(false)
  const [countdownHeld, setCountdownHeld] = useState(false)
  const [falseStartEnabled, setFalseStartEnabled] = useState(!import.meta.env.DEV)

  const WATT_THRESHOLD = 10
  const leftWatts = race?.left?.instantWatts ?? 0
  const rightWatts = race?.right?.instantWatts ?? 0
  const shouldHold = falseStartEnabled && race?.status === 'countdown' &&
    (leftWatts > WATT_THRESHOLD || rightWatts > WATT_THRESHOLD)
  heldRef.current = shouldHold
  if (shouldHold !== countdownHeld) setCountdownHeld(shouldHold)

  const currentMatch = bracket.flatMap((r) => r.matches).find((m) => m.id === currentRaceId) ?? null
  const leftRider = riders.find((r) => r.id === currentMatch?.topRiderId)
  const rightRider = riders.find((r) => r.id === currentMatch?.bottomRiderId)

  useEffect(() => {
    const unsub = window.electronAPI.onRaceFinished(({ lane, result }) => {
      const rider = lane === 'left' ? leftRider : rightRider
      const r = { ...result, riderId: rider?.id ?? '' }
      resultsRef.current[lane] = r
      setLaneFinished(lane, r)
      if (!fanfarePlayed.current) {
        fanfarePlayed.current = true
        playFinishFanfare()
      }
    })
    return unsub
  }, [leftRider, rightRider, setLaneFinished, playFinishFanfare])

  useEffect(() => {
    if (race?.status !== 'finished') return
    window.electronAPI.stopRace()

    const left = resultsRef.current['left'] ?? null
    const right = resultsRef.current['right'] ?? null
    const leftTime = left?.finishTimeMs ?? Infinity
    const rightTime = right?.finishTimeMs ?? Infinity
    const winnerId = leftTime < rightTime ? leftRider?.id : rightRider?.id

    if (currentMatch && winnerId) {
      advanceBracket(currentMatch.id, winnerId, internalRaceIdRef.current)
    }
  }, [race?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  function startRace() {
    if (!leftRider || !rightRider) return
    fanfarePlayed.current = false
    resultsRef.current = {}
    const raceId = nanoid()
    internalRaceIdRef.current = raceId
    initRace(
      raceId,
      { riderId: leftRider.id, riderName: leftRider.name },
      { riderId: rightRider.id, riderName: rightRider.name }
    )
    window.electronAPI.startRace(raceId, config.distanceMetres, ['left', 'right'])

    let count = 3
    setCountdown(count)
    countdownRef.current = setInterval(() => {
      if (heldRef.current) return // false start — hold this tick
      count -= 1
      if (count >= 0) { setCountdown(count); playCountdownBeep(count) }
      if (count < 0) {
        clearInterval(countdownRef.current!)
        window.electronAPI.raceGo()
        setRacing()
      }
    }, 1000)
  }

  function handleBackToBracket() {
    resetRace()
    setPhase('bracket')
  }

  function handleAbort() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    fanfarePlayed.current = false
    resultsRef.current = {}
    window.electronAPI.stopRace()
    resetRace()
    setPhase('bracket')
  }

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current) }, [])

  if (!currentMatch || !leftRider || !rightRider) {
    return (
      <div className="flex items-center justify-center h-full text-stone-400">
        No match configured
      </div>
    )
  }

  const isIdle = !race || race.status === 'idle'
  const isFinished = race?.status === 'finished'

  const leftTime = resultsRef.current['left']?.finishTimeMs ?? Infinity
  const rightTime = resultsRef.current['right']?.finishTimeMs ?? Infinity
  const winnerName = leftTime < rightTime ? leftRider.name : rightRider.name

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center px-8 py-4 border-b border-stone-800">
        <span className="text-xs text-stone-500 uppercase tracking-widest">
          Round {currentMatch.round + 1} · Match {currentMatch.matchIndex + 1}
          {' — '}
          <span className="text-[var(--lane-left)]">{leftRider.name}</span>
          {' vs '}
          <span className="text-[var(--lane-right)]">{rightRider.name}</span>
        </span>
        <div className="flex items-center gap-3">
          {import.meta.env.DEV && (
            <button
              onClick={() => setFalseStartEnabled((v) => !v)}
              className={`text-xs border rounded px-2 py-1 uppercase tracking-widest transition-colors ${
                falseStartEnabled
                  ? 'text-[var(--accent)] border-[var(--accent)] accent-tint'
                  : 'text-stone-600 border-stone-700'
              }`}
              title="Toggle false-start detection (dev only)"
            >
              False Start {falseStartEnabled ? 'ON' : 'OFF'}
            </button>
          )}
          {!isIdle && !isFinished && (
            <button
              onClick={handleAbort}
              className="text-sm text-red-500 hover:text-red-300 border border-red-900 hover:border-red-600 rounded px-3 py-1 uppercase tracking-widest transition-colors"
            >
              Abort Race
            </button>
          )}
        </div>
      </div>

      {/* Race area */}
      <div className="flex-1 relative">
        {/* Track — shown once race has started */}
        {race && (
          <div className="absolute inset-0 flex">
            <TrackDisplay
              left={race.left}
              right={race.right}
              targetDistance={config.distanceMetres}
            />
          </div>
        )}

        {/* Start button — before race begins */}
        {isIdle && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <button
              onClick={startRace}
              className="px-16 py-6 bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-3xl font-bold tracking-widest uppercase rounded-xl transition-colors shadow-2xl"
            >
              START RACE
            </button>
          </div>
        )}

        {/* Countdown overlay */}
        {race?.status === 'countdown' && !countdownHeld && <Countdown value={race.countdownValue} />}

        {/* False-start hold overlay */}
        {countdownHeld && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/60">
            <div className="flex flex-col items-center gap-4">
              <div className="text-red-400 text-6xl font-black uppercase tracking-widest">Hold!</div>
              <div className="text-stone-300 text-xl">Stop pedaling to resume countdown</div>
              <div className="flex gap-12 text-2xl font-bold tabular-nums">
                {leftWatts > WATT_THRESHOLD && (
                  <span className="text-[var(--lane-left)]">{leftRider?.name}: {leftWatts}W</span>
                )}
                {rightWatts > WATT_THRESHOLD && (
                  <span className="text-[var(--lane-right)]">{rightRider?.name}: {rightWatts}W</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Winner overlay */}
        {isFinished && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
            <div className="flex flex-col items-center gap-6">
              <div className="text-[var(--accent)] text-6xl font-black uppercase tracking-widest">
                {winnerName} Wins!
              </div>
              <button
                onClick={handleBackToBracket}
                className="px-12 py-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-xl font-bold tracking-widest uppercase rounded-lg transition-colors"
              >
                Back to Bracket →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
