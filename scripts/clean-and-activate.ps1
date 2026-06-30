# Script pour nettoyer et activer proprement la licence
# Supprime tous les anciens fichiers et installe une licence activée

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  NETTOYAGE ET ACTIVATION PROPRE" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

$licenseFile = "$env:APPDATA\gestionnaire-quincaillerie\license-data.json"
$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"
$machineId = "2b1e147f6d7892677fccbc0186c86eff900cd6a13e0864cfd71185cf4daa5e4f"

# Étape 1: Fermer l'application
Write-Host "[1] Fermeture de l'application..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -like "*electron*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 3
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Étape 2: Supprimer TOUS les anciens fichiers
Write-Host "[2] Nettoyage complet..." -ForegroundColor Yellow

if (Test-Path $licenseFile) {
    Remove-Item $licenseFile -Force
    Write-Host "  OK Ancien fichier supprime" -ForegroundColor Green
}

# Supprimer aussi le dossier entier pour être sûr
$licenseDir = "$env:APPDATA\gestionnaire-quincaillerie"
if (Test-Path $licenseDir) {
    Remove-Item $licenseDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  OK Dossier nettoye" -ForegroundColor Green
}
Write-Host ""

# Étape 3: Récupérer la licence ACTIVÉE
Write-Host "[3] Recuperation de la licence..." -ForegroundColor Yellow

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

Write-Host "  Status: $($activationResponse.data.status)" -ForegroundColor $(if ($activationResponse.data.status -eq "activated" -or $activationResponse.data.status -eq "already_active") { "Green" } else { "Red" })

if ($activationResponse.data.status -ne "activated" -and $activationResponse.data.status -ne "already_active") {
    Write-Host ""
    Write-Host "  ERREUR: La licence n'est pas activee!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  SOLUTION: Approuvez la demande dans le dashboard" -ForegroundColor Yellow
    Write-Host "  1. Aller sur https://licenceskayapps.duckdns.org" -ForegroundColor White
    Write-Host "  2. Se connecter: admin@example.com / Admin123!ChangeMe" -ForegroundColor White
    Write-Host "  3. Section 'Activations'" -ForegroundColor White
    Write-Host "  4. Approuver la demande" -ForegroundColor White
    Write-Host "  5. Relancez ce script" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "  OK Licence activee!" -ForegroundColor Green

# Extraire les données
$licenseData = $activationResponse.data
$payload = $licenseData.payload
$signature = $licenseData.signature
$licenseToken = $licenseData.licenseToken

Write-Host ""
Write-Host "[4] Installation de la licence..." -ForegroundColor Yellow

# Créer le dossier
$licenseDir = Split-Path $licenseFile -Parent
New-Item -Path $licenseDir -ItemType Directory -Force | Out-Null

# Créer le contenu JSON - FORMAT PROPRE
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

Write-Host "  OK Licence installee!" -ForegroundColor Green
Write-Host "  Fichier: $licenseFile" -ForegroundColor Gray
Write-Host ""

# Afficher les détails
Write-Host "[5] Details:" -ForegroundColor Cyan
Write-Host "  Client: $($payload.clientName)" -ForegroundColor White
Write-Host "  Produit: $($payload.productSlug)" -ForegroundColor White
Write-Host "  Type: $($payload.licenseType)" -ForegroundColor White
Write-Host "  Status: $($payload.status)" -ForegroundColor Green
Write-Host "  Modules: $($payload.authorizedModules -join ', ')" -ForegroundColor White
Write-Host "  Machine ID: $($payload.machineId)" -ForegroundColor White
Write-Host ""

# Étape 6: Lancer l'application
Write-Host "[6] Lancement de l'application..." -ForegroundColor Yellow
Write-Host "  L'application va demarrer dans 2 secondes" -ForegroundColor Gray
Write-Host ""

Start-Sleep 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Kayce\Documents\Work\Gestionnaire Quincaillerie'; npm run dev"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ACTIVATION TERMINEE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "L'application va demarrer et detecter la licence." -ForegroundColor White
Write-Host "Elle devrait afficher l'interface PRINCIPALE (pas 'En attente')." -ForegroundColor White
Write-Host ""
Write-Host "Si elle reste en attente:" -ForegroundColor Red
Write-Host "  1. Fermez l'application" -ForegroundColor Gray
Write-Host "  2. Relancez: .\scripts\clean-and-activate.ps1" -ForegroundColor Gray
Write-Host ""