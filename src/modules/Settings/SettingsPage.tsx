import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { DEFAULT_MONGO_URI } from '@shared/constants'
import { apiRequest } from '@renderer/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface Settings {
  companyName: string
  companyAddress?: string
  companyPhone?: string
  defaultTva: number
  currency: string
  invoiceFormat: string
  mongoUri?: string
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    defaultTva: 19,
    currency: 'DT',
    invoiceFormat: 'FAC-{year}-{number}'
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiRequest<Settings>('/settings')
  })

  useEffect(() => {
    if (settings) {
      setForm({
        companyName: settings.companyName,
        companyAddress: settings.companyAddress || '',
        companyPhone: settings.companyPhone || '',
        defaultTva: settings.defaultTva,
        currency: settings.currency,
        invoiceFormat: settings.invoiceFormat
      })
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...data,
          mongoUri: settings?.mongoUri || DEFAULT_MONGO_URI
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Paramètres enregistrés')
    },
    onError: (err: Error) => toast.error(err.message)
  })

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="page-title">Paramètres</h1>
      <p className="page-subtitle">Configuration de la société</p>

      <section className="card p-6 space-y-3">
        <h2 className="text-lg font-semibold mb-2">Informations société</h2>
        <Input
          label="Nom société"
          value={form.companyName}
          onChange={(e) => setForm({ ...form, companyName: e.target.value })}
        />
        <Input
          label="Adresse"
          value={form.companyAddress}
          onChange={(e) => setForm({ ...form, companyAddress: e.target.value })}
        />
        <Input
          label="Téléphone"
          value={form.companyPhone}
          onChange={(e) => setForm({ ...form, companyPhone: e.target.value })}
        />
        <Input
          label="TVA par défaut %"
          type="number"
          value={form.defaultTva}
          onChange={(e) => {
            const tva = Number(e.target.value)
            setForm({ ...form, defaultTva: Number.isFinite(tva) ? tva : 0 })
          }}
        />
        <Input
          label="Devise"
          value={form.currency}
          onChange={(e) => setForm({ ...form, currency: e.target.value })}
        />
        <Input
          label="Format facture"
          value={form.invoiceFormat}
          onChange={(e) => setForm({ ...form, invoiceFormat: e.target.value })}
        />
        <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
          Enregistrer
        </Button>
      </section>
    </div>
  )
}
