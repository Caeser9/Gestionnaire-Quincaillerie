import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@renderer/components/ui/Button'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  back?: boolean
  backLabel?: string
  onBack?: () => void
  children?: ReactNode
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  backLabel = 'Retour',
  onBack,
  children
}: PageHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    navigate(-1)
  }

  return (
    <div className="page-header">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {back && (
            <Button variant="secondary" onClick={handleBack} className="whitespace-nowrap">
              <ArrowLeft size={16} />
              {backLabel}
            </Button>
          )}
          <div>
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
