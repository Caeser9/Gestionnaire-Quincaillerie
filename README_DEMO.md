Demo build instructions

This project includes a JSON-based demo API that runs without MongoDB. Use the demo server to show the application to clients without installing or running a database.

How it works
- When `DEMO_MODE` is set to a value containing `demo`, the Electron main process starts the demo API (`src/main/server/demo.ts`) which reads/writes data to a JSON file in the application's user data directory (or the `PORTABLE_EXECUTABLE_DIR` when packaged portable).
- The demo data file path is shown in the app logs when the demo server starts.

Run in development (Windows / cross-platform)

Install dev deps (if not already installed):

```bash
npm install
```

Start dev in demo mode (cross-platform):

```bash
npm run dev:demo
```

Build a demo package (cross-platform):

```bash
npm run build:demo
npm run dist:demo
```

Notes
- Demo data file location: by default `%APPDATA%/Gestionnaire Quincaillerie/demo-data.json` (or the app's `userData` folder). The exact path is printed in the console when the demo server starts.
- You can pre-seed or inspect the data file to modify demo content.
- The demo server implements a broad subset of API routes and persists to JSON using `demo-data.json`.

If you want, I can:
- Add a small script to copy a pre-filled demo JSON into the output installer so the packaged app ships with sample data.
- Add a UI toggle to start the app in demo mode from the splash screen.
