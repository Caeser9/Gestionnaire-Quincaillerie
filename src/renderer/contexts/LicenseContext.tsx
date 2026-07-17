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
  dashboardMode: 'pro' | 'simple'
  refresh: (forceOnline?: boolean) => Promise<void>
  isRouteAllowed: (path: string) => boolean
}

const LicenseContext = createContext<LicenseContextValue | null>(null)

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LicenseStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (forceOnline = false) => {
    setLoading(true)
    try {
      let result: LicenseStatusResponse | any = null

      if (window.electronAPI?.getLicenseStatus) {
        result = forceOnline && window.electronAPI.verifyLicense
          ? await window.electronAPI.verifyLicense()
          : await window.electronAPI.getLicenseStatus()
      } else {
        result = { status: 'active', authorizedModules: Object.values(ROUTE_MODULE_MAP).filter(Boolean) as string[] }
      }

      // If the API is a demo server, force simple dashboard mode
      try {
        const res = await fetch('/api/health')
        const json = await res.json()
        const isDemo = json?.data?.mode === 'demo' || json?.data?.mode === 'DEMO'
        if (isDemo) {
          result = { ...(result || {}), payload: { ...(result?.payload || {}), dashboardMode: 'simple' } }
        }
      } catch {
        // ignore errors
      }

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

    window.addEventListener('online', syncLicense)

    return () => {
      window.removeEventListener('online', syncLicense)
    }
  }, [refresh])

  const authorizedModules = status?.authorizedModules ?? []
  const dashboardMode = status?.payload?.dashboardMode === 'simple' ? 'simple' : 'pro'

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
      dashboardMode,
      refresh,
      isRouteAllowed
    }),
    [status, loading, authorizedModules, dashboardMode, refresh, isRouteAllowed]
  )

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>
}

export function useLicense() {
  const ctx = useContext(LicenseContext)
  if (!ctx) throw new Error('useLicense must be used within LicenseProvider')
  return ctx
}

