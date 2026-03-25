/* ── ADD SPOT PANEL ── */
let _addSpotOpen = false;
function toggleAddSpot() {
  _addSpotOpen = !_addSpotOpen;
  document.getElementById('addspot-panel').classList.toggle('open', _addSpotOpen);
  document.getElementById('addspot-btn').classList.toggle('active', _addSpotOpen);
}

/* ── GLOBAL CONTROLS ── */
function selectSpot(id) {
  selectedHourData = null; selHidx = null; _updateMapForecastLabel(null);
  activeId = id; arrowParticles = []; flyToSpot(id);
  if (!bpOpen) toggleBpCollapse(); else renderAll();
  if (dpOpen) openDetail(id);
}
function setFilter(f, el) { filter = f; document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); renderList(); }
function setTemp(u) {
  tempUnit = u;
  document.getElementById('tc-btn').className = 'tt-btn'+(u==='C'?' active':'');
  document.getElementById('tf-btn').className = 'tt-btn'+(u==='F'?' active':'');
  renderList();
  if (dpOpen) renderDpToday();
  renderBottomPanel();
}
function toggleTilt() { tilt = !tilt; document.getElementById('tilt-btn').className = 'tilt-btn'+(tilt?' on':''); arrowParticles = []; renderPins(); drawMap(); }
function setLayer(l) { layer = l; ['sat','wind','rain'].forEach(k=>document.getElementById('lb-'+k).className='lb'+(k===l?' on':'')); drawMap(); }

/* ── PHOTOS ── */
function openPhotos() {
  const s = SPOTS[activeId];
  document.getElementById('photos-spot-name').textContent = s?.name ?? '—';
  document.getElementById('photos-modal').className = 'photos-modal-bg open';
  // Show loading placeholders
  document.querySelector('.photos-grid').innerHTML =
    Array(6).fill(`<div class="photo-ph"><svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity=".25"><rect x="1" y="4.5" width="14" height="9.5" rx="2"/><circle cx="8" cy="9.5" r="2.5"/><path d="M5.5 4.5l1.2-2h2.6l1.2 2"/></svg></div>`).join('');
  document.querySelector('.photos-footer').textContent = 'Searching Wikimedia Commons…';
  fetch(`${API_BASE}/api/photos?spot=${s.slug}`)
    .then(r => r.ok ? r.json() : [])
    .then(photos => _renderPhotosGrid(photos, s))
    .catch(() => _renderPhotosGrid([], s));
}
function closePhotos() { document.getElementById('photos-modal').className = 'photos-modal-bg'; }

function _renderPhotosGrid(photos, s) {
  const grid = document.querySelector('.photos-grid');
  const footer = document.querySelector('.photos-footer');
  if (!photos.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:36px 0;font-size:12px;color:#aaa;">No photos found for ${s.name}</div>`;
    footer.textContent = 'Try Flickr or Wikimedia Commons directly';
    return;
  }
  grid.innerHTML = photos.map(p => `
    <a href="${p.page_url}" target="_blank" rel="noopener noreferrer" class="photo-card">
      <img src="${p.thumb}" alt="${p.title}" loading="lazy" onerror="this.closest('.photo-card').style.display='none'">
      <div class="photo-card-info">
        <div class="photo-card-title">${p.title}</div>
        ${p.author ? `<div class="photo-card-author">© ${p.author}</div>` : ''}
      </div>
      <div class="photo-card-src">Commons</div>
    </a>`).join('');
  footer.textContent = `${photos.length} photos · Wikimedia Commons (CC)`;
}

