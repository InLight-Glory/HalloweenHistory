// Cut-paper sets. Each draws a full 1280x720 backdrop for audio time t.
const SET = {};

function bands(cols, y0, y1) { // paper strips for skies
  const h = (y1 - y0) / cols.length;
  cols.forEach((col, i) => paper(densify(rectP(-20, y0 + i * h - 2, W + 40, h + 6), 60), col, { id: 'band' + col + i, shadow: false, line: false, cut: 3, grainA: 0.35 }));
}
function hillP(y, amp, seed, freq = 3) {
  const p = [[-30, H + 20]];
  for (let x = -30; x <= W + 30; x += 40) p.push([x, y - amp * (0.5 + 0.5 * Math.sin(x / W * Math.PI * freq + seed)) - (hash(seed * 99, x) - 0.5) * 10]);
  p.push([W + 30, H + 20]); return p;
}
function leaves(t, n, seed, cols, area = [0, 0, W, H], wind = 60) {
  const ts = step(t, 12);
  for (let i = 0; i < n; i++) {
    const sp = 0.4 + hash(seed, i) * 0.6, ph = hash(seed, i, 3) * 100;
    const k = ((ts * 0.05 * sp + hash(seed, i, 1)) % 1);
    const x = area[0] + ((hash(seed, i, 2) * area[2] + k * wind * 12) % area[2]);
    const y = area[1] + k * area[3] + Math.sin(ts * 2 * sp + ph) * 14;
    G.ctx.save(); G.ctx.translate(x, y); G.ctx.rotate(ts * sp * 3 + ph);
    paper([[0, -7], [5, 0], [0, 8], [-5, 0]], cols[i % cols.length], { id: 'lf' + i, lw: 0.8, sx: 2, sy: 2, dense: false });
    G.ctx.restore();
  }
}
function flame(x, y, s, t, seed, a = 1) {
  const ts = step(t, 12); const c = G.ctx;
  glow(x, y - 40 * s, 220 * s, 'rgba(255,150,60,0.9)', 0.55 * a);
  const cols = ['#c8401f', '#ee8a2a', '#f7c84a', '#fff1b8'];
  cols.forEach((col, L) => {
    const w = 60 * s * (1 - L * 0.22), h = 140 * s * (1 - L * 0.2);
    const p = [[x - w, y]];
    for (let i = 0; i <= 6; i++) { const u = i / 6; p.push([x - w + u * 2 * w + (hash(seed, ts * 12 | 0, i + L * 9) - 0.5) * 18 * s, y - h * (0.45 + 0.55 * Math.sin(u * Math.PI)) * (0.75 + hash(seed, ts * 12 | 0, i + 40 + L) * 0.5) * (i % 2 ? 1 : 0.7)]); }
    p.push([x + w, y]);
    paper(p, col, { id: 'fl' + seed + L, shadow: L === 0, lw: 0.9, alpha: a, dense: false, grainA: 0.2 });
  });
}
function smoke(x, y, t, seed, col = 'rgba(80,80,90,0.6)') {
  const ts = step(t, 12); const pts = [];
  for (let i = 0; i < 14; i++) { const u = i / 13; pts.push([x + Math.sin(u * 7 + ts * 1.5 + seed) * 12 * u + u * 30, y - u * 120]); }
  pencil(pts, { lw: 2.2, col, alpha: 0.6, jit: 1.5 });
}

