# ============================================================
# WindSpot — Step 2: Setup .env and start containers
# Run this script in PowerShell as Administrator
# ============================================================

Write-Host ""
Write-Host "=== WindSpot Setup & Launch ===" -ForegroundColor Cyan
Write-Host ""

# --- Move to project root ---
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
Write-Host "Working directory: $projectRoot" -ForegroundColor Gray

# --- Check Docker is running ---
Write-Host ""
Write-Host "[1/5] Checking Docker..." -ForegroundColor Cyan
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Docker not found. Run 01_install_docker.ps1 first." -ForegroundColor Red
    exit 1
}
$dockerRunning = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker Desktop is not running. Please open Docker Desktop and wait for it to start, then re-run this script." -ForegroundColor Red
    exit 1
}
Write-Host "Docker is running." -ForegroundColor Green

# --- Create .env if missing ---
Write-Host ""
Write-Host "[2/5] Setting up .env file..." -ForegroundColor Cyan
if (Test-Path ".env") {
    $existingSecret = (Get-Content .env | Where-Object { $_ -match "^JWT_SECRET=.+" })
    if ($existingSecret) {
        Write-Host ".env already configured. Skipping." -ForegroundColor Green
    } else {
        Write-Host ".env exists but JWT_SECRET is empty. Regenerating secret..." -ForegroundColor Yellow
        $secret = -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
        "JWT_SECRET=$secret"         | Out-File -FilePath .env -Encoding utf8
        ""                           | Add-Content .env
        "STORMGLASS_KEY="            | Add-Content .env
        "FORECAST_REFRESH_MINS=15"   | Add-Content .env
        "SSE_POLL_SECS=5"            | Add-Content .env
        Write-Host "JWT_SECRET generated." -ForegroundColor Green
    }
} else {
    Write-Host ".env not found. Creating from template..." -ForegroundColor Yellow
    $secret = -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
    "JWT_SECRET=$secret"         | Out-File -FilePath .env -Encoding utf8
    ""                           | Add-Content .env
    "STORMGLASS_KEY="            | Add-Content .env
    "FORECAST_REFRESH_MINS=15"   | Add-Content .env
    "SSE_POLL_SECS=5"            | Add-Content .env
    Write-Host "JWT_SECRET generated." -ForegroundColor Green
}

# --- Build images ---
Write-Host ""
Write-Host "[3/5] Building Docker images (this may take 3-5 minutes)..." -ForegroundColor Cyan
docker compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed. Check the output above for details." -ForegroundColor Red
    exit 1
}
Write-Host "Build complete." -ForegroundColor Green

# --- Start containers ---
Write-Host ""
Write-Host "[4/5] Starting containers..." -ForegroundColor Cyan
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start containers." -ForegroundColor Red
    exit 1
}

# --- Wait for health checks ---
Write-Host ""
Write-Host "[5/5] Waiting for services to be ready (up to 30 seconds)..." -ForegroundColor Cyan
$maxWait = 30
$elapsed = 0
$allReady = $false
while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds 3
    $elapsed += 3

    $apiOk  = $false
    $rendOk = $false
    $webOk  = $false

    try { $r = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; $apiOk  = $r.StatusCode -eq 200 } catch {}
    try { $r = Invoke-WebRequest -Uri "http://localhost:8001/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; $rendOk = $r.StatusCode -eq 200 } catch {}
    try { $r = Invoke-WebRequest -Uri "http://localhost:3000"        -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; $webOk  = $r.StatusCode -eq 200 } catch {}

    $apiStatus  = if ($apiOk)  { "OK" } else { "waiting..." }
    $rendStatus = if ($rendOk) { "OK" } else { "waiting..." }
    $webStatus  = if ($webOk)  { "OK" } else { "waiting..." }

    Write-Host "  API :8000 $apiStatus  |  Renderer :8001 $rendStatus  |  Dashboard :3000 $webStatus" -ForegroundColor Gray

    if ($apiOk -and $rendOk -and $webOk) { $allReady = $true; break }
}

Write-Host ""
if ($allReady) {
    Write-Host "=== All services are running! ===" -ForegroundColor Green
} else {
    Write-Host "=== Some services are still starting. Check logs: ===" -ForegroundColor Yellow
    Write-Host "  docker compose logs api" -ForegroundColor White
    Write-Host "  docker compose logs renderer" -ForegroundColor White
}

Write-Host ""
Write-Host "URLs:" -ForegroundColor Cyan
Write-Host "  Dashboard  ->  http://localhost:3000" -ForegroundColor White
Write-Host "  API        ->  http://localhost:8000/health" -ForegroundColor White
Write-Host "  Spots      ->  http://localhost:8000/api/spots" -ForegroundColor White
Write-Host "  Renderer   ->  http://localhost:8001/health" -ForegroundColor White
Write-Host ""
Write-Host "To stop:   docker compose down" -ForegroundColor Gray
Write-Host "To start:  docker compose up -d" -ForegroundColor Gray
Write-Host ""
