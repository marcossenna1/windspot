# ADR-001 — Map Overlays: Water Depth & Sea Surface Temperature

**Status:** Deferred — research complete, implementation pending
**Date:** 2026-03-18
**Author:** Architecture session
**Context:** WindSpot Kitesurf Dashboard

---

## Decision

Defer full implementation of water depth and SST map overlays until a higher-resolution
shallow-water depth source is identified and integrated. The global GEBCO dataset (460 m
resolution) is insufficient for the primary use-case spots in Pamlico Sound and other
shallow coastal sounds. All research is captured here so implementation can proceed
without repeating the discovery phase.

---

## Context

Users requested a right-click context menu on the map to toggle:
1. **Water depth overlay** — depth contours/gradient rendered as a transparent tile layer
2. **Water temperature overlay** — sea surface temperature (SST) tile layer

The current dashboard already fetches point-level depth via GEBCO (Open Topo Data API)
and stores it in the `spots.depth_m` DB column. The next step is a full spatial overlay
visible at the map tile level.

---

## Evaluated Data Sources

### Water Depth / Bathymetry

| Source | URL / Endpoint | Key | Resolution | CORS | Notes |
|---|---|---|---|---|---|
| **GEBCO WMS** | `https://wms.gebco.net/mapserv` layer `GEBCO_LATEST_2` | None | ~460 m | ✅ OK | Transparent PNG, Leaflet-ready via `L.tileLayer.wms` |
| **NOAA Nautical Charts (RNC)** | `https://seamlessrnc.nauticalcharts.noaa.gov/arcgis/services/RNC/NOAA_RNC/MapServer/WMSServer` layer `0` | None | Chart-scale | ✅ OK | Traditional nautical chart styling; very detailed nearshore |
| **NOAA BlueTopo (AWS S3)** | `s3://noaa-bathymetry-pds/BlueTopo/` | None | **1–10 m** | N/A (S3 COG) | Best US coastal resolution; requires rasterio/Python for tile generation; not a live WMS |
| **NOAA CoNED / TBDEMs** | USGS download only | None | **1 m** (where available) | N/A (file) | Highest resolution; patchy coverage; no live tile service |
| **OpenTopography API** | `https://portal.opentopography.org/API/globaldem` | Free key | ~460 m | ✅ OK | Returns GeoTIFF bounding box; useful for batch pre-caching |

### Sea Surface Temperature (SST)

| Source | URL / Endpoint | Key | Resolution | Freshness | CORS | Notes |
|---|---|---|---|---|---|---|
| **NASA GIBS — MODIS Aqua 4km Night** | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Aqua_L3_SST_MidIR_4km_Night_Daily/default/{date}/GoogleMapsCompatible/{z}/{y}/{x}.png` | None | 4 km | ~1 day | ✅ OK | Standard `L.tileLayer`; date param drives displayed day |
| **NASA GIBS — MODIS Terra 9km** | Same base URL, layer `MODIS_Terra_L3_SST_MidIR_9km_Day_Monthly` | None | 9 km | Monthly | ✅ OK | Smoother, good for seasonal context |
| **NOAA CoastWatch ERDDAP** | `https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41` | None | **~1 km** | ~1 day | ❌ CORS | Best US coastal SST; needs backend proxy route to use as tiles |
| **Copernicus Marine (CMEMS)** | `https://nrt.cmems-du.eu/thredds/wms/...` | Registration | ~1–5 km | Near-real-time | Restricted | Best European product; available for Atlantic US |

---

## Proposed Implementation Architecture

### 1. Right-click Context Menu
```javascript
_map.on('contextmenu', e => {
  showMapContextMenu(e.containerPoint, e.latlng);
});
```
Custom `<div id="map-context-menu">` positioned at click coordinates, containing:
- `[ ] Show depth` toggle
- `[ ] Show water temperature` toggle
- Depth value at clicked point (queried on-demand)
- SST value at clicked point (queried on-demand)
Closes on map click or Escape.

