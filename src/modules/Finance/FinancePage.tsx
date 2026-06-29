import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Modal } from '@renderer/components/ui/Modal'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Select } from '@renderer/components/ui/Select'
import { StatCard } from '@renderer/components/ui/StatCard'
import { apiRequest } from '@renderer/lib/api'
import { formatCurrency, formatDate } from '@renderer/lib/format'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

const EXPENSE_CATEGORIES = [
  { value: 'merchandise', label: 'Achats de marchandises' },
  { value: 'transport', label: 'Transport' },
  { value: 'rent', label: 'Loyer' },
  { value: 'electricity', label: 'Électricité' },
  { value: 'other', label: 'Autres charges' }
]

interface FinanceSummary {
  recettes: number
  depenses: number
  beneficeNet: number
  recettesDetail: { source: string; total: number }[]
  depensesParCategorie: { category: string; label: string; total: number }[]
  expenses: {
    _id: string
    label: string
    category: string
    amount: number
    date: string
  }[]
}

export default function FinancePage() {
  const queryClient = useQueryClient()
  const now = new Date()
  const [year, setYear] = useState(String(now.getFullYear()))
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    label: '',
    category: 'other',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    notes: ''
  })

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i).toLocaleString('fr', { month: 'long' })
  }))

  const { data, isLoading } = useQuery({
    queryKey: ['finance-summary', year, month],
    queryFn: () => apiRequest<FinanceSummary>(`/finance/summary?year=${year}&month=${month}`)
  })

  const addMutation = useMutation({
    mutationFn: (body: typeof form) =>
      apiRequest('/expenses', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] })
      toast.success('Dépense enregistrée')
      setModalOpen(false)
      setForm({
        label: '',
        category: 'other',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        notes: ''
      })
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] })
      toast.success('Dépense supprimée')
    }
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recettes, Dépenses & Bénéfices"
        subtitle="Vision globale de la santé financière de votre activité"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Select value={month} onChange={(e) => setMonth(e.target.value)} options={months} />
            <Select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              options={['2024', '2025', '2026'].map((y) => ({ value: y, label: y }))}
            />
            <Button onClick={() => setModalOpen(true)}>
              <Plus size={16} />
              Ajouter dépense
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-200 border-t-primary-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Recettes (entrées)"
              value={formatCurrency(data?.recettes ?? 0)}
              subtitle="Sommes réellement encaissées"
              icon={<TrendingUp size={22} />}
              color="green"
            />
            <StatCard
              title="Dépenses (charges)"
              value={formatCurrency(data?.depenses ?? 0)}
              subtitle="Achats, loyer, transport..."
              icon={<TrendingDown size={22} />}
              color="red"
            />
            <StatCard
              title="Bénéfice net"
              value={formatCurrency(data?.beneficeNet ?? 0)}
              subtitle="Recettes − Dépenses"
              icon={<DollarSign size={22} />}
              color={(data?.beneficeNet ?? 0) >= 0 ? 'green' : 'red'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h2 className="section-title">Détail des recettes</h2>
              <div className="space-y-2">
                {data?.recettesDetail?.map((r, i) => (
                  <div
                    key={i}
                    className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0"
                  >
                    <span className="text-sm text-slate-600 dark:text-slate-400">{r.source}</span>
                    <span className="font-semibold text-emerald-600">
                      {formatCurrency(r.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="section-title">Dépenses par catégorie</h2>
              <div className="space-y-2">
                {data?.depensesParCategorie?.length ? (
                  data.depensesParCategorie.map((d) => (
                    <div
                      key={d.category}
                      className="flex justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0"
                    >
                      <span className="text-sm">{d.label}</span>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(d.total)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Aucune dépense ce mois</p>
                )}
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="section-title">Journal des dépenses manuelles</h2>
            <div className="table-container border-0 shadow-none">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Libellé</th>
                    <th>Catégorie</th>
                    <th>Montant</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data?.expenses?.map((e) => (
                    <tr key={e._id}>
                      <td>{formatDate(e.date)}</td>
                      <td className="font-medium">{e.label}</td>
                      <td>
                        <span className="badge-neutral">
                          {EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label}
                        </span>
                      </td>
                      <td className="text-red-600 font-semibold">
                        {formatCurrency(e.amount)}
                      </td>
                      <td>
                        <button
                          onClick={() => deleteMutation.mutate(e._id)}
                          className="btn-ghost btn-sm text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!data?.expenses?.length && (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-400 py-6">
                        Aucune dépense manuelle — les achats fournisseurs sont comptabilisés
                        automatiquement
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nouvelle dépense"
        subtitle="Transport, loyer, électricité..."
      >
        <Input
          label="Libellé"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="ex: Facture électricité janvier"
        />
        <Select
          label="Catégorie"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          options={EXPENSE_CATEGORIES}
        />
        <Input
          label="Montant"
          type="number"
          step="0.001"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: +e.target.value })}
        />
        <Input
          label="Date"
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
        />
        <Input
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Annuler
          </Button>
          <Button loading={addMutation.isPending} onClick={() => addMutation.mutate(form)}>
            Enregistrer
          </Button>
        </div>
      </Modal>
    </div>
  )
}
