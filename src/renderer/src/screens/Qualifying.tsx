import { useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useEventStore, selectRiders, selectConfig, selectQualifyingResults, selectHeroMode } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { FreePairModal } from '../components/FreePairModal'
import type { FreePairStartData } from '../components/FreePairModal'
import { useBluetoothStore } from '../store/bluetooth.store'
import { WattBomber } from '../components/WattBomber'
import { BRACKET_SIZE, DEMO_DEVICE_IDS } from '@shared/constants'
import type { Rider } from '@shared/types'

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
  const moveRiderToEnd = useEventStore((s) => s.moveRiderToEnd)
  const reorderRiders = useEventStore((s) => s.reorderRiders)
  const removeRider = useEventStore((s) => s.removeRider)
  const addRider = useEventStore((s) => s.addRider)
  const setPhase = useEventStore((s) => s.setPhase)
  const heroMode = useEventStore(selectHeroMode)
  const setHeroMode = useEventStore((s) => s.setHeroMode)
  const setFreePairRiders = useRaceStore((s) => s.setFreePairRiders)
  const setQualRiders = useRaceStore((s) => s.setQualRiders)

  const connectedDevices = useBluetoothStore((s) => s.connectedDevices)
  const leftReady = connectedDevices['left']?.status === 'connected'
  const rightReady = connectedDevices['right']?.status === 'connected'
  const bothConnected = leftReady && rightReady

  const completedIds = new Set(
    existingResults.flatMap((r) =>
      [r.left?.riderId, r.right?.riderId].filter((id): id is string => !!id)
    )
  )
  const remaining = riders.filter((r) => !completedIds.has(r.id))
  const riderA = remaining[0] ?? null
  const riderB = remaining[1] ?? null
  const isSolo = riderA !== null && riderB === null

  const canStart = isSolo ? (leftReady || rightReady) : bothConnected

  const [freePairOpen, setFreePairOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addGender, setAddGender] = useState<'M' | 'F'>('M')
  const [addError, setAddError] = useState('')
  const [demoStopped, setDemoStopped] = useState<Record<string, boolean>>({})
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragOverDelete, setDragOverDelete] = useState(false)

  const riderARef = useRef(riderA)
  riderARef.current = riderA
  const riderBRef = useRef(riderB)
  riderBRef.current = riderB

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

  function toggleDemoDevice(id: string) {
    const next = !demoStopped[id]
    setDemoStopped((prev) => ({ ...prev, [id]: next }))
    window.electronAPI.setDemoStopped(id, next)
  }

  function handleQueueDrop(fromId: string, toId: string) {
    const fromIdx = remaining.findIndex((r) => r.id === fromId)
    const toIdx = remaining.findIndex((r) => r.id === toId)
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return
    const next = [...remaining]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    reorderRiders([...riders.filter((r) => completedIds.has(r.id)), ...next])
  }

  function startRace() {
    const a = riderARef.current
    const b = riderBRef.current
    if (!a) return
    setQualRiders({
      leftRiderId: a.id,
      leftName: a.name,
      rightRiderId: b?.id ?? null,
      rightName: b?.name ?? null,
      distance: config.distanceMetres,
    })
    setPhase('qualifying-race')
  }

  function handleAddRider() {
    const name = addName.trim()
    if (!name) return
    if (riders.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      setAddError('Name already registered')
      return
    }
    addRider({ id: nanoid(), name, gender: addGender })
    setAddName('')
    setAddError('')
  }

  function handleFreePairStart(data: FreePairStartData) {
    setFreePairOpen(false)
    setFreePairRiders({
      leftName: data.leftName,
      rightName: data.rightName,
      distance: data.distance,
      garrettMode: data.garrettMode,
      leftWeightKg: data.leftWeightKg,
      rightWeightKg: data.rightWeightKg,
      returnPhase: 'qualifying',
      countAsQualifying: data.countAsQualifying,
      leftGender: data.leftGender,
      rightGender: data.rightGender,
    })
    setPhase('free-pair')
  }

  const pools = anyGender && availablePools.length > 1 ? availablePools : [null as LbPool | null]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center px-8 py-4 border-b border-stone-800">
        <div className="flex items-center gap-6">
          <button
            onClick={() => {
              if (window.confirm('Exit qualifying? The current rider list will be lost.')) {
                setPhase('setup')
              }
            }}
            className="text-stone-500 hover:text-white text-sm uppercase tracking-widest transition-colors"
          >
            ← Exit
          </button>
          <div>
            <div className="text-xs text-stone-500 uppercase tracking-widest">Qualifying · {config.distanceMetres}m</div>
            <div className="text-white text-xl font-bold">
              {riderA ? (riderB ? `${riderA.name} + ${riderB.name}` : riderA.name) : 'All done'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {import.meta.env.DEV && DEMO_DEVICE_IDS.map((id, i) => (
            <button
              key={id}
              onClick={() => toggleDemoDevice(id)}
              className={`text-xs border rounded px-2 py-1 uppercase tracking-widest transition-colors ${
                demoStopped[id]
                  ? 'text-orange-400 border-orange-700 bg-orange-950/40'
                  : 'text-stone-600 border-stone-700'
              }`}
            >
              T{i + 1} {demoStopped[id] ? 'STOP' : 'LIVE'}
            </button>
          ))}
          {import.meta.env.DEV && (
            <button
              disabled={!riderA}
              onClick={() => {
                const a = riderA
                const b = riderB
                if (!a) return
                addQualifyingResult({
                  raceId: nanoid(), type: 'qualifying', startedAt: Date.now(),
                  left: { riderId: a.id, lane: 'left', finishTimeMs: Math.round(30000 + Math.random() * 30000), maxWatts: Math.round(300 + Math.random() * 300), avgWatts: Math.round(200 + Math.random() * 200), distanceMetres: config.distanceMetres },
                  right: null
                })
                if (b) {
                  addQualifyingResult({
                    raceId: nanoid(), type: 'qualifying', startedAt: Date.now(),
                    left: null,
                    right: { riderId: b.id, lane: 'right', finishTimeMs: Math.round(30000 + Math.random() * 30000), maxWatts: Math.round(300 + Math.random() * 300), avgWatts: Math.round(200 + Math.random() * 200), distanceMetres: config.distanceMetres }
                  })
                }
              }}
              className="text-xs border border-amber-900 hover:border-amber-700 text-amber-700 hover:text-amber-400 disabled:opacity-30 rounded px-2 py-1 uppercase tracking-widest transition-colors"
            >
              ⚡ Sim
            </button>
          )}
          {import.meta.env.DEV && (
            <button
              disabled={remaining.length === 0}
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
          )}
          {import.meta.env.DEV && (
            <button
              onClick={() => {
                const seeds: { name: string; gender: 'M' | 'F' }[] = [
                  { name: 'Alice', gender: 'F' }, { name: 'Bob', gender: 'M' },
                  { name: 'Carol', gender: 'F' }, { name: 'Dave', gender: 'M' },
                  { name: 'Eve', gender: 'F' }, { name: 'Frank', gender: 'M' },
                  { name: 'Grace', gender: 'F' }, { name: 'Hank', gender: 'M' },
                  { name: 'Ivy', gender: 'F' }, { name: 'Jack', gender: 'M' },
                  { name: 'Karen', gender: 'F' }, { name: 'Leo', gender: 'M' },
                  { name: 'Mia', gender: 'F' }, { name: 'Ned', gender: 'M' },
                  { name: 'Olivia', gender: 'F' }, { name: 'Pete', gender: 'M' },
                  { name: 'Quinn', gender: 'F' }, { name: 'Rose', gender: 'F' },
                  { name: 'Sam', gender: 'M' }, { name: 'Tara', gender: 'F' },
                ]
                seeds.forEach(({ name, gender }) => addRider({ id: nanoid(), name, gender }))
              }}
              className="text-xs border border-stone-700 hover:border-stone-500 text-stone-400 hover:text-white rounded px-2 py-1 uppercase tracking-widest transition-colors"
            >
              Seed 20
            </button>
          )}
          <button
            onClick={() => setFreePairOpen(true)}
            className="text-xs border border-stone-700 text-stone-400 hover:text-white hover:border-stone-500 rounded px-3 py-1 uppercase tracking-widest transition-colors"
          >
            Free Pair
          </button>
          <button
            onClick={() => setHeroMode(!heroMode)}
            className={`text-xs border rounded px-2 py-1 uppercase tracking-widest transition-colors ${
              heroMode
                ? 'text-orange-400 border-orange-700 bg-orange-950/40'
                : 'text-stone-600 border-stone-700 hover:text-stone-400 hover:border-stone-500'
            }`}
            title="Hero mode — watts catch fire above big-power thresholds during races (persists for the event)"
          >
            🔥 Hero {heroMode ? 'ON' : 'OFF'}
          </button>
          <div className="text-stone-500 text-sm">
            {existingResults.length} / {riders.length} complete
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Queue sidebar */}
        <div className="w-52 border-r border-stone-800 flex flex-col overflow-hidden">
          {/* Up next + start */}
          {riderA && (
            <div className="px-3 pt-4 pb-3 border-b border-stone-800 flex flex-col gap-2">
              <div className="text-stone-500 text-xs uppercase tracking-widest">Up now</div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--lane-left)] text-xs font-bold uppercase tracking-widest w-3">L</span>
                  <span className="text-white text-sm font-bold truncate">{riderA.name}</span>
                </div>
                {riderB && (
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--lane-right)] text-xs font-bold uppercase tracking-widest w-3">R</span>
                    <span className="text-white text-sm font-bold truncate">{riderB.name}</span>
                  </div>
                )}
              </div>
              {!canStart && (
                <div className="text-amber-400 text-xs uppercase tracking-widest">
                  {isSolo ? 'No devices' : 'Need both devices'}
                </div>
              )}
              <button
                onClick={startRace}
                disabled={!canStart}
                className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-h)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--accent-fg)] text-sm font-bold tracking-widest uppercase rounded transition-colors"
              >
                START
              </button>
            </div>
          )}

          {/* All done */}
          {!riderA && existingResults.length > 0 && (
            <div className="px-3 pt-4 pb-3 border-b border-stone-800 flex flex-col gap-3">
              <div className="text-green-400 text-sm font-bold uppercase tracking-widest">All done!</div>
              <button
                onClick={() => setPhase('qualifying-results')}
                className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-sm font-bold tracking-widest uppercase rounded transition-colors"
              >
                Results →
              </button>
            </div>
          )}

          <div className="px-4 pt-4 pb-2 text-xs text-stone-500 uppercase tracking-widest">Up Next</div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOverDelete(true); setDragOverId(null) }}
            onDragLeave={() => setDragOverDelete(false)}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) removeRider(id); setDraggedId(null); setDragOverDelete(false) }}
            className={`mx-2 rounded border border-dashed text-xs uppercase tracking-widest text-center transition-all duration-150 ${
              draggedId
                ? dragOverDelete
                  ? 'px-3 py-2 mb-1 border-red-500 text-red-400 bg-red-950/40'
                  : 'px-3 py-2 mb-1 border-stone-700 text-stone-600'
                : 'h-0 overflow-hidden border-transparent'
            }`}
          >
            {dragOverDelete ? 'Release to remove' : 'Drag here to remove'}
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {remaining.length === 0 ? (
              <p className="text-stone-700 text-xs text-center py-6">All riders done</p>
            ) : (
              <div className="flex flex-col gap-1">
                {remaining.map((rider, i) => {
                  const isUpNow = i === 0 || i === 1
                  const isDragging = draggedId === rider.id
                  const isOver = dragOverId === rider.id && draggedId !== rider.id
                  const laneColor = i === 0 ? 'var(--lane-left)' : i === 1 ? 'var(--lane-right)' : undefined
                  return (
                    <div
                      key={rider.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', rider.id); e.dataTransfer.effectAllowed = 'move'; setDraggedId(rider.id); setDragOverDelete(false) }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(rider.id); setDragOverDelete(false) }}
                      onDragLeave={() => setDragOverId(null)}
                      onDrop={(e) => { e.preventDefault(); const fromId = e.dataTransfer.getData('text/plain'); if (fromId && fromId !== rider.id) handleQueueDrop(fromId, rider.id); setDraggedId(null); setDragOverId(null) }}
                      onDragEnd={() => { setDraggedId(null); setDragOverId(null); setDragOverDelete(false) }}
                      className={`flex items-center gap-2 rounded px-3 py-2 border transition-colors cursor-grab active:cursor-grabbing ${
                        isDragging ? 'opacity-40' :
                        isOver ? 'border-[var(--accent)] bg-stone-800' :
                        isUpNow ? 'accent-tint border-transparent' : 'bg-stone-900 border-transparent'
                      }`}
                    >
                      <span className="text-xs font-bold w-4 shrink-0" style={{ color: laneColor ?? '#57534e' }}>
                        {i + 1}
                      </span>
                      <span className={`flex-1 text-sm font-medium truncate ${isUpNow ? 'text-white' : 'text-stone-400'}`}>
                        {rider.name}
                      </span>
                      {rider.gender && (
                        <span className={`text-xs font-bold shrink-0 ${rider.gender === 'M' ? 'text-blue-400' : 'text-pink-400'}`}>
                          {rider.gender}
                        </span>
                      )}
                      {isUpNow && (
                        <span className="text-xs uppercase tracking-widest shrink-0" style={{ color: laneColor }}>
                          {i === 0 ? 'L' : 'R'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard(s) */}
        {pools.map((pool) => {
          const colResults = resultsForPool(pool)
          const labelText = pool === 'M' ? 'Men' : pool === 'F' ? 'Women' : pool === 'Open' ? 'Open' : 'Leaderboard'
          const labelClass = pool === 'M' ? 'text-blue-400' : pool === 'F' ? 'text-pink-400' : pool === 'Open' ? 'text-stone-400' : 'text-stone-500'
          return (
            <div key={pool ?? 'all'} className="flex-1 border-l border-stone-800 flex flex-col overflow-hidden">
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
                              onClick={() => { removeQualifyingResult(riderId); moveRiderToEnd(riderId) }}
                              className="text-xs text-stone-400 hover:text-white border border-stone-700 hover:border-stone-500 rounded px-2 py-0.5 transition-colors shrink-0"
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

      {freePairOpen && (
        <FreePairModal onClose={() => setFreePairOpen(false)} onStart={handleFreePairStart} />
      )}

      {/* Late arrival */}
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
          <button
            onClick={handleAddRider}
            disabled={!addName.trim()}
            className="px-4 py-2 rounded bg-stone-700 hover:bg-stone-600 disabled:bg-stone-800 disabled:text-stone-600 text-white text-sm font-bold transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
