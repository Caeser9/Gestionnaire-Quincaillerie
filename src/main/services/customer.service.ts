import { Customer } from '../db/models'
import { getNextReference } from './reference.service'

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Find an existing customer by name (case-insensitive) or create a new one.
 */
export async function findOrCreateCustomerByName(
  name: string,
  details: { phone?: string; address?: string; matricule?: string } = {}
) {
  const trimmed = name.trim()
  if (!trimmed) return null

  const existing = await Customer.findOne({
    isDeleted: false,
    name: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') }
  })
  if (existing) {
    let changed = false
    ;(['phone', 'address', 'matricule'] as const).forEach((key) => {
      const value = details[key]?.trim()
      if (value && existing[key] !== value) {
        existing[key] = value
        changed = true
      }
    })
    if (changed) await existing.save()
    return { customer: existing, created: false as const }
  }

  const reference = await getNextReference('customer')
  const customer = await Customer.create({
    name: trimmed,
    reference,
    phone: details.phone?.trim() || undefined,
    address: details.address?.trim() || undefined,
    matricule: details.matricule?.trim() || undefined
  })
  return { customer, created: true as const }
}
