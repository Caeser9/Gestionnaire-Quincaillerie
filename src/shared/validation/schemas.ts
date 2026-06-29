import { z } from 'zod'

/** Treats empty string as undefined for optional MongoDB ObjectId fields */
export const optionalId = z.preprocess(
  (val) => (val === '' || val === null ? undefined : val),
  z.string().optional()
)

export const loginSchema = z.object({
  username: z.string().min(1, "Nom d'utilisateur requis"),
  password: z.string().min(1, 'Mot de passe requis')
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    newPassword: z.string().min(6, 'Minimum 6 caractères'),
    confirmPassword: z.string().min(1, 'Confirmation requise')
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword']
  })

export const productSchema = z.object({
  reference: z.string().optional(),
  barcode: z.string().optional(),
  designation: z.string().min(1, 'Désignation requise'),
  description: z.string().optional(),
  categoryId: z.string().min(1, 'Catégorie requise'),
  subCategoryId: optionalId,
  brand: z.string().optional(),
  supplierId: optionalId,
  purchasePrice: z.number().min(0, 'Prix achat invalide'),
  salePrice: z.number().min(0, 'Prix vente invalide').optional(),
  profitMargin: z.number().min(0, 'Marge invalide').max(1000).default(25),
  discount: z.number().min(0, 'Remise invalide').max(100).default(0),
  tva: z.number().min(0).max(100),
  subjectToFodec: z.boolean().optional().default(false),
  stock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(0),
  unit: z.string().min(1, 'Unité requise'),
  location: z.string().optional()
})

export const categorySchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  prefix: z.string().min(2, 'Préfixe requis (2 lettres minimum)').max(5).toUpperCase(),
  counter: z.number().optional()
})

export const subCategorySchema = z.object({
  categoryId: z.string().min(1, 'Catégorie requise'),
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional()
})

export const supplierSchema = z.object({
  companyName: z.string().min(1, 'Raison sociale requise'),
  taxId: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  address: z.string().optional(),
  contactName: z.string().optional()
})

export const customerSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  phone: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal(''))
})

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Fournisseur requis'),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        designation: z.string(),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0)
      })
    )
    .min(1, 'Au moins un produit requis'),
  notes: z.string().optional()
})

export const quickReceiveSchema = purchaseOrderSchema.extend({
  updatePurchasePrices: z.boolean().optional().default(true),
  recordDebt: z.boolean().optional().default(false)
})

export const purchaseReceivePaymentSchema = z
  .object({
    mode: z.enum(['paid', 'credit', 'partial']),
    amountPaid: z.number().min(0).optional(),
    method: z.enum(['cash', 'card', 'mixed']).optional()
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'partial' && (data.amountPaid === undefined || data.amountPaid <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Montant payé requis pour un paiement partiel',
        path: ['amountPaid']
      })
    }
  })

export const purchaseOrderPaySchema = z.object({
  amount: z.number().positive('Montant invalide'),
  method: z.enum(['cash', 'card', 'mixed']),
  notes: z.string().optional()
})

export const saleSchema = z.object({
  customerId: optionalId,
  customerName: z.string().optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().min(1),
        discount: z.number().optional()
      })
    )
    .min(1, 'Panier vide'),
  paymentMethod: z.enum(['cash', 'card', 'mixed', 'credit']),
  amountPaid: z.number().min(0).optional(),
  cashReceived: z.number().optional(),
  cardAmount: z.number().optional(),
  includeTva: z.boolean().optional().default(false)
}).superRefine((data, ctx) => {
  const hasCustomer = !!(data.customerId || data.customerName?.trim())
  const isCredit = data.paymentMethod === 'credit'
  const partialPaid = data.amountPaid !== undefined && data.amountPaid >= 0
  if ((isCredit || partialPaid) && !hasCustomer) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Un client est requis pour une vente à crédit ou un paiement partiel',
      path: ['customerName']
    })
  }
})

export const paymentSchema = z.object({
  type: z.enum(['customer', 'supplier']),
  entityId: z.string().min(1),
  invoiceId: optionalId,
  purchaseSlipId: optionalId,
  purchaseOrderId: optionalId,
  amount: z.number().positive('Montant invalide'),
  method: z.enum(['cash', 'card', 'mixed']),
  notes: z.string().optional()
})

export const settingsSchema = z.object({
  companyName: z.string().min(1, 'Nom société requis'),
  companyAddress: z.string().optional(),
  companyPhone: z.string().optional(),
  defaultTva: z.coerce.number().min(0).max(100),
  currency: z.string().min(1),
  invoiceFormat: z.string().min(1),
  mongoUri: z.string().min(1).optional()
})

export const createUserSchema = z.object({
  username: z.string().min(3, 'Minimum 3 caractères'),
  password: z.string().min(6, 'Minimum 6 caractères'),
  role: z.enum(['admin', 'cashier'])
})

export const updateInvoiceSchema = z.object({
  customerName: z.string().min(1, 'Nom client requis')
})

export const expenseSchema = z.object({
  label: z.string().min(1, 'Libellé requis'),
  category: z.enum(['merchandise', 'transport', 'rent', 'electricity', 'other']),
  amount: z.number().positive('Montant invalide'),
  date: z.string().min(1, 'Date requise'),
  notes: z.string().optional()
})
