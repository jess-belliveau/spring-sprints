import { useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useEventStore, selectRiders, selectConfig, selectQualifyingResults } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { TrackDisplay } from '../components/TrackDisplay'
import { Countdown } from '../components/Countdown'
import { useAudio } from '../hooks/useAudio'
import { BRACKET_SIZE } from '@shared/constants'
import type { RaceResult } from '@shared/types'

export function Qualifying() {
  const riders = useEventStore(selectRiders)
  const config = useEventStore(selectConfig)
  const existingResults = useEventStore(selectQualifyingResults)
  const addQualifyingResult = useEventStore((s) => s.addQualifyingResult)
  const removeQualifyingResult = useEventStore((s) => s.removeQualifyingResult)
  const addRider = useEventStore((s) => s.addRider)
  const setPhase = useEventStore((s) => s.setPhase)

  const race = useRaceStore((s) => s.race)
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
  const [addName, setAddName] = useState('')
  const [addError, setAddError] = useState('')
  const raceIdRef = useRef<string>('')
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishHandledRef = useRef(false)

  // Sorted leaderboard from completed results
  const sortedResults = [...existingResults].sort((a, b) => {
    const aTime = a.left?.finishTimeMs ?? a.right?.finishTimeMs ?? Infinity
    const bTime = b.left?.finishTimeMs ?? b.right?.finishTimeMs ?? Infinity
    return aTime - bTime
  })

  useEffect(() => {
    if (race?.status === 'finished' && !finishHandledRef.current) {
      finishHandledRef.current = true
      playFinishFanfare()
      setShowResult(true)
      window.electronAPI.stopRace()
    }
  }, [race?.status, playFinishFanfare])

  useEffect(() => {
    const unsub = window.electronAPI.onRaceFinished(({ lane, result }) => {
      if (lane !== 'left') return
      if (!currentRider) return
      setLaneFinished('left', { ...result, riderId: currentRider.id })
    })
    return unsub
  }, [currentRider, setLaneFinished])

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
    countdownRef.current = setInterval(() => {
      count -= 1
      if (count >= 0) { setCountdown(count); playCountdownBeep(count) }
      if (count < 0) { clearInterval(countdownRef.current!); setRacing() }
    }, 1000)
  }

  function saveAndAdvance() {
    const laneResult = race?.left?.result
    if (!laneResult || !currentRider) return
    const raceResult: RaceResult = {
      raceId: raceIdRef.current,
      type: 'qualifying',
      startedAt: Date.now(),
      left: laneResult,
      right: null
    }
    addQualifyingResult(raceResult)
    resetRace()
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
    addRider({ id: nanoid(), name })
    setAddName('')
    setAddError('')
  }

  function handleAbort() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    finishHandledRef.current = false
    window.electronAPI.stopRace()
    resetRace()
    setShowResult(false)
  }

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current) }, [])

  const isIdle = !race || race.status === 'idle'
  const isActive = race !== null && race.status !== 'idle'
  const isLive = race?.status === 'countdown' || race?.status === 'racing'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center px-8 py-4 border-b border-gray-800">
        <div className="flex items-center gap-6">
          {isIdle && !showResult && (
            <button
              onClick={() => setPhase('registration')}
              className="text-gray-500 hover:text-white text-sm uppercase tracking-widest transition-colors"
            >
              ← Riders
            </button>
          )}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-widest">Qualifying</div>
            <div className="text-white text-xl font-bold">{currentRider?.name ?? 'All done'}</div>
          </div>
        </div>
        {isLive ? (
          <button
            onClick={handleAbort}
            className="text-sm text-red-500 hover:text-red-300 border border-red-900 hover:border-red-600 rounded px-3 py-1 uppercase tracking-widest transition-colors"
          >
            Abort Race
          </button>
        ) : (
          <div className="text-gray-500 text-sm">
            {existingResults.length} / {riders.length} complete
          </div>
        )}
      </div>

      {/* Body: race area + leaderboard sidebar */}
      <div className="flex flex-1 overflow-hidden">

        {/* Race area */}
        <div className="flex-1 relative">

          {/* Idle: start prompt */}
          {isIdle && !showResult && currentRider && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-6">
                <div className="text-gray-400 text-2xl">Ready to race?</div>
                <div className="text-5xl font-black text-white">{currentRider.name}</div>
                <button
                  onClick={startRace}
                  className="px-12 py-4 bg-green-600 hover:bg-green-500 text-white text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
                >
                  START RACE
                </button>
              </div>
            </div>
          )}

          {/* Idle: all done */}
          {isIdle && !showResult && !currentRider && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="text-green-400 text-2xl font-bold uppercase tracking-widest">All riders done!</div>
                <button
                  onClick={() => setPhase('qualifying-results')}
                  className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
                >
                  See Results →
                </button>
              </div>
            </div>
          )}

          {/* Active: circular track */}
          {isActive && (
            <div className="absolute inset-0 flex">
              <TrackDisplay
                left={race!.left}
                right={null}
                targetDistance={config.distanceMetres}
              />
            </div>
          )}

          {/* Countdown overlay */}
          {isActive && race!.status === 'countdown' && (
            <Countdown value={race!.countdownValue} />
          )}

          {/* Result overlay after finish */}
          {showResult && race?.left?.result && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
              <div className="flex flex-col items-center gap-6">
                <div className="text-green-400 text-4xl font-bold uppercase tracking-widest">
                  Finished!
                </div>
                <div className="text-8xl font-black text-white tabular-nums">
                  {formatTime(race.left.result.finishTimeMs)}
                </div>
                <div className="flex gap-8 text-xl text-gray-400">
                  <span>Avg: <strong className="text-yellow-400">{race.left.result.avgWatts}W</strong></span>
                  <span>Max: <strong className="text-orange-400">{race.left.result.maxWatts}W</strong></span>
                </div>
                <button
                  onClick={saveAndAdvance}
                  className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
                >
                  {remaining.length <= 1 ? 'See Results →' : 'Next Rider →'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard sidebar */}
        <div className="w-64 border-l border-gray-800 flex flex-col overflow-hidden">
          <div className="px-4 pt-4 pb-2 text-xs text-gray-500 uppercase tracking-widest flex justify-between">
            <span>Leaderboard</span>
            <span>{sortedResults.length}/{riders.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {sortedResults.length === 0 ? (
              <p className="text-gray-700 text-xs text-center py-6">No times yet</p>
            ) : (
              <div className="flex flex-col gap-1">
                {sortedResults.map((result, i) => {
                  const riderId = result.left?.riderId ?? result.right?.riderId ?? ''
                  const rider = riders.find((r) => r.id === riderId)
                  const laneResult = result.left ?? result.right
                  const advances = i < BRACKET_SIZE
                  return (
                    <div
                      key={result.raceId}
                      className={`flex items-center gap-2 rounded px-2 py-2 ${advances ? 'bg-green-950' : 'bg-gray-900'}`}
                    >
                      <span className={`text-sm font-bold w-5 text-right shrink-0 ${advances ? 'text-green-400' : 'text-gray-600'}`}>
                        {i + 1}
                      </span>
                      <span className="flex-1 text-white text-sm font-medium truncate">
                        {rider?.name ?? '?'}
                      </span>
                      {advances ? (
                        <span className="text-yellow-400 text-sm font-mono tabular-nums shrink-0">
                          {laneResult ? formatTime(laneResult.finishTimeMs) : '—'}
                        </span>
                      ) : (
                        <button
                          onClick={() => removeQualifyingResult(riderId)}
                          disabled={!isIdle || showResult}
                          className="text-xs text-orange-400 hover:text-orange-300 border border-orange-700 hover:border-orange-500 rounded px-2 py-0.5 disabled:opacity-30 transition-colors shrink-0"
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
        </div>
      </div>

      {/* Late arrival panel — hidden while racing */}
      {isIdle && !showResult && (
        <div className="border-t border-gray-800 px-8 py-4">
          <div className="flex items-center gap-3 w-full max-w-md mx-auto">
            <span className="text-xs text-gray-500 uppercase tracking-widest whitespace-nowrap">Add rider</span>
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
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-600"
              />
              {addError && <p className="absolute text-red-400 text-xs mt-0.5">{addError}</p>}
            </div>
            <button
              onClick={handleAddRider}
              disabled={!addName.trim()}
              className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-bold transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
