# Guide de Test Manuel - Activation de Licence

Ce guide explique comment tester manuellement le flux d'activation de licence entre l'application Electron Gestionnaire Quincaillerie et la plateforme de gestion de licences.

## Prérequis

### Serveur de Production

**Le serveur de licences est déjà hébergé et accessible :**
- **API:** https://licenceskayapps.duckdns.org/api/v1/client
- **Dashboard:** https://licenceskayapps.duckdns.org

**Aucune installation locale nécessaire** pour tester l'API.

### Identifiants Admin par défaut

- **Email:** admin@example.com
- **Mot de passe:** Admin123!ChangeMe
- **Dashboard:** https://licenceskayapps.duckdns.org

---

## Méthode 1 : Test via le Dashboard (Interface Web)

### Étape 1 : Créer un produit et une licence

1. **Ouvrir le dashboard** : https://licenceskayapps.duckdns.org
2. **Se connecter** avec les identifiants admin
3. **Créer un produit** :
   - Aller dans "Catalog" → "Products"
   - Cliquer sur "Add Product"
   - Remplir :
     - **Name:** Hardware Store
     - **Slug:** `hardware-store` (important : doit correspondre à l'application Electron)
     - **Description:** Logiciel de gestion de quincaillerie
   - Sauvegarder

4. **Créer un type de licence** :
   - Aller dans "Catalog" → "License Types"
   - Cliquer sur "Add License Type"
   - Remplir :
     - **Name:** Pro
     - **Slug:** `pro`
     - **Max Users:** 10
     - **Max Workstations:** 5
   - Sauvegarder

5. **Créer un client** :
   - Aller dans "Clients"
   - Cliquer sur "Add Client"
   - Remplir :
     - **Company Name:** Société Test
     - **Email:** contact@societetest.com
     - **Phone:** +261 34 00 000 00
   - Sauvegarder

6. **Créer une licence** :
   - Aller dans "Licenses"
   - Cliquer sur "Add License"
   - Remplir :
     - **Client:** Société Test
     - **Product:** Hardware Store
     - **License Type:** Pro
     - **License Key:** `TEST-2026-001` (ou générer automatiquement)
     - **Status:** Active
   - Sauvegarder

### Étape 2 : Tester l'activation depuis l'application Electron

1. **Démarrer l'application Electron** :
   ```bash
   cd "c:\Users\Kayce\Documents\Work\Gestionnaire Quincaillerie"
   npm run dev
   ```

2. **Observer le comportement** :
   - L'application va automatiquement détecter qu'aucune licence n'est présente
   - Elle va afficher l'écran d'activation
   - Saisir les informations :
     - **Company Name:** Société Test
     - **Contact Email:** contact@societetest.com
     - **Contact Phone:** +261 34 00 000 00
     - **License Key:** `TEST-2026-001`
   - Cliquer sur "Activate"

3. **Vérifier le résultat** :
   - Si la licence est valide, l'application devrait s'ouvrir normalement
   - Si la licence est en attente, un message indique "En attente de validation"

### Étape 3 : Approuver l'activation (si nécessaire)

Si l'activation est en statut "pending" :

1. **Retourner sur le dashboard** : https://licenceskayapps.duckdns.org
2. **Aller dans "Activations"**
3. **Voir la demande d'activation** en attente
4. **Cliquer sur "Approve"**
5. **Vérifier que le statut passe à "Approved"**

### Étape 4 : Vérifier la licence activée

1. **Dans le dashboard** (https://licenceskayapps.duckdns.org), aller dans "Licenses"
2. **Vérifier** :
   - La licence a le statut "Active"
   - Le Machine ID de l'application Electron est enregistré
   - Les modules autorisés sont listés

3. **Dans l'application Electron** :
   - La licence devrait maintenant être active
   - Les modules autorisés sont accessibles
   - La vérification périodique (30 jours) est programmée

---

## Méthode 2 : Test via cURL (API Directe)

### Test 1 : Récupérer la clé publique

```bash
curl https://licenceskayapps.duckdns.org/api/v1/client/public-key
```

**Réponse attendue :**
```json
{
  "success": true,
  "data": {
    "publicKey": "-----BEGIN PUBLIC KEY-----\n..."
  }
}
```

### Test 2 : Demande d'activation

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

**Réponses possibles :**

**a) Licence déjà activée :**
```json
{
  "success": true,
  "data": {
    "status": "already_active",
    "licenseToken": "abc123...",
    "payload": { ... },
    "signature": "base64...",
    "checkIntervalDays": 30
  }
}
```

**b) En attente de validation :**
```json
{
  "success": true,
  "data": {
    "status": "pending",
    "requestId": "req_123456",
    "message": "Demande envoyée — en attente de validation administrateur"
  }
}
```

