import { useEffect } from 'react'
import { useBluetoothStore } from '../store/bluetooth.store'
import { useRaceStore } from '../store/race.store'

export function useIPCListeners(): void {
  const addScannedDevice = useBluetoothStore((s) => s.addScannedDevice)
  const setDeviceConnected = useBluetoothStore((s) => s.setDeviceConnected)
  const setDeviceDisconnected = useBluetoothStore((s) => s.setDeviceDisconnected)
  const applyTelemetry = useRaceStore((s) => s.applyTelemetry)
  const setLaneFinished = useRaceStore((s) => s.setLaneFinished)

  useEffect(() => {
    const unsubs = [
      window.electronAPI.onDeviceFound((device) => {
        addScannedDevice(device)
      }),

      window.electronAPI.onDeviceConnected(({ lane, device }) => {
        setDeviceConnected(lane, device)
      }),

      window.electronAPI.onDeviceDisconnected(({ lane }) => {
        setDeviceDisconnected(lane)
      }),

      window.electronAPI.onTelemetry((frame) => {
        applyTelemetry(frame)
      }),

      window.electronAPI.onRaceFinished(({ lane, result }) => {
        setLaneFinished(lane, result)
      })
    ]

    return () => unsubs.forEach((fn) => fn())
  }, [addScannedDevice, setDeviceConnected, setDeviceDisconnected, applyTelemetry, setLaneFinished])
}
