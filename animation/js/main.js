// Director: maps time -> set, puppet poses, overlays, captions.
const INTRO = 5, OUTRO = 8;
let TL, ENV, LINES, CUES, SCENES, AUDIO_END = 1472.33;

const strip = s => s.replace(/\*\*?/g, '').replace(/\s+/g, ' ').trim();
function L(sub, after = 0) { return LINES.find(l => l.start >= after && l.text.includes(sub)); }
function lineAt(t) { // dialogue line active at t (with small hold)
  let best = null;
  for (const l of LINES) { if (l.start <= t && t < l.end + 0.25) best = l; if (l.start > t) break; }
  return best;
}
function env(t) { const i = Math.floor(t * ENV.fps); return ENV.v[Math.max(0, Math.min(ENV.v.length - 1, i))] || 0; }

// ---------------------------------------------------------------- locations
const LOC = [
  [0, 'office'], [72.4, 'lab'], [133, 'hill'], [404.3, 'street'], [621.7, 'lab'], [639.3, 'rome'],
  [705.6, 'cathedral'], [865, 'medieval'], [942.2, 'dark'], [1006.2, 'lab'], [1023.6, 'office'],
];
const TEAR = 1.4;
function locAt(t) {
  let i = 0; while (i + 1 < LOC.length && LOC[i + 1][0] <= t) i++;
  const dur = LOC[i][1] === 'hill' && i === 2 ? 8 : TEAR;
  const k = clamp((t - LOC[i][0]) / dur);
  return { cur: LOC[i][1], prev: i ? LOC[i - 1][1] : null, k: i ? k : 1, start: LOC[i][0] };
}
function drawSet(t) {
  const { cur, prev, k, start } = locAt(t);
  if (prev && k < 1) {
    SET[prev](t);
    const c = G.ctx; const x = lerp(-80, W + 80, ease(k));
    const edge = []; for (let y = -20; y <= H + 20; y += 24) edge.push([x + (hash(sid(cur), y) - 0.5) * 50, y]);
    const P = [[-40, -20], ...edge, [-40, H + 20]];
    c.save(); tracePath(c, P); c.clip(); SET[cur](t); c.restore();
    // torn white fringe
    pencil(edge, { lw: 9, col: '#f6efe0', alpha: 1, jit: 3 }); pencil(edge.map(([a, b]) => [a + 6, b]), { lw: 2, alpha: 0.5 });
  } else SET[cur](t);
  // tether: brief ghost of the lab over the hillside / Rome
  const ghost = win(t, 330, 336, 0.8, 1.5) + win(t, 1006.2, 1008, 0.3, 0.8) * 0;
  if (ghost > 0 && cur === 'hill') { G.ctx.save(); G.ctx.globalAlpha = ghost * 0.35; SET.lab(t); G.ctx.restore(); }
}

// ---------------------------------------------------------------- swirl (WHOOM)
function whoom(t) {
  const k = win(t, 131, 142, 1.2, 2.5); if (k <= 0) return;
  const c = G.ctx; const ts = step(t, 12);
  c.save(); c.globalAlpha = k;
  for (let i = 0; i < 46; i++) {
    const r = 60 + hash(70, i) * 560, a = hash(71, i) * 6.28 + ts * (1.6 - r / 600) * 2, sz = 10 + hash(72, i) * 26;
    c.save(); c.translate(640 + Math.cos(a) * r, 330 + Math.sin(a) * r * 0.6); c.rotate(a + 1.57);
    paper(rectP(-sz, -sz / 3, sz * 2, sz / 1.5), ['#f3e8d2', '#7aa39b', '#9fd3c7', '#e0975e', '#3d4a5c'][i % 5], { id: 'sw' + i, lw: 0.8, dense: false, sx: 2, sy: 3 });
    c.restore();
  }
  for (let i = 0; i < 4; i++) { const pts = []; for (let u = 0; u < 1; u += 0.04) { const a = u * 12 + ts * 3 + i * 1.6, r = u * 420; pts.push([640 + Math.cos(a) * r, 330 + Math.sin(a) * r * 0.6]); } pencil(pts, { lw: 1.6, alpha: 0.5 }); }
  c.restore();
}

