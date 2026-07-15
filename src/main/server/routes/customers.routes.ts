import { Router } from 'express'
import { Customer, Payment, Invoice, PurchaseSlip, Sale } from '../../db/models'
import { attachActor, getActorId } from '../middleware/context'
import { sendSuccess, sendError, handleZodError, asyncHandler } from '../middleware/response'
import { customerSchema, paymentSchema } from '@shared/validation/schemas'
import { getNextReference } from '../../services/reference.service'
import { findOrCreateCustomerByName } from '../../services/customer.service'
import {
  applyPaymentToPurchaseSlip,
  getSlipMaxPayment
} from '../../services/invoice.service'
import { roundMoney } from '@shared/utils'

const router = Router()
router.use(attachActor)

router.get('/customers', asyncHandler(async (req, res) => {
  const { search, page = '1', limit = '50' } = req.query
  const pageNum = parseInt(page as string, 10)
  const limitNum = parseInt(limit as string, 10)
  const filter: Record<string, unknown> = { isDeleted: false }
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { reference: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ]
  }

  const [data, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Customer.countDocuments(filter)
  ])

  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) })
}))

router.get('/customers/credits/open', asyncHandler(async (_req, res) => {
  const slips = await PurchaseSlip.find({ isSettled: false, amountDue: { $gt: 0 }, convertedInvoiceId: null })
    .populate('customerId', 'name reference phone')
    .sort({ createdAt: -1 })

  const rows = slips.map((slip) => {
    const customer = slip.customerId as { name?: string } | null
    return {
      _id: slip._id.toString(),
      reference: slip.reference,
      customerName: slip.customerName || customer?.name || 'Client',
      customerId: customer && '_id' in (customer as object) ? String((customer as { _id: unknown })._id) : slip.customerId?.toString(),
      amountDue: slip.amountDue,
      documentType: 'purchase_slip'
    }
  })
  sendSuccess(res, rows)
}))

/** Find or create a customer by name only (POS quick add) — before /:id routes */
router.post('/customers/quick', asyncHandler(async (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  if (!name) {
    sendError(res, 'Nom du client requis', 400)
    return
  }

  const result = await findOrCreateCustomerByName(name, {
    phone: String(req.body?.phone ?? '').trim() || undefined,
    address: String(req.body?.address ?? '').trim() || undefined,
    matricule: String(req.body?.matricule ?? '').trim() || undefined
  })
  if (!result) {
    sendError(res, 'Nom du client requis', 400)
    return
  }

  sendSuccess(res, { ...result.customer.toObject(), created: result.created }, result.created ? 201 : 200)
}))

router.get('/customers/:id', asyncHandler(async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, isDeleted: false })
  if (!customer) {
    sendError(res, 'Client introuvable', 404)
    return
  }
  sendSuccess(res, customer)
}))

router.post('/customers', asyncHandler(async (req, res) => {
  const parsed = customerSchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }
  const reference = await getNextReference('customer')
  const customer = await Customer.create({ ...parsed.data, reference })
  sendSuccess(res, customer, 201)
}))

router.put('/customers/:id', asyncHandler(async (req, res) => {
  const parsed = customerSchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }
  const customer = await Customer.findByIdAndUpdate(req.params.id, parsed.data, { new: true })
  sendSuccess(res, customer)
}))

router.delete('/customers/:id', asyncHandler(async (req, res) => {
  await Customer.findByIdAndUpdate(req.params.id, { isDeleted: true })
  sendSuccess(res, { message: 'Client supprimé' })
}))

router.get('/customers/:id/sales', asyncHandler(async (req, res) => {
  const sales = await Sale.find({ customerId: req.params.id, isCancelled: false }).sort({ createdAt: -1 })
  sendSuccess(res, sales)
}))

router.get('/customers/:id/invoices', asyncHandler(async (req, res) => {
  const invoices = await Invoice.find({ customerId: req.params.id }).sort({ createdAt: -1 })
  sendSuccess(res, invoices)
}))

