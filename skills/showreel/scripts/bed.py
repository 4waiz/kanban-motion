#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy"]
# ///
"""Generate an original, royalty-free music bed with a beat grid. No samples, no licences.

    uv run bed.py -o audio/music.wav --duration 20 --bpm 100 --key A --mode minor --style pulse

Styles
  pad    warm chords only (deadpan, polished, documentary)
  pulse  pad + sub bass + soft kick on 1 and 3, gentle sidechain pump (default, most launch videos)
  beat   pulse + kick on every beat, offbeat hats, claps on 2 and 4 (chaotic, app-store, yc-parody)

Arrangement: bar 1 is pad only, the groove enters on bar 2, the last bar drops the drums so the
outro can breathe. Also writes <out>.beats.json:
  {"bpm": 100, "beat": 0.6, "beats": [...], "bars": [...], "drops": [...], "key": "A minor"}
so cuts can land on bars and effects can be tuned to the key (mix.py "rate").
"""

import argparse
import json
import wave
from pathlib import Path

import numpy as np

SR = 48000
NOTES = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
         "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
# chord roots (semitones from the key) and whether each chord is minor
PROGRESSIONS = {
    "minor": [(0, True), (8, False), (3, False), (10, False)],   # i - VI - III - VII
    "major": [(0, False), (7, False), (9, True), (5, False)],    # I - V - vi - IV
}


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def lowpass(x, cutoff, slope=2.0):
    """Zero-phase FFT low-pass with a gentle roll-off. x: (n,) or (n, ch)."""
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    g = 1 / (1 + (f / cutoff) ** (2 * slope))
    return np.fft.irfft(X * (g[:, None] if x.ndim == 2 else g), n=x.shape[0], axis=0)


def highpass(x, cutoff, slope=2.0):
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    g = 1 - 1 / (1 + (f / cutoff) ** (2 * slope))
    return np.fft.irfft(X * (g[:, None] if x.ndim == 2 else g), n=x.shape[0], axis=0)


def env(n, attack, release, total=None):
    """Raised-cosine attack, sustain, raised-cosine release over n samples."""
    e = np.ones(n)
    a, r = min(n, int(attack * SR)), min(n, int(release * SR))
    if a:
        e[:a] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, a))
    if r:
        e[n - r:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, r))
    return e


