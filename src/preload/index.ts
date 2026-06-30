import { contextBridge, ipcRenderer } from 'electron'
import type { ActivateParams, ActivateResult, LicenseStatusResponse } from '@shared/types/license'

const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  getApiPort: (): Promise<number> => ipcRenderer.invoke('app:getApiPort'),
  getApiUrl: (): Promise<string> => ipcRenderer.invoke('app:getApiUrl'),
  printThermal: (base64Data: string): Promise<{ success: boolean; message?: string; error?: string }> =>
    ipcRenderer.invoke('print:thermal', base64Data),
  printA4: (pdfBase64: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('print:a4', pdfBase64),
  saveFile: (
    defaultName: string,
    data: string
  ): Promise<{ success: boolean; path?: string }> =>
    ipcRenderer.invoke('dialog:saveFile', defaultName, data),

  getLicenseStatus: (): Promise<LicenseStatusResponse> =>
    ipcRenderer.invoke('license:getStatus'),
  getLicenseMachineId: (): Promise<string> => ipcRenderer.invoke('license:getMachineId'),
  getLicenseModules: (): Promise<string[]> => ipcRenderer.invoke('license:getModules'),
  activateLicense: (params: ActivateParams): Promise<ActivateResult> =>
    ipcRenderer.invoke('license:activate', params),
  verifyLicense: (): Promise<LicenseStatusResponse> => ipcRenderer.invoke('license:verify'),
  transferLicense: (newMachineId: string): Promise<ActivateResult> =>
    ipcRenderer.invoke('license:transfer', newMachineId),
  clearLicense: (): Promise<{ success: boolean }> => ipcRenderer.invoke('license:clear'),
  getPendingActivation: (): Promise<ActivateParams | null> =>
    ipcRenderer.invoke('license:getPending'),
  retryPendingActivation: (): Promise<ActivateResult> =>
    ipcRenderer.invoke('license:retryPending')
}

contextBridge.exposeInMainWorld('electronAPI', api)
