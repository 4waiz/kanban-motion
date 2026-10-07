# Examples

Five reels made with Kanban Motion from Kanban Studios projects. Each folder is a self-contained reel (`index.html`, `reel.js`, plates, theme, assets, audio and timings), so you can preview it, change it and render it again. The finished videos and the prompts are in the [main README](../README.md#examples).

| Example | Format | Shows |
| --- | --- | --- |
| [`blueban-813`](blueban-813) | 30 s · 16:9 · voice | Real Sentinel-2 imagery with a scan-line "turn" (`photo`), count-up stats, a pipeline lit by the voice (`steps`), and camera moves over the live dashboard with tracking callouts (`screen`) |
| [`sooqroot`](sooqroot) | 30 s · 9:16 · music only | Cuts on the bars of a 120 bpm bed, typed headlines (`typewrite`), and the real app running locally, framed for vertical |
| [`encirra`](encirra) | 30 s · 1:1 · voice | A square explainer: stats, a logo reveal, full-bleed UI with captions, and an on-screen "concept · synthetic data" tag |
| [`cack`](cack) | 15 s · 16:9 · music only | One seamless camera move through 3D (`space`): morphing wireframe solids, a glitch pass and kinetic type in 3D |
| [`roadtrace`](roadtrace) | 15 s · 16:9 · music only | A chase camera along a 3D road, objects that leave a trace and flash, a shape morph, and a crossfade into the product's own render |

From the repository root, once per machine:

```bash
npm install --prefix skills/kanban-motion/scripts
```

Preview an example in the browser:

```bash
node skills/kanban-motion/scripts/render.mjs preview --dir examples/blueban-813
```

Mix its sound:

```bash
uv run skills/kanban-motion/scripts/mix.py examples/blueban-813/cues.json -o out/blueban-813-mix.wav
```

Render it:

```bash
node skills/kanban-motion/scripts/render.mjs video --dir examples/blueban-813 --samples 6 --audio out/blueban-813-mix.wav --out out/blueban-813.mp4
```

The voiced examples keep their `script.txt` next to `reel.js`. Regenerate the voice with `voiceover.py` and `align.py` (see `skills/kanban-motion/references/voiceover.md`) and the cuts re-time themselves.

The projects' names, logos, screenshots and renders belong to their projects and are not covered by this repository's MIT license.
