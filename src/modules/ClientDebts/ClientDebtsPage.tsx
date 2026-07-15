import { Button } from '@renderer/components/ui/Button'
import { EmptyState } from '@renderer/components/ui/EmptyState'
import { Input } from '@renderer/components/ui/Input'
import { Modal } from '@renderer/components/ui/Modal'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Select } from '@renderer/components/ui/Select'
import { apiRequest } from '@renderer/lib/api'
import { formatCurrency, formatDate } from '@renderer/lib/format'
import { TIMBRE_FISCAL_AMOUNT } from '@shared/constants'
import type { PaginatedResult } from '@shared/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Banknote, CreditCard, Filter, Users, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import Pagination from '@renderer/components/ui/Pagination'
import toast from 'react-hot-toast'

interface Customer {
  _id: string
  name: string
  creditBalance: number
}

interface ClientTrackingRow {
  _id: string
  date: string
  customerName: string
  customerId?: string
  reference: string
  totalInvoice: number
  amountPaid: number
  currentDebt: number
  maxPayment?: number
  awaitingTimbre?: boolean
}

type PaymentTarget =
  | { mode: 'slip'; row: ClientTrackingRow }
  | { mode: 'customer'; customer: Customer }

export default function ClientDebtsPage() {
  const queryClient = useQueryClient()
  const [customerId, setCustomerId] = useState('')
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const { data: customers } = useQuery({
    queryKey: ['customers-filter'],
    queryFn: () => apiRequest<PaginatedResult<Customer>>('/customers?limit=200')
  })

  const { data, isLoading } = useQuery({
    queryKey: ['client-tracking', customerId],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '100' })
      if (customerId) params.set('customerId', customerId)
      return apiRequest<PaginatedResult<ClientTrackingRow>>(
        `/finance/client-tracking?${params}`
      )
    }
  })

  const selectedCustomer = customers?.data?.find((c) => c._id === customerId)

  const paymentMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest<{ payment: unknown; invoice?: { reference: string } }>(
        '/customer-payments',
        { method: 'POST', body: JSON.stringify(payload) }
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['client-tracking'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customers-filter'] })
      queryClient.invalidateQueries({ queryKey: ['open-credits'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['finance'] })
      if (result.invoice?.reference) {
        toast.success(`Facture ${result.invoice.reference} créée — bon d'achat soldé`)
      } else {
        toast.success('Paiement enregistré')
      }
      closePaymentModal()
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const totalDebt = data?.data?.reduce((s, r) => s + r.currentDebt, 0) ?? 0
  const totalPaid = data?.data?.reduce((s, r) => s + r.amountPaid, 0) ?? 0
  const totalInvoiced = data?.data?.reduce((s, r) => s + r.totalInvoice, 0) ?? 0

  const customersWithDebt = useMemo(() => {
    return (customers?.data ?? []).filter((c) => c.creditBalance > 0)
  }, [customers?.data])

  const maxPayable = paymentTarget
    ? paymentTarget.mode === 'slip'
      ? (paymentTarget.row.maxPayment ?? paymentTarget.row.currentDebt)
      : paymentTarget.customer.creditBalance
    : 0

  const openPaymentForSlip = (row: ClientTrackingRow) => {
    setPaymentTarget({ mode: 'slip', row })
    setPaymentAmount(String(row.maxPayment ?? row.currentDebt))
    setPaymentMethod('cash')
    setPaymentNotes('')
  }

  const openPaymentForCustomer = (customer: Customer) => {
    setPaymentTarget({ mode: 'customer', customer })
    setPaymentAmount(String(customer.creditBalance))
    setPaymentMethod('cash')
    setPaymentNotes('')
  }

  const closePaymentModal = () => {
    setPaymentTarget(null)
    setPaymentAmount('')
    setPaymentNotes('')
  }

  const submitPayment = () => {
    if (!paymentTarget) return
    const amount = roundAmount(paymentAmount)
    if (!amount || amount <= 0) {
      toast.error('Montant invalide')
      return
    }
    if (amount > maxPayable) {
      toast.error(`Le montant ne peut pas dépasser ${formatCurrency(maxPayable)}`)
      return
    }

    const entityId =
      paymentTarget.mode === 'slip'
        ? paymentTarget.row.customerId
        : paymentTarget.customer._id

    if (!entityId) {
      toast.error('Client introuvable pour ce bon')
      return
    }

    paymentMutation.mutate({
      type: 'customer',
      entityId,
      amount,
      method: paymentMethod,
      purchaseSlipId: paymentTarget.mode === 'slip' ? paymentTarget.row._id : undefined,
      notes: paymentNotes.trim() || undefined
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back
        title="Suivi des Clients & Dettes"
        subtitle="Historique des bons d'achat et règlement des dettes par client"
      />

      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={18} className="text-slate-400" />
          <div className="flex-1 min-w-[200px] max-w-sm">
            <Select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              options={[
                { value: '', label: '— Tous les clients —' },
                ...(customers?.data?.map((c) => ({
                  value: c._id,
                  label: c.creditBalance > 0 ? `${c.name} (${formatCurrency(c.creditBalance)})` : c.name
                })) || [])
              ]}
            />
          </div>
          {selectedCustomer && selectedCustomer.creditBalance > 0 && (
            <Button onClick={() => openPaymentForCustomer(selectedCustomer)}>
              <Wallet size={16} />
              Régler toute la dette
            </Button>
          )}
        </div>
      </div>

      {customersWithDebt.length > 0 && !customerId && (
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Clients avec dette
          </p>
          <div className="flex flex-wrap gap-2">
            {customersWithDebt.map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => openPaymentForCustomer(c)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <span className="font-medium">{c.name}</span>
                <span className="font-bold">{formatCurrency(c.creditBalance)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Total facturé</p>
          <p className="text-xl font-bold">{formatCurrency(totalInvoiced)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Montant payé</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Dette actuelle totale</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalDebt)}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-200 border-t-primary-600" />
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>N° Bon</th>
                <th>Total</th>
                <th>Payé</th>
                <th>Dette</th>
                <th>Statut</th>
                <th className="w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data ?? [])
                .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                .map((row) => (
                <tr
                  key={row._id}
                  className={row.currentDebt > 0 ? 'bg-red-50/30 dark:bg-red-900/10' : ''}
                >
                  <td>{formatDate(row.date)}</td>
                  <td className="font-medium">{row.customerName}</td>
                  <td>
                    <span className="font-mono text-xs">{row.reference}</span>
                  </td>
                  <td>{formatCurrency(row.totalInvoice)}</td>
                  <td className="text-emerald-600 font-medium">
                    {formatCurrency(row.amountPaid)}
                  </td>
                  <td
                    className={
                      row.currentDebt > 0 ? 'text-red-600 font-bold' : 'text-emerald-600'
                    }
                  >
                    {formatCurrency(row.currentDebt)}
                  </td>
                  <td>
                    {row.awaitingTimbre ? (
                      <span className="text-xs font-medium text-amber-600">Timbre à payer</span>
                    ) : (
                      <span className="text-xs text-slate-500">Bon d&apos;achat</span>
                    )}
                  </td>
                  <td>
                    {row.currentDebt > 0 && (
                      <Button
                        variant="secondary"
                        className="!py-1.5 !px-2.5 text-xs"
                        onClick={() => openPaymentForSlip(row)}
                      >
                        <Wallet size={14} />
                        Payer
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            current={page}
            totalPages={Math.max(1, Math.ceil((data?.total ?? data?.data?.length ?? 0) / PAGE_SIZE))}
            onChange={(p) => setPage(p)}
          />
          {!data?.data?.length && (
            <EmptyState
              icon={<Users size={28} />}
              title="Aucune dette ouverte"
              description="Aucun bon d'achat avec solde restant pour ce filtre"
            />
          )}
        </div>
      )}

      <Modal
        isOpen={!!paymentTarget}
        onClose={closePaymentModal}
        title="Règlement de dette"
        subtitle={
          paymentTarget?.mode === 'slip'
            ? `${paymentTarget.row.customerName} — Bon ${paymentTarget.row.reference}`
            : paymentTarget?.customer.name
        }
      >
        {paymentTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Reste à payer</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(maxPayable)}</p>
              {paymentTarget.mode === 'slip' && !paymentTarget.row.awaitingTimbre && (
                <p className="text-xs text-slate-500 mt-1">
                  Inclut {formatCurrency(TIMBRE_FISCAL_AMOUNT)} de timbre fiscal — une facture sera
                  émise à la place du bon
                </p>
              )}
              {paymentTarget.mode === 'slip' && paymentTarget.row.awaitingTimbre && (
                <p className="text-xs text-amber-600 mt-1">
                  Timbre fiscal uniquement — la facture sera générée après ce paiement
                </p>
              )}
            </div>

            <Input
              label="Montant reçu"
              type="number"
              step="0.001"
              min="0"
              max={maxPayable}
              className="input-number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentAmount(String(maxPayable))}
                className="text-xs px-2.5 py-1 rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 hover:bg-primary-100"
              >
                Totalité ({formatCurrency(maxPayable)})
              </button>
              {paymentTarget.mode === 'slip' &&
                !paymentTarget.row.awaitingTimbre &&
                (paymentTarget.row.maxPayment ?? 0) > paymentTarget.row.currentDebt && (
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(String(paymentTarget.row.currentDebt))}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  >
                    Dette seule ({formatCurrency(paymentTarget.row.currentDebt)})
                  </button>
                )}
            </div>

            <div>
              <p className="label">Mode de paiement</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                    paymentMethod === 'cash'
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <Banknote size={18} />
                  Espèces
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                    paymentMethod === 'card'
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <CreditCard size={18} />
                  Carte
                </button>
              </div>
            </div>

            <Input
              label="Notes (optionnel)"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Ex. Acompte, chèque n°…"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={closePaymentModal}>
                Annuler
              </Button>
              <Button loading={paymentMutation.isPending} onClick={submitPayment}>
                <Wallet size={16} />
                Enregistrer le paiement
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function roundAmount(value: string): number {
  const n = parseFloat(value)
  if (Number.isNaN(n)) return 0
  return Math.round(n * 1000) / 1000
}
