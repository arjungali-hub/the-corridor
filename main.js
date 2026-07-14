// The Corridor — bootstrap, input, and the frame loop. Loaded last.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ── input ────────────────────────────────────────────────────────────────────

const KEYMAP = {
  w: 'up', arrowup: 'up',
  s: 'down', arrowdown: 'down',
  a: 'left', arrowleft: 'left',
  d: 'right', arrowright: 'right',
  ' ': 'sense',
  e: 'scent',
};

window.addEventListener('keydown', (ev) => {
  const k = ev.key.toLowerCase();
  if (k === ' ' || k.startsWith('arrow')) ev.preventDefault();

  if (S && S.mode === 'intro') { S.mode = 'play'; return; }

  if (k === 'n') { clearSave(); newGame(); S.mode = 'play'; return; }
  if (k === 'f' && S && S.mode === 'play') { togglePackStay(); return; }

  const slot = KEYMAP[k];
  if (slot) input[slot] = true;
});

window.addEventListener('keyup', (ev) => {
  const slot = KEYMAP[ev.key.toLowerCase()];
  if (slot) input[slot] = false;
});

// right-mouse hold also raises the map
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
canvas.addEventListener('mousedown', (ev) => { if (ev.button === 2) input.sense = true; });
window.addEventListener('mouseup', (ev) => { if (ev.button === 2) input.sense = false; });
window.addEventListener('blur', () => {
  input.up = input.down = input.left = input.right = input.sense = input.scent = false;
});

// ── boot ─────────────────────────────────────────────────────────────────────

if (!loadGame()) newGame();

let lastT = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);
