import { Router } from 'express'
import { Product, StockMovement, InventoryAdjustment } from '../../db/models'
import { attachActor, getActorId } from '../middleware/context'
import { sendSuccess, sendError, asyncHandler } from '../middleware/response'
import { getNextReference } from '../../services/reference.service'

const router = Router()
router.use(attachActor)

router.get('/stock/movements', asyncHandler(async (req, res) => {
  const { productId, page = '1', limit = '50' } = req.query
  const pageNum = parseInt(page as string, 10)
  const limitNum = parseInt(limit as string, 10)
  const filter: Record<string, unknown> = {}
  if (productId) filter.productId = productId

  const [data, total] = await Promise.all([
    StockMovement.find(filter)
      .populate('productId', 'reference designation')
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    StockMovement.countDocuments(filter)
  ])

  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) })
}))

router.get('/stock/valuation', asyncHandler(async (_req, res) => {
  const products = await Product.find({ isDeleted: false })
  const currentStock = products.reduce((sum, p) => sum + p.stock, 0)
  const lowStock = products.filter((p) => p.stock <= p.minStock)

  sendSuccess(res, {
    totalProducts: products.length,
    currentStock,
    restockCount: lowStock.length,
    lowStockProducts: lowStock.map((p) => ({
      _id: p._id,
      designation: p.designation,
      stock: p.stock,
      minStock: p.minStock,
      purchasePrice: p.purchasePrice,
      supplierId: p.supplierId
    }))
  })
}))

router.get('/stock/alerts', asyncHandler(async (_req, res) => {
  const products = await Product.find({
    isDeleted: false,
    $expr: { $lte: ['$stock', '$minStock'] }
  }).sort({ stock: 1 })
  sendSuccess(res, products)
}))

router.post('/stock/adjust', asyncHandler(async (req, res) => {
  const { productId, quantity, notes } = req.body
  const product = await Product.findById(productId)
  if (!product) {
    sendError(res, 'Produit introuvable', 404)
    return
  }

  const stockBefore = product.stock
  product.stock = quantity
  await product.save()

  const diff = quantity - stockBefore
  await StockMovement.create({
    productId: product._id,
    type: diff >= 0 ? 'in' : 'out',
    reason: 'correction',
    quantity: Math.abs(diff),
    stockBefore,
    stockAfter: product.stock,
    notes,
    createdBy: getActorId(req)
  })

  sendSuccess(res, product)
}))

router.post('/inventory', asyncHandler(async (req, res) => {
  const { lines, notes } = req.body as {
    lines: { productId: string; actualStock: number }[]
    notes?: string
  }

  const reference = await getNextReference('inventory')
  const adjustmentLines: Array<{
    productId: string
    designation: string
    theoreticalStock: number
    actualStock: number
    difference: number
  }> = []

  // Stocker les produits modifiés pour rollback
  const updatedProducts: { productId: string; stockBefore: number }[] = []

  try {
    for (const line of lines) {
      const product = await Product.findById(line.productId)
      if (!product) continue

      const theoreticalStock = product.stock
      const difference = line.actualStock - theoreticalStock

      adjustmentLines.push({
        productId: product._id.toString(),
        designation: product.designation,
        theoreticalStock,
        actualStock: line.actualStock,
        difference
      })

      if (difference !== 0) {
        const stockBefore = product.stock
        product.stock = line.actualStock
        await product.save()
        updatedProducts.push({ productId: product._id.toString(), stockBefore })

        await StockMovement.create({
          productId: product._id,
          type: difference > 0 ? 'in' : 'out',
          reason: 'inventaire',
          quantity: Math.abs(difference),
          stockBefore,
          stockAfter: product.stock,
          reference,
          createdBy: getActorId(req)
        })
      }
    }

    const adjustment = await InventoryAdjustment.create({
      reference,
      lines: adjustmentLines,
      notes,
      createdBy: getActorId(req)
    })

    sendSuccess(res, adjustment, 201)
  } catch (err) {
    // Rollback manuel
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

router.get('/inventory', asyncHandler(async (req, res) => {
  const { page = '1', limit = '20' } = req.query
  const pageNum = parseInt(page as string, 10)
  const limitNum = parseInt(limit as string, 10)

  const [data, total] = await Promise.all([
    InventoryAdjustment.find()
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    InventoryAdjustment.countDocuments()
  ])

  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) })
}))

export default router