// ------------------------------------------------------------------ office
SET.office = (t) => {
  const evening = t > 1023, late = t > 1343;
  const wall = evening ? '#8a9f86' : '#7aa39b';
  paper(rectP(-20, -20, W + 40, 600), wall, { id: 'offwall', line: false, shadow: false });
  // wallpaper stripes
  for (let x = 0; x < W; x += 64) pencil([[x, 0], [x + 2, 560]], { lw: 1, alpha: 0.12, jit: 0.6 });
  paper(rectP(-20, 470, W + 40, 100), shade(wall, -22), { id: 'wains', shadow: false });
  // window
  const sky = late ? ['#3b3a66', '#7a4f6f', '#d07a52'] : evening ? ['#6b6f9a', '#d79a6a', '#f2c38a'] : ['#9ec3d6', '#f6d9a0', '#f2c38a'];
  paper(rectP(500, 90, 270, 250), '#5b4330', { id: 'winframe' });
  G.ctx.save(); tracePath(G.ctx, rectP(514, 104, 242, 222)); G.ctx.clip();
  bands(sky, 100, 330);
  paper(hillP(330, 40, 3, 2), '#6f7b44', { id: 'winhill', line: false, shadow: false });
  paper([[600, 330], [612, 230], [596, 180], [640, 210], [660, 150], [668, 220], [700, 190], [676, 250], [664, 330]], '#4d3524', { id: 'tree' });
  [['#d1602a', 600, 170], ['#e39a2f', 660, 140], ['#b8432f', 700, 180], ['#e8b13a', 630, 200]].forEach(([col, x, y], i) => circle(x, y, 34 - i * 3, col, { id: 'fol' + i, hatch: { gap: 8, alpha: 0.12 } }));
  leaves(t, 6, 5, ['#d1602a', '#e8b13a', '#b8432f'], [514, 104, 242, 222], 30);
  G.ctx.restore();
  pencil([[635, 104], [635, 326]], { lw: 5, col: '#5b4330', alpha: 1 }); pencil([[514, 215], [756, 215]], { lw: 5, col: '#5b4330', alpha: 1 });
  // corkboard
  paper(rectP(830, 100, 240, 230), '#b98d5a', { id: 'cork', hatch: { gap: 5, alpha: 0.08 } });
  pencil(rectP(838, 108, 224, 214), { closed: true, lw: 1, alpha: 0.4 });
  // clock
  const cx = 1170, cy = 150;
  circle(cx, cy, 52, '#f6efdc', { id: 'clock' });
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; line(cx + Math.cos(a) * 42, cy + Math.sin(a) * 42, cx + Math.cos(a) * 48, cy + Math.sin(a) * 48, { lw: 1.5 }); }
  const sec = Math.floor(t); const ma = (14 * 60 + 55 + t / 60) / 60 * 6.283 - 1.57, ha = (3 + (55 + t / 60) / 60) / 12 * 6.283 - 1.57, sa = sec / 60 * 6.283 - 1.57;
  line(cx, cy, cx + Math.cos(ha) * 24, cy + Math.sin(ha) * 24, { lw: 3.5 }); line(cx, cy, cx + Math.cos(ma) * 38, cy + Math.sin(ma) * 38, { lw: 2.5 });
  line(cx, cy, cx + Math.cos(sa) * 40, cy + Math.sin(sa) * 40, { lw: 1, col: PAL.red });
  // bookshelf
  paper(rectP(1120, 250, 150, 320), '#6b4a30', { id: 'shelf' });
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
    const col = ['#a8442f', '#3f7273', '#d9a53b', '#5b3d63', '#5e7d4a', '#e0782f'][(i + r * 2) % 6], h = 70 + hash(r, i) * 22;
    paper(rectP(1130 + i * 22, 340 + r * 100 - h, 19, h), col, { id: 'bk' + r + i, lw: 0.9, sx: 1, sy: 1 });
  }
  // floor
  paper(rectP(-20, 560, W + 40, 180), '#9a6a43', { id: 'floor', shadow: false });
  for (let y = 590; y < H; y += 34) pencil([[0, y], [W, y + 3]], { lw: 1, alpha: 0.35 });
  // desk
  paper(rectP(70, 440, 420, 30), '#7a5235', { id: 'desktop', hatch: { gap: 10, alpha: 0.12, angle: 0.1 } });
  paper(rectP(90, 470, 26, 120), '#6a4529', { id: 'dl1' }); paper(rectP(444, 470, 26, 120), '#6a4529', { id: 'dl2' });
  paper(rectP(330, 470, 140, 80), '#6a4529', { id: 'drawer' }); circle(400, 510, 5, PAL.gold, { id: 'knob', shadow: false });
  // monitor
  paper(rectP(120, 300, 170, 120), '#2f3640', { id: 'mon' }); paper(rectP(130, 310, 150, 100), evening ? '#41566b' : '#7aa6c2', { id: 'screen', shadow: false });
  for (let i = 0; i < 5; i++) pencil([[140, 325 + i * 15], [140 + 40 + hash(i, 4) * 90, 325 + i * 15]], { lw: 1.5, col: '#e8f0f4', alpha: 0.6 });
  paper(rectP(195, 420, 20, 22), '#2f3640', { id: 'monstand' });
  // lamp
  const shakeL = G.t > 97.3 && G.t < 98.3 ? Math.sin(G.t * 60) * 3 : 0;
  G.ctx.save(); G.ctx.translate(shakeL, 0);
  paper(rectP(330, 430, 60, 12), '#3a3a3a', { id: 'lampbase' }); pencil([[360, 432], [380, 360], [345, 330]], { lw: 4, col: '#3a3a3a', alpha: 1 });
  paper([[320, 300], [370, 316], [352, 350], [306, 328]], PAL.red, { id: 'lampshade' });
  if (evening) glow(330, 345, 260, 'rgba(255,210,140,1)', 0.45);
  G.ctx.restore();
  // mug + pencil cup
  paper(rectP(250, 405, 34, 36), '#e9e2d0', { id: 'mug' }); sketchCircle(290, 422, 9, { lw: 3 });
  if (t > 1340) { // Bible on desk (S5/S6) handled by overlay; keep spot clear
  }
  pencilCup(440, 440, G.t);
  // chairs in S5/S6
  if (evening) { chair(440 - 60, 665); chair(820 + 60, 665, -1); }
};
function pencilCup(x, y, t) {
  const sh = (t > 1454.8 && t < 1456.5) ? Math.sin(t * 50) * 2 : 0;
  G.ctx.save(); G.ctx.translate(x + sh, y);
  ['#f0c419', '#3f7273', PAL.red].forEach((col, i) => { G.ctx.save(); G.ctx.rotate(-0.2 + i * 0.2); paper(rectP(-3, -60, 6, 50), col, { id: 'pc' + i, lw: 0.8, sx: 1, sy: 1, dense: false }); G.ctx.restore(); });
  paper(rectP(-16, -30, 32, 30), '#5b6b8c', { id: 'pcup' }); G.ctx.restore();
}
function chair(x, y, f = 1) {
  G.ctx.save(); G.ctx.translate(x, y); G.ctx.scale(f, 1);
  paper(rectP(-60, -260, 26, 200), '#3b3f4a', { id: 'chairback' + f });
  paper(rectP(-60, -100, 130, 22), '#3b3f4a', { id: 'chairseat' + f });
  paper(rectP(0, -78, 10, 60), '#2a2d35', { id: 'chairpole' + f }); paper(rectP(-40, -18, 90, 10), '#2a2d35', { id: 'chairfoot' + f });
  G.ctx.restore();
}

