import { ipcMain } from 'electron'
import type { BluetoothManager } from '../bluetooth/manager'
import { IPC } from '../../shared/ipc-channels'

export function registerDevHandlers(manager: BluetoothManager): void {
  ipcMain.handle(IPC.DEMO_SET_STOPPED, (_event, { id, stopped }: { id: string; stopped: boolean }) => {
    manager.setDemoStopped(id, stopped)
  })
}
