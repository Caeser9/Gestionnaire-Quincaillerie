let apiBaseUrl = 'http://127.0.0.1:3847/api'

export async function initApi(): Promise<void> {
  if (window.electronAPI) {
    apiBaseUrl = await window.electronAPI.getApiUrl()
  }
  apiBaseUrl = apiBaseUrl.replace(/\/$/, '')

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${apiBaseUrl}/health`)
      if (res.ok) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 200))
  }
}

function buildUrl(endpoint: string): string {
  let path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  if (path.startsWith('/api/')) {
    path = path.slice(4)
  }
  return `${apiBaseUrl}${path}`
}

function pathFromUrl(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

interface ApiJson {
  success: boolean
  data?: unknown
  error?: { message?: string; errors?: Record<string, string[]> }
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  const url = buildUrl(endpoint)
  const response = await fetch(url, { ...options, headers })
  const contentType = response.headers.get('content-type') ?? ''

  let json: ApiJson
  if (contentType.includes('application/json')) {
    json = await response.json()
  } else {
    throw new Error(
      response.status === 404
        ? `Route introuvable : ${pathFromUrl(url)}`
        : `Réponse invalide du serveur (${response.status})`
    )
  }

  if (!response.ok || !json.success) {
    const fieldErrors = json.error?.errors
      ? Object.values(json.error.errors).flat().filter(Boolean)
      : []
    const msg =
      fieldErrors.length > 0
        ? fieldErrors.join(' · ')
        : json.error?.message || `Erreur serveur (${response.status})`
    if (msg.startsWith('Route introuvable')) {
      throw new Error(`${msg} : ${pathFromUrl(url)}`)
    }
    throw new Error(msg)
  }

  return json.data as T
}

export async function apiDownload(endpoint: string): Promise<Blob> {
  const url = buildUrl(endpoint)
  const response = await fetch(url)

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const json = await response.json()
      throw new Error(json.error?.message || 'Erreur téléchargement')
    }
    throw new Error(`Erreur téléchargement (${response.status}) : ${pathFromUrl(url)}`)
  }

  return response.blob()
}

initApi().catch(() => {
  // API may start after renderer
})
