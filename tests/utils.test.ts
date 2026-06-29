import { describe, expect, it } from 'vitest'
import { calculateTVA, formatReference, getDayBounds, roundMoney } from '@shared/utils'

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
})
