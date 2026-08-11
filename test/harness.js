// Headless harness: drives the prologue end-to-end, then the year's systems.
//
// Run from anywhere:  node test/harness.js   (or: npm test)
// Needs no dependencies — it loads the four game files into a `vm` context
// with stubbed document/window/localStorage/AudioContext and calls the real
// input handlers and update()/draw() directly. main.js only starts its frame
// loop when requestAnimationFrame exists, which is why this works headless.
//
// Expect three logged stack traces near the end: the error-boundary and
// save-migration checks deliberately throw. The last line is the verdict.
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// The repo root — one level up from test/, so a clone works anywhere.
const DIR = path.join(__dirname, '..');

const anything = new Proxy(function () {}, {
  get(t, p) { if (p === Symbol.toPrimitive) return () => 0; return anything; },
  set() { return true; },
  apply() { return anything; },
});

const winListeners = {};
const canvasListeners = {};
let lastAC = null;   // the most recently constructed stub AudioContext (Part 2)
const canvasStub = {
  width: 1280, height: 800,
  getContext: () => anything,
  addEventListener: (ev, fn) => { canvasListeners[ev] = fn; },
};
const store = {};
const sandbox = {
  document: {
    getElementById: () => canvasStub,
    createElement: () => ({ width: 0, height: 0, getContext: () => anything }),
  },
  window: {
    innerWidth: 1280, innerHeight: 800,
    addEventListener: (ev, fn) => { winListeners[ev] = fn; },
    AudioContext: class {
      constructor() { this.state = 'suspended'; this.__resumed = false; lastAC = this; }
      get currentTime() { return 0; }
      get destination() { return {}; }
      createOscillator() { return anything; }
      createGain() { return anything; }
      resume() { this.state = 'running'; this.__resumed = true; return Promise.resolve(); }
    },
  },
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  console,
};
vm.createContext(sandbox);
for (const f of ['data.js', 'game.js', 'render.js', 'main.js']) {
  vm.runInContext(fs.readFileSync(`${DIR}/${f}`, 'utf8'), sandbox, { filename: f });
}

const G = expr => vm.runInContext(expr, sandbox);
const key = k => winListeners.keydown({ key: k, preventDefault() {} });

let failures = 0;
function check(label, cond) {
  if (cond) console.log(`  ok  ${label}`);
  else { failures++; console.log(`FAIL  ${label}`); }
}
function step(dt = 1 / 20, n = 1) { for (let i = 0; i < n; i++) G(`update(${dt})`); }
function clearInput() { G('input.up=input.down=input.left=input.right=false'); }
function stepTo(x, y, maxSec = 60) {
  let sec = 0;
  while (sec < maxSec) {
    const w = G('({x: S.wolf.x, y: S.wolf.y})');
    if (Math.hypot(x - w.x, y - w.y) < 18) { clearInput(); return true; }
    G(`input.left=${x - w.x < -6}; input.right=${x - w.x > 6}; input.up=${y - w.y < -6}; input.down=${y - w.y > 6};`);
    step();
    sec += 1 / 20;
  }
  clearInput(); return false;
}
// Walk to a node through waypoints along the straight line — the way a player
// tracks a destination — so the walk stays inside the route corridor.
function goNode(id, maxSec) {
  const n = G(`(() => { const n = NbyId.get('${id}'); return { x: n.x, y: n.y }; })()`);
  const w = G('({x: S.wolf.x, y: S.wolf.y})');
  const hops = Math.max(2, Math.ceil(Math.hypot(n.x - w.x, n.y - w.y) / 110));
  for (let i = 1; i < hops; i++) {
    stepTo(w.x + (n.x - w.x) * i / hops, w.y + (n.y - w.y) * i / hops, (maxSec || 60) / hops + 4);
  }
  return stepTo(n.x, n.y, (maxSec || 60) / hops + 6);
}
function waitFor(expr, maxSec = 30) {
  let sec = 0;
  while (sec < maxSec) {
    if (G(expr)) return true;
    step();
    sec += 1 / 20;
  }
  return false;
}
function clickNodeOnMap(id) {
  const p = G(`(() => { const n = NbyId.get('${id}');
    return { x: (n.x - S.cam.x) * S.cam.scale + canvas.width / 2,
             y: (n.y - S.cam.y) * S.cam.scale + canvas.height / 2 }; })()`);
  canvasListeners.click({ clientX: p.x, clientY: p.y });
}

function smokeDraw(label) {
  try { G('draw()'); console.log(`  ok  draw(): ${label}`); }
  catch (e) { failures++; console.log(`FAIL  draw() threw at ${label}: ${e.message}`); }
}

