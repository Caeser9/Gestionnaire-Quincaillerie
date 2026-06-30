# Script qui attend que le rate limit se réinitialise puis réessaye
# À utiliser après une erreur 429

param(
    [int]$WaitMinutes = 5
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  Attente et Nouvelle Tentative" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

Write-Host "Le serveur a bloque les requetes (erreur 429)" -ForegroundColor Red
Write-Host "Attente de $WaitMinutes minutes pour que le rate limit se reinitialise..." -ForegroundColor Yellow
Write-Host ""

$waitSeconds = $WaitMinutes * 60
$startTime = Get-Date

while ($true) {
    $elapsed = (Get-Date) - $startTime
    $remaining = $waitSeconds - $elapsed.TotalSeconds
    
    if ($remaining -le 0) {
        Write-Host "  OK Attente terminee!" -ForegroundColor Green
        break
    }
    
    $minutes = [math]::Floor($remaining / 60)
    $seconds = [math]::Floor($remaining % 60)
    Write-Host "  Temps restant: $minutes min $seconds sec" -ForegroundColor Gray
    
    Start-Sleep 1
}

Write-Host ""
Write-Host "Relancement de l'application..." -ForegroundColor Yellow
Write-Host ""

# Fermer l'application
Get-Process | Where-Object { $_.ProcessName -like "*electron*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 2

# Lancer l'application
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Kayce\Documents\Work\Gestionnaire Quincaillerie'; npm run dev"

Write-Host ""
Write-Host "Application lancee!" -ForegroundColor Green
Write-Host ""
Write-Host "NOTE: L'application va maintenant verifier moins frequemment" -ForegroundColor Yellow
Write-Host "      pour eviter le rate limit." -ForegroundColor Gray
Write-Host ""