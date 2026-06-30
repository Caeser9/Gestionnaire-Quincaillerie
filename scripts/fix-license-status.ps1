# Script pour forcer le statut de la licence a "active"
# Modifie le fichier de licence pour que l'application le detecte comme active

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  CORRECTION DU STATUT DE LICENCE" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

$licenseFile = "$env:APPDATA\gestionnaire-quincaillerie\license-data.json"

# Étape 1: Fermer l'application
Write-Host "[1] Fermeture de l'application..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -like "*electron*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 3
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Étape 2: Lire le fichier existant
Write-Host "[2] Lecture du fichier de licence..." -ForegroundColor Yellow

if (-not (Test-Path $licenseFile)) {
    Write-Host "  ERREUR: Aucun fichier de licence trouve!" -ForegroundColor Red
    Write-Host "  Executez d'abord: .\scripts\auto-approve-and-install.ps1" -ForegroundColor Yellow
    exit 1
}

$licenseContent = Get-Content $licenseFile -Raw | ConvertFrom-Json
Write-Host "  OK Fichier lu" -ForegroundColor Green
Write-Host "  Client: $($licenseContent.license.payload.clientName)" -ForegroundColor White
Write-Host "  Status actuel: $($licenseContent.license.payload.status)" -ForegroundColor Yellow
Write-Host ""

# Étape 3: Corriger le statut
Write-Host "[3] Correction du statut..." -ForegroundColor Yellow

# Modifier le payload pour forcer le status a "active"
$payload = $licenseContent.license.payload
$payload.status = "active"
$payload.clientName = "Societe Test"
$payload.productSlug = "hardware-store"
$payload.licenseType = "enterprise"
$payload.authorizedModules = @("products", "stock", "pos", "billing", "reports", "accounting", "multi-store")
$payload.machineId = "2b1e147f6d7892677fccbc0186c86eff900cd6a13e0864cfd71185cf4daa5e4f"

# Mettre à jour le payload dans le fichier
$licenseContent.license.payload = $payload

# Supprimer les champs qui pourraient indiquer "pending"
if ($licenseContent.license.pendingActivation) {
    $licenseContent.license.PSObject.Properties.Remove('pendingActivation')
}

Write-Host "  OK Statut corrige: active" -ForegroundColor Green
Write-Host ""

# Étape 4: Sauvegarder le fichier
Write-Host "[4] Sauvegarde du fichier..." -ForegroundColor Yellow

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($licenseFile, ($licenseContent | ConvertTo-Json -Depth 10), $utf8NoBom)

Write-Host "  OK Fichier sauvegarde" -ForegroundColor Green
Write-Host ""

# Étape 5: Lancer l'application
Write-Host "[5] Lancement de l'application..." -ForegroundColor Yellow
Write-Host "  L'application va demarrer dans 2 secondes" -ForegroundColor Gray
Write-Host "  Elle devrait maintenant detecter la licence comme ACTIVE" -ForegroundColor Green
Write-Host ""

Start-Sleep 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Kayce\Documents\Work\Gestionnaire Quincaillerie'; npm run dev"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  CORRECTION TERMINEE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "L'application va demarrer." -ForegroundColor White
Write-Host "Elle devrait afficher l'interface PRINCIPALE." -ForegroundColor White
Write-Host ""
Write-Host "Si elle reste en attente:" -ForegroundColor Red
Write-Host "  1. Fermez l'application" -ForegroundColor Gray
Write-Host "  2. Relancez: .\scripts\fix-license-status.ps1" -ForegroundColor Gray
Write-Host ""