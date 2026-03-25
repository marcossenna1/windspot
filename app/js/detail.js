/* ── DIRECTION → DEGREES MAP (shared) ── */
const _dirDeg = {N:0,NNE:22,NE:45,ENE:67,E:90,ESE:112,SE:135,SSE:157,S:180,SSW:202,SW:225,WSW:247,W:270,WNW:292,NW:315,NNW:337};

/* ── PANEL EYE ICONS ── */
// eye-slash = panel visible (click to hide) | eye = panel hidden (click to show)
const _SVG_EYE = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M1.5 8C3 5 5 3.5 8 3.5S13 5 14.5 8C13 11 11 12.5 8 12.5S3 11 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>`;
const _SVG_EYE_SLASH = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M1.5 8C3 5 5 3.5 8 3.5S13 5 14.5 8C13 11 11 12.5 8 12.5S3 11 1.5 8z"/><circle cx="8" cy="8" r="2"/><line x1="2.5" y1="13.5" x2="13.5" y2="2.5" stroke-width="1.9"/></svg>`;

/* ── BARB SVG ── */
function barbSvg(dir, kn) {
  const dm = {N:0,NNE:22,NE:45,ENE:67,E:90,ESE:112,SE:135,SSE:157,S:180,SSW:202,SW:225,WSW:247,W:270,WNW:292,NW:315,NNW:337};
  const deg = dm[dir]??270, r = deg*Math.PI/180, cx = 9, cy = 9, l = 6;
  const x2=cx+Math.sin(r)*l,y2=cy-Math.cos(r)*l,x1=cx-Math.sin(r)*l,y1=cy+Math.cos(r)*l;
  const hx=x2-Math.sin(r-.44)*3.5,hy=y2+Math.cos(r-.44)*3.5;
  const c=kn>=20?'#c0392b':kn>=13?'#c97d0a':'#2a9d5c';
  return `<svg width="18" height="18" viewBox="0 0 18 18" style="display:inline-block;vertical-align:middle"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="2" stroke-linecap="round"/><line x1="${x2}" y1="${y2}" x2="${hx}" y2="${hy}" stroke="${c}" stroke-width="2" stroke-linecap="round"/></svg>`;
}

/* ── DETAIL PANEL (Today only) ── */
function openDetail(id) {
  activeId = id; dpOpen = true; flyToSpot(id);
  if (!bpOpen) toggleBpCollapse();
  renderAll();
  const s = SPOTS[id];
  document.getElementById('dp-name').textContent = s.name;
  document.getElementById('dp-sub').textContent = `${s.region} · ${s.dir} · ${s.rain}% rain`;
  const pill = document.getElementById('dp-pill');
  pill.textContent = `${s.status==='go'?'Go':s.status==='maybe'?'Maybe':'No go'} · ${s.score}`;
  pill.style.background = SBG[s.status]; pill.style.color = STXT[s.status];
  renderDpToday();
  _syncDpButtons(s);
  document.getElementById('dp').classList.add('open');
}
function closeDetail() { dpOpen = false; document.getElementById('dp').classList.remove('open'); }
function setDpTab(t) { dpTab = t; if (t === 'today') renderDpToday(); }

function _syncDpButtons(s) {
  const favBtn  = document.getElementById('dp-fav-btn');
  const privBtn = document.getElementById('dp-priv-btn');
  if (!favBtn || !privBtn) return;
  // Favourite
  if (s.fav) {
    favBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="#f5c518" stroke="#d4a800" stroke-width="1"><path d="M8 1l1.85 3.75 4.15.6-3 2.93.7 4.1L8 10.27l-3.7 1.94.7-4.1L2 5.35l4.15-.6z"/></svg>`;
    favBtn.classList.add('active');
  } else {
    favBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M8 1l1.85 3.75 4.15.6-3 2.93.7 4.1L8 10.27l-3.7 1.94.7-4.1L2 5.35l4.15-.6z"/></svg>`;
    favBtn.classList.remove('active');
  }
  // Private / Shared
  if (s.isPrivate) {
    privBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="7" width="10" height="8" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/></svg><span>Private</span>`;
    privBtn.classList.add('private');
  } else {
    privBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="7" width="10" height="8" rx="1.5"/><path d="M5 7V5a3 3 0 016 0" /><line x1="11" y1="4" x2="13" y2="2"/></svg><span>Shared</span>`;
    privBtn.classList.remove('private');
  }
}
function toggleFav() {
  const s = SPOTS[activeId]; s.fav = !s.fav;
  _syncDpButtons(s); renderList();
}
function togglePrivate() {
  const s = SPOTS[activeId]; s.isPrivate = !s.isPrivate;
  _syncDpButtons(s);
}

