import { ipcMain, dialog } from 'electron'
import { writeFile } from 'fs/promises'
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

  ipcMain.handle(IPC.EVENT_EXPORT_CSV, async (_event, { csv, filename }: { csv: string; filename: string }) => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: filename,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return { saved: false }
    await writeFile(filePath, csv, 'utf-8')
    return { saved: true }
  })
}
