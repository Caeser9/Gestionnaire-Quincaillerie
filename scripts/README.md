# Scripts de Test - Licence Production

Scripts pour tester l'intégration avec le serveur de licences hébergé.

## Test Rapide (PowerShell)

### Exécution simple

```powershell
# Exécuter le script de test
powershell -ExecutionPolicy Bypass -File "scripts/test-production-license.ps1"
```

### Mode détaillé

```powershell
# Avec affichage complet des réponses
powershell -ExecutionPolicy Bypass -File "scripts/test-production-license.ps1" -Detailed
```

## Ce que le script teste

1. **Résolution DNS** - Vérifie que `licenceskayapps.duckdns.org` est accessible
2. **Connectivité HTTPS** - Vérifie que le serveur répond
3. **Clé publique RSA** - Récupère la clé publique du serveur
4. **Activation de licence** - Envoie une demande d'activation test
5. **Vérification de licence** - Vérifie la validité d'une licence (si activée)
6. **Modules autorisés** - Récupère les modules disponibles
7. **Mises à jour** - Vérifie les mises à jour disponibles

## Résultats possibles

### Status: pending
La demande d'activation est en attente de validation par un administrateur.

**Action requise:**
1. Aller sur https://licenceskayapps.duckdns.org
2. Se connecter avec `admin@example.com` / `Admin123!ChangeMe`
3. Aller dans "Activations"
4. Approuver la demande avec le Request ID affiché
5. Relancer le script pour vérifier

### Status: activated
La licence a été activée immédiatement (licence déjà existante ou validation automatique).

### Status: already_active
La licence est déjà activée sur ce Machine ID.

## Test Manuel avec cURL

### 1. Récupérer la clé publique

```bash
curl https://licenceskayapps.duckdns.org/api/v1/client/public-key
```

### 2. Demande d'activation

```bash
curl -X POST https://licenceskayapps.duckdns.org/api/v1/client/activate \
  -H "Content-Type: application/json" \
  -d '{
    "productSlug": "hardware-store",
    "licenseKey": "TEST-2026-001",
    "companyName": "Société Test",
    "contactEmail": "contact@societetest.com",
    "contactPhone": "+261 34 00 000 00",
    "machineId": "TEST-MACHINE-12345",
    "appVersion": "1.0.0",
    "osInfo": "Windows 11 Pro",
    "hostname": "PC-CAISSE-01"
  }'
```

### 3. Vérifier une licence

```bash
curl -X POST https://licenceskayapps.duckdns.org/api/v1/client/verify \
  -H "Content-Type: application/json" \
  -d '{
    "licenseToken": "VOTRE_TOKEN",
    "machineId": "TEST-MACHINE-12345",
    "appVersion": "1.0.0"
  }'
```

## Test depuis l'application Electron

### Démarrage

```bash
cd "c:\Users\Kayce\Documents\Work\Gestionnaire Quincaillerie"
npm run dev
```

### Configuration

L'application est déjà configurée pour utiliser le serveur hébergé :

**Fichier:** `src/shared/constants/license.ts`

```typescript
export const LICENSE_SERVER_URL = 'https://licenceskayapps.duckdns.org/api/v1/client'
export const PRODUCT_SLUG = 'hardware-store'
export const LICENSE_CHECK_INTERVAL_DAYS = 30
```

### Test d'activation

1. Lancer l'application Electron
2. Aller dans l'écran d'activation
3. Saisir les informations :
   - Company Name: Société Test
   - Contact Email: contact@societetest.com
   - Contact Phone: +261 34 00 000 00
   - License Key: TEST-2026-001
4. Cliquer sur "Activate"
5. Vérifier le résultat

## Tests Automatisés (Vitest)

```bash
# Exécuter les tests d'intégration
npm test -- tests/license-activation.test.ts

# Mode watch
npm test -- tests/license-activation.test.ts --watch
```

**Résultats:** 13 tests passés (8.53s)

## Dépannage

### Erreur de connexion

```powershell
# Tester la résolution DNS
nslookup licenceskayapps.duckdns.org

# Tester la connectivité
curl https://licenceskayapps.duckdns.org/api/v1/client/public-key
```

### Erreur CORS

Le serveur est configuré pour accepter les requêtes depuis :
- https://licenceskayapps.duckdns.org (dashboard)
- http://localhost:5173 (dev local)

### Licence en pending

Si l'activation reste en "pending", vérifier dans le dashboard :
1. https://licenceskayapps.duckdns.org
2. Section "Activations"
3. Approuver la demande

## Documentation

- Guide complet: `docs/MANUAL_TESTING.md`
- API Documentation: `docs/API.md`
- Architecture: `docs/ARCHITECTURE.md`

## Support

- Dashboard: https://licenceskayapps.duckdns.org
- API: https://licenceskayapps.duckdns.org/api/v1/client
- Email admin: admin@example.com
- Mot de passe: Admin123!ChangeMe