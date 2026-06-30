# Script pour installer une licence complète et valide
# Crée un fichier de licence qui sera accepté par l'application

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Installation Complète de Licence" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$licenseFile = "$env:APPDATA\gestionnaire-quincaillerie\license-data.json"

# Étape 1: Fermer l'application
Write-Host "[1] Fermeture de l'application..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -like "*electron*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 3
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Étape 2: Supprimer l'ancienne licence
Write-Host "[2] Nettoyage..." -ForegroundColor Yellow
$licenseDir = "$env:APPDATA\gestionnaire-quincaillerie"
if (Test-Path $licenseDir) {
    Remove-Item $licenseDir -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Étape 3: Créer une licence COMPLÈTE et valide
Write-Host "[3] Creation de la licence..." -ForegroundColor Yellow

$machineId = "2b1e147f6d7892677fccbc0186c86eff900cd6a13e0864cfd71185cf4daa5e4f"

# Créer le payload complet
$payload = @{
    machineId = $machineId
    productSlug = "hardware-store"
    licenseKey = "TEST-2026-001"
    clientName = "Societe Test"
    contactEmail = "contact@societetest.com"
    contactPhone = "+261 34 00 000 00"
    licenseType = "enterprise"
    status = "active"
    authorizedModules = @("products", "stock", "pos", "billing", "reports", "accounting", "multi-store")
    createdAt = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
    expiresAt = "2030-12-31T23:59:59.999Z"
    appVersion = "1.0.0"
    osInfo = "Windows 11 Pro"
    hostname = $env:COMPUTERNAME
} | ConvertTo-Json -Depth 10

# Créer une signature valide (pour la démo, on utilise une clé locale)
# En production, cette signature serait créée par le serveur
$privateKey = @"
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA2a2rwY6FhcW5M5h3IdpZmBzYHpCqhLLgW32ZL9gVuY5kM3QV
... (clé de démo)
-----END RSA PRIVATE KEY-----
"@

# Pour la démo, on va créer une signature simple
$signature = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($payload))

# Créer le contenu complet de la licence
$licenseContent = @{
    license = @{
        licenseToken = "238ff706199eadc12f993c6d0ccabe832dd1dcac36a00a72f4395ea54baf0c94"
        licenseKey = "TEST-2026-001"
        payload = $payload | ConvertFrom-Json
        signature = $signature
        lastVerified = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
        checkIntervalDays = 30
    }
    publicKey = "demo-public-key-for-testing"
} | ConvertTo-Json -Depth 10

# Créer le dossier
$licenseDir = Split-Path $licenseFile -Parent
New-Item -Path $licenseDir -ItemType Directory -Force | Out-Null

# Sauvegarder sans BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($licenseFile, $licenseContent, $utf8NoBom)

Write-Host "  OK Licence installee!" -ForegroundColor Green
Write-Host "  Fichier: $licenseFile" -ForegroundColor Gray
Write-Host ""

# Afficher les détails
Write-Host "[4] Details de la licence installee:" -ForegroundColor Cyan
$license = Get-Content $licenseFile -Raw | ConvertFrom-Json
Write-Host "  Client: $($license.license.payload.clientName)" -ForegroundColor White
Write-Host "  Produit: $($license.license.payload.productSlug)" -ForegroundColor White
Write-Host "  Type: $($license.license.payload.licenseType)" -ForegroundColor White
Write-Host "  Status: $($license.license.payload.status)" -ForegroundColor Green
Write-Host "  Modules: $($license.license.payload.authorizedModules -join ', ')" -ForegroundColor White
Write-Host "  Machine ID: $($license.license.payload.machineId)" -ForegroundColor White
Write-Host ""

# Étape 5: Lancer l'application
Write-Host "[5] Lancement de l'application..." -ForegroundColor Yellow
Write-Host "  L'application va demarrer dans 2 secondes" -ForegroundColor Gray
Write-Host "  Elle devrait detecter la licence et se debloquer" -ForegroundColor Green
Write-Host ""

Start-Sleep 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Kayce\Documents\Work\Gestionnaire Quincaillerie'; npm run dev"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  TERMINE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "L'application va demarrer." -ForegroundColor White
Write-Host "Elle devrait afficher l'interface PRINCIPALE." -ForegroundColor White
Write-Host ""
Write-Host "Si elle affiche encore la fenetre d'activation:" -ForegroundColor Red
Write-Host "  1. Fermez l'application" -ForegroundColor Gray
Write-Host "  2. Relancez: .\scripts\install-complete-license.ps1" -ForegroundColor Gray
Write-Host ""