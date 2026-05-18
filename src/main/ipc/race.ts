import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type { BluetoothManager } from '../bluetooth/manager'
import { IPC } from '../../shared/ipc-channels'
import type { Lane } from '../../shared/types'

export function registerRaceHandlers(
  manager: BluetoothManager,
  _getWindow: () => BrowserWindow | null
): void {
  ipcMain.handle(
    IPC.RACE_START,
    (_event, payload: { raceId: string; distanceMetres: number; lanes: Lane[] }) => {
      manager.startRaceMonitoring(payload.raceId, payload.distanceMetres, payload.lanes)
    }
  )

  ipcMain.handle(IPC.RACE_STOP, () => {
    manager.stopRaceMonitoring()
  })
}
