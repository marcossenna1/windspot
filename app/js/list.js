/* ── HELPERS ── */
function depthColor(d) {
  if (d == null) return '#888';
  if (d < 1.5)  return '#c97d0a';  // shallow — orange
  if (d <= 4.0) return '#2a9d5c';  // ideal   — green
  return '#378add';                  // deep    — blue
}
function depthLabel(d) {
  if (d == null) return '—';
  if (d < 1.5)  return 'Shallow';
  if (d <= 4.0) return 'Ideal';
  return 'Deep';
}
function wBg(k) { if(k<=8)return'#2a6aa0';if(k<=13)return'#1a8870';if(k<=18)return'#2a9d5c';if(k<=24)return'#b8a000';if(k<=30)return'#c96800';if(k<=36)return'#b83010';return'#8b0000'; }
function rBg(r)    { if(r<=10)return'transparent';if(r<=25)return'#dceeff';if(r<=50)return'#a8c8f0';return'#5b9cd6'; }
function rMmBg(mm) { if(mm==null||mm<0.1)return'transparent';if(mm<1)return'rgba(100,180,255,.22)';if(mm<5)return'rgba(60,130,220,.35)';if(mm<10)return'rgba(30,80,180,.45)';return'rgba(20,40,140,.55)'; }
function cloudBg(c){ if(c==null)return'transparent';if(c<20)return'rgba(180,220,255,.18)';if(c<50)return'rgba(160,185,210,.28)';if(c<80)return'rgba(130,148,165,.35)';return'rgba(100,112,125,.42)'; }
function waveBg(w) { if(w==null||w<0.3)return'transparent';if(w<0.8)return'rgba(60,190,140,.25)';if(w<1.5)return'rgba(200,185,30,.30)';if(w<2.5)return'rgba(210,110,20,.35)';return'rgba(190,40,20,.40)'; }
function tempBg(c) {
  if(c==null)return'transparent';
  if(c<5)  return'rgba(72,120,210,.38)';   // frigid  — deep blue
  if(c<10) return'rgba(80,185,220,.30)';   // cold    — sky blue
  if(c<15) return'rgba(90,205,190,.25)';   // cool    — cyan
  if(c<20) return'rgba(72,188,110,.22)';   // mild    — green
  if(c<25) return'rgba(205,190,45,.28)';   // warm    — yellow
  if(c<30) return'rgba(218,128,38,.30)';   // hot     — orange
  return             'rgba(200,52,38,.34)'; // very hot — red
}
function fmtT(c) { if(c==null)return'—'; return tempUnit==='C'?Math.round(c)+'°C':Math.round(c*9/5+32)+'°F'; }
function fmtTv(c) { if(c==null)return'—'; return tempUnit==='C'?Math.round(c)+'°':Math.round(c*9/5+32)+'°'; }
function lensIcon(color) { return `<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="${color}" stroke-width="1.25" stroke-linecap="round" style="flex-shrink:0;display:block"><circle cx="6" cy="6" r="4.5"/><circle cx="6" cy="6" r="2" stroke-opacity=".55"/><line x1="6" y1="1" x2="6" y2="3.5" stroke-opacity=".35"/><line x1="6" y1="8.5" x2="6" y2="11" stroke-opacity=".35"/><line x1="1" y1="6" x2="3.5" y2="6" stroke-opacity=".35"/><line x1="8.5" y1="6" x2="11" y2="6" stroke-opacity=".35"/></svg>`; }

/* ── WIND ZONE GRADIENT ── */
function windZoneGradient(wind, gusts) {
  const wp = Math.min(100,wind/MAXKN*100), gp = Math.min(100,gusts/MAXKN*100);
  const stops = [];
  function seg(from,to,col){const c=Math.min(to,wp);if(c<=from)return;stops.push(`${col} ${from.toFixed(1)}%`,`${col} ${c.toFixed(1)}%`);}
  seg(0,B1,'rgba(140,140,140,.22)');seg(B1,B2,'rgba(42,157,92,.22)');seg(B2,B3,'rgba(204,170,0,.28)');seg(B3,100,'rgba(192,57,43,.22)');
  if(gp>wp){let gc='rgba(140,140,140,.1)';if(gp>B3)gc='rgba(192,57,43,.10)';else if(gp>B2)gc='rgba(204,170,0,.12)';else if(gp>B1)gc='rgba(42,157,92,.10)';stops.push(`${gc} ${wp.toFixed(1)}%`,`${gc} ${gp.toFixed(1)}%`);}
  const tail=Math.max(wp,gp);if(tail<100)stops.push(`transparent ${tail.toFixed(1)}%`,`transparent 100%`);
  return `linear-gradient(to right,${stops.join(',')})`;
}

