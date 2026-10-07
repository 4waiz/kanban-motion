#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10,<3.14"
# dependencies = ["librosa>=0.10", "numpy"]
# ///
"""Beat grid for any music track, in the same shape bed.py writes.

    uv run beats.py track.mp3 -o track.beats.json [--offset 12.0] [--duration 20]

Output: {"bpm", "beat", "beats": [...], "bars": [...], "strong": [...]} in seconds, relative
to --offset (the point in the track where the video's music starts). Bars assume 4/4 and
start on the beat with the most low-end energy among the first four. "strong" lists the
biggest onsets: good places for a hard cut or an impact.
"""

import argparse
import json
from pathlib import Path

import librosa
import numpy as np


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("track")
    ap.add_argument("-o", "--out")
    ap.add_argument("--offset", type=float, default=0.0)
    ap.add_argument("--duration", type=float, default=None)
    ap.add_argument("--strong", type=int, default=12, help="how many strong onsets to keep")
    a = ap.parse_args()

    y, sr = librosa.load(a.track, sr=22050, mono=True, offset=a.offset, duration=a.duration)
    onset = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, frames = librosa.beat.beat_track(onset_envelope=onset, sr=sr, units="frames")
    bpm = float(np.atleast_1d(tempo)[0])
    beats = librosa.frames_to_time(frames, sr=sr)

    # downbeat guess: of the first four beats, the one whose bar positions carry the most bass
    S = np.abs(librosa.stft(y))
    low = S[: int(S.shape[0] * 150 / (sr / 2))].sum(axis=0)
    def bass_at(t):
        return low[min(len(low) - 1, librosa.time_to_frames(t, sr=sr))]
    phase = max(range(min(4, len(beats))), key=lambda p: sum(bass_at(t) for t in beats[p::4])) if len(beats) else 0
    bars = beats[phase::4]

    peaks = librosa.util.peak_pick(onset, pre_max=8, post_max=8, pre_avg=16, post_avg=16, delta=0.2, wait=10)
    top = sorted(peaks, key=lambda i: onset[i], reverse=True)[: a.strong]
    strong = sorted(librosa.frames_to_time(np.array(top, dtype=int), sr=sr).tolist())

    grid = {
        "bpm": round(bpm, 2), "beat": round(60 / bpm, 4) if bpm else None, "offset": a.offset,
        "beats": [round(float(t), 4) for t in beats],
        "bars": [round(float(t), 4) for t in bars],
        "strong": [round(t, 4) for t in strong],
    }
    out = Path(a.out) if a.out else Path(a.track).with_suffix(".beats.json")
    out.write_text(json.dumps(grid, indent=1))
    print(f"wrote {out}: {bpm:.1f} bpm, {len(beats)} beats, {len(bars)} bars, {len(strong)} strong onsets")


if __name__ == "__main__":
    main()