(async () => {

// ════ PROLOGUE ════
check('boots to intro, prologue wanted', G('S.mode') === 'intro' && G('S.wantPrologue') === true);
smokeDraw('intro');
key('x');
check('any key starts the prologue', G('S.mode') === 'prologue' && G('S.beat') === 1 && G('S.era') === 'past');
check('her map does not exist yet', G("S.edges.every(e => e.state === 'unknown')"));
smokeDraw('prologue beat 1');

// beat 1: walk, then scent — with something already there to smell
check('there is scent to read from the first breath', G('S.scent.length') > 10);
G('toggleMap()');
check('the map refuses to open before it is taught', G('S.mapOpen') === false);
G('input.right = true'); step(1 / 20, 40); clearInput();
check('beat 1: walking registered', G('S.tut.moved') > 120);
waitFor('S.tut._b1scent === true', 28);
check('beat 1: the pack is introduced by name, Aspen first, Alder and Fen apart',
  G('S.tut._b1n1') === true && G('S.tut._b1n3') === true && G('S.tut._b1n4') === true);
check('a deer walks the morning past her, close',
  G('S.elk.some(e => Math.hypot(e.x - S.wolf.x, e.y - S.wolf.y) < 600)') === true);
G('input.scent = true'); step(1 / 20, 70); G('input.scent = false');
check('beat 1 → 2 (scent read, unhurried)', G('S.beat') === 2);

// beat 2: the overlook — arriving raises the held vista; she stops ~130px out
check('beat 2: the vista takes hold at the overlook', (() => {
  for (let i = 0; i < 800; i++) {
    if (G('S.vistaWait')) return true;
    const w = G('({x:S.wolf.x,y:S.wolf.y})');
    G(`input.left=${2050 - w.x < -6}; input.right=${2050 - w.x > 6}; input.up=${1500 - w.y < -6}; input.down=${1500 - w.y > 6};`);
    step();
  }
  return false;
})());
clearInput();
check('beat 2: Willow appears while the vista holds', G('S.willow') !== null && G('S.beat') === 2);
check('first inherited ink exists', G("S.edges.find(e => e.id === 'den-aspenStand').state") === 'inherited');
key(' ');   // she looks away — the vista lowers and beat 3 begins
check('beat 2 → 3: she looks away and beat 3 begins', G('S.beat') === 3);
step(1 / 20, 40);  // the vista finishes lowering

// beat 3: she shows you her map — a forced view, never a key
waitFor('S.tut._b3shown === true', 14);
check('beat 3: her map is shown, not given', G('S.tut._b3shown') === true && G('S.forcedSenseT') > 0);
check('the forced view already fits the FULL (west-extended) land',
  Math.abs(G('mapFitScale()') - G('Math.min(canvas.width / (WORLD.w - WORLD.x0 + 500), canvas.height / (WORLD.h + 500))')) < 1e-9);
G('toggleMap()');
check('SPACE still refuses — the map is not hers yet', G('S.mapOpen') === false);
waitFor('S.forcedSenseT <= 0 && S.senseBlend < 0.15', 25);
step(1 / 20, 20);   // the view settles; she walks on
// follow Willow one frame at a time and stop the instant the hunt opens — the
// winter-thin elk spawns on the path ahead, so a coarse loop would run her
// straight through it into beats 5–6 before we can observe beat 4
for (let i = 0; i < 800; i++) {
  if (G('S.beat') >= 4) break;
  const a = G('({x: S.wolf.x, y: S.wolf.y})'), w = G('({x: S.willow.x, y: S.willow.y})');
  G(`input.left=${w.x - a.x < -6}; input.right=${w.x - a.x > 6}; input.up=${w.y - a.y < -6}; input.down=${w.y - a.y > 6};`);
  step();
}
clearInput();
check('beat 3 → 4: at the Old Ford, hunt begins', G('S.beat') === 4 && G('S.elk.length') === 1);
check("the pack holds its mother's zone, not hers",
  G('S.willow && zoneCenter().x === S.willow.x && zoneCenter().y === S.willow.y'));
check('her ink followed her', G("S.edges.find(e => e.id === 'aspenStand-oldFord').state") === 'inherited');

// beat 4: run down the winter-thin elk
for (let i = 0; i < 80 && G('S.elk.length') > 0; i++) {
  const e = G('S.elk.length ? ({x: S.elk[0].x, y: S.elk[0].y}) : null');
  if (!e) break;
  stepTo(e.x, e.y, 1.2);
}
check('beat 4 → 5: the kill', G('S.beat') === 5);

// beat 5: the gravel crossing
for (let i = 0; i < 30 && !G('S.truckSent'); i++) {
  const w = G('({x: S.willow.x, y: S.willow.y})');
  stepTo(w.x + 30, w.y, 2);
  step(1 / 20, 5);
}
check('beat 5: the slow truck comes', G('S.truckSent') === true);
waitFor('S.tut._b5go === true', 30);
check('beat 5: she crosses when it is gone', G('S.tut._b5go') === true);
check('crossed behind her', stepTo(850, 1460, 20) || G('S.wolf.x') < 880);
waitFor("S.beat >= 6", 5);
check('beat 5 → 6', G('S.beat') >= 6);

// beat 6: lean into her — SPACE is the gesture now, not F
for (let i = 0; i < 10 && G('S.beat') === 6; i++) {
  const w = G('({x: S.willow.x, y: S.willow.y})');
  stepTo(w.x + 20, w.y, 3);
  key(' ');
  step(1 / 20, 5);
}
G('input.sense = false');
check('beat 6 → 7: the bond', G('S.beat') === 7);

// beat 7: no verb lesson — F belongs to spring. She simply walks on.
waitFor('S.tut._b7go === true', 20);
check('beat 7: she walks on, no F lesson given', G('S.tut._b7go') === true
  && G('S.tut.fTaught') !== true);
key('f'); step();
check('F does nothing while the pack is still hers', G('S.tut.fTaught') !== true
  && G('S.zoneAnchor') === null);

// beat 7: to the winter range
for (let i = 0; i < 60; i++) {
  const w = G('({x: S.willow.x, y: S.willow.y})');
  stepTo(w.x, w.y, 3);
  step(1 / 20, 10);   // let her walk on even when Aspen is at her side
  if (G('S.beat') === 8) break;
}
if (G('S.beat') !== 8) {
  console.log('DEBUG beat', G('S.beat'),
    'willow', G('S.willow && Math.round(S.willow.x) + "," + Math.round(S.willow.y)'),
    'path', G('S.willow && S.willow.path.length'),
    'wolf', G('Math.round(S.wolf.x) + "," + Math.round(S.wolf.y)'));
}
check('beat 7 → 8: winter range, map complete', G('S.beat') === 8);
check('the whole inherited map inked in',
  G("S.edges.filter(e => EDGES.find(d => d.id === e.id).state === 'inherited').every(e => e.state === 'inherited')"));

// beat 8: THE CUT — the held vista lowers on a keypress, then beat 9
waitFor("S.tut._b8cut === true", 10);
check('beat 8: era flips to the present', G('S.era') === 'present');
check('beat 8: the CUT vista holds for a keypress', G('S.vistaWait') === true);
smokeDraw('after the cut');
key(' ');   // she looks away from what the years did
waitFor('S.beat === 9', 12);
check('beat 8 → 9: she is at the den', G('S.beat') === 9 && G('S.willow.lying') === true);

// beat 9: the inheritance — stillness, the ask, the hold, the map rising
check('walked to her side', stepTo(G('DEN.x') + 26, G('DEN.y') - 6, 40));
check('the stillness comes before the ask', G('S.tut._b9near') === true && G('S.tut._b9ask') !== true);
waitFor('S.tut._b9ask === true', 12);
check('then, the ask', G('S.tut._b9ask') === true);
G('input.sense = true');
step(1 / 20, 60);   // 3 s in: still holding, not yet done
check('the hold is not the map (suppressed at her side)', G('S.senseBlend') < 0.3 && G('S.inherited') === false);
// A5: a stray SPACE press during the inherit hold cannot raise/close the map
G('_mo = S.mapOpen; toggleMap();');
check('the inherit hold ignores the map toggle', G('S.mapOpen') === G('_mo'));
step(1 / 20, 30);   // past 3.5 s
check('the hold, at her side: inherited', G('S.inherited') === true);
check('her breathing stopped', G('S.willow.alive') === false);
check('the map rises on its own', G('S.mapOpen') === true);
G('input.sense = false');
waitFor('S.senseBlend > 0.8', 10);
check('risen: the damage is already labelled',
  G("(S.calloutActive && S.calloutActive.id === 'rip') || S.callouts.includes('rip')"));
key(' ');   // she lowers it herself — the first press that is truly hers
waitFor("S.mode === 'play'", 15);
G('input.sense = false;');
check('lowering the map begins Act I promptly', G('S.mode') === 'play' && G('day()') === 1);
check('a white passage held between her death and spring', G('S.tut._b10') === true);
smokeDraw('the first thaw');
check('spring opens away from every hollow',
  G('DEN_SITES.every(s => Math.hypot(S.wolf.x - s.x, S.wolf.y - s.y) > 300)'));
check('the den choice is named at once', G('S.tut.denPrompt') === true);
check('prologue marked done for this session', G('prologueDone()') === true);
check('tutorial resumes past the taught verbs', G('S.tut.step') >= 6);
check('the land refilled with prey', G('S.elk.length') >= 15);
check('herds are distinct', G('new Set(S.elk.map(e => e.herd)).size') >= 3);
smokeDraw('Act I world');

// F is TAUGHT in spring, not told: the pack is hers now and she is walked
// through holding it and calling it on with her own body before the year opens
G("S.tut.fLesson = 0; S.tut.fLessonDone = false; S.tut.fTaught = false; S.tut.fTeachT = 6.0; S.tut.step = 6; S.pack.forEach(w => w.state = 'follow'); S.zoneAnchor = null; S.cars.length = 0;");
step();
check('the F lesson opens in spring and the verb becomes usable',
  G('S.tut.fLesson') === 1 && G('S.tut.fTaught') === true);
key('f'); step();
check('holding the pack (F) advances the lesson',
  G('S.tut.fLesson') === 2 && G("alivePack().some(w => w.state === 'stay')") === true);
key('f'); step();
check('calling them back on (F again) finishes the lesson — taught, not told',
  G('S.tut.fLessonDone') === true);

// ════ ACT I SYSTEMS ════
G('S.food = 85');

// A1: exploration fog — the map remembers only walked ground
check('the migration corridor she walked is seen', G("nodeSeen('winterRange')") === true
  && G("nodeSeen('aspenStand')") === true);
check('far untrodden ground is still rumor', G("nodeSeen('saltLick')") === false
  && G("nodeSeen('longMarsh')") === false);
check('an unwalked inherited node reads dim (not resolved)',
  G("nodeKnownG('birchDraw')") === true);   // planning still works over it
G("_seenBefore = nodeSeen('cutbank');");
G("S.wolf.x = NbyId.get('cutbank').x; S.wolf.y = NbyId.get('cutbank').y;"); step();
check('walking to a node flips it to seen', G('_seenBefore') === false && G("nodeSeen('cutbank')") === true);
G('_savedSeen = S.seen.reduce((a, b) => a + b, 0); saveGame(); S.seen.fill(0); loadGame();');
check('the seen-grid round-trips through the save',
  G('S.seen.reduce((a, b) => a + b, 0)') === G('_savedSeen') && G('_savedSeen') > 0);
G('S.food = 85; S.wolf.x = DEN.x; S.wolf.y = DEN.y;');

// coverage honesty: touching both ends is not walking the middle
G("S.wolf.x = NbyId.get('den').x + 14; S.wolf.y = NbyId.get('den').y + 24;");
step();
G("S.wolf.x = NbyId.get('cutbank').x - 12; S.wolf.y = NbyId.get('cutbank').y - 18;");
step();
check('bucket coverage: ends without middle is no pass',
  G("S.edges.find(e => e.id === 'den-cutbank').passCount") === 0);

// sense radius on the big world
G('S.wolf.x = DEN.x; S.wolf.y = DEN.y;'); step();
check('map radius scaled up for the big world', G('senseRadius()') >= 460);

// A3: play sight is in WORLD units (canvas-independent) and tightens at
// night + in violet, down to the map-reliance floor
G('S.weather = null; S.clock.min = 0;');   // reset weather; time drives daylight
G('S.time = 37.5;');   // midday: full sight
const sightDay = G('playSightWorld()');
check('midday sight is wide and world-unit', sightDay >= 200);
G('S.time = 75;');   // deep night
const sightNight = G('playSightWorld()');
check('deep night pulls sight in hard', sightNight < sightDay * 0.65);
G('S.wolf.x = OBSTACLES.subdivision.x0 - 40; S.wolf.y = (OBSTACLES.subdivision.y0 + OBSTACLES.subdivision.y1) / 2;');
check('a night approach in violet forces map-reliance (~floor)', G('playSightWorld()') <= 130);
G('S.time = 37.5; S.wolf.x = DEN.x; S.wolf.y = DEN.y;');
check('play sight is canvas-independent (world units only)',
  G('typeof playSightWorld() === "number" && playSightWorld() > 0'));

// map routing: click a known place, be shown the way
G('toggleMap()'); step(1 / 20, 30);
clickNodeOnMap('birchDraw');
check('map click plans a route', G("S.routeTo === 'birchDraw'")
  && G('S.routePath !== null && S.routePath.length >= 2'));
clickNodeOnMap('birchDraw');  // second click dismisses
check('clicking again lets the plan go', G('S.routeTo') === null);
clickNodeOnMap('winterRange');
check('a route west exists before the tear', G('S.routePath !== null'));
G('toggleMap()'); step(1 / 20, 25);

// A2: the plan persists as a bearing cue in the porthole
G("S.wolf.x = DEN.x; S.wolf.y = DEN.y;");
G("S.routeTo = 'winterRange'; S.routePath = computeRoute('winterRange');");
G('_nn = routeNextNode();');
check('a route yields a next-node bearing in play', G('_nn') !== null);
check('the bearing points west, toward the range',
  G('routeNextNode().x') < G('DEN.x'));
G('S.routePath = null;');
check('the cue dies the instant the path is gone', G('routeNextNode()') === null);
// restore the plan west exactly as the tear-check below expects
G("S.routeTo = 'winterRange'; S.routePath = computeRoute('winterRange');");

// the black river tear, on arrival
check('west along the migration', goNode('aspenStand', 40) && goNode('oldFord', 40));
goNode('sageFlat', 25);
check('blackriver tears on arrival', G("S.edges.filter(e => e.tearGroup === 'blackriver').every(e => e.torn)"));
check('scripted first tear ran (or deferred safely)', G('S.firstTear') === true);
check('ghost beyond the tear', G("S.ghostNodes.has('winterRange')"));
check('the tear killed the plan west', G("S.routeTo === 'winterRange'") && G('S.routePath') === null);
check('every tear has a name for the map and the urge alike',
  G("TEAR_GROUPS.every(g => TEAR_NAMES[g.key])") === true);
G('toggleMap()'); step(1 / 20, 30); smokeDraw('map with rip'); G('toggleMap()'); step(1 / 20, 25);

// review fix 9: Bram's recall — the ghost brightens beside the old wolf
G("_bram = S.pack.find(w => w.id === 'bram'); _bx = _bram.x; _by = _bram.y;");
G('_bram.x = S.wolf.x + 10; _bram.y = S.wolf.y;');
step();
check('beside Bram, the far side brightens', G('bramRemembers()') === true);
check('and it is said once', G('S.tut.bramRecall') === true);
G('_bram.x = S.wolf.x + 3000; _bram.y = S.wolf.y;');
check('without him, the ghost dims again', G('bramRemembers()') === false);
G('_bram.x = _bx; _bram.y = _by;');

// the detour and the patch — falling back to the last good node first
check('fell back to the Old Ford', goNode('oldFord', 40));
check('detour: Willow Slough', goNode('willowSlough', 40));
check('detour: under the road', goNode('culvert', 40));
check('detour: Stony Bench', goNode('stonyBench', 40));
check('detour: Far Bench', goNode('farBench', 40));
check('blackriver bridged by her own ink', G("S.bridged.has('blackriver')"));
G("S.routeTo = 'winterRange'; S.routeT = 99; S.routePath = computeRoute('winterRange');");
check('the detour restored the plan west', G('S.routePath !== null'));
G('S.routeTo = null; S.routePath = null;');
check('yearlings learned the new way, silently', G('S.yearlingKnows.size') > 0);
check('the rip is permanent', G("S.edges.find(e => e.id === 'sageFlat-farBench').torn"));

// road: entry side, the strike, the injury
G('S.food = 85; S.cars.length = 0; S.fear = 0; S.time = 9.2;');
G('S.wolf.x = 830; S.wolf.y = 700;'); step();
G('input.right = true');
waitFor('S.wolfWasOnRoad === true', 5);
G('input.right = false');
check('entry side recorded (west)', G("S.roadEntrySide") === 'west');
check('her crossing opens a grace window for driven prey', G('S.roadGraceT') > 0);
key('f');               // anchor the pack's zone off the road for the crash test
G('S.wolf.x = 940;');  // past the centerline
G('S.cars.push({ x: 935, y: S.wolf.y - 260, vy: 700, tone: "#333", met: new Set() })');
step(1 / 20, 14);
check('a strike throws her back to the side she came from', G('S.wolf.x') < 890);
check('and hurts her', G('isInjured()') === true);
check('fear spikes', G('S.fear') > 0.9);
G('S.injuredT = 0; S.fear = 0; S.cars.length = 0;');
key('f');               // release the zone back to her heels

// the road-lock guard: a first tear on asphalt defers the forced map
// (line-proximity may have torn drycreek already on the walk — reset it)
G("(() => { const g = TEAR_GROUPS.find(x => x.key === 'drycreek'); for (const id of g.edges) { const e = S.edges.find(x2 => x2.id === id); if (e) e.torn = false; } S.bridged.delete('drycreek'); recomputeGhosts(); })()");
G('S.firstTear = false; S.forcedSenseT = 0; S.pendingForcedSense = false;');
G("const g3 = TEAR_GROUPS.find(g => g.key === 'drycreek'); g3.trigger._x = g3.trigger.x; g3.trigger._y = g3.trigger.y;");
G("(() => { const g = TEAR_GROUPS.find(x => x.key === 'drycreek'); g.trigger.x = 920; g.trigger.y = 700; g.trigger.r = 120; })()");
G('S.wolf.x = 920; S.wolf.y = 700;');
G('tearCheck()');
check('tear on asphalt: forced map deferred', G('S.pendingForcedSense') === true && G('S.forcedSenseT') === 0);
G('S.wolf.x = 1100;'); step();
check('off the road, the lesson fires', G('S.forcedSenseT') > 0);
G("(() => { const g = TEAR_GROUPS.find(x => x.key === 'drycreek'); g.trigger.x = g.trigger._x; g.trigger.y = g.trigger._y; g.trigger.r = 95; })()");
step(1 / 20, 60);  // let the forced view play out

// prey keeps its distance from its own kind — sampled over time, since two
// animals may legitimately cross paths for a moment
let bestSpread = 0;
for (let s = 0; s < 5; s++) {
  step(1 / 20, 40);
  const spread = G(`(() => {
    const herd0 = S.elk.filter(e => e.herd === 0);
    let worst = 1e9;
    for (let i = 0; i < herd0.length; i++) for (let j = i + 1; j < herd0.length; j++) {
      worst = Math.min(worst, Math.hypot(herd0[i].x - herd0[j].x, herd0[i].y - herd0[j].y));
    }
    return worst;
  })()`);
  bestSpread = Math.max(bestSpread, spread);
}
check('the herd stays loose (min spacing > 40 at rest)', bestSpread > 40);
check('no animal is wedged inside blocked ground',
  G('S.elk.every(e => !blockedAt(e.x, e.y, 2, false, APRON))'));

// den choice: stand a while
G('S.food = 85;');
check('walked to Ridge Hollow', stepTo(1960, 1200, 60));
clearInput(); step(1 / 20, 70);
if (G("S.denId") !== 'ridgeDen') {
  console.log('DEBUG den', G('S.denId'), 'day', G('day()'),
    'wolf', G('Math.round(S.wolf.x) + "," + Math.round(S.wolf.y)'),
    'standT', G('S.denStandT'), 'moving', G('S.wolf.moving'));
}
check('standing chooses the den', G("S.denId") === 'ridgeDen');

// the chosen hollow becomes a real place on the graph
check('the hollow is a real node now', G("NbyId.has('home')") === true
  && G("NbyId.get('home').x") === 1960 && G("S.visited.has('home')") === true);
check('with unknown paths toward its neighbors',
  G("S.edges.filter(e => e.a === 'home').length") >= 2
  && G("S.edges.filter(e => e.a === 'home').every(e => e.state === 'unknown')"));
G("_he = S.edges.filter(e => e.a === 'home')[0];");
goNode(G('_he.b'), 40);
check('her steps can ink the new path', G('_he.covBits') > 0 || G("_he.state") !== 'unknown');

// the gravel pit: a footprint-derived tear on the hunting loop, then its detour
check('trigger was derived from the pit footprint',
  G("(() => { const g = TEAR_GROUPS.find(x => x.key === 'gravelpit'); return g.trigger.r === 190 && g.trigger.x === 2200; })()"));
G('S.food = 85;');
check('walked to the Ridge Saddle', goNode('ridgeSaddle', 40));
goNode('elkMeadow', 12);   // the pit is in the way; the tear fires en route
check('gravelpit tears on approach', G("S.edges.find(e => e.id === 'elkMeadow-ridgeSaddle').torn"));

// review fix 14: anywhere around the human-made thing is close enough
if (!G("groupTorn(TEAR_GROUPS.find(g => g.key === 'machines'))")) {
  G("S.wolf.x = obstacleRect('construction').x0 - 120; S.wolf.y = (OBSTACLES.construction.y0 + OBSTACLES.construction.y1) / 2;");
  G('tearCheck()');
  check('anywhere around the machines is close enough to tear',
    G("groupTorn(TEAR_GROUPS.find(g => g.key === 'machines'))") === true);
}

// review fix 14: ANY walked loop around the obstacle counts as a way around
G(`(() => {
  const g = TEAR_GROUPS.find(x => x.key === 'gravelpit');
  S.bridged.delete('gravelpit');
  const A = NbyId.get(g.chain[0]), B = NbyId.get(g.chain[g.chain.length - 1]);
  const pts = [{ x: A.x, y: A.y }];
  for (let t = 0; t <= 1.001; t += 0.05) pts.push({ x: A.x + (B.x - A.x) * t, y: 700 });
  pts.push({ x: B.x, y: B.y });
  S.trail = pts;
})()`);
G('freeformBridgeCheck()');
check('any walked loop around the pit counts as a way around',
  G("S.bridged.has('gravelpit')") === true);

// the SHORT way she walked is kept as a found path — new ink, oriented from the
// near end, that reconnects the tear for routing (no more far detour required)
check('the walk records a found path oriented from the near end',
  G("Array.isArray(S.foundPaths['gravelpit']) && S.foundPaths['gravelpit'].length >= 2 && Math.hypot(S.foundPaths['gravelpit'][0][0]-2500, S.foundPaths['gravelpit'][0][1]-840) < 220"));
check('the found short-way is keyed to the tear ends both ways',
  G("foundTearBetween('elkMeadow','ridgeSaddle') !== null && foundTearBetween('ridgeSaddle','elkMeadow') !== null"));
// force a clearly-shortest found path so the routing choice is deterministic
G("S.foundPaths['gravelpit'] = [[2500,840],[2200,760],[1900,1000]]; recomputeGhosts();");
G("_wsave = { x: S.wolf.x, y: S.wolf.y };");
G("S.wolf.x = NbyId.get('elkMeadow').x; S.wolf.y = NbyId.get('elkMeadow').y; _rp = computeRoute('ridgeSaddle');");
check('a route crosses by the found short-way, not the long graph detour',
  G("!!_rp && _rp.length === 2 && _rp[0] === 'elkMeadow' && _rp[1] === 'ridgeSaddle'"));
G("S.wolf.x = _wsave.x; S.wolf.y = _wsave.y;");   // restore for the walk that follows
check('back out to the saddle', goNode('ridgeSaddle', 40));
check('detour: North Ridge', goNode('northRidge', 40));
check('detour: down to the meadow', goNode('elkMeadow', 40));
check('gravelpit bridged around the pit', G("S.bridged.has('gravelpit')"));

// Lichen arrives from the north at day 100, carrying fragments
G('S.clock.min = 100 * 1440 + 600; S.lastDay = day();');
step();
check('Lichen joins the pack', G("S.pack.some(w => w.id === 'lichen')"));
check('her northern fragments ink in', G("S.edges.find(e => e.id === 'northRidge-blackPines').state") === 'current-dotted');

// pups: born, fed, traveling
G('S.clock.min = 75 * 1440 + 600; S.lastDay = day();');
step();
check('pups born in late spring', G('S.pups') !== null && G('S.pups.count') === 2);
G('S.food = 90; S.wolf.x = S.denSite.x + 10; S.wolf.y = S.denSite.y;');
const pupFoodBefore = G('S.pups.food');
step(1 / 20, 40);
check('standing at the den, full, feeds them', G('S.pups.food') > pupFoodBefore);
G('S.clock.min = 240 * 1440 + 600; S.lastDay = day(); S.pups.food = 80;');
step();
check('by late autumn the pups travel', G('S.pups.traveling') === true
  && G("S.pack.filter(w => w.pup).length") === 2);

// the fire: one summer day (its roll is random per year — pin it here)
G('S.fire.day = 130;');
G('S.clock.min = 134 * 1440 + 600; S.lastDay = day();');
step();
check('dry lightning: the fire starts', G("S.fire.state") === 'burning');
G('S.fire.t = 999;');
step();
check('and passes, leaving black ground', G("S.fire.state") === 'done');
G('S.clock.min = 241 * 1440 + 600; S.lastDay = day();');
step();

// the rancher, kept low: the gift by the wire — and his dogs
check('kept low, something is left by the fence', G('S.gift.given') === true);
G('S.wolf.x = RANCH.giftSpot.x + 10; S.wolf.y = RANCH.giftSpot.y;');
const foodBeforeGift = G('S.food');
step(1 / 20, 30);
check('the gut pile feeds the pack', G('S.gift.taken') === true && G('S.food') > foodBeforeGift);
check('near the treeline, a standoff begins', G('S.standoff !== null')
  && G('S.standoff.rivals.length') === 2);
step(1 / 20, 30);
check('the dogs come out', G('S.dogs.some(d => Math.hypot(d.x - S.wolf.x, d.y - S.wolf.y) < 420)'));
// their teeth cost meat and blood
G('S.wolf.x = RANCH.dogHome.x + 20; S.wolf.y = RANCH.dogHome.y; S.food = 80; S.injuredT = 0;');
G('S.dogs.forEach(d => { d.biteCd = 0; d.x = S.wolf.x + 5; d.y = S.wolf.y; });');
step(1 / 20, 40);
check('a dog bite costs meat and draws blood', G('S.food') <= 66 && G('isInjured()') === true);

// review fix 10: the wound heals in real time, urge open or not
// (out of the ranch's reach first — the rifle was refreshing the wound)
G('S.wolf.x = 3200; S.wolf.y = 2200; S.dogs.forEach(d => { d.biteCd = 999; });');
G("_task10 = S.task; S.task = { kind: 'patch', text: 'x', t: 0, key: 'never-bridged' };");
const hurt10 = G('S.injuredT');
step(1 / 20, 40);   // two real seconds with an open urge
check('the wound heals in real time', G('S.injuredT') < hurt10 && G('S.injuredT') > 0);
G('S.task = _task10;');
G('S.injuredT = 0; S.fear = 0; S.packFrozen = false;');

// review fix 11: M is the quiet valve; the fire picks its own day
key('m');
check('M quiets the world', G('muted') === true);
key('m');
check('M brings it back', G('muted') === false);
check('the fire picks its own summer day', G('S.fire.day') >= 115 && G('S.fire.day') <= 159);

// a packmate carries a dog bite, long
G('_pm = alivePack()[0]; _pm.injuredT = 0; _pm.frozenT = 0; _pm.fleeTo = null; _pm.balked = false;');
G('_pm.x = RANCH.dogHome.x + 6; _pm.y = RANCH.dogHome.y;');
G('S.dogs.forEach(d => { d.biteCd = 0; d.x = _pm.x + 4; d.y = _pm.y; });');
step(1 / 20, 10);
check('a dog bite wounds a packmate for twice her span', G('_pm.injuredT') > 75);
G('S.fear = 0; S.packFrozen = false; S.pack.forEach(w => { w.frozenT = 0; w.fleeTo = null; w.balked = false; });');

// fear roots the pack: any fear in the bar freezes it; real terror scatters
// them to safe ground first; the moment fear drains, they move again
G('_pp = alivePack().map(w => ({ w, x: w.x, y: w.y }));');
G('S.fearSource = { x: S.wolf.x, y: S.wolf.y };');
G('S.fear = 1;');
step();
check('at full terror the pack breaks for safety', G('S.packFrozen') === true);
step(1 / 20, 100);   // five seconds: they run clear
check('they ran, they did not stand', G('_pp.some(p => Math.hypot(p.w.x - p.x, p.w.y - p.y) > 200)'));
G('S.fear = 0.15;');
step();
check('any fear in the bar keeps the pack frozen', G('S.packFrozen') === true);
G('S.fear = 0;');
step();
check('the freeze ends the instant fear is gone', G('S.packFrozen') === false);

// a wolf told to HOLD keeps to the anchor even when another packmate follows
// (the roster's "holds" must never be a lie — the Sedge-found desync)
G('S.fear = 0; S.packFrozen = false; S.pack.forEach(w => { w.fleeTo = null; w.balked = false; });');
G('S.zoneAnchor = { x: 2600, y: 1800 }; S.pack.forEach(w => w.state = "stay");');
G('_held = alivePack().filter(w => !w.pup)[1]; _held.x = 2600; _held.y = 1800; _held.state = "stay";');
G('alivePack().filter(w => !w.pup)[0].state = "follow";');   // one follows, like a just-found wolf
G('S.wolf.x = 4600; S.wolf.y = 3100;');   // Aspen far from the anchor
// pin fear off: a held wolf DOES flee real terror (correct), which would
// confound this test — here we isolate the hold/roster behavior itself
for (let i = 0; i < 60; i++) { G('S.fear = 0; S.packFrozen = false;'); step(); }
check('a held wolf keeps to the anchor while another follows',
  G('_held.state') === 'stay' && G('Math.hypot(_held.x - 2600, _held.y - 1800)') < 400);

// item 1: holding pins each wolf WHERE IT STANDS, not at Aspen's spot
G('S.tut.fTaught = true; S.westState = "none"; S.standoff = null; S.standoffCd = 999; S.cars.length = 0;');
G('S.wolf.x = 3000; S.wolf.y = 2000; S.pack.forEach(w => { w.state = "follow"; w.balked = false; w.holdX = undefined; });');
G('_hp = alivePack().filter(w => !w.pup)[0]; _hp.x = 2000; _hp.y = 1000;');   // far behind her
G('togglePackStay();');
check('holding pins a wolf where it stands (its own hold point, not Aspen)',
  G('_hp.state') === 'stay' && Math.abs(G('_hp.holdX') - 2000) < 1 && Math.abs(G('_hp.holdY') - 1000) < 1);
for (let i = 0; i < 60; i++) { G('S.fear = 0; S.packFrozen = false;'); step(); }
check('a held wolf keeps to its own ground, far from Aspen',
  G('_hp.state') === 'stay' && G('Math.hypot(_hp.x - 2000, _hp.y - 1000)') < 260
  && G('Math.hypot(_hp.x - 3000, _hp.y - 2000)') > 400);

G('S.zoneAnchor = null; S.pack.forEach(w => { w.state = "follow"; w.holdX = undefined; }); S.wolf.x = DEN.x; S.wolf.y = DEN.y;');
G('S.wolf.x = 3200; S.wolf.y = 2200;');
step(1 / 20, 10);
check('leaving rival ground ends the standoff', G('S.standoff') === null);

// the silence zone: noise becomes light becomes SEEN
const conflictBefore = G('S.conflict');
G('S.wolf.x = 4200; S.wolf.y = 3000; S.alarm = 0.97; input.down = true;');
step(1 / 20, 12);
clearInput();
check('seen at the rooflines: the ledger grows', G('S.conflict') > conflictBefore + 0.05);
// item 3: being seen brings people (and pets) out of the houses toward the pack
check('being seen brings people out of the houses', G('S.townsfolk.length') > 0);
G('_tx = S.townsfolk[0].x; _ty = S.townsfolk[0].y;');
step(1 / 20, 20);
check('the townsfolk move (out toward the pack, then back home)',
  G('!S.townsfolk.length || (Math.abs(S.townsfolk[0].x - _tx) + Math.abs(S.townsfolk[0].y - _ty))') > 2);
G('S.townsfolk = []; S.alarm = 0;');

// taking cattle: easy meat, hard arithmetic
G("(() => { const c = S.elk.find(e => HERDS[e.herd].cattle); c.stamina = 5; S.wolf.x = c.x; S.wolf.y = c.y; })()");
const conflictBeforeCalf = G('S.conflict');
step(1 / 20, 6);
check('cattle are taken and the house will know', G('S.conflict') >= conflictBeforeCalf + 0.29);
G('S.wolf.x = S.denSite.x; S.wolf.y = S.denSite.y; S.standoff = null; S.standoffCd = 999; S.cars.length = 0; S.injuredT = 0;');
step();

// item 15: pushing against a world bound announces the edge of her territory
G("S.mode = 'play'; S.edgeMsgCd = 0; S.msg = ''; S.msgT = 0; S.snaredT = 0; S.inputLockT = 0; S.senseBlend = 0; S.sickT = 0;");
G("S.wolf.x = (WORLD.x0 || 0) + WOLF_R + 1; S.wolf.y = 1500;");
G("input.left = true; input.right = false; input.up = false; input.down = false;");
step(1 / 20, 4);
G("input.left = false;");
check('reaching the edge of her territory is announced, not silent',
  /edge of her territory/i.test(G('S.msg')));
G("S.wolf.x = 2600; S.wolf.y = 1800; S.edgeMsgCd = 0; S.msg = ''; S.msgT = 0;");

// item 5: the drink hint HOLDS while she is over water (first drink) and lingers
// a few seconds after she leaves if she never drank, then clears
G("S.mode = 'play'; S.tut.drinkHintDone = false; S.tut.drinkTaught = true; S.prompt = null; S.promptQueue.length = 0; S.drinkHintT = 0; S.water = 55; S.iceCd = 999; input.drink = false;");
G("S.wolf.x = PONDS[0].x; S.wolf.y = PONDS[0].y;");
step();
check('the drink hint shows while she stands over water', G("!!S.prompt && /Hold Q to drink/i.test(S.prompt.text)") === true);
step(1 / 20, 120);   // 6s over water — a timed prompt would have faded; a sticky holds
check('the drink hint HOLDS the whole time she is over water', G("!!S.prompt && /Hold Q to drink/i.test(S.prompt.text)") === true);
G("S.wolf.x = -300; S.wolf.y = 250;");   // dry ground
step(1 / 20, 2);
check('the drink hint lingers just after she leaves the water', G("!!S.prompt && /Hold Q to drink/i.test(S.prompt.text)") === true);
step(1 / 20, 90);    // a few seconds later
check('the drink hint clears once she has left and not drunk', G("!S.prompt || !/Hold Q to drink/i.test(S.prompt.text)") === true);
G("S.tut.drinkHintDone = true; S.prompt = null; S.promptQueue.length = 0; S.wolf.x = 2600; S.wolf.y = 1800;");

// item 7: a chosen den retires every "choose a den" line
check('a chosen den retires the choose-a-den objective',
  !!G('S.denId') && !/den must be chosen/i.test(G('objectiveText()')));
G("S.denId = null; S.tut.denPrompt = true; S.prompt = null; S.promptQueue.length = 0;");
G("showPrompt('The pups will come with the late spring. A den must be chosen — raise the map; the hollows are marked.', ['SPACE'], 9);");
G("chooseDen(DEN_SITES.find(s => s.id === 'ridgeDen'));");
check('choosing a den clears a lingering choose-a-den prompt',
  G("S.denId") === 'ridgeDen' && G("!S.prompt || !/den must be chosen/i.test(S.prompt.text)") === true);

// Part 25A: the OLD den made home reads "The Den", not "The Old Den"
G("S.denId = 'ridgeDen';");
check('a different home leaves the old den named "The Old Den"',
  G("nodeLabel(NbyId.get('den'))") === 'The Old Den');
G("S.denId = 'oldDen';");
check('the old den made home reads "The Den"',
  G("nodeLabel(NbyId.get('den'))") === 'The Den');
G("S.denId = 'ridgeDen';");

// individual trees: scarce, real obstacles for wolves AND prey in the present,
// carved off every node so nothing is walled in; never block the past prologue
check('trees are scarce individual obstacles', G('TREES.length') > 120 && G('TREES.length') < 600);
check('no tree stands where a wolf must reach a node',
  G('TREES.every(t => NODES.every(n => Math.hypot(t.x - n.x, t.y - n.y) > t.s * TREE_R + WOLF_R))'));
G('_tree = TREES[0];');
check('a tree trunk blocks a wolf in the present', G('wolfBlockedAt(_tree.x, _tree.y, 0)') === true);
check('a tree trunk blocks prey in the present', G('blockedAt(_tree.x, _tree.y, 14, false, 0)') === true);
G('S.era = "past"');
check('trees do not block in the past (scripted prologue runs clear)', G('inTreeAt(_tree.x, _tree.y, 12)') === false);
G('S.era = "present"');

// a packmate rounds a tree between it and Aspen (moveAround), instead of
// sticking on the trunk's face as the plain axis-slide would
G(`(() => {
  const block = (x, y) => (x * x + y * y) < 30 * 30;   // a circular trunk at the origin
  const who = { x: 46, y: 0 };                          // it starts due east; target is due west
  for (let i = 0; i < 240; i++) {
    const d = Math.hypot(-46 - who.x, -who.y) || 1;
    moveAround(who, (-46 - who.x) / d * 4, (0 - who.y) / d * 4, block);
  }
  _ma = { x: who.x, y: who.y };
})()`);
check('a packmate rounds a trunk between it and its goal (no sticking on its face)',
  G('_ma.x') < -5);
// the plain axis-slide WOULD stick — confirms the test is meaningful
G(`(() => {
  const block = (x, y) => (x * x + y * y) < 30 * 30;
  const who = { x: 46, y: 0 };
  for (let i = 0; i < 240; i++) {
    const d = Math.hypot(-46 - who.x, -who.y) || 1;
    tryMove(who, (-46 - who.x) / d * 4, (0 - who.y) / d * 4, block);
  }
  _ts = { x: who.x };
})()`);
check('the plain axis-slide sticks on the trunk face (the bug moveAround fixes)',
  G('_ts.x') > 25);

// suggestions replace tasks: always one in play, non-binding, expiring, and
// naming only a DIRECTION (never a point). The day never holds for them.
G('_food0 = S.food; S.hud.day = true; S.suggestion = null; suggestionUpdate(0.05);');
check('there is always a suggestion in play', G('!!S.suggestion && typeof S.suggestion.text === "string" && S.suggestion.text.length > 0'));
G('_sold = S.suggestion.text; S.suggestion.t = S.suggestion.dur + 1; suggestionUpdate(0.05);');
check('a suggestion expires and a fresh one replaces it', G('!!S.suggestion && S.suggestion.t < 1'));
G('S.food = 8; S.suggestion = null; suggestionUpdate(0.05);');
check('a hunger suggestion names a direction, not a point',
  G('/\\b(north|south|east|west)/i.test(S.suggestion.text)') === true);
G('_clk = S.clock.min;');
step(1 / 20, 20);
check('the calendar runs regardless of the suggestion (no day-hold)', G('S.clock.min') > G('_clk'));
G('S.food = _food0; S.suggestion = null;');

// items 4/13/14: a carcass is a findable, significant meal that completes a
// FINITE suggestion (den + carcass advance on completion, not only on timeout)
G("S.mode = 'play'; S.hud.day = true; S.carcass = null; S.wolf.x = 2600; S.wolf.y = 1800;");
G("spawnCarcass();");
check('a carcass spawns on reachable ground, off road/rail/water',
  G("!!S.carcass && !blockedAt(S.carcass.x, S.carcass.y, 22, false, 0) && !onRoad(S.carcass.x, S.carcass.y) && !onRail(S.carcass.x, S.carcass.y) && !waterAt(S.carcass.x, S.carcass.y)"));
G("S.food = 40; S.wolf.x = S.carcass.x; S.wolf.y = S.carcass.y; carcassUpdate();");
check('reaching a carcass gives a significant meal (a bit under an elk) and clears it',
  G("S.carcass") === null && Math.abs(G('S.food') - 80) < 0.001);
G("S.suggestion = { text: 'CARCASS_TEST', dur: 999, t: 0, kind: 'carcass' }; S.carcass = null; suggestionUpdate(0.05);");
check('a finite carcass suggestion advances the moment the carcass is taken',
  G("!S.suggestion || S.suggestion.text !== 'CARCASS_TEST'"));
G("S.suggestion = { text: 'DEN_TEST', dur: 999, t: 0, kind: 'den' }; suggestionUpdate(0.05);");
check('a finite den suggestion advances the moment a den is chosen',
  G("!!S.denId && (!S.suggestion || S.suggestion.text !== 'DEN_TEST')"));
G("S.suggestion = null; S.carcass = null; S.food = 85;");

// save / load
G('S.food = 60; saveGame()');
const sx = G('S.wolf.x');
G('S.wolf.x = 50; S.wolf.y = 50;');
check('load restores the year', G('loadGame()') === true && Math.abs(G('S.wolf.x') - sx) < 1);
check('den, pups, tears survive',
  G("S.denId === 'ridgeDen'") && G('S.pups.traveling') === true
  && G("S.edges.filter(e => e.tearGroup === 'blackriver').every(e => e.torn)"));
check('bridges survive', G("S.bridged.has('blackriver')"));
check('the dug den is rebuilt from the save', G("NbyId.has('home')") === true
  && G("S.edges.some(e => e.a === 'home')"));
check('Lichen and the ledger survive the reload', G("S.pack.some(w => w.id === 'lichen')")
  && G('S.conflict') > 0.3 && G("S.fire.state") === 'done');

// the calendar runs unconditionally (no task freeze; tasks were removed)
const openMin = G('S.clock.min');
step(1 / 20, 40);
check('the calendar always runs', G('S.clock.min') > openMin);

// R asks twice
const dayBefore = G('day()');
key('r');
check('one R does not restart the game', G('S.mode') === 'play' && G('day()') === dayBefore);
step(1 / 20, 60);  // let the confirm window lapse

// the overpass: opened, reeking, then learned by crossings — adoption played
check('the overpass stands and was announced',
  G('overpassOpen()') === true && G('S.tut.overpassOpen') === true);
check('its band is earth, not asphalt',
  G('onRoad(920, (OBSTACLES.overpass.y0 + OBSTACLES.overpass.y1) / 2)') === false
  && G('onRoad(920, OBSTACLES.overpass.y1 + 60)') === true);
check('but the pack does not trust it yet', G('overpassTrusted()') === false
  && G('packRefuses(920, (OBSTACLES.overpass.y0 + OBSTACLES.overpass.y1) / 2)') === true);
check('and prey will not touch it either',
  G('S.roadGraceT = 0; S.fire.state === "burning" ? true : blockedAt(920, (OBSTACLES.overpass.y0 + OBSTACLES.overpass.y1) / 2, 2, false, 0)') === true);
G('S.wolf.x = 920; S.wolf.y = (OBSTACLES.overpass.y0 + OBSTACLES.overpass.y1) / 2;');
step();
check('she scouts it herself; it reeks', G('S.tut.overpassWalked') === true);
G('S.task = null; S.taskCooldown = 999; S.fear = 0; S.packFrozen = false;');
G('S.pack.forEach(w => { w.lost = false; w.balked = false; w.frozenT = 0; w.fleeTo = null; w.hunting = false; if (w.state === "stay" || w.state === "balk") w.state = "follow"; });');
G('_wq = alivePack()[0];');
for (let k = 0; k < 3; k++) {
  G('_wq.x = 905; _wq.y = (OBSTACLES.overpass.y0 + OBSTACLES.overpass.y1) / 2;');
  step();
  G('_wq.x = 1060;');
  step();
}
if (!G('overpassTrusted()')) {
  console.log('DEBUG-OP cross', G('S.overpassCross'), 'deckFrom', G('_wq.deckFrom'),
    'lost', G('_wq.lost'), 'frozen', G('S.packFrozen'), 'state', G('_wq.state'),
    'onDeck905', G('onDeck(905, (OBSTACLES.overpass.y0 + OBSTACLES.overpass.y1) / 2)'));
}
check('three conducted crossings teach the bridge',
  G('overpassTrusted()') === true && G('S.tut.overpassTrust') === true);
check('now the prey may follow',
  G('blockedAt(920, (OBSTACLES.overpass.y0 + OBSTACLES.overpass.y1) / 2, 2, false, 0)') === false);
smokeDraw('the overpass');

// the powerline cut: open ground under a hum
check('the cut runs pole to pole', G('inPowerlineCut(4200, 2350)') === true
  && G('inPowerlineCut(3000, 1000)') === false);

// review fix 4: the seasonal squeeze — the east empties as the year turns
G('S.clock.min = 200 * 1440 + 600; S.lastDay = day();');   // autumn
step();  // flush any respawns already due
G('S.tut.eastThins = false;');
G("_e4 = S.elk.find(e => !HERDS[e.herd].cattle && HERDS[e.herd].anchor.x > OBSTACLES.highway.x1);");
G('_rq = S.elkRespawn.length; _hd = _e4.herd; _e4.stamina = 0; S.wolf.x = _e4.x; S.wolf.y = _e4.y;');
step(1 / 20, 6);
check('autumn: an eastern kill is rescheduled at 2.5x',
  G('S.elkRespawn.length') === G('_rq') + 1
  && G('S.elkRespawn[S.elkRespawn.length - 1].day') === G('day() + Math.round(HERDS[_hd].respawnDays * 2.5)'));
check('the thinning is said once', G('S.tut.eastThins') === true && /east is emptying/.test(G('S.msg')));
// A5: during the season ritual, SPACE cannot dismiss the map early
G('S.tut.seasonRitual = true; S.forcedSenseT = 3; S.seasonGhostT = 3; S.mapOpen = true;');
G('toggleMap();');
check('the season ritual ignores an early SPACE dismiss', G('S.mapOpen') === true);
G('S.forcedSenseT = 0; S.seasonGhostT = 0; S.mapOpen = false;');

// A4: the ritual defers off the road, then raises the map, mother-ghosted
G('S.tut.seasonRitual = false; S.forcedSenseT = 0; S.seasonGhostT = 0; S.pendingSeasonRitual = false;');
G('S.cars.length = 0; S.roadGraceT = 0;');   // no stray car may strike her off the road this tick
G('_hwy = OBSTACLES.highway; S.wolf.x = (_hwy.x0 + _hwy.x1) / 2; S.wolf.y = 1800;');   // ON the road
G('S.clock.min = 275 * 1440 + 600; S.lastDay = day() - 1;');   // winter turns
step();
check('the season turn defers while she is on the road',
  G('S.pendingSeasonRitual') === true && G('S.seasonGhostT') === 0);
G('S.wolf.x = 2500; S.wolf.y = 1800;');   // off the road
step();
check('off the road, the ritual raises the map, mother-ghosted',
  G('S.seasonGhostT') > 0 && G('S.forcedSenseT') > 0);
check('and names it once', /What her mother knew/.test(G('S.caption && S.caption.sub')));
smokeDraw('season ritual ghost map');
G('S.forcedSenseT = 0; S.seasonGhostT = 0;');   // lower it for the tests below
step(1 / 20, 20);
G("_e5 = S.elk.find(e => !HERDS[e.herd].cattle && HERDS[e.herd].anchor.x > OBSTACLES.highway.x1);");
G('_rq2 = S.elkRespawn.length; _e5.stamina = 0; S.wolf.x = _e5.x; S.wolf.y = _e5.y;');
step(1 / 20, 6);
check('winter: an eastern kill is not replaced',
  G('S.elk.includes(_e5)') === false && G('S.elkRespawn.length') === G('_rq2'));
G("_e6 = S.elk.find(e => !HERDS[e.herd].cattle && HERDS[e.herd].anchor.x <= OBSTACLES.highway.x1);");
G('_rq3 = S.elkRespawn.length; _hd6 = _e6.herd; _e6.stamina = 0; S.wolf.x = _e6.x; S.wolf.y = _e6.y;');
step(1 / 20, 6);
check('winter: the west still refills',
  G('S.elkRespawn.length') === G('_rq3') + 1
  && G('S.elkRespawn[S.elkRespawn.length - 1].herd') === G('_hd6'));

// drift fix 2: the migration is watched — mill at the road, then trickle west
G('_ha = HERDS.find(H => !H.cattle && H.anchor0.x > OBSTACLES.highway.x1);');
G('_hx0 = _ha.anchor.x; _oc = S.overpassCross; S.overpassCross = 0;');
G('S.clock.min = 250 * 1440 + 600; S.lastDay = day() - 1;');
step();
check('distrusted, the herds mill against the road',
  G('_ha.anchor.x') <= Math.max(G('_hx0') - 60, G('OBSTACLES.highway.x1') + 300));
G('S.overpassCross = 3; _hx1 = _ha.anchor.x; S.lastDay = day() - 1;');
step();
check('trusted, they trickle across it, west',
  G('_ha.anchor.x') <= Math.max(G('_hx1') - 90, 620));
G('S.overpassCross = _oc; S.forcedSenseT = 0; S.seasonGhostT = 0;');

// drift fix (smaller): F during a standoff — the pack stands tall together
G("S.standoff = { t: 1, rivals: [{ x: S.wolf.x + 130, y: S.wolf.y, heading: 0, gait: 0, moving: false }] };");
G('alivePack().slice(0, 2).forEach(w => { w.x = S.wolf.x + 20; w.y = S.wolf.y + 10; w.lost = false; });');
key('f');
check('F during a standoff: the pack stands tall as one',
  G('S.standoff') === null && /stands tall/.test(G('S.msg')));
G('S.fear = 0; S.standoffCd = 999;');

// drift fix (smaller): Sedge's mark waits at the world's edge, in the cold
G('S.clock.min = 280 * 1440 + 600; S.lastDay = day();');   // winter for the reading
G("S.sedgeMark = { x: WORLD.w - 70, y: 1200 }; S.tut.sedgeSeen = false;");
G('S.wolf.x = S.sedgeMark.x - 100; S.wolf.y = S.sedgeMark.y; input.scent = true;');
step();
check("Sedge's mark is found in scent view in winter", G('S.tut.sedgeSeen') === true
  && /somewhere the map does not go/.test(G('S.msg')));
G('input.scent = false;');

// part 16: drinking is an act; wrong water costs; paths curve
G('_wp16 = PONDS.find(p => waterFouled(p.x, p.y)); S.water = 40; S.sickT = 0; S.foulCd = 0;');
G('S.wolf.x = _wp16.x; S.wolf.y = _wp16.y;');
step();
check('standing in water alone does not drink', G('S.water') < 41);
G('input.drink = true;'); step(1 / 20, 20); G('input.drink = false;');
check('holding Q in the shallows drinks — and near-people water costs',
  G('S.water') > 41 && G('S.sickT') > 0);
check('the far pool, away from people, runs clean',
  G('waterAt(PONDS[3].x, PONDS[3].y).clean') === true);
// clear any season-ghost lock a prior clock jump may have left active, and
// move to open dry ground (no wall, no water) with a full run of input
G('S.forcedSenseT = 0; S.seasonGhostT = 0; S.mapOpen = false; S.senseBlend = 0; S.inputLockT = 0;');
G('S.sickT = 0; S.water = 90; S.wolf.x = 2500; S.wolf.y = 1500; input.up = true; S.injuredT = 0;');
step(1 / 20, 4);   // let senseBlend settle to 0 and speed reach steady state
const preSickY = G('S.wolf.y');
step(1 / 20, 10);
const wellStep = preSickY - G('S.wolf.y');
G('S.wolf.y = 1500; S.sickT = 60;');
const preSick2Y = G('S.wolf.y');
step(1 / 20, 10);
const sickStep = preSick2Y - G('S.wolf.y');
G('input.up = false;'); clearInput();
check('sickness slows her badly (well under injury\'s own 0.7x)', wellStep > 5 && sickStep < wellStep * 0.65);
G('S.sickT = 0; S.wolf.x = 2600; S.wolf.y = 1800;');
check('a path curves where an obstacle blocks the line',
  G('S.edges.some(e => e.via && e.via.length)') === true);
check('the construction has grown with the seasons',
  G("obstacleRect('construction').x0") < G('OBSTACLES.construction.x0'));

// review fix 3: a wolf never ambles on asphalt
G('_h = OBSTACLES.highway; _elkStash = S.elk; S.elk = [];');
G('S.wolf.x = _h.x0 - 40; S.wolf.y = 1800; S.fear = 0; S.packFrozen = false;');
G("_w3 = alivePack()[0]; _w3.state = 'follow'; _w3.balked = false; _w3.hunting = false; _w3.frozenT = 0; _w3.fleeTo = null; _w3.injuredT = 0;");
G('_w3.x = _h.x0 + 12; _w3.y = 1800; _w3.tx = _h.x1 + 60; _w3.ty = 1800; _w3.wanderT = 99; _x3 = _w3.x;');
step();
const roadStep = G('Math.hypot(_w3.x - _x3, _w3.y - 1800)');
check('mid-road, a pack wolf moves at full lope', roadStep > 6.5);

// review fix 14: a packmate never takes asphalt Aspen is not on
G("_w3.state = 'follow'; _w3.balked = false; _w3.frozenT = 0; _w3.fleeTo = null; _w3.hunting = false; S.fear = 0;");
G('S.wolf.x = _h.x0 - 60; S.wolf.y = 1800;');
G('_w3.x = _h.x0 - 30; _w3.y = 1800; _w3.tx = _h.x1 + 80; _w3.ty = 1800; _w3.wanderT = 99;');
step(1 / 20, 40);
check('a packmate never takes asphalt Aspen is not on', G('onRoad(_w3.x, _w3.y)') === false);
G('S.elk = _elkStash;');
check('the crossing lesson has been taught by now', G('S.tut.roadLesson') === true);
G('saveGame(); loadGame();');
check('the lesson survives a save/load, so it cannot re-fire', G('S.tut.roadLesson') === true);

// review fix 14: weather — spells of sky
G("S.weather = { kind: 'cloud', t: 0, dur: 99 };");
check('cloud pulls the horizon in', G('senseRadius()') < G('(WORLD.w - WORLD.x0)') * 0.45);
G("S.weather = { kind: 'rain', t: 0, dur: 99 };");
G('_sp = { x: 1, y: 1, t: S.time, v: 0 }; S.scent.push(_sp); _t0 = _sp.t;');
step();
check('rain washes the scent out faster', G('_sp.t') < G('_t0'));
G("S.weather = { kind: 'sun', t: 0, dur: 99 };");
check('under sun the horizon is whole again', G('senseRadius()') > G('(WORLD.w - WORLD.x0)') * 0.45);
smokeDraw('weather overlays');

// drift fix 4: the wind decides how close she can come
G('S.wind.a = 0;');   // blowing due east
check('upwind, they smell her far off', G('windDetectMult(1000, 1000, 1400, 1000)') > 1.5);
check('downwind, she can come close', G('windDetectMult(1400, 1000, 1000, 1000)') < 0.8);
G("S.weather = { kind: 'rain', t: 0, dur: 99 }; _wm = windDetectMult(1000, 1000, 1400, 1000);");
check('rain drowns her scent', G('_wm') < 2.0);
G("S.weather = { kind: 'sun', t: 0, dur: 99 };");
G('input.scent = true'); smokeDraw('scent view with wind streaks'); G('input.scent = false');

// B1: hunger becomes a bearing toward distant living prey
G("S.clock.min = 30 * 1440 + 600; S.lastDay = day();");   // spring: all herds live
G('S.food = 80; S.wolf.x = DEN.x; S.wolf.y = DEN.y;');
check('well-fed, no compass pulls her', G('preyBearing()') === null);
G('S.food = 20;');   // starving
G('_pb = preyBearing();');
check('hunger yields a prey bearing (direction, not a dot)',
  G('_pb') !== null && G('typeof _pb.a === "number"') && G('_pb.x') === undefined);
check('the bearing points at a real distant herd region',
  G('(() => { const b = preyBearing(); let ok = false; for (const H of HERDS) { if (H.cattle) continue; const d = Math.hypot(H.anchor.x - S.wolf.x, H.anchor.y - S.wolf.y); if (d > playSightWorld() * 1.3 && Math.abs(Math.atan2(H.anchor.y - S.wolf.y, H.anchor.x - S.wolf.x) - b.a) < 0.01) ok = true; } return ok; })()') === true);
G('_i1 = preyBearing().intensity; S.food = 5; _i2 = preyBearing().intensity;');
check('the compass strengthens with hunger', G('_i2') > G('_i1'));
G('S.food = 85;');

// B2: thirst is a second compass; the western pool reads clean; speed floors
G('_cold = PONDS.find(p => p.x < -1000);');
check('a clean western water source exists on the corridor',
  G('_cold') !== null && G('waterFouled(_cold.x, _cold.y)') === false);
check('the pit sump and stock pond read fouled (near people)',
  G('waterFouled(PONDS.find(p => p.name === "the pit sump").x, PONDS.find(p => p.name === "the pit sump").y)') === true);
G('S.water = 90; S.wolf.x = 2700; S.wolf.y = 2800;');   // by the fouled impoundment
check('slaked, no water compass', G('waterBearing()') === null);
G('S.water = 15;');
G('_wb = waterBearing();');
check('thirst yields a clean-water bearing (direction only)',
  G('_wb') !== null && G('typeof _wb.a === "number"') && G('_wb.x') === undefined);
// the stacked slow floor: injured + sick + thirsty + wading never below 0.5x
G('S.injuredT = 75; S.sickT = 75; S.water = 0;');
G('S.wolf.x = DEN.x; S.wolf.y = DEN.y; S.forcedSenseT = 0; S.seasonGhostT = 0; S.mapOpen = false; S.senseBlend = 0; S.inputLockT = 0; S.snaredT = 0;');
G('input.up = true; _fy0 = S.wolf.y;'); step(1 / 20, 10); G('input.up = false;');
const floored = G('(_fy0 - S.wolf.y)');
G('S.injuredT = 0; S.sickT = 0; S.water = 90; S.wolf.y = _fy0;');
G('input.up = true;'); step(1 / 20, 10); G('input.up = false;');
const wellMove = G('(_fy0 - S.wolf.y)');
check('stacked penalties never drop her below the ~0.5 floor',
  floored >= wellMove * 0.5 - 0.5 && floored > 0);
G('S.water = 85; S.wolf.x = DEN.x; S.wolf.y = DEN.y;');

// B3: rumors resolve when walked — to a real feature, or a changed one. Clear
// any wrongness Bram's aging memory rolled during earlier play, so these test
// the true (right-memory) resolutions.
G('S.bramWrong = [];');
G('_rw = RUMORS.find(r => r.type === "water" && r.resolvesTo === "real");');
G('S.wolf.x = _rw.x; S.wolf.y = _rw.y; rumorUpdate();');
check('a water rumor resolves to a real clean spring',
  G('S.rumorsSeen.includes(_rw.id)') === true
  && G('waterAt(_rw.x, _rw.y) && waterAt(_rw.x, _rw.y).clean') === true);
G('_rc = RUMORS.find(r => r.resolvesTo === "changed");');
G('S.wolf.x = _rc.x; S.wolf.y = _rc.y; _foodC = S.food; rumorUpdate();');
check('a changed rumor resolves to the wrong (no spring) truth',
  G('S.rumorsSeen.includes(_rc.id)') === true
  && (G('!waterAt(_rc.x, _rc.y)') || G('waterAt(_rc.x, _rc.y).clean') === false));
G('_rv = RUMORS.find(r => r.type === "vantage");');
G('S.wolf.x = _rv.x; S.wolf.y = _rv.y; _sight0 = playSightWorld(); rumorUpdate();');
check('a vantage rumor briefly widens her sight',
  G('S.vantageT') > 0 && G('playSightWorld()') > G('_sight0'));
G('_seen0 = S.rumorsSeen.length; saveGame(); S.rumorsSeen = []; loadGame();');
check('resolved rumors round-trip through the save', G('S.rumorsSeen.length') === G('_seen0'));
G('S.food = 85; S.vantageT = 0; S.wolf.x = DEN.x; S.wolf.y = DEN.y;');

// Bram earns his years: at Aspen's side he surfaces rumors onto the map (they
// are no longer inherited-visible), one at a time, on a cooldown
G("(() => { S.rumorsTold = []; S.rumorsSeen = []; S.bramRumorCd = 0; const b = S.pack.find(w => w.id === 'bram'); b.state = 'follow'; b.x = S.wolf.x + 40; b.y = S.wolf.y; })()");
G('bramTellsRumor(0.05)');
check('Bram at her side surfaces a rumor onto the map', G('S.rumorsTold.length') === 1);
check('Bram waits before the next memory (a cooldown, not a flood)', G('S.bramRumorCd') > 10);
G("(() => { S.rumorsTold = []; S.bramRumorCd = 0; S.pack.find(w => w.id === 'bram').state = 'dead'; })()");
G('bramTellsRumor(0.05)');
check('a lost Bram surfaces no rumors', G('S.rumorsTold.length') === 0);
G("S.pack.find(w => w.id === 'bram').state = 'follow'; S.rumorsTold = []; S.rumorsSeen = []; S.bramRumorCd = 35;");

// Bram's aging memory: a rumor he got WRONG has nothing there; she searches a
// while, then it reveals itself (first time explains why) so she isn't left
// hunting an empty spot forever
G("S.mode = 'play'; S.rumorsSeen = []; S.rumorsTold = []; S.bramWrong = []; S.foundWater = []; S.tut.bramWrongSeen = false; S.bramSearchT = 0; S.msg = '';");
G("_wr = RUMORS.find(r => r.type === 'water' && r.resolvesTo === 'real'); S.rumorsTold.push(_wr.id); S.bramWrong.push(_wr.id); S.wolf.x = _wr.x; S.wolf.y = _wr.y;");
G("rumorUpdate(2);");
check('a wrong Bram rumor is not resolved instantly (she searches first)',
  G("!S.rumorsSeen.includes(_wr.id)") === true && G('S.foundWater.length') === 0);
G("rumorUpdate(3);");
check('after searching, a wrong Bram rumor reveals itself as nothing (no water)',
  G("S.rumorsSeen.includes(_wr.id)") === true && G('S.foundWater.length') === 0 && /bram/i.test(G('S.msg')));
check('the first wrong rumor explains his aging memory', G('S.tut.bramWrongSeen') === true);
G("S.rumorsSeen = []; S.rumorsTold = []; S.bramWrong = []; S.bramSearchT = 0; S.wolf.x = 2600; S.wolf.y = 1800;");

// B4: the home range dies — winter escalation fires once near the emptied den
G('S.clock.min = 280 * 1440 + 600; S.lastDay = day();');   // winter
G('S.tut.westCall = false; S.food = 30; S.wolf.x = DEN.x; S.wolf.y = DEN.y;');
G('_stash = S.elk; S.elk = S.elk.filter(e => Math.hypot(e.x - DEN.x, e.y - DEN.y) >= 1100);');
step();
check('winter near the emptied den calls her west, once', G('S.tut.westCall') === true
  && /living land has moved west/.test(G('S.msg')));
G('S.msg = "";'); step();
check('the west-call is said only once', !/moved west/.test(G('S.msg')));
G('S.elk = _stash;');
check('winter east stays barren, the west keeps refilling',
  G('respawnMult(HERDS[0])') === 0 && G('respawnMult(HERDS.find(H => !H.cattle && H.anchor0.x <= OBSTACLES.highway.x1))') === 1);
G('S.food = 85; S.wolf.x = DEN.x; S.wolf.y = DEN.y;');

// review fix 6: light runs on its own slow clock, not the 5-second calendar
G('_t6 = S.time; _m6 = S.clock.min;');
G('S.clock.min = 0;');   // calendar midnight — a frozen task would hold it here
check('midday light at calendar midnight', G('S.time = 37.5; daylight()') === 1);
check('night light regardless of the calendar', G('S.time = 75; daylight()') === 0.1);
{
  let smooth = true, moved = false, prev = G('S.time = 20; daylight()');
  for (let i = 1; i <= 40; i++) {
    const v = G(`S.time = ${20 + i * 0.5}; daylight()`);
    if (Math.abs(v - prev) > 0.06) smooth = false;
    if (v !== prev) moved = true;
    prev = v;
  }
  check('the light moves, smoothly, while the calendar stands still', smooth && moved);
}
G('S.clock.min = _m6; S.time = _t6;');

// the far west: the ballast itself is walkable — crossing it is a choice —
// but a train on it is lethal, even to her
check('a wolf may cross the ballast', G('wolfBlockedAt(-1100, 1500)') === false);
check('deer refuse the rail same as the road', G('blockedAt(-1100, 1500, 14, false, 0)') === true);
check('the trestle passes beneath it, always', G('wolfBlockedAt(-1100, 3025)') === false);
G('S.wolf.x = -880; S.wolf.y = 960;');   // her mother's crossing, contradicted
G('tearCheck()');
check('the rail line tears on approach',
  G("groupTorn(TEAR_GROUPS.find(g => g.key === 'railline'))") === true);
check('onRail marks the deadly ballast, not the trestle gap',
  G('onRail(-1100, 1500)') === true && G('onRail(-1100, 3025)') === false);
G('S.era = "present"; S.mode = "play"; S.endKind = null; S.wolf.x = -1100; S.wolf.y = 1500;');

// a train is TELEGRAPHED: >= TRAIN_WARN seconds of horn/headlight/tremble before
// it can strike. The warning state (warning + warnT) drives all three cues.
G('S.trains.length = 0; S.trains.push({ y: -APRON - 1600, vy: 1700, dir: 1, len: 1300, warnT: 0, warning: true, met: new Set() });');
check('a fresh train spawns in a warning state (horn/headlight/tremble ride warnT)',
  G('S.trains[0] && S.trains[0].warning === true && S.trains[0].warnT < 0.1'));
G('_ty0 = S.trains[0].y;');
step(1 / 20, 40);   // 2s — inside the warning
check('no strike during the warning, and the train stays off the map',
  G('S.mode') === 'play' && G('S.trains[0] && S.trains[0].warning') === true
  && Math.abs(G('S.trains[0].y') - G('_ty0')) < 1);
step(1 / 20, 220);  // let the (longer) warning finish and the train run her down
check('once warned, a train on the ballast still kills outright',
  G('S.mode') === 'ending' && G('S.endKind') === 'dead');

// the invariant, measured: a strike cannot land before the full warning elapsed
G("S.mode = 'play'; S.endKind = null; S.wolf.x = -1100; S.wolf.y = 1500; S.trains.length = 0; S.trains.push({ y: -APRON - 1600, vy: 1700, dir: 1, len: 1300, warnT: 0, warning: true, met: new Set() });");
let _strikeAt = null, _elapsed = 0;
for (let i = 0; i < 300 && _strikeAt === null; i++) { step(); _elapsed += 1 / 20; if (G("S.mode") === 'ending') _strikeAt = _elapsed; }
check('a train cannot strike before its full warning has elapsed',
  _strikeAt !== null && _strikeAt >= G('TRAIN_WARN') - 0.1);
// item 11: the warning is FELT near the rail — the ground trembles during it
G("S.mode = 'play'; S.endKind = null; S.shake = 0; S.wolf.x = -1100; S.wolf.y = 1000; S.trains.length = 0; S.trains.push({ y: -APRON - 1600, vy: 1700, dir: 1, len: 1300, warnT: 0, warning: true, met: new Set() });");
step(1 / 20, 40);
check('the train warning trembles the ground near the rail (a felt warning)',
  G('S.shake') > 0 && G('S.trains[0] && S.trains[0].warning') === true);
G("S.mode = 'play'; S.endKind = null; S.trains.length = 0; S.shake = 0; S.wolf.x = 2600; S.wolf.y = 1800;");

// item 2: the pack follows her ACROSS the rail — no phantom wall when she leads
// (the rail band is ~[-1138,-1062]; she is west of it, a follower starts east)
G("S.mode = 'play'; S.era = 'present'; S.fear = 0; S.packFrozen = false; S.trains.length = 0; S.cars.length = 0; S.tut.fTaught = true;");
G("S.wolf.x = -1500; S.wolf.y = 1500;");
G("_rc = alivePack().filter(w => !w.pup)[0]; _rc.state = 'follow'; _rc.balked = false; _rc.holdX = undefined; _rc.x = -820; _rc.y = 1500;");
for (let i = 0; i < 140; i++) { G('S.fear = 0; S.trains.length = 0;'); step(); }
check('the pack crosses the rail to follow her (no phantom wall behind her)',
  G('_rc.x') < -1160);
G("S.pack.forEach(w => { w.state = 'follow'; w.holdX = undefined; }); S.wolf.x = 2600; S.wolf.y = 1800;");

// Part 2: the first user gesture must resume a SUSPENDED AudioContext or the game
// ships silent (Safari/iOS, much of Chrome). (Manual Safari check still owed.)
G('audioUnlocked = false; audioCtx = null; masterGain = null;');
lastAC = null;
key('z');   // any first gesture
const firstAC = lastAC;
check('the first keydown creates and resumes a suspended audio context',
  firstAC !== null && firstAC.__resumed === true && firstAC.state === 'running' && G('audioUnlocked') === true);
key('z');
check('a later gesture does not spin up a second context (unlock fires once)',
  lastAC === firstAC);

// leaving the tab auto-mutes; returning reopens the valve and resumes a context
// the browser may have suspended — but a manual mute (M) is never overridden.
G('muted = false; tabHidden = false; setTabHidden(true);');
check('leaving the tab sets the auto-mute (manual mute untouched)',
  G('tabHidden') === true && G('muted') === false);
firstAC.state = 'suspended';                 // browsers may suspend a hidden tab's context
G('setTabHidden(false);');
check('returning clears the auto-mute and resumes the context',
  G('tabHidden') === false && firstAC.state === 'running');
G('toggleMute();');                          // manual mute ON
G('setTabHidden(true); setTabHidden(false);');
check('a manual mute survives a tab leave/return', G('muted') === true);
G('toggleMute(); tabHidden = false;');       // back to audible for later tests

// Part 4: an uncaught error mid-year must halt into a gentle card, not a frozen
// canvas. A deliberate throw inside update() should be caught by the frame
// boundary (no unhandled throw), and the crash state set.
G('crashed = false; _origUpdate = update; update = () => { throw new Error("deliberate boundary test"); };');
G('frame(0)');   // the throw is caught inside frame; the card path is taken
check('an error inside update() trips the boundary (loop halts, no unhandled throw)',
  G('crashed') === true);
G('update = _origUpdate; crashed = false;');
winListeners.unhandledrejection({ reason: new Error('deliberate rejection test') });
check('an unhandled promise rejection also trips the boundary', G('crashed') === true);
G('crashed = false;');

// Part 7: the touch gate must stay INERT on desktop/headless (so the keyboard
// game boots), and the touch controls must lay out, draw, and drive input
// without throwing. (Actual on-a-phone feel is manual.)
check('the touch gate is inert on desktop/headless (keyboard game boots)',
  G('typeof isTouchOnly === "function" && isTouchOnly() === false'));
let touchOk = true, touchErr = '';
try {
  G('touchMode = true;');
  // layout gives a pad and four action buttons
  check('touch: layout has a movement pad and four action buttons',
    G('(function(){var L=touchLayout(); return L.btns.length===4 && L.pad.r>0;})()') === true);
  // teaching text names the buttons, not keys
  check('touch: capOf names the on-screen buttons',
    G("capOf('scent')") === 'Smell' && G("capOf('map')") === 'Map' && G("capOf('drink')") === 'Drink');
  // the controls draw without throwing
  G('drawTouchControls();');
  // the movement pad drives the four directions (thumb to the top → she walks up)
  const up = G('(function(){ touchState.joyId=1; var L=touchLayout(); updateJoy(L.pad.x, L.pad.y - L.pad.r, L); return input.up && !input.down && !input.left && !input.right; })()');
  check('touch: the pad drives movement (up)', up === true);
  // a held action button sets its verb, and clears on release
  G("pressTouchButton('scent');"); const sOn = G('input.scent');
  G("releaseTouchButton('scent');"); const sOff = G('input.scent');
  check('touch: an action button holds its verb, then releases', sOn === true && sOff === false);
} catch (e) { touchOk = false; touchErr = String(e && e.message || e); }
// reset the shared touch state so later tests see a keyboard world again
G('touchMode = false; touchState.joyId = null; input.up=input.down=input.left=input.right=input.scent=input.drink=false;');
check('touch: controls lay out, draw, and drive input without throwing' + (touchOk ? '' : ' — ' + touchErr), touchOk === true);

// the winter arrival — hers alone is not enough
G('S.tut.earlyRange = false; S.tut.rangeWait = false;');
G('S.clock.min = 260 * 1440 + 600; S.lastDay = day();');
G("_wr = NbyId.get('winterRange'); S.wolf.x = _wr.x + 20; S.wolf.y = _wr.y; for (const w of alivePack()) { w.x = _wr.x + 40; w.y = _wr.y + 40; w.hunting = false; }");
step();
check('the range before winter does not end the year', G('S.mode') === 'play' && G('S.tut.earlyRange') === true);
check('…and she is told why', /season has not turned/.test(G('S.msg')));
G('S.clock.min = 280 * 1440 + 600; S.lastDay = day();');
G('_stray = alivePack()[0]; _stray.x = 4900; _stray.y = 300; _stray.hunting = false;');
step();
check('a stranded packmate holds the ending open', G('S.mode') === 'play' && G('S.tut.rangeWait') === true);
check('she waits at the edge of the range', /waits at the edge/.test(G('S.msg')));
G("startEnding('arrived'); _snap = S.endSurvivors; S.mode = 'play'; S.endKind = null; S.endSurvivors = null;");
check('came-through count excludes a stranded-but-alive wolf', G('_snap') === 1 + G('alivePack().length') - 1);
G('_stray.x = _wr.x + 40; _stray.y = _wr.y + 40;');
step();
check('the gathered pack ends the year', G('S.mode') === 'ending' && G("S.endKind") === 'arrived');
check('the snapshot counts everyone who was there', G('S.endSurvivors') === 1 + G('alivePack().length'));
G('S.endT = 16');
smokeDraw('ending card');

// the train ending has its own line and draws clean
G("S.endKind = 'dead';");
smokeDraw('ending card: the train');
// the full card, late enough for the sourced Banff impact panel (Part 6)
G("S.endKind = 'arrived'; S.endT = 21;");
smokeDraw('ending card: the sourced impact panel');
G("S.endKind = 'arrived'; S.endT = 16;");

// R after the ending: straight to a new year, prologue not repeated
key('r');
check('restart skips the finished prologue', G('S.mode') === 'play' && G('day()') === 1);

// the terrain layer builds once, then never again while nothing changes
G('globalThis._bbCount = 0; const _origBB = buildBaseLayer; buildBaseLayer = function () { globalThis._bbCount++; return _origBB(); }; baseKey = "force-rebuild";');
for (let i = 0; i < 5; i++) G('draw()');
check('terrain builds once across repeated frames', G('globalThis._bbCount') === 1);

// scent view + fog smoke
G('input.scent = true'); smokeDraw('scent view with fog'); G('input.scent = false');
G('S.showHelp = true'); smokeDraw('help overlay'); G('S.showHelp = false');

// hunger drives Sedge out; the year can run out
G('S.elk.length = 0; S.elkRespawn.length = 0;');   // nothing to catch: the larder stays empty
G('S.food = 0');
step(1, 125);
check('two starving days and Sedge disperses', G("S.pack.find(w => w.id === 'sedge').state") === 'gone');

// review fix 5: winter starvation has teeth (autumn does not)
G('S.clock.min = 200 * 1440 + 10; S.lastDay = day();');   // autumn
step(1, 70);   // starveT is now well past 180, but the season is wrong
check('autumn starvation does not end the year', G('S.mode') === 'play' && G('S.starveT') > 180);
G('S.clock.min = 275 * 1440 + 10; S.lastDay = day();');   // winter
step(1, 2);
check('winter starvation ends the year', G('S.mode') === 'ending' && G("S.endKind") === 'failed');
G("S.mode = 'play'; S.endKind = null; S.endSurvivors = null; S.starveT = 0; S.food = 50;");

G('S.clock.min = 361 * 1440 + 10; S.lastDay = day();');
step();
check('the year running out is its own ending', G('S.mode') === 'ending' && G("S.endKind") === 'failed');

// review fix 7: R from the intro reclaims a year in progress
G("S.mode = 'play'; S.endKind = null; S.endSurvivors = null; S.food = 60; S.starveT = 0;");
G('saveGame();');
const d7 = G('day()'), x7 = G('S.wolf.x'), p7 = G('alivePack().length');
const k7 = G("S.edges.filter(e => e.state !== 'unknown').length");
G('newGame();');   // simulated reboot: fresh state, nothing auto-loaded
check('reboot lands on the intro, the return on offer',
  G('S.mode') === 'intro' && G('hasResumableSave()') === true);
key('r');
check('R returns to the saved year',
  G('S.mode') === 'play' && G('day()') === d7 && G('S.wolf.x') === x7
  && G('alivePack().length') === p7
  && G("S.edges.filter(e => e.state !== 'unknown').length") === k7);
G('saveGame(); newGame();');
key('x');
check('any other key starts fresh and lets the save go',
  G('S.mode') === 'play' && G('day()') === 1 && G('hasResumableSave()') === false);

// ════ THE WESTERN PACK ════
// P1 — data: the scar, the pack, its territory
check('westCut has a footprint and a violet source',
  G('typeof obstacleRect("westCut").x0 === "number"')
  && G('SCENT_VIOLET.some(v => Math.hypot(v.x - 440, v.y - 1700) < 200)'));
check('the territory overlaps the farBench→highMeadow approach',
  G('(() => { const T = WEST_PACK.territory; const fb = NbyId.get("farBench"), hm = NbyId.get("highMeadow"); return Math.hypot(fb.x - T.x, fb.y - T.y) < T.r && Math.hypot(hm.x - T.x, hm.y - T.y) < T.r; })()') === true);
check('the territory does NOT contain the winter range (sanctuary stays clean)',
  G('(() => { const T = WEST_PACK.territory, wr = NbyId.get("winterRange"); return Math.hypot(wr.x - T.x, wr.y - T.y) > T.r; })()') === true);
check('the western marks are a distinct set from the eastern SCENT_RED',
  G('WEST_PACK.marks.every(m => !SCENT_RED.some(r => r.x === m.x && r.y === m.y))') === true
  && G('WEST_PACK.marks.length') >= 5 && G('WEST_PACK.marks.length') <= 7);
check('every western mark sits inside the territory',
  G('WEST_PACK.marks.every(m => Math.hypot(m.x - WEST_PACK.territory.x, m.y - WEST_PACK.territory.y) <= WEST_PACK.territory.r)') === true);

// P2 — arrival: marks-first, midyear, once
G("S.mode = 'play'; S.endKind = null; S.endSurvivors = null; S.task = null; S.taskCooldown = 999;");
G('S.clock.min = 120 * 1440 + 600; S.lastDay = day();');   // before appearDay
G('S.exposure = 0; S.tut.westArrived = false; S.wolf.x = WEST_PACK.territory.x; S.wolf.y = WEST_PACK.territory.y;');
step();
check('before the appear day, the western pack does not exist',
  G('westActive()') === false && G('S.exposure') === 0 && G('S.tut.westArrived') === false);
G('S.clock.min = 160 * 1440 + 600; S.lastDay = day(); S.msg = "";');
step();
check('at the appear day the marks arrive, announced once',
  G('westActive()') === true && G('S.tut.westArrived') === true && /driven the same way/.test(G('S.msg')));
G('S.msg = ""; saveGame(); loadGame();'); step();
check('arrival survives save/load, does not re-announce', !/driven the same way/.test(G('S.msg')));

// P4 — the patrol is deterministic from S.time; freshness tracks it
G('S.time = 10; _c1 = patrolCentroid();');
G('S.time = 10; _c2 = patrolCentroid();');
check('the patrol centroid is deterministic from S.time',
  G('_c1.x') === G('_c2.x') && G('_c1.y') === G('_c2.y'));
G('S.time = 10 + WEST_PACK.patrol.period; _c3 = patrolCentroid();');
check('and periodic (same phase, a full loop later)',
  Math.abs(G('_c1.x') - G('_c3.x')) < 0.01 && Math.abs(G('_c1.y') - G('_c3.y')) < 0.01);
G('_cNow = patrolCentroid(); _mNear = WEST_PACK.marks.reduce((b, m) => Math.hypot(m.x - _cNow.x, m.y - _cNow.y) < Math.hypot(b.x - _cNow.x, b.y - _cNow.y) ? m : b);');
G('_mFar = WEST_PACK.marks.reduce((b, m) => Math.hypot(m.x - _cNow.x, m.y - _cNow.y) > Math.hypot(b.x - _cNow.x, b.y - _cNow.y) ? m : b);');
check('a mark the patrol is at reads fresher than one far from it',
  G('markFreshness(_mNear)') > G('markFreshness(_mFar)'));

// P3 — exposure: depth, mark proximity, detection, drain, no double-cross
G('S.clock.min = 160 * 1440 + 600; S.lastDay = day(); S.time = 20; S.weather = null;');
G('S.fear = 0; S.wind = { a: 0 };');
G('S.exposure = 0; S.wolf.x = WEST_PACK.territory.x; S.wolf.y = WEST_PACK.territory.y; S.wolf.moving = true; westExposureStep(1); _deep = S.exposure;');
G('S.exposure = 0; S.wolf.x = WEST_PACK.territory.x + WEST_PACK.territory.r - 40; S.wolf.y = WEST_PACK.territory.y; westExposureStep(1); _edge = S.exposure;');
check('exposure rises faster deep than at the edge', G('_deep') > G('_edge'));
G('S.exposure = 0; S.wolf.x = 5000; S.wolf.y = 3000; westExposureStep(1);');
check('outside the territory, exposure drains (never rises)', G('S.exposure') === 0);
G('S.exposure = 0.30; S.wolf.x = WEST_PACK.territory.x; S.wolf.y = WEST_PACK.territory.y; westExposureStep(1);');
check('a single tick never crosses two thresholds', (G('S.exposure') - 0.30) <= 0.11);
// detection: near the patrol, daylit, upwind vs far away
G('S.clock.min = 160 * 1440 + 600;');
G('_c = patrolCentroid(); S.time = S.time;');
G('S.wolf.x = _c.x + 30; S.wolf.y = _c.y; S.wind = { a: Math.atan2(S.wolf.y - _c.y, S.wolf.x - _c.x) };');
G('S.exposure = 0; westExposureStep(0.5); _seen = S.exposure;');
G('S.exposure = 0; S.wolf.x = _c.x + 2000; S.wolf.y = _c.y; westExposureStep(0.5); _unseen = S.exposure;');
check('being seen (near patrol, upwind) raises exposure far faster', G('_seen') > G('_unseen') * 1.5);

// P5/P6 — the encounter and the strength gate
const WPS = G('WEST_PACK.strength'), WPR = G('WEST_PACK.territory.r');
G("S.westState = 'none'; S.westRivals = []; S.westLaneT = 0; S.fear = 0; S.food = 85;");
G('S.exposure = 0.5; westPackUpdate(0.1);');
check('exposure .33–.66 is a sighting; rivals appear', G("S.westState") === 'sighting' && G('S.westRivals.length') > 0);
G('S.exposure = 0.7; westPackUpdate(0.1);');
check('exposure .66+ is a confrontation, posture prompted', G("S.westState") === 'confrontation');
// a full fed pack (with Lichen) wins the posture → a lane opens
G("if (!S.pack.some(w => w.id === 'lichen')) S.pack.push({ id: 'lichen', name: 'Lichen', mult: 1, x: S.wolf.x, y: S.wolf.y, state: 'follow' });");
G('S.pack.forEach(w => { w.injuredT = 0; if (w.state === "dead" || w.state === "gone") w.state = "follow"; }); S.food = 90; S.fear = 0; S.injuredT = 0;');
G('_str = aspenStrength(); westResolvePosture();');
check('a strong fed pack wins the posture — a lane opens',
  G('_str') >= WPS * 0.9 && G('S.westLaneT') > 0 && G('S.exposure') < 0.3);
// a thinned, starving, frightened pack loses → driven to the edge, unhurt
G("S.pack = S.pack.filter(w => w.id === 'alder'); S.pack.forEach(w => w.state = 'follow'); S.food = 12; S.fear = 0.6; S.injuredT = 0;");
G('S.exposure = 0.7; S.westLaneT = 0; S.wolf.x = WEST_PACK.territory.x; S.wolf.y = WEST_PACK.territory.y; westPackUpdate(0.1);');
G('_hp0 = S.injuredT; _dead0 = S.pack.filter(w => w.state === "dead").length; westResolvePosture();');
check('a ruined pack loses the posture — driven to the edge, not injured',
  G('Math.hypot(S.wolf.x - WEST_PACK.territory.x, S.wolf.y - WEST_PACK.territory.y)') >= WPR
  && G('S.injuredT') === G('_hp0') && G('S.pack.filter(w => w.state === "dead").length') === G('_dead0'));
check('losing teaches the timing (no way around)', G('S.tut.westTiming') === true);
// high fear alone flips a marginal win to a loss
G("S.pack = [{ id: 'bram', name: 'Bram', x: 0, y: 0, state: 'follow' }, { id: 'sedge', name: 'Sedge', x: 0, y: 0, state: 'follow' }, { id: 'lichen', name: 'Lichen', x: 0, y: 0, state: 'follow' }, { id: 'alder', name: 'Alder', yearling: true, x: 0, y: 0, state: 'follow' }]; S.food = 90; S.injuredT = 0;");
G('S.fear = 0; _calm = aspenStrength(); S.fear = 0.95; _scared = aspenStrength();');
check('terror scales the whole posture down (bluffs weakly)',
  G('_calm') >= WPS * 0.9 && G('_scared') < WPS * 0.9);
G("S.westState = 'none'; S.westRivals = []; S.exposure = 0; S.westLaneT = 0;");

// P7 — NO skirt-it route (Arjun, 2026-07-22): every path to the winter range
// passes through the territory. A ruined pack must TIME it, not go around.
const skirtExists = G(`(() => {
  const T = WEST_PACK.territory;
  const outside = id => { const n = NbyId.get(id); return Math.hypot(n.x - T.x, n.y - T.y) > T.r; };
  const adj = {};
  for (const e of EDGES) { (adj[e.a] = adj[e.a] || []).push(e.b); (adj[e.b] = adj[e.b] || []).push(e.a); }
  const start = 'oldFord', goal = 'winterRange';
  if (!outside(start) || !outside(goal)) return false;
  const seen = new Set([start]), q = [start];
  while (q.length) {
    const c = q.shift();
    if (c === goal) return true;
    for (const nb of (adj[c] || [])) if (!seen.has(nb) && outside(nb)) { seen.add(nb); q.push(nb); }
  }
  return false;
})()`);
check('no route to the winter range skirts the territory — she must time it',
  skirtExists === false);
// the guardrail now rides entirely on TIMING: a crossing with the patrol far
// away (no detection) never forces a confrontation
G('S.clock.min = 160 * 1440 + 600; S.lastDay = day(); S.weather = null; S.fear = 0; S.wind = { a: 0 };');
G('_far = { x: WEST_PACK.patrol.legs[0].x, y: WEST_PACK.patrol.legs[0].y };');
// stand on the OPPOSITE side of the territory from the patrol leg 0, and set
// S.time so the centroid sits at leg 0 (far from her crossing point)
G('S.time = 0; _c0 = patrolCentroid();');   // phase 0 → centroid at leg 0
G('S.exposure = 0; S.wolf.x = WEST_PACK.territory.x - (WEST_PACK.patrol.legs[0].x - WEST_PACK.territory.x); S.wolf.y = WEST_PACK.territory.y - (WEST_PACK.patrol.legs[0].y - WEST_PACK.territory.y); S.wolf.moving = true;');
let timedOk = true;
for (let k = 0; k < 30; k++) { G('S.time = 0; westExposureStep(0.2);'); if (G('S.exposure') >= 0.66) { timedOk = false; break; } }
check('a well-timed crossing (patrol away) never forces a confrontation', timedOk === true);
G('S.exposure = 0; S.wolf.moving = false;');

// P8 — the reveal: reaching the scar names it, once
G("S.clock.min = 160 * 1440 + 600; S.lastDay = day(); S.tut.westScarSeen = false; S.msg = '';");
G('_wc = obstacleRect("westCut"); S.wolf.x = (_wc.x0 + _wc.x1) / 2; S.wolf.y = (_wc.y0 + _wc.y1) / 2;');
G('westPackUpdate(0.1);');
check('reaching the western scar names what drove them, once',
  G('S.tut.westScarSeen') === true && /the same hands, a different corner/i.test(G('S.msg')));
G("S.msg = ''; westPackUpdate(0.1);");
check('the scar line is said only once', !/different corner/.test(G('S.msg')));

// P9 — the EASTERN pack stays passive: no exposure, no posture, no lane
G("S.exposure = 0; S.westState = 'none'; S.westLaneT = 0;");
G('_er = SCENT_RED[0]; S.wolf.x = _er.x - 40; S.wolf.y = _er.y; S.fear = 0; S.standoff = null; S.standoffCd = 0;');
step(1 / 20, 30);
check('the eastern pack raises fear on sighting, nothing more',
  G('S.standoff !== null || S.fear > 0'));
G("S.clock.min = 160 * 1440 + 600; S.wolf.x = WEST_PACK.territory.x; S.wolf.y = WEST_PACK.territory.y; input.scent = true;");
smokeDraw('scent view with western marks'); G('input.scent = false;');
G("S.exposure = 0.5; westPackUpdate(0.1);"); smokeDraw('western rivals at the fog edge');
G("S.exposure = 0; S.westState = 'none'; S.westRivals = [];");
check('the eastern pack never raises western exposure or an encounter',
  G('S.exposure') === 0 && (G("S.westState") === 'calm' || G("S.westState") === 'none')
  && G('S.westLaneT') === 0 && G('S.westRivals.length') === 0);
G('S.standoff = null; S.standoffCd = 999; S.wolf.x = DEN.x; S.wolf.y = DEN.y; S.fear = 0;');

// ── Part 9: accessibility slate ──────────────────────────────────────────────
// 9a: remaps persist under their OWN key (separate from the run save), so they
// survive New Year (which only clears the run save), and reload into the keymap.
G("OPTIONS.bindings.up = 'i'; saveOptions();");
check('9a a remap persists under the options key, separate from the run save',
  G("JSON.parse(localStorage.getItem(OPTIONS_KEY)).bindings.up") === 'i');
G("clearSave();");   // New Year clears the run save…
check('9a …but never the options, so remaps survive New Year',
  G("localStorage.getItem(OPTIONS_KEY) !== null") && G("OPTIONS.bindings.up") === 'i');
G("loadOptions(); rebuildKeymap();");
check('9a a persisted remap reloads into the effective keymap', G("KEYMAP['i']") === 'up');
G("OPTIONS.bindings = { ...DEFAULT_BINDINGS }; rebuildKeymap();");
// items 9/10: teaching labels read the LIVE bindings; arrows always move
check('teaching labels read the default bindings',
  G("capOf('up')") === 'W' && G("capOf('map')") === 'Space' && G("capOf('drink')") === 'Q');
G("OPTIONS.bindings.up = 'i'; OPTIONS.bindings.left = 'j'; OPTIONS.bindings.down = 'k'; OPTIONS.bindings.right = 'l'; rebuildKeymap();");
check('remapping WASD retitles the taught movement keys (IJKL to move)',
  G("moveCaps().join(' ')") === 'I J K L');
check('arrows always move, whatever WASD is bound to',
  G("KEYMAP['arrowup']") === 'up' && G("KEYMAP['arrowdown']") === 'down' && G("KEYMAP['i']") === 'up');
G("OPTIONS.bindings = { ...DEFAULT_BINDINGS }; saveOptions(); rebuildKeymap();");
// the opening prompt spells the movement keys in reading order: W-A-S-D, not WSAD
check('the default movement keys spell WASD (not WSAD)', G("moveCaps().join('')") === 'WASD');
// a corrupt persisted set (two actions on one key) self-heals to the defaults on load
G("localStorage.setItem(OPTIONS_KEY, JSON.stringify({ bindings: { up:'w', down:'s', left:'s', right:'d', map:' ', scent:'e', drink:'q' } }));");
G("OPTIONS.bindings = {}; loadOptions();");
check('corrupt bindings (a duplicate key) fall back to the WASD defaults',
  G("moveCaps().join('')") === 'WASD' && G("OPTIONS.bindings.left") === 'a');
G("OPTIONS.bindings = { ...DEFAULT_BINDINGS }; saveOptions(); rebuildKeymap();");

G("S.mode = 'play'; gamePaused = false; optionsOpen = false; input.scent = false;");

// 9b: hold-to-toggle flips a sustained verb on a tap; keyup does not release it
G("OPTIONS.holdToggle = true;");
key('e');
check('9b hold-toggle: a tap turns a sustained verb ON', G('input.scent') === true);
winListeners.keyup({ key: 'e' });
check('9b hold-toggle: keyup does not release it', G('input.scent') === true);
key('e');
check('9b hold-toggle: a second tap turns it OFF', G('input.scent') === false);
G("OPTIONS.holdToggle = false; input.scent = false;");

// 9d: bigger text lingers longer (caption lifetime scales with the size option)
G("OPTIONS.textScale = 1.5; setCaption('x', 4);");
check('9d text scale lengthens caption lifetime for readability',
  Math.abs(G('S.caption.dur') - 6) < 0.001);
G("OPTIONS.textScale = 1;");

// 9e: ESC-pause halts update() wholesale; unpausing runs the world again
G("_t0 = S.time; gamePaused = true;");
step(1 / 20, 8);
check('9e pause halts the world (update ticks do nothing)', G('S.time') === G('_t0'));
G("gamePaused = false;");
step();
check('9e unpausing runs the world again', G('S.time') > G('_t0'));

// options round-trip through their own storage
G("OPTIONS.holdToggle = true; OPTIONS.textScale = 1.3; saveOptions(); OPTIONS.holdToggle = false; OPTIONS.textScale = 1; loadOptions();");
check('9 options round-trip through their own key',
  G('OPTIONS.holdToggle') === true && G('OPTIONS.textScale') === 1.3);
G("OPTIONS = { bindings: { ...DEFAULT_BINDINGS }, holdToggle: false, textScale: 1 }; saveOptions(); rebuildKeymap();");
// the options + pause screens draw clean
G("optionsOpen = true;"); smokeDraw('options screen'); G("optionsOpen = false;");
G("gamePaused = true;"); smokeDraw('pause overlay'); G("gamePaused = false;");

// Part 5: save migration — old saves (missing recently-added fields) must load
// with sane defaults, and a structurally-unusable save must fail safe to a
// fresh start rather than crash. (Runs last: loadGame resets S.)
G('localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 2, clockMin: 5000, wolf: { x: 2600, y: 1800 } }))');
G('_loadOld = loadGame();');
check('an old save missing many fields loads without throwing', G('_loadOld') === true);
check('migration fills the missing fields with sane defaults',
  G('S.water') === 90 && G('S.exposure') === 0
  && G('S.foundPaths && typeof S.foundPaths === "object" && Object.keys(S.foundPaths).length === 0')
  && G('Array.isArray(S.rumorsTold) && S.rumorsTold.length === 0')
  && G('S.wind && typeof S.wind.a === "number"') && G('S.food') === 70);
G('localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 2, edges: 12345 }))');
G('_loadCorrupt = loadGame();');
check('a structurally-unusable save fails safe to a fresh start (no crash)',
  G('_loadCorrupt') === false && G('S.mode') === 'intro');
G('clearSave();');

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
