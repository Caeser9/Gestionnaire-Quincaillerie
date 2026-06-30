import { ROUTE_MODULE_MAP } from '@shared/constants/license'
import type { LicenseStatusResponse } from '@shared/types/license'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

interface LicenseContextValue {
  status: LicenseStatusResponse | null
  loading: boolean
  isActive: boolean
  authorizedModules: string[]
  refresh: (forceOnline?: boolean) => Promise<void>
  isRouteAllowed: (path: string) => boolean
}

const LicenseContext = createContext<LicenseContextValue | null>(null)

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LicenseStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (forceOnline = false) => {
    if (!window.electronAPI?.getLicenseStatus) {
      setStatus({ status: 'active', authorizedModules: Object.values(ROUTE_MODULE_MAP).filter(Boolean) as string[] })
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result =
        forceOnline && window.electronAPI.verifyLicense
          ? await window.electronAPI.verifyLicense()
          : await window.electronAPI.getLicenseStatus()
      setStatus(result)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh(true)
  }, [refresh])

  useEffect(() => {
    const syncLicense = () => {
      void refresh(true)
    }

    const interval = window.setInterval(syncLicense, 86400_000)
    window.addEventListener('focus', syncLicense)
    window.addEventListener('online', syncLicense)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', syncLicense)
      window.removeEventListener('online', syncLicense)
    }
  }, [refresh])

  const authorizedModules = status?.authorizedModules ?? []

  const isRouteAllowed = useCallback(
    (path: string) => {
      if (status?.status !== 'active') return false
      const moduleKey = ROUTE_MODULE_MAP[path]
      if (moduleKey === null || moduleKey === undefined) return true
      return authorizedModules.includes(moduleKey)
    },
    [status?.status, authorizedModules]
  )

  const value = useMemo(
    () => ({
      status,
      loading,
      isActive: status?.status === 'active',
      authorizedModules,
      refresh,
      isRouteAllowed
    }),
    [status, loading, authorizedModules, refresh, isRouteAllowed]
  )

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>
}

export function useLicense() {
  const ctx = useContext(LicenseContext)
  if (!ctx) throw new Error('useLicense must be used within LicenseProvider')
  return ctx
}
