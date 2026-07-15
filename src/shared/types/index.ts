import type { Types } from 'mongoose'

export type UserRole = 'admin' | 'cashier'
export type PaymentMethod = 'cash' | 'card' | 'mixed' | 'credit'
export type PurchaseOrderStatus = 'draft' | 'sent' | 'partial' | 'received'
export type PurchasePaymentStatus = 'none' | 'paid' | 'unpaid' | 'partial'
export type StockMovementType = 'in' | 'out'
export type StockMovementReason = 'achat' | 'vente' | 'correction' | 'inventaire'
export type PaymentType = 'customer' | 'supplier'
export type ExpenseCategory = 'merchandise' | 'transport' | 'rent' | 'electricity' | 'other'
export type AuditAction = 'create' | 'update' | 'delete'

export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

export interface ApiErrorResponse {
  success: false
  error: {
    message: string
    errors?: Record<string, string[]>
  }
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface SaleLine {
  productId: Types.ObjectId | string
  reference?: string
  designation?: string
  quantity: number
  unitPrice?: number
  tva?: number
  totalHT?: number
  totalTTC?: number
}

export interface PurchaseOrderLine {
  productId: Types.ObjectId | string
  designation: string
  quantity: number
  unitPrice: number
  receivedQuantity?: number
}
