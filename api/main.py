"""
Kitesurf Dashboard — FastAPI backend (Phase 1, SQLite)
"""
import asyncio
import json
import os
import re
import sqlite3
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import AsyncGenerator

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DB_PATH = Path(os.environ.get("DB_PATH", "/data/kitesurf.db"))
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24
OPEN_METEO_BASE = os.environ.get("OPEN_METEO_BASE", "https://api.open-meteo.com/v1")
NOAA_BASE = os.environ.get("NOAA_BASE", "https://api.tidesandcurrents.noaa.gov")
STORMGLASS_KEY = os.environ.get("STORMGLASS_KEY", "")
FORECAST_REFRESH_MINS = int(os.environ.get("FORECAST_REFRESH_MINS", "15"))
SSE_POLL_SECS = int(os.environ.get("SSE_POLL_SECS", "5"))

SCHEMA_FILE = Path(__file__).parent / "schema.sql"
WIKIMEDIA_BASE = "https://commons.wikimedia.org/w/api.php"

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_db() -> sqlite3.Connection:
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    return db


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db() as db:
        db.executescript(SCHEMA_FILE.read_text())
        # Migration: add depth_m column to existing databases
        try:
            db.execute("ALTER TABLE spots ADD COLUMN depth_m REAL")
        except Exception:
            pass  # column already exists


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)


def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


