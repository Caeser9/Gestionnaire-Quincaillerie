import { X } from 'lucide-react'
import type { ReactNode } from 'react'

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
} as const

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  size?: keyof typeof sizes
}

export function Modal({ isOpen, onClose, title, subtitle, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative card w-full ${sizes[size]} max-h-[90vh] overflow-hidden flex flex-col animate-slide-up shadow-2xl`}
      >
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-2 rounded-xl -mr-1 -mt-1 text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
