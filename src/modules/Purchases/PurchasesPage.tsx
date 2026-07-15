import { Button } from '@renderer/components/ui/Button'
import { EmptyState } from '@renderer/components/ui/EmptyState'
import { Input } from '@renderer/components/ui/Input'
import { Modal } from '@renderer/components/ui/Modal'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { SearchInput } from '@renderer/components/ui/SearchInput'
import { Select } from '@renderer/components/ui/Select'
import { useDebounce } from '@renderer/hooks'
import { apiRequest } from '@renderer/lib/api'
import { formatCurrency, formatDate } from '@renderer/lib/format'
import { roundMoney } from '@shared/utils'
import type { PaginatedResult } from '@shared/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Package, Plus, Trash2, Wallet, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import Pagination from '@renderer/components/ui/Pagination'
import toast from 'react-hot-toast'
import { QuickReceivePanel, type CartLine } from './QuickReceivePanel'

interface PurchaseOrder {
  _id: string
  reference: string
  supplierId?: { companyName?: string }
  supplierName?: string
  totalHT: number
  status: 'draft' | 'sent' | 'partial' | 'received'
  paymentStatus?: 'none' | 'paid' | 'unpaid' | 'partial'
  amountPaid?: number
  amountDue?: number
  createdAt: string
  lines: {
    productId: string
    designation: string
    quantity: number
    unitPrice: number
    receivedQuantity: number
  }[]
}

interface Supplier {
  _id: string
  companyName: string
}

interface Product {
  _id: string
  reference: string
  designation: string
  purchasePrice: number
}

const statusLabel = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  partial: 'Reçu partiellement',
  received: 'Reçu totalement'
} as const

const statusBadge = {
  draft: 'badge-info',
  sent: 'badge-warning',
  partial: 'badge-warning',
  received: 'badge-success'
} as const

const paymentLabel = {
  none: '—',
  paid: 'Payé',
  unpaid: 'À payer',
  partial: 'Partiel'
} as const

const paymentBadge = {
  none: 'badge-neutral',
  paid: 'badge-success',
  unpaid: 'badge-warning',
  partial: 'badge-info'
} as const

type ReceivePaymentMode = 'paid' | 'credit' | 'partial'

type Tab = 'quick' | 'orders'

