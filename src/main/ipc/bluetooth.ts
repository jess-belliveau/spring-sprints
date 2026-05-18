import { ipcMain } from 'electron'
import type { BluetoothManager } from '../bluetooth/manager'
import { IPC } from '../../shared/ipc-channels'
import type { Lane } from '../../shared/types'

export function registerBluetoothHandlers(manager: BluetoothManager): void {
  ipcMain.handle(IPC.BLUETOOTH_SCAN_START, (_event, payload?: { ftmsOnly?: boolean }) => {
    manager.startScan(payload?.ftmsOnly ?? true)
  })

  ipcMain.handle(IPC.BLUETOOTH_SCAN_STOP, () => {
    manager.stopScan()
  })

  ipcMain.handle(
    IPC.BLUETOOTH_CONNECT,
    async (_event, payload: { deviceId: string; lane: Lane }) => {
      try {
        await manager.connectToLane(payload.deviceId, payload.lane)
        return { success: true }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  ipcMain.handle(IPC.BLUETOOTH_DISCONNECT, async (_event, payload: { lane: Lane }) => {
    await manager.disconnectLane(payload.lane)
  })
}
