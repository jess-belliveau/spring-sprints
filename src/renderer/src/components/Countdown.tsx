interface Props {
  value: number | null
}

export function Countdown({ value }: Props) {
  const label = value === null ? null : value === 0 ? 'GO!' : String(value)

  if (label === null) return null

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div
        key={label}
        className={
          label === 'GO!'
            ? 'text-[var(--accent)] text-[16rem] font-black'
            : 'text-white text-[20rem] font-black drop-shadow-2xl'
        }
        style={{ textShadow: '0 0 80px rgba(255,255,255,0.3)' }}
      >
        {label}
      </div>
    </div>
  )
}
