# Script pour reinitialiser la licence et forcer le rechargement
# A utiliser quand l'application reste bloquee en attente

param(
    [switch]$CloseApp = $false
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "Reset et Rechargement de la Licence" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Chemin du fichier de licence
$licenseFile = "$env:APPDATA\gestionnaire-quincaillerie\license-data.json"

Write-Host "[1] Suppression du fichier de licence local..." -ForegroundColor Yellow

if (Test-Path $licenseFile) {
    try {
        Remove-Item $licenseFile -Force
        Write-Host "  OK Fichier supprime: $licenseFile" -ForegroundColor Green
    } catch {
        Write-Host "  ERREUR: Impossible de supprimer le fichier" -ForegroundColor Red
        Write-Host "  $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "  Essayez de fermer l'application Electron d'abord" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Aucun fichier de licence trouve (deja propre)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "[2] Informations de re-activation..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  L'application Electron va maintenant:" -ForegroundColor White
Write-Host "    1. Demander une nouvelle activation" -ForegroundColor Gray
Write-Host "    2. Communiquer avec le serveur" -ForegroundColor Gray
Write-Host "    3. Recuperer la licence approuvee" -ForegroundColor Gray
Write-Host "    4. Se debloquer automatiquement" -ForegroundColor Gray
Write-Host ""

Write-Host "[3] Instructions..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Si l'application est toujours ouverte:" -ForegroundColor White
Write-Host "    1. Fermez l'application Electron" -ForegroundColor Gray
Write-Host "    2. Relancez: npm run dev" -ForegroundColor Gray
Write-Host "    3. Remplissez le formulaire d'activation" -ForegroundColor Gray
Write-Host "    4. Cliquez sur 'Activer le logiciel'" -ForegroundColor Gray
Write-Host ""
Write-Host "  La licence va etre recuperee automatiquement car:" -ForegroundColor Cyan
Write-Host "    - Le Machine ID est deja approuve" -ForegroundColor Gray
Write-Host "    - Le serveur a la licence en memoire" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "Reset termine!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Prochaine etape:" -ForegroundColor Yellow
Write-Host "  1. Fermer l'application Electron si elle est ouverte" -ForegroundColor White
Write-Host "  2. La relancer avec: npm run dev" -ForegroundColor White
Write-Host "  3. L'application va se reactiver automatiquement" -ForegroundColor White
Write-Host ""

# Verifier si l'application Electron est en cours d'execution
Write-Host "[4] Verification des processus Electron..." -ForegroundColor Yellow

$electronProcesses = Get-Process | Where-Object { $_.ProcessName -like "*electron*" -or $_.ProcessName -like "*gestionnaire*" }

if ($electronProcesses) {
    Write-Host "  ATTENTION: Processus Electron detectes:" -ForegroundColor Yellow
    $electronProcesses | ForEach-Object {
        Write-Host "    - $($_.ProcessName) (PID: $($_.Id))" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "  Fermez ces processus avant de relancer l'application" -ForegroundColor Yellow
} else {
    Write-Host "  Aucun processus Electron detecte" -ForegroundColor Green
}

Write-Host ""