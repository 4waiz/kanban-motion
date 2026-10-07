// bg: a slow-drifting gradient backdrop with two soft glows and a vignette.
// Colours come from CSS variables (--bg-a, --bg-b, --glow-a, --glow-b) so each project can theme it.
// The glow breathes with the voice (f.env) when there is one.
export default function bg({ angle = 160, drift = 1, name = 'bg' } = {}) {
  let a, b;
  return {
    name,
    setup(root) {
      root.innerHTML = `<div class="bg" style="background:linear-gradient(${angle}deg, var(--bg-a), var(--bg-b))">
        <i class="bg-glow ga"></i><i class="bg-glow gb"></i><i class="bg-vig"></i></div>`;
      [a, b] = root.querySelectorAll('.bg-glow');
    },
    draw(f) {
      const t = f.t * drift;
      a.style.transform = `translate(${Math.sin(t * 0.21) * 10}%, ${Math.cos(t * 0.17) * 8}%) scale(${1 + 0.06 * Math.sin(t * 0.3)})`;
      b.style.transform = `translate(${Math.cos(t * 0.19) * 12}%, ${Math.sin(t * 0.23) * 9}%)`;
      a.style.opacity = 0.5 + 0.3 * (f.env || 0);
    },
  };
}
