// The Corridor — game state and systems. No rendering here.
// data.js is loaded before this file; render.js and main.js after.

// ── constants ────────────────────────────────────────────────────────────────

const WOLF_R        = 12;
const CORRIDOR      = 60;    // within this of a route segment counts as walking it
const NODE_VISIT_R  = 70;
const SPEED_ROUGH   = 185;   // off-route
const SPEED_ROUTE   = 265;   // along a known, untorn route
const SPEED_SNOW    = 150;   // off-route in winter
const MIN_PER_SEC   = 24;    // game minutes per real second (1 day ≈ 60 s)
const SOLID_AT      = 3;     // full traversals to lift dotted → solid
const DECAY_SOLID_DAYS  = 15;
const DECAY_DOTTED_DAYS = 25;
const SENSE_IN      = 0.35;  // seconds to raise the map
const SENSE_OUT     = 0.5;   // the locked 0.5 s blend back
const SCALE_WORLD   = 1.1;
const SCALE_MAP     = 0.42;
const YEAR_DAYS     = 360;
const WINTER_START  = 271;
const FOOD_PER_DAY  = 4.5;
const HUNT_FOOD     = 45;
const CAR_SPEED     = 700;
const FEAR_NEAR_MISS = 0.22;
const FEAR_BALK     = 0.55;  // above this, packmates refuse the road
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];

// ── small helpers ────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function smooth(t) { return t * t * (3 - 2 * t); }

// Distance from point to segment, plus the parameter t along it
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

// Deterministic PRNG so textures are identical on every redraw
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

let S = null;  // the whole mutable game state; rebuilt by newGame(), serialized by saveGame()

function newGame() {
  S = {
    mode: 'intro',           // intro | play | ending
    clock: { min: 8 * 60 },  // dawn, day 1, spring
    lastDay: 1,

    wolf: { x: DEN.x, y: DEN.y, heading: -Math.PI / 2, moving: false },

    // Aspen's knowledge, per edge. `state` starts from data and diverges.
    edges: EDGES.map(d => ({
      id: d.id, a: d.a, b: d.b, tearGroup: d.tearGroup,
      state: d.state, torn: false,
      passCount: 0, lastUsedDay: 1,
      inkLo: 1, inkHi: 0,            // partial-walk ink on unknown edges
      covLo: 1, covHi: 0,            // coverage toward the next full pass
    })),
    visited: new Set(['den']),
    bridged: new Set(),
    ghostNodes: new Set(),
    ghostEdges: new Set(),
    firstTear: false,

    senseBlend: 0, forcedSenseT: 0, flickerT: 0,
    cam: { x: DEN.x, y: DEN.y, scale: SCALE_WORLD },

    pack: PACK_DEF.map((d, i) => ({
      ...d, x: DEN.x - 30 * (i + 1), y: DEN.y + 20 * (i % 2 ? 1 : -1),
      state: 'follow',   // follow | stay | balk | dead | gone
    })),
    trail: [{ x: DEN.x, y: DEN.y }],  // Aspen's breadcrumbs, for followers
    fear: 0,
    food: 70,
    starveT: 0,
    yearlingKnows: new Set(),  // edge ids walked while a yearling followed — silent

    cars: [],
    laneNext: [0, 0],  // next spawn time per lane
    elk: [], elkRespawn: [],
    scent: [],         // gold prey-scent breadcrumbs {x,y,t}
    scentDropT: 0,

    history: [],       // {type:'pos'|'edge'|'tear'|'bridge'|'hunt'|'loss', day, ...}
    histT: 0,

    msg: '', msgT: 0,
    endT: 0, endKind: null,
    saveT: 0,
    time: 0,
  };
  for (let i = 0; i < ELK_DEF.count; i++) spawnElk();
  recomputeGhosts();
}

function spawnElk() {
  const a = Math.random() * Math.PI * 2, r = Math.random() * 200;
  S.elk.push({
    x: ELK_DEF.anchor.x + Math.cos(a) * r, y: ELK_DEF.anchor.y + Math.sin(a) * r,
    heading: Math.random() * Math.PI * 2, stamina: 100, fleeing: false,
  });
}

function day() { return Math.floor(S.clock.min / 1440) + 1; }
function seasonIndex() { return clamp(Math.floor((day() - 1) / 90), 0, 3); }
function seasonName() { return SEASONS[seasonIndex()]; }

function say(text) { S.msg = text; S.msgT = 7; }

// ── movement & collision ─────────────────────────────────────────────────────

