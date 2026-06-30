# Script de test avec licence existante
# Verifie une licence deja approuvee dans le dashboard

param(
    [string]$LicenseKey = "TEST-2026-001",
    [string]$MachineId = "TEST-MACHINE-EXISTING",
    [switch]$Detailed = $false
)

$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"
$productSlug = "hardware-store"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test avec Licence Existante" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  License Key: $LicenseKey" -ForegroundColor White
Write-Host "  Machine ID: $MachineId" -ForegroundColor White
Write-Host "  Product: $productSlug" -ForegroundColor White
Write-Host ""

# Etape 1: Recuperer la cle publique
Write-Host "[1] Recuperation de la cle publique..." -ForegroundColor Yellow
try {
    $publicKeyResponse = Invoke-RestMethod -Uri "$apiUrl/public-key" -Method Get -TimeoutSec 10
    Write-Host "OK Cle publique recuperee" -ForegroundColor Green
} catch {
    Write-Host "ERREUR: $_" -ForegroundColor Red
    exit 1
}

# Etape 2: Demande d'activation avec la cle existante
Write-Host ""
Write-Host "[2] Demande d'activation avec la cle existante..." -ForegroundColor Yellow

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
        Write-Host "ATTENTION: Cette licence necessite une approbation manuelle" -ForegroundColor Yellow
        Write-Host "  Allez sur https://licenceskayapps.duckdns.org > Activations" -ForegroundColor Gray
    }
    elseif ($activationResponse.data.status -eq "activated" -or $activationResponse.data.status -eq "already_active") {
        Write-Host "OK Licence activee avec succes!" -ForegroundColor Green
        
        if ($activationResponse.data.licenseToken) {
            Write-Host "  License Token: $($activationResponse.data.licenseToken)" -ForegroundColor Yellow
            $global:licenseToken = $activationResponse.data.licenseToken
        }
        
        if ($activationResponse.data.payload) {
            $payload = $activationResponse.data.payload
            Write-Host ""
            Write-Host "Details de la licence:" -ForegroundColor Cyan
            Write-Host "  Client: $($payload.clientName)" -ForegroundColor White
            Write-Host "  Produit: $($payload.productSlug)" -ForegroundColor White
            Write-Host "  Type: $($payload.licenseType)" -ForegroundColor White
            Write-Host "  Status: $($payload.status)" -ForegroundColor Green
            Write-Host "  Modules: $($payload.authorizedModules -join ', ')" -ForegroundColor White
            Write-Host "  Machine ID: $($payload.machineId)" -ForegroundColor White
            
            if ($payload.expiresAt) {
                Write-Host "  Expire le: $($payload.expiresAt)" -ForegroundColor Yellow
            } else {
                Write-Host "  Pas d'expiration" -ForegroundColor Green
            }
        }
        
        if ($activationResponse.data.signature) {
            Write-Host "  Signature: $($activationResponse.data.signature.Length) caracteres" -ForegroundColor Yellow
        }
    }
    
    if ($Detailed) {
        Write-Host ""
        Write-Host "Reponse complete:" -ForegroundColor Gray
        $activationResponse | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
    }
    
} catch {
    Write-Host "ERREUR: Echec de l'activation: $_" -ForegroundColor Red
    exit 1
}

# Etape 3: Verification (si on a un token)
if ($global:licenseToken) {
    Write-Host ""
    Write-Host "[3] Verification de la licence..." -ForegroundColor Yellow
    
    $verifyBody = @{
        licenseToken = $global:licenseToken
        machineId = $MachineId
        appVersion = "1.0.0"
    } | ConvertTo-Json
    
    try {
        $verifyResponse = Invoke-RestMethod -Uri "$apiUrl/verify" -Method Post -Body $verifyBody -ContentType "application/json" -TimeoutSec 10
        
        if ($verifyResponse.data.valid) {
            Write-Host "OK Licence valide et verifiee" -ForegroundColor Green
        } else {
            Write-Host "ERREUR: Licence invalide" -ForegroundColor Red
        }
    } catch {
        Write-Host "ERREUR: Echec de la verification: $_" -ForegroundColor Red
    }
    
    # Etape 4: Modules
    Write-Host ""
    Write-Host "[4] Recuperation des modules..." -ForegroundColor Yellow
    
    try {
        $modulesResponse = Invoke-RestMethod -Uri "$apiUrl/modules/$global:licenseToken" -Method Get -TimeoutSec 10
        
        if ($modulesResponse.data.authorizedModules) {
            Write-Host "OK Modules autorises:" -ForegroundColor Green
            $modulesResponse.data.authorizedModules | ForEach-Object {
                Write-Host "  - $_" -ForegroundColor White
            }
        }
    } catch {
        Write-Host "ERREUR: $_" -ForegroundColor Red
    }
}

# Resume
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Resume" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($activationResponse.data.status -eq "activated" -or $activationResponse.data.status -eq "already_active") {
    Write-Host "OK Test reussi - Licence fonctionnelle" -ForegroundColor Green
    Write-Host "  L'application Electron peut utiliser cette licence" -ForegroundColor Green
} elseif ($activationResponse.data.status -eq "pending") {
    Write-Host "ATTENTION: Licence en attente d'approbation" -ForegroundColor Yellow
    Write-Host "  Request ID: $($activationResponse.data.requestId)" -ForegroundColor Yellow
    Write-Host "  Approuvez dans le dashboard puis relancez ce script" -ForegroundColor Yellow
}

Write-Host ""