// ---------------------------------------------------------------- puppets
function blinkAt(t, seed) { const p = 3.2 + hash(seed, 1) * 2; const ph = (t + hash(seed, 2) * p) % p; return ph < 0.13; }
function posePuppet(name, t) {
  const loc = locAt(t).cur;
  const seated = loc === 'office' && t > 1023.6;
  const isTim = name === 'TIM';
  const p = { x: isTim ? 870 : 410, y: 668, s: 0.98, face: isTim ? -1 : 1, front: 0.15, armF: 0.08, armB: -0.08, tilt: 0, bob: 0, sit: seated ? 1 : 0, mouth: 0, brow: 0, smile: 0.5 };
  if (seated) { p.x = isTim ? 830 : 450; p.y = 668; }
  if (t > 1023.6 && t < 1027) { const k = ease((t - 1023.6) / 3); p.x += (isTim ? 40 : -40) * (1 - k); } // chairs scrape closer
  const ts = step(t, 12);
  // idle breathing
  p.bob = Math.sin(ts * 2.2 + (isTim ? 0 : 1.7)) * 1.6;
  const ln = lineAt(t);
  const speaking = ln && ln.speaker === name;
  if (speaking) {
    const e = env(t); p.mouth = e > 0.25 ? e : 0;
    const g = sid(ln.text) % 7;
    p.armF = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(ts * 1.7 + g)) * (g % 3 ? 1 : 0.4);
    p.armB = -0.15 + 0.2 * Math.sin(ts * 1.3 + g);
    p.tilt = Math.sin(ts * 1.1 + g) * 0.04;
    p.bob += e * 2.5;
    const d = ln.dir || '';
    if (/listener/i.test(d)) { p.front = 1; p.s *= 1.05; p.armF = 0.9; }
    if (/Laughing|Half-laugh|Smiling/i.test(d)) { p.smile = 1; p.bob += Math.abs(Math.sin(ts * 9)) * 3; }
    if (/Quiet|Slowly|Thoughtful/i.test(d)) { p.tilt = 0.08; p.armF = 0.05; }
    if (/Dryly/i.test(d)) { p.brow = 0.6; }
    if (/Calls upward/i.test(d)) { p.tilt = -0.18; p.armF = 2.4; }
    if (/Rubbing his arms/i.test(d)) { p.armF = 1.9; p.armB = 1.7; }
    if (/Starts forward/i.test(d)) { p.x += isTim ? -40 : 40; p.armF = 1.6; }
  } else if (ln) { // listening
    p.tilt = -0.03; p.front = 0.05;
  }
  p.blink = blinkAt(t, isTim ? 3 : 8) && p.mouth < 0.1;
  // ---- scripted business
  const T = (a, b) => t >= a && t < b;
  if (isTim) {
    if (T(26.6, 36)) { p.prop = 'diagram'; p.armF = 1.15; p.propK = easeOutBack((t - 26.6) / 0.6); }
    if (T(35.8, 37.5)) { p.brow = 1; p.lean = -0.06; }
    if (T(129.3, 131)) { p.armF = 1.3; p.x -= 30; }
    if (T(306.2, 309)) { const k = 1 - clamp((t - 306.2) / 2.8); p.x += 70 * Math.sin(Math.min(1, (t - 306.2) * 3) * 1.57) * (0.4 + k * 0.6); p.armF = 2.6; p.armB = 2.4; p.brow = 1; p.mouth = Math.max(p.mouth, 0.6); }
    const tl = L('Lifts a projected', 0) || L('You mean instead of carving', 500);
    if (tl && T(tl.start, tl.end + 1.5)) { p.prop = 'turnip'; p.armF = 2.9; p.armB = 2.9; p.propK = Math.sin(ts * 5) * 0.5 + 0.5; p.bob += Math.sin(ts * 8) * 3; }
    if (T(627.6, 629.5)) { p.lean = 0.12; p.x += (t - 627.6) * 20; p.brow = 1; }
    if (T(1006.1, 1008)) { p.brow = 1; p.lean = 0.08; }
    if (T(1294.2, 1343.3)) { p.prop = 'invitation'; p.armF = 1.1; p.propK = 1; }
    if (T(1343.3, 1431)) { p.prop = 'invitation'; p.armF = 0.9; p.propK = t > 1429.4 ? clamp(1 - (t - 1429.4) / 1.2, 0.15) : 1; }
    if (T(1454.8, 1457)) { p.brow = 1; }
  } else {
    if (T(330, 334)) { p.crouch = Math.sin(clamp((t - 330) / 4) * Math.PI); p.armF = 0.9; }
    if (T(1234, 1290)) { p.prop = t < 1236 ? 'bible' : null; }
    if (T(35.8, 37)) p.brow = 0.4;
  }
  return p;
}

