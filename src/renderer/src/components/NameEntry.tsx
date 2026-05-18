import type { Ref } from 'react'
import clsx from 'clsx'

interface Props {
  index: number
  value: string
  onChange: (value: string) => void
  onNext?: () => void
  error?: string
  ref?: Ref<HTMLInputElement>
}

export function NameEntry({ index, value, onChange, onNext, error, ref }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 uppercase tracking-widest">Rider {index + 1}</label>
      <input
        ref={ref}
        type="text"
        value={value}
        maxLength={24}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            onNext?.()
          }
        }}
        className={clsx(
          'bg-gray-900 border rounded px-4 py-3 text-white text-xl font-medium w-full',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          'placeholder:text-gray-600',
          error ? 'border-red-500' : 'border-gray-700'
        )}
        placeholder={`Rider ${index + 1} name`}
        autoComplete="off"
        spellCheck={false}
      />
      {error && <span className="text-red-400 text-sm">{error}</span>}
    </div>
  )
}
