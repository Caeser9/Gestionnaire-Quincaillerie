export type LicenseStatus = 'pending' | 'active' | 'suspended' | 'expired'

export interface SignedLicensePayload {
  licenseId: string
  licenseKey: string
  clientId: string
  clientName: string
  productId: string
  productSlug: string
  licenseType: string
  status: LicenseStatus
  maxUsers: number
  maxWorkstations: number
  authorizedModules: string[]
  minVersion?: string
  maxVersion?: string
  machineId: string
  activatedAt: string
  expiresAt?: string
  issuedAt: string
}

export interface StoredLicense {
  licenseToken: string
  licenseKey?: string
  payload: SignedLicensePayload
  signature: string
  lastVerified: string
  checkIntervalDays: number
}

export type LicenseGateStatus =
  | 'loading'
  | 'not_activated'
  | 'pending'
  | 'active'
  | 'suspended'
  | 'expired'
  | 'invalid'

export interface LicenseStatusResponse {
  status: LicenseGateStatus
  message?: string
  requestId?: string
  payload?: SignedLicensePayload
  authorizedModules: string[]
  licenseKey?: string
  expiresAt?: string
  clientName?: string
  licenseType?: string
  checkIntervalDays?: number
}

export interface ActivateParams {
  companyName: string
  contactEmail: string
  contactPhone?: string
  licenseKey?: string
  requestId?: string
}

export interface ActivateResult {
  success: boolean
  status: 'activated' | 'already_active' | 'pending' | 'error'
  message?: string
  requestId?: string
}
