import { Button } from '@renderer/components/ui/Button'
import { EmptyState } from '@renderer/components/ui/EmptyState'
import { Input } from '@renderer/components/ui/Input'
import { Modal } from '@renderer/components/ui/Modal'
import { apiRequest } from '@renderer/lib/api'
import { formatCurrency, formatDateTime } from '@renderer/lib/format'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ClipboardList,
  CreditCard,
  FileText,
  Package,
  Wallet
} from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface Supplier {
  _id: string
  reference: string
  companyName: string
  balance: number
}

interface ActivityLine {
  designation: string
  quantity?: number
  unitPrice?: number
  receivedQuantity?: number
}

interface ActivityRow {
  _id: string
  date: string
  type: 'order' | 'receipt' | 'invoice' | 'payment'
  reference: string
  label: string
  amount?: number
  effect: 'debt_up' | 'debt_down' | 'neutral'
  status?: string
  paymentStatus?: string
  amountDue?: number
  amountPaid?: number
  lines?: ActivityLine[]
  method?: string
  notes?: string
}

interface SupplierProduct {
  _id: string
  reference: string
  designation: string
  purchasePrice: number
  stock: number
  unit: string
}

interface SupplierActivity {
  supplier: Supplier
  summary: {
    balance: number
    totalOrdersHT: number
    totalInvoiced: number
    totalPaid: number
    ordersCount: number
    receiptsCount: number
    invoicesCount: number
    paymentsCount: number
    productsCount: number
  }
  activities: ActivityRow[]
  products: SupplierProduct[]
}

const TYPE_LABELS: Record<ActivityRow['type'], string> = {
  order: 'Bon de commande',
  receipt: 'Réception',
  invoice: 'Facture fournisseur',
  payment: 'Paiement'
}

const TYPE_ICONS: Record<ActivityRow['type'], typeof Package> = {
  order: ClipboardList,
  receipt: Package,
  invoice: FileText,
  payment: Wallet
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  partial: 'Partiel',
  received: 'Reçu'
}

const PAYMENT_LABELS: Record<string, string> = {
  paid: 'Payé',
  unpaid: 'À payer',
  partial: 'Partiel',
  none: '—'
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'Toutes' },
  { value: 'order', label: 'Commandes' },
  { value: 'receipt', label: 'Réceptions' },
  { value: 'invoice', label: 'Factures' },
  { value: 'payment', label: 'Paiements' }
] as const

interface SupplierActivityModalProps {
  supplier: Supplier | null
  onClose: () => void
}

