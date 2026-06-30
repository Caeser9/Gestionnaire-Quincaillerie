# Script de test de licence en production
# Teste la connectivite avec le serveur heberge licenceskayapps.duckdns.org

param(
    [switch]$Detailed = $false
)

$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"
$productSlug = "hardware-store"
$testLicenseKey = "TEST-PROD-" + (Get-Date -Format "yyyyMMdd-HHmmss")

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test de Connectivite - Serveur Production" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: DNS
Write-Host "[1] Verification de la resolution DNS..." -ForegroundColor Yellow
try {
    $dns = Resolve-DnsName -Name "licenceskayapps.duckdns.org" -Type A -ErrorAction Stop
    Write-Host "OK DNS resolu: $($dns.IPAddress)" -ForegroundColor Green
} catch {
    Write-Host "ERREUR: Impossible de resoudre le DNS: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2] Verification de la connectivite HTTPS..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://licenceskayapps.duckdns.org" -Method Head -UseBasicParsing -TimeoutSec 5
    Write-Host "OK Serveur accessible (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "ERREUR: Serveur inaccessible: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[3] Test de l'API publique (cle RSA)..." -ForegroundColor Yellow
try {
    $apiResponse = Invoke-RestMethod -Uri "$apiUrl/public-key" -Method Get -TimeoutSec 10
    if ($apiResponse.success -and $apiResponse.data.publicKey) {
        Write-Host "OK Cle publique RSA recuperee" -ForegroundColor Green
        Write-Host "  Longueur: $($apiResponse.data.publicKey.Length) caracteres" -ForegroundColor Yellow
        Write-Host "  Format: $($apiResponse.data.publicKey.Substring(0, 50))..." -ForegroundColor Gray
        
        if ($Detailed) {
            Write-Host ""
            Write-Host "Cle publique complete:" -ForegroundColor Gray
            Write-Host $apiResponse.data.publicKey -ForegroundColor Gray
        }
    } else {
        Write-Host "ERREUR: Format de reponse invalide" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERREUR: Impossible de recuperer la cle publique: $_" -ForegroundColor Red
    exit 1
}

# Test d'activation
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test d'Activation de Licence" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$machineId = "TEST-MACHINE-" + (Get-Random -Minimum 1000 -Maximum 9999)
Write-Host "Machine ID de test: $machineId" -ForegroundColor Gray
Write-Host "Cle de licence: $testLicenseKey" -ForegroundColor Gray
Write-Host ""

Write-Host "[4] Envoi d'une demande d'activation..." -ForegroundColor Yellow

$activationBody = @{
    productSlug = $productSlug
    licenseKey = $testLicenseKey
    companyName = "Societe Test Production"
    contactEmail = "test-production@example.com"
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
    Write-Host "Status: $($activationResponse.data.status)" -ForegroundColor $(if ($activationResponse.data.status -eq "pending") { "Yellow" } else { "Green" })
    
    if ($activationResponse.data.status -eq "pending") {
        Write-Host "  Request ID: $($activationResponse.data.requestId)" -ForegroundColor Yellow
        Write-Host "  Message: $($activationResponse.data.message)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "ATTENTION: Action requise - Approuver l'activation dans le dashboard" -ForegroundColor Yellow
        Write-Host "  Dashboard: https://licenceskayapps.duckdns.org" -ForegroundColor Gray
        Write-Host "  Section: Activations" -ForegroundColor Gray
    }
    elseif ($activationResponse.data.status -eq "activated" -or $activationResponse.data.status -eq "already_active") {
        Write-Host "OK Licence activee avec succes!" -ForegroundColor Green
        
        if ($activationResponse.data.licenseToken) {
            Write-Host "  License Token: $($activationResponse.data.licenseToken.Substring(0, 20))..." -ForegroundColor Yellow
            
            # Sauvegarder le token pour les tests suivants
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
            Write-Host "  Max Users: $($payload.maxUsers)" -ForegroundColor White
            Write-Host "  Max Workstations: $($payload.maxWorkstations)" -ForegroundColor White
            Write-Host "  Modules: $($payload.authorizedModules -join ', ')" -ForegroundColor White
            Write-Host "  Machine ID: $($payload.machineId)" -ForegroundColor White
            Write-Host "  Activated At: $($payload.activatedAt)" -ForegroundColor White
            
            if ($payload.expiresAt) {
                Write-Host "  Expires At: $($payload.expiresAt)" -ForegroundColor Yellow
            } else {
                Write-Host "  Expires At: Jamais" -ForegroundColor Green
            }
        }
        
        if ($activationResponse.data.signature) {
            Write-Host "  Signature RSA: $($activationResponse.data.signature.Length) caracteres (base64)" -ForegroundColor Yellow
        }
        
        if ($activationResponse.data.checkIntervalDays) {
            Write-Host "  Intervalle de verification: $($activationResponse.data.checkIntervalDays) jours" -ForegroundColor Yellow
        }
    }
    
    if ($Detailed) {
        Write-Host ""
        Write-Host "Reponse complete:" -ForegroundColor Gray
        $activationResponse | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
    }
    
} catch {
    Write-Host "ERREUR: Echec de l'activation: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
    exit 1
}

# Test de verification (si on a un token)
if ($global:licenseToken) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Test de Verification de Licence" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "[5] Verification de la licence..." -ForegroundColor Yellow
    
    $verifyBody = @{
        licenseToken = $global:licenseToken
        machineId = $machineId
        appVersion = "1.0.0"
    } | ConvertTo-Json
    
    try {
        $verifyResponse = Invoke-RestMethod -Uri "$apiUrl/verify" -Method Post -Body $verifyBody -ContentType "application/json" -TimeoutSec 10
        
        if ($verifyResponse.data.valid) {
            Write-Host "OK Licence valide" -ForegroundColor Green
            Write-Host "  Token: $($verifyResponse.data.licenseToken.Substring(0, 20))..." -ForegroundColor Yellow
        } else {
            Write-Host "ERREUR: Licence invalide" -ForegroundColor Red
        }
        
        if ($Detailed -and $verifyResponse.data.payload) {
            Write-Host ""
            Write-Host "Payload de verification:" -ForegroundColor Gray
            $verifyResponse.data.payload | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor Gray
        }
    } catch {
        Write-Host "ERREUR: Echec de la verification: $_" -ForegroundColor Red
    }
    
    # Test des modules
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Test des Modules Autorises" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "[6] Recuperation des modules autorises..." -ForegroundColor Yellow
    
    try {
        $modulesResponse = Invoke-RestMethod -Uri "$apiUrl/modules/$global:licenseToken" -Method Get -TimeoutSec 10
        
        if ($modulesResponse.data.authorizedModules) {
            Write-Host "OK Modules autorises recuperes" -ForegroundColor Green
            Write-Host "  Modules: $($modulesResponse.data.authorizedModules -join ', ')" -ForegroundColor White
        }
    } catch {
        Write-Host "ERREUR: Impossible de recuperer les modules: $_" -ForegroundColor Red
    }
    
    # Test des mises a jour
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Test des Mises a Jour" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "[7] Verification des mises a jour..." -ForegroundColor Yellow
    
    try {
        $updatesResponse = Invoke-RestMethod -Uri "$apiUrl/updates/check?productSlug=$productSlug&currentVersion=1.0.0" -Method Get -TimeoutSec 10
        
        if ($updatesResponse.data) {
            Write-Host "OK Verification effectuee" -ForegroundColor Green
            Write-Host "  Update disponible: $($updatesResponse.data.hasUpdate)" -ForegroundColor $(if ($updatesResponse.data.hasUpdate) { "Yellow" } else { "Green" })
            Write-Host "  Derniere version: $($updatesResponse.data.latestVersion)" -ForegroundColor White
            if ($updatesResponse.data.downloadUrl) {
                Write-Host "  URL: $($updatesResponse.data.downloadUrl)" -ForegroundColor Cyan
            }
        }
    } catch {
        Write-Host "ERREUR: Impossible de verifier les mises a jour: $_" -ForegroundColor Red
    }
}

# Resume
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Resume des Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "OK Serveur de licences operationnel" -ForegroundColor Green
Write-Host "OK API client fonctionnelle" -ForegroundColor Green
Write-Host "OK Communication HTTPS etablie" -ForegroundColor Green

if ($activationResponse.data.status -eq "pending") {
    Write-Host ""
    Write-Host "ATTENTION: Activation en attente de validation" -ForegroundColor Yellow
    Write-Host "  1. Aller sur https://licenceskayapps.duckdns.org" -ForegroundColor White
    Write-Host "  2. Se connecter avec admin@example.com / Admin123!ChangeMe" -ForegroundColor White
    Write-Host "  3. Aller dans 'Activations'" -ForegroundColor White
    Write-Host "  4. Approuver la demande avec Request ID: $($activationResponse.data.requestId)" -ForegroundColor White
    Write-Host "  5. Relancer ce script pour verifier" -ForegroundColor White
} elseif ($activationResponse.data.status -eq "activated" -or $activationResponse.data.status -eq "already_active") {
    Write-Host ""
    Write-Host "OK Licence active et fonctionnelle" -ForegroundColor Green
    Write-Host "  L'application Electron peut maintenant utiliser cette licence" -ForegroundColor Green
}

Write-Host ""
Write-Host "Test termine avec succes!" -ForegroundColor Green
Write-Host ""