import { useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useEventStore, selectRiders, selectQualifyingResults } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { Countdown } from '../components/Countdown'
import { TrackDisplay } from '../components/TrackDisplay'
import { LineSplitDisplay } from '../components/LineSplitDisplay'
import { useAudio } from '../hooks/useAudio'
import type { LaneResult } from '@shared/types'

const WATT_THRESHOLD = 10

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export function QualSplitDisplay() {
  const riders = useEventStore(selectRiders)
  const existingResults = useEventStore(selectQualifyingResults)
  const addQualifyingResult = useEventStore((s) => s.addQualifyingResult)
  const moveRiderToEnd = useEventStore((s) => s.moveRiderToEnd)
  const setPhase = useEventStore((s) => s.setPhase)

  const qualRiders = useRaceStore((s) => s.qualRiders)
  const raceStatus = useRaceStore((s) => s.race?.status ?? null)
  const countdownValue = useRaceStore((s) => s.race?.countdownValue ?? 0)
  const initRace = useRaceStore((s) => s.initRace)
  const setCountdown = useRaceStore((s) => s.setCountdown)
  const setRacing = useRaceStore((s) => s.setRacing)
  const setLaneFinished = useRaceStore((s) => s.setLaneFinished)
  const resetRace = useRaceStore((s) => s.resetRace)

  const { playCountdownBeep, playFinishFanfare, playBuzzer } = useAudio()

  const [displayFormat, setDisplayFormat] = useState<'line' | 'circle'>('line')
  const [isFalseStart, setIsFalseStart] = useState(false)
  const [falseStartRiderName, setFalseStartRiderName] = useState('')
  const [buzzerEnabled, setBuzzerEnabled] = useState(true)
  const buzzerEnabledRef = useRef(true)
  buzzerEnabledRef.current = buzzerEnabled
  const [falseStartEnabled, setFalseStartEnabled] = useState(true)
  const falseStartEnabledRef = useRef(falseStartEnabled)
  falseStartEnabledRef.current = falseStartEnabled
  const falseStartFiredRef = useRef(false)
  const [leftResult, setLeftResult] = useState<LaneResult | null>(null)
  const [rightResult, setRightResult] = useState<LaneResult | null>(null)
  const [showResult, setShowResult] = useState(false)
  const finishHandledRef = useRef(false)
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const raceIdRef = useRef('')
  const handleFalseStartRef = useRef<((name: string) => void) | null>(null)
  const startCountdownRef = useRef<() => void>(() => {})
  const qualRidersRef = useRef(qualRiders)
  const isSoloRef = useRef(!qualRiders?.rightRiderId)

  // Navigate back if no rider context
  useEffect(() => {
    if (!qualRiders) setPhase('qualifying')
  }, []) // eslint-disable-line

  // Start the race immediately on mount
  useEffect(() => {
    if (!qualRiders) return
    const raceId = nanoid()
    raceIdRef.current = raceId
    initRace(
      raceId,
      { riderId: qualRiders.leftRiderId, riderName: qualRiders.leftName },
      qualRiders.rightRiderId
        ? { riderId: qualRiders.rightRiderId, riderName: qualRiders.rightName! }
        : null
    )
    window.electronAPI.startRace(
      raceId,
      qualRiders.distance,
      qualRiders.rightRiderId ? ['left', 'right'] : ['left']
    )
    startCountdownRef.current()
  }, []) // eslint-disable-line

  // False start detection
  useEffect(() => {
    return useRaceStore.subscribe((state) => {
      const lw = state.race?.left?.instantWatts ?? 0
      const rw = state.race?.right?.instantWatts ?? 0
      const isCountdown = state.race?.status === 'countdown' && (state.race?.countdownValue ?? 1) > 0
      if (falseStartEnabledRef.current && isCountdown && !falseStartFiredRef.current) {
        const falseLeft  = lw > WATT_THRESHOLD
        const falseRight = !isSoloRef.current && rw > WATT_THRESHOLD
        if (falseLeft || falseRight) {
          falseStartFiredRef.current = true
          const name = falseLeft
            ? (state.race?.left?.riderName ?? '')
            : (state.race?.right?.riderName ?? '')
          handleFalseStartRef.current?.(name)
        }
      }
    })
  }, [])

  // Handle race finished
  useEffect(() => {
    if (raceStatus === 'finished' && !finishHandledRef.current) {
      finishHandledRef.current = true
      playFinishFanfare()
      setShowResult(true)
      window.electronAPI.stopRace()
    }
  }, [raceStatus, playFinishFanfare])

  // Lane finish events
  useEffect(() => {
    const unsub = window.electronAPI.onRaceFinished(({ lane, result }) => {
      const qr = qualRidersRef.current
      if (!qr) return
      if (lane === 'left') {
        const laneResult = { ...result, riderId: qr.leftRiderId }
        setLaneFinished('left', laneResult)
        setLeftResult(laneResult)
      } else if (lane === 'right' && qr.rightRiderId) {
        const laneResult = { ...result, riderId: qr.rightRiderId }
        setLaneFinished('right', laneResult)
        setRightResult(laneResult)
      }
    })
    return unsub
  }, [setLaneFinished])

  useEffect(() => () => { if (countdownRef.current) clearTimeout(countdownRef.current) }, [])

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

  function saveAndAdvance() {
    const raceId = raceIdRef.current
    const now = Date.now()
    if (leftResult) {
      addQualifyingResult({ raceId: `${raceId}-L`, type: 'qualifying', startedAt: now, left: leftResult, right: null })
    }
    if (rightResult) {
      addQualifyingResult({ raceId: `${raceId}-R`, type: 'qualifying', startedAt: now, left: null, right: rightResult })
    }
    resetRace()
    setPhase('qualifying')
  }

  function handleRetry() {
    const qr = qualRidersRef.current
    if (qr?.leftRiderId) moveRiderToEnd(qr.leftRiderId)
    if (qr?.rightRiderId) moveRiderToEnd(qr.rightRiderId)
    resetRace()
    setPhase('qualifying')
  }

  function handleAbort() {
    if (countdownRef.current) { clearTimeout(countdownRef.current); countdownRef.current = null }
    window.electronAPI.stopRace()
    resetRace()
    setPhase('qualifying')
  }

  if (!qualRiders) return null

  const leftRiderName = qualRiders.leftName
  const rightRiderName = qualRiders.rightName

  const completedIds = new Set(
    existingResults.flatMap((r) => [r.left?.riderId, r.right?.riderId].filter((id): id is string => !!id))
  )
  const remainingAfterSave = riders.filter(
    (r) => !completedIds.has(r.id) && r.id !== qualRiders.leftRiderId && r.id !== (qualRiders.rightRiderId ?? '')
  ).length

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center px-8 py-3 border-b border-stone-800">
        <span className="text-xs text-stone-500 uppercase tracking-widest">
          Qualifying · {qualRiders.distance}m
          {' — '}
          <span className="text-[var(--lane-left)]">{leftRiderName}</span>
          {rightRiderName && (
            <>{' vs '}<span className="text-[var(--lane-right)]">{rightRiderName}</span></>
          )}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDisplayFormat((f) => f === 'line' ? 'circle' : 'line')}
            className="text-xs border border-stone-700 text-stone-400 hover:text-white hover:border-stone-500 rounded px-2 py-1 uppercase tracking-widest transition-colors"
          >
            {displayFormat === 'line' ? '◎ Circle' : '▬ Line'}
          </button>
          <button
            onClick={() => setFalseStartEnabled((v) => !v)}
            className={`text-xs border rounded px-2 py-1 uppercase tracking-widest transition-colors ${
              falseStartEnabled
                ? 'text-[var(--accent)] border-[var(--accent)] accent-tint'
                : 'text-stone-600 border-stone-700'
            }`}
          >
            False Start {falseStartEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setBuzzerEnabled((v) => !v)}
            className={`text-xs border rounded px-2 py-1 uppercase tracking-widest transition-colors ${
              buzzerEnabled ? 'text-amber-400 border-amber-700' : 'text-stone-600 border-stone-700'
            }`}
          >
            Buzzer {buzzerEnabled ? 'ON' : 'OFF'}
          </button>
          {!showResult && (
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
        <div className="absolute inset-0 flex overflow-hidden">
          {displayFormat === 'line' ? (
            <LineSplitDisplay
              left={{ riderName: leftRiderName }}
              right={rightRiderName ? { riderName: rightRiderName } : null}
              targetDistance={qualRiders.distance}
            />
          ) : (
            <TrackDisplay
              left={{ riderName: leftRiderName }}
              right={rightRiderName ? { riderName: rightRiderName } : null}
              targetDistance={qualRiders.distance}
            />
          )}
        </div>

        {raceStatus === 'countdown' && !isFalseStart && <Countdown value={countdownValue} />}

        {isFalseStart && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/80">
            <div className="flex flex-col items-center gap-4">
              <div className="text-red-400 text-7xl font-black uppercase tracking-widest">False Start</div>
              <div className="text-white text-3xl font-bold">{falseStartRiderName}</div>
            </div>
          </div>
        )}

        {showResult && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
            <div className="flex flex-col items-center gap-8 w-full px-16">
              <div className="text-green-400 text-4xl font-bold uppercase tracking-widest">Finished!</div>
              <div className="flex gap-12 justify-center w-full">
                {leftResult && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-2xl font-black uppercase tracking-widest" style={{ color: 'var(--lane-left)' }}>
                      {leftRiderName}
                    </div>
                    <div className="text-7xl font-black text-white tabular-nums">
                      {fmt(leftResult.finishTimeMs)}
                    </div>
                    <div className="flex gap-6 text-lg text-stone-400">
                      <span>Avg: <strong className="text-[var(--accent)]">{leftResult.avgWatts}W</strong></span>
                      <span>Max: <strong className="text-amber-300">{leftResult.maxWatts}W</strong></span>
                    </div>
                  </div>
                )}
                {leftResult && rightResult && <div className="w-px bg-stone-800 self-stretch" />}
                {rightResult && rightRiderName && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-2xl font-black uppercase tracking-widest" style={{ color: 'var(--lane-right)' }}>
                      {rightRiderName}
                    </div>
                    <div className="text-7xl font-black text-white tabular-nums">
                      {fmt(rightResult.finishTimeMs)}
                    </div>
                    <div className="flex gap-6 text-lg text-stone-400">
                      <span>Avg: <strong className="text-[var(--accent)]">{rightResult.avgWatts}W</strong></span>
                      <span>Max: <strong className="text-amber-300">{rightResult.maxWatts}W</strong></span>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={saveAndAdvance}
                className="px-12 py-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
              >
                {remainingAfterSave === 0 ? 'See Results →' : 'Next Pair →'}
              </button>
              <button
                onClick={handleRetry}
                className="text-stone-500 hover:text-stone-300 text-sm uppercase tracking-widest transition-colors"
              >
                ↺ Retry (go to end of queue)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
