import { Product, PurchaseSlip } from '../db/models'
import { buildDocumentTotals } from '@shared/utils'
import { getNextReference } from './reference.service'

export type DeliveryNoteLine = {
  productId?: string
  reference?: string
  designation: string
  quantity: number
  unitPrice: number
  discount?: number
  tva?: number
  totalHT: number
  totalTVA?: number
  totalTTC: number
}

export type CreateDeliveryNoteInput = {
  saleId?: unknown
  invoiceId?: unknown
  sourceInvoiceId?: unknown
  customerId?: unknown
  customerName?: string
  customerAddress?: string
  lines: DeliveryNoteLine[]
  includeTva?: boolean
  linkToInvoice?: boolean
  blNumber?: string
  bcNumber?: string
  pieceNumber?: string
  representative?: string
  deliveryPerson?: string
  deliveryDriverName?: string
  deliveryDriverCin?: string
  deliveryVehiclePlate?: string
  validUntil?: Date
  amountPaid?: number
  amountDue?: number
  isSettled?: boolean
}

async function resolveLineProductIds(lines: DeliveryNoteLine[]): Promise<DeliveryNoteLine[]> {
  return Promise.all(
    lines.map(async (line) => {
      if (line.productId) return line
      if (!line.reference?.trim()) return line
      const product = await Product.findOne({ reference: line.reference.trim(), isDeleted: false })
      if (!product) return line
      return { ...line, productId: product._id.toString() }
    })
  )
}

function mapLineForStorage(line: DeliveryNoteLine) {
  const stored: Record<string, unknown> = {
    reference: line.reference,
    designation: line.designation,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discount: line.discount ?? 0,
    tva: line.tva ?? 0,
    totalHT: line.totalHT,
    totalTVA: line.totalTVA ?? Math.max(0, (line.totalTTC || 0) - (line.totalHT || 0)),
    totalTTC: line.totalTTC
  }
  if (line.productId) {
    stored.productId = line.productId
  }
  return stored
}

export function mapInvoiceLinesToDeliveryLines(
  lines: Array<Record<string, unknown>>
): DeliveryNoteLine[] {
  return (lines || []).map((line) => {
    const rawProductId = line.productId
    const productId =
      typeof rawProductId === 'object' && rawProductId && '_id' in rawProductId
        ? String((rawProductId as { _id: string })._id)
        : rawProductId
          ? String(rawProductId)
          : undefined

    const quantity = Number(line.quantity) || 0
    const unitPrice = Number(line.unitPrice) || 0
    const totalHT = Number(line.totalHT) || quantity * unitPrice
    const totalTTC = Number(line.totalTTC) || totalHT

    return {
      productId,
      reference: String(line.reference || ''),
      designation: String(line.designation || ''),
      quantity,
      unitPrice,
      discount: Number(line.discount) || 0,
      tva: Number(line.tva) || 19,
      totalHT,
      totalTTC
    }
  })
}

export async function createDeliveryNote(input: CreateDeliveryNoteInput) {
  const resolvedLines = await resolveLineProductIds(input.lines)
  const totals = buildDocumentTotals(resolvedLines, { includeTva: input.includeTva, timbreFiscal: 0 })
  const reference = await getNextReference('deliveryNote', true)

  return PurchaseSlip.create({
    reference,
    documentType: 'delivery_note',
    saleId: input.saleId ?? null,
    sourceInvoiceId: input.sourceInvoiceId ?? undefined,
    convertedInvoiceId: input.linkToInvoice ? input.invoiceId : null,
    customerId: input.customerId || undefined,
    customerName: input.customerName?.trim() || 'Client comptant',
    customerAddress: input.customerAddress?.trim() || undefined,
    lines: resolvedLines.map(mapLineForStorage),
    totalHT: totals.totalHT,
    totalTVA: totals.totalTVA,
    timbreFiscal: 0,
    totalTTC: totals.totalTTC,
    amountPaid: input.amountPaid ?? 0,
    amountDue: input.amountDue ?? totals.totalTTC,
    isSettled: input.isSettled ?? Boolean(input.linkToInvoice),
    includeTva: input.includeTva ?? false,
    blNumber: input.blNumber?.trim() || reference,
    bcNumber: input.bcNumber,
    pieceNumber: input.pieceNumber,
    representative: input.representative,
    deliveryPerson: input.deliveryPerson ?? input.deliveryDriverName,
    deliveryDriverName: input.deliveryDriverName,
    deliveryDriverCin: input.deliveryDriverCin,
    deliveryVehiclePlate: input.deliveryVehiclePlate,
    vehicleRegistration: input.deliveryVehiclePlate,
    validUntil: input.validUntil
  })
}

export const deliveryNoteFilter = {
  $or: [
    { documentType: 'delivery_note' },
    {
      documentType: { $exists: false },
      $or: [{ saleId: null }, { convertedInvoiceId: { $ne: null }, amountDue: 0 }]
    }
  ]
} as const

export const purchaseSlipFilter = {
  $or: [
    { documentType: 'purchase_slip' },
    {
      documentType: { $exists: false },
      amountDue: { $gt: 0 },
      saleId: { $ne: null },
      convertedInvoiceId: null
    }
  ]
} as const
