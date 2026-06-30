# Script pour installer la licence directement dans l'application Electron
# Contourne le probleme de connexion en installant la licence localement

param(
    [string]$LicenseToken = "238ff706199eadc12f993c6d0ccabe832dd1dcac36a00a72f4395ea54baf0c94",
    [string]$MachineId = "2b1e147f6d7892677fccbc0186c86eff900cd6a13e0864cfd71185cf4daa5e4f"
)

$licenseFile = "$env:APPDATA\gestionnaire-quincaillerie\license-data.json"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Installation Directe de la Licence" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Verifier que l'application est fermee
Write-Host "[1] Verification de l'application..." -ForegroundColor Yellow
$electronProcesses = Get-Process | Where-Object { $_.ProcessName -like "*electron*" }

if ($electronProcesses) {
    Write-Host "  ATTENTION: Fermez l'application Electron d'abord!" -ForegroundColor Red
    Write-Host "  Appuyez sur Ctrl+C dans le terminal ou fermez la fenetre" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Voulez-vous continuer quand meme? (o/n)"
    if ($response -ne "o") {
        Write-Host "Operation annulee" -ForegroundColor Yellow
        exit 0
    }
}
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Creer le dossier si necessaire
$licenseDir = Split-Path $licenseFile -Parent
if (-not (Test-Path $licenseDir)) {
    New-Item -Path $licenseDir -ItemType Directory -Force | Out-Null
    Write-Host "  Dossier cree: $licenseDir" -ForegroundColor Gray
}

# Recuperer la licence complete depuis le serveur
Write-Host "[2] Recuperation de la licence depuis le serveur..." -ForegroundColor Yellow

$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"

# D'abord recuperer la cle publique
$publicKeyResponse = Invoke-RestMethod -Uri "$apiUrl/public-key" -Method Get -TimeoutSec 10
$publicKey = $publicKeyResponse.data.publicKey
Write-Host "  OK Cle publique recuperee" -ForegroundColor Green

# Verifier le statut pour obtenir la licence complete
$statusBody = @{
    requestId = "6a439f68307fe0cda32f9eeb"
    machineId = $MachineId
    appVersion = "1.0.0"
} | ConvertTo-Json

$statusResponse = Invoke-RestMethod -Uri "$apiUrl/activation/status" -Method Post -Body $statusBody -ContentType "application/json" -TimeoutSec 10

if ($statusResponse.data.status -ne "activated") {
    Write-Host "  ERREUR: La licence n'est pas activee" -ForegroundColor Red
    exit 1
}

Write-Host "  OK Licence activee" -ForegroundColor Green

# Extraire les donnees de la licence
$licenseData = $statusResponse.data
$payload = $licenseData.payload
$signature = $licenseData.signature
$licenseTokenFinal = $licenseData.licenseToken

if (-not $licenseTokenFinal) {
    $licenseTokenFinal = $LicenseToken
}

Write-Host ""
Write-Host "[3] Creation du fichier de licence..." -ForegroundColor Yellow

# Creer le contenu du fichier de licence (format electron-store)
$licenseContent = @{
    license = @{
        licenseToken = $licenseTokenFinal
        licenseKey = $payload.licenseKey
        payload = $payload
        signature = $signature
        lastVerified = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
        checkIntervalDays = $licenseData.checkIntervalDays
    }
    publicKey = $publicKey
} | ConvertTo-Json -Depth 10

# Sauvegarder le fichier (sans BOM)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($licenseFile, $licenseContent, $utf8NoBom)
Write-Host "  OK Fichier de licence cree" -ForegroundColor Green
Write-Host "  Emplacement: $licenseFile" -ForegroundColor Gray
Write-Host ""

# Afficher les details
Write-Host "[4] Details de la licence installee:" -ForegroundColor Cyan
Write-Host "  Client: $($payload.clientName)" -ForegroundColor White
Write-Host "  Produit: $($payload.productSlug)" -ForegroundColor White
Write-Host "  Type: $($payload.licenseType)" -ForegroundColor White
Write-Host "  Status: $($payload.status)" -ForegroundColor Green
Write-Host "  Modules: $($payload.authorizedModules -join ', ')" -ForegroundColor White
Write-Host "  Machine ID: $($payload.machineId)" -ForegroundColor White
Write-Host "  License Token: $licenseTokenFinal" -ForegroundColor Yellow
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "Installation Terminee!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaine etape:" -ForegroundColor Yellow
Write-Host "  1. Lancer l'application Electron: npm run dev" -ForegroundColor White
Write-Host "  2. L'application va detecter la licence automatiquement" -ForegroundColor White
Write-Host "  3. L'application devrait se debloquer immediatement" -ForegroundColor White
Write-Host ""

Write-Host "Si l'application reste bloquee:" -ForegroundColor Yellow
Write-Host "  1. Fermez l'application" -ForegroundColor Gray
Write-Host "  2. Supprimez le fichier: $licenseFile" -ForegroundColor Gray
Write-Host "  3. Relancez: npm run dev" -ForegroundColor Gray
Write-Host ""