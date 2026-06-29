import { REFERENCE_PAD } from '../constants'

export function formatReference(prefix: string, counter: number, year?: number): string {
  const padded = String(counter).padStart(REFERENCE_PAD, '0')
  if (year !== undefined) {
    return `${prefix}-${year}-${padded}`
  }
  return `${prefix}-${padded}`
}

export function roundMoney(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function calculateTVA(ht: number, tvaRate: number): number {
  return roundMoney(ht * (tvaRate / 100))
}

export function calculateFodec(htBase: number, ratePercent = 1): number {
  if (htBase <= 0) return 0
  return roundMoney(htBase * (ratePercent / 100))
}

export interface SaleTotalsInput {
  totalHT: number
  totalTVA: number
  totalFodec: number
  timbreFiscal: number
}

export function calculateGrandTotal(totals: SaleTotalsInput): number {
  return roundMoney(
    totals.totalHT + totals.totalFodec + totals.totalTVA + totals.timbreFiscal
  )
}

/**
 * Calculate sale price from purchase price and profit margin percentage.
 * profitMargin is the margin percentage on the sale price:
 *   salePrice = purchasePrice / (1 - profitMargin/100)
 * Example: purchasePrice=100, profitMargin=25 => salePrice = 100/0.75 = 133.333
 */
export function calculateSalePrice(purchasePrice: number, profitMargin: number): number {
  if (profitMargin >= 100) return roundMoney(purchasePrice * (profitMargin / 100 + 1))
  return roundMoney(purchasePrice / (1 - profitMargin / 100))
}

/**
 * Calculate profit margin percentage from purchase price and sale price.
 */
export function calculateProfitMargin(purchasePrice: number, salePrice: number): number {
  if (salePrice <= 0) return 0
  return roundMoney(((salePrice - purchasePrice) / salePrice) * 100)
}

/**
 * Calculate total after discount percentage.
 */
export function applyDiscount(amount: number, discountPercent: number): number {
  return roundMoney(amount * (1 - discountPercent / 100))
}

export type PurchasePaymentStatus = 'none' | 'paid' | 'unpaid' | 'partial'

export function getReceivedHT(
  lines: { receivedQuantity?: number; unitPrice: number }[]
): number {
  return roundMoney(
    lines.reduce((s, l) => s + (l.receivedQuantity ?? 0) * l.unitPrice, 0)
  )
}

export function computePurchasePayment(
  lines: { receivedQuantity?: number; unitPrice: number }[],
  amountPaid: number
): { paymentStatus: PurchasePaymentStatus; amountDue: number; receivedHT: number } {
  const receivedHT = getReceivedHT(lines)
  const paid = roundMoney(amountPaid || 0)
  if (receivedHT <= 0) {
    return { paymentStatus: 'none', amountDue: 0, receivedHT: 0 }
  }
  const amountDue = roundMoney(Math.max(0, receivedHT - paid))
  let paymentStatus: PurchasePaymentStatus
  if (amountDue <= 0) paymentStatus = 'paid'
  else if (paid <= 0) paymentStatus = 'unpaid'
  else paymentStatus = 'partial'
  return { paymentStatus, amountDue, receivedHT }
}

export function resolveSalePayment(
  totalTTC: number,
  paymentMethod: 'cash' | 'card' | 'mixed' | 'credit',
  options?: { amountPaid?: number; cashReceived?: number; cardAmount?: number }
): { amountPaid: number; amountDue: number; change?: number } {
  let paid: number

  if (options?.amountPaid !== undefined) {
    paid = roundMoney(Math.min(Math.max(0, options.amountPaid), totalTTC))
  } else if (paymentMethod === 'credit') {
    paid = 0
  } else if (paymentMethod === 'card') {
    paid = totalTTC
  } else if (paymentMethod === 'mixed') {
    paid = roundMoney(Math.min((options?.cashReceived ?? 0) + (options?.cardAmount ?? 0), totalTTC))
  } else {
    const received = options?.cashReceived ?? totalTTC
    paid = roundMoney(Math.min(received, totalTTC))
    const change = received > totalTTC ? roundMoney(received - totalTTC) : undefined
    return { amountPaid: paid, amountDue: roundMoney(totalTTC - paid), change }
  }

  return {
    amountPaid: paid,
    amountDue: roundMoney(totalTTC - paid)
  }
}

export function getDayBounds(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}
