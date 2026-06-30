# Script qui verifie automatiquement l'approbation et installe la licence
# A executer pendant que l'application est en mode attente

param(
    [string]$RequestId = "6a43a667307fe0cda32fa00c",
    [int]$CheckInterval = 5
)

$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"
$machineId = "2b1e147f6d7892677fccbc0186c86eff900cd6a13e0864cfd71185cf4daa5e4f"
$licenseFile = "$env:APPDATA\gestionnaire-quincaillerie\license-data.json"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Automatique d'Approbation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Request ID: $RequestId" -ForegroundColor Yellow
Write-Host "Machine ID: $machineId" -ForegroundColor Gray
Write-Host ""
Write-Host "Verification toutes les $CheckInterval secondes..." -ForegroundColor Gray
Write-Host "Appuyez sur Ctrl+C pour arreter" -ForegroundColor Gray
Write-Host ""

while ($true) {
    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] Verification du statut..." -ForegroundColor Yellow
    
    try {
        $statusBody = @{
            requestId = $RequestId
            machineId = $machineId
            appVersion = "1.0.0"
        } | ConvertTo-Json
        
        $statusResponse = Invoke-RestMethod -Uri "$apiUrl/activation/status" -Method Post -Body $statusBody -ContentType "application/json" -TimeoutSec 10
        
        Write-Host "  Status: $($statusResponse.data.status)" -ForegroundColor $(if ($statusResponse.data.status -eq "activated") { "Green" } elseif ($statusResponse.data.status -eq "pending") { "Yellow" } else { "Red" })
        
        if ($statusResponse.data.status -eq "activated") {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "LICENCE APPROUVEE!" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            
            # Récupérer la clé publique
            $publicKeyResponse = Invoke-RestMethod -Uri "$apiUrl/public-key" -Method Get -TimeoutSec 10
            $publicKey = $publicKeyResponse.data.publicKey
            
            # Extraire les données
            $licenseData = $statusResponse.data
            $payload = $licenseData.payload
            $signature = $licenseData.signature
            $licenseToken = $licenseData.licenseToken
            
            Write-Host "Installation de la licence..." -ForegroundColor Yellow
            
            # Créer le dossier si nécessaire
            $licenseDir = Split-Path $licenseFile -Parent
            if (-not (Test-Path $licenseDir)) {
                New-Item -Path $licenseDir -ItemType Directory -Force | Out-Null
            }
            
            # Créer le contenu JSON
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
            Write-Host ""
            Write-Host "Details:" -ForegroundColor Cyan
            Write-Host "  Client: $($payload.clientName)" -ForegroundColor White
            Write-Host "  Produit: $($payload.productSlug)" -ForegroundColor White
            Write-Host "  Type: $($payload.licenseType)" -ForegroundColor White
            Write-Host "  Modules: $($payload.authorizedModules -join ', ')" -ForegroundColor White
            Write-Host ""
            
            Write-Host "========================================" -ForegroundColor Green
            Write-Host "PROCHAINE ETAPE" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Green
            Write-Host ""
            Write-Host "1. L'application va detecter la licence automatiquement" -ForegroundColor White
            Write-Host "2. Elle va se debloquer dans quelques secondes" -ForegroundColor White
            Write-Host "3. Vous pourrez utiliser le logiciel!" -ForegroundColor White
            Write-Host ""
            Write-Host "Si l'application ne se debloque pas:" -ForegroundColor Yellow
            Write-Host "  1. Fermez l'application" -ForegroundColor Gray
            Write-Host "  2. Relancez-la: npm run dev" -ForegroundColor Gray
            Write-Host ""
            
            break
        }
        elseif ($statusResponse.data.status -eq "rejected") {
            Write-Host "  ERREUR: Demande rejetee!" -ForegroundColor Red
            Write-Host "  Raison: $($statusResponse.data.reason)" -ForegroundColor Red
            Write-Host ""
            Write-Host "Vous devez creer une nouvelle demande" -ForegroundColor Yellow
            break
        }
        
    }
    catch {
        Write-Host "  ERREUR: $_" -ForegroundColor Red
    }
    
    Write-Host "  Nouvelle verification dans $CheckInterval secondes..." -ForegroundColor Gray
    Start-Sleep $CheckInterval
}

Write-Host ""