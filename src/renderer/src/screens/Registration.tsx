import { useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useEventStore, selectConfig, selectRiders, selectQualifyingResults, selectBracket } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { FreePairModal } from '../components/FreePairModal'
import { BRACKET_SIZE } from '@shared/constants'

export function Registration() {
  const config = useEventStore(selectConfig)
  const riders = useEventStore(selectRiders)
  const qualifyingResults = useEventStore(selectQualifyingResults)
  const bracket = useEventStore(selectBracket)
  const addRider = useEventStore((s) => s.addRider)
  const removeRider = useEventStore((s) => s.removeRider)
  const setPhase = useEventStore((s) => s.setPhase)
  const generateBracket = useEventStore((s) => s.generateBracket)
  const reset = useEventStore((s) => s.reset)

  const setFreePairRiders = useRaceStore((s) => s.setFreePairRiders)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [confirmNewEvent, setConfirmNewEvent] = useState(false)
  const [freePairOpen, setFreePairOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const completedIds = new Set(
    qualifyingResults.map((r) => r.left?.riderId ?? r.right?.riderId)
  )
  const hasUnqualifiedRiders = riders.some((r) => !completedIds.has(r.id))

  function handleAdd() {
    const name = input.trim()
    if (!name) return
    if (riders.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      setError('Name already added')
      return
    }
    addRider({ id: nanoid(), name })
    setInput('')
    setError('')
    inputRef.current?.focus()
  }

  function handleContinue() {
    if (bracket.length > 0) {
      generateBracket()
    } else if (hasUnqualifiedRiders) {
      setPhase(qualifyingResults.length > 0 ? 'qualifying' : 'device-pairing')
    } else if (qualifyingResults.length > 0) {
      setPhase('qualifying-results')
    } else {
      setPhase('device-pairing')
    }
  }

  const continueLabel = (() => {
    if (bracket.length > 0) return 'Regenerate Bracket →'
    if (hasUnqualifiedRiders && qualifyingResults.length > 0) return 'Back to Qualifying →'
    if (qualifyingResults.length > 0) return 'Back to Results →'
    return `Continue with ${riders.length > 0 ? riders.length : ''} Riders →`.trim()
  })()

  const canContinue = riders.length >= 2

  function handleFreePairStart(leftName: string, rightName: string, distance: number) {
    setFreePairRiders({ leftName, rightName, distance, returnPhase: 'registration' })
    setFreePairOpen(false)
    setPhase('free-pair')
  }

  return (
    <>
    <div className="flex flex-col h-full px-8 pt-12 gap-6">
      <div className="text-center">
        <h2 className="text-4xl font-black uppercase tracking-widest text-white">
          Rider Registration
        </h2>
        <p className="text-stone-500 mt-1">{config.name} · {config.distanceMetres}m sprint</p>
        <p className="text-stone-600 text-sm mt-1">
          Any number of riders can qualify — top {BRACKET_SIZE} advance to the bracket
        </p>
      </div>

      {/* Add rider input */}
      <div className="flex gap-2 w-full max-w-md mx-auto">
        <div className="flex-1">
          <input
            ref={inputRef}
            type="text"
            value={input}
            maxLength={24}
            onChange={(e) => { setInput(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="w-full bg-stone-900 border border-stone-700 rounded px-4 py-3 text-white text-lg font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-stone-600"
            placeholder="Rider name…"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
        </div>
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="px-5 py-3 rounded bg-[var(--accent)] hover:bg-[var(--accent-h)] disabled:bg-stone-800 disabled:text-stone-600 text-[var(--accent-fg)] font-bold text-lg transition-colors"
        >
          Add
        </button>
      </div>

      {/* Rider list */}
      <div className="flex-1 scrollable w-full max-w-md mx-auto">
        {riders.length === 0 ? (
          <p className="text-stone-600 text-center py-8">No riders added yet</p>
        ) : (
          <div className="flex flex-col gap-2">
            {riders.map((rider, i) => {
              const hasResult = qualifyingResults.some(
                (r) => r.left?.riderId === rider.id || r.right?.riderId === rider.id
              )
              return (
                <div
                  key={rider.id}
                  className="flex items-center justify-between bg-stone-900 border border-stone-800 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-stone-600 text-sm w-6 text-right">{i + 1}</span>
                    <span className="text-white font-medium text-lg">{rider.name}</span>
                    {hasResult && (
                      <span className="text-xs text-green-400 border border-green-800 rounded px-1.5 py-0.5 uppercase tracking-widest">
                        Qualified
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeRider(rider.id)}
                    className="text-stone-600 hover:text-red-400 text-xl leading-none px-2 transition-colors"
                    aria-label="Remove rider"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="w-full max-w-md mx-auto pb-8 flex flex-col gap-3">
        {riders.length > 0 && riders.length < 2 && (
          <p className="text-amber-500 text-sm text-center">Add at least 2 riders to continue</p>
        )}
        <button
          disabled={!canContinue}
          onClick={handleContinue}
          className="w-full py-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-h)] disabled:bg-stone-800 disabled:text-stone-600 text-[var(--accent-fg)] text-xl font-bold tracking-widest uppercase transition-colors"
        >
          {continueLabel}
        </button>

        <button
          onClick={() => setFreePairOpen(true)}
          className="w-full py-3 rounded-lg border border-stone-700 hover:border-stone-500 text-stone-400 hover:text-white text-sm font-bold tracking-widest uppercase transition-colors"
        >
          Free Pair Race
        </button>

        {/* New Event — two-tap confirm to prevent accidents */}
        {!confirmNewEvent ? (
          <button
            onClick={() => setConfirmNewEvent(true)}
            className="w-full py-2 rounded-lg border border-stone-800 hover:border-stone-600 text-stone-600 hover:text-stone-400 text-sm font-medium tracking-widest uppercase transition-colors"
          >
            New Event
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 py-2 rounded-lg bg-red-900 hover:bg-red-800 text-red-300 text-sm font-bold tracking-widest uppercase transition-colors"
            >
              Confirm — Clear All Data
            </button>
            <button
              onClick={() => setConfirmNewEvent(false)}
              className="px-4 py-2 rounded-lg border border-stone-700 text-stone-500 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
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
