// The Corridor — bootstrap, input, and the frame loop. Loaded last.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ── error boundary ───────────────────────────────────────────────────────────
// Any uncaught error mid-year must not leave a stranger with a frozen or blank
// canvas. Stop the loop, draw a gentle in-fiction card, log the real error for
// us, and let R reload. Kept tiny and independent of game state — which may be
// the very thing that broke — and it never registers a second keydown listener
// (R-on-crash is handled at the top of the input handler below).
let crashed = false;
function drawCrashCard() {
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#191b16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d8cfb8';
  ctx.font = '26px Georgia, "Times New Roman", serif';
  ctx.fillText('The land slipped away.', canvas.width / 2, canvas.height / 2 - 14);
  ctx.fillStyle = '#8a8472';
  ctx.font = 'italic 15px Georgia, "Times New Roman", serif';
  ctx.fillText('Press R to return.', canvas.width / 2, canvas.height / 2 + 24);
}
function handleCrash(err) {
  if (crashed) return;
  crashed = true;
  try { console.error('[The Corridor] the year slipped:', err); } catch (_) {}
  try { drawCrashCard(); } catch (_) {}
}
window.addEventListener('error', (e) => handleCrash(e && (e.error || e.message)));
window.addEventListener('unhandledrejection', (e) => handleCrash(e && e.reason));

// ── input ────────────────────────────────────────────────────────────────────

