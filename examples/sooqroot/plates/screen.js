// screen: a real screenshot with camera moves (push-ins, pans) and callouts that track the UI.
//
// keys:     [{ t, x, y, zoom, move }]: the camera arrives at focus point (x, y), in image pixels, at
//           plate time t, after moving for `move` seconds (default 0.9). zoom 1 = image fits the view width.
// callouts: [{ t, until, x, y, w, h, label }]: boxes in image pixels that follow the camera.
// frame:    'window' (browser chrome + url), 'phone', or 'none' (full bleed).
import { clamp, ease, lerp, range, spring } from '../motion.js';

export default function screen({
  src, w, h, keys = [{ t: 0, x: 0.5, y: 0.5, zoom: 1 }], callouts = [], frame = 'window', url = '',
  vw = 1640, vh = 922, top = null, name = 'screen',
} = {}) {
  let win, img, over, boxes = [];
  const K = keys.map((k) => ({ move: 0.9, ...k }));
  const cam = (lt) => {
    let c = { ...K[0] };
    for (let i = 1; i < K.length; i++) {
      const k = K[i];
      const p = range(lt, k.t - k.move, k.t, ease.inOutCubic);
      if (p <= 0) break;
      c = {
        x: lerp(c.x, k.x, p), y: lerp(c.y, k.y, p),
        zoom: Math.exp(lerp(Math.log(c.zoom), Math.log(k.zoom), p)),
      };
    }
    return c;
  };
  return {
    name,
    async setup(root) {
      const chrome = frame === 'window'
        ? `<div class="scr-bar"><span></span><span></span><span></span><label>${url}</label></div>` : '';
      root.innerHTML = `
        <div class="scr scr-${frame}" style="${top !== null ? `top:${top}px;translate:-50% 0;` : ''}">
          ${chrome}
          <div class="scr-view" style="width:${vw}px;height:${vh}px"><img class="scr-img" src="${src}" alt=""><div class="scr-over"></div></div>
        </div>`;
      win = root.querySelector('.scr');
      img = root.querySelector('.scr-img');
      over = root.querySelector('.scr-over');
      try { await img.decode(); } catch { /* render waits for images anyway */ }
      w = w || img.naturalWidth; h = h || img.naturalHeight;
      // keys/callouts may use 0..1 fractions; convert to pixels
      for (const k of K) { if (k.x <= 1) k.x *= w; if (k.y <= 1) k.y *= h; }
      // callouts may also use 0..1 fractions of the image
      for (const c of callouts) if (c.x <= 1 && c.y <= 1 && c.w <= 1 && c.h <= 1) { c.x *= w; c.y *= h; c.w *= w; c.h *= h; }
      boxes = callouts.map((c) => {
        const el = document.createElement('div');
        el.className = 'scr-call';
        el.innerHTML = c.label ? `<b>${c.label}</b>` : '';
        over.appendChild(el);
        return { el, c };
      });
    },
    draw(f) {
      const inK = spring(f.lt, { stiffness: 120, damping: 18 });
      const out = range(f.lt, f.dur - 0.3, f.dur, ease.inQuad);
      win.style.opacity = clamp(inK * 1.6) * (1 - out);
      win.style.transform = `perspective(2600px) rotateX(${(1 - inK) * 12}deg) translateY(${(1 - inK) * 90 - out * 30}px) scale(${0.94 + 0.06 * inK})`;

      const c = cam(f.lt);
      const s = (c.zoom * vw) / w;
      let tx = vw / 2 - c.x * s, ty = vh / 2 - c.y * s;
      if (w * s >= vw) tx = Math.min(0, Math.max(vw - w * s, tx)); else tx = (vw - w * s) / 2;
      if (h * s >= vh) ty = Math.min(0, Math.max(vh - h * s, ty)); else ty = (vh - h * s) / 2;
      img.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;

      for (const { el, c: b } of boxes) {
        const a = spring(f.lt - b.t, { stiffness: 260, damping: 18 });
        const gone = b.until != null ? range(f.lt, b.until, b.until + 0.25, ease.inQuad) : 0;
        const vis = f.lt >= b.t ? clamp(a * 2) * (1 - gone) : 0;
        Object.assign(el.style, {
          left: `${tx + b.x * s}px`, top: `${ty + b.y * s}px`, width: `${b.w * s}px`, height: `${b.h * s}px`,
          opacity: vis, transform: `scale(${1.08 - 0.08 * clamp(a)})`,
        });
      }
    },
  };
}
