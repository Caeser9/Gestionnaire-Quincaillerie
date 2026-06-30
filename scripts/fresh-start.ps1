# Script pour un nouveau départ complet
# Supprime tout et fait une nouvelle demande

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  NOUVEAU DEPART COMPLET" -ForegroundColor Red
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

# Étape 2: Supprimer la licence locale
Write-Host "[2] Suppression de la licence locale..." -ForegroundColor Yellow
$licenseDir = "$env:APPDATA\gestionnaire-quincaillerie"
if (Test-Path $licenseDir) {
    Remove-Item $licenseDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  OK" -ForegroundColor Green
} else {
    Write-Host "  Aucune licence locale" -ForegroundColor Gray
}
Write-Host ""

# Étape 3: Récupérer la clé publique
Write-Host "[3] Recuperation de la cle publique..." -ForegroundColor Yellow
$publicKeyResponse = Invoke-RestMethod -Uri "$apiUrl/public-key" -Method Get -TimeoutSec 10
$publicKey = $publicKeyResponse.data.publicKey
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Étape 4: Créer une NOUVELLE demande d'activation
Write-Host "[4] Creation d'une nouvelle demande d'activation..." -ForegroundColor Yellow
Write-Host "  Machine ID: $machineId" -ForegroundColor Gray
Write-Host ""

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

Write-Host "  Status: $($activationResponse.data.status)" -ForegroundColor $(if ($activationResponse.data.status -eq "pending") { "Yellow" } else { "Green" })

if ($activationResponse.data.status -eq "pending") {
    Write-Host ""
    Write-Host "  Request ID: $($activationResponse.data.requestId)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  ACTION REQUISE" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Allez sur https://licenceskayapps.duckdns.org" -ForegroundColor White
    Write-Host "2. Login: admin@example.com / Admin123!ChangeMe" -ForegroundColor White
    Write-Host "3. Section 'Activations'" -ForegroundColor White
    Write-Host "4. Approuvez la demande ID: $($activationResponse.data.requestId)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "5. Revenez ici et relancez ce script:" -ForegroundColor White
    Write-Host "   .\scripts\fresh-start.ps1" -ForegroundColor Gray
    Write-Host ""
    
    # Sauvegarder le request ID
    $info = @{
        requestId = $activationResponse.data.requestId
        machineId = $machineId
        timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    } | ConvertTo-Json
    
    $info | Out-File -FilePath "$PSScriptRoot\last-request.json" -Encoding UTF8
    
    Write-Host "  Le Request ID a ete sauvegarde dans: last-request.json" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

if ($activationResponse.data.status -ne "activated" -and $activationResponse.data.status -ne "already_active") {
    Write-Host ""
    Write-Host "  ERREUR: Activation echouee" -ForegroundColor Red
    Write-Host "  Status: $($activationResponse.data.status)" -ForegroundColor Red
    exit 1
}

Write-Host "  OK Licence activee!" -ForegroundColor Green
Write-Host ""

# Étape 5: Installer la licence
Write-Host "[5] Installation de la licence..." -ForegroundColor Yellow

$licenseData = $activationResponse.data
$payload = $licenseData.payload
$signature = $licenseData.signature
$licenseToken = $licenseData.licenseToken

$licenseDir = Split-Path $licenseFile -Parent
New-Item -Path $licenseDir -ItemType Directory -Force | Out-Null

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

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($licenseFile, $licenseContent, $utf8NoBom)

Write-Host "  OK Licence installee!" -ForegroundColor Green
Write-Host ""

# Étape 6: Lancer l'application
Write-Host "[6] Lancement de l'application..." -ForegroundColor Yellow
Write-Host "  L'application va demarrer dans 2 secondes" -ForegroundColor Gray
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