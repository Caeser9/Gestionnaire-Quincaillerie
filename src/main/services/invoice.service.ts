import { Invoice, PurchaseSlip, Sale } from '../db/models'
import { TIMBRE_FISCAL_AMOUNT } from '@shared/constants'
import { roundMoney } from '@shared/utils'
import { getNextReference } from './reference.service'
import type { Document } from 'mongoose'

type SlipDoc = Document & {
  _id: unknown
  saleId: unknown
  customerId?: unknown
  customerName?: string
  lines: unknown[]
  totalHT: number
  totalTVA: number
  totalFodec?: number
  totalTTC: number
  amountPaid: number
  amountDue: number
  includeTva?: boolean
  convertedInvoiceId?: unknown
  isSettled: boolean
  save(): Promise<unknown>
}

export async function convertPurchaseSlipToInvoice(
  slip: SlipDoc
): Promise<InstanceType<typeof Invoice>> {
  if (slip.convertedInvoiceId) {
    const existing = await Invoice.findById(slip.convertedInvoiceId)
    if (existing) return existing
  }

  const sale = await Sale.findById(slip.saleId)
  if (!sale) {
    throw new Error('Vente introuvable pour ce bon d\'achat')
  }

  const timbre = TIMBRE_FISCAL_AMOUNT
  const totalTTC = roundMoney(slip.totalTTC + timbre)

  const invoiceRef = await getNextReference('invoice', true)
  const invoice = await Invoice.create({
    reference: invoiceRef,
    saleId: slip.saleId,
    customerId: slip.customerId,
    customerName: slip.customerName,
    lines: slip.lines,
    totalHT: slip.totalHT,
    totalTVA: slip.totalTVA,
    totalFodec: slip.totalFodec ?? 0,
    timbreFiscal: timbre,
    totalTTC,
    amountPaid: totalTTC,
    amountDue: 0,
    isPaid: true,
    includeTva: slip.includeTva ?? false
  })

  slip.amountPaid = slip.totalTTC
  slip.amountDue = 0
  slip.isSettled = true
  slip.convertedInvoiceId = invoice._id
  await slip.save()

  sale.invoiceId = invoice._id
  await sale.save()

  return invoice
}

/** Montant max payable pour solder le bon et obtenir la facture. */
export function getSlipMaxPayment(slip: {
  totalTTC: number
  amountPaid: number
  amountDue: number
  convertedInvoiceId?: unknown
}): number {
  if (slip.convertedInvoiceId) return 0
  const productDue = roundMoney(Math.max(0, slip.totalTTC - slip.amountPaid))
  if (productDue > 0) {
    return roundMoney(productDue + TIMBRE_FISCAL_AMOUNT)
  }
  return roundMoney(slip.amountDue)
}

export function isSlipAwaitingTimbre(slip: {
  totalTTC: number
  amountPaid: number
  amountDue: number
  convertedInvoiceId?: unknown
}): boolean {
  if (slip.convertedInvoiceId) return false
  return slip.amountPaid >= slip.totalTTC && slip.amountDue > 0
}

export async function applyPaymentToPurchaseSlip(
  slip: SlipDoc,
  amount: number
): Promise<InstanceType<typeof Invoice> | null> {
  if (slip.convertedInvoiceId) {
    throw new Error('Ce bon a déjà été converti en facture')
  }

  let remaining = roundMoney(amount)

  const productDue = roundMoney(Math.max(0, slip.totalTTC - slip.amountPaid))
  if (productDue > 0 && remaining > 0) {
    const applied = roundMoney(Math.min(remaining, productDue))
    slip.amountPaid = roundMoney(slip.amountPaid + applied)
    remaining = roundMoney(remaining - applied)
    slip.amountDue = roundMoney(Math.max(0, slip.totalTTC - slip.amountPaid))
  }

  if (slip.amountPaid >= slip.totalTTC && !slip.convertedInvoiceId) {
    if (slip.amountDue <= 0) {
      slip.amountDue = TIMBRE_FISCAL_AMOUNT
      slip.isSettled = false
    }

    if (remaining > 0) {
      const timbrePay = roundMoney(Math.min(remaining, slip.amountDue))
      slip.amountDue = roundMoney(slip.amountDue - timbrePay)
      remaining = roundMoney(remaining - timbrePay)
    }

    if (slip.amountDue <= 0) {
      return convertPurchaseSlipToInvoice(slip)
    }

    await slip.save()
    return null
  }

  slip.isSettled = slip.amountDue <= 0
  await slip.save()
  return null
}
