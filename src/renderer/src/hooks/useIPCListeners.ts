import { useEffect } from 'react'
import { useBluetoothStore } from '../store/bluetooth.store'
import { useRaceStore } from '../store/race.store'

export function useIPCListeners(): void {
  const addScannedDevice = useBluetoothStore((s) => s.addScannedDevice)
  const setDeviceConnected = useBluetoothStore((s) => s.setDeviceConnected)
  const setDeviceDisconnected = useBluetoothStore((s) => s.setDeviceDisconnected)
  const setDeviceError = useBluetoothStore((s) => s.setDeviceError)
  const applyTelemetry = useRaceStore((s) => s.applyTelemetry)

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

      window.electronAPI.onDeviceError(({ lane }) => {
        if (lane) setDeviceError(lane, '')
      }),

      window.electronAPI.onTelemetry((frame) => {
        applyTelemetry(frame)
      }),

      // onRaceFinished is NOT handled here — each race screen registers its own
      // handler so it can supply the correct riderId and trigger screen-specific
      // logic (fanfare, resultsRef). A global handler would fire first with an
      // empty riderId from the main process and cause a double state update.
    ]

    return () => unsubs.forEach((fn) => fn())
  }, [addScannedDevice, setDeviceConnected, setDeviceDisconnected, setDeviceError, applyTelemetry])
}
