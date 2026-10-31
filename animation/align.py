"""Align the audio-play script to the recording.

Usage: python3 align.py <script.md> <segments.json> <out timeline.json>
segments.json: [{"s": start_sec, "e": end_sec, "text": "..."}] from speech-to-text.
Produces one entry per dialogue line (speaker, text, start, end) and one per
[SFX]/[Music] cue (time = when the surrounding dialogue places it).
"""
import json, re, sys, difflib

script_path, segs_path, out_path = sys.argv[1:4]
norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())

# ---- parse script -------------------------------------------------------
items, scene = [], 0
scene_titles = {}
for raw in open(script_path, encoding="utf-8"):
    line = raw.strip()
    m = re.match(r"## SCENE (\d+) — (.+?) \(", line)
    if m:
        scene = int(m.group(1)); scene_titles[scene] = m.group(2); continue
    if line.startswith("## Producer"): break
    if not scene: continue
    m = re.match(r"\*\*(TIM|MATT):\*\* (.*)", line)
    if m:
        body = m.group(2)
        dirs = re.findall(r"\[([^\]]+)\]", body)
        text = re.sub(r"\s*\[[^\]]+\]\s*", " ", body).strip()
        items.append({"kind": "line", "scene": scene, "speaker": m.group(1), "text": text, "dir": " ".join(dirs)})
        continue
    m = re.match(r"\[(SFX|Music): (.*)\]$", line)
    if m:
        items.append({"kind": "cue", "scene": scene, "type": m.group(1), "text": m.group(2)})

# ---- words ---------------------------------------------------------------
sw, sidx = [], []
for i, it in enumerate(items):
    if it["kind"] != "line": continue
    for w in it["text"].replace("—", " ").replace("-", " ").split():
        n = norm(w)
        if n: sw.append(n); sidx.append(i)

segs = json.load(open(segs_path))
tw, tt = [], []
for sg in segs:
    words = [w for w in sg["text"].replace("-", " ").split() if norm(w)]
    total = sum(len(w) + 1 for w in words) or 1
    acc = 0
    for w in words:
        t0 = sg["s"] + (sg["e"] - sg["s"]) * acc / total
        acc += len(w) + 1
        t1 = sg["s"] + (sg["e"] - sg["s"]) * acc / total
        tw.append(norm(w)); tt.append((t0, t1))

sm = difflib.SequenceMatcher(None, sw, tw, autojunk=False)
times = {}
for a, b, n in sm.get_matching_blocks():
    for k in range(n):
        times.setdefault(sidx[a + k], []).append(tt[b + k])

lines = [i for i, it in enumerate(items) if it["kind"] == "line"]
for i in lines:
    if i in times:
        items[i]["start"] = min(t[0] for t in times[i]); items[i]["end"] = max(t[1] for t in times[i])
# interpolate gaps
known = [i for i in lines if "start" in items[i]]
for i in lines:
    if "start" in items[i]: continue
    prev = max([k for k in known if k < i], default=None); nxt = min([k for k in known if k > i], default=None)
    s = items[prev]["end"] if prev is not None else 0.0
    e = items[nxt]["start"] if nxt is not None else segs[-1]["e"]
    items[i]["start"], items[i]["end"] = s, max(s + 0.5, e)
    items[i]["interpolated"] = True
# keep monotonic
last = 0.0
for i in lines:
    items[i]["start"] = max(items[i]["start"], last)
    items[i]["end"] = max(items[i]["end"], items[i]["start"] + 0.4)
    last = items[i]["start"]
# cues: placed at end of previous line (or start of next if at scene top)
for i, it in enumerate(items):
    if it["kind"] != "cue": continue
    prev = next((items[k] for k in range(i - 1, -1, -1) if items[k]["kind"] == "line"), None)
    nxt = next((items[k] for k in range(i + 1, len(items)) if items[k]["kind"] == "line"), None)
    if prev and prev["scene"] == it["scene"]:
        it["t"] = prev["end"] + (0.2 if not nxt else min(0.6, max(0.0, nxt["start"] - prev["end"]) / 2))
    else:
        it["t"] = max(0.0, (nxt["start"] if nxt else 0) - 1.0)
for it in items:
    for k in ("start", "end", "t"):
        if k in it: it[k] = round(it[k], 2)

scenes = []
for n in sorted(scene_titles):
    ls = [it for it in items if it["kind"] == "line" and it["scene"] == n]
    scenes.append({"n": n, "title": scene_titles[n], "start": ls[0]["start"], "end": ls[-1]["end"]})
for a, b in zip(scenes, scenes[1:]):
    mid = round((a["end"] + b["start"]) / 2, 2); a["end"] = mid; b["start"] = mid
scenes[0]["start"] = 0.0; scenes[-1]["end"] = round(segs[-1]["e"] + 3, 2)
json.dump({"scenes": scenes, "items": items}, open(out_path, "w"), indent=1, ensure_ascii=False)
ml = sum(1 for i in lines if not items[i].get("interpolated"))
print(f"{len(lines)} lines, {ml} matched, {len(lines)-ml} interpolated")
for s in scenes: print(s)