/* ── BOTTOM PANEL (Pro + 7-day) ── */
function updateBpHead() {
  const s = SPOTS[activeId];
  document.getElementById('bp-spot-name').textContent = s.name;
  const pill = document.getElementById('bp-pill');
  pill.textContent = `${s.status==='go'?'Go':s.status==='maybe'?'Maybe':'No go'} · ${s.score}`;
  pill.style.background = SBG[s.status]; pill.style.color = STXT[s.status];
}
function setBpTab(t) {
  bpTab = t;
  ['pro','week','wg'].forEach(k => {
    const el = document.getElementById('bpt-'+k);
    if (el) el.className = 'bp-tab' + (k === t ? ' active' : '');
  });
  const nav = document.getElementById('bp-nav-btns');
  if (nav) nav.style.display = t === 'pro' ? '' : 'none';
  renderBottomPanel();
}
function renderBottomPanel() {
  updateBpHead();
  if (!bpOpen) return;
  if (bpTab === 'pro')  renderBpPro();
  else if (bpTab === 'wg') renderBpWindguru();
  else                  renderBpWeek();
}
function renderBpWindguru() {
  const url = 'https://www.windguru.cz/62';
  const body = document.getElementById('bp-body');
  body.innerHTML = `
    <div style="position:relative;width:100%;height:100%;min-height:200px;display:flex;flex-direction:column;">
      <div id="wg-blocked" style="display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;height:100%;padding:24px;text-align:center;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1" fill="#aaa"/></svg>
        <div style="font-size:12px;color:#888;">WindGuru bloqueou o embedding (X-Frame-Options).</div>
        <a href="${url}" target="_blank" rel="noopener noreferrer"
           style="font-size:12px;color:#00629B;text-decoration:none;border:1px solid #00629B;padding:5px 14px;border-radius:6px;">
          Abrir WindGuru numa nova aba ↗
        </a>
      </div>
      <iframe id="wg-frame" src="${url}"
        style="flex:1;width:100%;border:none;border-radius:0 0 8px 8px;"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        loading="lazy"
        onload="document.getElementById('wg-blocked').style.display='none';"
        onerror="document.getElementById('wg-blocked').style.display='flex';document.getElementById('wg-frame').style.display='none';">
      </iframe>
    </div>`;
  /* detect CSP/X-Frame block after short delay */
  setTimeout(() => {
    const f = document.getElementById('wg-frame');
    if (!f) return;
    try {
      const doc = f.contentDocument || f.contentWindow?.document;
      if (!doc || doc.URL === 'about:blank') throw new Error('blocked');
    } catch {
      document.getElementById('wg-blocked').style.display = 'flex';
      f.style.display = 'none';
    }
  }, 2500);
}
/* sync icon on all matching buttons */
function _setBpCollapseIcon(open) {
  ['bp-collapse','panel-toggle-btn'].forEach(id => {
    const btn = document.getElementById(id); if (!btn) return;
    btn.innerHTML = open ? _SVG_EYE_SLASH : _SVG_EYE;
    btn.title     = open ? 'Hide panel'   : 'Show panel';
  });
}

/* ── GUARD: map + list both hidden → restore list full-width ── */
let _listVisible = true, _mapVisible = true;
function _checkAllHidden() {
  if (!_listVisible && !_mapVisible) {
    _listVisible = true;
    document.getElementById('right-col').classList.remove('list-hidden');
    document.getElementById('left-col').classList.remove('list-gone');
    const btn = document.getElementById('list-toggle-btn');
    btn.innerHTML = _SVG_EYE_SLASH; btn.title = 'Hide spot list';
    btn.classList.remove('hidden-panel');
    setTimeout(() => { computeZoneWidths(); }, 60);
  }
}

/* ── SPOT LIST TOGGLE ── */
function toggleListPanel() {
  _listVisible = !_listVisible;
  document.getElementById('right-col').classList.toggle('list-hidden', !_listVisible);
  document.getElementById('left-col').classList.toggle('list-gone', !_listVisible);
  const btn = document.getElementById('list-toggle-btn');
  btn.innerHTML = _listVisible ? _SVG_EYE_SLASH : _SVG_EYE;
  btn.title     = _listVisible ? 'Hide spot list' : 'Show spot list';
  btn.classList.toggle('hidden-panel', !_listVisible);
  setTimeout(() => { if (typeof _map !== 'undefined' && _map) _map.invalidateSize(); computeZoneWidths(); drawMap(); renderPins(); renderMapRose(); }, 60);
  _checkAllHidden();
}

/* ── MAP TOGGLE ── */
function toggleMapPanel() {
  _mapVisible = !_mapVisible;
  document.getElementById('left-col').classList.toggle('map-hidden', !_mapVisible);
  const btn = document.getElementById('map-toggle-btn');
  btn.classList.toggle('hidden-panel', !_mapVisible);
  btn.title = _mapVisible ? 'Hide map' : 'Show map';
  setTimeout(() => { if (typeof _map !== 'undefined' && _map) _map.invalidateSize(); computeZoneWidths(); drawMap(); renderPins(); renderMapRose(); }, 60);
  _checkAllHidden();
}

/* ── BOTTOM PANEL TOGGLE — bp-head always visible, only bp-body hides ── */
function toggleBpCollapse() {
  bpOpen = !bpOpen;
  const panel  = document.getElementById('bottom-panel');
  const body   = document.getElementById('bp-body');
  const rr     = document.getElementById('row-resize');
  if (bpOpen) {
    body.style.display = '';
    panel.style.height = bpH + 'px';
    rr.classList.remove('bp-hidden');
    _setBpCollapseIcon(true);
    document.getElementById('panel-toggle-btn').classList.remove('hidden-panel');
    renderBottomPanel();
  } else {
    bpH = panel.offsetHeight > 40 ? panel.offsetHeight : bpH;
    body.style.display = 'none';
    panel.style.height = '34px';
    rr.classList.add('bp-hidden');
    _setBpCollapseIcon(false);
    document.getElementById('panel-toggle-btn').classList.add('hidden-panel');
  }
  _checkAllHidden();
}

