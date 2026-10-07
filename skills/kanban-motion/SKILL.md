---
name: kanban-motion
description: "Make or edit code-driven motion graphics videos: launch videos, explainers and promos from a project, a website or a script, with a generated or recorded voiceover, a music bed and sound effects, all synced word by word. Works with the Motion as Code kit (voiceover-synced plates, preview, stills, render, SFX mix) or the bundled starter kit. Use for \"motion graphics\", \"motion as code\", \"edit the plate\", \"render the video\", \"swap the voiceover\", \"add a voiceover\", \"narrate this\", \"make a launch video\", \"turn this into a video\", \"promo video\", \"kanban motion\"."
---

# Kanban Motion

Made by Kanban Studios. Motion graphics written as code and locked to a voice. This skill has two layers:

1. **Motion as Code** (below, unchanged): the full workflow for the Motion as Code kit.
2. **Kanban Motion additions** (after it): a starter kit that needs no external project, voiceover generation and word alignment, launch-video planning (inspect, plan, tones, creative laws), an original music bed, a CC0 sound library and mixer, and delivery (poster frame and share copy).

Use the kit when the user has it or is editing it. Otherwise use the starter kit. The same rules apply to both: plates are pure functions of time, check stills before rendering, and ask before a full render.

# Motion as Code

A workflow for making motion graphics from code, locked to a voiceover, with no After Effects. Each scene (a "plate") is a TypeScript file that draws every frame as a pure function of time; word-level timings of the voiceover tell each plate when to animate. The browser preview and the exported MP4 are identical.

Output: 1920x1080, 60 fps. Stack: TypeScript + three.js, bun + Vite, headless Chrome + ffmpeg.

## Where the kit lives

The project folder is `Motion_as_kit` in the user's Documents folder (`C:\Users\awaiz\OneDrive\Documents\Motion_as_kit` on their Windows PC). If it is not reachable or has moved, ask the user where it is. Keep the folder structure exactly as it is: the scripts use relative paths.

Before the first change in a session, read `README.md`, `app/src/timeline.ts` and `app/src/engine/scene.ts`.

## Requirements (on the user's machine)

- bun (bun.sh): installs packages and runs scripts
- Google Chrome: the renderer drives it headlessly (set `BROWSER_CHANNEL`, e.g. `msedge`, to use another browser)
- ffmpeg with libx264
- Python + uv, only to re-align a new voiceover or rebuild the SFX mix; run it as `python -m uv`

`app/node_modules` is not shipped. Run `bun install` inside `app/` before anything else.

## Layout

| Path | Role |
| --- | --- |
| `audio/voiceover.mp3` | The voiceover |
| `audio/sfx/` | 28 sound effects (`name_1.mp3`, `name_2.mp3` are alternate takes) |
| `data/lyrics.json` | Word-level timings, made by `analysis/align_vo.py` (CTC forced alignment, wav2vec2 ONNX) |
| `data/audio.json` | Voice loudness envelopes, word onsets, nominal beat grid, made by `analysis/audio_vo.py` |
| `analysis/sfx_mix.py` | Cue sheet (~500 cues) and SFX mixer |
| `app/src/engine/` | The pdoom-video engine. Do not edit. |
| `app/src/scenes/_vo.ts` | Shared toolkit: 2D camera, plotter pen, world-space karaoke words, graph paper |
| `app/src/scenes/*.ts` | The plates |
| `app/src/timeline.ts` | When each plate plays; cuts sit in the pause just before each line |
| `app/scripts/render.ts` | Offline renderer: headless Chrome to raw frames to ffmpeg |
| `out/` | Renders |

The shipped demo has nine plates: hook, model, prompt, crazy, code, frames, pipeline, edits, verdict (92.6 s total; verdict loops back to frame 0).

## Rules

