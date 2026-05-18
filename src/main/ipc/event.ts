import { ipcMain } from 'electron'
import type { AppStore } from '../store'
import { IPC } from '../../shared/ipc-channels'
import type { EventData } from '../../shared/types'

export function registerEventHandlers(store: AppStore): void {
  ipcMain.handle(IPC.EVENT_LOAD, () => {
    return store.getEvent()
  })

  ipcMain.handle(IPC.EVENT_SAVE, (_event, eventData: EventData) => {
    store.saveEvent(eventData)
  })

  ipcMain.handle(IPC.EVENT_CLEAR, () => {
    store.clearEvent()
  })
}
