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
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import Pagination from '@renderer/components/ui/Pagination'
import toast from 'react-hot-toast'
import { SupplierActivityModal } from './SupplierActivityModal'

interface Supplier {
  _id: string
  reference: string
  companyName: string
  taxId?: string
  phone?: string
  email?: string
  address?: string
  contactName?: string
  balance: number
}

const emptyForm = {
  companyName: '',
  taxId: '',
  phone: '',
  email: '',
  address: '',
  contactName: ''
}

export default function SuppliersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [activitySupplier, setActivitySupplier] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', debouncedSearch],
    queryFn: () =>
      apiRequest<PaginatedResult<Supplier>>(`/suppliers?search=${debouncedSearch}`)
  })

  const saveMutation = useMutation({
    mutationFn: (payload: typeof emptyForm) =>
      editing
        ? apiRequest(`/suppliers/${editing._id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          })
        : apiRequest('/suppliers', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success(editing ? 'Fournisseur modifié' : 'Fournisseur créé')
      setModalOpen(false)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/suppliers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success('Fournisseur supprimé')
      setDeleteId(null)
    }
  })

  return (
    <div className="space-y-4">
      <PageHeader
        back
        title="Fournisseurs"
        subtitle="Partenaires, achats, dettes et historique des opérations"
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setForm(emptyForm)
              setModalOpen(true)
            }}
          >
            <Plus size={16} />
            Nouveau fournisseur
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

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Réf.</th>
              <th>Raison sociale</th>
              <th>Téléphone</th>
              <th>Contact</th>
              <th>Dette</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? [])
              .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              .map((s) => (
              <tr key={s._id}>
                <td className="font-mono text-xs">{s.reference}</td>
                <td className="font-medium">{s.companyName}</td>
                <td>{s.phone}</td>
                <td>{s.contactName}</td>
                <td className={s.balance > 0 ? 'text-red-600 font-semibold' : ''}>
                  {formatCurrency(s.balance)}
                </td>
                <td>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setActivitySupplier(s)}
                      className="btn-ghost p-1 text-primary-600"
                      title="Historique & opérations"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(s)
                        setForm({
                          companyName: s.companyName,
                          taxId: s.taxId || '',
                          phone: s.phone || '',
                          email: s.email || '',
                          address: s.address || '',
                          contactName: s.contactName || ''
                        })
                        setModalOpen(true)
                      }}
                      className="btn-ghost p-1"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(s._id)}
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
        <Pagination
          current={page}
          totalPages={Math.max(1, Math.ceil((data?.total ?? data?.data?.length ?? 0) / PAGE_SIZE))}
          onChange={(p) => setPage(p)}
        />
      </div>

      <SupplierActivityModal
        supplier={activitySupplier}
        onClose={() => setActivitySupplier(null)}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifier fournisseur' : 'Nouveau fournisseur'}
      >
        <Input
          label="Raison sociale *"
          value={form.companyName}
          onChange={(e) => setForm({ ...form, companyName: e.target.value })}
        />
        <Input
          label="Matricule fiscal"
          value={form.taxId}
          onChange={(e) => setForm({ ...form, taxId: e.target.value })}
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
        <Input
          label="Contact principal"
          value={form.contactName}
          onChange={(e) => setForm({ ...form, contactName: e.target.value })}
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

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Supprimer"
        message="Supprimer ce fournisseur ?"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
