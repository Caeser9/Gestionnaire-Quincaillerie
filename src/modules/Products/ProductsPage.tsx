import { Button } from '@renderer/components/ui/Button'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { EmptyState } from '@renderer/components/ui/EmptyState'
import { Input } from '@renderer/components/ui/Input'
import { Modal } from '@renderer/components/ui/Modal'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { SearchInput } from '@renderer/components/ui/SearchInput'
import { Select } from '@renderer/components/ui/Select'
import { useDebounce } from '@renderer/hooks'
import { apiDownload, apiRequest } from '@renderer/lib/api'
import { formatCurrency } from '@renderer/lib/format'
import { calculateSalePrice } from '@shared/utils'
import type { PaginatedResult } from '@shared/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Package, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import Pagination from '@renderer/components/ui/Pagination'
import toast from 'react-hot-toast'
import { read, utils } from 'xlsx'

const UNITS = ['pièce', 'kg', 'm', 'm²', 'L', 'boîte', 'paquet', 'rouleau']

interface Product {
  _id: string
  reference: string
  designation: string
  barcode?: string
  description?: string
  categoryId?: { _id: string; name: string } | string
  brand?: string
  purchasePrice: number
  salePrice: number
  profitMargin: number
  discount: number
  stock: number
  minStock: number
  unit: string
  location?: string
}

