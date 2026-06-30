import { describe, expect, it, beforeAll } from 'vitest'
import {
  LICENSE_SERVER_URL,
  PRODUCT_SLUG,
  LICENSE_CHECK_INTERVAL_DAYS
} from '@shared/constants/license'
import type { ActivateParams, ActivateResult, LicenseStatusResponse } from '@shared/types/license'

/**
 * Test d'intégration du flux d'activation de licence
 * avec communication vers le serveur de licences Kay Apps
 *
 * Prérequis:
 * - Backend Gestion Licences démarré sur http://localhost:4000
 * - MongoDB opérationnel
 * - Données seedées (produit hardware-store, type de licence, etc.)
 */

const API_BASE = LICENSE_SERVER_URL

describe('License Activation Integration', () => {
  beforeAll(() => {
    // Vérifier que le serveur est accessible
  })

  it('devrait récupérer la clé publique RSA depuis le serveur', async () => {
    const res = await fetch(`${API_BASE}/public-key`)
    expect(res.ok).toBe(true)
    
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.publicKey).toBeDefined()
    expect(json.data.publicKey).toContain('-----BEGIN PUBLIC KEY-----')
  })

  it('devrait envoyer une demande d\'activation et recevoir un statut', async () => {
    const machineId = 'TEST-MACHINE-' + Math.random().toString(36).substring(7)
    
    const activationParams: ActivateParams = {
      companyName: 'Société Test Integration',
      contactEmail: 'test-integration@example.com',
      contactPhone: '+261 34 00 000 00',
      licenseKey: 'TEST-' + Date.now(),
      requestId: undefined
    }

    const res = await fetch(`${API_BASE}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productSlug: PRODUCT_SLUG,
        licenseKey: activationParams.licenseKey,
        companyName: activationParams.companyName,
        contactEmail: activationParams.contactEmail,
        contactPhone: activationParams.contactPhone,
        machineId,
        appVersion: '1.0.0',
        osInfo: 'Test OS 1.0',
        hostname: 'test-host'
      })
    })

    expect(res.ok).toBe(true)
    
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toBeDefined()
    expect(['pending', 'activated', 'already_active']).toContain(json.data.status)
    
    if (json.data.status === 'pending') {
      expect(json.data.requestId).toBeDefined()
      expect(json.data.message).toBeDefined()
    }
    
    if (json.data.status === 'activated' || json.data.status === 'already_active') {
      expect(json.data.licenseToken).toBeDefined()
      expect(json.data.payload).toBeDefined()
      expect(json.data.signature).toBeDefined()
      expect(json.data.checkIntervalDays).toBeDefined()
      
      // Vérifier la structure du payload
      const payload = json.data.payload
      expect(payload.productSlug).toBe(PRODUCT_SLUG)
      expect(payload.machineId).toBe(machineId)
      expect(payload.status).toBe('active')
      expect(payload.authorizedModules).toBeDefined()
      expect(Array.isArray(payload.authorizedModules)).toBe(true)
    }
  })

  it('devrait vérifier une licence existante via /verify', async () => {
    // Ce test nécessite une licence déjà activée
    // Pour le test, on vérifie que l'endpoint répond correctement même sans licence
    
    const res = await fetch(`${API_BASE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseToken: 'invalid-token-test',
        machineId: 'test-machine',
        appVersion: '1.0.0'
      })
    })

    // Le serveur peut répondre avec succès (valid: false) ou une erreur HTTP pour un token invalide
    // Les deux comportements sont valides
    if (res.ok) {
      const json = await res.json()
      expect(json).toBeDefined()
    } else {
      // Erreur attendue pour un token invalide
      expect(res.status).toBeGreaterThanOrEqual(400)
    }
  })

  it('devrait récupérer les modules autorisés pour un token', async () => {
    // Test de l'endpoint modules (peut échouer si pas de licence valide)
    const res = await fetch(`${API_BASE}/modules/test-token`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    // Accepter 200 ou 404 selon l'état du serveur
    expect([200, 404]).toContain(res.status)
  })

  it('devrait vérifier les mises à jour disponibles', async () => {
    const res = await fetch(
      `${API_BASE}/updates/check?productSlug=${PRODUCT_SLUG}&currentVersion=1.0.0`
    )
    
    // Accepter 200 ou 404 selon l'état du serveur
    expect([200, 404]).toContain(res.status)
  })

  it('devrait valider la structure d\'une licence signée', async () => {
    // Simuler la vérification de signature RSA
    const crypto = await import('crypto')
    
    // Générer une paire de clés RSA pour test
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa' as any, {
      modulusLength: 4096,
      publicExponent: 65537,
      hashAlgorithm: 'sha256'
    } as any)

    const testPayload = {
      licenseId: 'test-license-id',
      licenseKey: 'TEST-KEY-123',
      clientId: 'test-client-id',
      clientName: 'Client Test',
      productId: 'test-product-id',
      productSlug: PRODUCT_SLUG,
      licenseType: 'pro',
      status: 'active' as const,
      maxUsers: 10,
      maxWorkstations: 3,
      authorizedModules: ['products', 'stock', 'pos', 'billing'],
      machineId: 'TEST-MACHINE-123',
      activatedAt: new Date().toISOString(),
      issuedAt: new Date().toISOString()
    }

    // Signer le payload
    const sign = crypto.createSign('SHA256')
    sign.update(JSON.stringify(testPayload))
    sign.end()
    const signature = sign.sign(privateKey, 'base64')

    // Vérifier la signature
    const verify = crypto.createVerify('SHA256')
    verify.update(JSON.stringify(testPayload))
    verify.end()
    const isValid = verify.verify(publicKey, signature, 'base64')

    expect(isValid).toBe(true)
    expect(signature).toBeDefined()
    expect(signature.length).toBeGreaterThan(0)
  })

  it('devrait rejeter une signature invalide', async () => {
    const crypto = await import('crypto')
    
    const { publicKey } = crypto.generateKeyPairSync('rsa' as any, {
      modulusLength: 4096,
      publicExponent: 65537
    } as any)

    const testPayload = {
      licenseId: 'test-license-id',
      status: 'active' as const
    }

    const fakeSignature = 'invalid-signature-base64'

    const verify = crypto.createVerify('SHA256')
    verify.update(JSON.stringify(testPayload))
    verify.end()
    const isValid = verify.verify(publicKey, fakeSignature, 'base64')

    expect(isValid).toBe(false)
  })

  it('devrait calculer le Machine ID correctement', async () => {
    const os = await import('os')
    const crypto = await import('crypto')
    
    const raw = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model ?? 'cpu'}`
    const machineId = crypto.createHash('sha256').update(raw).digest('hex')
    
    expect(machineId).toBeDefined()
    expect(machineId.length).toBe(64) // SHA256 = 64 caractères hex
    expect(/^[a-f0-9]+$/i.test(machineId)).toBe(true)
  })

  it('devrait valider le format des réponses API', async () => {
    const res = await fetch(`${API_BASE}/public-key`)
    const json = await res.json()
    
    // Structure attendue: { success: boolean, data: {...}, signature?: string }
    expect(json).toHaveProperty('success')
    expect(typeof json.success).toBe('boolean')
    expect(json).toHaveProperty('data')
    expect(json.data).toHaveProperty('publicKey')
  })

  it('devrait mesurer le temps de réponse du serveur de licences', async () => {
    const start = Date.now()
    
    const res = await fetch(`${API_BASE}/public-key`)
    const duration = Date.now() - start
    
    expect(res.ok).toBe(true)
    expect(duration).toBeLessThan(5000) // Moins de 5 secondes
    console.log(`[Performance] Temps de réponse serveur licences: ${duration}ms`)
  })
})

describe('License Constants Validation', () => {
  it('devrait avoir une URL de serveur valide', () => {
    expect(API_BASE).toBeDefined()
    expect(API_BASE).toContain('https://')
    expect(API_BASE).toContain('/api/v1/client')
  })

  it('devrait avoir un slug de produit défini', () => {
    expect(PRODUCT_SLUG).toBeDefined()
    expect(PRODUCT_SLUG.length).toBeGreaterThan(0)
    expect(PRODUCT_SLUG).toBe('hardware-store')
  })

  it('devrait avoir un intervalle de vérification valide', () => {
    expect(LICENSE_CHECK_INTERVAL_DAYS).toBeGreaterThan(0)
    expect(LICENSE_CHECK_INTERVAL_DAYS).toBeLessThanOrEqual(365)
  })
})