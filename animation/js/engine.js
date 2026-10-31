// Paper-cutout + pencil-sketch drawing engine (Canvas 2D, deterministic in time).
const W = 1280, H = 720;
const G = { ctx: null, T: 0, t: 0, BF: 0 }; // T = video time, t = audio time, BF = boil frame

const PENCIL = '#2a2622';
const PAL = {
  kraft: '#c9a978', cream: '#f3e8d2', ink: '#2a2622', paper: '#efe4cc',
  orange: '#e0782f', pumpkin: '#ee8a2a', green: '#5e7d4a', teal: '#3f7273',
  navy: '#24324f', night: '#1d2440', dusk: '#4a4a78', plum: '#5b3d63',
  gold: '#d9a53b', red: '#b8432f', brown: '#7a5235', stone: '#b9ad97', olive: '#7b8a4b',
};

// ---------- deterministic randomness ----------
function hash(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function sid(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ---------- easing / helpers ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => { k = clamp(k); return k * k * (3 - 2 * k); };
const easeOutBack = k => { k = clamp(k); const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const win = (t, a, b, fi = 0.4, fo = 0.4) => clamp((t - a) / fi) * clamp((b - t) / fo); // 0..1 window
// stepped time for stop-motion feel
const step = (t, fps = 12) => Math.floor(t * fps) / fps;

// ---------- textures ----------
const TEX = {};
function makeTextures() {
  const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; };
  // paper fibre grain (multiply)
  TEX.grain = mk(256, 256, (c, w, h) => {
    const r = rng(7); const img = c.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 225 + r() * 30; img.data[i * 4] = v; img.data[i * 4 + 1] = v - 3; img.data[i * 4 + 2] = v - 10; img.data[i * 4 + 3] = 255; }
    c.putImageData(img, 0, 0);
    c.globalAlpha = 0.18; c.strokeStyle = '#8a7a60'; c.lineWidth = 0.6;
    for (let i = 0; i < 160; i++) { const x = r() * w, y = r() * h, a = r() * 6.28, l = 3 + r() * 10; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  });
  // background board / sketchbook paper with faint graphite smudges
  TEX.board = mk(W, H, (c) => {
    const r = rng(11); c.fillStyle = '#e9dcc0'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(90,70,40,${r() * 0.05})`; c.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
  });
  TEX.vignette = mk(W, H, (c) => {
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,18,5,0.45)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  });
  TEX.grainPat = G.ctx.createPattern(TEX.grain, 'repeat');
}

// ---------- geometry ----------
function rectP(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
function ellP(cx, cy, rx, ry, n = 22, a0 = 0, a1 = Math.PI * 2) {
  const p = []; const full = Math.abs(a1 - a0) >= 6.28;
  const m = full ? n : n + 1;
  for (let i = 0; i < m; i++) { const a = a0 + (a1 - a0) * i / (full ? n : n); p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return p;
}
function rrectP(x, y, w, h, r, n = 4) {
  const p = []; const c = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
  for (const [cx, cy, a0] of c) for (let i = 0; i <= n; i++) { const a = a0 + (Math.PI / 2) * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return p;
}
// densify long edges so the cut edge can wobble
function densify(pts, seg = 28) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]; out.push(a);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.floor(d / seg);
    for (let k = 1; k < n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
  }
  return out;
}
function cutEdge(pts, seed, amt = 1.2) { // static scissor-cut irregularity
  return pts.map((p, i) => [p[0] + (hash(seed, i, 1) - 0.5) * amt * 2, p[1] + (hash(seed, i, 2) - 0.5) * amt * 2]);
}
function tracePath(c, pts, closed = true) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  if (closed) c.closePath();
}

// ---------- primitives ----------
// A piece of cut paper: shadow, coloured fill, grain, pencil outline (boiling), optional hatching.
function paper(pts, fill, o = {}) {
  const c = G.ctx; const seed = sid(o.id || fill + pts.length + Math.round(pts[0][0]));
  let P = cutEdge(o.dense === false ? pts : densify(pts, o.seg || 30), seed, o.cut ?? 1.0);
  const a = o.alpha ?? 1;
  c.save(); c.globalAlpha = a;
  if (o.shadow !== false) {
    c.save(); c.translate(o.sx ?? 3, o.sy ?? 4); tracePath(c, P); c.fillStyle = o.shadowCol || 'rgba(45,28,10,0.30)'; c.fill(); c.restore();
  }
  tracePath(c, P); c.fillStyle = fill; c.fill();
  if (o.grain !== false && TEX.grainPat) { c.save(); c.clip(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = a * (o.grainA ?? 0.55); c.fillStyle = TEX.grainPat; c.fillRect(-W, -H, W * 3, H * 3); c.restore(); }
  if (o.hatch) hatch(P, o.hatch, seed);
  if (o.line !== false) pencil(P, { closed: true, id: seed, lw: o.lw ?? 1.3, col: o.lineCol || PENCIL, alpha: o.lineA ?? 0.75, passes: o.passes ?? 2, jit: o.jit ?? 1.2 });
  c.restore();
  return P;
}
// sketchy graphite line, re-drawn with fresh jitter every boil frame
function pencil(pts, o = {}) {
  const c = G.ctx; const seed = o.id ?? sid(String(pts[0]));
  const passes = o.passes ?? 2, jit = o.jit ?? 1.2;
  c.save(); c.strokeStyle = o.col || PENCIL; c.lineCap = 'round'; c.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    c.globalAlpha = (o.alpha ?? 0.75) * (p ? 0.55 : 1) * (c.globalAlpha || 1);
    c.lineWidth = (o.lw ?? 1.3) * (p ? 0.7 : 1);
    c.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i][0] + (hash(seed, G.BF * 7 + p, i * 2) - 0.5) * jit * 2;
      const y = pts[i][1] + (hash(seed, G.BF * 7 + p, i * 2 + 1) - 0.5) * jit * 2;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    if (o.closed) c.closePath();
    c.stroke();
  }
  c.restore();
}
function hatch(P, h, seed) {
  const c = G.ctx; const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const gap = h.gap || 7, ang = h.angle ?? -0.9, col = h.col || PENCIL;
  c.save(); tracePath(c, P); c.clip(); c.strokeStyle = col; c.globalAlpha *= (h.alpha ?? 0.22); c.lineWidth = h.lw || 0.9;
  const dx = Math.cos(ang), dy = Math.sin(ang), L = (x1 - x0) + (y1 - y0) + 40;
  c.beginPath();
  for (let k = -L; k < L; k += gap) {
    const j = (hash(seed, G.BF, k | 0) - 0.5) * 2;
    const cx = (x0 + x1) / 2 + -dy * k + j, cy = (y0 + y1) / 2 + dx * k;
    c.moveTo(cx - dx * L, cy - dy * L); c.lineTo(cx + dx * L, cy + dy * L);
  }
  c.stroke(); c.restore();
}
function line(x0, y0, x1, y1, o = {}) { pencil([[x0, y0], [lerp(x0, x1, 0.5), lerp(y0, y1, 0.5)], [x1, y1]], { closed: false, ...o }); }
function circle(cx, cy, r, fill, o = {}) { return paper(ellP(cx, cy, r, o.ry ?? r, o.n || Math.max(10, Math.min(40, r | 0))), fill, { dense: false, ...o }); }
function sketchCircle(cx, cy, r, o = {}) { pencil(ellP(cx, cy, r, o.ry ?? r, 20), { closed: true, ...o }); }

// glow (lamps, fire, windows) – soft radial light drawn with 'screen'
function glow(x, y, r, col, a = 0.5) {
  const c = G.ctx; c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = a;
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}

// hand-lettered text
function txt(s, x, y, o = {}) {
  const c = G.ctx; c.save();
  c.font = `${o.size || 28}px ${o.font || "'Patrick Hand'"}`; c.textAlign = o.align || 'center'; c.textBaseline = o.base || 'middle';
  c.fillStyle = o.col || PENCIL; c.globalAlpha *= (o.alpha ?? 1);
  if (o.rot) { c.translate(x, y); c.rotate(o.rot); x = 0; y = 0; }
  const jx = (hash(sid(s), G.BF, 1) - 0.5) * (o.boil ?? 0.8), jy = (hash(sid(s), G.BF, 2) - 0.5) * (o.boil ?? 0.8);
  c.fillText(s, x + jx, y + jy); c.restore();
}
function wrapText(s, maxW, size, font = "'Patrick Hand'") {
  const c = G.ctx; c.save(); c.font = `${size}px ${font}`;
  const words = s.split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); c.restore(); return lines;
}
// paper card with lettering (used for scripture cards, labels)
function card(x, y, w, h, lines, o = {}) {
  const c = G.ctx; c.save(); c.translate(x, y); c.rotate(o.rot || 0); c.scale(o.s ?? 1, o.s ?? 1);
  paper(rectP(-w / 2, -h / 2, w, h), o.fill || PAL.cream, { id: o.id || lines.join(), alpha: o.alpha ?? 1 });
  if (o.pin) { circle(0, -h / 2 + 10, 6, o.pin, { id: 'pin' + o.id, shadow: true }); }
  if (o.tape) paper(rectP(-30, -h / 2 - 10, 60, 22), 'rgba(235,225,190,0.75)', { id: 'tape' + o.id, line: false, shadow: false, grainA: 0.3 });
  const size = o.size || 26; const lh = size * 1.15; const y0 = -((lines.length - 1) * lh) / 2 + (o.dy || 0);
  lines.forEach((l, i) => txt(l, 0, y0 + i * lh, { size: i === 0 && o.head ? size * 1.1 : size, font: i === 0 && o.headFont ? o.headFont : undefined, col: o.col, alpha: o.alpha ?? 1 }));
  c.restore();
}