const emptyForm = {
  reference: '',
  designation: '',
  barcode: '',
  description: '',
  brand: '',
  purchasePrice: 0,
  salePrice: 0,
  profitMargin: 25,
  discount: 0,
  stock: 0,
  minStock: 0,
  unit: 'pièce',
  location: ''
}

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const { data, isLoading } = useQuery({
    queryKey: ['products', debouncedSearch],
    queryFn: () =>
      apiRequest<PaginatedResult<Product>>(
        `/products?search=${debouncedSearch}&limit=100`
      )
  })

  const buildProductPayload = (form: typeof emptyForm) => {
    const { salePrice: _salePrice, ...rest } = form
    return rest
  }

  const saveMutation = useMutation({
    mutationFn: (payload: typeof emptyForm) =>
      editing
        ? apiRequest(`/products/${editing._id}`, {
            method: 'PUT',
            body: JSON.stringify(buildProductPayload(payload))
          })
        : apiRequest('/products', { method: 'POST', body: JSON.stringify(buildProductPayload(payload)) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(editing ? 'Produit modifié' : 'Produit créé')
      closeModal()
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Produit supprimé')
      setDeleteId(null)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm })
    setModalOpen(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({
      reference: p.reference,
      designation: p.designation,
      barcode: p.barcode || '',
      description: p.description || '',
      brand: p.brand || '',
      purchasePrice: p.purchasePrice,
      salePrice: p.salePrice,
      profitMargin: p.profitMargin,
      discount: p.discount,
      stock: p.stock,
      minStock: p.minStock,
      unit: p.unit,
      location: p.location || ''
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const allProductsCount = data?.total ?? 0
  const activeProducts = data?.data ?? []
  const totalPages = Math.max(1, Math.ceil(allProductsCount / PAGE_SIZE))
  const pagedProducts = activeProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleExport = async () => {
    try {
      const blob = await apiDownload('/products/export/excel')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'produits.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export terminé')
    } catch {
      toast.error('Erreur export')
    }
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const wb = read(ev.target?.result, { type: 'binary' })
      const rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
      try {
        const result = await apiRequest<{ imported: number }>('/products/import', {
          method: 'POST',
          body: JSON.stringify({ rows })
        })
        queryClient.invalidateQueries({ queryKey: ['products'] })
        toast.success(`${result.imported} produits importés`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erreur import')
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-5">
      <PageHeader
        back
        title="Produits"
        subtitle={`${allProductsCount} produit${allProductsCount !== 1 ? 's' : ''} en catalogue`}
        actions={
          <>
            <label className="btn-secondary cursor-pointer">
              <Upload size={16} />
              Import Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImport}
              />
            </label>
            <Button variant="secondary" onClick={handleExport}>
              <Download size={16} />
              Export
            </Button>
            <Button onClick={() => openCreate()}>
              <Plus size={16} />
              Nouveau produit
            </Button>
          </>
        }
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          onClear={() => setSearch('')}
          placeholder="Rechercher par nom, référence ou code-barres..."
          loading={isLoading}
        />
      </PageHeader>

        <table className="table">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation</th>
              <th>Catégorie</th>
              <th>Prix HT</th>
              <th>Quantité</th>
              <th>Unité</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedProducts.map((p) => (
              <tr
                key={p._id}
                className={
                  p.stock <= p.minStock ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                }
              >
                <td>
                  <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                    {p.reference}
                  </span>
                </td>
                <td className="font-medium">{p.designation}</td>
                <td>{typeof p.categoryId === 'object' ? p.categoryId.name : p.categoryId || '—'}</td>
                <td className="font-semibold text-primary-600">
                  {formatCurrency(p.salePrice)}
                </td>
                <td>
                  <span
                    className={`inline-flex items-center gap-1 ${
                      p.stock <= p.minStock ? 'text-red-600 font-bold' : ''
                    }`}
                  >
                    {p.stock <= p.minStock && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    )}
                    {p.stock}
                  </span>
                </td>
                <td>
                  <span className="badge-neutral">{p.unit}</span>
                </td>
                <td>
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(p)} className="btn-ghost btn-sm">
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteId(p._id)}
                      className="btn-ghost btn-sm text-red-500 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination current={page} totalPages={totalPages} onChange={(p) => setPage(p)} />
        {!activeProducts.length && (
          <EmptyState
            icon={<Package size={28} />}
            title="Aucun produit"
            description="Ajoutez votre premier produit ou importez depuis Excel"
            action={
              <Button onClick={() => openCreate()}>
                <Plus size={16} />
                Ajouter un produit
              </Button>
            }
          />
        )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? 'Modifier produit' : 'Nouveau produit'}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">

          <Input
            label="Désignation *"
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
          />
          <Input
            label="Référence (facultatif)"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            disabled={!!editing}
          />
          <Input
            label="Code-barres"
            value={form.barcode}
            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
          />
          <Input
            label="Marque"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
          />
          <Input
            label="Emplacement"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
          <Input
            label="Prix achat"
            type="number"
            step="0.001"
            className="input-number"
            value={form.purchasePrice}
            onChange={(e) => setForm({ ...form, purchasePrice: +e.target.value })}
          />
          <Input
            label="Marge bénéficiaire %"
            type="number"
            step="0.1"
            className="input-number"
            value={form.profitMargin}
            onChange={(e) => setForm({ ...form, profitMargin: +e.target.value })}
          />
          <div className="mb-3">
            <label className="label">Prix HT (calculé)</label>
            <div className="input bg-slate-50 dark:bg-slate-800 text-slate-500 cursor-not-allowed">
              {formatCurrency(
                form.purchasePrice > 0 && form.profitMargin > 0
                  ? calculateSalePrice(form.purchasePrice, form.profitMargin)
                  : form.purchasePrice
              )}
            </div>
          </div>
          <Input
            label="Remise par défaut %"
            type="number"
            step="0.1"
            className="input-number"
            value={form.discount}
            onChange={(e) => setForm({ ...form, discount: +e.target.value })}
          />
          <Select
            label="Unité"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            options={UNITS.map((u) => ({ value: u, label: u }))}
          />
          <Input
            label="Quantité"
            type="number"
            className="input-number"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: +e.target.value })}
          />
          <Input
            label="Quantité minimum"
            type="number"
            className="input-number"
            value={form.minStock}
            onChange={(e) => setForm({ ...form, minStock: +e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={closeModal}>
            Annuler
          </Button>
          <Button
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
            disabled={!form.designation.trim()}
          >
            {editing ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </Modal>


      <ConfirmDialog
        isOpen={!!deleteId}
        title="Supprimer le produit"
        message="Êtes-vous sûr de vouloir supprimer ce produit ?"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}