// ------------------------------------------------------------------ lab (timeline room)
SET.lab = (t) => {
  paper(rectP(-20, -20, W + 40, 600), '#3d4a5c', { id: 'labwall', line: false, shadow: false });
  for (let x = 40; x < W; x += 160) paper(rectP(x, 60, 120, 420), '#465569', { id: 'labpanel' + x, hatch: { gap: 12, alpha: 0.08 } });
  // projection ring
  const ts = step(t, 12);
  G.ctx.save(); G.ctx.translate(640, 250);
  circle(0, 0, 170, '#2c3646', { id: 'ring', lw: 2 });
  for (let i = 0; i < 3; i++) { G.ctx.save(); G.ctx.rotate(ts * (0.2 + i * 0.15) * (i % 2 ? -1 : 1)); sketchCircle(0, 0, 140 - i * 28, { lw: 1.5, col: '#9fd3c7', alpha: 0.7 }); line(-140 + i * 28, 0, -120 + i * 28, 0, { col: '#9fd3c7', lw: 3 }); G.ctx.restore(); }
  txt('TIMELINE', 0, 0, { size: 30, font: "'Permanent Marker'", col: '#9fd3c7', alpha: 0.8 });
  G.ctx.restore();
  glow(640, 250, 260, 'rgba(120,220,200,1)', 0.18);
  // vents
  [[150, 110], [1060, 110]].forEach(([x, y], i) => { paper(rectP(x, y, 90, 50), '#59687c', { id: 'vent' + i }); for (let k = 0; k < 4; k++) pencil([[x + 8, y + 10 + k * 10], [x + 82, y + 10 + k * 10]], { lw: 1.4 }); });
  // floor panels
  paper(rectP(-20, 560, W + 40, 180), '#2b3340', { id: 'labfloor', shadow: false });
  for (let i = 0; i < 9; i++) pencil([[640 + (i - 4) * 60, 560], [640 + (i - 4) * 260, 720]], { lw: 1, col: '#9fd3c7', alpha: 0.3 });
  for (let y of [600, 650, 705]) pencil([[0, y], [W, y]], { lw: 1, col: '#9fd3c7', alpha: 0.3 });
  // safety rail
  pencil([[40, 500], [1240, 500]], { lw: 5, col: '#c9a23b', alpha: 1 });
  for (let x = 60; x < 1240; x += 170) pencil([[x, 500], [x, 565]], { lw: 4, col: '#c9a23b', alpha: 1 });
  // console
  paper([[520, 470], [760, 470], [790, 560], [490, 560]], '#596579', { id: 'console' });
  paper(rectP(540, 440, 200, 34), '#6b778c', { id: 'consoletop' });
  for (let i = 0; i < 5; i++) circle(560 + i * 30, 457, 8, ['#9fd3c7', '#f0c419', '#9fd3c7', '#e9e2d0', '#9fd3c7'][i], { id: 'btnc' + i, shadow: false, lw: 0.8 });
  const alarm = (t > 129.4 && t < 133) || (t > 1341.2 && t < 1342.4);
  const blink = alarm && Math.floor(t * 6) % 2 === 0;
  circle(718, 457, 13, blink ? '#ff4a2e' : PAL.red, { id: 'reddial' });
  line(718, 457, 718 + Math.cos(t) * 10, 457 - 10, { lw: 2 });
  if (blink) glow(718, 457, 80, 'rgba(255,80,50,1)', 0.8);
};

