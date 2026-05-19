import { useState } from 'react'
import { useEventStore, selectRiders, selectQualifyingResults } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { Leaderboard } from '../components/Leaderboard'
import { WattBomber } from '../components/WattBomber'
import { FreePairModal } from '../components/FreePairModal'
import { BRACKET_SIZE } from '@shared/constants'

export function QualifyingResults() {
  const riders = useEventStore(selectRiders)
  const results = useEventStore(selectQualifyingResults)
  const generateBracket = useEventStore((s) => s.generateBracket)
  const removeQualifyingResult = useEventStore((s) => s.removeQualifyingResult)
  const setPhase = useEventStore((s) => s.setPhase)
  const setFreePairRiders = useRaceStore((s) => s.setFreePairRiders)
  const [freePairOpen, setFreePairOpen] = useState(false)

  function handleRetry(riderId: string) {
    removeQualifyingResult(riderId)
    setPhase('qualifying')
  }

  function handleFreePairStart(leftName: string, rightName: string) {
    setFreePairRiders({ leftName, rightName, returnPhase: 'qualifying-results' })
    setFreePairOpen(false)
    setPhase('free-pair')
  }

  const sorted = [...results].sort((a, b) => {
    const aTime = a.left?.finishTimeMs ?? a.right?.finishTimeMs ?? Infinity
    const bTime = b.left?.finishTimeMs ?? b.right?.finishTimeMs ?? Infinity
    return aTime - bTime
  })

  const rows = sorted.map((result, idx) => {
    const riderId = result.left?.riderId ?? result.right?.riderId ?? ''
    const rider = riders.find((r) => r.id === riderId)!
    return { seed: idx + 1, rider, result }
  })

  const advanceCount = Math.min(BRACKET_SIZE, rows.length)

  return (
    <>
    <div className="flex flex-col h-full px-8 pt-8 gap-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPhase('registration')}
          className="text-stone-500 hover:text-white text-sm uppercase tracking-widest transition-colors"
        >
          ← Riders
        </button>
        <button
          onClick={() => setFreePairOpen(true)}
          className="text-xs text-stone-500 hover:text-stone-300 border border-stone-700 hover:border-stone-500 rounded px-3 py-1.5 uppercase tracking-widest transition-colors"
        >
          Free Pair
        </button>
      </div>
      <div className="text-center -mt-2">
        <h2 className="text-4xl font-black uppercase tracking-widest text-white">
          Qualifying Results
        </h2>
        {rows.length > BRACKET_SIZE && (
          <p className="text-green-400 text-sm mt-2 tracking-wide">
            Top {BRACKET_SIZE} riders advance to the bracket
          </p>
        )}
      </div>

      <div className="flex-1 flex gap-8 min-h-0">
        <div className="flex-1 overflow-y-auto">
          <Leaderboard rows={rows} advanceCount={advanceCount} onRetry={handleRetry} />
        </div>

        <div className="w-56 shrink-0 flex flex-col gap-3">
          <div className="text-xs text-stone-500 uppercase tracking-widest">Watt Bomber</div>
          <WattBomber results={results} riders={riders} limit={3} />
        </div>
      </div>

      <button
        onClick={generateBracket}
        className="self-center px-16 py-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-xl font-bold tracking-widest uppercase transition-colors mb-8"
      >
        Generate Bracket →
      </button>
    </div>

    {freePairOpen && (
      <FreePairModal
        onClose={() => setFreePairOpen(false)}
        onStart={handleFreePairStart}
      />
    )}
    </>
  )
}
