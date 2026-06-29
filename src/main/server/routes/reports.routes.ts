import { Router } from 'express'
import { Sale, Invoice, Product, PurchaseOrder, Customer } from '../../db/models'
import { attachActor } from '../middleware/context'
import { sendSuccess, asyncHandler } from '../middleware/response'
import { getDayBounds } from '@shared/utils'

const router = Router()
router.use(attachActor)

router.get('/dashboard', asyncHandler(async (_req, res) => {
  const { start, end } = getDayBounds()

  const todaySales = await Sale.find({
    isCancelled: false,
    createdAt: { $gte: start, $lte: end }
  })

  const todayRevenue = todaySales.reduce((sum, s) => sum + s.totalTTC, 0)

  const productIds = todaySales.flatMap((s) => s.lines.map((l) => l.productId))
  const products = await Product.find({ _id: { $in: productIds } }).lean()
  const productMap = new Map(products.map((p) => [p._id.toString(), p]))

  let profit = 0
  for (const sale of todaySales) {
    for (const line of sale.lines) {
      const product = productMap.get(line.productId.toString())
      if (product) {
        profit += line.totalHT! - product.purchasePrice * line.quantity
      }
    }
  }

  const todayInvoices = await Invoice.countDocuments({ createdAt: { $gte: start, $lte: end } })
  const lowStockCount = await Product.countDocuments({
    isDeleted: false,
    $expr: { $lte: ['$stock', '$minStock'] }
  })

  const recentPurchases = await PurchaseOrder.find()
    .populate('supplierId', 'companyName')
    .sort({ createdAt: -1 })
    .limit(5)

  const recentCustomers = await Customer.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(5)

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const monthlySalesData = await Sale.aggregate([
    { $match: { isCancelled: false, createdAt: { $gte: sixMonthsAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        revenue: { $sum: '$totalTTC' },
        profit: { $sum: '$totalHT' }
      }
    },
    { $sort: { _id: 1 } }
  ])

  const topProducts = await Sale.aggregate([
    { $match: { isCancelled: false } },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.productId',
        designation: { $first: '$lines.designation' },
        quantity: { $sum: '$lines.quantity' },
        revenue: { $sum: '$lines.totalTTC' }
      }
    },
    { $sort: { quantity: -1 } },
    { $limit: 10 }
  ])

  sendSuccess(res, {
    todayRevenue: Math.round(todayRevenue * 1000) / 1000,
    todaySales: todaySales.length,
    todayProfit: Math.round(profit * 1000) / 1000,
    todayInvoices,
    lowStockCount,
    recentPurchases,
    recentCustomers,
    topProducts: topProducts.map((p) => ({
      productId: p._id,
      designation: p.designation,
      quantity: p.quantity,
      revenue: p.revenue
    })),
    monthlySales: monthlySalesData.map((m) => ({
      month: m._id,
      revenue: m.revenue,
      profit: m.profit
    }))
  })
}))

router.get('/reports/sales', asyncHandler(async (req, res) => {
  const { period = 'month', year, month } = req.query
  const filter: Record<string, unknown> = { isCancelled: false }

  if (period === 'day' && year && month) {
    const d = new Date(Number(year), Number(month) - 1, 1)
    const { start, end } = getDayBounds(d)
    filter.createdAt = { $gte: start, $lte: end }
  } else if (period === 'month' && year && month) {
    const start = new Date(Number(year), Number(month) - 1, 1)
    const end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999)
    filter.createdAt = { $gte: start, $lte: end }
  } else if (period === 'year' && year) {
    const start = new Date(Number(year), 0, 1)
    const end = new Date(Number(year), 11, 31, 23, 59, 59, 999)
    filter.createdAt = { $gte: start, $lte: end }
  }

  const sales = await Sale.find(filter).sort({ createdAt: -1 })
  const totalRevenue = sales.reduce((sum, s) => sum + s.totalTTC, 0)
  const totalHT = sales.reduce((sum, s) => sum + s.totalHT, 0)

  sendSuccess(res, { sales, totalRevenue, totalHT, count: sales.length })
}))

router.get('/reports/top-products', asyncHandler(async (req, res) => {
  const { limit = '10' } = req.query
  const top = await Sale.aggregate([
    { $match: { isCancelled: false } },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.productId',
        designation: { $first: '$lines.designation' },
        reference: { $first: '$lines.reference' },
        quantity: { $sum: '$lines.quantity' },
        revenue: { $sum: '$lines.totalTTC' }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: parseInt(limit as string, 10) }
  ])

  sendSuccess(res, top)
}))

router.get('/reports/top-customers', asyncHandler(async (_req, res) => {
  const top = await Customer.find({ isDeleted: false })
    .sort({ totalPurchases: -1 })
    .limit(10)
    .select('name reference totalPurchases creditBalance')
  sendSuccess(res, top)
}))

router.get('/reports/top-suppliers', asyncHandler(async (_req, res) => {
  const top = await PurchaseOrder.aggregate([
    { $group: { _id: '$supplierId', count: { $sum: 1 }, total: { $sum: '$totalHT' } } },
    { $sort: { total: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'suppliers',
        localField: '_id',
        foreignField: '_id',
        as: 'supplier'
      }
    },
    { $unwind: '$supplier' }
  ])
  sendSuccess(res, top)
}))

router.get('/reports/profit', asyncHandler(async (req, res) => {
  const { year, month } = req.query
  const filter: Record<string, unknown> = { isCancelled: false }

  if (year && month) {
    const start = new Date(Number(year), Number(month) - 1, 1)
    const end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999)
    filter.createdAt = { $gte: start, $lte: end }
  }

  const sales = await Sale.find(filter)
  const productIds = [...new Set(sales.flatMap((s) => s.lines.map((l) => l.productId.toString())))]
  const products = await Product.find({ _id: { $in: productIds } })
  const productMap = new Map(products.map((p) => [p._id.toString(), p]))

  let revenue = 0
  let cost = 0
  for (const sale of sales) {
    revenue += sale.totalTTC
    for (const line of sale.lines) {
      const product = productMap.get(line.productId.toString())
      if (product) cost += product.purchasePrice * line.quantity
    }
  }

  sendSuccess(res, {
    revenue: Math.round(revenue * 1000) / 1000,
    cost: Math.round(cost * 1000) / 1000,
    profit: Math.round((revenue - cost) * 1000) / 1000
  })
}))

export default router