// ------------------------------------------------------------------ hillside (Samhain)
SET.hill = (t) => {
  bands(['#262a50', '#38365e', '#5a4568', '#8d5566', '#c4705a', '#e0975e'], -10, 380);
  // moon + stars
  circle(220, 110, 34, '#efe2b4', { id: 'moon', hatch: { gap: 7, alpha: 0.1 } });
  for (let i = 0; i < 26; i++) { const x = hash(4, i) * W, y = hash(5, i) * 220; pencil([[x - 3, y], [x + 3, y]], { lw: 1, col: '#e9e2c0', alpha: 0.6 }); pencil([[x, y - 3], [x, y + 3]], { lw: 1, col: '#e9e2c0', alpha: 0.6 }); }
  // clouds drifting
  const ts = step(t, 12);
  for (let i = 0; i < 3; i++) { const x = ((hash(7, i) * W + ts * 6 * (i + 1)) % (W + 300)) - 150; paper(ellP(x, 120 + i * 50, 120, 18), 'rgba(60,55,90,0.85)', { id: 'cl' + i, shadow: false, lw: 0.8 }); }
  paper(hillP(380, 70, 1.2, 2), '#4b4f6a', { id: 'hfar', shadow: false, hatch: { gap: 9, alpha: 0.1 } });
  // bonfire on far hill
  const big = t > 251 ? 1 : 0.55, flare = (t > 306.2 && t < 309) ? 1.8 - (t - 306.2) * 0.25 : 1, dim = t > 394 ? clamp(1 - (t - 394) / 6) : 1;
  paper(hillP(450, 60, 2.6, 1.5), '#3e5b45', { id: 'hmid', hatch: { gap: 10, alpha: 0.1 } });
  if (dim > 0) {
    // figures round the fire (silhouettes, indistinct)
    for (let i = 0; i < 6; i++) {
      const fx = 940 + i * 40 - 100, sway = Math.sin(ts * 2 + i) * 3;
      G.ctx.save(); G.ctx.translate(fx + sway, 420); G.ctx.scale(0.5, 0.5);
      paper([[-18, 0], [18, 0], [12, -70], [-12, -70]], '#1d1c26', { id: 'fig' + i, lw: 0.8, alpha: dim });
      circle(0, -86, 14, '#1d1c26', { id: 'fh' + i, alpha: dim });
      if (i === 4) { pencil([[-6, -96], [-18, -130], [-28, -138]], { lw: 3, col: '#1d1c26' }); pencil([[6, -96], [18, -130], [28, -138]], { lw: 3, col: '#1d1c26' }); pencil([[-14, -118], [-26, -116]], { lw: 3, col: '#1d1c26' }); pencil([[14, -118], [26, -116]], { lw: 3, col: '#1d1c26' }); }
      G.ctx.restore();
    }
    flame(1020, 420, 0.55 * big * flare * dim, t, 3, dim);
  }
  // roundhouses
  [[180, 470, 1], [340, 455, 0.8], [770, 470, 0.9]].forEach(([x, y, s], i) => {
    G.ctx.save(); G.ctx.translate(x, y); G.ctx.scale(s, s);
    paper(rectP(-70, -70, 140, 70), '#a68a5f', { id: 'rhw' + i, hatch: { gap: 8, alpha: 0.12, angle: 1.57 } });
    paper([[-90, -64], [0, -170], [90, -64]], '#8b6a32', { id: 'rhr' + i, hatch: { gap: 5, alpha: 0.25, angle: -1.1 } });
    paper(rectP(-16, -50, 32, 50), '#2b1d12', { id: 'rhd' + i });
    glow(0, -25, 60, 'rgba(255,170,80,1)', 0.35);
    smoke(0, -170, t + i * 3, i);
    G.ctx.restore();
  });
  // fence + gate
  for (let x = 420; x < 720; x += 36) paper(rectP(x, 470, 10, 60), '#6a4a2c', { id: 'fp' + x, lw: 0.8, sx: 2, sy: 2 });
  pencil([[420, 485], [720, 488]], { lw: 3, col: '#6a4a2c', alpha: 1 }); pencil([[420, 510], [720, 512]], { lw: 3, col: '#6a4a2c', alpha: 1 });
  // cattle
  [[520, 520, 1], [640, 528, -1]].forEach(([x, y, f], i) => {
    G.ctx.save(); G.ctx.translate(x, y); G.ctx.scale(f * 0.7, 0.7);
    paper(ellP(0, -40, 60, 26), '#3a2a24', { id: 'cow' + i });
    [-40, -20, 20, 40].forEach((lx, k) => paper(rectP(lx - 5, -20, 10, 30), '#3a2a24', { id: 'cl' + i + k, lw: 0.6, sx: 1, sy: 1, dense: false }));
    G.ctx.save(); G.ctx.translate(58, -52); G.ctx.rotate(Math.sin(ts * 0.7 + i) * 0.25 + 0.3); paper(ellP(14, 0, 22, 14), '#3a2a24', { id: 'cowh' + i }); G.ctx.restore();
    G.ctx.restore();
  });
  // near hill + grain baskets
  paper(hillP(600, 50, 5, 1.2), '#556b3a', { id: 'hnear', hatch: { gap: 8, alpha: 0.12 } });
  [[110, 600], [180, 610]].forEach(([x, y], i) => { paper([[x - 30, y], [x + 30, y], [x + 24, y - 40], [x - 24, y - 40]], '#b8904f', { id: 'bask' + i, hatch: { gap: 5, alpha: 0.3, angle: 0.6 } }); paper(ellP(x, y - 42, 28, 12), '#e1c26b', { id: 'grain' + i }); });
  // grass tufts swaying
  for (let i = 0; i < 18; i++) {
    const x = hash(9, i) * W, y = 640 + hash(10, i) * 80, sw = Math.sin(ts * 2.5 + i) * 8;
    for (let k = -1; k <= 1; k++) pencil([[x + k * 5, y], [x + k * 8 + sw, y - 30 - k * 4]], { lw: 1.8, col: '#2f3d22', alpha: 0.8 });
  }
  // wind streaks
  for (let i = 0; i < 5; i++) { const k = ((ts * 0.3 + hash(11, i)) % 1); const x = k * (W + 400) - 200, y = 150 + hash(12, i) * 380; pencil([[x, y], [x + 60, y - 4], [x + 120, y + 2]], { lw: 1, col: '#e6e0f0', alpha: 0.35 * Math.sin(k * Math.PI) }); }
  leaves(t, 10, 21, ['#b8432f', '#d1602a', '#e8b13a'], [0, 0, W, H], 90);
};

