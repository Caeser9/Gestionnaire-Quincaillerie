import { Router } from 'express'
import { Customer, Invoice, PurchaseSlip, Settings } from '../../db/models'
import { attachActor } from '../middleware/context'
import { sendSuccess, sendError, asyncHandler } from '../middleware/response'
import { getNextReference } from '../../services/reference.service'
import { buildDocumentTotals, mergeDocumentLines, roundMoney } from '@shared/utils'
import { TIMBRE_FISCAL_AMOUNT } from '@shared/constants'
import { generateInvoicePdf } from '../../services/pdf.service'
import {
  createDeliveryNote,
  deliveryNoteFilter,
  mapInvoiceLinesToDeliveryLines,
  type DeliveryNoteLine
} from '../../services/delivery-note.service'

const router = Router()
router.use(attachActor)

async function enrichDeliveryNoteForPdf(doc: InstanceType<typeof PurchaseSlip>) {
  const data = doc.toObject()
  if (doc.customerId) {
    const customer = await Customer.findById(doc.customerId)
    if (customer) {
      data.customerCode = customer.reference
    }
  }
  data.deliveryDriverName = doc.deliveryDriverName || doc.deliveryPerson
  data.deliveryDriverCin = doc.deliveryDriverCin
  data.deliveryVehiclePlate = doc.deliveryVehiclePlate || doc.vehicleRegistration
  data.vehicleRegistration = doc.vehicleRegistration || doc.deliveryVehiclePlate
  return data
}

router.get('/delivery-notes', asyncHandler(async (_req, res) => {
  const docs = await PurchaseSlip.find(deliveryNoteFilter).sort({ createdAt: -1 }).limit(100)
  sendSuccess(res, { data: docs })
}))

router.get('/delivery-notes/:id', asyncHandler(async (req, res) => {
  const doc = await PurchaseSlip.findOne({ _id: req.params.id, ...deliveryNoteFilter })
  if (!doc) {
    sendError(res, 'Bon de livraison introuvable', 404)
    return
  }
  sendSuccess(res, doc)
}))

router.post('/delivery-notes/from-invoice/:invoiceId', asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.invoiceId)
  if (!invoice) {
    sendError(res, 'Facture introuvable', 404)
    return
  }

  const existing = await PurchaseSlip.findOne({
    documentType: 'delivery_note',
    $or: [{ sourceInvoiceId: invoice._id }, { convertedInvoiceId: invoice._id }]
  })
  if (existing) {
    sendSuccess(res, { slip: existing, created: false }, 200)
    return
  }

  const body = req.body as {
    deliveryDriverName?: string
    deliveryDriverCin?: string
    deliveryVehiclePlate?: string
  }

  const slip = await createDeliveryNote({
    sourceInvoiceId: invoice._id,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    customerAddress: invoice.customerAddress,
    lines: mapInvoiceLinesToDeliveryLines(invoice.lines || []),
    includeTva: invoice.includeTva,
    blNumber: invoice.blNumber || invoice.reference,
    bcNumber: invoice.bcNumber,
    pieceNumber: invoice.pieceNumber,
    representative: invoice.representative,
    deliveryPerson: invoice.deliveryPerson,
    deliveryDriverName: body.deliveryDriverName,
    deliveryDriverCin: body.deliveryDriverCin,
    deliveryVehiclePlate: body.deliveryVehiclePlate,
    validUntil: invoice.validUntil,
    isSettled: false
  })

  sendSuccess(res, { slip }, 201)
}))

