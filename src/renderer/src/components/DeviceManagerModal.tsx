import { useEffect } from 'react'
import { useBluetoothStore } from '../store/bluetooth.store'
import type { Lane } from '@shared/types'

const LANE_COLOR = { left: 'text-cyan-400', right: 'text-orange-400' } as const

function RssiDots({ rssi }: { rssi: number }) {
  const strength = rssi >= -60 ? 3 : rssi >= -75 ? 2 : 1
  return (
    <div className="flex gap-0.5 items-end h-3.5">
      {[1, 2, 3].map((level) => (
        <div
          key={level}
          className={`w-1 rounded-sm ${level <= strength ? 'bg-green-400' : 'bg-gray-700'}`}
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
  const clearScannedDevices = useBluetoothStore((s) => s.clearScannedDevices)
  const setDeviceConnecting = useBluetoothStore((s) => s.setDeviceConnecting)

  useEffect(() => {
    clearScannedDevices()
    window.electronAPI.scanStart()
    return () => { window.electronAPI.scanStop() }
  }, [clearScannedDevices])

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
      <div className="fixed top-0 right-0 h-full w-80 z-50 bg-gray-950 border-l border-gray-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <span className="text-sm font-bold uppercase tracking-widest text-white">Devices</span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Connected lanes */}
          <div className="px-4 pt-4 pb-3">
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-3">Connected</div>
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
                        ? 'border-gray-700 bg-gray-900'
                        : isConnecting
                          ? 'border-yellow-800 bg-yellow-950/40'
                          : isError
                            ? 'border-red-900 bg-red-950/40'
                            : 'border-gray-800 bg-gray-900/40'
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
                              {conn.device.name}
                            </span>
                          </>
                        )}
                        {isConnecting && (
                          <span className="text-yellow-400 text-sm">Connecting…</span>
                        )}
                        {isError && (
                          <span className="text-red-400 text-sm">Error</span>
                        )}
                        {!conn && (
                          <span className="text-gray-600 text-sm">Empty</span>
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
                  </div>
                )
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800 mx-4" />

          {/* Scan results */}
          <div className="px-4 pt-3 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-xs text-gray-500 uppercase tracking-widest">Available</div>
              <span className="flex items-center gap-1 text-xs text-gray-600">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Scanning
              </span>
            </div>

            {available.length === 0 ? (
              <p className="text-gray-700 text-xs text-center py-4">
                No devices found. Make sure trainers are powered on.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {available.map((device) => {
                  const assigned = assignedLane(device.id)
                  return (
                    <div
                      key={device.id}
                      className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5"
                    >
                      <RssiDots rssi={device.rssi} />
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{device.name}</div>
                        <div className="text-gray-600 text-xs font-mono">{device.id.slice(0, 10)}…</div>
                      </div>
                      {assigned ? (
                        <span className="text-xs font-bold uppercase tracking-widest text-blue-400 shrink-0">
                          {assigned}
                        </span>
                      ) : (
                        <div className="flex gap-1 shrink-0">
                          <button
                            disabled={anyConnecting}
                            onClick={() => handleAssign(device.id, 'left')}
                            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-cyan-800 text-white disabled:opacity-40 transition-colors"
                          >
                            L
                          </button>
                          <button
                            disabled={anyConnecting}
                            onClick={() => handleAssign(device.id, 'right')}
                            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-orange-800 text-white disabled:opacity-40 transition-colors"
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
