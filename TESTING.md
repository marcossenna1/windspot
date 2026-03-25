# WindSpot — Test Procedures

Run these in order. Each step has a **Goal**, the **Command**, and the **Pass criterion**.

---

## Prerequisites

```bash
# From the project root
cp .env.example .env
# Edit .env and set JWT_SECRET to any 32+ char random string, e.g.:
# JWT_SECRET=$(openssl rand -hex 32)
```

---

## Step 1 — Docker Build

**Goal:** All three images build without errors.

```bash
docker compose build --no-cache
```

**Pass:** All three services print `=> exporting to image` with no error lines.
**Fail signal:** Red `ERROR` lines. Check the failing service's Dockerfile or requirements.

---

## Step 2 — Containers Start

**Goal:** All three containers reach a running state.

```bash
docker compose up -d
docker compose ps
```

**Pass:** `kitesurf-dashboard`, `kitesurf-api`, `kitesurf-renderer` all show `running` (not `restarting`).

**Watch logs if something fails:**
```bash
docker compose logs api      # FastAPI startup
docker compose logs renderer # Node startup
docker compose logs dashboard
```

---

## Step 3 — API Health Check

**Goal:** FastAPI is up and the DB path is reported.

```bash
curl -s http://localhost:8000/health | python -m json.tool
```

**Pass:**
```json
{
  "status": "ok",
  "db": "/data/kitesurf.db"
}
```

---

## Step 4 — SQLite Database Created & Seeded

**Goal:** The schema was applied and 5 spots were inserted on startup.

```bash
curl -s http://localhost:8000/api/spots | python -m json.tool
```

**Pass:** JSON array with 5 objects — slugs `salvo`, `canadian`, `buxton`, `wrightsville`, `miami25`.

**Direct DB check (optional):**
```bash
docker exec kitesurf-api sqlite3 /data/kitesurf.db "SELECT slug, name FROM spots;"
```

---

## Step 5 — Forecast Endpoint (cache miss → live fetch)

**Goal:** The API calls Open-Meteo and returns a populated forecast JSON.

```bash
curl -s "http://localhost:8000/api/forecast?spot=salvo" | python -m json.tool
```

**Pass:** Response contains `spot_id`, `current` object with numeric `wind_kn` and `gusts_kn`, and an `hourly` array.

**Timing note:** First call fetches from Open-Meteo (1–3 sec). Subsequent calls within 15 min hit the cache (<100 ms).

---

## Step 6 — Forecast Cache (cache hit)

**Goal:** Second request is served instantly from SQLite.

```bash
time curl -s "http://localhost:8000/api/forecast?spot=salvo" > /dev/null
```

**Pass:** Wall time < 200 ms (vs 1–3 s for first call).

**Direct cache check:**
```bash
docker exec kitesurf-api sqlite3 /data/kitesurf.db \
  "SELECT spot_id, fetched_at, length(payload) as bytes FROM forecast_cache;"
```
**Pass:** 5 rows, each with a recent `fetched_at` timestamp and `bytes > 100`.

---

## Step 7 — SSE Stream

**Goal:** The SSE endpoint opens a persistent connection and emits `forecast` events.

```bash
curl -N --no-buffer http://localhost:8000/api/stream/salvo
```

**Pass:** Within 10 seconds you see:
```
event: forecast
data: {"spot_id": 1, "updated_at": "...", "current": {...}}
```
Press `Ctrl+C` to end.

**Test with a second spot in parallel:**
```bash
curl -N --no-buffer http://localhost:8000/api/stream/miami25 &
sleep 12
kill %1
```

---

## Step 8 — Auth: Signup

**Goal:** A new user account is created and a JWT is returned.

```bash
curl -s -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Secret123"}' \
  | python -m json.tool
```

**Pass:**
```json
{
  "token": "<jwt-string>",
  "user_id": "<uuid>"
}
```

**Duplicate email check:**
```bash
# Run same command again
curl -s -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Secret123"}'
```
**Pass:** `{"detail": "Email already registered"}` with HTTP 400.

---

## Step 9 — Auth: Login

**Goal:** Existing credentials return a valid JWT; wrong credentials are rejected.

```bash
# Correct credentials
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Secret123"}' \
  | python -m json.tool
```
**Pass:** `{"token": "...", "user_id": "..."}`

```bash
# Wrong password
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpass"}'
```
**Pass:** HTTP 401 `{"detail": "Invalid credentials"}`

---

## Step 10 — Favourites (authenticated)

**Goal:** A logged-in user can add and retrieve favourite spots.

