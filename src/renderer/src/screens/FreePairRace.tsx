import { useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useEventStore } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { useBluetoothStore } from '../store/bluetooth.store'
import { TrackDisplay } from '../components/TrackDisplay'
import { Countdown } from '../components/Countdown'
import { useAudio } from '../hooks/useAudio'
import type { LaneResult } from '@shared/types'

export function FreePairRace() {
  const setPhase = useEventStore((s) => s.setPhase)

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

  const { playCountdownBeep, playFinishFanfare } = useAudio()
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resultsRef = useRef<Partial<Record<'left' | 'right', LaneResult>>>({})
  const fanfarePlayed = useRef(false)
  const heldRef = useRef(false)
  const [countdownHeld, setCountdownHeld] = useState(false)
  const [falseStartEnabled, setFalseStartEnabled] = useState(!import.meta.env.DEV)
  const falseStartEnabledRef = useRef(falseStartEnabled)
  falseStartEnabledRef.current = falseStartEnabled
  const leftWattsSpanRef = useRef<HTMLSpanElement>(null)
  const rightWattsSpanRef = useRef<HTMLSpanElement>(null)
  const leftWattsValRef = useRef<HTMLSpanElement>(null)
  const rightWattsValRef = useRef<HTMLSpanElement>(null)
  const WATT_THRESHOLD = 10

  // Stable per-session rider IDs — not tied to any event rider
  const leftRiderIdRef = useRef(nanoid())
  const rightRiderIdRef = useRef(nanoid())

  const leftName = freePairRiders?.leftName ?? ''
  const rightName = freePairRiders?.rightName ?? ''
  const distance = freePairRiders?.distance ?? 250

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
      const shouldHold =
        falseStartEnabledRef.current && isCountdown && (lw > WATT_THRESHOLD || rw > WATT_THRESHOLD)
      heldRef.current = shouldHold
      if (leftWattsSpanRef.current) leftWattsSpanRef.current.style.display = lw > WATT_THRESHOLD ? '' : 'none'
      if (rightWattsSpanRef.current) rightWattsSpanRef.current.style.display = rw > WATT_THRESHOLD ? '' : 'none'
      if (leftWattsValRef.current) leftWattsValRef.current.textContent = String(lw)
      if (rightWattsValRef.current) rightWattsValRef.current.textContent = String(rw)
      setCountdownHeld((prev) => (prev === shouldHold ? prev : shouldHold))
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

  useEffect(() => {
    if (raceStatus !== 'finished') return
    window.electronAPI.stopRace()
  }, [raceStatus])

  useEffect(() => () => { if (countdownRef.current) clearTimeout(countdownRef.current) }, [])

  function startRace() {
    if (!leftName || !rightName) return
    fanfarePlayed.current = false
    resultsRef.current = {}
    const raceId = nanoid()
    initRace(
      raceId,
      { riderId: leftRiderIdRef.current, riderName: leftName },
      { riderId: rightRiderIdRef.current, riderName: rightName }
    )
    window.electronAPI.startRace(raceId, distance, ['left', 'right'])

    let count = 3
    setCountdown(count)
    playCountdownBeep(count)
    let lastAt = performance.now()
    let wasHeld = false
    function tick() {
      if (heldRef.current) { wasHeld = true; countdownRef.current = setTimeout(tick, 100); return }
      count -= 1
      const now = performance.now()
      const drift = wasHeld ? 0 : now - lastAt - 1000
      wasHeld = false; lastAt = now
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
  }

  const returnPhase = freePairRiders?.returnPhase ?? 'bracket'

  function handleDone() {
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
    window.electronAPI.stopRace()
    resetRace()
    setPhase(returnPhase)
  }

  if (!leftName || !rightName) return null

  const isIdle = raceStatus === null || raceStatus === 'idle'
  const isFinished = raceStatus === 'finished'

  const leftTime = resultsRef.current['left']?.finishTimeMs ?? Infinity
  const rightTime = resultsRef.current['right']?.finishTimeMs ?? Infinity
  const winnerName = leftTime < rightTime ? leftName : rightName

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
        {raceStatus !== null && (
          <div className="absolute inset-0 flex">
            <TrackDisplay
              left={{ riderName: leftName }}
              right={{ riderName: rightName }}
              targetDistance={distance}
            />
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

        {raceStatus === 'countdown' && !countdownHeld && <Countdown value={countdownValue} />}

        {countdownHeld && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/60">
            <div className="flex flex-col items-center gap-4">
              <div className="text-red-400 text-6xl font-black uppercase tracking-widest">Hold!</div>
              <div className="text-stone-300 text-xl">Stop pedaling to resume countdown</div>
              <div className="flex gap-12 text-2xl font-bold tabular-nums">
                <span ref={leftWattsSpanRef} style={{ display: 'none' }} className="text-[var(--lane-left)]">
                  {leftName}: <span ref={leftWattsValRef}>0</span>W
                </span>
                <span ref={rightWattsSpanRef} style={{ display: 'none' }} className="text-[var(--lane-right)]">
                  {rightName}: <span ref={rightWattsValRef}>0</span>W
                </span>
              </div>
            </div>
          </div>
        )}

        {isFinished && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
            <div className="flex flex-col items-center gap-6">
              <div className="text-[var(--accent)] text-6xl font-black uppercase tracking-widest">
                {winnerName} Wins!
              </div>
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
