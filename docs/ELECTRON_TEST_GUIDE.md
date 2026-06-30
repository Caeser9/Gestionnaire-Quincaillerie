# Guide de Test - Application Electron

## Démarrage Rapide

### 1. Installer les dépendances (si première fois)

```bash
cd "c:\Users\Kayce\Documents\Work\Gestionnaire Quincaillerie"
npm install
```

### 2. Lancer l'application

```bash
npm run dev
```

L'application va se lancer et afficher automatiquement la page d'activation de licence.

## Test d'Activation

### Étape 1: Vérifier l'écran d'activation

Au démarrage, l'application affiche:

```
┌─────────────────────────────────────┐
│  🔧 Activation du logiciel          │
│  Gestionnaire Quincaillerie         │
├─────────────────────────────────────┤
│                                     │
│  Une connexion Internet est         │
│  requise pour la première           │
│  activation. Ensuite, le logiciel   │
│  fonctionne hors ligne.             │
│                                     │
│  [Raison sociale *]                 │
│  [Email de contact *]               │
│  [Téléphone]                        │
│  [Clé de licence]                   │
│                                     │
│  ID machine: TEST-MACHINE-XXXX      │
│  Produit: hardware-store            │
│                                     │
│  [Activer le logiciel]              │
│                                     │
│  🔑 Licence gérée par Kay Apps      │
└─────────────────────────────────────┘
```

### Étape 2: Saisir les informations

**Remplir le formulaire:**
- **Raison sociale:** Societe Test
- **Email de contact:** contact@societetest.com
- **Téléphone:** +261 34 00 000 00
- **Clé de licence:** TEST-2026-001

**Note:** Le Machine ID est généré automatiquement et affiché.

### Étape 3: Activer

1. Cliquer sur **"Activer le logiciel"**
2. L'application envoie la demande au serveur
3. Si la licence est déjà activée pour ce Machine ID → accès immédiat
4. Si la licence nécessite une approbation → affichage du mode "pending"

### Étape 4: Mode En Attente (si applicable)

Si l'activation est en "pending", l'écran change:

```
┌─────────────────────────────────────┐
│  ⏳ En attente de validation        │
│     administrateur                  │
├─────────────────────────────────────┤
│                                     │
│         (Animation de chargement)   │
│                                     │
│  Une fois approuvée dans le         │
│  dashboard, la licence sera         │
│  récupérée automatiquement.         │
│                                     │
│  licenceskayapps.duckdns.org        │
│                                     │
│  [Vérifier maintenant]  [Modifier]  │
│                                     │
└─────────────────────────────────────┘
```

**L'application vérifie automatiquement toutes les 8 secondes.**

### Étape 5: Approuver dans le Dashboard

Pendant ce temps, approuver l'activation:

1. Ouvrir https://licenceskayapps.duckdns.org
2. Se connecter: admin@example.com / Admin123!ChangeMe
3. Aller dans **"Activations"**
4. Approuver la demande
5. L'application Electron se débloque automatiquement

## Vérification Post-Activation

### Une fois activée, l'application:

1. **Stocke la licence localement** dans electron-store
2. **Vérifie la signature RSA** de la licence
3. **Récupère les modules autorisés**
4. **Débloque l'accès** aux fonctionnalités

### Emplacement du fichier de licence

**Windows:**
```
%APPDATA%\gestionnaire-quincaillerie\license-data.json
```

**Contenu:**
```json
{
  "license": {
    "licenseToken": "abc123...",
    "licenseKey": "TEST-2026-001",
    "payload": {
      "clientName": "Societe Test",
      "productSlug": "hardware-store",
      "licenseType": "pro",
      "status": "active",
      "authorizedModules": ["products", "stock", "pos", "billing", "reports"],
      "machineId": "TEST-MACHINE-1901",
      ...
    },
    "signature": "base64...",
    "lastVerified": "2026-06-30T11:30:00.000Z",
    "checkIntervalDays": 30
  },
  "publicKey": "-----BEGIN PUBLIC KEY-----\n..."
}
```

## Fonctionnalités Testées

### ✅ Activation
- Communication avec le serveur hébergé
- Envoi des informations (company, email, machine ID)
- Réception de la licence signée
- Vérification de la signature RSA

### ✅ Vérification Périodique
- Toutes les 30 jours (par défaut)
- Vérification en ligne
- Mode hors ligne (si signature valide)

### ✅ Modules Autorisés
- products (produits)
- stock (inventaire)
- pos (caisse)
- billing (facturation)
- reports (rapports)

### ✅ Sécurité
- Machine ID unique
- Signature RSA 4096 bits
- Vérification d'intégrité
- Pas de modification possible

## Dépannage

### L'application ne se lance pas

```bash
# Vérifier les logs
npm run dev

# Erreurs courantes:
# - Port déjà utilisé: changer le port dans vite.config.ts
# - Module manquant: npm install
```

### Erreur d'activation

1. **"Connexion Internet requise"**
   - Vérifier la connexion Internet
   - Vérifier que le serveur est accessible: https://licenceskayapps.duckdns.org

2. **"Licence invalide"**
   - Vérifier la clé de licence
   - Vérifier que la licence est active dans le dashboard

3. **"Machine ID invalide"**
   - La licence est activée sur un autre poste
   - Demander un transfert dans le dashboard

### Voir les logs

**Logs du processus principal (main):**
```bash
# Dans le terminal où npm run dev est lancé
# Les logs apparaissent automatiquement
```

**Logs du processus de rendu (UI):**
- Ouvrir les DevTools: Ctrl+Shift+I (Windows/Linux) ou Cmd+Option+I (Mac)
- Console: voir les logs JavaScript

## Test Complet

### Checklist

- [ ] Application se lance
- [ ] Page d'activation s'affiche
- [ ] Machine ID est généré
- [ ] Formulaire se remplit
- [ ] Activation envoyée
- [ ] Réponse reçue (pending ou activated)
- [ ] Si pending: vérification automatique
- [ ] Si approved: licence activée
- [ ] Modules débloqués
- [ ] Application fonctionne normalement

## Commandes Utiles

```bash
# Lancer l'application
npm run dev

# Build pour production
npm run build

# Tests
npm test

# Lint
npm run lint
```

## Architecture

```
Gestionnaire Quincaillerie/
├── src/
│   ├── main/                    # Processus principal Electron
│   │   ├── services/
│   │   │   └── license.service.ts    # Logique de licence
│   │   └── index.ts                  # Point d'entrée
│   │
│   ├── renderer/                # Interface utilisateur
│   │   ├── modules/License/
│   │   │   ├── LicenseActivationPage.tsx   # Page d'activation
│   │   │   └── LicenseBlockedPage.tsx      # Page de blocage
│   │   └── App.tsx                      # Composant principal
│   │
│   ├── preload/                 # Pont entre main et renderer
│   │   └── index.ts
│   │
│   └── shared/                  # Code partagé
│       ├── constants/
│       │   └── license.ts       # URL serveur, config
│       └── types/
│           └── license.ts       # Types TypeScript
│
└── scripts/
    └── test-with-persistence.ps1  # Script de test
```

## Support

- **Documentation API:** docs/API.md
- **Guide de test manuel:** docs/MANUAL_TESTING.md
- **Résultats de test:** docs/TEST_RESULTS.md
- **Dashboard:** https://licenceskayapps.duckdns.org