import { Router } from 'express'
import {
  Supplier,
  PurchaseOrder,
  PurchaseReceipt,
  SupplierInvoice,
  Product,
  StockMovement,
  Payment
} from '../../db/models'
import { attachActor, getActorId } from '../middleware/context'
import { sendSuccess, sendError, handleZodError, asyncHandler } from '../middleware/response'
import { supplierSchema, purchaseOrderSchema, quickReceiveSchema, purchaseReceivePaymentSchema, purchaseOrderPaySchema, paymentSchema } from '@shared/validation/schemas'
import { getNextReference } from '../../services/reference.service'
import { roundMoney, computePurchasePayment } from '@shared/utils'

const router = Router()
router.use(attachActor)

type ReceiveLine = { productId: string; quantity: number; unitPrice?: number }

type ReceivePaymentInput = {
  mode: 'paid' | 'credit' | 'partial'
  amountPaid?: number
  method?: 'cash' | 'card' | 'mixed'
}

function calcReceiveBatchHT(
  orderLines: Array<{ productId: { toString(): string }; unitPrice: number }>,
  receiveLines: ReceiveLine[]
): number {
  return roundMoney(
    receiveLines.reduce((sum, rl) => {
      if (rl.quantity <= 0) return sum
      const ol = orderLines.find((l) => l.productId.toString() === rl.productId)
      if (!ol) return sum
      return sum + rl.quantity * ol.unitPrice
    }, 0)
  )
}

async function applyReceivePayment(
  order: InstanceType<typeof PurchaseOrder>,
  batchHT: number,
  payment: ReceivePaymentInput,
  actorId: string | undefined
) {
  if (batchHT <= 0) return

  let payAmount = 0
  let debtAmount = 0

  if (payment.mode === 'paid') {
    payAmount = batchHT
  } else if (payment.mode === 'credit') {
    debtAmount = batchHT
  } else {
    payAmount = roundMoney(Math.min(payment.amountPaid ?? 0, batchHT))
    debtAmount = roundMoney(batchHT - payAmount)
  }

  order.amountPaid = roundMoney((order.amountPaid || 0) + payAmount)
  const computed = computePurchasePayment(order.lines, order.amountPaid)
  order.paymentStatus = computed.paymentStatus
  order.amountDue = computed.amountDue
  await order.save()

  if (debtAmount > 0) {
    await Supplier.findByIdAndUpdate(order.supplierId, { $inc: { balance: debtAmount } })
    await SupplierInvoice.create({
      supplierId: order.supplierId,
      purchaseOrderId: order._id,
      reference: `DET-${order.reference}`,
      amount: debtAmount
    })
  }

  if (payAmount > 0) {
    await Payment.create({
      type: 'supplier',
      entityId: order.supplierId,
      purchaseOrderId: order._id,
      amount: payAmount,
      method: payment.method || 'cash',
      createdBy: actorId
    })
  }
}

async function applyPurchaseReceive(
  order: InstanceType<typeof PurchaseOrder>,
  lines: ReceiveLine[],
  actorId: string | undefined,
  options?: { updatePurchasePrices?: boolean }
) {
  const receiptRef = await getNextReference('purchaseReceipt')
  const updatedProducts: { productId: string; stockBefore: number }[] = []

  for (const line of lines) {
    if (line.quantity <= 0) continue

    const orderLine = order.lines.find((l) => l.productId.toString() === line.productId)
    if (!orderLine) continue

    const remaining = orderLine.quantity - orderLine.receivedQuantity
    if (line.quantity > remaining) {
      throw new Error(
        `Quantité excessive pour « ${orderLine.designation} » (reste: ${remaining})`
      )
    }

    orderLine.receivedQuantity += line.quantity
    const product = await Product.findById(line.productId)
    if (!product) continue

    const stockBefore = product.stock
    product.stock += line.quantity

    if (options?.updatePurchasePrices) {
      const price = line.unitPrice ?? orderLine.unitPrice
      if (price > 0) product.purchasePrice = price
    }

    await product.save()
    updatedProducts.push({ productId: product._id.toString(), stockBefore })

    await StockMovement.create({
      productId: product._id,
      type: 'in',
      reason: 'purchase',
      quantity: line.quantity,
      stockBefore,
      stockAfter: product.stock,
      reference: receiptRef,
      createdBy: actorId
    })
  }

  const allReceived = order.lines.every((l) => l.receivedQuantity >= l.quantity)
  const partialReceived = order.lines.some((l) => l.receivedQuantity > 0)
  order.status = allReceived ? 'received' : partialReceived ? 'partial' : order.status
  await order.save()

  const receipt = await PurchaseReceipt.create({
    purchaseOrderId: order._id,
    reference: receiptRef,
    lines: lines.filter((l) => l.quantity > 0).map((l) => ({ productId: l.productId, quantity: l.quantity })),
    receivedBy: actorId
  })

  return { order, receipt, updatedProducts, receiptRef }
}

