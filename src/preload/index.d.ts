export interface ElectronAPI {
  getVersion: () => Promise<string>
  getApiPort: () => Promise<number>
  getApiUrl: () => Promise<string>
  printThermal: (base64Data: string) => Promise<{ success: boolean; message?: string; error?: string }>
  printA4: (pdfBase64: string) => Promise<{ success: boolean; error?: string }>
  saveFile: (defaultName: string, data: string) => Promise<{ success: boolean; path?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