/* ── SHARE ── */
function openShare() {
  const s = SPOTS[activeId], now = new Date();
  const dateStr = now.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'});
  document.getElementById('share-preview').innerHTML = `<strong>Kite Forecast · ${dateStr}</strong><br><strong>${s.name}</strong> — ${s.region}<br>Wind: ${s.wind}/${s.gusts} kn ${s.dir} · ${s.status==='go'?'GO':'NO GO'}<br>Air: ${fmtT(s.airC)} · Water: ${fmtT(s.waterC)}<br>${s.goodStart?'Best: '+s.goodStart+'–'+s.goodEnd:'No window today'}<br>Waves: ${s.waves!=null?s.waves+'m':'—'} · Rain: ${s.rain}%`;
  document.getElementById('share-modal').className = 'share-modal-bg open';
}
function closeShare() { document.getElementById('share-modal').className = 'share-modal-bg'; }
function sendWhatsApp() {
  const s = SPOTS[activeId], now = new Date(), dateStr = now.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'});
  const msg = encodeURIComponent(`Kite Forecast ${dateStr}\nSpot: ${s.name} (${s.region})\nWind: ${s.wind}/${s.gusts} kn ${s.dir}\nStatus: ${s.status==='go'?'GO':s.status==='maybe'?'MAYBE':'NO GO'} (${s.score})\nAir: ${fmtT(s.airC)} · Water: ${fmtT(s.waterC)}\n${s.goodStart?'Best: '+s.goodStart+'–'+s.goodEnd:'No good window today'}\nWaves: ${s.waves!=null?s.waves+'m':'—'} · Rain: ${s.rain}%\n#kitesurfing`);
  window.open('https://wa.me/?text='+msg, '_blank'); closeShare();
}
function copyText() {
  const txt = document.getElementById('share-preview').innerText;
  if (navigator.clipboard) navigator.clipboard.writeText(txt);
  const btn = document.getElementById('copy-btn'); btn.textContent = 'Copied!';
  setTimeout(() => { btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="5" y="5" width="9" height="9" rx="2"/><path d="M11 5V3a2 2 0 00-2-2H3a2 2 0 00-2 2v6a2 2 0 002 2h2"/></svg> Copy'; }, 1600);
}

/* ── SEARCH ── */
function onSearch(v) {
  document.getElementById('sclr').style.display = v ? 'block' : 'none';
  const dr = document.getElementById('sdrop'); if (!v.trim()) { dr.className = 'sdrop'; return; }
  const q = v.toLowerCase(), hits = SPOTS.filter(s=>s.name.toLowerCase().includes(q)||s.region.toLowerCase().includes(q)).slice(0,5);
  if (!hits.length) { dr.innerHTML = `<div class="sdr" style="color:#888">No spots found</div>`; dr.className = 'sdrop open'; return; }
  dr.innerHTML = hits.map(s=>`<div class="sdr" onclick="selectSpot(${s.id});clearS()"><svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" style="opacity:.4"><path d="M7 1a4 4 0 014 4c0 4-4 8-4 8S3 9 3 5a4 4 0 014-4z"/><circle cx="7" cy="5" r="1.3"/></svg><div class="sdr-info"><div class="sdr-name">${s.name}</div><div class="sdr-sub">${s.region}</div></div><span class="sdr-pill" style="background:${SBG[s.status]};color:${STXT[s.status]}">${s.status==='go'?'Go':s.status==='maybe'?'Maybe':'No go'}</span></div>`).join('');
  dr.className = 'sdrop open';
}
function clearS() { document.getElementById('sinput').value = ''; document.getElementById('sclr').style.display = 'none'; document.getElementById('sdrop').className = 'sdrop'; }
document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) document.getElementById('sdrop').className = 'sdrop'; });

/* ── DRAG OVERLAY (prevents Leaflet from stealing mouse events during resize drags) ── */
const _dragOverlay = document.getElementById('drag-overlay');
function _startDrag(cls) { _dragOverlay.className = cls; document.body.style.userSelect = 'none'; }
function _endDrag()       { _dragOverlay.className = '';   document.body.style.userSelect = ''; }

/* ── COLUMN RESIZE ── */
let colDragging = false, colX0 = 0, colW0 = 0;
document.getElementById('col-resize').addEventListener('mousedown', e => {
  colDragging = true; colX0 = e.clientX; colW0 = document.getElementById('left-col').offsetWidth;
  _startDrag('col-drag');
  document.addEventListener('mousemove', onColDrag); document.addEventListener('mouseup', endColDrag); e.preventDefault();
});
function onColDrag(e) {
  if (!colDragging) return;
  const appW = document.getElementById('app').offsetWidth;
  const newW = Math.max(200, Math.min(appW-220, colW0+(e.clientX-colX0)));
  document.getElementById('left-col').style.width = newW+'px';
  drawMap(); renderPins(); renderMapRose(); computeZoneWidths();
}
function endColDrag() { colDragging = false; _endDrag(); document.removeEventListener('mousemove', onColDrag); document.removeEventListener('mouseup', endColDrag); }