- Everything in a plate must be a deterministic function of time. No `Math.random()` without a seed, no wall-clock time, no state that is not reset on seek.
- Do not edit `app/src/engine/`.
- Do not run a full render, and never a 4K render, without asking the user first. Use stills to check work.
- Explain each change in one or two sentences before making it.
- Keep `LICENSE.pdoom-engine` with the project (engine and visual style are pdoom-video by mexicat, MIT).

## Workflow

### 1. Preview (the fast loop)

```sh
cd app
bun install      # first time only
bunx vite        # http://localhost:5173
```

Edits hot-reload. Keys: space play/pause, left/right seek 1 s (5 s with shift), `,` `.` step a frame, `[` `]` previous/next plate, `l` loop the plate, `h` hide UI. Add `?t=35` to the URL to start at 35 s.

### 2. Check stills while editing

```sh
cd app
bun scripts/render.ts stills --t 12.5,40.2 --only code --out ../out/wip
```

Renders single frames (here the `code` plate at 12.5 s and 40.2 s). Look at the stills and show them to the user before proposing a full render.

### 3. Render the video (ask first)

```sh
cd app
bun run render
```

Equivalent to `bun scripts/render.ts video --samples auto --min-samples 4 --max-samples 12 --shutter 0.5 --crf 17 --out ../out/motion-as-code.mp4`.

- `--samples 4`: about 4x faster draft; fast moves show stepped copies
- `--samples auto`: more sub-frames where motion is fast (default)
- `--scale 2`: 4K (3840x2160)

### 4. Sound effects

No re-render needed: rebuild the mix, then copy the picture and add audio. Run from the project root.

```sh
python -m uv run --no-project --with numpy python analysis/sfx_mix.py
cd out
ffmpeg -i motion-as-code.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -shortest motion-as-code_sfx.mp4
```

Effects duck up to 7 dB under the voice; the mix is normalised to -14 LUFS. To change an effect's loudness, edit its `db` value in the cue sheet; to move it, edit its time expression.

### 5. Swap the voiceover

1. Replace `audio/voiceover.mp3`.
2. Edit `SCRIPT` (and `SPOKEN` for numbers and acronyms) in `analysis/align_vo.py`.
3. Re-run, from the project root:

```sh
python -m uv run --no-project --with onnxruntime --with numpy python analysis/align_vo.py
python -m uv run --no-project --with numpy python analysis/audio_vo.py
```

Plates find their words by content (`lineOf`, `wordOf`), so with the same script every animation re-times itself. If the wording changed, update the anchor phrases in the `cut(...)` calls in `timeline.ts` and tell the user which ones changed.

## Writing or changing a plate

A plate is a class that extends `Scene` (`app/src/engine/scene.ts`) and is the file's default export. The engine calls `render(f, out)` once per frame with:

- `f.t` song time, `f.lt` time since the plate started, `f.p` progress 0 to 1 through the plate
- `f.a` audio features at that moment (voice envelope, hit pulses)
- `f.seeked` true after a scrub; stateful plates must reset on it

To add a plate: create `app/src/scenes/yourplate.ts`, then add one `E('yourplate', 'yourplate', start, end)` line in `timeline.ts`. Start times come from the script: `cut('This is Claude')` cuts 0.18 s before that line's first word. The file name in `timeline.ts` must match a file in `app/src/scenes/`.

The `prompt` plate reads its token breakdowns from `app/src/scenes/prompt-data.ts`.

Study an existing plate and `_vo.ts` before writing a new one, and reuse the toolkit and palette (ink, bone, signal orange) rather than inventing new helpers.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Blank page at localhost:5173 | Run `bun install` in `app/`; check the vite terminal for errors |
| No sound in preview | Press space; the browser blocks audio until interaction. Check the tab is not muted |
| Render cannot find Chrome | Install Chrome, or set `BROWSER_CHANNEL` (e.g. `msedge`) |
| ffmpeg not found / no libx264 | Install a full ffmpeg build; confirm `ffmpeg -version` in a new terminal |
| Render is very slow | `--samples 4` for drafts; render single plates with the stills command |
| Animation drifted after a new voiceover | Re-run both analysis scripts; update `cut(...)` phrases if wording changed |
| Scene module not found | File name in `timeline.ts` must match a file in `app/src/scenes/` |

