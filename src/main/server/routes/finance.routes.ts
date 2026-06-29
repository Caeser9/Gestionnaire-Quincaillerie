import { Router } from 'express'
import { Invoice, Sale, Payment, Expense, PurchaseOrder, PurchaseSlip } from '../../db/models'
import { attachActor, getActorId } from '../middleware/context'
import { sendSuccess, sendError, handleZodError, asyncHandler } from '../middleware/response'
import { expenseSchema } from '@shared/validation/schemas'
import { getSlipMaxPayment, isSlipAwaitingTimbre } from '../../services/invoice.service'
import { roundMoney } from '@shared/utils'
import type { ExpenseCategory } from '@shared/types'

const router = Router()
router.use(attachActor)

const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  merchandise: 'Achats de marchandises',
  transport: 'Transport',
  rent: 'Loyer',
  electricity: 'Électricité',
  other: 'Autres charges'
}

function getPeriodBounds(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0, 23, 59, 59, 999)
  return { start, end }
}

router.get('/finance/client-tracking', asyncHandler(async (req, res) => {
  const { customerId, page = '1', limit = '50' } = req.query
  const pageNum = parseInt(page as string, 10)
  const limitNum = parseInt(limit as string, 10)
  const filter: Record<string, unknown> = {}
  if (customerId) filter.customerId = customerId

  const [slips, total] = await Promise.all([
    PurchaseSlip.find({
      ...filter,
      convertedInvoiceId: null,
      amountDue: { $gt: 0 }
    })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    PurchaseSlip.countDocuments({
      ...filter,
      convertedInvoiceId: null,
      amountDue: { $gt: 0 }
    })
  ])

  const rows = slips.map((slip) => ({
    _id: slip._id.toString(),
    date: slip.createdAt,
    customerName: slip.customerName || 'Client',
    customerId: slip.customerId?.toString(),
    reference: slip.reference,
    documentType: 'purchase_slip' as const,
    totalInvoice: slip.totalTTC,
    amountPaid: slip.amountPaid,
    currentDebt: slip.amountDue,
    maxPayment: getSlipMaxPayment(slip),
    awaitingTimbre: isSlipAwaitingTimbre(slip)
  }))

  sendSuccess(res, { data: rows, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) })
}))

router.get('/finance/summary', asyncHandler(async (req, res) => {
  const now = new Date()
  const year = parseInt(req.query.year as string, 10) || now.getFullYear()
  const month = parseInt(req.query.month as string, 10) || now.getMonth() + 1
  const { start, end } = getPeriodBounds(year, month)

  const sales = await Sale.find({ isCancelled: false, createdAt: { $gte: start, $lte: end } })

  let recettesVentes = 0
  for (const sale of sales) {
    if (sale.paymentMethod === 'cash') {
      recettesVentes += sale.totalTTC
    } else if (sale.paymentMethod === 'card') {
      recettesVentes += sale.totalTTC
    } else if (sale.paymentMethod === 'mixed') {
      recettesVentes += (sale.cashReceived || 0) + (sale.cardAmount || 0)
    }
  }

  const customerPayments = await Payment.find({
    type: 'customer',
    createdAt: { $gte: start, $lte: end }
  })
  const recettesPaiements = customerPayments.reduce((s, p) => s + p.amount, 0)
  const recettes = roundMoney(recettesVentes + recettesPaiements)

  const manualExpenses = await Expense.find({ date: { $gte: start, $lte: end } })
  const depensesManuelles = manualExpenses.reduce((s, e) => s + e.amount, 0)

  const purchaseOrders = await PurchaseOrder.find({
    status: { $in: ['partial', 'received'] },
    updatedAt: { $gte: start, $lte: end }
  })
  const depensesAchats = purchaseOrders.reduce((s, po) => s + po.totalHT, 0)
  const depenses = roundMoney(depensesManuelles + depensesAchats)
  const beneficeNet = roundMoney(recettes - depenses)

  const categoryTotals = new Map<string, number>()
  for (const e of manualExpenses) {
    categoryTotals.set(e.category, (categoryTotals.get(e.category) || 0) + e.amount)
  }
  if (depensesAchats > 0) {
    categoryTotals.set('merchandise', (categoryTotals.get('merchandise') || 0) + depensesAchats)
  }

  const depensesParCategorie = Array.from(categoryTotals.entries()).map(([category, total]) => ({
    category,
    label: EXPENSE_LABELS[category as ExpenseCategory] || category,
    total: roundMoney(total)
  }))

  sendSuccess(res, {
    recettes,
    depenses,
    beneficeNet,
    depensesParCategorie,
    recettesDetail: [
      { source: 'Ventes encaissées (espèces/carte)', total: roundMoney(recettesVentes) },
      { source: 'Paiements crédit client', total: roundMoney(recettesPaiements) }
    ],
    expenses: manualExpenses,
    period: { year, month }
  })
}))

router.get('/expenses', asyncHandler(async (req, res) => {
  const { year, month } = req.query
  const filter: Record<string, unknown> = {}
  if (year && month) {
    const { start, end } = getPeriodBounds(parseInt(year as string, 10), parseInt(month as string, 10))
    filter.date = { $gte: start, $lte: end }
  }
  const expenses = await Expense.find(filter).sort({ date: -1 })
  sendSuccess(res, expenses)
}))

router.post('/expenses', asyncHandler(async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }

  const expense = await Expense.create({
    ...parsed.data,
    date: new Date(parsed.data.date),
    createdBy: getActorId(req)
  })

  sendSuccess(res, expense, 201)
}))

router.delete('/expenses/:id', asyncHandler(async (req, res) => {
  const expense = await Expense.findByIdAndDelete(req.params.id)
  if (!expense) {
    sendError(res, 'Dépense introuvable', 404)
    return
  }
  sendSuccess(res, { message: 'Dépense supprimée' })
}))

export default router