**c) Licence activée immédiatement :**
```json
{
  "success": true,
  "data": {
    "status": "activated",
    "licenseToken": "abc123...",
    "payload": {
      "licenseId": "...",
      "clientName": "Société Test",
      "productSlug": "hardware-store",
      "licenseType": "pro",
      "status": "active",
      "maxUsers": 10,
      "maxWorkstations": 5,
      "authorizedModules": ["products", "stock", "pos", "billing"],
      "machineId": "TEST-MACHINE-12345",
      "activatedAt": "2026-01-15T10:00:00.000Z",
      "expiresAt": null,
      "issuedAt": "2026-01-15T10:00:00.000Z"
    },
    "signature": "base64...",
    "checkIntervalDays": 30
  }
}
```

### Test 3 : Vérifier une licence

```bash
curl -X POST https://licenceskayapps.duckdns.org/api/v1/client/verify \
  -H "Content-Type: application/json" \
  -d '{
    "licenseToken": "abc123...",
    "machineId": "TEST-MACHINE-12345",
    "appVersion": "1.0.0"
  }'
```

**Réponse attendue :**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "licenseToken": "abc123...",
    "payload": { ... },
    "signature": "base64...",
    "checkIntervalDays": 30
  }
}
```

### Test 4 : Récupérer les modules autorisés

```bash
curl https://licenceskayapps.duckdns.org/api/v1/client/modules/abc123...
```

**Réponse attendue :**
```json
{
  "success": true,
  "data": {
    "authorizedModules": ["products", "stock", "pos", "billing"]
  }
}
```

### Test 5 : Vérifier les mises à jour

```bash
curl "https://licenceskayapps.duckdns.org/api/v1/client/updates/check?productSlug=hardware-store&currentVersion=1.0.0"
```

**Réponse attendue :**
```json
{
  "success": true,
  "data": {
    "hasUpdate": false,
    "latestVersion": "1.0.0",
    "downloadUrl": null
  }
}
```

---

## Méthode 3 : Test via Postman / Insomnia

### Collection Postman

Importer cette collection pour tester tous les endpoints :

```json
{
  "info": {
    "name": "License API - Gestion Quincaillerie",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Get Public Key",
      "request": {
        "method": "GET",
      "url": "https://licenceskayapps.duckdns.org/api/v1/client/public-key"
      }
    },
    {
      "name": "2. Activate License",
      "request": {
        "method": "POST",
        "url": "https://licenceskayapps.duckdns.org/api/v1/client/activate",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"productSlug\": \"hardware-store\",\n  \"licenseKey\": \"TEST-2026-001\",\n  \"companyName\": \"Société Test\",\n  \"contactEmail\": \"contact@societetest.com\",\n  \"contactPhone\": \"+261 34 00 000 00\",\n  \"machineId\": \"TEST-MACHINE-12345\",\n  \"appVersion\": \"1.0.0\",\n  \"osInfo\": \"Windows 11 Pro\",\n  \"hostname\": \"PC-CAISSE-01\"\n}"
        }
      }
    },
    {
      "name": "3. Verify License",
      "request": {
        "method": "POST",
        "url": "https://licenceskayapps.duckdns.org/api/v1/client/verify",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"licenseToken\": \"{{licenseToken}}\",\n  \"machineId\": \"TEST-MACHINE-12345\",\n  \"appVersion\": \"1.0.0\"\n}"
        }
      }
    },
    {
      "name": "4. Get Modules",
      "request": {
        "method": "GET",
        "url": "https://licenceskayapps.duckdns.org/api/v1/client/modules/{{licenseToken}}"
      }
    },
    {
      "name": "5. Check Updates",
      "request": {
        "method": "GET",
        "url": "https://licenceskayapps.duckdns.org/api/v1/client/updates/check?productSlug=hardware-store&currentVersion=1.0.0"
      }
    }
  ]
}
```

---

## Méthode 4 : Test Automatique (Vitest)

### Exécuter les tests d'intégration

```bash
cd "c:\Users\Kayce\Documents\Work\Gestionnaire Quincaillerie"

# Exécuter tous les tests de licence
npm test -- tests/license-activation.test.ts

# Exécuter en mode watch (développement)
npm test -- tests/license-activation.test.ts --watch

