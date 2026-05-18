import clsx from 'clsx'
import type { BracketRound, Rider } from '@shared/types'

interface Props {
  rounds: BracketRound[]
  riders: Rider[]
  currentMatchId?: string
}

function getRiderName(id: string | null, riders: Rider[]): string {
  if (!id) return 'TBD'
  return riders.find((r) => r.id === id)?.name ?? 'Unknown'
}

export function BracketTree({ rounds, riders, currentMatchId }: Props) {
  const roundLabels = ['Quarter-Finals', 'Semi-Finals', 'Final']

  return (
    <div className="flex gap-8 items-start overflow-x-auto pb-4">
      {rounds.map((round, rIdx) => (
        <div key={round.round} className="flex flex-col gap-4 min-w-[200px]">
          <div className="text-xs text-stone-500 uppercase tracking-widest text-center pb-2">
            {roundLabels[rIdx] ?? `Round ${rIdx + 1}`}
          </div>

          <div
            className="flex flex-col"
            style={{ gap: `${Math.pow(2, rIdx + 1) * 16}px` }}
          >
            {round.matches.map((match) => {
              const isCurrent = match.id === currentMatchId
              const topName = getRiderName(match.topRiderId, riders)
              const bottomName = getRiderName(match.bottomRiderId, riders)

              return (
                <div
                  key={match.id}
                  className={clsx(
                    'border rounded-lg overflow-hidden',
                    isCurrent ? 'border-[var(--accent)]' : 'border-stone-700'
                  )}
                >
                  <div
                    className={clsx(
                      'px-3 py-2 text-sm font-medium border-b border-stone-700',
                      match.winnerId === match.topRiderId && match.winnerId
                        ? 'text-green-400 bg-stone-800'
                        : 'text-stone-300 bg-stone-900'
                    )}
                  >
                    {topName}
                  </div>
                  <div
                    className={clsx(
                      'px-3 py-2 text-sm font-medium',
                      match.winnerId === match.bottomRiderId && match.winnerId
                        ? 'text-green-400 bg-stone-800'
                        : 'text-stone-300 bg-stone-900'
                    )}
                  >
                    {bottomName}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
