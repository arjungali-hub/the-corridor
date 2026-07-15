// The Corridor — game state and systems. No rendering here.
// data.js is loaded before this file; render.js and main.js after.

// ── constants ────────────────────────────────────────────────────────────────

const WOLF_R        = 12;
const CORRIDOR      = 70;    // within this of a route segment counts as walking it
const COV_BUCKETS   = 8;     // a pass requires every stretch of the edge walked
const COV_FULL      = (1 << COV_BUCKETS) - 1;
const NODE_VISIT_R  = 70;
const SPEED_ROUGH   = 185;   // off-route
const SPEED_ROUTE   = 265;   // along a known, untorn route
const SPEED_SNOW    = 150;   // off-route in winter
const INJURY_SPEED  = 0.7;   // while hurt
const INJURY_DAYS   = 2.5;
const MIN_PER_SEC   = 48;    // game minutes per real second (1 day ≈ 30 s)
const SOLID_AT      = 3;     // full traversals to lift dotted → solid
const DECAY_SOLID_DAYS  = 15;
const DECAY_DOTTED_DAYS = 25;
const SENSE_IN      = 0.35;  // seconds to raise the map
const SENSE_OUT     = 0.5;   // the locked 0.5 s blend back
const SCALE_WORLD   = 1.1;
const SCALE_MAP     = 0.26;  // the map pulls well back — a document, not a lens
const SCALE_VISTA   = 0.5;
const YEAR_DAYS     = 360;
const WINTER_START  = 271;
const FOOD_PER_DAY  = 4.5;
const PUP_FOOD_PER_DAY = 30;
const PUPS_BORN_DAY    = 75;
const PUPS_TRAVEL_DAY  = 240;
const DEN_DEADLINE_DAY = 70;
const CAR_SPEED     = 700;
const FEAR_NEAR_MISS = 0.22;
const FEAR_BALK     = 0.55;  // above this, packmates refuse the road
const INHERIT_HOLD  = 3.5;   // seconds of holding, at her side, at the end
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

const OVERLOOK = { x: 2050, y: 1500 };  // beat 2 and beat 8 share this camera
const WILLOW_TONE_ID = 'willow';

// ── small helpers ────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function smooth(t) { return t * t * (3 - 2 * t); }

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  t = clamp(t, 0, 1);
  return { d: Math.hypot(px - (ax + dx * t), py - (ay + dy * t)), t };
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function makePrng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const NbyId = new Map(NODES.map(n => [n.id, n]));
const DEN = NbyId.get('den');

// ── game state ───────────────────────────────────────────────────────────────

const input = { up: false, down: false, left: false, right: false, sense: false, scent: false };

let S = null;

function newGame() {
  S = {
    mode: 'intro',           // intro | prologue | play | ending
    era: 'present',          // 'past' during prologue beats 1–7
    wantPrologue: !prologueDone(),
    clock: { min: 8 * 60 },
    lastDay: 1,

    wolf: { x: DEN.x, y: DEN.y, heading: -Math.PI / 2, moving: false, gait: 0 },
    injuredUntilDay: 0,
    roadEntrySide: null,
    wolfWasOnRoad: false,

    edges: EDGES.map(d => ({
      id: d.id, a: d.a, b: d.b, tearGroup: d.tearGroup,
      state: d.state, torn: false,
      passCount: 0, lastUsedDay: 1,
      inkLo: 1, inkHi: 0,
      covBits: 0,
    })),
    visited: new Set(['den']),
    bridged: new Set(),
    ghostNodes: new Set(),
    ghostEdges: new Set(),
    firstTear: false,
    pendingForcedSense: false,

    senseBlend: 0, forcedSenseT: 0, flickerT: 0, shake: 0,
    cam: { x: DEN.x, y: DEN.y, scale: SCALE_WORLD },

    hud: { pack: false, food: false, fear: false, day: false, pups: false },
    tut: {
      step: 0, t: 0, moved: 0,
      sawMap: false, scentHold: 0, usedHold: false,
      fearSeen: false, violetSeen: false, ownInkSeen: false,
      tearPrompt: false, goalSet: false, taughtHelp: false, denPrompt: false,
      lastStarveDay: 0,
    },
    prompt: null,
    callouts: [],
    calloutActive: null,
    showHelp: false,
    confirmNewYearT: 0,

    pack: PACK_DEF.map((d, i) => ({
      ...d, x: DEN.x - 30 * (i + 1), y: DEN.y + 20 * (i % 2 ? 1 : -1),
      state: 'follow', gait: 0, moving: false,
    })),
    trail: [{ x: DEN.x, y: DEN.y }],
    fear: 0,
    food: 70,
    starveT: 0,
    yearlingKnows: new Set(),

    denId: null, denSite: null, denStandT: 0,
    seenDens: [],
    pups: null,

    cars: [],
    laneNext: [0, 0],
    elk: [], elkRespawn: [],
    scent: [],
    scentDropT: 0,

    // prologue
    beat: 0, beatT: 0,
    willow: null,      // { x, y, heading, gait, moving, alive, lying, path: [] }
    caption: null,     // { text, sub, t, dur }
    inputLockT: 0, vistaT: 0,
    inheritHold: 0, inherited: false, inheritBloom: 0,
    ghostPulse: 0, bondGlow: 0,
    prologueElk: false, truckSent: false,

    history: [],
    histT: 0,

    msg: '', msgT: 0,
    endT: 0, endKind: null,
    saveT: 0,
    time: 0,
  };
  for (let h = 0; h < HERDS.length; h++) {
    for (let i = 0; i < HERDS[h].count; i++) spawnPrey(h);
  }
  recomputeGhosts();
}

function spawnPrey(herdIdx) {
  const H = HERDS[herdIdx];
  const a = Math.random() * Math.PI * 2;
  const r = 80 + Math.random() * Math.max(60, H.leash - 120);
  const elk = {
    herd: herdIdx,
    x: H.anchor.x + Math.cos(a) * r, y: H.anchor.y + Math.sin(a) * r,
    heading: Math.random() * Math.PI * 2, stamina: 100, fleeing: false,
    gait: 0,
    bull: H.antlers && Math.random() < 0.4,
    skittish: 0.75 + Math.random() * 0.5,
    grazeT: Math.random() * 6,
    tx: 0, ty: 0,
  };
  pickGrazeTarget(elk);
  S.elk.push(elk);
}

function pickGrazeTarget(elk) {
  const H = HERDS[elk.herd];
  const a = Math.random() * Math.PI * 2;
  const r = 60 + Math.random() * Math.max(60, H.leash - 80);
  elk.tx = H.anchor.x + Math.cos(a) * r;
  elk.ty = H.anchor.y + Math.sin(a) * r;
  elk.grazeT = 3 + Math.random() * 9;
}

function day() { return Math.floor(S.clock.min / 1440) + 1; }
function seasonIndex() { return clamp(Math.floor((day() - 1) / 90), 0, 3); }
function seasonName() { return SEASONS[seasonIndex()]; }
function isInjured() { return day() < S.injuredUntilDay; }

function say(text) { S.msg = text; S.msgT = 7; }
function setCaption(text, dur, sub) { S.caption = { text, sub: sub || '', t: 0, dur: dur || 4 }; }

// ── movement & collision ─────────────────────────────────────────────────────

function blockedAt(x, y, r, canPassGap) {
  if (x < r || y < r || x > WORLD.w - r || y > WORLD.h - r) return true;
  const h = OBSTACLES.highway;
  if (x > h.x0 - r && x < h.x1 + r) {
    const inGap = canPassGap && y > h.gapY0 + r && y < h.gapY1 - r;
    if (!inGap) return true;
  }
  if (S.era === 'past') return false;  // none of it has been built yet
  for (const key of ['construction', 'subdivision']) {
    const c = OBSTACLES[key];
    if (x > c.x0 - r && x < c.x1 + r && y > c.y0 - r && y < c.y1 + r) return true;
  }
  return false;
}