# Exécuter avec affichage détaillé
npm test -- tests/license-activation.test.ts --reporter=verbose
```

**Résultats attendus :**
```
✓ tests/license-activation.test.ts (13) 8.53s
  ✓ License Activation Integration (10)
    ✓ devrait récupérer la clé publique RSA depuis le serveur
    ✓ devrait envoyer une demande d'activation et recevoir un statut
    ✓ devrait vérifier une licence existante via /verify
    ✓ devrait récupérer les modules autorisés pour un token
    ✓ devrait vérifier les mises à jour disponibles
    ✓ devrait valider la structure d'une licence signée
    ✓ devrait rejeter une signature invalide
    ✓ devrait calculer le Machine ID correctement
    ✓ devrait valider le format des réponses API
    ✓ devrait mesurer le temps de réponse du serveur de licences
  ✓ License Constants Validation (3)
    ✓ devrait avoir une URL de serveur valide
    ✓ devrait avoir un slug de produit défini
    ✓ devrait avoir un intervalle de vérification valide
```

---

## Vérifications et Debug

### Vérifier les logs du backend

```bash
# Dans le terminal du backend, observer les logs :
# - Requêtes entrantes
# - Erreurs de validation
# - Création d'ActivationRequest
# - Signature RSA
```

### Vérifier les logs de l'application Electron

```bash
# Dans le terminal de l'application Electron :
npm run dev

# Observer :
# - Récupération de la clé publique
# - Envoi de la demande d'activation
# - Réception et vérification de la signature
# - Stockage de la licence
```

### Vérifier MongoDB

```bash
# Se connecter à MongoDB
mongosh

# Utiliser la base de données
use gestion-licences

# Voir les collections
show collections

# Vérifier les licences
db.licenses.find().pretty()

# Vérifier les demandes d'activation
db.activationrequests.find().pretty()

# Vérifier les logs d'activation
db.activationlogs.find().pretty()
```

### Vérifier le stockage local Electron

L'application Electron stocke la licence dans `electron-store` :

**Windows :**
```
%APPDATA%\gestionnaire-quincaillerie\license-data.json
```

**macOS :**
```
~/Library/Application Support/gestionnaire-quincaillerie/license-data.json
```

**Linux :**
```
~/.config/gestionnaire-quincaillerie/license-data.json
```

**Contenu attendu :**
```json
{
  "license": {
    "licenseToken": "abc123...",
    "licenseKey": "TEST-2026-001",
    "payload": { ... },
    "signature": "base64...",
    "lastVerified": "2026-01-15T10:00:00.000Z",
    "checkIntervalDays": 30
  },
  "publicKey": "-----BEGIN PUBLIC KEY-----\n..."
}
```

---

## Scénarios de Test

### Scénario 1 : Activation réussie

1. Créer un produit `hardware-store` dans le dashboard
2. Créer un client et une licence active
3. Lancer l'application Electron
4. Saisir la clé de licence
5. ✅ L'application s'ouvre normalement

### Scénario 2 : Activation en attente

1. Créer une licence mais ne pas l'activer dans le dashboard
2. Lancer l'application Electron
3. Saisir les informations d'activation
4. ✅ Message "En attente de validation"
5. Aller dans le dashboard → Activations
6. Approuver la demande
7. ✅ L'application se débloque après vérification

### Scénario 3 : Licence suspendue

1. Dans le dashboard, suspendre une licence
2. Lancer l'application Electron
3. ✅ Message "Licence suspendue — contactez le support"

### Scénario 4 : Machine ID invalide

1. Activer une licence sur un poste
2. Copier le fichier de licence sur un autre poste
3. Lancer l'application sur le nouveau poste
4. ✅ Message "Machine ID invalide" ou demande de transfert

### Scénario 5 : Mode hors ligne

1. Activer une licence normalement
2. Déconnecter Internet
3. Lancer l'application
4. ✅ L'application fonctionne (vérification signature locale)
5. Attendre plus de 30 jours (ou modifier `lastVerified`)
6. ✅ Message "Connexion Internet requise"

### Scénario 6 : Transfert de licence

1. Activer une licence sur le poste A
2. Dans l'application, demander un transfert
3. ✅ La licence est transférée vers le nouveau Machine ID
4. Le poste A ne peut plus utiliser la licence

---

## Outils de Diagnostic

### Script de test rapide

Créer un fichier `test-license.bat` :

```batch
@echo off
echo ========================================
echo Test d'activation de licence
echo ========================================
echo.