def create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    return jwt.encode({"sub": user_id, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> str:
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise JWTError("missing sub")
    return user_id


def current_user_id(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        return decode_token(creds.credentials)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")


# ---------------------------------------------------------------------------
# Forecast fetcher
# ---------------------------------------------------------------------------

def _dir_label(deg: float) -> str:
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return dirs[round(deg / 45) % 8]


# NOAA CO-OPS station closest to each spot (for water temperature)
NOAA_WATER_STATIONS: dict[str, str] = {
    # North Carolina — Hatteras / OBX
    "salvo":            "8655875",  # Oregon Inlet, NC
    "canadian":         "8655875",  # Oregon Inlet, NC
    "buxton":           "8654467",  # Hatteras Inlet, NC
    "waves-soundside":  "8655875",  # Oregon Inlet, NC
    "kite-point":       "8654467",  # Hatteras Inlet, NC
    # North Carolina — other
    "jockeys-ridge":    "8651370",  # Duck, NC
    "wrightsville":     "8658163",  # Wrightsville Beach, NC
    # South Carolina
    "sullivans-island": "8665530",  # Charleston, SC
    "isle-of-palms":    "8665530",  # Charleston, SC
    "folly-beach":      "8665530",  # Charleston, SC
    "hilton-head":      "8670870",  # Fort Pulaski, GA (nearest active)
    # Florida
    "miami25":          "8723214",  # Virginia Key, FL
    "crandon-park":     "8723214",  # Virginia Key, FL
    "carlin-park":      "8722670",  # Lake Worth, FL
    "slick-520":        "8721604",  # Canaveral Bight, FL
    "skyway-beach":     "8726520",  # St. Petersburg, FL
}


async def fetch_open_meteo(lat: float, lon: float) -> dict:
    """Wind, temperature and rain from Open-Meteo forecast endpoint."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,precipitation_probability",
        "hourly": "wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation_probability,precipitation,cloud_cover,temperature_2m",
        "daily": "wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_probability_max,temperature_2m_max,temperature_2m_min,sunrise,sunset",
        "wind_speed_unit": "kn",
        "forecast_days": 16,
        "timezone": "auto",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{OPEN_METEO_BASE}/forecast", params=params)
        r.raise_for_status()
        return r.json()


async def fetch_marine(lat: float, lon: float) -> dict:
    """Wave height and period from Open-Meteo marine endpoint."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "wave_height,wave_period,wind_wave_height,sea_surface_temperature",
        "hourly": "wave_height,wave_period",
        "timezone": "auto",
        "forecast_days": 16,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get("https://marine-api.open-meteo.com/v1/marine", params=params)
        if r.status_code != 200:
            return {}
        return r.json()


async def fetch_depth_gebco(lat: float, lon: float) -> float | None:
    """Ocean depth at a lat/lon from Open Topo Data (GEBCO 2020, ~460 m resolution).
    Returns depth in metres (positive = below sea level), or None on failure.
    """
    url = f"https://api.opentopodata.org/v1/gebco2020?locations={lat},{lon}"
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(url)
            if r.status_code != 200:
                return None
            results = r.json().get("results", [])
            if not results:
                return None
            elev = results[0].get("elevation")
            if elev is None:
                return None
            # Negative elevation = ocean/sound depth; positive = land (set to 0)
            return round(-float(elev), 1) if float(elev) < 0 else 0.0
        except Exception:
            return None


async def seed_depths() -> None:
    """One-time fetch of depth for every spot that has NULL depth_m."""
    with get_db() as db:
        spots = db.execute(
            "SELECT id, lat, lon FROM spots WHERE depth_m IS NULL AND lat IS NOT NULL"
        ).fetchall()
    for spot in spots:
        depth = await fetch_depth_gebco(spot["lat"], spot["lon"])
        if depth is not None:
            with get_db() as db:
                db.execute("UPDATE spots SET depth_m=? WHERE id=?", (depth, spot["id"]))
        await asyncio.sleep(0.4)  # polite pacing for the free public API


async def fetch_wikimedia_photos(name: str, region: str) -> list[dict]:
    """Search Wikimedia Commons for photos matching a spot name."""
    city = region.split(",")[0].strip()
    query = f"kitesurfing kiteboarding {name} {city}"
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            # Step 1: find file titles via full-text search
            r = await client.get(WIKIMEDIA_BASE, params={
                "action": "query", "list": "search",
                "srsearch": query, "srnamespace": 6,
                "format": "json", "srlimit": 8, "origin": "*",
            })
            if r.status_code != 200:
                return []
            hits = r.json().get("query", {}).get("search", [])
            if not hits:
                return []
            titles = "|".join(h["title"] for h in hits[:8])
            # Step 2: get image URLs + metadata
            r2 = await client.get(WIKIMEDIA_BASE, params={
                "action": "query", "titles": titles,
                "prop": "imageinfo", "iiprop": "url|extmetadata",
                "iiurlwidth": 400, "format": "json", "origin": "*",
            })
            if r2.status_code != 200:
                return []
            pages = r2.json().get("query", {}).get("pages", {})
        except Exception:
            return []
    results = []
    for page in pages.values():
        ii = (page.get("imageinfo") or [{}])[0]
        url = ii.get("url")
        thumb = ii.get("thumburl") or url
        if not url:
            continue
        meta = ii.get("extmetadata", {})
        artist = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", ""))
        license_name = meta.get("LicenseShortName", {}).get("value", "CC")
        title = page.get("title", "").replace("File:", "").rsplit(".", 1)[0]
        results.append({
            "url": url,
            "thumb": thumb,
            "title": title,
            "author": artist,
            "source": "wikimedia",
            "license": license_name,
            "page_url": f"https://commons.wikimedia.org/wiki/{page.get('title','').replace(' ','_')}",
        })
    return results


async def fetch_water_temp(slug: str) -> float | None:
    """Water temperature from the nearest NOAA CO-OPS station."""
    station = NOAA_WATER_STATIONS.get(slug)
    if not station:
        return None
    params = {
        "date": "latest",
        "station": station,
        "product": "water_temperature",
        "units": "metric",
        "time_zone": "gmt",
        "application": "kitesurf_dashboard",
        "format": "json",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{NOAA_BASE}/api/prod/datagetter", params=params)
        if r.status_code != 200:
            return None
        readings = r.json().get("data", [])
        if not readings:
            return None
        try:
            return round(float(readings[-1]["v"]), 1)
        except (KeyError, ValueError):
            return None


def _ms_to_kn(ms: float) -> int:
    return round(ms * 1.944)


def build_forecast(
    spot_id: int,
    raw: dict,
    marine: dict | None = None,
    water_temp_c: float | None = None,
) -> dict:
    cur = raw.get("current", {})
    hourly = raw.get("hourly", {})
    times = hourly.get("time", [])[:16*24]
    wind_kn = round(cur.get("wind_speed_10m", 0))
    gusts_kn = round(cur.get("wind_gusts_10m", 0))
    dir_deg = cur.get("wind_direction_10m", 0)
    air_temp_c = cur.get("temperature_2m", 0)
    rain_pct = cur.get("precipitation_probability", 0)

    # Wave data from Open-Meteo marine
    marine = marine or {}
    cur_marine = marine.get("current", {})
    wave_m = cur_marine.get("wave_height")
    wave_period = cur_marine.get("wave_period")
    if wave_m is not None:
        wave_m = round(float(wave_m), 1)
    if wave_period is not None:
        wave_period = round(float(wave_period), 1)

    # Water temp: prefer NOAA (accurate), fall back to Open-Meteo marine SST (global)
    if water_temp_c is None:
        sst = cur_marine.get("sea_surface_temperature")
        if sst is not None:
            water_temp_c = round(float(sst), 1)

    # Marine hourly wave lookup: ISO time string → wave_height
    marine_hourly = marine.get("hourly", {})
    _m_times = marine_hourly.get("time", [])
    _m_waves = marine_hourly.get("wave_height", [])
    marine_wave_lut = {
        _m_times[j]: _m_waves[j]
        for j in range(min(len(_m_times), len(_m_waves)))
    }

    def _h(key, i, default=0):
        arr = hourly.get(key) or []
        return arr[i] if i < len(arr) else default

    hourly_data = [
        {
            "date":      t[:10],
            "hour":      t[11:13] if len(t) > 13 else t,
            "wind_kn":   round(_h("wind_speed_10m", i)),
            "gusts_kn":  round(_h("wind_gusts_10m", i)),
            "dir":       _dir_label(_h("wind_direction_10m", i)),
            "dir_deg":   round(_h("wind_direction_10m", i)),
            "rain_pct":  _h("precipitation_probability", i),
            "rain_mm":   round(float(_h("precipitation", i, 0) or 0), 2),
            "cloud":     _h("cloud_cover", i, None),
            "wave":      round(float(marine_wave_lut[t]), 1) if t in marine_wave_lut and marine_wave_lut[t] is not None else None,
            "air_temp_c": round(_h("temperature_2m", i, None), 1) if _h("temperature_2m", i, None) is not None else None,
        }
        for i, t in enumerate(times)
    ]

    # 16-day daily summary
    daily_raw = raw.get("daily", {})
    daily_times = daily_raw.get("time", [])
    _d = lambda key, i: (daily_raw.get(key) or [None]*20)[i] if i < len(daily_raw.get(key) or []) else None
    daily_data = [
        {
            "date": daily_times[i],
            "wind_kn_max": round(_d("wind_speed_10m_max", i) or 0),
            "gusts_kn_max": round(_d("wind_gusts_10m_max", i) or 0),
            "dir": _dir_label(_d("wind_direction_10m_dominant", i) or 0),
            "rain_pct": _d("precipitation_probability_max", i) or 0,
            "air_temp_max_c": round(_d("temperature_2m_max", i), 1) if _d("temperature_2m_max", i) is not None else None,
            "air_temp_min_c": round(_d("temperature_2m_min", i), 1) if _d("temperature_2m_min", i) is not None else None,
            "sunrise": _d("sunrise", i)[11:16] if _d("sunrise", i) else None,
            "sunset":  _d("sunset",  i)[11:16] if _d("sunset",  i) else None,
        }
        for i in range(len(daily_times))
    ]

    # Today's sunrise / sunset — Open-Meteo returns ISO datetime e.g. "2026-03-23T06:15"
    _today_sunrise = daily_raw.get("sunrise", [None])[0]
    _today_sunset  = daily_raw.get("sunset",  [None])[0]
    sunrise_time = _today_sunrise[11:16] if _today_sunrise else None  # "06:15"
    sunset_time  = _today_sunset[11:16]  if _today_sunset  else None  # "18:47"

    return {
        "spot_id": spot_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "current": {
            "wind_kn": wind_kn,
            "gusts_kn": gusts_kn,
            "dir_deg": dir_deg,
            "dir_label": _dir_label(dir_deg),
            "wave_m": wave_m,
            "wave_period_s": wave_period,
            "air_temp_c": round(air_temp_c, 1),
            "water_temp_c": water_temp_c,
            "rain_pct": rain_pct,
            "tide_next": None,
        },
        "hourly": hourly_data,
        "daily": daily_data,
        "session_windows": _compute_session_windows(hourly_data[:24]),
        "sunrise": sunrise_time,
        "sunset": sunset_time,
    }


def _compute_session_windows(hourly: list[dict]) -> list[dict]:
    """Find contiguous windows where wind is in the green zone (13-19 kn)."""
    windows = []
    start = None
    for h in hourly:
        w = h["wind_kn"]
        if 13 <= w <= 19:
            if start is None:
                start = h["hour"]
        else:
            if start is not None:
                score = _score(hourly, start, h["hour"])
                windows.append({"start": f"{start}:00", "end": f"{h['hour']}:00", "score": score})
                start = None
    return windows


def _score(hourly: list[dict], start_h: str, end_h: str) -> int:
    subset = [h for h in hourly if start_h <= h["hour"] < end_h]
    if not subset:
        return 0
    in_range = sum(1 for h in subset if 13 <= h["wind_kn"] <= 19) / len(subset)
    no_rain = sum(1 for h in subset if h["rain_pct"] < 20) / len(subset)
    score = round(in_range * 40 + no_rain * 25 + 20 + 10 + 5)
    return min(score, 100)


async def refresh_spot(spot_id: int, lat: float, lon: float, slug: str = "") -> None:
    try:
        results = await asyncio.gather(
            fetch_open_meteo(lat, lon),
            fetch_marine(lat, lon),
            fetch_water_temp(slug),
            return_exceptions=True,
        )
        weather = results[0]
        marine  = results[1] if not isinstance(results[1], Exception) else {}
        wtemp   = results[2] if not isinstance(results[2], Exception) else None
        if isinstance(weather, Exception):
            raise weather
        payload = build_forecast(spot_id, weather, marine, wtemp)
        now = datetime.now(timezone.utc).isoformat()
        expires = (datetime.now(timezone.utc) + timedelta(minutes=FORECAST_REFRESH_MINS)).isoformat()
        with get_db() as db:
            db.execute(
                """INSERT INTO forecast_cache (spot_id, fetched_at, expires_at, payload)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(spot_id) DO UPDATE SET
                     fetched_at=excluded.fetched_at,
                     expires_at=excluded.expires_at,
                     payload=excluded.payload""",
                (spot_id, now, expires, json.dumps(payload)),
            )
    except Exception as exc:
        print(f"[refresh_spot] spot_id={spot_id} error: {exc}")


async def refresh_all_spots() -> None:
    with get_db() as db:
        spots = db.execute("SELECT id, slug, lat, lon FROM spots").fetchall()
    for spot in spots:
        if spot["lat"] and spot["lon"]:
            await refresh_spot(spot["id"], spot["lat"], spot["lon"], spot["slug"] or "")


# ---------------------------------------------------------------------------
# Scheduler
# ---------------------------------------------------------------------------
scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    await seed_depths()        # one-time depth fetch for new spots
    await refresh_all_spots()
    scheduler.add_job(
        refresh_all_spots,
        "interval",
        minutes=FORECAST_REFRESH_MINS,
        misfire_grace_time=60,
        coalesce=True,
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Kitesurf API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes — health
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "db": str(DB_PATH)}


# ---------------------------------------------------------------------------
# Routes — auth
# ---------------------------------------------------------------------------

class SignupRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/auth/signup", status_code=201)
def signup(body: SignupRequest):
    with get_db() as db:
        existing = db.execute("SELECT id FROM users WHERE email = ?", (body.email,)).fetchone()
        if existing:
            raise HTTPException(400, "Email already registered")
        user_id = str(uuid.uuid4())
        db.execute(
            "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
            (user_id, body.email, hash_password(body.password)),
        )
        db.execute("INSERT INTO user_profiles (user_id) VALUES (?)", (user_id,))
    return {"token": create_token(user_id), "user_id": user_id}


@app.post("/api/auth/login")
def login(body: LoginRequest):
    with get_db() as db:
        row = db.execute("SELECT id, password_hash FROM users WHERE email = ?", (body.email,)).fetchone()
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    return {"token": create_token(row["id"]), "user_id": row["id"]}


# ---------------------------------------------------------------------------
# Routes — spots
# ---------------------------------------------------------------------------

@app.get("/api/spots")
def list_spots():
    with get_db() as db:
        rows = db.execute("SELECT * FROM spots ORDER BY id").fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Routes — forecast
# ---------------------------------------------------------------------------

@app.get("/api/forecast")
async def get_forecast(spot: str):
    with get_db() as db:
        spot_row = db.execute("SELECT * FROM spots WHERE slug = ?", (spot,)).fetchone()
        if not spot_row:
            raise HTTPException(404, f"Spot '{spot}' not found")

        cache = db.execute(
            "SELECT payload, fetched_at, expires_at FROM forecast_cache WHERE spot_id = ?",
            (spot_row["id"],),
        ).fetchone()

    if cache:
        expires = datetime.fromisoformat(cache["expires_at"])
        if expires > datetime.now(timezone.utc):
            return json.loads(cache["payload"])

    # Cache miss or expired — fetch live
    if spot_row["lat"] and spot_row["lon"]:
        await refresh_spot(spot_row["id"], spot_row["lat"], spot_row["lon"], spot_row["slug"] or "")
        with get_db() as db:
            cache = db.execute(
                "SELECT payload FROM forecast_cache WHERE spot_id = ?", (spot_row["id"],)
            ).fetchone()
        if cache:
            return json.loads(cache["payload"])

    raise HTTPException(503, "Forecast data unavailable")


# ---------------------------------------------------------------------------
# Routes — SSE stream
# ---------------------------------------------------------------------------

@app.get("/api/stream/{spot_slug}")
async def stream_forecast(spot_slug: str):
    with get_db() as db:
        spot_row = db.execute("SELECT id FROM spots WHERE slug = ?", (spot_slug,)).fetchone()
    if not spot_row:
        raise HTTPException(404, f"Spot '{spot_slug}' not found")

    spot_id = spot_row["id"]
    last_sent_at: str | None = None

    async def event_generator() -> AsyncGenerator[dict, None]:
        nonlocal last_sent_at
        while True:
            with get_db() as db:
                if last_sent_at:
                    row = db.execute(
                        "SELECT payload, fetched_at FROM forecast_cache WHERE spot_id = ? AND fetched_at > ?",
                        (spot_id, last_sent_at),
                    ).fetchone()
                else:
                    row = db.execute(
                        "SELECT payload, fetched_at FROM forecast_cache WHERE spot_id = ?",
                        (spot_id,),
                    ).fetchone()

            if row:
                last_sent_at = row["fetched_at"]
                yield {"event": "forecast", "data": row["payload"]}

            await asyncio.sleep(SSE_POLL_SECS)

    return EventSourceResponse(event_generator())


# ---------------------------------------------------------------------------
# Routes — tide (NOAA CO-OPS, on-demand)
# ---------------------------------------------------------------------------

@app.get("/api/tide")
async def get_tide(spot: str):
    station = NOAA_WATER_STATIONS.get(spot)
    if not station:
        raise HTTPException(404, f"No tide station configured for '{spot}'")
    begin = datetime.now(timezone.utc).strftime("%Y%m%d")
    params = {
        "begin_date": begin,
        "range": "24",
        "station": station,
        "product": "predictions",
        "datum": "MLLW",
        "time_zone": "lst_ldt",
        "interval": "hilo",
        "units": "metric",
        "application": "kitesurf_dashboard",
        "format": "json",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{NOAA_BASE}/api/prod/datagetter", params=params)
    if r.status_code != 200:
        raise HTTPException(503, "NOAA tide data unavailable")
    return {"station": station, "predictions": r.json().get("predictions", [])}


# ---------------------------------------------------------------------------
# Routes — photos (Flickr + Wikimedia, no persistence)
# ---------------------------------------------------------------------------

@app.get("/api/photos")
async def get_photos(spot: str):
    with get_db() as db:
        row = db.execute("SELECT name, region, lat, lon FROM spots WHERE slug = ?", (spot,)).fetchone()
    if not row:
        raise HTTPException(404, f"Spot '{spot}' not found")
    photos = await fetch_wikimedia_photos(row["name"], row["region"] or "")
    return photos[:18]


# ---------------------------------------------------------------------------
# Routes — favourites (requires auth)
# ---------------------------------------------------------------------------

@app.get("/api/favourites")
def get_favourites(user_id: str = Depends(current_user_id)):
    with get_db() as db:
        rows = db.execute(
            """SELECT s.* FROM spots s
               JOIN user_favourites uf ON s.id = uf.spot_id
               WHERE uf.user_id = ?
               ORDER BY uf.added_at""",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/favourites/{spot_id}", status_code=201)
def add_favourite(spot_id: int, user_id: str = Depends(current_user_id)):
    with get_db() as db:
        db.execute(
            "INSERT OR IGNORE INTO user_favourites (user_id, spot_id) VALUES (?, ?)",
            (user_id, spot_id),
        )
    return {"status": "added"}


@app.delete("/api/favourites/{spot_id}")
def remove_favourite(spot_id: int, user_id: str = Depends(current_user_id)):
    with get_db() as db:
        db.execute(
            "DELETE FROM user_favourites WHERE user_id = ? AND spot_id = ?",
            (user_id, spot_id),
        )
    return {"status": "removed"}
