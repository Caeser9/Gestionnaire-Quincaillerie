import mongoose from 'mongoose'
import { DEFAULT_MONGO_URI } from '@shared/constants'

let isConnected = false

export async function connectDatabase(uri: string = DEFAULT_MONGO_URI): Promise<void> {
  if (isConnected) return
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000
  })
  isConnected = true
  console.log('[DB] Connected to MongoDB')
}
