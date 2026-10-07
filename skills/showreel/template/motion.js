// showreel motion toolkit: tiny, deterministic helpers.
// Every value a plate draws must come from these + time. No Math.random, no Date.now.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const mix = lerp;

// Progress of t through [a, b], clamped to 0..1, optionally eased.
export const range = (t, a, b, ease = (k) => k) => ease(clamp((t - a) / (b - a)));

export const ease = {
  linear: (k) => k,
  inQuad: (k) => k * k,
  outQuad: (k) => 1 - (1 - k) * (1 - k),
  inOutQuad: (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  outCubic: (k) => 1 - (1 - k) ** 3,
  inOutCubic: (k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  outExpo: (k) => (k === 1 ? 1 : 1 - 2 ** (-10 * k)),
  inOutExpo: (k) =>
    k === 0 ? 0 : k === 1 ? 1 : k < 0.5 ? 2 ** (20 * k - 10) / 2 : (2 - 2 ** (-20 * k + 10)) / 2,
  outBack: (k, s = 1.70158) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2,
};

// Closed-form damped spring 0 -> 1. Pure function of elapsed time, so seeking is free.
export function spring(dt, { stiffness = 170, damping = 20, mass = 1 } = {}) {
  if (dt <= 0) return 0;
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * dt) * (Math.cos(wd * dt) + ((zeta * w0) / wd) * Math.sin(wd * dt));
  }
  return 1 - Math.exp(-w0 * dt) * (1 + w0 * dt);
}

// Seeded PRNG (mulberry32). Same seed -> same sequence on every frame and every render.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Stateless hash noise: noise(i) is always the same number for the same i.
export const hash = (i, seed = 0) => rng((i * 2654435761) ^ seed)();

// Reveal text one character at a time: typed('Hello', t, start, cps).
export const typed = (text, t, start, cps = 24) =>
  text.slice(0, Math.max(0, Math.floor((t - start) * cps)));

// ---- Voiceover sync -------------------------------------------------------
// words.json: [{ "w": "This", "s": 0.21, "e": 0.40 }, ...] (from scripts/align.py)
let WORDS = [];
export const setWords = (w) => (WORDS = w || []);
export const words = () => WORDS;

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim();

// Find a spoken phrase at or after `after` seconds -> {s, e, words} or null.
// Matching ignores case and punctuation, so plates find their words by content and
// re-time themselves when the voiceover is regenerated or re-recorded.
export function lineOf(phrase, after = 0) {
  const q = norm(phrase).split(' ').filter(Boolean);
  const toks = WORDS.flatMap((w, i) => norm(w.w).split(' ').filter(Boolean).map((tok) => ({ tok, i })));
  for (let k = 0; k + q.length <= toks.length; k++) {
    if (WORDS[toks[k].i].s < after) continue;
    if (q.every((tok, j) => toks[k + j].tok === tok)) {
      const ws = WORDS.slice(toks[k].i, toks[k + q.length - 1].i + 1);
      return { s: ws[0].s, e: ws[ws.length - 1].e, words: ws };
    }
  }
  return null;
}

// First single word matching `text` -> {w, s, e} or null.
export const wordOf = (text, after = 0) => lineOf(text, after)?.words[0] ?? null;

// Words spoken inside [a, b) seconds.
export const wordsIn = (a, b) => WORDS.filter((w) => w.s >= a - 0.01 && w.s < b);

// Cut time for a plate: just before the line starts, inside the breath.
export const cut = (phrase, lead = 0.18, fallback = 0) => {
  const l = lineOf(phrase);
  return l ? Math.max(0, l.s - lead) : fallback;
};
