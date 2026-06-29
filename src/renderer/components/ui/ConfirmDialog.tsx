interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  loading
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative card max-w-md w-full p-6 animate-slide-up shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
        <p className="text-slate-500 dark:text-slate-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary" disabled={loading}>
            Annuler
          </button>
          <button onClick={onConfirm} className="btn-danger" disabled={loading}>
            {loading ? 'Suppression...' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}