// Wolves are blocked by fences and buildings but NOT by the road surface —
// the road can be walked onto. That is the whole problem with it.
function wolfBlockedAt(x, y) {
  if (x < WOLF_R || y < WOLF_R || x > WORLD.w - WOLF_R || y > WORLD.h - WOLF_R) return true;
  if (S.era === 'past') return false;
  for (const key of ['construction', 'subdivision']) {
    const c = OBSTACLES[key];
    if (x > c.x0 - WOLF_R && x < c.x1 + WOLF_R && y > c.y0 - WOLF_R && y < c.y1 + WOLF_R) return true;
  }
  return false;
}

function tryMove(who, dx, dy, blockFn) {
  const nx = who.x + dx;
  if (!blockFn(nx, who.y)) who.x = nx;
  const ny = who.y + dy;
  if (!blockFn(who.x, ny)) who.y = ny;
}

function onRoad(x, y) {
  const h = OBSTACLES.highway;
  return x > h.x0 - 8 && x < h.x1 + 8 && !(y > h.gapY0 && y < h.gapY1);
}

function onKnownRoute() {
  for (const e of S.edges) {
    if (e.torn || e.state === 'unknown') continue;
    const A = NbyId.get(e.a), B = NbyId.get(e.b);
    if (distSeg(S.wolf.x, S.wolf.y, A.x, A.y, B.x, B.y).d < 40) return true;
  }
  return false;
}

function moveAspen(dt) {
  let vx = 0, vy = 0;
  if (S.senseBlend < 0.25 && S.inputLockT <= 0) {
    vx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    vy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  }
  if (vx || vy) {
    const m = Math.hypot(vx, vy);
    const rough = seasonIndex() === 3 && S.mode === 'play' ? SPEED_SNOW : SPEED_ROUGH;
    let sp = onKnownRoute() ? SPEED_ROUTE : rough;
    if (isInjured()) sp *= INJURY_SPEED;
    tryMove(S.wolf, vx / m * sp * dt, vy / m * sp * dt, wolfBlockedAt);
    S.wolf.heading = Math.atan2(vy, vx);
    S.wolf.moving = true;
    S.wolf.gait += sp * dt;
    S.tut.moved += sp * dt;
  } else {
    S.wolf.moving = false;
  }
}

// ── knowledge: traversal, tears, ghosts, bridges, decay ──────────────────────

function isKnownEdge(e) { return !e.torn && e.state !== 'unknown'; }

function recomputeGhosts() {
  S.ghostNodes.clear(); S.ghostEdges.clear();
  const reach = new Set(['den']);
  const queue = ['den'];
  while (queue.length) {
    const nid = queue.shift();
    for (const e of S.edges) {
      if (!isKnownEdge(e)) continue;
      const nb = e.a === nid ? e.b : e.b === nid ? e.a : null;
      if (nb && !reach.has(nb)) { reach.add(nb); queue.push(nb); }
    }
  }
  for (const e of S.edges) {
    if (e.torn || e.state === 'unknown') continue;
    if (!reach.has(e.a) || !reach.has(e.b)) {
      S.ghostEdges.add(e.id);
      if (!reach.has(e.a)) S.ghostNodes.add(e.a);
      if (!reach.has(e.b)) S.ghostNodes.add(e.b);
    }
  }
}

function swallowedNodeIds() {
  const out = new Set();
  for (const g of TEAR_GROUPS) {
    if (!groupTorn(g)) continue;
    for (const nid of g.chain.slice(1, -1)) out.add(nid);
  }
  return out;
}

function groupTorn(g) { return S.edges.find(e => e.id === g.edges[0]).torn; }

function completeTraversal(e) {
  e.passCount++;
  e.lastUsedDay = day();
  if (e.state === 'unknown') { e.state = 'current-dotted'; e.inkLo = 0; e.inkHi = 1; }
  if (e.state === 'current-dotted' && e.passCount >= SOLID_AT) e.state = 'current-solid';
  S.history.push({ type: 'edge', day: day(), edge: e.id });

  // Generational encoding — silent, never surfaced during play
  for (const w of S.pack) {
    if (w.yearling && (w.state === 'follow' || w.state === 'balk')
        && dist(w.x, w.y, S.wolf.x, S.wolf.y) < 420) {
      S.yearlingKnows.add(e.id);
    }
  }

  recomputeGhosts();
  checkBridges();
}

function traversalUpdate() {
  for (const e of S.edges) {
    if (e.torn) continue;
    const A = NbyId.get(e.a), B = NbyId.get(e.b);
    const { d, t } = distSeg(S.wolf.x, S.wolf.y, A.x, A.y, B.x, B.y);
    if (d >= CORRIDOR) continue;
    // Honest knowledge: a pass needs every stretch of the edge actually
    // walked, in however many visits — not just both endpoints touched.
    e.covBits |= 1 << Math.min(COV_BUCKETS - 1, Math.floor(t * COV_BUCKETS));
    if (e.state === 'unknown') { e.inkLo = Math.min(e.inkLo, t); e.inkHi = Math.max(e.inkHi, t); }
    if (e.covBits === COV_FULL) {
      completeTraversal(e);
      e.covBits = 0;
    }
  }
  for (const n of NODES) {
    if (!S.visited.has(n.id) && dist(S.wolf.x, S.wolf.y, n.x, n.y) < NODE_VISIT_R) {
      S.visited.add(n.id);
    }
  }
}

function tearCheck() {
  for (const g of TEAR_GROUPS) {
    if (groupTorn(g)) continue;
    if (dist(S.wolf.x, S.wolf.y, g.trigger.x, g.trigger.y) < g.trigger.r) {
      for (const eid of g.edges) S.edges.find(e => e.id === eid).torn = true;
      recomputeGhosts();
      S.flickerT = 0.5;
      S.shake = 8;
      playTearSting();
      S.history.push({ type: 'tear', day: day(), group: g.key });
      if (!S.firstTear) {
        // The scripted first tear: the map is forced up so the player watches
        // the rip appear — but never while she is standing in traffic.
        S.firstTear = true;
        if (onRoad(S.wolf.x, S.wolf.y)) S.pendingForcedSense = true;
        else S.forcedSenseT = 2.6;
      }
      say('The land is not what she remembered.');
      checkBridges();
      saveGame();
    }
  }
}

// A patch is new knowledge: only Aspen's own ink can bridge a tear.
function newInkPath(a, b) {
  const seen = new Set([a]);
  const queue = [a];
  while (queue.length) {
    const nid = queue.shift();
    if (nid === b) return true;
    for (const e of S.edges) {
      if (e.torn || (e.state !== 'current-dotted' && e.state !== 'current-solid')) continue;
      const nb = e.a === nid ? e.b : e.b === nid ? e.a : null;
      if (nb && !seen.has(nb)) { seen.add(nb); queue.push(nb); }
    }
  }
  return false;
}

function checkBridges() {
  for (const g of TEAR_GROUPS) {
    if (!groupTorn(g) || S.bridged.has(g.key)) continue;
    const a = g.chain[0], b = g.chain[g.chain.length - 1];
    if (a === b) continue;
    if (newInkPath(a, b)) {
      S.bridged.add(g.key);
      playPatchChime();
      S.history.push({ type: 'bridge', day: day(), group: g.key });
      say('A new way around. She will remember it.');
    }
  }
}

