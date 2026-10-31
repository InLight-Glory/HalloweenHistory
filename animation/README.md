# The Halloween Party Invitation — paper-cut animation

This folder holds a full-length animated version of the audio play *HalloweenHistory: Behind the Masks*. It's drawn in a **paper-cutout + pencil-sketch** style and synced line for line to `The Halloween Party Invitation.mp3`.

- **Rendered video:** `../The-Halloween-Party-Invitation-Animated.mp4` (1280×720, 12 fps stop-motion, ~24:45)
- **Live player:** serve the repo root and open `animation/index.html`. Press Play and the animation is drawn in real time against the MP3.

## How it's made

| File | Role |
|------|------|
| `align.py` | Aligns `HalloweenHistory-Audio-Play.md` to a speech-to-text transcript of the MP3, so every dialogue line and `[SFX]`/`[Music]` cue gets a timestamp. |
| `timeline.json` | Output of `align.py`: the 6 scenes, 214 dialogue lines and 47 cues with times in seconds. |
| `envelope.json` | Loudness of the recording at 24 fps. It drives the puppets' mouths. |
| `js/engine.js` | The drawing engine: scissor-cut paper shapes with drop shadows and paper grain, graphite outlines that "boil" (re-jitter) 6× a second, and pencil hatching. |
| `js/characters.js` | The jointed paper puppets TIM and MATT (head tilt, blinking, arms, sitting and crouching, held props). |
| `js/scenes.js` | The sets: office, timeline lab, Celtic hillside, modern street, Roman courtyard, cathedral, medieval street and the Exodus 32 spotlight. |
| `js/main.js` | The director: scene schedule and torn-paper transitions, poses from the script's stage directions, on-screen cards (dates, Scripture references, the four questions, the new invitation), captions, and the intro and closing titles. |
| `render.js` | Renders every frame in headless Chromium and encodes it with ffmpeg, then adds the audio (delayed 5 s for the title card). |

## Re-rendering

```bash
node animation/render.js The-Halloween-Party-Invitation-Animated.mp4 4 12
```

The arguments are the output file, the number of parallel workers and the frame rate. This needs Node with Playwright/Chromium and ffmpeg.

To re-time after re-recording the audio, re-run the speech-to-text, then:

```bash
python3 animation/align.py HalloweenHistory-Audio-Play.md segments.json animation/timeline.json
```

## Credits
- Story concept and script: Aquil Roberts
- Fonts: Patrick Hand (SIL OFL 1.1) and Permanent Marker (Apache 2.0), from Fontsource
