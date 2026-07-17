import { Button } from '@renderer/components/ui/Button'
import { EmptyState } from '@renderer/components/ui/EmptyState'
import { Input } from '@renderer/components/ui/Input'
import { Modal } from '@renderer/components/ui/Modal'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { apiDownload, apiRequest } from '@renderer/lib/api'
import { formatCurrency, formatDate, formatDateTime } from '@renderer/lib/format'
import { printA4Pdf } from '@renderer/lib/printDocument'
import type { PaginatedResult } from '@shared/types'
import { TIMBRE_FISCAL_AMOUNT } from '@shared/constants'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Eye, FileText, Plus, Printer, Trash2, Edit } from 'lucide-react'
import { useMemo, useEffect, useState } from 'react'
import Pagination from '@renderer/components/ui/Pagination'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { parseBillingTab, type BillingTab } from '@shared/constants/billing'
import { SearchInput } from '@renderer/components/ui/SearchInput'

interface InvoiceLine {
  designation: string
  quantity: number
  unitPrice: number
  discount?: number
  totalHT: number
  totalTTC: number
}

interface SaleDocument {
  _id: string
  reference: string
  customerName?: string
  customerAddress?: string
  deliveryDriverName?: string
  deliveryDriverCin?: string
  deliveryVehiclePlate?: string
  createdAt: string
  totalHT: number
  totalTVA: number
  timbreFiscal?: number
  totalTTC: number
  amountPaid: number
  amountDue: number
  includeTva?: boolean
  convertedInvoiceId?: string
  sourceInvoiceId?: string
  lines: InvoiceLine[]
}