function applyDecay() {
  const d = day();
  let changed = false;
  for (const e of S.edges) {
    if (e.torn) continue;
    if (e.state === 'current-solid' && d - e.lastUsedDay >= DECAY_SOLID_DAYS) {
      e.state = 'current-dotted';
      e.lastUsedDay = d;
      changed = true;
    } else if (e.state === 'current-dotted' && e.passCount > 0 && d - e.lastUsedDay >= DECAY_DOTTED_DAYS) {
      e.state = 'unknown'; e.passCount = 0; e.inkLo = 1; e.inkHi = 0; e.covBits = 0;
      changed = true;
    }
  }
  if (changed) recomputeGhosts();
}

// The map's visible radius: generous over well-known ground, tight in the void
function senseRadius() {
  let n = 0;
  for (const e of S.edges) {
    if (!isKnownEdge(e)) continue;
    const A = NbyId.get(e.a), B = NbyId.get(e.b);
    if (distSeg(S.wolf.x, S.wolf.y, A.x, A.y, B.x, B.y).d < 700) n++;
  }
  return 460 + 170 * Math.min(n, 6);
}

// Violet human-noise intensity at a point; radii widen every season.
function violetAt(x, y) {
  if (S.era === 'past') return 0;
  const scale = 1 + 0.25 * seasonIndex();
  let v = 0;
  for (const s of SCENT_VIOLET) {
    const d = dist(x, y, s.x, s.y);
    const r = s.r * scale;
    v += Math.exp(-(d * d) / (r * r));
  }
  return v;
}

// ── the pack ─────────────────────────────────────────────────────────────────

function alivePack() { return S.pack.filter(w => w.state !== 'dead' && w.state !== 'gone'); }

function trailPoint(distBack) {
  let acc = 0;
  for (let i = S.trail.length - 1; i > 0; i--) {
    const a = S.trail[i], b = S.trail[i - 1];
    const seg = dist(a.x, a.y, b.x, b.y);
    if (acc + seg >= distBack) {
      const t = (distBack - acc) / seg;
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
    }
    acc += seg;
  }
  return S.trail[0];
}

function packUpdate(dt) {
  const last = S.trail[S.trail.length - 1];
  if (dist(last.x, last.y, S.wolf.x, S.wolf.y) > 14) {
    S.trail.push({ x: S.wolf.x, y: S.wolf.y });
    if (S.trail.length > 400) S.trail.shift();
  }

  S.fear = Math.max(0, S.fear - 0.02 * dt);

  let slot = 0;
  for (const w of S.pack) {
    if (w.state === 'dead' || w.state === 'gone' || w.state === 'stay') { w.moving = false; continue; }
    slot++;
    const target = trailPoint(38 * slot);

    const targetOnRoad = onRoad(target.x, target.y);
    const selfOnRoad = onRoad(w.x, w.y);
    if (w.state === 'balk') {
      if (S.fear < 0.35) { w.state = 'follow'; }
      else { w.moving = false; continue; }
    } else if (targetOnRoad && !selfOnRoad && S.fear > FEAR_BALK && S.mode === 'play') {
      w.state = 'balk';
      w.moving = false;
      continue;
    }

    const d = dist(w.x, w.y, target.x, target.y);
    if (d < 6) { w.moving = false; continue; }
    let sp = 230 * w.mult;
    if (d > 700) sp *= 1.6;
    const step = Math.min(d, sp * dt);
    tryMove(w, (target.x - w.x) / d * step, (target.y - w.y) / d * step, wolfBlockedAt);
    w.gait = (w.gait || 0) + step;
    w.moving = true;
  }
}

function togglePackStay() {
  const anyFollowing = S.pack.some(w => w.state === 'follow' || w.state === 'balk');
  for (const w of S.pack) {
    if (w.state === 'dead' || w.state === 'gone') continue;
    w.state = anyFollowing ? 'stay' : 'follow';
  }
  S.tut.usedHold = true;
  if (S.mode === 'prologue' && S.beat === 6) S.tut._bond = true;
  say(anyFollowing ? 'The pack holds.' : 'The pack follows.');
}

// ── traffic: the Black River That Roars ──────────────────────────────────────

const LANES = [{ x: 905, vy: CAR_SPEED }, { x: 935, vy: -CAR_SPEED }];
const CAR_TONES = ['#8a8f96', '#3d4854', '#7d3b35', '#c6c9cc', '#2e3b2f', '#5b6472'];

function trafficBusy() { return (S.time % 16) < 9; }

function trafficUpdate(dt) {
  for (let li = 0; li < LANES.length; li++) {
    if (trafficBusy() && S.time >= S.laneNext[li]) {
      const lane = LANES[li];
      S.cars.push({
        x: lane.x, y: lane.vy > 0 ? -80 : WORLD.h + 80, vy: lane.vy,
        tone: CAR_TONES[Math.floor(Math.random() * CAR_TONES.length)],
        met: new Set(),
      });
      S.laneNext[li] = S.time + 0.9 + Math.random() * 0.7;
    }
  }
  moveCars(dt);
  carCollisions();
}

function moveCars(dt) {
  for (const car of S.cars) car.y += car.vy * dt;
  S.cars = S.cars.filter(c => c.y > -200 && c.y < WORLD.h + 200);
}

function carCollisions() {
  const everyone = [{ id: 'aspen', ref: S.wolf }, ...alivePack().map(w => ({ id: w.id, ref: w }))];
  for (const car of S.cars) {
    for (const { id, ref } of everyone) {
      if (!onRoad(ref.x, ref.y) || Math.abs(ref.x - car.x) > 26 || car.met.has(id)) continue;
      const dy = Math.abs(ref.y - car.y);
      const receding = (car.vy > 0) === (car.y > ref.y);
      if (dy < 34) {
        car.met.add(id);
        if (id === 'aspen') {
          // Thrown back the way she came — a strike never completes the
          // crossing — and hurt: slower on her feet for days.
          const h = OBSTACLES.highway;
          const side = S.roadEntrySide
            || (ref.x < (h.x0 + h.x1) / 2 ? 'west' : 'east');
          ref.x = side === 'west' ? h.x0 - 30 : h.x1 + 30;
          S.fear = 1; S.flickerT = 0.6; S.shake = 14;
          S.food = Math.max(0, S.food - 8);
          if (S.mode === 'play') S.injuredUntilDay = day() + INJURY_DAYS;
          playImpact();
          say('The Black River strikes. She drags herself back, limping.');
        } else {
          const w = S.pack.find(p => p.id === id);
          if (S.mode !== 'play') continue;  // the prologue does not kill family
          w.state = 'dead';
          S.fear = 1; S.flickerT = 0.6; S.shake = 14;
          playImpact();
          S.history.push({ type: 'loss', day: day(), who: id });
          say(`${w.name} does not come back from the road.`);
          saveGame();
        }
      } else if (dy < 130 && receding) {
        car.met.add(id);
        S.fear = Math.min(1, S.fear + FEAR_NEAR_MISS);
        S.shake = Math.max(S.shake, 4);
        playWhoosh();
      }
    }
  }
}

// ── prey and the hunt ────────────────────────────────────────────────────────

