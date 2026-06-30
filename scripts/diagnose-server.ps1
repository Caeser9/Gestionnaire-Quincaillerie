# Script de diagnostic du serveur de licences
# Vérifie la connectivité et résout les problèmes

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Diagnostic du Serveur de Licences" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"

Write-Host "[1] Test de résolution DNS..." -ForegroundColor Yellow
try {
    $dns = Resolve-DnsName licenceskayapps.duckdns.org -Type A -ErrorAction Stop
    Write-Host "  OK DNS résolu" -ForegroundColor Green
    Write-Host "  Adresse: $($dns.IPAddress)" -ForegroundColor White
} catch {
    Write-Host "  ERREUR: Impossible de résoudre le DNS" -ForegroundColor Red
    Write-Host "  Le serveur n'est pas accessible" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Solutions possibles:" -ForegroundColor Yellow
    Write-Host "  1. Vérifiez votre connexion Internet" -ForegroundColor White
    Write-Host "  2. Le serveur DuckDNS peut être éteint" -ForegroundColor White
    Write-Host "  3. Le domaine a expiré" -ForegroundColor White
    Write-Host ""
    exit 1
}
Write-Host ""

Write-Host "[2] Test de connectivité HTTPS..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $apiUrl -Method Head -TimeoutSec 5 -UseBasicParsing
    Write-Host "  OK Serveur accessible" -ForegroundColor Green
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor White
} catch {
    Write-Host "  ERREUR: Impossible de se connecter au serveur" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Le serveur peut être:" -ForegroundColor Yellow
    Write-Host "  - En maintenance" -ForegroundColor White
    Write-Host "  - Éteint" -ForegroundColor White
    Write-Host "  - Bloqué par un firewall" -ForegroundColor White
    Write-Host ""
    exit 1
}
Write-Host ""

Write-Host "[3] Test de l'API publique..." -ForegroundColor Yellow
try {
    $publicKeyResponse = Invoke-RestMethod -Uri "$apiUrl/public-key" -Method Get -TimeoutSec 10
    Write-Host "  OK API fonctionnelle" -ForegroundColor Green
    Write-Host "  Clé publique reçue: $($publicKeyResponse.data.publicKey.Length) caractères" -ForegroundColor White
} catch {
    Write-Host "  ERREUR: L'API ne répond pas" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  DIAGNOSTIC TERMINÉ" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Le serveur de licences est OPÉRATIONNEL." -ForegroundColor Green
Write-Host ""
Write-Host "Si vous avez eu des erreurs précédentes (429, etc.):" -ForegroundColor Yellow
Write-Host "  - Attendez 5-10 minutes" -ForegroundColor White
Write-Host "  - Puis relancez: .\scripts\fresh-start.ps1" -ForegroundColor Gray
Write-Host ""