import { Router } from 'express'
import mongoose from 'mongoose'
import { Product, Sale, Invoice, PurchaseSlip, Customer, StockMovement, Settings } from '../../db/models'
import { attachActor, getActorId } from '../middleware/context'
import { sendSuccess, sendError, handleZodError, asyncHandler } from '../middleware/response'
import { saleSchema, updateInvoiceSchema } from '@shared/validation/schemas'
import { getNextReference } from '../../services/reference.service'
import { findOrCreateCustomerByName } from '../../services/customer.service'
import { roundMoney, calculateTVA, applyDiscount, resolveSalePayment, calculateGrandTotal } from '@shared/utils'
import { TIMBRE_FISCAL_AMOUNT } from '@shared/constants'
import { generateReceiptEscPos, generatePurchaseSlipEscPos } from '../../services/pdf.service'
import { createDeliveryNote, purchaseSlipFilter } from '../../services/delivery-note.service'

const router = Router()
router.use(attachActor)

type IncomingSaleLine = {
  productId?: string
  isCustom?: boolean
  reference?: string
  designation?: string
  unitPrice?: number
  tva?: number
  quantity: number
  discount?: number
}

function isCustomSaleLine(line: IncomingSaleLine): boolean {
  if (line.isCustom === true) return true
  if (line.productId?.startsWith('custom-')) return true
  if (line.productId && !mongoose.Types.ObjectId.isValid(line.productId)) {
    return !!(line.designation?.trim())
  }
  return false
}

type BuiltSaleLine = {
  productId?: string
  reference: string
  designation: string
  quantity: number
  unitPrice: number
  discount: number
  tva: number
  totalHT: number
  totalTVA: number
  totalTTC: number
}

async function buildSaleLineFromInput(
  line: IncomingSaleLine,
  includeTva: boolean
): Promise<{ saleLine: BuiltSaleLine; stockUpdate?: { productId: string; stockBefore: number; quantity: number } }> {
  if (isCustomSaleLine(line)) {
    const discountPercent = line.discount ?? 0
    const unitPrice = line.unitPrice ?? 0
    const tvaRate = line.tva ?? 19
    const lineTotalBeforeDiscount = roundMoney(unitPrice * line.quantity)
    const lineHT = applyDiscount(lineTotalBeforeDiscount, discountPercent)
    const lineTVA = includeTva ? calculateTVA(lineHT, tvaRate) : 0
    const lineTTC = roundMoney(lineHT + lineTVA)

    return {
      saleLine: {
        reference: line.reference?.trim() || 'DIV',
        designation: line.designation?.trim() || 'Article divers',
        quantity: line.quantity,
        unitPrice,
        discount: discountPercent,
        tva: tvaRate,
        totalHT: lineHT,
        totalTVA: lineTVA,
        totalTTC: lineTTC
      }
    }
  }

  const product = await Product.findById(line.productId)
  if (!product || product.isDeleted) {
    throw new Error(`Produit introuvable: ${line.productId}`)
  }
  if (product.stock < line.quantity) {
    throw new Error(`Stock insuffisant pour ${product.designation}`)
  }

  const discountPercent = line.discount !== undefined ? line.discount : product.discount || 0
  const unitPrice = product.salePrice
  const lineTotalBeforeDiscount = roundMoney(unitPrice * line.quantity)
  const lineHT = applyDiscount(lineTotalBeforeDiscount, discountPercent)
  const lineTVA = includeTva ? calculateTVA(lineHT, product.tva) : 0
  const lineTTC = roundMoney(lineHT + lineTVA)

  return {
    saleLine: {
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
    },
    stockUpdate: {
      productId: product._id.toString(),
      stockBefore: product.stock,
      quantity: line.quantity
    }
  }
}