// The effective key map is built from OPTIONS.bindings (9a: remappable, persisted
// separately from the run save) — arrows always stay as movement alternates.
let KEYMAP = {};
const SLOT_FOR = { up: 'up', down: 'down', left: 'left', right: 'right', map: 'sense', scent: 'scent', drink: 'drink' };
function rebuildKeymap() {
  KEYMAP = { arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right' };
  for (const action in OPTIONS.bindings) {
    const key = OPTIONS.bindings[action], slot = SLOT_FOR[action];
    if (key && slot) KEYMAP[key] = slot;
  }
}
loadOptions();
rebuildKeymap();

const HELD_SLOTS = { sense: 1, scent: 1, drink: 1 };   // the sustained-hold verbs (9b)
const REBIND_ACTIONS = ['up', 'down', 'left', 'right', 'map', 'scent', 'drink'];
const RESERVED_KEYS = ['r', 'm', 'h', 'f', 'escape', 'o'];
let optionsOpen = false;
let rebinding = null;   // the action awaiting a new key, while the options screen is up

function applyBinding(action, key) {
  if (!key || RESERVED_KEYS.includes(key)) return false;         // don't shadow a system key
  for (const a of REBIND_ACTIONS) if (a !== action && OPTIONS.bindings[a] === key) return false;  // no dupes
  OPTIONS.bindings[action] = key;
  saveOptions();
  rebuildKeymap();
  return true;
}
function handleOptionsKey(k) {
  if (rebinding) {                                   // capture the next key as the new binding
    if (k !== 'escape') applyBinding(rebinding, k);
    rebinding = null;
    return;
  }
  if (k === 'o' || k === 'escape') { optionsOpen = false; return; }
  const n = parseInt(k, 10);
  if (n >= 1 && n <= REBIND_ACTIONS.length) { rebinding = REBIND_ACTIONS[n - 1]; return; }
  if (k === 't') { OPTIONS.holdToggle = !OPTIONS.holdToggle; saveOptions(); return; }
  if (k === '-' || k === '_') { OPTIONS.textScale = Math.max(1, +(OPTIONS.textScale - 0.1).toFixed(2)); saveOptions(); return; }
  if (k === '=' || k === '+') { OPTIONS.textScale = Math.min(2, +(OPTIONS.textScale + 0.1).toFixed(2)); saveOptions(); return; }
}

window.addEventListener('keydown', (ev) => {
  const k = (ev.key || '').toLowerCase();
  // if the year has slipped, the only verb left is R — return to a clean start
  if (crashed) { if (k === 'r') { try { location.reload(); } catch (_) {} } return; }
  if (k === ' ' || k.startsWith('arrow')) ev.preventDefault();

  resumeAudio();   // the first gesture unlocks a suspended AudioContext (Safari/iOS/Chrome)

  // the options screen owns all input while it is up
  if (optionsOpen) { handleOptionsKey(k); return; }

  // ESC pauses the year; while paused, ANY key resumes (9e)
  if (gamePaused) { gamePaused = false; return; }
  if (k === 'escape') { togglePause(); return; }

  if (S && S.mode === 'intro') {
    if (k === 'o') { optionsOpen = true; return; }   // O opens options from the intro
    // R reclaims a year in progress; any other key lets it go and starts fresh
    if (k === 'r' && hasResumableSave()) { if (!loadGame()) { clearSave(); beginFromIntro(); } return; }
    clearSave();
    beginFromIntro();
    return;
  }

  // a held prologue vista lowers on any key — and that key does nothing else
  if (S && S.vistaWait && !ev.repeat) { releaseVista(); return; }

  if (k === 'r') { requestNewYear(); return; }
  if (k === 'm') { toggleMute(); return; }
  if (k === 'h' && S && S.tut && S.tut.taughtHelp
      && (S.mode === 'play' || S.mode === 'prologue')) { S.showHelp = !S.showHelp; return; }
  if (k === 'f' && S && (S.mode === 'play' || S.mode === 'prologue')) { togglePackStay(); return; }
  if (k === OPTIONS.bindings.map && !ev.repeat) toggleMap();  // press to open, press to close

  const slot = KEYMAP[k];
  if (slot) {
    // 9b: with hold-toggle on, a tap flips a sustained verb instead of holding it
    if (OPTIONS.holdToggle && HELD_SLOTS[slot]) input[slot] = !input[slot];
    else input[slot] = true;
  }
});

window.addEventListener('keyup', (ev) => {
  const slot = KEYMAP[(ev.key || '').toLowerCase()];
  if (slot) {
    if (OPTIONS.holdToggle && HELD_SLOTS[slot]) return;   // stays on until pressed again
    input[slot] = false;
  }
});

// clicking the raised map plans a route to a known place
canvas.addEventListener('click', (ev) => {
  resumeAudio();
  if (!S || (S.mode !== 'play' && S.mode !== 'prologue')) return;
  const wx = (ev.clientX - canvas.width / 2) / S.cam.scale + S.cam.x;
  const wy = (ev.clientY - canvas.height / 2) / S.cam.scale + S.cam.y;
  mapClick(wx, wy);
});

// right-click also toggles the map
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
canvas.addEventListener('mousedown', (ev) => { if (ev.button === 2) toggleMap(); });
window.addEventListener('blur', () => {
  input.up = input.down = input.left = input.right = input.sense = input.scent = input.drink = false;
});

// ── boot ─────────────────────────────────────────────────────────────────────

// A reload is a clean slate by default: the whole game starts over, prologue
// included. A save is never loaded at boot — but a year in progress can be
// reclaimed from the intro screen with R; any other key clears it.
// (newGame() runs in the boot gate at the bottom, unless this is a phone.)

// A phone visitor can't control a keyboard game — greet them kindly instead of
// handing them a canvas they can't play. Desktop is unaffected.
function isTouchOnly() {
  try {
    if (typeof window === 'undefined') return false;
    const mm = window.matchMedia;
    const noFine = !(mm && mm.call(window, '(pointer: fine)').matches);
    const touch = ('ontouchstart' in window)
      || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
    return !!touch && noFine;
  } catch (_) { return false; }
}
function drawMobileCard() {
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#191b16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d8cfb8';
  ctx.font = 'bold 30px Georgia, "Times New Roman", serif';
  ctx.fillText('THE CORRIDOR', canvas.width / 2, canvas.height / 2 - 40);
  ctx.font = 'italic 16px Georgia, "Times New Roman", serif';
  ctx.fillStyle = '#a29b86';
  ctx.fillText('The Corridor is a keyboard game.', canvas.width / 2, canvas.height / 2 + 12);
  ctx.fillText('Please visit on a computer to play.', canvas.width / 2, canvas.height / 2 + 38);
}

let lastT = 0;
let loadingCleared = false;
function frame(t) {
  if (crashed) return;   // the boundary has taken over; stop the loop cleanly
  try {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    update(dt);
    draw();
    // the game has painted a real frame — retire the pre-JS loading state
    if (!loadingCleared) {
      loadingCleared = true;
      const el = typeof document !== 'undefined' && document.getElementById && document.getElementById('loading');
      if (el) el.classList.add('hidden');
    }
  } catch (err) {
    handleCrash(err);
    return;   // do not reschedule — the card stands until R
  }
  requestAnimationFrame(frame);
}
// Boot gate: a keyboard-less phone gets the kind card; everyone else gets the game.
if (isTouchOnly()) {
  const el = typeof document !== 'undefined' && document.getElementById && document.getElementById('loading');
  if (el) el.classList.add('hidden');
  drawMobileCard();
  window.addEventListener('resize', drawMobileCard);
} else {
  newGame();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);
}
