import { useState } from 'react'
import { useEventStore } from '../store/event.store'
import { DEFAULT_DISTANCE_METRES } from '@shared/constants'

export function Setup() {
  const initEvent = useEventStore((s) => s.initEvent)
  const [name, setName] = useState('')
  const [distance, setDistance] = useState(DEFAULT_DISTANCE_METRES)

  const canStart = name.trim().length > 0

  function handleStart() {
    if (!canStart) return
    initEvent({ name: name.trim(), distanceMetres: distance })
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-12 px-8">
      <div className="text-center">
        <h1 className="text-6xl font-black tracking-widest uppercase text-white mb-2">
          Sprint Series
        </h1>
        <p className="text-stone-500 tracking-widest uppercase text-sm">
          Head-to-head bike trainer competition
        </p>
      </div>

      <div className="flex flex-col gap-6 w-full max-w-md">
        <div>
          <label className="block text-xs text-stone-500 uppercase tracking-widest mb-2">
            Event Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            className="w-full bg-stone-900 border border-stone-700 rounded px-4 py-3 text-white text-xl font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-stone-600"
            placeholder="e.g. Tuesday Night Series"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs text-stone-500 uppercase tracking-widest mb-2">
            Sprint Distance (metres)
          </label>
          <input
            type="number"
            value={distance}
            onChange={(e) => setDistance(Math.max(50, Number(e.target.value)))}
            className="w-full bg-stone-900 border border-stone-700 rounded px-4 py-3 text-white text-xl font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>

        <button
          disabled={!canStart}
          onClick={handleStart}
          className="w-full py-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-h)] disabled:bg-stone-800 disabled:text-stone-600 text-[var(--accent-fg)] text-xl font-bold tracking-widest uppercase transition-colors"
        >
          Start Event
        </button>
      </div>
    </div>
  )
}
