// Encirra: 30 s square explainer, 1080x1080. Voice: af_nova. Every cut comes from the voice.
// Screens are the real app (served locally from its build) mid-scenario. All Encirra data is
// synthetic and it is not connected to any operational system, so the video says so on screen.
import { run, E } from './engine.js';
import { cut, wordOf } from './motion.js';
import bg from './plates/bg.js';
import stats from './plates/stats.js';
import logo from './plates/logo.js';
import screen from './plates/screen.js';
import cap from './plates/cap.js';
import say from './plates/say.js';

const END = 30;
const at = (w, after = 0, d = 0) => (wordOf(w, after)?.s ?? after) + d;
const full = { vw: 1080, vh: 1080, frame: 'none' };

// a small persistent "concept · synthetic data" tag over every UI shot
const tag = (text) => ({
  name: 'tag',
  setup(root) { root.innerHTML = `<span class="tag">${text}</span>`; this.el = root.firstChild; },
  draw(f) { this.el.style.opacity = Math.min(1, f.lt / 0.3, (f.dur - f.lt) / 0.3); },
});

run({
  width: 1080,
  height: 1080,
  fps: 30,
  background: 'var(--ink)',
  audio: 'audio/voiceover.wav',
  words: 'data/words.json',
  env: 'data/audio.json',
  timeline: () => {
    const c2 = cut('Encirra fuses'), c3 = cut('A concept command'), c4 = cut('A gamma trend');
    const c5 = cut('Encirra correlates'), c6 = cut('Then a person'), c7 = cut('Encirra. Integrated');
    return [
      E(bg(), 0, END),
      E(stats({
        cols: 3, count: 0.9,
        items: [{ value: 200, label: 'sensors' }, { value: 4, label: 'video feeds' }, { value: 1, label: 'wind field' }],
        times: [at('Two'), at('Four'), at('One')],
      }), 0, c2),
      E(logo({ src: 'assets/mark.svg', height: 190, title: 'ENCIRRA', tagline: 'Integrated CBRN situational awareness', at: 0.08 }), c2, c3),

      E(screen({ ...full, src: 'assets/ov_flag.jpg',
        keys: [{ t: 0, x: 0.47, y: 0.45, zoom: 1.85 }, { t: 3.8, x: 0.43, y: 0.42, zoom: 2.35, move: 3.8 }] }), c3, c4),
      E(Object.assign(cap({ size: 46, top: 900, name: 'band' }), {}), c3, c4),

      E(screen({ ...full, src: 'assets/incidents.jpg',
        keys: [{ t: 0, x: 0.33, y: 0.12, zoom: 2.4 }, { t: 1.55, x: 0.32, y: 0.28, zoom: 2.4, move: 0.9 }],
        callouts: [
          { t: 0.3, until: 1.25, x: 0.18, y: 0.065, w: 0.33, h: 0.065, label: 'INC-1007-01 · Unit 3 east corridor' },
          { t: 1.65, x: 0.18, y: 0.22, w: 0.34, h: 0.062, label: 'RAD-S17 rising gamma trend' },
        ] }), c4, c5),

      E(screen({ ...full, src: 'assets/insights.jpg',
        keys: [
          { t: 0, x: 0.07, y: 0.27, zoom: 3.0 },
          { t: at('sends') - c5 + 0.35, x: 0.36, y: 0.42, zoom: 2.6, move: 0.8 },
          { t: at('re-tasks') - c5 + 0.35, x: 0.58, y: 0.82, zoom: 2.6, move: 0.8 },
        ],
        callouts: [
          { t: at('correlates') - c5 + 0.15, until: at('sends') - c5 - 0.25, x: 0.005, y: 0.205, w: 0.155, h: 0.12, label: '3 sources correlated · 73%' },
          { t: at('sends') - c5 + 0.45, until: at('re-tasks') - c5 - 0.25, x: 0.305, y: 0.405, w: 0.065, h: 0.03, label: 'UGV-01 · en route' },
          { t: at('re-tasks') - c5 + 0.45, x: 0.455, y: 0.785, w: 0.27, h: 0.05, label: 'UAV-01 re-tasked' },
        ] }), c5, c6),
      E(tag('CONCEPT · SYNTHETIC DATA'), c3, c6),

      E(say({ name: 'human', text: 'Then a person validates. Recommendations are advisory. Nothing acts on its own.', size: 76 }), c6, c7),
      E(logo({
        src: 'assets/mark.svg', height: 170, title: 'ENCIRRA', tagline: 'Integrated CBRN situational awareness',
        badge: 'Concept · synthetic data', url: 'github.com/4waiz/Encirra',
        credit: 'Made with Kanban Motion · Kanban Studios', creditLogo: 'assets/ks-light.png', at: 0.08,
      }), c7, END),
    ];
  },
});