router.post('/delivery-notes/convert', asyncHandler(async (req, res) => {
  const body = req.body as {
    customerId?: string
    customerName?: string
    customerAddress?: string
    lines?: DeliveryNoteLine[]
    deliveryIds?: string[]
    includeTva?: boolean
  }

  let mergedLines = body.lines ? [...body.lines] : []
  let customerId = body.customerId
  let customerName = body.customerName?.trim()
  let customerAddress = body.customerAddress?.trim()
  let includeTva = body.includeTva

  if (body.deliveryIds?.length) {
    const deliveryDocs = await PurchaseSlip.find({
      _id: { $in: body.deliveryIds },
      ...deliveryNoteFilter,
      convertedInvoiceId: null
    })

    if (!deliveryDocs.length) {
      sendError(res, 'Aucun bon de livraison valide sélectionné', 400)
      return
    }

    if (deliveryDocs.length !== body.deliveryIds.length) {
      sendError(res, 'Un ou plusieurs bons de livraison ne sont plus disponibles pour facturation', 400)
      return
    }

    const firstCustomerName = deliveryDocs[0].customerName?.trim()
    const mixedCustomers = deliveryDocs.some(
      (doc) => (doc.customerName?.trim() || 'Client comptant') !== (firstCustomerName || 'Client comptant')
    )
    if (mixedCustomers) {
      sendError(res, 'Les bons de livraison sélectionnés doivent appartenir au même client', 400)
      return
    }

    customerId = customerId || deliveryDocs[0].customerId?.toString()
    customerName = customerName || deliveryDocs[0].customerName || 'Client comptant'
    customerAddress = customerAddress || deliveryDocs[0].customerAddress
    includeTva = includeTva ?? deliveryDocs[0].includeTva ?? false

    const primaryDelivery = deliveryDocs[0]

    const fromDeliveryNotes = deliveryDocs.flatMap((doc) =>
      (doc.lines || []).map((line) => ({
        productId: line.productId?.toString(),
        reference: line.reference,
        designation: line.designation || '',
        quantity: line.quantity || 0,
        unitPrice: line.unitPrice || 0,
        discount: line.discount ?? 0,
        tva: line.tva ?? 0,
        totalHT: line.totalHT || 0,
        totalTTC: line.totalTTC || 0
      }))
    )

    mergedLines = [...mergedLines, ...fromDeliveryNotes]
  }

  if (!mergedLines.length) {
    sendError(res, 'Aucune ligne de livraison', 400)
    return
  }

  const normalizedLines = mergeDocumentLines(mergedLines)
  const timbre = TIMBRE_FISCAL_AMOUNT
  const totals = buildDocumentTotals(normalizedLines, { includeTva, timbreFiscal: timbre })
  const invoiceRef = await getNextReference('invoice', true)

  const primaryDelivery =
    body.deliveryIds?.length
      ? await PurchaseSlip.findById(body.deliveryIds[0])
      : null

  const invoice = await Invoice.create({
    reference: invoiceRef,
    customerId: customerId || undefined,
    customerName: customerName || 'Client comptant',
    customerAddress: customerAddress || undefined,
    lines: normalizedLines.map((line) => ({
      productId: line.productId,
      reference: line.reference,
      designation: line.designation,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount ?? 0,
      tva: line.tva ?? 0,
      totalHT: line.totalHT,
      totalTTC: line.totalTTC
    })),
    totalHT: totals.totalHT,
    totalTVA: totals.totalTVA,
    timbreFiscal: timbre,
    totalTTC: totals.totalTTC,
    amountPaid: 0,
    amountDue: totals.totalTTC,
    isPaid: false,
    includeTva: includeTva ?? false,
    blNumber: body.deliveryIds?.length === 1 ? primaryDelivery?.reference : undefined,
    deliveryPerson: primaryDelivery?.deliveryDriverName || primaryDelivery?.deliveryPerson,
    representative: primaryDelivery?.representative
  })

  if (body.deliveryIds?.length) {
    await PurchaseSlip.updateMany(
      { _id: { $in: body.deliveryIds } },
      { $set: { convertedInvoiceId: invoice._id, isSettled: true, amountDue: 0 } }
    )
  }

  sendSuccess(res, { invoice, documentType: 'invoice' }, 201)
}))

router.post('/delivery-notes', asyncHandler(async (req, res) => {
  const body = req.body as {
    customerId?: string
    customerName?: string
    customerAddress?: string
    sourceInvoiceId?: string
    lines?: DeliveryNoteLine[]
    includeTva?: boolean
    deliveryDriverName?: string
    deliveryDriverCin?: string
    deliveryVehiclePlate?: string
  }

  if (!body.lines?.length) {
    sendError(res, 'Aucune ligne de bon de livraison', 400)
    return
  }

  let lines = body.lines as DeliveryNoteLine[]

  if (body.sourceInvoiceId) {
    const invoice = await Invoice.findById(body.sourceInvoiceId)
    if (invoice?.lines?.length) {
      const invoiceLines = mapInvoiceLinesToDeliveryLines(invoice.lines)
      lines = lines.map((line, index) => ({
        ...invoiceLines[index],
        ...line,
        productId: line.productId || invoiceLines[index]?.productId,
        designation: line.designation || invoiceLines[index]?.designation || '',
        reference: line.reference || invoiceLines[index]?.reference || ''
      }))
    }
  }

  const slip = await createDeliveryNote({
    sourceInvoiceId: body.sourceInvoiceId,
    customerId: body.customerId,
    customerName: body.customerName,
    customerAddress: body.customerAddress,
    lines,
    includeTva: body.includeTva,
    deliveryDriverName: body.deliveryDriverName,
    deliveryDriverCin: body.deliveryDriverCin,
    deliveryVehiclePlate: body.deliveryVehiclePlate,
    isSettled: false
  })

  sendSuccess(res, { slip }, 201)
}))

router.get('/delivery-notes/:id/pdf', asyncHandler(async (req, res) => {
  const doc = await PurchaseSlip.findOne({ _id: req.params.id, ...deliveryNoteFilter })
  if (!doc) {
    sendError(res, 'Bon de livraison introuvable', 404)
    return
  }

  const settings = (await Settings.findOne()) ?? (await Settings.create({}))
  const pdfBytes = await generateInvoicePdf(await enrichDeliveryNoteForPdf(doc), settings, 'BON DE LIVRAISON')
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename=${doc.reference}.pdf`)
  res.send(Buffer.from(pdfBytes))
}))

export default router
