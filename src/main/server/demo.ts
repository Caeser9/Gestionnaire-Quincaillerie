import { app as electronApp } from 'electron'
import express, { type Express, type Request, type Response } from 'express'
import cors from 'cors'
import fs from 'fs/promises'
import path from 'path'
import { DEFAULT_PORT, DEFAULT_SETTINGS, TIMBRE_FISCAL_AMOUNT } from '@shared/constants'
import { roundMoney, applyDiscount } from '@shared/utils'

interface DemoCategory {
  _id: string
  name: string
  prefix: string
}

interface DemoSupplier {
  _id: string
  companyName: string
  phone?: string
  email?: string
  address?: string
}

interface DemoCustomer {
  _id: string
  reference: string
  name: string
  phone?: string
  balance?: number
}

interface DemoProduct {
  _id: string
  reference: string
  designation: string
  barcode?: string
  categoryId: DemoCategory | string
  supplierId?: string | DemoSupplier
  brand?: string
  purchasePrice: number
  salePrice: number
  profitMargin: number
  discount: number
  tva: number
  stock: number
  minStock: number
  unit: string
  location?: string
}

interface DemoSaleLine {
  productId: string
  reference: string
  designation: string
  quantity: number
  unitPrice: number
  discount: number
  totalHT: number
  totalTTC: number
}

interface DemoDocument {
  _id: string
  reference: string
  customerId?: string
  customerName?: string
  lines: DemoSaleLine[]
  totalHT: number
  totalTTC: number
  paidAmount: number
  amountDue: number
  paymentMethod: string
  status: string
  createdAt: string
}

interface DemoDb {
  settings: typeof DEFAULT_SETTINGS
  categories: DemoCategory[]
  suppliers: DemoSupplier[]
  customers: DemoCustomer[]
  products: DemoProduct[]
  invoices: DemoDocument[]
  purchaseSlips: DemoDocument[]
  purchaseOrders: Array<Record<string, unknown>>
  stockMovements: Array<Record<string, unknown>>
  expenses: Array<Record<string, unknown>>
  counters: Record<string, number>
}

let serverPort = DEFAULT_PORT
let dbCache: DemoDb | null = null

function demoDataPath(): string {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
  return path.join(portableDir || electronApp.getPath('userData'), 'demo-data.json')
}

function nowIso(): string {
  return new Date().toISOString()
}

function monthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7)
}

function nextCounter(db: DemoDb, key: string): number {
  db.counters[key] = (db.counters[key] || 0) + 1
  return db.counters[key]
}

function makeId(prefix: string, db: DemoDb): string {
  return `${prefix}-${String(nextCounter(db, prefix)).padStart(6, '0')}`
}