echo [1] Verification du serveur API...
curl -s http://localhost:4000/api/v1/client/public-key | jq .
echo.

echo [2] Demande d'activation...
curl -X POST http://localhost:4000/api/v1/client/activate ^
  -H "Content-Type: application/json" ^
  -d "{\"productSlug\":\"hardware-store\",\"licenseKey\":\"TEST-2026-001\",\"companyName\":\"Test\",\"contactEmail\":\"test@test.com\",\"machineId\":\"TEST-MACHINE\",\"appVersion\":\"1.0.0\"}"
echo.

echo ========================================
echo Test termine
echo ========================================
pause
```

### Script PowerShell de vérification

```powershell
# test-license.ps1
$apiUrl = "http://localhost:4000/api/v1/client"

Write-Host "=== Test d'activation de licence ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Clé publique
Write-Host "[1] Récupération de la clé publique..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/public-key" -Method Get
    Write-Host "✓ Clé publique récupérée" -ForegroundColor Green
    Write-Host "  Longueur: $($response.data.publicKey.Length) caractères"
} catch {
    Write-Host "✗ Erreur: $_" -ForegroundColor Red
}

Write-Host ""

# Test 2: Activation
Write-Host "[2] Demande d'activation..." -ForegroundColor Yellow
$body = @{
    productSlug = "hardware-store"
    licenseKey = "TEST-2026-001"
    companyName = "Société Test"
    contactEmail = "test@test.com"
    machineId = "TEST-MACHINE-123"
    appVersion = "1.0.0"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$apiUrl/activate" -Method Post -Body $body -ContentType "application/json"
    Write-Host "✓ Réponse reçue" -ForegroundColor Green
    Write-Host "  Status: $($response.data.status)"
    if ($response.data.requestId) {
        Write-Host "  Request ID: $($response.data.requestId)"
    }
} catch {
    Write-Host "✗ Erreur: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Test terminé ===" -ForegroundColor Cyan
```

---

## Résolution de Problèmes

### Problème 1 : Le serveur ne répond pas

**Vérifications :**
```bash
# Tester la connexion au serveur hébergé
curl https://licenceskayapps.duckdns.org/api/v1/client/public-key

# Vérifier la résolution DNS
nslookup licenceskayapps.duckdns.org

# Vérifier la connectivité HTTPS
curl -I https://licenceskayapps.duckdns.org/api/v1/client/public-key
```

### Problème 2 : Erreur "Product not found"

**Solution :** Vérifier que le slug du produit est bien `hardware-store` dans le dashboard.

### Problème 3 : Erreur "License key not found"

**Solution :** Créer une licence dans le dashboard avec la clé correspondante.

### Problème 4 : Signature invalide

**Vérifications :**
- Les clés RSA sont générées : `backend/keys/`
- Le backend utilise bien la clé privée pour signer
- L'application Electron utilise bien la clé publique du serveur

### Problème 5 : CORS / Erreur réseau

**Vérifier les headers CORS dans `backend/src/app.ts` :**
```typescript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://licenceskayapps.duckdns.org'
    : 'http://localhost:5173',
  credentials: true
}))
```

**Note:** Le serveur hébergé est déjà configuré pour accepter les requêtes depuis :
- https://licenceskayapps.duckdns.org (dashboard)
- http://localhost:5173 (dev local)

---

## Checklist de Test Complet

### Infrastructure
- [ ] Serveur hébergé accessible (https://licenceskayapps.duckdns.org)
- [ ] Dashboard accessible (https://licenceskayapps.duckdns.org)
- [ ] API répond correctement

### Configuration Dashboard
- [ ] Produit `hardware-store` créé
- [ ] Type de licence créé
- [ ] Client créé
- [ ] Licence créée et active

### Test Application Electron
- [ ] Application Electron démarrée
- [ ] Clé publique RSA récupérable
- [ ] Demande d'activation envoyée
- [ ] Réponse signée reçue
- [ ] Signature vérifiée avec succès
- [ ] Licence stockée localement
- [ ] Application fonctionne normalement

### Fonctionnalités avancées
- [ ] Vérification périodique fonctionne
- [ ] Mode hors ligne fonctionne
- [ ] Transfert de licence fonctionne
- [ ] Suspension de licence détectée
- [ ] Logs d'activation enregistrés

---

## Support

Pour toute question ou problème :
- Vérifier les logs du backend
- Vérifier les logs de l'application Electron
- Consulter la documentation API : `docs/API.md`
- Consulter l'architecture : `docs/ARCHITECTURE.md`