/* ── ROW RESIZE (bottom panel height) ── */
let rowDragging = false, rowY0 = 0, rowH0 = 0;
const _bp = document.getElementById('bottom-panel');
const _rowHandle = document.getElementById('row-resize');
function _syncRowHandle() { /* handle is in normal flow — no position sync needed */ }
_rowHandle.addEventListener('mousedown', e => {
  rowDragging = true; rowY0 = e.clientY; rowH0 = _bp.offsetHeight;
  _bp.style.transition = 'none'; _rowHandle.classList.add('dragging');
  _startDrag('row-drag');
  document.addEventListener('mousemove', onRowDrag); document.addEventListener('mouseup', endRowDrag); e.preventDefault();
});
function onRowDrag(e) {
  if (!rowDragging) return;
  const mb = document.getElementById('main-body');
  const maxH = mb.offsetHeight - 180;
  const newH = Math.max(34, Math.min(maxH, rowH0 + (rowY0 - e.clientY)));
  _bp.style.height = newH + 'px';
  if (newH > 60 && !bpOpen) {
    bpOpen = true;
    document.getElementById('bp-body').style.display = '';
    _setBpCollapseIcon(true);
    document.getElementById('panel-toggle-btn')?.classList.remove('hidden-panel');
  }
}
function endRowDrag() {
  rowDragging = false; _endDrag(); _rowHandle.classList.remove('dragging');
  _bp.style.transition = '';
  document.removeEventListener('mousemove', onRowDrag); document.removeEventListener('mouseup', endRowDrag);
  const h = _bp.offsetHeight;
  if (h <= 60) {
    bpOpen = false; bpH = Math.max(bpH, 180);
    document.getElementById('bp-body').style.display = 'none';
    _bp.style.height = '34px';
    document.getElementById('row-resize').classList.add('bp-hidden');
    document.getElementById('panel-toggle-btn')?.classList.add('hidden-panel');
    _setBpCollapseIcon(false);
  } else { bpH = h; }
  renderBottomPanel();
}

/* ── ROW RESIZE — touch support ── */
function _onRowTouchMove(e) {
  if (!rowDragging) return;
  e.preventDefault();
  const mb = document.getElementById('main-body');
  const maxH = mb.offsetHeight - 180;
  const newH = Math.max(34, Math.min(maxH, rowH0 + (rowY0 - e.touches[0].clientY)));
  _bp.style.height = newH + 'px';
  if (newH > 60 && !bpOpen) {
    bpOpen = true;
    document.getElementById('bp-body').style.display = '';
    _setBpCollapseIcon(true);
    document.getElementById('panel-toggle-btn')?.classList.remove('hidden-panel');
  }
}
function _endRowTouch() {
  rowDragging = false; _rowHandle.classList.remove('dragging');
  _bp.style.transition = '';
  document.removeEventListener('touchmove', _onRowTouchMove);
  document.removeEventListener('touchend', _endRowTouch);
  const h = _bp.offsetHeight;
  if (h <= 60) {
    bpOpen = false; bpH = Math.max(bpH, 180);
    document.getElementById('bp-body').style.display = 'none';
    _bp.style.height = '34px';
    document.getElementById('row-resize').classList.add('bp-hidden');
    document.getElementById('panel-toggle-btn')?.classList.add('hidden-panel');
    _setBpCollapseIcon(false);
  } else { bpH = h; }
  renderBottomPanel();
}
_rowHandle.addEventListener('touchstart', e => {
  rowDragging = true; rowY0 = e.touches[0].clientY; rowH0 = _bp.offsetHeight;
  _bp.style.transition = 'none'; _rowHandle.classList.add('dragging');
  document.addEventListener('touchmove', _onRowTouchMove, {passive:false});
  document.addEventListener('touchend', _endRowTouch);
  e.preventDefault();
}, {passive:false});
document.getElementById('bp-head').addEventListener('touchstart', e => {
  if (e.target.closest('button,select,.bp-tab')) return;
  e.preventDefault();
  rowDragging = true; rowY0 = e.touches[0].clientY; rowH0 = _bp.offsetHeight;
  _bp.style.transition = 'none';
  document.addEventListener('touchmove', _onRowTouchMove, {passive:false});
  document.addEventListener('touchend', _endRowTouch);
}, {passive:false});
window.addEventListener('resize', () => setTimeout(() => { drawMap(); renderPins(); renderMapRose(); arrowParticles = []; computeZoneWidths(); }, 60));

/* ── BOOT ── */
function renderAll() { drawMap(); renderPins(); renderMapRose(); renderList(); renderWindLegend(); startAnimation(); renderBottomPanel(); }

// Initialize bottom panel height
document.getElementById('bottom-panel').style.height = bpH + 'px';

renderAll();
