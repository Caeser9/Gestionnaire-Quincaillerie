import { Button } from '@renderer/components/ui/Button'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Select } from '@renderer/components/ui/Select'
import { apiRequest } from '@renderer/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { DocumentEditor, type DocumentEditorLine } from '@modules/Documents/DocumentEditor'
import { billingPath } from '@shared/constants/billing'
import toast from 'react-hot-toast'

interface CustomerOption {
  _id: string
  name: string
  phone?: string
  address?: string
}

interface InvoiceOption {
  _id: string
  reference: string
  customerName?: string
  createdAt: string
}

interface InvoiceLineFromApi {
  productId?: string | { _id: string }
  reference?: string
  designation?: string
  quantity?: number
  unitPrice?: number
  discount?: number
  tva?: number
  totalHT?: number
  totalTTC?: number
}

interface InvoiceDetail {
  _id: string
  customerId?: string | { _id: string; name?: string; address?: string }
  customerName?: string
  customerAddress?: string
  includeTva?: boolean
  lines?: InvoiceLineFromApi[]
}

function extractId(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'object' && value && '_id' in value) {
    return String((value as { _id: string })._id)
  }
  return String(value)
}

function mapInvoiceLine(line: InvoiceLineFromApi): DocumentEditorLine {
  const quantity = Number(line.quantity) || 0
  const unitPrice = Number(line.unitPrice) || 0
  const totalHT = Number(line.totalHT) || quantity * unitPrice
  const totalTTC = Number(line.totalTTC) || totalHT

  return {
    productId: extractId(line.productId),
    reference: line.reference || '',
    designation: line.designation || '',
    quantity,
    unitPrice,
    discount: Number(line.discount) || 0,
    tva: Number(line.tva) || 19,
    totalHT,
    totalTTC
  }
}

export default function AddDeliveryNotePage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'new' | 'from-invoice'>('new')
  const [sourceInvoiceId, setSourceInvoiceId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerMatricule, setCustomerMatricule] = useState('')
  const [deliveryDriverName, setDeliveryDriverName] = useState('')
  const [deliveryDriverCin, setDeliveryDriverCin] = useState('')
  const [deliveryVehiclePlate, setDeliveryVehiclePlate] = useState('')
  const [lines, setLines] = useState<DocumentEditorLine[]>([])
  const [includeTva, setIncludeTva] = useState(true)

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<{ data: CustomerOption[] }>('/customers?limit=200')
  })

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices-for-bl'],
    queryFn: () => apiRequest<{ data: InvoiceOption[] }>('/invoices?limit=100'),
    enabled: mode === 'from-invoice'
  })

  useEffect(() => {
    if (mode !== 'from-invoice' || !sourceInvoiceId) return

    apiRequest<InvoiceDetail>(`/invoices/${sourceInvoiceId}`)
      .then((invoice) => {
        const populatedCustomer =
          typeof invoice.customerId === 'object' && invoice.customerId ? invoice.customerId : null

        setCustomerId(extractId(invoice.customerId))
        setCustomerName(invoice.customerName || populatedCustomer?.name || '')
        setCustomerAddress(invoice.customerAddress || populatedCustomer?.address || '')
        setCustomerMatricule((invoice as any).customerMatricule || populatedCustomer?.matricule || '')
        setIncludeTva(invoice.includeTva ?? false)
        setLines((invoice.lines || []).map(mapInvoiceLine))
      })
      .catch(() => toast.error('Impossible de charger la facture'))
  }, [mode, sourceInvoiceId])

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => apiRequest('/delivery-notes', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-notes'] })
      toast.success('Bon de livraison enregistré')
      navigate(billingPath('delivery-notes'))
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const save = () => {
    const cleaned = lines.filter((line) => line.designation.trim())
    if (!cleaned.length) {
      toast.error('Ajoutez au moins une ligne')
      return
    }
    createMutation.mutate({
      customerId: customerId || undefined,
      customerMatricule: customerMatricule?.trim() || undefined,
      customerName,
      customerAddress,
      sourceInvoiceId: mode === 'from-invoice' ? sourceInvoiceId : undefined,
      lines: cleaned.map((line) => ({
        productId: line.productId,
        reference: line.reference,
        designation: line.designation,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount ?? 0,
        tva: line.tva ?? 19,
        totalHT: line.totalHT,
        totalTTC: line.totalTTC
      })),
      includeTva,
      deliveryDriverName,
      deliveryDriverCin,
      deliveryVehiclePlate
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back
        backLabel="Retour aux factures"
        onBack={() => navigate(billingPath('delivery-notes'))}
        title="Nouveau bon de livraison"
        subtitle="Création à partir de zéro ou depuis une facture existante"
      />

      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant={mode === 'new' ? 'primary' : 'secondary'} onClick={() => setMode('new')}>
            Créer de zéro
          </Button>
          <Button variant={mode === 'from-invoice' ? 'primary' : 'secondary'} onClick={() => setMode('from-invoice')}>
            Depuis une facture
          </Button>
        </div>

        {mode === 'from-invoice' && (
          <Select
            label="Facture source"
            value={sourceInvoiceId}
            onChange={(e) => setSourceInvoiceId(e.target.value)}
            options={[
              { value: '', label: 'Sélectionner une facture…' },
              ...(invoicesData?.data ?? []).map((invoice) => ({
                value: invoice._id,
                label: `${invoice.reference} — ${invoice.customerName || 'Client comptant'}`
              }))
            ]}
          />
        )}
      </div>

      <DocumentEditor
        title="Bon de livraison"
        subtitle={mode === 'from-invoice' ? 'Informations reprises de la facture sélectionnée' : 'Saisie manuelle des lignes'}
        customerName={customerName}
        customerAddress={customerAddress}
        includeTva={includeTva}
        onCustomerNameChange={setCustomerName}
        onCustomerAddressChange={setCustomerAddress}
        onIncludeTvaChange={setIncludeTva}
        customers={customersData?.data ?? []}
        customerId={customerId}
        customerMatricule={customerMatricule}
        onUpdateMatricule={setCustomerMatricule}
        onSelectCustomer={(customer) => {
          setCustomerId(customer?._id ?? '')
          setCustomerName(customer?.name ?? '')
          setCustomerAddress(customer?.address ?? '')
          setCustomerMatricule(customer?.matricule ?? '')
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
        saveLabel="Valider le bon de livraison"
        saveLoading={createMutation.isPending}
        showTimbre={false}
      />
    </div>
  )
}
