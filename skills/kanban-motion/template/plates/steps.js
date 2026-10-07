// steps: a pipeline that lights up stage by stage (e.g. WATCH -> DETECT -> ... -> LEARN).
// items: [{ label, sub }]. times: optional absolute activation time per step (e.g. from the voice).
import { clamp, ease, range, spring } from '../motion.js';

export default function steps({ items = [], at = 0.25, every = 0.4, times = null, top = null, name = 'steps' } = {}) {
  let nodes = [], fill, act = [];
  return {
    name,
    setup(root) {
      root.innerHTML = `
        <div class="sp" style="${top !== null ? `top:${top}px;translate:0 0;` : ''}">
          <div class="sp-rail"><i></i></div>
          ${items.map((it, i) => `<div class="sp-node"><div class="sp-dot">${String(i + 1).padStart(2, '0')}</div><b>${it.label}</b><span>${it.sub || ''}</span></div>`).join('')}
        </div>`;
      nodes = [...root.querySelectorAll('.sp-node')];
      fill = root.querySelector('.sp-rail i');
      act = items.map((_, i) => (times ? times[i] : this.start + at + i * every));
    },
    draw(f) {
      const out = range(f.lt, f.dur - 0.3, f.dur, ease.inQuad);
      const n = items.length;
      nodes.forEach((el, i) => {
        const p = spring(f.t - act[i] + 0.12, { stiffness: 230, damping: 16 });
        const on = f.t >= act[i];
        const current = on && (i === n - 1 || f.t < act[i + 1]);
        el.style.opacity = (0.28 + 0.72 * clamp(p)) * (1 - out);
        el.style.transform = `translateY(${(1 - clamp(p)) * 26}px) scale(${current ? 1.06 : 1})`;
        el.classList.toggle('on', on);
        el.classList.toggle('now', current);
      });
      // the rail fills from the first node to the current one
      let k = 0;
      for (let i = 1; i < n; i++) k += range(f.t, act[i] - 0.3, act[i], ease.inOutQuad);
      fill.style.transform = `scaleX(${n > 1 ? k / (n - 1) : 1})`;
      fill.parentNode.style.opacity = 1 - out;
    },
  };
}
