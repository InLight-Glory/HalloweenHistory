#!/usr/bin/env python3
"""Build "The Halloween Party Invitation" paper-cut animation into a local video.

The animation lives in animation/ (HTML canvas + JS). This script opens it in a
headless Chromium, renders every frame, pipes the frames to ffmpeg, and adds the
soundtrack from "The Halloween Party Invitation.mp3".

Quick start
-----------
    python build.py --install-deps      # one-time: installs Playwright, Chromium and an ffmpeg binary
    python build.py                     # full video -> The-Halloween-Party-Invitation-Animated.mp4
    python build.py --preview           # 30-second test clip first, to check your setup

More options
------------
    python build.py --out my_video.mp4 --fps 24 --workers 6 --crf 18
    python build.py --start 300 --end 420     # render only part of the timeline (seconds)
    python build.py --chromium "C:/path/to/chrome.exe"   # use a browser you already have

Requirements: Python 3.8+, the `playwright` package plus a Chromium browser, and
ffmpeg (taken from PATH, or from the `imageio-ffmpeg` package).
"""
import argparse
import asyncio
import base64
import functools
import http.server
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MP3 = ROOT / "The Halloween Party Invitation.mp3"
INTRO = 5.0  # seconds of title card before the audio starts (must match animation/js/main.js)
DEFAULT_OUT = ROOT / "The-Halloween-Party-Invitation-Animated.mp4"


# --------------------------------------------------------------------------- setup helpers
def install_deps():
    py = sys.executable
    print("Installing Python packages: playwright, imageio-ffmpeg ...")
    subprocess.check_call([py, "-m", "pip", "install", "--upgrade", "playwright", "imageio-ffmpeg"])
    print("Installing Chromium for Playwright ...")
    subprocess.check_call([py, "-m", "playwright", "install", "chromium"])
    print("Dependencies installed.")


def find_ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        sys.exit("ffmpeg not found. Install it (https://ffmpeg.org) or run: python build.py --install-deps")


