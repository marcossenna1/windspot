@echo off
cd /d "%~dp0"
echo.
echo  Deploying WindSpot...
echo.
docker compose build dashboard api renderer
docker compose up -d dashboard api renderer
echo.
echo  Done. App running at http://localhost:3000
echo.
