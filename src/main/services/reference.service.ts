import { Counter, Category } from '../db/models'
import { REFERENCE_PREFIXES } from '@shared/constants'
import { formatReference } from '@shared/utils'

export async function getNextReference(key: string, withYear = false): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  )
  const prefix = REFERENCE_PREFIXES[key as keyof typeof REFERENCE_PREFIXES] ?? key
  const year = withYear ? new Date().getFullYear() : undefined
  return formatReference(prefix, counter!.value, year)
}

/**
 * Generate the next product reference for a given category.
 * Uses the category's own prefix and counter stored in the Category document.
 * The counter is atomically incremented to prevent duplicates.
 * Format: {PREFIX}{6-digit padded counter} e.g. PL000001, EL000042
 */
export async function getNextProductReference(categoryId: string): Promise<string> {
  const category = await Category.findOneAndUpdate(
    { _id: categoryId },
    { $inc: { counter: 1 } },
    { upsert: true, new: true }
  )

  if (!category) {
    throw new Error(`Catégorie introuvable : ${categoryId}`)
  }

  const padded = String(category.counter).padStart(6, '0')
  return `${category.prefix}${padded}`
}