function preyUpdate(dt) {
  for (let i = S.elkRespawn.length - 1; i >= 0; i--) {
    if (day() >= S.elkRespawn[i].day) {
      const herd = S.elkRespawn[i].herd;
      S.elkRespawn.splice(i, 1);
      spawnPrey(herd);
    }
  }

  const hunters = [{ x: S.wolf.x, y: S.wolf.y }, ...alivePack()];
  if (S.willow && S.willow.alive && !S.willow.lying) hunters.push(S.willow);

  for (const elk of S.elk) {
    const H = HERDS[elk.herd];
    let fx = 0, fy = 0, threat = 0;
    const flightR = 300 * elk.skittish;
    for (const h of hunters) {
      const d = dist(elk.x, elk.y, h.x, h.y);
      if (d < flightR && d > 1) {
        fx += (elk.x - h.x) / d * (flightR - d);
        fy += (elk.y - h.y) / d * (flightR - d);
        threat++;
      }
    }
    let sx = 0, sy = 0;
    for (const other of S.elk) {
      if (other === elk || other.herd !== elk.herd) continue;
      const d = dist(elk.x, elk.y, other.x, other.y);
      if (d < 90 && d > 1) {
        sx += (elk.x - other.x) / d * (90 - d);
        sy += (elk.y - other.y) / d * (90 - d);
      }
    }

    elk.fleeing = threat > 0;
    if (elk.fleeing) {
      elk.stamina = Math.max(0, elk.stamina - 12 * dt);
      fx += sx * 0.6; fy += sy * 0.6;
      const wob = elk.heading + (Math.random() - 0.5) * 2;
      fx += Math.cos(wob) * 40; fy += Math.sin(wob) * 40;
      const dAnchor = dist(elk.x, elk.y, H.anchor.x, H.anchor.y);
      if (dAnchor > H.leash) {
        fx += (H.anchor.x - elk.x) / dAnchor * 120;
        fy += (H.anchor.y - elk.y) / dAnchor * 120;
      }
      const m = Math.hypot(fx, fy) || 1;
      const sp = (elk.stamina > 25 ? H.speed : H.speed * 0.56)
        * (0.92 + 0.16 * elk.skittish) * (elk.frail || 1);
      tryMove(elk, fx / m * sp * dt, fy / m * sp * dt, (x, y) => blockedAt(x, y, 14, false));
      elk.heading = Math.atan2(fy, fx);
      elk.gait += sp * dt;
    } else {
      elk.stamina = Math.min(100, elk.stamina + 8 * dt);
      elk.grazeT -= dt;
      if (elk.grazeT <= 0) pickGrazeTarget(elk);
      const dT = dist(elk.x, elk.y, elk.tx, elk.ty);
      if (dT > 30) {
        let mx = (elk.tx - elk.x) / dT + sx * 0.02;
        let my = (elk.ty - elk.y) / dT + sy * 0.02;
        const mm = Math.hypot(mx, my) || 1;
        const sp = 34 + 18 * Math.sin(hashStr('e' + elk.tx) + S.time * 0.3);
        tryMove(elk, mx / mm * sp * dt, my / mm * sp * dt,
          (x, y) => blockedAt(x, y, 14, false));
        elk.heading += (Math.atan2(my, mx) - elk.heading) * Math.min(1, dt * 3);
        elk.gait += sp * dt;
      } else if (sx || sy) {
        const mm = Math.hypot(sx, sy) || 1;
        tryMove(elk, sx / mm * 22 * dt, sy / mm * 22 * dt, (x, y) => blockedAt(x, y, 14, false));
        elk.gait += 22 * dt;
      }
    }

    S.scentDropT += dt;
  }
  if (S.scentDropT > 1.4) {
    S.scentDropT = 0;
    for (const elk of S.elk) S.scent.push({ x: elk.x, y: elk.y, t: S.time });
    if (S.scent.length > 400) S.scent.splice(0, S.scent.length - 400);
  }

  for (let i = S.elk.length - 1; i >= 0; i--) {
    const elk = S.elk[i];
    if (elk.stamina > 25) continue;
    const caught = hunters.some(h => dist(elk.x, elk.y, h.x, h.y) < 22);
    if (caught) {
      const H = HERDS[elk.herd];
      S.elk.splice(i, 1);
      if (H.count > 0) S.elkRespawn.push({ day: day() + H.respawnDays, herd: elk.herd });
      const sedge = S.pack.find(w => w.id === 'sedge');
      const sedgeIn = sedge && sedge.state !== 'dead' && sedge.state !== 'gone'
        && dist(sedge.x, sedge.y, elk.x, elk.y) < 500;
      S.food = Math.min(100, S.food + H.food + (sedgeIn ? 10 : 0));
      S.tut.usedHold = true;
      S.history.push({ type: 'hunt', day: day() });
      say(sedgeIn ? 'A kill. Sedge ran it down with her.' : 'A kill. The pack eats.');
      saveGame();
    }
  }
}

// ── hunger and Sedge's restlessness ──────────────────────────────────────────

function hungerUpdate(dt) {
  S.food = Math.max(0, S.food - FOOD_PER_DAY / 1440 * MIN_PER_SEC * dt);
  const sedge = S.pack.find(w => w.id === 'sedge');
  if (!sedge || sedge.state === 'dead' || sedge.state === 'gone') return;
  if (S.food <= 0) {
    S.starveT += dt;
    if (S.starveT > 120) {
      sedge.state = 'gone';
      S.history.push({ type: 'loss', day: day(), who: 'sedge', dispersed: true });
      say('Sedge is gone. Hunger took her somewhere the map does not go.');
      saveGame();
    }
  } else {
    S.starveT = 0;
  }
}

// ── the den bet and the pups ─────────────────────────────────────────────────

function denUpdate(dt) {
  if (!S.denId) {
    if (!S.tut.denPrompt && day() >= 3 && S.tut.step >= 6) {
      S.tut.denPrompt = true;
      showPrompt('The pups will come with the late spring. A den must be chosen — hers, or a new one.', [], 8);
    }
    for (const site of DEN_SITES) {
      if (!S.seenDens.includes(site.id) && dist(S.wolf.x, S.wolf.y, site.x, site.y) < 200) {
        S.seenDens.push(site.id);
        say(`${site.name}. A den could be dug here.`);
      }
    }
    let near = null;
    for (const site of DEN_SITES) {
      if (dist(S.wolf.x, S.wolf.y, site.x, site.y) < 60) near = site;
    }
    if (near && !S.wolf.moving) {
      S.denStandT += dt;
      if (S.denStandT > 2.5) chooseDen(near);
    } else {
      S.denStandT = 0;
    }
    if (day() >= DEN_DEADLINE_DAY) {
      chooseDen(DEN_SITES[0]);
      say('No choice was made. The old den will serve.');
    }
  }
}

function chooseDen(site) {
  S.denId = site.id;
  S.denSite = { x: site.x, y: site.y };
  if (!S.seenDens.includes(site.id)) S.seenDens.push(site.id);
  S.history.push({ type: 'den', day: day(), site: site.id });
  say(`${site.name} is home now.`);
  saveGame();
}

function pupUpdate(dt) {
  if (!S.pups && S.denId && day() >= PUPS_BORN_DAY) {
    S.pups = { count: 2, food: 80, starveT: 0, traveling: false, lost: 0 };
    S.hud.pups = true;
    say('Pups. Two of them, blind and certain of you.');
    showPrompt('Carry food home in your belly — stand at the den, full, and they eat.', [], 8);
    saveGame();
  }
  if (!S.pups || S.pups.count <= 0 || S.pups.traveling) return;

  S.pups.food = Math.max(0, S.pups.food - PUP_FOOD_PER_DAY / 1440 * MIN_PER_SEC * dt);

  if (S.denSite && dist(S.wolf.x, S.wolf.y, S.denSite.x, S.denSite.y) < 90
      && S.food > 25 && S.pups.food < 98) {
    const amt = Math.min(15 * dt, S.food - 25, 100 - S.pups.food);
    if (amt > 0) { S.food -= amt; S.pups.food += amt; }
  }

  if (S.pups.food <= 0) {
    S.pups.starveT += dt;
    if (S.pups.starveT > 90) {
      S.pups.starveT = 0;
      S.pups.count--;
      S.pups.lost++;
      S.history.push({ type: 'loss', day: day(), who: 'pup' });
      say(S.pups.count > 0 ? 'A pup slips away in the night.' : 'The den is silent.');
      saveGame();
    }
  } else {
    S.pups.starveT = 0;
  }

  if (day() >= PUPS_TRAVEL_DAY && S.pups.count > 0) {
    S.pups.traveling = true;
    for (let i = 0; i < S.pups.count; i++) {
      S.pack.push({
        id: 'pup' + (i + 1), name: 'Pup', mult: 0.92, yearling: true, pup: true,
        x: S.denSite.x - 20 * (i + 1), y: S.denSite.y + 14 * (i % 2 ? 1 : -1),
        state: 'follow', gait: 0, moving: false,
      });
    }
    say('The pups are strong enough to travel. They walk where you walk now.');
    saveGame();
  }
}

