import { PageHeader } from '@renderer/components/ui/PageHeader'
import { apiRequest } from '@renderer/lib/api'
import { printA4Pdf } from '@renderer/lib/printDocument'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DocumentEditor, type DocumentEditorLine } from '@modules/Documents/DocumentEditor'
import { SaleDocumentModal, type SaleDocument } from '@modules/POS/SaleDocumentModal'
import { billingPath } from '@shared/constants/billing'
import toast from 'react-hot-toast'
import { useState } from 'react'

interface CustomerOption {
  _id: string
  name: string
  phone?: string
  address?: string
}

function toSaleDocument(quote: SaleDocument): SaleDocument {
  return {
    ...quote,
    amountPaid: quote.amountPaid ?? 0,
    amountDue: quote.amountDue ?? 0,
    lines: quote.lines ?? [],
  }
}

export default function AddQuotePage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [lines, setLines] = useState<DocumentEditorLine[]>([])
  const [includeTva, setIncludeTva] = useState(false)
  const [validityDays, setValidityDays] = useState(30)
  const [saveLoading, setSaveLoading] = useState(false)
  const [lastQuote, setLastQuote] = useState<SaleDocument | null>(null)

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<{ data: CustomerOption[] }>('/customers?limit=200')
  })

  const buildPayload = () => {
    const cleaned = lines.filter((line) => line.designation.trim())
    if (!cleaned.length) {
      toast.error('Ajoutez au moins une ligne')
      return null
    }
    return {
      customerName,
      customerAddress,
      lines: cleaned,
      includeTva,
      validUntil: new Date(Date.now() + Math.max(1, validityDays) * 86400000).toISOString(),
    }
  }

  const resetForm = () => {
    setCustomerId('')
    setCustomerName('')
    setCustomerAddress('')
    setLines([])
    setIncludeTva(false)
    setValidityDays(30)
  }

  const submitQuote = async (autoPrint: boolean) => {
    const payload = buildPayload()
    if (!payload) return

    setSaveLoading(true)
    try {
      const result = await apiRequest<{ quote: SaleDocument }>('/quotes', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      await queryClient.invalidateQueries({ queryKey: ['quotes'] })
      toast.success('Devis enregistré')

      const quote = toSaleDocument(result.quote)

      if (autoPrint) {
        await printA4Pdf(`/quotes/${quote._id}/pdf`, `${quote.reference}.pdf`)
        resetForm()
        setLastQuote(quote)
      } else {
        navigate(billingPath('quotes'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement')
    } finally {
      setSaveLoading(false)
    }
  }

  const save = () => submitQuote(false)
  const saveAndPrint = () => submitQuote(true)

  return (
    <div className="space-y-6">
      <PageHeader
        back
        backLabel="Retour aux factures"
        onBack={() => navigate(billingPath('quotes'))}
        title="Nouveau devis"
        subtitle="Création identique à la facture de point de vente"
      />

      <DocumentEditor
        title="Devis"
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
        lines={lines}
        onLinesChange={setLines}
        onSave={save}
        onSaveAndPrint={saveAndPrint}
        saveLabel="Enregistrer"
        saveAndPrintLabel="Enregistrer et imprimer"
        saveLoading={saveLoading}
        showTimbre={false}
        showQuoteValidity
        validityDays={validityDays}
        onValidityDaysChange={setValidityDays}
      />

      <SaleDocumentModal
        document={lastQuote}
        documentType={lastQuote ? 'quote' : null}
        onClose={() => setLastQuote(null)}
      />
    </div>
  )
}
