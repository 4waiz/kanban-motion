// photo: a full-bleed image (satellite frame, hero art, product shot) with a slow camera push.
// Optional "turn": at time `turnAt` a scan line sweeps down and reveals a second image (src2),
// e.g. true colour -> anomaly map. Labels are small corner chips (only state what the image is).
// from/to: { x, y, zoom } in 0..1 image fractions; zoom 1 = the image just covers the frame.
import { clamp, ease, lerp, range } from '../motion.js';

export default function photo({
  src, src2 = '', turnAt = null, turnDur = 0.9, from = { x: 0.5, y: 0.5, zoom: 1 }, to = { x: 0.5, y: 0.5, zoom: 1.12 },
  label = '', label2 = '', dim = 0.35, shade = 'left', fadeIn = 0.35, name = 'photo',
} = {}) {
  let wrap, a, b, scan, chip1, chip2, W, H, iw = 0, ih = 0;
  const place = (img, cam) => {
    const s = Math.max(W / iw, H / ih) * cam.zoom;
    let tx = W / 2 - cam.x * iw * s, ty = H / 2 - cam.y * ih * s;
    tx = Math.min(0, Math.max(W - iw * s, tx));
    ty = Math.min(0, Math.max(H - ih * s, ty));
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  };
  return {
    name,
    async setup(root, { width, height }) {
      W = width; H = height;
      root.innerHTML = `
        <div class="ph">
          <img class="ph-a" src="${src}" alt="">${src2 ? `<img class="ph-b" src="${src2}" alt="">` : ''}
          <i class="ph-scan"></i><i class="ph-shade ph-shade-${shade}" style="opacity:${dim}"></i>
          ${label ? `<span class="ph-chip">${label}</span>` : ''}${label2 ? `<span class="ph-chip ph-chip2">${label2}</span>` : ''}
        </div>`;
      wrap = root.firstElementChild;
      a = root.querySelector('.ph-a');
      b = root.querySelector('.ph-b');
      scan = root.querySelector('.ph-scan');
      [chip1, chip2] = root.querySelectorAll('.ph-chip');
      try { await a.decode(); } catch { /* render waits for images */ }
      iw = a.naturalWidth; ih = a.naturalHeight;
    },
    draw(f) {
      const out = range(f.lt, f.dur - 0.3, f.dur, ease.inQuad);
      const k = ease.inOutQuad(clamp(f.p));
      const cam = { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), zoom: lerp(from.zoom, to.zoom, k) };
      place(a, cam);
      const turn = turnAt !== null ? range(f.t, turnAt, turnAt + turnDur, ease.inOutCubic) : 0;
      if (b) {
        place(b, cam);
        b.style.clipPath = `inset(0 0 ${(1 - turn) * 100}% 0)`;
        scan.style.opacity = turn > 0 && turn < 1 ? 1 : 0;
        scan.style.top = `${turn * 100}%`;
      }
      wrap.style.opacity = range(f.lt, 0, fadeIn, ease.inOutQuad) * (1 - out);
      if (chip1) chip1.style.opacity = range(f.lt, 0.4, 0.8, ease.outQuad) * (1 - (b ? turn : 0));
      if (chip2) chip2.style.opacity = turn;
    },
  };
}