---

# Kanban Motion additions

Everything below adds to the Motion as Code workflow above; none of it replaces it. `<skill-dir>` is the folder that contains this `SKILL.md` (Claude Code prints it as "Base directory for this skill"). Don't guess an install path.

## Pick the path

| Situation | Do this |
| --- | --- |
| The user has `Motion_as_kit`, or asks to edit a plate, render, or swap the voiceover in it | Follow **Motion as Code** above. Use the additions (voiceover generation, music bed, launch planning, delivery) where they help. |
| A new video from a project, a website, a script or an idea, with no kit around | Use the **starter kit** below, plus the launch workflow. |
| "Make a launch video", "turn this into a video", "promo" | Run the **launch workflow** (inspect, plan, build, deliver) on whichever kit is available. |

Output goes to `kanban-motion-output/` in the current directory, or to a timestamped `kanban-motion-output-YYYY-MM-DD-HHmmss/` if that folder exists. Inside it: `reel/` (the plates), `out/` (renders, mix, stills), `work/` (downloads, scratch), plus `plan.md`, `script.txt` and `share-copy.txt`.

## Starter kit

A small, dependency-free version of the same idea: plain ES modules in a browser, frames captured by headless Chrome, encoded by ffmpeg. Requirements: Node 18+, Chrome or Edge, ffmpeg with libx264, and uv (for the audio scripts). Once per machine: `npm install --prefix <skill-dir>/scripts`.

Copy `<skill-dir>/template/` to `kanban-motion-output/reel/`. Before the first change, read `reel.js`, `engine.js` and one plate.

| Path | Role |
| --- | --- |
| `reel.js` | The timeline: `E(plate({...}), start, end)` per plate, with cuts from the voice via `cut('phrase')` |
| `engine.js` | Preview, seeking and render hooks. Do not edit. |
| `motion.js` | Toolkit: `range`, `ease`, closed-form `spring`, seeded `rng`/`hash`, `typed`, and voice sync `lineOf`, `wordOf`, `wordsIn`, `cut` |
| `plates/*.js` | `paper` (graph-paper backdrop that breathes with the voice), `say` (kinetic words landing as spoken), `code` (typing editor), `shot` (real screenshot in a window), `outro` (name, pen underline, tagline, URL). For launch videos: `bg` (drifting gradient), `photo` (full-bleed image with a push and an optional scan-line "turn" to a second image), `screen` (real UI with camera keys and tracking callouts), `typewrite` (letter-by-letter headlines), `stats` (count-up numbers), `steps` (a pipeline lighting up on the voice), `cap` (captions of the line being spoken), `logo` (logo reveal with tagline, badge, URL and credit). For cinematic sequences: `space` (one seamless camera move through a 3D scene of morphing wireframe solids, a perspective grid and kinetic type in 3D) |
| `style.css` | Palette and type tokens (ink, bone, signal orange). Swap in the project's exact colours and fonts. |
| `audio/`, `data/`, `cues.json` | Voiceover and music; `words.json`, `lines.json` and `audio.json`; the sound cue sheet. The template ships a working demo of all three, so preview and render work immediately. Put images in `assets/`. |

A plate is `{ name, setup(root), draw(f) }`. `draw` receives `f.t` (global time), `f.lt` (time since the plate started), `f.p` (0 to 1 through the plate), `f.dur`, `f.env` (voice loudness 0 to 1) and `f.fps`. It must set every visual property from `f` alone: no `Math.random()` (use `rng(seed)`), no wall-clock time, no state that a seek would not reset. Give a plate `tail: 0.4` in `E(...)` to let it overlap the next one for a transition.