router.get('/suppliers', asyncHandler(async (req, res) => {
  const { search, page = '1', limit = '50' } = req.query
  const pageNum = parseInt(page as string, 10)
  const limitNum = parseInt(limit as string, 10)
  const filter: Record<string, unknown> = { isDeleted: false }
  if (search) {
    filter.$or = [
      { companyName: { $regex: search, $options: 'i' } },
      { reference: { $regex: search, $options: 'i' } }
    ]
  }

  const [data, total] = await Promise.all([
    Supplier.find(filter).sort({ companyName: 1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Supplier.countDocuments(filter)
  ])

  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) })
}))

router.get('/suppliers/:id', asyncHandler(async (req, res) => {
  const supplier = await Supplier.findOne({ _id: req.params.id, isDeleted: false })
  if (!supplier) {
    sendError(res, 'Fournisseur introuvable', 404)
    return
  }
  sendSuccess(res, supplier)
}))

router.post('/suppliers', asyncHandler(async (req, res) => {
  const parsed = supplierSchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }
  const reference = await getNextReference('supplier')
  const supplier = await Supplier.create({ ...parsed.data, reference })
  sendSuccess(res, supplier, 201)
}))

router.put('/suppliers/:id', asyncHandler(async (req, res) => {
  const parsed = supplierSchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, parsed.data, { new: true })
  sendSuccess(res, supplier)
}))

router.delete('/suppliers/:id', asyncHandler(async (req, res) => {
  await Supplier.findByIdAndUpdate(req.params.id, { isDeleted: true })
  sendSuccess(res, { message: 'Fournisseur supprimé' })
}))

router.get('/suppliers/:id/purchases', asyncHandler(async (req, res) => {
  const orders = await PurchaseOrder.find({ supplierId: req.params.id }).sort({ createdAt: -1 })
  sendSuccess(res, orders)
}))

router.get('/suppliers/:id/payments', asyncHandler(async (req, res) => {
  const payments = await Payment.find({ type: 'supplier', entityId: req.params.id }).sort({ createdAt: -1 })
  sendSuccess(res, payments)
}))

