import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { BluetoothManager } from './bluetooth/manager'
import { AppStore } from './store'

let mainWindow: BrowserWindow | null = null
let bluetoothManager: BluetoothManager | null = null
let appStore: AppStore | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
    if (is.dev) mainWindow!.webContents.openDevTools({ mode: 'detach' })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.sprintseries.app')

  appStore = await AppStore.create()
  bluetoothManager = new BluetoothManager(() => mainWindow, is.dev)

  createWindow()
  registerIpcHandlers(bluetoothManager, appStore, () => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Clean up BLE before windows close so disconnects are attempted gracefully.
app.on('before-quit', () => {
  bluetoothManager?.destroy()
})

// Noble holds a native CoreBluetooth handle that keeps the event loop alive
// indefinitely. app.exit() bypasses the lingering handle and exits immediately.
app.on('will-quit', () => {
  app.exit(0)
})
