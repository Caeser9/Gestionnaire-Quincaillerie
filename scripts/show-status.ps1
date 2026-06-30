# Script pour afficher le statut de la licence
# Montre ce qui bloque l'application

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Statut de la Licence" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$licenseFile = "$env:APPDATA\gestionnaire-quincaillerie\license-data.json"
$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"
$machineId = "2b1e147f6d7892677fccbc0186c86eff900cd6a13e0864cfd71185cf4daa5e4f"

# Vérifier le fichier local
Write-Host "[1] Fichier de licence local..." -ForegroundColor Yellow

if (-not (Test-Path $licenseFile)) {
    Write-Host "  ERREUR: Aucun fichier de licence trouve" -ForegroundColor Red
    Write-Host "  Executez: .\scripts\fresh-start.ps1" -ForegroundColor Yellow
    exit 1
}

$licenseContent = Get-Content $licenseFile -Raw | ConvertFrom-Json
Write-Host "  OK Fichier trouve" -ForegroundColor Green
Write-Host "  Client: $($licenseContent.license.payload.clientName)" -ForegroundColor White
Write-Host "  Status: $($licenseContent.license.payload.status)" -ForegroundColor $(if ($licenseContent.license.payload.status -eq "active") { "Green" } else { "Yellow" })
Write-Host ""

# Vérifier le statut sur le serveur
Write-Host "[2] Verification sur le serveur..." -ForegroundColor Yellow

try {
    $publicKeyResponse = Invoke-RestMethod -Uri "$apiUrl/public-key" -Method Get -TimeoutSec 10
    $publicKey = $publicKeyResponse.data.publicKey
    Write-Host "  OK Connexion au serveur" -ForegroundColor Green
} catch {
    Write-Host "  ERREUR: Impossible de se connecter au serveur" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Vérifier s'il y a une demande en attente
if ($licenseContent.license.pendingActivation) {
    Write-Host ""
    Write-Host "  DEMANDE EN ATTENTE DETECTEE!" -ForegroundColor Yellow
    Write-Host "  Request ID: $($licenseContent.license.pendingActivation.requestId)" -ForegroundColor Yellow
    Write-Host ""
    
    # Vérifier le statut de cette demande
    try {
        $statusBody = @{
            requestId = $licenseContent.license.pendingActivation.requestId
            machineId = $machineId
            appVersion = "1.0.0"
        } | ConvertTo-Json
        
        $statusResponse = Invoke-RestMethod -Uri "$apiUrl/activation/status" -Method Post -Body $statusBody -ContentType "application/json" -TimeoutSec 10
        
        Write-Host "  Statut sur le serveur: $($statusResponse.data.status)" -ForegroundColor $(if ($statusResponse.data.status -eq "activated") { "Green" } else { "Yellow" })
        Write-Host ""
        
        if ($statusResponse.data.status -eq "pending") {
            Write-Host "========================================" -ForegroundColor Red
            Write-Host "  ACTION REQUISE" -ForegroundColor Red
            Write-Host "========================================" -ForegroundColor Red
            Write-Host ""
            Write-Host "La demande est EN ATTENTE d'approbation." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "1. Allez sur https://licenceskayapps.duckdns.org" -ForegroundColor White
            Write-Host "2. Login: admin@example.com / Admin123!ChangeMe" -ForegroundColor White
            Write-Host "3. Section 'Activations'" -ForegroundColor White
            Write-Host "4. Approuvez la demande ID: $($licenseContent.license.pendingActivation.requestId)" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "5. Revenez ici et relancez: .\scripts\show-status.ps1" -ForegroundColor White
            Write-Host ""
        }
        elseif ($statusResponse.data.status -eq "activated") {
            Write-Host "  La licence est ACTIVE sur le serveur!" -ForegroundColor Green
            Write-Host "  Mais le fichier local n'est pas a jour." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "  Relancez: .\scripts\fix-signature.ps1" -ForegroundColor White
            Write-Host ""
        }
    } catch {
        Write-Host "  Impossible de verifier le statut" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    }
}
else {
    Write-Host "  Aucune demande en attente" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EXPLICATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "L'application est en BOUCLE car:" -ForegroundColor Yellow
Write-Host "  - Elle a cree une demande d'activation" -ForegroundColor White
Write-Host "  - Elle verifie le statut toutes les 8 secondes" -ForegroundColor White
Write-Host "  - La demande n'est pas encore approuvee" -ForegroundColor White
Write-Host ""
Write-Host "C'est NORMAL - ce n'est pas un bug!" -ForegroundColor Green
Write-Host ""
Write-Host "Pour debloquer:" -ForegroundColor Yellow
Write-Host "  1. Approuvez la demande dans le dashboard" -ForegroundColor White
Write-Host "  2. L'application se debloquera automatiquement" -ForegroundColor White
Write-Host ""