export default function InvoicesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const tab = parseBillingTab(searchParams.get('tab'))
  const setTab = (next: BillingTab) => setSearchParams({ tab: next })
  const [search, setSearch] = useState('')
  const [selectedQuote, setSelectedQuote] = useState<SaleDocument | null>(null)
  const [selected, setSelected] = useState<SaleDocument | null>(null)
  const [selectedPurchaseSlip, setSelectedPurchaseSlip] = useState<SaleDocument | null>(null)
  const [selectedDelivery, setSelectedDelivery] = useState<SaleDocument | null>(null)
  const [editCustomerName, setEditCustomerName] = useState('')
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => apiRequest<PaginatedResult<SaleDocument>>('/invoices?limit=100')
  })

  const { data: purchaseSlipsData, isLoading: purchaseSlipsLoading } = useQuery({
    queryKey: ['purchase-slips'],
    queryFn: () => apiRequest<PaginatedResult<SaleDocument>>('/purchase-slips?limit=100')
  })

  const { data: deliveryNotesData, isLoading: deliveryNotesLoading } = useQuery({
    queryKey: ['delivery-notes'],
    queryFn: () => apiRequest<{ data: SaleDocument[] }>('/delivery-notes?limit=100')
  })

  const { data: quotesData, isLoading: quotesLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => apiRequest<{ data: SaleDocument[] }>('/quotes?limit=100')
  })

  useEffect(() => {
    setPageInvoices(1)
    setPagePurchaseSlips(1)
    setPageDeliveryNotes(1)
    setPageQuotes(1)
  }, [search, tab])

  useEffect(() => {
    const state = location.state as { tab?: BillingTab } | null
    if (state?.tab) {
      setSearchParams({ tab: state.tab })
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate, setSearchParams])

  const [pageInvoices, setPageInvoices] = useState(1)
  const [pagePurchaseSlips, setPagePurchaseSlips] = useState(1)
  const [pageDeliveryNotes, setPageDeliveryNotes] = useState(1)
  const [pageQuotes, setPageQuotes] = useState(1)
  const PAGE_SIZE = 10

  const filterDocs = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (docs: SaleDocument[]) => {
      if (!q) return docs
      return docs.filter(
        (doc) =>
          doc.reference.toLowerCase().includes(q) ||
          (doc.customerName || 'Client comptant').toLowerCase().includes(q)
      )
    }
  }, [search])

  const filteredInvoices = useMemo(() => filterDocs(data?.data ?? []), [data?.data, filterDocs])
  const filteredPurchaseSlips = useMemo(
    () => filterDocs(purchaseSlipsData?.data ?? []),
    [purchaseSlipsData?.data, filterDocs]
  )
  const filteredDeliveryNotes = useMemo(
    () => filterDocs(deliveryNotesData?.data ?? []),
    [deliveryNotesData?.data, filterDocs]
  )
  const filteredQuotes = useMemo(() => filterDocs(quotesData?.data ?? []), [quotesData?.data, filterDocs])

  const billableDeliveryNotes = useMemo(
    () => (deliveryNotesData?.data ?? []).filter((doc) => !doc.convertedInvoiceId),
    [deliveryNotesData?.data]
  )

  const selectedDeliveryDocs = useMemo(
    () => billableDeliveryNotes.filter((doc) => selectedDeliveryIds.includes(doc._id)),
    [billableDeliveryNotes, selectedDeliveryIds]
  )

  const selectedDeliveryPreview = useMemo(() => {
    const subtotal = selectedDeliveryDocs.reduce((sum, doc) => sum + doc.totalTTC, 0)
    return {
      count: selectedDeliveryDocs.length,
      customerName: selectedDeliveryDocs[0]?.customerName || 'Client comptant',
      subtotal,
      totalWithTimbre: subtotal + (selectedDeliveryDocs.length > 0 ? TIMBRE_FISCAL_AMOUNT : 0)
    }
  }, [selectedDeliveryDocs])

  const customerKey = (name?: string) => (name?.trim() || 'Client comptant').toLowerCase()

  const toggleDeliverySelection = (doc: SaleDocument) => {
    if (doc.convertedInvoiceId) return

    setSelectedDeliveryIds((current) => {
      if (current.includes(doc._id)) {
        return current.filter((id) => id !== doc._id)
      }

      if (current.length > 0) {
        const anchor = billableDeliveryNotes.find((item) => item._id === current[0])
        if (anchor && customerKey(anchor.customerName) !== customerKey(doc.customerName)) {
          toast.error('Les bons sélectionnés doivent appartenir au même client')
          return current
        }
      }

      return [...current, doc._id]
    })
  }

  const toggleSelectAllOnPage = (pageDocs: SaleDocument[]) => {
    const selectable = pageDocs.filter((doc) => !doc.convertedInvoiceId)
    if (!selectable.length) return

    const pageIds = selectable.map((doc) => doc._id)
    const allSelected = pageIds.every((id) => selectedDeliveryIds.includes(id))

    if (allSelected) {
      setSelectedDeliveryIds((current) => current.filter((id) => !pageIds.includes(id)))
      return
    }

    const anchorId = selectedDeliveryIds[0]
    const anchor = billableDeliveryNotes.find((item) => item._id === anchorId)
    const anchorCustomer = anchor ? customerKey(anchor.customerName) : customerKey(selectable[0].customerName)

    const sameClientOnPage = selectable.filter(
      (doc) => customerKey(doc.customerName) === anchorCustomer
    )

    if (sameClientOnPage.length !== selectable.length) {
      toast.error('Seuls les bons du même client ont été sélectionnés sur cette page')
    }

    setSelectedDeliveryIds((current) => {
      const merged = new Set(current)
      for (const doc of sameClientOnPage) merged.add(doc._id)
      return Array.from(merged)
    })
  }

  useEffect(() => {
    if (tab !== 'delivery-notes') setSelectedDeliveryIds([])
  }, [tab])

  const convertDeliveryMutation = useMutation({
    mutationFn: (deliveryIds: string[]) =>
      apiRequest('/delivery-notes/convert', {
        method: 'POST',
        body: JSON.stringify({ deliveryIds })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] })
      toast.success('Facture créée à partir des bons de livraison')
      setConvertModalOpen(false)
      setSelectedDeliveryIds([])
      setTab('invoices')
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const createBlFromInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      apiRequest(`/delivery-notes/from-invoice/${invoiceId}`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] })
      toast.success('Bon de livraison créé depuis la facture')
      setTab('delivery-notes')
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, customerName }: { id: string; customerName: string }) =>
      apiRequest(`/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ customerName })
      }),
    onSuccess: (updated: SaleDocument) => {
      setSelected(updated)
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Nom du client mis à jour')
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const handleDownloadPdf = async (id: string, reference: string) => {
    try {
      const blob = await apiDownload(`/invoices/${id}/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reference}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF téléchargé')
    } catch {
      toast.error('Erreur téléchargement PDF')
    }
  }

  const handleDownloadPurchaseSlipPdf = async (id: string, reference: string) => {
    try {
      const blob = await apiDownload(`/purchase-slips/${id}/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reference}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF téléchargé')
    } catch {
      toast.error('Erreur téléchargement PDF')
    }
  }

  const handleDownloadDeliveryPdf = async (id: string, reference: string) => {
    try {
      const blob = await apiDownload(`/delivery-notes/${id}/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reference}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF téléchargé')
    } catch {
      toast.error('Erreur téléchargement PDF')
    }
  }

  const handlePrintThermal = async (id: string) => {
    try {
      const receipt = await apiRequest<{ data: string }>(`/invoices/${id}/receipt`)
      if (window.electronAPI) {
        await window.electronAPI.printThermal(receipt.data)
        toast.success("Ticket envoyé à l'imprimante")
      } else {
        toast.error('Impression disponible en mode desktop uniquement')
      }
    } catch {
      toast.error('Erreur impression')
    }
  }

  const handlePrintA4 = async (id: string, reference?: string) => {
    await printA4Pdf(`/invoices/${id}/pdf`, `${reference || 'facture'}.pdf`)
  }

  const openDetail = async (id: string) => {
    try {
      const inv = await apiRequest<SaleDocument>(`/invoices/${id}`)
      setSelected(inv)
      setEditCustomerName(inv.customerName || '')
    } catch {
      toast.error('Impossible de charger la facture')
    }
  }

  const openPurchaseSlipDetail = async (id: string) => {
    try {
      const slip = await apiRequest<SaleDocument>(`/purchase-slips/${id}`)
      setSelectedPurchaseSlip(slip)
    } catch {
      toast.error('Impossible de charger le bon d\'achat')
    }
  }

  const openDeliveryDetail = async (id: string) => {
    try {
      const delivery = await apiRequest<SaleDocument>(`/delivery-notes/${id}`)
      setSelectedDelivery(delivery)
    } catch {
      toast.error('Impossible de charger le bon de livraison')
    }
  }

  const openQuoteDetail = async (id: string) => {
    try {
      const quote = await apiRequest<SaleDocument>(`/quotes/${id}`)
      setSelectedQuote(quote)
    } catch {
      toast.error('Impossible de charger le devis')
    }
  }

  const handleDownloadQuotePdf = async (id: string, reference: string) => {
    try {
      const blob = await apiDownload(`/quotes/${id}/pdf`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reference}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF téléchargé')
    } catch {
      toast.error('Erreur téléchargement PDF')
    }
  }

  const handlePrintQuotePdf = async (id: string, reference: string) => {
    await printA4Pdf(`/quotes/${id}/pdf`, `${reference}.pdf`)
  }

  const handlePrintPurchaseSlipPdf = async (id: string, reference: string) => {
    await printA4Pdf(`/purchase-slips/${id}/pdf`, `${reference}.pdf`)
  }

  const handlePrintDeliveryPdf = async (id: string, reference: string) => {
    await printA4Pdf(`/delivery-notes/${id}/pdf`, `${reference}.pdf`)
  }

  const deleteInvoiceMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/invoices/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Facture supprimée')
      setSelected(null)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const convertQuoteToInvoiceMutation = useMutation({
    mutationFn: (quoteId: string) =>
      apiRequest(`/quotes/${quoteId}/convert-to-invoice`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      if (data.alreadyConverted) {
        toast.success('Facture existante affichée')
      } else {
        toast.success('Facture créée à partir du devis')
      }
      setTab('invoices')
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const deleteQuoteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/quotes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      toast.success('Devis supprimé')
      setSelectedQuote(null)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const deletePurchaseSlipMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/purchase-slips/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-slips'] })
      toast.success('Bon d\'achat supprimé')
      setSelectedPurchaseSlip(null)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  if (isLoading || purchaseSlipsLoading || deliveryNotesLoading || quotesLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back
        title="Gestion des transactions"
        subtitle="Historique des factures, devis, bons d'achat et bons de livraison"
        actions={
          <Link to="/pos" className="btn-primary btn-sm inline-flex items-center gap-1">
            <Plus size={16} /> Facturation
          </Link>
        }
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        onClear={() => setSearch('')}
        placeholder="Rechercher par n° ou client…"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
          <button
          type="button"
          onClick={() => setTab('invoices')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
            tab === 'invoices' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500'
          }`}
        >
          Factures
        </button>
          <button
            type="button"
            onClick={() => setTab('quotes')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              tab === 'quotes' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500'
            }`}
          >
            Devis
          </button>
          <button
            type="button"
            onClick={() => setTab('purchase-slips')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              tab === 'purchase-slips' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500'
            }`}
          >
            Bons d&apos;achat
          </button>
          <button
            type="button"
            onClick={() => setTab('delivery-notes')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              tab === 'delivery-notes' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500'
            }`}
          >
            Bons de livraison
          </button>
        </div>
        {tab === 'invoices' && (
          <Link to="/pos" className="btn-secondary btn-sm inline-flex items-center gap-1">
            <Plus size={16} /> Ouvrir la facturation
          </Link>
        )}
        {tab === 'quotes' && (
          <Link to="/quotes/new" className="btn-primary btn-sm inline-flex items-center gap-1">
            <Plus size={16} /> Nouveau devis
          </Link>
        )}
        {tab === 'delivery-notes' && (
          <div className="flex flex-wrap gap-2">
            <Link to="/delivery-notes/new" className="btn-secondary btn-sm inline-flex items-center gap-1">
              <Plus size={16} /> Nouveau bon
            </Link>
            {selectedDeliveryIds.length > 0 ? (
              <Button
                loading={convertDeliveryMutation.isPending}
                onClick={() => setConvertModalOpen(true)}
              >
                Fusionner en facture ({selectedDeliveryIds.length})
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setConvertModalOpen(true)} disabled={!billableDeliveryNotes.length}>
                Fusionner des bons en facture
              </Button>
            )}
          </div>
        )}
      </div>

      {tab === 'invoices' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>N° Facture</th>
                <th>Client</th>
                <th>Date</th>
                <th>TVA</th>
                <th>Total TTC</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.slice((pageInvoices - 1) * PAGE_SIZE, pageInvoices * PAGE_SIZE).map((inv) => (
                <tr key={inv._id}>
                  <td>
                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                      {inv.reference}
                    </span>
                  </td>
                  <td className="font-medium">{inv.customerName || 'Client comptant'}</td>
                  <td>{formatDate(inv.createdAt)}</td>
                  <td>
                    <span className={inv.includeTva ? 'badge-info' : 'badge-neutral'}>
                      {inv.includeTva ? 'Oui' : 'Non'}
                    </span>
                  </td>
                  <td className="font-semibold">{formatCurrency(inv.totalTTC)}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openDetail(inv._id)} className="btn-ghost btn-sm" title="Voir">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => handlePrintA4(inv._id, inv.reference)} className="btn-ghost btn-sm" title="Imprimer A4">
                        <Printer size={15} />
                      </button>
                      <button onClick={() => handleDownloadPdf(inv._id, inv.reference)} className="btn-ghost btn-sm" title="PDF">
                        <Download size={15} />
                      </button>
                      <button onClick={() => deleteInvoiceMutation.mutate(inv._id)} className="btn-ghost btn-sm text-red-500 hover:text-red-600" title="Supprimer">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination current={pageInvoices} totalPages={Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE))} onChange={(p) => setPageInvoices(p)} />
          {!data?.data?.length ? (
            <EmptyState
              icon={<FileText size={28} />}
              title="Aucune facture"
              description="Les factures sont créées au point de vente lors d'un paiement intégral"
              action={
                <Link to="/pos" className="btn-primary btn-sm">
                  Ouvrir le point de vente
                </Link>
              }
            />
          ) : !filteredInvoices.length ? (
            <p className="py-4 text-center text-sm text-slate-500">Aucun résultat pour cette recherche.</p>
          ) : null}
        </div>
      )}

      {tab === 'quotes' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>N° Devis</th>
                <th>Client</th>
                <th>Date</th>
                <th>Total TTC</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.slice((pageQuotes - 1) * PAGE_SIZE, pageQuotes * PAGE_SIZE).map((q) => (
                <tr key={q._id}>
                  <td>
                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                      {q.reference}
                    </span>
                  </td>
                  <td className="font-medium">{q.customerName || 'Client comptant'}</td>
                  <td>{formatDate(q.createdAt)}</td>
                  <td className="font-semibold">{formatCurrency(q.totalTTC)}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      {/* Bouton de conversion supprimé (conversion automatique désactivée) */}
                      <button onClick={() => openQuoteDetail(q._id)} className="btn-ghost btn-sm" title="Voir">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => handlePrintQuotePdf(q._id, q.reference)} className="btn-ghost btn-sm" title="Imprimer">
                        <Printer size={15} />
                      </button>
                      <button onClick={() => handleDownloadQuotePdf(q._id, q.reference)} className="btn-ghost btn-sm" title="PDF">
                        <Download size={15} />
                      </button>
                      <button onClick={() => deleteQuoteMutation.mutate(q._id)} className="btn-ghost btn-sm text-red-500 hover:text-red-600" title="Supprimer">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination current={pageQuotes} totalPages={Math.max(1, Math.ceil(filteredQuotes.length / PAGE_SIZE))} onChange={(p) => setPageQuotes(p)} />
          {!quotesData?.data?.length ? (
            <EmptyState
              icon={<FileText size={28} />}
              title="Aucun devis"
              description="Créez un devis indépendant — sans timbre fiscal ni lien avec les factures"
              action={
                <Link to="/quotes/new" className="btn-primary btn-sm">
                  Nouveau devis
                </Link>
              }
            />
          ) : !filteredQuotes.length ? (
            <p className="py-4 text-center text-sm text-slate-500">Aucun résultat pour cette recherche.</p>
          ) : null}
        </div>
      )}

      {tab === 'purchase-slips' && (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>N° Bon</th>
                <th>Client</th>
                <th>Date</th>
                <th>Total</th>
                <th>Payé</th>
                <th>Reste</th>
                <th>Statut</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchaseSlips.slice((pagePurchaseSlips - 1) * PAGE_SIZE, pagePurchaseSlips * PAGE_SIZE).map((slip) => (
                <tr key={slip._id}>
                  <td>
                    <span className="font-mono text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 px-2 py-1 rounded-lg">
                      {slip.reference}
                    </span>
                  </td>
                  <td className="font-medium">{slip.customerName || '—'}</td>
                  <td>{formatDate(slip.createdAt)}</td>
                  <td className="font-semibold">{formatCurrency(slip.totalTTC)}</td>
                  <td className="text-emerald-600">{formatCurrency(slip.amountPaid)}</td>
                  <td className={slip.amountDue > 0 ? 'text-red-600 font-bold' : ''}>
                    {formatCurrency(slip.amountDue)}
                  </td>
                  <td>
                    <span className={slip.amountDue > 0 ? 'badge-warning' : 'badge-success'}>
                      {slip.amountDue > 0 ? 'Dette ouverte' : 'Soldé'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openPurchaseSlipDetail(slip._id)} className="btn-ghost btn-sm" title="Voir">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => handlePrintPurchaseSlipPdf(slip._id, slip.reference)} className="btn-ghost btn-sm" title="Imprimer">
                        <Printer size={15} />
                      </button>
                      <button onClick={() => handleDownloadPurchaseSlipPdf(slip._id, slip.reference)} className="btn-ghost btn-sm" title="PDF">
                        <Download size={15} />
                      </button>
                      <button onClick={() => deletePurchaseSlipMutation.mutate(slip._id)} className="btn-ghost btn-sm text-red-500 hover:text-red-600" title="Supprimer">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination current={pagePurchaseSlips} totalPages={Math.max(1, Math.ceil(filteredPurchaseSlips.length / PAGE_SIZE))} onChange={(p) => setPagePurchaseSlips(p)} />
          {!purchaseSlipsData?.data?.length ? (
            <EmptyState
              icon={<FileText size={28} />}
              title="Aucun bon d'achat"
              description="Créés quand un client n'a pas payé la totalité du montant"
              action={
                <Link to="/pos" className="btn-primary btn-sm">
                  Vente avec paiement partiel
                </Link>
              }
            />
          ) : !filteredPurchaseSlips.length ? (
            <p className="py-4 text-center text-sm text-slate-500">Aucun résultat pour cette recherche.</p>
          ) : null}
        </div>
      )}

      {tab === 'delivery-notes' && (
        <>
          {selectedDeliveryIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 dark:border-primary-800/50 dark:bg-primary-900/20">
              <div>
                <p className="font-semibold text-primary-800 dark:text-primary-200">
                  {selectedDeliveryPreview.count} bon{selectedDeliveryPreview.count > 1 ? 's' : ''} sélectionné
                  {selectedDeliveryPreview.count > 1 ? 's' : ''} — {selectedDeliveryPreview.customerName}
                </p>
                <p className="text-sm text-primary-700 dark:text-primary-300">
                  Total estimé : {formatCurrency(selectedDeliveryPreview.totalWithTimbre)} (timbre fiscal inclus)
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setSelectedDeliveryIds([])}>
                  Tout désélectionner
                </Button>
                <Button
                  loading={convertDeliveryMutation.isPending}
                  onClick={() => setConvertModalOpen(true)}
                >
                  Vérifier et facturer
                </Button>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">
                    {(() => {
                      const pageDocs = filteredDeliveryNotes.slice(
                        (pageDeliveryNotes - 1) * PAGE_SIZE,
                        pageDeliveryNotes * PAGE_SIZE
                      )
                      const selectable = pageDocs.filter((doc) => !doc.convertedInvoiceId)
                      const pageIds = selectable.map((doc) => doc._id)
                      const allPageSelected =
                        pageIds.length > 0 && pageIds.every((id) => selectedDeliveryIds.includes(id))

                      return selectable.length ? (
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          onChange={() => toggleSelectAllOnPage(pageDocs)}
                          title="Sélectionner les bons facturables de cette page"
                        />
                      ) : null
                    })()}
                  </th>
                  <th>N° Bon</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Total TTC</th>
                  <th>Statut</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveryNotes.slice((pageDeliveryNotes - 1) * PAGE_SIZE, pageDeliveryNotes * PAGE_SIZE).map((delivery) => {
                  const isBillable = !delivery.convertedInvoiceId
                  const isSelected = selectedDeliveryIds.includes(delivery._id)

                  return (
                    <tr
                      key={delivery._id}
                      className={isSelected ? 'bg-primary-50/60 dark:bg-primary-900/10' : undefined}
                    >
                      <td>
                        {isBillable ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleDeliverySelection(delivery)}
                            title="Sélectionner pour fusion en facture"
                          />
                        ) : null}
                      </td>
                      <td>
                        <span className="font-mono text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 px-2 py-1 rounded-lg">
                          {delivery.reference}
                        </span>
                      </td>
                      <td className="font-medium">{delivery.customerName || 'Client comptant'}</td>
                      <td>{formatDate(delivery.createdAt)}</td>
                      <td className="font-semibold">{formatCurrency(delivery.totalTTC)}</td>
                      <td>
                        <span className={delivery.convertedInvoiceId ? 'badge-success' : 'badge-warning'}>
                          {delivery.convertedInvoiceId ? 'Facturé' : 'En attente'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openDeliveryDetail(delivery._id)} className="btn-ghost btn-sm" title="Voir">
                            <Eye size={15} />
                          </button>
                          <button onClick={() => handlePrintDeliveryPdf(delivery._id, delivery.reference)} className="btn-ghost btn-sm" title="Imprimer">
                            <Printer size={15} />
                          </button>
                          <button onClick={() => handleDownloadDeliveryPdf(delivery._id, delivery.reference)} className="btn-ghost btn-sm" title="PDF">
                            <Download size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination current={pageDeliveryNotes} totalPages={Math.max(1, Math.ceil(filteredDeliveryNotes.length / PAGE_SIZE))} onChange={(p) => setPageDeliveryNotes(p)} />
            {!deliveryNotesData?.data?.length ? (
              <EmptyState
                icon={<FileText size={28} />}
                title="Aucun bon de livraison"
                description="Créés automatiquement à chaque facture ou manuellement depuis zéro / une facture"
                action={
                  <Link to="/delivery-notes/new" className="btn-primary btn-sm">
                    Nouveau bon de livraison
                  </Link>
                }
              />
            ) : !filteredDeliveryNotes.length ? (
              <p className="py-4 text-center text-sm text-slate-500">Aucun résultat pour cette recherche.</p>
            ) : null}
          </div>
        </>
      )}

      <Modal
        isOpen={convertModalOpen}
        onClose={() => setConvertModalOpen(false)}
        title="Fusionner les bons de livraison en une facture"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Les lignes des bons sélectionnés seront regroupées dans une seule facture (timbre fiscal inclus).
            Seuls les bons du même client peuvent être fusionnés.
          </p>

          {selectedDeliveryDocs.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/50">
              <p className="font-semibold">{selectedDeliveryPreview.customerName}</p>
              <p className="mt-1 text-slate-500">
                {selectedDeliveryPreview.count} bon{selectedDeliveryPreview.count > 1 ? 's' : ''} •{' '}
                Sous-total : {formatCurrency(selectedDeliveryPreview.subtotal)} •{' '}
                Timbre : {formatCurrency(TIMBRE_FISCAL_AMOUNT)} •{' '}
                Total facture : {formatCurrency(selectedDeliveryPreview.totalWithTimbre)}
              </p>
            </div>
          )}

          <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
            {billableDeliveryNotes.length === 0 && (
              <p className="p-3 text-sm text-slate-500">Aucun bon de livraison disponible pour facturation.</p>
            )}
            {billableDeliveryNotes.map((doc) => (
              <label
                key={doc._id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                  selectedDeliveryIds.includes(doc._id)
                    ? 'border-primary-300 bg-primary-50/50 dark:border-primary-700 dark:bg-primary-900/20'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div>
                  <p className="font-medium">{doc.reference}</p>
                  <p className="text-xs text-slate-500">
                    {doc.customerName || 'Client comptant'} • {formatDate(doc.createdAt)} • {formatCurrency(doc.totalTTC)}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedDeliveryIds.includes(doc._id)}
                  onChange={() => toggleDeliverySelection(doc)}
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConvertModalOpen(false)}>
              Annuler
            </Button>
            <Button
              loading={convertDeliveryMutation.isPending}
              disabled={selectedDeliveryIds.length === 0}
              onClick={() => convertDeliveryMutation.mutate(selectedDeliveryIds)}
            >
              Créer la facture ({selectedDeliveryIds.length || 0})
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={`Facture ${selected?.reference}`}
        subtitle={selected ? `${selected.customerName || 'Client comptant'} — ${formatDateTime(selected.createdAt)}` : ''}
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-3">
              <p className="text-xs text-slate-400 uppercase">Client sur la facture</p>
              <div className="flex gap-2">
                <Input value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} placeholder="Nom du client" />
                <Button
                  variant="secondary"
                  loading={updateCustomerMutation.isPending}
                  onClick={() => updateCustomerMutation.mutate({ id: selected._id, customerName: editCustomerName.trim() })}
                >
                  Enregistrer
                </Button>
              </div>
            </div>
            <DocumentLines doc={selected} showTimbre />
            <div className="flex justify-end gap-2 flex-wrap">
              <Button
                variant="secondary"
                loading={createBlFromInvoiceMutation.isPending}
                onClick={() => createBlFromInvoiceMutation.mutate(selected._id)}
              >
                Créer bon de livraison
              </Button>
              <Button variant="secondary" onClick={() => handleDownloadPdf(selected._id, selected.reference)}>
                <Download size={16} /> Télécharger PDF
              </Button>
              <Button variant="secondary" onClick={() => handlePrintThermal(selected._id)}>
                <Printer size={16} /> Ticket thermique
              </Button>
              <Button onClick={() => handlePrintA4(selected._id)}>
                <Printer size={16} /> Imprimer A4
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!selectedPurchaseSlip}
        onClose={() => setSelectedPurchaseSlip(null)}
        title={`Bon d'achat ${selectedPurchaseSlip?.reference}`}
        subtitle={selectedPurchaseSlip ? `${selectedPurchaseSlip.customerName || '—'} — ${formatDateTime(selectedPurchaseSlip.createdAt)}` : ''}
        size="lg"
      >
        {selectedPurchaseSlip && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-sm">
              <div>
                <p className="text-slate-400 text-xs uppercase">Total commande</p>
                <p className="font-bold">{formatCurrency(selectedPurchaseSlip.totalTTC)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase">Montant payé</p>
                <p className="font-bold text-emerald-600">{formatCurrency(selectedPurchaseSlip.amountPaid)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase">Reste à payer</p>
                <p className={`font-bold ${selectedPurchaseSlip.amountDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatCurrency(selectedPurchaseSlip.amountDue)}
                </p>
              </div>
            </div>
            <DocumentLines doc={selectedPurchaseSlip} showDebt />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => handlePrintPurchaseSlipPdf(selectedPurchaseSlip._id, selectedPurchaseSlip.reference)}>
                <Printer size={16} /> Imprimer
              </Button>
              <Button variant="secondary" onClick={() => handleDownloadPurchaseSlipPdf(selectedPurchaseSlip._id, selectedPurchaseSlip.reference)}>
                <Download size={16} /> Télécharger PDF
              </Button>
              <Button variant="danger" onClick={() => deletePurchaseSlipMutation.mutate(selectedPurchaseSlip._id)}>
                <Trash2 size={16} /> Supprimer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!selectedDelivery}
        onClose={() => setSelectedDelivery(null)}
        title={`Bon de livraison ${selectedDelivery?.reference}`}
        subtitle={selectedDelivery ? `${selectedDelivery.customerName || 'Client comptant'} — ${formatDateTime(selectedDelivery.createdAt)}` : ''}
        size="lg"
      >
        {selectedDelivery && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-sm">
              <p className="text-slate-400 text-xs uppercase">Total</p>
              <p className="font-bold text-lg">{formatCurrency(selectedDelivery.totalTTC)}</p>
            </div>
            {(selectedDelivery.customerAddress || selectedDelivery.deliveryDriverName || selectedDelivery.deliveryVehiclePlate) && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                {selectedDelivery.customerAddress && (
                  <div>
                    <p className="text-xs text-slate-400">Adresse de livraison</p>
                    <p className="font-medium">{selectedDelivery.customerAddress}</p>
                  </div>
                )}
                {(selectedDelivery.deliveryDriverName || selectedDelivery.deliveryDriverCin || selectedDelivery.deliveryVehiclePlate) && (
                  <div>
                    <p className="text-xs text-slate-400">Livreur</p>
                    <p className="font-medium">{selectedDelivery.deliveryDriverName || '—'} {selectedDelivery.deliveryDriverCin ? `• CIN: ${selectedDelivery.deliveryDriverCin}` : ''} {selectedDelivery.deliveryVehiclePlate ? `• ${selectedDelivery.deliveryVehiclePlate}` : ''}</p>
                  </div>
                )}
              </div>
            )}
            <DocumentLines doc={selectedDelivery} showTimbre={false} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => handlePrintDeliveryPdf(selectedDelivery._id, selectedDelivery.reference)}>
                <Printer size={16} /> Imprimer
              </Button>
              <Button variant="secondary" onClick={() => handleDownloadDeliveryPdf(selectedDelivery._id, selectedDelivery.reference)}>
                <Download size={16} /> Télécharger PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!selectedQuote}
        onClose={() => setSelectedQuote(null)}
        title={`Devis ${selectedQuote?.reference}`}
        subtitle={selectedQuote ? `${selectedQuote.customerName || 'Client comptant'} — ${formatDateTime(selectedQuote.createdAt)}` : ''}
        size="lg"
      >
        {selectedQuote && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-sm">
              <p className="text-slate-400 text-xs uppercase">Total</p>
              <p className="font-bold text-lg">{formatCurrency(selectedQuote.totalTTC)}</p>
            </div>
            <DocumentLines doc={selectedQuote} showTimbre={false} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => handlePrintQuotePdf(selectedQuote._id, selectedQuote.reference)}>
                <Printer size={16} /> Imprimer
              </Button>
              <Button variant="secondary" onClick={() => handleDownloadQuotePdf(selectedQuote._id, selectedQuote.reference)}>
                <Download size={16} /> Télécharger PDF
              </Button>
              <Button variant="danger" onClick={() => deleteQuoteMutation.mutate(selectedQuote._id)}>
                <Trash2 size={16} /> Supprimer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function DocumentLines({
  doc,
  showDebt,
  showTimbre = false
}: {
  doc: SaleDocument
  showDebt?: boolean
  showTimbre?: boolean
}) {
  return (
    <>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Désignation</th>
              <th>Qté</th>
              <th>P.U.</th>
              <th>Remise</th>
              <th>Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line, i) => (
              <tr key={i}>
                <td>{line.designation}</td>
                <td>{line.quantity}</td>
                <td>{formatCurrency(line.unitPrice)}</td>
                <td>{line.discount ? `${line.discount}%` : '—'}</td>
                <td className="font-medium">{formatCurrency(line.totalTTC)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
        <div className="flex justify-between text-sm">
          <span>Total HT</span>
          <span>{formatCurrency(doc.totalHT)}</span>
        </div>
        {doc.includeTva && (
          <div className="flex justify-between text-sm">
            <span>TVA</span>
            <span>{formatCurrency(doc.totalTVA)}</span>
          </div>
        )}
        {showTimbre && (
          <div className="flex justify-between text-sm">
            <span>Timbre fiscal</span>
            <span>
              {formatCurrency(
                (doc.timbreFiscal ?? 0) > 0 ? doc.timbreFiscal! : TIMBRE_FISCAL_AMOUNT
              )}
            </span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold border-t pt-2">
          <span>Total TTC</span>
          <span className="text-primary-600">{formatCurrency(doc.totalTTC)}</span>
        </div>
        {showDebt && (
          <>
            <div className="flex justify-between text-sm text-emerald-600">
              <span>Montant payé</span>
              <span className="font-semibold">{formatCurrency(doc.amountPaid)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Reste à payer (dette)</span>
              <span className={doc.amountDue > 0 ? 'text-red-600' : 'text-emerald-600'}>
                {formatCurrency(doc.amountDue)}
              </span>
            </div>
          </>
        )}
      </div>
    </>
  )
}
