import { Button } from '@renderer/components/ui/Button'
import { POSHeader } from '@modules/POS/components/POSHeader'
import { POSProductInput } from '@modules/POS/components/POSProductInput'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@renderer/lib/api'
import { useDebounce } from '@renderer/hooks'
import { extractProductSearchResults } from '@modules/POS/utils/posSearch'
import { POSTable } from '@modules/POS/components/POSTable'
import { Plus, Printer, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

interface DocumentCustomer {
  _id: string
  name: string
  phone?: string
  address?: string
  matricule?: string
}

export interface DocumentEditorLine {
  productId?: string
  reference?: string
  designation: string
  quantity: number
  unitPrice: number
  discount?: number
  tva?: number
  totalHT: number
  totalTTC: number
}

interface DocumentEditorProps {
  title: string
  subtitle: string
  customerName: string
  customerAddress: string
  includeTva: boolean
  onCustomerNameChange: (value: string) => void
  onCustomerAddressChange: (value: string) => void
  onIncludeTvaChange: (value: boolean) => void
  customers?: DocumentCustomer[]
  customerId?: string
  customerPhone?: string
  onSelectCustomer?: (customer: DocumentCustomer | null) => void
  onUpdatePhone?: (value: string) => void
  onUpdateAddress?: (value: string) => void
  // delivery fields (optional) shown for delivery notes
  showDeliveryFields?: boolean
  deliveryAddress?: string
  deliveryDriverName?: string
  deliveryDriverCin?: string
  deliveryVehiclePlate?: string
  onDeliveryAddressChange?: (value: string) => void
  onDeliveryDriverNameChange?: (value: string) => void
  onDeliveryDriverCinChange?: (value: string) => void
  onDeliveryVehiclePlateChange?: (value: string) => void
  lines: DocumentEditorLine[]
  onLinesChange: (lines: DocumentEditorLine[]) => void
  onSave: () => void
  onSaveAndPrint?: () => void
  saveLabel: string
  saveAndPrintLabel?: string
  saveLoading?: boolean
  showTimbre?: boolean
  showQuoteValidity?: boolean
  validityDays?: number
  onValidityDaysChange?: (days: number) => void
}

export function DocumentEditor({
  title,
  subtitle,
  customerName,
  customerAddress,
  includeTva,
  onCustomerNameChange,
  onCustomerAddressChange,
  onIncludeTvaChange,
  customers = [],
  customerId = '',
  customerPhone = '',
  onSelectCustomer,
  onUpdatePhone,
  onUpdateAddress,
  showDeliveryFields = false,
  deliveryAddress = '',
  deliveryDriverName = '',
  deliveryDriverCin = '',
  deliveryVehiclePlate = '',
  onDeliveryAddressChange,
  onDeliveryDriverNameChange,
  onDeliveryDriverCinChange,
  onDeliveryVehiclePlateChange,
  lines,
  onLinesChange,
  onSave,
  onSaveAndPrint,
  saveLabel,
  saveAndPrintLabel = 'Enregistrer et imprimer',
  saveLoading = false,
  showTimbre = false,
  showQuoteValidity = false,
  validityDays = 30,
  onValidityDaysChange,
}: DocumentEditorProps) {
  const queryClient = useQueryClient()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchCode, setSearchCode] = useState('')
  const [searchDesignation, setSearchDesignation] = useState('')
  const [pendingItem, setPendingItem] = useState<{
    productId: string
    reference: string
    designation: string
    unitPrice: number
    discount: number
    tva: number
    quantity: number
    stock: number
  } | null>(null)
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState(customerPhone)
  const [selectedCustomerMatricule, setSelectedCustomerMatricule] = useState('')
  const [localCustomerId, setLocalCustomerId] = useState(customerId)
  const debouncedCode = useDebounce(searchCode, 300)
  const debouncedDesignation = useDebounce(searchDesignation, 300)

  const { data: searchResultsByCode } = useQuery({
    queryKey: ['doc-product-search-code', debouncedCode],
    queryFn: () => apiRequest(`/products?search=${debouncedCode}&limit=10`),
    enabled: debouncedCode.length >= 2,
  })

  const { data: searchResultsByDesignation } = useQuery({
    queryKey: ['doc-product-search-designation', debouncedDesignation],
    queryFn: () => apiRequest(`/products?search=${debouncedDesignation}&limit=10`),
    enabled: debouncedDesignation.length >= 2,
  })

  const updateLine = (index: number, patch: Partial<DocumentEditorLine>) => {
    const next = [...lines]
    const current = next[index]
    const quantity = Number(patch.quantity ?? current.quantity ?? 0)
    const unitPrice = Number(patch.unitPrice ?? current.unitPrice ?? 0)
    const totalHT = quantity * unitPrice
    next[index] = { ...current, ...patch, quantity, unitPrice, totalHT, totalTTC: totalHT }
    onLinesChange(next)
  }

  const addLine = () => {
    onLinesChange([...lines, { reference: '', designation: '', quantity: 1, unitPrice: 0, totalHT: 0, totalTTC: 0 }])
  }

  const removeLine = (index: number) => {
    onLinesChange(lines.filter((_, i) => i !== index))
  }

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + (line.totalHT || 0), 0), [lines])
  const totalTva = includeTva ? lines.reduce((sum, line) => sum + Math.max(0, (line.totalTTC || 0) - (line.totalHT || 0)), 0) : 0
  const totalTtc = subtotal + totalTva

  const addPendingToLines = () => {
    if (!pendingItem) return
    const newLine = {
      productId: pendingItem.productId,
      reference: pendingItem.reference,
      designation: pendingItem.designation,
      quantity: pendingItem.quantity,
      unitPrice: pendingItem.unitPrice,
      discount: pendingItem.discount,
      tva: pendingItem.tva,
      totalHT: pendingItem.quantity * pendingItem.unitPrice,
      totalTTC: pendingItem.quantity * pendingItem.unitPrice
    }
    onLinesChange([...lines, newLine])
    setPendingItem(null)
    setSearchCode('')
    setSearchDesignation('')
    searchInputRef.current?.focus()
  }

  const handleSelectSearchProduct = (product: any) => {
    setPendingItem({
      productId: product._id,
      reference: product.reference,
      designation: product.designation,
      unitPrice: product.salePrice ?? product.unitPrice ?? 0,
      discount: product.discount ?? 0,
      tva: product.tva ?? 0,
      quantity: 1,
      stock: product.stock ?? 999,
    })
    setSearchCode(product.reference)
    setSearchDesignation(product.designation)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const handleSelectCustomer = (customer: DocumentCustomer | null) => {
    onSelectCustomer?.(customer)
    if (customer) {
      setLocalCustomerId(customer._id)
      onCustomerNameChange(customer.name)
      onCustomerAddressChange(customer.address ?? '')
      setSelectedCustomerPhone(customer.phone ?? '')
      setSelectedCustomerMatricule(customer.matricule ?? '')
      onUpdatePhone?.(customer.phone ?? '')
      onUpdateAddress?.(customer.address ?? '')
    } else {
      setLocalCustomerId('')
      onCustomerNameChange('')
      onCustomerAddressChange('')
      setSelectedCustomerPhone('')
      setSelectedCustomerMatricule('')
      onUpdatePhone?.('')
      onUpdateAddress?.('')
    }
  }

  const createCustomerFromDoc = async (draft: { name: string; phone?: string; address?: string; matricule?: string }) => {
    const created = await apiRequest<DocumentCustomer & { created?: boolean }>('/customers/quick', {
      method: 'POST',
      body: JSON.stringify(draft),
    })
    handleSelectCustomer(created)
    queryClient.invalidateQueries({ queryKey: ['customers'] })
    toast.success(created.created ? 'Client créé' : 'Client sélectionné')
    return created
  }

  const validUntilDate = useMemo(() => {
    const days = Math.max(1, validityDays || 1)
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date.toLocaleDateString('fr-FR')
  }, [validityDays])

  const currentLines = useMemo(() => lines.map((line, index) => ({
    lineId: `${index}-${line.designation}`,
    reference: line.reference || '',
    designation: line.designation,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discount: line.discount ?? 0,
    tva: 19,
    stock: 999,
    lineHT: line.totalHT,
    lineTTC: line.totalTTC,
    lineTotal: line.totalTTC,
  })), [lines])

  return (
    <div className="space-y-4 overflow-visible">
      <div>
        <POSHeader
          back={false}
          customers={customers}
          customerId={localCustomerId}
          customerName={customerName}
          customerPhone={selectedCustomerPhone}
          customerAddress={customerAddress}
          customerMatricule={selectedCustomerMatricule}
          isWalkIn={false}
          invoiceDate={new Date().toISOString().slice(0, 10)}
          documentNumber=""
          orderNumber=""
          deliveryNumber=""
          onSelectCustomer={handleSelectCustomer}
          onCreateCustomer={createCustomerFromDoc}
          onUpdatePhone={(value) => {
            setSelectedCustomerPhone(value)
            onUpdatePhone?.(value)
          }}
          onUpdateAddress={(value) => {
            onCustomerAddressChange(value)
            onUpdateAddress?.(value)
          }}
          onUpdateMatricule={setSelectedCustomerMatricule}
          onDateChange={() => {}}
          onOrderNumberChange={() => {}}
          onDeliveryNumberChange={() => {}}
        />
      </div>

      <div className="relative">
        <POSProductInput
          ref={searchInputRef}
          pendingItem={pendingItem}
          searchCode={searchCode}
          searchDesignation={searchDesignation}
          onSearchCodeChange={setSearchCode}
          onSearchDesignationChange={setSearchDesignation}
          onQuantityChange={(qty) => pendingItem && setPendingItem({ ...pendingItem, quantity: qty })}
          onDiscountChange={() => {}}
          onUnitPriceChange={(price) => pendingItem && setPendingItem({ ...pendingItem, unitPrice: price })}
          onClearPending={() => { setPendingItem(null); setSearchCode(''); setSearchDesignation('') }}
          onAddPending={addPendingToLines}
          onCreateCustomPending={(draft) => {
            const designation = draft.designation.trim()
            if (!designation) {
              return
            }
            const quantity = Math.max(1, draft.quantity || 1)
            const unitPrice = Number.isFinite(draft.unitPrice) ? draft.unitPrice : 0
            const reference = draft.reference.trim() || 'DIV'
            onLinesChange([
              ...lines,
              {
                reference,
                designation,
                quantity,
                unitPrice,
                discount: draft.discount ?? 0,
                tva: 19,
                totalHT: quantity * unitPrice,
                totalTTC: quantity * unitPrice,
              },
            ])
            setPendingItem(null)
            setSearchCode('')
            setSearchDesignation('')
            searchInputRef.current?.focus()
          }}
        />

        {debouncedCode.length >= 2 && !pendingItem && (
          extractProductSearchResults(searchResultsByCode).length > 0 ? (
            <div className="absolute left-0 right-0 z-50 mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {extractProductSearchResults(searchResultsByCode).map((p) => (
                <button key={p._id} type="button"
                  onClick={() => handleSelectSearchProduct(p)}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <span className="w-20 truncate text-xs font-mono text-slate-400">{p.reference}</span>
                  <span className="flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{p.designation}</span>
                  <span className="text-xs text-slate-400">Stock: {p.stock}</span>
                  <span className="text-sm font-bold text-primary-600">{(p.salePrice ?? p.unitPrice ?? 0).toFixed(3)} DT</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="absolute left-0 right-0 z-50 mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <div className="py-4 text-center text-sm text-slate-500">Aucun produit trouvé</div>
            </div>
          )
        )}

        {debouncedDesignation.length >= 2 && !pendingItem && (
          extractProductSearchResults(searchResultsByDesignation).length > 0 ? (
            <div className="absolute left-0 right-0 z-50 mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {extractProductSearchResults(searchResultsByDesignation).map((p) => (
                <button key={p._id} type="button"
                  onClick={() => handleSelectSearchProduct(p)}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <span className="w-20 truncate text-xs font-mono text-slate-400">{p.reference}</span>
                  <span className="flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{p.designation}</span>
                  <span className="text-xs text-slate-400">Stock: {p.stock}</span>
                  <span className="text-sm font-bold text-primary-600">{(p.salePrice ?? p.unitPrice ?? 0).toFixed(3)} DT</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="absolute left-0 right-0 z-50 mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <div className="py-4 text-center text-sm text-slate-500">Aucun produit trouvé</div>
            </div>
          )
        )}
      </div>

      <div className="relative z-0 min-h-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <POSTable
          lines={currentLines}
          onUpdateLine={() => {}}
          onRemoveLine={(lineId) => {
            const index = Number(lineId.split('-')[0])
            if (!Number.isNaN(index)) {
              const next = lines.filter((_, i) => i !== index)
              onLinesChange(next)
            }
          }}
          onEditLine={() => {}}
          onDuplicateLine={() => {}}
          onMoveLineUp={() => {}}
          onMoveLineDown={() => {}}
          selectedLineId={selectedLineId}
          onSelectLine={setSelectedLineId}
        />
      </div>

      {showDeliveryFields && (
        <div className="relative z-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary-50 p-1.5 text-primary-600 dark:bg-primary-900/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v10H3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4l3 3v4h-7" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Livraison</p>
              <p className="text-[11px] text-slate-500">Adresse et livreur</p>
            </div>
          </div>

          <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_0.9fr]">
            <textarea value={deliveryAddress} onChange={(e) => onDeliveryAddressChange?.(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50" placeholder="Adresse de livraison" />
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <input type="text" value={deliveryDriverName} onChange={(e) => onDeliveryDriverNameChange?.(e.target.value)} placeholder="Nom livreur" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50" />
              <input type="text" value={deliveryDriverCin} onChange={(e) => onDeliveryDriverCinChange?.(e.target.value)} placeholder="CIN" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50" />
              <input type="text" value={deliveryVehiclePlate} onChange={(e) => onDeliveryVehiclePlateChange?.(e.target.value)} placeholder="Matricule" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50" />
            </div>
          </div>
        </div>
      )}

      {showQuoteValidity && (
        <div className="relative z-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Validité du devis</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Durée de validité (jours)</label>
              <input
                type="number"
                min={1}
                value={validityDays}
                onChange={(e) => onValidityDaysChange?.(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="mt-1 w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-mono tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div className="rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-800 dark:border-primary-800/50 dark:bg-primary-950/30 dark:text-primary-200">
              Valable jusqu&apos;au <strong>{validUntilDate}</strong>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex justify-between gap-8"><span>Total HT</span><span>{subtotal.toFixed(3)} DT</span></div>
            {includeTva && <div className="flex justify-between gap-8"><span>TVA</span><span>{totalTva.toFixed(3)} DT</span></div>}
            <div className="flex justify-between gap-8 border-t border-slate-200 pt-2 font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100"><span>Total TTC</span><span>{totalTtc.toFixed(3)} DT</span></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" loading={saveLoading} onClick={onSave}>{saveLabel}</Button>
            {onSaveAndPrint && (
              <Button loading={saveLoading} onClick={onSaveAndPrint}>
                <Printer size={16} />
                {saveAndPrintLabel}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
