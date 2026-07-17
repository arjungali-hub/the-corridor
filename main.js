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

  if (S && S.mode === 'intro') {
    // R reclaims a year in progress; any other key lets it go and starts fresh
    if (k === 'r' && hasResumableSave()) { if (!loadGame()) { clearSave(); beginFromIntro(); } return; }
    clearSave();
    beginFromIntro();
    return;
  }

  if (k === 'r') { requestNewYear(); return; }
  if (k === 'h' && S && S.tut && S.tut.taughtHelp
      && (S.mode === 'play' || S.mode === 'prologue')) { S.showHelp = !S.showHelp; return; }
  if (k === 'f' && S && (S.mode === 'play' || S.mode === 'prologue')) { togglePackStay(); return; }
  if (k === ' ' && !ev.repeat) toggleMap();  // press to open, press to close

  const slot = KEYMAP[k];
  if (slot) input[slot] = true;  // ' ' still tracked while held: the inherit gesture
});

window.addEventListener('keyup', (ev) => {
  const slot = KEYMAP[ev.key.toLowerCase()];
  if (slot) input[slot] = false;
});

// clicking the raised map plans a route to a known place
canvas.addEventListener('click', (ev) => {
  if (!S || (S.mode !== 'play' && S.mode !== 'prologue')) return;
  const wx = (ev.clientX - canvas.width / 2) / S.cam.scale + S.cam.x;
  const wy = (ev.clientY - canvas.height / 2) / S.cam.scale + S.cam.y;
  mapClick(wx, wy);
});

// right-click also toggles the map
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
canvas.addEventListener('mousedown', (ev) => { if (ev.button === 2) toggleMap(); });
window.addEventListener('blur', () => {
  input.up = input.down = input.left = input.right = input.sense = input.scent = false;
});

// ── boot ─────────────────────────────────────────────────────────────────────

// A reload is a clean slate by default: the whole game starts over, prologue
// included. A save is never loaded at boot — but a year in progress can be
// reclaimed from the intro screen with R; any other key clears it.
newGame();

let lastT = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);
