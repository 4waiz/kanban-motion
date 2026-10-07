// SooqRoot: 30 s vertical launch video, 1080x1920, with a voiceover (am_michael). Cuts land on the
// bars of a 120 bpm music bed (bed.py), and each voice line starts on its scene's downbeat ([at] in
// script.txt); the typed headlines type as their words are spoken. Screens are the real app
// running locally; every figure in SooqRoot is illustrative demo data, so only the engine's
// rules are counted up, never business numbers.
import { run, E } from './engine.js';
import { wordOf } from './motion.js';
import bg from './plates/bg.js';
import photo from './plates/photo.js';
import typewrite from './plates/typewrite.js';
import screen from './plates/screen.js';
import stats from './plates/stats.js';
import logo from './plates/logo.js';

const BAR = 2;                       // 120 bpm, 4/4
const B = (n) => n * BAR;            // bar n starts at B(n)
const END = B(15);                   // 30 s
const head = (eyebrow, ...lines) => typewrite({ eyebrow, lines, size: 62, top: 270, at: 0.1, cps: 34, gap: 0.1 });
const view = { vw: 960, vh: 1000, top: 560, url: 'sooqroot.kanbanstudios.ae' };

run({
  width: 1080,
  height: 1920,
  fps: 30,
  background: 'var(--ink)',
  audio: 'audio/voiceover.wav',
  words: 'data/words.json',
  env: 'data/audio.json',
  timeline: () => [
    E(bg({ angle: 170 }), 0, END),
    E(photo({ src: 'assets/agri-network.jpg', from: { x: 0.55, y: 0.5, zoom: 1.0 }, to: { x: 0.48, y: 0.45, zoom: 1.18 }, dim: 0.95, shade: 'bottom' }), 0, B(3)),
    E(typewrite({
      eyebrow: 'The Procurement Operating System for UAE Local Food',
      lines: ['One Order.', 'Many Farms.', 'Confirmed', 'Before Harvest.'], accent: [2, 3],
      size: 112, top: 1060, cps: 22,
      times: ['One', 'Many', 'Confirmed', 'Before'].map((w) => wordOf(w)?.s ?? 0.35),
    }), 0, B(3)),
    E(typewrite({ lines: ['Buyers don’t', 'write purchase', 'orders.', 'They write', 'sentences.'], accent: [3, 4], size: 112, cps: 28,
      times: [['Buyers', 0], ['write', 6], ['orders', 6], ['They', 6], ['sentences', 6]].map(([w, a]) => wordOf(w, a)?.s ?? B(3) + 0.2) }), B(3), B(5)),

    E(head('AI Demand Translator', 'SooqRoot reads the sentence.'), B(5), B(7)),
    E(screen({ ...view, src: 'assets/demand_out.jpg',
      keys: [{ t: 0, x: 0.39, y: 0.45, zoom: 2.4 }, { t: 1.9, x: 0.78, y: 0.55, zoom: 2.3, move: 1.0 }],
      callouts: [
        { t: 0.5, until: 1.55, x: 0.205, y: 0.372, w: 0.375, h: 0.15, label: 'the buyer’s sentence' },
        { t: 2.05, x: 0.6, y: 0.488, w: 0.355, h: 0.07, label: '“ten tonnes” → 10,000 kg' },
      ] }), B(5), B(7)),

    E(head('Commitment Engine', 'One order,', 'split across farms.'), B(7), B(9)),
    E(screen({ ...view, src: 'assets/engine_run.jpg',
      keys: [{ t: 0, x: 0.32, y: 0.55, zoom: 2.4 }, { t: 1.8, x: 0.76, y: 0.56, zoom: 2.2, move: 1.0 }],
      callouts: [
        { t: 0.45, until: 1.5, x: 0.203, y: 0.345, w: 0.235, h: 0.395, label: 'SR-2610 · 10,000 kg tomatoes' },
        { t: 2.0, x: 0.865, y: 0.395, w: 0.11, h: 0.04, label: 'max 23% per farm' },
        { t: 2.5, x: 0.893, y: 0.283, w: 0.09, h: 0.033, label: '100% coverage' },
      ] }), B(7), B(9)),

    E(head('Farmer Copilot', 'A WhatsApp in Arabic.', 'A one-word reply.'), B(9), B(11)),
    E(screen({ ...view, src: 'assets/copilot_ar.jpg',
      keys: [{ t: 0, x: 0.695, y: 0.44, zoom: 1.75 }, { t: 3.6, x: 0.68, y: 0.45, zoom: 1.9, move: 3.2 }],
      callouts: [
        { t: 0.45, x: 0.528, y: 0.35, w: 0.447, h: 0.1, label: 'commitment request · in Arabic' },
        { t: 1.6, x: 0.417, y: 0.452, w: 0.2, h: 0.08, label: 'reply: نعم · yes' },
      ] }), B(9), B(11)),

    E(stats({
      title: 'The Commitment Engine’s rules', cols: 1, at: 0.15, stagger: 0.35,
      items: [
        { value: 7, label: 'weighted farm signals' },
        { value: 23, suffix: '%', label: 'max share of an order per farm' },
        { value: 5, suffix: '%', label: 'max backup share' },
      ],
    }), B(11), B(13)),
    E(logo({
      src: 'assets/logo-light.png', height: 150, tagline: 'The Procurement Operating System for UAE Local Food',
      badge: '2nd Place · Universities Hackathon: Farm to Market', url: 'sooqroot.kanbanstudios.ae',
      credit: 'Made with Kanban Motion · Kanban Studios', creditLogo: 'assets/ks-light.png', at: 0.1,
    }), B(13), END),
  ],
});
