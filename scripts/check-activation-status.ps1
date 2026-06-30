# Script de verification du statut d'activation
# Verifie le statut d'une demande d'activation specifique

param(
    [string]$RequestId = "",
    [string]$LicenseKey = "TEST-2026-001",
    [string]$MachineId = "TEST-MACHINE-FIXED-001"
)

$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"
$productSlug = "hardware-store"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification du Statut d'Activation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  License Key: $LicenseKey" -ForegroundColor White
Write-Host "  Machine ID: $MachineId" -ForegroundColor White
Write-Host "  Product: $productSlug" -ForegroundColor White
if ($RequestId) {
    Write-Host "  Request ID: $RequestId" -ForegroundColor White
}
Write-Host ""

# Methode 1: Verifier le statut via l'endpoint /activation/status
if ($RequestId) {
    Write-Host "[1] Verification du statut de la demande..." -ForegroundColor Yellow
    
    $statusBody = @{
        requestId = $RequestId
        machineId = $MachineId
        appVersion = "1.0.0"
    } | ConvertTo-Json
    
    try {
        $statusResponse = Invoke-RestMethod -Uri "$apiUrl/activation/status" -Method Post -Body $statusBody -ContentType "application/json" -TimeoutSec 10
        
        Write-Host "OK Reponse recue" -ForegroundColor Green
        Write-Host ""
        Write-Host "Status: $($statusResponse.data.status)" -ForegroundColor $(if ($statusResponse.data.status -eq "activated") { "Green" } elseif ($statusResponse.data.status -eq "pending") { "Yellow" } else { "Red" })
        
        if ($statusResponse.data.status -eq "activated") {
            Write-Host ""
            Write-Host "Details de la licence:" -ForegroundColor Cyan
            if ($statusResponse.data.payload) {
                $payload = $statusResponse.data.payload
                Write-Host "  Client: $($payload.clientName)" -ForegroundColor White
                Write-Host "  Produit: $($payload.productSlug)" -ForegroundColor White
                Write-Host "  Type: $($payload.licenseType)" -ForegroundColor White
                Write-Host "  Status: $($payload.status)" -ForegroundColor Green
                Write-Host "  Modules: $($payload.authorizedModules -join ', ')" -ForegroundColor White
                Write-Host "  Machine ID: $($payload.machineId)" -ForegroundColor White
            }
            Write-Host ""
            Write-Host "OK Licence activee avec succes!" -ForegroundColor Green
        }
        elseif ($statusResponse.data.status -eq "pending") {
            Write-Host "  Message: $($statusResponse.data.message)" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "ATTENTION: Toujours en attente" -ForegroundColor Yellow
        }
        elseif ($statusResponse.data.status -eq "rejected") {
            Write-Host "  Raison: $($statusResponse.data.reason)" -ForegroundColor Red
            Write-Host ""
            Write-Host "ERREUR: Demande rejetee" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "ERREUR: Impossible de verifier le statut: $_" -ForegroundColor Red
        Write-Host "  (L'endpoint /activation/status n'existe peut-etre pas encore)" -ForegroundColor Gray
    }
}

# Methode 2: Tenter l'activation avec un Machine ID fixe
Write-Host ""
Write-Host "[2] Tentative d'activation (Machine ID fixe)..." -ForegroundColor Yellow

$activationBody = @{
    productSlug = $productSlug
    licenseKey = $LicenseKey
    companyName = "Societe Test"
    contactEmail = "contact@societetest.com"
    contactPhone = "+261 34 00 000 00"
    machineId = $MachineId
    appVersion = "1.0.0"
    osInfo = "Windows 11 Pro"
    hostname = $env:COMPUTERNAME
} | ConvertTo-Json -Depth 10

try {
    $startTime = Get-Date
    $activationResponse = Invoke-RestMethod -Uri "$apiUrl/activate" -Method Post -Body $activationBody -ContentType "application/json" -TimeoutSec 15
    $duration = (Get-Date) - $startTime
    
    Write-Host "OK Reponse recue en $($duration.TotalMilliseconds)ms" -ForegroundColor Green
    Write-Host ""
    Write-Host "Status: $($activationResponse.data.status)" -ForegroundColor $(if ($activationResponse.data.status -eq "pending") { "Yellow" } elseif ($activationResponse.data.status -eq "activated" -or $activationResponse.data.status -eq "already_active") { "Green" } else { "Red" })
    
    if ($activationResponse.data.status -eq "pending") {
        Write-Host "  Request ID: $($activationResponse.data.requestId)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "ATTENTION: Approbation requise" -ForegroundColor Yellow
        Write-Host "  1. Aller sur https://licenceskayapps.duckdns.org" -ForegroundColor White
        Write-Host "  2. Se connecter avec admin@example.com / Admin123!ChangeMe" -ForegroundColor White
        Write-Host "  3. Aller dans 'Activations'" -ForegroundColor White
        Write-Host "  4. Approuver la demande ID: $($activationResponse.data.requestId)" -ForegroundColor White
        Write-Host "  5. Relancer ce script avec: -RequestId $($activationResponse.data.requestId)" -ForegroundColor White
    }
    elseif ($activationResponse.data.status -eq "activated" -or $activationResponse.data.status -eq "already_active") {
        Write-Host "OK Licence activee!" -ForegroundColor Green
        
        if ($activationResponse.data.licenseToken) {
            Write-Host "  License Token: $($activationResponse.data.licenseToken)" -ForegroundColor Yellow
            $global:licenseToken = $activationResponse.data.licenseToken
        }
        
        if ($activationResponse.data.payload) {
            $payload = $activationResponse.data.payload
            Write-Host ""
            Write-Host "Details:" -ForegroundColor Cyan
            Write-Host "  Client: $($payload.clientName)" -ForegroundColor White
            Write-Host "  Produit: $($payload.productSlug)" -ForegroundColor White
            Write-Host "  Type: $($payload.licenseType)" -ForegroundColor White
            Write-Host "  Status: $($payload.status)" -ForegroundColor Green
            Write-Host "  Modules: $($payload.authorizedModules -join ', ')" -ForegroundColor White
            Write-Host "  Machine ID: $($payload.machineId)" -ForegroundColor White
        }
    }
    
} catch {
    Write-Host "ERREUR: Echec de l'activation: $_" -ForegroundColor Red
}

# Resume
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Resume" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($activationResponse.data.status -eq "activated" -or $activationResponse.data.status -eq "already_active") {
    Write-Host "OK Licence fonctionnelle" -ForegroundColor Green
    Write-Host "  L'application Electron peut utiliser cette licence" -ForegroundColor Green
} elseif ($activationResponse.data.status -eq "pending") {
    Write-Host "ATTENTION: Approbation requise" -ForegroundColor Yellow
    Write-Host "  Request ID: $($activationResponse.data.requestId)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pour verifier le statut apres approbation:" -ForegroundColor White
    Write-Host "  .\check-activation-status.ps1 -RequestId $($activationResponse.data.requestId)" -ForegroundColor Gray
}

Write-Host ""