function renderDpToday() {
  const s = SPOTS[activeId];
  const avg = Math.round((s.wind+s.gusts)/2), bg = wBg(avg), dot = Math.min(96,Math.max(2,(s.wind/50)*100));
  const vals = s.hours.length ? s.hours : Array(12).fill(0);
  const mx = Math.max(...vals)+4, mn = Math.max(0,Math.min(...vals)-2), CW = 400, CH = 50;
  const pts = vals.map((v,i) => [(i/(vals.length-1))*(CW-20)+10, CH-5-((v-mn)/(mx-mn||1))*(CH-14)]);
  const ln = pts.map((p,i) => i===0?`M${p[0]},${p[1]}`:`L${p[0]},${p[1]}`).join(' ');
  const ar2 = ln+` L${pts[pts.length-1][0]},${CH} L10,${CH} Z`;
  const iy1 = CH-5-((28-mn)/(mx-mn||1))*(CH-14), iy2 = CH-5-((14-mn)/(mx-mn||1))*(CH-14);
  document.getElementById('dp-body').innerHTML = `
    ${s.desc ? `<div style="font-size:11px;color:#555;line-height:1.55;padding:8px 10px;background:#f7f7f9;border-radius:8px;margin-top:8px;margin-bottom:2px;">${s.desc}</div>` : ''}
    ${(s.camUrl || s.localUrl) ? `<div style="display:flex;gap:8px;margin-top:4px;margin-bottom:2px;flex-wrap:wrap;">${s.camUrl?`<a href="${s.camUrl}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#378add;text-decoration:none;display:flex;align-items:center;gap:3px;"><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="4" width="10" height="8" rx="1.5"/><path d="M11 7l4-2v6l-4-2"/></svg>Camera</a>`:''}${s.localUrl?`<a href="${s.localUrl}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#378add;text-decoration:none;display:flex;align-items:center;gap:3px;"><svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 1a5 5 0 015 5c0 5-5 9-5 9S3 11 3 6a5 5 0 015-5z"/><circle cx="8" cy="6" r="1.5"/></svg>Local info</a>`:''}` + '</div>' : ''}
    <div class="dm-grid" style="margin-top:8px;">
      <div style="background:${bg};border-radius:8px;padding:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:72px;">
        <div style="font-size:10px;color:rgba(255,255,255,.7);margin-bottom:4px;">Wind · ${s.dir}</div>
        <svg viewBox="0 0 60 60" width="52" height="52">${compassRingSVG(30,30,24,s.dirDeg,SC[s.status],0.7)}</svg>
        <div style="font-size:10px;color:rgba(255,255,255,.7);margin-top:3px;">${s.wind}/${s.gusts} kn</div>
      </div>
      <div class="dm"><div class="dm-lbl">Rain</div><div class="dm-val">${s.rain}%</div><div class="dm-sub">${s.rain<15?'Dry':'Possible'}</div></div>
      <div class="dm"><div class="dm-lbl">Waves</div><div class="dm-val">${s.waves!=null?s.waves+'m':'—'}</div><div class="dm-sub">${s.period!=null?s.period+'s':'—'}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:6px;margin-bottom:10px;">
      <div class="dm"><div class="dm-lbl">Air temp</div><div class="dm-val">${fmtT(s.airC)}</div></div>
      <div class="dm"><div class="dm-lbl">Water temp</div><div class="dm-val">${fmtT(s.waterC)}</div></div>
      <div class="dm"><div class="dm-lbl">Tide</div><div class="dm-val" id="dp-tide" style="font-size:13px;line-height:1.3">…</div></div>
      <div class="dm has-tip" data-tip="Average depth at MLLW · varies ±1–2 m with tide">
        <div class="dm-lbl">Depth</div>
        <div class="dm-val" style="color:${depthColor(s.depth_m)}">${s.depth_m != null ? '~' + s.depth_m + ' m' : '—'}</div>
        <div class="dm-sub">${depthLabel(s.depth_m)}</div>
      </div>
    </div>
    <div class="sec-lbl" style="margin-bottom:4px">Tide today</div>
    <div id="dp-tide-chart" style="margin-bottom:8px;min-height:32px"><div style="font-size:11px;color:#aaa;padding:4px 0">Loading…</div></div>
    <div style="margin:8px 0 10px;">
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#888;margin-bottom:4px;"><span>0 kn</span><span>wind vs ideal range</span><span>50 kn</span></div>
      <div class="rbar"><div class="rbar-ideal" style="left:28%;width:28%"></div><div class="rbar-dot" style="left:${dot}%;background:${SC[s.status]}"></div></div>
    </div>
    <div class="sec-lbl">Best windows</div>
    <div class="win-row">${s.allW.length?s.allW.map(w=>`<span class="wc${s.windows.includes(w)?' best':''}">${w}</span>`).join(''):'<span style="font-size:11px;color:#c0392b">No good windows</span>'}</div>
    <div class="sec-lbl">Wind today</div>
    <svg width="100%" viewBox="0 0 400 50" preserveAspectRatio="none" style="margin-bottom:8px;">
      <rect x="10" y="${Math.min(iy1,iy2)}" width="380" height="${Math.abs(iy2-iy1)}" fill="rgba(42,157,92,.1)"/>
      <path d="${ar2}" fill="rgba(55,138,221,.12)"/><path d="${ln}" fill="none" stroke="#378add" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map((p,i) => { const v=vals[i],sc=v>=14&&v<=30?'go':v>=9?'maybe':'nogo';return `<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="${SC[sc]}"/>`; }).join('')}
    </svg>
    <div class="sec-lbl" style="margin-bottom:4px">Hourly</div>
    <table class="htbl"><thead><tr><th>Time</th><th style="text-align:center">Wind/Gust</th><th style="text-align:center">Dir</th><th style="text-align:center">Rain</th><th></th></tr></thead>
    <tbody>${s.hr.map(h=>`<tr class="${h.s==='go'?'bh':''}"><td>${h.t}:00</td><td class="wch" style="background:${wBg(h.w)};color:#fff;">${h.w}/${h.g}</td><td style="text-align:center">${barbSvg(h.d,h.w)}</td><td style="text-align:center;background:${rBg(h.r)}">${h.r}%</td><td style="text-align:center"><span style="width:8px;height:8px;border-radius:50%;display:inline-block;background:${SC[h.s]}"></span></td></tr>`).join('')}</tbody></table>`;
  loadTide(activeId);
}

