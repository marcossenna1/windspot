# ADR-002 — Photo Storage: Local Network Server fs110

**Status:** Planned — architecture defined, implementation pending
**Date:** 2026-03-18
**Author:** Architecture session
**Context:** WindSpot Kitesurf Dashboard — community photo feature

---

## Decision

When user-uploaded photos are implemented, store photo files on the local network file server
**fs110** (12 TB available), mounted as a Docker volume into the FastAPI container. The server
is external to Docker but on the same LAN, making it a zero-cost, high-capacity NAS solution.

---

## Context

The current implementation fetches photos on-demand from Flickr and Wikimedia Commons with no
local persistence. The next evolution — user photo uploads — requires:

1. A place to write and serve binary files (originals + thumbnails)
2. Persistence that survives container restarts and re-deployments
3. Sufficient capacity for the long term (community photos grow unbounded)

fs110 satisfies all three: it is a dedicated file server with 12 TB available, already on the
LAN, and accessible via SMB/NFS or direct NFS mount.

---

## Architecture

### Storage Layout on fs110

```
/data/windspot/                     ← NFS export root (or SMB share)
  photos/
    originals/
      {spot_slug}/
        {uuid}.jpg                  ← full-res upload (max 12 MB)
    thumbs/
      {spot_slug}/
        {uuid}_400.jpg              ← 400 px wide WebP thumbnail
        {uuid}_800.jpg              ← 800 px wide WebP thumbnail
  cache/                            ← optional Flickr/Wikimedia tile cache
```

### Mount Strategy

**Option A — NFS (recommended for Linux host)**

```yaml
# docker-compose.yml
services:
  api:
    volumes:
      - photo_store:/data/photos

volumes:
  photo_store:
    driver: local
    driver_opts:
      type: nfs
      o: addr=fs110,rw,nfsvers=4,hard,intr
      device: ":/data/windspot/photos"
```

**Option B — SMB/CIFS (if fs110 runs Windows or Samba)**

```bash
# On Docker host, mount before compose:
mount -t cifs //fs110/windspot /mnt/windspot -o username=...,password=...,uid=1000
```

Then bind-mount `/mnt/windspot` as a host volume in `docker-compose.yml`.

**Option C — sshfs (fallback, no kernel module needed)**

```bash
sshfs user@fs110:/data/windspot /mnt/windspot -o reconnect,ServerAliveInterval=15
```

### FastAPI Upload Route (future implementation)

```python
from pathlib import Path
from uuid import uuid4
from PIL import Image          # pillow
import aiofiles

PHOTO_DIR = Path(os.environ.get("PHOTO_DIR", "/data/photos"))

@app.post("/api/photos/upload", status_code=201)
async def upload_photo(
    spot: str,
    file: UploadFile,
    user_id: str = Depends(current_user_id),
):
    spot_row = get_spot_by_slug(spot)         # validate spot exists
    uid = str(uuid4())
    orig_path  = PHOTO_DIR / "originals" / spot / f"{uid}.jpg"
    thumb_path = PHOTO_DIR / "thumbs"    / spot / f"{uid}_400.jpg"
    orig_path.parent.mkdir(parents=True, exist_ok=True)
    thumb_path.parent.mkdir(parents=True, exist_ok=True)

    # Save original
    async with aiofiles.open(orig_path, "wb") as f:
        await f.write(await file.read())

    # Generate thumbnail (Pillow, synchronous — run in thread pool)
    import asyncio
    await asyncio.to_thread(_make_thumb, orig_path, thumb_path, 400)

    # Persist metadata in DB
    with get_db() as db:
        db.execute(
            "INSERT INTO spot_photos (spot_id, user_id, filename, uploaded_at) VALUES (?,?,?,datetime('now'))",
            (spot_row["id"], user_id, uid),
        )
    return {"id": uid, "thumb": f"/static/photos/{spot}/{uid}_400.jpg"}
```

### Static File Serving

Mount the photos directory as a FastAPI `StaticFiles` route:

```python
from fastapi.staticfiles import StaticFiles
app.mount("/static/photos", StaticFiles(directory=str(PHOTO_DIR)), name="photos")
```

### Database Schema (to add)

```sql
CREATE TABLE IF NOT EXISTS spot_photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  spot_id     INTEGER REFERENCES spots(id),
  user_id     TEXT REFERENCES users(id),
  filename    TEXT NOT NULL,            -- UUID, no extension
  caption     TEXT,
  approved    INTEGER DEFAULT 0,        -- moderation flag
  uploaded_at TEXT DEFAULT (datetime('now'))
);
```

---

## GET /api/photos Route (extended, future)

When this is implemented, the existing `/api/photos` route will be extended to merge three
sources in priority order:

1. **User photos** (from fs110, `approved = 1`) — shown first, most relevant
2. **Wikimedia Commons** (text search, CC) — fills gaps where community photos are sparse

The response format is already defined and consistent across all three sources.

---

## Network & Capacity Planning

| Metric | Estimate |
|---|---|
| Average photo size (original) | 4 MB |
| Average thumbnail size (400px WebP) | 80 KB |
| Spots | 16 (growing) |
| Target photos per spot | 50 |
| Total originals | 16 × 50 × 4 MB ≈ **3.2 GB** |
| Total thumbnails | 16 × 50 × 80 KB ≈ **64 MB** |
| 5-year growth (10× active users) | ~32 GB originals |

12 TB on fs110 provides **375× headroom** at the 5-year estimate — capacity is not a constraint.

---

## Prerequisites Before Implementation

1. **Auth UI** — users must be logged in to upload; auth routes already exist in the API
2. **Moderation** — `approved` flag in DB; admin route `PATCH /api/photos/{id}/approve`
3. **fs110 access** — NFS export or SMB share configured; Docker host can mount it
4. **Pillow dependency** — add `pillow` and `aiofiles` to `requirements.txt`
5. **File validation** — check MIME type (JPEG/PNG/WebP only), max 12 MB, strip EXIF GPS

---

## Key Caveats

1. **No CDN** — photos served directly from fs110 via the FastAPI container. Acceptable for
   a private/local deployment; would need object storage (S3/R2) for public internet scale.

2. **NFS availability** — if fs110 goes offline, uploads fail and static file serving returns
   404. The `/api/photos` route degrades gracefully: Flickr + Wikimedia still serve external
   photos even when the local store is unavailable.

3. **Moderation required** — user-submitted photos need manual or automated approval before
   appearing to other users. The `approved` DB flag enables this workflow.

4. **EXIF stripping** — user photos may contain GPS coordinates; strip EXIF on ingest to
   protect user privacy.

---

## Related Files

| File | Relevance |
|---|---|
| `api/main.py` | `fetch_wikimedia_photos()`, `GET /api/photos` |
| `api/schema.sql` | `spot_photos` table (to be added) |
| `docker-compose.yml` | NFS volume mount for fs110 |
| `specifications/ADR-001-map-overlay-depth-temperature.md` | Pattern for deferred features |
