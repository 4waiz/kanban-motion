// shot: a real screenshot or exported UI frame in a window, springing in and drifting.
// Use the product's actual UI (render it, screenshot it, or point at its built assets).
import { clamp, ease, range, spring } from '../motion.js';

export default function shot({ src, caption = '', url = '', name = 'shot' } = {}) {
  let win, cap;
  return {
    name,
    setup(root) {
      root.innerHTML = `
        <div class="shot">
          <div class="shot-win">
            <div class="shot-bar"><span></span><span></span><span></span><label>${url}</label></div>
            <img src="${src}" alt="">
          </div>
          <p class="shot-cap">${caption}</p>
        </div>`;
      win = root.querySelector('.shot-win');
      cap = root.querySelector('.shot-cap');
    },
    draw(f) {
      const k = spring(f.lt, { stiffness: 120, damping: 17 });
      const out = range(f.lt, f.dur - 0.3, f.dur, ease.inQuad);
      win.style.opacity = clamp(k * 1.5) * (1 - out);
      win.style.transform =
        `perspective(2400px) rotateX(${(1 - k) * 14}deg) translateY(${(1 - k) * 120 - f.lt * 6}px) scale(${0.9 + 0.08 * k + f.p * 0.03})`;
      const c = range(f.lt, 0.45, 0.9, ease.outExpo);
      cap.style.opacity = c * (1 - out);
      cap.style.transform = `translateY(${(1 - c) * 24}px)`;
    },
  };
}