function _renderTideChart(predictions) {
  const el = document.getElementById('dp-tide-chart');
  if (!el) return;
  if (!predictions || predictions.length < 2) {
    el.innerHTML = '<div style="font-size:11px;color:#aaa;padding:4px 0">Tide data unavailable</div>';
    return;
  }

  const CW = 400, CH = 86, PAD_TOP = 18, PAD_BOT = 18, PAD_SIDE = 8;

  const pts = predictions.map(p => {
    const d = new Date(p.t.replace(' ', 'T'));
    const mins = d.getHours() * 60 + d.getMinutes();
    return { mins, v: parseFloat(p.v), type: p.type };
  }).sort((a, b) => a.mins - b.mins);

  const allV = pts.map(p => p.v);
  const mn = Math.min(...allV) - 0.05, mx = Math.max(...allV) + 0.05;
  const toX = m => PAD_SIDE + (m / 1440) * (CW - PAD_SIDE * 2);
  const toY = v => PAD_TOP + (1 - (v - mn) / (mx - mn)) * (CH - PAD_TOP - PAD_BOT);

  // Cosine-interpolated curve between consecutive H/L turning points
  const STEPS = 80;
  const pathPts = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    for (let s = 0; s <= STEPS; s++) {
      const t = s / STEPS;
      const mins = a.mins + t * (b.mins - a.mins);
      const v = a.v + (b.v - a.v) * (1 - Math.cos(t * Math.PI)) / 2;
      pathPts.push([toX(mins), toY(v)]);
    }
  }

  const ln = pathPts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pathPts[pathPts.length - 1], first = pathPts[0];
  const baseY = (CH - PAD_BOT + 2).toFixed(1);
  const area = `${ln} L${last[0].toFixed(1)},${baseY} L${first[0].toFixed(1)},${baseY} Z`;

  // Current time marker
  const now = new Date();
  const nowX = toX(now.getHours() * 60 + now.getMinutes()).toFixed(1);

  // H/L dot labels
  const dotLabels = pts.map(p => {
    const x = toX(p.mins).toFixed(1);
    const y = toY(p.v);
    const hh = String(Math.floor(p.mins / 60)).padStart(2, '0');
    const mm = String(p.mins % 60).padStart(2, '0');
    const isH = p.type === 'H';
    const valY  = (isH ? y - 10 : y + 20).toFixed(1);
    const timeY = (isH ? y - 2  : y + 11).toFixed(1);
    return `<circle cx="${x}" cy="${y.toFixed(1)}" r="3" fill="#378add" stroke="#fff" stroke-width="1.2"/>
      <text x="${x}" y="${valY}" text-anchor="middle" font-size="8" fill="#378add" font-family="sans-serif" font-weight="600">${p.v.toFixed(1)}m</text>
      <text x="${x}" y="${timeY}" text-anchor="middle" font-size="8" fill="#888" font-family="sans-serif">${p.type} ${hh}:${mm}</text>`;
  }).join('');

  // Hour grid lines and tick labels
  const hourTicks = [0, 6, 12, 18].map(h => {
    const x = toX(h * 60).toFixed(1);
    return `<line x1="${x}" y1="${PAD_TOP}" x2="${x}" y2="${baseY}" stroke="rgba(0,0,0,.06)" stroke-width="1"/>
      <text x="${x}" y="${CH - 4}" text-anchor="middle" font-size="8" fill="#bbb" font-family="sans-serif">${h === 0 ? '0h' : h + 'h'}</text>`;
  }).join('');

  el.innerHTML = `
    <svg width="100%" viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="none" style="display:block;margin-bottom:4px;">
      ${hourTicks}
      <path d="${area}" fill="rgba(55,138,221,.1)"/>
      <path d="${ln}" fill="none" stroke="#378add" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <line x1="${nowX}" y1="${PAD_TOP}" x2="${nowX}" y2="${baseY}" stroke="rgba(201,125,10,.7)" stroke-width="1.5" stroke-dasharray="3,2"/>
      ${dotLabels}
    </svg>`;
}

