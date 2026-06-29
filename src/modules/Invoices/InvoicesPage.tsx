import { Button } from '@renderer/components/ui/Button'
import { EmptyState } from '@renderer/components/ui/EmptyState'
import { Input } from '@renderer/components/ui/Input'
import { Modal } from '@renderer/components/ui/Modal'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { apiDownload, apiRequest } from '@renderer/lib/api'
import { formatCurrency, formatDate, formatDateTime } from '@renderer/lib/format'
import type { PaginatedResult } from '@shared/types'
import { TIMBRE_FISCAL_AMOUNT } from '@shared/constants'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Eye, FileText, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'

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
  createdAt: string
  totalHT: number
  totalTVA: number
  totalFodec?: number
  timbreFiscal?: number
  totalTTC: number
  amountPaid: number
  amountDue: number
  includeTva?: boolean
  lines: InvoiceLine[]
}

export default function InvoicesPage() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'invoices' | 'purchase-slips'>('invoices')
  const [selected, setSelected] = useState<SaleDocument | null>(null)
  const [selectedSlip, setSelectedSlip] = useState<SaleDocument | null>(null)
  const [editCustomerName, setEditCustomerName] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => apiRequest<PaginatedResult<SaleDocument>>('/invoices?limit=100')
  })

  const { data: slips, isLoading: slipsLoading } = useQuery({
    queryKey: ['purchase-slips'],
    queryFn: () => apiRequest<PaginatedResult<SaleDocument>>('/purchase-slips?limit=100')
  })

  useEffect(() => {
    const state = location.state as { tab?: 'invoices' | 'purchase-slips' } | null
    if (state?.tab) setTab(state.tab)
  }, [location.state])

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

  const handleDownloadSlipPdf = async (id: string, reference: string) => {
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
    try {
      const blob = await apiDownload(`/invoices/${id}/pdf`)
      const buffer = await blob.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)
      if (window.electronAPI) {
        const result = await window.electronAPI.printA4(base64)
        if (result.success) toast.success("Facture envoyée à l'imprimante")
        else toast.error(result.error || 'Erreur impression')
      } else {
        handleDownloadPdf(id, reference || 'facture')
      }
    } catch {
      toast.error('Erreur impression A4')
    }
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

  const openSlipDetail = async (id: string) => {
    try {
      const slip = await apiRequest<SaleDocument>(`/purchase-slips/${id}`)
      setSelectedSlip(slip)
    } catch {
      toast.error("Impossible de charger le bon d'achat")
    }
  }

  if (isLoading || slipsLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Facturation"
        subtitle="Consultation et impression — les ventes se font au point de vente"
      />

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
          onClick={() => setTab('purchase-slips')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
            tab === 'purchase-slips' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500'
          }`}
        >
          Bons d&apos;achat
        </button>
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
              {data?.data?.map((inv) => (
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.data?.length && (
            <EmptyState
              icon={<FileText size={28} />}
              title="Aucune facture"
              description="Les factures sont créées au point de vente lors d'un paiement intégral"
            />
          )}
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
              {slips?.data?.map((slip) => (
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
                      <button onClick={() => openSlipDetail(slip._id)} className="btn-ghost btn-sm" title="Voir">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => handleDownloadSlipPdf(slip._id, slip.reference)} className="btn-ghost btn-sm" title="PDF">
                        <Download size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!slips?.data?.length && (
            <EmptyState
              icon={<FileText size={28} />}
              title="Aucun bon d'achat"
              description="Créés au point de vente quand le client ne paie pas la totalité"
            />
          )}
        </div>
      )}

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
            <DocumentLines doc={selected} />
            <div className="flex justify-end gap-2">
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
        isOpen={!!selectedSlip}
        onClose={() => setSelectedSlip(null)}
        title={`Bon d'achat ${selectedSlip?.reference}`}
        subtitle={selectedSlip ? `${selectedSlip.customerName || '—'} — ${formatDateTime(selectedSlip.createdAt)}` : ''}
        size="lg"
      >
        {selectedSlip && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-sm">
              <div>
                <p className="text-slate-400 text-xs uppercase">Total commande</p>
                <p className="font-bold">{formatCurrency(selectedSlip.totalTTC)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase">Montant payé</p>
                <p className="font-bold text-emerald-600">{formatCurrency(selectedSlip.amountPaid)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase">Reste à payer</p>
                <p className={`font-bold ${selectedSlip.amountDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatCurrency(selectedSlip.amountDue)}
                </p>
              </div>
            </div>
            <DocumentLines doc={selectedSlip} showDebt />
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => handleDownloadSlipPdf(selectedSlip._id, selectedSlip.reference)}>
                <Download size={16} /> Télécharger PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function DocumentLines({ doc, showDebt }: { doc: SaleDocument; showDebt?: boolean }) {
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
        {(doc.totalFodec ?? 0) > 0 && (
          <div className="flex justify-between text-sm">
            <span>FODEC (1%)</span>
            <span>{formatCurrency(doc.totalFodec!)}</span>
          </div>
        )}
        {doc.includeTva && (
          <div className="flex justify-between text-sm">
            <span>TVA</span>
            <span>{formatCurrency(doc.totalTVA)}</span>
          </div>
        )}
        {!showDebt && (
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
