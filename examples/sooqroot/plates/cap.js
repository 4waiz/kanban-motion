// cap: captions for muted viewers. Shows the line being spoken at the top of the safe zone,
// word by word as it is said, with the word being spoken in the accent colour.
import { ease, range, wordsIn } from '../motion.js';

export default function cap({ from, to, size = 88, top = 300, name = 'cap' } = {}) {
  let lines = [], win;
  return {
    name,
    setup(root) {
      win = [from ?? this.start, to ?? this.end];
      const groups = new Map();
      for (const w of wordsIn(win[0], win[1])) {
        if (!groups.has(w.line)) groups.set(w.line, []);
        groups.get(w.line).push(w);
      }
      lines = [...groups.values()].map((words) => {
        const el = document.createElement('p');
        el.className = 'cap';
        Object.assign(el.style, { top: top + 'px', fontSize: size + 'px' });
        const spans = words.map((w) => {
          const s = document.createElement('span');
          s.textContent = w.w;
          el.append(s, ' ');
          return s;
        });
        root.appendChild(el);
        return { el, words, spans, s: words[0].s };
      });
    },
    draw(f) {
      const out = range(f.t, win[1] - 0.2, win[1], ease.inQuad);
      lines.forEach((L, i) => {
        const next = lines[i + 1];
        const leave = Math.max(out, next ? range(f.t, next.s - 0.16, next.s - 0.04, ease.inQuad) : 0);
        const vis = f.t >= L.s - 0.1 && f.t < win[1] && (!next || f.t < next.s - 0.04);
        L.el.style.visibility = vis ? 'visible' : 'hidden';
        L.el.style.opacity = 1 - leave;
        L.el.style.transform = `translateY(${-leave * 30}px)`;
        L.spans.forEach((sp, j) => {
          const w = L.words[j];
          const k = range(f.t, w.s - 0.07, w.s + 0.2, ease.outExpo);
          sp.style.opacity = k;
          sp.style.transform = `translateY(${(1 - k) * 0.3}em)`;
          const nx = L.words[j + 1]?.s ?? Infinity;
          sp.style.color = f.t >= w.s - 0.07 && f.t < Math.min(w.e + 0.04, nx - 0.07) ? 'var(--signal)' : '';
        });
      });
    },
  };
}