```bash
# 1. Login and capture token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Secret123"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 2. Add spot 1 (Salvo) as favourite
curl -s -X POST http://localhost:8000/api/favourites/1 \
  -H "Authorization: Bearer $TOKEN"

# 3. List favourites
curl -s http://localhost:8000/api/favourites \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

**Pass:** Step 3 returns an array containing the Salvo spot object.

```bash
# 4. Remove favourite
curl -s -X DELETE http://localhost:8000/api/favourites/1 \
  -H "Authorization: Bearer $TOKEN"

# 5. Confirm empty
curl -s http://localhost:8000/api/favourites \
  -H "Authorization: Bearer $TOKEN"
```
**Pass:** Step 5 returns `[]`.

**Unauthenticated attempt:**
```bash
curl -s http://localhost:8000/api/favourites
```
**Pass:** HTTP 403 or 401.

---

## Step 11 — Renderer Health Check

**Goal:** The Node OG-image renderer is up.

```bash
curl -s http://localhost:8001/health | python -m json.tool
```

**Pass:**
```json
{ "status": "ok" }
```

---

## Step 12 — OG Image Rendering

**Goal:** The renderer returns a valid PNG for a forecast card.

```bash
curl -s "http://localhost:8001/og-image/Salvo?wind=22&gusts=28&dir=SW&score=88" \
  --output /tmp/test-card.png

file /tmp/test-card.png
```

**Pass:** `test-card.png: PNG image data, 1200 x 630`

**Open the image** (macOS: `open /tmp/test-card.png`, Linux: `xdg-open /tmp/test-card.png`, Windows: `start /tmp/test-card.png`).

**Status colour test:**
```bash
# go = green
curl -s "http://localhost:8001/og-image/Salvo?wind=15&score=88" -o /tmp/go.png
# maybe = yellow
curl -s "http://localhost:8001/og-image/Canadian+Hole?wind=25&score=60" -o /tmp/maybe.png
# nogo = red
curl -s "http://localhost:8001/og-image/Buxton?wind=35&score=30" -o /tmp/nogo.png
```

---

## Step 13 — Dashboard (nginx frontend)

**Goal:** The static app is served correctly.

```bash
curl -sI http://localhost:3000/
```

**Pass:** HTTP 200, `Content-Type: text/html`

```bash
# Cache headers for static assets
curl -sI http://localhost:3000/css/styles.css | grep -i cache-control
```
**Pass:** `Cache-Control: public, max-age=86400`

```bash
# No-cache on index.html
curl -sI http://localhost:3000/index.html | grep -i cache-control
```
**Pass:** `Cache-Control: no-cache, no-store, must-revalidate`

**Browser test:** Open `http://localhost:3000` — you should see the WindSpot header and spot rows (initially showing `—` while SSE connects, then live wind values within ~10 seconds).

---

## Step 14 — Volume Persistence

**Goal:** Restarting the API container does not lose the database.

```bash
# Note current forecast cache
docker exec kitesurf-api sqlite3 /data/kitesurf.db \
  "SELECT spot_id, fetched_at FROM forecast_cache LIMIT 1;"

# Restart the container
docker compose restart api
sleep 15

# Confirm data still present
docker exec kitesurf-api sqlite3 /data/kitesurf.db \
  "SELECT spot_id, fetched_at FROM forecast_cache LIMIT 1;"
```

**Pass:** Same row is present after restart (same `fetched_at` timestamp, or a newer one if the refresh ran).

---

## Step 15 — Full Stack Teardown & Restart

**Goal:** `docker compose down` + `up` cycle works cleanly.

```bash
docker compose down
docker compose up -d
sleep 20
curl -s http://localhost:8000/health
curl -s http://localhost:3000/ | head -5
```

**Pass:** Both return 200 responses.

---

## Quick-reference: all checks in one shot

```bash
echo "=== API health ===" && curl -s http://localhost:8000/health
echo ""
echo "=== Spots ===" && curl -s http://localhost:8000/api/spots | python -c "import sys,json; [print(s['slug']) for s in json.load(sys.stdin)]"
echo ""
echo "=== Forecast (salvo) ===" && curl -s "http://localhost:8000/api/forecast?spot=salvo" | python -c "import sys,json; d=json.load(sys.stdin); print('wind:', d['current']['wind_kn'], 'kn')"
echo ""
echo "=== Renderer ===" && curl -s http://localhost:8001/health
echo ""
echo "=== Dashboard ===" && curl -sI http://localhost:3000/ | head -1
```
