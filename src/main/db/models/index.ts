import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'cashier'], required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

const productSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    barcode: { type: String, sparse: true, index: true },
    designation: { type: String, required: true, index: true },
    description: String,
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    subCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory' },
    brand: String,
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    purchasePrice: { type: Number, required: true, default: 0 },
    salePrice: { type: Number, required: true, default: 0 },
    profitMargin: { type: Number, required: true, default: 25 },
    discount: { type: Number, required: true, default: 0 },
    tva: { type: Number, required: true, default: 19 },
    stock: { type: Number, required: true, default: 0 },
    minStock: { type: Number, required: true, default: 0 },
    unit: { type: String, required: true, default: 'pièce' },
    location: String,
    photo: String,
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
)
productSchema.index({ designation: 'text', reference: 'text', barcode: 'text' })

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: String,
    prefix: { type: String, required: true, unique: true, trim: true, uppercase: true },
    counter: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
)

const subCategorySchema = new mongoose.Schema(
  {
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    name: { type: String, required: true, trim: true },
    description: String
  },
  { timestamps: true }
)
subCategorySchema.index({ categoryId: 1, name: 1 }, { unique: true })

const supplierSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    companyName: { type: String, required: true, index: true },
    taxId: String,
    phone: String,
    email: String,
    address: String,
    contactName: String,
    balance: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
)

const customerSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    name: { type: String, required: true, index: true },
    phone: String,
    address: String,
    email: String,
    matricule: String,
    creditBalance: { type: Number, default: 0 },
    totalPurchases: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
)

const purchaseOrderLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    designation: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    receivedQuantity: { type: Number, default: 0 }
  },
  { _id: false }
)

const purchaseOrderSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    lines: [purchaseOrderLineSchema],
    status: {
      type: String,
      enum: ['draft', 'sent', 'partial', 'received'],
      default: 'draft'
    },
    totalHT: { type: Number, default: 0 },
    notes: String,
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['none', 'paid', 'unpaid', 'partial'],
      default: 'none'
    }
  },
  { timestamps: true }
)

const purchaseReceiptSchema = new mongoose.Schema(
  {
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
    reference: { type: String, required: true, unique: true },
    lines: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true }
      }
    ],
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notes: String
  },
  { timestamps: true }
)

const supplierInvoiceSchema = new mongoose.Schema(
  {
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    reference: { type: String, required: true },
    amount: { type: Number, required: true },
    filePath: String,
    fileType: { type: String, enum: ['pdf', 'image'] }
  },
  { timestamps: true }
)

const saleLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    reference: String,
    designation: String,
    quantity: Number,
    unitPrice: Number,
    discount: { type: Number, default: 0 },
    tva: Number,
    totalHT: Number,
    totalTVA: Number,
    totalTTC: Number
  },
  { _id: false }
)

const saleSchema = new mongoose.Schema(
  {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    purchaseSlipId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseSlip' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerAddress: String,
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lines: [saleLineSchema],
    totalHT: { type: Number, default: 0 },
    totalTVA: { type: Number, default: 0 },
    timbreFiscal: { type: Number, default: 0 },
    totalTTC: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'mixed', 'credit'],
      required: true
    },
    bcNumber: String,
    blNumber: String,
    pieceNumber: String,
    representative: String,
    deliveryPerson: String,
    validUntil: Date,
    cashReceived: Number,
    cardAmount: Number,
    change: Number,
    includeTva: { type: Boolean, default: false },
    isCancelled: { type: Boolean, default: false }
  },
  { timestamps: true }
)

const purchaseSlipSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    documentType: {
      type: String,
      enum: ['delivery_note', 'purchase_slip'],
      default: 'purchase_slip'
    },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', default: null },
    sourceInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: String,
    customerAddress: String,
    customerMatricule: String,
    lines: [saleLineSchema],
    totalHT: { type: Number, default: 0 },
    totalTVA: { type: Number, default: 0 },
    timbreFiscal: { type: Number, default: 0 },
    totalTTC: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    isSettled: { type: Boolean, default: false },
    convertedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    bcNumber: String,
    blNumber: String,
    pieceNumber: String,
    representative: String,
    deliveryPerson: String,
    deliveryDriverName: String,
    deliveryDriverCin: String,
    deliveryVehiclePlate: String,
    vehicleRegistration: String,
    validUntil: Date,
    includeTva: { type: Boolean, default: false }
  },
  { timestamps: true }
)

const invoiceSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: String,
    customerAddress: String,
    lines: [saleLineSchema],
    totalHT: { type: Number, default: 0 },
    totalTVA: { type: Number, default: 0 },
    timbreFiscal: { type: Number, default: 0 },
    totalTTC: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    isPaid: { type: Boolean, default: true },
    bcNumber: String,
    blNumber: String,
    pieceNumber: String,
    representative: String,
    deliveryPerson: String,
    validUntil: Date,
    includeTva: { type: Boolean, default: false }
  },
  { timestamps: true }
)

const paymentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['customer', 'supplier'], required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    purchaseSlipId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseSlip' },
    purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder' },
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ['cash', 'card', 'mixed', 'credit'],
      required: true
    },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
)

const stockMovementSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    type: { type: String, enum: ['in', 'out'], required: true },
    reason: {
      type: String,
      enum: ['achat', 'vente', 'correction', 'inventaire'],
      required: true
    },
    quantity: { type: Number, required: true },
    stockBefore: { type: Number, required: true },
    stockAfter: { type: Number, required: true },
    reference: String,
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
)

const inventoryAdjustmentSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    lines: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        designation: String,
        theoreticalStock: Number,
        actualStock: Number,
        difference: Number
      }
    ],
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
)

const settingsSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, default: 'Ma Quincaillerie' },
    companyAddress: String,
    companyPhone: String,
    companyFax: String,
    companyMatriculeFiscal: String,
    companyTvaCode: String,
    companyRC: String,
    companyLogo: String,
    defaultTva: { type: Number, default: 19 },
    currency: { type: String, default: 'DT' },
    mongoUri: { type: String, default: 'mongodb://127.0.0.1:27017/quincaillerie' }
  },
  { timestamps: true }
)

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    action: { type: String, enum: ['create', 'update', 'delete'], required: true },
    targetCollection: { type: String, required: true },
    documentId: { type: String, required: true },
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
)

const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 }
})

const expenseSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    category: {
      type: String,
      enum: ['merchandise', 'transport', 'rent', 'electricity', 'other'],
      required: true
    },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
)

export const User = mongoose.models.User ?? mongoose.model('User', userSchema)
export const Product = mongoose.models.Product ?? mongoose.model('Product', productSchema)
export const Category = mongoose.models.Category ?? mongoose.model('Category', categorySchema)
export const SubCategory = mongoose.models.SubCategory ?? mongoose.model('SubCategory', subCategorySchema)
export const Supplier = mongoose.models.Supplier ?? mongoose.model('Supplier', supplierSchema)
export const Customer = mongoose.models.Customer ?? mongoose.model('Customer', customerSchema)
export const PurchaseOrder = mongoose.models.PurchaseOrder ?? mongoose.model('PurchaseOrder', purchaseOrderSchema)
export const PurchaseReceipt = mongoose.models.PurchaseReceipt ?? mongoose.model('PurchaseReceipt', purchaseReceiptSchema)
export const SupplierInvoice = mongoose.models.SupplierInvoice ?? mongoose.model('SupplierInvoice', supplierInvoiceSchema)
export const Sale = mongoose.models.Sale ?? mongoose.model('Sale', saleSchema)
export const PurchaseSlip =
  mongoose.models.PurchaseSlip ?? mongoose.model('PurchaseSlip', purchaseSlipSchema)
export const Invoice = mongoose.models.Invoice ?? mongoose.model('Invoice', invoiceSchema)

const quoteLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    reference: String,
    designation: String,
    quantity: Number,
    unitPrice: Number,
    discount: { type: Number, default: 0 },
    tva: Number,
    totalHT: Number,
    totalTVA: Number,
    totalTTC: Number
  },
  { _id: false }
)

const quoteSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: String,
    customerAddress: String,
    lines: [quoteLineSchema],
    totalHT: { type: Number, default: 0 },
    totalTVA: { type: Number, default: 0 },
    timbreFiscal: { type: Number, default: 0 },
    totalTTC: { type: Number, default: 0 },
    includeTva: { type: Boolean, default: false },
    validUntil: Date
  },
  { timestamps: true }
)

export const Quote = mongoose.models.Quote ?? mongoose.model('Quote', quoteSchema)
export const Payment = mongoose.models.Payment ?? mongoose.model('Payment', paymentSchema)
export const StockMovement = mongoose.models.StockMovement ?? mongoose.model('StockMovement', stockMovementSchema)
export const InventoryAdjustment =
  mongoose.models.InventoryAdjustment ?? mongoose.model('InventoryAdjustment', inventoryAdjustmentSchema)
export const Settings = mongoose.models.Settings ?? mongoose.model('Settings', settingsSchema)
export const AuditLog = mongoose.models.AuditLog ?? mongoose.model('AuditLog', auditLogSchema)
export const Counter = mongoose.models.Counter ?? mongoose.model('Counter', counterSchema)
export const Expense = mongoose.models.Expense ?? mongoose.model('Expense', expenseSchema)