// ---------------------------------------------------------------- overlays
let OVL = [];
function buildOverlays() {
  const O = (a, b, fn) => { if (a != null && b != null) OVL.push({ a, b, fn }); };
  const at = (sub, after = 0) => L(sub, after) || null;
  const fracTime = (l, sub) => { const i = l.text.indexOf(sub); return l.start + (l.end - l.start) * Math.max(0, i) / l.text.length; };
  // party diagram
  O(26.6, 33.5, k => {
    const c = G.ctx; c.save(); c.translate(980, 230); c.rotate(-0.04); c.scale(easeOutBack(k.in) * 1, easeOutBack(k.in));
    paper(rectP(-200, -170, 400, 320), '#fbf6ea', { id: 'diag' }); for (let y = -140; y < 150; y += 24) pencil([[-190, y], [190, y]], { lw: 0.7, col: '#8fb3d9', alpha: 0.5 });
    txt('SATURDAY HALLOWEEN PARTY', 0, -138, { size: 24, font: "'Permanent Marker'", col: PAL.orange });
    const box = (x, y, w, h, s, col) => { paper(rectP(x, y, w, h), col, { id: 'db' + s, shadow: false, lw: 1.2 }); txt(s, x + w / 2, y + h / 2, { size: 22 }); };
    box(-180, -100, 110, 50, 'costumes', '#f6e2b5'); box(-50, -100, 100, 50, 'music', '#d8e7d0'); box(70, -100, 110, 50, 'food', '#f3d0b8');
    box(70, -30, 110, 50, 'MORE food', '#f3d0b8'); box(-180, 40, 250, 90, '', '#e9c48f'); txt('BROWNIES', -55, 70, { size: 34, font: "'Permanent Marker'", col: '#5a3418' }); txt('(own section)', -55, 104, { size: 18 });
    const arrow = (x0, y0, x1, y1) => { pencil([[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 - 10], [x1, y1]], { lw: 2, col: PAL.red }); const a = Math.atan2(y1 - y0, x1 - x0); pencil([[x1 - 12 * Math.cos(a - 0.5), y1 - 12 * Math.sin(a - 0.5)], [x1, y1], [x1 - 12 * Math.cos(a + 0.5), y1 - 12 * Math.sin(a + 0.5)]], { lw: 2, col: PAL.red }); };
    arrow(125, -48, 125, -32); arrow(125, 22, 60, 60); arrow(0, -48, -40, 38); arrow(-125, -48, -110, 38); arrow(170, 120, 80, 95);
    c.restore();
  });
  // record scratch
  O(35.8, 37.4, k => { const c = G.ctx; c.save(); c.translate(820, 230); c.scale(easeOutBack(k.in * 1.5), easeOutBack(k.in * 1.5)); const P = []; for (let i = 0; i < 16; i++) { const r = i % 2 ? 40 : 70, a = i / 16 * 6.283; P.push([Math.cos(a) * r, Math.sin(a) * r]); } paper(P, '#f7d35a', { id: 'burst', dense: false }); txt('?!', 0, 4, { size: 54, font: "'Permanent Marker'", col: PAL.red }); c.restore(); });
  // the question
  let l = at('Today we\'re exploring');
  if (l) O(l.start + 2, l.end + 4, k => card(640, 120, 640, 110, ['Can a celebration be separated', 'from its history?'], { id: 'q1', size: 34, rot: -0.01, tape: true, s: easeOutBack(k.in), alpha: k.out }));
  // Samhain
  l = at('a seasonal festival called');
  if (l) O(l.start + 3, l.end + 3, k => card(640, 110, 420, 120, ['SAMHAIN', '"SOW-in"  ·  "SAH-win"'], { id: 'samh', size: 32, headFont: "'Permanent Marker'", head: true, rot: 0.02, tape: true, s: easeOutBack(k.in), alpha: k.out, fill: '#f3e3c3' }));
  l = at('That\'s how some of the stories describe it');
  if (l) O(fracTime(l, 'beliefs'), l.end + 3, k => card(640, 110, 520, 100, ['beliefs & stories', '— not proof'], { id: 'bel', size: 32, rot: -0.02, pin: PAL.red, s: easeOutBack(k.in), alpha: k.out }));
  l = at('scholars can\'t trace every');
  if (l) O(fracTime(l, 'scholars'), l.end + 2, k => stamp(640, 120, 'THE HISTORICAL PICTURE HAS GAPS', k));
  // pencils scatter (tether)
  O(306.2, 312, k => { const u = clamp((G.t - 306.2) / 1.6); for (let i = 0; i < 7; i++) { const c = G.ctx; c.save(); const x = 760 + i * 40 + u * (hash(80, i) - 0.5) * 300, y = lerp(-40, 690 - hash(81, i) * 30, Math.min(1, u * u * 1.4)); c.translate(x, y); c.rotate(u * (hash(82, i) * 12 - 6)); c.globalAlpha = k.out; paper(rectP(-4, -36, 8, 72), ['#f0c419', '#3f7273', PAL.red][i % 3], { id: 'spc' + i, dense: false, lw: 0.8 }); c.restore(); } });
  O(306.0, 307.6, k => { const c = G.ctx; c.save(); c.globalAlpha = k.out; txt('ROAR!', 1000, 200, { size: 72, font: "'Permanent Marker'", col: '#f7c84a', rot: -0.1 }); c.restore(); });
  // street: three questions
  l = at('three different questions');
  if (l) O(fracTime(l, 'historical roots'), l.end + 4, k => { ['historical roots', 'current meaning', 'personal conscience'].forEach((s, i) => card(330 + i * 310, 120, 270, 80, [s], { id: 'tq' + i, size: 30, rot: (i - 1) * 0.04, pin: [PAL.red, PAL.teal, PAL.gold][i], s: easeOutBack(clamp(k.in * 3 - i)), alpha: k.out })); });
  l = at('Much too simple');
  if (l) O(l.start, l.end + 2, k => stamp(640, 120, 'TOO SIMPLE', k));
  l = at('Stingy Jack');
  if (l) O(fracTime(l, 'Stingy'), l.end + 2, k => card(640, 110, 420, 90, ['"Stingy Jack" — a folktale'], { id: 'sj', size: 32, tape: true, s: easeOutBack(k.in), alpha: k.out }));
  l = at('not conclusively documented');
  if (l) O(fracTime(l, 'That particular'), l.end + 3, k => stamp(640, 120, 'NOT CONCLUSIVELY DOCUMENTED', k));
  l = at('Hallow” means holy') || at('means holy');
  if (l) O(fracTime(l, 'Hallow'), l.end + 3, k => card(640, 110, 360, 100, ['"HALLOW" = holy?'], { id: 'hal', size: 40, headFont: "'Permanent Marker'", head: true, tape: true, s: easeOutBack(k.in), alpha: k.out }));
  // Rome
  l = at('Feralia was a Roman');
  if (l) O(l.start, l.end + 2, k => { card(470, 110, 300, 90, ['FERALIA', 'honouring the dead'], { id: 'fer', size: 26, head: true, headFont: "'Permanent Marker'", rot: -0.03, tape: true, s: easeOutBack(k.in), alpha: k.out }); card(810, 110, 300, 90, ['POMONA', 'orchards & fruit'], { id: 'pom', size: 26, head: true, headFont: "'Permanent Marker'", rot: 0.03, tape: true, s: easeOutBack(clamp(k.in * 2 - 0.5)), alpha: k.out }); });
  l = at('An inaccurate story');
  if (l) O(fracTime(l, 'An inaccurate'), l.end + 3, k => card(640, 110, 700, 100, ['An inaccurate story doesn\'t become accurate', 'because it supports an opinion we already hold.'], { id: 'inacc', size: 28, pin: PAL.red, s: easeOutBack(k.in), alpha: k.out }));
  // Cathedral timeline
  l = at('Not one universal date');
  const souls = at('A November second observance');
  if (l) {
    const pts = [
      [fracTime(l, '609'), '609/610', 'Pantheon · May'],
      [fracTime(l, 'eighth'), '8th c.', 'Gregory III · Nov 1'],
      [fracTime(l, 'Gregory IV'), '9th c.', 'Gregory IV spreads it'],
      [souls ? fracTime(souls, 'Odilo') : l.end + 60, 'c. 1000', 'Odilo · Nov 2 All Souls'],
    ];
    const endT = (at('So it isn\'t accurate') || l).start;
    O(l.start, endT, k => timeline(pts, k));
  }
  if (souls) O(fracTime(souls, 'So we have'), souls.end + 3, k => {
    [['OCT 31', 'All Hallows\' Eve'], ['NOV 1', 'All Saints'], ['NOV 2', 'All Souls']].forEach(([d, s], i) => card(440 + i * 200, 300, 170, 150, [d, s], { id: 'cal' + i, size: 24, head: true, headFont: "'Permanent Marker'", rot: (i - 1) * 0.03, pin: PAL.red, s: easeOutBack(clamp(k.in * 3 - i)), alpha: k.out }));
  });
  l = at('is an old English word');
  if (l) O(l.start, l.end + 2, k => {
    const u = clamp((G.t - l.start) / (l.end - l.start));
    const words = ['All Hallows\' Eve', 'Hallowe\'en', 'Halloween']; const i = Math.min(2, Math.floor(u * 3.2));
    card(640, 236, 600, 96, [words[i]], { id: 'hw' + i, size: 48, headFont: "'Permanent Marker'", head: true, tape: true, s: easeOutBack(k.in), alpha: k.out, col: i === 2 ? PAL.orange : PENCIL });
  });
  // intercom
  O(782.7, 785.5, k => { const c = G.ctx; c.save(); c.globalAlpha = k.out; paper(rectP(1060, 60, 140, 90), '#59687c', { id: 'icom' }); for (let i = 0; i < 4; i++) pencil([[1080, 80 + i * 14], [1180, 80 + i * 14]], { lw: 2 }); pencil([[1040, 100], [1020, 90], [1030, 110], [1005, 100]], { lw: 2, col: '#f7c84a' }); txt('*crackle*', 1130, 175, { size: 26, col: '#f3e8d2' }); c.restore(); });
  // medieval: soul cakes + refs
  l = at('often called');
  if (l) O(l.start, l.end + 2, k => card(610, 250, 240, 60, ['soul cakes'], { id: 'sc', size: 30, rot: -0.04, tape: true, s: easeOutBack(k.in), alpha: k.out }));
  // scripture cards (pop + pin) everywhere refs are spoken
  buildScripture();
  // Exodus 32
  l = at('Israel fashioning a golden calf');
  if (l) O(fracTime(l, 'golden'), 990, k => card(1040, 140, 220, 80, ['Exodus 32'], { id: 'ex32', size: 34, headFont: "'Permanent Marker'", head: true, rot: 0.03, tape: true, s: easeOutBack(k.in), alpha: k.out }));
  l = at('Should we decide how to honor God') || at('should we decide how to honor God');
  if (l) O(l.start, l.end + 2, k => card(640, 640, 820, 90, ['Should Scripture guide the practice from the beginning?'], { id: 'sg', size: 30, pin: PAL.gold, s: easeOutBack(k.in), alpha: k.out }));
  // Scene 5: four questions notepad
  l = at('First, ask what it celebrates');
  if (l) {
    const qs = [['First', 'What does it celebrate?'], ['Second', 'What does it ask us to imitate or admire?'], ['Third', 'What do we teach our children?'], ['fourth', 'Does it agree with Scripture?']];
    const times = qs.map(([m]) => fracTime(l, m));
    O(l.start, l.end + 28, k => notepad(qs.map(q => q[1]), times, k));
  }
  l = at('Which conviction?');
  if (l) O(fracTime(l, 'Which'), l.end + 4, k => ['Which conviction?', 'Which practice?', 'What is being surrendered?'].forEach((s, i) => card(360 + i * 280, 130, 250, 80, [s], { id: 'wc' + i, size: 28, rot: (i - 1) * 0.04, pin: PAL.red, s: easeOutBack(clamp(k.in * 3 - i)), alpha: k.out })));
  l = at('Children learn from what we choose');
  if (l) O(l.start, l.end + 3, k => card(640, 120, 640, 90, ['Children learn from what we choose,', 'not only from what we say.'], { id: 'cl', size: 30, tape: true, s: easeOutBack(k.in), alpha: k.out }));
  l = at('Maybe a harvest dinner');
  if (l) O(l.start, l.end + 6, k => thought(k));
  l = at('What do we want our celebrations to teach') || at('here\'s a question you can ask your family');
  if (l) O(fracTime(l, 'What do we'), l.end + 2, k => card(640, 130, 760, 110, ['"What do we want our celebrations', 'to teach about what matters to us?"'], { id: 'fam', size: 34, tape: true, s: easeOutBack(k.in), alpha: k.out, fill: '#fbf1d9' }));
  // Scene 6
  l = at('I have some reading to do');
  if (l) O(l.start + 1, l.end + 4, k => card(640, 175, 300, 260, ['Reading list', 'Psalm 24', 'Jeremiah 10', 'Deuteronomy 18', 'Isaiah 56', 'Romans 14'], { id: 'rl', size: 28, head: true, headFont: "'Permanent Marker'", rot: 0.04, tape: true, s: easeOutBack(k.in), alpha: k.out, fill: '#fbf6ea' }));
  l = at('Then how about Saturday evening');
  if (l) O(l.start + 0.5, 1446, k => newInvite(k));
  // closing words
  const cl = [at('History is worth understanding', 1400), at('Faith is worth examining', 1400), at('And your choices', 1400), at('are worth making on purpose', 1400)];
  if (cl[0]) O(cl[0].start, AUDIO_END + 0.5, k => closing(cl, k));
}
function stamp(x, y, s, k) {
  const c = G.ctx; c.save(); c.translate(x, y); c.rotate(-0.06); const sc = 1 + (1 - clamp(k.in * 2)) * 0.6; c.scale(sc, sc); c.globalAlpha = clamp(k.in * 2) * k.out * 0.9;
  c.font = "34px 'Permanent Marker'"; const w = c.measureText(s).width + 40;
  pencil(rrectP(-w / 2, -32, w, 64, 10), { closed: true, lw: 4, col: '#b8432f', alpha: 1, jit: 2 });
  txt(s, 0, 2, { size: 34, font: "'Permanent Marker'", col: '#b8432f' }); c.restore();
}
function timeline(pts, k) {
  const c = G.ctx; c.save(); c.globalAlpha = k.out;
  paper(rectP(140, 30, 1000, 150), '#f3e8d2', { id: 'tlbar', alpha: k.out });
  txt('All Saints\' Day — how the date developed', 640, 56, { size: 26, font: "'Permanent Marker'" });
  pencil([[180, 110], [1100, 110]], { lw: 3 });
  pts.forEach(([tt, a, b], i) => {
    if (G.t < tt) return; const x = 240 + i * 270, u = easeOutBack(clamp((G.t - tt) / 0.5));
    c.save(); c.translate(x, 110); c.scale(u, u); circle(0, 0, 10, PAL.red, { id: 'tld' + i }); c.restore();
    txt(a, x, 138, { size: 26, font: "'Permanent Marker'", alpha: u }); txt(b, x, 164, { size: 20, alpha: u });
  });
  c.restore();
}
function notepad(items, times, k) {
  const c = G.ctx; c.save(); c.translate(640, 175); c.rotate(0.02); c.globalAlpha = k.out; const s = easeOutBack(k.in) * 0.7; c.scale(s, s);
  paper(rectP(-230, -170, 460, 340), '#fbf6ea', { id: 'np' }); for (let y = -120; y < 170; y += 30) pencil([[-220, y], [220, y]], { lw: 0.7, col: '#8fb3d9', alpha: 0.5 });
  pencil([[-180, -170], [-180, 170]], { lw: 1, col: '#d97a7a', alpha: 0.7 });
  txt('Four questions', 20, -140, { size: 30, font: "'Permanent Marker'" });
  items.forEach((s, i) => { if (G.t < times[i]) return; const lines = wrapText(s, 380, 24); lines.forEach((ln, j) => txt((j ? '   ' : (i + 1) + '. ') + ln, -170, -95 + i * 70 + j * 26, { size: 24, align: 'left', alpha: clamp((G.t - times[i]) / 0.4) })); });
  c.restore();
}
function thought(k) {
  const c = G.ctx; c.save(); c.globalAlpha = k.out; const s = easeOutBack(k.in);
  [[880, 380, 12], [910, 340, 20]].forEach(([x, y, r], i) => circle(x, y, r * s, '#fbf6ea', { id: 'tb' + i }));
  c.translate(960, 200); c.scale(s, s);
  const P = []; for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283; P.push([Math.cos(a) * (200 + (i % 2) * 18), Math.sin(a) * (110 + (i % 2) * 12)]); }
  paper(P, '#fbf6ea', { id: 'cloud', dense: false });
  paper(rectP(-130, 10, 260, 22), '#7a5235', { id: 'table' }); paper(ellP(-60, 6, 34, 12), '#e0782f', { id: 'pie' }); paper(ellP(40, 4, 26, 18), '#d9a53b', { id: 'bread' });
  for (let i = 0; i < 4; i++) { circle(-120 + i * 80, -50, 16, ['#f0c49c', '#8d5a3b', '#d9a27a', '#f0c49c'][i], { id: 'tp' + i }); }
  txt('harvest dinner', 0, 70, { size: 28, font: "'Permanent Marker'", col: PAL.orange });
  c.restore();
}
function newInvite(k) {
  const c = G.ctx; c.save(); c.translate(640, 185); c.rotate(-0.03); const s = easeOutBack(k.in) * 0.66; c.scale(s, s); c.globalAlpha = k.out;
  paper(rectP(-200, -190, 400, 380), '#f6e2b5', { id: 'ninv' }); pencil(rectP(-184, -174, 368, 348), { closed: true, lw: 1.2, col: PAL.orange });
  txt('You\'re invited!', 0, -140, { size: 40, font: "'Permanent Marker'", col: PAL.orange });
  ['Saturday evening', 'dinner · friends · games', 'celebrating the good things', 'God has given us'].forEach((s2, i) => txt(s2, 0, -80 + i * 38, { size: 28 }));
  txt('+ brownies', -40, 110, { size: 34, font: "'Permanent Marker'", col: '#5a3418' });
  pencil([[90, 150], [60, 128], [40, 112]], { lw: 2, col: PAL.red }); pencil([[52, 108], [40, 112], [46, 124]], { lw: 2, col: PAL.red });
  txt('(arrows non-negotiable)', 40, 160, { size: 18 });
  c.restore();
}
function closing(cl, k) {
  const c = G.ctx; c.save(); c.globalAlpha = k.out;
  c.fillStyle = 'rgba(25,18,10,0.35)'; c.fillRect(0, 0, W, H);
  const rows = [['History is worth understanding.', cl[0]], ['Faith is worth examining.', cl[1]], ['And your choices are', cl[2]], ['worth making on purpose.', cl[3]]];
  rows.forEach(([s, l], i) => { if (!l || G.t < l.start) return; const u = easeOutBack(clamp((G.t - l.start) / 0.5)); c.save(); c.translate(640, 150 + i * 105); c.rotate((i % 2 ? 1 : -1) * 0.02); c.scale(u, u); card(0, 0, 900, 86, [s], { id: 'clo' + i, size: 40, headFont: "'Permanent Marker'", head: true, fill: ['#f3e8d2', '#e8d7b0', '#f6e2b5', '#f6e2b5'][i], col: i >= 2 ? PAL.orange : PENCIL }); c.restore(); });
  c.restore();
}

