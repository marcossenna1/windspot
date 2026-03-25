/* ── COMPASS RING SVG ── */
function compassRingSVG(cx, cy, R, dirDeg, windColor, alpha, ringRgb, innerCircle = true) {
  const rgb = ringRgb ?? '255,255,255';
  const labels = [{a:0,t:'N'},{a:45,t:'NE'},{a:90,t:'E'},{a:135,t:'SE'},{a:180,t:'S'},{a:225,t:'SW'},{a:270,t:'W'},{a:315,t:'NW'}];
  const sa = `rgba(${rgb},${alpha})`; let s = '';
  s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${sa}" stroke-width="1.2"/>`;
  if (innerCircle) s += `<circle cx="${cx}" cy="${cy}" r="${R*.62}" fill="none" stroke="${sa}" stroke-width="0.6"/>`;
  for (let a = 0; a < 360; a += 10) {
    const ar = (a-90)*Math.PI/180, major = a%45===0, mid = a%15===0&&!major;
    const r1 = major?R*.82:mid?R*.87:R*.91, r2 = R*.97, sw = major?1.4:mid?0.9:0.5, op = major?alpha*2.2:mid?alpha*1.6:alpha;
    s += `<line x1="${cx+Math.cos(ar)*r1}" y1="${cy+Math.sin(ar)*r1}" x2="${cx+Math.cos(ar)*r2}" y2="${cy+Math.sin(ar)*r2}" stroke="rgba(${rgb},${Math.min(.9,op)})" stroke-width="${sw}"/>`;
  }
  labels.forEach(l => {
    const ar = (l.a-90)*Math.PI/180, lr = R*1.18, isMain = l.a%90===0;
    s += `<text x="${cx+Math.cos(ar)*lr}" y="${cy+Math.sin(ar)*lr}" text-anchor="middle" dominant-baseline="central" font-size="${isMain?R*.24:R*.19}px" font-weight="${isMain?'700':'400'}" fill="rgba(${rgb},${Math.min(.95,alpha*2.5)})" font-family="sans-serif">${l.t}</text>`;
  });
  const arc = 60*Math.PI/180, ar = (dirDeg-90)*Math.PI/180, a1 = ar-arc/2, a2 = ar+arc/2;
  const x1 = cx+Math.cos(a1)*R*.97, y1 = cy+Math.sin(a1)*R*.97, x2 = cx+Math.cos(a2)*R*.97, y2 = cy+Math.sin(a2)*R*.97;
  s += `<path d="M${x1},${y1} A${R*.97},${R*.97} 0 0,1 ${x2},${y2}" fill="none" stroke="${windColor}" stroke-width="4" stroke-linecap="round" opacity="${Math.min(1,alpha*3)}"/>`;
  const px2 = cx+Math.cos(ar)*(R*.72), py2 = cy+Math.sin(ar)*(R*.72), plx = cx+Math.cos(ar)*(R*.58), ply = cy+Math.sin(ar)*(R*.58), pw = R*.08;
  s += `<polygon points="${px2},${py2} ${plx+Math.cos(ar+Math.PI/2)*pw},${ply+Math.sin(ar+Math.PI/2)*pw} ${plx+Math.cos(ar-Math.PI/2)*pw},${ply+Math.sin(ar-Math.PI/2)*pw}" fill="${windColor}" opacity="${Math.min(1,alpha*3)}"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${R*.045}" fill="${sa}"/>`;
  return s;
}
