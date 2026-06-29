import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { SearchInput } from '@renderer/components/ui/SearchInput'
import { Select } from '@renderer/components/ui/Select'
import { useDebounce } from '@renderer/hooks'
import { apiRequest } from '@renderer/lib/api'
import { formatCurrency } from '@renderer/lib/format'
import { roundMoney, applyDiscount, calculateFodec } from '@shared/utils'
import { TIMBRE_FISCAL_AMOUNT } from '@shared/constants'
import type { PaginatedResult } from '@shared/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Banknote,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Minus,
  Percent,
  Plus,
  Printer,
  ShoppingCart,
  Trash2,
  User
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import toast from 'react-hot-toast'
import { SaleDocumentModal, type SaleDocument } from './SaleDocumentModal'

interface Product {
  _id: string
  designation: string
  reference: string
  salePrice: number
  discount: number
  tva: number
  stock: number
  minStock: number
  subjectToFodec?: boolean
  categoryId?: { _id: string; name: string; prefix?: string } | string
}

interface Category {
  _id: string
  name: string
  prefix: string
}

interface Customer {
  _id: string
  name: string
}

interface CartItem {
  product: Product
  quantity: number
  discount: number
}

const CASH_QUICK_AMOUNTS = [5, 10, 20, 50, 100]

function useKeyboardShortcut(key: string, callback: () => void, enabled = true) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      const parts = key.toLowerCase().split('+')
      const needsCtrl = parts.includes('ctrl')
      const needsShift = parts.includes('shift')
      const keyName = parts[parts.length - 1]
      if (needsCtrl && !e.ctrlKey && !e.metaKey) return
      if (needsShift && !e.shiftKey) return
      if (e.key.toLowerCase() === keyName || e.code.toLowerCase() === keyName) {
        e.preventDefault()
        callback()
      }
    },
    [key, callback, enabled]
  )

  useEffect(() => {
    window.addEventListener('keydown', handler as unknown as globalThis.KeyboardEventListener)
    return () => window.removeEventListener('keydown', handler as unknown as globalThis.KeyboardEventListener)
  }, [handler])
}

