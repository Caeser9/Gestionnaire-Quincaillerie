import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Modal } from '@renderer/components/ui/Modal'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { StatCard } from '@renderer/components/ui/StatCard'
import { apiRequest } from '@renderer/lib/api'
import { formatCurrency, formatDateTime } from '@renderer/lib/format'
import type { PaginatedResult } from '@shared/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ClipboardList, Package } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface Product {
  _id: string
  designation: string
  stock: number
  minStock: number
}

interface Valuation {
  totalProducts: number
  purchaseValue: number
  saleValue: number
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion du stock"
        subtitle="Suivi des mouvements, inventaires et valorisation"
        actions={
          <Button onClick={startInventory}>
            <ClipboardList size={16} />
            Lancer un inventaire
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Produits"
          value={valuation?.totalProducts ?? 0}
          icon={<Package size={24} />}
        />
        <StatCard
          title="Valeur achat"
          value={formatCurrency(valuation?.purchaseValue ?? 0)}
          icon={<Package size={24} />}
          color="blue"
        />
        <StatCard
          title="Valeur vente"
          value={formatCurrency(valuation?.saleValue ?? 0)}
          icon={<Package size={24} />}
          color="green"
        />
      </div>

      {valuation?.lowStockProducts && valuation.lowStockProducts.length > 0 && (
        <div className="card p-4">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <AlertTriangle className="text-yellow-500" size={20} />
            Alertes stock minimum
          </h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Stock</th>
                  <th>Minimum</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {valuation.lowStockProducts.map((p) => (
                  <tr key={p._id}>
                    <td>{p.designation}</td>
                    <td className="text-red-600 font-semibold">{p.stock}</td>
                    <td>{p.minStock}</td>
                    <td>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setAdjustProduct(p)
                          setNewStock(p.stock)
                        }}
                      >
                        Ajuster
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              {movements?.data?.map((m) => (
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
                    {m.stockBefore} → {m.stockAfter}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={!!adjustProduct}
        onClose={() => setAdjustProduct(null)}
        title="Ajuster le stock"
      >
        <p className="mb-3">{adjustProduct?.designation}</p>
        <Input
          label="Nouveau stock"
          type="number"
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