export default function PurchasesPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('quick')
  const [statusFilter, setStatusFilter] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const debouncedOrderSearch = useDebounce(orderSearch)

  const [modalOpen, setModalOpen] = useState(false)
  const [receiveId, setReceiveId] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [lines, setLines] = useState<CartLine[]>([])
  const [poNotes, setPoNotes] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const debouncedProductSearch = useDebounce(productSearch, 250)
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({})
  const [receiveUpdatePrices, setReceiveUpdatePrices] = useState(true)
  const [receivePaymentMode, setReceivePaymentMode] = useState<ReceivePaymentMode>('credit')
  const [receivePartialAmount, setReceivePartialAmount] = useState('')
  const [receivePaymentMethod, setReceivePaymentMethod] = useState<'cash' | 'card' | 'mixed'>('cash')
  const [payOrderId, setPayOrderId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'mixed'>('cash')

  const ordersQuery = useMemo(() => {
    const params = new URLSearchParams({ limit: '50' })
    if (statusFilter) params.set('status', statusFilter)
    return params.toString()
  }, [statusFilter])

  const { data: orders } = useQuery({
    queryKey: ['purchase-orders', ordersQuery],
    queryFn: () => apiRequest<PaginatedResult<PurchaseOrder>>(`/purchase-orders?${ordersQuery}`)
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => apiRequest<PaginatedResult<Supplier>>('/suppliers?limit=200')
  })

  const productQuery = useMemo(() => {
    const params = new URLSearchParams({ limit: '50' })
    if (debouncedProductSearch) params.set('search', debouncedProductSearch)
    if (supplierId) params.set('supplierId', supplierId)
    return params.toString()
  }, [debouncedProductSearch, supplierId])

  const { data: products } = useQuery({
    queryKey: ['po-products', productQuery],
    queryFn: () => apiRequest<PaginatedResult<Product>>(`/products?${productQuery}`),
    enabled: modalOpen && !!supplierId
  })

  const createMutation = useMutation({
    mutationFn: (data: { supplierId: string; lines: CartLine[]; notes?: string }) =>
      apiRequest('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: data.supplierId,
          notes: data.notes,
          lines: data.lines.map((l) => ({
            productId: l.productId,
            designation: l.designation,
            quantity: l.quantity,
            unitPrice: l.unitPrice
          }))
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Bon de commande créé')
      closePoModal()
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const receiveMutation = useMutation({
    mutationFn: ({
      id,
      lines: recvLines,
      updatePurchasePrices,
      payment
    }: {
      id: string
      lines: { productId: string; quantity: number }[]
      updatePurchasePrices: boolean
      payment: {
        mode: ReceivePaymentMode
        amountPaid?: number
        method?: 'cash' | 'card' | 'mixed'
      }
    }) =>
      apiRequest(`/purchase-orders/${id}/receive`, {
        method: 'POST',
        body: JSON.stringify({ lines: recvLines, updatePurchasePrices, payment })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Réception enregistrée')
      setReceiveId(null)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const payMutation = useMutation({
    mutationFn: ({ id, amount, method }: { id: string; amount: number; method: string }) =>
      apiRequest(`/purchase-orders/${id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ amount, method })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Paiement enregistré')
      setPayOrderId(null)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/purchase-orders/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
  })

  const closePoModal = () => {
    setModalOpen(false)
    setSupplierId('')
    setLines([])
    setPoNotes('')
    setProductSearch('')
  }

  const addLine = (product: Product) => {
    if (lines.some((l) => l.productId === product._id)) {
      setLines(
        lines.map((l) =>
          l.productId === product._id ? { ...l, quantity: l.quantity + 1 } : l
        )
      )
      return
    }
    setLines([
      ...lines,
      {
        productId: product._id,
        designation: product.designation,
        reference: product.reference,
        quantity: 1,
        unitPrice: product.purchasePrice,
        unit: 'pièce'
      }
    ])
    setProductSearch('')
  }

  const poTotal = roundMoney(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0))

  const orderToReceive = orders?.data?.find((o) => o._id === receiveId)
  const orderToPay = orders?.data?.find((o) => o._id === payOrderId)

  const receiveBatchHT = useMemo(() => {
    if (!orderToReceive) return 0
    return roundMoney(
      Object.entries(receiveQty).reduce((sum, [productId, qty]) => {
        if (qty <= 0) return sum
        const line = orderToReceive.lines.find((l) => l.productId.toString() === productId)
        return sum + (line ? qty * line.unitPrice : 0)
      }, 0)
    )
  }, [orderToReceive, receiveQty])

  const filteredOrders = useMemo(() => {
    if (!debouncedOrderSearch) return orders?.data ?? []
    const q = debouncedOrderSearch.toLowerCase()
    return (orders?.data ?? []).filter(
      (o) =>
        o.reference.toLowerCase().includes(q) ||
        (o.supplierId?.companyName || o.supplierName || '').toLowerCase().includes(q)
    )
  }, [orders?.data, debouncedOrderSearch])
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const fillReceiveAll = () => {
    if (!orderToReceive) return
    const qty: Record<string, number> = {}
    for (const line of orderToReceive.lines) {
      const remaining = line.quantity - line.receivedQuantity
      if (remaining > 0) qty[line.productId.toString()] = remaining
    }
    setReceiveQty(qty)
  }

  return (
    <div className="space-y-4">
      <PageHeader
        back
        title="Achats"
        subtitle="Réception rapide et bons de commande fournisseurs"
        actions={
          activeTab === 'orders' ? (
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={16} />
              Nouveau bon de commande
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('quick')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all flex items-center gap-2 ${activeTab === 'quick'
              ? 'bg-white dark:bg-slate-900 text-primary-600 border-b-2 border-primary-500'
              : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          <Zap size={16} />
          Réception rapide
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all flex items-center gap-2 ${activeTab === 'orders'
              ? 'bg-white dark:bg-slate-900 text-primary-600 border-b-2 border-primary-500'
              : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          <ClipboardList size={16} />
          Bons de commande
        </button>
      </div>

      {activeTab === 'quick' ? (
        <QuickReceivePanel />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <SearchInput
                value={orderSearch}
                onChange={setOrderSearch}
                onClear={() => setOrderSearch('')}
                placeholder="Rechercher par référence ou fournisseur..."
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'Tous les statuts' },
                { value: 'draft', label: 'Brouillon' },
                { value: 'sent', label: 'Envoyé' },
                { value: 'partial', label: 'Reçu partiellement' },
                { value: 'received', label: 'Reçu totalement' }
              ]}
            />
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Fournisseur</th>
                  <th>Total HT</th>
                  <th>Statut</th>
                  <th>Paiement</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((o) => (
                  <tr key={o._id}>
                    <td className="font-mono text-xs">{o.reference}</td>
                    <td>{o.supplierId?.companyName || o.supplierName}</td>
                    <td>{formatCurrency(o.totalHT)}</td>
                    <td>
                      <span className={statusBadge[o.status]}>{statusLabel[o.status]}</span>
                    </td>
                    <td>
                      {o.paymentStatus && o.paymentStatus !== 'none' ? (
                        <div className="space-y-1">
                          <span className={paymentBadge[o.paymentStatus]}>
                            {paymentLabel[o.paymentStatus]}
                          </span>
                          {(o.paymentStatus === 'unpaid' || o.paymentStatus === 'partial') && (
                            <p className="text-xs text-amber-600">
                              Reste {formatCurrency(o.amountDue ?? 0)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td>{formatDate(o.createdAt)}</td>
                    <td>
                      <div className="flex gap-1">
                        {o.status === 'draft' && (
                          <Button
                            variant="secondary"
                            onClick={() => statusMutation.mutate({ id: o._id, status: 'sent' })}
                          >
                            Envoyer
                          </Button>
                        )}
                        {o.status !== 'received' && (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setReceiveId(o._id)
                              setReceiveQty({})
                              setReceiveUpdatePrices(true)
                              setReceivePaymentMode('credit')
                              setReceivePartialAmount('')
                              setReceivePaymentMethod('cash')
                            }}
                          >
                            <Package size={14} />
                            Réception
                          </Button>
                        )}
                        {(o.paymentStatus === 'unpaid' || o.paymentStatus === 'partial') && (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setPayOrderId(o._id)
                              setPayAmount(String(o.amountDue ?? 0))
                              setPayMethod('cash')
                            }}
                          >
                            <Wallet size={14} />
                            Payer
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredOrders.length && (
              <EmptyState
                icon={<ClipboardList size={28} />}
                title="Aucun bon de commande"
                description="Créez un bon ou utilisez la réception rapide"
                action={
                  <Button onClick={() => setModalOpen(true)}>
                    <Plus size={16} />
                    Nouveau bon
                  </Button>
                }
              />
            )}
            <Pagination
              current={page}
              totalPages={Math.max(1, Math.ceil((filteredOrders.length ?? 0) / PAGE_SIZE))}
              onChange={(p) => setPage(p)}
            />
          </div>
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closePoModal}
        title="Nouveau bon de commande"
        size="xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Fournisseur *"
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value)
              setLines([])
            }}
            options={[
              { value: '', label: 'Sélectionner...' },
              ...(suppliers?.data?.map((s) => ({ value: s._id, label: s.companyName })) || [])
            ]}
          />
          <Input
            label="Notes"
            value={poNotes}
            onChange={(e) => setPoNotes(e.target.value)}
            placeholder="Référence fournisseur, délai..."
          />
        </div>

        {supplierId && (
          <div className="mt-3">
            <SearchInput
              value={productSearch}
              onChange={setProductSearch}
              onClear={() => setProductSearch('')}
              placeholder="Rechercher un produit à ajouter..."
            />
            {products?.data && products.data.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                {products.data.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => addLine(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-700 last:border-0"
                  >
                    <span className="font-mono text-xs text-slate-400 mr-2">{p.reference}</span>
                    {p.designation}
                    <span className="float-right text-slate-500">{formatCurrency(p.purchasePrice)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {lines.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Lignes ({lines.length})</p>
            {lines.map((line) => (
              <div key={line.productId} className="flex gap-2 items-center">
                <span className="flex-1 text-sm truncate">{line.designation}</span>
                 <div className="flex flex-col gap-1">
                    <label htmlFor={`quantity-${line.productId}`} className="text-xs font-medium text-slate-600 dark:text-slate-400">Quantité</label>
                <Input
                  style={{width:'6rem'}}
                  type="number"
                  min={1}
                  className="w-20 input-number-sm"
                  value={line.quantity}
                  onChange={(e) => {
                    const updated = lines.map((l) =>
                      l.productId === line.productId
                        ? { ...l, quantity: Math.max(1, +e.target.value) }
                        : l
                    )
                    setLines(updated)
                  }}
                />
                </div>
                 <div className="flex flex-col gap-1">
                    <label htmlFor={`price-${line.productId}`} className="text-xs font-medium text-slate-600 dark:text-slate-400">Prix HT</label>
                <Input
                  style={{width:'10rem'}}
                  type="number"
                  step="0.001"
                  min={0}
                  className="w-28 input-number-sm"
                  value={line.unitPrice}
                  onChange={(e) => {
                    const updated = lines.map((l) =>
                      l.productId === line.productId
                        ? { ...l, unitPrice: Math.max(0, +e.target.value) }
                        : l
                    )
                    setLines(updated)
                  }}
                />
                </div>
                <button
                  type="button"
                  onClick={() => setLines(lines.filter((l) => l.productId !== line.productId))}
                  className="text-red-500 hover:text-red-600 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <p className="text-right font-semibold text-primary-600">
              Total HT : {formatCurrency(poTotal)}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={closePoModal}>
            Annuler
          </Button>
          <Button
            loading={createMutation.isPending}
            onClick={() =>
              createMutation.mutate({ supplierId, lines, notes: poNotes || undefined })
            }
            disabled={!supplierId || !lines.length}
          >
            Créer le bon
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!receiveId}
        onClose={() => setReceiveId(null)}
        title={`Réception — ${orderToReceive?.reference ?? ''}`}
        size="lg"
      >
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm text-slate-500">
            {orderToReceive?.supplierId?.companyName || orderToReceive?.supplierName}
          </p>
          <Button variant="secondary" onClick={fillReceiveAll}>
            Recevoir tout le reste
          </Button>
        </div>

        {orderToReceive?.lines.map((line) => {
          const remaining = line.quantity - line.receivedQuantity
          const pid = line.productId.toString()
          return (
            <div
              key={pid}
              className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700"
            >
              <div>
                <p className="text-sm font-medium">{line.designation}</p>
                <p className="text-xs text-gray-500">
                  Commandé: {line.quantity} | Reçu: {line.receivedQuantity} | Reste: {remaining}
                </p>
              </div>
              <Input
                type="number"
                className="w-32 input-number"
                min={0}
                max={remaining}
                placeholder="Qté"
                disabled={remaining <= 0}
                value={receiveQty[pid] ?? ''}
                onChange={(e) =>
                  setReceiveQty({
                    ...receiveQty,
                    [pid]: Math.min(remaining, Math.max(0, +e.target.value))
                  })
                }
              />
            </div>
          )
        })}

        <label className="flex items-center gap-2 mt-4 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={receiveUpdatePrices}
            onChange={(e) => setReceiveUpdatePrices(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Mettre à jour les prix d&apos;achat produits
        </label>

        {receiveBatchHT > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <p className="text-sm font-medium">
              Paiement de cette réception — {formatCurrency(receiveBatchHT)} HT
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: 'paid', label: 'Payé comptant' },
                  { value: 'credit', label: 'À payer (dette)' },
                  { value: 'partial', label: 'Paiement partiel' }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReceivePaymentMode(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    receivePaymentMode === opt.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30'
                      : 'border-slate-200 dark:border-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {receivePaymentMode === 'partial' && (
              <Input
                label="Montant payé maintenant"
                type="number"
                step="0.001"
                min={0}
                max={receiveBatchHT}
                className="input-number"
                value={receivePartialAmount}
                onChange={(e) => setReceivePartialAmount(e.target.value)}
              />
            )}
            {receivePaymentMode !== 'credit' && (
              <Select
                label="Mode de paiement"
                value={receivePaymentMethod}
                onChange={(e) =>
                  setReceivePaymentMethod(e.target.value as 'cash' | 'card' | 'mixed')
                }
                options={[
                  { value: 'cash', label: 'Espèces' },
                  { value: 'card', label: 'Carte / Chèque' },
                  { value: 'mixed', label: 'Mixte' }
                ]}
              />
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setReceiveId(null)}>
            Annuler
          </Button>
          <Button
            loading={receiveMutation.isPending}
            onClick={() => {
              const recvLines = Object.entries(receiveQty)
                .filter(([, qty]) => qty > 0)
                .map(([productId, quantity]) => ({ productId, quantity }))
              if (!recvLines.length) {
                toast.error('Saisissez au moins une quantité')
                return
              }
              if (receiveId) {
                const payment: {
                  mode: ReceivePaymentMode
                  amountPaid?: number
                  method?: 'cash' | 'card' | 'mixed'
                } = { mode: receivePaymentMode }
                if (receivePaymentMode === 'partial') {
                  const amt = +receivePartialAmount
                  if (!amt || amt <= 0 || amt > receiveBatchHT) {
                    toast.error('Montant partiel invalide')
                    return
                  }
                  payment.amountPaid = amt
                  payment.method = receivePaymentMethod
                } else if (receivePaymentMode === 'paid') {
                  payment.method = receivePaymentMethod
                }
                receiveMutation.mutate({
                  id: receiveId,
                  lines: recvLines,
                  updatePurchasePrices: receiveUpdatePrices,
                  payment
                })
              }
            }}
          >
            Valider réception
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!payOrderId}
        onClose={() => setPayOrderId(null)}
        title={`Payer — ${orderToPay?.reference ?? ''}`}
      >
        <p className="text-sm text-slate-500 mb-3">
          {orderToPay?.supplierId?.companyName || orderToPay?.supplierName}
        </p>
        <p className="text-sm mb-4">
          Reste dû :{' '}
          <span className="font-semibold text-amber-600">
            {formatCurrency(orderToPay?.amountDue ?? 0)}
          </span>
        </p>
        <Input
          label="Montant à payer"
          type="number"
          step="0.001"
          min={0}
          max={orderToPay?.amountDue ?? 0}
          className="input-number"
          value={payAmount}
          onChange={(e) => setPayAmount(e.target.value)}
        />
        <Select
          label="Mode de paiement"
          value={payMethod}
          onChange={(e) => setPayMethod(e.target.value as 'cash' | 'card' | 'mixed')}
          options={[
            { value: 'cash', label: 'Espèces' },
            { value: 'card', label: 'Carte / Chèque' },
            { value: 'mixed', label: 'Mixte' }
          ]}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setPayOrderId(null)}>
            Annuler
          </Button>
          <Button
            loading={payMutation.isPending}
            onClick={() => {
              const amount = +payAmount
              if (!amount || amount <= 0) {
                toast.error('Montant invalide')
                return
              }
              if (payOrderId) payMutation.mutate({ id: payOrderId, amount, method: payMethod })
            }}
          >
            Enregistrer le paiement
          </Button>
        </div>
      </Modal>
    </div>
  )
}
