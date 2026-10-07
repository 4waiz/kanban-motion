// ROADTRACE: 15 s cinematic sequence, 1920x1080, with a voiceover (af_bella). Kinetic typography, smooth shape transitions, 3D
// elements and one seamless camera move that chases a car down the road past camera sites
// RT-01 to RT-04. Words are ROADTRACE's own; the stills are the simulation's own renders.
import { run, E } from './engine.js';
import { clamp, ease, lerp, range, spring } from './motion.js';
import bg from './plates/bg.js';
import space from './plates/space.js';
import photo from './plates/photo.js';
import logo from './plates/logo.js';

const END = 15;
const G = '#55f59a', G2 = '#79ffae', AMB = '#ffb44c', FG = '#ecf5ef';
const SANS = (w) => `${w} 100px Geist`;
const MONO = (w) => `${w} 100px "Geist Mono"`;
const span = (s, word) => { const i = s.indexOf(word); return Array.from({ length: word.length }, (_, k) => i + k); };

// the car drives toward -z; everything is timed from where it is
const V = 4.2;
const carZ = (t) => 4 - V * t;
const car = (t) => [1.2, -1.15, carZ(t)];
const passAt = (z) => (4 - z) / V;

// road: lane chunks so each piece fades with its own distance
const lanes = [];
for (let z = 12; z > -84; z -= 8) {
  const segs = [[[-2.6, 0, 4], [-2.6, 0, -4]], [[3.4, 0, 4], [3.4, 0, -4]]];
  for (let d = 4; d > -4; d -= 2.4) segs.push([[0.4, 0, d], [0.4, 0, d - 1.2]]);
  lanes.push({ shapes: [segs], pos: [0, -1.58, z - 4], color: G, alpha: 0.75, width: 2, fog: 60 });
}
const sites = [['RT-01', 3.9, -6], ['RT-02', -3.1, -18], ['RT-03', 3.9, -30], ['RT-04', -3.1, -42]];

// camera: chase the car, then rise to show the whole network
const follow = (t) => [car(t)[0] - 1.6 + 0.9 * Math.sin(t * 0.35), 0.75 + 0.35 * Math.sin(t * 0.5), carZ(t) + 6.4];
const aim = (t) => [car(t)[0] - 0.4, -0.55, carZ(t) - 7];
const lift = (t) => ease.inOutCubic(clamp((t - 11.0) / 3.6));
const camera = {
  fov: 52,
  pos: (t) => { const k = lift(t), z = carZ(t); return [lerp(follow(t)[0], 0.4, k), lerp(follow(t)[1], 9.5, k), lerp(follow(t)[2], z + 13, k)]; },
  look: (t) => { const k = lift(t), z = carZ(t); return [lerp(aim(t)[0], 0.3, k), lerp(aim(t)[1], -1.6, k), lerp(aim(t)[2], z - 16, k)]; },
};
// type rides with the camera (same speed as the car), so it stays readable while it animates
const ride = (x, y, ahead) => (t) => [x, y, carZ(t) - ahead];
const textAt = (txt, at, until, x, y, size, font, extra = {}) => ({ text: txt, pos: ride(x, y, 3.2)(at), vel: [0, 0, -V], size, at, until, font, color: FG, ...extra });

const T = { a: 'Every car leaves a trace.', b: 'Real snapshot', c: 'Visual fingerprint', d: 'Type what you remember', e: 'Follow the trace' };

// the snapshot card: a real capture from the simulation, popping in as RT-01 fires
const snap = {
  name: 'snap',
  setup(root) { root.innerHTML = '<div class="snap"><img src="assets/capture-ir.jpg" alt=""><b>#RT01 · CAPTURED <i>LANE 2</i></b></div>'; this.el = root.firstChild; },
  draw(f) {
    const k = spring(f.lt, { stiffness: 240, damping: 18 }), out = range(f.lt, f.dur - 0.3, f.dur, ease.inQuad);
    this.el.style.opacity = clamp(k * 2) * (1 - out);
    this.el.style.transform = `translateY(${(1 - k) * -40}px) scale(${0.9 + 0.1 * k})`;
  },
};

