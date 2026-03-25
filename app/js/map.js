/* ── LEAFLET MAP ── */

let _map = null;
let _tiles = {};
let _activeTileKey = null;
let _markers = {};   // spotId → L.Marker
let _flyZoom = 17;   // persists last manual zoom across spot clicks
let _mapReady = false;

const _TILE_CFG = {
  sat: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opts: { attribution: 'Tiles &copy; Esri', maxZoom: 19 },
  },
  wind: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    opts: { attribution: '&copy; <a href="https://carto.com/">CARTO</a>', subdomains: 'abcd', maxZoom: 20 },
  },
  rain: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    opts: { attribution: '&copy; <a href="https://carto.com/">CARTO</a>', subdomains: 'abcd', maxZoom: 20 },
  },
};

// Fit map to show all spots with padding
const _ALL_LATLNGS = SPOTS_CONFIG.map(s => [s.lat, s.lon]);

function _getViewWidth() {
  if (!_map) return '';
  const b = _map.getBounds(), c = _map.getCenter();
  const dLon = (b.getEast() - b.getWest()) * Math.PI / 180;
  const km = 6371 * dLon * Math.cos(c.lat * Math.PI / 180);
  return km >= 10 ? Math.round(km) + ' km' : km >= 1 ? km.toFixed(1) + ' km' : Math.round(km * 1000) + ' m';
}

function _updateScale() {
  const el = document.getElementById('map-scale');
  if (!el || !_map) return;
  el.textContent = 'Z' + _map.getZoom() + ' · ~' + _getViewWidth();
}

function initMap() {
  if (_map) return;
  _map = L.map('mc', { zoomControl: true, attributionControl: true });
  _map.zoomControl.setPosition('bottomright');
  setTimeout(() => {
    _map.invalidateSize();
    _map.fitBounds(L.latLngBounds(_ALL_LATLNGS).pad(0.15));
    _updateScale();
    _renderSavedPins();
    setTimeout(() => { _mapReady = true; }, 1500);
  }, 100);

  _map.on('zoomend moveend', () => {
    if (_mapReady) _flyZoom = _map.getZoom();
    _updateScale();
  });
  _map.on('click', () => closeSetViewPopup());

  Object.entries(_TILE_CFG).forEach(([k, cfg]) => {
    _tiles[k] = L.tileLayer(cfg.url, cfg.opts);
  });
  _tiles.sat.addTo(_map);
  _activeTileKey = 'sat';
}

