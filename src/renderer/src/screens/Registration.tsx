import { useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useEventStore, selectConfig, selectRiders, selectQualifyingResults, selectBracket, selectBracketF, selectBracketOpen, selectHeroMode } from '../store/event.store'
import { useRaceStore } from '../store/race.store'
import { FreePairModal } from '../components/FreePairModal'
import type { FreePairStartData } from '../components/FreePairModal'
import { CustomBracketModal } from '../components/CustomBracketModal'
import { BRACKET_SIZE } from '@shared/constants'

const GENDER_BTN = (active: boolean, color: string) =>
  `text-xs font-bold px-2 py-1 rounded border transition-colors ${
    active ? `${color} border-current` : 'text-stone-600 border-stone-700 hover:border-stone-500 hover:text-stone-400'
  }`

export function Registration() {
  const config = useEventStore(selectConfig)
  const riders = useEventStore(selectRiders)
  const qualifyingResults = useEventStore(selectQualifyingResults)
  const bracketM = useEventStore(selectBracket)
  const bracketF = useEventStore(selectBracketF)
  const bracketOpen = useEventStore(selectBracketOpen)
  const addRider = useEventStore((s) => s.addRider)
  const removeRider = useEventStore((s) => s.removeRider)
  const setRiderGender = useEventStore((s) => s.setRiderGender)
  const setPhase = useEventStore((s) => s.setPhase)
  const generateBracket = useEventStore((s) => s.generateBracket)
  const generateCustomBracket = useEventStore((s) => s.generateCustomBracket)
  const reset = useEventStore((s) => s.reset)
  const heroMode = useEventStore(selectHeroMode)
  const setHeroMode = useEventStore((s) => s.setHeroMode)

  const setFreePairRiders = useRaceStore((s) => s.setFreePairRiders)
  const [input, setInput] = useState('')
  const [newGender, setNewGender] = useState<'M' | 'F'>('M')
  const [error, setError] = useState('')
  const [confirmNewEvent, setConfirmNewEvent] = useState(false)
  const [freePairOpen, setFreePairOpen] = useState(false)
  const [customBracketOpen, setCustomBracketOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasBracket = bracketM.length > 0 || bracketF.length > 0 || bracketOpen.length > 0

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
    addRider({ id: nanoid(), name, gender: newGender })
    setInput('')
    setError('')
    inputRef.current?.focus()
  }

  function handleContinue() {
    if (hasBracket) {
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
    if (hasBracket) return 'Regenerate Bracket →'
    if (hasUnqualifiedRiders && qualifyingResults.length > 0) return 'Back to Qualifying →'
    if (qualifyingResults.length > 0) return 'Back to Results →'
    return `Continue with ${riders.length > 0 ? riders.length : ''} Riders →`.trim()
  })()

  const canContinue = riders.length >= 2

  function handleFreePairStart(data: FreePairStartData) {
    setFreePairRiders({ ...data, returnPhase: 'registration' })
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
          Any number of riders can qualify — top {BRACKET_SIZE} per gender advance to the bracket
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
        <div className="flex rounded border border-stone-700 overflow-hidden shrink-0 self-start mt-0.5">
          <button
            onClick={() => setNewGender('M')}
            className={`px-3 py-3 text-sm font-bold transition-colors ${newGender === 'M' ? 'bg-blue-900 text-blue-300' : 'text-stone-500 hover:text-stone-300'}`}
          >M</button>
          <button
            onClick={() => setNewGender('F')}
            className={`px-3 py-3 text-sm font-bold border-l border-stone-700 transition-colors ${newGender === 'F' ? 'bg-pink-900 text-pink-300' : 'text-stone-500 hover:text-stone-300'}`}
          >F</button>
        </div>
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="px-5 py-3 rounded bg-[var(--accent)] hover:bg-[var(--accent-h)] disabled:bg-stone-800 disabled:text-stone-600 text-[var(--accent-fg)] font-bold text-lg transition-colors self-start"
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
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-stone-600 text-sm w-6 text-right shrink-0">{i + 1}</span>
                    <span className="text-white font-medium text-lg truncate">{rider.name}</span>
                    {hasResult && (
                      <span className="text-xs text-green-400 border border-green-800 rounded px-1.5 py-0.5 uppercase tracking-widest shrink-0">
                        Qualified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <div className="flex rounded overflow-hidden border border-stone-700">
                      <button
                        onClick={() => setRiderGender(rider.id, 'M')}
                        className={GENDER_BTN(rider.gender === 'M', 'text-blue-300')}
                      >M</button>
                      <button
                        onClick={() => setRiderGender(rider.id, 'F')}
                        className={`${GENDER_BTN(rider.gender === 'F', 'text-pink-300')} border-l border-stone-700`}
                      >F</button>
                    </div>
                    <button
                      onClick={() => removeRider(rider.id)}
                      className="text-stone-600 hover:text-red-400 text-xl leading-none px-2 transition-colors"
                      aria-label="Remove rider"
                    >
                      ×
                    </button>
                  </div>
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
          onClick={() => setHeroMode(!heroMode)}
          className={`w-full py-3 rounded-lg border text-sm font-bold tracking-widest uppercase transition-colors ${
            heroMode
              ? 'border-orange-700 text-orange-400 hover:border-orange-500'
              : 'border-stone-700 hover:border-stone-500 text-stone-400 hover:text-white'
          }`}
          title="Hero mode — watts catch fire above big-power thresholds during races"
        >
          🔥 Hero Mode {heroMode ? 'ON' : 'OFF'}
        </button>

        <button
          onClick={() => setFreePairOpen(true)}
          className="w-full py-3 rounded-lg border border-stone-700 hover:border-stone-500 text-stone-400 hover:text-white text-sm font-bold tracking-widest uppercase transition-colors"
        >
          Free Pair Race
        </button>

        <button
          onClick={() => setCustomBracketOpen(true)}
          className="w-full py-3 rounded-lg border border-stone-700 hover:border-stone-500 text-stone-400 hover:text-white text-sm font-bold tracking-widest uppercase transition-colors"
        >
          Custom Bracket
        </button>

        {import.meta.env.DEV && (
          <button
            onClick={() => {
              const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Evan', 'Fiona', 'George', 'Hannah', 'Ivan', 'Julia', 'Kevin', 'Laura', 'Mike', 'Nina', 'Oscar', 'Petra', 'Quinn', 'Rachel', 'Sam', 'Tara']
              names.forEach((name, i) => {
                if (!riders.some((r) => r.name === name)) {
                  addRider({ id: nanoid(), name, gender: i % 2 === 0 ? 'M' : 'F' })
                }
              })
            }}
            className="w-full py-2 rounded-lg border border-amber-900 hover:border-amber-700 text-amber-700 hover:text-amber-400 text-sm font-bold tracking-widest uppercase transition-colors"
          >
            ⚡ Seed 20 Riders
          </button>
        )}

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

    {customBracketOpen && (
      <CustomBracketModal
        onClose={() => setCustomBracketOpen(false)}
        onGenerate={(names) => {
          setCustomBracketOpen(false)
          generateCustomBracket(names)
        }}
      />
    )}
    </>
  )
}
