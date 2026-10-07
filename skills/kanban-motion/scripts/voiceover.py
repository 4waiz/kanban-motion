#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10,<3.14"
# dependencies = ["kokoro-onnx>=0.4", "soundfile", "numpy"]
# ///
"""Generate a voiceover from a script.

Default engine is Kokoro (open-weight, runs locally, no API key):

    uv run voiceover.py script.txt -o audio/voiceover.wav

Script format: one spoken line per line. A blank line adds a longer pause,
`[pause 1.2]` on its own line adds an exact pause, and `#` starts a comment.

Writes the WAV plus a lines file (default: <out>.lines.json) holding the exact
start and end of every line. align.py uses it to keep word timings honest.

Options:
  --voice af_heart            any Kokoro voice, or a blend: "af_heart:0.7,af_bella:0.3"
  --speed 1.0                 0.5 - 2.0
  --gap 0.32                  silence between lines (s); blank line = 2x
  --engine system             no download: Windows SAPI / macOS say / espeak-ng
  --list-voices               print Kokoro voices and exit

Kokoro model files (~340 MB, once) are cached in ~/.cache/kanban-motion/kokoro
(override with KANBAN_MOTION_MODELS).
"""

import argparse
import json
import os
import platform
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

KOKORO_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
KOKORO_FILES = {"fp32": "kokoro-v1.0.onnx", "int8": "kokoro-v1.0.int8.onnx", "fp16": "kokoro-v1.0.fp16.onnx"}
VOICES_FILE = "voices-v1.0.bin"


def model_dir() -> Path:
    d = Path(os.environ.get("KANBAN_MOTION_MODELS", Path.home() / ".cache" / "kanban-motion")) / "kokoro"
    d.mkdir(parents=True, exist_ok=True)
    return d


def fetch(name: str) -> Path:
    path = model_dir() / name
    if path.exists() and path.stat().st_size > 0:
        return path
    print(f"downloading {name} -> {path}", file=sys.stderr)
    tmp = path.with_suffix(path.suffix + ".part")

    def hook(blocks, bs, total):
        if total > 0:
            print(f"\r  {min(100, blocks * bs * 100 // total):3d}%", end="", file=sys.stderr)

    urllib.request.urlretrieve(KOKORO_URL + name, tmp, hook)
    print(file=sys.stderr)
    tmp.replace(path)
    return path


def parse_script(text: str):
    """-> list of ('line', text) | ('pause', seconds)."""
    items = []
    for raw in text.splitlines():
        line = raw.strip()
        if line.startswith("#"):
            continue
        m = re.fullmatch(r"\[pause\s+([\d.]+)\s*s?\]", line, re.I)
        if m:
            items.append(("pause", float(m.group(1))))
        elif not line:
            if items and items[-1][0] == "line":
                items.append(("blank", None))
        else:
            items.append(("line", line))
    return items


def trim(x: np.ndarray, sr: int, thresh=0.01, pad=0.03) -> np.ndarray:
    if not len(x):
        return x
    peak = np.max(np.abs(x)) or 1.0
    idx = np.where(np.abs(x) > thresh * peak)[0]
    if not len(idx):
        return x[:0]
    p = int(pad * sr)
    return x[max(0, idx[0] - p): idx[-1] + p]


class KokoroEngine:
    def __init__(self, voice: str, speed: float, lang: str, quality: str):
        from kokoro_onnx import Kokoro

        self.k = Kokoro(str(fetch(KOKORO_FILES[quality])), str(fetch(VOICES_FILE)))
        self.voice = self._voice(voice)
        self.speed, self.lang = speed, lang

    def _voice(self, spec: str):
        if "," not in spec and ":" not in spec:
            return spec
        style = None
        for part in spec.split(","):
            name, _, w = part.partition(":")
            v = self.k.get_voice_style(name.strip()) * float(w or 1)
            style = v if style is None else style + v
        return style

    def say(self, text: str):
        samples, sr = self.k.create(text, voice=self.voice, speed=self.speed, lang=self.lang)
        return np.asarray(samples, dtype=np.float32), sr


