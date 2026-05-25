import { useEffect, useState } from 'react'
import { useBluetoothStore } from '../store/bluetooth.store'
import type { Lane } from '@shared/types'

const LANE_COLOR = { left: 'text-[var(--lane-left)]', right: 'text-[var(--lane-right)]' } as const

function RssiDots({ rssi }: { rssi: number }) {
  const strength = rssi >= -60 ? 3 : rssi >= -75 ? 2 : 1
  return (
    <div className="flex gap-0.5 items-end h-3.5">
      {[1, 2, 3].map((level) => (
        <div
          key={level}
          className={`w-1 rounded-sm ${level <= strength ? 'bg-green-400' : 'bg-stone-700'}`}
          style={{ height: `${level * 3 + 3}px` }}
        />
      ))}
    </div>
  )
}

interface Props {
  onClose: () => void
}

export function DeviceManagerModal({ onClose }: Props) {
  const scannedDevices = useBluetoothStore((s) => s.scannedDevices)
  const connectedDevices = useBluetoothStore((s) => s.connectedDevices)
  const deviceLabels = useBluetoothStore((s) => s.deviceLabels)
  const setDeviceLabel = useBluetoothStore((s) => s.setDeviceLabel)
  const clearScannedDevices = useBluetoothStore((s) => s.clearScannedDevices)
  const setDeviceConnecting = useBluetoothStore((s) => s.setDeviceConnecting)
  const [ftmsOnly, setFtmsOnly] = useState(true)

  useEffect(() => {
    clearScannedDevices()
    window.electronAPI.scanStart(ftmsOnly)
    return () => { window.electronAPI.scanStop() }
  }, [clearScannedDevices, ftmsOnly])

  function handleToggleFtms() {
    window.electronAPI.scanStop()
    clearScannedDevices()
    setFtmsOnly((v) => !v)
    // The effect re-runs via ftmsOnly dependency and restarts the scan
  }

  async function handleDisconnect(lane: Lane) {
    await window.electronAPI.disconnectDevice(lane)
  }

  async function handleAssign(deviceId: string, lane: Lane) {
    const device = scannedDevices.find((d) => d.id === deviceId)
    if (!device) return
    setDeviceConnecting(lane, device)
    const result = await window.electronAPI.connectDevice(deviceId, lane)
    if (!result.success) console.error('Connect failed:', result.error)
  }

  function assignedLane(deviceId: string): Lane | undefined {
    for (const lane of ['left', 'right'] as Lane[]) {
      if (connectedDevices[lane]?.device.id === deviceId) return lane
    }
    return undefined
  }

  const connectedIds = new Set(
    (['left', 'right'] as Lane[]).map((l) => connectedDevices[l]?.device.id).filter(Boolean)
  )
  const anyConnecting =
    connectedDevices['left']?.status === 'connecting' ||
    connectedDevices['right']?.status === 'connecting'

  const available = scannedDevices.filter((d) => !connectedIds.has(d.id))

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-80 z-50 bg-stone-950 border-l border-stone-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
          <span className="text-sm font-bold uppercase tracking-widest text-white">Devices</span>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-white text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Connected lanes */}
          <div className="px-4 pt-4 pb-3">
            <div className="text-xs text-stone-500 uppercase tracking-widest mb-3">Connected</div>
            <div className="flex flex-col gap-2">
              {(['left', 'right'] as Lane[]).map((lane) => {
                const conn = connectedDevices[lane]
                const isConnected = conn?.status === 'connected'
                const isConnecting = conn?.status === 'connecting'
                const isError = conn?.status === 'error'

                return (
                  <div
                    key={lane}
                    className={`rounded-lg border px-3 py-2.5 ${
                      isConnected
                        ? 'border-stone-700 bg-stone-900'
                        : isConnecting
                          ? 'border-amber-800 bg-amber-950/40'
                          : isError
                            ? 'border-red-900 bg-red-950/40'
                            : 'border-stone-800 bg-stone-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-bold uppercase tracking-widest shrink-0 ${LANE_COLOR[lane]}`}>
                          {lane}
                        </span>
                        {isConnected && conn.device && (
                          <>
                            <RssiDots rssi={conn.device.rssi} />
                            <span className="text-white text-sm font-medium truncate">
                              {deviceLabels[lane] || conn.device.name}
                            </span>
                          </>
                        )}
                        {isConnecting && (
                          <span className="text-amber-400 text-sm">Connecting…</span>
                        )}
                        {isError && (
                          <span className="text-red-400 text-sm">Error</span>
                        )}
                        {!conn && (
                          <span className="text-stone-600 text-sm">Empty</span>
                        )}
                      </div>

                      {(isConnected || isError) && (
                        <button
                          onClick={() => handleDisconnect(lane)}
                          className="text-xs text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 rounded px-2 py-0.5 shrink-0 transition-colors"
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                    {isConnected && conn.device && (
                      <input
                        type="text"
                        value={deviceLabels[lane] ?? ''}
                        onChange={(e) => setDeviceLabel(lane, e.target.value)}
                        placeholder={conn.device.name}
                        className="mt-2 w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-stone-500 transition-colors"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-stone-800 mx-4" />

          {/* Scan results */}
          <div className="px-4 pt-3 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-xs text-stone-500 uppercase tracking-widest">Available</div>
              <span className="flex items-center gap-1 text-xs text-stone-600">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                Scanning
              </span>
              <button
                onClick={handleToggleFtms}
                title={ftmsOnly ? 'Showing FTMS devices only — click to show all' : 'Showing all devices — click to show FTMS only'}
                className={`ml-auto text-xs border rounded px-2 py-0.5 uppercase tracking-widest transition-colors ${
                  ftmsOnly
                    ? 'text-[var(--accent)] border-[var(--accent)] accent-tint'
                    : 'text-stone-500 border-stone-700 hover:text-stone-300'
                }`}
              >
                FTMS only
              </button>
            </div>

            {available.length === 0 ? (
              <p className="text-stone-700 text-xs text-center py-4">
                No devices found. Make sure trainers are powered on.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {available.map((device) => {
                  const assigned = assignedLane(device.id)
                  return (
                    <div
                      key={device.id}
                      className="flex items-center gap-2 bg-stone-900 border border-stone-700 rounded-lg px-3 py-2.5"
                    >
                      <RssiDots rssi={device.rssi} />
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{device.name}</div>
                        <div className="text-stone-600 text-xs font-mono">{device.id.slice(0, 10)}…</div>
                      </div>
                      {assigned ? (
                        <span className={`text-xs font-bold uppercase tracking-widest shrink-0 ${LANE_COLOR[assigned]}`}>
                          {assigned}
                        </span>
                      ) : (
                        <div className="flex gap-1 shrink-0">
                          <button
                            disabled={anyConnecting}
                            onClick={() => handleAssign(device.id, 'left')}
                            className="text-xs px-2 py-1 rounded border border-[var(--lane-left)] text-[var(--lane-left)] hover:bg-[var(--lane-left)] hover:text-white disabled:opacity-40 transition-colors"
                          >
                            L
                          </button>
                          <button
                            disabled={anyConnecting}
                            onClick={() => handleAssign(device.id, 'right')}
                            className="text-xs px-2 py-1 rounded border border-[var(--lane-right)] text-[var(--lane-right)] hover:bg-[var(--lane-right)] hover:text-white disabled:opacity-40 transition-colors"
                          >
                            R
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
