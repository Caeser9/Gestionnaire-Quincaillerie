# Script de debug pour simuler le fetch de l'application Electron
# Teste differentes methodes pour identifier le probleme

$apiUrl = "https://licenceskayapps.duckdns.org/api/v1/client"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Debug - Fetch Electron" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Fetch simple avec PowerShell
Write-Host "[1] Test avec Invoke-RestMethod (PowerShell)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$apiUrl/public-key" -Method Get -TimeoutSec 10
    Write-Host "  OK Succes!" -ForegroundColor Green
    Write-Host "  Success: $($response.success)" -ForegroundColor White
    Write-Host "  Public Key length: $($response.data.publicKey.Length)" -ForegroundColor White
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Fetch avec curl
Write-Host "[2] Test avec curl..." -ForegroundColor Yellow
try {
    $curlOutput = curl -s "$apiUrl/public-key"
    Write-Host "  OK Succes!" -ForegroundColor Green
    Write-Host "  Response: $($curlOutput.Substring(0, [Math]::Min(100, $curlOutput.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Fetch avec WebClient .NET
Write-Host "[3] Test avec .NET WebClient..." -ForegroundColor Yellow
try {
    $webClient = New-Object System.Net.WebClient
    $webClient.Headers.Add("Content-Type", "application/json")
    $result = $webClient.DownloadString("$apiUrl/public-key")
    Write-Host "  OK Succes!" -ForegroundColor Green
    Write-Host "  Response length: $($result.Length)" -ForegroundColor White
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
    Write-Host "  Details: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 4: Fetch avec HttpClient .NET (comme Electron)
Write-Host "[4] Test avec .NET HttpClient (simule Electron)..." -ForegroundColor Yellow
try {
    $httpClient = New-Object System.Net.Http.HttpClient
    $httpClient.BaseAddress = New-Object System.Uri($apiUrl)
    $httpClient.DefaultRequestHeaders.Add("Accept", "application/json")
    
    $response = $httpClient.GetAsync("/public-key").Result
    Write-Host "  Status: $($response.StatusCode)" -ForegroundColor $(if ($response.StatusCode -eq "OK") { "Green" } else { "Red" })
    
    if ($response.IsSuccessStatusCode) {
        $content = $response.Content.ReadAsStringAsync().Result
        Write-Host "  OK Succes!" -ForegroundColor Green
        Write-Host "  Response length: $($content.Length)" -ForegroundColor White
    }
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
    Write-Host "  Details: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 5: Tester l'endpoint /activate
Write-Host "[5] Test de l'endpoint /activate..." -ForegroundColor Yellow
try {
    $body = @{
        productSlug = "hardware-store"
        licenseKey = "TEST-2026-001"
        companyName = "Test"
        contactEmail = "test@test.com"
        machineId = "TEST-MACHINE"
        appVersion = "1.0.0"
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$apiUrl/activate" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 10
    Write-Host "  OK Succes!" -ForegroundColor Green
    Write-Host "  Status: $($response.data.status)" -ForegroundColor Yellow
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
}
Write-Host ""

# Informations de debug
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Informations" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "API URL: $apiUrl" -ForegroundColor White
Write-Host "Public Key endpoint: $apiUrl/public-key" -ForegroundColor White
Write-Host ""
Write-Host "Si les tests PowerShell/curl fonctionnent mais pas l'application Electron:" -ForegroundColor Yellow
Write-Host "  - Probleme de CORS dans le backend" -ForegroundColor Gray
Write-Host "  - Probleme de configuration Electron" -ForegroundColor Gray
Write-Host "  - Probleme de certificat SSL" -ForegroundColor Gray
Write-Host ""
Write-Host "Si les tests ne fonctionnent pas:" -ForegroundColor Red
Write-Host "  - Probleme de reseau" -ForegroundColor Gray
Write-Host "  - Serveur inaccessible" -ForegroundColor Gray
Write-Host "  - Firewall bloque" -ForegroundColor Gray
Write-Host ""