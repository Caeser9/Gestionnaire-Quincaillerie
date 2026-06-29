import { PageHeader } from '@renderer/components/ui/PageHeader'
import { StatCard } from '@renderer/components/ui/StatCard'
import { apiRequest } from '@renderer/lib/api'
import { formatCurrency, formatDate } from '@renderer/lib/format'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  DollarSign,
  FileText,
  Package,
  ShoppingBag,
  TrendingUp
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

interface DashboardData {
  todayRevenue: number
  todaySales: number
  todayProfit: number
  todayInvoices: number
  lowStockCount: number
  recentPurchases: { _id: string; reference: string; createdAt: string }[]
  recentCustomers: { _id: string; name: string; phone?: string; reference: string }[]
  topProducts: { productId: string; designation: string; quantity: number; revenue: number }[]
  monthlySales: { month: string; revenue: number; profit: number }[]
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiRequest<DashboardData>('/dashboard')
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-200 border-t-primary-600" />
        <p className="text-sm text-slate-400">Chargement du tableau de bord...</p>
      </div>
    )
  }

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        subtitle={`Aperçu de votre activité — ${todayLabel}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Chiffre d'affaires"
          value={formatCurrency(data?.todayRevenue ?? 0)}
          icon={<DollarSign size={22} />}
          color="green"
          subtitle="Aujourd'hui"
        />
        <StatCard
          title="Ventes"
          value={data?.todaySales ?? 0}
          icon={<ShoppingBag size={22} />}
          color="blue"
          subtitle="Transactions du jour"
        />
        <StatCard
          title="Bénéfice estimé"
          value={formatCurrency(data?.todayProfit ?? 0)}
          icon={<TrendingUp size={22} />}
          color="purple"
          subtitle="Marge brute"
        />
        <StatCard
          title="Factures"
          value={data?.todayInvoices ?? 0}
          icon={<FileText size={22} />}
          color="amber"
          subtitle="Émises aujourd'hui"
        />
      </div>

      {data && data.lowStockCount > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <AlertTriangle className="text-amber-600" size={20} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-800 dark:text-amber-200">Alerte stock</p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {data.lowStockCount} produit{data.lowStockCount > 1 ? 's' : ''} sous le seuil minimum
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-6">
          <h2 className="section-title">Ventes mensuelles</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.monthlySales ?? []} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'CA']}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}
              />
              <Bar dataKey="revenue" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h2 className="section-title">Bénéfices mensuels</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data?.monthlySales ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'Bénéfice']}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5">
          <h2 className="section-title flex items-center gap-2">
            <Package size={18} className="text-primary-500" />
            Meilleures ventes
          </h2>
          <div className="space-y-1">
            {data?.topProducts?.slice(0, 5).map((p, i) => (
              <div
                key={p.productId}
                className="flex items-center gap-3 py-2.5 border-b border-slate-50 dark:border-slate-800 last:border-0"
              >
                <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm truncate text-slate-700 dark:text-slate-300">
                  {p.designation}
                </span>
                <span className="text-sm font-semibold text-primary-600">{p.quantity} u.</span>
              </div>
            ))}
            {!data?.topProducts?.length && (
              <p className="text-slate-400 text-sm py-4 text-center">Aucune vente enregistrée</p>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="section-title">Derniers achats</h2>
          <div className="space-y-1">
            {data?.recentPurchases?.map((p) => (
              <div
                key={p._id}
                className="py-2.5 border-b border-slate-50 dark:border-slate-800 last:border-0"
              >
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.reference}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDate(p.createdAt)}</p>
              </div>
            ))}
            {!data?.recentPurchases?.length && (
              <p className="text-slate-400 text-sm py-4 text-center">Aucun achat</p>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="section-title">Derniers clients</h2>
          <div className="space-y-1">
            {data?.recentCustomers?.map((c) => (
              <div
                key={c._id}
                className="flex items-center gap-3 py-2.5 border-b border-slate-50 dark:border-slate-800 last:border-0"
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 text-xs font-bold shrink-0">
                  {c.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.phone || c.reference}</p>
                </div>
              </div>
            ))}
            {!data?.recentCustomers?.length && (
              <p className="text-slate-400 text-sm py-4 text-center">Aucun client</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
