# Kitesurf Dashboard — Implementation Plan

> **Status:** Planning phase — no code written yet  
> **Last updated:** March 2026  
> **Stack decision:** Subject to change

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Frontend Architecture](#2-frontend-architecture)
3. [Docker & Server Setup](#3-docker--server-setup)
4. [User Authentication & Data Storage](#4-user-authentication--data-storage)
5. [Weather Data Sources & Parsing](#5-weather-data-sources--parsing)
6. [Real-Time Updates](#6-real-time-updates)
7. [WhatsApp Integration](#7-whatsapp-integration)
8. [Database Design](#8-database-design)
9. [Full Docker Compose](#9-full-docker-compose)
10. [Roadmap & Phases](#10-roadmap--phases)

---

## 1. Project Overview

A kitesurf session planning dashboard that combines Windfinder's ease-of-use with Windguru's forecast depth. The primary question the app answers: **which spot should I go to today, and when?**

### Core Features

- Wind zone colour system across all spot rows (grey ≤12 kn, green 13–19, yellow 20–29, red 30+)
- Desktop two-column layout: live map left, spot list right
- Session window text aligned to the 13–19 kn green zone
- Spot name as camera button (lens icon + name, opens live feed)
- Air temp, water temp, wave height stacked in the 30+ kn column
- Animated compass rose with wind direction particles
- Detail panel: Today / Pro table / 7-day trend
- WhatsApp share with rich preview card
- User authentication, favourites, and profile preferences
- Real-time forecast updates pushed to all open browser sessions

### Spots (initial set)

| Spot | Region | State |
|---|---|---|
| Salvo — Sound | Hatteras, NC | nc |
| Canadian Hole | Hatteras, NC | nc |
| Buxton Kite Pt. | Hatteras, NC | nc |
| Wrightsville Beach | Wilmington, NC | nc |
| Miami Beach St. 25 | Miami, FL | fl |

---

## 2. Frontend Architecture

### File Structure

```
app/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── data.js         ← SPOTS array + constants (B1, B2, B3, SC, SBG, STXT)
│   ├── compass.js      ← compassRingSVG() pure function
│   ├── map.js          ← canvas map, pins, animated wind arrow particles
│   ├── list.js         ← spot list renderer, zone width calculator (computeZoneWidths)
│   ├── detail.js       ← detail panel: Today / Pro / 7-day tabs
│   ├── cam.js          ← camera modal, drawCamFrame()
│   ├── auth.js         ← login/logout, JWT handling, favourites sync
│   ├── realtime.js     ← SSE connection, update handler
│   └── app.js          ← global state, renderAll(), event listeners, resize handler
└── assets/
    └── favicon.ico
```

### Wind Zone System

```
Scale: 0–45 kn maps to 0–100% of row width

B1 = 12/45 * 100 = 26.7%   (grey → green boundary)
B2 = 19/45 * 100 = 42.2%   (green → yellow boundary)
B3 = 29/45 * 100 = 64.4%   (yellow → red boundary)

Zone 0  (0–B1)     ≤ 12 kn   grey    rgba(140,140,140,.22)   spot name / cam button
Zone 1  (B1–B2)   13–19 kn   green   rgba(42,157,92,.22)     region, rain%, tide, session window
Zone 2  (B2–B3)   20–29 kn   yellow  rgba(204,170,0,.28)     compass + wind/gust numbers
Zone 3  (B3–100)  30+ kn     red     rgba(192,57,43,.22)     air temp / water temp / wave height
```

### Session Score Formula

```
Wind in range    40%
No rain          25%
Wind consistency 20%
Wave quality     10%
Tide timing       5%

Go      ≥ 75
Maybe   45–74
No go   < 45
```

---

## 3. Docker & Server Setup

### Dockerfile (static frontend)

```dockerfile
FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY app/ /usr/share/nginx/html/
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### nginx.conf

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|ico|svg)$ {
        expires 1d;
        add_header Cache-Control "public, max-age=86400";
    }

    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    gzip on;
    gzip_types text/css application/javascript image/svg+xml;
}
```

### Development Workflow

```bash
# First run
docker compose up --build

# Daily use
docker compose up -d
docker compose down

# Edit files in app/ → refresh browser (volume mount handles it)

# Production build (files baked into image)
docker compose build
docker run -p 3000:80 kitesurf-dashboard
```

---

## 4. User Authentication & Data Storage

### Authentication Strategy

**Phase 1 (chosen):** Self-hosted JWT auth inside the API service — no external auth provider needed.

**Phase 2 (upgrade path):** Supabase Auth (hosted Postgres + RLS + OAuth) or Keycloak (self-hosted OpenID Connect).

### Why SQLite for Phase 1

| Benefit | Detail |
|---|---|
| Zero infrastructure | No Postgres process, no connection pooling |
| Single file backup | `cp kitesurf.db kitesurf.db.bak` is a complete backup |
| Instant local setup | Works on any machine immediately |
| Portable | Entire app state moves with one file |
| Readable | Open with DB Browser for SQLite |

### SQLite Constraints to Be Aware Of

| Constraint | Impact |
|---|---|
| No Row-Level Security | Must enforce user ownership in every API query manually |
| No LISTEN/NOTIFY | Real-time coordination requires polling (5-sec delay) |
| Single writer | API service cannot scale horizontally |
| File locking | Cannot share the .db file across multiple Docker containers |

### Migration Path

SQLite → Postgres is clean. The schema is identical standard SQL. The API layer owns all queries. Change the database driver and connection string, run a one-time data export/import, and the frontend changes nothing.

---

## 5. Weather Data Sources & Parsing

### Data Sources

| Data Type | Source | Cost | Notes |
|---|---|---|---|
| Wind speed, gusts, direction | Open-Meteo | Free | Marine hourly forecasts |
| Wave height, period | Stormglass | Paid tier | More accurate than modelled |
| Water temperature | Stormglass | Paid tier | — |
| Air temperature | Open-Meteo | Free | — |
| Rain probability | Open-Meteo | Free | Hourly precipitation % |
| Tide times | NOAA CO-OPS API | Free | US only, official predictions |
| Live webcam | Spot-specific URLs | Free | Surfline, BeachCam, custom |

### Data Collection Architecture

```
Browser
  │
  │  GET /api/forecast?spot=salvo
  ▼
API Service (FastAPI)
  │
  ├── check forecast_cache table (SQLite)
  │     └── cache hit (< 15 min old) → return immediately
  │
  └── cache miss → parallel fetch:
        ├── Open-Meteo  → wind, rain, air temp
        ├── Stormglass  → waves, water temp
        └── NOAA CO-OPS → tide times
              │
              ▼
           parse & normalise → unified JSON schema
              │
              ▼
           write to forecast_cache with fetched_at = now()
              │
              ▼
           return to browser
```

### Unified Forecast JSON Schema

```json
{
  "spot_id": 0,
  "updated_at": "2026-03-16T14:00:00Z",
  "current": {
    "wind_kn": 22,
    "gusts_kn": 28,
    "dir_deg": 225,
    "dir_label": "SW",
    "wave_m": 0.6,
    "wave_period_s": 4,
    "air_temp_c": 22,
    "water_temp_c": 18,
    "rain_pct": 8,
    "tide_next": "↑ 14:10"
  },
  "hourly": [
    { "hour": "08", "wind_kn": 14, "gusts_kn": 18, "dir": "SW", "rain_pct": 5 }
  ],
  "daily": [
    { "date": "Mon", "wind_kn": 9, "status": "nogo" }
  ],
  "session_windows": [
    { "start": "10:00", "end": "18:00", "score": 88 }
  ]
}
```

### Data Refresh Schedule

```
Every 15 minutes  → refresh all active spot forecasts
Every 1 hour      → refresh tide predictions
Every 24 hours    → refresh 7-day forecast window
On user login     → force-refresh their favourite spots
```

---

## 6. Real-Time Updates

### Two Types of Live Updates

```
Type 1 — Live wind forecast data
  Weather APIs update every 10–15 minutes.
  Goal: all open browser sessions see updated conditions
  without the user refreshing the page.

Type 2 — Live webcam frames
  Camera streams JPEG frames continuously.
  Goal: the image in the modal updates several times per second.
  → This is a media problem, not a database problem.
     Use MJPEG stream or snapshot polling on the client.
```

### Technique Comparison

| Technique | Latency | Complexity | Works with SQLite | Works with Postgres |
|---|---|---|---|---|
| Polling (client-side timer) | Up to 60 sec | Very simple | ✅ | ✅ |
| Server-Sent Events + DB polling | ~5 sec | Simple | ✅ | ✅ |
| Server-Sent Events + LISTEN/NOTIFY | < 1 sec | Moderate | ❌ | ✅ |
| WebSockets | < 1 sec | Complex | ❌ efficient | ✅ |

### Chosen Approach: SSE + Database Polling (Phase 1, SQLite)

```
Browser opens one long-lived HTTP connection:
  GET /api/stream/salvo
  Accept: text/event-stream

SSE Handler (inside API service):
  Every 5 seconds:
    SELECT payload, fetched_at
    FROM forecast_cache
    WHERE spot_id = ? AND fetched_at > last_sent_at

  If new row found:
    push event down the SSE connection to all listening browsers
    update last_sent_at

  Result: browsers see updated wind data within 5 seconds
  of new forecast data being written to the database.
```

### Upgrade Path: SSE + LISTEN/NOTIFY (Phase 2, Postgres)

```
Forecast Fetcher writes new row to forecast_cache
  → Postgres trigger fires: NOTIFY 'forecast_update', '{"spot":"salvo"}'
  → SSE Handler receives notification in milliseconds
  → Immediately pushes updated data to all connected browsers
  → No polling anywhere in the chain
```

### Database Role in Real-Time

The database is not just storage — it is the **coordination layer** that decouples the data fetcher from the display layer and keeps multiple browser sessions in sync.

```
Phase 1 (SQLite):
  forecast_cache table acts as a shared state store.
  SSE handler polls it every 5 seconds.
  Simple, adequate for wind forecast granularity.

Phase 2 (Postgres):
  LISTEN/NOTIFY turns the database into an event bus.
  Sub-second delivery, no polling, scales to multiple API containers.
```

### Live Webcam Architecture

```
Option A — MJPEG stream (simplest)
  Camera: http://cam.salvo.com/stream.mjpeg
  Browser: <img src="http://cam.salvo.com/stream.mjpeg">
  Native browser support, no server involvement.

Option B — Snapshot polling (for still-only cameras)
  Camera: http://cam.salvo.com/latest.jpg  (updates every 2 sec)
  Browser fetches and swaps <img> src every 2 seconds.

Option C — Proxy (if camera requires auth or has CORS issues)
  Browser → your API → camera
  API fetches frame and passes it through.
```

---

## 7. WhatsApp Integration

### Three Modes

#### Mode A — Enhanced Deep Link (no account needed)

```
Current:   wa.me/?text=plain+text+only

Upgraded:  wa.me/?text=Check+this+forecast+https://app.com/share/salvo
                                              ↑
                              WhatsApp fetches this URL,
                              reads og:image meta tag,
                              renders a rich forecast card preview
```

The share URL resolves to a page with dynamic Open Graph tags:

```html
<meta property="og:title"       content="Salvo — Sound · Go · 88">
<meta property="og:description" content="22/28 kn SW · Air 22°C · Waves 0.6m · Best: 10:00–18:00">
<meta property="og:image"       content="https://app.com/api/og-image/salvo?wind=22&score=88">
<meta property="og:url"         content="https://app.com/share/salvo">
```

#### Mode B — Server-Rendered Forecast Card Image

```
GET /api/og-image/salvo?wind=22&gusts=28&status=go&score=88
  │
  ▼
Image Renderer service (Node + Satori + Sharp)
  ├── Satori renders forecast card → SVG
  ├── Sharp converts SVG → PNG
  └── Returns image/png (cached 15 min)
```

Every WhatsApp share auto-generates a clean forecast card image — no WhatsApp API account needed.

#### Mode C — WhatsApp Business API (push alerts)

For proactive alerts: "Go window opening at Salvo in 2 hours."

```
Provider: Twilio (simplest) or 360dialog (cheaper at scale)

Flow:
  1. User opts in to alerts in profile settings
  2. User provides WhatsApp number
  3. API sends verification message via Twilio
  4. User confirms → stored in user_profiles.whatsapp_number
  5. Scheduler: if forecast crosses Go threshold for a favourite spot
       → send WhatsApp message with forecast card image attached
```

---

## 8. Database Design

### SQLite Schema

```sql
-- Users
CREATE TABLE users (
  id          TEXT PRIMARY KEY,   -- UUID
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- User profile / preferences
CREATE TABLE user_profiles (
  user_id         TEXT PRIMARY KEY REFERENCES users(id),
  display_name    TEXT,
  temp_unit       TEXT DEFAULT 'C',
  wind_unit       TEXT DEFAULT 'kn',
  kite_size_min   INTEGER,
  kite_size_max   INTEGER,
  home_region     TEXT,
  whatsapp_number TEXT,
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- Spots master table (shared)
CREATE TABLE spots (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  short_name  TEXT,
  slug        TEXT UNIQUE,
  region      TEXT,
  state_code  TEXT,
  lat         REAL,
  lon         REAL,
  cam_url     TEXT,
  cam_live    INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Per-user favourites
CREATE TABLE user_favourites (
  user_id   TEXT REFERENCES users(id),
  spot_id   INTEGER REFERENCES spots(id),
  added_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, spot_id)
);

-- Forecast cache (replaces Redis)
CREATE TABLE forecast_cache (
  spot_id     INTEGER REFERENCES spots(id),
  fetched_at  TEXT DEFAULT (datetime('now')),
  expires_at  TEXT,
  payload     TEXT,    -- JSON blob (unified forecast schema)
  PRIMARY KEY (spot_id)
);

-- Kite session log (optional)
CREATE TABLE kite_sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT REFERENCES users(id),
  spot_id    INTEGER REFERENCES spots(id),
  session_at TEXT,
  wind_kn    INTEGER,
  notes      TEXT
);
```

### Key Design Notes

- **forecast_cache** replaces Redis. One row per spot, upserted every 15 minutes.
- **SSE handler** polls `forecast_cache` every 5 seconds on `fetched_at > last_sent_at`.
- **user_id** is TEXT (UUID stored as string) because SQLite has no native UUID type.
- **cam_live** is INTEGER (0/1) because SQLite has no BOOLEAN type.
- **No RLS** — all ownership enforcement must be in API query logic (`WHERE user_id = ?`).

---

## 9. Full Docker Compose

### Phase 1 — SQLite (3 containers)

```yaml
version: "3.9"

services:

  dashboard:
    build: .
    container_name: kitesurf-dashboard
    ports:
      - "3000:80"
    volumes:
      - ./app:/usr/share/nginx/html:ro
    restart: unless-stopped

  api:
    build: ./api
    container_name: kitesurf-api
    ports:
      - "8000:8000"
    volumes:
      - ./data:/data                    # kitesurf.db persisted here
    environment:
      - DB_PATH=/data/kitesurf.db
      - JWT_SECRET=${JWT_SECRET}
      - OPEN_METEO_BASE=https://api.open-meteo.com/v1
      - STORMGLASS_KEY=${STORMGLASS_KEY}
      - NOAA_BASE=https://api.tidesandcurrents.noaa.gov
      - FORECAST_REFRESH_MINS=15
      - SSE_POLL_SECS=5
    restart: unless-stopped

  renderer:
    build: ./renderer                   # Node + Satori + Sharp
    container_name: kitesurf-renderer
    ports:
      - "8001:8001"
    restart: unless-stopped

volumes:
  # no named volumes — SQLite file lives in ./data on host disk
```

### Phase 2 — Postgres + Redis (6 containers)

```yaml
version: "3.9"

services:

  dashboard:
    build: .
    ports: ["3000:80"]
    volumes:
      - ./app:/usr/share/nginx/html:ro

  api:
    build: ./api
    ports: ["8000:8000"]
    environment:
      - DATABASE_URL=postgresql://postgres:pass@postgres:5432/kitesurf
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - OPEN_METEO_BASE=https://api.open-meteo.com/v1
      - STORMGLASS_KEY=${STORMGLASS_KEY}
      - NOAA_BASE=https://api.tidesandcurrents.noaa.gov
    depends_on: [postgres, redis]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: kitesurf
      POSTGRES_PASSWORD: pass
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./api/schema.sql:/docker-entrypoint-initdb.d/schema.sql

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru

  renderer:
    build: ./renderer
    ports: ["8001:8001"]

  keycloak:                             # optional — swap for Supabase hosted
    image: quay.io/keycloak/keycloak:24
    ports: ["8080:8080"]
    environment:
      - KEYCLOAK_ADMIN=admin
      - KEYCLOAK_ADMIN_PASSWORD=${KEYCLOAK_PASS}

volumes:
  pgdata:
```

---

## 10. Roadmap & Phases

### Phase 1 — Local, single user (now)

- [x] Frontend dashboard complete (wind zones, compass, map, detail panel)
- [ ] Extract widget into static file structure
- [ ] Docker + nginx serving app on localhost:3000
- [ ] SQLite schema created and seeded with 5 spots
- [ ] FastAPI service with `/api/forecast` endpoint
- [ ] Open-Meteo integration (wind, rain, air temp)
- [ ] NOAA CO-OPS tide integration
- [ ] SSE endpoint `/api/stream/:spot` with 5-sec DB polling
- [ ] Frontend connects to SSE, updates wind badges live

### Phase 2 — Multi-user (next)

- [ ] JWT auth (signup, login, logout)
- [ ] User profiles table + preferences UI
- [ ] Favourites sync (star a spot, persisted per user)
- [ ] Stormglass integration (waves, water temp)
- [ ] Session score computed server-side
- [ ] OG image renderer for WhatsApp share cards

### Phase 3 — Production ready

- [ ] Migrate SQLite → Postgres
- [ ] Replace SSE polling with LISTEN/NOTIFY
- [ ] Add Keycloak or Supabase Auth
- [ ] WhatsApp Business API push alerts (Twilio)
- [ ] HTTPS via Let's Encrypt (Certbot sidecar)
- [ ] Add more spots (expandable via admin UI or spots table)
- [ ] Mobile PWA (add to home screen, offline cached last forecast)

---

## Decision Log

| Decision | Chosen | Rationale | Revisit when |
|---|---|---|---|
| Database | SQLite | Zero infra, single file, adequate for personal use | >20 concurrent users or need RLS |
| Auth | Self-hosted JWT | No external dependency | Want OAuth / social login |
| Real-time | SSE + DB polling | Simple, works with SQLite | Need sub-second updates |
| Caching | SQLite forecast_cache | Replaces Redis, simpler | High read load, multiple API containers |
| Weather API | Open-Meteo (free) | No cost, good accuracy | Need more precise marine data |
| WhatsApp | Deep link + OG image | No Business API account needed | Need push alerts |
| Frontend framework | Vanilla JS | No build toolchain, fast, already working | Need TypeScript or component framework |

---

*Plan authored during design session — Claude Sonnet 4.6*
