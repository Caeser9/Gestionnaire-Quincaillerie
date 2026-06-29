import { Router } from 'express'
import { Invoice, PurchaseSlip, Settings } from '../../db/models'
import { attachActor } from '../middleware/context'
import { sendSuccess, sendError, asyncHandler } from '../middleware/response'
import { generateInvoicePdf, generatePurchaseSlipPdf } from '../../services/pdf.service'

const router = Router()
router.use(attachActor)

router.get('/invoices/:id/pdf', asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
  if (!invoice) {
    sendError(res, 'Facture introuvable', 404)
    return
  }

  const settings = (await Settings.findOne()) ?? (await Settings.create({}))
  const pdfBytes = await generateInvoicePdf(invoice, settings)

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename=${invoice.reference}.pdf`)
  res.send(Buffer.from(pdfBytes))
}))

router.get('/purchase-slips/:id/pdf', asyncHandler(async (req, res) => {
  const slip = await PurchaseSlip.findById(req.params.id)
  if (!slip) {
    sendError(res, 'Bon d\'achat introuvable', 404)
    return
  }

  const settings = (await Settings.findOne()) ?? (await Settings.create({}))
  const pdfBytes = await generatePurchaseSlipPdf(slip, settings)

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename=${slip.reference}.pdf`)
  res.send(Buffer.from(pdfBytes))
}))

export default router