```sh
node <skill-dir>/scripts/render.mjs preview --dir reel                         # http://127.0.0.1:5173, same keys as the kit
node <skill-dir>/scripts/render.mjs stills --dir reel --plates --out out/wip   # settled frame + into-the-cut frame per plate
node <skill-dir>/scripts/render.mjs stills --dir reel --t 2.4,6.1 --only say --out out/wip
node <skill-dir>/scripts/render.mjs video --dir reel --samples 4 --audio out/mix.wav --out out/reel.mp4   # ask first
```

Render flags mirror the kit: `--samples` (motion-blur sub-frames, 4 for drafts, 8 to 12 for finals), `--shutter 0.5`, `--scale 2` (4K, ask first), `--crf 17`, `--from/--to`, `--fps`. Use `BROWSER_CHANNEL=msedge` or `BROWSER_PATH=...` if Chrome is missing. Vertical (1080x1920) and square (1080x1080) work by changing `width`/`height` in `reel.js`; recheck every plate's layout in stills when you do.

Worked examples live in the repo's `examples/` folder (five real projects: voiced landscape, beat-cut vertical, voiced square explainer, and two 3D cinematic sequences). Read the one closest to the request before writing a new reel. Capture real UI as the "show the thing" material:
- **Live sites:** use headless Chrome screenshots at 2x.
- **Apps the user owns:** run them on localhost, using the app's own demo or "fill" sign-in if it has one.

Then aim cameras and callouts with 0..1 fractions read off a gridded copy of each screenshot.

## Voiceover

Add one when the user asks for narration or a voiceover, or passes `--voice`. Details are in [references/voiceover.md](references/voiceover.md).

1. **Write `script.txt`**: one line per beat, since lines become cuts. A blank line adds a longer pause; `[pause 0.8]` adds an exact one. Write numbers and acronyms the way they are spoken. Narration should add to the visuals rather than read them out, match the scene pacing, sound conversational, and be specific to the product. Budget about 2.5 words per second.
2. **Generate it** with Kokoro, an open-weight voice that runs locally. The model downloads once (about 340 MB).
   ```sh
   uv run <skill-dir>/scripts/voiceover.py script.txt -o reel/audio/voiceover.wav --lines reel/data/lines.json --voice af_heart
   ```
   Good voices: `af_heart`, `af_bella`, `am_michael`, `am_fenrir`, `bf_emma`, `bm_george` (blend them with `--voice af_heart:0.6,af_bella:0.4`; adjust pace with `--speed`). `--engine system` uses the OS voice with no download. If the user recorded their own voice, put it at `reel/audio/voiceover.wav` and skip this step.
3. **Align it** to get word-level timings. faster-whisper's word timings are snapped onto the script's own words, and the line bounds from step 2 are pinned exactly:
   ```sh
   uv run <skill-dir>/scripts/align.py reel/audio/voiceover.wav --script script.txt --lines reel/data/lines.json -o reel/data/words.json
   ```
   This writes `words.json` and `audio.json` (the voice envelope behind `f.env`).
4. **Sync plates**: `cut('Every frame')` starts a plate 0.18 s before that line. `lineOf`, `wordOf` and `wordsIn` find words by content, so regenerating the voice with the same script re-times everything. If the wording changes, update the `cut(...)` phrases and tell the user which ones changed.

**With the kit:** generate with `voiceover.py`, convert it with `ffmpeg -i voiceover.wav -b:a 192k audio/voiceover.mp3`, put the script into `SCRIPT` in `analysis/align_vo.py`, then follow the kit's "Swap the voiceover" steps.

## Launch workflow

For "make a launch video" or "turn this into a video": inspect, plan, build, deliver. Full guidance is in [references/launch.md](references/launch.md), tones in [references/tones.md](references/tones.md).

