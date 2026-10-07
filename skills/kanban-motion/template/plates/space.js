// space: one continuous camera move through a 3D scene. A perspective grid, wireframe solids
// that morph between shapes (and can glitch, travel and leave a trace), and kinetic type set in
// 3D, all drawn on a canvas as a pure function of time.
//
//   camera:  { keys: [{ t, pos: [x,y,z], look: [x,y,z], fov, roll }] }  (Catmull-Rom through keys)
//            or { pos: (t) => [x,y,z], look: (t) => [x,y,z], fov }
//   grid:    { y, step, size, color, alpha, fog }
//   objects: [{ shapes: ['hex', { kind: 'icosa', at: 4 }], morph, pos (array or t => array), scale,
//              rot, spin, color, width, from, to, glitch: [{ from, to, amount }], trail: { dur, step },
//              flash: [t...] }]
//   texts:   [{ text, pos, size, at, until, color, font, align, stagger, vel, glow, glitch }]
// The world is y-up; the camera usually travels toward -z.
import { clamp, ease, hash, lerp, range } from '../motion.js';

const PHI = (1 + Math.sqrt(5)) / 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return mul(a, 1 / l); };
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---- shapes: lists of segments, roughly unit radius ----------------------------------------
const pairsAt = (V, d) => {
  const S = [];
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++)
    if (Math.abs(Math.hypot(...sub(V[i], V[j])) - d) < 1e-3) S.push([V[i], V[j]]);
  return S;
};
const unit = (S) => { const r = Math.max(...S.flat().map((v) => Math.hypot(...v))); return S.map(([a, b]) => [mul(a, 1 / r), mul(b, 1 / r)]); };
const ring = (n, r, z = 0, rot = 0) => Array.from({ length: n }, (_, i) => {
  const a = rot + (i / n) * Math.PI * 2, b = rot + ((i + 1) / n) * Math.PI * 2;
  return [[Math.cos(a) * r, Math.sin(a) * r, z], [Math.cos(b) * r, Math.sin(b) * r, z]];
});
const CORNERS = [];
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) CORNERS.push([x, y, z]);
export const SHAPES = {
  tetra: () => unit(pairsAt([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], Math.sqrt(8))),
  cube: () => unit(pairsAt(CORNERS, 2)),
  box: () => SHAPES.cube(),
  octa: () => unit(pairsAt([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], Math.SQRT2)),
  icosa: () => unit(pairsAt([[0, 1, PHI], [0, 1, -PHI], [0, -1, PHI], [0, -1, -PHI], [1, PHI, 0], [1, -PHI, 0], [-1, PHI, 0], [-1, -PHI, 0],
    [PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, 1], [-PHI, 0, -1]], 2)),
  hex: () => [...ring(6, 1, 0, Math.PI / 6), ...ring(6, 0.56, 0, Math.PI / 6)],
  hexprism: () => [...ring(6, 1, -0.35, Math.PI / 6), ...ring(6, 1, 0.35, Math.PI / 6),
    ...Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i / 6) * Math.PI * 2; return [[Math.cos(a), Math.sin(a), -0.35], [Math.cos(a), Math.sin(a), 0.35]]; })],
  ring: () => ring(32, 1),
  rings: () => [...ring(24, 1), ...ring(18, 0.66), ...ring(12, 0.33)],
  cross: () => [[[-1, 0, 0], [-0.35, 0, 0]], [[0.35, 0, 0], [1, 0, 0]], [[0, -1, 0], [0, -0.35, 0]], [[0, 0.35, 0], [0, 1, 0]], ...ring(4, 0.35, 0, Math.PI / 4)],
  // a camera on a pole: body box, lens frustum pointing +z, and the pole
  camera: () => {
    const b = [[-0.35, -0.22, -0.5], [0.35, 0.22, 0.15]];
    const box = SHAPES.cube().map(([p, q]) => [p, q].map((v) => [lerp(b[0][0], b[1][0], (v[0] + 1) / 2), lerp(b[0][1], b[1][1], (v[1] + 1) / 2), lerp(b[0][2], b[1][2], (v[2] + 1) / 2)]));
    const apex = [0, 0, 0.15], base = [[-0.5, -0.32, 1], [0.5, -0.32, 1], [0.5, 0.32, 1], [-0.5, 0.32, 1]];
    return [...box, ...base.map((c) => [apex, c]), ...base.map((c, i) => [c, base[(i + 1) % 4]]), [[0, -0.22, -0.2], [0, -2.2, -0.2]]];
  },
};
const shapeOf = (k) => (Array.isArray(k) ? k : SHAPES[k]());
const sortSegs = (S) => S.map((s) => { const m = mul(add(s[0], s[1]), 0.5); return { s, k: Math.atan2(m[2], m[0]) * 10 + m[1] }; })
  .sort((a, b) => a.k - b.k).map((o) => o.s);
