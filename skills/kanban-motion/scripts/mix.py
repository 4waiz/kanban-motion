#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy"]
# ///
"""Mix voiceover, music and sound effects from a cue sheet, then master to -14 LUFS.

    uv run mix.py cues.json -o out/mix.wav

cues.json (paths are relative to the cue sheet; "sfx:" means the bundled CC0 library):
{
  "duration": 9.9,
  "voice": {"file": "audio/voiceover.wav", "db": 0, "at": 0},
  "music": {"file": "audio/music.mp3", "db": -9, "at": 0, "offset": 12.0,
            "fade_in": 0.4, "fade_out": 1.8},
  "sfx": [
    {"file": "sfx:impact/impactSoft_medium_001.ogg", "t": 0.18, "db": -10},
    {"file": "sfx:interface/click_003.ogg", "t": "word:frame", "db": -14, "lp": 7000}
  ],
  "duck": {"music": 8, "sfx": 6, "attack": 0.04, "release": 0.4},
  "lufs": -14
}

SFX times may be numbers or anchors resolved from data/words.json:
  "word:frame"        start of the first spoken "frame"
  "word:frame+0.05"   offsets are allowed
  "line:every word"   start of that phrase
Per-cue options: "db", "lp" (low-pass Hz, tames bright clicks), "hp", "rate" (pitch/speed), "pan" (-1..1).
Music and effects duck under the voice; the result is normalised to the target loudness with a
-1 dBTP ceiling (two-pass ffmpeg loudnorm).
"""

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

SR = 48000
SKILL = Path(__file__).resolve().parent.parent


def decode(path: Path, filters=None) -> np.ndarray:
    cmd = ["ffmpeg", "-v", "error", "-i", str(path)]
    if filters:
        cmd += ["-af", ",".join(filters)]
    cmd += ["-f", "f32le", "-ac", "2", "-ar", str(SR), "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def db(x):
    return 10 ** (x / 20)


def resolve(base: Path, f: str) -> Path:
    if f.startswith("sfx:"):
        return SKILL / "assets" / "sfx" / f[4:]
    p = Path(f)
    return p if p.is_absolute() else base / p


def phrase_time(words, phrase):
    norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower())
    q = [norm(x) for x in phrase.split() if norm(x)]
    toks = [norm(w["w"]) for w in words]
    for i in range(len(toks) - len(q) + 1):
        if toks[i:i + len(q)] == q:
            return words[i]["s"]
    raise SystemExit(f"anchor not found in words.json: {phrase!r}")


def cue_time(t, words):
    if isinstance(t, (int, float)):
        return float(t)
    m = re.fullmatch(r"(word|line):(.+?)([+-][\d.]+)?", t.strip())
    if not m:
        raise SystemExit(f"bad cue time {t!r}")
    if words is None:
        raise SystemExit("word:/line: anchors need data/words.json (pass --words)")
    return phrase_time(words, m.group(2)) + float(m.group(3) or 0)


def place(bus, x, at):
    i = int(round(at * SR))
    if i < 0:
        x, i = x[-i:], 0
    n = min(len(x), len(bus) - i)
    if n > 0:
        bus[i:i + n] += x[:n]


def envelope(x, attack, release, ctrl=1000):
    """Voice activity 0..1 at control rate, smoothed, then upsampled to audio rate."""
    mono = np.abs(x).mean(axis=1)
    hop = SR // ctrl
    n = len(mono) // hop
    rms = np.sqrt(np.mean(mono[: n * hop].reshape(n, hop) ** 2, axis=1)) if n else np.zeros(1)
    ref = np.percentile(rms[rms > 1e-5], 90) if np.any(rms > 1e-5) else 1.0
    act = np.clip(rms / (ref * 0.5), 0, 1)
    a, r = np.exp(-1 / (attack * ctrl)), np.exp(-1 / (release * ctrl))
    out, v = np.zeros_like(act), 0.0
    for i, s in enumerate(act):
        v = a * v + (1 - a) * s if s > v else r * v + (1 - r) * s
        out[i] = v
    return np.interp(np.arange(len(x)) / hop, np.arange(len(out)), out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cues")
    ap.add_argument("-o", "--out", default="out/mix.wav")
    ap.add_argument("--words", help="words.json for word:/line: anchors (default: data/ or reel/data/ next to the cues)")
    a = ap.parse_args()

    cue_path = Path(a.cues).resolve()
    base = cue_path.parent
    c = json.loads(cue_path.read_text())
    guesses = [Path(a.words)] if a.words else [base / "data" / "words.json", base / "reel" / "data" / "words.json"]
    wpath = next((p for p in guesses if p.exists()), None)
    words = json.loads(wpath.read_text()) if wpath else None

    dur = float(c["duration"])
    n = int(round(dur * SR))
    voice, music, sfx = (np.zeros((n, 2), np.float32) for _ in range(3))

    if v := c.get("voice"):
        place(voice, decode(resolve(base, v["file"])) * db(v.get("db", 0)), v.get("at", 0))

    if m := c.get("music"):
        x = decode(resolve(base, m["file"]), [f"atrim=start={m.get('offset', 0)}", "asetpts=PTS-STARTPTS"])
        x = x[: max(0, n - int(m.get("at", 0) * SR))] * db(m.get("db", -9))
        g = np.ones(len(x))
        fi, fo = int(m.get("fade_in", 0.3) * SR), int(m.get("fade_out", 1.5) * SR)
        if fi:
            g[:fi] *= np.linspace(0, 1, min(fi, len(g)))
        if fo:
            end = min(len(x), n - int(m.get("at", 0) * SR))
            g[max(0, end - fo):end] *= np.linspace(1, 0, end - max(0, end - fo)) ** 2
        place(music, x * g[:, None], m.get("at", 0))

    for s in c.get("sfx", []):
        f = []
        if s.get("rate"):
            f += [f"asetrate={int(SR * s['rate'])}", f"aresample={SR}"]
        if s.get("hp"):
            f.append(f"highpass=f={s['hp']}")
        if s.get("lp"):
            f.append(f"lowpass=f={s['lp']}")
        x = decode(resolve(base, s["file"]), f) * db(s.get("db", -10))
        pan = float(s.get("pan", 0))
        x *= np.array([min(1, 1 - pan), min(1, 1 + pan)], np.float32)
        place(sfx, x, cue_time(s["t"], words))

    d = c.get("duck", {})
    env = envelope(voice, d.get("attack", 0.04), d.get("release", 0.4))[:, None]
    mix = voice + music * db(-d.get("music", 8) * env) + sfx * db(-d.get("sfx", 6) * env)

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    lufs = c.get("lufs", -14)
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "raw.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
                        "-c:a", "pcm_f32le", str(raw)], input=mix.astype(np.float32).tobytes(), check=True)
        ln = f"loudnorm=I={lufs}:TP=-1:LRA=11"
        meas = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(raw), "-af", ln + ":print_format=json", "-f", "null", "-"],
                              capture_output=True, text=True).stderr
        j = json.loads(meas[meas.rindex("{"): meas.rindex("}") + 1])
        apply = (f"{ln}:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
                 f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", apply, "-ar", str(SR),
                        "-c:a", "pcm_s24le", str(out)], check=True)
    print(f"wrote {out} ({dur:.2f}s, input {j['input_i']} LUFS -> {lufs} LUFS)", file=sys.stderr)


if __name__ == "__main__":
    main()
