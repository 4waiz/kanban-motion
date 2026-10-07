// The timeline: which plate plays when. Cuts come from the voiceover itself:
// cut('Every frame') = 0.18 s before that line's first word, inside the breath.
// Regenerate the voice with the same script and every cut re-times itself.
import { run, E } from './engine.js';
import { cut, lineOf } from './motion.js';
import paper from './plates/paper.js';
import say from './plates/say.js';
import code from './plates/code.js';
import outro from './plates/outro.js';

const SNIPPET = `// a frame is a function of time
export default (f) => ({
  y: spring(f.lt),
  glow: f.env,
})`;

run({
  width: 1920,
  height: 1080,
  fps: 30,
  background: 'var(--ink)',
  audio: 'audio/voiceover.wav', // preview playback; the render muxes the final mix
  words: 'data/words.json',     // from scripts/align.py
  env: 'data/audio.json',       // voice loudness envelope, also from align.py
  timeline: () => {
    const end = (lineOf('Kanban Motion')?.e ?? 8) + 2.4;
    const t1 = cut('Every frame', 0.18, 2.2);
    const t2 = cut('Every word', 0.18, 4.6);
    const t3 = cut('Kanban Motion', 0.18, 6.6);
    return [
      E(paper(), 0, end),
      E(say({ name: 'hook', text: 'Videos, written as code.' }), 0, t1),
      E(code({ title: 'plates/hook.js', code: SNIPPET, cps: 64, delay: 0.2 }), t1, t2),
      E(say({ name: 'sync', text: 'Every word lands on the voice.', size: 104 }), t2, t3),
      E(outro({ title: 'Kanban Motion', tagline: 'Motion graphics as code.', url: 'github.com/4waiz/kanban-motion · made by Kanban Studios' }), t3, end),
    ];
  },
});