const pad = (S, n) => Array.from({ length: n }, (_, i) => S[i % S.length]);

// ---- camera ----------------------------------------------------------------------------------
const catmull = (p0, p1, p2, p3, u) => {
  const u2 = u * u, u3 = u2 * u;
  return p1.map((_, i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * u + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * u3));
};
function camAt(cam, t) {
  if (!cam.keys) return { pos: cam.pos(t), look: cam.look(t), fov: cam.fov || 55, roll: cam.roll ? cam.roll(t) : 0 };
  const K = cam.keys, n = K.length;
  if (t <= K[0].t) return { ...K[0], fov: K[0].fov || 55, roll: K[0].roll || 0 };
  if (t >= K[n - 1].t) return { ...K[n - 1], fov: K[n - 1].fov || 55, roll: K[n - 1].roll || 0 };
  let i = 0;
  while (i < n - 2 && t >= K[i + 1].t) i++;
  const u = (t - K[i].t) / (K[i + 1].t - K[i].t);
  const g = (j) => K[Math.max(0, Math.min(n - 1, j))];
  return {
    pos: catmull(g(i - 1).pos, g(i).pos, g(i + 1).pos, g(i + 2).pos, u),
    look: catmull(g(i - 1).look, g(i).look, g(i + 1).look, g(i + 2).look, u),
    fov: lerp(g(i).fov || 55, g(i + 1).fov || 55, u),
    roll: lerp(g(i).roll || 0, g(i + 1).roll || 0, u),
  };
}

