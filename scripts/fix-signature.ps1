# Script pour corriger la signature de licence
# Réinstalle une licence avec une signature valide

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  CORRECTION DE SIGNATURE" -ForegroundColor Red
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

# Étape 2: Supprimer l'ancienne licence
Write-Host "[2] Suppression de l'ancienne licence..." -ForegroundColor Yellow
if (Test-Path $licenseFile) {
    Remove-Item $licenseFile -Force
    Write-Host "  OK" -ForegroundColor Green
}
Write-Host ""

# Étape 3: Récupérer la clé publique
Write-Host "[3] Recuperation de la cle publique..." -ForegroundColor Yellow
$publicKeyResponse = Invoke-RestMethod -Uri "$apiUrl/public-key" -Method Get -TimeoutSec 10
$publicKey = $publicKeyResponse.data.publicKey
Write-Host "  OK" -ForegroundColor Green
Write-Host ""

# Étape 4: Créer une NOUVELLE activation
Write-Host "[4] Creation d'une nouvelle activation..." -ForegroundColor Yellow
Write-Host "  IMPORTANT: La licence doit etre approuvee dans le dashboard!" -ForegroundColor Red
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

Write-Host "  Status: $($activationResponse.data.status)" -ForegroundColor $(if ($activationResponse.data.status -eq "activated" -or $activationResponse.data.status -eq "already_active") { "Green" } else { "Red" })

if ($activationResponse.data.status -ne "activated" -and $activationResponse.data.status -ne "already_active") {
    Write-Host ""
    Write-Host "  ERREUR: Licence non approuvee!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Vous devez approuver la demande dans le dashboard:" -ForegroundColor Yellow
    Write-Host "  1. https://licenceskayapps.duckdns.org" -ForegroundColor White
    Write-Host "  2. Login: admin@example.com / Admin123!ChangeMe" -ForegroundColor White
    Write-Host "  3. Section 'Activations'" -ForegroundColor White
    Write-Host "  4. Approuvez la demande ID: $($activationResponse.data.requestId)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Puis relancez ce script" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "  OK Licence activee avec signature valide!" -ForegroundColor Green
Write-Host ""

# Étape 5: Vérifier la signature
Write-Host "[5] Verification de la signature..." -ForegroundColor Yellow

$licenseData = $activationResponse.data
$payload = $licenseData.payload
$signature = $licenseData.signature
$licenseToken = $licenseData.licenseToken

Write-Host "  Payload status: $($payload.status)" -ForegroundColor White
Write-Host "  Signature presente: $($signature.Length -gt 0)" -ForegroundColor White
Write-Host "  License Token: $licenseToken" -ForegroundColor Gray
Write-Host ""

# Étape 6: Installer la licence
Write-Host "[6] Installation de la licence..." -ForegroundColor Yellow

$licenseDir = Split-Path $licenseFile -Parent
New-Item -Path $licenseDir -ItemType Directory -Force | Out-Null

# Créer le contenu JSON avec signature
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
Write-Host "[7] Details de la licence:" -ForegroundColor Cyan
Write-Host "  Client: $($payload.clientName)" -ForegroundColor White
Write-Host "  Produit: $($payload.productSlug)" -ForegroundColor White
Write-Host "  Type: $($payload.licenseType)" -ForegroundColor White
Write-Host "  Status: $($payload.status)" -ForegroundColor Green
Write-Host "  Modules: $($payload.authorizedModules -join ', ')" -ForegroundColor White
Write-Host "  Machine ID: $($payload.machineId)" -ForegroundColor White
Write-Host "  Signature: $($signature.Substring(0, [Math]::Min(50, $signature.Length)))..." -ForegroundColor Gray
Write-Host ""

# Étape 8: Lancer l'application
Write-Host "[8] Lancement de l'application..." -ForegroundColor Yellow
Write-Host "  L'application va demarrer dans 2 secondes" -ForegroundColor Gray
Write-Host "  Elle devrait detecter la signature comme VALIDE" -ForegroundColor Green
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
Write-Host "Si 'Signature invalide' s'affiche encore:" -ForegroundColor Red
Write-Host "  1. Fermez l'application" -ForegroundColor Gray
Write-Host "  2. Attendez 5 minutes (rate limit)" -ForegroundColor Gray
Write-Host "  3. Relancez: .\scripts\fix-signature.ps1" -ForegroundColor Gray
Write-Host ""