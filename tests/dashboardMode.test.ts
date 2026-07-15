import { describe, expect, it } from 'vitest'
import { resolveDashboardMode } from '../src/modules/Dashboard/dashboardMode'

describe('resolveDashboardMode', () => {
  it('defaults to pro when no license mode is provided', () => {
    expect(resolveDashboardMode(undefined)).toBe('pro')
  })

  it('uses the licensed dashboard mode when it is set', () => {
    expect(resolveDashboardMode('simple')).toBe('simple')
    expect(resolveDashboardMode('pro')).toBe('pro')
  })
})
