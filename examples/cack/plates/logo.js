// logo: logo reveal. The mark wipes in and settles on a spring, a glint passes, then the
// title, tagline and an optional credit line land.
import { clamp, ease, range, spring } from '../motion.js';

export default function logo({ src = '', height = 200, title = '', tagline = '', badge = '', url = '', credit = '', creditLogo = '', at = 0.15, name = 'logo' } = {}) {
  let mark, glint, ttl, tag, bdg, link, cred;
  return {
    name,
    setup(root) {
      root.innerHTML = `
        <div class="lg">
          ${src ? `<div class="lg-mark"><img src="${src}" alt="" style="height:${height}px"><i class="lg-glint"></i></div>` : ''}
          ${title ? `<div class="lg-title">${title}</div>` : ''}
          ${tagline ? `<div class="lg-tag">${tagline}</div>` : ''}
          ${badge ? `<div class="lg-badge">${badge}</div>` : ''}
          ${url ? `<div class="lg-url">${url}</div>` : ''}
          ${credit ? `<div class="lg-credit">${creditLogo ? `<img src="${creditLogo}" alt="">` : ''}<span>${credit}</span></div>` : ''}
        </div>`;
      mark = root.querySelector('.lg-mark');
      glint = root.querySelector('.lg-glint');
      ttl = root.querySelector('.lg-title');
      tag = root.querySelector('.lg-tag');
      bdg = root.querySelector('.lg-badge');
      link = root.querySelector('.lg-url');
      cred = root.querySelector('.lg-credit');
    },
    draw(f) {
      const lt = f.lt - at;
      this.root.style.opacity = range(f.lt, 0, 0.4, ease.outQuad);
      if (mark) {
        const wipe = range(lt, 0, 0.55, ease.inOutCubic);
        const k = spring(lt, { stiffness: 170, damping: 15 });
        mark.style.clipPath = `inset(0 ${(1 - wipe) * 100}% 0 0)`;
        mark.style.transform = `scale(${0.86 + 0.14 * k})`;
        const g = range(lt, 0.5, 1.2, ease.inOutQuad);
        glint.style.transform = `translateX(${-120 + 240 * g}%) skewX(-18deg)`;
        glint.style.opacity = g > 0 && g < 1 ? 0.65 : 0;
      }
      const show = (el, t0, dy = 26) => {
        if (!el) return;
        const p = range(lt, t0, t0 + 0.45, ease.outExpo);
        el.style.opacity = p;
        el.style.transform = `translateY(${(1 - p) * dy}px)`;
      };
      show(ttl, 0.35, 34);
      show(tag, 0.6);
      show(bdg, 0.8, 18);
      show(link, 0.95);
      show(cred, 1.15, 14);
    },
  };
}
