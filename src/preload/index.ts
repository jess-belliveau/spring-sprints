import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { Lane, EventData, BLEDeviceInfo, TelemetryFrame, LaneResult } from '../shared/types'

type UnsubscribeFn = () => void

const electronAPI = {
  // ── Bluetooth ────────────────────────────────────────────────────────────
  scanStart: () => ipcRenderer.invoke(IPC.BLUETOOTH_SCAN_START),
  scanStop: () => ipcRenderer.invoke(IPC.BLUETOOTH_SCAN_STOP),
  connectDevice: (deviceId: string, lane: Lane) =>
    ipcRenderer.invoke(IPC.BLUETOOTH_CONNECT, { deviceId, lane }) as Promise<{
      success: boolean
      error?: string
    }>,
  disconnectDevice: (lane: Lane) => ipcRenderer.invoke(IPC.BLUETOOTH_DISCONNECT, { lane }),

  // ── Race ─────────────────────────────────────────────────────────────────
  startRace: (raceId: string, distanceMetres: number, lanes: Lane[]) =>
    ipcRenderer.invoke(IPC.RACE_START, { raceId, distanceMetres, lanes }),
  stopRace: () => ipcRenderer.invoke(IPC.RACE_STOP),

  // ── Event ─────────────────────────────────────────────────────────────────
  loadEvent: () => ipcRenderer.invoke(IPC.EVENT_LOAD) as Promise<EventData | null>,
  saveEvent: (event: EventData) => ipcRenderer.invoke(IPC.EVENT_SAVE, event),
  clearEvent: () => ipcRenderer.invoke(IPC.EVENT_CLEAR),

  // ── Push listeners ────────────────────────────────────────────────────────
  onDeviceFound: (cb: (device: BLEDeviceInfo) => void): UnsubscribeFn => {
    const handler = (_: unknown, d: BLEDeviceInfo) => cb(d)
    ipcRenderer.on(IPC.BLUETOOTH_DEVICE_FOUND, handler)
    return () => ipcRenderer.removeListener(IPC.BLUETOOTH_DEVICE_FOUND, handler)
  },

  onDeviceConnected: (
    cb: (payload: { lane: Lane; device: BLEDeviceInfo }) => void
  ): UnsubscribeFn => {
    const handler = (_: unknown, p: { lane: Lane; device: BLEDeviceInfo }) => cb(p)
    ipcRenderer.on(IPC.BLUETOOTH_DEVICE_CONNECTED, handler)
    return () => ipcRenderer.removeListener(IPC.BLUETOOTH_DEVICE_CONNECTED, handler)
  },

  onDeviceDisconnected: (cb: (payload: { lane: Lane }) => void): UnsubscribeFn => {
    const handler = (_: unknown, p: { lane: Lane }) => cb(p)
    ipcRenderer.on(IPC.BLUETOOTH_DEVICE_DISCONNECTED, handler)
    return () => ipcRenderer.removeListener(IPC.BLUETOOTH_DEVICE_DISCONNECTED, handler)
  },

  onDeviceError: (cb: (payload: { lane: Lane | null; message: string }) => void): UnsubscribeFn => {
    const handler = (_: unknown, p: { lane: Lane | null; message: string }) => cb(p)
    ipcRenderer.on(IPC.BLUETOOTH_DEVICE_ERROR, handler)
    return () => ipcRenderer.removeListener(IPC.BLUETOOTH_DEVICE_ERROR, handler)
  },

  onTelemetry: (cb: (frame: TelemetryFrame) => void): UnsubscribeFn => {
    const handler = (_: unknown, f: TelemetryFrame) => cb(f)
    ipcRenderer.on(IPC.RACE_TELEMETRY, handler)
    return () => ipcRenderer.removeListener(IPC.RACE_TELEMETRY, handler)
  },

  onRaceFinished: (cb: (payload: { lane: Lane; result: LaneResult }) => void): UnsubscribeFn => {
    const handler = (_: unknown, p: { lane: Lane; result: LaneResult }) => cb(p)
    ipcRenderer.on(IPC.RACE_FINISHED, handler)
    return () => ipcRenderer.removeListener(IPC.RACE_FINISHED, handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electronAPI = electronAPI
}

export type ElectronAPI = typeof electronAPI
