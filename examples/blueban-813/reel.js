// BLUEBAN 813: 30 s launch video, 1920x1080. Every cut comes from the voice (bm_george).
// Imagery: the real Sentinel-2 frame of the Fujairah event (BB-AE-2024-001) and the live dashboard.
import { run, E } from './engine.js';
import { cut, lineOf, wordOf } from './motion.js';
import bg from './plates/bg.js';
import photo from './plates/photo.js';
import say from './plates/say.js';
import logo from './plates/logo.js';
import stats from './plates/stats.js';
import steps from './plates/steps.js';
import cap from './plates/cap.js';
import screen from './plates/screen.js';

const END = 30;
const at = (w, after = 0, d = 0) => (wordOf(w, after)?.s ?? after) + d;

run({
  width: 1920,
  height: 1080,
  fps: 30,
  background: 'var(--ink)',
  audio: 'audio/voiceover.wav',
  words: 'data/words.json',
  env: 'data/audio.json',
  timeline: () => {
    const c2 = cut('When the sea'), c3 = cut('BlueBan eight-one-three watches'), c4 = cut('Five thousand');
    const c5 = cut('Satellites flag'), c6 = cut('Like this'), c7 = at('Early', 0, -0.18);
    return [
      E(bg(), 0, END),
      E(photo({
        src: 'assets/fujairah-rgb.jpg', src2: 'assets/fujairah-ndci-z.jpg', turnAt: at('turns', 0, -0.12),
        label: 'Sentinel-2 · off Fujairah · 17 Feb 2024', label2: 'NDCI anomaly vs its own seasonal past',
        from: { x: 0.42, y: 0.5, zoom: 1 }, to: { x: 0.5, y: 0.42, zoom: 1.22 }, dim: 0.9, shade: 'left',
      }), 0, c3),
      E(say({ name: 'hook', text: 'The UAE drinks the sea.', size: 132, align: 'left' }), 0, c2),
      E(say({ name: 'turn', text: 'When the sea turns, the taps are at risk.', size: 108, align: 'left' }), c2, c3),
      E(logo({ src: 'assets/logo-full.png', height: 420, tagline: 'Every Sentinel-2 pass since 2017', at: 0.1 }), c3, c4),
      E(stats({
        title: 'The archive',
        items: [
          { value: 5080, label: 'Sentinel-2 datatakes' },
          { value: 10, label: 'UAE areas' },
          { value: '2017–26', label: 'record' },
        ],
        times: [at('Five'), at('Ten'), at('Ten', 0, 0.45)],
      }), c4, c5),
      E(cap({ size: 64, top: 200 }), c5, c6),
      E(steps({
        top: 520,
        items: [
          { label: 'WATCH', sub: 'Monitoring' }, { label: 'DETECT', sub: 'Unusual water' },
          { label: 'DIAGNOSE', sub: 'Colour fingerprint' }, { label: 'VERIFY', sub: 'Field samples' },
          { label: 'ACT', sub: 'Response' }, { label: 'LEARN', sub: 'Model improvement' },
        ],
        times: [at('Satellites'), at('flag'), at('analyst'), at('field'), at('confirms'), at('learns')],
      }), c5, c6),
      E(screen({
        src: 'assets/dashboard.jpg', url: 'blueban813.kanbanstudios.ae', vw: 1600, vh: 900,
        keys: [
          { t: 0, x: 0.5, y: 0.5, zoom: 1 },
          { t: 1.0, x: 0.445, y: 0.4, zoom: 2.1, move: 0.9 },
          { t: 3.4, x: 0.875, y: 0.24, zoom: 2.0, move: 1.0 },
        ],
        callouts: [
          { t: 0.85, until: 2.35, x: 0.39, y: 0.25, w: 0.11, h: 0.32, label: 'bloom-like · 2.39 km²' },
          { t: 3.45, x: 0.772, y: 0.125, w: 0.215, h: 0.088, label: 'BB-AE-2024-001 · under review' },
        ],
      }), c6, c7),
      E(logo({
        src: 'assets/logo-full.png', height: 330, tagline: "Early warning for the water in front of the UAE's intakes.",
        url: 'blueban813.kanbanstudios.ae', credit: 'Made with Kanban Motion · Kanban Studios', creditLogo: 'assets/ks-light.png', at: 0.1,
      }), c7, END),
    ];
  },
});