class SystemEngine:
    """Built-in OS voice. Lower quality, zero downloads."""

    def __init__(self, voice: str | None, speed: float):
        self.voice, self.speed = voice, speed
        self.os = platform.system()

    def say(self, text: str):
        with tempfile.TemporaryDirectory() as d:
            txt, wav = Path(d) / "t.txt", Path(d) / "t.wav"
            txt.write_text(text, encoding="utf-8")
            if self.os == "Windows":
                rate = int(round((self.speed - 1) * 10))
                sel = f"$s.SelectVoice('{self.voice}');" if self.voice else ""
                ps = (
                    "Add-Type -AssemblyName System.Speech;"
                    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;"
                    f"{sel}$s.Rate = {max(-10, min(10, rate))};"
                    f"$s.SetOutputToWaveFile('{wav}');"
                    f"$s.Speak([IO.File]::ReadAllText('{txt}'));$s.Dispose()"
                )
                subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True)
            elif self.os == "Darwin":
                cmd = ["say", "-o", str(wav), "--file-format=WAVE", "--data-format=LEI16@24000",
                       "-r", str(int(180 * self.speed)), "-f", str(txt)]
                if self.voice:
                    cmd[1:1] = ["-v", self.voice]
                subprocess.run(cmd, check=True)
            else:
                cmd = ["espeak-ng", "-w", str(wav), "-s", str(int(165 * self.speed)), "-f", str(txt)]
                if self.voice:
                    cmd[1:1] = ["-v", self.voice]
                subprocess.run(cmd, check=True)
            x, sr = sf.read(wav, dtype="float32", always_2d=True)
            return x.mean(axis=1), sr


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("script", nargs="?", help="script .txt (or - for stdin)")
    ap.add_argument("-o", "--out", default="audio/voiceover.wav")
    ap.add_argument("--lines", help="lines json path (default <out>.lines.json)")
    ap.add_argument("--engine", choices=["kokoro", "system"], default="kokoro")
    ap.add_argument("--voice", default=None, help="default af_heart (kokoro) / OS default (system)")
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--lang", default="en-us")
    ap.add_argument("--quality", choices=list(KOKORO_FILES), default="fp32")
    ap.add_argument("--gap", type=float, default=0.32)
    ap.add_argument("--lead", type=float, default=0.25, help="silence before the first line")
    ap.add_argument("--tail", type=float, default=0.6, help="silence after the last line")
    ap.add_argument("--list-voices", action="store_true")
    a = ap.parse_args()

    if a.list_voices:
        from kokoro_onnx import Kokoro

        k = Kokoro(str(fetch(KOKORO_FILES[a.quality])), str(fetch(VOICES_FILE)))
        print("\n".join(sorted(k.get_voices())))
        return

    if not a.script:
        ap.error("script is required")
    text = sys.stdin.read() if a.script == "-" else Path(a.script).read_text(encoding="utf-8")
    items = parse_script(text)
    if not any(k == "line" for k, _ in items):
        sys.exit("script has no spoken lines")

    eng = (KokoroEngine(a.voice or "af_heart", a.speed, a.lang, a.quality)
           if a.engine == "kokoro" else SystemEngine(a.voice, a.speed))

    sr, chunks, lines, n = None, [], [], 0  # n = samples written after the lead-in
    pending_pause = 0.0
    for kind, val in items:
        if kind == "pause":
            pending_pause += val
            continue
        if kind == "blank":
            pending_pause += a.gap
            continue
        audio, rate = eng.say(val)
        sr = sr or rate
        if rate != sr:
            sys.exit(f"sample rate changed mid-script ({rate} vs {sr})")
        audio = trim(audio, sr)
        if lines:
            pending_pause += a.gap
        if pending_pause:
            silence = np.zeros(int(round(pending_pause * sr)), np.float32)
            chunks.append(silence)
            n += len(silence)
        pending_pause = 0.0
        s = a.lead + n / sr
        lines.append({"i": len(lines), "text": val, "s": round(s, 3), "e": round(s + len(audio) / sr, 3)})
        chunks.append(audio)
        n += len(audio)
        print(f"  {lines[-1]['s']:6.2f}-{lines[-1]['e']:6.2f}  {val}", file=sys.stderr)

    lead = np.zeros(int(round(a.lead * sr)), np.float32)
    tail = np.zeros(int(round((a.tail + pending_pause) * sr)), np.float32)
    out = np.concatenate([lead, *chunks, tail])
    peak = np.max(np.abs(out)) or 1.0
    out = out / peak * 0.89  # about -1 dBFS; final loudness is set in mix.py

    out_path = Path(a.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(out_path, out, sr, subtype="PCM_16")
    lines_path = Path(a.lines) if a.lines else out_path.with_suffix(".lines.json")
    lines_path.parent.mkdir(parents=True, exist_ok=True)
    lines_path.write_text(json.dumps({"duration": round(len(out) / sr, 3), "lines": lines}, indent=1))
    print(f"wrote {out_path} ({len(out) / sr:.2f}s) and {lines_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
