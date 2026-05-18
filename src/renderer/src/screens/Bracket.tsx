import { useEventStore, selectBracket, selectRiders } from '../store/event.store'
import { BracketTree } from '../components/BracketTree'
import type { BracketMatch } from '@shared/types'

function findNextMatch(rounds: ReturnType<typeof selectBracket>): BracketMatch | null {
  for (const round of rounds) {
    for (const match of round.matches) {
      if (!match.winnerId && match.topRiderId && match.bottomRiderId) {
        return match
      }
    }
  }
  return null
}

export function Bracket() {
  const bracket = useEventStore(selectBracket)
  const riders = useEventStore(selectRiders)
  const setCurrentRaceId = useEventStore((s) => s.setCurrentRaceId)
  const setPhase = useEventStore((s) => s.setPhase)

  const nextMatch = findNextMatch(bracket)

  function handleStartMatch() {
    if (!nextMatch) return
    setCurrentRaceId(nextMatch.id)
    setPhase('head-to-head')
  }

  return (
    <div className="flex flex-col h-full px-8 pt-8 gap-8">
      <div className="flex items-center">
        <button
          onClick={() => setPhase('registration')}
          className="text-gray-500 hover:text-white text-sm uppercase tracking-widest transition-colors"
        >
          ← Riders
        </button>
      </div>
      <h2 className="text-4xl font-black uppercase tracking-widest text-white text-center -mt-4">
        Tournament Bracket
      </h2>

      <div className="flex-1 flex items-center justify-center">
        <BracketTree rounds={bracket} riders={riders} currentMatchId={nextMatch?.id} />
      </div>

      {nextMatch ? (
        <div className="flex flex-col items-center gap-4 pb-8">
          <div className="text-gray-400 text-lg">
            Next:{' '}
            <strong className="text-white">
              {riders.find((r) => r.id === nextMatch.topRiderId)?.name}
            </strong>{' '}
            vs{' '}
            <strong className="text-white">
              {riders.find((r) => r.id === nextMatch.bottomRiderId)?.name}
            </strong>
          </div>
          <button
            onClick={handleStartMatch}
            className="px-16 py-4 bg-green-600 hover:bg-green-500 text-white text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
          >
            Start Race →
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center pb-8">
          <button
            onClick={() => setPhase('complete')}
            className="px-16 py-4 bg-yellow-600 hover:bg-yellow-500 text-white text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
          >
            View Final Results →
          </button>
        </div>
      )}
    </div>
  )
}
