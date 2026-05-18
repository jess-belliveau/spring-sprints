import type { RaceResult, Rider } from '@shared/types'

interface Props {
  results: RaceResult[]
  riders: Rider[]
  limit?: number
}

const MEDALS = ['🥇', '🥈', '🥉']

export function WattBomber({ results, riders, limit = 3 }: Props) {
  const ranked = results
    .map((r) => {
      const lane = r.left ?? r.right
      if (!lane) return null
      const rider = riders.find((rd) => rd.id === lane.riderId)
      if (!rider) return null
      return { rider, maxWatts: lane.maxWatts }
    })
    .filter((x): x is { rider: Rider; maxWatts: number } => x !== null)
    .sort((a, b) => b.maxWatts - a.maxWatts)
    .slice(0, limit)

  return (
    <div className="flex flex-col gap-1">
      {ranked.length === 0 ? (
        <p className="text-gray-700 text-xs text-center py-4">No data yet</p>
      ) : (
        ranked.map(({ rider, maxWatts }, i) => (
          <div
            key={rider.id}
            className="flex items-center gap-2 rounded px-3 py-2 bg-gray-900"
          >
            <span className="text-base w-5 shrink-0 text-center">{MEDALS[i] ?? i + 1}</span>
            <span className="flex-1 text-sm font-medium text-white truncate">{rider.name}</span>
            <span className="text-sm font-mono font-bold text-orange-400 shrink-0">
              {maxWatts}W
            </span>
          </div>
        ))
      )}
    </div>
  )
}