def add(buf, x, at):
    i = int(round(at * SR))
    n = min(len(x), len(buf) - i)
    if i < len(buf) and n > 0:
        buf[i:i + n] += x[:n]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-o", "--out", default="audio/music.wav")
    ap.add_argument("--duration", type=float, default=20)
    ap.add_argument("--bpm", type=float, default=100)
    ap.add_argument("--key", default="A")
    ap.add_argument("--mode", choices=["minor", "major"], default="minor")
    ap.add_argument("--style", choices=["pad", "pulse", "beat"], default="pulse")
    ap.add_argument("--brightness", type=float, default=1.0, help="pad filter, 0.5 dark - 2 bright")
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()

    rng = np.random.default_rng(a.seed)
    beat = 60 / a.bpm
    bar = 4 * beat
    nbars = int(np.ceil(a.duration / bar))
    total = nbars * bar + 2.5
    n = int(total * SR)
    key = NOTES[a.key.capitalize() if len(a.key) == 1 else a.key[0].upper() + a.key[1:]]
    prog = PROGRESSIONS[a.mode]

    pad = np.zeros((n, 2))
    sub = np.zeros(n)
    kick = np.zeros(n)
    perc = np.zeros((n, 2))

    # ---- pad: open voicing (root, fifth, tenth, ninth), two detuned saws per note
    for b in range(nbars):
        root, minor = prog[b % len(prog)]
        base = 57 + ((key + root) % 12)                       # around A3
        if base > 62:
            base -= 12
        voicing = [base - 12, base, base + 7, base + 12 + (3 if minor else 4), base + 14]
        length = bar + 0.9
        m = int(length * SR)
        t = np.arange(m) / SR
        chord = np.zeros((m, 2))
        for k, note in enumerate(voicing):
            for side, cents in ((0, -7), (1, 7)):
                f = hz(note) * 2 ** (cents / 1200)
                ph = rng.random()
                saw = 2 * ((f * t + ph) % 1) - 1
                sine = np.sin(2 * np.pi * (f * t + ph))
                amp = 0.55 if k == 0 else 0.33
                chord[:, side] += amp * (0.55 * saw + 0.45 * sine)
        chord *= env(m, 0.45, 0.9)[:, None]
        add(pad, chord, b * bar)
    pad = lowpass(pad, 1400 * a.brightness, 1.5)
    # slow swell so the bed is never static
    tt = np.arange(n) / SR
    pad *= (0.85 + 0.15 * np.sin(2 * np.pi * tt / (bar * 2) - np.pi / 2))[:, None]

    groove_from = 1 if nbars > 2 else 0
    groove_to = nbars - 1 if nbars > 2 else nbars

    if a.style in ("pulse", "beat"):
        # ---- sub bass: chord root, one short note per beat
        for b in range(groove_from, groove_to):
            root, _ = prog[b % len(prog)]
            f = hz(33 + ((key + root) % 12))
            for q in range(4):
                m = int(beat * 0.9 * SR)
                t = np.arange(m) / SR
                note = np.sin(2 * np.pi * f * t) * np.exp(-t / (beat * 0.45)) * env(m, 0.006, 0.05)
                add(sub, note, b * bar + q * beat)
        # ---- kick: pitch-swept sine
        hits = [0, 2] if a.style == "pulse" else [0, 1, 2, 3]
        m = int(0.45 * SR)
        t = np.arange(m) / SR
        freq = 46 + 80 * np.exp(-t * 32)
        k1 = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 8.5)
        k1[:96] += np.linspace(0.5, 0, 96) * rng.standard_normal(96) * 0.3
        for b in range(groove_from, groove_to):
            for q in hits:
                add(kick, k1 * (1.0 if q == 0 else 0.85), b * bar + q * beat)
        # ---- sidechain: pad and sub dip on every kick
        duck = np.ones(n)
        dm = int(beat * SR)
        shape = 1 - 0.45 * np.exp(-np.arange(dm) / (0.16 * SR))
        for b in range(groove_from, groove_to):
            for q in hits:
                i = int((b * bar + q * beat) * SR)
                j = min(n, i + dm)
                duck[i:j] = np.minimum(duck[i:j], shape[: j - i])
        pad *= duck[:, None]
        sub *= 0.6 + 0.4 * duck

    if a.style == "beat":
        # ---- hats on the offbeats, claps on 2 and 4
        for b in range(groove_from, groove_to):
            for q in range(4):
                m = int(0.07 * SR)
                t = np.arange(m) / SR
                hat = highpass(rng.standard_normal(m), 7000) * np.exp(-t * 70)
                pan = 0.35 if q % 2 else -0.35
                vel = 0.18 + 0.05 * rng.random()
                add(perc, np.stack([hat * (1 - pan), hat * (1 + pan)], 1) * vel, b * bar + (q + 0.5) * beat)
            for q in (1, 3):
                m = int(0.22 * SR)
                t = np.arange(m) / SR
                body = lowpass(highpass(rng.standard_normal(m), 900), 5000)
                burst = sum(np.exp(-np.maximum(t - d, 0) * 60) * (t >= d) for d in (0, 0.011, 0.023))
                clap = body * burst * np.exp(-t * 14) * 0.5
                add(perc, np.stack([clap, clap], 1), b * bar + q * beat)

    mix = pad * 0.55 + (sub * 0.5)[:, None] + (kick * 0.75)[:, None] + perc
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix = mix[: int((a.duration + 1.5) * SR)]
    fade = int(1.5 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    mix /= np.max(np.abs(mix)) or 1
    mix *= 0.89

    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype("<i2").tobytes())

    beats = [round(i * beat, 4) for i in range(int(a.duration / beat) + 1)]
    grid = {
        "bpm": a.bpm, "beat": round(beat, 4), "bar": round(bar, 4),
        "key": f"{a.key} {a.mode}", "style": a.style,
        "beats": beats, "bars": [round(b * bar, 4) for b in range(nbars + 1) if b * bar <= a.duration],
        "drops": [round(groove_from * bar, 4), round(groove_to * bar, 4)] if a.style != "pad" else [],
    }
    jp = out.with_suffix(".beats.json")
    jp.write_text(json.dumps(grid, indent=1))
    print(f"wrote {out} ({len(mix) / SR:.1f}s, {a.key} {a.mode}, {a.bpm} bpm, {a.style}) and {jp}")


if __name__ == "__main__":
    main()
