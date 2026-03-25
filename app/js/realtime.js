/* ── REALTIME — API fetch + SSE updates ── */

/**
 * Map API forecast response onto the SPOTS entry.
 */
function applyForecast(spotId, data) {
  const spot = SPOTS.find(s => s.id === spotId);
  if (!spot || !data || !data.current) return;
  const cur = data.current;

  spot.wind    = cur.wind_kn    ?? 0;
  spot.gusts   = cur.gusts_kn   ?? 0;
  spot.dir     = cur.dir_label  ?? '—';
  spot.dirDeg  = cur.dir_deg    ?? 0;
  spot.airC    = cur.air_temp_c ?? null;
  spot.waterC  = cur.water_temp_c ?? null;
  spot.waves   = cur.wave_m     ?? null;
  spot.period  = cur.wave_period_s ?? null;
  spot.rain    = cur.rain_pct   ?? 0;
  spot.tide    = cur.tide_next  ?? '—';
  spot.sunrise = data.sunrise ?? null;
  spot.sunset  = data.sunset  ?? null;

  // Session windows
  const wins = data.session_windows ?? [];
  spot.windows   = wins.map(w => `${w.start}–${w.end}`);
  spot.allW      = spot.windows;
  spot.goodStart = wins.length ? wins[0].start : null;
  spot.goodEnd   = wins.length ? wins[wins.length-1].end : null;

  // Score and status from best window score
  const bestScore = wins.length ? Math.max(...wins.map(w => w.score)) : 0;
  spot.score  = bestScore;
  spot.status = bestScore >= 75 ? 'go' : bestScore >= 45 ? 'maybe' : 'nogo';

  // Hourly — map API format to display format (16 days × 24 h)
  spot.hr = (data.hourly ?? []).slice(0, 16*24).map(h => ({
    date: h.date  ?? null,
    t:    h.hour,
    w:    h.wind_kn  ?? 0,
    g:    h.gusts_kn ?? 0,
    d:    h.dir      ?? '—',
    dDeg: h.dir_deg  ?? 0,
    r:    h.rain_pct ?? 0,
    rmm:  h.rain_mm  ?? null,
    cloud:h.cloud    ?? null,
    wave: h.wave     ?? null,
    airC: h.air_temp_c ?? null,
    s:    (h.wind_kn >= 13 && h.wind_kn <= 19) ? 'go' : (h.wind_kn >= 8) ? 'maybe' : 'nogo',
  }));
  spot.hours = spot.hr.slice(0, 24).map(h => h.w);  // today only, for sparkline

  // 16-day — map daily API data to week display format
  const _DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const _MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  spot.week = (data.daily ?? []).slice(0, 15).map(d => {
    const kn = d.wind_kn_max ?? 0;
    const dateObj = d.date ? new Date(d.date + 'T12:00:00') : null;
    const dayName = dateObj ? _DAY[dateObj.getDay()] : '—';
    const dt = dateObj ? `${dateObj.getDate()} ${_MON[dateObj.getMonth()]}` : '';
    return {
      date: d.date  ?? null,
      d:    dayName,
      dt,
      kn,
      dir:      d.dir ?? '—',
      rain:     d.rain_pct ?? 0,
      tMax:     d.air_temp_max_c ?? null,
      tMin:     d.air_temp_min_c ?? null,
      sunrise:  d.sunrise ?? null,
      sunset:   d.sunset  ?? null,
      sunriseH: d.sunrise ? parseInt(d.sunrise) : null,
      sunsetH:  d.sunset  ? parseInt(d.sunset)  : null,
      s:    kn >= 13 && kn <= 19 ? 'go' : kn >= 8 ? 'maybe' : 'nogo',
    };
  });
}

/**
 * Fetch initial forecast for all spots from the API.
 */
async function loadAllForecasts() {
  for (const cfg of SPOTS) {
    try {
      const r = await fetch(`${API_BASE}/api/forecast?spot=${cfg.slug}`);
      if (r.ok) { applyForecast(cfg.id, await r.json()); }
    } catch (e) {
      console.warn(`[realtime] forecast fetch failed for ${cfg.slug}:`, e.message);
    }
  }
  renderAll();
}

/**
 * Open an SSE connection for a spot and update on new forecast events.
 */
function connectSSE(spotId, slug) {
  const es = new EventSource(`${API_BASE}/api/stream/${slug}`);
  es.addEventListener('forecast', e => {
    try {
      applyForecast(spotId, JSON.parse(e.data));
      renderAll();
      if (dpOpen && activeId === spotId) setDpTab(dpTab);
    } catch (err) {
      console.warn('[realtime] SSE parse error:', err);
    }
  });
  es.onerror = () => {
    es.close();
    setTimeout(() => connectSSE(spotId, slug), 15000);
  };
}

/**
 * Fetch all spots from /api/spots, update depth on existing entries,
 * and inject any DB-only spots (not in SPOTS_CONFIG) into the SPOTS array.
 */
async function loadDepths() {
  try {
    const r = await fetch(`${API_BASE}/api/spots`);
    if (!r.ok) return;
    const apiSpots = await r.json();

    apiSpots.forEach(apiSpot => {
      const local = SPOTS.find(s => s.slug === apiSpot.slug);
      if (local) {
        // Update depth on existing spot
        if (apiSpot.depth_m != null) local.depth_m = apiSpot.depth_m;
      } else {
        // New spot exists in DB but not in data.js — add it dynamically
        SPOTS.push({
          id:       SPOTS.length,
          name:     apiSpot.name,
          short:    apiSpot.short_name || apiSpot.name,
          slug:     apiSpot.slug,
          region:   apiSpot.region   || '',
          state:    apiSpot.state_code || '',
          fav:      false,
          lat:      apiSpot.lat,
          lon:      apiSpot.lon,
          cam:      !!apiSpot.cam_url,
          camLive:  apiSpot.cam_live === 1,
          depth_m:  apiSpot.depth_m  ?? null,
          desc:     '',
          // weather fields — filled by loadAllForecasts
          score: 0, status: 'nogo', wind: 0, gusts: 0,
          dir: '—', dirDeg: 0,
          airC: null, waterC: null, waves: null, period: null,
          rain: 0, tide: '—', sunrise: null, sunset: null,
          goodStart: null, goodEnd: null,
          hours: [], windows: [], allW: [], hr: [],
          week: Array(7).fill(null).map((_,i) => ({
            d: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i], kn: 0, s: 'nogo'
          })),
        });
      }
    });
  } catch (e) {
    console.warn('[realtime] spots fetch failed:', e.message);
  }
}

/**
 * Boot: load depths, then forecasts, then open SSE streams.
 */
loadDepths().then(() => loadAllForecasts()).then(() => {
  SPOTS.forEach(cfg => connectSSE(cfg.id, cfg.slug));
});
