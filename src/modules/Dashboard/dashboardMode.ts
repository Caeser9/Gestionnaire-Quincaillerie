export type DashboardMode = 'pro' | 'simple'

export function resolveDashboardMode(mode?: string | null): DashboardMode {
  return mode === 'simple' ? 'simple' : 'pro'
}