// canPassGap: wolves fit through the culvert; elk do not.
function blockedAt(x, y, r, canPassGap) {
  if (x < r || y < r || x > WORLD.w - r || y > WORLD.h - r) return true;
  const h = OBSTACLES.highway;
  if (x > h.x0 - r && x < h.x1 + r) {
    const inGap = canPassGap && y > h.gapY0 + r && y < h.gapY1 - r;
    if (!inGap) return true;
  }
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
    // Coverage persists until the full length has been walked, however many
    // visits it takes — 8-way movement cannot hold a diagonal trail exactly,
    // and knowledge of ground walked in pieces is still knowledge.
    e.covLo = Math.min(e.covLo, t);
    e.covHi = Math.max(e.covHi, t);
    if (e.state === 'unknown') { e.inkLo = Math.min(e.inkLo, t); e.inkHi = Math.max(e.inkHi, t); }
    if (e.covLo < 0.15 && e.covHi > 0.85) {
      completeTraversal(e);
      e.covLo = 1; e.covHi = 0;  // the next pass starts from nothing
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
      playTearSting();
      S.history.push({ type: 'tear', day: day(), group: g.key });
      if (!S.firstTear) {
        // The scripted first tear: the map is forced up so the player watches
        // the rip appear. Every later tear is discovered on a voluntary check.
        S.firstTear = true;
        S.forcedSenseT = 2.6;
      }
      say('The land is not what she remembered.');
      checkBridges();  // a detour walked before the tear already bridges it
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
      e.lastUsedDay = d;  // faint timer restarts from demotion
      changed = true;
    } else if (e.state === 'current-dotted' && e.passCount > 0 && d - e.lastUsedDay >= DECAY_DOTTED_DAYS) {
      e.state = 'unknown'; e.passCount = 0; e.inkLo = 1; e.inkHi = 0;
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
    if (distSeg(S.wolf.x, S.wolf.y, A.x, A.y, B.x, B.y).d < 420) n++;
  }
  return 230 + 95 * Math.min(n, 6);
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
  // breadcrumbs
  const last = S.trail[S.trail.length - 1];
  if (dist(last.x, last.y, S.wolf.x, S.wolf.y) > 14) {
    S.trail.push({ x: S.wolf.x, y: S.wolf.y });
    if (S.trail.length > 400) S.trail.shift();
  }

  S.fear = Math.max(0, S.fear - 0.02 * dt);

  let slot = 0;
  for (const w of S.pack) {
    if (w.state === 'dead' || w.state === 'gone' || w.state === 'stay') continue;
    slot++;
    const target = trailPoint(38 * slot);

    // Balk: a frightened wolf will not step onto the road
    const targetOnRoad = onRoad(target.x, target.y);
    const selfOnRoad = onRoad(w.x, w.y);
    if (w.state === 'balk') {
      if (S.fear < 0.35) { w.state = 'follow'; }
      else continue;
    } else if (targetOnRoad && !selfOnRoad && S.fear > FEAR_BALK) {
      w.state = 'balk';
      continue;
    }

    const d = dist(w.x, w.y, target.x, target.y);
    if (d < 6) continue;
    let sp = 230 * w.mult;
    if (d > 700) sp *= 1.6;  // catch up rather than be lost forever
    const step = Math.min(d, sp * dt);
    tryMove(w, (target.x - w.x) / d * step, (target.y - w.y) / d * step, wolfBlockedAt);
  }
}

function togglePackStay() {
  const anyFollowing = S.pack.some(w => w.state === 'follow' || w.state === 'balk');
  for (const w of S.pack) {
    if (w.state === 'dead' || w.state === 'gone') continue;
    w.state = anyFollowing ? 'stay' : 'follow';
  }
  say(anyFollowing ? 'The pack holds.' : 'The pack follows.');
}

// ── traffic: the Black River That Roars ──────────────────────────────────────
// Waves with a learnable rhythm: ~9 s of traffic, ~7 s of quiet.

const LANES = [{ x: 445, vy: CAR_SPEED }, { x: 475, vy: -CAR_SPEED }];

function trafficBusy() { return (S.time % 16) < 9; }

