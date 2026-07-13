import { useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useEventStore, selectRiders, selectGarrettEntries, selectEventRecordWatts, selectHeroMode } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { useBluetoothStore } from '../store/bluetooth.store'
import { TrackDisplay } from '../components/TrackDisplay'
import { LineSplitDisplay } from '../components/LineSplitDisplay'
import { Countdown } from '../components/Countdown'
import { KeggersLeaderboard } from '../components/KeggersLeaderboard'
import { useAudio } from '../hooks/useAudio'
import { heroThresholdsFor } from '../lib/hero'
import type { LaneResult } from '@shared/types'

export function FreePairRace() {
  const setPhase = useEventStore((s) => s.setPhase)
  const addQualifyingResult = useEventStore((s) => s.addQualifyingResult)
  const addGarrettEntry = useEventStore((s) => s.addGarrettEntry)
  const addRider = useEventStore((s) => s.addRider)
  const riders = useEventStore(selectRiders)
  const garrettEntries = useEventStore(selectGarrettEntries)
  const eventRecordWatts = useEventStore(selectEventRecordWatts)

  const freePairRiders = useRaceStore((s) => s.freePairRiders)
  const raceStatus = useRaceStore((s) => s.race?.status ?? null)
  const countdownValue = useRaceStore((s) => s.race?.countdownValue ?? 0)
  const initRace = useRaceStore((s) => s.initRace)
  const setCountdown = useRaceStore((s) => s.setCountdown)
  const setRacing = useRaceStore((s) => s.setRacing)
  const setLaneFinished = useRaceStore((s) => s.setLaneFinished)
  const resetRace = useRaceStore((s) => s.resetRace)

  const connectedDevices = useBluetoothStore((s) => s.connectedDevices)
  const leftReady = connectedDevices['left']?.status === 'connected'
  const rightReady = connectedDevices['right']?.status === 'connected'
  const devicesReady = leftReady && rightReady

  const { playCountdownBeep, playFinishFanfare, playBuzzer } = useAudio()
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resultsRef = useRef<Partial<Record<'left' | 'right', LaneResult>>>({})
  const fanfarePlayed = useRef(false)
  const [displayFormat, setDisplayFormat] = useState<'line' | 'circle'>('circle')
  const heroMode = useEventStore(selectHeroMode)
  const [isFalseStart, setIsFalseStart] = useState(false)
  const [falseStartRiderName, setFalseStartRiderName] = useState('')
  const [buzzerEnabled, setBuzzerEnabled] = useState(true)
  const buzzerEnabledRef = useRef(true)
  buzzerEnabledRef.current = buzzerEnabled
  const falseStartFiredRef = useRef(false)
  const handleFalseStartRef = useRef<((name: string) => void) | null>(null)
  const startCountdownRef = useRef<() => void>(() => {})
  const [falseStartEnabled, setFalseStartEnabled] = useState(!import.meta.env.DEV)
  const falseStartEnabledRef = useRef(falseStartEnabled)
  falseStartEnabledRef.current = falseStartEnabled
  const WATT_THRESHOLD = 10

  // Stable per-session rider IDs — not tied to any event rider
  const leftRiderIdRef = useRef(nanoid())
  const rightRiderIdRef = useRef(nanoid())

  const leftName = freePairRiders?.leftName ?? ''
  const rightName = freePairRiders?.rightName ?? ''
  const distance = freePairRiders?.distance ?? 250
  const garrettMode = freePairRiders?.garrettMode ?? false
  const leftWeightKg = freePairRiders?.leftWeightKg
  const rightWeightKg = freePairRiders?.rightWeightKg
  const countAsQualifying = freePairRiders?.countAsQualifying ?? false
  const leftGender = freePairRiders?.leftGender
  const rightGender = freePairRiders?.rightGender
  const garrettWeights = garrettMode && leftWeightKg && rightWeightKg
    ? { left: leftWeightKg, right: rightWeightKg }
    : null
  const heroThresholds = heroMode
    ? {
        left: heroThresholdsFor(leftGender),
        right: heroThresholdsFor(rightGender),
        recordWatts: eventRecordWatts,
      }
    : null

  // If riders are missing (e.g. app restarted mid-session), bail back to bracket
  useEffect(() => {
    if (!freePairRiders) setPhase('bracket')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Non-reactive false-start detection — avoids 10 Hz re-renders
  useEffect(() => {
    return useRaceStore.subscribe((state) => {
      const lw = state.race?.left?.instantWatts ?? 0
      const rw = state.race?.right?.instantWatts ?? 0
      const isCountdown = state.race?.status === 'countdown' && (state.race?.countdownValue ?? 1) > 0
      if (falseStartEnabledRef.current && isCountdown && !falseStartFiredRef.current) {
        if (lw > WATT_THRESHOLD || rw > WATT_THRESHOLD) {
          falseStartFiredRef.current = true
          const name = lw > WATT_THRESHOLD
            ? (state.race?.left?.riderName ?? '')
            : (state.race?.right?.riderName ?? '')
          handleFalseStartRef.current?.(name)
        }
      }
    })
  }, [])

  useEffect(() => {
    const unsub = window.electronAPI.onRaceFinished(({ lane, result }) => {
      const riderId = lane === 'left' ? leftRiderIdRef.current : rightRiderIdRef.current
      const r = { ...result, riderId }
      resultsRef.current[lane] = r
      setLaneFinished(lane, r)
      if (!fanfarePlayed.current) {
        fanfarePlayed.current = true
        playFinishFanfare()
      }
    })
    return unsub
  }, [setLaneFinished, playFinishFanfare])

  const garrettSavedRef = useRef(false)

  useEffect(() => {
    if (raceStatus !== 'finished') return
    window.electronAPI.stopRace()
    if (garrettWeights && !garrettSavedRef.current) {
      garrettSavedRef.current = true
      const now = Date.now()
      const leftResult = resultsRef.current['left']
      const rightResult = resultsRef.current['right']
      if (leftResult) addGarrettEntry({ name: leftName, weightKg: garrettWeights.left, maxWatts: leftResult.maxWatts, avgWatts: leftResult.avgWatts, racedAt: now })
      if (rightResult) addGarrettEntry({ name: rightName, weightKg: garrettWeights.right, maxWatts: rightResult.maxWatts, avgWatts: rightResult.avgWatts, racedAt: now })
    }
  }, [raceStatus]) // eslint-disable-line

  useEffect(() => () => { if (countdownRef.current) clearTimeout(countdownRef.current) }, [])

  function startRace() {
    if (!leftName || !rightName) return
    fanfarePlayed.current = false
    garrettSavedRef.current = false
    resultsRef.current = {}
    const raceId = nanoid()
    initRace(
      raceId,
      { riderId: leftRiderIdRef.current, riderName: leftName },
      { riderId: rightRiderIdRef.current, riderName: rightName }
    )
    window.electronAPI.startRace(raceId, distance, ['left', 'right'])
    startCountdownRef.current()
  }

  startCountdownRef.current = () => {
    let count = 3
    setCountdown(count)
    playCountdownBeep(count)
    let lastAt = performance.now()
    function tick() {
      count -= 1
      const now = performance.now()
      const drift = now - lastAt - 1000
      lastAt = now
      if (count > 0) {
        setCountdown(count); playCountdownBeep(count)
        countdownRef.current = setTimeout(tick, Math.max(0, 1000 - drift))
      } else {
        setCountdown(0); playCountdownBeep(0)
        window.electronAPI.raceGo()
        countdownRef.current = setTimeout(() => setRacing(), 800)
      }
    }
    countdownRef.current = setTimeout(tick, 1000)
    falseStartFiredRef.current = false
  }

  handleFalseStartRef.current = (riderName: string) => {
    if (countdownRef.current) { clearTimeout(countdownRef.current); countdownRef.current = null }
    setIsFalseStart(true)
    setFalseStartRiderName(riderName)
    if (buzzerEnabledRef.current) playBuzzer()
    countdownRef.current = setTimeout(() => {
      setIsFalseStart(false)
      startCountdownRef.current()
    }, 1000)
  }

  const returnPhase = freePairRiders?.returnPhase ?? 'bracket'

  function handleDone() {
    if (countAsQualifying) {
      function findOrCreateRider(name: string, gender: 'M' | 'F' | undefined): string {
        const existing = riders.find((r) => r.name.toLowerCase() === name.toLowerCase())
        if (existing) return existing.id
        const id = nanoid()
        addRider({ id, name, gender })
        return id
      }
      const leftResult = resultsRef.current['left']
      const rightResult = resultsRef.current['right']
      if (leftResult) {
        const riderId = findOrCreateRider(leftName, leftGender)
        addQualifyingResult({
          raceId: nanoid(),
          type: 'qualifying',
          startedAt: Date.now(),
          left: { ...leftResult, riderId },
          right: null,
        })
      }
      if (rightResult) {
        const riderId = findOrCreateRider(rightName, rightGender)
        addQualifyingResult({
          raceId: nanoid(),
          type: 'qualifying',
          startedAt: Date.now(),
          left: null,
          right: { ...rightResult, riderId },
        })
      }
    }
    resetRace()
    setPhase(returnPhase)
  }

  function handleAbort() {
    if (countdownRef.current) {
      clearTimeout(countdownRef.current)
      countdownRef.current = null
    }
    fanfarePlayed.current = false
    resultsRef.current = {}
    falseStartFiredRef.current = false
    window.electronAPI.stopRace()
    resetRace()
    setIsFalseStart(false)
    setFalseStartRiderName('')
    setPhase(returnPhase)
  }

  if (!leftName || !rightName) return null

  const isIdle = raceStatus === null || raceStatus === 'idle'
  const isFinished = raceStatus === 'finished'

  const leftTime = resultsRef.current['left']?.finishTimeMs ?? Infinity
  const rightTime = resultsRef.current['right']?.finishTimeMs ?? Infinity
  const winnerIsLeft = leftTime < rightTime
  const winnerName = winnerIsLeft ? leftName : rightName
  const winnerColor = winnerIsLeft ? 'var(--lane-left)' : 'var(--lane-right)'

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center px-8 py-4 border-b border-stone-800">
        <span className="text-xs text-stone-500 uppercase tracking-widest">
          Free Pair
          {' — '}
          <span className="text-[var(--lane-left)]">{leftName}</span>
          {' vs '}
          <span className="text-[var(--lane-right)]">{rightName}</span>
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDisplayFormat((f) => f === 'line' ? 'circle' : 'line')}
            className="text-xs border border-stone-700 text-stone-400 hover:text-white hover:border-stone-500 rounded px-2 py-1 uppercase tracking-widest transition-colors"
          >
            {displayFormat === 'line' ? '◎ Circle' : '▬ Line'}
          </button>
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
          <button
            onClick={() => setBuzzerEnabled((v) => !v)}
            className={`text-xs border rounded px-2 py-1 uppercase tracking-widest transition-colors ${
              buzzerEnabled ? 'text-amber-400 border-amber-700' : 'text-stone-600 border-stone-700'
            }`}
            title="Toggle false-start buzzer"
          >
            Buzzer {buzzerEnabled ? 'ON' : 'OFF'}
          </button>
          {isIdle && (
            <button
              onClick={handleDone}
              className="text-sm text-stone-500 hover:text-white uppercase tracking-widest transition-colors"
            >
              ← Back
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

      <div className="flex-1 relative">
        {raceStatus !== null && !isFalseStart && (
          <div className="absolute inset-0 flex">
            {displayFormat === 'circle' ? (
              <TrackDisplay
                left={{ riderName: leftName }}
                right={{ riderName: rightName }}
                targetDistance={distance}
                garrettWeights={garrettWeights}
                heroThresholds={heroThresholds}
              />
            ) : (
              <LineSplitDisplay
                left={{ riderName: leftName }}
                right={{ riderName: rightName }}
                targetDistance={distance}
                heroThresholds={heroThresholds}
              />
            )}
          </div>
        )}

        {isIdle && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              {!devicesReady && (
                <div className="text-amber-400 text-sm uppercase tracking-widest">
                  {!leftReady && !rightReady ? 'No devices connected' : !leftReady ? 'Left lane not connected' : 'Right lane not connected'}
                </div>
              )}
              <button
                onClick={startRace}
                disabled={!devicesReady}
                className="px-16 py-6 bg-[var(--accent)] hover:bg-[var(--accent-h)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--accent-fg)] text-3xl font-bold tracking-widest uppercase rounded-xl transition-colors shadow-2xl"
              >
                START RACE
              </button>
            </div>
          </div>
        )}

        {raceStatus === 'countdown' && !isFalseStart && <Countdown value={countdownValue} />}

        {isFalseStart && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/80">
            <div className="flex flex-col items-center gap-4">
              <div className="text-red-400 text-7xl font-black uppercase tracking-widest">False Start</div>
              <div className="text-white text-3xl font-bold">{falseStartRiderName}</div>
            </div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
            <div className="flex flex-col items-center gap-6">
              <div className="text-6xl font-black uppercase tracking-widest" style={{ color: winnerColor }}>
                {winnerName} Wins!
              </div>

              {garrettWeights && (
                <div className="flex gap-12">
                  {([
                    { name: leftName, result: resultsRef.current['left'], weight: garrettWeights.left, color: 'var(--lane-left)' },
                    { name: rightName, result: resultsRef.current['right'], weight: garrettWeights.right, color: 'var(--lane-right)' },
                  ] as const).map(({ name, result, weight, color }) => (
                    <div key={name} className="flex flex-col items-center gap-1">
                      <span className="text-sm font-bold uppercase tracking-widest" style={{ color }}>{name}</span>
                      <span className="text-3xl font-black text-amber-400 tabular-nums">
                        {result ? (result.avgWatts / weight).toFixed(2) : '—'}
                        <span className="text-lg text-stone-400 font-normal"> avg W/kg</span>
                      </span>
                      <span className="text-xl font-bold text-stone-300 tabular-nums">
                        {result ? (result.maxWatts / weight).toFixed(2) : '—'}
                        <span className="text-sm text-stone-500 font-normal"> max W/kg</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {garrettWeights && garrettEntries.length > 0 && (
                <div className="w-72 bg-stone-950 rounded-xl p-4">
                  <div className="text-xs text-stone-500 uppercase tracking-widest mb-2 text-center">Keggers</div>
                  <KeggersLeaderboard entries={garrettEntries} highlightNames={[leftName, rightName]} />
                </div>
              )}

              <button
                onClick={handleDone}
                className="px-12 py-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-xl font-bold tracking-widest uppercase rounded-lg transition-colors"
              >
                {returnPhase === 'bracket' ? 'Back to Bracket →' : 'Back →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