function _pinIcon(s) {
  const bg = wBg((s.wind + s.gusts) / 2);
  const isActive = s.id === activeId;
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer">
      <div style="
        background:${bg};border:${isActive ? '2.5px' : '2px'} solid rgba(255,255,255,.9);
        border-radius:99px;padding:3px 8px;display:flex;align-items:center;gap:4px;
        font-size:${isActive ? 12 : 10}px;font-weight:500;color:#fff;white-space:nowrap;
        transform:${isActive ? 'scale(1.15)' : 'none'};transition:all .2s;
        box-shadow:0 2px 6px rgba(0,0,0,.4)">
        ${s.wind}<span style="font-size:9px;margin-left:2px;opacity:.8">kn</span>
      </div>
      ${isActive ? `<div style="margin-top:3px;background:rgba(0,0,0,.65);color:#fff;font-size:10px;padding:2px 7px;border-radius:99px;white-space:nowrap">${s.short}</div>` : ''}
    </div>`;
  return L.divIcon({
    className: '',
    html,
    iconSize: [0, 0],     // size 0 lets the div expand naturally
    iconAnchor: [30, 13], // center of bubble (approx 60px wide, 26px tall)
  });
}

/* ── DRAW MAP (tile layer switch + tilt) ── */
function drawMap() {
  initMap();

  if (_activeTileKey !== layer) {
    _map.removeLayer(_tiles[_activeTileKey]);
    _tiles[layer].addTo(_map);
    _activeTileKey = layer;
  }

  // Tilt: rotate entire map container to align North with active spot's wind direction
  const deg = tilt ? -(SPOTS[activeId].dirDeg - 270) : 0;
  document.getElementById('mc').style.transform = `rotate(${deg}deg)`;

  _map.invalidateSize();
}

/* ── SAVED SPOT VIEWS + PINS ── */
const _VIEWS_KEY = 'wsp_spot_views';
function _getSavedViews() { try { return JSON.parse(localStorage.getItem(_VIEWS_KEY)||'{}'); } catch { return {}; } }

let _savedPinMarkers = {};

function _renderSavedPins() {
  Object.values(_savedPinMarkers).forEach(m => m.remove());
  _savedPinMarkers = {};
  if (!_map) return;
  const views = _getSavedViews();
  Object.entries(views).forEach(([slug, v]) => {
    const spot = SPOTS.find(s => s.slug === slug);
    if (!spot) return;
    const icon = L.divIcon({
      className: '',
      html: `<svg width="20" height="28" viewBox="0 0 20 28" style="display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))"><path d="M10 0a10 10 0 0110 10c0 7-10 18-10 18S0 17 0 10A10 10 0 0110 0z" fill="rgba(55,138,221,.92)" stroke="#fff" stroke-width="1.5"/><circle cx="10" cy="10" r="3.5" fill="#fff"/></svg>`,
      iconSize: [20, 28],
      iconAnchor: [10, 28],
    });
    const label = v.comment
      ? `<strong>${spot.name}</strong><br>${v.comment}`
      : `<strong>${spot.name}</strong>`;
    const marker = L.marker([v.lat, v.lon], { icon, zIndexOffset: 500 })
      .bindTooltip(label, { direction: 'top', className: 'saved-pin-tip', offset: [0, -32] })
      .addTo(_map);
    _savedPinMarkers[slug] = marker;
  });
}

function _updateSetViewBtn() {
  const btn = document.getElementById('map-setview-btn');
  if (!btn || !SPOTS[activeId]) return;
  const saved = !!_getSavedViews()[SPOTS[activeId].slug];
  btn.classList.toggle('active', saved);
  btn.title = saved ? 'Custom view saved — click to edit or remove' : 'Save current map view as default for this spot';
}

/* popup open/confirm/cancel/remove (called from HTML) */
function openSetViewPopup() {
  if (!_map) return;
  const slug = SPOTS[activeId]?.slug; if (!slug) return;
  const existing = _getSavedViews()[slug];
  document.getElementById('svp-spot-name').textContent = SPOTS[activeId].short || SPOTS[activeId].name;
  document.getElementById('svp-comment').value = existing?.comment || '';
  document.getElementById('svp-remove-btn').style.display = existing ? '' : 'none';
  document.getElementById('setview-popup').classList.add('open');
  setTimeout(() => document.getElementById('svp-comment').focus(), 50);
}
function closeSetViewPopup() { document.getElementById('setview-popup').classList.remove('open'); }
function confirmSetView() {
  if (!_map) return;
  const slug = SPOTS[activeId]?.slug; if (!slug) return;
  const c = _map.getCenter();
  const views = _getSavedViews();
  views[slug] = { lat: c.lat, lon: c.lng, zoom: _map.getZoom(), comment: document.getElementById('svp-comment').value.trim() };
  localStorage.setItem(_VIEWS_KEY, JSON.stringify(views));
  closeSetViewPopup();
  _updateSetViewBtn();
  _renderSavedPins();
}
function resetSpotView() {
  const slug = SPOTS[activeId]?.slug; if (!slug) return;
  const views = _getSavedViews();
  delete views[slug];
  localStorage.setItem(_VIEWS_KEY, JSON.stringify(views));
  closeSetViewPopup();
  _updateSetViewBtn();
  _renderSavedPins();
}

/* ── FLY TO SPOT ── */
function flyToSpot(id) {
  if (!_map) return;
  const s = SPOTS[id];
  const saved = _getSavedViews()[s.slug];
  if (saved) {
    _map.flyTo([saved.lat, saved.lon], saved.zoom, { duration: 1.2 });
  } else {
    _map.flyTo([s.lat, s.lon], _flyZoom, { duration: 1.2 });
  }
  setTimeout(_updateSetViewBtn, 200);
}

/* ── COMPASS ROSE ── */
function renderMapRose() {
  const s = SPOTS[activeId];
  const dirDeg = selectedHourData ? selectedHourData.dirDeg : s.dirDeg;
  const wind   = selectedHourData ? selectedHourData.w      : s.wind;
  const status = selectedHourData
    ? (wind >= 13 && wind <= 19 ? 'go' : wind >= 8 ? 'maybe' : 'nogo')
    : s.status;
  document.getElementById('map-rose').innerHTML = compassRingSVG(140, 140, 104, dirDeg, SC[status], 0.28);
}

/* ── SPOT PINS ── */
function renderPins() {
  if (!_map) return;

  // Remove old markers
  Object.values(_markers).forEach(m => m.remove());
  _markers = {};

  SPOTS.forEach(s => {
    const marker = L.marker([s.lat, s.lon], {
      icon: _pinIcon(s),
      zIndexOffset: s.id === activeId ? 1000 : 0,
    });
    marker.on('click', () => selectSpot(s.id));
    marker.addTo(_map);
    _markers[s.id] = marker;
  });

  const s = SPOTS[activeId];
  document.getElementById('map-status').textContent = `${s.name} · ${s.wind}/${s.gusts} kn ${s.dir}`;
  _updateSetViewBtn();
}

/* ── WIND DIRECTION ARROW PARTICLES ── */
let arrowParticles = [], animFrame = null;

// Color palette: cool (calm) → warm (strong) → purple (extreme)
function _windColor(kn) {
  if (kn <  6) return '#74b9ff';  // calm      — sky blue
  if (kn < 12) return '#0984e3';  // light     — blue
  if (kn < 18) return '#00b894';  // ideal     — teal-green
  if (kn < 25) return '#f9ca24';  // strong    — yellow
  if (kn < 33) return '#f0932b';  // very strong — orange
  if (kn < 42) return '#eb4d4b';  // storm     — red
  return '#a855f7';               // extreme   — purple
}

function spawnP(W, H, dD, wk) {
  const ar = (dD+180-90)*Math.PI/180, opp = ar+Math.PI;
  const cx2 = W/2+Math.cos(opp)*(W*.55), cy2 = H/2+Math.sin(opp)*(H*.55);
  const perp = ar+Math.PI/2, sp = (Math.random()-.5)*Math.max(W,H)*1.8;
  return {x:cx2+Math.cos(perp)*sp, y:cy2+Math.sin(perp)*sp, life:Math.random(), col:_windColor(wk), dirDeg:dD, wk, sz:6+wk/9, W, H};
}
function stepP(p) {
  const ar = (p.dirDeg+180-90)*Math.PI/180, spd = 0.5+p.wk/12;
  p.x += Math.cos(ar)*spd*1.4; p.y += Math.sin(ar)*spd*1.4; p.life += 0.003+p.wk/5500;
  if (p.life > 1 || p.x < -30 || p.x > p.W+30 || p.y < -30 || p.y > p.H+30) {
    const np = spawnP(p.W, p.H, p.dirDeg, p.wk);
    Object.assign(p, np); p.life = 0;
  }
}
function drawP(ctx, p) {
  const t = p.life, ar = (p.dirDeg+180-90)*Math.PI/180;
  let a = t<.15?t/.15:t<.8?1:(1-t)/.2; a *= .88;
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(ar); ctx.globalAlpha = a;
  ctx.strokeStyle = p.col; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-p.sz*.7,0); ctx.lineTo(p.sz*.6,0); ctx.stroke();
  ctx.fillStyle = p.col; ctx.beginPath(); ctx.moveTo(p.sz*.6,0); ctx.lineTo(p.sz*.05,-p.sz*.45); ctx.lineTo(p.sz*.05,p.sz*.45); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function animateArrows() {
  const cv = document.getElementById('map-arrows'); if (!cv) return;
  const sec = document.getElementById('map-area');
  const W = sec.offsetWidth, H = sec.offsetHeight;
  if (H < 20) { animFrame = requestAnimationFrame(animateArrows); return; }
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const ctx = cv.getContext('2d'); ctx.clearRect(0,0,W,H);
  const s = SPOTS[activeId];
  const hourDirDeg = selectedHourData ? selectedHourData.dirDeg : s.dirDeg;
  const hourWind   = selectedHourData ? selectedHourData.w      : s.wind;
  if (arrowParticles.length === 0 || arrowParticles[0].W !== W) {
    const cnt = Math.round(35 + hourWind / 1.5); arrowParticles = [];
    for (let i = 0; i < cnt; i++) arrowParticles.push(spawnP(W, H, hourDirDeg, hourWind));
  }
  arrowParticles.forEach(p => { stepP(p); drawP(ctx,p); });
  animFrame = requestAnimationFrame(animateArrows);
}
function stopAnimation() { if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; } }
function startAnimation() { stopAnimation(); arrowParticles = []; animateArrows(); }
