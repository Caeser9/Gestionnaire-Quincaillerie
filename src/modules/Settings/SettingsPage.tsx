import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Select } from '@renderer/components/ui/Select'
import { useLicense } from '@renderer/contexts/LicenseContext'
import { DEFAULT_MONGO_URI } from '@shared/constants'
import { apiRequest } from '@renderer/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Store, Wrench, ShoppingCart, Building2, Factory, Briefcase } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface Settings {
  companyName: string
  companyAddress?: string
  companyPhone?: string
  companyFax?: string
  companyMatriculeFiscal?: string
  companyTvaCode?: string
  companyRC?: string
  defaultTva: number
  currency: string
  mongoUri?: string
  storeName?: string
  storeIcon?: string
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { status, authorizedModules } = useLicense()
  const [machineId, setMachineId] = useState('')
  const [form, setForm] = useState({
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    companyFax: '',
    companyMatriculeFiscal: '',
    companyTvaCode: '',
    companyRC: '',
    defaultTva: 19,
    currency: 'DT',
    storeName: '',
    storeIcon: 'store'
  })

  const storeIcons = [
    { value: 'store', label: 'Boutique', icon: Store },
    { value: 'wrench', label: 'Quincaillerie', icon: Wrench },
    { value: 'shopping', label: 'Supermarché', icon: ShoppingCart },
    { value: 'building', label: 'Commerce', icon: Building2 },
    { value: 'factory', label: 'Usine', icon: Factory },
    { value: 'briefcase', label: 'Bureau', icon: Briefcase }
  ]

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
        companyFax: settings.companyFax || '',
        companyMatriculeFiscal: settings.companyMatriculeFiscal || '',
        companyTvaCode: settings.companyTvaCode || '',
        companyRC: settings.companyRC || '',
        defaultTva: settings.defaultTva,
        currency: settings.currency,
        storeName: settings.storeName || '',
        storeIcon: settings.storeIcon || 'store'
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

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader title="Paramètres" subtitle="Configuration de la société" back />

      <section className="card p-6 space-y-3">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Store size={18} />
          Personnalisation boutique
        </h2>
        <p className="text-sm text-slate-500 mb-3">
          Personnalisez le nom et l'icône de votre application.
        </p>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Icône de la boutique</label>
          <div className="grid grid-cols-3 gap-3">
            {storeIcons.map((icon) => {
              const IconComponent = icon.icon
              return (
                <button
                  key={icon.value}
                  type="button"
                  onClick={() => setForm({ ...form, storeIcon: icon.value })}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    form.storeIcon === icon.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                  }`}
                >
                  <IconComponent size={24} className={form.storeIcon === icon.value ? 'text-primary-600' : 'text-slate-400'} />
                  <span className="text-xs font-medium">{icon.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
          Enregistrer
        </Button>
      </section>
      <section className="card p-6 space-y-3">
        <h2 className="text-lg font-semibold mb-2">Informations société</h2>
        <p className="text-sm text-slate-500 mb-3">
          Ces informations apparaissent sur les factures, bons de livraison et devis (bloc vendeur).
        </p>
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
          label="Fax"
          value={form.companyFax}
          onChange={(e) => setForm({ ...form, companyFax: e.target.value })}
        />        
        <Input
          label="TVA %"
          type="number"
          disabled 
          value={form.defaultTva}
          onChange={(e) => {
            const tva = Number(e.target.value)
            setForm({ ...form, defaultTva: Number.isFinite(tva) ? tva : 0 })
          }}
        />
        <Input
          label="Registre de commerce"
          value={form.companyRC}
          onChange={(e) => setForm({ ...form, companyRC: e.target.value })}
        />
        <Input
          label="Code TVA"
          value={form.companyTvaCode}
          onChange={(e) => setForm({ ...form, companyTvaCode: e.target.value })}
        />
        <Input
          label="Devise"
          value={form.currency}
          onChange={(e) => setForm({ ...form, currency: e.target.value })}
        />
        <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
          Enregistrer
        </Button>
      </section>

      <section className="card p-6 space-y-3">
        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <Store size={18} />
          Personnalisation boutique
        </h2>
        <p className="text-sm text-slate-500 mb-3">
          Personnalisez le nom et l'icône de votre application.
        </p>
        <Input
          label="Nom de la boutique"
          value={form.storeName}
          onChange={(e) => setForm({ ...form, storeName: e.target.value })}
          placeholder="Ex: Ma Boutique"
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Icône de la boutique</label>
          <div className="grid grid-cols-3 gap-3">
            {storeIcons.map((icon) => {
              const IconComponent = icon.icon
              return (
                <button
                  key={icon.value}
                  type="button"
                  onClick={() => setForm({ ...form, storeIcon: icon.value })}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    form.storeIcon === icon.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                  }`}
                >
                  <IconComponent size={24} className={form.storeIcon === icon.value ? 'text-primary-600' : 'text-slate-400'} />
                  <span className="text-xs font-medium">{icon.label}</span>
                </button>
              )
            })}
          </div>
        </div>
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
      </section>
    </div>
  )
}
