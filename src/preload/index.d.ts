import type { ActivateParams, ActivateResult, LicenseStatusResponse } from '@shared/types/license'

export interface ElectronAPI {
  getVersion: () => Promise<string>
  getApiPort: () => Promise<number>
  getApiUrl: () => Promise<string>
  printThermal: (base64Data: string) => Promise<{ success: boolean; message?: string; error?: string }>
  printA4: (pdfBase64: string) => Promise<{ success: boolean; error?: string }>
  saveFile: (defaultName: string, data: string) => Promise<{ success: boolean; path?: string }>
  getLicenseStatus: () => Promise<LicenseStatusResponse>
  getLicenseMachineId: () => Promise<string>
  getLicenseModules: () => Promise<string[]>
  activateLicense: (params: ActivateParams) => Promise<ActivateResult>
  verifyLicense: () => Promise<LicenseStatusResponse>
  transferLicense: (newMachineId: string) => Promise<ActivateResult>
  clearLicense: () => Promise<{ success: boolean }>
  getPendingActivation: () => Promise<ActivateParams | null>
  retryPendingActivation: () => Promise<ActivateResult>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
