import clsx from 'clsx'
import type { LiveLaneState } from '@shared/types'
import { ProgressBar } from './ProgressBar'

interface Props {
  lane: LiveLaneState | null
  targetDistance: number
  label: string
  side: 'left' | 'right'
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  const centiseconds = Math.floor((ms % 1000) / 10)
  return `${min}:${String(sec).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

export function RaceDisplay({ lane, targetDistance, label, side }: Props) {
  if (!lane) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <span className="text-2xl">{label}</span>
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'flex-1 flex flex-col justify-between p-8',
        side === 'left' ? 'items-start' : 'items-end'
      )}
    >
      {/* Rider name */}
      <div
        className={clsx(
          'text-3xl font-bold tracking-widest uppercase text-gray-200',
          lane.finished && 'text-green-400'
        )}
      >
        {lane.riderName}
      </div>

      {/* Large time display */}
      <div className="text-7xl font-bold tabular-nums text-white tracking-tight">
        {formatTime(lane.elapsedMs)}
      </div>

      {/* Power and cadence */}
      <div className="flex gap-8 items-baseline">
        <div>
          <span className="text-5xl font-bold text-yellow-400 tabular-nums">
            {lane.instantWatts}
          </span>
          <span className="text-xl text-gray-400 ml-1">W</span>
        </div>
        <div>
          <span className="text-3xl font-bold text-gray-300 tabular-nums">{lane.cadenceRpm}</span>
          <span className="text-lg text-gray-500 ml-1">rpm</span>
        </div>
      </div>

      {/* Distance */}
      <div className="w-full">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>{Math.round(lane.distanceCovered)}m</span>
          <span>{targetDistance}m</span>
        </div>
        <ProgressBar covered={lane.distanceCovered} total={targetDistance} />
      </div>

      {lane.finished && (
        <div className="text-xl font-bold text-green-400 tracking-widest uppercase">
          FINISHED
        </div>
      )}
    </div>
  )
}