function loadTide(id) {
  const el = document.getElementById('dp-tide');
  if (!el) return;
  const slug = SPOTS[id]?.slug;
  if (!slug) { el.textContent = '—'; return; }
  el.textContent = '…';
  fetch(`${API_BASE}/api/tide?spot=${slug}`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!el.isConnected) return;  // panel closed before response
      const preds = data?.predictions ?? [];
      // Next tide cell
      const now = new Date();
      const next = preds.find(p => new Date(p.t) > now);
      if (!next) { el.textContent = '—'; } else {
        const time = new Date(next.t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const arrow = next.type === 'H' ? '↑' : '↓';
        const label = next.type === 'H' ? 'High' : 'Low';
        el.innerHTML = `${arrow} ${label}<br><span style="font-weight:600">${time}</span><br><span style="font-size:10px;color:#888">${parseFloat(next.v).toFixed(1)} m</span>`;
      }
      // Tide chart
      _renderTideChart(preds);
    })
    .catch(() => { if (el.isConnected) el.textContent = '—'; });
}

function setBpFontSize(delta) {
  bpFontSize = Math.max(8, Math.min(14, bpFontSize + delta));
  localStorage.setItem('wsp_bp_fs', bpFontSize);
  if (bpTab === 'pro') renderBpPro();
}
function toggleBpLegend() {
  bpShowLegend = !bpShowLegend;
  const btn = document.getElementById('bp-legend-btn');
  if (btn) {
    btn.classList.toggle('active', bpShowLegend);
    btn.title = bpShowLegend ? 'Hide legend' : 'Show legend';
  }
  if (bpTab === 'pro') renderBpPro();
}
function toggleBpLabelSide() {
  bpLabelSide = bpLabelSide === 'left' ? 'right' : 'left';
  localStorage.setItem('wsp_bp_side', bpLabelSide);
  _updateBpSideBtn();
  if (bpTab === 'pro') renderBpPro();
}
function _updateBpSideBtn() {
  const btn = document.getElementById('bp-side-btn');
  if (btn) btn.innerHTML = bpLabelSide === 'left' ? '&#8594;' : '&#8592;';
}

