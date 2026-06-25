import { useEffect } from 'react'
import { useBluetoothStore } from '../store/bluetooth.store'
import { useEventStore } from '../store/event.store'
import { DeviceCard } from '../components/DeviceCard'
import type { Lane } from '@shared/types'

export function DevicePairing() {
  const setPhase = useEventStore((s) => s.setPhase)
  const scannedDevices = useBluetoothStore((s) => s.scannedDevices)
  const connectedDevices = useBluetoothStore((s) => s.connectedDevices)
  const deviceLabels = useBluetoothStore((s) => s.deviceLabels)
  const clearScannedDevices = useBluetoothStore((s) => s.clearScannedDevices)
  const setDeviceConnecting = useBluetoothStore((s) => s.setDeviceConnecting)

  const leftConnected = connectedDevices['left']?.status === 'connected'
  const rightConnected = connectedDevices['right']?.status === 'connected'

  useEffect(() => {
    clearScannedDevices()
    window.electronAPI.scanStart()
    return () => {
      window.electronAPI.scanStop()
    }
  }, [clearScannedDevices])

  async function handleAssign(deviceId: string, lane: Lane) {
    const device = scannedDevices.find((d) => d.id === deviceId)
    if (!device) return
    setDeviceConnecting(lane, device)
    const result = await window.electronAPI.connectDevice(deviceId, lane)
    if (!result.success) {
      console.error('Connect failed:', result.error)
    }
  }

  function assignedLane(deviceId: string): Lane | undefined {
    for (const lane of ['left', 'right'] as Lane[]) {
      if (connectedDevices[lane]?.device.id === deviceId) return lane
    }
    return undefined
  }

  return (
    <div className="flex flex-col h-full px-8 pt-8 gap-8">
      <h2 className="text-4xl font-black uppercase tracking-widest text-white text-center">
        Device Pairing
      </h2>

      {/* Connected lanes status */}
      <div className="flex gap-4 justify-center">
        {(['left', 'right'] as Lane[]).map((lane) => {
          const conn = connectedDevices[lane]
          return (
            <div
              key={lane}
              className={`flex-1 max-w-xs rounded-lg border px-4 py-3 text-center ${
                conn?.status === 'connected'
                  ? 'border-green-500 bg-green-950'
                  : conn?.status === 'connecting'
                    ? 'border-amber-500 bg-amber-950/40'
                    : 'border-stone-700 bg-stone-900'
              }`}
            >
              <div className="text-xs text-stone-500 uppercase tracking-widest mb-1">
                {lane} lane
              </div>
              <div className="text-white font-medium">
                {conn?.status === 'connected'
                  ? deviceLabels[lane] || conn.device.name
                  : conn?.status === 'connecting'
                    ? 'Connecting…'
                    : 'Empty'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Scanned devices */}
      <div className="flex-1 scrollable flex flex-col gap-2">
        <div className="text-xs text-stone-500 uppercase tracking-widest mb-2">
          Scanning for FTMS devices…
        </div>
        {scannedDevices.length === 0 && (
          <div className="text-stone-600 text-center py-8">
            No devices found. Make sure trainers are powered on.
          </div>
        )}
        {scannedDevices.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            assignedLane={assignedLane(device.id)}
            onAssign={(lane) => handleAssign(device.id, lane)}
            disabled={
              assignedLane(device.id) !== undefined ||
              connectedDevices['left']?.status === 'connecting' ||
              connectedDevices['right']?.status === 'connecting'
            }
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 mb-8">
        {leftConnected && !rightConnected && (
          <p className="text-amber-500 text-sm text-center">
            Right lane needed for bracket races — connect it before qualifying ends
          </p>
        )}
        <button
          disabled={!leftConnected}
          onClick={() => setPhase('qualifying')}
          className="self-center px-16 py-4 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-h)] disabled:bg-stone-800 disabled:text-stone-600 text-[var(--accent-fg)] text-xl font-bold tracking-widest uppercase transition-colors"
        >
          Begin Qualifying →
        </button>
      </div>
    </div>
  )
}
