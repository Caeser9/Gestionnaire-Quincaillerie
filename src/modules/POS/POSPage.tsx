import { useRef, useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { apiRequest } from '@renderer/lib/api'
import { useDebounce } from '@renderer/hooks'
import { useQuery } from '@tanstack/react-query'
import type { PaginatedResult } from '@shared/types'

import { POSHeader } from './components/POSHeader'
import { POSProductInput } from './components/POSProductInput'
import { POSTable } from './components/POSTable'
import { POSSummary } from './components/POSSummary'
import { ShortcutBar } from './components/ShortcutBar'
import { usePOSState } from './hooks/usePOSState'
import { usePOSShortcuts } from './hooks/usePOSShortcuts'
import { SaleDocumentModal, type SaleDocument } from './SaleDocumentModal'
import { canAddSelectedProductToCart, mapCartToSaleLines } from './utils/posCalculations'
import { extractProductSearchResults } from './utils/posSearch'
import { printA4Pdf } from '@renderer/lib/printDocument'

interface POSProduct {
  _id: string
  reference: string
  designation: string
  salePrice: number
  purchasePrice?: number
  discount: number
  tva: number
  stock: number
}

export default function POSPage() {
  const queryClient = useQueryClient()
  const state = usePOSState()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [lastDocument, setLastDocument] = useState<SaleDocument | null>(null)
  const [lastDocumentType, setLastDocumentType] = useState<'invoice' | 'purchase_slip' | null>(null)
  const [checkoutPending, setCheckoutPending] = useState(false)
  const debouncedCode = useDebounce(state.searchCode, 300)
  const debouncedDesignation = useDebounce(state.searchDesignation, 300)
  const purchaseCost = state.cart.reduce((sum, item) => sum + (item.purchasePrice ?? 0) * item.quantity, 0)

  const { data: searchResultsByCode } = useQuery({
    queryKey: ['pos-product-search-code', debouncedCode],
    queryFn: () => apiRequest<PaginatedResult<POSProduct>>(`/products?search=${debouncedCode}&limit=10`),
    enabled: debouncedCode.length >= 2,
  })

  const { data: searchResultsByDesignation } = useQuery({
    queryKey: ['pos-product-search-designation', debouncedDesignation],
    queryFn: () => apiRequest<PaginatedResult<POSProduct>>(`/products?search=${debouncedDesignation}&limit=10`),
    enabled: debouncedDesignation.length >= 2,
  })

  const { data: barcodeProduct } = useQuery({
    queryKey: ['pos-product-barcode', debouncedCode],
    queryFn: () => apiRequest<POSProduct>(`/products/barcode/${debouncedCode}`),
    enabled: debouncedCode.length >= 8 && /^\d+$/.test(debouncedCode),
  })

  useEffect(() => {
    if (barcodeProduct && !state.pendingItem) {
      state.setPendingItem({
        productId: barcodeProduct._id,
        reference: barcodeProduct.reference,
        designation: barcodeProduct.designation,
        unitPrice: barcodeProduct.salePrice,
        purchasePrice: barcodeProduct.purchasePrice ?? 0,
        discount: barcodeProduct.discount || 0,
        tva: barcodeProduct.tva,
        quantity: 1,
        stock: barcodeProduct.stock,
      })
      state.setSearchCode(barcodeProduct.reference)
      state.setSearchDesignation(barcodeProduct.designation)
    }
  }, [barcodeProduct, state])

  // Quotes loader
  const { data: quotesData } = useQuery({
    queryKey: ['quotes-for-pos'],
    queryFn: () => apiRequest<{ data: SaleDocument[] }>('/quotes?limit=200'),
  })

  const loadQuote = async (quoteId: string) => {
    if (!quoteId) return
    try {
      const quote = await apiRequest<SaleDocument>(`/quotes/${quoteId}`)
      // Map quote lines to cart items
      const mapped = (quote.lines || []).map((line) => ({
        lineId: `quote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: line.productId ? String(line.productId) : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        reference: line.reference || 'DIV',
        designation: line.designation || '',
        quantity: line.quantity || 1,
        unitPrice: line.unitPrice || 0,
        discount: line.discount ?? 0,
        tva: line.tva ?? 19,
        stock: 0,
        purchasePrice: 0,
        isCustom: !line.productId
      }))

      state.setCart(mapped)
      state.setCustomerId(quote.customerId ? String(quote.customerId) : '')
      state.setCustomerName(quote.customerName || '')
      state.setCustomerAddress(quote.customerAddress || '')
      state.setCustomerMatricule(quote.customerMatricule || '')
      state.setInvoiceDate(new Date(quote.createdAt).toISOString().slice(0,10))
      toast.success('Devis chargé dans la facture')
      setTimeout(() => searchInputRef.current?.focus(), 100)
    } catch (err) {
      toast.error('Impossible de charger le devis')
    }
  }

  useEffect(() => { setTimeout(() => searchInputRef.current?.focus(), 100) }, [])
  useEffect(() => {
    if (state.cart.length > 0 && !state.pendingItem) searchInputRef.current?.focus()
  }, [state.cart.length, state.pendingItem])

  const handleSelectSearchProduct = useCallback((product: POSProduct) => {
    if (!canAddSelectedProductToCart(product.stock, 1)) {
      toast.error('Produit indisponible en stock')
      return
    }

    state.setPendingItem({
      productId: product._id,
      reference: product.reference,
      designation: product.designation,
      unitPrice: product.salePrice,
      purchasePrice: product.purchasePrice ?? 0,
      discount: product.discount || 0,
      tva: product.tva,
      quantity: 1,
      stock: product.stock,
    })
    state.setSearchCode(product.reference)
    state.setSearchDesignation(product.designation)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }, [state])

  const handlePrint = useCallback(() => {
    if (!state.cart.length) return
    toast.success('Préparation de l’impression…')
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print()
    }
  }, [state.cart.length])

  usePOSShortcuts({
    F1: () => document.querySelector<HTMLButtonElement>('[data-pos-client-btn]')?.click(),
    F2: () => searchInputRef.current?.focus(),
    F3: () => { if (state.selectedLineId) { state.removeFromCart(state.selectedLineId); state.setSelectedLineId(null) } },
    F4: () => toast('Liste des prix', { icon: '📋' }),
    F6: () => { if (state.cart.length > 0) handlePrint() },
    F8: () => { if (state.cart.length > 0) void handleCheckout() },
    Escape: () => { state.setSelectedLineId(null); state.setPendingItem(null) },
  }, searchInputRef, true)

  const submitSale = useCallback(async (options?: { forceInvoice?: boolean; autoPrint?: boolean }) => {
    if (!state.cart.length) { toast.error('Panier vide'); return }

    const receivedAmount = state.cashReceived ? parseFloat(state.cashReceived) : undefined
    const amountPaid = receivedAmount !== undefined ? Math.min(receivedAmount, state.totalWithTimbre) : undefined
    const amountDue =
      amountPaid !== undefined ? Math.max(0, state.totalWithTimbre - amountPaid) : 0

    let resolvedCustomerId = state.customerId || undefined
    if (state.customerName.trim() && !state.isWalkIn && !state.customerId) {
      const linkedId = await state.linkCustomerByName(state.customerName)
      if (linkedId) resolvedCustomerId = linkedId
    }

    const needsCustomer = amountDue > 0
    if (needsCustomer && !resolvedCustomerId && !(state.customerName.trim() && !state.isWalkIn)) {
      toast.error(
        options?.forceInvoice
          ? 'Indiquez un client pour forcer la facture'
          : 'Indiquez un client pour enregistrer une dette (paiement partiel)'
      )
      return
    }

    setCheckoutPending(true)
    try {
      const result = await apiRequest<{
        invoice?: { _id: string; reference: string }
        purchaseSlip?: { _id: string; reference: string }
        documentType: 'invoice' | 'purchase_slip'
      }>('/sales', {
        method: 'POST',
        body: JSON.stringify({
          customerId: resolvedCustomerId,
          customerName: state.customerName.trim() || undefined,
          customerAddress: state.customerAddress.trim() || undefined,
          customerPhone: state.customerPhone.trim() || undefined,
          customerMatricule: state.customerMatricule.trim() || undefined,
          lines: mapCartToSaleLines(state.cart),
          paymentMethod: 'cash',
          includeTva: true,
          forceInvoice: options?.forceInvoice === true,
          amountPaid: amountPaid !== undefined ? amountPaid : undefined,
          cashReceived: receivedAmount,
          bcNumber: state.orderNumber.trim() || undefined,
          blNumber: state.deliveryNumber.trim() || undefined,
          deliveryPerson: state.deliveryDriverName.trim() || undefined,
          deliveryDriverName: state.deliveryDriverName.trim() || undefined,
          deliveryDriverCin: state.deliveryDriverCin.trim() || undefined,
          deliveryVehiclePlate: state.deliveryVehiclePlate.trim() || undefined,
          representative: state.deliveryDriverName.trim() || undefined,
          createdAt: state.invoiceDate ? state.invoiceDate : undefined,
          notes: state.remark.trim() || undefined,
        }),
      })

      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['purchase-slips'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] })
      queryClient.invalidateQueries({ queryKey: ['pos-products-category'] })

      const docId = result.invoice?._id ?? result.purchaseSlip?._id
      const docType = result.documentType
      const ref = result.invoice?.reference ?? result.purchaseSlip?.reference ?? ''
      state.resetState()

      if (docId) {
        try {
          const path = docType === 'purchase_slip' ? `/purchase-slips/${docId}` : `/invoices/${docId}`
          const doc = await apiRequest<SaleDocument>(path)
          setLastDocument(doc)
          setLastDocumentType(docType)
          if (options?.autoPrint && docType === 'invoice') {
            await printA4Pdf(`/invoices/${docId}/pdf`, `${ref}.pdf`)
          }
        } catch {
          toast.success(docType === 'purchase_slip' ? `Bon d'achat — ${ref}` : `Facture — ${ref}`)
          if (options?.autoPrint && docType === 'invoice' && result.invoice?._id) {
            await printA4Pdf(`/invoices/${result.invoice._id}/pdf`, `${ref}.pdf`)
          }
        }
      }
      setTimeout(() => searchInputRef.current?.focus(), 100)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la création de la vente')
    } finally {
      setCheckoutPending(false)
    }
  }, [state, queryClient])

  const handleCheckout = useCallback(() => submitSale(), [submitSale])
  const handleForceInvoice = useCallback(
    () => submitSale({ forceInvoice: true, autoPrint: true }),
    [submitSale]
  )

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden bg-slate-50 p-3 dark:bg-slate-950">
      <POSHeader
        back
        customers={state.customersList}
        customerId={state.customerId}
        customerName={state.customerName}
        customerPhone={state.customerPhone}
        customerAddress={state.customerAddress}
        customerMatricule={state.customerMatricule}
        isWalkIn={state.isWalkIn}
        invoiceDate={state.invoiceDate}
        documentNumber={state.documentNumber}
        orderNumber={state.orderNumber}
        deliveryNumber={state.deliveryNumber}
        onSelectCustomer={state.selectCustomer}
        onCreateCustomer={state.createCustomerFromPos}
        onUpdatePhone={state.setCustomerPhone}
        onUpdateAddress={state.setCustomerAddress}
        onUpdateMatricule={state.setCustomerMatricule}
        onDateChange={state.setInvoiceDate}
        onOrderNumberChange={state.setOrderNumber}
        onDeliveryNumberChange={state.setDeliveryNumber}
      />

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-600">Charger un devis :</label>
        <select
          className="input w-80"
          onChange={(e) => void loadQuote(e.target.value)}
          defaultValue=""
        >
          <option value="">Sélectionnez un devis…</option>
          {quotesData?.data?.map((q) => (
            <option key={q._id} value={q._id}>{`${q.reference} — ${q.customerName || 'Client comptant'}`}</option>
          ))}
        </select>
      </div>

      <POSProductInput
        ref={searchInputRef}
        pendingItem={state.pendingItem}
        searchCode={state.searchCode}
        searchDesignation={state.searchDesignation}
        onSearchCodeChange={state.setSearchCode}
        onSearchDesignationChange={state.setSearchDesignation}
        onQuantityChange={(qty) => state.pendingItem && state.setPendingItem({ ...state.pendingItem, quantity: qty })}
        onDiscountChange={(discount) => state.pendingItem && state.setPendingItem({ ...state.pendingItem, discount })}
        onUnitPriceChange={(price) => state.pendingItem && state.setPendingItem({ ...state.pendingItem, unitPrice: price })}
        onClearPending={() => { state.setPendingItem(null); state.setSearchCode(''); state.setSearchDesignation(''); searchInputRef.current?.focus() }}
        onAddPending={() => { state.addPendingToCart(); searchInputRef.current?.focus() }}
        onCreateCustomPending={(draft) => { state.addCustomItemToCart(draft); state.setSearchCode(''); state.setSearchDesignation(''); searchInputRef.current?.focus() }}
      />

      {debouncedCode.length >= 2 && !state.pendingItem && (
        extractProductSearchResults(searchResultsByCode).length > 0 ? (
          <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {extractProductSearchResults(searchResultsByCode).map((p) => (
              <button key={p._id} type="button"
                onClick={() => handleSelectSearchProduct(p)}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                <span className="w-20 truncate text-xs font-mono text-slate-400">{p.reference}</span>
                <span className="flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{p.designation}</span>
                <span className="text-xs text-slate-400">Stock: {p.stock}</span>
                <span className="text-sm font-bold text-primary-600">{p.salePrice.toFixed(3)} DT</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="py-4 text-center text-sm text-slate-500">Aucun produit trouvé</div>
          </div>
        )
      )}

      {debouncedDesignation.length >= 2 && !state.pendingItem && (
        extractProductSearchResults(searchResultsByDesignation).length > 0 ? (
          <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {extractProductSearchResults(searchResultsByDesignation).map((p) => (
              <button key={p._id} type="button"
                onClick={() => handleSelectSearchProduct(p)}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-2 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                <span className="w-20 truncate text-xs font-mono text-slate-400">{p.reference}</span>
                <span className="flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{p.designation}</span>
                <span className="text-xs text-slate-400">Stock: {p.stock}</span>
                <span className="text-sm font-bold text-primary-600">{p.salePrice.toFixed(3)} DT</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="py-4 text-center text-sm text-slate-500">Aucun produit trouvé</div>
          </div>
        )
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-0 flex-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <POSTable
            lines={state.calculatedLines}
            onUpdateLine={state.updateCartLine}
            onRemoveLine={state.removeFromCart}
            onEditLine={state.editLine}
            onDuplicateLine={state.duplicateLine}
            onMoveLineUp={state.moveLineUp}
            onMoveLineDown={state.moveLineDown}
            selectedLineId={state.selectedLineId}
            onSelectLine={state.setSelectedLineId}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
            <textarea value={state.customerAddress} onChange={(e) => state.setCustomerAddress(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50" placeholder="Adresse de livraison" />
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <input type="text" value={state.deliveryDriverName} onChange={(e) => state.setDeliveryDriverName(e.target.value)} placeholder="Nom livreur" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50" />
              <input type="text" value={state.deliveryDriverCin} onChange={(e) => state.setDeliveryDriverCin(e.target.value)} placeholder="CIN" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50" />
              <input type="text" value={state.deliveryVehiclePlate} onChange={(e) => state.setDeliveryVehiclePlate(e.target.value)} placeholder="Matricule Vehicule" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50" />
            </div>
          </div>
        </div>
      </div>

      <POSSummary
        summary={state.summary}
        cartItemCount={state.cartItemCount}
        totalQuantity={state.totalQuantity}
        cashReceived={state.cashReceived}
        onCashReceivedChange={state.setCashReceived}
        onCheckout={handleCheckout}
        onForceInvoice={handleForceInvoice}
        isPending={checkoutPending}
        hasCartItems={state.cart.length > 0}
        showPurchaseCost={false}
        purchaseCost={purchaseCost}
        timbreFiscal={state.timbreFiscal}
        totalWithTimbre={state.totalWithTimbre}
      />

      <ShortcutBar
        onF1={() => document.querySelector<HTMLButtonElement>('[data-pos-client-btn]')?.click()}
        onF2={() => searchInputRef.current?.focus()}
        onF3={() => { if (state.selectedLineId) { state.removeFromCart(state.selectedLineId); state.setSelectedLineId(null) } }}
        onF4={() => toast('Liste des prix', { icon: '📋' })}
        onF6={() => { if (state.cart.length > 0) handlePrint() }}
        onF8={() => { if (state.cart.length > 0) void handleCheckout() }}
        disabled={!state.cart.length}
      />

      <SaleDocumentModal
        document={lastDocument}
        documentType={lastDocumentType}
        onClose={() => { setLastDocument(null); setLastDocumentType(null); searchInputRef.current?.focus() }}
      />
    </div>
  )
}