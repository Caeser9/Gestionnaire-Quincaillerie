import { ArrowLeft, Calendar, ClipboardList, FileText, Truck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@renderer/components/ui/Button'
import { POSClientSelect } from './POSClientSelect'
import type { Customer } from '../hooks/usePOSState'

interface POSHeaderProps {
  customers: Customer[]
  customerId: string
  customerName: string
  customerPhone: string
  customerAddress: string
  customerMatricule: string
  isWalkIn: boolean
  invoiceDate: string
  documentNumber: string
  orderNumber: string
  deliveryNumber: string
  onSelectCustomer: (customer: Customer | null) => void
  onCreateCustomer: (draft: { name: string; phone?: string; address?: string; matricule?: string }) => Promise<unknown>
  onUpdatePhone: (phone: string) => void
  onUpdateAddress: (address: string) => void
  onUpdateMatricule: (matricule: string) => void
  onDateChange: (date: string) => void
  onOrderNumberChange: (value: string) => void
  onDeliveryNumberChange: (value: string) => void
  back?: boolean
  backLabel?: string
  onBack?: () => void
}

export function POSHeader({
  customers,
  customerId,
  customerName,
  customerPhone,
  customerAddress,
  customerMatricule,
  isWalkIn,
  invoiceDate,
  documentNumber,
  orderNumber,
  deliveryNumber,
  onSelectCustomer,
  onCreateCustomer,
  onUpdatePhone,
  onUpdateAddress,
  onUpdateMatricule,
  onDateChange,
  onOrderNumberChange,
  onDeliveryNumberChange,
  back,
  backLabel = 'Retour',
  onBack,
}
  : POSHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    navigate(-1)
  }

  return (
    <div className="space-y-3">
      {back && (
        <Button variant="secondary" onClick={handleBack} className="whitespace-nowrap">
          <ArrowLeft size={16} />
          {backLabel}
        </Button>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Client & coordonnées</p>
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-600 dark:bg-primary-900/20">F1</span>
          </div>
          <POSClientSelect
            customers={customers}
            customerId={customerId}
            customerName={customerName}
            customerPhone={customerPhone}
            customerAddress={customerAddress}
            customerMatricule={customerMatricule}
            isWalkIn={isWalkIn}
            onSelectCustomer={onSelectCustomer}
            onCreateCustomer={onCreateCustomer}
            onUpdatePhone={onUpdatePhone}
            onUpdateAddress={onUpdateAddress}
            onUpdateMatricule={onUpdateMatricule}
          />

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="mb-2 flex items-center gap-2">
              <ClipboardList size={14} className="text-slate-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Références</p>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Bon de commande</span>
                <input type="text" value={orderNumber} onChange={(e) => onOrderNumberChange(e.target.value)} placeholder="Optionnel" className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900" />
              </label>
              <label className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
                <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  <Truck size={12} /> Bon de livraison
                </span>
                <input type="text" value={deliveryNumber} onChange={(e) => onDeliveryNumberChange(e.target.value)} placeholder="Optionnel" className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900" />
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Informations document</p>
            <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800">Caisse</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <Calendar size={13} /> Date
              </span>
              <input type="date" value={invoiceDate} onChange={(e) => onDateChange(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900" />
            </label>

            <label className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <FileText size={13} /> N° facture
              </span>
              <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-mono text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                {documentNumber || 'Généré automatiquement'}
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
