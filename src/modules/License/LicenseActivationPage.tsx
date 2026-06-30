import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { PRODUCT_SLUG } from '@shared/constants/license'
import type { ActivateParams } from '@shared/types/license'
import { KeyRound, LoaderCircle, RefreshCw, ShieldCheck, Wrench } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface LicenseActivationPageProps {
  onActivated: () => void
  initialPending?: boolean
  machineId?: string
}

export function LicenseActivationPage({
  onActivated,
  initialPending,
  machineId
}: LicenseActivationPageProps) {
  const [form, setForm] = useState<ActivateParams>({
    companyName: '',
    contactEmail: '',
    contactPhone: '',
    licenseKey: ''
  })
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [pending, setPending] = useState(initialPending ?? false)
  const [hwId, setHwId] = useState(machineId ?? '')

  useEffect(() => {
    if (!hwId && window.electronAPI?.getLicenseMachineId) {
      window.electronAPI.getLicenseMachineId().then(setHwId)
    }
  }, [hwId])

  useEffect(() => {
    window.electronAPI?.getPendingActivation?.().then((saved) => {
      if (saved) {
        setForm(saved)
        setPending(true)
      }
    })
  }, [])

  const checkApproval = useCallback(async () => {
    if (!window.electronAPI?.retryPendingActivation) return false
    setChecking(true)
    try {
      const result = await window.electronAPI.retryPendingActivation()
      if (
        result.success &&
        (result.status === 'activated' || result.status === 'already_active')
      ) {
        toast.success('Licence activée !')
        onActivated()
        return true
      }
      return false
    } catch (err) {
      console.error('[License] check failed:', err)
      return false
    } finally {
      setChecking(false)
    }
  }, [onActivated])

  useEffect(() => {
    if (!pending) return
    checkApproval()
    const interval = setInterval(checkApproval, 8000)
    return () => clearInterval(interval)
  }, [pending, checkApproval])

  const handleActivate = async () => {
    if (!form.companyName.trim() || !form.contactEmail.trim()) {
      toast.error('Raison sociale et email requis')
      return
    }
    if (!window.electronAPI?.activateLicense) {
      toast.error('API licence indisponible')
      return
    }

    setLoading(true)
    try {
      const payload = {
        companyName: form.companyName.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone?.trim() || undefined,
        licenseKey: form.licenseKey?.trim() || undefined
      }
      const result = await window.electronAPI.activateLicense(payload)

      if (result.status === 'pending') {
        setPending(true)
        toast.success(result.message ?? 'Demande envoyée — en attente de validation')
        return
      }

      if (result.success) {
        toast.success(result.message ?? 'Licence activée')
        onActivated()
      } else {
        toast.error(result.message ?? 'Activation échouée')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center page-bg p-6">
      <div className="card w-full max-w-lg p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <Wrench size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Activation du logiciel
            </h1>
            <p className="text-sm text-slate-500">Gestionnaire Quincaillerie</p>
          </div>
        </div>

        {pending ? (
          <div className="text-center py-8 space-y-4">
            <LoaderCircle
              size={40}
              className={`mx-auto text-primary-500 ${checking ? 'animate-spin' : ''}`}
            />
            <p className="font-medium text-slate-700 dark:text-slate-300">
              En attente de validation administrateur
            </p>
            <p className="text-sm text-slate-500">
              Une fois approuvée dans le dashboard, la licence sera récupérée automatiquement.
              <br />
              <span className="font-mono text-xs">licenceskayapps.duckdns.org</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button loading={checking} onClick={checkApproval}>
                <RefreshCw size={16} />
                Vérifier maintenant
              </Button>
              <Button variant="secondary" onClick={() => setPending(false)}>
                Modifier la demande
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
              Une connexion Internet est requise pour la première activation. Ensuite, le logiciel
              fonctionne hors ligne.
            </p>

            <div className="space-y-1">
              <Input
                label="Raison sociale *"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="Ma Quincaillerie SARL"
              />
              <Input
                label="Email de contact *"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
              <Input
                label="Téléphone"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
              <Input
                label="Clé de licence (si déjà fournie)"
                value={form.licenseKey}
                onChange={(e) => setForm({ ...form, licenseKey: e.target.value })}
                placeholder="A1B2-C3D4-E5F6-7890"
              />
            </div>

            {hwId && (
              <p className="text-xs text-slate-400 mt-3 font-mono break-all">
                ID machine : {hwId.slice(0, 16)}…
              </p>
            )}

            <p className="text-xs text-slate-400 mt-2">Produit : {PRODUCT_SLUG}</p>

            <Button className="w-full mt-6" size="lg" loading={loading} onClick={handleActivate}>
              <ShieldCheck size={18} />
              Activer le logiciel
            </Button>
          </>
        )}

        <p className="text-center text-xs text-slate-400 mt-6 flex items-center justify-center gap-1">
          <KeyRound size={12} />
          Licence gérée par Kay Apps
        </p>
      </div>
    </div>
  )
}
