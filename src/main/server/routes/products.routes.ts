import { Router } from 'express'
import { Product, Category, SubCategory } from '../../db/models'
import { attachActor, getActorId } from '../middleware/context'
import { sendSuccess, sendError, handleZodError, asyncHandler } from '../middleware/response'
import { productSchema, categorySchema, subCategorySchema } from '@shared/validation/schemas'
import { getNextProductReference } from '../../services/reference.service'
import { calculateSalePrice } from '@shared/utils'
import { logAudit } from '../../services/audit.service'
import * as XLSX from 'xlsx'

const router = Router()
router.use(attachActor)

router.get('/products', asyncHandler(async (req, res) => {
  const { search, page = '1', limit = '50', categoryId, supplierId, lowStock } = req.query
  const pageNum = parseInt(page as string, 10)
  const limitNum = parseInt(limit as string, 10)
  const filter: Record<string, unknown> = { isDeleted: false }

  if (search) {
    filter.$or = [
      { designation: { $regex: search, $options: 'i' } },
      { reference: { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } }
    ]
  }
  if (categoryId) filter.categoryId = categoryId
  if (supplierId) filter.supplierId = supplierId
  if (lowStock === 'true') {
    filter.$expr = { $lte: ['$stock', '$minStock'] }
  }

  const [data, total] = await Promise.all([
    Product.find(filter)
      .populate('categoryId', 'name prefix')
      .populate('supplierId', 'companyName')
      .sort({ designation: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Product.countDocuments(filter)
  ])

  sendSuccess(res, { data, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) })
}))

router.get('/products/export/excel', asyncHandler(async (_req, res) => {
  const products = await Product.find({ isDeleted: false }).lean()
  const rows = products.map((p) => ({
    Référence: p.reference,
    'Code-barres': p.barcode || '',
    Désignation: p.designation,
    'Prix achat': p.purchasePrice,
    'Prix vente': p.salePrice,
    TVA: p.tva,
    Stock: p.stock,
    'Stock min': p.minStock,
    Unité: p.unit
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Produits')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename=produits.xlsx')
  res.send(buffer)
}))

router.get('/products/barcode/:barcode', asyncHandler(async (req, res) => {
  const product = await Product.findOne({ barcode: req.params.barcode, isDeleted: false })
  if (!product) {
    sendError(res, 'Produit introuvable', 404)
    return
  }
  sendSuccess(res, product)
}))

router.get('/products/:id', asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false })
    .populate('categoryId', 'name prefix')
    .populate('subCategoryId', 'name')
    .populate('supplierId', 'companyName')
  if (!product) {
    sendError(res, 'Produit introuvable', 404)
    return
  }
  sendSuccess(res, product)
}))

router.post('/products', asyncHandler(async (req, res) => {
  const parsed = productSchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }

  const categoryId = parsed.data.categoryId
  if (!categoryId) {
    sendError(res, 'Catégorie requise pour générer la référence', 400)
    return
  }

  // Génération automatique de la référence basée sur la catégorie
  const reference = await getNextProductReference(categoryId)

  // Calculate salePrice from purchasePrice + profitMargin if not provided directly
  const productData = { ...parsed.data, reference }
  if (!productData.salePrice && productData.purchasePrice > 0 && productData.profitMargin) {
    productData.salePrice = calculateSalePrice(productData.purchasePrice, productData.profitMargin)
  } else if (!productData.salePrice) {
    productData.salePrice = productData.purchasePrice
  }

  const product = await Product.create(productData)

  await logAudit({
    userId: getActorId(req),
    username: 'system',
    action: 'create',
    targetCollection: 'products',
    documentId: product._id.toString(),
    newValue: product.toObject()
  })

  sendSuccess(res, product, 201)
}))

router.put('/products/:id', asyncHandler(async (req, res) => {
  const parsed = productSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }

  const productId = String(req.params.id)
  const old = await Product.findById(productId)
  if (!old || old.isDeleted) {
    sendError(res, 'Produit introuvable', 404)
    return
  }

  // Empêcher la modification de la référence
  if (parsed.data.reference && parsed.data.reference !== old.reference) {
    sendError(res, 'La référence ne peut pas être modifiée', 400)
    return
  }

  // Si la catégorie change, la référence doit être régénérée
  const updateData = { ...parsed.data }

  // Recalculate salePrice if profitMargin or purchasePrice changed
  if (
    updateData.profitMargin !== undefined &&
    (updateData.purchasePrice !== undefined || updateData.profitMargin !== undefined) &&
    updateData.salePrice === undefined
  ) {
    const pp = updateData.purchasePrice ?? old.purchasePrice
    updateData.salePrice = calculateSalePrice(pp, updateData.profitMargin ?? old.profitMargin)
  } else if (updateData.purchasePrice !== undefined && updateData.profitMargin === undefined && updateData.salePrice === undefined) {
    updateData.salePrice = calculateSalePrice(updateData.purchasePrice, old.profitMargin)
  }
  const newCategoryId = updateData.categoryId ? String(updateData.categoryId) : undefined
  if (newCategoryId && newCategoryId !== old.categoryId?.toString()) {
    const newRef = await getNextProductReference(newCategoryId)
    updateData.reference = newRef
    updateData.categoryId = newCategoryId
  }

  const product = await Product.findByIdAndUpdate(productId, updateData, { new: true })

  await logAudit({
    userId: getActorId(req),
    username: 'system',
    action: 'update',
    targetCollection: 'products',
    documentId: productId,
    oldValue: old.toObject(),
    newValue: product!.toObject()
  })

  sendSuccess(res, product)
}))

