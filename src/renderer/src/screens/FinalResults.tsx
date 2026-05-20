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

  return places
}

function podiumFrom(bracket: BracketRound[], riders: Rider[]) {
  const places = computePlaces(bracket)
  return [...places.entries()]
    .sort((a, b) => a[1] - b[1])
    .flatMap(([id, place]) => {
      const rider = riders.find((r) => r.id === id)
      return rider ? [{ place, rider }] : []
    })
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

function PoolPodium({ bracket, riders, label, labelColor }: {
  bracket: BracketRound[]
  riders: Rider[]
  label?: string
  labelColor?: string
}) {
  const podium = podiumFrom(bracket, riders)
  const first = podium.find((p) => p.place === 1)
  const second = podium.find((p) => p.place === 2)
  const thirds = podium.filter((p) => p.place === 3)
  if (!first) return null

  return (
    <div className="flex flex-col items-center gap-6">
      {label && (
        <div className={`text-sm font-bold uppercase tracking-widest ${labelColor}`}>{label}</div>
      )}
      <div className="flex flex-col items-center gap-2">
        <div className="text-4xl">🏆</div>
        <div className="text-7xl font-black text-white tracking-tight leading-none">{first.rider.name}</div>
      </div>
      {(second || thirds.length > 0) && (
        <div className="flex gap-10 flex-wrap justify-center">
          {second && (
            <div className="flex flex-col items-center gap-1">
              <div className="text-2xl">🥈</div>
              <div className="text-3xl font-bold text-stone-300">{second.rider.name}</div>
            </div>
          )}
          {thirds.map(({ rider }) => (
            <div key={rider.id} className="flex flex-col items-center gap-1">
              <div className="text-2xl">🥉</div>
              <div className="text-3xl font-bold text-stone-400">{rider.name}</div>
            </div>
          ))}
        </div>
      )}
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

  const hasMen = bracketM.length > 0
  const hasWomen = bracketF.length > 0
  const hasOpen = bracketOpen.length > 0

  function topWatter(riderSubset: Rider[]) {
    return qualifyingResults
      .flatMap((r) => {
        const lane = r.left ?? r.right
        if (!lane) return []
        const rider = riderSubset.find((rd) => rd.id === lane.riderId)
        return rider ? [{ rider, maxWatts: lane.maxWatts }] : []
      })
      .sort((a, b) => b.maxWatts - a.maxWatts)[0] ?? null
  }

  const wattBomber = hasGenderSplit ? null : topWatter(riders)
  const wattBomberM = hasGenderSplit && hasMen ? topWatter(riders.filter((r) => r.gender === 'M')) : null
  const wattBomberF = hasGenderSplit && hasWomen ? topWatter(riders.filter((r) => r.gender === 'F')) : null
  const wattBomberOpen = hasGenderSplit && hasOpen ? topWatter(riders.filter((r) => !r.gender)) : null

  async function handleExport() {
    const csv = buildCsv(riders, qualifyingResults, bracketM, bracketF, bracketOpen, hasGenderSplit)
    const slug = (config?.name ?? 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    await window.electronAPI.exportCsv(csv, `${slug}-results.csv`)
  }

  return (
    <div className="flex flex-col h-full items-center justify-between px-8 pt-12 pb-8">
      <h2 className="text-4xl font-black uppercase tracking-widest text-white">Final Results</h2>

      <div className="flex-1 flex items-center justify-center w-full">
        {!hasGenderSplit ? (
          <PoolPodium bracket={bracketM} riders={riders} />
        ) : (
          <div className="flex gap-20 flex-wrap justify-center items-start">
            {hasMen && (
              <PoolPodium bracket={bracketM} riders={riders} label="Men" labelColor="text-blue-400" />
            )}
            {hasWomen && (
              <PoolPodium bracket={bracketF} riders={riders} label="Women" labelColor="text-pink-400" />
            )}
            {hasOpen && (
              <PoolPodium bracket={bracketOpen} riders={riders} label="Open" labelColor="text-stone-400" />
            )}
          </div>
        )}
      </div>

      {wattBomber && (
        <div className="flex items-center gap-5 border border-stone-700 rounded-xl px-8 py-4 mb-4">
          <span className="text-2xl">⚡</span>
          <div className="flex flex-col">
            <div className="text-amber-400 text-xs font-bold uppercase tracking-widest">Watt Bomb</div>
            <div className="text-2xl font-black text-white">{wattBomber.rider.name}</div>
          </div>
          <div className="text-3xl font-mono font-bold text-amber-400 ml-2">{wattBomber.maxWatts}W</div>
        </div>
      )}
      {hasGenderSplit && (wattBomberM || wattBomberF || wattBomberOpen) && (
        <div className="flex gap-4 flex-wrap justify-center mb-4">
          {wattBomberM && (
            <div className="flex items-center gap-4 border border-stone-700 rounded-xl px-6 py-3">
              <span className="text-xl">⚡</span>
              <div className="flex flex-col">
                <div className="text-amber-400 text-xs font-bold uppercase tracking-widest">Watt Bomb · <span className="text-blue-400">Men</span></div>
                <div className="text-xl font-black text-white">{wattBomberM.rider.name}</div>
              </div>
              <div className="text-2xl font-mono font-bold text-amber-400 ml-1">{wattBomberM.maxWatts}W</div>
            </div>
          )}
          {wattBomberF && (
            <div className="flex items-center gap-4 border border-stone-700 rounded-xl px-6 py-3">
              <span className="text-xl">⚡</span>
              <div className="flex flex-col">
                <div className="text-amber-400 text-xs font-bold uppercase tracking-widest">Watt Bomb · <span className="text-pink-400">Women</span></div>
                <div className="text-xl font-black text-white">{wattBomberF.rider.name}</div>
              </div>
              <div className="text-2xl font-mono font-bold text-amber-400 ml-1">{wattBomberF.maxWatts}W</div>
            </div>
          )}
          {wattBomberOpen && (
            <div className="flex items-center gap-4 border border-stone-700 rounded-xl px-6 py-3">
              <span className="text-xl">⚡</span>
              <div className="flex flex-col">
                <div className="text-amber-400 text-xs font-bold uppercase tracking-widest">Watt Bomb · <span className="text-stone-400">Open</span></div>
                <div className="text-xl font-black text-white">{wattBomberOpen.rider.name}</div>
              </div>
              <div className="text-2xl font-mono font-bold text-amber-400 ml-1">{wattBomberOpen.maxWatts}W</div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4">
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