def check_inputs():
    missing = [p for p in [MP3, ROOT / "animation" / "index.html", ROOT / "animation" / "timeline.json"] if not p.exists()]
    if missing:
        sys.exit("Missing files:\n  " + "\n  ".join(str(m) for m in missing) +
                 "\nRun build.py from inside the HalloweenHistory repository.")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class QuietServer(http.server.ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        pass  # the browser dropping a connection (e.g. the audio preload) is harmless


def start_server():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    httpd = QuietServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def fmt(sec):
    sec = int(sec)
    return f"{sec // 60}:{sec % 60:02d}"


# --------------------------------------------------------------------------- rendering
async def render_segment(browser, url, idx, f0, f1, fps, ffmpeg, seg_path, crf, progress):
    page = await browser.new_page(viewport={"width": 1280, "height": 720})
    page.on("pageerror", lambda e: print(f"[worker {idx}] page error: {e}", file=sys.stderr))
    await page.goto(url)
    await page.wait_for_function("window.READY === true", timeout=120_000)
    proc = await asyncio.create_subprocess_exec(
        ffmpeg, "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
        "-c:v", "libx264", "-preset", "medium", "-tune", "animation", "-crf", str(crf), "-pix_fmt", "yuv420p",
        "-r", str(fps), str(seg_path), stdin=asyncio.subprocess.PIPE)
    batch = 12
    js = """([a, b, fps]) => { const out = []; for (let i = a; i < b; i++) { renderAt(i / fps);
            out.push(document.getElementById('c').toDataURL('image/jpeg', 0.93).split(',')[1]); } return out; }"""
    for f in range(f0, f1, batch):
        frames = await page.evaluate(js, [f, min(f + batch, f1), fps])
        for b64 in frames:
            proc.stdin.write(base64.b64decode(b64))
        await proc.stdin.drain()
        progress[idx] = min(f + batch, f1) - f0
    proc.stdin.close()
    if await proc.wait() != 0:
        raise RuntimeError(f"ffmpeg failed while encoding segment {idx}")
    await page.close()


async def report(progress, total, t0, done):
    while not done.is_set():
        n = sum(progress)
        el = time.time() - t0
        eta = el / n * (total - n) if n else 0
        print(f"\r  frames {n}/{total}  ({100 * n / total:5.1f}%)  elapsed {fmt(el)}  eta {fmt(eta)}   ", end="", flush=True)
        try:
            await asyncio.wait_for(done.wait(), 2)
        except asyncio.TimeoutError:
            pass
    print()


async def render(args, ffmpeg, tmp):
    from playwright.async_api import async_playwright

    httpd = start_server()
    url = f"http://127.0.0.1:{httpd.server_address[1]}/animation/index.html?render"
    async with async_playwright() as pw:
        launch = {"executable_path": args.chromium} if args.chromium else {}
        try:
            browser = await pw.chromium.launch(**launch)
        except Exception as e:
            sys.exit(f"Could not start Chromium: {e}\nRun: python build.py --install-deps  (or pass --chromium PATH)")
        probe = await browser.new_page()
        await probe.goto(url)
        await probe.wait_for_function("window.READY === true", timeout=120_000)
        total_sec = await probe.evaluate("TOTAL")
        await probe.close()

        start = max(0.0, args.start)
        end = min(total_sec, args.end if args.end is not None else total_sec)
        if end <= start:
            sys.exit("--end must be greater than --start")
        f_start, f_end = int(start * args.fps), int(end * args.fps)
        n = f_end - f_start
        workers = max(1, min(args.workers, n // args.fps or 1))
        per = -(-n // workers)
        print(f"Rendering {fmt(start)}-{fmt(end)} of {fmt(total_sec)}: {n} frames at {args.fps} fps, {workers} workers")

        progress = [0] * workers
        done = asyncio.Event()
        t0 = time.time()
        reporter = asyncio.create_task(report(progress, n, t0, done))
        segs, jobs = [], []
        for i in range(workers):
            a, b = f_start + i * per, min(f_end, f_start + (i + 1) * per)
            if a >= b:
                break
            seg = tmp / f"seg{i:02d}.mp4"
            segs.append(seg)
            jobs.append(render_segment(browser, url, i, a, b, args.fps, ffmpeg, seg, args.crf, progress))
        try:
            await asyncio.gather(*jobs)
        finally:
            done.set()
            await reporter
            await browser.close()
            httpd.shutdown()
    return segs, start, end


def mux(ffmpeg, segs, start, end, out, tmp):
    lst = tmp / "list.txt"
    lst.write_text("".join(f"file '{s.as_posix()}'\n" for s in segs), encoding="utf-8")
    # audio starts INTRO seconds into the video; shift it to match the rendered window
    a_off = start - INTRO
    cmd = [ffmpeg, "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst)]
    if a_off >= 0:
        cmd += ["-ss", f"{a_off:.3f}", "-i", str(MP3), "-filter_complex", "[1:a]apad[a]"]
    else:
        ms = int(round(-a_off * 1000))
        cmd += ["-i", str(MP3), "-filter_complex", f"[1:a]adelay={ms}|{ms},apad[a]"]
    cmd += ["-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
            "-t", f"{end - start:.3f}", "-movflags", "+faststart", str(out)]
    subprocess.check_call(cmd)


def main():
    ap = argparse.ArgumentParser(description="Build the paper-cut animation into a video file.")
    ap.add_argument("--out", type=Path, default=None, help=f"output file (default: {DEFAULT_OUT.name})")
    ap.add_argument("--fps", type=int, default=12, help="frames per second (12 = stop-motion look; 24 = smoother)")
    ap.add_argument("--workers", type=int, default=max(1, min(8, (os.cpu_count() or 4))), help="parallel render workers")
    ap.add_argument("--crf", type=int, default=20, help="x264 quality: lower = better/larger (18-28)")
    ap.add_argument("--start", type=float, default=0.0, help="start time in seconds (video timeline)")
    ap.add_argument("--end", type=float, default=None, help="end time in seconds (video timeline)")
    ap.add_argument("--preview", action="store_true", help="render a 30 s test clip (0:00-0:30)")
    ap.add_argument("--chromium", default=os.environ.get("CHROMIUM_PATH"), help="path to a Chromium/Chrome executable")
    ap.add_argument("--keep-temp", action="store_true", help="keep the temporary segment files")
    ap.add_argument("--install-deps", action="store_true", help="install Playwright, Chromium and ffmpeg, then exit")
    args = ap.parse_args()

    if args.install_deps:
        install_deps()
        return
    try:
        import playwright  # noqa: F401
    except ImportError:
        sys.exit("The 'playwright' package is not installed. Run: python build.py --install-deps")

    check_inputs()
    if args.preview:
        args.start, args.end = 0.0, 30.0
    out = (args.out or (ROOT / ("preview.mp4" if args.preview else DEFAULT_OUT.name))).resolve()
    ffmpeg = find_ffmpeg()

    tmp = Path(tempfile.mkdtemp(prefix="hpi-build-"))
    t0 = time.time()
    try:
        segs, start, end = asyncio.run(render(args, ffmpeg, tmp))
        print("Adding soundtrack ...")
        mux(ffmpeg, segs, start, end, out, tmp)
    finally:
        if not args.keep_temp:
            shutil.rmtree(tmp, ignore_errors=True)
    size = out.stat().st_size / 1e6
    print(f"Done in {fmt(time.time() - t0)} -> {out} ({size:.1f} MB)")


if __name__ == "__main__":
    main()
