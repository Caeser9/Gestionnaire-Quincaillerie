# Script pour forcer l'activation de la licence
# Installe la licence directement et ferme l'application pour forcer le redemarrage

param(
    [switch]$Restart = $true
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  ACTIVATION FORCEE DE LA LICENCE" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

# Constantes
$licenseFile = "$env:APPDATA\gestionnaire-quincaillerie\license-data.json"
$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"
$machineId = "2b1e147f6d7892677fccbc0186c86eff900cd6a13e0864cfd71185cf4daa5e4f"

# Étape 1: Fermer l'application
Write-Host "[1] Fermeture forcee de l'application..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -like "*electron*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 3
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Étape 2: Récupérer la licence
Write-Host "[2] Recuperation de la licence depuis le serveur..." -ForegroundColor Yellow

$publicKeyResponse = Invoke-RestMethod -Uri "$apiUrl/public-key" -Method Get -TimeoutSec 10
$publicKey = $publicKeyResponse.data.publicKey
Write-Host "  OK Cle publique recuperee" -ForegroundColor Green

# Créer l'activation
$activationBody = @{
    productSlug = "hardware-store"
    licenseKey = "TEST-2026-001"
    companyName = "Societe Test"
    contactEmail = "contact@societetest.com"
    contactPhone = "+261 34 00 000 00"
    machineId = $machineId
    appVersion = "1.0.0"
    osInfo = "Windows 11 Pro"
    hostname = $env:COMPUTERNAME
} | ConvertTo-Json -Depth 10

$activationResponse = Invoke-RestMethod -Uri "$apiUrl/activate" -Method Post -Body $activationBody -ContentType "application/json" -TimeoutSec 15

if ($activationResponse.data.status -ne "activated" -and $activationResponse.data.status -ne "already_active") {
    Write-Host "  ERREUR: L'activation n'est pas approuvee" -ForegroundColor Red
    Write-Host "  Status: $($activationResponse.data.status)" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Approuvez d'abord la demande dans le dashboard!" -ForegroundColor Yellow
    Write-Host "  Dashboard: https://licenceskayapps.duckdns.org" -ForegroundColor Gray
    exit 1
}

Write-Host "  OK Licence activee" -ForegroundColor Green

# Extraire les données
$licenseData = $activationResponse.data
$payload = $licenseData.payload
$signature = $licenseData.signature
$licenseToken = $licenseData.licenseToken

Write-Host ""
Write-Host "[3] Installation de la licence..." -ForegroundColor Yellow

# Créer le dossier si nécessaire
$licenseDir = Split-Path $licenseFile -Parent
if (-not (Test-Path $licenseDir)) {
    New-Item -Path $licenseDir -ItemType Directory -Force | Out-Null
}

# Créer le contenu JSON avec TOUS les champs nécessaires
$licenseContent = @{
    license = @{
        licenseToken = $licenseToken
        licenseKey = $payload.licenseKey
        payload = $payload
        signature = $signature
        lastVerified = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
        checkIntervalDays = $licenseData.checkIntervalDays
    }
    publicKey = $publicKey
} | ConvertTo-Json -Depth 10

# Sauvegarder sans BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($licenseFile, $licenseContent, $utf8NoBom)

Write-Host "  OK Licence installee dans: $licenseFile" -ForegroundColor Green
Write-Host ""

# Afficher les détails
Write-Host "[4] Details de la licence:" -ForegroundColor Cyan
Write-Host "  Client: $($payload.clientName)" -ForegroundColor White
Write-Host "  Produit: $($payload.productSlug)" -ForegroundColor White
Write-Host "  Type: $($payload.licenseType)" -ForegroundColor White
Write-Host "  Status: $($payload.status)" -ForegroundColor Green
Write-Host "  Modules: $($payload.authorizedModules -join ', ')" -ForegroundColor White
Write-Host "  Machine ID: $($payload.machineId)" -ForegroundColor White
Write-Host ""

if ($Restart) {
    Write-Host "[5] Lancement de l'application..." -ForegroundColor Yellow
    Write-Host "  L'application va demarrer dans 2 secondes" -ForegroundColor Gray
    Write-Host ""
    
    Start-Sleep 2
    
    # Lancer dans un nouveau terminal
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Kayce\Documents\Work\Gestionnaire Quincaillerie'; npm run dev"
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ACTIVATION TERMINEE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "L'application va demarrer et detecter la licence automatiquement." -ForegroundColor White
    Write-Host "Elle devrait afficher l'interface principale (PAS 'En attente')." -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  LICENCE INSTALLEE" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Pour lancer l'application:" -ForegroundColor Yellow
    Write-Host "  cd 'c:\Users\Kayce\Documents\Work\Gestionnaire Quincaillerie'" -ForegroundColor Gray
    Write-Host "  npm run dev" -ForegroundColor Gray
    Write-Host ""
}