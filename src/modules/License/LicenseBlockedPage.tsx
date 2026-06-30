import { Button } from '@renderer/components/ui/Button'
import type { LicenseStatusResponse } from '@shared/types/license'
import { AlertTriangle, RefreshCw, ShieldOff } from 'lucide-react'

interface LicenseBlockedPageProps {
  status: LicenseStatusResponse
  onRetry: () => void
}

const TITLES: Record<string, { title: string; description: string }> = {
  suspended: {
    title: 'Licence suspendue',
    description:
      "Votre licence a été suspendue par l'administrateur. Contactez le support Kay Apps pour la réactiver."
  },
  expired: {
    title: 'Licence expirée',
    description:
      'Votre licence a expiré. Renouvelez votre abonnement pour continuer à utiliser le logiciel.'
  },
  invalid: {
    title: 'Licence invalide',
    description: 'La licence locale est invalide ou une vérification en ligne est requise.'
  }
}

export function LicenseBlockedPage({ status, onRetry }: LicenseBlockedPageProps) {
  const info = TITLES[status.status] ?? TITLES.invalid

  return (
    <div className="min-h-screen flex items-center justify-center page-bg p-6">
      <div className="card max-w-md w-full p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
          {status.status === 'suspended' ? (
            <ShieldOff size={28} className="text-red-600" />
          ) : (
            <AlertTriangle size={28} className="text-red-600" />
          )}
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{info.title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          {status.message ?? info.description}
        </p>
        {status.licenseKey && (
          <p className="text-xs font-mono text-slate-400 mb-4">Clé : {status.licenseKey}</p>
        )}
        <Button onClick={onRetry}>
          <RefreshCw size={16} />
          Réessayer la vérification
        </Button>
      </div>
    </div>
  )
}