function trafficUpdate(dt) {
  for (let li = 0; li < LANES.length; li++) {
    if (trafficBusy() && S.time >= S.laneNext[li]) {
      const lane = LANES[li];
      S.cars.push({ x: lane.x, y: lane.vy > 0 ? -80 : WORLD.h + 80, vy: lane.vy, met: new Set() });
      S.laneNext[li] = S.time + 0.9 + Math.random() * 0.7;
    }
  }
  for (const car of S.cars) car.y += car.vy * dt;
  S.cars = S.cars.filter(c => c.y > -160 && c.y < WORLD.h + 160);

  // near-misses and hits, for Aspen and every follower
  const everyone = [{ id: 'aspen', ref: S.wolf }, ...alivePack().map(w => ({ id: w.id, ref: w }))];
  for (const car of S.cars) {
    for (const { id, ref } of everyone) {
      if (!onRoad(ref.x, ref.y) || Math.abs(ref.x - car.x) > 26 || car.met.has(id)) continue;
      const dy = Math.abs(ref.y - car.y);
      const receding = (car.vy > 0) === (car.y > ref.y);
      if (dy < 34) {
        car.met.add(id);
        if (id === 'aspen') {
          // Thrown clear, hurt, terrified — never gore
          const h = OBSTACLES.highway;
          ref.x = ref.x < (h.x0 + h.x1) / 2 ? h.x0 - 30 : h.x1 + 30;
          S.fear = 1; S.flickerT = 0.6; S.food = Math.max(0, S.food - 8);
          playTearSting();
          say('The Black River strikes. She limps clear.');
        } else {
          const w = S.pack.find(p => p.id === id);
          w.state = 'dead';
          S.fear = 1; S.flickerT = 0.6;
          playTearSting();
          S.history.push({ type: 'loss', day: day(), who: id });
          say(`${w.name} does not come back from the road.`);
          saveGame();
        }
      } else if (dy < 130 && receding) {
        // only a car that has already swept past counts as a near-miss —
        // an approaching one must still be able to become a hit
        car.met.add(id);
        S.fear = Math.min(1, S.fear + FEAR_NEAR_MISS);
        playWhoosh();
      }
    }
  }
}

// ── elk and the hunt ─────────────────────────────────────────────────────────

