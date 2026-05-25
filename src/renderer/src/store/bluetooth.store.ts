import { create } from 'zustand'
import type { BLEDeviceInfo, ConnectedDevice, Lane } from '@shared/types'

interface BluetoothState {
  scannedDevices: BLEDeviceInfo[]
  connectedDevices: Partial<Record<Lane, ConnectedDevice>>
  deviceLabels: Partial<Record<Lane, string>>
  isScanning: boolean

  setScanning: (v: boolean) => void
  addScannedDevice: (device: BLEDeviceInfo) => void
  clearScannedDevices: () => void
  setDeviceConnecting: (lane: Lane, device: BLEDeviceInfo) => void
  setDeviceConnected: (lane: Lane, device: BLEDeviceInfo) => void
  setDeviceDisconnected: (lane: Lane) => void
  setDeviceError: (lane: Lane, message: string) => void
  setDeviceLabel: (lane: Lane, label: string) => void
}

export const useBluetoothStore = create<BluetoothState>((set) => ({
  scannedDevices: [],
  connectedDevices: {},
  deviceLabels: {},
  isScanning: false,

  setScanning: (v) => set({ isScanning: v }),

  addScannedDevice: (device) =>
    set((s) => {
      const exists = s.scannedDevices.some((d) => d.id === device.id)
      if (exists) return s
      return { scannedDevices: [...s.scannedDevices, device] }
    }),

  clearScannedDevices: () => set({ scannedDevices: [] }),

  setDeviceConnecting: (lane, device) =>
    set((s) => ({
      connectedDevices: {
        ...s.connectedDevices,
        [lane]: { lane, device, status: 'connecting' }
      }
    })),

  setDeviceConnected: (lane, device) =>
    set((s) => ({
      connectedDevices: {
        ...s.connectedDevices,
        [lane]: { lane, device, status: 'connected' }
      }
    })),

  setDeviceDisconnected: (lane) =>
    set((s) => {
      const next = { ...s.connectedDevices }
      delete next[lane]
      const nextLabels = { ...s.deviceLabels }
      delete nextLabels[lane]
      return { connectedDevices: next, deviceLabels: nextLabels }
    }),

  setDeviceLabel: (lane, label) =>
    set((s) => ({ deviceLabels: { ...s.deviceLabels, [lane]: label } })),

  setDeviceError: (lane, _message) =>
    set((s) => {
      const existing = s.connectedDevices[lane]
      if (!existing) return s
      return {
        connectedDevices: {
          ...s.connectedDevices,
          [lane]: { ...existing, status: 'error' as const }
        }
      }
    })
}))
