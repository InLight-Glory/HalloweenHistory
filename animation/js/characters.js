// Paper puppets: TIM and MATT. Feet at origin, drawn facing right; mirrored for facing left.
const CHAR = {
  TIM: {
    skin: '#f0c49c', skinD: '#d9a27a', hair: '#8a4a22', top: PAL.orange, top2: '#f3d9a8', legs: '#3c5a86', shoe: '#e9e2d0',
    legH: 150, torsoTop: -290, headY: -345, headR: [44, 50], shoulder: 34,
  },
  MATT: {
    skin: '#8d5a3b', skinD: '#6f4329', hair: '#1f1a17', top: '#4f7a52', top2: '#efe6d2', legs: '#5a4a3a', shoe: '#3a2a20',
    legH: 165, torsoTop: -312, headY: -368, headR: [42, 52], shoulder: 38,
  },
};

function limb(x, y, ang, len, wid, col, id, hand, handCol) {
  const c = G.ctx; c.save(); c.translate(x, y); c.rotate(-ang);
  paper(rrectP(-wid / 2, -6, wid, len + 6, wid / 2.4), col, { id: id, seg: 40 });
  if (hand) circle(0, len + 4, wid * 0.55, handCol, { id: id + 'h' });
  c.restore();
}

function drawPuppet(name, p) {
  const C = CHAR[name]; const c = G.ctx; const id = name;
  c.save();
  c.translate(p.x, p.y + (p.bob || 0));
  c.scale((p.face || 1) * (p.s || 1), p.s || 1);
  c.rotate(p.lean || 0);
  // floor shadow
  c.save(); c.globalAlpha = 0.25; c.fillStyle = '#2a1a08'; c.beginPath(); c.ellipse(0, 4, 70, 12, 0, 0, 7); c.fill(); c.restore();

  const sit = p.sit || 0, crouch = p.crouch || 0;
  const drop = sit * 70 + crouch * 60;
  // legs
  if (sit > 0.5) {
    const hipY = -C.legH + drop;
    paper(rrectP(-24, hipY - 12, 96, 26, 10), C.legs, { id: id + 'thigh' });
    paper(rectP(54, hipY, 24, -hipY - 8), C.legs, { id: id + 'shin' });
    paper(ellP(76, -8, 24, 10), C.shoe, { id: id + 'shoeS' });
  } else {
    const kneeBend = crouch * 0.6;
    limb(-14, -C.legH + drop, kneeBend, C.legH - drop - 6, 24, C.legs, id + 'legB');
    limb(10, -C.legH + drop, -kneeBend * 0.4, C.legH - drop - 6, 24, shade(C.legs, 12), id + 'legF');
    paper(ellP(-8, -7, 24, 10), shade(C.shoe, -10), { id: id + 'shoeB' });
    paper(ellP(18, -7, 24, 10), C.shoe, { id: id + 'shoeF' });
  }
  c.translate(0, drop);
  const tt = C.torsoTop, sh = C.shoulder;
  // back arm
  limb(-sh + 10, tt + 14, p.armB ?? -0.1, 118, 24, shade(C.top, -18), id + 'armB', true, C.skinD);
  // torso
  const torso = [[-sh - 6, tt + 6], [sh + 6, tt + 6], [sh + 14, -C.legH + 4], [-sh - 14, -C.legH + 4]];
  paper(torso, C.top, { id: id + 'torso', hatch: { gap: 9, alpha: 0.12 } });
  if (name === 'TIM') {
    paper([[-sh - 9, tt + 70], [sh + 9, tt + 70], [sh + 10, tt + 88], [-sh - 10, tt + 88]], C.top2, { id: 'timstripe', shadow: false });
    paper([[-sh - 11, tt + 100], [sh + 11, tt + 100], [sh + 12, tt + 112], [-sh - 12, tt + 112]], '#c95f23', { id: 'timstripe2', shadow: false });
  } else {
    paper([[-12, tt + 6], [26, tt + 6], [8, tt + 70]], C.top2, { id: 'mattshirt', shadow: false });
    for (let i = 0; i < 4; i++) circle(14 - i * 2, tt + 86 + i * 30, 3.5, '#d8c9a0', { id: 'btn' + i, shadow: false, lw: 0.8 });
    pencil([[8, tt + 70], [4, -C.legH + 4]], { lw: 1, alpha: 0.6 });
  }
  // neck + head
  c.save();
  c.translate(6, tt + 8);
  c.rotate(p.tilt || 0);
  c.translate(-6, -(tt + 8));
  paper(rectP(-6, tt - 18, 24, 30), C.skinD, { id: id + 'neck', shadow: false });
  const hy = C.headY, [rx, ry] = C.headR;
  paper(ellP(6, hy, rx, ry), C.skin, { id: id + 'head' });
  const fr = p.front || 0; // 0 = profile-ish 3/4, 1 = facing camera
  // ear
  if (fr < 0.6) paper(ellP(-18 + fr * 20, hy + 2, 8, 12), C.skinD, { id: id + 'ear', shadow: false });
  // hair
  if (name === 'TIM') {
    const hp = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * 1.02 + i / 12 * Math.PI * 0.98; const r = rx + 8 + (i % 2 ? 10 : 0); hp.push([6 + Math.cos(a) * r, hy - 8 + Math.sin(a) * (ry + (i % 2 ? 10 : 2))]); }
    hp.push([6 + rx * 0.9, hy - 14]); hp.push([6 - rx * 0.95, hy - 6]);
    paper(hp, C.hair, { id: 'timhair', hatch: { gap: 6, alpha: 0.18, angle: -1.2 } });
  } else {
    paper([...ellP(6, hy - 12, rx + 2, ry - 8, 18, Math.PI * 1.02, Math.PI * 1.98), [6 + rx, hy - 18], [6 - rx, hy - 10]], C.hair, { id: 'matthair', hatch: { gap: 4, alpha: 0.25 } });
    // beard
    // beard: crescent along the jaw only, leaving the face clear
    const jaw = ellP(6, hy, rx + 1, ry + 1, 16, 0.25, Math.PI - 0.25);
    const inner = ellP(6 + (1 - fr) * 8, hy + 12, rx - 14, ry - 26, 12, Math.PI - 0.5, 0.5);
    paper([...jaw, ...inner], C.hair, { id: 'mattbeard', hatch: { gap: 4, alpha: 0.2 }, dense: false });
  }
  // face
  const ex = lerp(18, -2, fr), gap = lerp(22, 30, fr), eyY = hy - 6;
  const blink = p.blink;
  for (let k = 0; k < 2; k++) {
    const x = ex + k * gap;
    if (blink) pencil([[x - 6, eyY], [x + 6, eyY]], { lw: 2 });
    else { c.save(); c.fillStyle = PENCIL; c.beginPath(); c.ellipse(x + (1 - fr) * 2, eyY, 4, 5, 0, 0, 7); c.fill(); c.restore(); }
    const by = eyY - 15 - (p.brow || 0) * 7;
    pencil([[x - 8, by + 2], [x, by - 1], [x + 8, by + 1]], { lw: name === 'MATT' ? 3 : 2.2 });
    if (name === 'MATT') sketchCircle(x + 1, eyY, 12, { lw: 1.6 });
  }
  if (name === 'MATT') pencil([[ex + 13, eyY - 2], [ex + gap - 11, eyY - 2]], { lw: 1.5 });
  // nose
  const nx = ex + gap * 0.5 + (1 - fr) * 18;
  pencil([[nx - 2, eyY + 6], [nx + 6, eyY + 20], [nx - 3, eyY + 23]], { lw: 1.6, closed: false });
  // mouth
  const mx = ex + gap * 0.5 + (1 - fr) * 8, my = hy + (name === 'MATT' ? 26 : 24);
  const m = clamp(p.mouth || 0);
  if (m > 0.08) {
    c.save(); c.fillStyle = '#3a1612'; c.beginPath(); c.ellipse(mx, my, 9 + m * 4, 2 + m * 10, 0, 0, 7); c.fill();
    c.fillStyle = '#c4555a'; c.beginPath(); c.ellipse(mx, my + m * 6, 6, 1 + m * 4, 0, 0, Math.PI); c.fill(); c.restore();
    pencil(ellP(mx, my, 9 + m * 4, 2 + m * 10, 12), { closed: true, lw: 1.3 });
  } else {
    const sm = p.smile ?? 0.5;
    pencil([[mx - 11, my - sm * 4], [mx, my + sm * 3], [mx + 11, my - sm * 4]], { lw: 1.8 });
  }
  if (name === 'TIM') { // freckles
    for (let i = 0; i < 3; i++) { c.save(); c.fillStyle = '#b06a40'; c.globalAlpha = 0.6; c.beginPath(); c.arc(ex - 4 + i * 6 + fr * 2, eyY + 18 + (i % 2) * 3, 1.6, 0, 7); c.fill(); c.restore(); }
  }
  c.restore(); // head
  // held prop (drawn between body and front arm)
  if (p.prop) PROPS[p.prop](p.propK ?? 1, p);
  // front arm
  limb(sh - 8, tt + 14, p.armF ?? 0.1, 118, 24, C.top, id + 'armF', true, C.skin);
  c.restore();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// Props held in hand (local puppet coords, after torso; facing right)