router.get('/suppliers/:id/activity', asyncHandler(async (req, res) => {
  const supplierId = req.params.id
  const supplier = await Supplier.findOne({ _id: supplierId, isDeleted: false })
  if (!supplier) {
    sendError(res, 'Fournisseur introuvable', 404)
    return
  }

  const [orders, payments, supplierInvoices, products] = await Promise.all([
    PurchaseOrder.find({ supplierId }).sort({ createdAt: -1 }),
    Payment.find({ type: 'supplier', entityId: supplierId }).sort({ createdAt: -1 }),
    SupplierInvoice.find({ supplierId }).sort({ createdAt: -1 }),
    Product.find({ supplierId, isDeleted: false })
      .select('reference designation purchasePrice stock unit')
      .sort({ designation: 1 })
  ])

  const orderIds = orders.map((o) => o._id)
  const orderRefMap = new Map(orders.map((o) => [o._id.toString(), o.reference]))

  const receipts = orderIds.length
    ? await PurchaseReceipt.find({ purchaseOrderId: { $in: orderIds } })
        .sort({ createdAt: -1 })
        .lean()
    : []

  const productIds = new Set<string>()
  for (const o of orders) {
    for (const l of o.lines) productIds.add(l.productId.toString())
  }
  for (const r of receipts) {
    for (const l of r.lines) productIds.add(l.productId.toString())
  }

  const productMap = new Map(
    products.map((p) => [p._id.toString(), p])
  )
  const extraProducts =
    productIds.size > 0
      ? await Product.find({
          _id: { $in: [...productIds].filter((id) => !productMap.has(id)) },
          isDeleted: false
        })
          .select('reference designation purchasePrice stock unit')
          .lean()
      : []
  for (const p of extraProducts) {
    productMap.set(p._id.toString(), p)
  }

  type ActivityRow = {
    _id: string
    date: Date
    type: 'order' | 'receipt' | 'invoice' | 'payment'
    reference: string
    label: string
    amount?: number
    effect: 'debt_up' | 'debt_down' | 'neutral'
    status?: string
    lines?: Array<{
      designation: string
      quantity?: number
      unitPrice?: number
      receivedQuantity?: number
    }>
    method?: string
    notes?: string
  }

  const activities: ActivityRow[] = []

  for (const order of orders) {
    activities.push({
      _id: order._id.toString(),
      date: order.createdAt,
      type: 'order',
      reference: order.reference,
      label: `Bon de commande — ${order.lines.length} ligne(s)`,
      amount: order.totalHT,
      effect: 'neutral',
      status: order.status,
      lines: order.lines.map((l) => ({
        designation: l.designation,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        receivedQuantity: l.receivedQuantity
      })),
      paymentStatus: order.paymentStatus,
      amountPaid: order.amountPaid,
      amountDue: order.amountDue
    })
  }

  for (const receipt of receipts) {
    const poRef = orderRefMap.get(receipt.purchaseOrderId.toString()) ?? '—'
    const recvLines = receipt.lines.map((l) => {
      const p = productMap.get(l.productId.toString())
      return {
        designation: p?.designation ?? 'Produit',
        quantity: l.quantity
      }
    })
    const totalQty = recvLines.reduce((s, l) => s + (l.quantity ?? 0), 0)
    activities.push({
      _id: receipt._id.toString(),
      date: receipt.createdAt,
      type: 'receipt',
      reference: receipt.reference,
      label: `Réception BC ${poRef} — ${totalQty} unité(s)`,
      effect: 'neutral',
      lines: recvLines
    })
  }

  for (const inv of supplierInvoices) {
    const poRef = inv.purchaseOrderId
      ? orderRefMap.get(inv.purchaseOrderId.toString())
      : undefined
    activities.push({
      _id: inv._id.toString(),
      date: inv.createdAt,
      type: 'invoice',
      reference: inv.reference,
      label: poRef ? `Facture fournisseur (BC ${poRef})` : 'Facture fournisseur',
      amount: inv.amount,
      effect: 'debt_up'
    })
  }

  for (const pay of payments) {
    activities.push({
      _id: pay._id.toString(),
      date: pay.createdAt,
      type: 'payment',
      reference: `PAY-${pay._id.toString().slice(-6).toUpperCase()}`,
      label: 'Paiement fournisseur',
      amount: pay.amount,
      effect: 'debt_down',
      method: pay.method,
      notes: pay.notes
    })
  }

  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalOrdersHT = roundMoney(orders.reduce((s, o) => s + o.totalHT, 0))
  const totalInvoiced = roundMoney(supplierInvoices.reduce((s, i) => s + i.amount, 0))
  const totalPaid = roundMoney(payments.reduce((s, p) => s + p.amount, 0))

  sendSuccess(res, {
    supplier,
    summary: {
      balance: supplier.balance,
      totalOrdersHT,
      totalInvoiced,
      totalPaid,
      ordersCount: orders.length,
      receiptsCount: receipts.length,
      invoicesCount: supplierInvoices.length,
      paymentsCount: payments.length,
      productsCount: products.length
    },
    activities,
    products: products.map((p) => ({
      _id: p._id.toString(),
      reference: p.reference,
      designation: p.designation,
      purchasePrice: p.purchasePrice,
      stock: p.stock,
      unit: p.unit
    }))
  })
}))

