import { Router } from 'express'
import { Settings, Quote, Invoice, Customer } from '../../db/models'
import { getNextReference } from '../../services/reference.service'
import { attachActor } from '../middleware/context'
import { sendSuccess, sendError, asyncHandler } from '../middleware/response'
import { buildDocumentTotals } from '@shared/utils'
import { generateInvoicePdf } from '../../services/pdf.service'
import { TIMBRE_FISCAL_AMOUNT } from '@shared/constants'

const router = Router()
router.use(attachActor)

router.get('/quotes', asyncHandler(async (_req, res) => {
  const docs = await Quote.find().sort({ createdAt: -1 }).limit(100)
  sendSuccess(res, { data: docs })
}))

router.post('/quotes', asyncHandler(async (req, res) => {
  const body = req.body as {
    customerId?: string
    customerName?: string
    customerAddress?: string
    validUntil?: string
    lines?: Array<{ designation: string; quantity: number; unitPrice: number; discount?: number; tva?: number; totalHT: number; totalTTC: number }>
    includeTva?: boolean
  }

  if (!body.lines?.length) {
    sendError(res, 'Aucune ligne de devis', 400)
    return
  }

  // Récupérer le code TVA et le matricule du client si customerId existe
  let customerTvaCode = undefined
  let customerMatricule = undefined
  if (body.customerId) {
    const customer = await Customer.findById(body.customerId)
    if (customer) {
      customerTvaCode = customer.tvaCode
      customerMatricule = customer.matricule
    }
  }

  // Recalculer les totaux TVA pour chaque ligne
  const recalculatedLines = body.lines.map((line) => {
    const quantity = line.quantity
    const unitPrice = line.unitPrice
    const discount = line.discount ?? 0
    const tva = line.tva ?? 0
    const htBeforeDiscount = quantity * unitPrice
    const discountAmount = htBeforeDiscount * (discount / 100)
    const totalHT = htBeforeDiscount - discountAmount
    const tvaAmount = body.includeTva ? (totalHT * tva / 100) : 0
    const totalTTC = totalHT + tvaAmount
    return {
      ...line,
      totalHT,
      totalTVA: tvaAmount,
      totalTTC
    }
  })

  const totals = buildDocumentTotals(recalculatedLines, { includeTva: body.includeTva, timbreFiscal: 0 })
  const ref = await getNextReference('quote', true)
  const quote = await Quote.create({
    reference: ref,
    customerId: body.customerId || undefined,
    customerName: body.customerName?.trim() || 'Client comptant',
    customerAddress: body.customerAddress?.trim() || undefined,
    customerMatricule: customerMatricule,
    customerTvaCode: customerTvaCode,
    lines: recalculatedLines.map((line) => ({
      productId: undefined,
      reference: (line as any).reference ?? '',
      designation: line.designation,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount ?? 0,
      tva: line.tva ?? 0,
      totalHT: line.totalHT,
      totalTVA: line.totalTVA,
      totalTTC: line.totalTTC
    })),
    totalHT: totals.totalHT,
    totalTVA: totals.totalTVA,
    timbreFiscal: 0,
    totalTTC: totals.totalTTC,
    includeTva: body.includeTva ?? false,
    validUntil: body.validUntil ? new Date(body.validUntil) : undefined
  })

  sendSuccess(res, { quote }, 201)
}))

router.get('/quotes/:id', asyncHandler(async (req, res) => {
  const quote = await Quote.findById(req.params.id)
  if (!quote) {
    sendError(res, 'Devis introuvable', 404)
    return
  }
  sendSuccess(res, quote)
}))

