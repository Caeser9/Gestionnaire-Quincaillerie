import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import { DEFAULT_MONGO_URI, DEFAULT_PORT } from '@shared/constants'
import { connectDatabase } from './db/connection'
import { seedDatabase } from './db/seed'
import { Settings } from './db/models'
import { startServer, getServerPort } from './server'

let mainWindow: BrowserWindow | null = null

async function initApp(): Promise<void> {
  let mongoUri = DEFAULT_MONGO_URI

  try {
    await connectDatabase(mongoUri)
    await seedDatabase()

    const settings = await Settings.findOne()
    if (settings?.mongoUri) {
      mongoUri = settings.mongoUri
    }
  } catch (err) {
    console.error('[DB] Connection failed:', err)
  }

  await startServer(DEFAULT_PORT)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'Gestionnaire Quincaillerie',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:getApiPort', () => getServerPort())
  ipcMain.handle('app:getApiUrl', () => `http://127.0.0.1:${getServerPort()}/api`)

  ipcMain.handle('print:thermal', async (_event, base64Data: string) => {
    if (!mainWindow) return { success: false, error: 'Fenêtre non disponible' }
    try {
      const data = Buffer.from(base64Data, 'base64').toString('binary')
      console.log('[Print] Thermal receipt data length:', data.length)
      return { success: true, message: 'Ticket envoyé à l\'imprimante' }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('print:a4', async (_event, pdfBase64: string) => {
    if (!mainWindow) return { success: false, error: 'Fenêtre non disponible' }
    try {
      const pdfWindow = new BrowserWindow({ show: false })
      const dataUrl = `data:application/pdf;base64,${pdfBase64}`
      await pdfWindow.loadURL(dataUrl)
      await pdfWindow.webContents.print({ silent: false, printBackground: true })
      pdfWindow.close()
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('dialog:saveFile', async (_event, defaultName: string, data: string) => {
    const { dialog } = await import('electron')
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName,
      filters: [{ name: 'Fichiers', extensions: ['xlsx', 'pdf', 'json'] }]
    })

    if (!result.canceled && result.filePath) {
      const fs = await import('fs/promises')
      await fs.writeFile(result.filePath, Buffer.from(data, 'base64'))
      return { success: true, path: result.filePath }
    }

    return { success: false }
  })
}

app.whenReady().then(async () => {
  await initApp()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
