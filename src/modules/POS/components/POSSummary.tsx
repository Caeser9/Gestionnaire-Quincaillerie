import { Printer, ShoppingCart } from 'lucide-react'
import { formatCurrency } from '@renderer/lib/format'
import type { POSSummary as POSSummaryType } from '../utils/posCalculations'
import { Button } from '@renderer/components/ui/Button'

interface POSSummaryProps {
  summary: POSSummaryType
  cartItemCount: number
  totalQuantity: number
  cashReceived: string
  onCashReceivedChange: (value: string) => void
  onCheckout: () => void
  onForceInvoice: () => void
  isPending: boolean
  hasCartItems: boolean
  showPurchaseCost: boolean
  purchaseCost: number
  timbreFiscal: number
  totalWithTimbre: number
}

export function POSSummary({
  summary,
  cartItemCount,
  totalQuantity,
  cashReceived,
  onCashReceivedChange,
  onCheckout,
  onForceInvoice,
  isPending,
  hasCartItems,
  showPurchaseCost,
  purchaseCost,
  timbreFiscal,
  totalWithTimbre,
}: POSSummaryProps) {
  const receivedAmount = parseFloat(cashReceived) || 0
  const isFullPayment = receivedAmount >= totalWithTimbre
  const amountDue = totalWithTimbre - Math.min(receivedAmount, totalWithTimbre)
  const change = receivedAmount > totalWithTimbre ? receivedAmount - totalWithTimbre : 0
  const documentType = isFullPayment ? 'Facture finale' : "Bon d'achat"

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Produits</p>
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">{cartItemCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Qté</p>
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">{totalQuantity}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">HT</p>
              <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(summary.totalHT)}</p>
            </div>
          </div>

          {showPurchaseCost && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="mb-1 flex items-center gap-2">
                <ShoppingCart size={15} className="text-amber-600" />
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Coût d’achat total</p>
              </div>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(purchaseCost)}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between rounded-2xl bg-primary-600 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-primary-100">À payer</p>
              <p className="mt-1 text-4xl font-black leading-tight">{formatCurrency(totalWithTimbre)}</p>
            </div>
            <button
              type="button"
              onClick={onForceInvoice}
              disabled={!hasCartItems || isPending}
              title="Forcer la facture et imprimer (même si paiement incomplet)"
              className="rounded-xl bg-white/15 p-2.5 transition-colors hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                <Printer size={18} />
                Imprimer facture
              </span>
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-primary-100">Montant reçu</label>
            <input type="number" step="0.001" min="0" value={cashReceived} onChange={(e) => onCashReceivedChange(e.target.value)} placeholder="0.000" className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-right text-lg font-semibold text-white placeholder:text-primary-200 focus:outline-none focus:ring-2 focus:ring-white" />

            <div className="flex items-center justify-between text-sm text-primary-100">
              <span>{hasCartItems ? (isFullPayment ? 'Paiement complet' : 'Paiement partiel') : 'En attente'}</span>
              <span>{documentType}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-primary-100">
              <span>Timbre fiscal</span>
              <span>{formatCurrency(timbreFiscal)}</span>
            </div>
            {amountDue > 0 && hasCartItems && <p className="text-sm text-primary-100">Reste : {formatCurrency(amountDue)}</p>}
            {change > 0 && <p className="text-sm text-emerald-200">Monnaie : {formatCurrency(change)}</p>}
          </div>

          <Button onClick={onCheckout} loading={isPending} className="mt-4 w-full !bg-white !text-primary-700 hover:!bg-primary-50" disabled={!hasCartItems}>
            <Printer size={18} />
            {hasCartItems ? `Valider — ${documentType} (F8)` : 'Valider (F8)'}
          </Button>
        </div>
      </div>
    </div>
  )
}
