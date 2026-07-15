import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import { DEFAULT_MONGO_URI, DEFAULT_PORT } from '@shared/constants'
import { connectDatabase } from './db/connection'
import { seedDatabase } from './db/seed'
import { Settings } from './db/models'
import { startServer, getServerPort } from './server'
import { startDemoServer } from './server/demo'
import { isDemoMode } from './demoMode'
import { startMongoDB, stopMongoDB, getMongoDBUri } from './services/mongodb.service'
import {
  activateLicense,
  getAuthorizedModules,
  getLicenseStatus,
  getMachineId,
  transferLicense,
  clearLocalLicense,
  getPendingActivation,
  retryPendingActivation
} from './services/license.service'

let mainWindow: BrowserWindow | null = null

// Allow overriding userData path via env for debugging (useful when profile is corrupt)
const _udOverride = process.env.ELECTRON_USER_DATA || process.env.ELECTRON_USERDATA
if (_udOverride) {
  try {
    app.setPath('userData', _udOverride)
    console.log('[APP] userData overridden to:', app.getPath('userData'))
  } catch (err) {
    console.error('[APP] Failed to set userData override:', err)
  }
}
async function initApp(): Promise<void> {
  if (isDemoMode()) {
    console.log('[DEMO] Starting JSON demo mode')
    await startDemoServer(DEFAULT_PORT)
    return
  }

  // Démarrer MongoDB automatiquement
  const mongoStarted = await startMongoDB()
  if (!mongoStarted) {
    console.error('[APP] Failed to start MongoDB')
    return
  }

  let mongoUri = getMongoDBUri()

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

async function getAppTitle(): Promise<string> {
  if (isDemoMode()) {
    return 'Gestionnaire Quincaillerie (Demo)'
  }
  
  try {
    const settings = await Settings.findOne().exec()
    if (settings?.storeName) {
      return settings.storeName
    }
    if (settings?.companyName) {
      return settings.companyName
    }
  } catch (err) {
    console.error('[APP] Failed to load settings for title:', err)
  }
  
  return 'Gestionnaire Quincaillerie'
}

async function createWindow(): Promise<void> {
  const title = await getAppTitle()
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title,
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
      const pdfWindow = new BrowserWindow({ 
        show: true,
        width: 800,
        height: 600,
        title: 'Aperçu avant impression',
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })
      
      const dataUrl = `data:application/pdf;base64,${pdfBase64}`
      await pdfWindow.loadURL(dataUrl)
      
      pdfWindow.webContents.on('did-finish-load', () => {
        setTimeout(() => {
          pdfWindow.webContents.print({ silent: false, printBackground: true })
        }, 500)
      })
      
      pdfWindow.on('closed', () => {
        pdfWindow.destroy()
      })
      
      return { success: true }
    } catch (err) {
      console.error('[Print] A4 print error:', err)
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

  ipcMain.handle('license:getStatus', () => getLicenseStatus())
  ipcMain.handle('license:getMachineId', () => getMachineId())
  ipcMain.handle('license:getModules', () => getAuthorizedModules())
  ipcMain.handle('license:activate', (_e, params) => activateLicense(params))
  ipcMain.handle('license:verify', () => getLicenseStatus(true))
  ipcMain.handle('license:transfer', (_e, newMachineId?: string) => transferLicense(newMachineId))
  ipcMain.handle('license:clear', () => {
    clearLocalLicense()
    return { success: true }
  })
  ipcMain.handle('license:getPending', () => getPendingActivation())
  ipcMain.handle('license:retryPending', () => retryPendingActivation())
}

app.whenReady().then(async () => {
  console.log('[APP] userData path:', app.getPath('userData'))
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