// ------------------------------------------------------------------ modern street
SET.street = (t) => {
  const ts = step(t, 12);
  bands(['#141a33', '#1d2442', '#262e52', '#33385f'], -10, 420);
  for (let i = 0; i < 40; i++) { const x = hash(14, i) * W, y = hash(15, i) * 260, tw = hash(16, i, ts * 4 | 0) > 0.85 ? 0.3 : 0.8; pencil([[x - 2, y], [x + 2, y]], { lw: 1.4, col: '#fff3c4', alpha: tw }); }
  circle(1080, 100, 46, '#f1e3b0', { id: 'moon2', hatch: { gap: 7, alpha: 0.12 } }); glow(1080, 100, 160, 'rgba(255,240,190,1)', 0.25);
  // houses
  const houses = [[-20, 210, '#5b3d63'], [190, 250, '#2f4a5c'], [420, 190, '#6a3b2f'], [660, 240, '#3a4f3a'], [880, 205, '#4b3f6e'], [1090, 250, '#5c4a2f']];
  const party = t > 594.9 && t < 600 ? 0.5 + 0.5 * Math.sin(t * 12) : 0;
  houses.forEach(([x, y, col], i) => {
    const w = 210, base = 540;
    paper(rectP(x, y, w, base - y), col, { id: 'hs' + i, hatch: { gap: 10, alpha: 0.08 } });
    paper([[x - 18, y + 2], [x + w / 2, y - 80], [x + w + 18, y + 2]], shade(col, -25), { id: 'hr' + i, hatch: { gap: 6, alpha: 0.2 } });
    for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) {
      const wx = x + 30 + k * 100, wy = y + 30 + r * 110; if (wy + 60 > base - 70) continue;
      const lit = hash(i, r, k) > 0.25; const pc = (i === 3 && party) ? `rgba(255,${150 + party * 80},90,1)` : lit ? '#f7cf6a' : '#2a2a3a';
      paper(rectP(wx, wy, 60, 60), pc, { id: 'hw' + i + r + k, lw: 1 });
      pencil([[wx + 30, wy], [wx + 30, wy + 60]], { lw: 2 }); pencil([[wx, wy + 30], [wx + 60, wy + 30]], { lw: 2 });
      if (lit) glow(wx + 30, wy + 30, 70, 'rgba(255,200,90,1)', 0.25 + (i === 3 ? party * 0.4 : 0));
    }
    paper(rectP(x + 140, base - 90, 46, 90), shade(col, -40), { id: 'hd' + i }); circle(x + 176, base - 45, 3, PAL.gold, { id: 'hdk' + i, shadow: false });
    if (i === 3 && party) for (let n = 0; n < 3; n++) txt('♪', x + 60 + n * 40, y - 30 - ((ts * 30 + n * 20) % 60), { size: 30, col: '#f7cf6a', alpha: party });
    // porch jack-o'-lantern
    if (i % 2 === 0) jack(x + 110, base - 2, 0.6, ts, i);
  });
  // doorbell porch light
  if (t > 462.8 && t < 466) glow(316, 470, 120, 'rgba(255,230,150,1)', 0.6);
  // sidewalk / street
  paper(rectP(-20, 540, W + 40, 70), '#8c8a85', { id: 'sidewalk', shadow: false });
  for (let x = 0; x < W; x += 90) pencil([[x, 540], [x - 10, 610]], { lw: 1, alpha: 0.4 });
  paper(rectP(-20, 610, W + 40, 120), '#2e2f36', { id: 'road', shadow: false });
  for (let x = 20; x < W; x += 140) paper(rectP(x, 670, 70, 8), '#d9c46a', { id: 'dash' + x, shadow: false, lw: 0.6 });
  // street lamps
  [140, 1140].forEach((x, i) => { paper(rectP(x - 5, 330, 10, 220), '#26262c', { id: 'lp' + i }); paper([[x - 22, 320], [x + 22, 320], [x + 14, 345], [x - 14, 345]], '#f7e3a0', { id: 'lpl' + i }); glow(x, 340, 200, 'rgba(255,220,140,1)', 0.45); });
  // trick-or-treaters walking (generic costumes)
  const kids = ['cape', 'astro', 'pizza'];
  kids.forEach((k, i) => {
    const sp = 22, x = ((ts * sp + i * 160 + 200) % (W + 300)) - 150, hop = Math.abs(Math.sin(ts * 6 + i)) * 4;
    kid(k, x, 560 - hop, 0.42, ts, i);
  });
  leaves(t, 8, 31, ['#b8432f', '#d1602a', '#e8b13a'], [0, 300, W, 420], 40);
  // pumpkin rolls in, turnip demo handled as prop; apple barrel
  if (t > 503.8) { const k = ease((t - 503.8) / 2.5); G.ctx.save(); G.ctx.translate(lerp(-80, 600, k), 655); G.ctx.rotate(k * 9); jackBody(0, 0, 0.6, true); G.ctx.restore(); }
  if (t > 547) {
    const a = clamp((t - 547) / 0.8);
    G.ctx.save(); G.ctx.globalAlpha = a;
    paper([[60, 700], [190, 700], [200, 600], [50, 600]], '#7a5235', { id: 'barrel', hatch: { gap: 10, alpha: 0.2, angle: 1.57 } });
    paper(ellP(125, 600, 76, 16), '#4c78a8', { id: 'water' });
    [[95, 598], [130, 602], [160, 597]].forEach(([x, y], i) => circle(x, y, 13, PAL.red, { id: 'ap' + i }));
    if (t > 549 && t < 550.5) for (let i = 0; i < 6; i++) { const u = (t - 549) / 1.5; circle(125 + Math.cos(i) * 60 * u, 590 - Math.sin(i * 1.3 + 1) * 70 * u + u * u * 60, 5, '#9cc6e8', { id: 'drop' + i, shadow: false, lw: 0.6 }); }
    G.ctx.restore();
  }
};
function jackBody(x, y, s, face) {
  G.ctx.save(); G.ctx.translate(x, y); G.ctx.scale(s, s);
  paper(ellP(0, -40, 58, 44), PAL.pumpkin, { id: 'pump', hatch: { gap: 9, alpha: 0.12, angle: 1.57 } });
  pencil([[-20, -82], [-26, -40], [-20, 2]], { lw: 1.2, alpha: 0.5 }); pencil([[20, -82], [26, -40], [20, 2]], { lw: 1.2, alpha: 0.5 });
  paper(rectP(-6, -96, 12, 16), PAL.green, { id: 'stem' });
  if (face) { paper([[-30, -50], [-14, -50], [-22, -64]], '#3a1d0a', { id: 'je1', shadow: false }); paper([[14, -50], [30, -50], [22, -64]], '#3a1d0a', { id: 'je2', shadow: false }); paper([[-28, -30], [28, -30], [16, -16], [0, -24], [-16, -16]], '#3a1d0a', { id: 'jm', shadow: false }); }
  G.ctx.restore();
}
function jack(x, y, s, ts, i) {
  jackBody(x, y, s, true);
  const fl = 0.6 + hash(i, ts * 12 | 0) * 0.3; glow(x, y - 30 * s, 50, 'rgba(255,170,60,1)', fl * 0.5);
}
function kid(type, x, y, s, ts, i) {
  const c = G.ctx; c.save(); c.translate(x, y); c.scale(s, s);
  const leg = Math.sin(ts * 6 + i) * 0.4;
  [[-12, leg], [12, -leg]].forEach(([lx, a], k) => { c.save(); c.translate(lx, -110); c.rotate(a); paper(rectP(-9, 0, 18, 110), type === 'astro' ? '#e9e6dd' : '#2f3a5a', { id: 'kl' + type + k, dense: false }); c.restore(); });
  if (type === 'cape') {
    paper([[-40, -260], [40, -260], [70, -90], [-70, -90]], PAL.red, { id: 'cape' });
    paper(rectP(-32, -270, 64, 160), '#3b6fb0', { id: 'suit' });
    paper([[-12, -230], [12, -230], [0, -205]], '#f0c419', { id: 'star', shadow: false });
    circle(0, -310, 40, '#f0c49c', { id: 'kh1' }); paper(rectP(-36, -322, 72, 16), '#2a2a2a', { id: 'mask', shadow: false });
  } else if (type === 'astro') {
    paper(rrectP(-40, -270, 80, 165, 14), '#e9e6dd', { id: 'astrob' }); paper(rectP(-20, -240, 40, 30), '#8aa', { id: 'astrop' });
    circle(0, -315, 48, '#e9e6dd', { id: 'helm' }); circle(0, -312, 32, '#3a4e6e', { id: 'visor' }); pencil([[-14, -326], [-4, -334]], { lw: 3, col: '#cfe' });
  } else {
    paper([[-60, -280], [60, -280], [0, -100]], '#f0b94a', { id: 'pizza', hatch: { gap: 8, alpha: 0.1 } });
    paper(rrectP(-64, -292, 128, 22, 10), '#c9853f', { id: 'crust' });
    [[-22, -250], [18, -240], [0, -200], [-6, -160]].forEach(([px, py], k) => circle(px, py, 11, '#b23a2a', { id: 'pep' + k, shadow: false }));
    circle(0, -320, 36, '#d9a27a', { id: 'kh3' });
  }
  if (type !== 'astro') { pencil([[-12, -324], [-8, -324]], { lw: 3 }); pencil([[8, -324], [12, -324]], { lw: 3 }); }
  // candy bag
  c.save(); c.translate(48, -150); paper(rectP(-16, 0, 32, 36), '#e0782f', { id: 'bag' + type }); pencil([[-12, 0], [0, -14], [12, 0]], { lw: 2 }); c.restore();
  c.restore();
}

