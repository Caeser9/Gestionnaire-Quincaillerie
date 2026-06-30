# Script pour activer l'application Electron
# Simule exactement le comportement de l'application Electron

param(
    [string]$CompanyName = "Societe Test",
    [string]$ContactEmail = "contact@societetest.com",
    [string]$ContactPhone = "+261 34 00 000 00",
    [string]$LicenseKey = "TEST-2026-001"
)

$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"
$productSlug = "hardware-store"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Activation Application Electron" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Calculer le Machine ID exactement comme l'application Electron
Write-Host "[1] Calcul du Machine ID (comme Electron)..." -ForegroundColor Yellow

$hostname = $env:COMPUTERNAME
$platform = "win32"  # Windows
$arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
$cpuModel = (Get-WmiObject -Class Win32_Processor | Select-Object -First 1).Name
if (-not $cpuModel) { $cpuModel = "CPU" }

$raw = "$hostname-$platform-$arch-$cpuModel"
$machineId = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($raw))).Replace("-", "").ToLower()

Write-Host "  Hostname: $hostname" -ForegroundColor Gray
Write-Host "  Platform: $platform" -ForegroundColor Gray
Write-Host "  Arch: $arch" -ForegroundColor Gray
Write-Host "  CPU: $cpuModel" -ForegroundColor Gray
Write-Host ""
Write-Host "  Machine ID: $machineId" -ForegroundColor Cyan
Write-Host ""

# Recuperer la cle publique
Write-Host "[2] Recuperation de la cle publique..." -ForegroundColor Yellow
try {
    $publicKeyResponse = Invoke-RestMethod -Uri "$apiUrl/public-key" -Method Get -TimeoutSec 10
    Write-Host "  OK Cle publique recuperee" -ForegroundColor Green
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Creer la demande d'activation
Write-Host "[3] Creation de la demande d'activation..." -ForegroundColor Yellow
Write-Host "  Company: $CompanyName" -ForegroundColor White
Write-Host "  Email: $ContactEmail" -ForegroundColor White
Write-Host "  Phone: $ContactPhone" -ForegroundColor White
Write-Host "  License Key: $LicenseKey" -ForegroundColor White
Write-Host "  Product: $productSlug" -ForegroundColor White
Write-Host ""

$activationBody = @{
    productSlug = $productSlug
    licenseKey = $LicenseKey
    companyName = $CompanyName
    contactEmail = $ContactEmail
    contactPhone = $ContactPhone
    machineId = $machineId
    appVersion = "1.0.0"
    osInfo = "Windows 11 Pro"
    hostname = $hostname
} | ConvertTo-Json -Depth 10

try {
    $startTime = Get-Date
    $activationResponse = Invoke-RestMethod -Uri "$apiUrl/activate" -Method Post -Body $activationBody -ContentType "application/json" -TimeoutSec 15
    $duration = (Get-Date) - $startTime
    
    Write-Host "  OK Reponse recue en $($duration.TotalMilliseconds)ms" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Status: $($activationResponse.data.status)" -ForegroundColor $(if ($activationResponse.data.status -eq "pending") { "Yellow" } elseif ($activationResponse.data.status -eq "activated" -or $activationResponse.data.status -eq "already_active") { "Green" } else { "Red" })
    
    if ($activationResponse.data.status -eq "pending") {
        Write-Host ""
        Write-Host "  Request ID: $($activationResponse.data.requestId)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Yellow
        Write-Host "ACTION REQUISE" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "1. Aller sur https://licenceskayapps.duckdns.org" -ForegroundColor White
        Write-Host "2. Se connecter: admin@example.com / Admin123!ChangeMe" -ForegroundColor White
        Write-Host "3. Aller dans 'Activations'" -ForegroundColor White
        Write-Host "4. Approuver la demande ID: $($activationResponse.data.requestId)" -ForegroundColor Yellow
        Write-Host "5. L'application Electron se debloquera automatiquement" -ForegroundColor White
        Write-Host ""
        Write-Host "Machine ID de l'application: $machineId" -ForegroundColor Gray
        Write-Host ""
        
        # Sauvegarder les informations
        $info = @{
            machineId = $machineId
            requestId = $activationResponse.data.requestId
            companyName = $CompanyName
            email = $ContactEmail
            timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        } | ConvertTo-Json
        
        $info | Out-File -FilePath "$PSScriptRoot\electron-activation-info.json" -Encoding UTF8
        Write-Host "  Informations sauvegardees dans: electron-activation-info.json" -ForegroundColor Gray
    }
    elseif ($activationResponse.data.status -eq "activated" -or $activationResponse.data.status -eq "already_active") {
        Write-Host ""
        Write-Host "  OK Licence activee avec succes!" -ForegroundColor Green
        
        if ($activationResponse.data.payload) {
            $payload = $activationResponse.data.payload
            Write-Host ""
            Write-Host "  Details:" -ForegroundColor Cyan
            Write-Host "    Client: $($payload.clientName)" -ForegroundColor White
            Write-Host "    Produit: $($payload.productSlug)" -ForegroundColor White
            Write-Host "    Type: $($payload.licenseType)" -ForegroundColor White
            Write-Host "    Status: $($payload.status)" -ForegroundColor Green
            Write-Host "    Modules: $($payload.authorizedModules -join ', ')" -ForegroundColor White
        }
        
        Write-Host ""
        Write-Host "  L'application Electron peut maintenant utiliser cette licence" -ForegroundColor Green
    }
    
} catch {
    Write-Host ""
    Write-Host "  ERREUR: Echec de l'activation: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""