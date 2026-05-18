import clsx from 'clsx'

interface Props {
  covered: number
  total: number
}

export function ProgressBar({ covered, total }: Props) {
  const pct = Math.min(100, (covered / total) * 100)
  const isNearEnd = pct >= 80

  return (
    <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden">
      <div
        className={clsx(
          'h-full rounded-full transition-all duration-100',
          pct < 50 && 'bg-blue-500',
          pct >= 50 && pct < 80 && 'bg-yellow-400',
          isNearEnd && 'bg-green-400'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
