import { useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useEventStore, selectRiders, selectConfig, selectQualifyingResults } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { useBluetoothStore } from '../store/bluetooth.store'
import { TrackDisplay } from '../components/TrackDisplay'
import { Countdown } from '../components/Countdown'
import { useAudio } from '../hooks/useAudio'
import { BRACKET_SIZE, DEMO_DEVICE_IDS } from '@shared/constants'
import { WattBomber } from '../components/WattBomber'
import type { RaceResult, LaneResult, Rider } from '@shared/types'

type LbPool = 'M' | 'F' | 'Open'

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function riderPool(rider: Rider): LbPool {
  return rider.gender === 'M' ? 'M' : rider.gender === 'F' ? 'F' : 'Open'
}

export function Qualifying() {
  const riders = useEventStore(selectRiders)
  const config = useEventStore(selectConfig)
  const existingResults = useEventStore(selectQualifyingResults)
  const addQualifyingResult = useEventStore((s) => s.addQualifyingResult)
  const removeQualifyingResult = useEventStore((s) => s.removeQualifyingResult)
  const addRider = useEventStore((s) => s.addRider)
  const setPhase = useEventStore((s) => s.setPhase)

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
  const bothConnected = leftReady && rightReady

  const { playCountdownBeep, playFinishFanfare, playBuzzer } = useAudio()

  const completedIds = new Set(existingResults.map((r) => r.left?.riderId ?? r.right?.riderId))
  const remaining = riders.filter((r) => !completedIds.has(r.id))
  const currentRider = remaining[0] ?? null

  const [showResult, setShowResult] = useState(false)
  const [finishResult, setFinishResult] = useState<LaneResult | null>(null)
  const [addName, setAddName] = useState('')
  const [addGender, setAddGender] = useState<'M' | 'F'>('M')
  const [addError, setAddError] = useState('')
  const [isFalseStart, setIsFalseStart] = useState(false)
  const [falseStartRiderName, setFalseStartRiderName] = useState('')
  const [buzzerEnabled, setBuzzerEnabled] = useState(true)
  const buzzerEnabledRef = useRef(true)
  buzzerEnabledRef.current = buzzerEnabled
  const falseStartFiredRef = useRef(false)
  const handleFalseStartRef = useRef<((name: string) => void) | null>(null)
  const startCountdownRef = useRef<() => void>(() => {})
  const [falseStartEnabled, setFalseStartEnabled] = useState(!import.meta.env.DEV)
  const [demoStopped, setDemoStopped] = useState<Record<string, boolean>>({})

  function toggleDemoDevice(id: string) {
    const next = !demoStopped[id]
    setDemoStopped((prev) => ({ ...prev, [id]: next }))
    window.electronAPI.setDemoStopped(id, next)
  }

  const raceIdRef = useRef<string>('')
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finishHandledRef = useRef(false)
  const currentRiderRef = useRef(currentRider)
  currentRiderRef.current = currentRider
  const falseStartEnabledRef = useRef(falseStartEnabled)
  falseStartEnabledRef.current = falseStartEnabled
  const WATT_THRESHOLD = 10
  const DETECT_THRESHOLD = 30
  const DETECT_SUSTAIN_MS = 2000

  // Lane detection state
  const raceLaneRef = useRef<'left' | 'right'>('left')
  const [isDetecting, setIsDetecting] = useState(false)
  const isDetectingRef = useRef(false)
  isDetectingRef.current = isDetecting
  const [detectedLane, setDetectedLane] = useState<'left' | 'right' | null>(null)
  const detectionCalledRef = useRef(false)
  const leftDetectWattsRef = useRef<HTMLSpanElement>(null)
  const rightDetectWattsRef = useRef<HTMLSpanElement>(null)
  const leftProgressRef = useRef<HTMLDivElement>(null)
  const rightProgressRef = useRef<HTMLDivElement>(null)
  const leftAboveSinceRef = useRef(0)
  const rightAboveSinceRef = useRef(0)
  const [isAwaitingStop, setIsAwaitingStop] = useState(false)
  const isAwaitingStopRef = useRef(false)
  isAwaitingStopRef.current = isAwaitingStop
  const awaitingStopLaneRef = useRef<'left' | 'right' | null>(null)
  const belowThresholdSinceRef = useRef(0)
  const awaitingStopWattsRef = useRef<HTMLSpanElement>(null)
  const awaitingStopReadyRef = useRef<((lane: 'left' | 'right') => void) | null>(null)

  const anyGender = riders.some((r) => r.gender)
  const availablePools: LbPool[] = []
  if (riders.some((r) => r.gender === 'M')) availablePools.push('M')
  if (riders.some((r) => r.gender === 'F')) availablePools.push('F')
  if (riders.some((r) => !r.gender)) availablePools.push('Open')

  const sortedResults = [...existingResults].sort((a, b) => {
    const aTime = a.left?.finishTimeMs ?? a.right?.finishTimeMs ?? Infinity
    const bTime = b.left?.finishTimeMs ?? b.right?.finishTimeMs ?? Infinity
    return aTime - bTime
  })

  function resultsForPool(pool: LbPool | null) {
    if (!pool) return sortedResults
    return sortedResults.filter((r) => {
      const id = r.left?.riderId ?? r.right?.riderId ?? ''
      const rider = riders.find((rd) => rd.id === id)
      return rider ? riderPool(rider) === pool : false
    })
  }

  // Non-reactive: lane detection + false-start detection
  const handleLaneDetectedRef = useRef<((lane: 'left' | 'right') => void) | null>(null)
  useEffect(() => {
    return useRaceStore.subscribe((state) => {
      const lw = state.race?.left?.instantWatts ?? 0
      const rw = state.race?.right?.instantWatts ?? 0

      if (isDetectingRef.current) {
        if (leftDetectWattsRef.current) leftDetectWattsRef.current.textContent = String(lw)
        if (rightDetectWattsRef.current) rightDetectWattsRef.current.textContent = String(rw)
        if (!detectionCalledRef.current) {
          const now = Date.now()
          if (lw > DETECT_THRESHOLD) { if (!leftAboveSinceRef.current) leftAboveSinceRef.current = now }
          else leftAboveSinceRef.current = 0
          if (rw > DETECT_THRESHOLD) { if (!rightAboveSinceRef.current) rightAboveSinceRef.current = now }
          else rightAboveSinceRef.current = 0
          const leftPct = leftAboveSinceRef.current ? Math.min(100, (now - leftAboveSinceRef.current) / DETECT_SUSTAIN_MS * 100) : 0
          const rightPct = rightAboveSinceRef.current ? Math.min(100, (now - rightAboveSinceRef.current) / DETECT_SUSTAIN_MS * 100) : 0
          if (leftProgressRef.current) leftProgressRef.current.style.width = `${leftPct}%`
          if (rightProgressRef.current) rightProgressRef.current.style.width = `${rightPct}%`
          const leftSustained = leftAboveSinceRef.current > 0 && now - leftAboveSinceRef.current >= DETECT_SUSTAIN_MS
          const rightSustained = rightAboveSinceRef.current > 0 && now - rightAboveSinceRef.current >= DETECT_SUSTAIN_MS
          const det = leftSustained ? 'left' : rightSustained ? 'right' : null
          if (det) {
            detectionCalledRef.current = true
            handleLaneDetectedRef.current?.(det)
          }
        }
        return
      }

      if (isAwaitingStopRef.current) {
        const detLane = awaitingStopLaneRef.current!
        const detWatts = detLane === 'left' ? lw : rw
        if (awaitingStopWattsRef.current) awaitingStopWattsRef.current.textContent = String(detWatts)
        if (detWatts > WATT_THRESHOLD) {
          belowThresholdSinceRef.current = 0
        } else {
          if (!belowThresholdSinceRef.current) belowThresholdSinceRef.current = Date.now()
          if (Date.now() - belowThresholdSinceRef.current >= 2000) {
            awaitingStopReadyRef.current?.(detLane)
          }
        }
        return
      }

      const isCountdown = state.race?.status === 'countdown' && (state.race?.countdownValue ?? 1) > 0
      if (falseStartEnabledRef.current && isCountdown && !falseStartFiredRef.current) {
        const detWatts = raceLaneRef.current === 'left' ? lw : rw
        if (detWatts > WATT_THRESHOLD) {
          falseStartFiredRef.current = true
          handleFalseStartRef.current?.(state.race?.[raceLaneRef.current]?.riderName ?? '')
        }
      }
    })
  }, [])

  useEffect(() => {
    if (raceStatus === 'finished' && !finishHandledRef.current) {
      finishHandledRef.current = true
      playFinishFanfare()
      setShowResult(true)
      window.electronAPI.stopRace()
    }
  }, [raceStatus, playFinishFanfare])

  useEffect(() => {
    const unsub = window.electronAPI.onRaceFinished(({ lane, result }) => {
      if (lane !== raceLaneRef.current) return
      if (!currentRiderRef.current) return
      const laneResult = { ...result, riderId: currentRiderRef.current.id }
      setLaneFinished(raceLaneRef.current, laneResult)
      setFinishResult(laneResult)
    })
    return unsub
  }, [setLaneFinished])

  function startRaceOnLane(lane: 'left' | 'right') {
    if (!currentRiderRef.current) return
    raceLaneRef.current = lane
    finishHandledRef.current = false
    setShowResult(false)
    const raceId = nanoid()
    raceIdRef.current = raceId
    initRace(
      raceId,
      lane === 'left' ? { riderId: currentRiderRef.current.id, riderName: currentRiderRef.current.name } : null,
      lane === 'right' ? { riderId: currentRiderRef.current.id, riderName: currentRiderRef.current.name } : null
    )
    window.electronAPI.startRace(raceId, config.distanceMetres, [lane])
    startCountdownRef.current()
  }

  // Updated every render so the subscription callback always has the latest version
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
    // Reset AFTER setting the timer so a synchronous Zustand subscription fire
    // (triggered by setCountdown above) doesn't immediately re-trigger a false start
    // before countdownRef.current is properly set.
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

  // Updated every render so the subscription callback always has the latest version
  handleLaneDetectedRef.current = (lane: 'left' | 'right') => {
    isDetectingRef.current = false  // mirror of startRace(); prevents re-detection from in-flight telemetry before React re-renders
    setIsDetecting(false)
    detectionCalledRef.current = false
    leftAboveSinceRef.current = 0
    rightAboveSinceRef.current = 0
    // Keep detection monitoring running so we can read live watts during the stop phase
    awaitingStopLaneRef.current = lane
    belowThresholdSinceRef.current = 0
    isAwaitingStopRef.current = true
    setIsAwaitingStop(true)
    setDetectedLane(lane)
  }

  awaitingStopReadyRef.current = (lane: 'left' | 'right') => {
    isAwaitingStopRef.current = false
    setIsAwaitingStop(false)
    window.electronAPI.stopRace()
    startRaceOnLane(lane)
  }

  function startRace() {
    if (!currentRider) return
    if (bothConnected && detectedLane === null) {
      // Set ref immediately — before IPC fires — so the subscription sees detecting=true
      // even if telemetry arrives before React re-renders the state change.
      detectionCalledRef.current = false
      leftAboveSinceRef.current = 0
      rightAboveSinceRef.current = 0
      isDetectingRef.current = true
      setIsDetecting(true)
      const detId = nanoid()
      raceIdRef.current = detId
      initRace(detId,
        { riderId: currentRider.id, riderName: currentRider.name },
        { riderId: '_det', riderName: '' }
      )
      window.electronAPI.startRace(detId, config.distanceMetres, ['left', 'right'])
    } else {
      startRaceOnLane(detectedLane ?? (leftReady ? 'left' : 'right'))
    }
  }

  function saveAndAdvance() {
    if (!finishResult || !currentRider) return
    const lane = raceLaneRef.current
    const raceResult: RaceResult = {
      raceId: raceIdRef.current,
      type: 'qualifying',
      startedAt: Date.now(),
      left: lane === 'left' ? finishResult : null,
      right: lane === 'right' ? finishResult : null
    }
    addQualifyingResult(raceResult)
    resetRace()
    setFinishResult(null)
    setShowResult(false)
    finishHandledRef.current = false
    setDetectedLane(null)
    raceLaneRef.current = 'left'
    setIsFalseStart(false)
    falseStartFiredRef.current = false
  }

  function handleAddRider() {
    const name = addName.trim()
    if (!name) return
    if (riders.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      setAddError('Name already registered')
      return
    }
    addRider({ id: nanoid(), name, gender: anyGender ? addGender : undefined })
    setAddName('')
    setAddError('')
  }

  function handleAbort() {
    if (countdownRef.current) { clearTimeout(countdownRef.current); countdownRef.current = null }
    finishHandledRef.current = false
    detectionCalledRef.current = false
    leftAboveSinceRef.current = 0
    rightAboveSinceRef.current = 0
    isAwaitingStopRef.current = false
    belowThresholdSinceRef.current = 0
    awaitingStopLaneRef.current = null
    falseStartFiredRef.current = false
    window.electronAPI.stopRace()
    resetRace()
    setFinishResult(null)
    setShowResult(false)
    setIsDetecting(false)
    setIsAwaitingStop(false)
    setIsFalseStart(false)
    setFalseStartRiderName('')
    setDetectedLane(null)
    raceLaneRef.current = 'left'
  }

  useEffect(() => () => { if (countdownRef.current) clearTimeout(countdownRef.current) }, [])

  const isIdle = raceStatus === null || raceStatus === 'idle'
  const isActive = raceStatus !== null && raceStatus !== 'idle'
  const isLive = raceStatus === 'countdown' || raceStatus === 'racing'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center px-8 py-4 border-b border-stone-800">
        <div className="flex items-center gap-6">
          {isIdle && !showResult && (
            <button
              onClick={() => setPhase('registration')}
              className="text-stone-500 hover:text-white text-sm uppercase tracking-widest transition-colors"
            >
              ← Riders
            </button>
          )}
          <div>
            <div className="text-xs text-stone-500 uppercase tracking-widest">Qualifying</div>
            <div className="text-white text-xl font-bold">{currentRider?.name ?? 'All done'}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {import.meta.env.DEV && (
            <>
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
              {DEMO_DEVICE_IDS.map((id, i) => (
                <button
                  key={id}
                  onClick={() => toggleDemoDevice(id)}
                  className={`text-xs border rounded px-2 py-1 uppercase tracking-widest transition-colors ${
                    demoStopped[id]
                      ? 'text-orange-400 border-orange-700 bg-orange-950/40'
                      : 'text-stone-600 border-stone-700'
                  }`}
                  title={`Freeze demo trainer ${i + 1} at 0W (dev only)`}
                >
                  T{i + 1} {demoStopped[id] ? 'STOP' : 'LIVE'}
                </button>
              ))}
              <button
                disabled={!currentRider || isActive || showResult}
                onClick={() => {
                  if (!currentRider) return
                  addQualifyingResult({
                    raceId: nanoid(), type: 'qualifying', startedAt: Date.now(),
                    left: { riderId: currentRider.id, lane: 'left', finishTimeMs: Math.round(30000 + Math.random() * 30000), maxWatts: Math.round(300 + Math.random() * 300), avgWatts: Math.round(200 + Math.random() * 200), distanceMetres: config.distanceMetres },
                    right: null
                  })
                }}
                className="text-xs border border-amber-900 hover:border-amber-700 text-amber-700 hover:text-amber-400 disabled:opacity-30 rounded px-2 py-1 uppercase tracking-widest transition-colors"
              >
                ⚡ Sim
              </button>
              <button
                disabled={remaining.length === 0 || isActive}
                onClick={() => {
                  remaining.forEach((rider) => {
                    addQualifyingResult({
                      raceId: nanoid(), type: 'qualifying', startedAt: Date.now(),
                      left: { riderId: rider.id, lane: 'left', finishTimeMs: Math.round(30000 + Math.random() * 30000), maxWatts: Math.round(300 + Math.random() * 300), avgWatts: Math.round(200 + Math.random() * 200), distanceMetres: config.distanceMetres },
                      right: null
                    })
                  })
                  setPhase('qualifying-results')
                }}
                className="text-xs border border-amber-900 hover:border-amber-700 text-amber-700 hover:text-amber-400 disabled:opacity-30 rounded px-2 py-1 uppercase tracking-widest transition-colors"
              >
                ⚡ Sim All
              </button>
            </>
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
          {isLive ? (
            <button
              onClick={handleAbort}
              className="text-sm text-red-500 hover:text-red-300 border border-red-900 hover:border-red-600 rounded px-3 py-1 uppercase tracking-widest transition-colors"
            >
              Abort Race
            </button>
          ) : (
            <div className="text-stone-500 text-sm">
              {existingResults.length} / {riders.length} complete
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Queue sidebar */}
        <div className="w-52 border-r border-stone-800 flex flex-col overflow-hidden">
          <div className="px-4 pt-4 pb-2 text-xs text-stone-500 uppercase tracking-widest">Up Next</div>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {remaining.length === 0 ? (
              <p className="text-stone-700 text-xs text-center py-6">All riders done</p>
            ) : (
              <div className="flex flex-col gap-1">
                {remaining.map((rider, i) => {
                  const isCurrent = i === 0
                  return (
                    <div
                      key={rider.id}
                      className={`flex items-center gap-2 rounded px-3 py-2 border ${isCurrent ? 'accent-tint' : 'bg-stone-900 border-transparent'}`}
                    >
                      <span className={`text-xs font-bold w-4 shrink-0 ${isCurrent ? 'text-[var(--accent)]' : 'text-stone-600'}`}>
                        {i + 1}
                      </span>
                      <span className={`flex-1 text-sm font-medium truncate ${isCurrent ? 'text-white' : 'text-stone-400'}`}>
                        {rider.name}
                      </span>
                      {rider.gender && (
                        <span className={`text-xs font-bold shrink-0 ${rider.gender === 'M' ? 'text-blue-400' : 'text-pink-400'}`}>
                          {rider.gender}
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-xs text-[var(--accent)] uppercase tracking-widest shrink-0">
                          {isActive ? '▶' : '●'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Race area */}
        <div className="flex-1 relative">
          {isIdle && !showResult && currentRider && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-6">
                <div className="text-stone-400 text-2xl">Ready to race?</div>
                <div className="text-5xl font-black text-white">{currentRider.name}</div>
                {currentRider.gender && (
                  <div className={`text-sm font-bold uppercase tracking-widest ${currentRider.gender === 'M' ? 'text-blue-400' : 'text-pink-400'}`}>
                    {currentRider.gender === 'M' ? 'Men' : 'Women'}
                  </div>
                )}
                {detectedLane && bothConnected && (
                  <div className={`text-sm font-bold uppercase tracking-widest ${detectedLane === 'left' ? 'text-[var(--lane-left)]' : 'text-[var(--lane-right)]'}`}>
                    {detectedLane === 'left' ? 'Left' : 'Right'} bike
                  </div>
                )}
                {!leftReady && !rightReady && (
                  <div className="text-amber-400 text-sm uppercase tracking-widest">No devices connected</div>
                )}
                <button
                  onClick={startRace}
                  disabled={!leftReady && !rightReady}
                  className="px-12 py-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--accent-fg)] text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
                >
                  START RACE
                </button>
              </div>
            </div>
          )}

          {isIdle && !showResult && !currentRider && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="text-green-400 text-2xl font-bold uppercase tracking-widest">All riders done!</div>
                <button
                  onClick={() => setPhase('qualifying-results')}
                  className="px-12 py-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
                >
                  See Results →
                </button>
              </div>
            </div>
          )}

          {isActive && !isDetecting && !isAwaitingStop && !isFalseStart && (
            <div className="absolute inset-0 flex">
              <TrackDisplay
                left={raceLaneRef.current === 'left' && currentRider ? { riderName: currentRider.name } : null}
                right={raceLaneRef.current === 'right' && currentRider ? { riderName: currentRider.name } : null}
                targetDistance={config.distanceMetres}
              />
            </div>
          )}

          {isAwaitingStop && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/70">
              <div className="flex flex-col items-center gap-6">
                <div className="text-white text-4xl font-black uppercase tracking-widest">Bike selected</div>
                <div className="text-stone-400 text-lg">Stop pedalling to begin</div>
                <div
                  className="text-5xl font-black tabular-nums"
                  style={{ color: detectedLane === 'left' ? 'var(--lane-left)' : 'var(--lane-right)' }}
                >
                  <span ref={awaitingStopWattsRef}>0</span>
                  <span className="text-2xl text-stone-500"> W</span>
                </div>
                <button
                  onClick={handleAbort}
                  className="mt-2 text-sm text-stone-600 hover:text-stone-400 uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isDetecting && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/70">
              <div className="flex flex-col items-center gap-6">
                <div className="text-white text-4xl font-black uppercase tracking-widest">Which bike?</div>
                <div className="text-stone-400 text-lg">Pedal steadily above 30W for 2 seconds</div>
                <div className="flex gap-16 mt-2">
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--lane-left)' }}>Left</div>
                    <div className="text-4xl font-black tabular-nums" style={{ color: 'var(--lane-left)' }}>
                      <span ref={leftDetectWattsRef}>0</span>
                      <span className="text-xl text-stone-500"> W</span>
                    </div>
                    <div className="w-36 h-2 bg-stone-800 rounded-full overflow-hidden">
                      <div ref={leftProgressRef} className="h-full rounded-full" style={{ width: '0%', backgroundColor: 'var(--lane-left)', transition: 'none' }} />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--lane-right)' }}>Right</div>
                    <div className="text-4xl font-black tabular-nums" style={{ color: 'var(--lane-right)' }}>
                      <span ref={rightDetectWattsRef}>0</span>
                      <span className="text-xl text-stone-500"> W</span>
                    </div>
                    <div className="w-36 h-2 bg-stone-800 rounded-full overflow-hidden">
                      <div ref={rightProgressRef} className="h-full rounded-full" style={{ width: '0%', backgroundColor: 'var(--lane-right)', transition: 'none' }} />
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleAbort}
                  className="mt-2 text-sm text-stone-600 hover:text-stone-400 uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isActive && !isDetecting && !isAwaitingStop && !isFalseStart && raceStatus === 'countdown' && (
            <Countdown value={countdownValue} />
          )}

          {isActive && isFalseStart && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/80">
              <div className="flex flex-col items-center gap-4">
                <div className="text-red-400 text-7xl font-black uppercase tracking-widest">False Start</div>
                <div className="text-white text-3xl font-bold">{falseStartRiderName}</div>
              </div>
            </div>
          )}

          {showResult && finishResult && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
              <div className="flex flex-col items-center gap-6">
                <div className="text-green-400 text-4xl font-bold uppercase tracking-widest">Finished!</div>
                <div className="text-8xl font-black text-white tabular-nums">
                  {formatTime(finishResult.finishTimeMs)}
                </div>
                <div className="flex gap-8 text-xl text-stone-400">
                  <span>Avg: <strong className="text-[var(--accent)]">{finishResult.avgWatts}W</strong></span>
                  <span>Max: <strong className="text-amber-300">{finishResult.maxWatts}W</strong></span>
                </div>
                <button
                  onClick={saveAndAdvance}
                  className="px-12 py-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
                >
                  {remaining.length <= 1 ? 'See Results →' : 'Next Rider →'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard sidebar(s) */}
        {(anyGender && availablePools.length > 1 ? availablePools : [null as LbPool | null]).map((pool) => {
          const colResults = resultsForPool(pool)
          const labelText = pool === 'M' ? 'Men' : pool === 'F' ? 'Women' : pool === 'Open' ? 'Open' : 'Leaderboard'
          const labelClass = pool === 'M' ? 'text-blue-400' : pool === 'F' ? 'text-pink-400' : pool === 'Open' ? 'text-stone-400' : 'text-stone-500'
          return (
            <div key={pool ?? 'all'} className="w-80 border-l border-stone-800 flex flex-col overflow-hidden">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <span className={`text-sm font-bold uppercase tracking-widest ${labelClass}`}>{labelText}</span>
                {!pool && <span className="text-xs text-stone-600">{existingResults.length}/{riders.length}</span>}
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-2">
                {colResults.length === 0 ? (
                  <p className="text-stone-700 text-sm text-center py-6">No times yet</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {colResults.map((result, i) => {
                      const riderId = result.left?.riderId ?? result.right?.riderId ?? ''
                      const rider = riders.find((r) => r.id === riderId)
                      const laneResult = result.left ?? result.right
                      const advances = i < BRACKET_SIZE
                      return (
                        <div
                          key={result.raceId}
                          className={`flex items-center gap-2 rounded px-3 py-2.5 ${advances ? 'bg-green-950' : 'bg-stone-900'}`}
                        >
                          <span className={`text-base font-bold w-6 text-right shrink-0 ${advances ? 'text-green-400' : 'text-stone-600'}`}>
                            {i + 1}
                          </span>
                          <span className="flex-1 text-white text-base font-medium truncate">
                            {rider?.name ?? '?'}
                          </span>
                          {advances ? (
                            <span className="text-[var(--accent)] text-base font-mono tabular-nums shrink-0">
                              {laneResult ? formatTime(laneResult.finishTimeMs) : '—'}
                            </span>
                          ) : (
                            <button
                              onClick={() => removeQualifyingResult(riderId)}
                              disabled={!isIdle || showResult}
                              className="text-xs text-stone-400 hover:text-white border border-stone-700 hover:border-stone-500 rounded px-2 py-0.5 disabled:opacity-30 transition-colors shrink-0"
                              title={formatTime(laneResult?.finishTimeMs ?? 0)}
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="border-t border-stone-800 px-4 pt-3 pb-3">
                <div className="text-xs text-stone-500 uppercase tracking-widest mb-2">Watt Bomber</div>
                <WattBomber results={colResults} riders={riders} limit={3} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Late arrival panel */}
      {isIdle && !showResult && (
        <div className="border-t border-stone-800 px-8 py-4">
          <div className="flex items-center gap-3 w-full max-w-md mx-auto">
            <span className="text-xs text-stone-500 uppercase tracking-widest whitespace-nowrap">Add rider</span>
            <div className="flex-1 relative">
              <input
                type="text"
                value={addName}
                maxLength={24}
                onChange={(e) => { setAddName(e.target.value); setAddError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRider()}
                placeholder="Late arrival name…"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)] placeholder:text-stone-600"
              />
              {addError && <p className="absolute text-red-400 text-xs mt-0.5">{addError}</p>}
            </div>
            {anyGender && (
              <div className="flex rounded border border-stone-700 overflow-hidden shrink-0">
                <button
                  onClick={() => setAddGender('M')}
                  className={`px-2 py-2 text-xs font-bold transition-colors ${addGender === 'M' ? 'bg-blue-900 text-blue-300' : 'text-stone-500'}`}
                >M</button>
                <button
                  onClick={() => setAddGender('F')}
                  className={`px-2 py-2 text-xs font-bold border-l border-stone-700 transition-colors ${addGender === 'F' ? 'bg-pink-900 text-pink-300' : 'text-stone-500'}`}
                >F</button>
              </div>
            )}
            <button
              onClick={handleAddRider}
              disabled={!addName.trim()}
              className="px-4 py-2 rounded bg-stone-700 hover:bg-stone-600 disabled:bg-stone-800 disabled:text-stone-600 text-white text-sm font-bold transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
