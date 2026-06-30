# Résolution de Problèmes - Activation de Licence

## Erreur: "Impossible de récupérer la clé publique"

Cette erreur signifie que l'application Electron ne peut pas se connecter au serveur de licences.

### Causes Possibles

1. **Problème de connexion Internet**
2. **URL de serveur incorrecte**
3. **Problème de CORS**
4. **Serveur inaccessible**

### Solutions

#### Solution 1: Vérifier la Connectivité

```bash
# Tester la connexion au serveur
curl https://licenceskayapps.duckdns.org/api/v1/client/public-key

# Vérifier la résolution DNS
nslookup licenceskayapps.duckdns.org

# Tester avec PowerShell
powershell -Command "Invoke-RestMethod -Uri 'https://licenceskayapps.duckdns.org/api/v1/client/public-key' -Method Get"
```

#### Solution 2: Vérifier la Configuration

**Fichier:** `src/shared/constants/license.ts`

```typescript
export const LICENSE_SERVER_URL = 'https://licenceskayapps.duckdns.org/api/v1/client'
export const PRODUCT_SLUG = 'hardware-store'
export const LICENSE_CHECK_INTERVAL_DAYS = 30
```

Assurez-vous que l'URL est correcte.

#### Solution 3: Désactiver le proxy (si applicable)

Si vous êtes derrière un proxy, ajoutez dans le code:

```typescript
// Dans license.service.ts, avant les appels fetch
process.env.NO_PROXY = 'licenceskayapps.duckdns.org'
```

#### Solution 4: Vérifier les logs détaillés

```bash
# Lancer l'application avec logs détaillés
cd "c:\Users\Kayce\Documents\Work\Gestionnaire Quincaillerie"
npm run dev 2>&1 | tee electron-logs.txt
```

Cherchez les erreurs:
- `ECONNREFUSED` - Serveur inaccessible
- `ENOTFOUND` - DNS ne résout pas
- `ETIMEDOUT` - Timeout de connexion
- `CORS` - Problème de CORS

#### Solution 5: Tester avec une URL locale

Si le serveur hébergé pose problème, testez en local:

1. **Démarrer le backend local:**
   ```bash
   cd "c:\Users\Kayce\Documents\Work\Gestion Licences\backend"
   npm run dev
   ```

2. **Modifier temporairement l'URL:**
   ```typescript
   // src/shared/constants/license.ts
   export const LICENSE_SERVER_URL = 'http://localhost:4000/api/v1/client'
   ```

3. **Tester l'application**

#### Solution 6: Vérifier le firewall

```powershell
# Vérifier si le port 443 (HTTPS) est bloqué
Test-NetConnection -ComputerName licenceskayapps.duckdns.org -Port 443

# Si bloqué, ajouter une règle
New-NetFirewallRule -DisplayName "Allow HTTPS" -Direction Outbound -Protocol TCP -LocalPort 443 -RemotePort 443 -Action Allow
```

### Diagnostic Complet

Utilisez le script de diagnostic:

```powershell
powershell -ExecutionPolicy Bypass -File "scripts/diagnose-electron.ps1"
```

### Vérification Manuelle

1. **Ouvrir un navigateur**
2. **Aller sur:** https://licenceskayapps.duckdns.org/api/v1/client/public-key
3. **Vérifier que la réponse s'affiche** (JSON avec la clé publique)

Si le navigateur ne peut pas accéder au serveur, le problème vient du réseau, pas de l'application.

### Logs de l'Application

Dans le terminal où vous lancez `npm run dev`, cherchez:

```
[License] Fetching public key...
[License] Public key fetched successfully
```

Si vous voyez:
```
[License] Error fetching public key: <error details>
```

Cela donne des indices sur le problème.

### Test de Connectivité depuis l'Application

Ajoutez temporairement ce code dans `license.service.ts`:

```typescript
// Test de connectivité au démarrage
async function testConnectivity() {
  try {
    console.log('[Test] Testing connectivity to:', LICENSE_SERVER_URL)
    const response = await fetch(`${LICENSE_SERVER_URL}/public-key`)
    console.log('[Test] Response status:', response.status)
    const data = await response.json()
    console.log('[Test] Response data:', data)
  } catch (error) {
    console.error('[Test] Connectivity error:', error)
  }
}

// Appeler au démarrage
testConnectivity()
```

### Solutions par Erreur Spécifique

#### Erreur: `ECONNREFUSED`
- Le serveur n'est pas accessible
- Vérifiez que le serveur est en ligne
- Vérifiez votre connexion Internet

#### Erreur: `ENOTFOUND`
- Problème de DNS
- Essayez: `nslookup licenceskayapps.duckdns.org`
- Utilisez l'adresse IP directement (si connue)

#### Erreur: `ETIMEDOUT`
- Le serveur met trop de temps à répondre
- Vérifiez votre connexion Internet
- Le serveur peut être surchargé

#### Erreur: `CORS`
- Le serveur bloque les requêtes
- Vérifiez les headers CORS dans le backend
- En développement, le serveur devrait autoriser `localhost:5173`

### Vérification du Backend

Si vous avez accès au serveur:

```bash
# Vérifier que le backend fonctionne
curl https://licenceskayapps.duckdns.org/api/v1/client/public-key

# Vérifier les logs du serveur
# (dans le terminal où le backend est lancé)
```

### Contact Support

Si rien ne fonctionne:

1. Vérifiez que le serveur est en ligne: https://licenceskayapps.duckdns.org
2. Vérifiez les logs du backend
3. Vérifiez la configuration réseau (firewall, proxy, etc.)

### Solution Temporaire: Mode Hors Ligne

Si vous ne pouvez pas vous connecter au serveur, vous pouvez utiliser le mode développement:

```typescript
// Dans license.service.ts, ligne 149
if (process.env.SKIP_LICENSE_CHECK === 'true') {
  // ... mode dev
}
```

Lancez l'application avec:
```bash
SKIP_LICENSE_CHECK=true npm run dev
```

**Note:** Ce mode est uniquement pour le développement et les tests.