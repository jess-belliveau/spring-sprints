import { useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useEventStore, selectRiders, selectConfig, selectQualifyingResults } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { TrackDisplay } from '../components/TrackDisplay'
import { Countdown } from '../components/Countdown'
import { useAudio } from '../hooks/useAudio'
import { BRACKET_SIZE } from '@shared/constants'
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

  const { playCountdownBeep, playFinishFanfare } = useAudio()

  const completedIds = new Set(existingResults.map((r) => r.left?.riderId ?? r.right?.riderId))
  const remaining = riders.filter((r) => !completedIds.has(r.id))
  const currentRider = remaining[0] ?? null

  const [showResult, setShowResult] = useState(false)
  const [finishResult, setFinishResult] = useState<LaneResult | null>(null)
  const [addName, setAddName] = useState('')
  const [addGender, setAddGender] = useState<'M' | 'F'>('M')
  const [addError, setAddError] = useState('')
  const [countdownHeld, setCountdownHeld] = useState(false)
  const [falseStartEnabled, setFalseStartEnabled] = useState(!import.meta.env.DEV)

  const raceIdRef = useRef<string>('')
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finishHandledRef = useRef(false)
  const heldRef = useRef(false)
  const currentRiderRef = useRef(currentRider)
  currentRiderRef.current = currentRider
  const falseStartEnabledRef = useRef(falseStartEnabled)
  falseStartEnabledRef.current = falseStartEnabled
  const wattsHoldRef = useRef<HTMLSpanElement>(null)
  const WATT_THRESHOLD = 10

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

  // Non-reactive: false-start detection + watts display
  useEffect(() => {
    return useRaceStore.subscribe((state) => {
      const watts = state.race?.left?.instantWatts ?? 0
      const isCountdown = state.race?.status === 'countdown' && (state.race?.countdownValue ?? 1) > 0
      const shouldHold = falseStartEnabledRef.current && isCountdown && watts > WATT_THRESHOLD
      heldRef.current = shouldHold
      if (wattsHoldRef.current) wattsHoldRef.current.textContent = String(watts)
      setCountdownHeld((prev) => (prev === shouldHold ? prev : shouldHold))
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
      if (lane !== 'left') return
      if (!currentRiderRef.current) return
      const laneResult = { ...result, riderId: currentRiderRef.current.id }
      setLaneFinished('left', laneResult)
      setFinishResult(laneResult)
    })
    return unsub
  }, [setLaneFinished])

  function startRace() {
    if (!currentRider) return
    finishHandledRef.current = false
    setShowResult(false)
    const raceId = nanoid()
    raceIdRef.current = raceId
    initRace(raceId, { riderId: currentRider.id, riderName: currentRider.name }, null)
    window.electronAPI.startRace(raceId, config.distanceMetres, ['left'])

    let count = 3
    setCountdown(count)
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

  function saveAndAdvance() {
    if (!finishResult || !currentRider) return
    const raceResult: RaceResult = {
      raceId: raceIdRef.current,
      type: 'qualifying',
      startedAt: Date.now(),
      left: finishResult,
      right: null
    }
    addQualifyingResult(raceResult)
    resetRace()
    setFinishResult(null)
    setShowResult(false)
    finishHandledRef.current = false
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
    window.electronAPI.stopRace()
    resetRace()
    setFinishResult(null)
    setShowResult(false)
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
                <button
                  onClick={startRace}
                  className="px-12 py-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
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

          {isActive && (
            <div className="absolute inset-0 flex">
              <TrackDisplay
                left={currentRider ? { riderName: currentRider.name } : null}
                right={null}
                targetDistance={config.distanceMetres}
              />
            </div>
          )}

          {isActive && raceStatus === 'countdown' && !countdownHeld && (
            <Countdown value={countdownValue} />
          )}

          {countdownHeld && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/60">
              <div className="flex flex-col items-center gap-3">
                <div className="text-red-400 text-6xl font-black uppercase tracking-widest">Hold!</div>
                <div className="text-stone-300 text-xl">Stop pedaling to resume countdown</div>
                <div className="text-[var(--accent)] text-2xl font-bold tabular-nums"><span ref={wattsHoldRef}>0</span>W</div>
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
