# Script de diagnostic pour l'application Electron
# Verifie le Machine ID et l'etat de la licence

param(
    [switch]$Detailed = $false
)

$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"
$approvedMachineId = "TEST-MACHINE-1901"
$approvedRequestId = "6a439ab0609f2696835e8b83"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostic - Application Electron" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Information sur le poste actuel
Write-Host "[1] Informations sur le poste actuel" -ForegroundColor Yellow
Write-Host "  Hostname: $env:COMPUTERNAME" -ForegroundColor White
Write-Host "  User: $env:USERNAME" -ForegroundColor White
Write-Host "  OS: $([System.Environment]::OSVersion.VersionString)" -ForegroundColor White
Write-Host ""

# Calculer le Machine ID comme l'application Electron
Write-Host "[2] Calcul du Machine ID (comme Electron)" -ForegroundColor Yellow

$os = Import-Module -Name os -ErrorAction SilentlyContinue
$crypto = Import-Module -Name crypto -ErrorAction SilentlyContinue

# Simuler le calcul de l'application
$hostname = $env:COMPUTERNAME
$platform = if ($env:OS -eq "Windows_NT") { "win32" } else { "linux" }
$arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }

# Pour CPU model, on utilise une valeur par defaut sur Windows
$cpuModel = (Get-WmiObject -Class Win32_Processor | Select-Object -First 1).Name
if (-not $cpuModel) {
    $cpuModel = "CPU"
}

$raw = "$hostname-$platform-$arch-$cpuModel"
$machineId = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($raw))).Replace("-", "").ToLower()

Write-Host "  Hostname: $hostname" -ForegroundColor Gray
Write-Host "  Platform: $platform" -ForegroundColor Gray
Write-Host "  Arch: $arch" -ForegroundColor Gray
Write-Host "  CPU: $cpuModel" -ForegroundColor Gray
Write-Host "  Raw string: $raw" -ForegroundColor Gray
Write-Host ""
Write-Host "  Machine ID calcule: $machineId" -ForegroundColor Cyan
Write-Host "  Machine ID approuve: $approvedMachineId" -ForegroundColor Yellow
Write-Host ""

if ($machineId -eq $approvedMachineId) {
    Write-Host "  OK Les Machine IDs correspondent!" -ForegroundColor Green
} else {
    Write-Host "  ERREUR: Machine IDs differents!" -ForegroundColor Red
    Write-Host "  L'application Electron va generer une nouvelle demande d'activation" -ForegroundColor Red
    Write-Host "  car elle est sur un poste different de celui du test." -ForegroundColor Red
}
Write-Host ""

# Verifier le statut de l'approbation
Write-Host "[3] Verification du statut d'approbation" -ForegroundColor Yellow

$statusBody = @{
    requestId = $approvedRequestId
    machineId = $approvedMachineId
    appVersion = "1.0.0"
} | ConvertTo-Json

try {
    $statusResponse = Invoke-RestMethod -Uri "$apiUrl/activation/status" -Method Post -Body $statusBody -ContentType "application/json" -TimeoutSec 10
    
    Write-Host "  Status: $($statusResponse.data.status)" -ForegroundColor $(if ($statusResponse.data.status -eq "activated") { "Green" } else { "Yellow" })
    
    if ($statusResponse.data.status -eq "activated") {
        Write-Host "  OK Licence active pour Machine ID: $approvedMachineId" -ForegroundColor Green
        
        if ($statusResponse.data.payload) {
            $payload = $statusResponse.data.payload
            Write-Host "  Client: $($payload.clientName)" -ForegroundColor White
            Write-Host "  Produit: $($payload.productSlug)" -ForegroundColor White
            Write-Host "  Modules: $($payload.authorizedModules -join ', ')" -ForegroundColor White
        }
    }
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
}
Write-Host ""

# Solutions possibles
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Solutions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($machineId -ne $approvedMachineId) {
    Write-Host "PROBLEME: L'application Electron est sur un poste different." -ForegroundColor Red
    Write-Host ""
    Write-Host "Solutions:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Tester sur le meme poste que le script PowerShell" -ForegroundColor White
    Write-Host "   (Le Machine ID doit etre identique)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Creer une licence pour ce poste" -ForegroundColor White
    Write-Host "   a) Lancer l'application Electron" -ForegroundColor Gray
    Write-Host "   b) Noter le Machine ID affiche" -ForegroundColor Gray
    Write-Host "   c) Creer une nouvelle licence dans le dashboard pour ce Machine ID" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Transférer la licence vers ce poste" -ForegroundColor White
    Write-Host "   a) Dans le dashboard, transferer la licence vers le nouveau Machine ID" -ForegroundColor Gray
    Write-Host "   b) L'application Electron s'activera automatiquement" -ForegroundColor Gray
} else {
    Write-Host "OK Le Machine ID correspond!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Si l'application ne s'active pas, verifiez:" -ForegroundColor Yellow
    Write-Host "  1. Les logs de l'application (terminal npm run dev)" -ForegroundColor White
    Write-Host "  2. La connexion Internet" -ForegroundColor White
    Write-Host "  3. Le fichier de licence local (%APPDATA%\gestionnaire-quincaillerie\license-data.json)" -ForegroundColor White
}

Write-Host ""