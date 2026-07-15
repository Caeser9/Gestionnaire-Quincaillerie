import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Select } from '@renderer/components/ui/Select'
import { StatCard } from '@renderer/components/ui/StatCard'
import { apiRequest } from '@renderer/lib/api'
import { formatCurrency } from '@renderer/lib/format'
import { useQuery } from '@tanstack/react-query'
import { ChartColumn, DollarSign, Package, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

interface SalesReport {
  count: number
  totalRevenue: number
}

interface ProfitReport {
  cost: number
  profit: number
}

interface TopProduct {
  designation: string
  revenue: number
}

interface TopCustomer {
  name: string
  totalPurchases: number
}

export default function ReportsPage() {
  const now = new Date()
  const [year, setYear] = useState(String(now.getFullYear()))
  const [month, setMonth] = useState(String(now.getMonth() + 1))

  const { data: salesReport } = useQuery({
    queryKey: ['reports-sales', year, month],
    queryFn: () =>
      apiRequest<SalesReport>(`/reports/sales?period=month&year=${year}&month=${month}`)
  })

  const { data: profit } = useQuery({
    queryKey: ['reports-profit', year, month],
    queryFn: () => apiRequest<ProfitReport>(`/reports/profit?year=${year}&month=${month}`)
  })

  const { data: topProducts } = useQuery({
    queryKey: ['reports-top-products'],
    queryFn: () => apiRequest<TopProduct[]>('/reports/top-products')
  })

  const { data: topCustomers } = useQuery({
    queryKey: ['reports-top-customers'],
    queryFn: () => apiRequest<TopCustomer[]>('/reports/top-customers')
  })

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i).toLocaleString('fr', { month: 'long' })
  }))

  const chartData =
    topProducts?.slice(0, 8).map((p) => ({
      name: p.designation.substring(0, 15),
      revenue: p.revenue
    })) || []

  return (
    <div className="space-y-6">
      <PageHeader
        back
        title="Rapports"
        subtitle="Analyse des ventes, bénéfices et performances"
        actions={
          <div className="flex gap-2">
            <Select value={month} onChange={(e) => setMonth(e.target.value)} options={months} />
            <Select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              options={['2024', '2025', '2026'].map((y) => ({ value: y, label: y }))}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Nombre de ventes"
          value={salesReport?.count ?? 0}
          icon={<ChartColumn size={22} />}
          color="blue"
        />
        <StatCard
          title="Chiffre d'affaires"
          value={formatCurrency(salesReport?.totalRevenue ?? 0)}
          icon={<DollarSign size={22} />}
          color="green"
        />
        <StatCard
          title="Coût d'achat"
          value={formatCurrency(profit?.cost ?? 0)}
          icon={<Package size={22} />}
          color="amber"
        />
        <StatCard
          title="Bénéfice net"
          value={formatCurrency(profit?.profit ?? 0)}
          icon={<TrendingUp size={22} />}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Produits les plus vendus</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="revenue" fill="#f97316" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold mb-4">Clients les plus rentables</h2>
          <div className="space-y-2">
            {topCustomers?.map((c, i) => (
              <div
                key={i}
                className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <span>
                  {i + 1}. {c.name}
                </span>
                <span className="font-medium">{formatCurrency(c.totalPurchases)}</span>
              </div>
            ))}
            {!topCustomers?.length && (
              <p className="text-gray-400 text-sm">Aucune donnée</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
