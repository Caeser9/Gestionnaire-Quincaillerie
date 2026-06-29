/// <reference types="vite/client" />

interface ElectronAPI {
  getVersion: () => Promise<string>
  getApiPort: () => Promise<number>
  getApiUrl: () => Promise<string>
  printThermal: (base64Data: string) => Promise<{ success: boolean; error?: string; message?: string }>
  printA4: (pdfBase64: string) => Promise<{ success: boolean; error?: string }>
  saveFile: (defaultName: string, data: string) => Promise<{ success: boolean; path?: string }>
}

interface Window {
  electronAPI?: ElectronAPI
}
