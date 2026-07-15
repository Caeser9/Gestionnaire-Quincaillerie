import { apiDownload } from '@renderer/lib/api'
import toast from 'react-hot-toast'

export async function printA4Pdf(pdfPath: string, fallbackDownloadName?: string): Promise<boolean> {
  try {
    const blob = await apiDownload(pdfPath)
    const buffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const base64 = btoa(binary)

    if (window.electronAPI) {
      const result = await window.electronAPI.printA4(base64)
      if (result.success) {
        toast.success('Document envoyé à l\'imprimante')
        return true
      }
      toast.error(result.error || 'Erreur impression')
      return false
    }

    if (fallbackDownloadName) {
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = fallbackDownloadName
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF téléchargé')
    }
    return true
  } catch {
    toast.error('Erreur impression A4')
    return false
  }
}