run({
  width: 1920,
  height: 1080,
  fps: 30,
  background: 'var(--ink)',
  audio: 'audio/voiceover.wav',
  words: 'data/words.json',
  env: 'data/audio.json',
  timeline: () => [
    E(bg({ angle: 175 }), 0, END),
    E(space({
      camera,
      grid: { y: -1.62, step: 2, size: 44, color: G, alpha: 0.16, fog: 44 },
      dust: { count: 260, box: [[-24, -1, -70], [24, 9, 14]], color: G2, alpha: 0.28 },
      objects: [
        ...lanes,
        // the car, which turns into its visual fingerprint and back, leaving a trace on the road
        { shapes: ['box', { kind: 'rings', at: 6.2 }, { kind: 'box', at: 8.0 }], morph: 0.8, pos: car,
          scale: (t) => { const m = range(t, 5.4, 6.2) * (1 - range(t, 7.2, 8.0)); return [lerp(0.75, 0.62, m), lerp(0.42, 0.62, m), lerp(1.5, 0.62, m)]; },
          color: G2, width: 2.4, trail: { dur: 2.6, step: 0.04, color: G, y: -1.55 } },
        // the four camera sites, each firing as the car passes
        ...sites.map(([, x, z]) => ({ shapes: ['camera'], pos: [x, 0.95, z], scale: 0.9, rot: [0.12, x > 0 ? -0.5 : 0.5, 0],
          color: G, width: 1.8, flash: [passAt(z) - 0.25], flashColor: '#ffffff' })),
      ],
      texts: [
        textAt(T.a, 0.35, 2.3, -1.2, 1.25, 0.7, SANS(800), { accent: span(T.a, 'trace.'), accentColor: G, glow: 12, glowColor: 'rgba(85,245,154,.4)' }),
        textAt(T.b, 2.6, 4.6, -1.8, 1.3, 0.72, SANS(800), { accent: span(T.b, 'snapshot'), accentColor: G }),
        textAt(T.c, 5.0, 7.5, -1.0, 1.4, 0.72, SANS(800), { accent: span(T.c, 'fingerprint'), accentColor: G2 }),
        textAt(T.d, 7.8, 10.0, -1.4, 1.3, 0.55, MONO(600), { stagger: 0.045, accent: span(T.d, 'remember'), accentColor: AMB }),
        textAt(T.e, 10.2, 12.0, 0.9, 1.6, 0.78, SANS(800), { accent: span(T.e, 'trace'), accentColor: G, glow: 12, glowColor: 'rgba(85,245,154,.4)' }),
        textAt('4 camera sites · RT-01 → RT-04', 10.5, 12.0, 0.9, 0.98, 0.26, MONO(500), { color: G2 }),
        ...sites.map(([id, x, z]) => ({ text: id, pos: [x, 2.0, z], size: 0.26, at: Math.max(0.1, passAt(z) - 2.4), until: passAt(z) + 0.2, font: MONO(600), color: G2 })),
      ],
    }), 0, END),
    E(snap, passAt(-6) - 0.2, passAt(-6) + 2.0),
    E(photo({ src: 'assets/cinematic.jpg', from: { x: 0.5, y: 0.6, zoom: 1.12 }, to: { x: 0.5, y: 0.5, zoom: 1.0 }, dim: 0, shade: 'full', fadeIn: 1.1, name: 'film' }), 11.7, END),
    E(logo({
      name: 'end', src: 'assets/mark.svg', height: 130, title: 'ROADTRACE', tagline: 'Every car leaves a trace.',
      badge: 'Live simulation · runs in the browser', url: 'cctv.kanbanstudios.ae',
      credit: 'by Kanban Studios', creditLogo: 'assets/ks-light.png', at: 0.2,
    }), 12.4, END),
  ],
});
