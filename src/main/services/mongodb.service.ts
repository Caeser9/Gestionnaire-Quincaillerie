import { spawn, exec } from 'child_process'
import path from 'path'
import { app } from 'electron'
import fs from 'fs/promises'

// Chemin d'installation de MongoDB (après installation via NSIS)
const MONGODB_DIR = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'GestionnaireQuincaillerie', 'mongodb')
const DATA_DIR = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'GestionnaireQuincaillerie', 'data')
const LOG_DIR = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'GestionnaireQuincaillerie', 'logs')

let mongodProcess: any = null

export async function ensureDirectories(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.mkdir(LOG_DIR, { recursive: true })
}

export async function isMongoDBRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq mongod.exe"', (error, stdout) => {
      if (stdout.includes('mongod.exe')) {
        resolve(true)
      } else {
        resolve(false)
      }
    })
  })
}

export async function startMongoDB(): Promise<boolean> {
  try {
    await ensureDirectories()
    
    const alreadyRunning = await isMongoDBRunning()
    if (alreadyRunning) {
      console.log('[MongoDB] Already running')
      return true
    }

    const mongodPath = path.join(MONGODB_DIR, 'bin', 'mongod.exe')
    const logPath = path.join(LOG_DIR, 'mongodb.log')

    // Vérifier que mongod.exe existe
    try {
      await fs.access(mongodPath)
    } catch {
      console.error('[MongoDB] mongod.exe not found at:', mongodPath)
      return false
    }

    mongodProcess = spawn(mongodPath, [
      '--dbpath', DATA_DIR,
      '--logpath', logPath,
      '--bind_ip', '127.0.0.1',
      '--port', '27017'
    ])

    mongodProcess.on('error', (err: Error) => {
      console.error('[MongoDB] Failed to start:', err)
    })

    mongodProcess.on('exit', (code: number) => {
      console.log('[MongoDB] Exited with code:', code)
    })

    // Attendre un peu pour vérifier que MongoDB a démarré
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    const isRunning = await isMongoDBRunning()
    if (isRunning) {
      console.log('[MongoDB] Started successfully')
      return true
    } else {
      console.error('[MongoDB] Failed to start')
      return false
    }
  } catch (error) {
    console.error('[MongoDB] Error starting MongoDB:', error)
    return false
  }
}

export async function stopMongoDB(): Promise<void> {
  if (mongodProcess) {
    mongodProcess.kill()
    mongodProcess = null
  }
  
  return new Promise((resolve) => {
    exec('taskkill /F /IM mongod.exe', () => {
      console.log('[MongoDB] Stopped')
      resolve()
    })
  })
}

export function getMongoDBUri(): string {
  return 'mongodb://127.0.0.1:27017/gestionnaire_quincaillerie'
}
