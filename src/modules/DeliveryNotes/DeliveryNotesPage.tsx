import { Button } from '@renderer/components/ui/Button'
import { Modal } from '@renderer/components/ui/Modal'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { apiDownload, apiRequest } from '@renderer/lib/api'
import { formatCurrency, formatDate } from '@renderer/lib/format'
import { printA4Pdf } from '@renderer/lib/printDocument'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Plus, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'

interface CustomerOption {
  _id: string
  name: string
  phone?: string
  address?: string
}
import toast from 'react-hot-toast'
import { DocumentEditor, type DocumentEditorLine } from '@modules/Documents/DocumentEditor'

interface DeliveryLine extends DocumentEditorLine {
  tva?: number
}

interface DeliveryDocument {
  _id: string
  reference: string
  customerName?: string
  createdAt: string
  totalHT: number
  totalTTC: number
  amountDue: number
  lines: DeliveryLine[]
}

export default function DeliveryNotesPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [deliveryDriverName, setDeliveryDriverName] = useState('')
  const [deliveryDriverCin, setDeliveryDriverCin] = useState('')
  const [deliveryVehiclePlate, setDeliveryVehiclePlate] = useState('')
  const [lines, setLines] = useState<DeliveryLine[]>([{ designation: '', quantity: 1, unitPrice: 0, totalHT: 0, totalTTC: 0 }])
  const [includeTva, setIncludeTva] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['delivery-notes'],
    queryFn: () => apiRequest<{ data: DeliveryDocument[] }>('/delivery-notes?limit=100')
  })

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<{ data: CustomerOption[] }>('/customers?limit=200')
  })

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => apiRequest('/delivery-notes', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] })
      toast.success('Bon de livraison enregistré')
      setOpen(false)
      setCustomerId('')
      setCustomerName('')
      setCustomerAddress('')
      setLines([{ designation: '', quantity: 1, unitPrice: 0, totalHT: 0, totalTTC: 0 }])
      setIncludeTva(false)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const save = () => {
    const cleaned = lines.filter((line) => line.designation.trim())
    if (!cleaned.length) {
      toast.error('Ajoutez au moins une ligne')
      return
    }
    createMutation.mutate({ customerName, customerAddress, lines: cleaned, includeTva, deliveryDriverName, deliveryDriverCin, deliveryVehiclePlate })
  }

  const downloadPdf = async (id: string, reference: string) => {
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

  const printPdf = async (id: string, reference: string) => {
    await printA4Pdf(`/delivery-notes/${id}/pdf`, `${reference}.pdf`)
  }

  return (
    <div className="space-y-6">
      <PageHeader back title="Bons de livraison" subtitle="Création rapide et export PDF" />
      <div className="flex justify-end gap-2">
        <Link to="/delivery-notes/new" className="btn-primary btn-sm inline-flex items-center gap-1">
          <Plus size={16} /> Nouveau bon
        </Link>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Création rapide</Button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? <div className="py-10 text-center text-sm text-slate-500">Chargement…</div> : (
          <div className="space-y-3">
            {(data?.data ?? []).length === 0 && <div className="text-sm text-slate-500">Aucun bon de livraison pour le moment.</div>}
            {(data?.data ?? []).map((doc) => (
              <div key={doc._id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div>
                  <p className="font-semibold">{doc.reference}</p>
                  <p className="text-sm text-slate-500">{doc.customerName || 'Client comptant'} • {formatDate(doc.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatCurrency(doc.totalTTC)}</span>
                  <button className="btn-ghost btn-sm" onClick={() => printPdf(doc._id, doc.reference)}><Printer size={15} /></button>
                  <button className="btn-ghost btn-sm" onClick={() => downloadPdf(doc._id, doc.reference)}><Download size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Nouveau bon de livraison" size="xl">
        <DocumentEditor
          title="Bon de livraison"
          subtitle="Création identique à la facture de point de vente"
          customerName={customerName}
          customerAddress={customerAddress}
          includeTva={includeTva}
          onCustomerNameChange={setCustomerName}
          onCustomerAddressChange={setCustomerAddress}
          onIncludeTvaChange={setIncludeTva}
          customers={customersData?.data ?? []}
          customerId={customerId}
          onSelectCustomer={(customer) => {
            setCustomerId(customer?._id ?? '')
            setCustomerName(customer?.name ?? '')
            setCustomerAddress(customer?.address ?? '')
          }}
          showDeliveryFields
          deliveryAddress={customerAddress}
          deliveryDriverName={deliveryDriverName}
          deliveryDriverCin={deliveryDriverCin}
          deliveryVehiclePlate={deliveryVehiclePlate}
          onDeliveryAddressChange={setCustomerAddress}
          onDeliveryDriverNameChange={setDeliveryDriverName}
          onDeliveryDriverCinChange={setDeliveryDriverCin}
          onDeliveryVehiclePlateChange={setDeliveryVehiclePlate}
          lines={lines}
          onLinesChange={setLines}
          onSave={save}
          saveLabel="Enregistrer"
          saveLoading={createMutation.isPending}
          showTimbre={false}
        />
      </Modal>
    </div>
  )
}
