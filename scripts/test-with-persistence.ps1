# Script de test avec persistance du Machine ID
# Simule le comportement de l'application Electron qui garde le meme Machine ID

param(
    [switch]$Detailed = $false
)

$configFile = "$PSScriptRoot\test-config.json"
$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"
$productSlug = "hardware-store"
$licenseKey = "TEST-2026-001"

# Charger ou creer la configuration
if (Test-Path $configFile) {
    $config = Get-Content $configFile | ConvertFrom-Json
    Write-Host "OK Configuration chargee depuis $configFile" -ForegroundColor Green
} else {
    $machineId = "TEST-MACHINE-" + (Get-Random -Minimum 1000 -Maximum 9999)
    $config = @{
        machineId = $machineId
        licenseKey = $licenseKey
        productSlug = $productSlug
        requestId = $null
        licenseToken = $null
    }
    
    $config | ConvertTo-Json -Depth 10 | Out-File -FilePath $configFile -Encoding UTF8
    Write-Host "OK Nouvelle configuration creee" -ForegroundColor Green
}

$machineId = $config.machineId

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test avec Persistance (Machine ID fixe)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  License Key: $($config.licenseKey)" -ForegroundColor White
Write-Host "  Machine ID: $machineId" -ForegroundColor White
Write-Host "  Product: $($config.productSlug)" -ForegroundColor White
if ($config.requestId) {
    Write-Host "  Request ID precedent: $($config.requestId)" -ForegroundColor Gray
}
Write-Host ""

# Si on a un Request ID, verifier le statut
if ($config.requestId) {
    Write-Host "[1] Verification du statut de la demande precedente..." -ForegroundColor Yellow
    
    $statusBody = @{
        requestId = $config.requestId
        machineId = $machineId
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
                
                if ($payload.expiresAt) {
                    Write-Host "  Expire le: $($payload.expiresAt)" -ForegroundColor Yellow
                } else {
                    Write-Host "  Pas d'expiration" -ForegroundColor Green
                }
            }
            Write-Host ""
            Write-Host "OK Licence activee avec succes!" -ForegroundColor Green
            
            # Sauvegarder le token
            if ($statusResponse.data.licenseToken) {
                $config.licenseToken = $statusResponse.data.licenseToken
                $config | ConvertTo-Json | Out-File -FilePath $configFile -Encoding UTF8
            }
            
            # Passer aux tests de verification
            $global:licenseToken = $statusResponse.data.licenseToken
        }
        elseif ($statusResponse.data.status -eq "pending") {
            Write-Host "  Message: $($statusResponse.data.message)" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "ATTENTION: Toujours en attente d'approbation" -ForegroundColor Yellow
            Write-Host "  Request ID: $($config.requestId)" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "  Approuvez dans le dashboard:" -ForegroundColor White
            Write-Host "  https://licenceskayapps.duckdns.org > Activations" -ForegroundColor Gray
        }
        elseif ($statusResponse.data.status -eq "rejected") {
            Write-Host "  Raison: $($statusResponse.data.reason)" -ForegroundColor Red
            Write-Host ""
            Write-Host "ERREUR: Demande rejetee" -ForegroundColor Red
            # Supprimer le request ID pour creer une nouvelle demande
            $config.requestId = $null
            $config | ConvertTo-Json | Out-File -FilePath $configFile -Encoding UTF8
        }
        
    } catch {
        Write-Host "ERREUR: Impossible de verifier le statut: $_" -ForegroundColor Red
        Write-Host "  (L'endpoint /activation/status n'existe peut-etre pas)" -ForegroundColor Gray
    }
}

