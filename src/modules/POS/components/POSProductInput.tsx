import { forwardRef, useRef, useState, type KeyboardEvent } from 'react'
import { Search, Barcode, Plus, X } from 'lucide-react'
import { formatCurrency } from '@renderer/lib/format'
import { calculateLineHT, calculateLineTVA, calculateLineTTC } from '../utils/posCalculations'

interface PendingItem {
  productId: string
  reference: string
  designation: string
  unitPrice: number
  discount: number
  tva: number
  quantity: number
  stock: number
  isCustom?: boolean
}

interface POSProductInputProps {
  pendingItem: PendingItem | null
  searchCode: string
  searchDesignation: string
  onSearchCodeChange: (value: string) => void
  onSearchDesignationChange: (value: string) => void
  onQuantityChange: (qty: number) => void
  onDiscountChange: (discount: number) => void
  onUnitPriceChange: (price: number) => void
  onClearPending: () => void
  onAddPending: () => void
  onCreateCustomPending: (draft: { reference: string; designation: string; quantity: number; unitPrice: number; discount?: number }) => void
}

export const POSProductInput = forwardRef<HTMLInputElement, POSProductInputProps>(
  (
    {
      pendingItem,
      searchCode,
      searchDesignation,
      onSearchCodeChange,
      onSearchDesignationChange,
      onQuantityChange,
      onDiscountChange,
      onUnitPriceChange,
      onClearPending,
      onAddPending,
      onCreateCustomPending,
    },
    ref
  ) => {
    const qtyRef = useRef<HTMLInputElement>(null)
    const discountRef = useRef<HTMLInputElement>(null)
    const priceRef = useRef<HTMLInputElement>(null)
    const [freeProductLabel, setFreeProductLabel] = useState('')
    const [freeProductQty, setFreeProductQty] = useState(1)
    const [freeProductPrice, setFreeProductPrice] = useState(0)

    const pendingLineHT = pendingItem
      ? calculateLineHT(pendingItem.unitPrice, pendingItem.quantity, pendingItem.discount)
      : 0
    const pendingLineTVA = pendingItem
      ? calculateLineTVA(pendingLineHT, pendingItem.tva)
      : 0
    const pendingLineTTC = pendingItem
      ? calculateLineTTC(pendingLineHT, pendingLineTVA)
      : 0

    const hasManualEntry = (searchCode.trim() || searchDesignation.trim() || freeProductLabel.trim()).length > 0

    const handleCreateCustom = () => {
      const reference = searchCode.trim() || 'DIV'
      const designation = freeProductLabel.trim() || searchDesignation.trim() || reference
      if (!designation.trim()) return
      const quantity = Math.max(1, freeProductQty || 1)
      const unitPrice = Number.isFinite(freeProductPrice) ? freeProductPrice : 0
      onCreateCustomPending({ reference, designation, quantity, unitPrice, discount: 0 })
      setFreeProductLabel('')
      setFreeProductQty(1)
      setFreeProductPrice(0)
      setSearchCode('')
      setSearchDesignation('')
    }

    const handleFreeProductKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (freeProductLabel.trim()) {
          handleCreateCustom()
        }
      }
    }

    const handleAllFieldsKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (pendingItem) {
          onAddPending()
          return
        }
        if (searchCode.trim() || searchDesignation.trim() || freeProductLabel.trim()) {
          handleCreateCustom()
        }
      }
    }

    const handleClearPending = () => {
      setFreeProductLabel('')
      setFreeProductQty(1)
      setFreeProductPrice(0)
      onClearPending()
    }

    const handleCodeKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (pendingItem) {
          qtyRef.current?.focus()
          return
        }
      }
    }

    const handleDesignationKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (pendingItem) {
          qtyRef.current?.focus()
        }
      }
    }

    const handleQtyKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        priceRef.current?.focus()
      }
    }

    const handlePriceKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        discountRef.current?.focus()
      }
    }

    const handleDiscountKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onAddPending()
      }
    }

    return (
      <div className="relative z-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-600 dark:bg-primary-900/20 dark:text-primary-300">
                Saisie rapide
              </span>
              <span>Code • Désignation • Qté • Prix • Remise</span>
            </div>
            <span>Entrée pour ajouter • Échap pour annuler</span>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(80px,0.4fr)_minmax(100px,0.8fr)_70px_90px_70px_60px_100px_200px]">
            {/* Code / Référence */}
            <div className="relative min-w-0">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Code / Réf.</label>
              <div className="relative">
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
                  {searchCode.length >= 8 && /^\d+$/.test(searchCode) ? (
                    <Barcode size={15} />
                  ) : (
                    <Search size={15} />
                  )}
                </div>
                <input
                  ref={ref}
                  type="text"
                  value={searchCode}
                  onChange={(e) => onSearchCodeChange(e.target.value)}
                  onKeyDown={handleCodeKeyDown}
                  placeholder="Code / Réf."
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-8 pr-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Désignation */}
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Désignation</label>
              <input
                type="text"
                value={searchDesignation}
                onChange={(e) => onSearchDesignationChange(e.target.value)}
                onKeyDown={handleDesignationKeyDown}
                placeholder="Désignation"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900"
                autoComplete="off"
              />
            </div>

            {/* Quantité */}
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Qté</label>
              <input
                ref={qtyRef}
                type="number"
                min="1"
                max={pendingItem?.stock ?? 999}
                value={pendingItem?.quantity ?? ''}
                onChange={(e) => onQuantityChange(parseInt(e.target.value, 10) || 1)}
                onKeyDown={handleQtyKeyDown}
                onFocus={() => qtyRef.current?.select()}
                placeholder="Qté"
                disabled={!pendingItem}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-center text-base font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            {/* Prix unitaire HT */}
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Prix HT</label>
              <input
                ref={priceRef}
                type="number"
                step="0.001"
                min="0"
                value={pendingItem?.unitPrice ?? ''}
                onChange={(e) => onUnitPriceChange(parseFloat(e.target.value) || 0)}
                onKeyDown={handlePriceKeyDown}
                onFocus={() => priceRef.current?.select()}
                placeholder="Prix"
                disabled={!pendingItem}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-right text-base font-mono tabular-nums font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            {/* Remise */}
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Remise</label>
              <div className="relative">
                <input
                  ref={discountRef}
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={pendingItem?.discount ?? ''}
                  onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
                  onKeyDown={handleDiscountKeyDown}
                  onFocus={() => discountRef.current?.select()}
                  placeholder="Rem."
                  disabled={!pendingItem}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2.5 pr-6 text-right text-base font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
              </div>
            </div>

            {/* TVA */}
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">TVA</label>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2.5 pro-6 text-center text-base text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                {pendingItem ? `${pendingItem.tva}%` : '—'}
              </div>
            </div>

            {/* Montant */}
            <div className="min-w-0 text-right">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Montant TTC</label>
              {pendingItem ? (
                <div>
                  <p className="text-base font-bold text-primary-600">{formatCurrency(pendingLineTTC)}</p>
                  <p className="text-[12px] text-slate-400">M.HT: {formatCurrency(pendingLineHT)}</p>
                </div>
              ) : (
                <p className="py-2.5 text-sm text-slate-400">—</p>
              )}
            </div>

            {/* Boutons */}
            <div className="flex items-center gap-1.5" style={{ margin: 'auto' }}>
              
              {pendingItem ? (
                <>
                  <button
                    type="button"
                    onClick={handleClearPending}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:hover:bg-red-900/20"
                  >
                    <X size={15} />
                    <span className="hidden sm:inline">Effacer</span>
                  </button>
                  <button
                    type="button"
                    onClick={onAddPending}
                    className="flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
                  >
                    <Plus size={15} />
                    <span>Ajouter</span>
                  </button>
                </>
              ) : hasManualEntry ? (
                <button
                  type="button"
                  onClick={handleCreateCustom}
                  className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                >
                  Produit libre
                </button>
              ) : null}
            </div>
          </div>

          {!pendingItem && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 dark:border-amber-800/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-1 rounded-md bg-white/80 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-slate-900/40 dark:text-amber-300">
                <span>Nom</span>
              </div>
              <input
                type="text"
                value={freeProductLabel}
                onChange={(e) => setFreeProductLabel(e.target.value)}
                onKeyDown={handleFreeProductKeyDown}
                placeholder="Produit libre"
                className="min-w-[140px] flex-1 bg-transparent text-sm focus:outline-none"
                autoComplete="off"
              />
              <div className="flex items-center gap-1 rounded-md bg-white/80 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-slate-900/40 dark:text-amber-300">
                <span>Qté</span>
              </div>
              <input
                type="number"
                min="1"
                value={freeProductQty}
                onChange={(e) => setFreeProductQty(parseInt(e.target.value, 10) || 1)}
                onKeyDown={handleAllFieldsKeyDown}
                className="w-14 rounded-md border border-amber-200 bg-white px-2 py-1 text-sm focus:outline-none dark:border-amber-800/50 dark:bg-slate-900"
              />
              <div className="flex items-center gap-1 rounded-md bg-white/80 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-slate-900/40 dark:text-amber-300">
                <span>HT</span>
              </div>
              <input
                type="number"
                min="0"
                step="0.001"
                value={freeProductPrice}
                onChange={(e) => setFreeProductPrice(parseFloat(e.target.value) || 0)}
                onKeyDown={handleAllFieldsKeyDown}
                className="w-24 rounded-md border border-amber-200 bg-white px-2 py-1 text-sm focus:outline-none dark:border-amber-800/50 dark:bg-slate-900"
              />
            </div>
          )}
        </div>
      </div>
    )
  }
)

POSProductInput.displayName = 'POSProductInput'