// CACK: 15 s cinematic sequence, 1920x1080, with a voiceover (am_onyx). Kinetic typography, smooth shape transitions, 3D
// elements and one seamless camera move. Words are CACK's own phrases. No people, no footage and
// no detection claims: the "crowd" is abstract shapes, and one of them moves out of place.
import { run, E } from './engine.js';
import bg from './plates/bg.js';
import space from './plates/space.js';
import logo from './plates/logo.js';

const END = 15;
const CY = '#22d3ee', VI = '#8b5cf6', RO = '#ff3d71', FG = '#e8eef8';
const SANS = (w) => `${w} 100px Inter`;
const span = (s, word) => { const i = s.indexOf(word); return Array.from({ length: word.length }, (_, k) => i + k); };

// the crowd: small tetrahedra flowing one way; one moves against the flow
const odd = (t) => [4.8 - t * 1.15, -1.0, -7.2];
const crowd = Array.from({ length: 16 }, (_, i) => {
  const lane = i % 4, x0 = -10 + ((i * 53) % 20);
  return {
    shapes: ['tetra'], scale: 0.3, rot: [i, i * 2, 0], spin: [0.5, 1 + (i % 3) * 0.25, 0],
    pos: (t) => [x0 + t * 0.85, -1.0 + Math.sin(t * 2 + i) * 0.05, -5.4 - lane * 1.2],
    color: CY, alpha: 0.55, width: 1.4, from: 2.4, to: 7.2,
  };
});

const T = {
  a: 'Learns what normal looks like',
  b: 'Out-of-place behaviour',
  c: 'Glitches in reality',
  d: 'Calibrated, explained evidence',
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
    E(bg({ angle: 165 }), 0, END),
    E(space({
      camera: {
        keys: [
          { t: 0, pos: [0, 2.6, 11], look: [0, 1.3, 0], fov: 50 },
          { t: 2.6, pos: [2.2, 2.3, 6.2], look: [-0.6, 0.3, -6], fov: 52 },
          { t: 5.6, pos: [-0.6, 2.0, -1.5], look: [0.8, 1.2, -17], fov: 52, roll: -3 },
          { t: 8.8, pos: [0.6, 2.4, -9.5], look: [0, 1.6, -27], fov: 50, roll: 2 },
          { t: 11.8, pos: [-0.4, 2.5, -18.5], look: [0, 1.6, -38], fov: 48 },
          { t: 15, pos: [0, 2.2, -29.5], look: [0, 1.5, -38], fov: 46 },
        ],
      },
      grid: { y: -1.6, step: 1.6, size: 44, color: CY, alpha: 0.32, fog: 44 },
      dust: { count: 380, box: [[-20, -1, -46], [20, 10, 12]], color: '#a3b3cc', alpha: 0.4 },
      objects: [
        // the kernel: a hexagon (CACK's mark) that becomes an icosahedron
        { shapes: ['hex', { kind: 'icosa', at: 2.5 }], morph: 1.0, pos: [0, 0.9, 0], scale: 1.45,
          spin: [0.15, 0.35, 0.05], color: CY, width: 2.2, to: 3.0 },
        ...crowd,
        // the out-of-place one, with CACK's pink target box
        { shapes: ['tetra'], scale: 0.34, spin: [0.6, 1.4, 0], pos: odd, color: RO, width: 2.4, from: 2.4, to: 7.2,
          glitch: [{ from: 4.1, to: 6.4, amount: 0.7 }], trail: { dur: 1.3, step: 0.05, color: RO } },
        { shapes: ['cross'], scale: 0.62, pos: (t) => [odd(t)[0], -0.95, -7.2], color: RO, width: 2, from: 3.6, to: 6.6 },
        // a glitch in reality
        { shapes: ['icosa', { kind: 'octa', at: 8.4 }, { kind: 'icosa', at: 9.2 }], morph: 0.5, pos: [1.8, 1.0, -18],
          scale: 1.35, spin: [0.3, 0.6, 0.1], color: VI, width: 2.2, from: 5.6, to: 9.6,
          glitch: [{ from: 6.6, to: 8.7, amount: 1 }] },
        // calibrated: a clean solid inside calibration rings
        { shapes: ['octa', { kind: 'icosa', at: 10.8 }], morph: 1.0, pos: [0, 1.2, -27.5], scale: 1.3,
          spin: [0.2, 0.5, 0], color: CY, width: 2.2, from: 8.4, to: 12.6 },
        { shapes: ['rings'], pos: [0, 1.2, -27.7], scale: (t) => 2.0 + 0.15 * Math.sin(t * 2), spin: [0, 0, 0.4],
          color: VI, alpha: 0.6, width: 1.6, from: 9.6, to: 12.6 },
        // the mark again, waiting at the end of the move
        { shapes: ['hexprism'], pos: [0, 1.5, -38], scale: 2.4, rot: [0, 0, 0], spin: [0, 0.25, 0],
          color: CY, alpha: 0.75, width: 2, from: 11 },
      ],
      texts: [
        { text: T.a, pos: [0, 2.9, 1.5], size: 0.46, at: 0.4, until: 2.0, font: SANS(600), color: FG, accent: span(T.a, 'normal'), accentColor: CY, glow: 14, glowColor: 'rgba(34,211,238,.45)' },
        { text: T.b, pos: [-0.4, 1.35, -9.5], size: 0.5, at: 3.2, until: 5.7, font: SANS(700), color: FG, accent: span(T.b, 'Out-of-place'), accentColor: RO },
        { text: T.c, pos: [0.6, 3.0, -17], size: 0.6, at: 6.4, until: 8.9, font: SANS(800), color: FG, glitch: [{ from: 6.6, to: 8.7 }] },
        { text: T.d, pos: [0, 3.0, -26], size: 0.48, at: 9.4, until: 11.9, font: SANS(600), color: FG, accent: span(T.d, 'evidence'), accentColor: CY },
      ],
    }), 0, END),
    E(logo({
      name: 'end', src: 'assets/logo.png', height: 210, title: 'CACK', tagline: 'Cognitive Anomaly Classification Kernel',
      badge: 'Real-time crowd and video-feed anomaly detection', credit: 'by Kanban Studios', creditLogo: 'assets/ks-light.png', at: 0.15,
    }), 12.3, END),
  ],
});
