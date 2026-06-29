import { contextBridge, ipcRenderer } from 'electron'

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
    ipcRenderer.invoke('dialog:saveFile', defaultName, data)
}

contextBridge.exposeInMainWorld('electronAPI', api)
