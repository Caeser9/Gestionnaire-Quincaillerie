import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { apiRequest } from '@renderer/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface CreatedSupplier {
  _id: string
  companyName: string
}

interface SupplierQuickCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (supplier: CreatedSupplier) => void
}

const emptyForm = {
  companyName: '',
  phone: '',
  contactName: ''
}

export function SupplierQuickCreateModal({
  isOpen,
  onClose,
  onCreated
}: SupplierQuickCreateModalProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (isOpen) setForm(emptyForm)
  }, [isOpen])

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest<CreatedSupplier>('/suppliers', {
        method: 'POST',
        body: JSON.stringify(form)
      }),
    onSuccess: (supplier) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast.success(`Fournisseur « ${supplier.companyName} » créé`)
      onCreated(supplier)
      onClose()
    },
    onError: (err: Error) => toast.error(err.message)
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-md animate-slide-up shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Nouveau fournisseur</h2>
            <p className="text-sm text-slate-500 mt-0.5">Création rapide sans quitter le formulaire</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost p-2 rounded-xl -mr-1 -mt-1 text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-1">
          <Input
            label="Raison sociale *"
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            autoFocus
          />
          <Input
            label="Téléphone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="Contact principal"
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={!form.companyName.trim()}
              onClick={() => createMutation.mutate()}
            >
              Créer et sélectionner
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
