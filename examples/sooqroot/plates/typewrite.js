// typewrite: headline lines typed letter by letter with a blinking caret.
// Lines keep their final width from the first frame (a hidden ghost copy), so centred text never shifts.
// times: optional absolute start time per line (e.g. from the voice); otherwise lines type back to back.
import { ease, range } from '../motion.js';

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export default function typewrite({
  lines = [], eyebrow = '', at = 0.15, cps = 24, gap = 0.2, size = 120, align = 'left',
  accent = [], times = null, top = null, name = 'type',
} = {}) {
  let rows = [], caret, eb, starts = [];
  return {
    name,
    setup(root) {
      root.innerHTML = `
        <div class="tw tw-${align}" style="${top !== null ? `top:${top}px;translate:0 0;` : ''}">
          ${eyebrow ? `<div class="tw-eyebrow">${esc(eyebrow)}</div>` : ''}
          <div class="tw-lines" style="font-size:${size}px"></div>
        </div>`;
      eb = root.querySelector('.tw-eyebrow');
      const box = root.querySelector('.tw-lines');
      let t = at;
      rows = lines.map((txt, i) => {
        const d = document.createElement('div');
        d.className = 'tw-line' + (accent.includes(i) ? ' tw-accent' : '');
        d.innerHTML = `<span class="tw-ghost">${esc(txt)}</span><span class="tw-typed"></span>`;
        box.appendChild(d);
        starts.push(times ? times[i] - this.start : t);
        t += txt.length / cps + gap;
        return d.lastChild;
      });
      // lines never overlap, even when word timings are bunched up: each waits for the one before
      for (let i = 1; i < starts.length; i++) starts[i] = Math.max(starts[i], starts[i - 1] + lines[i - 1].length / cps + 0.05);
      caret = document.createElement('i');
      caret.className = 'tw-caret';
    },
    draw(f) {
      const out = range(f.lt, f.dur - 0.3, f.dur, ease.inQuad);
      if (eb) eb.style.opacity = range(f.lt, 0, 0.35, ease.outQuad) * (1 - out);
      let host = null, typing = false;
      rows.forEach((el, i) => {
        const n = Math.max(0, Math.min(lines[i].length, Math.floor((f.lt - starts[i]) * cps)));
        el.textContent = lines[i].slice(0, n);
        if (f.lt >= starts[i]) { host = el; typing = n < lines[i].length; }
        el.parentNode.style.opacity = 1 - out;
      });
      if (host) host.appendChild(caret);
      caret.style.opacity = host && (typing || Math.floor(f.lt * 2.4) % 2 === 0) ? 1 - out : 0;
    },
  };
}
