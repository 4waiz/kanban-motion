// stats: numbers that count up, with labels. Only use real numbers from the project.
// items: [{ value: 205, prefix: '~', suffix: '', decimals: 0, label: 'spectral bands' }]
// A string value (e.g. '400-1700 nm') pops in without counting.
import { clamp, ease, range, spring } from '../motion.js';

const fmt = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export default function stats({ items = [], title = '', at = 0.2, stagger = 0.2, count = 1.2, cols = null, times = null, top = null, name = 'stats' } = {}) {
  let cards = [], nums = [], head;
  return {
    name,
    setup(root) {
      root.innerHTML = `
        <div class="st" style="${top !== null ? `top:${top}px;translate:0 0;` : ''}">
          ${title ? `<div class="st-title">${title}</div>` : ''}
          <div class="st-grid" style="grid-template-columns:repeat(${cols || items.length}, minmax(0, 1fr))">
            ${items.map((it) => `<div class="st-card"><div class="st-num"></div><div class="st-label">${it.label || ''}</div></div>`).join('')}
          </div>
        </div>`;
      head = root.querySelector('.st-title');
      cards = [...root.querySelectorAll('.st-card')];
      nums = [...root.querySelectorAll('.st-num')];
    },
    draw(f) {
      const out = range(f.lt, f.dur - 0.3, f.dur, ease.inQuad);
      if (head) {
        const h = range(f.lt, 0, 0.4, ease.outExpo);
        head.style.opacity = h * (1 - out);
        head.style.transform = `translateY(${(1 - h) * 20}px)`;
      }
      items.forEach((it, i) => {
        const t0 = times ? times[i] - this.start : at + i * stagger;
        const p = spring(f.lt - t0, { stiffness: 200, damping: 17 });
        cards[i].style.opacity = clamp(p * 2) * (1 - out);
        cards[i].style.transform = `translateY(${(1 - p) * 50 - out * 30}px) scale(${0.92 + 0.08 * p})`;
        if (typeof it.value === 'number') {
          const k = range(f.lt, t0, t0 + count, ease.outExpo);
          nums[i].textContent = `${it.prefix || ''}${fmt(it.value * k, it.decimals || 0)}${it.suffix || ''}`;
        } else {
          nums[i].textContent = it.value;
        }
      });
    },
  };
}
