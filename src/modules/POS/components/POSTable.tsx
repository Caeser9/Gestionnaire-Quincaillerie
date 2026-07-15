import { useState } from 'react'
import Pagination from '@renderer/components/ui/Pagination'
import { Trash2, Edit3, ChevronUp, ChevronDown, Copy, Check } from 'lucide-react'
import { formatCurrency } from '@renderer/lib/format'
import type { CalculatedLine } from '../utils/posCalculations'

interface POSTableProps {
  lines: CalculatedLine[]
  onUpdateLine: (lineId: string, updates: Partial<{ quantity: number; discount: number; unitPrice: number }>) => void
  onRemoveLine: (lineId: string) => void
  onEditLine: (line: CalculatedLine) => void
  onDuplicateLine: (line: CalculatedLine) => void
  onMoveLineUp: (index: number) => void
  onMoveLineDown: (index: number) => void
  selectedLineId: string | null
  onSelectLine: (lineId: string | null) => void
}

export function POSTable({
  lines,
  onUpdateLine,
  onRemoveLine,
  onEditLine,
  onDuplicateLine,
  onMoveLineUp,
  onMoveLineDown,
  selectedLineId,
  onSelectLine,
}: POSTableProps) {
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  if (lines.length === 0) {
    return (
      <div className="flex min-h-[180px] flex-1 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/30">
        <div className="p-8 text-center">
          <p className="font-medium text-slate-400">Aucun article dans la facture</p>
          <p className="mt-1 text-sm text-slate-400">Scannez ou saisissez un produit</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-50 dark:bg-slate-800/80">
            <th className="w-10 px-1 py-2 text-left"></th>
            <th className="w-16 px-2 py-2 text-left text-[10px] uppercase font-semibold text-slate-400">Réf.</th>
            <th className="px-2 py-2 text-left text-[10px] uppercase font-semibold text-slate-400">Désignation</th>
            <th className="px-2 py-2 text-right text-[10px] uppercase font-semibold text-slate-400">Qté</th>
            <th className="px-2 py-2 text-right text-[10px] uppercase font-semibold text-slate-400">Prix.U.HT (DT)</th>
            <th className="px-2 py-2 text-right text-[10px] uppercase font-semibold text-slate-400">Remise</th>
            <th className="px-2 py-2 text-right text-[10px] uppercase font-semibold text-slate-400">TVA</th>
            <th className="px-2 py-2 text-right text-[10px] uppercase font-semibold text-slate-400">Montant HT</th>
            <th className="px-2 py-2 text-right text-[10px] uppercase font-semibold text-slate-400">Montant TTC</th>
            <th className="w-32 px-1 py-2 text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {lines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((line, idx) => (
            <tr
              key={line.lineId}
              className={`transition-colors ${
                selectedLineId === line.lineId
                  ? 'bg-primary-50/50 ring-1 ring-primary-500 dark:bg-primary-900/10'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
              }`}
              onClick={() => onSelectLine(line.lineId)}
            >
              <td className="px-1 py-1.5 text-center">
                <div className="flex items-center justify-center gap-0.5">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onMoveLineUp(idx) }} disabled={idx === 0} className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30"><ChevronUp size={11} /></button>
                  <span className="w-3 text-center text-[10px] font-mono text-slate-300">{idx + 1}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onMoveLineDown(idx) }} disabled={idx >= lines.length - 1} className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30"><ChevronDown size={11} /></button>
                </div>
              </td>
              <td className="px-2 py-1.5"><span className="text-xs font-mono text-slate-500">{line.reference}</span></td>
              <td className="px-2 py-1.5">
                <span className="block max-w-[180px] truncate text-sm font-medium text-slate-800 dark:text-slate-200">{line.designation}</span>
              </td>
              <td className="px-2 py-1.5 text-right">
                {editingLineId === line.lineId ? (
                  <input type="number" min="1" max={line.stock > 0 ? line.stock : undefined} value={line.quantity} onChange={(e) => { const qty = parseInt(e.target.value, 10); if (qty >= 1 && (line.stock <= 0 || qty <= line.stock)) onUpdateLine(line.lineId, { quantity: qty }) }} className="w-14 rounded-lg border border-slate-200 bg-white px-1 py-1 text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900" onClick={(e) => e.stopPropagation()} />
                ) : (
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{line.quantity}</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right">
                {editingLineId === line.lineId ? (
                  <input type="number" step="0.001" min="0" value={line.unitPrice} onChange={(e) => { const price = parseFloat(e.target.value) || 0; onUpdateLine(line.lineId, { unitPrice: price }) }} className="w-16 rounded-lg border border-slate-200 bg-white px-1 py-1 text-right text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900" onClick={(e) => e.stopPropagation()} />
                ) : (
                  <span className="text-sm font-medium">{line.unitPrice}</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right">
                {editingLineId === line.lineId ? (
                  <div className="inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <input type="number" min="0" max="100" step="0.5" value={line.discount} onChange={(e) => { const disc = parseFloat(e.target.value) || 0; onUpdateLine(line.lineId, { discount: Math.max(0, Math.min(100, disc)) }) }} className="w-12 rounded-lg border border-slate-200 bg-white px-1 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900" />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                ) : (
                  <span className="text-sm text-slate-600 dark:text-slate-300">{line.discount}%</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right"><span className="text-sm">{line.tva}%</span></td>
              <td className="px-2 py-1.5 text-right"><span className="text-sm font-medium">{formatCurrency(line.lineHT)}</span></td>
              <td className="px-2 py-1.5 text-right"><span className="text-sm font-bold text-primary-600">{formatCurrency(line.lineTTC)}</span></td>
              <td className="px-2 py-1.5 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  {/* <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicateLine(line) }} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" title="Dupliquer"><Copy size={13} /></button> */}
                  <button type="button" onClick={(e) => { e.stopPropagation(); onEditLine(line); setEditingLineId((prev) => prev === line.lineId ? null : line.lineId) }} className={`rounded-lg border p-1.5 shadow-sm transition-colors ${editingLineId === line.lineId ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400' : 'border-slate-200 bg-white text-slate-500 hover:bg-amber-50 hover:text-amber-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`} title={editingLineId === line.lineId ? 'Terminer la modification' : 'Modifier dans la ligne'}>
                    {editingLineId === line.lineId ? <Check size={13} /> : <Edit3 size={13} />}
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onRemoveLine(line.lineId) }} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" title="Supprimer"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-2">
        <Pagination current={page} totalPages={Math.max(1, Math.ceil(lines.length / PAGE_SIZE))} onChange={(p) => setPage(p)} />
      </div>
    </div>
  )
}