function seedDb(): DemoDb {
  const categories: DemoCategory[] = [
    { _id: 'cat-electricite', name: 'Electricite', prefix: 'ELE' },
    { _id: 'cat-plomberie', name: 'Plomberie', prefix: 'PLB' },
    { _id: 'cat-outillage', name: 'Outillage', prefix: 'OUT' },
    { _id: 'cat-peinture', name: 'Peinture', prefix: 'PEI' }
  ]

  const suppliers: DemoSupplier[] = [
    { _id: 'sup-001', companyName: 'Comptoir General', phone: '71111222' },
    { _id: 'sup-002', companyName: 'Tunisie Outillage', phone: '72222333' }
  ]

  const customers: DemoCustomer[] = [
    { _id: 'cus-001', reference: 'CLI-000001', name: 'hamadi', phone: '29665911', balance: 0 },
    { _id: 'cus-002', reference: 'CLI-000002', name: 'Kaycer Khouini', phone: '29665911', balance: 0 },
    { _id: 'cus-003', reference: 'CLI-000003', name: 'Abdelkader', phone: '22000111', balance: 0 }
  ]

  const products: DemoProduct[] = [
    { _id: 'prd-001', reference: 'ELE000001', designation: 'Carte Arduino', barcode: '6190000000010', categoryId: categories[0], supplierId: suppliers[0], purchasePrice: 18, salePrice: 30, profitMargin: 66.67, discount: 0, tva: 19, stock: 100, minStock: 5, unit: 'piece', location: 'A1' },
    { _id: 'prd-002', reference: 'OUT000002', designation: 'test', barcode: '6190000000027', categoryId: categories[2], supplierId: suppliers[1], purchasePrice: 10, salePrice: 15, profitMargin: 50, discount: 0, tva: 19, stock: 40, minStock: 5, unit: 'piece', location: 'B2' },
    { _id: 'prd-003', reference: 'ELE000003', designation: 'fil rigide 1.5mm', barcode: '6190000000034', categoryId: categories[0], supplierId: suppliers[0], purchasePrice: 0.7, salePrice: 1.2, profitMargin: 71.43, discount: 0, tva: 19, stock: 29, minStock: 10, unit: 'm', location: 'C1' },
    { _id: 'prd-004', reference: 'PLB000004', designation: 'Semant', barcode: '6190000000041', categoryId: categories[1], supplierId: suppliers[0], purchasePrice: 7, salePrice: 11.5, profitMargin: 64.29, discount: 0, tva: 19, stock: 1, minStock: 3, unit: 'sac', location: 'D1' },
    { _id: 'prd-005', reference: 'OUT000005', designation: 'Marteau 500g', barcode: '6190000000058', categoryId: categories[2], supplierId: suppliers[1], purchasePrice: 12, salePrice: 19.9, profitMargin: 65.83, discount: 0, tva: 19, stock: 18, minStock: 4, unit: 'piece', location: 'B1' },
    { _id: 'prd-006', reference: 'PEI000006', designation: 'Peinture blanche 5L', barcode: '6190000000065', categoryId: categories[3], supplierId: suppliers[0], purchasePrice: 22, salePrice: 34.5, profitMargin: 56.82, discount: 0, tva: 19, stock: 12, minStock: 3, unit: 'L', location: 'P1' }
  ]

  return {
    settings: { ...DEFAULT_SETTINGS, companyName: 'Quincaillerie Demo', companyPhone: '29665911' },
    categories,
    suppliers,
    customers,
    products,
    invoices: [],
    purchaseSlips: [],
    purchaseOrders: [
      { _id: 'po-001', reference: 'BC-2026-000012', supplierId: suppliers[0], status: 'received', totalTTC: 420, createdAt: '2026-06-30T09:10:00.000Z' },
      { _id: 'po-002', reference: 'BC-2026-000011', supplierId: suppliers[1], status: 'received', totalTTC: 360, createdAt: '2026-06-30T08:20:00.000Z' },
      { _id: 'po-003', reference: 'BC-2026-000010', supplierId: suppliers[0], status: 'received', totalTTC: 250, createdAt: '2026-06-29T15:30:00.000Z' }
    ],
    stockMovements: [],
    expenses: [],
    counters: { PRD: 6, CLI: 3, FAC: 0, BA: 0, sale: 0, movement: 0, supplier: 2, purchaseOrder: 12 }
  }
}

async function loadDb(): Promise<DemoDb> {
  if (dbCache) return dbCache
  const file = demoDataPath()
  try {
    const raw = await fs.readFile(file, 'utf8')
    dbCache = JSON.parse(raw) as DemoDb
  } catch {
    dbCache = seedDb()
    await saveDb(dbCache)
  }
  return dbCache
}

async function saveDb(db: DemoDb): Promise<void> {
  dbCache = db
  const file = demoDataPath()
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(db, null, 2), 'utf8')
}

function send<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data })
}

function page<T>(items: T[], req: Request): { data: T[]; total: number; page: number; limit: number; totalPages: number } {
  const current = Math.max(1, Number(req.query.page || 1))
  const limit = Math.max(1, Number(req.query.limit || items.length || 1))
  const start = (current - 1) * limit
  return {
    data: items.slice(start, start + limit),
    total: items.length,
    page: current,
    limit,
    totalPages: Math.max(1, Math.ceil(items.length / limit))
  }
}