### 2. Overlay Layer Objects
```javascript
const _OVERLAY_CFG = {
  depth: L.tileLayer.wms('https://wms.gebco.net/mapserv', {
    layers: 'GEBCO_LATEST_2',
    transparent: true,
    format: 'image/png',
    opacity: 0.55,
    attribution: '© GEBCO'
  }),
  sst: L.tileLayer(NASA_GIBS_SST_URL_WITH_DATE, {
    opacity: 0.65,
    attribution: 'NASA GIBS / MODIS'
  })
};
let _activeOverlays = { depth: false, sst: false };

function toggleOverlay(name) {
  _activeOverlays[name] = !_activeOverlays[name];
  if (_activeOverlays[name]) _OVERLAY_CFG[name].addTo(_map);
  else _map.removeLayer(_OVERLAY_CFG[name]);
  _updateContextMenuState();
  _updateOverlayLegend();
}
```

### 3. Point Value Queries on Click
- **Depth at point:** reuse existing backend `GET /api/depth?lat=&lon=` (calls Open Topo Data)
- **SST at point:** new backend route `GET /api/sst?lat=&lon=` → proxy to NOAA CoastWatch ERDDAP
  ```
  GET https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41.json
      ?analysed_sst[(last)][(lat):(lat)][(lon):(lon)]
  ```

### 4. Color Legend
When an overlay is visible, show a vertical legend bar at bottom-left:
- **Depth:** `0 m` (pale green) → `20 m` (teal) → `100 m` (blue) → `1000+ m` (purple)
- **SST:** `10°C` (blue) → `20°C` (yellow) → `30°C` (red) + data date

---

## Why Deferred: The Shallow-Water Resolution Problem

The primary kite spots in this dashboard are **Pamlico Sound, NC** (Salvo, Canadian Hole,
Buxton, Waves, Kite Point) — waters that are typically **0.5–2 m deep** over distances of
kilometres. GEBCO at 460 m resolution averages across sandbars, channels and shoals,
producing a false picture of depth at these spots.

**Minimum acceptable resolution for shallow-water kite spots: ≤ 50 m**

### Path to Better Resolution

| Option | Resolution | Effort | Status |
|---|---|---|---|
| NOAA BlueTopo raster tiles (self-hosted) | 1–10 m | High — requires tile generation pipeline (Python + rio-cogeo + tile server) | **Recommended long-term** |
| NOAA ENC vector charts (self-hosted) | Chart-scale | High — requires S57 parsing + renderer | Overkill |
| NOAA Nautical Charts WMS overlay | Chart-scale | Low — single Leaflet layer | Quick win for visual reference |
| Custom tile pipeline from BlueTopo COGs | 1–10 m | High — AWS S3 → rasterio → MBTiles → tile server | Best accuracy |

### Recommended Next Step (when implementing)
1. Download BlueTopo tiles for NC/SC/FL from `s3://noaa-bathymetry-pds/BlueTopo/`
2. Convert to MBTiles via `rio-cogeo` + `gdal2tiles`
3. Serve via `mbtileserver` or `martin` (both Docker-friendly, Rust-based)
4. Add as a Leaflet tile layer with opacity control

This gives 1–10 m resolution depth tiles for US coastal waters, suitable for identifying
sandbars, channels and shoals relevant to kite safety.

---

## Key Caveats

1. **"Per tile" toggle is not technically possible** — WMS/tile overlays cover the entire
   map viewport. Right-click offers a toggle for the whole overlay, not a single map tile.
   The phrase "for that map tile" in the UX request should be interpreted as
   "toggle the overlay layer while viewing this area."

2. **SST is not real-time** — best freely available data is ~1 day delayed at 1–4 km
   resolution. Suitable for "cold/warm" seasonal context; not suitable for minute-by-minute
   conditions.

3. **NOAA ENC/CoastWatch tiles require a backend proxy** — browser CORS blocks direct
   tile fetching from these endpoints. A single `GET /proxy/tiles` route in the FastAPI
   backend resolves this.

4. **Overlay opacity matters** — depth and SST overlays must be semi-transparent (0.5–0.7)
   to remain readable over the ESRI satellite base layer.

---

## Related Files

| File | Relevance |
|---|---|
| `api/main.py` | `fetch_depth_gebco()` — existing point-depth query |
| `app/js/map.js` | `_TILE_CFG`, `_OVERLAY_CFG` (to be added), `flyToSpot` |
| `app/js/data.js` | `SPOTS_CONFIG.depth_m` — per-spot static depth fallback |
| `api/schema.sql` | `spots.depth_m` — DB column seeded from GEBCO |
| `specifications/kitesurf-dashboard.html` | Original dashboard spec |