router.delete('/products/:id', asyncHandler(async (req, res) => {
  const productId = String(req.params.id)
  const old = await Product.findById(productId)
  if (!old) {
    sendError(res, 'Produit introuvable', 404)
    return
  }

  await Product.findByIdAndUpdate(productId, { isDeleted: true })

  await logAudit({
    userId: getActorId(req),
    username: 'system',
    action: 'delete',
    targetCollection: 'products',
    documentId: productId,
    oldValue: old.toObject()
  })

  sendSuccess(res, { message: 'Produit supprimé' })
}))

router.post('/products/import', asyncHandler(async (req, res) => {
  const { rows } = req.body as { rows: Record<string, unknown>[] }
  if (!rows?.length) {
    sendError(res, 'Fichier vide', 400)
    return
  }

  let imported = 0
  for (const row of rows) {
    // Try to find a category by name or prefix from the import row
    const categoryName = String(row.catégorie || row.Catégorie || row.category || '')
    let categoryId = row.categoryId as string | undefined

    if (!categoryId && categoryName) {
      const cat = await Category.findOne({
        $or: [
          { name: { $regex: `^${categoryName}$`, $options: 'i' } },
          { prefix: { $regex: `^${categoryName}$`, $options: 'i' } }
        ]
      })
      if (cat) categoryId = cat._id.toString()
    }

    // Fallback to first category if none found
    if (!categoryId) {
      const firstCat = await Category.findOne()
      if (firstCat) categoryId = firstCat._id.toString()
      else continue // No categories exist, skip
    }

    const reference = await getNextProductReference(categoryId!)
    await Product.create({
      reference,
      categoryId,
      designation: String(row.designation || row.Désignation || ''),
      barcode: row.barcode || row['Code-barres'] ? String(row.barcode || row['Code-barres']) : undefined,
      purchasePrice: Number(row.purchasePrice || row['Prix achat'] || 0),
      salePrice: Number(row.salePrice || row['Prix vente'] || 0),
      tva: Number(row.tva || row.TVA || 19),
      stock: Number(row.stock || row.Stock || 0),
      minStock: Number(row.minStock || row['Stock min'] || 0),
      unit: String(row.unit || row.Unité || 'pièce')
    })
    imported++
  }

  sendSuccess(res, { imported })
}))

router.get('/categories', asyncHandler(async (_req, res) => {
  const categories = await Category.find().sort({ name: 1 })
  sendSuccess(res, categories)
}))

router.post('/categories', asyncHandler(async (req, res) => {
  const parsed = categorySchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }
  const category = await Category.create(parsed.data)
  sendSuccess(res, category, 201)
}))

router.put('/categories/:id', asyncHandler(async (req, res) => {
  const parsed = categorySchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }
  const category = await Category.findByIdAndUpdate(req.params.id, parsed.data, { new: true })
  sendSuccess(res, category)
}))

router.delete('/categories/:id', asyncHandler(async (req, res) => {
  await Category.findByIdAndDelete(req.params.id)
  await SubCategory.deleteMany({ categoryId: req.params.id })
  sendSuccess(res, { message: 'Catégorie supprimée' })
}))

router.get('/subcategories', asyncHandler(async (req, res) => {
  const filter = req.query.categoryId ? { categoryId: req.query.categoryId } : {}
  const subcategories = await SubCategory.find(filter).populate('categoryId', 'name').sort({ name: 1 })
  sendSuccess(res, subcategories)
}))

router.post('/subcategories', asyncHandler(async (req, res) => {
  const parsed = subCategorySchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }
  const sub = await SubCategory.create(parsed.data)
  sendSuccess(res, sub, 201)
}))

router.put('/subcategories/:id', asyncHandler(async (req, res) => {
  const parsed = subCategorySchema.safeParse(req.body)
  if (!parsed.success) {
    handleZodError(res, parsed.error)
    return
  }
  const sub = await SubCategory.findByIdAndUpdate(req.params.id, parsed.data, { new: true })
  sendSuccess(res, sub)
}))

router.delete('/subcategories/:id', asyncHandler(async (req, res) => {
  await SubCategory.findByIdAndDelete(req.params.id)
  sendSuccess(res, { message: 'Sous-catégorie supprimée' })
}))

export default router