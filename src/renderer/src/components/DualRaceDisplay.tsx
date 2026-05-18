import type { LiveLaneState } from '@shared/types'
import { RaceDisplay } from './RaceDisplay'

interface Props {
  left: LiveLaneState | null
  right: LiveLaneState | null
  targetDistance: number
}

export function DualRaceDisplay({ left, right, targetDistance }: Props) {
  return (
    <div className="flex w-full h-full">
      <RaceDisplay lane={left} targetDistance={targetDistance} label="LEFT" side="left" />

      {/* Centre divider */}
      <div className="flex flex-col items-center justify-center px-4 gap-2">
        <div className="w-px h-full bg-gray-700" />
        <div className="absolute text-gray-500 text-sm font-bold tracking-widest">VS</div>
      </div>

      <RaceDisplay lane={right} targetDistance={targetDistance} label="RIGHT" side="right" />
    </div>
  )
}
