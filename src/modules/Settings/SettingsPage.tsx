import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { useLicense } from '@renderer/contexts/LicenseContext'
import { DEFAULT_MONGO_URI } from '@shared/constants'
import { apiRequest } from '@renderer/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, RefreshCw } from 'lucide-react'
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
  const { status, authorizedModules, refresh } = useLicense()
  const [machineId, setMachineId] = useState('')
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

  useEffect(() => {
    window.electronAPI?.getLicenseMachineId?.().then(setMachineId)
  }, [])

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

  const verifyLicenseNow = async () => {
    try {
      if (window.electronAPI?.verifyLicense) {
        await window.electronAPI.verifyLicense()
      }
      await refresh()
      toast.success('Licence verifiee')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de verification licence')
    }
  }

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

      <section className="card p-6 space-y-3">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <KeyRound size={18} />
          Licence logiciel
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500">Statut</p>
            <p className="font-medium capitalize">{status?.status ?? '—'}</p>
          </div>
          <div>
            <p className="text-slate-500">Type</p>
            <p className="font-medium">{status?.licenseType ?? '—'}</p>
          </div>
          <div>
            <p className="text-slate-500">Clé</p>
            <p className="font-mono text-xs">{status?.licenseKey ?? '—'}</p>
          </div>
          <div>
            <p className="text-slate-500">Expiration</p>
            <p className="font-medium">
              {status?.expiresAt ? new Date(status.expiresAt).toLocaleDateString('fr-FR') : 'Illimitée'}
            </p>
          </div>
        </div>
        {authorizedModules.length > 0 && (
          <div>
            <p className="text-sm text-slate-500 mb-1">Modules autorisés</p>
            <div className="flex flex-wrap gap-1.5">
              {authorizedModules.map((m) => (
                <span key={m} className="badge-neutral text-xs">
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
        {status?.adminNotes && (
          <div>
            <p className="text-sm text-slate-500 mb-1">Note administrateur</p>
            <p className="text-sm whitespace-pre-wrap rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-3">
              {status.adminNotes}
            </p>
          </div>
        )}
        {machineId && (
          <p className="text-xs text-slate-400 font-mono break-all">Machine ID : {machineId}</p>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={verifyLicenseNow}>
            <RefreshCw size={16} />
            Vérifier la licence
          </Button>
        </div>
      </section>
    </div>
  )
}
