import { useEventStore, selectRiders, selectQualifyingResults } from '../store/event.store'
import { Leaderboard } from '../components/Leaderboard'
import { WattBomber } from '../components/WattBomber'
import { BRACKET_SIZE } from '@shared/constants'

export function QualifyingResults() {
  const riders = useEventStore(selectRiders)
  const results = useEventStore(selectQualifyingResults)
  const generateBracket = useEventStore((s) => s.generateBracket)
  const removeQualifyingResult = useEventStore((s) => s.removeQualifyingResult)
  const setPhase = useEventStore((s) => s.setPhase)

  function handleRetry(riderId: string) {
    removeQualifyingResult(riderId)
    setPhase('qualifying')
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
    <div className="flex flex-col h-full px-8 pt-8 gap-6">
      <div className="flex items-center">
        <button
          onClick={() => setPhase('registration')}
          className="text-gray-500 hover:text-white text-sm uppercase tracking-widest transition-colors"
        >
          ← Riders
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
          <div className="text-xs text-gray-500 uppercase tracking-widest">Watt Bomber</div>
          <WattBomber results={results} riders={riders} limit={3} />
        </div>
      </div>

      <button
        onClick={generateBracket}
        className="w-full py-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xl font-bold tracking-widest uppercase transition-colors mb-8"
      >
        Generate Bracket →
      </button>
    </div>
  )
}
