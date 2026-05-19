import { useState } from 'react'
import { useEventStore, selectBracket, selectBracketF, selectBracketOpen, selectRiders, selectHasGenderSplit } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { BracketTree } from '../components/BracketTree'
import { FreePairModal } from '../components/FreePairModal'
import type { BracketMatch, BracketRound, BracketPool } from '@shared/types'

function findNextMatch(rounds: BracketRound[]): BracketMatch | null {
  for (const round of rounds) {
    for (const match of round.matches) {
      if (!match.winnerId && match.topRiderId && match.bottomRiderId) return match
    }
  }
  return null
}

export function Bracket() {
  const bracketM = useEventStore(selectBracket)
  const bracketF = useEventStore(selectBracketF)
  const bracketOpen = useEventStore(selectBracketOpen)
  const riders = useEventStore(selectRiders)
  const hasGenderSplit = useEventStore(selectHasGenderSplit)
  const setCurrentRaceId = useEventStore((s) => s.setCurrentRaceId)
  const setPhase = useEventStore((s) => s.setPhase)
  const setFreePairRiders = useRaceStore((s) => s.setFreePairRiders)
  const [freePairOpen, setFreePairOpen] = useState(false)

  const nextMatchM = findNextMatch(bracketM)
  const nextMatchF = findNextMatch(bracketF)
  const nextMatchOpen = findNextMatch(bracketOpen)

  // First unfinished match across all pools
  const nextMatch = nextMatchM ?? nextMatchF ?? nextMatchOpen
  const nextPool: BracketPool = nextMatchM ? 'M' : nextMatchF ? 'F' : 'Open'

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

  const topName = riders.find((r) => r.id === nextMatch?.topRiderId)?.name ?? '?'
  const bottomName = riders.find((r) => r.id === nextMatch?.bottomRiderId)?.name ?? '?'

  const poolLabel: Record<BracketPool, string> = { M: 'Men', F: 'Women', Open: 'Open' }

  // Bracket sections to render
  const sections: { pool: BracketPool; label: string; rounds: BracketRound[] }[] = []
  if (bracketM.length > 0) sections.push({ pool: 'M', label: hasGenderSplit ? 'Men' : '', rounds: bracketM })
  if (bracketF.length > 0) sections.push({ pool: 'F', label: 'Women', rounds: bracketF })
  if (bracketOpen.length > 0) sections.push({ pool: 'Open', label: hasGenderSplit ? 'Open' : '', rounds: bracketOpen })

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between shrink-0">
          <button
            onClick={() => setPhase('registration')}
            className="text-stone-500 hover:text-white text-sm uppercase tracking-widest transition-colors"
          >
            ← Riders
          </button>
          <h2 className="text-3xl font-black uppercase tracking-widest text-white">
            Tournament Bracket
          </h2>
          <button
            onClick={() => setFreePairOpen(true)}
            className="text-xs text-stone-500 hover:text-stone-300 border border-stone-700 hover:border-stone-500 rounded px-3 py-1.5 uppercase tracking-widest transition-colors"
          >
            Free Pair
          </button>
        </div>

        {/* Scrollable bracket area */}
        <div className="flex-1 overflow-y-auto px-8 pb-4">
          {sections.map((sec, i) => (
            <div key={sec.pool} className={i < sections.length - 1 ? 'mb-10' : ''}>
              {sec.label && (
                <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${
                  sec.pool === 'M' ? 'text-blue-400' : sec.pool === 'F' ? 'text-pink-400' : 'text-stone-400'
                }`}>
                  {sec.label}
                </div>
              )}
              <BracketTree rounds={sec.rounds} riders={riders} currentMatchId={nextMatch?.id} />
            </div>
          ))}
        </div>

        {/* Bottom action */}
        <div className="shrink-0 pb-8 flex flex-col items-center gap-4">
          {nextMatch ? (
            <>
              <div className="text-stone-400 text-lg text-center">
                {hasGenderSplit && (
                  <span className={`text-sm font-bold mr-2 ${nextPool === 'M' ? 'text-blue-400' : nextPool === 'F' ? 'text-pink-400' : 'text-stone-400'}`}>
                    [{poolLabel[nextPool]}]
                  </span>
                )}
                Next:{' '}
                <strong className="text-white">{topName}</strong>
                {' vs '}
                <strong className="text-white">{bottomName}</strong>
              </div>
              <button
                onClick={handleStartMatch}
                className="px-16 py-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
              >
                Start Race →
              </button>
            </>
          ) : (
            <button
              onClick={() => setPhase('complete')}
              className="px-16 py-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
            >
              View Final Results →
            </button>
          )}
        </div>
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
