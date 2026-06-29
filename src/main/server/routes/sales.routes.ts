import { Router } from 'express'
import { Product, Sale, Invoice, PurchaseSlip, Customer, StockMovement, Settings } from '../../db/models'
import { attachActor, getActorId } from '../middleware/context'
import { sendSuccess, sendError, handleZodError, asyncHandler } from '../middleware/response'
import { saleSchema, updateInvoiceSchema } from '@shared/validation/schemas'
import { getNextReference } from '../../services/reference.service'
import { findOrCreateCustomerByName } from '../../services/customer.service'
import { roundMoney, calculateTVA, applyDiscount, resolveSalePayment, calculateFodec, calculateGrandTotal } from '@shared/utils'
import { TIMBRE_FISCAL_AMOUNT } from '@shared/constants'
import { generateReceiptEscPos, generatePurchaseSlipEscPos } from '../../services/pdf.service'

const router = Router()
router.use(attachActor)

router.post('/sales', asyncHandler(async (req, res) => {
  const parsed = saleSchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }

  const includeTva = parsed.data.includeTva ?? false

  const saleLines: Array<{
    productId: string
    reference: string
    designation: string
    quantity: number
    unitPrice: number
    discount: number
    tva: number
    totalHT: number
    totalTVA: number
    totalTTC: number
  }> = []
  let totalHT = 0
  let totalTVA = 0
  let fodecBaseHT = 0

  // Stocker les produits mis à jour pour rollback
  const updatedProducts: { productId: string; stockBefore: number }[] = []

  try {
    for (const line of parsed.data.lines) {
      const product = await Product.findById(line.productId)
      if (!product || product.isDeleted) {
        // Rollback si besoin
        for (const upd of updatedProducts) {
          const prod = await Product.findById(upd.productId)
          if (prod) {
            prod.stock = upd.stockBefore
            await prod.save()
          }
        }
        sendError(res, `Produit introuvable: ${line.productId}`, 400)
        return
      }
      if (product.stock < line.quantity) {
        for (const upd of updatedProducts) {
          const prod = await Product.findById(upd.productId)
          if (prod) {
            prod.stock = upd.stockBefore
            await prod.save()
          }
        }
        sendError(res, `Stock insuffisant pour ${product.designation}`, 400)
        return
      }

      // Use line discount if provided, otherwise fallback to product default discount
      const discountPercent = line.discount !== undefined ? line.discount : (product.discount || 0)
      const unitPrice = product.salePrice
      const lineTotalBeforeDiscount = roundMoney(unitPrice * line.quantity)
      const lineHT = applyDiscount(lineTotalBeforeDiscount, discountPercent)
      const lineTVA = includeTva ? calculateTVA(lineHT, product.tva) : 0
      const lineTTC = roundMoney(lineHT + lineTVA)

      saleLines.push({
        productId: product._id.toString(),
        reference: product.reference,
        designation: product.designation,
        quantity: line.quantity,
        unitPrice,
        discount: discountPercent,
        tva: product.tva,
        totalHT: lineHT,
        totalTVA: lineTVA,
        totalTTC: lineTTC
      })

      totalHT += lineHT
      totalTVA += lineTVA
      if (product.subjectToFodec) {
        fodecBaseHT += lineHT
      }

      const stockBefore = product.stock
      product.stock -= line.quantity
      await product.save()
      updatedProducts.push({ productId: product._id.toString(), stockBefore })

      await StockMovement.create({
        productId: product._id,
        type: 'out',
        reason: 'sale',
        quantity: line.quantity,
        stockBefore,
        stockAfter: product.stock,
        createdBy: getActorId(req)
      })
    }

    totalHT = roundMoney(totalHT)
    totalTVA = roundMoney(totalTVA)
    fodecBaseHT = roundMoney(fodecBaseHT)
    const totalFodec = calculateFodec(fodecBaseHT)
    const subtotal = roundMoney(totalHT + totalFodec + totalTVA)

    const paymentProbe = resolveSalePayment(subtotal, parsed.data.paymentMethod, {
      amountPaid: parsed.data.amountPaid,
      cashReceived: parsed.data.cashReceived,
      cardAmount: parsed.data.cardAmount
    })
    const isFullPayment = paymentProbe.amountDue === 0
    const timbreFiscal = isFullPayment ? TIMBRE_FISCAL_AMOUNT : 0
    const totalTTC = roundMoney(subtotal + timbreFiscal)

    const payment = resolveSalePayment(totalTTC, parsed.data.paymentMethod, {
      amountPaid: parsed.data.amountPaid,
      cashReceived: parsed.data.cashReceived,
      cardAmount: parsed.data.cardAmount
    })
    const { amountPaid, amountDue, change } = payment

    let resolvedCustomerId = parsed.data.customerId || undefined
    let resolvedCustomerName = parsed.data.customerName?.trim() || undefined

    if (!resolvedCustomerId && resolvedCustomerName) {
      const result = await findOrCreateCustomerByName(resolvedCustomerName)
      if (result) {
        resolvedCustomerId = result.customer._id.toString()
        resolvedCustomerName = result.customer.name
      }
    } else if (resolvedCustomerId) {
      const customer = await Customer.findById(resolvedCustomerId)
      if (customer) {
        resolvedCustomerName = resolvedCustomerName || customer.name
      }
    }

    if (amountDue > 0 && !resolvedCustomerId) {
      for (const upd of updatedProducts) {
        const prod = await Product.findById(upd.productId)
        if (prod) {
          prod.stock = upd.stockBefore
          await prod.save()
        }
      }
      sendError(res, 'Indiquez le nom du client pour enregistrer une dette', 400)
      return
    }

    const sale = await Sale.create({
      customerId: resolvedCustomerId,
      cashierId: getActorId(req),
      lines: saleLines,
      totalHT,
      totalTVA,
      totalFodec,
      timbreFiscal,
      totalTTC,
      amountPaid,
      amountDue,
      paymentMethod: parsed.data.paymentMethod,
      cashReceived: parsed.data.cashReceived,
      cardAmount: parsed.data.cardAmount,
      change,
      includeTva
    })

    let customerName: string | undefined = resolvedCustomerName
    if (resolvedCustomerId) {
      const customer = await Customer.findById(resolvedCustomerId)
      if (customer) {
        customerName = customer.name
        customer.totalPurchases += totalTTC
        if (amountDue > 0) {
          customer.creditBalance += amountDue
        }
        await customer.save()
      }
    }

    const docPayload = {
      saleId: sale._id,
      customerId: resolvedCustomerId,
      customerName,
      lines: saleLines,
      totalHT,
      totalTVA,
      totalFodec,
      timbreFiscal,
      totalTTC,
      amountPaid,
      amountDue,
      includeTva
    }

    if (amountDue > 0) {
      const slipRef = await getNextReference('purchaseSlip', true)
      const purchaseSlip = await PurchaseSlip.create({
        reference: slipRef,
        ...docPayload,
        isSettled: false
      })
      sale.purchaseSlipId = purchaseSlip._id
      await sale.save()
      sendSuccess(res, { sale, purchaseSlip, documentType: 'purchase_slip' }, 201)
      return
    }

    const invoiceRef = await getNextReference('invoice', true)
    const invoice = await Invoice.create({
      reference: invoiceRef,
      ...docPayload,
      isPaid: true
    })

    sale.invoiceId = invoice._id
    await sale.save()

    sendSuccess(res, { sale, invoice, documentType: 'invoice' }, 201)
  } catch (err) {
    // Rollback manuel : restaurer les stocks
    try {
      for (const upd of updatedProducts) {
        const prod = await Product.findById(upd.productId)
        if (prod) {
          prod.stock = upd.stockBefore
          await prod.save()
        }
      }
    } catch {
      // Échec du rollback
    }
    throw err
  }
}))

