# Gestionnaire Quincaillerie

Application desktop de gestion complète pour quincaillerie (magasin physique).

## Stack technique

- **Desktop** : Electron 33 + React + TypeScript
- **UI** : Tailwind CSS, React Router, React Query
- **Backend** : Node.js + Express (local)
- **Base de données** : MongoDB + Mongoose
- **Build** : electron-vite 2.3 + Vite 5 + electron-builder

## Prérequis

- Node.js 18+
- **MongoDB** installé et démarré localement (`mongodb://127.0.0.1:27017`)

L'application ne fonctionne pas sans une instance MongoDB accessible. La base par défaut est `quincaillerie`.

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

Au démarrage :

- connexion à MongoDB ;
- serveur API local sur le port `3847` ;
- fenêtre Electron avec l'interface React.

Aucune authentification n'est requise : l'application est utilisable directement après le lancement.

## Build

```bash
npm run build
```

Prévisualisation du build :

```bash
npm run preview
```

## Distribution Windows

```bash
npm run dist:win
```

L'installateur est généré dans le dossier `release/`.

## Tests

```bash
npm test
```

## Architecture

```
src/
├── main/           # Process Electron, API Express, MongoDB
├── preload/        # Bridge IPC sécurisé
├── renderer/       # Application React
├── modules/        # Modules métier (Dashboard, POS, etc.)
└── shared/         # Types, constantes, validation, utils
```

## Licence

MIT