// ------------------------------------------------------------------ Rome
SET.rome = (t) => {
  const ts = step(t, 12);
  bands(['#f6d7a2', '#f2c48a', '#ebb072', '#e3a062'], -10, 430);
  circle(1080, 120, 60, '#fff0c0', { id: 'sun', line: false }); glow(1080, 120, 260, 'rgba(255,230,160,1)', 0.4);
  // temple
  paper([[230, 160], [640, 60], [1050, 160]], '#e8dcc0', { id: 'pedi', hatch: { gap: 9, alpha: 0.12 } });
  paper(rectP(220, 160, 840, 36), '#ddd0b2', { id: 'entab' });
  for (let i = 0; i < 8; i++) { const x = 250 + i * 110; paper(rectP(x, 196, 46, 300), '#efe5cf', { id: 'col' + i, hatch: { gap: 7, alpha: 0.15, angle: 1.57 } }); paper(rectP(x - 8, 190, 62, 14), '#d8cba9', { id: 'cap' + i }); paper(rectP(x - 8, 490, 62, 14), '#d8cba9', { id: 'base' + i }); }
  paper(rectP(200, 500, 880, 40), '#cbbd9c', { id: 'steps' });
  // olive trees
  [[90, 560], [1190, 560]].forEach(([x, y], i) => {
    paper([[x - 14, y], [x + 14, y], [x + 6, y - 120], [x + 30, y - 180], [x - 4, y - 140], [x - 30, y - 190], [x - 6, y - 110]], '#5e4a36', { id: 'ot' + i });
    [[-50, -200], [10, -230], [50, -190], [-10, -170]].forEach(([dx, dy], k) => paper(ellP(x + dx, y + dy + Math.sin(ts + k) * 2, 52, 30), ['#8a9a6a', '#7b8a5b', '#95a476', '#71805a'][k], { id: 'oc' + i + k, hatch: { gap: 7, alpha: 0.12 } }));
  });
  // flagstones
  paper(rectP(-20, 540, W + 40, 200), '#c7b48f', { id: 'flag', shadow: false });
  for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) pencil(rectP(k * 150 - (r % 2) * 75, 545 + r * 45, 150, 45), { closed: true, lw: 1, alpha: 0.35 });
  // fountain
  paper(ellP(640, 590, 140, 26), '#d9ceb4', { id: 'fbase' }); paper(ellP(640, 584, 120, 18), '#6aa0c0', { id: 'fwater', shadow: false });
  paper(rectP(626, 470, 28, 115), '#e3d8bf', { id: 'fcol' }); paper(ellP(640, 470, 50, 12), '#d9ceb4', { id: 'fbowl' });
  for (let s = -1; s <= 1; s += 2) for (let j = 0; j < 3; j++) { const pts = []; for (let u = 0; u <= 1; u += 0.1) pts.push([640 + s * u * (60 + j * 18), 466 - Math.sin(u * Math.PI * 0.8) * 30 + u * u * 110]); pencil(pts, { lw: 2, col: '#cfe7f5', alpha: 0.8, jit: 1.6 }); }
};

