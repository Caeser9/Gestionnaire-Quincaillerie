import type { ReactNode } from 'react'

const colorMap = {
  blue: { kpi: 'kpi-blue', icon: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400' },
  green: { kpi: 'kpi-green', icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' },
  amber: { kpi: 'kpi-amber', icon: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' },
  red: { kpi: 'kpi-red', icon: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' },
  purple: { kpi: 'kpi-purple', icon: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400' }
} as const

interface StatCardProps {
  title: string
  value: string | number
  icon: ReactNode
  color?: keyof typeof colorMap
  subtitle?: string
}

export function StatCard({ title, value, icon, color = 'blue', subtitle }: StatCardProps) {
  const c = colorMap[color]

  return (
    <div className={`kpi-card ${c.kpi}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 pl-2">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tracking-tight">
            {value}
          </p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl shrink-0 ${c.icon}`}>{icon}</div>
      </div>
    </div>
  )
}
