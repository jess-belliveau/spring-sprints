import { useState } from 'react'
import { nanoid } from 'nanoid'
import { useEventStore, selectBracket, selectBracketF, selectBracketOpen, selectRiders, selectHasGenderSplit, selectQualifyingResults, selectBracketResults } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { BracketTree } from '../components/BracketTree'
import { WattBomber } from '../components/WattBomber'
import { FreePairModal } from '../components/FreePairModal'
import type { FreePairStartData } from '../components/FreePairModal'
import type { BracketMatch, BracketRound, BracketPool, Rider } from '@shared/types'

function findNextMatchByRound(rounds: BracketRound[]): { match: BracketMatch; round: number } | null {
  for (let r = 0; r < rounds.length; r++) {
    for (const match of rounds[r].matches) {
      if (!match.winnerId && match.topRiderId && match.bottomRiderId && !match.isThirdPlace) return { match, round: r }
    }
  }
  // Check 3rd place match last (after all regular rounds)
  for (let r = 0; r < rounds.length; r++) {
    for (const match of rounds[r].matches) {
      if (!match.winnerId && match.topRiderId && match.bottomRiderId && match.isThirdPlace) return { match, round: r }
    }
  }
  return null
}

function find3rdPlaceMatch(rounds: BracketRound[]): BracketMatch | null {
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.isThirdPlace) return match
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
  const qualifyingResults = useEventStore(selectQualifyingResults)
  const bracketResults = useEventStore(selectBracketResults)
  const setCurrentRaceId = useEventStore((s) => s.setCurrentRaceId)
  const advanceBracket = useEventStore((s) => s.advanceBracket)
  const addBracketResult = useEventStore((s) => s.addBracketResult)
  const setPhase = useEventStore((s) => s.setPhase)
  const setFreePairRiders = useRaceStore((s) => s.setFreePairRiders)
  const [freePairOpen, setFreePairOpen] = useState(false)
  const [declaringWinner, setDeclaringWinner] = useState(false)

  const nextM = findNextMatchByRound(bracketM)
  const nextF = findNextMatchByRound(bracketF)
  const nextOpen = findNextMatchByRound(bracketOpen)

  // Pick the lowest round index with any ready match, then first bracket at that round (M → F → Open).
  // This ensures all QFs run before any SFs, all SFs before the finals, across all pools.
  const minRound = Math.min(nextM?.round ?? Infinity, nextF?.round ?? Infinity, nextOpen?.round ?? Infinity)
  const nextEntry = isFinite(minRound)
    ? (nextM?.round === minRound ? nextM : nextF?.round === minRound ? nextF : nextOpen!)
    : null
  const nextMatch = nextEntry?.match ?? null
  const nextPool: BracketPool = nextM?.round === minRound ? 'M' : nextF?.round === minRound ? 'F' : 'Open'

  function handleStartMatch() {
    if (!nextMatch) return
    setCurrentRaceId(nextMatch.id)
    setPhase('head-to-head')
  }

  function handleFreePairStart(data: FreePairStartData) {
    setFreePairRiders({ ...data, returnPhase: 'bracket' })
    setFreePairOpen(false)
    setPhase('free-pair')
  }

  function handleSimAll() {
    for (const pool of (['M', 'F', 'Open'] as BracketPool[])) {
      for (let r = 0; ; r++) {
        const { event } = useEventStore.getState()
        if (!event) break
        const bracket = pool === 'M' ? event.bracket : pool === 'F' ? event.bracketF : event.bracketOpen
        if (r >= bracket.length) break
        for (const match of bracket[r].matches) {
          if (match.winnerId || !match.topRiderId || !match.bottomRiderId) continue
          const winnerId = Math.random() < 0.5 ? match.topRiderId : match.bottomRiderId
          addBracketResult({
            raceId: nanoid(),
            type: 'bracket',
            startedAt: Date.now(),
            left: { riderId: match.topRiderId, lane: 'left', finishTimeMs: Math.round(20000 + Math.random() * 20000), maxWatts: Math.round(200 + Math.random() * 400), avgWatts: Math.round(150 + Math.random() * 250), distanceMetres: event.config.distanceMetres },
            right: { riderId: match.bottomRiderId, lane: 'right', finishTimeMs: Math.round(20000 + Math.random() * 20000), maxWatts: Math.round(200 + Math.random() * 400), avgWatts: Math.round(150 + Math.random() * 250), distanceMetres: event.config.distanceMetres }
          })
          advanceBracket(match.id, winnerId, nanoid(), pool)
        }
      }
    }
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
          <h2 className="text-3xl font-black uppercase tracking-widest text-white">
            Tournament Bracket
          </h2>
          <div className="flex items-center gap-2">
            {import.meta.env.DEV && (
              <button
                onClick={handleSimAll}
                className="text-xs border border-amber-900 hover:border-amber-700 text-amber-700 hover:text-amber-400 rounded px-3 py-1.5 uppercase tracking-widest transition-colors"
              >
                ⚡ Sim All
              </button>
            )}
            <button
              onClick={() => setFreePairOpen(true)}
              className="text-xs text-stone-500 hover:text-stone-300 border border-stone-700 hover:border-stone-500 rounded px-3 py-1.5 uppercase tracking-widest transition-colors"
            >
              Free Pair
            </button>
          </div>
        </div>

        {/* Scrollable bracket area */}
        <div className="flex-1 overflow-y-auto px-8 pb-4">
          {/* Men + Women face each other in the centre */}
          {bracketM.length > 0 && bracketF.length > 0 ? (
            <div className={`flex items-start gap-0 ${bracketOpen.length > 0 ? 'mb-10' : ''}`}>
              <div className="flex-1 min-w-0 overflow-x-auto">
                <div className="text-xs font-bold uppercase tracking-widest mb-3 text-blue-400">Men</div>
                <BracketTree rounds={bracketM} riders={riders} currentMatchId={nextMatch?.id} />
              </div>
              <div className="w-px self-stretch bg-stone-700 mx-4 shrink-0" />
              <div className="flex-1 min-w-0 overflow-x-auto flex flex-col items-end">
                <div className="text-xs font-bold uppercase tracking-widest mb-3 text-pink-400 text-right">Women</div>
                <BracketTree rounds={bracketF} riders={riders} currentMatchId={nextMatch?.id} mirrored />
              </div>
            </div>
          ) : (
            sections.filter((s) => s.pool !== 'Open').map((sec, i) => (
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
            ))
          )}

          {/* Open bracket always below */}
          {bracketOpen.length > 0 && (
            <div>
              {hasGenderSplit && (
                <div className="text-xs font-bold uppercase tracking-widest mb-3 text-stone-400">Open</div>
              )}
              <BracketTree rounds={bracketOpen} riders={riders} currentMatchId={nextMatch?.id} />
            </div>
          )}

          {/* 3rd Place Matches */}
          {sections.some((s) => find3rdPlaceMatch(s.rounds)) && (
            <div className="mt-8 border-t border-stone-800 pt-4">
              <div className="text-xs text-stone-500 uppercase tracking-widest mb-3">3rd Place</div>
              {bracketM.length > 0 && bracketF.length > 0 ? (
                <div className="flex items-start gap-0">
                  {(['M', 'F'] as const).map((pool, i) => {
                    const sec = sections.find((s) => s.pool === pool)
                    if (!sec) return <div key={pool} className="flex-1" />
                    const m = find3rdPlaceMatch(sec.rounds)
                    if (!m) return <div key={pool} className="flex-1" />
                    const topName = riders.find((r: Rider) => r.id === m.topRiderId)?.name ?? 'TBD'
                    const bottomName = riders.find((r: Rider) => r.id === m.bottomRiderId)?.name ?? 'TBD'
                    const mirrored = pool === 'F'
                    return (
                      <>
                        {i === 1 && <div className="w-px self-stretch bg-stone-800 mx-4 shrink-0" />}
                        <div key={pool} className={`flex-1 min-w-0 flex ${mirrored ? 'justify-end' : 'justify-start'}`}>
                          <div className={`min-w-[200px] border rounded-lg overflow-hidden ${m.winnerId ? 'border-stone-700' : 'border-stone-700 opacity-60'}`}>
                            <div className={`px-3 py-2 text-sm font-medium border-b border-stone-700 ${mirrored ? 'text-right' : ''} ${m.winnerId === m.topRiderId && m.winnerId ? 'text-green-400 bg-stone-800' : 'text-stone-300 bg-stone-900'}`}>{topName}</div>
                            <div className={`px-3 py-2 text-sm font-medium ${mirrored ? 'text-right' : ''} ${m.winnerId === m.bottomRiderId && m.winnerId ? 'text-green-400 bg-stone-800' : 'text-stone-300 bg-stone-900'}`}>{bottomName}</div>
                          </div>
                        </div>
                      </>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {sections.map((sec) => {
                    const m = find3rdPlaceMatch(sec.rounds)
                    if (!m) return null
                    const topName = riders.find((r: Rider) => r.id === m.topRiderId)?.name ?? 'TBD'
                    const bottomName = riders.find((r: Rider) => r.id === m.bottomRiderId)?.name ?? 'TBD'
                    return (
                      <div key={sec.pool} className="flex flex-col gap-1 min-w-[200px]">
                        {sec.label && (
                          <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${
                            sec.pool === 'M' ? 'text-blue-400' : sec.pool === 'F' ? 'text-pink-400' : 'text-stone-400'
                          }`}>{sec.label}</div>
                        )}
                        <div className={`w-full border border-stone-700 rounded-lg overflow-hidden ${!m.winnerId ? 'opacity-60' : ''}`}>
                          <div className={`px-3 py-2 text-sm font-medium border-b border-stone-700 ${m.winnerId === m.topRiderId && m.winnerId ? 'text-green-400 bg-stone-800' : 'text-stone-400 bg-stone-900'}`}>{topName}</div>
                          <div className={`px-3 py-2 text-sm font-medium ${m.winnerId === m.bottomRiderId && m.winnerId ? 'text-green-400 bg-stone-800' : 'text-stone-400 bg-stone-900'}`}>{bottomName}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Watt Bomber — updates as bracket races complete */}
          {bracketResults.length > 0 && (
            <div className="mt-8 border-t border-stone-800 pt-4 pb-2 max-w-xs">
              <div className="text-xs text-stone-500 uppercase tracking-widest mb-2">Watt Bomber</div>
              <WattBomber results={[...qualifyingResults, ...bracketResults]} riders={riders} limit={3} />
            </div>
          )}
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
                {nextMatch.isThirdPlace ? '3rd Place: ' : 'Next: '}
                <strong className="text-white">{topName}</strong>
                {' vs '}
                <strong className="text-white">{bottomName}</strong>
              </div>

              {declaringWinner ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="text-stone-500 text-sm uppercase tracking-widest">Declare winner</div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        advanceBracket(nextMatch.id, nextMatch.topRiderId!, nanoid(), nextPool)
                        setDeclaringWinner(false)
                      }}
                      className="px-10 py-3 bg-stone-700 hover:bg-stone-600 text-white text-lg font-bold tracking-widest uppercase rounded-lg transition-colors"
                    >
                      {topName}
                    </button>
                    <button
                      onClick={() => {
                        advanceBracket(nextMatch.id, nextMatch.bottomRiderId!, nanoid(), nextPool)
                        setDeclaringWinner(false)
                      }}
                      className="px-10 py-3 bg-stone-700 hover:bg-stone-600 text-white text-lg font-bold tracking-widest uppercase rounded-lg transition-colors"
                    >
                      {bottomName}
                    </button>
                  </div>
                  <button
                    onClick={() => setDeclaringWinner(false)}
                    className="text-stone-600 hover:text-stone-400 text-sm uppercase tracking-widest transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleStartMatch}
                    className="px-16 py-4 bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] text-2xl font-bold tracking-widest uppercase rounded-lg transition-colors"
                  >
                    Start Race →
                  </button>
                  <button
                    onClick={() => setDeclaringWinner(true)}
                    className="text-xs text-stone-500 hover:text-stone-300 border border-stone-700 hover:border-stone-500 rounded px-3 py-1.5 uppercase tracking-widest transition-colors"
                  >
                    Declare Winner
                  </button>
                </div>
              )}
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