router.get('/sales', asyncHandler(async (req, res) => {
  const { page = '1', limit = '20', date } = req.query
  const pageNum = parseInt(page as string, 10)
  const limitNum = parseInt(limit as string, 10)
  const filter: Record<string, unknown> = { isCancelled: false }

  if (date) {
    const d = new Date(date as string)
    const start = new Date(d)
    start.setHours(0, 0, 0, 0)
    const end = new Date(d)
    end.setHours(23, 59, 59, 999)
    filter.createdAt = { $gte: start, $lte: end }
  }

  const [data, total] = await Promise.all([
    Sale.find(filter)
      .populate('customerId', 'name')
      .populate('cashierId', 'username')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Sale.countDocuments(filter)
  ])

  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) })
}))

router.post('/sales/:id/cancel', asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id)
  if (!sale || sale.isCancelled) {
    sendError(res, 'Vente introuvable', 404)
    return
  }

  // Sauvegarder l'état d'origine pour rollback
  const originalCancelled = sale.isCancelled
  const updatedProducts: { productId: string; stockBefore: number }[] = []

  try {
    for (const line of sale.lines) {
      const product = await Product.findById(line.productId)
      if (!product) continue

      const stockBefore = product.stock
      product.stock += line.quantity
      await product.save()
      updatedProducts.push({ productId: product._id.toString(), stockBefore })

      await StockMovement.create({
        productId: product._id,
        type: 'in',
        reason: 'correction',
        quantity: line.quantity,
        stockBefore,
        stockAfter: product.stock,
        reference: `ANN-${sale._id}`,
        notes: 'Annulation vente',
        createdBy: getActorId(req)
      })
    }

    sale.isCancelled = true
    await sale.save()

    if (sale.invoiceId) {
      await Invoice.findByIdAndUpdate(sale.invoiceId, { isPaid: true, amountDue: 0 })
    }
    if (sale.purchaseSlipId) {
      const slip = await PurchaseSlip.findById(sale.purchaseSlipId)
      if (slip && slip.customerId && slip.amountDue > 0) {
        await Customer.findByIdAndUpdate(slip.customerId, {
          $inc: { creditBalance: -slip.amountDue }
        })
      }
      await PurchaseSlip.findByIdAndUpdate(sale.purchaseSlipId, {
        isSettled: true,
        amountDue: 0,
        amountPaid: slip?.totalTTC ?? 0
      })
    }

    sendSuccess(res, { message: 'Vente annulée' })
  } catch (err) {
    // Rollback manuel
    try {
      sale.isCancelled = originalCancelled
      await sale.save()
      for (const upd of updatedProducts) {
        const prod = await Product.findById(upd.productId)
        if (prod) {
          prod.stock = upd.stockBefore
          await prod.save()
        }
      }
    } catch {
      // Échec du rollback
    }
    throw err
  }
}))

