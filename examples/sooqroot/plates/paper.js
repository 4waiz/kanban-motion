// paper: graph-paper backdrop that drifts slowly and breathes with the voice.
// Put it first in the timeline, spanning the whole video.
export default function paper({ name = 'paper', drift = 14 } = {}) {
  let grid, glow;
  return {
    name,
    setup(root) {
      root.innerHTML = '<div class="paper"></div><div class="paper-glow"></div>';
      grid = root.querySelector('.paper');
      glow = root.querySelector('.paper-glow');
    },
    draw(f) {
      grid.style.backgroundPosition = `${-f.t * drift}px ${-f.t * drift * 0.4}px`;
      glow.style.opacity = 0.55 + 0.45 * f.env;
    },
  };
}
