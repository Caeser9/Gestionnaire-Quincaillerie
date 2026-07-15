import { useState } from 'react'
import { BarChart3, FileText, MapPin, MessageSquare } from 'lucide-react'
import { formatCurrency } from '@renderer/lib/format'

interface InvoiceTabsProps {
  totalHT: number
  totalTVA: number
  timbreFiscal: number
  totalTTC: number
  remark: string
  onRemarkChange: (value: string) => void
  bcNumber?: string
  blNumber?: string
}

export function InvoiceTabs({
  totalHT,
  totalTVA,
  timbreFiscal,
  totalTTC,
  remark,
  onRemarkChange,
  bcNumber: _bcNumber,
  blNumber: _blNumber,
}: InvoiceTabsProps) {
  const [activeTab, setActiveTab] = useState('tva')

  const tabs = [
    { id: 'tva', label: 'TVA', icon: <BarChart3 size={14} /> },
    { id: 'remark', label: 'Remarque', icon: <MessageSquare size={14} /> },
    { id: 'delivery', label: 'Livraison', icon: <MapPin size={14} /> },
    { id: 'export', label: 'Export', icon: <FileText size={14} /> },
  ]

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-900 text-primary-600 border-b-2 border-primary-500'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'tva' && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Total HT</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(totalHT)}</p>
            </div>
            <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">TVA</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(totalTVA)}</p>
            </div>
            <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Timbre</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(timbreFiscal)}</p>
            </div>
            <div className="px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20">
              <p className="text-[10px] uppercase tracking-wider text-primary-500">Total TTC</p>
              <p className="text-sm font-bold text-primary-600">{formatCurrency(totalTTC)}</p>
            </div>
          </div>
        )}

        {activeTab === 'remark' && (
          <textarea
            value={remark}
            onChange={(e) => onRemarkChange(e.target.value)}
            placeholder="Remarque libre sur la facture…"
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        )}

        {activeTab === 'delivery' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Bon de commande</label>
              <input
                type="text"
                placeholder="N° BC"
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Bon de livraison</label>
              <input
                type="text"
                placeholder="N° BL"
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Adresse livraison</label>
              <input
                type="text"
                placeholder="Adresse"
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Transporteur</label>
              <input
                type="text"
                placeholder="Nom transporteur"
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="flex flex-wrap gap-2">
            <button className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
              📄 Exporter PDF
            </button>
            <button className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
              📊 Exporter Excel
            </button>
            <button className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
              🖨️ Imprimer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}