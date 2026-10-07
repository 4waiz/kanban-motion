# Sound

Write the music, effects and voice as one piece:
- The effects sit in the same space as the music, blended in rather than laid on top.
- The voice always wins.
- Repeated small sounds stay in the background.
- Nothing harsh or spiky.

## Music

**Generated bed (default).** `bed.py` synthesises an original track, so there are no licences to clear.

```sh
uv run <skill-dir>/scripts/bed.py -o reel/audio/music.wav --duration 20 --bpm 100 --key A --mode minor --style pulse
```

| Flag | Notes |
| --- | --- |
| `--style pad` | Warm chords only: polished, deadpan, documentary |
| `--style pulse` | Pad, sub bass, soft kick on 1 and 3, and a gentle sidechain pump. Fits most launch videos. |
| `--style beat` | Pulse plus four-on-the-floor, offbeat hats and claps on 2 and 4: chaotic, app-store |
| `--key`, `--mode` | Pick a key and keep the effects consistent with it (pitch tonal effects with `"rate"` in the cue sheet) |
| `--brightness` | Pad filter: 0.6 is dark, 1.5 is bright |
| `--seed` | A different voicing texture with the same structure |

Bar 1 is pad only, the groove enters on bar 2, and the last bar drops the drums so the outro breathes. `music.beats.json` lists `beats`, `bars` and `drops`. Put big cuts on `bars`, let the outro land on the last `drops` value, and set `--duration` to the video length.

**The user's own track.** Use it only when its licence allows it. To get a beat grid:

```sh
uv run <skill-dir>/scripts/beats.py reel/audio/track.mp3 -o reel/audio/track.beats.json
```

This writes the same JSON shape, plus `strong` (the biggest onsets). Choose the `offset` into the track where the energy suits the hook.

**Levels.** In `cues.json`, a music bed sits around `-9` to `-12` dB under a voice and `-6` to `-8` dB without one. For deadpan, go to `-16` or lower, or use silence.

## Effects library (CC0)

`<skill-dir>/assets/sfx/` holds 3.6 MB of public-domain sounds from Kenney.nl, plus a 32-key keyboard pack by unicae_games on OpenGameArt:

| Folder | What | Use for |
| --- | --- | --- |
| `impact/` | Soft, bell, punch, wood, plank and plate impacts; footsteps | Reveals, hard cuts, logo landings, comic weight |
| `interface/` | Clicks, drops, switches, glitches, errors, a bong | Taps, items landing, toggles, tech accents, comic fails |
| `ui/` | Clicks, rollovers, a large set of switches | Simulated cursor and toggle actions |
| `casino/` | Card slides, places and fans; chips; dice | Swipes, stacks, deals, things arriving in sequence |
| `keyboard/` | `keypress-001` to `keypress-032.wav` | Typing; rotate through files so repeats don't sound robotic |

`sfx-analysis.md` and `sfx-analysis.json` rate every file's brightness and high-frequency risk:
- Use **low-risk** files for polished work and anything repeated.
- Keep **high-risk** (bright, clicky) files for tiny isolated accents, or soften them with `"lp": 6000`.

Safe picks:
- **Major reveal or hard cut:** `impact/impactSoft_medium_001`, `_002` or `_004`
- **Logo payoff or success:** `impact/impactBell_heavy_000`, `_003` or `_004`, quiet (around `-18` dB)
- **Button or tap:** `interface/click_002`, `_003` or `_005`, or `ui/click2`
- **Soft item landing:** `interface/drop_001` or `drop_002`
- **Toggle:** `interface/switch_002` or `_007`
- **Chaotic accent:** `interface/glitch_002` or `interface/error_005`

## Cue sheet and mix

`reel/cues.json` (paths are relative to it; `sfx:` means the bundled library; the template ships a worked example):

```json
{
  "duration": 20.0,
  "voice": {"file": "audio/voiceover.wav", "db": 0},
  "music": {"file": "audio/music.wav", "db": -10, "fade_in": 0.3, "fade_out": 1.6},
  "sfx": [
    {"file": "sfx:impact/impactSoft_medium_001.ogg", "t": "word:Kanban-0.03", "db": -9},
    {"file": "sfx:keyboard/keypress-007.wav", "t": 4.21, "db": -26, "lp": 6500, "pan": -0.2},
    {"file": "sfx:interface/drop_002.ogg", "t": "line:every word lands", "db": -17}
  ],
  "duck": {"music": 8, "sfx": 6},
  "lufs": -14
}
```

```sh
uv run <skill-dir>/scripts/mix.py reel/cues.json -o out/mix.wav
```

- **Times** are seconds, `word:<word>[+/-offset]` or `line:<phrase>[+/-offset]`, resolved from `data/words.json` next to the cue sheet (or `--words`). When a regenerated voice shifts, the effects move with it.
- **Per-cue options:**
  - `db`
  - `lp` / `hp` (filter Hz)
  - `rate` (resample: `1.059` is up a semitone)
  - `pan` (-1 to 1)
- **Ducking:** music and effects dip under the voice by the `duck` amounts, with fast attack and smooth release.
- **Mastering:** two-pass loudness normalisation to `lufs` (default -14, the streaming norm) with a -1 dBTP ceiling.

To mix for the Motion as Code kit, use the kit's own `analysis/sfx_mix.py`. `mix.py` is for the starter kit, or for any picture you only need to lay audio under.

## Timing rules

- Effects land at the **start** of the motion, 0 to 0.1 s before the first visible frame of the element.
- On a transition, the effect lands at the transition start.
- A success sound lands when the metric or state is fully visible.
- On a stagger, accent the first, the last or the strongest item. Score every item only if that rhythm is the point.
- For typing, accent about every 4th or 5th character, rotate files, use `lp` around 6500, and keep it around -24 to -28 dB.
- Fewer, better-timed cues beat a grab bag. Silence is a valid creative choice.