const PROPS = {
  diagram(k) { // party diagram held up
    const c = G.ctx; c.save(); c.translate(70, -250); c.rotate(-0.08); c.scale(k, k);
    paper(rectP(-45, -60, 90, 110), '#fbf6ea', { id: 'diagHeld' });
    for (let i = 0; i < 5; i++) pencil([[-35, -45 + i * 18], [30, -45 + i * 18]], { lw: 0.8, alpha: 0.5 });
    pencil([[-30, 30], [20, 0], [10, -5], [20, 0], [12, 8]], { lw: 1.4, col: PAL.red });
    c.restore();
  },
  invitation(k, p) {
    const c = G.ctx; c.save(); c.translate(72, -240); c.rotate(-0.15 + (1 - k) * 0.4); c.scale(1, k);
    paper(rectP(-40, -28, 80, 56), '#f6e2b5', { id: 'invHeld' });
    paper([[-40, -28], [40, -28], [0, 4]], '#e8c98b', { id: 'invFlap', shadow: false });
    c.save(); if ((p && p.face) < 0) c.scale(-1, 1); txt('Party!', 0, 14, { size: 16, font: "'Permanent Marker'", col: PAL.orange }); c.restore();
    c.restore();
  },
  turnip(k) {
    const c = G.ctx; c.save(); c.translate(30, -430 - k * 20);
    paper(ellP(0, 0, 70, 58), '#efe3e8', { id: 'turnipBody', hatch: { gap: 8, alpha: 0.12 } });
    paper([...ellP(0, -10, 70, 50, 14, Math.PI * 1.05, Math.PI * 1.95)], '#9b5aa0', { id: 'turnipTop' });
    paper([[-10, -60], [-30, -120], [0, -70], [20, -125], [12, -60]], PAL.green, { id: 'turnipLeaf' });
    pencil([[0, 58], [4, 80], [-2, 95]], { lw: 1.5 });
    c.restore();
  },
  bible() {
    const c = G.ctx; c.save(); c.translate(64, -240);
    paper(rectP(-34, -24, 68, 48), '#5a2a22', { id: 'bibleHeld' });
    pencil([[-26, -14], [-26, 14]], { col: PAL.gold, lw: 2 });
    c.restore();
  },
};
