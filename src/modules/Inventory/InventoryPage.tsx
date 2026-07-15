import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Modal } from '@renderer/components/ui/Modal'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { StatCard } from '@renderer/components/ui/StatCard'
import { apiRequest } from '@renderer/lib/api'
import { formatDateTime } from '@renderer/lib/format'
import type { PaginatedResult } from '@shared/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ClipboardList, Package } from 'lucide-react'
import { useState } from 'react'
import Pagination from '@renderer/components/ui/Pagination'
import toast from 'react-hot-toast'

interface Product {
  _id: string
  designation: string
  stock: number
  minStock: number
  purchasePrice?: number
  supplierId?: string | { _id?: string }
}

interface Valuation {
  totalProducts: number
  currentStock: number
  restockCount: number
  lowStockProducts: Product[]
}

interface StockMovement {
  _id: string
  createdAt: string
  type: 'in' | 'out'
  reason: string
  quantity: number
  stockBefore: number
  stockAfter: number
  productId?: { designation?: string } | string
}

interface InventoryLine {
  productId: string
  designation: string
  theoretical: number
  actual: number
}

export default function InventoryPage() {
  const queryClient = useQueryClient()
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [newStock, setNewStock] = useState(0)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [inventoryLines, setInventoryLines] = useState<InventoryLine[]>([])
  const [supplierModalOpen, setSupplierModalOpen] = useState(false)
  const [supplierModalProduct, setSupplierModalProduct] = useState<Product | null>(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [requiredQuantity, setRequiredQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)

  const { data: valuation } = useQuery({
    queryKey: ['stock-valuation'],
    queryFn: () => apiRequest<Valuation>('/stock/valuation')
  })

  const { data: movements } = useQuery({
    queryKey: ['stock-movements'],
    queryFn: () =>
      apiRequest<PaginatedResult<StockMovement>>('/stock/movements?limit=50')
  })

  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => apiRequest<PaginatedResult<Product>>('/products?limit=500'),
    enabled: inventoryOpen
  })
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => apiRequest<PaginatedResult<{ _id: string; companyName: string }>>('/suppliers?limit=200')
  })

  const adjustMutation = useMutation({
    mutationFn: (data: { productId: string; quantity: number }) =>
      apiRequest('/stock/adjust', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-valuation'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      toast.success('Stock ajusté')
      setAdjustProduct(null)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const createPurchaseOrderMutation = useMutation({
    mutationFn: (data: {
      supplierId: string
      lines: { productId: string; designation: string; quantity: number; unitPrice: number }[]
      notes?: string
    }) =>
      apiRequest('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast.success('Bon de commande créé')
      setSupplierModalOpen(false)
      setSupplierModalProduct(null)
      setSelectedSupplierId('')
      setRequiredQuantity(1)
      setUnitPrice(0)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const inventoryMutation = useMutation({
    mutationFn: (lines: { productId: string; actualStock: number }[]) =>
      apiRequest('/inventory', { method: 'POST', body: JSON.stringify({ lines }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-valuation'] })
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] })
      toast.success('Inventaire enregistré')
      setInventoryOpen(false)
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const startInventory = () => {
    if (products?.data) {
      setInventoryLines(
        products.data.map((p) => ({
          productId: p._id,
          designation: p.designation,
          theoretical: p.stock,
          actual: p.stock
        }))
      )
    }
    setInventoryOpen(true)
  }

  const [lowStockPage, setLowStockPage] = useState(1)
  const [movementsPage, setMovementsPage] = useState(1)
  const PAGE_SIZE = 10
  const PAGE_SIZE_PAA=3

  return (
    <div className="space-y-6">
      <PageHeader
        back
        title="Gestion du stock"
        subtitle="Stock actuel, produits à alimenter et mouvements"
        actions={
          <Button onClick={startInventory}>
            <ClipboardList size={16} />
            Lancer un inventaire
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <StatCard
          title="Stock actuel"
          value={valuation?.currentStock ?? 0}
          icon={<Package size={24} />}
          subtitle="Quantité totale en magasin"
        />
        <StatCard
          title="Produits à alimenter"
          value={valuation?.restockCount ?? 0}
          icon={<AlertTriangle size={24} />}
          color="amber"
          subtitle="Sous le stock minimum"
        />
      </div>

      {valuation?.lowStockProducts && valuation.lowStockProducts.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle className="text-yellow-500" size={20} />
            Liste des produits à alimenter
          </h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Stock actuel</th>
                  <th>Stock minimum</th>
                  <th>Qté à commander</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(valuation.lowStockProducts ?? [])
                  .slice((lowStockPage - 1) * PAGE_SIZE_PAA, lowStockPage * PAGE_SIZE_PAA)
                  .map((p) => (
                    <tr key={p._id}>
                      <td>{p.designation}</td>
                      <td className="text-red-600 font-semibold">{p.stock}</td>
                      <td>{p.minStock}</td>
                      <td className="font-semibold">{Math.max(1, p.minStock - p.stock)}</td>
                      <td>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            const supplierId =
                              typeof p.supplierId === 'string'
                                ? p.supplierId
                                : p.supplierId?._id

                            setSupplierModalProduct(p)
                            setSelectedSupplierId(supplierId ?? '')
                            setRequiredQuantity(Math.max(1, p.minStock - p.stock))
                            setUnitPrice(p.purchasePrice ?? 0)
                            setSupplierModalOpen(true)
                          }}
                        >
                          Commander
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <Pagination
              current={lowStockPage}
              totalPages={Math.max(1, Math.ceil((valuation?.lowStockProducts?.length ?? 0) / PAGE_SIZE_PAA))}
              onChange={(p) => setLowStockPage(p)}
            />
          </div>
        </div>
      )}

      <div className="card p-4">
        <h2 className="font-semibold mb-3">Historique des mouvements</h2>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Produit</th>
                <th>Type</th>
                <th>Raison</th>
                <th>Qté</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {(movements?.data ?? [])
                .slice((movementsPage - 1) * PAGE_SIZE, movementsPage * PAGE_SIZE)
                .map((m) => (
                  <tr key={m._id}>
                    <td className="text-xs">{formatDateTime(m.createdAt)}</td>
                    <td>
                      {typeof m.productId === 'object'
                        ? m.productId?.designation
                        : m.productId}
                    </td>
                    <td>
                      <span className={m.type === 'in' ? 'badge-success' : 'badge-danger'}>
                        {m.type === 'in' ? 'Entrée' : 'Sortie'}
                      </span>
                    </td>
                    <td>{m.reason}</td>
                    <td>{m.quantity}</td>
                    <td>
                      {m.stockAfter}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <Pagination
            current={movementsPage}
            totalPages={Math.max(1, Math.ceil((movements?.total ?? movements?.data?.length ?? 0) / PAGE_SIZE))}
            onChange={(p) => setMovementsPage(p)}
          />
        </div>
      </div>

      <Modal
        isOpen={supplierModalOpen}
        onClose={() => {
          setSupplierModalOpen(false)
          setSupplierModalProduct(null)
          setSelectedSupplierId('')
          setRequiredQuantity(1)
          setUnitPrice(0)
        }}
        title="Choisir un fournisseur"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-sm font-medium">Produit concerné</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">{supplierModalProduct?.designation}</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Quantité à commander</label>
            <Input
              label=""
              type="number"
              min="1"
              className="input-number"
              value={requiredQuantity}
              onChange={(e) => setRequiredQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Prix unitaire</label>
            <Input
              label=""
              type="number"
              min="0"
              step="0.01"
              className="input-number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Fournisseur</label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-900"
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
            >
              <option value="">Sélectionner un fournisseur</option>
              {(suppliers?.data ?? []).map((s: { _id: string; companyName: string }) => (
                <option key={s._id} value={s._id}>
                  {s.companyName}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Choisissez le fournisseur qui livrera ce produit.
            </p>
          </div>

          {!(suppliers?.data?.length ?? 0) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              Aucun fournisseur n’est disponible pour l’instant.
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setSupplierModalOpen(false)
              setSupplierModalProduct(null)
              setSelectedSupplierId('')
              setRequiredQuantity(1)
              setUnitPrice(0)
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={() => {
              if (!selectedSupplierId) {
                toast.error('Sélectionnez un fournisseur')
                return
              }
              if (!supplierModalProduct) return

            createPurchaseOrderMutation.mutate({
              supplierId: selectedSupplierId,
              lines: [
                {
                  productId: supplierModalProduct._id,
                  designation: supplierModalProduct.designation,
                  quantity: requiredQuantity,
                  unitPrice: unitPrice
                }
              ]
            })

            setSupplierModalOpen(false)
            setSupplierModalProduct(null)
            setSelectedSupplierId('')
            setRequiredQuantity(1)
            }}
          >
            Créer bon
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!adjustProduct}
        onClose={() => setAdjustProduct(null)}
        title="Ajuster le stock"
      >
        <p className="mb-3">{adjustProduct?.designation}</p>
        <Input
          label="Nouveau stock"
          type="number"
          className="input-number"
          value={newStock}
          onChange={(e) => setNewStock(+e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setAdjustProduct(null)}>
            Annuler
          </Button>
          <Button
            loading={adjustMutation.isPending}
            onClick={() =>
              adjustProduct &&
              adjustMutation.mutate({ productId: adjustProduct._id, quantity: newStock })
            }
          >
            Enregistrer
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        title="Inventaire physique"
        size="xl"
      >
        <div className="max-h-96 overflow-y-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Théorique</th>
                <th>Réel</th>
                <th>Écart</th>
              </tr>
            </thead>
            <tbody>
              {inventoryLines.map((line, i) => (
                <tr key={line.productId}>
                  <td>{line.designation}</td>
                  <td>{line.theoretical}</td>
                  <td>
                    <input
                      type="number"
                      value={line.actual}
                      className="input w-24"
                      onChange={(e) => {
                        const updated = [...inventoryLines]
                        updated[i] = { ...line, actual: +e.target.value }
                        setInventoryLines(updated)
                      }}
                    />
                  </td>
                  <td
                    className={
                      line.actual - line.theoretical !== 0
                        ? 'text-red-600 font-semibold'
                        : ''
                    }
                  >
                    {line.actual - line.theoretical}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setInventoryOpen(false)}>
            Annuler
          </Button>
          <Button
            loading={inventoryMutation.isPending}
            onClick={() =>
              inventoryMutation.mutate(
                inventoryLines.map((l) => ({
                  productId: l.productId,
                  actualStock: l.actual
                }))
              )
            }
          >
            Valider l&apos;inventaire
          </Button>
        </div>
      </Modal>
    </div>
  )
}
