// The Corridor — bootstrap, input, and the frame loop. Loaded last.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
if (canvas.style) canvas.style.touchAction = 'none';   // we own every touch — no browser scroll/zoom

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
  if (touchMode) return;   // touch handles its own taps (and a touch fires a synthetic click)
  resumeAudio();
  if (!S || (S.mode !== 'play' && S.mode !== 'prologue')) return;
  const wx = (ev.clientX - canvas.width / 2) / S.cam.scale + S.cam.x;
  const wy = (ev.clientY - canvas.height / 2) / S.cam.scale + S.cam.y;
  mapClick(wx, wy);
});

// ── touch input (keyboard-less devices) ──────────────────────────────────────
// A movement pad (lower-right) drives the four direction inputs — including
// diagonals — and a column of action buttons (left) drives the held verbs and
// the map/wait toggles. Each finger is tracked by its identifier so a player can
// steer with one thumb while smelling with the other. Geometry comes from
// touchLayout() (render.js) so hit-tests match exactly what is drawn.
var touchState = { joyId: null, joyDX: 0, joyDY: 0, btn: {} };

function clearMoveInput() { input.up = input.down = input.left = input.right = false; }

function updateJoy(px, py, L) {
  let dx = px - L.pad.x, dy = py - L.pad.y;
  const mag = Math.hypot(dx, dy) || 0.0001;
  if (mag > L.pad.r) { dx = dx / mag * L.pad.r; dy = dy / mag * L.pad.r; }   // clamp the knob to the ring
  touchState.joyDX = dx; touchState.joyDY = dy;
  const dead = L.pad.r * 0.28, t = L.pad.r * 0.22;
  if (mag < dead) { clearMoveInput(); return; }
  input.left = dx < -t; input.right = dx > t;   // per-axis thresholds give 8-way movement
  input.up = dy < -t; input.down = dy > t;
}

function pressTouchButton(name) {
  if (name === 'scent') input.scent = true;
  else if (name === 'drink') input.drink = true;
  else if (name === 'map') { toggleMap(); input.sense = true; }   // mirrors the map key: toggles, and holds for the beat-9 vigil
  else if (name === 'wait') togglePackStay();
}
function releaseTouchButton(name) {
  if (name === 'scent') input.scent = false;
  else if (name === 'drink') input.drink = false;
  else if (name === 'map') input.sense = false;
}

function classifyTouch(px, py, L) {
  if (Math.hypot(px - L.pad.x, py - L.pad.y) <= L.pad.r * 1.3) return { zone: 'move' };
  for (const b of L.btns) {
    if (b.enabled && Math.hypot(px - b.x, py - b.y) <= b.r * 1.25) return { zone: 'btn', btn: b };
  }
  return { zone: 'world' };
}

canvas.addEventListener('touchstart', (ev) => {
  resumeAudio();
  ev.preventDefault();
  if (crashed) { try { location.reload(); } catch (_) {} return; }
  // full-screen "any key" moments: a single tap advances them, and nothing else
  if (S && S.mode === 'intro') {
    if (hasResumableSave() && loadGame()) return;
    clearSave(); beginFromIntro(); return;
  }
  if (typeof gamePaused !== 'undefined' && gamePaused) { gamePaused = false; return; }
  if (S && S.vistaWait) { releaseVista(); return; }
  const L = touchLayout();
  for (const t of ev.changedTouches) {
    const c = classifyTouch(t.clientX, t.clientY, L);
    if (c.zone === 'move') { touchState.joyId = t.identifier; updateJoy(t.clientX, t.clientY, L); }
    else if (c.zone === 'btn') { touchState.btn[c.btn.name] = t.identifier; pressTouchButton(c.btn.name); }
    else if (S && S.senseBlend > 0.5) {   // a tap on the raised map plans a route
      const wx = (t.clientX - canvas.width / 2) / S.cam.scale + S.cam.x;
      const wy = (t.clientY - canvas.height / 2) / S.cam.scale + S.cam.y;
      mapClick(wx, wy);
    }
  }
}, { passive: false });

canvas.addEventListener('touchmove', (ev) => {
  if (touchState.joyId === null) return;
  const L = touchLayout();
  for (const t of ev.changedTouches) {
    if (t.identifier === touchState.joyId) { updateJoy(t.clientX, t.clientY, L); ev.preventDefault(); }
  }
}, { passive: false });

function endTouches(ev) {
  for (const t of ev.changedTouches) {
    if (t.identifier === touchState.joyId) { touchState.joyId = null; touchState.joyDX = touchState.joyDY = 0; clearMoveInput(); }
    for (const name in touchState.btn) {
      if (touchState.btn[name] === t.identifier) { releaseTouchButton(name); delete touchState.btn[name]; }
    }
  }
}
canvas.addEventListener('touchend', endTouches);
canvas.addEventListener('touchcancel', endTouches);

// right-click also toggles the map
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
canvas.addEventListener('mousedown', (ev) => { if (ev.button === 2) toggleMap(); });
window.addEventListener('blur', () => {
  input.up = input.down = input.left = input.right = input.sense = input.scent = input.drink = false;
});

// Leaving the tab mutes the land (its constant ambience shouldn't play into a
// tab you've walked away from); returning reopens the valve — unless you had
// muted by hand, which setTabHidden preserves. visibilitychange is the reliable
// signal; blur/focus back it up for browsers that fire it late.
function goHidden() { if (typeof setTabHidden === 'function') setTabHidden(true); }
function goVisible() { if (typeof setTabHidden === 'function') setTabHidden(false); }
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) goHidden(); else goVisible();
  });
}
window.addEventListener('blur', goHidden);
window.addEventListener('focus', goVisible);

// ── boot ─────────────────────────────────────────────────────────────────────

// A reload is a clean slate by default: the whole game starts over, prologue
// included. A save is never loaded at boot — but a year in progress can be
// reclaimed from the intro screen with R (or a tap, on touch); any other key
// clears it. (newGame() runs in the boot at the bottom.)

// A keyboard-less visitor (phone/tablet) still gets the game — with on-screen
// controls (touchMode) instead of a keyboard. A device with a fine pointer keeps
// the keyboard game untouched.
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
// Boot: everyone gets the game. A keyboard-less device runs in touchMode, which
// turns on the on-screen controls and swaps teaching text over to button names.
touchMode = isTouchOnly();
newGame();
if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);