// ------------------------------------------------------------------ cathedral
SET.cathedral = (t) => {
  const ts = step(t, 12);
  paper(rectP(-20, -20, W + 40, 760), '#3b3548', { id: 'cwall', line: false, shadow: false });
  // rose window
  const rx = 640, ry = 190;
  circle(rx, ry, 120, '#2a2433', { id: 'roseframe', lw: 2 });
  const glass = ['#b8432f', '#3f6fb0', '#d9a53b', '#5e7d4a', '#7a4f9a', '#3f7273'];
  for (let i = 0; i < 12; i++) { const a0 = i / 12 * 6.283, a1 = (i + 1) / 12 * 6.283; paper([[rx, ry], ...ellP(rx, ry, 105, 105, 6, a0, a1)], glass[i % 6], { id: 'rg' + i, dense: false, shadow: false, lw: 1.6, lineCol: '#1a1620', lineA: 1 }); }
  circle(rx, ry, 30, '#f0d27a', { id: 'rosec', shadow: false, lineCol: '#1a1620' });
  glow(rx, ry, 300, 'rgba(255,220,160,1)', 0.3);
  // light shafts
  G.ctx.save(); G.ctx.globalCompositeOperation = 'screen'; G.ctx.globalAlpha = 0.12; G.ctx.fillStyle = '#ffe9b0';
  G.ctx.beginPath(); G.ctx.moveTo(rx - 60, ry); G.ctx.lineTo(rx + 60, ry); G.ctx.lineTo(rx + 300, 720); G.ctx.lineTo(rx - 150, 720); G.ctx.fill(); G.ctx.restore();
  // gothic arches (layers)
  [[0, '#4a4358'], [1, '#554d66']].forEach(([L, col]) => {
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1, x0 = 640 + s * (420 - L * 120);
      const P = [[x0 - s * 200 * 0 - 140, 720], [x0 - 140, 260 - L * 40], [x0, 60 - L * 40], [x0 + 140, 260 - L * 40], [x0 + 140, 720], [x0 + 100, 720], [x0 + 100, 280 - L * 40], [x0, 130 - L * 40], [x0 - 100, 280 - L * 40], [x0 - 100, 720]];
      paper(P, col, { id: 'arch' + L + i, hatch: { gap: 10, alpha: 0.1 } });
    }
  });
  // pillars
  [130, 1150].forEach((x, i) => paper(rectP(x - 40, 0, 80, 720), '#5e5670', { id: 'pil' + i, hatch: { gap: 8, alpha: 0.12, angle: 1.57 } }));
  // floor tiles
  paper(rectP(-20, 560, W + 40, 200), '#5a5163', { id: 'cfloor', shadow: false });
  for (let k = -8; k < 9; k++) pencil([[640 + k * 40, 560], [640 + k * 160, 720]], { lw: 1, alpha: 0.3, col: '#c9c0d6' });
  for (let y of [590, 630, 680]) pencil([[0, y], [W, y]], { lw: 1, alpha: 0.3, col: '#c9c0d6' });
  // candles
  [[260, 540], [300, 548], [980, 540], [1020, 548]].forEach(([x, y], i) => {
    paper(rectP(x - 7, y - 60, 14, 60), '#efe6cf', { id: 'cd' + i, lw: 0.8 });
    const f = hash(i, ts * 12 | 0); paper([[x - 5, y - 60], [x, y - 80 - f * 6], [x + 5, y - 60]], '#f7c84a', { id: 'cf' + i, shadow: false, lw: 0.6, dense: false });
    glow(x, y - 70, 70, 'rgba(255,200,100,1)', 0.45 + f * 0.1);
  });
};

