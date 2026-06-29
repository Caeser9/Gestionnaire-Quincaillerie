export const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/quincaillerie'
export const DEFAULT_PORT = 3847

export const REFERENCE_PREFIXES = {
  product: 'PRD',
  customer: 'CLI',
  supplier: 'FRN',
  purchase: 'ACH',
  invoice: 'FAC',
  purchaseOrder: 'BC',
  purchaseSlip: 'BA',
  inventory: 'INV'
} as const

export type ReferenceKey = keyof typeof REFERENCE_PREFIXES

export const REFERENCE_PAD = 6

export const DEFAULT_SETTINGS = {
  companyName: 'Ma Quincaillerie',
  companyAddress: '',
  companyPhone: '',
  defaultTva: 19,
  currency: 'DT',
  invoiceFormat: 'FAC-{year}-{number}',
  mongoUri: DEFAULT_MONGO_URI
}

/** FODEC — 1 % sur le HT des produits éligibles (Tunisie) */
export const FODEC_RATE = 1

/** Timbre fiscal — montant fixe sur facture (Tunisie) */
export const TIMBRE_FISCAL_AMOUNT = 1
