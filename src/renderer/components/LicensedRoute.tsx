import { useLicense } from '@renderer/contexts/LicenseContext'
import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

export function LicensedRoute({ children }: { children: ReactNode }) {
  const { isRouteAllowed } = useLicense()
  const location = useLocation()

  if (!isRouteAllowed(location.pathname)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