export default function space({ camera, grid = null, objects = [], texts = [], dust = null, name = 'space' } = {}) {
  let cv, ctx, W, H, prepared = [], widths = [];
  return {
    name,
    async setup(root, { width, height }) {
      W = width; H = height;
      root.innerHTML = `<canvas width="${W}" height="${H}" style="position:absolute;inset:0;width:${W}px;height:${H}px"></canvas>`;
      cv = root.firstChild;
      ctx = cv.getContext('2d');
      // fonts used on the canvas must be loaded explicitly
      await Promise.all([...new Set(texts.map((x) => x.font || '700 100px sans-serif'))].map((f) => document.fonts.load(f.replace(/\d+px/, '100px'), 'Ag')));
      prepared = objects.map((o) => {
        const seq = (o.shapes || ['cube']).map((s, i) => (typeof s === 'string' || Array.isArray(s) ? { kind: s, at: i === 0 ? -1e9 : 0 } : s));
        const sets = seq.map((s) => sortSegs(shapeOf(s.kind)));
        const n = Math.max(...sets.map((S) => S.length));
        return { o, seq, sets: sets.map((S) => pad(S, n)) };
      });
      widths = texts.map((x) => {
        ctx.font = (x.font || '700 100px sans-serif').replace(/\d+px/, '100px');
        const chars = [...x.text];
        let acc = 0;
        const offs = chars.map((c) => { const o = acc; acc += ctx.measureText(c).width; return o; });
        return { chars, offs, total: acc };
      });
    },
    draw(f) {
      const t = f.t;
      ctx.clearRect(0, 0, W, H);
      const cam = camAt(camera, t);
      const fwd = norm(sub(cam.look, cam.pos));
      let right = norm(cross(fwd, [0, 1, 0]));
      let up = cross(right, fwd);
      if (cam.roll) {
        const r = (cam.roll * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
        [right, up] = [add(mul(right, c), mul(up, s)), add(mul(up, c), mul(right, -s))];
      }
      const F = (H / 2) / Math.tan(((cam.fov || 55) * Math.PI) / 360);
      const NEAR = 0.2;
      const view = (p) => { const d = sub(p, cam.pos); return [dot(d, right), dot(d, up), dot(d, fwd)]; };
      const scr = (v) => [W / 2 + (F * v[0]) / v[2], H / 2 - (F * v[1]) / v[2]];
      const seg = (a, b) => { // clip a world segment to the near plane, return screen points
        let va = view(a), vb = view(b);
        if (va[2] < NEAR && vb[2] < NEAR) return null;
        if (va[2] < NEAR) va = lerp3(va, vb, (NEAR - va[2]) / (vb[2] - va[2]));
        if (vb[2] < NEAR) vb = lerp3(vb, va, (NEAR - vb[2]) / (va[2] - vb[2]));
        return [scr(va), scr(vb), (va[2] + vb[2]) / 2];
      };
      const stroke = (paths, color, width, alpha, glow = true) => {
        ctx.strokeStyle = color; ctx.lineCap = 'round';
        if (glow) {
          ctx.globalAlpha = alpha * 0.16; ctx.lineWidth = width * 4.5; ctx.beginPath();
          for (const [a, b] of paths) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
          ctx.stroke();
        }
        ctx.globalAlpha = alpha; ctx.lineWidth = width; ctx.beginPath();
        for (const [a, b] of paths) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
        ctx.stroke();
      };

      // grid floor, faded with distance
      if (grid) {
        const { y = -1.5, step = 2, size = 60, color = '#ffffff', alpha = 0.25, fog = 60 } = grid;
        const cx = Math.round(cam.pos[0] / step) * step, cz = Math.round(cam.pos[2] / step) * step;
        const buckets = [[], [], [], []];
        for (let i = -size; i <= size; i += step) {
          for (let j = -size; j < size; j += step) {
            for (const [a, b] of [[[cx + i, y, cz + j], [cx + i, y, cz + j + step]], [[cx + j, y, cz + i], [cx + j + step, y, cz + i]]]) {
              const d = Math.hypot(...sub(mul(add(a, b), 0.5), cam.pos));
              const k = clamp(1 - d / fog);
              if (k <= 0) continue;
              const s = seg(a, b);
              if (s) buckets[Math.min(3, Math.floor(k * 4))].push(s);
            }
          }
        }
        buckets.forEach((B, i) => B.length && stroke(B, color, 1.2, alpha * ((i + 0.5) / 4) ** 1.6, false));
      }

      // dust: deterministic points for parallax depth
      if (dust) {
        const { count = 300, box = [[-30, -1, -80], [30, 14, 20]], color = '#ffffff', alpha = 0.5 } = dust;
        ctx.fillStyle = color;
        for (let i = 0; i < count; i++) {
          const p = [lerp(box[0][0], box[1][0], hash(i, 11)), lerp(box[0][1], box[1][1], hash(i, 23)), lerp(box[0][2], box[1][2], hash(i, 37))];
          const v = view(p);
          if (v[2] < NEAR) continue;
          const [sx, sy] = scr(v);
          const r = clamp(2.2 / v[2] * 6, 0.4, 3);
          ctx.globalAlpha = alpha * clamp(1 - v[2] / 70) * (0.4 + 0.6 * hash(i, 5));
          ctx.fillRect(sx - r / 2, sy - r / 2, r, r);
        }
      }

      // objects, far to near
      const frame = Math.floor(t * f.fps);
      const items = prepared.map((P) => {
        const o = P.o;
        const pos = typeof o.pos === 'function' ? o.pos(t) : (o.pos || [0, 0, 0]);
        return { P, pos, depth: view(pos)[2] };
      }).sort((a, b) => b.depth - a.depth);
      for (const { P, pos } of items) {
        const o = P.o;
        const from = o.from ?? -1e9, to = o.to ?? 1e9;
        if (t < from || t > to + (o.fadeOut ?? 0.6)) continue;
        let vis = range(t, from, from + (o.fadeIn ?? 0.6), ease.outQuad) * (1 - range(t, to, to + (o.fadeOut ?? 0.6), ease.inQuad));
        if (from < -1e8) vis = 1 - range(t, to, to + (o.fadeOut ?? 0.6), ease.inQuad);
        // which shapes are we between?
        let si = 0;
        for (let i = 1; i < P.seq.length; i++) if (t >= P.seq[i].at) si = i;
        let segs = P.sets[si];
        if (si + 1 < P.seq.length) {
          const m = range(t, P.seq[si + 1].at - (o.morph ?? 0.9), P.seq[si + 1].at, ease.inOutCubic);
          if (m > 0) segs = segs.map((s, i) => [lerp3(s[0], P.sets[si + 1][i][0], m), lerp3(s[1], P.sets[si + 1][i][1], m)]);
        }
        const sc = typeof o.scale === 'function' ? o.scale(t) : (o.scale ?? 1);
        const S = Array.isArray(sc) ? sc : [sc, sc, sc];
        const r0 = o.rot || [0, 0, 0], sp = o.spin || [0, 0, 0];
        const [ax, ay, az] = [r0[0] + sp[0] * t, r0[1] + sp[1] * t, r0[2] + sp[2] * t];
        const rotate = (v) => {
          let [x, y, z] = [v[0] * S[0], v[1] * S[1], v[2] * S[2]];
          [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
          [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
          [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
          return [x + pos[0], y + pos[1], z + pos[2]];
        };
        let g = 0;
        for (const G of o.glitch || []) g = Math.max(g, range(t, G.from, G.from + 0.15) * (1 - range(t, G.to - 0.15, G.to)) * (G.amount ?? 1));
        let fl = 0;
        for (const ft of o.flash || []) if (t >= ft) fl = Math.max(fl, 1 - range(t, ft, ft + 0.45, ease.outQuad));
        const paths = [];
        segs.forEach((s, i) => {
          if (g > 0 && hash(i * 7 + frame, 3) < 0.22 * g) return;
          let a = rotate(s[0]), b = rotate(s[1]);
          if (g > 0) {
            const j = 0.18 * g * Math.max(...S);
            a = add(a, [(hash(i, frame) - 0.5) * j, (hash(i, frame + 1) - 0.5) * j, 0]);
            b = add(b, [(hash(i, frame + 2) - 0.5) * j, (hash(i, frame + 3) - 0.5) * j, 0]);
          }
          const p = seg(a, b);
          if (p) paths.push(p);
        });
        const depthFade = clamp(1.15 - view(pos)[2] / (o.fog ?? 70));
        const alpha = (o.alpha ?? 1) * vis * depthFade;
        if (alpha <= 0.01) continue;
        const width = (o.width ?? 2) * (1 + fl * 1.2);
        if (g > 0) {
          const off = 6 * g;
          stroke(paths.map(([a, b]) => [[a[0] + off, a[1]], [b[0] + off, b[1]]]), o.glitchColor || '#ff3d71', width, alpha * 0.7 * g, false);
          stroke(paths.map(([a, b]) => [[a[0] - off, a[1]], [b[0] - off, b[1]]]), o.color2 || '#22d3ee', width, alpha * 0.7 * g, false);
        }
        stroke(paths, fl > 0 ? (o.flashColor || '#ffffff') : (o.color || '#ffffff'), width, Math.min(1, alpha * (1 + fl)));
        // the trace it leaves behind
        if (o.trail && typeof o.pos === 'function') {
          const { dur = 2, step = 0.04, color = o.color, y = null } = o.trail;
          const pts = [];
          for (let k = 0; k * step <= dur; k++) {
            const tt = t - k * step;
            if (tt < from) break;
            const q = o.pos(tt);
            const v = view(y === null ? q : [q[0], y, q[2]]);
            if (v[2] < NEAR) continue;
            pts.push([...scr(v), 1 - (k * step) / dur]);
          }
          ctx.strokeStyle = color; ctx.lineWidth = 3;
          for (let k = 1; k < pts.length; k++) {
            ctx.globalAlpha = alpha * pts[k][2] ** 2 * 0.9;
            ctx.beginPath(); ctx.moveTo(pts[k - 1][0], pts[k - 1][1]); ctx.lineTo(pts[k][0], pts[k][1]); ctx.stroke();
          }
        }
      }

      // kinetic type in 3D, far to near
      const order = texts.map((x, i) => ({ x, i, d: view(x.pos)[2] })).sort((a, b) => b.d - a.d);
      for (const { x, i } of order) {
        if (t < x.at - 0.05 || (x.until != null && t > x.until + 0.6)) continue;
        const L = widths[i];
        const size = x.size ?? 0.6;
        const base = x.pos, vel = x.vel || [0, 0, 0];
        const P0 = add(base, mul(vel, t - x.at));
        const startX = x.align === 'left' ? 0 : -L.total / 2;
        const stag = x.stagger ?? 0.035;
        ctx.textBaseline = 'alphabetic';
        L.chars.forEach((c, k) => {
          if (c === ' ') return;
          const a = x.at + k * stag;
          const p = range(t, a, a + 0.55, ease.outExpo);
          if (p <= 0) return;
          const q = x.until != null ? range(t, x.until + k * stag * 0.5, x.until + 0.45 + k * stag * 0.5, ease.inQuad) : 0;
          const lx = ((startX + L.offs[k]) / 100) * size;
          const w = [P0[0] + lx, P0[1] - (1 - p) * size * 0.9 + q * size * 0.6, P0[2] + (1 - p) * size * 3 - q * size * 2.5];
          const v = view(w);
          if (v[2] < NEAR) return;
          const [sx, sy] = scr(v);
          const px = (size * F) / v[2];
          ctx.font = (x.font || '700 100px sans-serif').replace(/\d+px/, `${px.toFixed(2)}px`);
          const alpha = p * (1 - q) * clamp(1.2 - v[2] / 60);
          const gl = x.glitch ? x.glitch.some((G) => t >= G.from && t <= G.to) : false;
          if (gl) {
            const off = px * 0.06 * (hash(k, frame) - 0.3);
            ctx.globalAlpha = alpha * 0.75; ctx.fillStyle = '#ff3d71'; ctx.fillText(c, sx + off, sy);
            ctx.fillStyle = '#22d3ee'; ctx.fillText(c, sx - off, sy);
          }
          ctx.globalAlpha = alpha;
          ctx.fillStyle = (x.accent && x.accent.includes(k)) ? (x.accentColor || '#ffffff') : (x.color || '#ffffff');
          if (x.glow) { ctx.shadowColor = x.glowColor || ctx.fillStyle; ctx.shadowBlur = x.glow; }
          ctx.fillText(c, sx, sy);
          ctx.shadowBlur = 0;
        });
      }
      ctx.globalAlpha = 1;
    },
  };
}