router.post('/customer-payments', asyncHandler(async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }

  const customer = await Customer.findById(parsed.data.entityId)
  if (!customer || customer.isDeleted) {
    sendError(res, 'Client introuvable', 404)
    return
  }

  const amount = roundMoney(parsed.data.amount)
  let createdInvoice = null
  let targetSlip = null

  if (parsed.data.purchaseSlipId) {
    targetSlip = await PurchaseSlip.findById(parsed.data.purchaseSlipId)
    if (!targetSlip) {
      sendError(res, 'Bon d\'achat introuvable', 404)
      return
    }
    if (targetSlip.convertedInvoiceId) {
      sendError(res, 'Ce bon a déjà été converti en facture', 400)
      return
    }
    if (targetSlip.customerId?.toString() !== parsed.data.entityId) {
      sendError(res, 'Ce bon n\'appartient pas à ce client', 400)
      return
    }
    const maxPay = getSlipMaxPayment(targetSlip)
    if (amount > maxPay) {
      sendError(res, `Montant maximum pour ce bon : ${maxPay.toFixed(3)} DT`, 400)
      return
    }
    const productDue = roundMoney(Math.max(0, targetSlip.totalTTC - targetSlip.amountPaid))
    const productPortion = roundMoney(Math.min(amount, productDue))
    if (productPortion > customer.creditBalance) {
      sendError(res, `Montant supérieur au solde crédit (${customer.creditBalance.toFixed(3)} DT)`, 400)
      return
    }
  } else {
    const openSlips = await PurchaseSlip.find({
      customerId: parsed.data.entityId,
      convertedInvoiceId: null,
      amountDue: { $gt: 0 }
    }).sort({ createdAt: 1 })

    const maxTotal = roundMoney(openSlips.reduce((s, slip) => s + getSlipMaxPayment(slip), 0))
    if (amount > maxTotal) {
      sendError(res, `Montant maximum pour ce client : ${maxTotal.toFixed(3)} DT`, 400)
      return
    }

    let productPortionTotal = 0
    let remainingCheck = amount
    for (const slip of openSlips) {
      if (remainingCheck <= 0) break
      const productDue = roundMoney(Math.max(0, slip.totalTTC - slip.amountPaid))
      const applied = roundMoney(Math.min(remainingCheck, getSlipMaxPayment(slip)))
      productPortionTotal = roundMoney(productPortionTotal + Math.min(applied, productDue))
      remainingCheck = roundMoney(remainingCheck - applied)
    }
    if (productPortionTotal > customer.creditBalance) {
      sendError(res, `Montant supérieur au solde crédit (${customer.creditBalance.toFixed(3)} DT)`, 400)
      return
    }
  }

  const payment = await Payment.create({
    ...parsed.data,
    amount,
    createdBy: getActorId(req)
  })

  let creditReduction = 0
  if (targetSlip) {
    creditReduction = roundMoney(Math.min(amount, roundMoney(Math.max(0, targetSlip.totalTTC - targetSlip.amountPaid))))
  } else {
    let remaining = amount
    const openSlipsForCredit = await PurchaseSlip.find({
      customerId: parsed.data.entityId,
      convertedInvoiceId: null,
      amountDue: { $gt: 0 }
    }).sort({ createdAt: 1 })
    for (const slip of openSlipsForCredit) {
      if (remaining <= 0) break
      const productDue = roundMoney(Math.max(0, slip.totalTTC - slip.amountPaid))
      const applied = roundMoney(Math.min(remaining, getSlipMaxPayment(slip)))
      creditReduction = roundMoney(creditReduction + Math.min(applied, productDue))
      remaining = roundMoney(remaining - applied)
    }
  }

  customer.creditBalance = roundMoney(Math.max(0, customer.creditBalance - creditReduction))
  await customer.save()

  if (parsed.data.invoiceId) {
    const invoice = await Invoice.findById(parsed.data.invoiceId)
    if (invoice) {
      invoice.amountPaid = roundMoney(invoice.amountPaid + amount)
      invoice.amountDue = Math.max(0, roundMoney(invoice.totalTTC - invoice.amountPaid))
      invoice.isPaid = invoice.amountDue <= 0
      await invoice.save()
    }
  }

  if (targetSlip) {
    createdInvoice = await applyPaymentToPurchaseSlip(targetSlip, amount)
  } else if (amount > 0) {
    let remaining = amount
    const openSlips = await PurchaseSlip.find({
      customerId: parsed.data.entityId,
      convertedInvoiceId: null,
      amountDue: { $gt: 0 }
    }).sort({ createdAt: 1 })

    for (const slip of openSlips) {
      if (remaining <= 0) break
      const maxPay = getSlipMaxPayment(slip)
      const applied = roundMoney(Math.min(remaining, maxPay))
      if (applied <= 0) continue
      const invoice = await applyPaymentToPurchaseSlip(slip, applied)
      if (invoice) createdInvoice = invoice
      remaining = roundMoney(remaining - applied)
    }
  }

  sendSuccess(res, { payment, invoice: createdInvoice }, 201)
}))

export default router
