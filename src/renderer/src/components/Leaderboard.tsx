import type { RaceResult, Rider } from '@shared/types'

interface Row {
  seed: number
  rider: Rider
  result: RaceResult
}

interface Props {
  rows: Row[]
  advanceCount?: number
  onRetry?: (riderId: string) => void
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  const centiseconds = Math.floor((ms % 1000) / 10)
  return `${min}:${String(sec).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

export function Leaderboard({ rows, advanceCount, onRetry }: Props) {
  return (
    <div className="w-full">
      <div className="flex flex-col gap-1">
        {rows.map(({ seed, rider, result }, i) => {
          const laneResult = result.left ?? result.right
          const advances = advanceCount !== undefined && i < advanceCount
          const canRetry = !advances && !!onRetry
          return (
            <div
              key={rider.id}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 ${advances ? 'bg-green-950 border border-green-800' : 'bg-gray-900'}`}
            >
              <span className={`text-2xl font-bold w-8 shrink-0 ${advances ? 'text-green-400' : 'text-gray-500'}`}>
                {seed}
              </span>

              <span className="flex-1 text-white font-medium text-lg flex items-center gap-3 min-w-0">
                <span className="truncate">{rider.name}</span>
                {advances && (
                  <span className="text-xs font-bold tracking-widest text-green-400 uppercase border border-green-700 rounded px-1.5 py-0.5 shrink-0">
                    Advances
                  </span>
                )}
              </span>

              <span className="text-xl font-mono font-bold text-yellow-400 shrink-0">
                {laneResult ? formatTime(laneResult.finishTimeMs) : '—'}
              </span>

              {advances ? (
                <span className="text-gray-500 text-sm shrink-0 w-28 text-right">
                  {laneResult ? `${laneResult.avgWatts}W / ${laneResult.maxWatts}W` : ''}
                </span>
              ) : (
                <span className="w-28 flex justify-end shrink-0">
                  {canRetry && (
                    <button
                      onClick={() => onRetry!(rider.id)}
                      className="text-sm text-orange-400 hover:text-orange-300 border border-orange-700 hover:border-orange-500 rounded px-3 py-1 transition-colors"
                    >
                      ↺ Retry
                    </button>
                  )}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
