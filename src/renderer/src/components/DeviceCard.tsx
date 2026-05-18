import clsx from 'clsx'
import type { BLEDeviceInfo, Lane } from '@shared/types'

interface Props {
  device: BLEDeviceInfo
  assignedLane?: Lane
  onAssign: (lane: Lane) => void
  disabled?: boolean
}

function RssiDots({ rssi }: { rssi: number }) {
  const strength = rssi >= -60 ? 3 : rssi >= -75 ? 2 : 1
  return (
    <div className="flex gap-0.5 items-end h-4">
      {[1, 2, 3].map((level) => (
        <div
          key={level}
          className={clsx(
            'w-1.5 rounded-sm',
            level <= strength ? 'bg-green-400' : 'bg-gray-700'
          )}
          style={{ height: `${level * 4 + 4}px` }}
        />
      ))}
    </div>
  )
}

export function DeviceCard({ device, assignedLane, onAssign, disabled }: Props) {
  return (
    <div className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg px-4 py-3">
      <div className="flex items-center gap-3">
        <RssiDots rssi={device.rssi} />
        <div>
          <div className="text-white font-medium">{device.name}</div>
          <div className="text-gray-500 text-xs font-mono">{device.id.slice(0, 12)}…</div>
        </div>
      </div>

      <div className="flex gap-2">
        {assignedLane ? (
          <span className="px-3 py-1 text-sm rounded bg-blue-900 text-blue-300 font-medium uppercase">
            {assignedLane} lane
          </span>
        ) : (
          <>
            <button
              disabled={disabled}
              onClick={() => onAssign('left')}
              className="px-3 py-1 text-sm rounded bg-gray-700 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors"
            >
              Left
            </button>
            <button
              disabled={disabled}
              onClick={() => onAssign('right')}
              className="px-3 py-1 text-sm rounded bg-gray-700 hover:bg-purple-700 text-white disabled:opacity-40 transition-colors"
            >
              Right
            </button>
          </>
        )}
      </div>
    </div>
  )
}
