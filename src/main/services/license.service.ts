import { app } from 'electron'
import crypto from 'crypto'
import os from 'os'
import Store from 'electron-store'
import { isDemoMode } from '../demoMode'
import {
  LICENSE_CHECK_INTERVAL_DAYS,
  LICENSE_SERVER_URL,
  PRODUCT_SLUG
} from '@shared/constants/license'
import type {
  ActivateParams,
  ActivateResult,
  LicenseStatusResponse,
  SignedLicensePayload,
  StoredLicense
} from '@shared/types/license'

interface ApiEnvelope<T> {
  success: boolean
  data: T
  signature?: string
}

const store = new Store<{
  license: StoredLicense
  publicKey?: string
  pendingActivation?: ActivateParams
}>({ name: 'license-data' })

let cachedPublicKey: string | null = null

export function getMachineId(): string {
  try {
    const raw = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model ?? 'cpu'}`
    return crypto.createHash('sha256').update(raw).digest('hex')
  } catch {
    return crypto.randomBytes(32).toString('hex')
  }
}

function loadStored(): StoredLicense | null {
  return store.get('license') ?? null
}

function saveStored(data: {
  licenseToken: string
  licenseKey?: string
  payload: SignedLicensePayload
  signature: string
  checkIntervalDays?: number
}): StoredLicense {
  const stored: StoredLicense = {
    licenseToken: data.licenseToken,
    licenseKey: data.licenseKey,
    payload: data.payload,
    signature: data.signature,
    lastVerified: new Date().toISOString(),
    checkIntervalDays: data.checkIntervalDays ?? LICENSE_CHECK_INTERVAL_DAYS
  }
  store.set('license', stored)
  return stored
}

let lastFetchTime = 0
const FETCH_COOLDOWN = 2000 // 2 secondes entre les requêtes

export async function fetchPublicKey(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedPublicKey) return cachedPublicKey
  if (!forceRefresh) {
    const storedKey = store.get('publicKey')
    if (storedKey) {
      cachedPublicKey = storedKey
      return storedKey
    }
  }

  // Éviter les requêtes en double
  const now = Date.now()
  if (!forceRefresh && cachedPublicKey && (now - lastFetchTime) < FETCH_COOLDOWN) {
    console.log('[License] Using cached public key (cooldown)')
    return cachedPublicKey
  }

  console.log('[License] Fetching public key from:', `${LICENSE_SERVER_URL}/public-key`)

  try {
    const res = await fetch(`${LICENSE_SERVER_URL}/public-key`, {
      headers: {
        'Accept': 'application/json'
      }
    })

    console.log('[License] Response status:', res.status)

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }

    const json = (await res.json()) as ApiEnvelope<{ publicKey: string }>
    const publicKey = json.data.publicKey
    if (!publicKey) throw new Error('Clé publique introuvable dans la réponse')

    cachedPublicKey = publicKey
    lastFetchTime = Date.now()
    store.set('publicKey', cachedPublicKey)
    console.log('[License] Public key fetched successfully')
    return cachedPublicKey
  } catch (error) {
    console.error('[License] Error fetching public key:', error)
    throw new Error(`Impossible de récupérer la clé publique: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export function verifyPayloadSignature(
  payload: SignedLicensePayload,
  signature: string,
  publicKey: string
): boolean {
  try {
    const verify = crypto.createVerify('SHA256')
    verify.update(JSON.stringify(payload))
    verify.end()
    return verify.verify(publicKey, signature, 'base64')
  } catch {
    return false
  }
}

function isOfflineValid(stored: StoredLicense, publicKey: string): boolean {
  if (!verifyPayloadSignature(stored.payload, stored.signature, publicKey)) {
    return false
  }
  if (stored.payload.status !== 'active') return false
  if (stored.payload.expiresAt && new Date(stored.payload.expiresAt) < new Date()) {
    return false
  }
  const daysSince =
    (Date.now() - new Date(stored.lastVerified).getTime()) / (1000 * 60 * 60 * 24)
  return daysSince <= stored.checkIntervalDays
}

async function apiPost<T>(path: string, body: unknown): Promise<ApiEnvelope<T>> {
  const res = await fetch(`${LICENSE_SERVER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const json = (await res.json()) as ApiEnvelope<T> & { success?: boolean; error?: string | { message: string } }
  if (!res.ok || json.success === false) {
    const errMsg =
      typeof json.error === 'string'
        ? json.error
        : json.error?.message ?? 'Erreur serveur de licences'
    throw new Error(errMsg)
  }
  return json as ApiEnvelope<T>
}

function toStatusResponse(
  gate: LicenseStatusResponse['status'],
  stored: StoredLicense | null,
  extra?: Partial<LicenseStatusResponse>
): LicenseStatusResponse {
  return {
    status: gate,
    authorizedModules: stored?.payload.authorizedModules ?? [],
    payload: stored?.payload,
    licenseKey: stored?.licenseKey ?? stored?.payload.licenseKey,
    expiresAt: stored?.payload.expiresAt,
    clientName: stored?.payload.clientName,
    licenseType: stored?.payload.licenseType,
    adminNotes: stored?.payload.adminNotes,
    checkIntervalDays: stored?.checkIntervalDays,
    ...extra
  }
}

const OFFLINE_GRACE_DAYS = 10
async function tryOnlineVerify(
  stored: StoredLicense,
  publicKey: string
): Promise<
  | { ok: true; updated: StoredLicense }
  | { ok: false; reason: 'network' | 'suspended' | 'expired' | 'invalid'; message?: string }
> {
  let json: ApiEnvelope<{
    valid: boolean
    status?: LicenseStatusResponse['status']
    message?: string
    licenseToken: string
    licenseKey: string
    payload: SignedLicensePayload
    signature: string
    checkIntervalDays: number
  }>

  try {
    json = await apiPost('/verify', {
      licenseToken: stored.licenseToken,
      machineId: getMachineId(),
      appVersion: app.getVersion()
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/suspendue/i.test(msg)) return { ok: false, reason: 'suspended', message: msg }
    if (/expir/i.test(msg)) return { ok: false, reason: 'expired', message: msg }
    if (/non trouvée|non correspondant|non active/i.test(msg)) {
      return { ok: false, reason: 'invalid', message: msg }
    }
    return { ok: false, reason: 'network', message: msg }
  }

  const { data } = json
  if (!verifyPayloadSignature(data.payload, data.signature, publicKey)) {
    return { ok: false, reason: 'invalid', message: 'Signature invalide après vérification' }
  }

  const updated = saveStored({
    licenseToken: data.licenseToken,
    licenseKey: data.licenseKey,
    payload: data.payload,
    signature: data.signature,
    checkIntervalDays: data.checkIntervalDays
  })

  return { ok: true, updated }
}

export async function getLicenseStatus(forceOnline = false): Promise<LicenseStatusResponse> {
  if (isDemoMode()) {
    return {
      status: 'active',
      authorizedModules: ['products', 'stock', 'pos', 'billing'],
      clientName: 'Client Demo',
      licenseType: 'demo',
      licenseKey: 'DEMO-PORTABLE',
      adminNotes: 'Version demo portable avec donnees JSON locales.'
    }
  }

  const stored = loadStored()

  if (!stored) {
    return toStatusResponse('not_activated', null)
  }

  let publicKey: string | null = cachedPublicKey ?? store.get('publicKey') ?? null
  if (!publicKey) {
    try {
      publicKey = await fetchPublicKey()
    } catch {
      publicKey = null
    }
  }

  if (!publicKey) {
    return toStatusResponse('invalid', stored, {
      message:
        'Clé publique introuvable — une connexion internet est requise lors de la première activation.'
    })
  }

  if (!verifyPayloadSignature(stored.payload, stored.signature, publicKey)) {
    return toStatusResponse('invalid', stored, { message: 'Signature de licence invalide' })
  }

  if (!forceOnline && stored.payload.status !== 'active') {
    return toStatusResponse(stored.payload.status as LicenseStatusResponse['status'], stored)
  }

  if (!forceOnline && stored.payload.expiresAt && new Date(stored.payload.expiresAt) < new Date()) {
    return toStatusResponse('expired', stored, { message: 'Licence expirée' })
  }

  const daysSinceVerified =
    (Date.now() - new Date(stored.lastVerified).getTime()) / (1000 * 60 * 60 * 24)

  if (!forceOnline && daysSinceVerified <= stored.checkIntervalDays) {
    return toStatusResponse('active', stored)
  }

  const result = await tryOnlineVerify(stored, publicKey)

  if (result.ok) {
    return toStatusResponse(result.updated.payload.status as LicenseStatusResponse['status'], result.updated)
  }

  if (result.reason === 'suspended') {
    return toStatusResponse('suspended', stored, { message: result.message })
  }
  if (result.reason === 'expired') {
    return toStatusResponse('expired', stored, { message: result.message })
  }
  if (result.reason === 'invalid') {
    return toStatusResponse('invalid', stored, { message: result.message })
  }

  if (stored.payload.status !== 'active') {
    return toStatusResponse(stored.payload.status as LicenseStatusResponse['status'], stored, {
      message: result.message
    })
  }

  if (stored.payload.expiresAt && new Date(stored.payload.expiresAt) < new Date()) {
    return toStatusResponse('expired', stored, { message: result.message ?? 'Licence expirée' })
  }

  if (daysSinceVerified <= stored.checkIntervalDays + OFFLINE_GRACE_DAYS) {
    return toStatusResponse('active', stored, {
      message: `Mode hors-ligne — dernière vérification il y a ${Math.floor(
        daysSinceVerified
      )} jours. Reconnectez-vous bientôt à internet.`
    })
  }

  return toStatusResponse('expired', stored, {
    message: 'Connexion internet requise pour revalider votre licence.'
  })
}

export async function activateLicense(params: ActivateParams): Promise<ActivateResult> {
  // Toujours récupérer la dernière clé publique depuis le serveur pour éviter
  // de vérifier avec une clé obsolète mise en cache localement
  await fetchPublicKey(true)

  // Si on a un requestId, on vérifie d'abord le statut de la demande existante
  if (params.requestId) {
    try {
      const statusResponse = await apiPost<{
        status: string
        requestId?: string
        reason?: string
        licenseToken?: string
        licenseKey?: string
        payload?: SignedLicensePayload
        signature?: string
        checkIntervalDays?: number
      }>('/activation/status', {
        requestId: params.requestId,
        machineId: getMachineId(),
        appVersion: app.getVersion()
      })

      const statusData = statusResponse.data
      const publicKey = cachedPublicKey!

      // Demande toujours en attente
      if (statusData.status === 'pending') {
        return {
          success: true,
          status: 'pending',
          message: 'Demande toujours en attente de validation',
          requestId: params.requestId
        }
      }

      // Demande rejetée
      if (statusData.status === 'rejected') {
        clearPendingActivation()
        return {
          success: false,
          status: 'error',
          message: statusData.reason || 'Demande rejetée par administrateur',
          requestId: params.requestId
        }
      }

      // Demande approuvée et licence disponible
      if (statusData.status === 'activated') {
        if (statusData.licenseToken && statusData.payload && statusData.signature) {
          if (!verifyPayloadSignature(statusData.payload, statusData.signature, publicKey)) {
            return { success: false, status: 'error', message: 'Signature de licence invalide' }
          }
          saveStored({
            licenseToken: statusData.licenseToken,
            licenseKey: statusData.licenseKey ?? statusData.payload.licenseKey,
            payload: statusData.payload,
            signature: statusData.signature,
            checkIntervalDays: statusData.checkIntervalDays
          })
          clearPendingActivation()
          return {
            success: true,
            status: 'activated',
            message: 'Licence activée — vous pouvez utiliser le logiciel'
          }
        }
      }
    } catch (err) {
      // Erreur de réseau, route non trouvée, ou autre - continuer avec nouvelle demande
      // (La route /activation/status n'existe peut-être pas encore sur le serveur)
      console.debug('[License] Vérification statut échouée, nouvelle demande:', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  // Nouvelle demande d'activation
  const json = await apiPost<{
    status: string
    requestId?: string
    message?: string
    licenseToken?: string
    licenseKey?: string
    payload?: SignedLicensePayload
    signature?: string
    checkIntervalDays?: number
  }>('/activate', {
    productSlug: PRODUCT_SLUG,
    licenseKey: params.licenseKey || undefined,
    companyName: params.companyName,
    contactEmail: params.contactEmail,
    contactPhone: params.contactPhone,
    machineId: getMachineId(),
    appVersion: app.getVersion(),
    osInfo: `${os.platform()} ${os.release()}`,
    hostname: os.hostname()
  })

  const { data } = json
  let publicKey = cachedPublicKey!

  if (data.status === 'activated' || data.status === 'already_active') {
    if (!publicKey) {
      publicKey = await fetchPublicKey(true)
    }
  }

  if (data.status === 'pending') {
    // Sauvegarder les paramètres ET le requestId pour les retries futurs
    const pendingParams: ActivateParams = {
      ...params,
      requestId: data.requestId
    }
    savePendingActivation(pendingParams)
    return {
      success: true,
      status: 'pending',
      message: data.message ?? 'Demande envoyée — en attente de validation administrateur',
      requestId: data.requestId
    }
  }

  clearPendingActivation()

  if (
    (data.status === 'activated' || data.status === 'already_active') &&
    data.licenseToken &&
    data.payload &&
    data.signature
  ) {
    if (!verifyPayloadSignature(data.payload, data.signature, publicKey)) {
      try {
        publicKey = await fetchPublicKey(true)
      } catch {
        // ignore and continue with the old value
      }

      if (!verifyPayloadSignature(data.payload, data.signature, publicKey)) {
        store.delete('publicKey')
        cachedPublicKey = null
        return { success: false, status: 'error', message: 'Signature de licence invalide' }
      }
    }
    saveStored({
      licenseToken: data.licenseToken,
      licenseKey: data.licenseKey ?? data.payload.licenseKey,
      payload: data.payload,
      signature: data.signature,
      checkIntervalDays: data.checkIntervalDays
    })
    return {
      success: true,
      status: data.status === 'already_active' ? 'already_active' : 'activated',
      message: 'Licence activée — vous pouvez utiliser le logiciel'
    }
  }

  return { success: false, status: 'error', message: 'Réponse serveur inattendue' }
}

export async function transferLicense(newMachineId?: string): Promise<ActivateResult> {
  const stored = loadStored()
  if (!stored) {
    return { success: false, status: 'error', message: 'Aucune licence locale' }
  }

  const newId = newMachineId?.trim()
  if (!newId || newId.length < 8) {
    return {
      success: false,
      status: 'error',
      message: 'Nouvel identifiant machine requis pour transférer la licence'
    }
  }

  if (newId === stored.payload.machineId) {
    return {
      success: false,
      status: 'error',
      message: 'La licence est déjà liée à cet identifiant machine'
    }
  }

  const publicKey = await fetchPublicKey()

  const json = await apiPost<{
    status: string
    licenseToken: string
    licenseKey: string
    payload: SignedLicensePayload
    signature: string
    checkIntervalDays: number
  }>('/transfer', {
    licenseToken: stored.licenseToken,
    oldMachineId: stored.payload.machineId,
    newMachineId: newId,
    appVersion: app.getVersion()
  })

  const { data } = json
  if (!verifyPayloadSignature(data.payload, data.signature, publicKey)) {
    return { success: false, status: 'error', message: 'Signature invalide après transfert' }
  }

  saveStored({
    licenseToken: data.licenseToken,
    licenseKey: data.licenseKey,
    payload: data.payload,
    signature: data.signature,
    checkIntervalDays: data.checkIntervalDays
  })

  return { success: true, status: 'activated', message: 'Licence transférée sur ce poste' }
}

export function getAuthorizedModules(): string[] {
  if (isDemoMode()) return ['products', 'stock', 'pos', 'billing']
  return loadStored()?.payload.authorizedModules ?? []
}

export function clearLocalLicense(): void {
  store.delete('license')
}

export function getPendingActivation(): ActivateParams | null {
  return store.get('pendingActivation') ?? null
}

export function savePendingActivation(params: ActivateParams): void {
  store.set('pendingActivation', params)
}

export function clearPendingActivation(): void {
  store.delete('pendingActivation')
}

export async function retryPendingActivation(): Promise<ActivateResult> {
  const pending = getPendingActivation()
  if (!pending) {
    return { success: false, status: 'error', message: 'Aucune demande en attente' }
  }
  return activateLicense(pending)
}
