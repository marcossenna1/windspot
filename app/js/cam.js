/* ── CAMERA MODAL ── */
function openCam(e, id) {
  e.stopPropagation(); const s = SPOTS[id];
  document.getElementById('cam-title').textContent = s.name + ' — Camera';
  const live = document.getElementById('cam-live-badge'), unavail = document.getElementById('cam-unavail'), cc = document.getElementById('cam-canvas');
  if (s.cam) {
    live.style.display = s.camLive ? 'block' : 'none'; unavail.style.display = 'none'; cc.style.display = 'block'; drawCamFrame(cc, s);
  } else {
    live.style.display = 'none'; unavail.style.display = 'flex'; cc.style.display = 'none';
  }
  document.getElementById('cam-info').innerHTML = `<div class="cam-info-row"><span>Wind</span><span style="font-weight:500">${s.wind}/${s.gusts} kn ${s.dir}</span></div><div class="cam-info-row"><span>Waves</span><span>${s.waves!=null?s.waves+'m':'—'} · ${s.period!=null?s.period+'s':'—'}</span></div><div class="cam-info-row"><span>Status</span><span style="color:${SC[s.status]};font-weight:500">${s.status==='go'?'Go':s.status==='maybe'?'Maybe':'No go'} · ${s.score}</span></div>`;
  document.getElementById('cam-modal').className = 'cam-modal-bg open';
}
function closeCam() { document.getElementById('cam-modal').className = 'cam-modal-bg'; }

function drawCamFrame(cv, s) {
  cv.width = 360; cv.height = 195; const ctx = cv.getContext('2d'), W = 360, H = 195;
  const sg = ctx.createLinearGradient(0,H*.45,0,H); sg.addColorStop(0,'#2a6a9a'); sg.addColorStop(1,'#0d3558'); ctx.fillStyle = sg; ctx.fillRect(0,H*.45,W,H*.55);
  const sk = ctx.createLinearGradient(0,0,0,H*.45); sk.addColorStop(0,'#6aa8d8'); sk.addColorStop(1,'#9ec8e8'); ctx.fillStyle = sk; ctx.fillRect(0,0,W,H*.45);
  ctx.fillStyle = '#c8b578'; ctx.fillRect(0,H*.43,W,H*.06);
  if (s.status === 'go' || s.status === 'maybe') {
    const kc = ['#e03030','#2a6ac0','#f5a020'];
    for (let i = 0; i < 3; i++) {
      const kx = 70+i*100, ky = 35+Math.cos(i*1.7)*15;
      ctx.save(); ctx.translate(kx,ky); ctx.fillStyle = kc[i]; ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.moveTo(0,-11); ctx.lineTo(8,0); ctx.lineTo(0,13); ctx.lineTo(-8,0); ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0,H-22,W,22);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`${s.name}  ·  ${s.wind}/${s.gusts}kn ${s.dir}  ·  ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`, 8, H-7);
}
