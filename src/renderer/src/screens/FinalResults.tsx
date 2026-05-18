import { useEventStore, selectBracket, selectRiders, selectQualifyingResults } from '../store/event.store'
import type { BracketRound, LaneResult, Rider, RaceResult } from '@shared/types'

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

function computePlaces(bracket: BracketRound[]): Map<string, number> {
  const places = new Map<string, number>()
  if (bracket.length === 0) return places

  const finalRound = bracket[bracket.length - 1]
  const finalMatch = finalRound?.matches[0]
  if (finalMatch?.winnerId) {
    places.set(finalMatch.winnerId, 1)
    const loserId = finalMatch.topRiderId === finalMatch.winnerId
      ? finalMatch.bottomRiderId
      : finalMatch.topRiderId
    if (loserId) places.set(loserId, 2)
  }

  if (bracket.length >= 2) {
    for (const match of bracket[bracket.length - 2].matches) {
      if (match.winnerId) {
        const loserId = match.topRiderId === match.winnerId ? match.bottomRiderId : match.topRiderId
        if (loserId) places.set(loserId, 3)
      }
    }
  }

  if (bracket.length >= 3) {
    for (const match of bracket[0].matches) {
      if (match.winnerId) {
        const loserId = match.topRiderId === match.winnerId ? match.bottomRiderId : match.topRiderId
        if (loserId && !places.has(loserId)) places.set(loserId, 5)
      }
    }
  }

  return places
}

function buildCsv(riders: Rider[], qualifyingResults: RaceResult[], bracket: BracketRound[]): string {
  const places = computePlaces(bracket)

  const qualMap = new Map<string, LaneResult>(
    qualifyingResults.flatMap((r) => {
      const lane = r.left ?? r.right
      return lane ? [[lane.riderId, lane] as [string, LaneResult]] : []
    })
  )

  const bracketRiderIds = new Set(places.keys())
  const nonBracket = riders
    .filter((r) => !bracketRiderIds.has(r.id) && qualMap.has(r.id))
    .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))

  const rows: { rider: Rider; place: number | null }[] = [
    ...([...places.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([id, place]) => ({ rider: riders.find((r) => r.id === id)!, place }))),
    ...nonBracket.map((rider, i) => ({ rider, place: places.size + i + 1 }))
  ]

  const lines = [
    'name,besttime,maxwatts,avgwatts,finalplace',
    ...rows
      .filter((row) => row.rider)
      .map(({ rider, place }) => {
        const q = qualMap.get(rider.id)
        return [
          `"${rider.name.replace(/"/g, '""')}"`,
          q ? formatTime(q.finishTimeMs) : '',
          q ? q.maxWatts : '',
          q ? q.avgWatts : '',
          place ?? ''
        ].join(',')
      })
  ]

  return lines.join('\r\n')
}

export function FinalResults() {
  const bracket = useEventStore(selectBracket)
  const riders = useEventStore(selectRiders)
  const qualifyingResults = useEventStore(selectQualifyingResults)
  const config = useEventStore((s) => s.event?.config)
  const reset = useEventStore((s) => s.reset)

  const finalRound = bracket[bracket.length - 1]
  const champion = finalRound?.matches[0]?.winnerId
    ? riders.find((r) => r.id === finalRound.matches[0].winnerId)
    : null

  async function handleExport() {
    const csv = buildCsv(riders, qualifyingResults, bracket)
    const slug = (config?.name ?? 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    await window.electronAPI.exportCsv(csv, `${slug}-results.csv`)
  }

  return (
    <div className="flex flex-col h-full px-8 pt-12 gap-8 items-center">
      <h2 className="text-4xl font-black uppercase tracking-widest text-white">Final Results</h2>

      {champion && (
        <div className="flex flex-col items-center gap-2 py-8">
          <div className="text-amber-400 text-2xl uppercase tracking-widest">Champion</div>
          <div className="text-8xl font-black text-white">{champion.name}</div>
        </div>
      )}

      <div className="flex-1 scrollable w-full max-w-2xl">
        {bracket.map((round) => (
          <div key={round.round} className="mb-6">
            <div className="text-xs text-stone-500 uppercase tracking-widest mb-2">
              {['Quarter-Finals', 'Semi-Finals', 'Final'][round.round] ?? `Round ${round.round + 1}`}
            </div>
            {round.matches.map((match) => {
              const top = riders.find((r) => r.id === match.topRiderId)
              const bottom = riders.find((r) => r.id === match.bottomRiderId)
              return (
                <div key={match.id} className="flex gap-2 mb-2">
                  {[top, bottom].map((rider, i) => (
                    <div
                      key={i}
                      className={`flex-1 flex justify-between items-center px-4 py-2 rounded-lg ${
                        rider?.id === match.winnerId ? 'bg-green-950 text-green-400' : 'bg-stone-900 text-stone-400'
                      }`}
                    >
                      <span className="font-medium">{rider?.name ?? 'TBD'}</span>
                      {rider?.id === match.winnerId && (
                        <span className="text-xs uppercase tracking-widest">Winner</span>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="flex gap-4 mb-8">
        <button
          onClick={handleExport}
          className="py-3 px-10 rounded-lg bg-stone-700 hover:bg-stone-600 text-white text-lg font-medium tracking-widest uppercase transition-colors"
        >
          Export CSV
        </button>
        <button
          onClick={reset}
          className="py-3 px-10 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-lg font-medium tracking-widest uppercase transition-colors"
        >
          New Event
        </button>
      </div>
    </div>
  )
}