/* ── DATE/TIME TICKER ── */
function _updateBpDatetime() {
  const el = document.getElementById('bp-datetime'); if (!el) return;
  const n = new Date();
  const _D = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const _M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  el.textContent = `${_D[n.getDay()]} ${n.getDate()} ${_M[n.getMonth()]} · ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}
_updateBpDatetime();
setInterval(_updateBpDatetime, 30000);

/* ── FORECAST SCROLL HELPERS ── */
function bpScrollDay(dir) {
  const wrap = document.getElementById('bp-scroll'); if (!wrap) return;
  const hdr = wrap.querySelector('.bp-day-hdr');
  wrap.scrollBy({ left: dir * (hdr ? hdr.offsetWidth : 220), behavior: 'smooth' });
}
function bpScrollNow() {
  const wrap = document.getElementById('bp-scroll'); if (!wrap) return;
  const line = document.getElementById('bp-now-line');
  if (line && line.style.display !== 'none') {
    const lx = parseInt(line.style.left) || 0;
    wrap.scrollTo({ left: Math.max(0, lx - wrap.offsetWidth / 3), behavior: 'smooth' });
  }
}

function renderBpPro() {
  const s = SPOTS[activeId];
  if (!s || !s.hr || !s.hr.length) {
    document.getElementById('bp-body').innerHTML = '<p style="color:#888;padding:16px;font-size:12px;">No hourly data available yet.</p>';
    return;
  }

  // Show nav buttons
  const navBtns = document.getElementById('bp-nav-btns');
  if (navBtns) navBtns.style.display = '';

  const now = new Date();
  const nowDate = now.toISOString().slice(0, 10);
  const nowHour = now.getHours();
  const fs = bpFontSize, side = bpLabelSide;
  const border = side === 'left' ? 'border-right' : 'border-left';
  const lblBg  = 'var(--bg,#fff)';
  const lblStyle = `position:sticky;${side}:0;z-index:2;background:${lblBg};font-size:${fs}px;font-weight:500;color:#888;padding:4px 8px;${border}:0.5px solid #e0e0e2;white-space:nowrap;min-width:${fs*7}px;`;
  const row = (lbl, cells) => side === 'left'
    ? `<tr><td style="${lblStyle}">${lbl}</td>${cells}</tr>`
    : `<tr>${cells}<td style="${lblStyle}">${lbl}</td></tr>`;

  // Build week lookup for per-day sunrise/sunset
  const weekMap = {};
  (s.week || []).forEach(d => { if (d.date) weekMap[d.date] = d; });
  const fallSR = s.sunrise ? parseInt(s.sunrise) : 6;
  const fallSS = s.sunset  ? parseInt(s.sunset)  : 19;

  // Group hourly data by day, filtering to daylight only
  const _DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const _MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayGroups = [];
  s.hr.forEach(h => {
    if (!h.date) return;
    const wk = weekMap[h.date];
    const srH = wk?.sunriseH ?? fallSR;
    const ssH = wk?.sunsetH  ?? fallSS;
    const hNum = parseInt(h.t);
    if (hNum < srH || hNum > ssH) return;
    let g = dayGroups.find(x => x.date === h.date);
    if (!g) {
      const dateObj = new Date(h.date + 'T12:00:00');
      const dayLabel = _DAY[dateObj.getDay()];
      g = { date: h.date, label: `${dayLabel} · ${dateObj.getDate()} ${_MON[dateObj.getMonth()]}`,
            isToday: h.date === nowDate, hours: [], srH, ssH };
      dayGroups.push(g);
    }
    g.hours.push(h);
  });

  if (!dayGroups.length) {
    document.getElementById('bp-body').innerHTML = '<p style="color:#888;padding:16px;font-size:12px;">No daylight data yet.</p>';
    return;
  }

  const allH = dayGroups.flatMap(g => g.hours.map(h => ({ ...h, _g: g })));
  const isLast = (i) => i === allH.length - 1 || allH[i+1]._g.date !== allH[i]._g.date;
  const dayBr  = (i) => isLast(i) ? 'border-right:2px solid #c8c8cc;' : 'border-right:0.5px solid #ebebed;';

  // Legend cell repeated at the start of each day
  const legS = `background:var(--bg2,#f5f5f7);font-size:${Math.max(8,fs-1)}px;color:#aaa;font-weight:500;padding:3px 5px;text-align:center;white-space:nowrap;border-right:1px solid #d0d0d2;vertical-align:middle;font-style:italic;`;
  const buildRow = (miniLabel, cellFn) => allH.reduce((acc, h, i) => {
    const firstOfDay = !i || allH[i-1]._g.date !== h._g.date;
    const cell = cellFn(h, i).replace(/^<td/, `<td data-hidx="${i}"`);
    return acc + (bpShowLegend && firstOfDay ? `<td class="bp-leg" style="${legS}">${miniLabel}</td>` : '') + cell;
  }, '');

  const _wBgA = k => k<=8?'rgba(42,106,160,.28)':k<=13?'rgba(26,136,112,.28)':k<=18?'rgba(42,157,92,.28)':k<=24?'rgba(184,160,0,.28)':k<=30?'rgba(201,104,0,.28)':k<=36?'rgba(184,48,16,.28)':'rgba(139,0,0,.28)';
  const proCompass = r => {
    const deg = _dirDeg[r.d] ?? 0, col = SC[r.s];
    return `<div style="position:relative;width:44px;height:44px;margin:0 auto;">` +
      `<svg style="position:absolute;inset:0;width:100%;height:100%;" viewBox="0 0 44 44">${compassRingSVG(22,22,19,deg,col,.65,'90,90,90',false)}</svg>` +
      `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;">` +
      `<span style="font-size:13px;font-weight:700;line-height:1;color:${STXT[r.s]}">${r.w}</span>` +
      `<span style="font-size:9px;line-height:1.4;color:${col};font-weight:500">/${r.g}</span>` +
      `</div></div>`;
  };

  // Day header row — colspan grows by 1 when legend is visible
  const extraCol = bpShowLegend ? 1 : 0;
  const labelTh = `<th style="${lblStyle}background:var(--bg2,#f5f5f7);"></th>`;
  const dayHdrs = dayGroups.map(g => {
    const bg = g.isToday ? 'rgba(42,157,92,.07)' : 'var(--bg2,#f5f5f7)';
    const br = `border-right:2px solid ${g.isToday?'rgba(42,157,92,.35)':'#c8c8cc'};`;
    return `<th colspan="${g.hours.length + extraCol}" class="bp-day-hdr" style="text-align:center;font-size:${fs}px;font-weight:600;padding:4px 6px;background:${bg};border-bottom:1px solid #e0e0e2;${br}white-space:nowrap;">${g.label}</th>`;
  }).join('');
  const dayHdrRow = side==='left' ? `<tr>${labelTh}${dayHdrs}</tr>` : `<tr>${dayHdrs}${labelTh}</tr>`;

  // All rows built via buildRow — inserts a mini-legend cell at each day start
  const _hgSvg = `<svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M1 0h8v1.5L5.5 4.8 9 8.5V12H1V8.5L4.5 4.8 1 1.5V0zm1.5 1.2l2.5 3 2.5-3h-5zm0 9.3h5L7 8.2 5 6.3 3 8.2l-0.5 2.3z"/></svg>`;
  const hourCells  = buildRow(_hgSvg, (h,i) => {
    const isNow   = h.date===nowDate && parseInt(h.t)===nowHour;
    const isFirst = !i || allH[i-1]._g.date !== h._g.date;
    const icon    = isFirst ? '🌅' : isLast(i) ? '🌇' : '';
    const bg      = isNow ? 'background:rgba(220,30,30,.08);' : '';
    return `<td ${isNow?'id="bp-now-cell"':''} style="cursor:pointer;text-align:center;font-size:${fs}px;color:#888;padding:2px 3px;${dayBr(i)}${bg}white-space:nowrap;">${icon?`<div style="font-size:9px;line-height:1">${icon}</div>`:''}${h.t}h</td>`;
  });
  const windCells  = buildRow('kn',  (h,i) => `<td style="text-align:center;padding:2px 1px;background:${_wBgA(h.w)};${dayBr(i)}">${proCompass(h)}</td>`);
  const rainCells  = buildRow('%',    (h,i) => `<td style="text-align:center;background:${rBg(h.r)};font-size:${fs}px;padding:4px 2px;${dayBr(i)}">${h.r}</td>`);
  const rainMmCells= buildRow('mm/h', (h,i) => `<td style="text-align:center;background:${rMmBg(h.rmm)};font-size:${fs}px;padding:4px 2px;${dayBr(i)}">${h.rmm!=null?h.rmm:'—'}</td>`);
  const cloudCells = buildRow('☁',   (h,i) => `<td style="text-align:center;background:${cloudBg(h.cloud)};font-size:${fs}px;padding:4px 2px;${dayBr(i)}">${h.cloud!=null?h.cloud+'%':'—'}</td>`);
  const waveCells  = buildRow('〜',  (h,i) => `<td style="text-align:center;background:${waveBg(h.wave)};font-size:${fs}px;padding:4px 2px;${dayBr(i)}">${h.wave!=null?h.wave+'m':'—'}</td>`);
  const airCells   = buildRow('air',  (h,i) => `<td style="text-align:center;font-size:${fs}px;color:#333;font-weight:500;padding:4px 2px;background:${tempBg(h.airC)};${dayBr(i)}">${fmtTv(h.airC)}</td>`);
  const waterCells = buildRow('H₂O', (h,i) => `<td style="text-align:center;font-size:${fs}px;color:#333;font-weight:500;padding:4px 2px;background:${tempBg(s.waterC)};${dayBr(i)}">${fmtTv(s.waterC)}</td>`);
  const scoreCells = buildRow('●',   (h,i) => `<td style="text-align:center;padding:4px 2px;${dayBr(i)}"><span style="width:9px;height:9px;border-radius:50%;display:inline-block;background:${SC[h.s]}"></span></td>`);

  const tbl = `<table id="bp-table" style="border-collapse:collapse;font-size:${fs}px;">
    <thead>${dayHdrRow}${row('Hour',hourCells)}</thead>
    <tbody>
      ${row('Wind',windCells)}
      ${row('Rain %',rainCells)}
      ${row('Rain mm/h',rainMmCells)}
      ${row('Cloud',cloudCells)}
      ${row('Wave',waveCells)}
      ${row('Air '+tempUnit,airCells)}
      ${row('Water '+tempUnit,waterCells)}
      ${row('Score',scoreCells)}
    </tbody>
  </table>
  <div id="bp-now-line" style="position:absolute;top:0;bottom:0;width:2px;background:rgba(210,30,30,.7);pointer-events:none;display:none;z-index:3;"></div>`;

  document.getElementById('bp-body').innerHTML =
    `<div id="bp-scroll" style="overflow-x:auto;position:relative;cursor:grab;user-select:none;">${tbl}</div>`;

  // Position now-line, auto-scroll, and wire mouse-drag scroll
  setTimeout(() => {
    const wrap = document.getElementById('bp-scroll');
    const nowCell = document.getElementById('bp-now-cell');
    const line    = document.getElementById('bp-now-line');
    if (wrap && nowCell && line) {
      const lx = nowCell.offsetLeft + nowCell.offsetWidth / 2 - 1;
      line.style.left = lx + 'px'; line.style.display = 'block';
      wrap.scrollLeft = Math.max(0, lx - wrap.offsetWidth / 3);
    }
    if (!wrap) return;
    let drag = false, sx = 0, sl = 0, hasDragged = false;
    wrap.addEventListener('mousedown', e => { drag=true; sx=e.pageX; sl=wrap.scrollLeft; hasDragged=false; wrap.style.cursor='grabbing'; e.preventDefault(); });
    document.addEventListener('mouseup', () => { drag=false; if(wrap) wrap.style.cursor='grab'; });
    wrap.addEventListener('mousemove', e => { if(!drag) return; if(Math.abs(e.pageX-sx)>4) hasDragged=true; wrap.scrollLeft = sl-(e.pageX-sx); });
    wrap.addEventListener('click', e => {
      if (hasDragged) return;
      const td = e.target.closest('td[data-hidx]');
      if (td) selectForecastHour(parseInt(td.dataset.hidx));
    });
  }, 80);
}