/* ── ZONE WIDTHS ── */
let zW = {z0:0, z1:0, z2:0, z3:0};
function computeZoneWidths() {
  const list = document.getElementById('spot-list'); if (!list||!list.offsetWidth) return;
  const rowW = list.offsetWidth, re = 68, zo = rowW-3-re;
  zW.z0 = Math.round(zo*(B1/100)); zW.z1 = Math.round(zo*((B2-B1)/100));
  zW.z2 = Math.round(zo*((B3-B2)/100)); zW.z3 = Math.round(zo*((100-B3)/100));
  document.querySelectorAll('.zone0').forEach(el=>el.style.width=zW.z0+'px');
  document.querySelectorAll('.zone1').forEach(el=>el.style.width=zW.z1+'px');
  document.querySelectorAll('.zone2').forEach(el=>el.style.width=zW.z2+'px');
  document.querySelectorAll('.zone3').forEach(el=>el.style.width=zW.z3+'px');
}

/* ── WIND LEGEND ── */
function renderWindLegend() {
  const segs = [
    {l:'≤ 12 kn', p:B1,       bg:'rgba(140,140,140,.3)', t:'#666'},
    {l:'13 – 19', p:B2-B1,    bg:'rgba(42,157,92,.38)',  t:'#1a5c35'},
    {l:'20 – 29', p:B3-B2,    bg:'rgba(204,170,0,.45)',  t:'#5a4800'},
    {l:'30 + kn', p:100-B3,   bg:'rgba(192,57,43,.38)',  t:'#6b1a1a'},
  ];
  document.getElementById('wind-legend').innerHTML = segs.map(s=>`<div class="wl-seg" style="width:${s.p.toFixed(1)}%;background:${s.bg};color:${s.t};">${s.l}</div>`).join('');
}

/* ── ROW COMPASS ── */
const rowAnims = {};
function buildRowCompass(s) {
  return `<div class="cw-wrap" id="rc-${s.id}"><svg class="cw-ring" viewBox="0 0 60 60">${compassRingSVG(30,30,24,s.dirDeg,SC[s.status],.55,'90,90,90',false)}</svg><canvas class="cw-arrows" id="ca-${s.id}" width="60" height="60"></canvas><div class="cw-center"><span class="cw-speed" style="color:${STXT[s.status]}">${s.wind}</span><span class="cw-gust" style="color:${SC[s.status]}">/${s.gusts}</span></div></div>`;
}
function spawnRP(dD, wk, st) {
  const ar=(dD+180-90)*Math.PI/180,opp=ar+Math.PI,perp=ar+Math.PI/2;
  const cx=30+Math.cos(opp)*28,cy=30+Math.sin(opp)*28,sp=(Math.random()-.5)*50;
  return {x:cx+Math.cos(perp)*sp,y:cy+Math.sin(perp)*sp,life:Math.random(),col:SC[st],dirDeg:dD,wk,sz:2.5+wk/16};
}
function stepRP(p) {
  const ar=(p.dirDeg+180-90)*Math.PI/180,spd=.45+p.wk/55;
  p.x+=Math.cos(ar)*spd;p.y+=Math.sin(ar)*spd;p.life+=.007+p.wk/7000;
  if(p.life>1||Math.sqrt((p.x-30)**2+(p.y-30)**2)>24){const np=spawnRP(p.dirDeg,p.wk,Object.keys(SC).find(k=>SC[k]===p.col)||'go');Object.assign(p,np);p.life=0;}
}
function drawRP(ctx, p) {
  const t=p.life,ar=(p.dirDeg+180-90)*Math.PI/180;let a=t<.2?t/.2:t<.8?1:(1-t)/.2;a*=.6;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(ar);ctx.globalAlpha=a;ctx.strokeStyle=p.col;ctx.lineWidth=1;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-p.sz*.5,0);ctx.lineTo(p.sz*.4,0);ctx.stroke();ctx.fillStyle=p.col;
  ctx.beginPath();ctx.moveTo(p.sz*.4,0);ctx.lineTo(0,-p.sz*.3);ctx.lineTo(0,p.sz*.3);ctx.closePath();ctx.fill();ctx.restore();
}
function startRowAnim(s) {
  const cv=document.getElementById(`ca-${s.id}`);if(!cv)return;
  const ps=[];for(let i=0;i<4+Math.round(s.wind/8);i++)ps.push(spawnRP(s.dirDeg,s.wind,s.status));
  let af=null;
  function tick(){const ctx=cv.getContext('2d');ctx.clearRect(0,0,60,60);ctx.save();ctx.beginPath();ctx.arc(30,30,22,0,Math.PI*2);ctx.clip();ps.forEach(p=>{stepRP(p);drawRP(ctx,p);});ctx.restore();af=requestAnimationFrame(tick);}
  tick();rowAnims[s.id]=af;
}

