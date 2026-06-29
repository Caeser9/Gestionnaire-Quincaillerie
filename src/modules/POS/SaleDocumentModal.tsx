import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { apiDownload, apiRequest } from '@renderer/lib/api'
import { formatCurrency, formatDateTime } from '@renderer/lib/format'
import { Download, ExternalLink, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
  totalFodec?: number
  timbreFiscal?: number
  totalTTC: number
  amountPaid: number
  amountDue: number
  includeTva?: boolean
  lines: SaleDocumentLine[]
}

interface SaleDocumentModalProps {
  document: SaleDocument | null
  documentType: 'invoice' | 'purchase_slip' | null
  onClose: () => void
}

export function SaleDocumentModal({ document, documentType, onClose }: SaleDocumentModalProps) {
  const navigate = useNavigate()

  if (!document || !documentType) return null

  const isSlip = documentType === 'purchase_slip'
  const title = isSlip ? "Bon d'achat" : 'Facture'
  const pdfPath = isSlip
    ? `/purchase-slips/${document._id}/pdf`
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

  const goToList = () => {
    onClose()
    navigate('/invoices', { state: { tab: isSlip ? 'purchase-slips' : 'invoices' } })
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
          className={`grid grid-cols-3 gap-3 p-4 rounded-xl text-sm ${
            isSlip ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'
          }`}
        >
          <div>
            <p className="text-slate-400 text-xs uppercase">Total</p>
            <p className="font-bold text-lg">{formatCurrency(document.totalTTC)}</p>
          </div>
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
        </div>

        {isSlip && document.amountDue > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl">
            Dette enregistrée sur le client. Consultable dans Clients et Suivi Dettes.
          </p>
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
              {document.lines.map((line, i) => (
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
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button variant="secondary" onClick={goToList}>
            <ExternalLink size={16} />
            Voir dans Factures & Bons
          </Button>
          <Button variant="secondary" onClick={handleDownloadPdf}>
            <Download size={16} />
            PDF
          </Button>
          <Button onClick={handlePrintThermal}>
            <Printer size={16} />
            Imprimer
          </Button>
        </div>
      </div>
    </Modal>
  )
}
