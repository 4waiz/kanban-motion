// say: kinetic type locked to the voiceover. Each word lands on the frame it is spoken,
// the word being spoken glows in the accent colour, then settles.
// Without words.json it falls back to revealing `text` evenly across the plate.
import { clamp, ease, range, wordsIn } from '../motion.js';

export default function say({ text = '', size = 120, align = 'center', name = 'say', accent = true } = {}) {
  let spans = [], timed = [];
  return {
    name,
    setup(root) {
      root.innerHTML = `<div class="say say-${align}"><p style="font-size:${size}px"></p></div>`;
      const p = root.querySelector('p');
      const spoken = wordsIn(this.start, this.end);
      const words = spoken.length ? spoken.map((w) => w.w) : text.split(/\s+/).filter(Boolean);
      timed = spoken.length ? spoken : null;
      spans = words.map((w) => {
        const s = document.createElement('span');
        s.textContent = w;
        p.append(s, ' ');
        return s;
      });
    },
    draw(f) {
      const n = spans.length;
      // Out: the last 0.35 s of the plate (plus any tail) lifts the line away.
      const out = range(f.lt, f.dur - 0.35 + (this.tail || 0), f.dur + (this.tail || 0), ease.inQuad);
      spans.forEach((el, i) => {
        const s = timed ? timed[i].s - this.start : (i / Math.max(1, n)) * f.dur * 0.6;
        const e = timed ? timed[i].e - this.start : s + 0.3;
        const k = range(f.lt, s - 0.06, s + 0.28, ease.outExpo);
        const live = accent && f.lt >= s - 0.06 && f.lt < e + 0.12;
        el.style.opacity = k * (1 - out);
        el.style.transform = `translateY(${(1 - k) * 0.35 + out * -0.2}em)`;
        el.style.color = live ? 'var(--signal)' : '';
        el.style.textShadow = live ? `0 0 ${20 + 40 * clamp(f.env)}px var(--signal-glow)` : 'none';
      });
      // Slow push-in: the camera drifts toward the line as it is spoken.
      this.root.firstChild.style.transform = `scale(${1 + 0.035 * ease.inOutQuad(clamp(f.p))})`;
    },
  };
}
