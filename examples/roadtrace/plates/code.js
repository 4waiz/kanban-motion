// code: an editor panel that types a snippet, with a blinking caret.
// Good for "show the thing" when the thing is code, a config, a command or a prompt.
import { clamp, ease, range, spring } from '../motion.js';

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// One pass over each line, so keywords inside comments or strings are never re-coloured.
const TOKENS = /(\/\/.*$)|('[^']*'?|"[^"]*"?|`[^`]*`?)|\b(import|from|export|default|const|let|return|function|await|async|new|if|else|for)\b/g;
const tint = (line) => {
  let out = '', last = 0;
  for (const m of line.matchAll(TOKENS)) {
    out += esc(line.slice(last, m.index));
    const tag = m[1] ? 'i' : m[2] ? 'b' : 'em';
    out += `<${tag}>${esc(m[0])}</${tag}>`;
    last = m.index + m[0].length;
  }
  return out + esc(line.slice(last));
};

export default function code({ title = 'reel.js', code: src = '', cps = 38, delay = 0.35, name = 'code' } = {}) {
  let body, panel, caret;
  return {
    name,
    setup(root) {
      root.innerHTML = `
        <div class="code-panel">
          <div class="code-bar"><span></span><span></span><span></span><label>${esc(title)}</label></div>
          <pre><code class="ghost">${esc(src)}</code><div class="live"><code></code><span class="caret"></span></div></pre>
        </div>`;
      panel = root.querySelector('.code-panel');
      body = root.querySelector('.live code');
      caret = root.querySelector('.caret');
    },
    draw(f) {
      const k = spring(f.lt, { stiffness: 140, damping: 18 });
      const out = range(f.lt, f.dur - 0.3, f.dur, ease.inQuad);
      panel.style.opacity = clamp(k * 1.4) * (1 - out);
      panel.style.transform = `translateY(${(1 - k) * 80 - out * 40}px) scale(${0.94 + 0.06 * k})`;
      const n = Math.max(0, Math.floor((f.lt - delay) * cps));
      body.innerHTML = src.slice(0, n).split('\n').map(tint).join('\n');
      const typing = n > 0 && n < src.length;
      caret.style.opacity = typing || Math.floor(f.lt * 2.2) % 2 === 0 ? 1 : 0;
    },
  };
}
