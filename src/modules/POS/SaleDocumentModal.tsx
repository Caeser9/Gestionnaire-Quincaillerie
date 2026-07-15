import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { apiDownload, apiRequest } from '@renderer/lib/api'
import { formatCurrency, formatDateTime } from '@renderer/lib/format'
import { printA4Pdf } from '@renderer/lib/printDocument'
import { billingPath } from '@shared/constants/billing'
import { Download, ExternalLink, Printer, Truck } from 'lucide-react'
import Pagination from '@renderer/components/ui/Pagination'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import toast from 'react-hot-toast'

export interface SaleDocumentLine {
  designation: string
  quantity: number
  unitPrice: number
  discount?: number
  totalHT: number
  totalTTC: number
}

export interface SaleDocument {
  _id: string
  reference: string
  customerName?: string
  createdAt: string
  totalHT: number
  totalTVA: number
  timbreFiscal?: number
  totalTTC: number
  amountPaid: number
  amountDue: number
  includeTva?: boolean
  lines: SaleDocumentLine[]
}

interface SaleDocumentModalProps {
  document: SaleDocument | null
  documentType: 'invoice' | 'purchase_slip' | 'quote' | null
  onClose: () => void
}

export function SaleDocumentModal({ document, documentType, onClose }: SaleDocumentModalProps) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const PAGE_SIZE = 10

  if (!document || !documentType) return null

  const isSlip = documentType === 'purchase_slip'
  const isQuote = documentType === 'quote'
  const title = isSlip ? "Bon d'achat" : isQuote ? 'Devis' : 'Facture'
  const pdfPath = isSlip
    ? `/purchase-slips/${document._id}/pdf`
    : isQuote
      ? `/quotes/${document._id}/pdf`
      : `/invoices/${document._id}/pdf`
  const receiptPath = isSlip
    ? `/purchase-slips/${document._id}/receipt`
    : `/invoices/${document._id}/receipt`

  const handlePrintThermal = async () => {
    try {
      const receipt = await apiRequest<{ data: string }>(receiptPath)
      if (window.electronAPI) {
        await window.electronAPI.printThermal(receipt.data)
        toast.success('Ticket envoyé à l\'imprimante')
      } else {
        toast.error('Impression disponible en mode desktop uniquement')
      }
    } catch {
      toast.error('Erreur impression')
    }
  }

  const handlePrintA4 = async () => {
    await printA4Pdf(pdfPath, `${document.reference}.pdf`)
  }

  const handleDownloadPdf = async () => {
    try {
      const blob = await apiDownload(pdfPath)
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = `${document.reference}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF téléchargé')
    } catch {
      toast.error('Erreur téléchargement')
    }
  }

  const handleDeliveryNote = async () => {
    setDeliveryLoading(true)
    try {
      const result = await apiRequest<{ slip: { _id: string; reference: string }; created?: boolean }>(
        `/delivery-notes/from-invoice/${document._id}`,
        { method: 'POST', body: JSON.stringify({}) }
      )
      const slip = result.slip
      await printA4Pdf(`/delivery-notes/${slip._id}/pdf`, `${slip.reference}.pdf`)
      toast.success(
        result.created === false
          ? `Bon de livraison ${slip.reference} — impression`
          : `Bon de livraison ${slip.reference} créé et imprimé`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur bon de livraison')
    } finally {
      setDeliveryLoading(false)
    }
  }

  const goToList = () => {
    onClose()
    navigate(billingPath(isSlip ? 'purchase-slips' : 'invoices'))
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${title} ${document.reference}`}
      subtitle={`${document.customerName || 'Client comptant'} — ${formatDateTime(document.createdAt)}`}
      size="lg"
    >
      <div className="space-y-4">
        <div
          className={`grid gap-3 p-4 rounded-xl text-sm ${
            isQuote
              ? 'grid-cols-1 bg-emerald-50 dark:bg-emerald-900/20'
              : isSlip
                ? 'grid-cols-3 bg-blue-50 dark:bg-blue-900/20'
                : 'grid-cols-3 bg-emerald-50 dark:bg-emerald-900/20'
          }`}
        >
          <div>
            <p className="text-slate-400 text-xs uppercase">Total</p>
            <p className="font-bold text-lg">{formatCurrency(document.totalTTC)}</p>
          </div>
          {!isQuote && (
            <>
              <div>
                <p className="text-slate-400 text-xs uppercase">Montant payé</p>
                <p className="font-bold text-lg text-emerald-600">{formatCurrency(document.amountPaid)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs uppercase">Reste à payer</p>
                <p className={`font-bold text-lg ${document.amountDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatCurrency(document.amountDue)}
                </p>
              </div>
            </>
          )}
        </div>

        {isSlip && document.amountDue > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl">
            <span>Dette enregistrée sur le client.</span>
            <Link to="/client-debts" onClick={onClose} className="btn-secondary btn-sm">
              Voir les dettes
            </Link>
          </div>
        )}

        {!isSlip && !isQuote && document.amountDue > 0 && (
          <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl">
            Facture avec reste à payer enregistrée sur le client.
          </div>
        )}

        <div className="table-container max-h-48 overflow-y-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Désignation</th>
                <th>Qté</th>
                <th>P.U.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(document.lines ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((line, i) => (
                <tr key={i}>
                  <td>
                    {line.designation}
                    {line.discount ? ` (-${line.discount}%)` : ''}
                  </td>
                  <td>{line.quantity}</td>
                  <td>{formatCurrency(line.unitPrice)}</td>
                  <td className="font-medium">{formatCurrency(line.totalTTC)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination current={page} totalPages={Math.max(1, Math.ceil((document.lines?.length ?? 0)/PAGE_SIZE))} onChange={(p) => setPage(p)} />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button variant="secondary" onClick={goToList}>
            <ExternalLink size={16} />
            Voir dans Gestion des transactions
          </Button>
          {!isSlip && !isQuote && (
            <Button variant="secondary" loading={deliveryLoading} onClick={handleDeliveryNote}>
              <Truck size={16} />
              Bon de livraison
            </Button>
          )}
          <Button variant="secondary" onClick={handleDownloadPdf}>
            <Download size={16} />
            PDF
          </Button>
          <Button onClick={handlePrintA4}>
            <Printer size={16} />
            Imprimer A4
          </Button>
        </div>
      </div>
    </Modal>
  )
}