/* ── FORECAST COLUMN SELECTION ── */
const _DAY_S  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const _MON_S  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function _highlightCol(hidx, on) {
  document.querySelectorAll(`#bp-scroll td[data-hidx="${hidx}"]`).forEach(td => {
    td.style.boxShadow = on ? 'inset 0 0 0 2px rgba(42,157,92,.65)' : '';
  });
}

function _updateMapForecastLabel(hd) {
  const el = document.getElementById('map-forecast-label');
  if (!el) return;
  if (!hd) { el.style.display = 'none'; return; }
  const dateObj = new Date(hd.date + 'T12:00:00');
  el.textContent = `${_DAY_S[dateObj.getDay()]} · ${dateObj.getDate()} ${_MON_S[dateObj.getMonth()]} · ${hd.t}h`;
  el.style.display = 'block';
}

function selectForecastHour(i) {
  const s = SPOTS[activeId];
  const h = s.hr[i];
  if (!h) return;
  // Toggle off if same column clicked again
  if (selHidx === i) {
    _highlightCol(i, false);
    selHidx = null;
    selectedHourData = null;
    _updateMapForecastLabel(null);
    renderMapRose();
    startAnimation();
    return;
  }
  // Deselect previous
  if (selHidx !== null) _highlightCol(selHidx, false);
  selHidx = i;
  _highlightCol(i, true);
  selectedHourData = { date: h.date, t: h.t, w: h.w, g: h.g, d: h.d, dirDeg: h.dDeg ?? _dirDeg[h.d] ?? 0 };
  _updateMapForecastLabel(selectedHourData);
  renderMapRose();
  startAnimation();
}

