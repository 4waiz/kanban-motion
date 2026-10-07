#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10,<3.14"
# dependencies = ["faster-whisper>=1.0", "numpy"]
# ///
"""Word-level timings for a voiceover: Kokoro, the OS voice, or a human recording.

    uv run align.py audio/voiceover.wav --script script.txt

Transcribes with faster-whisper word timestamps, then snaps the result onto the
script's own words, so `lineOf('an exact script phrase')` always matches even
when the recogniser misspells a name. With the lines file from voiceover.py,
every line's first and last word are pinned to its exact start and end.

Writes:
  data/words.json  [{"w": "Every", "s": 1.92, "e": 2.17, "line": 1}, ...]
  data/audio.json  {"fps": 60, "duration": 9.4, "rms": [0..1 per frame], "onsets": [...]}

Options:
  --lines data/lines.json   exact line bounds from voiceover.py (auto-detected next to the audio)
  --model base.en           tiny.en | base.en | small.en | medium.en | large-v3 (non-English: drop .en)
  --lang en                 language code, or "auto"
  --fps 60                  envelope rate
"""

import argparse
import difflib
import json
import re
import sys
from pathlib import Path

import numpy as np


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9']", "", s.lower())


def script_tokens(text: str):
    """Script -> [(token, line_index)]. Same line rules as voiceover.py."""
    out, li = [], 0
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or re.fullmatch(r"\[pause\s+[\d.]+\s*s?\]", line, re.I):
            continue
        for tok in line.split():
            if norm(tok):
                out.append((tok, li))
        li += 1
    return out


def spread(n_weights, s, e):
    """Split [s, e] into consecutive spans proportional to weights."""
    w = np.maximum(np.asarray(n_weights, float), 1)
    edges = s + (e - s) * np.concatenate([[0], np.cumsum(w) / w.sum()])
    return list(zip(edges[:-1], edges[1:]))


def snap(script, rec):
    """Map recognised (word, s, e) onto script tokens. Returns [[s, e] | None]."""
    a = [norm(t) for t, _ in script]
    b = [norm(w) for w, _, _ in rec]
    times = [None] * len(a)
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal" or (op == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                times[i1 + k] = [rec[j1 + k][1], rec[j1 + k][2]]
        elif op == "replace":
            spans = spread([len(x) for x in a[i1:i2]], rec[j1][1], rec[j2 - 1][2])
            for k, (s, e) in enumerate(spans):
                times[i1 + k] = [s, e]
    return times


def fill(script, times, duration):
    """Interpolate words the recogniser missed, weighting by word length."""
    n, i = len(times), 0
    while i < n:
        if times[i] is not None:
            i += 1
            continue
        j = i
        while j < n and times[j] is None:
            j += 1
        s = times[i - 1][1] if i > 0 else 0.0
        e = times[j][0] if j < n else duration
        for k, span in enumerate(spread([len(script[x][0]) for x in range(i, j)], s, max(e, s + 0.05 * (j - i)))):
            times[i + k] = list(span)
        i = j
    return times


def pin_lines(script, times, lines):
    """Keep each line's words inside its exact [s, e] from voiceover.py."""
    by_line = {}
    for idx, (_, li) in enumerate(script):
        by_line.setdefault(li, []).append(idx)
    for li, idxs in by_line.items():
        if li >= len(lines):
            continue
        ls, le = lines[li]["s"], lines[li]["e"]
        inside = [times[k] for k in idxs if ls - 0.25 <= times[k][0] <= le + 0.25]
        if len(inside) < max(1, len(idxs) // 2):  # recogniser lost this line: spread evenly
            for k, span in zip(idxs, spread([len(script[x][0]) for x in idxs], ls, le)):
                times[k] = list(span)
            continue
        for k in idxs:
            times[k] = [min(max(times[k][0], ls), le), min(max(times[k][1], ls), le)]
        times[idxs[0]][0] = ls
        times[idxs[-1]][1] = le
    return times


def monotonic(times):
    prev = 0.0
    for t in times:
        t[0] = max(t[0], prev)
        t[1] = max(t[1], t[0] + 0.02)
        prev = t[0]
    return times


def envelope(audio, sr, fps):
    hop = sr / fps
    n = int(len(audio) / hop) + 1
    rms = np.zeros(n)
    win = int(hop * 2)
    for i in range(n):
        c = int(i * hop)
        seg = audio[max(0, c - win // 2): c + win // 2]
        rms[i] = np.sqrt(np.mean(seg ** 2)) if len(seg) else 0
    # fast attack, slower release, normalised to the loud end of the voice
    out, v = np.zeros(n), 0.0
    for i, x in enumerate(rms):
        v = x if x > v else v * 0.85 + x * 0.15
        out[i] = v
    ref = np.percentile(out[out > 0], 98) if np.any(out > 0) else 1
    return np.clip(out / (ref or 1), 0, 1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("audio")
    ap.add_argument("--script", help="script .txt (recommended)")
    ap.add_argument("--lines", help="lines json from voiceover.py")
    ap.add_argument("-o", "--out", default="data/words.json")
    ap.add_argument("--audio-json", default=None, help="default: audio.json next to --out")
    ap.add_argument("--model", default="base.en")
    ap.add_argument("--lang", default="en")
    ap.add_argument("--fps", type=int, default=60)
    a = ap.parse_args()

    from faster_whisper import WhisperModel, decode_audio

    sr = 16000
    audio = decode_audio(a.audio, sampling_rate=sr)
    duration = len(audio) / sr

    script = script_tokens(Path(a.script).read_text(encoding="utf-8")) if a.script else None
    prompt = " ".join(t for t, _ in script[-150:]) if script else None

    print(f"transcribing {a.audio} ({duration:.1f}s) with {a.model}", file=sys.stderr)
    model = WhisperModel(a.model, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(
        audio, language=None if a.lang == "auto" else a.lang, word_timestamps=True,
        beam_size=5, vad_filter=False, condition_on_previous_text=False, initial_prompt=prompt,
    )
    rec = [(w.word.strip(), w.start, w.end) for seg in segments for w in (seg.words or []) if norm(w.word)]
    if not rec and not script:
        sys.exit("no speech found")

    lines_path = Path(a.lines) if a.lines else None
    if not lines_path:
        guess = [Path(a.audio).with_suffix(".lines.json"), Path(a.out).parent / "lines.json"]
        lines_path = next((p for p in guess if p.exists()), None)
    lines = json.loads(lines_path.read_text())["lines"] if lines_path else None

    if script:
        times = fill(script, snap(script, rec) if rec else [None] * len(script), duration)
        if lines:
            times = pin_lines(script, times, lines)
        times = monotonic(times)
        words = [{"w": t, "s": round(s, 3), "e": round(e, 3), "line": li}
                 for (t, li), (s, e) in zip(script, times)]
        print(f"{len(rec)} recognised words snapped onto {len(script)} script words", file=sys.stderr)
    else:
        words = [{"w": w, "s": round(s, 3), "e": round(e, 3)} for w, s, e in rec]

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(words, indent=0))

    env = envelope(audio, sr, a.fps)
    aj = Path(a.audio_json) if a.audio_json else out.parent / "audio.json"
    aj.write_text(json.dumps({
        "fps": a.fps, "duration": round(duration, 3),
        "rms": [round(float(x), 3) for x in env],
        "onsets": [w["s"] for w in words],
    }))
    print(f"wrote {out} ({len(words)} words) and {aj}", file=sys.stderr)
    for w in words:
        print(f"  {w['s']:6.2f} {w['e']:6.2f}  {w['w']}", file=sys.stderr)


if __name__ == "__main__":
    main()