function productCategory(product: DemoProduct, db: DemoDb): DemoCategory | undefined {
  const id = typeof product.categoryId === 'object' ? product.categoryId._id : product.categoryId
  return db.categories.find((category) => category._id === id)
}

function withProductRelations(product: DemoProduct, db: DemoDb): DemoProduct {
  const category = productCategory(product, db)
  const supplierId = typeof product.supplierId === 'object' ? product.supplierId._id : product.supplierId
  const supplier = db.suppliers.find((item) => item._id === supplierId)
  return { ...product, categoryId: category || product.categoryId, supplierId: supplier || product.supplierId }
}

function filterSearch<T extends Record<string, unknown>>(items: T[], search?: unknown): T[] {
  const q = String(search || '').trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => JSON.stringify(item).toLowerCase().includes(q))
}

function documentList(db: DemoDb): DemoDocument[] {
  return [...db.invoices, ...db.purchaseSlips].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function createCustomer(db: DemoDb, body: Record<string, unknown>): Promise<DemoCustomer> {
  const name = String(body.name || body.companyName || '').trim() || 'Client Demo'
  const existing = db.customers.find((customer) => customer.name.toLowerCase() === name.toLowerCase())
  if (existing) return existing
  const customer: DemoCustomer = {
    _id: makeId('CLI', db),
    reference: `CLI-${String(db.counters.CLI).padStart(6, '0')}`,
    name,
    phone: String(body.phone || ''),
    balance: 0
  }
  db.customers.unshift(customer)
  await saveDb(db)
  return customer
}

function computeSale(db: DemoDb, body: Record<string, unknown>): { lines: DemoSaleLine[]; totalHT: number; totalTTC: number; paidAmount: number; amountDue: number } {
  const linesInput = Array.isArray(body.lines) ? body.lines as Array<Record<string, unknown>> : []
  const includeTva = Boolean(body.includeTva)
  const lines: DemoSaleLine[] = linesInput.map((line) => {
    const isCustom =
      line.isCustom === true ||
      String(line.productId || '').startsWith('custom-') ||
      (line.productId && !/^[a-f\d]{24}$/i.test(String(line.productId)))

    if (isCustom) {
      const quantity = Math.max(1, Number(line.quantity || 1))
      const unitPrice = Math.max(0, Number(line.unitPrice || 0))
      const discount = Math.max(0, Number(line.discount || 0))
      const tva = Number(line.tva ?? 19)
      const totalHT = roundMoney(applyDiscount(unitPrice * quantity, discount))
      const totalTTC = roundMoney(totalHT + (includeTva ? totalHT * (tva / 100) : 0))
      return {
        reference: String(line.reference || 'DIV'),
        designation: String(line.designation || 'Article divers'),
        quantity,
        unitPrice,
        discount,
        totalHT,
        totalTTC
      }
    }

    const product = db.products.find((item) => item._id === line.productId)
    if (!product) throw new Error('Produit demo introuvable')
    const quantity = Math.max(1, Number(line.quantity || 1))
    const discount = Math.max(0, Number(line.discount || 0))
    const totalHT = roundMoney(applyDiscount(product.salePrice * quantity, discount))
    const totalTTC = roundMoney(totalHT + (includeTva ? totalHT * (product.tva / 100) : 0))
    return {
      productId: product._id,
      reference: product.reference,
      designation: product.designation,
      quantity,
      unitPrice: product.salePrice,
      discount,
      totalHT,
      totalTTC
    }
  })

  const totalHT = roundMoney(lines.reduce((sum, line) => sum + line.totalHT, 0))
  const totalBeforeStamp = roundMoney(lines.reduce((sum, line) => sum + line.totalTTC, 0))
  const paymentMethod = String(body.paymentMethod || 'cash')
  const cashReceived = body.cashReceived === undefined ? totalBeforeStamp + TIMBRE_FISCAL_AMOUNT : Number(body.cashReceived)
  const paidAmount = paymentMethod === 'credit' ? 0 : Math.min(cashReceived, totalBeforeStamp + TIMBRE_FISCAL_AMOUNT)
  const amountDue = roundMoney(totalBeforeStamp + TIMBRE_FISCAL_AMOUNT - paidAmount)
  return { lines, totalHT, totalTTC: roundMoney(totalBeforeStamp + TIMBRE_FISCAL_AMOUNT), paidAmount, amountDue }
}

export function createDemoApp(): Express {
  const app = express()
  app.use(cors({ origin: true }))
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  app.get('/api/health', (_req, res) => send(res, { status: 'ok', mode: 'demo', port: serverPort, dataFile: demoDataPath() }))
  app.get('/api', (_req, res) => send(res, { name: 'Gestionnaire Quincaillerie Demo API', version: '1.0.0' }))

  app.get('/api/settings', async (_req, res) => send(res, (await loadDb()).settings))
  app.put('/api/settings', async (req, res) => {
    const db = await loadDb()
    db.settings = { ...db.settings, ...req.body }
    await saveDb(db)
    send(res, db.settings)
  })

  app.get('/api/dashboard', async (_req, res) => {
    const db = await loadDb()
    const docs = documentList(db)
    const currentMonth = monthKey()
    const today = new Date().toISOString().slice(0, 10)
    const todayDocs = docs.filter((doc) => doc.createdAt.startsWith(today))
    const monthDocs = docs.filter((doc) => doc.createdAt.startsWith(currentMonth))
    const top = new Map<string, { productId: string; designation: string; quantity: number; revenue: number }>()
    for (const doc of docs) {
      for (const line of doc.lines) {
        const current = top.get(line.productId) || { productId: line.productId, designation: line.designation, quantity: 0, revenue: 0 }
        current.quantity += line.quantity
        current.revenue += line.totalTTC
        top.set(line.productId, current)
      }
    }
    const fallbackTop = db.products.slice(0, 5).map((product) => ({ productId: product._id, designation: product.designation, quantity: product.stock, revenue: product.salePrice * product.stock }))
    send(res, {
      todayRevenue: roundMoney(todayDocs.reduce((sum, doc) => sum + doc.totalTTC, 0)),
      todaySales: todayDocs.length,
      todayProfit: roundMoney(todayDocs.reduce((sum, doc) => sum + doc.totalHT * 0.35, 0)),
      todayInvoices: todayDocs.filter((doc) => doc.reference.startsWith('FAC')).length,
      lowStockCount: db.products.filter((product) => product.stock <= product.minStock).length,
      recentPurchases: db.purchaseOrders.slice(0, 3),
      recentCustomers: db.customers.slice(0, 3),
      topProducts: [...top.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5).concat(top.size ? [] : fallbackTop),
      monthlySales: [{ month: currentMonth, revenue: roundMoney(monthDocs.reduce((sum, doc) => sum + doc.totalTTC, 0) || 7600), profit: roundMoney(monthDocs.reduce((sum, doc) => sum + doc.totalHT * 0.35, 0) || 6700) }]
    })
  })

  app.get('/api/categories', async (_req, res) => send(res, (await loadDb()).categories))
  app.get('/api/subcategories', (_req, res) => send(res, []))

  app.get('/api/products/export/excel', async (_req, res) => {
    const db = await loadDb()
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename=produits-demo.csv')
    res.send(['reference,designation,stock,prix', ...db.products.map((p) => `${p.reference},${p.designation},${p.stock},${p.salePrice}`)].join('\n'))
  })

  app.get('/api/products/barcode/:code', async (req, res) => {
    const db = await loadDb()
    const product = db.products.find((item) => item.barcode === req.params.code || item.reference === req.params.code)
    if (!product) return res.status(404).json({ success: false, error: { message: 'Produit demo introuvable' } })
    send(res, withProductRelations(product, db))
  })

  app.get('/api/products', async (req, res) => {
    const db = await loadDb()
    const categoryId = String(req.query.categoryId || '')
    let products = db.products.map((product) => withProductRelations(product, db))
    if (categoryId) products = products.filter((product) => (typeof product.categoryId === 'object' ? product.categoryId._id : product.categoryId) === categoryId)
    send(res, page(filterSearch(products, req.query.search), req))
  })

  app.post('/api/products', async (req, res) => {
    const db = await loadDb()
    const category = db.categories.find((item) => item._id === req.body.categoryId) || db.categories[0]
    const product: DemoProduct = {
      _id: makeId('PRD', db),
      reference: `${category.prefix}${String(db.counters.PRD).padStart(6, '0')}`,
      designation: String(req.body.designation || 'Produit demo'),
      barcode: String(req.body.barcode || ''),
      categoryId: category,
      supplierId: req.body.supplierId,
      brand: String(req.body.brand || ''),
      purchasePrice: Number(req.body.purchasePrice || 0),
      salePrice: roundMoney(Number(req.body.purchasePrice || 0) * (1 + Number(req.body.profitMargin || 25) / 100)),
      profitMargin: Number(req.body.profitMargin || 25),
      discount: Number(req.body.discount || 0),
      tva: Number(req.body.tva || 19),
      stock: Number(req.body.stock || 0),
      minStock: Number(req.body.minStock || 0),
      unit: String(req.body.unit || 'piece'),
      location: String(req.body.location || '')
    }
    db.products.unshift(product)
    await saveDb(db)
    send(res, withProductRelations(product, db), 201)
  })

  app.put('/api/products/:id', async (req, res) => {
    const db = await loadDb()
    const index = db.products.findIndex((item) => item._id === req.params.id)
    if (index === -1) return res.status(404).json({ success: false, error: { message: 'Produit demo introuvable' } })
    const category = db.categories.find((item) => item._id === req.body.categoryId) || productCategory(db.products[index], db) || db.categories[0]
    db.products[index] = { ...db.products[index], ...req.body, categoryId: category, salePrice: roundMoney(Number(req.body.purchasePrice ?? db.products[index].purchasePrice) * (1 + Number(req.body.profitMargin ?? db.products[index].profitMargin) / 100)) }
    await saveDb(db)
    send(res, withProductRelations(db.products[index], db))
  })

  app.delete('/api/products/:id', async (req, res) => {
    const db = await loadDb()
    db.products = db.products.filter((item) => item._id !== req.params.id)
    await saveDb(db)
    send(res, { deleted: true })
  })

  app.get('/api/customers/credits/open', async (_req, res) => {
    const db = await loadDb()
    send(res, db.customers.filter((customer) => (customer.balance || 0) > 0).map((customer) => ({ customer, balance: customer.balance || 0 })))
  })
  app.get('/api/customers', async (req, res) => send(res, page(filterSearch((await loadDb()).customers, req.query.search), req)))
  app.post('/api/customers/quick', async (req, res) => send(res, { ...(await createCustomer(await loadDb(), req.body)), created: true }, 201))
  app.post('/api/customers', async (req, res) => send(res, await createCustomer(await loadDb(), req.body), 201))
  app.put('/api/customers/:id', async (req, res) => {
    const db = await loadDb()
    const customer = db.customers.find((item) => item._id === req.params.id)
    if (customer) Object.assign(customer, req.body)
    await saveDb(db)
    send(res, customer || null)
  })
  app.delete('/api/customers/:id', async (req, res) => {
    const db = await loadDb()
    db.customers = db.customers.filter((item) => item._id !== req.params.id)
    await saveDb(db)
    send(res, { deleted: true })
  })
  app.get('/api/customers/:id/tracking', async (req, res) => send(res, { customerId: req.params.id, rows: [], totalDebt: 0, totalPaid: 0 }))
  app.post('/api/customer-payments', (_req, res) => send(res, { paid: true }, 201))

  app.post('/api/sales', async (req, res) => {
    const db = await loadDb()
    const computed = computeSale(db, req.body)
    const documentType = computed.amountDue > 0 ? 'purchase_slip' : 'invoice'
    const key = documentType === 'invoice' ? 'FAC' : 'BA'
    const reference = `${key}-2026-${String(nextCounter(db, key)).padStart(6, '0')}`
    let customerName = String(req.body.customerName || '')
    let customerId = String(req.body.customerId || '')
    if (customerName && !customerId) {
      const customer = await createCustomer(db, { name: customerName })
      customerId = customer._id
      customerName = customer.name
    }
    const doc: DemoDocument = {
      _id: makeId('sale', db),
      reference,
      customerId: customerId || undefined,
      customerName: customerName || undefined,
      lines: computed.lines,
      totalHT: computed.totalHT,
      totalTTC: computed.totalTTC,
      paidAmount: computed.paidAmount,
      amountDue: computed.amountDue,
      paymentMethod: String(req.body.paymentMethod || 'cash'),
      status: computed.amountDue > 0 ? 'unpaid' : 'paid',
      createdAt: nowIso()
    }
    for (const line of computed.lines) {
      const product = db.products.find((item) => item._id === line.productId)
      if (!product) continue
      const before = product.stock
      product.stock = Math.max(0, product.stock - line.quantity)
      db.stockMovements.unshift({ _id: makeId('movement', db), createdAt: nowIso(), type: 'out', reason: 'vente', quantity: line.quantity, stockBefore: before, stockAfter: product.stock, productId: { designation: product.designation } })
    }
    if (documentType === 'invoice') db.invoices.unshift(doc)
    else db.purchaseSlips.unshift(doc)
    await saveDb(db)
    send(res, { documentType, invoice: documentType === 'invoice' ? doc : undefined, purchaseSlip: documentType === 'purchase_slip' ? doc : undefined }, 201)
  })

  app.get('/api/invoices', async (req, res) => send(res, page((await loadDb()).invoices, req)))
  app.get('/api/purchase-slips', async (req, res) => send(res, page((await loadDb()).purchaseSlips, req)))
  app.get('/api/invoices/:id', async (req, res) => send(res, (await loadDb()).invoices.find((item) => item._id === req.params.id) || null))
  app.get('/api/purchase-slips/:id', async (req, res) => send(res, (await loadDb()).purchaseSlips.find((item) => item._id === req.params.id) || null))
  app.get('/api/invoices/:id/receipt', (_req, res) => send(res, { data: Buffer.from('DEMO RECEIPT').toString('base64') }))
  app.get('/api/purchase-slips/:id/receipt', (_req, res) => send(res, { data: Buffer.from('DEMO RECEIPT').toString('base64') }))

  app.get('/api/stock/valuation', async (_req, res) => {
    const db = await loadDb()
    const lowStock = db.products.filter((p) => p.stock <= p.minStock)
    send(res, {
      totalProducts: db.products.length,
      currentStock: db.products.reduce((sum, p) => sum + p.stock, 0),
      restockCount: lowStock.length,
      lowStockProducts: lowStock
    })
  })
  app.get('/api/stock/alerts', async (_req, res) => {
    const db = await loadDb()
    send(res, db.products.filter((p) => p.stock <= p.minStock))
  })
  app.get('/api/stock/movements', async (req, res) => send(res, page((await loadDb()).stockMovements, req)))
  app.post('/api/stock/adjust', async (req, res) => {
    const db = await loadDb()
    const product = db.products.find((item) => item._id === req.body.productId)
    if (product) {
      const before = product.stock
      product.stock = Number(req.body.quantity || 0)
      db.stockMovements.unshift({ _id: makeId('movement', db), createdAt: nowIso(), type: product.stock >= before ? 'in' : 'out', reason: 'correction', quantity: Math.abs(product.stock - before), stockBefore: before, stockAfter: product.stock, productId: { designation: product.designation } })
    }
    await saveDb(db)
    send(res, product || null)
  })
  app.post('/api/inventory', (_req, res) => send(res, { saved: true }, 201))

  app.get('/api/suppliers', async (req, res) => send(res, page(filterSearch((await loadDb()).suppliers, req.query.search), req)))
  app.post('/api/suppliers', async (req, res) => {
    const db = await loadDb()
    const supplier: DemoSupplier = { _id: makeId('supplier', db), companyName: String(req.body.companyName || 'Fournisseur Demo'), phone: String(req.body.phone || '') }
    db.suppliers.unshift(supplier)
    await saveDb(db)
    send(res, supplier, 201)
  })
  app.put('/api/suppliers/:id', async (req, res) => {
    const db = await loadDb()
    const supplier = db.suppliers.find((item) => item._id === req.params.id)
    if (supplier) Object.assign(supplier, req.body)
    await saveDb(db)
    send(res, supplier || null)
  })
  app.delete('/api/suppliers/:id', async (req, res) => {
    const db = await loadDb()
    db.suppliers = db.suppliers.filter((item) => item._id !== req.params.id)
    await saveDb(db)
    send(res, { deleted: true })
  })
  app.get('/api/suppliers/:id/activity', async (req, res) => send(res, { supplierId: req.params.id, orders: [], payments: [], totalDue: 0 }))
  app.post('/api/supplier-payments', (_req, res) => send(res, { paid: true }, 201))

  app.get('/api/purchase-orders', async (req, res) => send(res, page((await loadDb()).purchaseOrders, req)))
  app.post('/api/purchase-orders', async (req, res) => {
    const db = await loadDb()
    const order = { _id: makeId('purchaseOrder', db), reference: `BC-2026-${String(db.counters.purchaseOrder).padStart(6, '0')}`, ...req.body, status: 'draft', createdAt: nowIso() }
    db.purchaseOrders.unshift(order)
    await saveDb(db)
    send(res, order, 201)
  })
  app.post('/api/purchase-orders/quick-receive', (_req, res) => send(res, { received: true }, 201))
  app.post('/api/purchase-orders/:id/receive', (_req, res) => send(res, { received: true }))
  app.post('/api/purchase-orders/:id/pay', (_req, res) => send(res, { paid: true }))
  app.post('/api/purchase-orders/:id/status', (_req, res) => send(res, { updated: true }))
  app.get('/api/supplier-invoices', (req, res) => send(res, page([], req)))

  app.get('/api/finance/summary', (_req, res) => send(res, { revenue: 0, expenses: 0, profit: 0, byCategory: [] }))
  app.post('/api/expenses', (_req, res) => send(res, { created: true }, 201))
  app.delete('/api/expenses/:id', (_req, res) => send(res, { deleted: true }))
  app.get('/api/reports/sales', (_req, res) => send(res, { total: 0, count: 0, rows: [] }))
  app.get('/api/reports/profit', (_req, res) => send(res, { revenue: 0, cost: 0, profit: 0 }))
  app.get('/api/reports/top-products', async (_req, res) => send(res, (await loadDb()).products.slice(0, 5)))
  app.get('/api/reports/top-customers', async (_req, res) => send(res, (await loadDb()).customers.slice(0, 5)))

  app.use((req, res) => {
    res.status(404).json({ success: false, error: { message: `Route demo introuvable : ${req.method} ${req.path}` } })
  })

  app.use((err: Error, _req: Request, res: Response) => {
    console.error('[Demo API Error]', err)
    res.status(500).json({ success: false, error: { message: err.message || 'Erreur demo' } })
  })

  return app
}

export async function startDemoServer(port: number = DEFAULT_PORT): Promise<number> {
  const demoApp = createDemoApp()
  return new Promise((resolve, reject) => {
    const server = demoApp.listen(port, '127.0.0.1', () => {
      serverPort = port
      console.log(`[DEMO API] Server running on http://127.0.0.1:${port}`)
      resolve(port)
    })
    server.on('error', reject)
  })
}

export function getDemoDataFilePath(): string {
  return demoDataPath()
}
