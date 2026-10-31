// Render the full animation to MP4 using headless Chromium + ffmpeg.
// Usage: node render.js [outFile] [workers] [fps]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { spawn, execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(root, 'The-Halloween-Party-Invitation-Animated.mp4'));
const WORKERS = +(process.argv[3] || 4), FPS = +(process.argv[4] || 12);
const MP3 = path.join(root, 'The Halloween Party Invitation.mp3');
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'hpi-'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });

async function worker(browser, idx, f0, f1) {
  const pg = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  pg.on('pageerror', e => console.error('page error', e.message));
  await pg.goto(`http://localhost:${srv.address().port}/animation/index.html?render`);
  await pg.waitForFunction('window.READY === true', null, { timeout: 60000 });
  const seg = path.join(tmp, `seg${idx}.mp4`);
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-tune', 'animation', '-crf', '24', '-pix_fmt', 'yuv420p', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const BATCH = 12;
  for (let f = f0; f < f1; f += BATCH) {
    const frames = await pg.evaluate(([a, b, fps]) => { const out = []; for (let i = a; i < b; i++) { renderAt(i / fps); out.push(document.getElementById('c').toDataURL('image/jpeg', 0.93).split(',')[1]); } return out; }, [f, Math.min(f + BATCH, f1), FPS]);
    for (const b64 of frames) if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (idx === 0 && (f - f0) % (BATCH * 50) === 0) console.log(`worker0 ${Math.round(100 * (f - f0) / (f1 - f0))}%`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await pg.close();
  return seg;
}

(async () => {
  await new Promise(r => srv.listen(0, r));
  const browser = await chromium.launch();
  const probe = await browser.newPage(); await probe.goto(`http://localhost:${srv.address().port}/animation/index.html?render`);
  await probe.waitForFunction('window.READY === true'); const TOTAL = await probe.evaluate('TOTAL'); await probe.close();
  const N = Math.ceil(TOTAL * FPS), per = Math.ceil(N / WORKERS);
  console.log(`rendering ${N} frames @ ${FPS}fps with ${WORKERS} workers`);
  const t0 = Date.now();
  const segs = await Promise.all([...Array(WORKERS)].map((_, i) => worker(browser, i, i * per, Math.min(N, (i + 1) * per))));
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map(s => `file '${s}'`).join('\n'));
  // Join segments, add the soundtrack (delayed 5 s for the title card), and two-pass encode
  // at ~400 kb/s so the file stays under GitHub's 100 MB limit.
  const joined = path.join(tmp, 'joined.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-c', 'copy', joined], { stdio: 'inherit' });
  const v = ['-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-b:v', '400k', '-passlogfile', path.join(tmp, 'pass')];
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', joined, ...v, '-pass', '1', '-an', '-f', 'null', '/dev/null'], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', joined, '-i', MP3, '-filter_complex', '[1:a]adelay=5000|5000,apad[a]', '-map', '0:v', '-map', '[a]',
    ...v, '-pass', '2', '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
  console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s -> ${OUT}`);
})();