/* ── SPOT LIST ── */
function filteredSpots() {
  return SPOTS.filter(s => {
    if(filter==='fav')  return s.fav;
    if(filter==='nc')   return s.state==='nc';
    if(filter==='sc')   return s.state==='sc';
    if(filter==='fl')   return s.state==='fl';
    if(filter==='rj')   return s.state==='rj';
    if(filter==='near') return s.id<=2;
    return true;
  }).sort((a,b) => b.score-a.score);
}

function renderList() {
  const fs = filteredSpots();
  document.getElementById('spot-list').innerHTML = fs.map(s => {
    const camColor = s.camLive?'#8b1414':'#888890';
    let btnClass = 'name-cam-btn'; if(s.cam&&s.camLive)btnClass+=' live'; else if(!s.cam)btnClass+=' nocam';
    const iconEl = s.cam?lensIcon(camColor):'';
    const favMark = s.fav?'★ ':'';
    const onclickAttr = s.cam?`onclick="openCam(event,${s.id})"`:' ';
    const nameBtn = `<button class="${btnClass} has-tip" ${onclickAttr} data-tip="${s.name}">${iconEl}<span class="btn-name">${favMark}${s.name}</span></button>`;
    const winLabel = s.goodStart
      ? `<div class="z1-win">${s.goodStart}–${s.goodEnd}</div>`
      : `<div class="z1-win nowin">No window</div>`;
    const wavesStr = s.waves!=null?`${s.waves}m`:'—';
    return `<div class="spot-row${s.id===activeId?' active-row':''}" style="background:${windZoneGradient(s.wind,s.gusts)};" onclick="openDetail(${s.id})">
      <div class="status-bar" style="background:${SC[s.status]}"></div>
      <div class="zone0">${nameBtn}</div>
      <div class="zone1">
        <div class="z1-meta">
          <div class="z1-meta-line"><span>${s.region}</span></div>
          <div class="z1-meta-line"><span>🌧${s.rain}%</span><span style="opacity:.4">·</span><span>${s.tide}</span><span style="opacity:.4">·</span><span style="color:${depthColor(s.depth_m)}">~${s.depth_m != null ? s.depth_m+'m' : '—'}</span></div>
        </div>
        ${winLabel}
      </div>
      <div class="zone2">${buildRowCompass(s)}</div>
      <div class="zone3">
        <div class="z3-row"><span class="z3-val">${fmtTv(s.airC)}</span><span class="z3-lbl">air</span></div>
        <div class="z3-row"><span class="z3-val">${fmtTv(s.waterC)}</span><span class="z3-lbl">water</span></div>
        <div class="z3-row"><span class="z3-val">${wavesStr}</span><span class="z3-lbl">wave</span></div>
      </div>
      <div class="row-right">
        <span class="score-pill" style="color:${STXT[s.status]}">${s.status==='go'?'Go':s.status==='maybe'?'Maybe':'No go'}</span>
        <span class="chevron">›</span>
      </div>
    </div>`;
  }).join('');
  setTimeout(() => {
    Object.values(rowAnims).forEach(af => { if(af) cancelAnimationFrame(af); });
    Object.keys(rowAnims).forEach(k => delete rowAnims[k]);
    fs.forEach(s => startRowAnim(s));
    computeZoneWidths();
  }, 50);
}
