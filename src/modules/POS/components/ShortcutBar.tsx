import { User, Search, Trash2, List, Printer, CheckCircle } from 'lucide-react'

interface ShortcutItem {
  key: string
  label: string
  icon: React.ReactNode
  action: () => void
  color?: string
}

interface ShortcutBarProps {
  onF1: () => void
  onF2: () => void
  onF3: () => void
  onF4: () => void
  onF6: () => void
  onF8: () => void
  disabled?: boolean
}

export function ShortcutBar({
  onF1,
  onF2,
  onF3,
  onF4,
  onF6,
  onF8,
  disabled,
}: ShortcutBarProps) {
  const shortcuts: ShortcutItem[] = [
    { key: 'F1', label: 'Client', icon: <User size={14} />, action: onF1 },
    { key: 'F2', label: 'Recherche', icon: <Search size={14} />, action: onF2 },
    { key: 'F3', label: 'Supprimer', icon: <Trash2 size={14} />, action: onF3 },
    { key: 'F4', label: 'Prix', icon: <List size={14} />, action: onF4 },
    { key: 'F6', label: 'Imprimer', icon: <Printer size={14} />, action: onF6 },
    { key: 'F8', label: 'Valider', icon: <CheckCircle size={14} />, action: onF8, color: 'text-primary-600' },
  ]

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
      {shortcuts.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={s.action}
          disabled={disabled && s.key !== 'F1' && s.key !== 'F2'}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${s.color || 'text-slate-500'}
            hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed
          `}
        >
          <kbd className="hidden sm:inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 mr-0.5">
            {s.key}
          </kbd>
          {s.icon}
          <span className="hidden sm:inline">{s.label}</span>
        </button>
      ))}
    </div>
  )
}