// What the year asks of her right now — shown quietly under the day counter.
function objectiveText() {
  const si = seasonIndex();
  if (si === 0) {
    if (!S.denId) return 'a den must be chosen';
    if (!S.pups) return 'the pups are coming';
    return 'keep the pups fed';
  }
  if (si === 1) return (S.pups && S.pups.count > 0) ? 'keep the pups fed — the land is drying' : 'the land is drying';
  if (si === 2) return day() < PUPS_TRAVEL_DAY ? 'scout the way west — teach the young' : 'west, before the snow';
  return 'reach the Winter Range';
}

// ── the long tutorial (in-game path; the prologue teaches the early verbs) ───

function showPrompt(text, keys, dur) {
  S.prompt = { text, keys: keys || [], dur, t: 0, sticky: false };
}
function stickyPrompt(text, keys) {
  S.prompt = { text, keys: keys || [], dur: Infinity, t: 0, sticky: true };
}
function clearPrompt() { S.prompt = null; }

function queueCallout(id) {
  if (!S.callouts.includes(id)) S.callouts.push(id);
}

const CALLOUT_VIEW = {
  'willow-ink': 'map', den: 'map', 'own-ink': 'map', rip: 'map', goal: 'map',
  gold: 'scent', violet: 'scent',
};

function calloutReady(id) {
  if (id === 'gold') return S.scent.length > 0;
  if (id === 'rip') return S.edges.some(e => e.torn);
  if (id === 'own-ink') return S.edges.some(e => e.state.startsWith('current'));
  return true;
}

function viewOpen(view) {
  return view === 'map'
    ? S.senseBlend > 0.85
    : (input.scent && S.senseBlend < 0.2);
}

function calloutUpdate(dt) {
  if (!S.calloutActive && S.callouts.length) {
    const id = S.callouts[0];
    if (viewOpen(CALLOUT_VIEW[id]) && calloutReady(id)) {
      S.callouts.shift();
      S.calloutActive = { id, t: 0, view: CALLOUT_VIEW[id] };
    }
  }
  const a = S.calloutActive;
  if (a) {
    a.t += dt;
    if (a.t > 5.5 || (!viewOpen(a.view) && a.t > 1.2)) S.calloutActive = null;
  }
}

function tutStep(step) { S.tut.step = step; S.tut.t = 0; }

function tutorialUpdate(dt) {
  const T = S.tut;
  T.t += dt;

  if (!S.prompt) {
    if (T.step === 2) stickyPrompt('Walk.', ['W', 'A', 'S', 'D']);
    if (T.step === 4) stickyPrompt('She left you her map of this land. Hold SPACE to remember it.', ['SPACE']);
    if (T.step === 8) stickyPrompt('Prey leaves its scent on the land. Hold E to smell the wind.', ['E']);
    if (T.step === 10) stickyPrompt('Run the prey until it tires. F asks the pack to wait in ambush.', ['F']);
  }

  switch (T.step) {
    case 0:
      if (T.t > 1.4) { showPrompt('You are Aspen.', [], 3.5); tutStep(1); }
      break;
    case 1:
      if (T.t > 4.6) tutStep(2);
      break;
    case 2:
      if (T.moved > 150) {
        clearPrompt();
        S.hud.pack = true;
        showPrompt('They follow you now. Your mother led them for nine years.', [], 5);
        tutStep(3);
      }
      break;
    case 3:
      if (T.moved > 550 || T.t > 24) tutStep(4);
      break;
    case 4:
      if (S.senseBlend > 0.8) {
        clearPrompt();
        T.sawMap = true;
        queueCallout('willow-ink');
        queueCallout('den');
        tutStep(5);
      }
      break;
    case 5:
      if (S.senseBlend < 0.2 && T.t > 2) {
        showPrompt('Her memory is old. The land may have moved on.', [], 5.5);
        tutStep(6);
      }
      break;
    case 6:
      if ((day() >= 2 || S.food < 58) && T.t > 8) {
        S.hud.food = true;
        S.hud.day = true;
        showPrompt('The pack is hungry.', [], 4);
        tutStep(7);
      }
      break;
    case 7:
      if (T.t > 4.5) tutStep(8);
      break;
    case 8:
      if (input.scent && S.senseBlend < 0.2) T.scentHold += dt;
      if (T.scentHold > 0.8) {
        clearPrompt();
        queueCallout('gold');
        tutStep(9);
      }
      break;
    case 9:
      if (T.t > 3) tutStep(10);
      break;
    case 10:
      if (T.usedHold) {
        clearPrompt();
        tutStep(11);
      }
      break;
    case 11:
      if (!T.taughtHelp && T.t > 6) {
        T.taughtHelp = true;
        showPrompt('Everything she has learned so far: H.', ['H'], 5);
        tutStep(12);
      }
      break;
  }

  if (!T.fearSeen && S.fear > 0.12) {
    T.fearSeen = true;
    S.hud.fear = true;
    showPrompt('The roar of the Black River frightens them.', [], 4.5);
  }
  if (!T.violetSeen && input.scent && violetAt(S.wolf.x, S.wolf.y) > 0.3) {
    T.violetSeen = true;
    queueCallout('violet');
  }
  if (!T.ownInkSeen && S.edges.some(e => e.state.startsWith('current'))) {
    T.ownInkSeen = true;
    queueCallout('own-ink');
  }
  if (!T.tearPrompt && S.firstTear && S.forcedSenseT <= 0 && !S.pendingForcedSense) {
    T.tearPrompt = true;
    showPrompt('Her map ends at the tear. Find your own way around.', [], 6);
    queueCallout('rip');
  }
  if (!T.goalSet && day() >= 181) {
    T.goalSet = true;
    showPrompt('The cold is coming. The pack cannot winter here — the range lies far west.', [], 8);
    queueCallout('goal');
  }
  if (S.food < 22 && day() - T.lastStarveDay > 2 && T.step > 10) {
    T.lastStarveDay = day();
    showPrompt('They starve. Hunt, or lose them.', [], 5);
  }

  if (S.prompt) {
    S.prompt.t += dt;
    if (!S.prompt.sticky && S.prompt.t > S.prompt.dur + 0.8) S.prompt = null;
  }
}

// ── THE PROLOGUE — nine beats, per the bible, in 2D ─────────────────────────
// A trap in the shape of a tutorial: every mechanic at its most generous,
// on land that no longer exists.

const PROLOGUE_DONE_KEY = 'the-corridor-prologue-done';
function prologueDone() {
  if (typeof localStorage === 'undefined') return false;
  try { return localStorage.getItem(PROLOGUE_DONE_KEY) === '1'; } catch (_) { return false; }
}
function markPrologueDone() {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(PROLOGUE_DONE_KEY, '1'); } catch (_) {}
}

function startPrologue() {
  S.mode = 'prologue';
  S.era = 'past';
  S.beat = 1; S.beatT = 0;
  // her map does not exist yet: the prologue draws it before your eyes
  for (const e of S.edges) { e.state = 'unknown'; e.torn = false; }
  recomputeGhosts();
  // no traffic, no herds where they will not matter; one calm morning
  S.cars.length = 0;
  setCaption('THE CORRIDOR', 4.5, 'one year, one map');
}

