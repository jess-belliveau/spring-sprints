import { useState } from 'react'
import { useEventStore, selectRiders, selectQualifyingResults, selectHasGenderSplit } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { Leaderboard } from '../components/Leaderboard'
import { WattBomber } from '../components/WattBomber'
import { FreePairModal } from '../components/FreePairModal'
import { BRACKET_SIZE } from '@shared/constants'
import type { RaceResult, Rider } from '@shared/types'

function poolResults(results: RaceResult[], riders: Rider[], gender: 'M' | 'F' | 'Open'): RaceResult[] {
  const ids = new Set(
    riders
      .filter((r) => (gender === 'Open' ? !r.gender : r.gender === gender))
      .map((r) => r.id)
  )
  return results.filter((r) => {
    const id = r.left?.riderId ?? r.right?.riderId
    return id && ids.has(id)
  })
}

function sortedRows(results: RaceResult[], riders: Rider[]) {
  return [...results]
    .sort((a, b) => {
      const aTime = a.left?.finishTimeMs ?? a.right?.finishTimeMs ?? Infinity
      const bTime = b.left?.finishTimeMs ?? b.right?.finishTimeMs ?? Infinity
      return aTime - bTime
    })
    .map((result, idx) => {
      const riderId = result.left?.riderId ?? result.right?.riderId ?? ''
      const rider = riders.find((r) => r.id === riderId)!
      return { seed: idx + 1, rider, result }
    })
    .filter((row) => row.rider)
}

export function QualifyingResults() {
  const riders = useEventStore(selectRiders)
  const results = useEventStore(selectQualifyingResults)
  const hasGenderSplit = useEventStore(selectHasGenderSplit)
  const generateBracket = useEventStore((s) => s.generateBracket)
  const removeQualifyingResult = useEventStore((s) => s.removeQualifyingResult)
  const moveRiderToEnd = useEventStore((s) => s.moveRiderToEnd)
  const setPhase = useEventStore((s) => s.setPhase)
  const setFreePairRiders = useRaceStore((s) => s.setFreePairRiders)
  const [freePairOpen, setFreePairOpen] = useState(false)

  function handleRetry(riderId: string) {
    removeQualifyingResult(riderId)
    moveRiderToEnd(riderId)
    setPhase('qualifying')
  }

  function handleFreePairStart(leftName: string, rightName: string, distance: number) {
    setFreePairRiders({ leftName, rightName, distance, returnPhase: 'qualifying-results' })
    setFreePairOpen(false)
    setPhase('free-pair')
  }

  // Determine which columns to show
  const hasMen = riders.some((r) => r.gender === 'M')
  const hasWomen = riders.some((r) => r.gender === 'F')
  const hasOpen = riders.some((r) => !r.gender)

  const mResults = poolResults(results, riders, 'M')
  const fResults = poolResults(results, riders, 'F')
  const openResults = poolResults(results, riders, 'Open')

  const mRows = sortedRows(mResults, riders)
  const fRows = sortedRows(fResults, riders)
  const openRows = sortedRows(openResults, riders)

  const mAdvance = Math.min(BRACKET_SIZE, mRows.length)
  const fAdvance = Math.min(BRACKET_SIZE, fRows.length)
  const openAdvance = Math.min(BRACKET_SIZE, openRows.length)

  // Non-gender event: single column
  if (!hasGenderSplit) {
    const allRows = sortedRows(results, riders)
    const advanceCount = Math.min(BRACKET_SIZE, allRows.length)
    return (
      <>
        <div className="flex flex-col h-full px-8 pt-8 gap-6">
          <div className="flex items-center justify-between">
            <button onClick={() => setPhase('registration')} className="text-stone-500 hover:text-white text-sm uppercase tracking-widest transition-colors">← Riders</button>
            <button onClick={() => setFreePairOpen(true)} className="text-xs text-stone-500 hover:text-stone-300 border border-stone-700 hover:border-stone-500 rounded px-3 py-1.5 uppercase tracking-widest transition-colors">Free Pair</button>
          </div>
          <h2 className="text-4xl font-black uppercase tracking-widest text-white text-center -mt-2">Qualifying Results</h2>
          <div className="flex-1 flex gap-8 min-h-0">
            <div className="flex-1 min-h-0">
              <Leaderboard rows={allRows} advanceCount={advanceCount} onRetry={handleRetry} fill />
            </div>
            <div className="w-56 shrink-0 flex flex-col gap-3">
              <div className="text-xs text-stone-500 uppercase tracking-widest">Watt Bomber</div>
              <WattBomber results={results} riders={riders} limit={3} />
            </div>
          </div>
          <button onClick={generateBracket} className="self-center px-16 py-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-xl font-bold tracking-widest uppercase transition-colors mb-8">
            Generate Bracket →
          </button>
        </div>
        {freePairOpen && <FreePairModal onClose={() => setFreePairOpen(false)} onStart={handleFreePairStart} />}
      </>
    )
  }

  // Gender event: one column per pool
  const columns: { label: string; rows: ReturnType<typeof sortedRows>; advance: number; poolResults: RaceResult[] }[] = []
  if (hasMen) columns.push({ label: 'Men', rows: mRows, advance: mAdvance, poolResults: mResults })
  if (hasWomen) columns.push({ label: 'Women', rows: fRows, advance: fAdvance, poolResults: fResults })
  if (hasOpen) columns.push({ label: 'Open', rows: openRows, advance: openAdvance, poolResults: openResults })

  return (
    <>
    <div className="flex flex-col h-full px-8 pt-8 gap-6">
      <div className="flex items-center justify-between">
        <button onClick={() => setPhase('registration')} className="text-stone-500 hover:text-white text-sm uppercase tracking-widest transition-colors">← Riders</button>
        <button onClick={() => setFreePairOpen(true)} className="text-xs text-stone-500 hover:text-stone-300 border border-stone-700 hover:border-stone-500 rounded px-3 py-1.5 uppercase tracking-widest transition-colors">Free Pair</button>
      </div>
      <h2 className="text-4xl font-black uppercase tracking-widest text-white text-center -mt-2">Qualifying Results</h2>

      <div className="flex-1 flex gap-4 min-h-0">
        {columns.map((col) => (
          <div key={col.label} className="flex-1 flex flex-col min-h-0 gap-3">
            <div className={`text-xs font-bold uppercase tracking-widest ${col.label === 'Men' ? 'text-blue-400' : col.label === 'Women' ? 'text-pink-400' : 'text-stone-400'}`}>
              {col.label}
              {col.rows.length > BRACKET_SIZE && (
                <span className="text-green-400 ml-2 font-normal">top {BRACKET_SIZE} advance</span>
              )}
            </div>
            <div className="flex-1 min-h-0">
              {col.rows.length === 0
                ? <p className="text-stone-700 text-sm text-center py-6">No results yet</p>
                : <Leaderboard rows={col.rows} advanceCount={col.advance} onRetry={handleRetry} fill />
              }
            </div>
            <div className="shrink-0 border-t border-stone-800 pt-3">
              <div className="text-xs text-stone-500 uppercase tracking-widest mb-2">Watt Bomber</div>
              <WattBomber results={col.poolResults} riders={riders} limit={3} />
            </div>
          </div>
        ))}
      </div>

      <button onClick={generateBracket} className="self-center px-16 py-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-xl font-bold tracking-widest uppercase transition-colors mb-8">
        Generate Bracket →
      </button>
    </div>

    {freePairOpen && (
      <FreePairModal onClose={() => setFreePairOpen(false)} onStart={handleFreePairStart} />
    )}
    </>
  )
}
