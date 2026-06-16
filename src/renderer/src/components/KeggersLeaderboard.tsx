import type { GarrettEntry } from '@shared/types'

interface KeggersLeaderboardProps {
  entries: GarrettEntry[]
  highlightNames?: string[]
}

interface Row {
  name: string
  maxWpkg: number
  avgWpkg: number
}

function buildRows(entries: GarrettEntry[]): Row[] {
  const best = new Map<string, Row>()
  for (const e of entries) {
    const key = e.name.toLowerCase()
    const maxWpkg = e.maxWatts / e.weightKg
    const avgWpkg = e.avgWatts / e.weightKg
    const existing = best.get(key)
    if (!existing || maxWpkg > existing.maxWpkg) {
      best.set(key, { name: e.name, maxWpkg, avgWpkg })
    }
  }
  return [...best.values()].sort((a, b) => b.maxWpkg - a.maxWpkg)
}

export function KeggersLeaderboard({ entries, highlightNames }: KeggersLeaderboardProps) {
  const rows = buildRows(entries)
  const highlightSet = new Set((highlightNames ?? []).map((n) => n.toLowerCase()))

  if (rows.length === 0) {
    return <p className="text-stone-600 text-xs text-center py-4">No entries yet</p>
  }

  return (
    <div className="flex flex-col gap-1">
      {rows.map((row, i) => {
        const isHighlighted = highlightSet.has(row.name.toLowerCase())
        return (
          <div
            key={row.name.toLowerCase()}
            className={`flex items-center gap-3 rounded px-3 py-2 ${isHighlighted ? 'accent-tint border border-[var(--accent)]/40' : 'bg-stone-900'}`}
          >
            <span className={`text-sm font-bold w-5 text-right shrink-0 tabular-nums ${i === 0 ? 'text-amber-400' : 'text-stone-500'}`}>
              {i + 1}
            </span>
            <span className="flex-1 text-white text-sm font-medium truncate">{row.name}</span>
            <span className={`text-sm font-black tabular-nums shrink-0 ${i === 0 ? 'text-amber-400' : 'text-stone-300'}`}>
              {row.maxWpkg.toFixed(2)}
              <span className="text-xs font-normal text-stone-500"> W/kg</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