export function SupplierActivityModal({ supplier, onClose }: SupplierActivityModalProps) {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<(typeof FILTER_OPTIONS)[number]['value']>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash')
  const [tab, setTab] = useState<'timeline' | 'products'>('timeline')

  const { data, isLoading } = useQuery({
    queryKey: ['supplier-activity', supplier?._id],
    queryFn: () => apiRequest<SupplierActivity>(`/suppliers/${supplier!._id}/activity`),
    enabled: !!supplier
  })

  const paymentMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest('/supplier-payments', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-activity', supplier?._id] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Paiement enregistré')
      setPaymentOpen(false)
      setPaymentAmount('')
    },
    onError: (err: Error) => toast.error(err.message)
  })

  if (!supplier) return null

  const activities =
    data?.activities.filter((a) => filter === 'all' || a.type === filter) ?? []

  const openPayment = () => {
    setPaymentAmount(String(data?.summary.balance ?? supplier.balance))
    setPaymentMethod('cash')
    setPaymentOpen(true)
  }

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title={supplier.companyName}
        subtitle={`Réf. ${supplier.reference} — Historique complet`}
        size="xl"
      >
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : data ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card p-3 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/40">
                <p className="text-xs text-slate-500">Dette actuelle</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(data.summary.balance)}</p>
              </div>
              <div className="card p-3">
                <p className="text-xs text-slate-500">Commandes HT</p>
                <p className="text-lg font-bold">{formatCurrency(data.summary.totalOrdersHT)}</p>
                <p className="text-[10px] text-slate-400">{data.summary.ordersCount} bon(s)</p>
              </div>
              <div className="card p-3">
                <p className="text-xs text-slate-500">Facturé</p>
                <p className="text-lg font-bold text-amber-600">
                  {formatCurrency(data.summary.totalInvoiced)}
                </p>
              </div>
              <div className="card p-3">
                <p className="text-xs text-slate-500">Payé</p>
                <p className="text-lg font-bold text-emerald-600">
                  {formatCurrency(data.summary.totalPaid)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {data.summary.balance > 0 && (
                <Button onClick={openPayment}>
                  <Wallet size={16} />
                  Régler la dette
                </Button>
              )}
              <div className="flex gap-1 ml-auto">
                <button
                  type="button"
                  onClick={() => setTab('timeline')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    tab === 'timeline'
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                  }`}
                >
                  Opérations ({data.activities.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab('products')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    tab === 'products'
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                  }`}
                >
                  Produits ({data.products.length})
                </button>
              </div>
            </div>

            {tab === 'timeline' ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFilter(opt.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        filter === opt.value
                          ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/30'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {activities.map((row) => {
                    const Icon = TYPE_ICONS[row.type]
                    const expanded = expandedId === row._id
                    return (
                      <div
                        key={row._id}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : row._id)}
                          className="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <div
                            className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                              row.effect === 'debt_up'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                                : row.effect === 'debt_down'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                            }`}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-primary-600">
                                {TYPE_LABELS[row.type]}
                              </span>
                              <span className="font-mono text-xs text-slate-400">{row.reference}</span>
                              {row.status && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                  {STATUS_LABELS[row.status] ?? row.status}
                                </span>
                              )}
                              {row.type === 'order' && row.paymentStatus && row.paymentStatus !== 'none' && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                                    row.paymentStatus === 'paid'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {PAYMENT_LABELS[row.paymentStatus] ?? row.paymentStatus}
                                  {(row.paymentStatus === 'unpaid' || row.paymentStatus === 'partial') &&
                                    row.amountDue !== undefined &&
                                    ` · ${formatCurrency(row.amountDue)}`}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                              {row.label}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {formatDateTime(row.date)}
                              {row.method && ` — ${row.method === 'cash' ? 'Espèces' : 'Carte'}`}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            {row.amount !== undefined && (
                              <p
                                className={`font-bold flex items-center gap-0.5 justify-end ${
                                  row.effect === 'debt_up'
                                    ? 'text-amber-600'
                                    : row.effect === 'debt_down'
                                      ? 'text-emerald-600'
                                      : 'text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {row.effect === 'debt_up' && <ArrowUpRight size={14} />}
                                {row.effect === 'debt_down' && <ArrowDownLeft size={14} />}
                                {row.effect === 'debt_down' ? '−' : row.effect === 'debt_up' ? '+' : ''}
                                {formatCurrency(row.amount)}
                              </p>
                            )}
                          </div>
                        </button>
                        {expanded && (row.lines?.length || row.notes) && (
                          <div className="px-3 pb-3 pt-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                            {row.lines && row.lines.length > 0 && (
                              <table className="w-full text-xs mt-2">
                                <thead>
                                  <tr className="text-slate-400">
                                    <th className="text-left py-1">Produit</th>
                                    <th className="text-right py-1">Qté</th>
                                    {row.type === 'order' && (
                                      <>
                                        <th className="text-right py-1">P.U.</th>
                                        <th className="text-right py-1">Reçu</th>
                                      </>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.lines.map((line, i) => (
                                    <tr key={i}>
                                      <td className="py-1">{line.designation}</td>
                                      <td className="text-right py-1">{line.quantity ?? '—'}</td>
                                      {row.type === 'order' && (
                                        <>
                                          <td className="text-right py-1">
                                            {line.unitPrice !== undefined
                                              ? formatCurrency(line.unitPrice)
                                              : '—'}
                                          </td>
                                          <td className="text-right py-1">
                                            {line.receivedQuantity ?? 0}/{line.quantity}
                                          </td>
                                        </>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            {row.notes && (
                              <p className="text-xs text-slate-500 mt-2 italic">Note : {row.notes}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {!activities.length && (
                    <EmptyState
                      icon={<ClipboardList size={28} />}
                      title="Aucune opération"
                      description="Aucune transaction pour ce filtre"
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="table-container max-h-[50vh] overflow-y-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Réf.</th>
                      <th>Désignation</th>
                      <th>Prix achat</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p) => (
                      <tr key={p._id}>
                        <td className="font-mono text-xs">{p.reference}</td>
                        <td>{p.designation}</td>
                        <td>{formatCurrency(p.purchasePrice)}</td>
                        <td>
                          {p.stock} {p.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.products.length && (
                  <EmptyState
                    icon={<Package size={28} />}
                    title="Aucun produit"
                    description="Aucun produit lié à ce fournisseur"
                  />
                )}
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="Paiement fournisseur"
        subtitle={supplier.companyName}
      >
        <div className="space-y-4">
          <p className="text-sm">
            Dette :{' '}
            <strong className="text-red-600">
              {formatCurrency(data?.summary.balance ?? supplier.balance)}
            </strong>
          </p>
          <Input
            label="Montant"
            type="number"
            step="0.001"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
          />
          <div>
            <p className="label">Mode de paiement</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 ${
                  paymentMethod === 'cash'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                <Banknote size={18} />
                Espèces
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 ${
                  paymentMethod === 'card'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                <CreditCard size={18} />
                Carte
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPaymentOpen(false)}>
              Annuler
            </Button>
            <Button
              loading={paymentMutation.isPending}
              onClick={() =>
                paymentMutation.mutate({
                  type: 'supplier',
                  entityId: supplier._id,
                  amount: parseFloat(paymentAmount) || 0,
                  method: paymentMethod
                })
              }
            >
              Enregistrer
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
