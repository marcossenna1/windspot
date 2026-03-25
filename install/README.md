# WindSpot — Installation Guide

Run these scripts **in PowerShell as Administrator**, in order.

---

## Step 1 — Install Docker Desktop

```powershell
cd "C:\Users\Senna\marcos projects\WindSpot\install"
.\01_install_docker.ps1
```

- Installs Docker Desktop via `winget` (Windows 11) or downloads the installer directly
- **Restart your computer after this step**
- After restart, open **Docker Desktop** from the Start Menu and wait until the whale icon in the taskbar stops animating

---

## Step 2 — Setup and Launch

```powershell
cd "C:\Users\Senna\marcos projects\WindSpot\install"
.\02_setup_and_run.ps1
```

This script:
1. Checks Docker is running
2. Creates `.env` with a secure JWT secret
3. Builds all 3 Docker images (`docker compose build`)
4. Starts the containers (`docker compose up -d`)
5. Waits and reports when each service is ready

**Expected build time:** 3–5 minutes on first run.

---

## Step 3 — Verify Everything Works

```powershell
cd "C:\Users\Senna\marcos projects\WindSpot\install"
.\03_verify.ps1
```

Runs automated checks on all endpoints and reports pass/fail.

---

## Daily Use (after first install)

```powershell
# Start
docker compose up -d

# Stop
docker compose down

# View logs
docker compose logs -f
```

---

## URLs

| Service    | URL                                    |
|------------|----------------------------------------|
| Dashboard  | http://localhost:3000                  |
| API health | http://localhost:8000/health           |
| Spots list | http://localhost:8000/api/spots        |
| Renderer   | http://localhost:8001/health           |

---

## Troubleshooting

**"Docker Desktop is not running"**
→ Open Docker Desktop from the Start Menu and wait ~30 seconds for it to fully start.

**Build fails on `renderer`**
→ `docker compose logs renderer` — usually a missing native dependency. The Dockerfile installs `vips-dev` for Sharp.

**API container keeps restarting**
→ `docker compose logs api` — check for a missing `JWT_SECRET` in `.env`.

**Port already in use**
→ Something else is on port 3000, 8000, or 8001. Stop it or change the ports in `docker-compose.yml`.
