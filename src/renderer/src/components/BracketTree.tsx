import clsx from 'clsx'
import type { BracketRound, Rider } from '@shared/types'

interface Props {
  rounds: BracketRound[]
  riders: Rider[]
  currentMatchId?: string
  mirrored?: boolean
}

function getRiderName(id: string | null, riders: Rider[]): string {
  if (!id) return 'TBD'
  return riders.find((r) => r.id === id)?.name ?? 'Unknown'
}

export function BracketTree({ rounds, riders, currentMatchId, mirrored = false }: Props) {
  const totalRounds = rounds.length
  function roundLabel(originalIdx: number): string {
    const fromEnd = totalRounds - 1 - originalIdx
    if (fromEnd === 0) return 'Final'
    if (fromEnd === 1) return 'Semi-Finals'
    if (fromEnd === 2) return 'Quarter-Finals'
    return `Round ${originalIdx + 1}`
  }

  const displayRounds = mirrored ? [...rounds].reverse() : rounds

  return (
    <div className="flex gap-8 items-start overflow-x-auto pb-4">
      {displayRounds.map((round, rIdx) => {
        const originalIdx = mirrored ? totalRounds - 1 - rIdx : rIdx
        return (
          <div key={round.round} className="flex flex-col gap-4 min-w-[200px]">
            <div className="text-xs text-stone-500 uppercase tracking-widest text-center pb-2">
              {roundLabel(originalIdx)}
            </div>

            <div
              className="flex flex-col"
              style={{ gap: `${Math.pow(2, originalIdx + 1) * 16}px` }}
            >
              {round.matches.filter((m) => !m.isThirdPlace).map((match) => {
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
        )
      })}
    </div>
  )
}