router.get('/purchase-orders', asyncHandler(async (req, res) => {
  const { status, page = '1', limit = '20' } = req.query
  const pageNum = parseInt(page as string, 10)
  const limitNum = parseInt(limit as string, 10)
  const filter: Record<string, unknown> = {}
  if (status) filter.status = status

  const [data, total] = await Promise.all([
    PurchaseOrder.find(filter)
      .populate('supplierId', 'companyName reference')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    PurchaseOrder.countDocuments(filter)
  ])

  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) })
}))

router.post('/purchase-orders/quick-receive', asyncHandler(async (req, res) => {
  const parsed = quickReceiveSchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }

  const { supplierId, lines, notes, updatePurchasePrices, recordDebt } = parsed.data
  const reference = await getNextReference('purchaseOrder', true)
  const totalHT = roundMoney(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0))

  const order = await PurchaseOrder.create({
    reference,
    supplierId,
    lines: lines.map((l) => ({ ...l, receivedQuantity: 0 })),
    totalHT,
    notes,
    status: 'sent'
  })

  try {
    const { order: updatedOrder, receipt } = await applyPurchaseReceive(
      order,
      lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice })),
      getActorId(req),
      { updatePurchasePrices }
    )

    if (recordDebt && totalHT > 0) {
      await applyReceivePayment(
        updatedOrder,
        totalHT,
        { mode: 'credit' },
        getActorId(req)
      )
    } else {
      await applyReceivePayment(
        updatedOrder,
        totalHT,
        { mode: 'paid', method: 'cash' },
        getActorId(req)
      )
    }

    const freshOrder = await PurchaseOrder.findById(updatedOrder._id)
    sendSuccess(res, { order: freshOrder, receipt, totalHT }, 201)
  } catch (err) {
    await PurchaseOrder.findByIdAndDelete(order._id)
    sendError(res, err instanceof Error ? err.message : 'Erreur réception', 400)
  }
}))

router.post('/purchase-orders', asyncHandler(async (req, res) => {
  const parsed = purchaseOrderSchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }

  const reference = await getNextReference('purchaseOrder', true)
  const totalHT = roundMoney(parsed.data.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0))

  const order = await PurchaseOrder.create({
    reference,
    supplierId: parsed.data.supplierId,
    lines: parsed.data.lines.map((l) => ({ ...l, receivedQuantity: 0 })),
    totalHT,
    notes: parsed.data.notes,
    status: 'draft'
  })

  sendSuccess(res, order, 201)
}))

router.put('/purchase-orders/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body
  const order = await PurchaseOrder.findByIdAndUpdate(req.params.id, { status }, { new: true })
  sendSuccess(res, order)
}))

router.post('/purchase-orders/:id/receive', asyncHandler(async (req, res) => {
  const { lines, updatePurchasePrices, payment } = req.body as {
    lines: ReceiveLine[]
    updatePurchasePrices?: boolean
    payment?: ReceivePaymentInput
  }

  const paymentParsed = purchaseReceivePaymentSchema.safeParse(
    payment ?? { mode: 'credit' }
  )
  if (!paymentParsed.success) {
    handleZodError(res, paymentParsed.error)
    return
  }

  const order = await PurchaseOrder.findById(req.params.id)
  if (!order) {
    sendError(res, 'Bon de commande introuvable', 404)
    return
  }

  const batchHT = calcReceiveBatchHT(order.lines, lines)

  const originalReceived = order.lines.map((l) => ({
    productId: l.productId.toString(),
    receivedQuantity: l.receivedQuantity
  }))
  const originalStatus = order.status
  const originalAmountPaid = order.amountPaid
  const originalPaymentStatus = order.paymentStatus
  const originalAmountDue = order.amountDue
  let updatedProducts: { productId: string; stockBefore: number }[] = []

  try {
    const priceMap = new Map(
      order.lines.map((l) => [l.productId.toString(), l.unitPrice])
    )
    const receiveLines = lines.map((l) => ({
      ...l,
      unitPrice: l.unitPrice ?? priceMap.get(l.productId)
    }))

    const result = await applyPurchaseReceive(order, receiveLines, getActorId(req), {
      updatePurchasePrices
    })
    updatedProducts = result.updatedProducts

    await applyReceivePayment(
      result.order,
      batchHT,
      paymentParsed.data,
      getActorId(req)
    )

    const freshOrder = await PurchaseOrder.findById(result.order._id)
    sendSuccess(res, { order: freshOrder, receipt: result.receipt })
  } catch (err) {
    try {
      for (const upd of updatedProducts) {
        const prod = await Product.findById(upd.productId)
        if (prod) {
          prod.stock = upd.stockBefore
          await prod.save()
        }
      }
      for (const ov of originalReceived) {
        const ol = order.lines.find((l) => l.productId.toString() === ov.productId)
        if (ol) ol.receivedQuantity = ov.receivedQuantity
      }
      order.status = originalStatus
      order.amountPaid = originalAmountPaid
      order.paymentStatus = originalPaymentStatus
      order.amountDue = originalAmountDue
      await order.save()
    } catch {
      // rollback failed
    }
    sendError(res, err instanceof Error ? err.message : 'Erreur réception', 400)
  }
}))