router.post('/sales', asyncHandler(async (req, res) => {
  const parsed = saleSchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }

  const includeTva = parsed.data.includeTva ?? false

  const saleLines: BuiltSaleLine[] = []
  let totalHT = 0
  let totalTVA = 0

  const updatedProducts: { productId: string; stockBefore: number }[] = []

  try {
    for (const line of parsed.data.lines) {
      let built: Awaited<ReturnType<typeof buildSaleLineFromInput>>
      try {
        built = await buildSaleLineFromInput(line, includeTva)
      } catch (err) {
        for (const upd of updatedProducts) {
          const prod = await Product.findById(upd.productId)
          if (prod) {
            prod.stock = upd.stockBefore
            await prod.save()
          }
        }
        sendError(res, err instanceof Error ? err.message : 'Ligne invalide', 400)
        return
      }

      saleLines.push(built.saleLine)
      totalHT += built.saleLine.totalHT
      totalTVA += built.saleLine.totalTVA

      if (built.stockUpdate) {
        const product = await Product.findById(built.stockUpdate.productId)
        if (!product) continue

        product.stock -= built.stockUpdate.quantity
        await product.save()
        updatedProducts.push({
          productId: built.stockUpdate.productId,
          stockBefore: built.stockUpdate.stockBefore
        })

        await StockMovement.create({
          productId: product._id,
          type: 'out',
          reason: 'vente',
          quantity: built.stockUpdate.quantity,
          stockBefore: built.stockUpdate.stockBefore,
          stockAfter: product.stock,
          createdBy: getActorId(req)
        })
      }
    }

    totalHT = roundMoney(totalHT)
    totalTVA = roundMoney(totalTVA)
    const subtotal = roundMoney(totalHT + totalTVA)

    const forceInvoice = parsed.data.forceInvoice === true

    const paymentProbe = resolveSalePayment(subtotal, parsed.data.paymentMethod, {
      amountPaid: parsed.data.amountPaid,
      cashReceived: parsed.data.cashReceived,
      cardAmount: parsed.data.cardAmount
    })
    const isFullPayment = paymentProbe.amountDue === 0
    const timbreFiscal = isFullPayment || forceInvoice ? TIMBRE_FISCAL_AMOUNT : 0
    const totalTTC = roundMoney(subtotal + timbreFiscal)

    const payment = resolveSalePayment(totalTTC, parsed.data.paymentMethod, {
      amountPaid: parsed.data.amountPaid,
      cashReceived: parsed.data.cashReceived,
      cardAmount: parsed.data.cardAmount
    })
    const { amountPaid, amountDue, change } = payment
    const billingDetails = {
      bcNumber: parsed.data.bcNumber?.trim() || undefined,
      blNumber: parsed.data.blNumber?.trim() || undefined,
      pieceNumber: parsed.data.pieceNumber?.trim() || undefined,
      representative: parsed.data.representative?.trim() || undefined,
      deliveryPerson: parsed.data.deliveryPerson?.trim() || parsed.data.deliveryDriverName?.trim() || undefined,
      validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : undefined,
      createdAt: parsed.data.createdAt ? new Date(parsed.data.createdAt) : undefined
    }
    const deliveryDetails = {
      deliveryDriverName: parsed.data.deliveryDriverName?.trim() || parsed.data.deliveryPerson?.trim() || undefined,
      deliveryDriverCin: parsed.data.deliveryDriverCin?.trim() || undefined,
      deliveryVehiclePlate: parsed.data.deliveryVehiclePlate?.trim() || undefined
    }

    let resolvedCustomerId = parsed.data.customerId || undefined
    let resolvedCustomerName = parsed.data.customerName?.trim() || undefined
    let resolvedCustomerAddress = parsed.data.customerAddress?.trim() || undefined
    let resolvedCustomerMatricule = parsed.data.customerMatricule?.trim() || undefined

    if (!resolvedCustomerId && resolvedCustomerName) {
      const result = await findOrCreateCustomerByName(resolvedCustomerName, {
        phone: parsed.data.customerPhone?.trim(),
        address: resolvedCustomerAddress,
        matricule: resolvedCustomerMatricule
      })
      if (result) {
        resolvedCustomerId = result.customer._id.toString()
        resolvedCustomerName = result.customer.name
        resolvedCustomerAddress = result.customer.address || resolvedCustomerAddress
        resolvedCustomerMatricule = result.customer.matricule || resolvedCustomerMatricule
      }
    } else if (resolvedCustomerId) {
      const customer = await Customer.findById(resolvedCustomerId)
      if (customer) {
        resolvedCustomerName = resolvedCustomerName || customer.name
        resolvedCustomerAddress = customer.address || resolvedCustomerAddress
        resolvedCustomerMatricule = resolvedCustomerMatricule || customer.matricule || undefined
        let changed = false
        if (parsed.data.customerPhone?.trim() && customer.phone !== parsed.data.customerPhone.trim()) {
          customer.phone = parsed.data.customerPhone.trim()
          changed = true
        }
        if (resolvedCustomerAddress && customer.address !== resolvedCustomerAddress) {
          customer.address = resolvedCustomerAddress
          changed = true
        }
        if (resolvedCustomerMatricule && customer.matricule !== resolvedCustomerMatricule) {
          customer.matricule = resolvedCustomerMatricule
          changed = true
        }
        if (changed) await customer.save()
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
      customerAddress: resolvedCustomerAddress,
      cashierId: getActorId(req),
      lines: saleLines,
      totalHT,
      totalTVA,
      timbreFiscal,
      totalTTC,
      amountPaid,
      amountDue,
      paymentMethod: parsed.data.paymentMethod,
      ...billingDetails,
      cashReceived: parsed.data.cashReceived,
      cardAmount: parsed.data.cardAmount,
      change,
      includeTva
    })

    let customerName: string | undefined = resolvedCustomerName
    let customerAddress: string | undefined = resolvedCustomerAddress
    if (resolvedCustomerId) {
      const customer = await Customer.findById(resolvedCustomerId)
      if (customer) {
        customerName = customer.name
        customerAddress = customer.address || customerAddress
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
      customerAddress,
      customerMatricule: resolvedCustomerMatricule,
      lines: saleLines,
      totalHT,
      totalTVA,
      timbreFiscal,
      totalTTC,
      amountPaid,
      amountDue,
      ...billingDetails,
      includeTva
    }

    if (amountDue > 0 && !forceInvoice) {
      const slipRef = await getNextReference('purchaseSlip', true)
      const purchaseSlip = await PurchaseSlip.create({
        reference: slipRef,
        documentType: 'purchase_slip',
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
      isPaid: amountDue <= 0
    })

    let deliveryNote = null
    if (amountDue <= 0) {
      deliveryNote = await createDeliveryNote({
      saleId: sale._id,
      invoiceId: invoice._id,
      customerId: resolvedCustomerId,
      customerName,
      customerAddress,
      lines: saleLines,
      includeTva,
      linkToInvoice: true,
      blNumber: billingDetails.blNumber || invoiceRef,
      bcNumber: billingDetails.bcNumber,
      pieceNumber: billingDetails.pieceNumber,
      representative: billingDetails.representative,
      deliveryPerson: billingDetails.deliveryPerson,
      ...deliveryDetails,
      validUntil: billingDetails.validUntil,
      amountPaid,
      amountDue: 0,
      isSettled: true
    })
    }

    sale.invoiceId = invoice._id
    if (deliveryNote) {
      sale.purchaseSlipId = deliveryNote._id
    }
    await sale.save()

    sendSuccess(res, { sale, invoice, deliveryNote, documentType: 'invoice' }, 201)
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
      if (!line.productId) continue
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
  sendSuccess(res, invoice.toObject())
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

router.delete('/invoices/:id', asyncHandler(async (req, res) => {
  const invoice = await Invoice.findByIdAndDelete(req.params.id)
  if (!invoice) {
    sendError(res, 'Facture introuvable', 404)
    return
  }
  sendSuccess(res, { message: 'Facture supprimée' })
}))

router.get('/purchase-slips', asyncHandler(async (req, res) => {
  const { page = '1', limit = '20' } = req.query
  const pageNum = parseInt(page as string, 10)
  const limitNum = parseInt(limit as string, 10)

  const [data, total] = await Promise.all([
    PurchaseSlip.find(purchaseSlipFilter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    PurchaseSlip.countDocuments(purchaseSlipFilter)
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

router.put('/purchase-slips/:id', asyncHandler(async (req, res) => {
  const body = req.body as {
    customerName?: string
    customerAddress?: string
    lines?: Array<{ designation: string; quantity: number; unitPrice: number; discount?: number; tva?: number; totalHT: number; totalTTC: number }>
    includeTva?: boolean
  }

  const slip = await PurchaseSlip.findById(req.params.id)
  if (!slip) {
    sendError(res, 'Bon d\'achat introuvable', 404)
    return
  }

  if (body.customerName !== undefined) slip.customerName = body.customerName.trim()
  if (body.customerAddress !== undefined) slip.customerAddress = body.customerAddress?.trim()
  if (body.includeTva !== undefined) slip.includeTva = body.includeTva
  
  if (body.lines?.length) {
    const totals = buildDocumentTotals(body.lines, { includeTva: body.includeTva ?? slip.includeTva, timbreFiscal: 0 })
    slip.lines = body.lines.map((line) => ({
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
    slip.totalHT = totals.totalHT
    slip.totalTVA = totals.totalTVA
    slip.totalTTC = totals.totalTTC
    
    const payment = resolveSalePayment(slip.totalTTC, slip.amountPaid || 0)
    slip.amountDue = payment.amountDue
  }

  await slip.save()
  sendSuccess(res, slip)
}))

router.delete('/purchase-slips/:id', asyncHandler(async (req, res) => {
  const slip = await PurchaseSlip.findByIdAndDelete(req.params.id)
  if (!slip) {
    sendError(res, 'Bon d\'achat introuvable', 404)
    return
  }
  sendSuccess(res, { message: 'Bon d\'achat supprimé' })
}))

export default router
