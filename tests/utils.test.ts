import { describe, expect, it } from 'vitest'
import { calculateGrandTotal, calculateTVA, formatReference, getDayBounds, roundMoney } from '@shared/utils'
import { saleSchema } from '@shared/validation/schemas'
import { canAddLineToCart, canAddSelectedProductToCart, getDefaultItemTvaRate } from '../src/modules/POS/utils/posCalculations'

describe('shared utils', () => {
  it('formatReference pads counter', () => {
    expect(formatReference('PRD', 1)).toBe('PRD-000001')
    expect(formatReference('FAC', 42, 2026)).toBe('FAC-2026-000042')
  })

  it('roundMoney rounds to 3 decimals', () => {
    expect(roundMoney(1.2345)).toBe(1.235)
    expect(roundMoney(10)).toBe(10)
  })

  it('calculateTVA computes tax', () => {
    expect(calculateTVA(100, 19)).toBe(19)
  })

  it('getDayBounds returns start and end of day', () => {
    const date = new Date('2026-06-15T14:30:00')
    const { start, end } = getDayBounds(date)
    expect(start.getHours()).toBe(0)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
  })

  it('defaults sale paymentMethod to cash when omitted', () => {
    const parsed = saleSchema.safeParse({
      lines: [{ productId: 'prod-1', quantity: 1 }],
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.paymentMethod).toBe('cash')
    }
  })

  it('allows adding a product with no stock to the invoice', () => {
    expect(canAddLineToCart(0, 1, 0)).toBe(true)
    expect(canAddLineToCart(0, 3, 1)).toBe(false)
    expect(canAddLineToCart(2, 3, 1)).toBe(false)
  })

  it('uses the default VAT rate for free products', () => {
    expect(getDefaultItemTvaRate()).toBe(19)
  })

  it('ignores FODEC when calculating the grand total', () => {
    const total = calculateGrandTotal({ totalHT: 100, totalTVA: 19, totalFodec: 1, timbreFiscal: 1 })
    expect(total).toBe(120)
  })

  it('only allows adding a selected product when it is in stock', () => {
    expect(canAddSelectedProductToCart(5, 3)).toBe(true)
    expect(canAddSelectedProductToCart(2, 3)).toBe(false)
    expect(canAddSelectedProductToCart(0, 1)).toBe(false)
  })
})