1. **Inspect.** For a project, read the code: main page, styles (exact colours and fonts), README, routes, key components. For a URL, load the rendered site (use a headless browser if a plain fetch comes back as an empty JavaScript shell). Find the product in use: entry, key action, result. Answer the nine planning questions in `launch.md`.
2. **Plan.** Write `plan.md`: angle, hook, 2 or 3 highlights, punchline, tone, format, visual identity, a storyboard with durations that sum to the target, the narration script (if any), and audio cues.
3. **Build.** Reuse the real thing: its components, CSS, fonts, screenshots and copy. Write plates, add the voiceover and music, then check stills from every plate *and* from mid-transition before the full render.
4. **Deliver.** Use the poster frame, bake it in as frame 0, and write share copy (see below).

**Creative laws:**
- **Short:** 15 to 25 s.
- **The hook is everything:** plan the first 2 s first.
- **Clear to a stranger:** after one viewing, they know what it is, who it's for and how to get it.
- **Show the thing:** real UI, not abstract filler.
- **Specific:** the project's own copy. No "streamline your workflow".
- **Readable:** hold any line meant to be read for about 0.3 s per word once it is fully on screen.
- **Alive:** typing, clicks and things arriving one by one.
- **Earned humour:** it comes from the project itself.
- **Every frame postable.**

Shape: hook (2 to 3 s), reveal (2 to 4 s), 2 or 3 highlights, punchline/outro (2 to 4 s).

**Tones** (presets, refined by any freeform direction):

| Tone | Feel |
| --- | --- |
| `default` | Playful, clean |
| `polished` | Serious, restrained |
| `yc-parody` | Deadpan startup launch |
| `chaotic` | Fast and loud |
| `deadpan` | Dry and calm |
| `cinematic` | Trailer-scale |
| `app-store` | Smooth feature cards |

## Sound

Music, effects and voice are written as one piece. Details are in [references/sound.md](references/sound.md).

- **Music bed**: `bed.py` makes an original, royalty-free track in a key and tempo, and writes a beat grid (`music.beats.json`) so cuts can land on bars.
  ```sh
  uv run <skill-dir>/scripts/bed.py -o reel/audio/music.wav --duration 20 --bpm 100 --key A --mode minor --style pulse
  ```
  Styles are `pad`, `pulse` and `beat`. For a track the user supplies, `uv run <skill-dir>/scripts/beats.py track.mp3` writes the same kind of beat grid. Never use a track whose licence is unclear.
- **Effects**: `<skill-dir>/assets/sfx/` holds a curated CC0 library (impacts, interface, UI, casino, 32 keypresses). Read `assets/sfx/sfx-analysis.md` first: prefer low-risk warm sounds, and keep bright clicks for tiny accents.
- **Mix**: list every cue in `reel/cues.json` (times can be anchors such as `"word:Kanban"`), then:
  ```sh
  uv run <skill-dir>/scripts/mix.py reel/cues.json -o out/mix.wav
  ```
  Music and effects duck under the voice, and the mix is normalised to -14 LUFS with a -1 dBTP ceiling. Pass the mix to the render with `--audio`.

Timing rules:
- Effects land 0 to 0.1 s *before* the motion they belong to.
- Accent the first, last or strongest item of a stagger, not every item.
- The voice always wins.

## Deliver

```sh
ffmpeg -ss 7.6 -i out/reel.mp4 -frames:v 1 -q:v 2 out/poster.jpg   # strongest settled frame, not mid-transition
ffmpeg -y -i out/reel.mp4 -i out/poster.jpg -filter_complex "[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]" -map "[v]" -map 0:a? -c:v libx264 -crf 17 -preset slow -pix_fmt yuv420p -c:a copy -movflags +faststart out/reel.poster.mp4
```

Then replace `reel.mp4` with `reel.poster.mp4`. Frame 0 is now the poster, so every platform's idle thumbnail shows it, and duration and sync are unchanged.

Write `share-copy.txt`: 1 to 3 postable sentences, specific and in the video's tone. Never "excited to share".

Tell the user where the video, poster and copy are, give one sentence on the creative angle, and offer to re-roll a plate, change the voice, or try another tone.