function elkUpdate(dt) {
  // respawns
  for (let i = S.elkRespawn.length - 1; i >= 0; i--) {
    if (day() >= S.elkRespawn[i]) { S.elkRespawn.splice(i, 1); spawnElk(); }
  }

  const hunters = [{ x: S.wolf.x, y: S.wolf.y }, ...alivePack()];
  for (const elk of S.elk) {
    let fx = 0, fy = 0, threat = 0;
    for (const h of hunters) {
      const d = dist(elk.x, elk.y, h.x, h.y);
      if (d < 300 && d > 1) {
        fx += (elk.x - h.x) / d * (300 - d);
        fy += (elk.y - h.y) / d * (300 - d);
        threat++;
      }
    }
    elk.fleeing = threat > 0;
    if (elk.fleeing) {
      elk.stamina = Math.max(0, elk.stamina - 12 * dt);
      const dAnchor = dist(elk.x, elk.y, ELK_DEF.anchor.x, ELK_DEF.anchor.y);
      if (dAnchor > ELK_DEF.leash) {  // leash pull keeps the hunt in the arena
        fx += (ELK_DEF.anchor.x - elk.x) / dAnchor * 120;
        fy += (ELK_DEF.anchor.y - elk.y) / dAnchor * 120;
      }
      const m = Math.hypot(fx, fy) || 1;
      const sp = elk.stamina > 25 ? 300 : 168;
      tryMove(elk, fx / m * sp * dt, fy / m * sp * dt, (x, y) => blockedAt(x, y, 14, false));
      elk.heading = Math.atan2(fy, fx);
    } else {
      elk.stamina = Math.min(100, elk.stamina + 8 * dt);
      elk.heading += (Math.random() - 0.5) * 1.5 * dt;
      tryMove(elk, Math.cos(elk.heading) * 26 * dt, Math.sin(elk.heading) * 26 * dt,
        (x, y) => blockedAt(x, y, 14, false) || dist(x, y, ELK_DEF.anchor.x, ELK_DEF.anchor.y) > ELK_DEF.leash);
    }

    // scent breadcrumbs
    S.scentDropT += dt;
  }
  if (S.scentDropT > 1.4) {
    S.scentDropT = 0;
    for (const elk of S.elk) S.scent.push({ x: elk.x, y: elk.y, t: S.time });
    if (S.scent.length > 400) S.scent.splice(0, S.scent.length - 400);
  }

  // the kill: a spent elk caught by any wolf
  for (let i = S.elk.length - 1; i >= 0; i--) {
    const elk = S.elk[i];
    if (elk.stamina > 25) continue;
    const caught = hunters.some(h => dist(elk.x, elk.y, h.x, h.y) < 22);
    if (caught) {
      S.elk.splice(i, 1);
      S.elkRespawn.push(day() + ELK_DEF.respawnDays);
      const sedge = S.pack.find(w => w.id === 'sedge');
      const sedgeIn = sedge && sedge.state !== 'dead' && sedge.state !== 'gone'
        && dist(sedge.x, sedge.y, elk.x, elk.y) < 500;
      S.food = Math.min(100, S.food + HUNT_FOOD + (sedgeIn ? 10 : 0));
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
    if (S.starveT > 120) {  // two hungry days and the strongest hunter walks
      sedge.state = 'gone';
      S.history.push({ type: 'loss', day: day(), who: 'sedge', dispersed: true });
      say('Sedge is gone. Hunger took her somewhere the map does not go.');
      saveGame();
    }
  } else {
    S.starveT = 0;
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

function startEnding(kind) {
  S.mode = 'ending';
  S.endKind = kind;
  S.endT = 0;
  clearSave();
}

// ── audio ────────────────────────────────────────────────────────────────────

let audioCtx = null;
function getAudioCtx() {
  const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

// The sound of the map being wrong. Reused by every tear, forever.
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

// ── save / load ──────────────────────────────────────────────────────────────

const SAVE_KEY = 'the-corridor-save-v1';
function storageOk() { return typeof localStorage !== 'undefined'; }

function saveGame() {
  if (!storageOk() || !S || S.mode === 'ending') return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1,
      clockMin: S.clock.min,
      wolf: { x: S.wolf.x, y: S.wolf.y },
      edges: S.edges.map(e => ({
        id: e.id, state: e.state, torn: e.torn, passCount: e.passCount,
        lastUsedDay: e.lastUsedDay, inkLo: e.inkLo, inkHi: e.inkHi,
        covLo: e.covLo, covHi: e.covHi,
      })),
      visited: [...S.visited], bridged: [...S.bridged],
      firstTear: S.firstTear,
      pack: S.pack.map(w => ({ id: w.id, x: w.x, y: w.y, state: w.state })),
      fear: S.fear, food: S.food,
      yearlingKnows: [...S.yearlingKnows],
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
  if (!d || d.v !== 1) return false;

  newGame();
  S.clock.min = d.clockMin; S.lastDay = day();
  S.wolf.x = d.wolf.x; S.wolf.y = d.wolf.y;
  S.trail = [{ x: S.wolf.x, y: S.wolf.y }];
  S.cam.x = S.wolf.x; S.cam.y = S.wolf.y;
  for (const se of d.edges) {
    const e = S.edges.find(x => x.id === se.id);
    if (e) Object.assign(e, se);
  }
  S.visited = new Set(d.visited); S.bridged = new Set(d.bridged);
  S.firstTear = d.firstTear;
  for (const sw of d.pack) {
    const w = S.pack.find(x => x.id === sw.id);
    if (w) { w.x = sw.x; w.y = sw.y; w.state = sw.state === 'balk' ? 'follow' : sw.state; }
  }
  S.fear = d.fear; S.food = d.food;
  S.yearlingKnows = new Set(d.yearlingKnows);
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
  S.clock.min += dt * MIN_PER_SEC;
  if (day() !== S.lastDay) { S.lastDay = day(); applyDecay(); }

  S.forcedSenseT = Math.max(0, S.forcedSenseT - dt);
  S.flickerT = Math.max(0, S.flickerT - dt);
  S.msgT = Math.max(0, S.msgT - dt);

  const sensing = input.sense || S.forcedSenseT > 0;
  S.senseBlend = clamp(S.senseBlend + (sensing ? dt / SENSE_IN : -dt / SENSE_OUT), 0, 1);

  // Aspen moves — unless she has stopped to remember
  let vx = 0, vy = 0;
  if (S.senseBlend < 0.25) {
    vx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    vy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  }
  if (vx || vy) {
    const m = Math.hypot(vx, vy);
    const rough = seasonIndex() === 3 ? SPEED_SNOW : SPEED_ROUGH;
    const sp = onKnownRoute() ? SPEED_ROUTE : rough;
    tryMove(S.wolf, vx / m * sp * dt, vy / m * sp * dt, wolfBlockedAt);
    S.wolf.heading = Math.atan2(vy, vx);
    S.wolf.moving = true;
  } else {
    S.wolf.moving = false;
  }

  traversalUpdate();
  tearCheck();
  packUpdate(dt);
  trafficUpdate(dt);
  elkUpdate(dt);
  hungerUpdate(dt);
  endingCheck();

  S.histT += dt;
  if (S.histT > 3) {
    S.histT = 0;
    S.history.push({ type: 'pos', day: day(), x: Math.round(S.wolf.x), y: Math.round(S.wolf.y) });
  }

  S.saveT += dt;
  if (S.saveT > 12) { S.saveT = 0; saveGame(); }

  // camera
  const targetScale = lerp(SCALE_WORLD, SCALE_MAP, smooth(S.senseBlend));
  S.cam.scale += (targetScale - S.cam.scale) * Math.min(1, dt * 8);
  S.cam.x += (S.wolf.x - S.cam.x) * Math.min(1, dt * 6);
  S.cam.y += (S.wolf.y - S.cam.y) * Math.min(1, dt * 6);
}