// scripture references: pop up large, then pin to corkboard (scene 5+) or fade
const REF_RE = /(Psalm \d+(?::\d+)?|Jeremiah \d+(?::\d+)?|Leviticus \d+(?::\d+)?|Deuteronomy \d+(?::\d+(?:–\d+)?)?|Hebrews \d+:\d+|First Timothy \d+:\d+|Isaiah \d+(?::\d+(?:–\d+)?)?|Romans \d+|Exodus \d+)/g;
let PINNED = [];
function buildScripture() {
  const seen = new Set();
  for (const l of LINES) {
    if (l.scene < 4) continue;
    let m; REF_RE.lastIndex = 0;
    while ((m = REF_RE.exec(l.text))) {
      let ref = m[1].replace('First Timothy', '1 Timothy');
      const tt = l.start + (l.end - l.start) * m.index / l.text.length;
      if (l.scene === 6) continue; // reading list card covers scene 6
      if (ref === 'Exodus 32') continue;
      const key = ref; if (seen.has(key)) continue; seen.add(key);
      const pinIdx = l.scene === 5 ? PINNED.length : -1;
      if (pinIdx >= 0) PINNED.push({ ref, t: tt + 2.6, i: pinIdx });
      OVL.push({ a: tt, b: tt + 2.8, fn: k => card(640, 170, 420, 110, [ref], { id: 'ref' + ref, size: 48, headFont: "'Permanent Marker'", head: true, tape: true, rot: (sid(ref) % 7 - 3) * 0.01, s: easeOutBack(k.in), alpha: l.scene === 5 ? 1 : k.out, fill: '#fbf6ea' }) });
    }
  }
}
function drawPinned(t) {
  if (locAt(t).cur !== 'office' || t < 1023.6) return;
  for (const p of PINNED) {
    if (t < p.t) continue;
    const col = p.i % 3, row = Math.floor(p.i / 3);
    const x = 870 + col * 78, y = 135 + row * 50;
    const u = clamp((t - p.t) / 0.5);
    const x0 = 640, y0 = 170;
    G.ctx.save(); G.ctx.translate(lerp(x0, x, ease(u)), lerp(y0, y, ease(u))); G.ctx.scale(lerp(1, 0.2, ease(u)) * (u < 1 ? 1 : 1), lerp(1, 0.2, ease(u)));
    if (u >= 1) { G.ctx.restore(); card(x, y, 76, 42, [p.ref.replace('Deuteronomy', 'Deut.').replace('Leviticus', 'Lev.').replace('Jeremiah', 'Jer.')], { id: 'pin' + p.ref, size: 13, pin: PAL.red, rot: (p.i % 3 - 1) * 0.05, fill: '#fbf6ea' }); continue; }
    card(0, 0, 420, 110, [p.ref], { id: 'ref' + p.ref, size: 48, headFont: "'Permanent Marker'", head: true, fill: '#fbf6ea' });
    G.ctx.restore();
  }
}

