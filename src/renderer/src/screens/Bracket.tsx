import { useState } from 'react'
import { useEventStore, selectBracket, selectRiders } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { BracketTree } from '../components/BracketTree'
import { FreePairModal } from '../components/FreePairModal'
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
  const setFreePairRiders = useRaceStore((s) => s.setFreePairRiders)
  const [freePairOpen, setFreePairOpen] = useState(false)

  const nextMatch = findNextMatch(bracket)

  function handleStartMatch() {
    if (!nextMatch) return
    setCurrentRaceId(nextMatch.id)
    setPhase('head-to-head')
  }

  function handleFreePairStart(leftName: string, rightName: string, distance: number) {
    setFreePairRiders({ leftName, rightName, distance, returnPhase: 'bracket' })
    setFreePairOpen(false)
    setPhase('free-pair')
  }

  return (
    <>
      <div className="flex flex-col h-full px-8 pt-8 gap-8">
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
        <h2 className="text-4xl font-black uppercase tracking-widest text-white text-center -mt-4">
          Tournament Bracket
        </h2>

        <div className="flex-1 flex items-center justify-center">
          <BracketTree rounds={bracket} riders={riders} currentMatchId={nextMatch?.id} />
        </div>

        {nextMatch ? (
          <div className="flex flex-col items-center gap-4 pb-8">
            <div className="text-stone-400 text-lg">
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
              className="px-16 py-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
            >
              Start Race →
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center pb-8">
            <button
              onClick={() => setPhase('complete')}
              className="px-16 py-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
            >
              View Final Results →
            </button>
          </div>
        )}
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
