import { createContext, useContext } from 'react'
import { apiRequest } from '@renderer/lib/api'
import { useQuery } from '@tanstack/react-query'

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

interface SettingsContextType {
  settings: Settings | null
  loading: boolean
  storeDisplayName: string
  storeIcon: string
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiRequest<Settings>('/settings'),
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

  const storeDisplayName = settings?.storeName || settings?.companyName || 'Gestionnaire Quincaillerie'
  const storeIcon = settings?.storeIcon || 'store'

  return (
    <SettingsContext.Provider value={{ settings: settings ?? null, loading: isLoading, storeDisplayName, storeIcon }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
