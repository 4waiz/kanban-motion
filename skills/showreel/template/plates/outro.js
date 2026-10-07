// outro: the name lands, a plotter-pen underline draws itself, then tagline and URL.
import { clamp, ease, range, spring } from '../motion.js';

export default function outro({ title = 'Showreel', tagline = '', url = '', at = 0, name = 'outro' } = {}) {
  let t1, line, sub, link;
  return {
    name,
    setup(root) {
      root.innerHTML = `
        <div class="outro">
          <h1>${title}</h1>
          <svg viewBox="0 0 1000 40" preserveAspectRatio="none"><path d="M10 26 C 240 8, 520 34, 990 14" pathLength="1"/></svg>
          <p class="outro-tag">${tagline}</p>
          <p class="outro-url">${url}</p>
        </div>`;
      t1 = root.querySelector('h1');
      line = root.querySelector('path');
      sub = root.querySelector('.outro-tag');
      link = root.querySelector('.outro-url');
    },
    draw(f) {
      const lt = f.lt - at;
      const k = spring(lt, { stiffness: 200, damping: 16 });
      t1.style.opacity = clamp(k * 2);
      t1.style.transform = `scale(${0.82 + 0.18 * k})`;
      t1.style.letterSpacing = `${(1 - clamp(k)) * 0.12 - 0.02}em`;
      line.style.strokeDashoffset = 1 - range(lt, 0.25, 0.85, ease.inOutCubic);
      const a = range(lt, 0.7, 1.1, ease.outExpo);
      sub.style.opacity = a;
      sub.style.transform = `translateY(${(1 - a) * 20}px)`;
      link.style.opacity = range(lt, 1.0, 1.4, ease.outQuad);
    },
  };
}