function renderBpWeek() {
  const s = SPOTS[activeId], w = s.week;
  if (!w.length) {
    document.getElementById('bp-body').innerHTML = '<p style="color:#888;padding:16px;font-size:12px;">7-day data loading…</p>';
    return;
  }
  const vals = w.map(d => d.kn), mx = Math.max(...vals) || 10;
  const CW = 300, CH = 100, CS = 38; // chart dims + compass size px
  // Point positions: y padded so compasses (radius CS/2) stay inside container
  const pad = CS / 2 + 2;
  const pts = w.map((d,i) => [
    (i/(w.length-1))*(CW-30)+15,
    (CH-pad) - (d.kn/(mx+4))*((CH-pad)-pad)
  ]);
  const ln  = pts.map((p,i) => `${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const ar2 = ln + ` L${pts[pts.length-1][0].toFixed(1)},${CH} L${pts[0][0].toFixed(1)},${CH} Z`;
  const iy1 = (CH-pad)-(28/(mx+4))*((CH-pad)-pad), iy2 = (CH-pad)-(14/(mx+4))*((CH-pad)-pad);
  const f3 = w.slice(0,3).reduce((a,d)=>a+d.kn,0)/3, l3 = w.slice(4).reduce((a,d)=>a+d.kn,0)/3;
  const tr  = l3>f3+2?'Building':l3<f3-2?'Dropping':'Stable';

  // Mini-compass for week view (no gusts — daily summary)
  const weekCompass = d => {
    const deg = _dirDeg[d.dir] ?? 0, col = SC[d.s], txt = STXT[d.s];
    return `<div style="position:relative;width:${CS}px;height:${CS}px;">` +
      `<svg style="position:absolute;inset:0;width:100%;height:100%;" viewBox="0 0 ${CS} ${CS}">${compassRingSVG(CS/2,CS/2,CS/2-2,deg,col,.65,'90,90,90',false)}</svg>` +
      `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">` +
      `<span style="font-size:11px;font-weight:700;color:${txt}">${d.kn}</span>` +
      `</div></div>`;
  };

  document.getElementById('bp-body').innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:11px;margin:8px 0 4px;">
      <span style="font-weight:500;color:#555">7-day wind trend</span>
      <span style="color:${l3>f3+2?'#2a9d5c':l3<f3-2?'#c0392b':'#888'};font-size:10px;">${tr}</span>
    </div>
    <div style="position:relative;height:${CH}px;margin-bottom:2px;">
      <svg style="position:absolute;inset:0;width:100%;height:100%;" viewBox="0 0 ${CW} ${CH}" preserveAspectRatio="none">
        <rect x="15" y="${Math.min(iy1,iy2).toFixed(1)}" width="270" height="${Math.abs(iy2-iy1).toFixed(1)}" fill="rgba(42,157,92,.08)"/>
        <path d="${ar2}" fill="rgba(55,138,221,.07)"/>
        <path d="${ln}" fill="none" stroke="#c8d8e8" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
      ${pts.map((p,i) => `
        <div style="position:absolute;left:${(p[0]/CW*100).toFixed(1)}%;top:${(p[1]/CH*100).toFixed(1)}%;transform:translate(-50%,-50%);">
          ${weekCompass(w[i])}
        </div>`).join('')}
    </div>
    <div style="position:relative;height:28px;margin-bottom:6px;">
      ${pts.map((p,i) => `
        <div style="position:absolute;left:${(p[0]/CW*100).toFixed(1)}%;transform:translateX(-50%);text-align:center;line-height:1.3;">
          <div style="font-size:8px;color:#aaa;">${w[i].dt||''}</div>
          <div style="font-size:9px;font-weight:500;color:#888;">${w[i].d}</div>
        </div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;margin-bottom:10px;">
      ${w.map(d=>`
        <div style="text-align:center;padding:4px 2px;border-radius:7px;border:0.5px solid #e0e0e2;
          ${d.s==='go'?'border-color:rgba(42,157,92,.4);background:rgba(42,157,92,.07)':d.s==='maybe'?'border-color:rgba(201,125,10,.3);background:rgba(201,125,10,.04)':'opacity:.45'}">
          <div style="font-size:8px;color:#aaa;line-height:1.4">${d.dt||''}</div>
          <div style="font-size:9px;font-weight:500;color:#888;margin-bottom:2px">${d.d}</div>
          <div style="font-size:11px;font-weight:600;color:${SC[d.s]}">${d.kn}</div>
          <div style="font-size:8px;color:#aaa">kn</div>
          <div style="font-size:8px;color:#888;margin-top:1px">${d.dir??''}</div>
          ${d.tMax!=null?`<div style="font-size:8px;color:#555;margin-top:1px;line-height:1.3">${Math.round(d.tMax)}°<span style="color:#aaa">/${Math.round(d.tMin??d.tMax)}°</span></div>`:''}
          ${(d.rain??0)>=20?`<div style="font-size:8px;color:#378add;margin-top:1px">${d.rain}%🌧</div>`:''}
        </div>`).join('')}
    </div>
    <div style="font-size:10px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:#888;margin-bottom:5px;">Rideable days</div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;">
      ${w.filter(d=>d.s!=='nogo').map(d=>`
        <div style="padding:3px 9px;border-radius:7px;
          background:${d.s==='go'?'rgba(42,157,92,.1)':'rgba(201,125,10,.1)'};
          border:0.5px solid ${d.s==='go'?'rgba(42,157,92,.3)':'rgba(201,125,10,.3)'};font-size:11px;">
          <span style="font-weight:500;color:${SC[d.s]}">${d.dt?d.dt+' ':''}${d.d}</span>
          <span style="color:#555"> ${d.kn} kn ${d.dir??''}</span>
        </div>`).join('')||'<span style="font-size:11px;color:#c0392b">None this week</span>'}
    </div>`;
}
