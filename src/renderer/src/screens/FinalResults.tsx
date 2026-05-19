import { useEventStore, selectBracket, selectBracketF, selectBracketOpen, selectRiders, selectQualifyingResults, selectHasGenderSplit } from '../store/event.store'
import type { BracketRound, BracketPool, LaneResult, Rider, RaceResult } from '@shared/types'

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

function buildCsvForPool(
  riders: Rider[],
  qualifyingResults: RaceResult[],
  bracket: BracketRound[],
  pool: BracketPool | null
): { rider: Rider; place: number | null; q: LaneResult | null }[] {
  const places = computePlaces(bracket)

  const qualMap = new Map<string, LaneResult>(
    qualifyingResults.flatMap((r) => {
      const lane = r.left ?? r.right
      return lane ? [[lane.riderId, lane] as [string, LaneResult]] : []
    })
  )

  const poolRiders = pool === null
    ? riders
    : pool === 'Open'
      ? riders.filter((r) => !r.gender)
      : riders.filter((r) => r.gender === pool)

  const bracketRiderIds = new Set(places.keys())
  const nonBracket = poolRiders
    .filter((r) => !bracketRiderIds.has(r.id) && qualMap.has(r.id))
    .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99))

  return [
    ...([...places.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([id, place]) => ({ rider: riders.find((r) => r.id === id)!, place, q: qualMap.get(id) ?? null }))),
    ...nonBracket.map((rider, i) => ({ rider, place: places.size + i + 1, q: qualMap.get(rider.id) ?? null }))
  ].filter((row) => row.rider)
}

function buildCsv(
  riders: Rider[],
  qualifyingResults: RaceResult[],
  bracketM: BracketRound[],
  bracketF: BracketRound[],
  bracketOpen: BracketRound[],
  hasGenderSplit: boolean
): string {
  const header = hasGenderSplit
    ? 'name,gender,besttime,maxwatts,avgwatts,finalplace'
    : 'name,besttime,maxwatts,avgwatts,finalplace'

  function rowsForPool(bracket: BracketRound[], pool: BracketPool | null) {
    return buildCsvForPool(riders, qualifyingResults, bracket, pool).map(({ rider, place, q }) => {
      const genderCol = hasGenderSplit ? `,"${rider.gender ?? 'Open'}"` : ''
      return [
        `"${rider.name.replace(/"/g, '""')}"`,
        genderCol,
        q ? formatTime(q.finishTimeMs) : '',
        q ? q.maxWatts : '',
        q ? q.avgWatts : '',
        place ?? ''
      ].join(',')
    })
  }

  let lines: string[]
  if (!hasGenderSplit) {
    lines = [header, ...rowsForPool(bracketM, null)]
  } else {
    lines = [header]
    if (bracketM.length > 0) lines.push(...rowsForPool(bracketM, 'M'))
    if (bracketF.length > 0) lines.push(...rowsForPool(bracketF, 'F'))
    if (bracketOpen.length > 0) lines.push(...rowsForPool(bracketOpen, 'Open'))
  }

  return lines.join('\r\n')
}

function BracketSection({ bracket, riders, label, labelClass }: {
  bracket: BracketRound[]
  riders: Rider[]
  label: string
  labelClass: string
}) {
  if (bracket.length === 0) return null
  const totalRounds = bracket.length
  function roundLabel(idx: number): string {
    const fromEnd = totalRounds - 1 - idx
    if (fromEnd === 0) return 'Final'
    if (fromEnd === 1) return 'Semi-Finals'
    if (fromEnd === 2) return 'Quarter-Finals'
    return `Round ${idx + 1}`
  }
  return (
    <div className="w-full">
      {label && <div className={`text-xs font-bold uppercase tracking-widest mb-3 ${labelClass}`}>{label}</div>}
      {bracket.map((round, rIdx) => (
        <div key={round.round} className="mb-4">
          <div className="text-xs text-stone-500 uppercase tracking-widest mb-2">{roundLabel(rIdx)}</div>
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
  )
}

export function FinalResults() {
  const bracketM = useEventStore(selectBracket)
  const bracketF = useEventStore(selectBracketF)
  const bracketOpen = useEventStore(selectBracketOpen)
  const riders = useEventStore(selectRiders)
  const qualifyingResults = useEventStore(selectQualifyingResults)
  const hasGenderSplit = useEventStore(selectHasGenderSplit)
  const config = useEventStore((s) => s.event?.config)
  const reset = useEventStore((s) => s.reset)

  function getChampion(bracket: BracketRound[]): Rider | null {
    const finalRound = bracket[bracket.length - 1]
    const winnerId = finalRound?.matches[0]?.winnerId
    return winnerId ? (riders.find((r) => r.id === winnerId) ?? null) : null
  }

  const championM = getChampion(bracketM)
  const championF = getChampion(bracketF)
  const championOpen = getChampion(bracketOpen)

  async function handleExport() {
    const csv = buildCsv(riders, qualifyingResults, bracketM, bracketF, bracketOpen, hasGenderSplit)
    const slug = (config?.name ?? 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    await window.electronAPI.exportCsv(csv, `${slug}-results.csv`)
  }

  return (
    <div className="flex flex-col h-full px-8 pt-12 gap-8 items-center">
      <h2 className="text-4xl font-black uppercase tracking-widest text-white">Final Results</h2>

      {hasGenderSplit ? (
        <div className="flex gap-12 flex-wrap justify-center">
          {championM && (
            <div className="flex flex-col items-center gap-1">
              <div className="text-blue-400 text-sm uppercase tracking-widest">Men's Champion</div>
              <div className="text-5xl font-black text-white">{championM.name}</div>
            </div>
          )}
          {championF && (
            <div className="flex flex-col items-center gap-1">
              <div className="text-pink-400 text-sm uppercase tracking-widest">Women's Champion</div>
              <div className="text-5xl font-black text-white">{championF.name}</div>
            </div>
          )}
          {championOpen && (
            <div className="flex flex-col items-center gap-1">
              <div className="text-stone-400 text-sm uppercase tracking-widest">Open Champion</div>
              <div className="text-5xl font-black text-white">{championOpen.name}</div>
            </div>
          )}
        </div>
      ) : (
        championM && (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="text-amber-400 text-2xl uppercase tracking-widest">Champion</div>
            <div className="text-8xl font-black text-white">{championM.name}</div>
          </div>
        )
      )}

      <div className="flex-1 min-h-0 w-full max-w-5xl flex gap-6 overflow-hidden">
        {hasGenderSplit ? (
          <>
            {bracketM.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                <BracketSection bracket={bracketM} riders={riders} label="Men" labelClass="text-blue-400" />
              </div>
            )}
            {bracketF.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                <BracketSection bracket={bracketF} riders={riders} label="Women" labelClass="text-pink-400" />
              </div>
            )}
            {bracketOpen.length > 0 && (
              <div className="flex-1 overflow-y-auto">
                <BracketSection bracket={bracketOpen} riders={riders} label="Open" labelClass="text-stone-400" />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto max-w-2xl mx-auto">
            <BracketSection bracket={bracketM} riders={riders} label="" labelClass="" />
          </div>
        )}
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
