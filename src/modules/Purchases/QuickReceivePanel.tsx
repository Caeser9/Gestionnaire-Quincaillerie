import { Button } from '@renderer/components/ui/Button'
import { EmptyState } from '@renderer/components/ui/EmptyState'
import { Input } from '@renderer/components/ui/Input'
import { SearchInput } from '@renderer/components/ui/SearchInput'
import { Select } from '@renderer/components/ui/Select'
import { useDebounce } from '@renderer/hooks'
import { apiRequest } from '@renderer/lib/api'
import { formatCurrency } from '@renderer/lib/format'
import { roundMoney } from '@shared/utils'
import type { PaginatedResult } from '@shared/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Minus, Package, Plus, Trash2, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'

interface Supplier {
  _id: string
  companyName: string
}

interface Product {
  _id: string
  reference: string
  designation: string
  barcode?: string
  purchasePrice: number
  stock: number
  unit: string
  minStock?: number
  supplierId?: string | { _id: string }
}

export interface CartLine {
  productId: string
  designation: string
  reference: string
  quantity: number
  unitPrice: number
  unit: string
}

interface QuickReceivePanelProps {
  onSuccess?: () => void
}

export function QuickReceivePanel({ onSuccess }: QuickReceivePanelProps) {
  const queryClient = useQueryClient()
  const searchRef = useRef<HTMLInputElement>(null)
  const [supplierId, setSupplierId] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [cart, setCart] = useState<CartLine[]>([])
  const [notes, setNotes] = useState('')
  const [updatePrices, setUpdatePrices] = useState(true)
  const [recordDebt, setRecordDebt] = useState(false)

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => apiRequest<PaginatedResult<Supplier>>('/suppliers?limit=200')
  })

  const productQuery = useMemo(() => {
    const params = new URLSearchParams({ limit: '80' })
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (supplierId && !showAllProducts) params.set('supplierId', supplierId)
    return params.toString()
  }, [debouncedSearch, supplierId, showAllProducts])

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['purchase-products', productQuery],
    queryFn: () => apiRequest<PaginatedResult<Product>>(`/products?${productQuery}`),
    enabled: !!supplierId
  })

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product._id)
      if (existing) {
        return prev.map((l) =>
          l.productId === product._id ? { ...l, quantity: l.quantity + 1 } : l
        )
      }
      return [
        ...prev,
        {
          productId: product._id,
          designation: product.designation,
          reference: product.reference,
          quantity: 1,
          unitPrice: product.purchasePrice,
          unit: product.unit
        }
      ]
    })
    setSearch('')
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!debouncedSearch || !products?.data?.length) return
    const exact = products.data.find(
      (p) => p.barcode && p.barcode === debouncedSearch.trim()
    )
    if (exact) addToCart(exact)
  }, [debouncedSearch, products?.data, addToCart])

  const receiveMutation = useMutation({
    mutationFn: () =>
      apiRequest('/purchase-orders/quick-receive', {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          lines: cart.map((l) => ({
            productId: l.productId,
            designation: l.designation,
            quantity: l.quantity,
            unitPrice: l.unitPrice
          })),
          notes: notes || undefined,
          updatePurchasePrices: updatePrices,
          recordDebt
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Réception enregistrée — stock mis à jour')
      setCart([])
      setNotes('')
      onSuccess?.()
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const totalHT = roundMoney(cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0))
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0)

  const updateLine = (productId: string, field: 'quantity' | 'unitPrice', value: number) => {
    setCart((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, [field]: value } : l))
    )
  }

  const removeLine = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId))
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Fournisseur *"
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value)
                setCart([])
              }}
              options={[
                { value: '', label: 'Choisir un fournisseur...' },
                ...(suppliers?.data?.map((s) => ({ value: s._id, label: s.companyName })) || [])
              ]}
            />
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={showAllProducts}
                  onChange={(e) => setShowAllProducts(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                Afficher tous les produits
              </label>
            </div>
          </div>

          {supplierId ? (
            <>
              <SearchInput
                ref={searchRef}
                value={search}
                onChange={setSearch}
                onClear={() => setSearch('')}
                placeholder="Rechercher ou scanner code-barres... (F2)"
                loading={productsLoading}
                size="large"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[420px] overflow-y-auto">
                {products?.data?.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="card-hover p-3 text-left"
                  >
                    <p className="text-xs font-mono text-slate-400 truncate">{p.reference}</p>
                    <p className="text-sm font-medium truncate">{p.designation}</p>
                    <div className="flex justify-between mt-1 text-xs text-slate-500">
                      <span>{formatCurrency(p.purchasePrice)}</span>
                      <span>Stock: {p.stock}</span>
                    </div>
                    {p.minStock !== undefined && p.stock <= p.minStock && (
                      <span className="text-[10px] text-amber-600 font-medium">Stock bas</span>
                    )}
                  </button>
                ))}
              </div>
              {!productsLoading && !products?.data?.length && (
                <EmptyState
                  icon={<Package size={24} />}
                  title="Aucun produit"
                  description={
                    showAllProducts
                      ? 'Aucun produit trouvé pour cette recherche'
                      : 'Aucun produit lié à ce fournisseur — cochez « tous les produits » ou liez des produits au fournisseur'
                  }
                />
              )}
            </>
          ) : (
            <EmptyState
              icon={<Zap size={24} />}
              title="Sélectionnez un fournisseur"
              description="Choisissez le fournisseur pour afficher ses produits et saisir la réception"
            />
          )}
        </div>
      </div>

      <div className="card p-4 flex flex-col min-h-[480px]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Panier réception</h3>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setCart([])}
              className="text-xs text-red-500 hover:text-red-600"
            >
              Vider
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mb-3">
          {cart.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              Cliquez sur un produit pour l&apos;ajouter
            </p>
          ) : (
            cart.map((line) => (
              <div
                key={line.productId}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700"
              >
                <div className="flex justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{line.designation}</p>
                    <p className="text-xs text-slate-400">{line.reference}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.productId)}
                    className="text-slate-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn-ghost btn-sm p-1"
                      onClick={() =>
                        updateLine(line.productId, 'quantity', Math.max(1, line.quantity - 1))
                      }
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.productId, 'quantity', Math.max(1, +e.target.value))
                      }
                      className="input w-14 text-center py-1 text-sm"
                    />
                    <button
                      type="button"
                      className="btn-ghost btn-sm p-1"
                      onClick={() => updateLine(line.productId, 'quantity', line.quantity + 1)}
                    >
                      <Plus size={14} />
                    </button>
                    <span className="text-xs text-slate-400">{line.unit}</span>
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    min={0}
                    value={line.unitPrice}
                    onChange={(e) =>
                      updateLine(line.productId, 'unitPrice', Math.max(0, +e.target.value))
                    }
                    className="input w-24 text-sm ml-auto"
                    title="Prix unitaire HT"
                  />
                </div>
                <p className="text-xs text-right text-slate-500 mt-1">
                  {formatCurrency(line.quantity * line.unitPrice)}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-3">
          <Input
            label="Notes (optionnel)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="N° BL fournisseur, remarques..."
          />

          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={updatePrices}
                onChange={(e) => setUpdatePrices(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              Mettre à jour les prix d&apos;achat produits
            </label>
            <p className="text-xs text-slate-500 font-medium pt-1">Statut paiement</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="quickPayment"
                checked={!recordDebt}
                onChange={() => setRecordDebt(false)}
                className="w-4 h-4"
              />
              Payé comptant ({formatCurrency(totalHT)})
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="quickPayment"
                checked={recordDebt}
                onChange={() => setRecordDebt(true)}
                className="w-4 h-4"
              />
              À payer plus tard — dette fournisseur
            </label>
          </div>

          <div className="flex justify-between items-center font-semibold">
            <span>{itemCount} article(s)</span>
            <span className="text-lg text-primary-600">{formatCurrency(totalHT)} HT</span>
          </div>

          <Button
            className="w-full"
            size="lg"
            loading={receiveMutation.isPending}
            disabled={!supplierId || cart.length === 0}
            onClick={() => receiveMutation.mutate()}
          >
            <Zap size={18} />
            Valider la réception
          </Button>
        </div>
      </div>
    </div>
  )
}