router.get('/invoices', asyncHandler(async (req, res) => {
  const { page = '1', limit = '20' } = req.query
  const pageNum = parseInt(page as string, 10)
  const limitNum = parseInt(limit as string, 10)

  const [data, total] = await Promise.all([
    Invoice.find().sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Invoice.countDocuments()
  ])

  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) })
}))

router.get('/invoices/:id/receipt', asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id)
  if (!invoice) {
    sendError(res, 'Facture introuvable', 404)
    return
  }

  const settings = (await Settings.findOne()) ?? (await Settings.create({}))
  const receiptData = generateReceiptEscPos(invoice, settings)
  sendSuccess(res, { data: receiptData.toString('base64') })
}))

router.get('/invoices/:id', asyncHandler(async (req, res) => {
  const invoice = await Invoice.findById(req.params.id).populate('customerId', 'name phone address')
  if (!invoice) {
    sendError(res, 'Facture introuvable', 404)
    return
  }
  sendSuccess(res, invoice)
}))

router.patch('/invoices/:id', asyncHandler(async (req, res) => {
  const parsed = updateInvoiceSchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }

  const invoice = await Invoice.findByIdAndUpdate(
    req.params.id,
    { customerName: parsed.data.customerName.trim() },
    { new: true }
  )
  if (!invoice) {
    sendError(res, 'Facture introuvable', 404)
    return
  }
  sendSuccess(res, invoice)
}))

router.get('/purchase-slips', asyncHandler(async (req, res) => {
  const { page = '1', limit = '20' } = req.query
  const pageNum = parseInt(page as string, 10)
  const limitNum = parseInt(limit as string, 10)

  const [data, total] = await Promise.all([
    PurchaseSlip.find().sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    PurchaseSlip.countDocuments()
  ])

  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) })
}))

router.get('/purchase-slips/:id', asyncHandler(async (req, res) => {
  const slip = await PurchaseSlip.findById(req.params.id).populate('customerId', 'name phone')
  if (!slip) {
    sendError(res, 'Bon d\'achat introuvable', 404)
    return
  }
  sendSuccess(res, slip)
}))

router.get('/purchase-slips/:id/receipt', asyncHandler(async (req, res) => {
  const slip = await PurchaseSlip.findById(req.params.id)
  if (!slip) {
    sendError(res, 'Bon d\'achat introuvable', 404)
    return
  }

  const settings = (await Settings.findOne()) ?? (await Settings.create({}))
  const receiptData = generatePurchaseSlipEscPos(slip, settings)
  sendSuccess(res, { data: receiptData.toString('base64') })
}))

export default router