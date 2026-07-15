import { Router } from 'express'
import { Settings, Quote } from '../../db/models'
import { getNextReference } from '../../services/reference.service'
import { attachActor } from '../middleware/context'
import { sendSuccess, sendError, asyncHandler } from '../middleware/response'
import { buildDocumentTotals } from '@shared/utils'
import { generateInvoicePdf } from '../../services/pdf.service'

const router = Router()
router.use(attachActor)

router.get('/quotes', asyncHandler(async (_req, res) => {
  const docs = await Quote.find().sort({ createdAt: -1 }).limit(100)
  sendSuccess(res, { data: docs })
}))

router.post('/quotes', asyncHandler(async (req, res) => {
  const body = req.body as {
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

  const totals = buildDocumentTotals(body.lines, { includeTva: body.includeTva, timbreFiscal: 0 })
  const ref = await getNextReference('quote', true)
  const quote = await Quote.create({
    reference: ref,
    customerId: body.customerId || undefined,
    customerName: body.customerName?.trim() || 'Client comptant',
    customerAddress: body.customerAddress?.trim() || undefined,
    lines: body.lines.map((line) => ({
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
  const pdfBytes = await generateInvoicePdf(quote, settings, 'DEVIS')
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

export default router