function skipPrologue() {
  markPrologueDone();
  newGame();
  applyPostPrologue();
  S.mode = 'play';
}

// Shared by finishing the prologue and skipping it: the world of Act I.
function applyPostPrologue() {
  S.era = 'present';
  // the spur near the den is already gone when the game opens (beat 9's find)
  for (const e of S.edges) {
    const d = EDGES.find(x => x.id === e.id);
    if (e.state === 'unknown' && d.state === 'inherited') e.state = 'inherited';
    if (e.tearGroup === 'mudspring') e.torn = true;
  }
  recomputeGhosts();
  // the prologue already taught move / scent / map / hunt / F
  S.tut.step = 6; S.tut.t = 0;
  S.tut.sawMap = true; S.tut.scentHold = 1; S.tut.usedHold = true;
  S.hud.pack = true;
  S.clock.min = 8 * 60; S.lastDay = 1;
  S.wolf.x = DEN.x; S.wolf.y = DEN.y;
  S.trail = [{ x: DEN.x, y: DEN.y }];
  S.cam.x = DEN.x; S.cam.y = DEN.y;
  let i = 0;
  for (const w of S.pack) { i++; w.x = DEN.x - 30 * i; w.y = DEN.y + (i % 2 ? 20 : -20); w.state = 'follow'; }
  S.cars.length = 0;
  S.willow = null;
  // the land refills for Act I (the prologue emptied it for its scripted hunt)
  S.elk.length = 0; S.elkRespawn.length = 0;
  for (let h = 0; h < HERDS.length; h++) {
    for (let k = 0; k < HERDS[h].count; k++) spawnPrey(h);
  }
  setCaption('Spring.', 3.5, 'the pack is yours now');
}

function willowSetPath(points) {
  S.willow.path = points.slice();
}

function willowUpdate(dt) {
  const w = S.willow;
  if (!w || !w.alive || w.lying) return;
  if (!w.path || !w.path.length) { w.moving = false; return; }
  // she waits for you — a mother teaching, not a guide rushing
  if (dist(w.x, w.y, S.wolf.x, S.wolf.y) > 440) { w.moving = false; return; }
  const t = w.path[0];
  const d = dist(w.x, w.y, t.x, t.y);
  if (d < 16) {
    w.path.shift();
    if (t.ink) inkInheritedEdge(t.ink);
    if (t.node) S.visited.add(t.node);
    return;
  }
  const sp = 235;
  const step = Math.min(d, sp * dt);
  w.x += (t.x - w.x) / d * step;
  w.y += (t.y - w.y) / d * step;
  w.heading = Math.atan2(t.y - w.y, t.x - w.x);
  w.gait += step;
  w.moving = true;
}

function inkInheritedEdge(edgeId) {
  const e = S.edges.find(x => x.id === edgeId);
  if (e && e.state === 'unknown') {
    e.state = 'inherited';
    recomputeGhosts();
  }
}

function nodePt(id, ink, extra) {
  const n = NbyId.get(id);
  return { x: n.x, y: n.y, node: id, ink: ink || null, ...(extra || {}) };
}