router.post('/purchase-orders/:id/pay', asyncHandler(async (req, res) => {
  const parsed = purchaseOrderPaySchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }

  const order = await PurchaseOrder.findById(req.params.id)
  if (!order) {
    sendError(res, 'Bon de commande introuvable', 404)
    return
  }

  const computed = computePurchasePayment(order.lines, order.amountPaid || 0)
  const amount = roundMoney(parsed.data.amount)

  if (computed.amountDue <= 0) {
    sendError(res, 'Ce bon de commande est déjà payé', 400)
    return
  }
  if (amount > computed.amountDue) {
    sendError(res, `Montant supérieur au reste dû (${computed.amountDue.toFixed(3)} DT)`, 400)
    return
  }

  const supplier = await Supplier.findById(order.supplierId)
  if (!supplier || supplier.isDeleted) {
    sendError(res, 'Fournisseur introuvable', 404)
    return
  }

  order.amountPaid = roundMoney((order.amountPaid || 0) + amount)
  const updated = computePurchasePayment(order.lines, order.amountPaid)
  order.paymentStatus = updated.paymentStatus
  order.amountDue = updated.amountDue
  await order.save()

  supplier.balance = roundMoney(Math.max(0, supplier.balance - amount))
  await supplier.save()

  const payment = await Payment.create({
    type: 'supplier',
    entityId: order.supplierId,
    purchaseOrderId: order._id,
    amount,
    method: parsed.data.method,
    notes: parsed.data.notes,
    createdBy: getActorId(req)
  })

  sendSuccess(res, { order, payment }, 201)
}))

router.post('/supplier-invoices', asyncHandler(async (req, res) => {
  const { supplierId, purchaseOrderId, reference, amount, filePath, fileType } = req.body
  const invoice = await SupplierInvoice.create({
    supplierId,
    purchaseOrderId,
    reference,
    amount,
    filePath,
    fileType
  })

  await Supplier.findByIdAndUpdate(supplierId, { $inc: { balance: amount } })
  sendSuccess(res, invoice, 201)
}))

router.post('/supplier-payments', asyncHandler(async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }

  if (parsed.data.type !== 'supplier') {
    sendError(res, 'Type de paiement invalide', 400)
    return
  }

  const supplier = await Supplier.findById(parsed.data.entityId)
  if (!supplier || supplier.isDeleted) {
    sendError(res, 'Fournisseur introuvable', 404)
    return
  }

  const amount = roundMoney(parsed.data.amount)
  if (amount > supplier.balance) {
    sendError(res, `Montant supérieur à la dette (${supplier.balance.toFixed(3)} DT)`, 400)
    return
  }

  const payment = await Payment.create({
    ...parsed.data,
    amount,
    createdBy: getActorId(req)
  })

  supplier.balance = roundMoney(Math.max(0, supplier.balance - amount))
  await supplier.save()

  sendSuccess(res, payment, 201)
}))

export default router
