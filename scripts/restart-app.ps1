# Script pour fermer et relancer l'application
# A utiliser apres installation de la licence

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "Redemarrage de l'Application" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Fermer l'application
Write-Host "[1] Fermeture de l'application..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -like "*electron*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 3
Write-Host "  OK Application fermee" -ForegroundColor Green
Write-Host ""

# Vérifier que la licence existe
$licenseFile = "$env:APPDATA\gestionnaire-quincaillerie\license-data.json"
if (Test-Path $licenseFile) {
    Write-Host "[2] Licence trouvee!" -ForegroundColor Green
    $licenseContent = Get-Content $licenseFile -Raw | ConvertFrom-Json
    if ($licenseContent.license.payload) {
        Write-Host "  Client: $($licenseContent.license.payload.clientName)" -ForegroundColor White
        Write-Host "  Status: $($licenseContent.license.payload.status)" -ForegroundColor Green
        Write-Host "  Modules: $($licenseContent.license.payload.authorizedModules -join ', ')" -ForegroundColor White
    }
} else {
    Write-Host "[2] ATTENTION: Aucune licence trouvee!" -ForegroundColor Red
    Write-Host "  Executez d'abord: .\scripts\setup-and-run.ps1" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Lancer l'application
Write-Host "[3] Lancement de l'application..." -ForegroundColor Yellow
Write-Host "  L'application va demarrer dans un nouveau terminal" -ForegroundColor Gray
Write-Host "  Elle devrait detecter la licence et se debloquer" -ForegroundColor Gray
Write-Host ""

Start-Sleep 2

# Lancer dans un nouveau terminal
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Kayce\Documents\Work\Gestionnaire Quincaillerie'; npm run dev"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Application Relancee!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "VERIFICATION:" -ForegroundColor Yellow
Write-Host "  - L'application devrait s'ouvrir" -ForegroundColor White
Write-Host "  - Elle devrait afficher l'interface principale" -ForegroundColor White
Write-Host "  - PLUS de page 'En attente de validation'" -ForegroundColor Green
Write-Host ""
Write-Host "Si elle reste bloquee:" -ForegroundColor Red
Write-Host "  1. Fermez l'application" -ForegroundColor Gray
Write-Host "  2. Relancez ce script: .\scripts\restart-app.ps1" -ForegroundColor Gray
Write-Host ""