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
import { Download, Hash, Package, Pencil, Plus, Trash2, Upload, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { read, utils } from 'xlsx'
import { SupplierQuickCreateModal } from '../Suppliers/SupplierQuickCreateModal'

const UNITS = ['pièce', 'kg', 'm', 'm²', 'L', 'boîte', 'paquet', 'rouleau']

interface Product {
  _id: string
  reference: string
  designation: string
  barcode?: string
  description?: string
  categoryId?: { _id: string; name: string; prefix?: string } | string
  subCategoryId?: string
  brand?: string
  supplierId?: string | { _id: string; companyName?: string }
  purchasePrice: number
  salePrice: number
  profitMargin: number
  discount: number
  tva: number
  subjectToFodec?: boolean
  stock: number
  minStock: number
  unit: string
  location?: string
}

interface Category {
  _id: string
  name: string
  prefix: string
}

const emptyForm = {
  designation: '',
  barcode: '',
  description: '',
  categoryId: '',
  subCategoryId: '',
  brand: '',
  supplierId: '',
  purchasePrice: 0,
  salePrice: 0,
  profitMargin: 25,
  discount: 0,
  tva: 19,
  subjectToFodec: false,
  stock: 0,
  minStock: 0,
  unit: 'pièce',
  location: ''
}

function getCategoryId(p: Product): string {
  return typeof p.categoryId === 'object' ? p.categoryId?._id : (p.categoryId as string) || ''
}

function getCategoryName(p: Product): string {
  return typeof p.categoryId === 'object' ? p.categoryId?.name || '' : ''
}

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [activeTab, setActiveTab] = useState<string>('all')
  const [supplierCreateOpen, setSupplierCreateOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['products', debouncedSearch],
    queryFn: () =>
      apiRequest<PaginatedResult<Product>>(
        `/products?search=${debouncedSearch}&limit=100`
      )
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiRequest<Category[]>('/categories')
  })

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => apiRequest<PaginatedResult<{ _id: string; companyName: string }>>('/suppliers?limit=200')
  })

  const { data: subcategories } = useQuery({
    queryKey: ['subcategories', form.categoryId],
    queryFn: () =>
      apiRequest<Category[]>(`/subcategories?categoryId=${form.categoryId}`),
    enabled: !!form.categoryId
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

  const openCreate = (categoryId?: string) => {
    setEditing(null)
    setForm({ ...emptyForm, categoryId: categoryId || '' })
    setModalOpen(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    const catId = typeof p.categoryId === 'object' ? p.categoryId?._id : (p.categoryId as string) || ''
    setForm({
      designation: p.designation,
      barcode: p.barcode || '',
      description: p.description || '',
      categoryId: catId,
      subCategoryId: (p.subCategoryId as string) || '',
      brand: p.brand || '',
      supplierId:
        typeof p.supplierId === 'object' ? p.supplierId?._id : (p.supplierId as string) || '',
      purchasePrice: p.purchasePrice,
      salePrice: p.salePrice,
      profitMargin: p.profitMargin,
      discount: p.discount,
      tva: p.tva,
      subjectToFodec: p.subjectToFodec ?? false,
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

  /** Compute the auto-generated reference preview based on selected category */
  const referencePreview = useMemo(() => {
    if (editing) {
      // When editing, show the existing reference as read-only
      return editing.reference
    }
    if (!form.categoryId || !categories) return '—'
    const cat = categories.find((c) => c._id === form.categoryId)
    if (!cat) return '—'
    return `${cat.prefix}XXXXXX (généré automatiquement)`
  }, [editing, form.categoryId, categories])

  /** Group products by category */
  const productsByCategory = useMemo(() => {
    if (!data?.data || !categories) return new Map<string, Product[]>()

    const grouped = new Map<string, Product[]>()
    // Initialize all categories with empty arrays
    for (const cat of categories) {
      grouped.set(cat._id, [])
    }
    // Distribute products
    for (const p of data.data) {
      const catId = getCategoryId(p)
      if (grouped.has(catId)) {
        grouped.get(catId)!.push(p)
      } else {
        // Products with unknown categories go to 'all'
        const all = grouped.get('__all__') || []
        all.push(p)
        grouped.set('__all__', all)
      }
    }
    return grouped
  }, [data?.data, categories])

  const allProductsCount = data?.total ?? 0

  // Compute active tab products
  const activeProducts = useMemo(() => {
    if (activeTab === 'all') return data?.data ?? []
    return productsByCategory.get(activeTab) ?? []
  }, [activeTab, data?.data, productsByCategory])

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

  const tabCategories = categories ?? []

  return (
    <div className="space-y-5">
      <PageHeader
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

      {/* Tabs by category */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700 pb-px">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
            activeTab === 'all'
              ? 'bg-white dark:bg-slate-900 text-primary-600 border-b-2 border-primary-500 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          Tous
          <span className="ml-1.5 text-xs text-slate-400">({allProductsCount})</span>
        </button>
        {tabCategories.map((cat) => {
          const count = productsByCategory.get(cat._id)?.length ?? 0
          return (
            <button
              key={cat._id}
              onClick={() => setActiveTab(cat._id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
                activeTab === cat._id
                  ? 'bg-white dark:bg-slate-900 text-primary-600 border-b-2 border-primary-500 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="font-mono text-xs mr-1.5 text-slate-400">{cat.prefix}</span>
              {cat.name}
              <span className="ml-1.5 text-xs text-slate-400">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Products table for active tab */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation</th>
              <th>Catégorie</th>
              <th>Prix vente</th>
              <th>Stock</th>
              <th>Unité</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeProducts.map((p) => (
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
                <td className="text-sm text-slate-500">{getCategoryName(p)}</td>
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
        {!activeProducts.length && (
          <EmptyState
            icon={<Package size={28} />}
            title="Aucun produit"
            description={
              activeTab === 'all'
                ? "Ajoutez votre premier produit ou importez depuis Excel"
                : "Aucun produit dans cette catégorie"
            }
            action={
              <Button onClick={() => openCreate(activeTab !== 'all' ? activeTab : undefined)}>
                <Plus size={16} />
                Ajouter un produit
              </Button>
            }
          />
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? 'Modifier produit' : 'Nouveau produit'}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          {/* Référence — auto-générée et en lecture seule */}
          {/* <div className="mb-3">
            <label className="label">Référence</label>
            <div className="input bg-slate-50 dark:bg-slate-800 text-slate-500 flex items-center gap-2 cursor-not-allowed">
              <Hash size={14} className="text-slate-400" />
              <span className="text-sm">{referencePreview}</span>
            </div>
            {!editing && form.categoryId && (
              <p className="text-xs text-primary-500 mt-1">
                Référence générée automatiquement à la création
              </p>
            )}
          </div> */}

          <Input
            label="Désignation *"
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
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
            value={form.purchasePrice}
            onChange={(e) => setForm({ ...form, purchasePrice: +e.target.value })}
          />
          <Input
            label="Marge bénéficiaire %"
            type="number"
            step="0.1"
            value={form.profitMargin}
            onChange={(e) => setForm({ ...form, profitMargin: +e.target.value })}
          />
          <div className="mb-3">
            <label className="label">Prix de vente (calculé)</label>
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
            value={form.discount}
            onChange={(e) => setForm({ ...form, discount: +e.target.value })}
          />
          <Input
            label="TVA %"
            type="number"
            value={form.tva}
            onChange={(e) => setForm({ ...form, tva: +e.target.value })}
          />
          <label className="flex items-center gap-2 cursor-pointer select-none mb-3">
            <input
              type="checkbox"
              checked={form.subjectToFodec}
              onChange={(e) => setForm({ ...form, subjectToFodec: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Soumis au FODEC (1% sur HT)
            </span>
          </label>
          <div className="mb-3">
            <label className="label">Fournisseur</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Select
                  value={form.supplierId}
                  onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                  options={[
                    { value: '', label: '-- Aucun --' },
                    ...(suppliers?.data?.map((s) => ({ value: s._id, label: s.companyName })) || [])
                  ]}
                />
              </div>
              <button
                type="button"
                onClick={() => setSupplierCreateOpen(true)}
                className="btn-secondary px-3 shrink-0 self-end mb-0.5"
                title="Nouveau fournisseur"
              >
                <UserPlus size={18} />
              </button>
            </div>
          </div>
          <Select
            label="Unité"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            options={UNITS.map((u) => ({ value: u, label: u }))}
          />
          <Input
            label="Stock"
            type="number"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: +e.target.value })}
          />
          <Input
            label="Stock minimum"
            type="number"
            value={form.minStock}
            onChange={(e) => setForm({ ...form, minStock: +e.target.value })}
          />

          {/* Catégorie — requise pour générer la référence */}
          <Select
            label="Catégorie *"
            value={form.categoryId}
            onChange={(e) =>
              setForm({ ...form, categoryId: e.target.value, subCategoryId: '' })
            }
            options={[
              { value: '', label: '-- Sélectionnez une catégorie --' },
              ...(categories?.map((c) => ({
                value: c._id,
                label: `${c.name} (${c.prefix})`
              })) || [])
            ]}
          />
          <Select
            label="Sous-catégorie"
            value={form.subCategoryId}
            onChange={(e) => setForm({ ...form, subCategoryId: e.target.value })}
            options={[
              { value: '', label: '--' },
              ...(subcategories?.map((s) => ({ value: s._id, label: s.name })) || [])
            ]}
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={closeModal}>
            Annuler
          </Button>
          <Button
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
            disabled={!form.categoryId}
          >
            {editing ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </Modal>

      <SupplierQuickCreateModal
        isOpen={supplierCreateOpen}
        onClose={() => setSupplierCreateOpen(false)}
        onCreated={(supplier) => setForm((f) => ({ ...f, supplierId: supplier._id }))}
      />

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