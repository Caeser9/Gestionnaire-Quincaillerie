import { roundMoney, applyDiscount } from '@shared/utils'

export interface CartLine {
  lineId: string
  productId: string
  reference: string
  designation: string
  quantity: number
  unitPrice: number
  discount: number
  tva: number
  stock: number
  purchasePrice?: number
  isCustom?: boolean
}

export interface CalculatedLine extends CartLine {
  lineHT: number
  lineTVA: number
  lineTTC: number
}

export function calculateLineHT(price: number, quantity: number, discount: number): number {
  const total = price * quantity
  return roundMoney(applyDiscount(total, discount))
}

export function getDefaultItemTvaRate(): number {
  return 19
}

export function calculateLineTVA(lineHT: number, tvaRate: number): number {
  return roundMoney(lineHT * (tvaRate / 100))
}

export function calculateLineTTC(lineHT: number, lineTVA: number): number {
  return roundMoney(lineHT + lineTVA)
}

export function calculateLine(line: CartLine): CalculatedLine {
  const lineHT = calculateLineHT(line.unitPrice, line.quantity, line.discount)
  const lineTVA = calculateLineTVA(lineHT, line.tva)
  const lineTTC = calculateLineTTC(lineHT, lineTVA)
  return {
    ...line,
    lineHT,
    lineTVA,
    lineTTC,
  }
}

export function calculateAllLines(lines: CartLine[]): CalculatedLine[] {
  return lines.map((l) => calculateLine(l))
}

export function canAddLineToCart(currentQuantity: number, incomingQuantity: number, stock: number): boolean {
  if (stock <= 0) return true
  return currentQuantity + incomingQuantity <= stock
}

export function canAddSelectedProductToCart(stock: number, quantity: number): boolean {
  if (stock <= 0) return false
  return quantity > 0 && quantity <= stock
}

export interface POSSummary {
  totalLines: number
  totalQuantity: number
  grossTotalHT: number
  totalHT: number
  totalDiscount: number
  totalTVA: number
  totalTTC: number
}

export function mapCartToSaleLines(cart: CartLine[]) {
  return cart.map((line) => {
    const isCustom = line.isCustom === true || (line.productId?.startsWith('custom-') ?? false)
    if (isCustom) {
      const unitPrice = Number.isFinite(line.unitPrice) ? line.unitPrice : 0
      return {
        isCustom: true,
        reference: line.reference?.trim() || 'DIV',
        designation: line.designation?.trim() || 'Article divers',
        unitPrice,
        tva: line.tva ?? getDefaultItemTvaRate(),
        quantity: Math.max(1, line.quantity || 1),
        discount: line.discount ?? 0
      }
    }
    return {
      productId: line.productId,
      quantity: line.quantity,
      discount: line.discount
    }
  })
}

export function calculateSummary(calculated: CalculatedLine[]): POSSummary {
  const totalLines = calculated.length
  let totalQuantity = 0
  let grossTotalHT = 0
  let totalHT = 0
  let totalTVA = 0

  for (const line of calculated) {
    totalQuantity += line.quantity
    grossTotalHT += line.unitPrice * line.quantity
    totalHT += line.lineHT
    totalTVA += line.lineTVA
  }

  grossTotalHT = roundMoney(grossTotalHT)
  totalHT = roundMoney(totalHT)
  const totalDiscount = roundMoney(Math.max(0, grossTotalHT - totalHT))
  totalTVA = roundMoney(totalTVA)
  const totalTTC = roundMoney(totalHT + totalTVA)

  return {
    totalLines,
    totalQuantity,
    grossTotalHT,
    totalHT,
    totalDiscount,
    totalTVA,
    totalTTC,
  }
}
