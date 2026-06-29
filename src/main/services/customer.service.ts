import { Customer } from '../db/models'
import { getNextReference } from './reference.service'

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Find an existing customer by name (case-insensitive) or create a new one.
 */
export async function findOrCreateCustomerByName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return null

  const existing = await Customer.findOne({
    isDeleted: false,
    name: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') }
  })
  if (existing) return { customer: existing, created: false as const }

  const reference = await getNextReference('customer')
  const customer = await Customer.create({ name: trimmed, reference })
  return { customer, created: true as const }
}