// ------------------------------------------------------------------ medieval street
SET.medieval = (t) => {
  const ts = step(t, 12);
  bands(['#4a3d63', '#6a4f74', '#8f6577', '#b77d72'], -10, 400);
  const houses = [[-40, 140, '#efe1c2'], [240, 110, '#e9d6b0'], [760, 120, '#efe1c2'], [1020, 150, '#e6d2ab']];
  houses.forEach(([x, y, col], i) => {
    const w = 290, base = 560;
    paper(rectP(x, y + 120, w, base - y - 120), col, { id: 'mh1' + i });
    paper(rectP(x - 18, y, w + 36, 130), col, { id: 'mh2' + i });
    paper([[x - 30, y + 4], [x + w / 2, y - 110], [x + w + 30, y + 4]], '#6b3b2b', { id: 'mhr' + i, hatch: { gap: 5, alpha: 0.25 } });
    // timber beams
    const beam = (pts) => pencil(pts, { lw: 7, col: '#4a3020', alpha: 1, jit: 0.8 });
    beam([[x - 18, y + 4], [x + w + 18, y + 4]]); beam([[x - 18, y + 128], [x + w + 18, y + 128]]);
    for (let k = 0; k <= 3; k++) beam([[x - 18 + k * (w + 36) / 3, y], [x - 18 + k * (w + 36) / 3, y + 130]]);
    beam([[x - 18, y + 128], [x + (w + 36) / 3 - 18, y]]); beam([[x + w + 18, y + 128], [x + w + 18 - (w + 36) / 3, y]]);
    for (let k = 0; k <= 2; k++) beam([[x + k * w / 2, y + 130], [x + k * w / 2, base]]);
    paper(rectP(x + 40, y + 180, 60, 60), '#f2b85a', { id: 'mw' + i }); glow(x + 70, y + 210, 80, 'rgba(255,190,90,1)', 0.4);
    paper(rrectP(x + 170, base - 120, 70, 120, 30), '#4a3020', { id: 'mdoor' + i });
  });
  // window ledge with soul cakes (centre)
  paper(rectP(500, 300, 220, 160), '#d9c49b', { id: 'ledgewall' });
  paper(rectP(530, 320, 160, 100), '#2b1d12', { id: 'ledgewin' }); glow(610, 370, 120, 'rgba(255,190,90,1)', 0.5);
  paper(rectP(500, 420, 220, 18), '#6a4a2c', { id: 'ledge' });
  paper([[540, 420], [680, 420], [664, 384], [556, 384]], '#a8814a', { id: 'basket', hatch: { gap: 5, alpha: 0.3, angle: 0.7 } });
  [[570, 380], [604, 376], [638, 380], [588, 366], [622, 364]].forEach(([x, y], i) => { circle(x, y, 16, '#d9a35a', { id: 'cake' + i }); pencil([[x - 8, y], [x + 8, y]], { lw: 1.4 }); pencil([[x, y - 8], [x, y + 8]], { lw: 1.4 }); });
  for (let i = 0; i < 3; i++) smoke(580 + i * 25, 350, t + i * 2, i + 7, 'rgba(255,245,230,0.7)');
  // cobbles
  paper(rectP(-20, 560, W + 40, 200), '#7c6e62', { id: 'cobble', shadow: false });
  for (let i = 0; i < 70; i++) { const x = hash(40, i) * W, y = 575 + hash(41, i) * 140; pencil(ellP(x, y, 20, 9, 10), { closed: true, lw: 1, alpha: 0.4 }); }
  // hanging lantern
  pencil([[380, 230], [380, 280]], { lw: 2 }); paper(rectP(366, 280, 28, 36), '#2a2a2a', { id: 'lant' }); paper(rectP(372, 286, 16, 24), '#f7c84a', { id: 'lantl', shadow: false });
  glow(380, 298, 120, 'rgba(255,200,100,1)', 0.5 + 0.1 * hash(3, ts * 12 | 0));
};

// ------------------------------------------------------------------ dark stage (Exodus 32 image)
SET.dark = (t) => {
  paper(rectP(-20, -20, W + 40, 760), '#16141d', { id: 'dark', line: false, shadow: false, grainA: 0.3 });
  const calf = t > 950.6;
  // mountain + clouds (Sinai), faint
  paper([[200, 520], [520, 150], [640, 210], [760, 120], [1080, 520]], '#252232', { id: 'mount', hatch: { gap: 8, alpha: 0.12 } });
  [[560, 140], [700, 110], [800, 150]].forEach(([x, y], i) => paper(ellP(x, y, 90, 24), '#33304a', { id: 'mc' + i, lw: 0.8 }));
  paper(rectP(-20, 560, W + 40, 200), '#1d1a26', { id: 'dfloor', shadow: false, line: false });
  if (calf) {
    const k = clamp((t - 950.6) / 1.2);
    G.ctx.save(); G.ctx.globalAlpha = k;
    G.ctx.save(); G.ctx.globalCompositeOperation = 'screen'; G.ctx.globalAlpha = 0.18 * k; G.ctx.fillStyle = '#fff1c0';
    G.ctx.beginPath(); G.ctx.moveTo(600, -10); G.ctx.lineTo(680, -10); G.ctx.lineTo(820, 580); G.ctx.lineTo(460, 580); G.ctx.fill(); G.ctx.restore();
    paper(rectP(570, 500, 140, 70), '#4a4358', { id: 'plinth' });
    G.ctx.save(); G.ctx.translate(640, 500); G.ctx.scale(0.8, 0.8);
    paper(ellP(0, -60, 70, 30), '#d9a53b', { id: 'calfb', hatch: { gap: 6, alpha: 0.18 } });
    [-48, -24, 24, 48].forEach((lx, i) => paper(rectP(lx - 6, -40, 12, 40), '#c99430', { id: 'calfl' + i, dense: false }));
    paper(ellP(76, -86, 24, 18), '#d9a53b', { id: 'calfh' }); pencil([[70, -102], [62, -118]], { lw: 3, col: '#c99430' }); pencil([[86, -102], [94, -118]], { lw: 3, col: '#c99430' });
    G.ctx.restore(); glow(640, 440, 160, 'rgba(255,210,120,1)', 0.35 * k);
    G.ctx.restore();
  }
};