router.get('/quotes/:id/pdf', asyncHandler(async (req, res) => {
  const settings = (await Settings.findOne()) ?? (await Settings.create({}))
  const quote = await Quote.findById(req.params.id)
  if (!quote) {
    sendError(res, 'Devis introuvable', 404)
    return
  }

  // Enrichir le devis avec le code TVA et le matricule du client si customerId existe
  const quoteData = quote.toObject()
  if (quote.customerId) {
    const customer = await Customer.findById(quote.customerId)
    if (customer) {
      quoteData.customerTvaCode = customer.tvaCode
      quoteData.customerMatricule = customer.matricule
    }
  }

  const pdfBytes = await generateInvoicePdf(quoteData, settings, 'DEVIS')
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename=${quote.reference}.pdf`)
  res.send(Buffer.from(pdfBytes))
}))

router.put('/quotes/:id', asyncHandler(async (req, res) => {
  const body = req.body as {
    customerName?: string
    customerAddress?: string
    validUntil?: string
    lines?: Array<{ designation: string; quantity: number; unitPrice: number; discount?: number; tva?: number; totalHT: number; totalTTC: number }>
    includeTva?: boolean
  }

  const quote = await Quote.findById(req.params.id)
  if (!quote) {
    sendError(res, 'Devis introuvable', 404)
    return
  }

  if (body.customerName !== undefined) quote.customerName = body.customerName.trim()
  if (body.customerAddress !== undefined) quote.customerAddress = body.customerAddress?.trim()
  if (body.validUntil !== undefined) quote.validUntil = body.validUntil ? new Date(body.validUntil) : undefined
  if (body.includeTva !== undefined) quote.includeTva = body.includeTva
  
  if (body.lines?.length) {
    const totals = buildDocumentTotals(body.lines, { includeTva: body.includeTva ?? quote.includeTva, timbreFiscal: 0 })
    quote.lines = body.lines.map((line) => ({
      productId: undefined,
      reference: (line as any).reference ?? '',
      designation: line.designation,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount ?? 0,
      tva: line.tva ?? 0,
      totalHT: line.totalHT,
      totalTVA: Math.max(0, (line.totalTTC || 0) - (line.totalHT || 0)),
      totalTTC: line.totalTTC
    }))
    quote.totalHT = totals.totalHT
    quote.totalTVA = totals.totalTVA
    quote.totalTTC = totals.totalTTC
  }

  await quote.save()
  sendSuccess(res, quote)
}))

router.delete('/quotes/:id', asyncHandler(async (req, res) => {
  const quote = await Quote.findByIdAndDelete(req.params.id)
  if (!quote) {
    sendError(res, 'Devis introuvable', 404)
    return
  }
  sendSuccess(res, { message: 'Devis supprimé' })
}))

router.post('/quotes/:id/convert-to-invoice', asyncHandler(async (req, res) => {
  const quote = await Quote.findById(req.params.id)
  if (!quote) {
    sendError(res, 'Devis introuvable', 404)
    return
  }

  // Vérifier si le devis a déjà été converti
  if (quote.convertedInvoiceId) {
    const existingInvoice = await Invoice.findById(quote.convertedInvoiceId)
    if (existingInvoice) {
      sendSuccess(res, { invoice: existingInvoice, alreadyConverted: true }, 200)
      return
    }
  }

  const settings = await Settings.findOne()
  const timbre = TIMBRE_FISCAL_AMOUNT
  const totals = buildDocumentTotals(quote.lines || [], { includeTva: quote.includeTva, timbreFiscal: timbre })
  const invoiceRef = await getNextReference('invoice', true)

  // Récupérer le code TVA du client si customerId existe
  let customerTvaCode = undefined
  if (quote.customerId) {
    const customer = await Customer.findById(quote.customerId)
    if (customer) {
      customerTvaCode = customer.tvaCode
    }
  }

  const invoice = await Invoice.create({
    reference: invoiceRef,
    customerId: quote.customerId || undefined,
    customerName: quote.customerName || 'Client comptant',
    customerAddress: quote.customerAddress || undefined,
    customerTvaCode: customerTvaCode,
    lines: quote.lines?.map((line) => ({
      productId: line.productId,
      reference: line.reference,
      designation: line.designation,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount ?? 0,
      tva: line.tva ?? 0,
      totalHT: line.totalHT,
      totalTTC: line.totalTTC
    })) || [],
    totalHT: totals.totalHT,
    totalTVA: totals.totalTVA,
    timbreFiscal: timbre,
    totalTTC: totals.totalTTC,
    includeTva: quote.includeTva ?? false,
    amountPaid: 0,
    amountDue: totals.totalTTC,
    sourceQuoteId: quote._id
  })

  // Note: on purpose we DO NOT mark the quote as converted here to avoid
  // an automatic persistent conversion. The frontend can link the invoice
  // to the quote if desired.

  sendSuccess(res, { invoice }, 201)
}))

export default router