// ---------------------------------------------------------------- captions
function captionChunks(l) {
  const text = strip(l.text); const sents = text.match(/[^.!?]+[.!?]*["”]?\s*/g) || [text];
  const chunks = []; let cur = '';
  for (const s of sents) { if ((cur + s).length > 110 && cur) { chunks.push(cur.trim()); cur = s; } else cur += s; }
  if (cur.trim()) chunks.push(cur.trim());
  const total = chunks.reduce((a, s) => a + s.length, 0); let acc = 0;
  return chunks.map(s => { const a = l.start + (l.end - l.start) * acc / total; acc += s.length; return { s, a, b: l.start + (l.end - l.start) * acc / total }; });
}
function drawCaption(t) {
  const l = lineAt(t); if (!l) return;
  if (!l._chunks) l._chunks = captionChunks(l);
  const ch = l._chunks.find(c => t >= c.a && t < c.b + 0.25) || l._chunks[l._chunks.length - 1];
  const lines = wrapText(ch.s, 940, 30);
  const h = 22 + lines.length * 34, y = H - 14 - h;
  const c = G.ctx; c.save();
  paper(rectP(150, y, 980, h), 'rgba(246,239,224,0.93)', { id: 'capstrip' + lines.length, sx: 3, sy: 4, cut: 2 });
  const isTim = l.speaker === 'TIM';
  paper(rectP(120, y - 18, 110, 36), isTim ? PAL.orange : '#4f7a52', { id: 'tag' + l.speaker });
  txt(l.speaker, 175, y, { size: 24, font: "'Permanent Marker'", col: '#fbf6ea' });
  lines.forEach((s, i) => txt(s, 640, y + 26 + i * 34, { size: 30 }));
  c.restore();
}

// ---------------------------------------------------------------- scene banners, intro, outro
function sceneBanner(t) {
  for (const s of SCENES) {
    const a = s.start + (s.n === 1 ? 0.3 : 1.5), b = a + 4.5;
    if (t < a || t > b) continue;
    const k = { in: clamp((t - a) / 0.5), out: clamp((b - t) / 0.6) };
    const c = G.ctx; c.save(); c.globalAlpha = k.out; c.translate(lerp(-300, 40, easeOutBack(k.in)), 30);
    const title = `SCENE ${s.n} · ${s.title}`; c.font = "26px 'Permanent Marker'"; const w = c.measureText(title).width + 50;
    paper(rectP(0, 0, w, 56), '#f3e8d2', { id: 'ban' + s.n, cut: 3 }); paper(rectP(-6, 0, 18, 56), PAL.orange, { id: 'banl' + s.n, shadow: false });
    txt(title, 25 + (w - 25) / 2, 30, { size: 26, font: "'Permanent Marker'" });
    c.restore();
  }
}
function intro(T) {
  G.t = 0; SET.office(0);
  const c = G.ctx; c.fillStyle = 'rgba(20,14,8,0.55)'; c.fillRect(0, 0, W, H);
  const fl = ease(clamp((T - 0.8) / 1.0)), up = easeOutBack(clamp((T - 1.6) / 1.0));
  c.save(); c.translate(640, 420);
  // card sliding out of envelope
  c.save(); c.translate(0, -up * 250);
  paper(rectP(-300, -150, 600, 300), '#f6e2b5', { id: 'icard' });
  pencil(rectP(-284, -134, 568, 268), { closed: true, lw: 1.2, col: PAL.orange });
  txt('You\'re invited to…', 0, -95, { size: 30 });
  txt('The Halloween', 0, -38, { size: 56, font: "'Permanent Marker'", col: PAL.orange });
  txt('Party Invitation', 0, 22, { size: 56, font: "'Permanent Marker'", col: PAL.orange });
  txt('HalloweenHistory: Behind the Masks', 0, 80, { size: 28 });
  txt('a paper-cut audio play · story by Aquil Roberts', 0, 114, { size: 22, alpha: 0.8 });
  c.restore();
  paper(rectP(-320, -40, 640, 240), '#c98a4a', { id: 'env', hatch: { gap: 9, alpha: 0.1 } });
  paper([[-320, 200], [0, 60], [320, 200]], '#b97a3c', { id: 'envb', shadow: false });
  c.save(); c.scale(1, lerp(1, -1, fl)); paper([[-320, -40], [320, -40], [0, 100]], '#d39a5a', { id: 'envflap' }); c.restore();
  c.restore();
  c.globalAlpha = 1;
}
function outro(T) {
  const t = T - INTRO; G.t = t; SET.office(t);
  const c = G.ctx; c.fillStyle = 'rgba(20,14,8,0.6)'; c.fillRect(0, 0, W, H);
  const u = easeOutBack(clamp((t - AUDIO_END) / 0.8));
  c.save(); c.translate(640, 360); c.scale(u, u);
  card(0, 0, 700, 380, ['The Halloween Party Invitation', '', 'TIM  &  MATT', 'story concept: Aquil Roberts', 'paper-cut animation from the audio play', '', 'THE END'], { id: 'endc', size: 30, head: true, headFont: "'Permanent Marker'", fill: '#f6e2b5', tape: true });
  c.restore();
}

// ---------------------------------------------------------------- frame
function camera(t) {
  let shake = 0;
  for (const [a, amp] of [[35.87, 5], [129.6, 3], [131, 8], [306.2, 14], [627.7, 5], [950.8, 4], [1006.2, 7], [1341.3, 3]]) if (t >= a && t < a + 0.8) shake = Math.max(shake, amp * (1 - (t - a) / 0.8));
  const ts = step(t, 12);
  const { start } = locAt(t); const z = 1 + 0.035 * clamp((t - start) / 60);
  const sx = (hash(90, ts * 12 | 0) - 0.5) * 2 * shake, sy = (hash(91, ts * 12 | 0) - 0.5) * 2 * shake;
  return { z, sx, sy, px: Math.sin(t / 37) * 8 };
}
function renderAt(T) {
  const c = G.ctx; G.T = T; G.BF = Math.floor(T * 6);
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.drawImage(TEX.board, 0, 0);
  const t = T - INTRO; G.t = t;
  if (T < INTRO) { intro(T); }
  else if (t > AUDIO_END) { outro(T); }
  else {
    const cam = camera(t);
    c.save(); c.translate(640 + cam.sx + cam.px, 400 + cam.sy); c.scale(cam.z, cam.z); c.translate(-640, -400);
    drawSet(t);
    drawPinned(t);
    whoom(t);
    const loc = locAt(t).cur;
    const pm = posePuppet('MATT', t), pt = posePuppet('TIM', t);
    drawPuppet('MATT', pm); drawPuppet('TIM', pt);
    c.restore();
    for (const o of OVL) if (t >= o.a && t < o.b) o.fn({ in: clamp((t - o.a) / 0.45), out: clamp((o.b - t) / 0.5) });
    sceneBanner(t);
    drawCaption(t);
    // fade in from intro
    if (t < 0.6) { c.fillStyle = `rgba(20,14,8,${0.55 * (1 - t / 0.6)})`; c.fillRect(0, 0, W, H); }
  }
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
  c.drawImage(TEX.vignette, 0, 0);
}

async function init() {
  G.ctx = document.getElementById('c').getContext('2d');
  await Promise.all([document.fonts.load("30px 'Patrick Hand'"), document.fonts.load("30px 'Permanent Marker'")]);
  makeTextures();
  TL = await (await fetch('timeline.json')).json();
  ENV = await (await fetch('envelope.json')).json();
  LINES = TL.items.filter(i => i.kind === 'line'); CUES = TL.items.filter(i => i.kind === 'cue'); SCENES = TL.scenes;
  buildOverlays();
  window.TOTAL = INTRO + AUDIO_END + OUTRO;
  window.renderAt = renderAt; window.READY = true;
}
