// showreel engine: plays plates in a browser preview and exposes the seek hook
// that scripts/render.mjs drives. You should not need to edit this file.
//
// A plate is { name, start, end, tail?, setup(root), draw(f) }.
//   setup(root) builds the plate's DOM once (root is a full-frame <div>).
//   draw(f) sets every visual property from f and nothing else:
//     f.t   global time (s)          f.lt  time since the plate started
//     f.p   0..1 through the plate   f.dur plate length (s)
//     f.env voice loudness 0..1 at t (needs data/audio.json)
//     f.fps frames per second
//   draw may return a Promise (e.g. waiting for a <video> to seek); the renderer awaits it.
// Plates live from start to end + tail, so a plate can overlap the next one for a transition.

import { setWords } from './motion.js';

const loadJSON = async (url) => {
  try {
    const r = await fetch(url);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
};

export const E = (plate, start, end, opts = {}) => Object.assign(plate, { start, end }, opts);

export async function run({ width = 1920, height = 1080, fps = 30, timeline, audio, words, env, background = '#000' }) {
  const params = new URLSearchParams(location.search);
  const rendering = params.has('render');
  const only = params.get('only');

  if (words) {
    const w = await loadJSON(words);
    if (w) setWords(w);
    else console.warn(`[showreel] ${words} not found; voice-synced plates fall back to their defaults`);
  }
  const envData = env ? await loadJSON(env) : null;
  const envAt = (t) => {
    if (!envData) return 0;
    const i = Math.max(0, Math.min(envData.rms.length - 1, Math.round(t * envData.fps)));
    return envData.rms[i];
  };

  const plates = typeof timeline === 'function' ? timeline() : timeline;
  const duration = Math.max(...plates.map((p) => p.end));

  // Hidden plates keep their layout (so fonts and images load up front) but nothing inside them
  // can show: !important beats any inline `visibility: visible` a plate sets on its children.
  const rule = document.createElement('style');
  rule.textContent = '.plate.off, .plate.off * { visibility: hidden !important; }';
  document.head.appendChild(rule);

  const stage = document.createElement('div');
  stage.id = 'stage';
  Object.assign(stage.style, {
    position: 'absolute', left: 0, top: 0, width: width + 'px', height: height + 'px',
    overflow: 'hidden', background, transformOrigin: '0 0',
  });
  document.body.appendChild(stage);

  for (const p of plates) {
    p.root = document.createElement('div');
    p.root.className = 'plate off plate-' + p.name;
    Object.assign(p.root.style, { position: 'absolute', inset: 0 });
    stage.appendChild(p.root);
    await p.setup?.(p.root, { width, height, fps });
  }

  // Never capture a frame with a font or image still loading.
  await document.fonts.ready;
  await Promise.all(
    [...document.images].map((img) =>
      img.complete ? 0 : new Promise((r) => { img.onload = img.onerror = r; })),
  );

  function seek(t) {
    const pending = [];
    for (const p of plates) {
      const live = t >= p.start && t < p.end + (p.tail || 0) && (!only || p.name === only);
      p.root.classList.toggle('off', !live);
      if (!live) continue;
      const lt = t - p.start, dur = p.end - p.start;
      const r = p.draw({ t, lt, p: lt / dur, dur, env: envAt(t), fps });
      if (r && r.then) pending.push(r);
    }
    return pending.length ? Promise.all(pending) : undefined;
  }

  const plateAt = (x) => plates.filter((p) => x >= p.start && x < p.end).pop() || plates[plates.length - 1];
  window.__meta = {
    width, height, fps, duration,
    plates: plates.map(({ name, start, end }) => ({ name, start, end })),
  };
  window.__seek = seek;
  window.__plateAt = (x) => plateAt(x).name;

  if (rendering) {
    document.body.style.margin = 0;
    await seek(0);
    window.__ready = true;
    return;
  }

  // ---- Preview -------------------------------------------------------------
  // space play/pause · ←/→ 1 s (shift 5 s) · , . one frame · [ ] prev/next plate
  // l loop plate · h hide HUD · ?t=12.5 start time · ?only=name solo a plate
  document.body.style.cssText += ';margin:0;background:#050505;overflow:hidden';
  const hud = document.createElement('div');
  Object.assign(hud.style, {
    position: 'fixed', left: 0, right: 0, bottom: 0, height: '40px', font: '12px ui-monospace,monospace',
    color: '#bbb', background: '#111', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 12px',
    zIndex: 10,
  });
  const label = document.createElement('span');
  const bar = Object.assign(document.createElement('input'), { type: 'range', min: 0, max: duration, step: 1 / fps });
  bar.style.flex = 1;
  hud.append(label, bar);
  document.body.appendChild(hud);

  const fit = () => {
    const h = hud.style.display === 'none' ? 0 : 40;
    stage.style.transform = `scale(${Math.min(innerWidth / width, (innerHeight - h) / height)})`;
  };
  addEventListener('resize', fit);
  fit();

  const vo = audio ? new Audio(audio) : null;
  let t = Number(params.get('t') || 0), playing = false, loop = null, last = performance.now();
  const setT = (x) => {
    t = Math.min(duration, Math.max(0, x));
    if (vo) vo.currentTime = t;
  };
  setT(t);
  bar.oninput = () => setT(Number(bar.value));

  addEventListener('keydown', (e) => {
    const k = e.key, step = e.shiftKey ? 5 : 1, i = plates.indexOf(plateAt(t));
    if (k === ' ') {
      playing = !playing;
      if (vo) { if (playing) { vo.currentTime = t; vo.play(); } else vo.pause(); }
    } else if (k === 'ArrowRight') setT(t + step);
    else if (k === 'ArrowLeft') setT(t - step);
    else if (k === '.') setT(t + 1 / fps);
    else if (k === ',') setT(t - 1 / fps);
    else if (k === ']') setT(plates[Math.min(plates.length - 1, i + 1)].start);
    else if (k === '[') setT(plates[Math.max(0, i - 1)].start);
    else if (k === 'l') loop = loop ? null : plateAt(t);
    else if (k === 'h') { hud.style.display = hud.style.display === 'none' ? 'flex' : 'none'; fit(); }
    else return;
    e.preventDefault();
  });

  function tick(now) {
    if (playing) {
      t = vo && !vo.paused && !vo.ended ? vo.currentTime : t + (now - last) / 1000;
      if (loop && t >= loop.end) setT(loop.start);
      if (t >= duration) setT(0);
    }
    last = now;
    seek(t);
    bar.value = t;
    label.textContent = `${t.toFixed(2)} / ${duration.toFixed(2)}s · ${plateAt(t).name}${loop ? ' (loop)' : ''}`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
