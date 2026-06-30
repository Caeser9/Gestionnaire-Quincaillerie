# Script FINAL - Setup complet et lancement de l'application
# Ce script fait tout automatiquement

param(
    [switch]$SkipActivation = $false
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SETUP COMPLET - Gestionnaire Quincaillerie" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Constantes
$licenseFile = "$env:APPDATA\gestionnaire-quincaillerie\license-data.json"
$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"
$machineId = "2b1e147f6d7892677fccbc0186c86eff900cd6a13e0864cfd71185cf4daa5e4f"

# Étape 1: Fermer l'application si elle est ouverte
Write-Host "[1] Fermeture de l'application..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -like "*electron*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 2
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Étape 2: Supprimer l'ancienne licence
Write-Host "[2] Nettoyage de l'ancienne licence..." -ForegroundColor Yellow
if (Test-Path $licenseFile) {
    Remove-Item $licenseFile -Force -ErrorAction SilentlyContinue
    Write-Host "  OK Ancienne licence supprimee" -ForegroundColor Green
} else {
    Write-Host "  OK Aucune ancienne licence" -ForegroundColor Gray
}
Write-Host ""

# Étape 3: Récupérer la licence depuis le serveur
Write-Host "[3] Recuperation de la licence depuis le serveur..." -ForegroundColor Yellow

# Récupérer la clé publique
$publicKeyResponse = Invoke-RestMethod -Uri "$apiUrl/public-key" -Method Get -TimeoutSec 10
$publicKey = $publicKeyResponse.data.publicKey
Write-Host "  OK Cle publique recuperee" -ForegroundColor Green

# Créer une nouvelle activation
Write-Host "  Creation d'une nouvelle activation..." -ForegroundColor Gray

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

# Gérer le mode pending
if ($activationResponse.data.status -eq "pending") {
    Write-Host "  OK Demande creee (en attente d'approbation)" -ForegroundColor Yellow
    Write-Host "  Request ID: $($activationResponse.data.requestId)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  IMPORTANT: Approuvez dans le dashboard!" -ForegroundColor Red
    Write-Host "  1. Aller sur https://licenceskayapps.duckdns.org" -ForegroundColor White
    Write-Host "  2. Section 'Activations'" -ForegroundColor White
    Write-Host "  3. Approuver la demande ID: $($activationResponse.data.requestId)" -ForegroundColor Yellow
    Write-Host ""
    
    # Installer en mode pending
    $pendingContent = @{
        license = @{
            licenseToken = ""
            licenseKey = "TEST-2026-001"
            payload = @{
                machineId = $machineId
                productSlug = "hardware-store"
            }
            signature = ""
            lastVerified = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
            checkIntervalDays = 30
            pendingActivation = $true
            requestId = $activationResponse.data.requestId
        }
        publicKey = $publicKey
    } | ConvertTo-Json -Depth 10
    
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($licenseFile, $pendingContent, $utf8NoBom)
    
    Write-Host "  Mode pending installe - l'application va verifier automatiquement" -ForegroundColor Green
    Write-Host ""
    
    # Lancer l'application
    Write-Host "[4] Lancement de l'application..." -ForegroundColor Yellow
    Write-Host "  L'application va afficher 'En attente de validation'" -ForegroundColor Gray
    Write-Host "  Elle verifiera automatiquement toutes les 8 secondes" -ForegroundColor Gray
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  SETUP TERMINE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    Start-Sleep 3
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Kayce\Documents\Work\Gestionnaire Quincaillerie'; npm run dev"
    
    Write-Host ""
    Write-Host "Application lancee en mode attente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "PROCHAINE ETAPE:" -ForegroundColor Yellow
    Write-Host "  1. Approuvez la demande dans le dashboard" -ForegroundColor White
    Write-Host "  2. L'application se debloquera automatiquement" -ForegroundColor White
    Write-Host ""
    exit 0
}

# Si activé directement
if ($activationResponse.data.status -ne "activated" -and $activationResponse.data.status -ne "already_active") {
    Write-Host "  ERREUR: Activation echouee (status: $($activationResponse.data.status))" -ForegroundColor Red
    Write-Host "  $($activationResponse.data.message)" -ForegroundColor Red
    exit 1
}

Write-Host "  OK Licence activee" -ForegroundColor Green

# Extraire les données
$licenseData = $activationResponse.data
$payload = $licenseData.payload
$signature = $licenseData.signature
$licenseToken = $licenseData.licenseToken

Write-Host ""
Write-Host "[4] Installation de la licence..." -ForegroundColor Yellow

# Créer le dossier si nécessaire
$licenseDir = Split-Path $licenseFile -Parent
if (-not (Test-Path $licenseDir)) {
    New-Item -Path $licenseDir -ItemType Directory -Force | Out-Null
}

# Créer le contenu JSON (format electron-store)
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

Write-Host "  OK Licence installee" -ForegroundColor Green
Write-Host "  Emplacement: $licenseFile" -ForegroundColor Gray
Write-Host ""

# Afficher les détails
Write-Host "[5] Details de la licence:" -ForegroundColor Cyan
Write-Host "  Client: $($payload.clientName)" -ForegroundColor White
Write-Host "  Produit: $($payload.productSlug)" -ForegroundColor White
Write-Host "  Type: $($payload.licenseType)" -ForegroundColor White
Write-Host "  Status: $($payload.status)" -ForegroundColor Green
Write-Host "  Modules: $($payload.authorizedModules -join ', ')" -ForegroundColor White
Write-Host "  Machine ID: $($payload.machineId)" -ForegroundColor White
Write-Host ""

# Étape 6: Lancer l'application
Write-Host "[6] Lancement de l'application..." -ForegroundColor Yellow
Write-Host "  L'application va se lancer dans un nouveau terminal" -ForegroundColor Gray
Write-Host "  Surveillez les logs pour verifier que la licence est detectee" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  SETUP TERMINE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Lancement de l'application dans 3 secondes..." -ForegroundColor Yellow
Start-Sleep 3

# Lancer l'application dans un nouveau terminal
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Kayce\Documents\Work\Gestionnaire Quincaillerie'; npm run dev"

Write-Host ""
Write-Host "Application lancee!" -ForegroundColor Green
Write-Host ""
Write-Host "VERIFICATION:" -ForegroundColor Yellow
Write-Host "  1. L'application devrait s'ouvrir" -ForegroundColor White
Write-Host "  2. Elle devrait detecter la licence automatiquement" -ForegroundColor White
Write-Host "  3. Elle devrait se debloquer et afficher l'interface principale" -ForegroundColor White
Write-Host ""
Write-Host "Si l'application reste bloquee en attente:" -ForegroundColor Red
Write-Host "  1. Fermez l'application" -ForegroundColor Gray
Write-Host "  2. Relancez ce script: .\scripts\setup-and-run.ps1" -ForegroundColor Gray
Write-Host ""