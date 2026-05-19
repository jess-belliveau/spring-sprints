import type { BrowserWindow } from 'electron'
import type { BluetoothManager } from '../bluetooth/manager'
import type { AppStore } from '../store'
import { registerBluetoothHandlers } from './bluetooth'
import { registerRaceHandlers } from './race'
import { registerEventHandlers } from './event'
import { registerDevHandlers } from './dev'

export function registerIpcHandlers(
  manager: BluetoothManager,
  store: AppStore,
  getWindow: () => BrowserWindow | null,
  isDev = false
): void {
  registerBluetoothHandlers(manager)
  registerRaceHandlers(manager, getWindow)
  registerEventHandlers(store)
  if (isDev) registerDevHandlers(manager)
}
