import { useEventStore, selectBracket, selectRiders } from '../store/event.store'

export function FinalResults() {
  const bracket = useEventStore(selectBracket)
  const riders = useEventStore(selectRiders)
  const reset = useEventStore((s) => s.reset)

  const finalRound = bracket[bracket.length - 1]
  const champion = finalRound?.matches[0]?.winnerId
    ? riders.find((r) => r.id === finalRound.matches[0].winnerId)
    : null

  return (
    <div className="flex flex-col h-full px-8 pt-12 gap-8 items-center">
      <h2 className="text-4xl font-black uppercase tracking-widest text-white">Final Results</h2>

      {champion && (
        <div className="flex flex-col items-center gap-2 py-8">
          <div className="text-yellow-400 text-2xl uppercase tracking-widest">Champion</div>
          <div className="text-8xl font-black text-white">{champion.name}</div>
        </div>
      )}

      <div className="flex-1 scrollable w-full max-w-2xl">
        {bracket.map((round) => (
          <div key={round.round} className="mb-6">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">
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
                        rider?.id === match.winnerId ? 'bg-green-950 text-green-400' : 'bg-gray-900 text-gray-400'
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

      <button
        onClick={reset}
        className="py-3 px-10 rounded-lg border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white text-lg font-medium tracking-widest uppercase transition-colors mb-8"
      >
        New Event
      </button>
    </div>
  )
}
