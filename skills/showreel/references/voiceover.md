# Voiceover

A voiceover is opt-in: add one when the user asks for narration or a voice, or passes `--voice`. The pipeline is: script, then voice, then word timings, then plates that find their words by content.

## Write the script

- **One line per beat.** Each line usually becomes a plate, and `cut('first words of the line')` starts that plate 0.18 s before the line.
- **Complement, don't caption.** The voice says what the picture can't, such as why it matters or what it feels like. It doesn't read the on-screen text aloud.
- **Pace.** About 2.5 words per second. A 20 s video holds about 40 to 45 spoken words, including the breaths.
- **Conversational and specific.** Use the product's real claims and words, read aloud before committing, and avoid generic launch filler.
- **Spell it as spoken.** "v2" becomes "version two", "10x" becomes "ten times", "SQL" becomes "sequel" or "S Q L". The written form can still appear on screen.
- **Pauses.** A blank line doubles the gap; `[pause 0.8]` on its own line inserts an exact pause; `# comments` are ignored.

## Generate (Kokoro, local)

```sh
uv run <skill-dir>/scripts/voiceover.py script.txt -o reel/audio/voiceover.wav --lines reel/data/lines.json
```

- **First run:** uv installs `kokoro-onnx` into a cached environment, and the model (about 340 MB) downloads to `~/.cache/showreel/kokoro`. Set `SHOWREEL_MODELS` to cache it elsewhere, or use `--quality int8` for an 88 MB model with slightly lower quality.
- **Voices** (`--list-voices` prints them all):
  - **American female:** `af_heart` (best all-rounder), `af_bella`, `af_nova`, `af_sarah`, `af_sky`
  - **American male:** `am_michael`, `am_fenrir`, `am_onyx`, `am_adam`, `am_puck`
  - **British:** `bf_emma`, `bf_isabella`, `bm_george`, `bm_daniel`, `bm_lewis`
  - **Other languages:** Spanish `ef_dora`, French `ff_siwis`, Hindi `hf_alpha`, Italian `if_sara`, Portuguese `pf_dora`, Japanese `jf_alpha`, Mandarin `zf_xiaoxiao`. Pass the matching espeak `--lang` code (`es`, `fr-fr`, `hi`, `it`, `pt-br`). Quality outside English varies, so test a line first.
- **Blends:** `--voice af_heart:0.6,af_bella:0.4`.
- **Pace:** `--speed 0.9` to `1.15`. Change the pause between lines with `--gap 0.32`, and the silence before the first line and after the last with `--lead` and `--tail`.
- **No download:** `--engine system` uses Windows SAPI, macOS `say` or `espeak-ng`. It is lower quality, so it suits drafts.

The script writes the WAV (24 kHz mono, peak about -1 dBFS) and `lines.json` holding each line's exact start and end. Listen to it, or at least check line durations against the storyboard, before building plates.

**The user's own recording:** save it as `reel/audio/voiceover.wav` (any format ffmpeg reads; convert it if needed) and keep a matching `script.txt`. There is no `lines.json`, so alignment relies on the recogniser alone, which is fine for clean speech.

## Align (word timings)

```sh
uv run <skill-dir>/scripts/align.py reel/audio/voiceover.wav --script script.txt --lines reel/data/lines.json -o reel/data/words.json
```

- faster-whisper (`--model base.en` by default; `small.en` is more accurate, and you drop `.en` for other languages) produces word timestamps. The script is passed in as a prompt to help with names.
- The recognised words are **snapped onto the script's words** with a sequence alignment, so `words.json` always spells words exactly as the script does. Words the recogniser missed are interpolated by length. With `lines.json`, each line's first and last words are pinned to the exact synthesis bounds.
- It also writes `audio.json`: a 60 fps loudness envelope (`f.env` in plates, which drives glows and breathing) and the word onsets.

## Use it in plates

```js
import { cut, lineOf, wordOf, wordsIn } from './motion.js';
cut('Every word lands')          // plate start: 0.18 s before the phrase
lineOf('lands on the voice')     // { s, e, words: [{ w, s, e, line }] }
wordOf('Showreel')               // { w, s, e } of the first match
wordsIn(plate.start, plate.end)  // everything spoken during a plate
```

Matching ignores case and punctuation. After regenerating the voice with the same script, everything re-times by itself. If the wording changed, update the `cut(...)` phrases and tell the user which ones changed.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `No such file` for a script that exists, on Windows | The path is too long (more than 260 characters). Work in a shorter folder. |
| uv picks a Python with no wheels | The scripts pin `requires-python <3.14`. Run `uv python install 3.12` if no compatible Python is installed. |
| A name is mispronounced | Respell it phonetically in the script ("Kubernetes" becomes "koo-ber-net-eez") and keep the real spelling on screen |
| A word lands late or early in plates | Use `--model small.en`; check that `lines.json` was passed; nudge with an offset in the plate |
| `anchor not found` in `mix.py` | The `word:`/`line:` text must match the script's words. Punctuation and case don't matter. |
