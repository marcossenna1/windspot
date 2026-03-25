# WindSpot - Service Verification
# Run after 02_setup_and_run.ps1 completes

Write-Host ""
Write-Host "=== WindSpot Service Verification ===" -ForegroundColor Cyan
Write-Host ""

$pass = 0
$fail = 0

function Test-Endpoint {
    param($label, $url, $expectContent)
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($expectContent -and ($r.Content -notmatch $expectContent)) {
            Write-Host "  FAIL  $label" -ForegroundColor Red
            $script:fail++
        } else {
            Write-Host "  PASS  $label" -ForegroundColor Green
            $script:pass++
        }
    } catch {
        Write-Host "  FAIL  $label - $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
    }
}

# Container status
Write-Host "[Containers]" -ForegroundColor Cyan
docker compose ps
Write-Host ""

# Health checks
Write-Host "[Health Checks]" -ForegroundColor Cyan
Test-Endpoint "API health"        "http://localhost:8000/health"  "ok"
Test-Endpoint "Renderer health"   "http://localhost:8001/health"  "ok"
Test-Endpoint "Dashboard nginx"   "http://localhost:3000/"        "WindSpot"

# Data
Write-Host ""
Write-Host "[Data]" -ForegroundColor Cyan
Test-Endpoint "Spots list"        "http://localhost:8000/api/spots"              "salvo"
Test-Endpoint "Forecast salvo"    "http://localhost:8000/api/forecast?spot=salvo"  "wind_kn"
Test-Endpoint "Forecast miami25"  "http://localhost:8000/api/forecast?spot=miami25" "wind_kn"

# OG image
Write-Host ""
Write-Host "[Renderer]" -ForegroundColor Cyan
try {
    $imgUrl = "http://localhost:8001/og-image/Salvo?wind=22" + "&gusts=28" + "&score=88" + "&dir=SW"
    $img = Invoke-WebRequest -Uri $imgUrl -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    $ct = $img.Headers["Content-Type"]
    if ($ct -match "image/png") {
        Write-Host "  PASS  OG image render - PNG $($img.RawContentLength) bytes" -ForegroundColor Green
        $pass++
    } else {
        Write-Host "  FAIL  OG image - wrong content type: $ct" -ForegroundColor Red
        $fail++
    }
} catch {
    Write-Host "  FAIL  OG image render - $($_.Exception.Message)" -ForegroundColor Red
    $fail++
}

# Auth
Write-Host ""
Write-Host "[Auth]" -ForegroundColor Cyan
$testEmail = "verify_$(Get-Random)@test.com"
$body = '{"email":"' + $testEmail + '","password":"Test1234"}'
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8000/api/auth/signup" `
        -Method POST -Body $body -ContentType "application/json" `
        -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($r.Content -match "token") {
        Write-Host "  PASS  Signup and JWT returned" -ForegroundColor Green
        $pass++
    } else {
        Write-Host "  FAIL  Signup - no token in response" -ForegroundColor Red
        $fail++
    }
} catch {
    Write-Host "  FAIL  Signup - $($_.Exception.Message)" -ForegroundColor Red
    $fail++
}

# Summary
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
if ($fail -eq 0) {
    Write-Host "  Results: $pass passed, $fail failed" -ForegroundColor Green
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "All checks passed!" -ForegroundColor Green
    Write-Host "Open http://localhost:3000 in your browser." -ForegroundColor White
} else {
    Write-Host "  Results: $pass passed, $fail failed" -ForegroundColor Yellow
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Some checks failed. Run: docker compose logs" -ForegroundColor Yellow
}
Write-Host ""
