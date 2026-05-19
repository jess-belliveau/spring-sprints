import { useRef, useState } from 'react'

interface Props {
  onClose: () => void
  onGenerate: (names: string[]) => void
}

function nextPowerOf2(n: number): number {
  let s = 2
  while (s < n) s *= 2
  return s
}

export function CustomBracketModal({ onClose, onGenerate }: Props) {
  const [names, setNames] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleAdd() {
    const name = input.trim()
    if (!name) return
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) {
      setError('Name already added')
      return
    }
    setNames((prev) => [...prev, name])
    setInput('')
    setError('')
    inputRef.current?.focus()
  }

  function handleRemove(i: number) {
    setNames((prev) => prev.filter((_, idx) => idx !== i))
  }

  const bracketSize = names.length >= 2 ? nextPowerOf2(names.length) : null
  const byeCount = bracketSize ? bracketSize - names.length : 0

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-stone-950 border border-stone-700 rounded-xl p-8 w-full max-w-md shadow-2xl flex flex-col gap-5 max-h-[80vh]">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-1">
              Custom Bracket
            </h2>
            <p className="text-stone-500 text-sm">Enter rider names — bracket scales to fit.</p>
          </div>

          {/* Add name input */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              maxLength={24}
              onChange={(e) => { setInput(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Rider name…"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-4 py-3 text-white placeholder-stone-600 focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
            <button
              onClick={handleAdd}
              disabled={!input.trim()}
              className="px-5 py-3 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-h)] disabled:bg-stone-800 disabled:text-stone-600 text-[var(--accent-fg)] font-bold transition-colors"
            >
              Add
            </button>
          </div>
          {error && <p className="text-red-400 text-sm -mt-3">{error}</p>}

          {/* Rider list */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-0">
            {names.length === 0 ? (
              <p className="text-stone-700 text-sm text-center py-4">No riders added yet</p>
            ) : (
              names.map((name, i) => (
                <div key={i} className="flex items-center gap-3 bg-stone-900 rounded-lg px-4 py-2.5">
                  <span className="text-stone-600 text-sm w-5 text-right shrink-0">{i + 1}</span>
                  <span className="flex-1 text-white font-medium truncate">{name}</span>
                  <button
                    onClick={() => handleRemove(i)}
                    className="text-stone-600 hover:text-red-400 text-xl leading-none transition-colors"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Bracket info */}
          {bracketSize && (
            <div className="text-xs text-stone-500 text-center">
              {names.length} riders → {bracketSize}-player bracket
              {byeCount > 0 && ` · ${byeCount} bye${byeCount > 1 ? 's' : ''}`}
            </div>
          )}
          {names.length === 1 && (
            <p className="text-amber-500 text-xs text-center">Add at least 2 riders</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-stone-700 text-stone-400 hover:text-white hover:border-stone-500 rounded-lg uppercase tracking-widest text-sm font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onGenerate(names)}
              disabled={names.length < 2}
              className="flex-[2] px-8 py-3 bg-[var(--accent)] hover:bg-[var(--accent-h)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--accent-fg)] rounded-lg uppercase tracking-widest text-sm font-bold transition-colors"
            >
              Generate Bracket →
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
