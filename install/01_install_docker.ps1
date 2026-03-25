# ============================================================
# WindSpot — Step 1: Install Docker Desktop
# Run this script in PowerShell as Administrator
# ============================================================

Write-Host ""
Write-Host "=== WindSpot Docker Installation ===" -ForegroundColor Cyan
Write-Host ""

# --- Check if already installed ---
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $v = docker --version
    Write-Host "Docker already installed: $v" -ForegroundColor Green
    Write-Host "You can skip this script and run 02_setup_and_run.ps1" -ForegroundColor Yellow
    exit 0
}

Write-Host "Docker not found. Installing Docker Desktop..." -ForegroundColor Yellow
Write-Host ""

# --- Try winget first (available on Windows 11) ---
if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host "Using winget to install Docker Desktop..." -ForegroundColor Cyan
    winget install --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
} else {
    # --- Fallback: download installer manually ---
    Write-Host "winget not found. Downloading Docker Desktop installer..." -ForegroundColor Cyan
    $installerUrl = "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
    $installerPath = "$env:TEMP\DockerDesktopInstaller.exe"

    Write-Host "Downloading to $installerPath ..."
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing

    Write-Host "Running installer (this will take a few minutes)..."
    Start-Process -FilePath $installerPath -ArgumentList "install --quiet" -Wait
}

Write-Host ""
Write-Host "=== Installation complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Restart your computer now, then:" -ForegroundColor Yellow
Write-Host "  1. Open Docker Desktop and wait for it to finish starting" -ForegroundColor White
Write-Host "  2. Run 02_setup_and_run.ps1 as Administrator" -ForegroundColor White
Write-Host ""
