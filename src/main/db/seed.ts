import mongoose from 'mongoose'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { User, Settings, Counter, Category } from './models'

const SYSTEM_USER_ID = new mongoose.Types.ObjectId('000000000000000000000001')

const DEFAULT_CATEGORIES = [
  { name: 'Plomberie', prefix: 'PL', description: 'Tuyauterie, robinetterie et accessoires sanitaires' },
  { name: 'Électricité', prefix: 'EL', description: 'Câbles, interrupteurs, disjoncteurs et éclairage' },
  { name: 'Peinture', prefix: 'PA', description: 'Peintures, pinceaux, rouleaux et solvants' },
  { name: 'Bricolage', prefix: 'BR', description: 'Outillage, quincaillerie générale et fixation' }
]

export async function seedDatabase(): Promise<void> {
  await User.findOneAndUpdate(
    { _id: SYSTEM_USER_ID },
    {
      username: 'system',
      password: 'n/a',
      role: 'admin',
      isActive: true
    },
    { upsert: true }
  )

  const settingsCount = await Settings.countDocuments()
  if (settingsCount === 0) {
    await Settings.create(DEFAULT_SETTINGS)
    console.log('[DB] Default settings created')
  }

  // Seed default categories with their prefixes and independent counters
  for (const cat of DEFAULT_CATEGORIES) {
    await Category.findOneAndUpdate(
      { prefix: cat.prefix },
      {
        $setOnInsert: {
          name: cat.name,
          description: cat.description,
          counter: 0
        }
      },
      { upsert: true }
    )
  }
  console.log('[DB] Default categories seeded')

  const counterKeys = [
    'customer',
    'supplier',
    'purchase',
    'invoice',
    'purchaseSlip',
    'purchaseOrder',
    'inventory',
    'purchaseReceipt'
  ]

  for (const key of counterKeys) {
    await Counter.findOneAndUpdate({ key }, { $setOnInsert: { value: 0 } }, { upsert: true })
  }
}