# Si pas de licence active, tenter l'activation
if (-not $global:licenseToken) {
    Write-Host ""
    Write-Host "[2] Demande d'activation..." -ForegroundColor Yellow
    
    $activationBody = @{
        productSlug = $productSlug
        licenseKey = $licenseKey
        companyName = "Societe Test"
        contactEmail = "contact@societetest.com"
        contactPhone = "+261 34 00 000 00"
        machineId = $machineId
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
        Write-Host "Status: $($activationResponse.data.status)" -ForegroundColor $(if ($activationResponse.data.status -eq "pending") { "Yellow" } elseif ($activationResponse.data.status -eq "activated" -or $activationResponse.status -eq "already_active") { "Green" } else { "Red" })
        
        if ($activationResponse.data.status -eq "pending") {
            $config.requestId = $activationResponse.data.requestId
            $config | ConvertTo-Json | Out-File -FilePath $configFile -Encoding UTF8
            
            Write-Host "  Request ID: $($activationResponse.data.requestId)" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "ATTENTION: Approbation requise" -ForegroundColor Yellow
            Write-Host "  1. Aller sur https://licenceskayapps.duckdns.org" -ForegroundColor White
            Write-Host "  2. Se connecter avec admin@example.com / Admin123!ChangeMe" -ForegroundColor White
            Write-Host "  3. Aller dans 'Activations'" -ForegroundColor White
            Write-Host "  4. Approuver la demande ID: $($activationResponse.data.requestId)" -ForegroundColor White
            Write-Host "  5. Relancer ce script pour verifier" -ForegroundColor White
        }
        elseif ($activationResponse.data.status -eq "activated" -or $activationResponse.data.status -eq "already_active") {
            Write-Host "OK Licence activee!" -ForegroundColor Green
            
            if ($activationResponse.data.licenseToken) {
                $global:licenseToken = $activationResponse.data.licenseToken
                $config.licenseToken = $activationResponse.data.licenseToken
                $config | ConvertTo-Json | Out-File -FilePath $configFile -Encoding UTF8
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
        
        if ($Detailed) {
            Write-Host ""
            Write-Host "Reponse complete:" -ForegroundColor Gray
            $activationResponse | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
        }
        
    } catch {
        Write-Host "ERREUR: Echec de l'activation: $_" -ForegroundColor Red
    }
}

# Tests de verification (si on a un token)
if ($global:licenseToken) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Tests de Verification" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Verification
    Write-Host "[3] Verification de la licence..." -ForegroundColor Yellow
    
    $verifyBody = @{
        licenseToken = $global:licenseToken
        machineId = $machineId
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
    
    # Modules
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
    
    # Mises a jour
    Write-Host ""
    Write-Host "[5] Verification des mises a jour..." -ForegroundColor Yellow
    
    try {
        $updatesResponse = Invoke-RestMethod -Uri "$apiUrl/updates/check?productSlug=$productSlug`&currentVersion=1.0.0" -Method Get -TimeoutSec 10
        
        if ($updatesResponse.data) {
            Write-Host "OK Verification effectuee" -ForegroundColor Green
            Write-Host "  Update disponible: $($updatesResponse.data.hasUpdate)" -ForegroundColor $(if ($updatesResponse.data.hasUpdate) { "Yellow" } else { "Green" })
            Write-Host "  Derniere version: $($updatesResponse.data.latestVersion)" -ForegroundColor White
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

if ($global:licenseToken) {
    Write-Host "OK Test reussi - Licence fonctionnelle" -ForegroundColor Green
    Write-Host "  L'application Electron peut utiliser cette licence" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configuration sauvegardee dans: $configFile" -ForegroundColor Gray
    Write-Host "  Machine ID: $machineId" -ForegroundColor Gray
} elseif ($config.requestId) {
    Write-Host "ATTENTION: Approbation requise" -ForegroundColor Yellow
    Write-Host "  Request ID: $($config.requestId)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Apres approbation, relancez ce script:" -ForegroundColor White
    Write-Host "  .\test-with-persistence.ps1" -ForegroundColor Gray
} else {
    Write-Host "ERREUR: Aucune licence activee" -ForegroundColor Red
}

Write-Host ""