# Script pour forcer la verification de l'activation
# Verifie le statut et force le rechargement si necessaire

param(
    [string]$RequestId = "6a439f68307fe0cda32f9eeb"
)

$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Forcee de l'Activation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Calculer le Machine ID de l'application
$hostname = $env:COMPUTERNAME
$platform = "win32"
$arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
$cpuModel = (Get-WmiObject -Class Win32_Processor | Select-Object -First 1).Name
if (-not $cpuModel) { $cpuModel = "CPU" }

$raw = "$hostname-$platform-$arch-$cpuModel"
$machineId = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($raw))).Replace("-", "").ToLower()

Write-Host "Machine ID de l'application: $machineId" -ForegroundColor Cyan
Write-Host "Request ID a verifier: $RequestId" -ForegroundColor Yellow
Write-Host ""

# Verifier le statut
Write-Host "[1] Verification du statut..." -ForegroundColor Yellow

$statusBody = @{
    requestId = $RequestId
    machineId = $machineId
    appVersion = "1.0.0"
} | ConvertTo-Json

try {
    $statusResponse = Invoke-RestMethod -Uri "$apiUrl/activation/status" -Method Post -Body $statusBody -ContentType "application/json" -TimeoutSec 10
    
    Write-Host "  Status: $($statusResponse.data.status)" -ForegroundColor $(if ($statusResponse.data.status -eq "activated") { "Green" } elseif ($statusResponse.data.status -eq "pending") { "Yellow" } else { "Red" })
    Write-Host ""
    
    if ($statusResponse.data.status -eq "activated") {
        Write-Host "  OK La licence est activée!" -ForegroundColor Green
        Write-Host ""
        
        if ($statusResponse.data.payload) {
            $payload = $statusResponse.data.payload
            Write-Host "  Details:" -ForegroundColor Cyan
            Write-Host "    Client: $($payload.clientName)" -ForegroundColor White
            Write-Host "    Produit: $($payload.productSlug)" -ForegroundColor White
            Write-Host "    Type: $($payload.licenseType)" -ForegroundColor White
            Write-Host "    Status: $($payload.status)" -ForegroundColor Green
            Write-Host "    Modules: $($payload.authorizedModules -join ', ')" -ForegroundColor White
            Write-Host "    Machine ID: $($payload.machineId)" -ForegroundColor White
            
            if ($payload.machineId -ne $machineId) {
                Write-Host ""
                Write-Host "  ATTENTION: Machine ID different!" -ForegroundColor Red
                Write-Host "    Machine ID dans la licence: $($payload.machineId)" -ForegroundColor Red
                Write-Host "    Machine ID de l'application: $machineId" -ForegroundColor Red
            }
        }
        
        if ($statusResponse.data.licenseToken) {
            Write-Host ""
            Write-Host "  License Token: $($statusResponse.data.licenseToken)" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "PROCHAINE ETAPE" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Si l'application Electron est toujours en attente:" -ForegroundColor White
        Write-Host ""
        Write-Host "1. Fermer l'application Electron" -ForegroundColor White
        Write-Host "2. Supprimer le fichier de licence local:" -ForegroundColor White
        Write-Host "   %APPDATA%\gestionnaire-quincaillerie\license-data.json" -ForegroundColor Gray
        Write-Host "3. Redemarrer l'application" -ForegroundColor White
        Write-Host "4. L'application va recuperer la licence automatiquement" -ForegroundColor White
        Write-Host ""
        
    } elseif ($statusResponse.data.status -eq "pending") {
        Write-Host "  ATTENTION: Toujours en attente" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  Verifiez dans le dashboard que la demande est bien approuvee" -ForegroundColor Yellow
        Write-Host "  Dashboard: https://licenceskayapps.duckdns.org" -ForegroundColor Gray
        Write-Host ""
        
    } elseif ($statusResponse.data.status -eq "rejected") {
        Write-Host "  ERREUR: Demande rejetee" -ForegroundColor Red
        Write-Host "  Raison: $($statusResponse.data.reason)" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Vous devez creer une nouvelle demande" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "  ERREUR: Impossible de verifier le statut" -ForegroundColor Red
    Write-Host "  $_" -ForegroundColor Red
}

Write-Host ""

# Test de l'endpoint /verify
Write-Host "[2] Test de l'endpoint /verify..." -ForegroundColor Yellow

$verifyBody = @{
    licenseToken = "test-token"
    machineId = $machineId
    appVersion = "1.0.0"
} | ConvertTo-Json

try {
    $verifyResponse = Invoke-RestMethod -Uri "$apiUrl/verify" -Method Post -Body $verifyBody -ContentType "application/json" -TimeoutSec 10
    
    Write-Host "  Endpoint /verify accessible" -ForegroundColor Green
    Write-Host "  Response: $($verifyResponse | ConvertTo-Json -Depth 5)" -ForegroundColor Gray
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
}

Write-Host ""

# Informations de debug
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Informations de Debug" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Machine ID: $machineId" -ForegroundColor White
Write-Host "Request ID: $RequestId" -ForegroundColor White
Write-Host "API URL: $apiUrl" -ForegroundColor White
Write-Host ""
Write-Host "Fichier de licence local:" -ForegroundColor Yellow
Write-Host "  %APPDATA%\gestionnaire-quincaillerie\license-data.json" -ForegroundColor Gray
Write-Host ""
Write-Host "Pour supprimer la licence locale et forcer la re-activation:" -ForegroundColor Yellow
Write-Host "  Remove-Item `$env:APPDATA\gestionnaire-quincaillerie\license-data.json" -ForegroundColor Gray
Write-Host ""