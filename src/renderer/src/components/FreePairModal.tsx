import { useState } from 'react'
import { useBluetoothStore } from '../store/bluetooth.store'

interface FreePairModalProps {
  onClose: () => void
  onStart: (leftName: string, rightName: string) => void
}

const LANE_DOT_COLOR: Record<string, string> = {
  connected: 'bg-green-400',
  connecting: 'bg-amber-400 animate-pulse',
  error: 'bg-red-500',
  empty: 'bg-stone-600'
}

export function FreePairModal({ onClose, onStart }: FreePairModalProps) {
  const [leftName, setLeftName] = useState('')
  const [rightName, setRightName] = useState('')
  const connectedDevices = useBluetoothStore((s) => s.connectedDevices)

  const leftStatus = connectedDevices['left']?.status ?? 'empty'
  const rightStatus = connectedDevices['right']?.status ?? 'empty'
  const leftConnected = leftStatus === 'connected'
  const rightConnected = rightStatus === 'connected'

  const canStart = leftName.trim().length > 0 && rightName.trim().length > 0 && leftConnected && rightConnected

  function handleStart() {
    if (!canStart) return
    onStart(leftName.trim(), rightName.trim())
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-stone-950 border border-stone-700 rounded-xl p-8 w-full max-w-md shadow-2xl">
          <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-1">
            Free Pair Race
          </h2>
          <p className="text-stone-500 text-sm mb-6">Outside the bracket — results are not recorded.</p>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-[var(--lane-left)] uppercase tracking-widest font-bold">
                  Left Lane
                </label>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${LANE_DOT_COLOR[leftStatus]}`} />
                  <span className="text-xs text-stone-500">
                    {leftConnected
                      ? connectedDevices['left']?.device.name
                      : leftStatus === 'connecting'
                        ? 'Connecting…'
                        : 'No device'}
                  </span>
                </div>
              </div>
              <input
                type="text"
                value={leftName}
                onChange={(e) => setLeftName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                placeholder="Rider name"
                className="w-full bg-stone-900 border border-stone-700 rounded-lg px-4 py-3 text-white placeholder-stone-600 focus:outline-none focus:border-[var(--lane-left)] transition-colors"
                autoFocus
              />
              {!leftConnected && (
                <p className="text-xs text-amber-500">Connect a device to the left lane via BLE</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-[var(--lane-right)] uppercase tracking-widest font-bold">
                  Right Lane
                </label>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${LANE_DOT_COLOR[rightStatus]}`} />
                  <span className="text-xs text-stone-500">
                    {rightConnected
                      ? connectedDevices['right']?.device.name
                      : rightStatus === 'connecting'
                        ? 'Connecting…'
                        : 'No device'}
                  </span>
                </div>
              </div>
              <input
                type="text"
                value={rightName}
                onChange={(e) => setRightName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                placeholder="Rider name"
                className="w-full bg-stone-900 border border-stone-700 rounded-lg px-4 py-3 text-white placeholder-stone-600 focus:outline-none focus:border-[var(--lane-right)] transition-colors"
              />
              {!rightConnected && (
                <p className="text-xs text-amber-500">Connect a device to the right lane via BLE</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-stone-700 text-stone-400 hover:text-white hover:border-stone-500 rounded-lg uppercase tracking-widest text-sm font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStart}
              disabled={!canStart}
              className="flex-[2] px-8 py-3 bg-[var(--accent)] hover:bg-[var(--accent-h)] text-[var(--accent-fg)] rounded-lg uppercase tracking-widest text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start Race →
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