function prologueUpdate(dt) {
  S.beatT += dt;
  S.vistaT = Math.max(0, S.vistaT - dt);
  S.bondGlow = Math.max(0, S.bondGlow - dt * 0.6);
  S.ghostPulse = Math.max(0, S.ghostPulse - dt);
  S.inheritBloom = Math.max(0, S.inheritBloom - dt * 0.25);

  moveAspen(dt);
  willowUpdate(dt);
  packUpdate(dt);
  moveCars(dt);
  carCollisions();
  if (S.prologueElk) preyUpdate(dt);
  calloutUpdate(dt);

  if (S.prompt) {
    S.prompt.t += dt;
    if (!S.prompt.sticky && S.prompt.t > S.prompt.dur + 0.8) S.prompt = null;
  }
  if (S.caption) {
    S.caption.t += dt;
    if (S.caption.t > S.caption.dur + 1.2) S.caption = null;
  }

  const w = S.willow;
  const T = S.tut;

  switch (S.beat) {
    // Beat 1 — waking in the den: movement and scent, in the calmest place
    case 1:
      if (S.beatT > 5 && !S.prompt && T.moved < 120) stickyPrompt('Walk.', ['W', 'A', 'S', 'D']);
      if (T.moved >= 120 && !T._b1scent) {
        T._b1scent = true;
        stickyPrompt('The world speaks in scent. Hold E.', ['E']);
      }
      if (T._b1scent && input.scent) T.scentHold += dt;
      if (T.scentHold > 0.6) {
        clearPrompt();
        S.beat = 2; S.beatT = 0;
        setCaption('Three springs old.', 3.5);
        showPrompt('Morning light on the overlook, west of the den.', [], 6);
      }
      break;

    // Beat 2 — first sightline: the valley, unbroken
    case 2:
      if (dist(S.wolf.x, S.wolf.y, OVERLOOK.x, OVERLOOK.y) < 130) {
        S.beat = 3; S.beatT = 0;
        S.vistaT = 3.4; S.inputLockT = 3.4;
        setCaption('The valley. Whole.', 3.4);
        // Willow appears and the map begins
        S.willow = {
          x: OVERLOOK.x - 60, y: OVERLOOK.y - 30, heading: Math.PI,
          gait: 0, moving: false, alive: true, lying: false, path: [],
        };
        inkInheritedEdge('den-aspenStand');
        S.visited.add('aspenStand');
      }
      break;

    // Beat 3 — following Willow: the map is born
    case 3:
      if (S.beatT > 3.5 && !T._b3go) {
        T._b3go = true;
        setCaption('Willow.', 3, 'your mother — follow her');
        willowSetPath([nodePt('oldFord', 'aspenStand-oldFord')]);
      }
      if (T._b3go && !T.sawMap && !S.prompt) {
        stickyPrompt('Watch her map become yours. Hold SPACE.', ['SPACE']);
      }
      if (S.senseBlend > 0.8 && !T.sawMap) {
        T.sawMap = true;
        clearPrompt();
        queueCallout('willow-ink');
      }
      if (w && !w.path.length && dist(w.x, w.y, NbyId.get('oldFord').x, NbyId.get('oldFord').y) < 60
          && dist(S.wolf.x, S.wolf.y, w.x, w.y) < 260 && T.sawMap) {
        S.beat = 4; S.beatT = 0;
        // an easy hunt on open, unbroken ground
        S.prologueElk = true;
        S.elk.length = 0;
        S.elk.push({
          herd: 0, x: w.x - 60, y: w.y - 240,
          heading: Math.PI / 2, stamina: 32, fleeing: false, gait: 0,
          bull: false, skittish: 0.8, grazeT: 99, tx: w.x - 60, ty: w.y - 240,
          frail: 0.55,   // winter-thin: the first hunt is meant to be won
        });
        setCaption('An elk, winter-thin.', 3.5);
        showPrompt('She will turn it. Run it down.', [], 6);
      }
      break;

    // Beat 4 — first hunt, tuned generous
    case 4:
      if (S.elk.length === 0) {
        S.beat = 5; S.beatT = 0;
        S.prologueElk = false;
        setCaption('The pack eats first from her kill. Then yours.', 4);
        willowSetPath([
          { x: 1240, y: 1500, ink: 'oldFord-sageFlat', node: 'sageFlat' },
          { x: 985, y: 1470 },
        ]);
      }
      break;

    // Beat 5 — the crossing, safe version: a quiet gravel road
    case 5:
      if (w && !w.path.length && !S.truckSent
          && dist(S.wolf.x, S.wolf.y, w.x, w.y) < 220) {
        S.truckSent = true;
        S.cars.push({
          x: 905, y: S.wolf.y + 1500, vy: -280,
          tone: '#6b6154', met: new Set(), truck: true,
        });
        showPrompt('She waits. Something is coming, slow, on the gravel.', [], 6);
      }
      if (S.truckSent && !T._b5go) {
        // the truck (northbound, y decreasing) must have swept past and gone
        const truckGone = !S.cars.some(c => c.truck && c.y > S.wolf.y - 400);
        if (truckGone) {
          T._b5go = true;
          willowSetPath([{ x: 850, y: 1450 }]);
          showPrompt('Now. Cross behind her.', [], 6);
        }
      }
      if (T._b5go && S.wolf.x < 880) {
        S.beat = 6; S.beatT = 0;
        setCaption('The far side.', 3);
        showPrompt('Lean into her.', ['F'], 0);
        S.prompt.sticky = true;
      }
      break;

    // Beat 6 — rest and bonding (optional; it skips itself)
    case 6:
      if ((S.tut._bond && w && dist(S.wolf.x, S.wolf.y, w.x, w.y) < 90) || S.beatT > 14) {
        clearPrompt();
        if (S.beatT <= 14) { S.bondGlow = 1.6; setCaption('Hers. Yours.', 3); }
        S.beat = 7; S.beatT = 0;
        willowSetPath([
          nodePt('farBench', 'sageFlat-farBench'),
          nodePt('highMeadow', 'farBench-highMeadow'),
          nodePt('winterRange', 'highMeadow-winterRange'),
        ]);
        showPrompt('Follow. The winter range is close now.', [], 5);
      }
      break;

    // Beat 7 — winter range reached: the map, complete and warm
    case 7:
      if (w && !w.path.length
          && dist(S.wolf.x, S.wolf.y, NbyId.get('winterRange').x, NbyId.get('winterRange').y) < 150) {
        S.beat = 8; S.beatT = 0;
        // nine years of her, compressed: the whole inherited map inks in
        for (const e of S.edges) {
          const d = EDGES.find(x => x.id === e.id);
          if (d.state === 'inherited') e.state = 'inherited';
        }
        recomputeGhosts();
        S.forcedSenseT = 4;
        setCaption('Nine years of her, in ink.', 4);
      }
      break;

    // Beat 8 — THE CUT
    case 8:
      if (S.beatT > 4.6 && !T._b8cut) {
        T._b8cut = true;
        S.era = 'present';
        playHorn();
        S.wolf.x = OVERLOOK.x; S.wolf.y = OVERLOOK.y;
        S.trail = [{ x: S.wolf.x, y: S.wolf.y }];
        let i = 0;
        for (const p of S.pack) { i++; p.x = S.wolf.x - 26 * i; p.y = S.wolf.y + (i % 2 ? 18 : -18); }
        S.cars.length = 0;
        S.vistaT = 3.6; S.inputLockT = 3.6;
        S.ghostPulse = 3.6;
        S.shake = 6;
        // the world that changed while she grew
        for (const e of S.edges) if (e.tearGroup === 'mudspring') e.torn = true;
        recomputeGhosts();
        setCaption('Three winters later.', 3.6, 'the world did not wait');
      }
      if (T._b8cut && S.beatT > 9.5 && S.beat === 8) {
        S.beat = 9; S.beatT = 0;
        // Willow, old, at the den
        S.willow = {
          x: DEN.x + 26, y: DEN.y - 6, heading: Math.PI * 0.9,
          gait: 0, moving: false, alive: true, lying: true, path: [],
        };
        setCaption('She is at the den.', 3.5);
      }
      break;

    // Beat 9 — Willow's death, and the inheritance
    case 9: {
      const nearHer = w && dist(S.wolf.x, S.wolf.y, w.x, w.y) < 70;
      if (!S.inherited) {
        if (nearHer && input.sense) {
          S.inheritHold += dt;
          if (S.inheritHold > INHERIT_HOLD) {
            S.inherited = true;
            w.alive = false;           // her breathing loop simply stops
            S.inheritBloom = 1;        // her warmth blooms around Aspen
            // no sting, no music — the bible is explicit
          }
        } else {
          S.inheritHold = Math.max(0, S.inheritHold - dt * 2);
        }
      } else if (dist(S.wolf.x, S.wolf.y, DEN.x, DEN.y) > 240) {
        // leaving the den begins Act I
        markPrologueDone();
        applyPostPrologue();
        S.mode = 'play';
        saveGame();
      }
      break;
    }
  }
}

// ── the year's end ───────────────────────────────────────────────────────────

function endingCheck() {
  const wr = NbyId.get('winterRange');
  if (day() >= WINTER_START && dist(S.wolf.x, S.wolf.y, wr.x, wr.y) < 90) {
    startEnding('arrived');
  } else if (day() > YEAR_DAYS) {
    startEnding('failed');
  }
}

function survivorCount() {
  let n = 1 + alivePack().length;
  if (S.pups && !S.pups.traveling) n += Math.max(0, S.pups.count);
  return n;
}

function startEnding(kind) {
  S.mode = 'ending';
  S.endKind = kind;
  S.endT = 0;
  clearSave();
}

// Abandoning a year is a real loss; it takes two presses to mean it.
// During the prologue, N skips straight to Act I.
function requestNewYear() {
  if (!S) return;
  if (S.mode === 'prologue') { skipPrologue(); return; }
  if (S.mode !== 'play') {
    clearSave(); newGame();
    if (S.wantPrologue) startPrologue(); else { applyPostPrologue(); S.mode = 'play'; }
    return;
  }
  if (S.confirmNewYearT > 0) {
    clearSave(); newGame();
    if (S.wantPrologue) startPrologue(); else { applyPostPrologue(); S.mode = 'play'; }
  } else {
    S.confirmNewYearT = 2.5;
    showPrompt('Press N again to abandon this year.', ['N'], 2.5);
  }
}

function beginFromIntro() {
  if (S.wantPrologue) startPrologue();
  else { applyPostPrologue(); S.mode = 'play'; }
}

// ── audio ────────────────────────────────────────────────────────────────────

let audioCtx = null;
function getAudioCtx() {
  const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

// The sound of the map being wrong. Played by tears, and by nothing else.
function playTearSting() {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  const parts = [
    { type: 'sawtooth', freq: 220,   peak: 0.22, at: 0,    len: 0.85 },
    { type: 'square',   freq: 311.1, peak: 0.15, at: 0.03, len: 0.75 },
  ];
  for (const p of parts) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = p.type; o.frequency.value = p.freq;
    g.gain.setValueAtTime(0.001, now + p.at);
    g.gain.linearRampToValueAtTime(p.peak, now + p.at + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + p.at + p.len);
    o.connect(g); g.connect(ac.destination);
    o.start(now + p.at); o.stop(now + p.at + p.len + 0.05);
  }
}

function playPatchChime() {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  const notes = [{ freq: 392, at: 0 }, { freq: 587.33, at: 0.15 }];
  for (const n of notes) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = n.freq;
    g.gain.setValueAtTime(0.001, now + n.at);
    g.gain.linearRampToValueAtTime(0.14, now + n.at + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + n.at + 0.7);
    o.connect(g); g.connect(ac.destination);
    o.start(now + n.at); o.stop(now + n.at + 0.8);
  }
}

function playWhoosh() {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(90, now);
  o.frequency.linearRampToValueAtTime(45, now + 0.35);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.12, now + 0.06);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  o.connect(g); g.connect(ac.destination);
  o.start(now); o.stop(now + 0.45);
}

