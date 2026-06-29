import { Button } from '@renderer/components/ui/Button'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { Input } from '@renderer/components/ui/Input'
import { Modal } from '@renderer/components/ui/Modal'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { SearchInput } from '@renderer/components/ui/SearchInput'
import { useDebounce } from '@renderer/hooks'
import { apiRequest } from '@renderer/lib/api'
import { formatCurrency } from '@renderer/lib/format'
import type { PaginatedResult } from '@shared/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface Customer {
  _id: string
  reference: string
  name: string
  phone?: string
  email?: string
  address?: string
  creditBalance: number
  totalPurchases: number
}

interface OpenCredit {
  _id: string
  reference: string
  customerName: string
  amountDue: number
}

const emptyForm = { name: '', phone: '', email: '', address: '' }

export default function CustomersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [modalOpen, setModalOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState<Customer | null>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState(emptyForm)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', debouncedSearch],
    queryFn: () =>
      apiRequest<PaginatedResult<Customer>>(`/customers?search=${debouncedSearch}`)
  })

  const { data: credits } = useQuery({
    queryKey: ['open-credits'],
    queryFn: () => apiRequest<OpenCredit[]>('/customers/credits/open')
  })

  const saveMutation = useMutation({
    mutationFn: (payload: typeof emptyForm) =>
      editing
        ? apiRequest(`/customers/${editing._id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          })
        : apiRequest('/customers', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success(editing ? 'Client modifié' : 'Client créé')
      setModalOpen(false)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const paymentMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest('/customer-payments', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['open-credits'] })
      toast.success('Paiement enregistré')
      setPaymentOpen(null)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/customers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setDeleteId(null)
    }
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clients"
        subtitle="Fichier clients, historique et gestion des crédits"
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setForm(emptyForm)
              setModalOpen(true)
            }}
          >
            <Plus size={16} />
            Nouveau client
          </Button>
        }
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          onClear={() => setSearch('')}
          loading={isLoading}
        />
      </PageHeader>

      {credits && credits.length > 0 && (
        <div className="flex items-start gap-4 p-4 rounded-2xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
            <CreditCard className="text-red-600" size={20} />
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-red-800 dark:text-red-200">Crédits ouverts</p>
            {credits.map((slip) => (
              <div key={slip._id} className="flex justify-between text-sm">
                <span className="text-red-700 dark:text-red-300">
                  {slip.customerName} — Bon {slip.reference}
                </span>
                <span className="font-semibold text-red-600">
                  {formatCurrency(slip.amountDue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Réf.</th>
              <th>Nom</th>
              <th>Téléphone</th>
              <th>Total achats</th>
              <th>Crédit</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((c) => (
              <tr key={c._id}>
                <td className="font-mono text-xs">{c.reference}</td>
                <td>{c.name}</td>
                <td>{c.phone}</td>
                <td>{formatCurrency(c.totalPurchases)}</td>
                <td className={c.creditBalance > 0 ? 'text-red-600 font-semibold' : ''}>
                  {formatCurrency(c.creditBalance)}
                </td>
                <td>
                  <div className="flex gap-1">
                    {c.creditBalance > 0 && (
                      <button
                        onClick={() => {
                          setPaymentOpen(c)
                          setPaymentAmount(c.creditBalance)
                        }}
                        className="btn-ghost p-1 text-green-600"
                      >
                        <CreditCard size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditing(c)
                        setForm({
                          name: c.name,
                          phone: c.phone || '',
                          email: c.email || '',
                          address: c.address || ''
                        })
                        setModalOpen(true)
                      }}
                      className="btn-ghost p-1"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteId(c._id)}
                      className="btn-ghost p-1 text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier client' : 'Nouveau client'}
      >
        <Input
          label="Nom *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Téléphone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Input
          label="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          label="Adresse"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Annuler
          </Button>
          <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
            {editing ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!paymentOpen}
        onClose={() => setPaymentOpen(null)}
        title="Paiement crédit client"
      >
        <p className="mb-3">
          Client: <strong>{paymentOpen?.name}</strong>
        </p>
        <p className="mb-3">
          Solde:{' '}
          <strong className="text-red-600">
            {formatCurrency(paymentOpen?.creditBalance ?? 0)}
          </strong>
        </p>
        <Input
          label="Montant"
          type="number"
          step="0.001"
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(+e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setPaymentOpen(null)}>
            Annuler
          </Button>
          <Button
            loading={paymentMutation.isPending}
            onClick={() =>
              paymentOpen &&
              paymentMutation.mutate({
                type: 'customer',
                entityId: paymentOpen._id,
                amount: paymentAmount,
                method: 'cash'
              })
            }
          >
            Enregistrer paiement
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Supprimer"
        message="Supprimer ce client ?"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