function ProductCard({
  product,
  highlighted,
  index,
  onAdd,
  cardRef
}: {
  product: Product
  highlighted: boolean
  index: number
  onAdd: (p: Product) => void
  cardRef?: (el: HTMLButtonElement | null) => void
}) {
  return (
    <button
      ref={cardRef}
      type="button"
      onClick={() => onAdd(product)}
      disabled={product.stock < 1}
      className={`card-hover p-4 text-left disabled:opacity-50 disabled:cursor-not-allowed group relative ${
        highlighted
          ? 'ring-2 ring-primary-500 border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/20'
          : ''
      }`}
    >
      {index < 9 && (
        <kbd className="absolute top-2 right-2 hidden sm:inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
          {index + 1}
        </kbd>
      )}
      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-primary-600 transition-colors pr-6">
        {product.designation}
      </p>
      <p className="text-xs text-slate-400 font-mono mt-1">{product.reference}</p>
      <div className="flex items-center justify-between mt-3">
        <span className="text-lg font-bold text-primary-600">{formatCurrency(product.salePrice)}</span>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-lg ${
            product.stock <= product.minStock
              ? 'bg-red-50 text-red-600 dark:bg-red-900/30'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
          }`}
        >
          Stock: {product.stock}
        </span>
      </div>
      {product.discount > 0 && (
        <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
          <Percent size={12} />
          Remise: {product.discount}%
        </div>
      )}
    </button>
  )
}

export default function POSPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 200)
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'credit'>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerLinking, setCustomerLinking] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [includeTva, setIncludeTva] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [lastDocument, setLastDocument] = useState<SaleDocument | null>(null)
  const [lastDocumentType, setLastDocumentType] = useState<'invoice' | 'purchase_slip' | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const productRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  useKeyboardShortcut('F2', () => searchRef.current?.focus())

  const handleCheckoutRef = useRef<() => Promise<void>>(async () => {})

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiRequest<Category[]>('/categories'),
    staleTime: 60_000
  })

  const isSearchMode = debouncedSearch.length > 0

  const { data: products, isFetching: isSearching } = useQuery({
    queryKey: ['pos-products-search', debouncedSearch],
    queryFn: () =>
      apiRequest<PaginatedResult<Product>>(`/products?search=${debouncedSearch}&limit=30`),
    enabled: isSearchMode
  })

  const { data: categoryProducts, isFetching: isLoadingCategory } = useQuery({
    queryKey: ['pos-products-category', selectedCategoryId],
    queryFn: () =>
      apiRequest<PaginatedResult<Product>>(
        `/products?categoryId=${selectedCategoryId}&limit=100`
      ),
    enabled: !isSearchMode && !!selectedCategoryId,
    staleTime: 30_000
  })

  useEffect(() => {
    if (categories?.length && !selectedCategoryId) {
      setSelectedCategoryId(categories[0]._id)
    }
  }, [categories, selectedCategoryId])

  const { data: customers, refetch: refetchCustomers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => apiRequest<PaginatedResult<Customer>>('/customers?limit=100')
  })

  const displayProducts = (isSearchMode ? products?.data : categoryProducts?.data)?.filter(
    (p) => p.stock > 0
  ) ?? []
  const selectedCategory = categories?.find((c) => c._id === selectedCategoryId)
  const isLoadingProducts = isSearchMode ? isSearching : isLoadingCategory

  useEffect(() => {
    setHighlightedIndex(0)
  }, [debouncedSearch, selectedCategoryId, displayProducts.length])

  useEffect(() => {
    productRefs.current.get(highlightedIndex)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [highlightedIndex])

  const linkCustomerByName = useCallback(
    async (name: string, options?: { silent?: boolean }): Promise<string | undefined> => {
      const trimmed = name.trim()
      if (!trimmed) {
        setCustomerId('')
        return undefined
      }

      const existing = customers?.data?.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase()
      )
      if (existing) {
        setCustomerId(existing._id)
        setCustomerName(existing.name)
        return existing._id
      }

      setCustomerLinking(true)
      try {
        const knownIds = new Set(customers?.data?.map((c) => c._id) ?? [])
        let created: Customer & { created?: boolean }

        try {
          created = await apiRequest<Customer & { created?: boolean }>('/customers/quick', {
            method: 'POST',
            body: JSON.stringify({ name: trimmed })
          })
        } catch {
          const searchResult = await apiRequest<PaginatedResult<Customer>>(
            `/customers?search=${encodeURIComponent(trimmed)}&limit=10`
          )
          const match = searchResult.data?.find(
            (c) => c.name.toLowerCase() === trimmed.toLowerCase()
          )
          if (match) {
            created = match
          } else {
            created = await apiRequest<Customer>('/customers', {
              method: 'POST',
              body: JSON.stringify({ name: trimmed })
            })
          }
        }

        setCustomerId(created._id)
        setCustomerName(created.name)
        await refetchCustomers()
        queryClient.invalidateQueries({ queryKey: ['customers'] })
        if (!options?.silent && (created.created || !knownIds.has(created._id))) {
          toast.success(`Client « ${created.name} » ajouté`)
        }
        return created._id
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur création client')
        return undefined
      } finally {
        setCustomerLinking(false)
      }
    },
    [customers?.data, queryClient, refetchCustomers]
  )

  const confirmCustomerName = useCallback(() => {
    if (customerName.trim()) void linkCustomerByName(customerName)
  }, [customerName, linkCustomerByName])

  const saleMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest<{
        invoice?: { _id: string; reference: string }
        purchaseSlip?: { _id: string; reference: string }
        documentType: 'invoice' | 'purchase_slip'
      }>('/sales', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: async (result) => {
      const docId = result.invoice?._id ?? result.purchaseSlip?._id
      const docType = result.documentType
      const ref = result.invoice?.reference ?? result.purchaseSlip?.reference ?? ''

      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-slips'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['open-credits'] })
      queryClient.invalidateQueries({ queryKey: ['pos-products-category'] })

      setCart([])
      setCashReceived('')
      setSearch('')
      setCustomerId('')
      setCustomerName('')
      setCustomerOpen(false)
      setIncludeTva(false)
      setPaymentMethod('cash')

      requestAnimationFrame(() => searchRef.current?.focus())

      if (docId) {
        try {
          const path =
            docType === 'purchase_slip' ? `/purchase-slips/${docId}` : `/invoices/${docId}`
          const doc = await apiRequest<SaleDocument>(path)
          setLastDocument(doc)
          setLastDocumentType(docType)
        } catch {
          toast.success(
            docType === 'purchase_slip' ? `Bon d'achat — ${ref}` : `Facture — ${ref}`
          )
        }
      }
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product._id === product._id)
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error('Stock insuffisant')
          return prev
        }
        return prev.map((c) =>
          c.product._id === product._id ? { ...c, quantity: c.quantity + 1 } : c
        )
      }
      if (product.stock < 1) {
        toast.error('Stock insuffisant')
        return prev
      }
      toast.success(`${product.designation} ajouté`, { duration: 1500 })
      return [...prev, { product, quantity: 1, discount: product.discount || 0 }]
    })
    setSearch('')
  }, [])

  const handleBarcode = useCallback(
    async (code: string) => {
      try {
        const product = await apiRequest<Product>(`/products/barcode/${code}`)
        addToCart(product)
      } catch {
        toast.error('Produit non trouvé')
      }
    },
    [addToCart]
  )

  useEffect(() => {
    if (search.length >= 8 && /^\d+$/.test(search)) {
      void handleBarcode(search)
    }
  }, [search, handleBarcode])

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.product._id !== id) return c
        const qty = c.quantity + delta
        if (qty < 1) return c
        if (qty > c.product.stock) {
          toast.error('Stock insuffisant')
          return c
        }
        return { ...c, quantity: qty }
      })
    )
  }

  const updateDiscount = (id: string, discount: number) => {
    setCart((prev) =>
      prev.map((c) =>
        c.product._id === id ? { ...c, discount: Math.max(0, Math.min(100, discount)) } : c
      )
    )
  }

  const removeFromCart = (id: string) =>
    setCart((prev) => prev.filter((c) => c.product._id !== id))

  const clearCart = () => {
    if (!cart.length) return
    setCart([])
    toast.success('Panier vidé')
  }

  const totalHT = roundMoney(
    cart.reduce((s, c) => {
      const lineTotal = c.product.salePrice * c.quantity
      return s + applyDiscount(lineTotal, c.discount)
    }, 0)
  )
  const fodecBaseHT = roundMoney(
    cart.reduce((s, c) => {
      if (!c.product.subjectToFodec) return s
      const lineTotal = c.product.salePrice * c.quantity
      return s + applyDiscount(lineTotal, c.discount)
    }, 0)
  )
  const totalFodec = calculateFodec(fodecBaseHT)
  const totalTVA = roundMoney(
    includeTva
      ? cart.reduce((s, c) => {
          const lineTotal = c.product.salePrice * c.quantity
          const lineAfterDiscount = applyDiscount(lineTotal, c.discount)
          return s + lineAfterDiscount * (c.product.tva / 100)
        }, 0)
      : 0
  )
  const subtotal = roundMoney(totalHT + totalFodec + totalTVA)

  const probePaid = roundMoney(
    paymentMethod === 'credit'
      ? 0
      : paymentMethod === 'card'
        ? subtotal
        : cashReceived !== ''
          ? Math.min(+cashReceived, subtotal)
          : subtotal
  )
  const isFullPayment = roundMoney(subtotal - probePaid) === 0
  const timbreFiscal = isFullPayment ? TIMBRE_FISCAL_AMOUNT : 0
  const totalTTC = roundMoney(subtotal + timbreFiscal)

  const paidAmount = roundMoney(
    paymentMethod === 'credit'
      ? 0
      : paymentMethod === 'card'
        ? totalTTC
        : cashReceived !== ''
          ? Math.min(+cashReceived, totalTTC)
          : totalTTC
  )
  const amountDue = roundMoney(totalTTC - paidAmount)
  const change =
    paymentMethod === 'cash' && cashReceived !== '' && +cashReceived > totalTTC
      ? roundMoney(+cashReceived - totalTTC)
      : 0

  const needsCustomer = paymentMethod === 'credit' || amountDue > 0
  const customerConfirmed =
    !!customerId &&
    !!customerName.trim() &&
    customers?.data?.some(
      (c) =>
        c._id === customerId && c.name.toLowerCase() === customerName.trim().toLowerCase()
    )

  useEffect(() => {
    if (needsCustomer) setCustomerOpen(true)
  }, [needsCustomer])

  const handleCheckout = async () => {
    if (!cart.length) {
      toast.error('Panier vide')
      return
    }
    if (amountDue > 0 && !customerName.trim()) {
      toast.error('Indiquez le nom du client pour enregistrer une dette')
      setCustomerOpen(true)
      return
    }

    let resolvedCustomerId = customerId || undefined
    if (customerName.trim()) {
      const linkedId = await linkCustomerByName(customerName, { silent: true })
      if (linkedId) resolvedCustomerId = linkedId
    }

    saleMutation.mutate({
      customerId: resolvedCustomerId,
      customerName: customerName.trim() || undefined,
      lines: cart.map((c) => ({
        productId: c.product._id,
        quantity: c.quantity,
        discount: c.discount
      })),
      paymentMethod,
      cashReceived: paymentMethod === 'cash' && cashReceived !== '' ? +cashReceived : undefined,
      includeTva
    })
  }

  handleCheckoutRef.current = handleCheckout
  useKeyboardShortcut('F9', () => {
    if (cart.length) void handleCheckoutRef.current()
  })

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!displayProducts.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, displayProducts.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const product = displayProducts[highlightedIndex]
      if (product) addToCart(product)
      return
    }
    const num = parseInt(e.key, 10)
    if (num >= 1 && num <= 9 && displayProducts[num - 1]) {
      e.preventDefault()
      addToCart(displayProducts[num - 1])
    }
  }

  const cartItemCount = cart.reduce((s, c) => s + c.quantity, 0)

  return (
    <div className={`-m-2 lg:-m-4 flex flex-col xl:flex-row gap-4 h-[calc(100vh-5.5rem)] min-h-0 ${cart.length > 0 ? 'pb-24 xl:pb-0' : ''}`}>
      {/* Zone produits */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="shrink-0 mb-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h1 className="page-title">Point de vente</h1>
              <p className="page-subtitle hidden sm:block">
                Recherche, scan ou sélection rapide
              </p>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-400">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono border border-slate-200 dark:border-slate-700">
                F2
              </kbd>
              <span>recherche</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono border border-slate-200 dark:border-slate-700">
                ↑↓
              </kbd>
              <span>naviguer</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono border border-slate-200 dark:border-slate-700">
                Entrée
              </kbd>
              <span>ajouter</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono border border-slate-200 dark:border-slate-700">
                F9
              </kbd>
              <span>valider</span>
            </div>
          </div>
          <SearchInput
            ref={searchRef}
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
            onKeyDown={handleSearchKeyDown}
            loading={isLoadingProducts}
            size="large"
            placeholder="Nom, référence, code-barres… (↑↓ Entrée ou 1-9)"
          />

          {!isSearchMode && (categories?.length ?? 0) > 0 && (
            <div className="flex gap-2 overflow-x-auto pt-3 pb-1 -mx-1 px-1">
              {categories!.map((cat) => (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat._id)}
                  className={`shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                    selectedCategoryId === cat._id
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {(isSearchMode || selectedCategoryId) ? (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 px-1">
              {isSearchMode
                ? 'Résultats de recherche'
                : selectedCategory?.name ?? 'Produits'}
              {!isSearchMode && displayProducts.length > 0 && (
                <span className="normal-case font-normal ml-1">({displayProducts.length})</span>
              )}
            </p>
            {isLoadingProducts && displayProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">Chargement…</div>
            ) : displayProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3 pb-2">
                {displayProducts.map((p, i) => (
                  <ProductCard
                    key={p._id}
                    product={p}
                    index={i}
                    highlighted={i === highlightedIndex}
                    onAdd={addToCart}
                    cardRef={(el) => {
                      if (el) productRefs.current.set(i, el)
                      else productRefs.current.delete(i)
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                {isSearchMode
                  ? 'Aucun produit trouvé'
                  : 'Aucun produit en stock dans cette catégorie'}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center card border-dashed border-2 border-slate-200 dark:border-slate-700 bg-transparent min-h-[200px]">
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="text-primary-500" size={28} />
              </div>
              <p className="font-medium text-slate-600 dark:text-slate-400">
                {categories?.length
                  ? 'Chargement des catégories…'
                  : 'Aucune catégorie définie — ajoutez-en dans Produits'}
              </p>
              <p className="text-sm text-slate-400 mt-1">ou scannez un code-barres</p>
            </div>
          </div>
        )}
      </div>

      {/* Panier */}
      <div className="w-full xl:w-[420px] shrink-0 card flex flex-col overflow-hidden shadow-card-hover min-h-0 xl:max-h-full">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 dark:text-white">Panier</h2>
            <span className="badge-info">
              {cartItemCount} art.{cartItemCount !== 1 ? 's' : ''}
            </span>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 size={13} />
              Vider
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px]">
          {cart.map((item) => {
            const lineTotal = item.product.salePrice * item.quantity
            const lineAfterDiscount = applyDiscount(lineTotal, item.discount)
            return (
              <div
                key={item.product._id}
                className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-slate-800 dark:text-slate-200 leading-tight">
                    {item.product.designation}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatCurrency(item.product.salePrice)} × {item.quantity}
                    {item.discount > 0 && (
                      <span className="text-amber-500"> (−{item.discount}%)</span>
                    )}
                  </p>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1">
                      <Percent size={10} className="text-slate-400" />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={item.discount}
                        onChange={(e) =>
                          updateDiscount(item.product._id, parseFloat(e.target.value) || 0)
                        }
                        className="w-12 text-xs px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center"
                        aria-label="Remise %"
                      />
                      <span className="text-xs text-slate-400">%</span>
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {formatCurrency(lineAfterDiscount)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-0.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                    <button
                      type="button"
                      onClick={() => updateQty(item.product._id, -1)}
                      className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                      aria-label="Diminuer"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.product._id, 1)}
                      className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                      aria-label="Augmenter"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product._id)}
                    className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
          {!cart.length && (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <ShoppingCart size={28} className="mb-2 opacity-40" />
              <p className="text-sm">Panier vide</p>
            </div>
          )}
        </div>

        {/* Paiement */}
        <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-0 max-h-[min(55vh,520px)] xl:max-h-[min(60vh,560px)]">
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {/* Client repliable */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setCustomerOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <span className="flex items-center gap-2">
                  <User size={15} className="text-slate-400" />
                  Client
                  {customerConfirmed && (
                    <span className="text-xs text-emerald-600 font-normal">✓ enregistré</span>
                  )}
                  {needsCustomer && !customerConfirmed && (
                    <span className="text-xs text-amber-600 font-normal">requis</span>
                  )}
                </span>
                {customerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {customerOpen && (
                <div className="px-3 pb-3 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                  <Select
                    label="Client enregistré"
                    value={customerId}
                    onChange={(e) => {
                      const id = e.target.value
                      setCustomerId(id)
                      const customer = customers?.data?.find((c) => c._id === id)
                      setCustomerName(customer?.name ?? '')
                    }}
                    options={[
                      { value: '', label: '— Client comptant —' },
                      ...(customers?.data?.map((c) => ({ value: c._id, label: c.name })) || [])
                    ]}
                  />
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Input
                        label="Nom"
                        placeholder="Ex. Mohamed"
                        value={customerName}
                        onChange={(e) => {
                          const value = e.target.value
                          setCustomerName(value)
                          const match = customers?.data?.find(
                            (c) => c.name.toLowerCase() === value.trim().toLowerCase()
                          )
                          setCustomerId(match?._id ?? '')
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            confirmCustomerName()
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      loading={customerLinking}
                      disabled={!customerName.trim()}
                      onClick={confirmCustomerName}
                      className="shrink-0 !py-2.5"
                    >
                      OK
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeTva}
                onChange={(e) => setIncludeTva(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">TVA</span>
            </label>
            {isFullPayment && paymentMethod !== 'credit' && (
              <p className="text-xs text-slate-400">
                Timbre fiscal {formatCurrency(TIMBRE_FISCAL_AMOUNT)} inclus sur la facture
              </p>
            )}
            {totalFodec > 0 && (
              <p className="text-xs text-slate-400">
                FODEC 1% sur {formatCurrency(fodecBaseHT)} HT (produits éligibles)
              </p>
            )}

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Total HT</span>
                <span>{formatCurrency(totalHT)}</span>
              </div>
              {totalFodec > 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>FODEC (1%)</span>
                  <span>{formatCurrency(totalFodec)}</span>
                </div>
              )}
              {includeTva && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>TVA</span>
                  <span>{formatCurrency(totalTVA)}</span>
                </div>
              )}
              {timbreFiscal > 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Timbre fiscal</span>
                  <span>{formatCurrency(timbreFiscal)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold text-slate-900 dark:text-white pt-1.5 border-t border-slate-200 dark:border-slate-700">
                <span>Total TTC</span>
                <span className="text-primary-600">{formatCurrency(totalTTC)}</span>
              </div>
              {amountDue > 0 && (
                <p className="text-xs font-semibold text-red-600 pt-1">
                  Dette : {formatCurrency(amountDue)} → Bon d&apos;achat
                </p>
              )}
              {amountDue === 0 && cart.length > 0 && paymentMethod !== 'credit' && (
                <p className="text-xs text-emerald-600 pt-1">Paiement intégral → Facture</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: 'cash' as const, label: 'Espèces', icon: <Banknote size={20} /> },
                  { key: 'card' as const, label: 'Carte', icon: <CreditCard size={20} /> },
                  { key: 'credit' as const, label: 'Crédit', icon: <User size={20} /> }
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setPaymentMethod(m.key)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                    paymentMethod === m.key
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>

            {paymentMethod === 'cash' && (
              <div className="space-y-2">
                <Input
                  label="Montant reçu"
                  type="number"
                  step="0.001"
                  placeholder={formatCurrency(totalTTC)}
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCashReceived(String(totalTTC))}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50"
                  >
                    Exact
                  </button>
                  {CASH_QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashReceived(String(amt))}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      {amt}
                    </button>
                  ))}
                </div>
                {cashReceived !== '' && paidAmount < totalTTC && (
                  <p className="text-xs font-semibold text-red-600">
                    Payé {formatCurrency(paidAmount)} — Reste {formatCurrency(amountDue)}
                  </p>
                )}
                {change > 0 && (
                  <p className="text-sm font-bold text-emerald-600">
                    Monnaie : {formatCurrency(change)}
                  </p>
                )}
              </div>
            )}

            {paymentMethod === 'credit' && (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2.5 rounded-xl">
                Crédit total — bon d&apos;achat. Client requis.
              </p>
            )}
          </div>

          <div className="shrink-0 px-4 py-3 border-t-2 border-primary-100 dark:border-primary-900/40 bg-slate-50 dark:bg-slate-800/50">
            <Button
              onClick={() => void handleCheckout()}
              loading={saleMutation.isPending}
              className="w-full !py-4 text-base font-semibold shadow-md"
              disabled={!cart.length}
            >
              <Printer size={20} />
              {amountDue > 0 ? "Valider — Bon d'achat" : 'Valider — Facture'}
              <span className="hidden sm:inline text-primary-200 font-normal ml-1">(F9)</span>
            </Button>
          </div>
        </div>
      </div>

      {cart.length > 0 && (
        <div className="xl:hidden fixed bottom-0 inset-x-0 z-50 border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-[0_-8px_24px_rgba(0,0,0,0.1)]">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="shrink-0">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Total TTC</p>
              <p className="text-lg font-bold text-primary-600 leading-tight">
                {formatCurrency(totalTTC)}
              </p>
            </div>
            <Button
              onClick={() => void handleCheckout()}
              loading={saleMutation.isPending}
              className="flex-1 !py-3.5 text-base font-semibold"
            >
              <Printer size={18} />
              {amountDue > 0 ? 'Bon d\'achat' : 'Facture'}
            </Button>
          </div>
        </div>
      )}

      <SaleDocumentModal
        document={lastDocument}
        documentType={lastDocumentType}
        onClose={() => {
          setLastDocument(null)
          setLastDocumentType(null)
          searchRef.current?.focus()
        }}
      />
    </div>
  )
}