// A car strike: blunt, mechanical, nothing like the tear.
function playImpact() {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  const o1 = ac.createOscillator(), g1 = ac.createGain();
  o1.type = 'sawtooth';
  o1.frequency.setValueAtTime(130, now);
  o1.frequency.exponentialRampToValueAtTime(32, now + 0.28);
  g1.gain.setValueAtTime(0.4, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  o1.connect(g1); g1.connect(ac.destination);
  o1.start(now); o1.stop(now + 0.55);
  const o2 = ac.createOscillator(), g2 = ac.createGain();
  o2.type = 'square';
  o2.frequency.setValueAtTime(640, now);
  o2.frequency.exponentialRampToValueAtTime(180, now + 0.12);
  g2.gain.setValueAtTime(0.18, now);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  o2.connect(g2); g2.connect(ac.destination);
  o2.start(now); o2.stop(now + 0.2);
}

// A distant diesel horn — the sound of beat 8's hard cut.
function playHorn() {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  for (const f of [110, 138.6]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.value = f;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.05);
    g.gain.setValueAtTime(0.16, now + 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    o.connect(g); g.connect(ac.destination);
    o.start(now); o.stop(now + 1.15);
  }
}

// ── save / load ──────────────────────────────────────────────────────────────

const SAVE_KEY = 'the-corridor-save-v2';
function storageOk() { return typeof localStorage !== 'undefined'; }

function saveGame() {
  if (!storageOk() || !S || S.mode !== 'play') return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 2,
      clockMin: S.clock.min,
      wolf: { x: S.wolf.x, y: S.wolf.y },
      injuredUntilDay: S.injuredUntilDay,
      edges: S.edges.map(e => ({
        id: e.id, state: e.state, torn: e.torn, passCount: e.passCount,
        lastUsedDay: e.lastUsedDay, inkLo: e.inkLo, inkHi: e.inkHi,
        covBits: e.covBits,
      })),
      visited: [...S.visited], bridged: [...S.bridged],
      firstTear: S.firstTear,
      pack: S.pack.map(w => ({
        id: w.id, name: w.name, mult: w.mult, yearling: w.yearling,
        pup: !!w.pup, x: w.x, y: w.y, state: w.state,
      })),
      fear: S.fear, food: S.food,
      yearlingKnows: [...S.yearlingKnows],
      denId: S.denId, denSite: S.denSite, seenDens: S.seenDens,
      pups: S.pups,
      hud: S.hud, tut: S.tut, callouts: S.callouts,
      elkRespawn: S.elkRespawn,
      history: S.history.slice(-4000),
      time: S.time,
    }));
  } catch (_) { /* storage full or blocked — the game just doesn't persist */ }
}

function loadGame() {
  if (!storageOk()) return false;
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (_) { return false; }
  if (!raw) return false;
  let d;
  try { d = JSON.parse(raw); } catch (_) { return false; }
  if (!d || d.v !== 2) return false;

  newGame();
  S.era = 'present';
  S.clock.min = d.clockMin; S.lastDay = day();
  S.wolf.x = d.wolf.x; S.wolf.y = d.wolf.y;
  S.injuredUntilDay = d.injuredUntilDay || 0;
  S.trail = [{ x: S.wolf.x, y: S.wolf.y }];
  S.cam.x = S.wolf.x; S.cam.y = S.wolf.y;
  for (const se of d.edges) {
    const e = S.edges.find(x => x.id === se.id);
    if (e) Object.assign(e, se);
  }
  S.visited = new Set(d.visited); S.bridged = new Set(d.bridged);
  S.firstTear = d.firstTear;
  for (const sw of d.pack) {
    if (sw.pup) {
      S.pack.push({ ...sw, state: sw.state === 'balk' ? 'follow' : sw.state, gait: 0, moving: false });
    } else {
      const w = S.pack.find(x => x.id === sw.id);
      if (w) { w.x = sw.x; w.y = sw.y; w.state = sw.state === 'balk' ? 'follow' : sw.state; }
    }
  }
  S.fear = d.fear; S.food = d.food;
  S.yearlingKnows = new Set(d.yearlingKnows);
  S.denId = d.denId; S.denSite = d.denSite; S.seenDens = d.seenDens || [];
  S.pups = d.pups;
  Object.assign(S.hud, d.hud || {});
  Object.assign(S.tut, d.tut || {});
  S.callouts = d.callouts || [];
  S.elkRespawn = d.elkRespawn || [];
  S.history = d.history;
  S.time = d.time || 0;
  recomputeGhosts();
  S.mode = 'play';
  return true;
}

function clearSave() {
  if (storageOk()) try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
}

// ── the frame update ─────────────────────────────────────────────────────────

function update(dt) {
  if (!S) return;
  if (S.mode === 'intro') return;
  if (S.mode === 'ending') { S.endT += dt; return; }

  S.time += dt;
  S.forcedSenseT = Math.max(0, S.forcedSenseT - dt);
  S.flickerT = Math.max(0, S.flickerT - dt);
  S.msgT = Math.max(0, S.msgT - dt);
  S.shake = Math.max(0, S.shake - 30 * dt);
  S.inputLockT = Math.max(0, S.inputLockT - dt);
  S.confirmNewYearT = Math.max(0, S.confirmNewYearT - dt);

  // in beat 9, holding at her side is the inherit gesture, not the map
  let sensing = input.sense || S.forcedSenseT > 0;
  if (S.mode === 'prologue' && S.beat === 9 && !S.inherited
      && S.willow && dist(S.wolf.x, S.wolf.y, S.willow.x, S.willow.y) < 70) {
    sensing = S.forcedSenseT > 0;
  }
  S.senseBlend = clamp(S.senseBlend + (sensing ? dt / SENSE_IN : -dt / SENSE_OUT), 0, 1);

  if (S.mode === 'prologue') {
    prologueUpdate(dt);
  } else {
    S.clock.min += dt * MIN_PER_SEC;
    if (day() !== S.lastDay) { S.lastDay = day(); applyDecay(); }

    if (S.pendingForcedSense && !onRoad(S.wolf.x, S.wolf.y)) {
      S.pendingForcedSense = false;
      S.forcedSenseT = 2.6;
    }

    moveAspen(dt);

    const onR = onRoad(S.wolf.x, S.wolf.y);
    if (onR && !S.wolfWasOnRoad) {
      const h = OBSTACLES.highway;
      S.roadEntrySide = S.wolf.x < (h.x0 + h.x1) / 2 ? 'west' : 'east';
    }
    S.wolfWasOnRoad = onR;

    traversalUpdate();
    tearCheck();
    packUpdate(dt);
    trafficUpdate(dt);
    preyUpdate(dt);
    hungerUpdate(dt);
    denUpdate(dt);
    pupUpdate(dt);
    tutorialUpdate(dt);
    calloutUpdate(dt);
    endingCheck();

    S.histT += dt;
    if (S.histT > 3) {
      S.histT = 0;
      S.history.push({ type: 'pos', day: day(), x: Math.round(S.wolf.x), y: Math.round(S.wolf.y) });
    }

    S.saveT += dt;
    if (S.saveT > 12) { S.saveT = 0; saveGame(); }

    if (S.caption) {
      S.caption.t += dt;
      if (S.caption.t > S.caption.dur + 1.2) S.caption = null;
    }
  }

  // camera
  let targetScale = lerp(SCALE_WORLD, SCALE_MAP, smooth(S.senseBlend));
  if (S.vistaT > 0) targetScale = SCALE_VISTA;
  S.cam.scale += (targetScale - S.cam.scale) * Math.min(1, dt * 8);
  S.cam.x += (S.wolf.x - S.cam.x) * Math.min(1, dt * 6);
  S.cam.y += (S.wolf.y - S.cam.y) * Math.min(1, dt * 6);
}
