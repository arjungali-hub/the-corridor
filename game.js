// The Corridor — game state and systems. No rendering here.
// data.js is loaded before this file; render.js and main.js after.

// ── constants ────────────────────────────────────────────────────────────────

const WOLF_R        = 12;
// Being in the general area of a path counts as walking it. Her mother's
// routes are broad ways through the land; new ground asks a little more
// precision; very long segments forgive more still.
function corridorFor(e) {
  const A = NbyId.get(e.a), B = NbyId.get(e.b);
  const long = dist(A.x, A.y, B.x, B.y) > 900 ? 50 : 0;
  return (e.state === 'inherited' ? 200 : 150) + long;
}
const COV_BUCKETS   = 10;    // ten stretches per edge; 8 of 10 (80%) is a pass
const COV_NEEDED    = 8;
const COV_FULL      = (1 << COV_BUCKETS) - 1;
const NODE_VISIT_R  = 70;
const SPEED_ROUGH   = 266;   // off-route — a shade quicker than the pack
const SPEED_ROUTE   = 298;   // along a known, untorn route
const SPEED_SNOW    = 216;   // off-route in winter
const INJURY_SPEED  = 0.7;   // while hurt
const INJURY_TIME   = 75;    // real seconds to heal — ticks even while a task holds the calendar
const MIN_PER_SEC   = 160;   // game minutes per real second (1 day ≈ 9 s; a year ≈ 54 min)
const SOLID_AT      = 3;     // full traversals to lift dotted → solid
// Ink decay keeps its tuned real-time pace across clock changes:
// solid fades after ~225 real s idle, dotted vanishes ~375 real s later.
const DECAY_SOLID_DAYS  = 25;
const DECAY_DOTTED_DAYS = 42;
const SENSE_IN      = 0.35;  // seconds to raise the map
const SENSE_OUT     = 0.5;   // the locked 0.5 s blend back
const SCALE_WORLD   = 1.1;
const SCALE_MAP     = 0.17;  // the map pulls well back — a document, not a lens
const APRON         = 600;   // land drawn beyond the walkable world — no black void
const SCALE_VISTA   = 0.5;
const YEAR_DAYS     = 360;
const WINTER_START  = 271;
// Survival pressure is priced in REAL time, decoupled from the fast
// calendar: the same pace it had at the old 48 min/s clock.
const FOOD_PER_SEC     = 0.15;
const PUP_FOOD_PER_SEC = 0.45;  // less than half the old pace — pups keep for minutes
const PUPS_BORN_DAY    = 75;
const PUPS_TRAVEL_DAY  = 240;
const DEN_DEADLINE_DAY = 70;
const CAR_SPEED     = 700;
const FEAR_NEAR_MISS = 0.22;
const FEAR_BALK     = 0.55;  // above this, packmates refuse the road
const INHERIT_HOLD  = 3.5;   // seconds of holding, at her side, at the end
const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
const SEASON_RITUAL = 5.5;   // seconds the season-turn map ghost holds

const OVERLOOK = { x: 2050, y: 1500 };  // beat 2 and beat 8 share this camera
const WILLOW_TONE_ID = 'willow';

// ── the seen-grid: the map remembers only what her own senses passed over ────
// Inheriting Willow's ROUTE is not the same as having SEEN the land. A coarse
// grid records where Aspen has actually been; the raised map fills in behind
// her, and unwalked ground — even where Willow's ink runs — reads as rumor.
const SEEN_CELL = 120;
const SIGHT_WORLD = 240;   // world-units of ground her senses register as seen
const GRID_W = Math.ceil((WORLD.w - (WORLD.x0 || 0)) / SEEN_CELL) + 1;
const GRID_H = Math.ceil(WORLD.h / SEEN_CELL) + 1;

function cellIndex(x, y) {
  const cx = Math.floor((x - (WORLD.x0 || 0)) / SEEN_CELL);
  const cy = Math.floor(y / SEEN_CELL);
  if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return -1;
  return cy * GRID_W + cx;
}

function markSeen(x, y, r) {
  if (!S.seen) return;
  const rc = Math.ceil(r / SEEN_CELL);
  const cx = Math.floor((x - (WORLD.x0 || 0)) / SEEN_CELL);
  const cy = Math.floor(y / SEEN_CELL);
  for (let dy = -rc; dy <= rc; dy++) {
    for (let dx = -rc; dx <= rc; dx++) {
      const gx = cx + dx, gy = cy + dy;
      if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) continue;
      if (dx * dx + dy * dy > rc * rc + 1) continue;
      S.seen[gy * GRID_W + gx] = 1;
    }
  }
}

function cellSeen(x, y) {
  const i = cellIndex(x, y);
  return i >= 0 && S.seen && S.seen[i] === 1;
}

// how much of an edge's line has been walked over (sampled), 0..1
function edgeSeenFrac(e) {
  const A = NbyId.get(e.a), B = NbyId.get(e.b);
  if (!A || !B) return 0;
  const pts = e.via ? [A, ...e.via, B] : [A, B];
  let seen = 0, n = 0;
  for (let s = 1; s < pts.length; s++) {
    for (let t = 0; t <= 1.0001; t += 0.2) {
      const x = lerp(pts[s - 1].x, pts[s].x, t), y = lerp(pts[s - 1].y, pts[s].y, t);
      n++; if (cellSeen(x, y)) seen++;
    }
  }
  return n ? seen / n : 0;
}

function nodeSeen(id) {
  const n = NbyId.get(id);
  return !!n && cellSeen(n.x, n.y);
}

// mark the corridor along a chain of nodes as seen (she walked it)
function seedSeenAlong(ids) {
  for (let i = 0; i < ids.length; i++) {
    const n = NbyId.get(ids[i]);
    if (n) markSeen(n.x, n.y, SIGHT_WORLD);
    if (i > 0) {
      const p = NbyId.get(ids[i - 1]);
      if (p && n) for (let t = 0; t <= 1; t += 0.05) markSeen(lerp(p.x, n.x, t), lerp(p.y, n.y, t), SIGHT_WORLD);
    }
  }
}

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
// herd anchors migrate during the year; remember where they truly live
for (const H of HERDS) H.anchor0 = { x: H.anchor.x, y: H.anchor.y };

// Individual trees. Far scarcer than a solid canopy — loose groves you weave
// through, each a real obstacle: its trunk blocks wolves and prey in the
// present. Shared by render (to draw) and collision (to block), and carved
// away from nodes, den sites, herd anchors, ponds, and the road so nothing
// critical is ever walled in or made unstandable.
const TREE_R = 0.42;   // collision radius as a fraction of the canopy size
const TREES = (() => {
  const clearings = [];
  for (const n of NODES) clearings.push({ x: n.x, y: n.y, r: 76 });
  for (const s of DEN_SITES) clearings.push({ x: s.x, y: s.y, r: 76 });
  for (const H of HERDS) clearings.push({ x: H.anchor.x, y: H.anchor.y, r: 96 });
  for (const p of PONDS) clearings.push({ x: p.x, y: p.y, r: p.r + 42 });
  if (TERRAIN.springsPond) clearings.push({ x: TERRAIN.springsPond.x, y: TERRAIN.springsPond.y, r: TERRAIN.springsPond.r + 42 });
  const clear = (x, y) => {
    if (x > 800 && x < 1040) return false;   // the road bed and its shoulders
    for (const c of clearings) if ((x - c.x) ** 2 + (y - c.y) ** 2 < c.r * c.r) return false;
    return true;
  };
  const out = [];
  for (const f of TERRAIN.forests) {
    const rng = makePrng(hashStr('grove' + f.x + ',' + f.y));
    const n = Math.max(3, Math.round(f.r * f.r / 5600));
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * f.r;
      const x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d;
      const s = 13 + rng() * 15;                 // canopy draw size
      if (clear(x, y)) out.push({ x, y, s });
    }
  }
  const lrng = makePrng(4242);
  const X0 = WORLD.x0 || 0;
  for (let i = 0; i < 60; i++) {
    const x = X0 + lrng() * WORLD.w, y = lrng() * WORLD.h;
    const s = 11 + lrng() * 12;
    if (clear(x, y)) out.push({ x, y, s });
  }
  return out;
})();

// A tree's trunk blocks — but only in the present; the scripted prologue paths
// run clear (matching how the built obstacles hold off until Act I).
function inTreeAt(x, y, pad) {
  if (!S || S.era === 'past') return false;
  for (const t of TREES) {
    const cr = t.s * TREE_R + pad;
    const dx = x - t.x; if (dx > cr || dx < -cr) continue;
    const dy = y - t.y; if (dy > cr || dy < -cr) continue;
    if (dx * dx + dy * dy < cr * cr) return true;
  }
  return false;
}

// The construction grows a little every season: the effective footprint of
// the machines' ground expands, and its tear zone with it.
function obstacleRect(key) {
  const o = OBSTACLES[key];
  if (key !== 'construction' || !S || S.era === 'past') return o;
  const g = seasonIndex() * 80;
  return { x0: o.x0 - g, y0: o.y0 - g * 0.5, x1: o.x1 + g, y1: o.y1 + g * 0.5 };
}

// Every wound has a name — shown on the map, and asked for by the urges
const TEAR_NAMES = {
  blackriver: 'the Black River', machines: 'the broken ground at Fence Line',
  drycreek: 'the drowned Bend', gravelpit: 'the pit', railline: 'the rail line',
};

// The rip on the map traces the obstacle itself, almost exactly
function footprintOutline(key) {
  const o = obstacleRect(key);
  if (o.r !== undefined) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      pts.push([o.x + Math.cos(a) * (o.r + 24), o.y + Math.sin(a) * (o.r + 24)]);
    }
    return pts;
  }
  return [[o.x0 - 24, o.y0 - 24], [o.x1 + 24, o.y0 - 24], [o.x1 + 24, o.y1 + 24],
          [o.x0 - 24, o.y1 + 24], [o.x0 - 24, o.y0 - 24]];
}

// A path is not a ruler. Where an obstacle stands between two nodes, the
// walked way curves around it — one derived waypoint per obstruction.
function edgeVia(A, B) {
  const vias = [];
  const ms = OBSTACLES.mudSink;
  const hit = distSeg(ms.x, ms.y, A.x, A.y, B.x, B.y);
  if (hit.d < ms.r + 150 && hit.t > 0.06 && hit.t < 0.94) {
    const px = A.x + (B.x - A.x) * hit.t, py = A.y + (B.y - A.y) * hit.t;
    const n = Math.hypot(px - ms.x, py - ms.y) || 1;
    vias.push({ t: hit.t, x: ms.x + (px - ms.x) / n * (ms.r + 170), y: ms.y + (py - ms.y) / n * (ms.r + 170) });
  }
  for (const key of ['construction', 'subdivision', 'gravelPit']) {
    const o = OBSTACLES[key];
    const cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2;
    const orad = Math.hypot(o.x1 - o.x0, o.y1 - o.y0) / 2;
    const h2 = distSeg(cx, cy, A.x, A.y, B.x, B.y);
    if (h2.d < orad + 100 && h2.t > 0.06 && h2.t < 0.94) {
      const px = A.x + (B.x - A.x) * h2.t, py = A.y + (B.y - A.y) * h2.t;
      const n = Math.hypot(px - cx, py - cy) || 1;
      vias.push({ t: h2.t, x: cx + (px - cx) / n * (orad + 150), y: cy + (py - cy) / n * (orad + 150) });
    }
  }
  vias.sort((u, v) => u.t - v.t);
  return vias.length ? vias.map(v => ({ x: v.x, y: v.y })) : undefined;
}

for (const d of EDGES) {
  const A = NbyId.get(d.a), B = NbyId.get(d.b);
  if (A && B) d.via = edgeVia(A, B);
}

// distance to the WALKED path of an edge (curved where it curves), and the
// true 0..1 parameter along its whole length
function distToEdgePath(e) {
  const A = NbyId.get(e.a), B = NbyId.get(e.b);
  const pts = e.via ? [A, ...e.via, B] : [A, B];
  let total = 0;
  const lens = [];
  for (let i = 1; i < pts.length; i++) {
    const L = dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    lens.push(L); total += L;
  }
  let best = { d: Infinity, t: 0 }, acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const r = distSeg(S.wolf.x, S.wolf.y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    if (r.d < best.d) best = { d: r.d, t: (acc + r.t * lens[i - 1]) / (total || 1) };
    acc += lens[i - 1];
  }
  return best;
}

// ── game state ───────────────────────────────────────────────────────────────

const input = { up: false, down: false, left: false, right: false, sense: false, scent: false, drink: false };

let S = null;

function newGame() {
  stripDynamicDen();   // a den dug last year is not part of the eternal graph
  for (const H of HERDS) { H.anchor.x = H.anchor0.x; H.anchor.y = H.anchor0.y; }
  S = {
    mode: 'intro',           // intro | prologue | play | ending
    era: 'present',          // 'past' during prologue beats 1–7
    wantPrologue: !prologueDone(),
    clock: { min: 8 * 60 },
    lastDay: 1,

    wolf: { x: DEN.x, y: DEN.y, heading: -Math.PI / 2, moving: false, gait: 0 },
    seen: new Uint8Array(GRID_W * GRID_H),   // the map's memory of walked ground
    injuredT: 0,
    roadEntrySide: null,
    wolfWasOnRoad: false,
    roadGraceT: 0,       // while > 0, driven prey may follow her across
    packFrozen: false,   // terror: the pack flees to safety, then roots there
    fearSource: null,    // where the last terror came from — what they flee

    edges: EDGES.map(d => ({
      id: d.id, a: d.a, b: d.b, tearGroup: d.tearGroup, via: d.via,
      state: d.state, torn: false,
      passCount: 0, lastUsedDay: 1,
      inkLo: 1, inkHi: 0,
      covBits: 0,
    })),
    visited: new Set(['den']),
    bridged: new Set(),
    foundPaths: {},   // tear key -> the short way she actually walked around it
    ghostNodes: new Set(),
    ghostEdges: new Set(),
    firstTear: false,
    pendingForcedSense: false,

    mapOpen: false,
    senseBlend: 0, forcedSenseT: 0, flickerT: 0, shake: 0,
    cam: { x: DEN.x, y: DEN.y, scale: SCALE_WORLD },

    hud: { pack: false, food: false, fear: false, day: false, pups: false },
    tut: {
      step: 0, t: 0, moved: 0,
      sawMap: false, scentHold: 0, usedHold: false, fTaught: false,
      fearSeen: false, violetSeen: false, ownInkSeen: false, redSeen: false,
      tearPrompt: false, goalSet: false, taughtHelp: false, denPrompt: false,
      routeTaught: false,
      lastStarveDay: 0,
    },
    prompt: null, promptQueue: [], promptGap: 0,
    guide: null,               // a soft chevron toward somewhere she must find
    callouts: [],
    calloutActive: null,
    showHelp: false,
    confirmNewYearT: 0,
    routeTo: null, routePath: null, routeT: 0,   // the way she has in mind
    zoneAnchor: null,                            // F pins the pack's zone here

    // the rancher: a hidden, permanent ledger — never shown, always kept
    conflict: 0, seenCd: 0, shotCd: 0,
    dogs: [
      { x: RANCH.dogHome.x - 20, y: RANCH.dogHome.y, heading: 0, gait: 0, moving: false, biteCd: 0 },
      { x: RANCH.dogHome.x + 20, y: RANCH.dogHome.y + 24, heading: 0, gait: 0, moving: false, biteCd: 0 },
    ],
    gift: { given: false, taken: false },
    alarm: 0,                                    // the silence zone's rising light
    standoff: null, standoffCd: 0,               // rivals: {t, rivals:[{x,y,...}]}
    lichenJoined: false,
    // the fire picks its own summer day, once per year
    fire: { state: 'none', t: 0, day: 115 + Math.floor(Math.random() * 45) },
    weather: null,     // spells of sky: sun | cloud | rain, a few days each
    wind: { a: Math.random() * Math.PI * 2 },   // the direction it blows toward
    overpassCross: 0,  // conducted pack crossings; at 3 the bridge is trusted
    seasonGhostT: 0,   // the season ritual: her mother's map, ghosted over now
    sedgeMark: null,   // where Sedge went, if hunger took her
    lastSeason: 0, bondT: 0, bondC: null,

    pack: PACK_DEF.map((d, i) => ({
      ...d, x: DEN.x - 30 * (i + 1), y: DEN.y + 20 * (i % 2 ? 1 : -1),
      state: 'follow', gait: 0, moving: false,
    })),
    trail: [{ x: DEN.x, y: DEN.y }],
    fear: 0,
    food: 70,
    water: 90, sickT: 0,          // thirst beside hunger; wrong water costs
    snares: [], snaredT: 0,       // steel by the wire, once the ledger rises
    roadkill: null,               // what the road leaves on its shoulder
    trains: [], trainCd: 25,      // what runs on the rail — lethal, even to her
    rumorsSeen: [],               // inherited notes she has walked to and cashed
    foundWater: [],               // clean springs a rumor resolved into being
    vantageT: 0,                  // a high place briefly widens her sight
    // the western pack: spatial pressure on the winter-range approach
    exposure: 0,                  // 0..1, how much they know she is here
    westState: 'none',            // none | calm | sighting | confrontation | clash
    westRivals: [],               // rival wolf positions, shown at sighting+
    westLaneT: 0,                 // a won lane stays open this long
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
    inputLockT: 0, vistaT: 0, vistaTMax: 0, vistaWait: false,
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
  deriveTriggers();
  recomputeGhosts();
}

// Tears mirror the obstacles that cause them: any group naming a footprint
// gets its trigger computed from the obstacle itself, not a hand-set circle.
function deriveTriggers() {
  for (const g of TEAR_GROUPS) {
    if (g.autoRip) { delete g.ripPath; g.autoRip = false; }   // last year's shape
    if (!g.footprint) continue;
    const o = OBSTACLES[g.footprint];
    if (o.r !== undefined) {
      g.trigger = { x: o.x, y: o.y, r: o.r + 70 };
    } else {
      g.trigger = {
        x: (o.x0 + o.x1) / 2, y: (o.y0 + o.y1) / 2,
        r: Math.max(o.x1 - o.x0, o.y1 - o.y0) / 2 + 70,
      };
    }
  }
}

function spawnPrey(herdIdx) {
  const H = HERDS[herdIdx];
  // never spawn inside blocked ground (the pit, the impoundment, buildings)
  let px = H.anchor.x, py = H.anchor.y;
  for (let tries = 0; tries < 14; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = 80 + Math.random() * Math.max(60, H.leash - 120);
    const cx = H.anchor.x + Math.cos(a) * r, cy = H.anchor.y + Math.sin(a) * r;
    if (!blockedAt(cx, cy, 14, false, APRON)) { px = cx; py = cy; break; }
  }
  const elk = {
    herd: herdIdx,
    x: px, y: py,
    heading: Math.random() * Math.PI * 2, stamina: 100, fleeing: false,
    gait: 0,
    bull: H.antlers && Math.random() < 0.4,
    skittish: H.cattle ? 0.45 : 0.75 + Math.random() * 0.5,
    // the lean west: winter spawns on the far side are warier and thinner —
    // every calorie on the final corridor is earned
    wary: seasonIndex() === 3 && !H.cattle && H.anchor.x <= OBSTACLES.highway.x1,
    grazeT: Math.random() * 6,
    tx: 0, ty: 0,
  };
  pickGrazeTarget(elk);
  S.elk.push(elk);
}

// the powerline cut is open ground under a hum — nothing grazes there
function inPowerlineCut(x, y) {
  if (S.era === 'past') return false;
  return distSeg(x, y, POWERLINE.x0, POWERLINE.y0, POWERLINE.x1, POWERLINE.y1).d < 60;
}

function pickGrazeTarget(elk) {
  const H = HERDS[elk.herd];
  for (let tries = 0; tries < 10; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * Math.max(60, H.leash - 80);
    const tx = H.anchor.x + Math.cos(a) * r, ty = H.anchor.y + Math.sin(a) * r;
    if (blockedAt(tx, ty, 14, false, APRON)) continue;  // never aim into a wall
    if (inPowerlineCut(tx, ty)) continue;               // nor under the wires
    elk.tx = tx; elk.ty = ty;
    break;
  }
  elk.grazeT = 3 + Math.random() * 9;
}

function day() { return Math.floor(S.clock.min / 1440) + 1; }
function seasonIndex() { return clamp(Math.floor((day() - 1) / 90), 0, 3); }
function seasonName() { return SEASONS[seasonIndex()]; }
function isInjured() { return S.injuredT > 0; }

function say(text) { S.msg = text; S.msgT = 7; }
function setCaption(text, dur, sub) { S.caption = { text, sub: sub || '', t: 0, dur: dur || 4 }; }

// A prologue "look here" marker: names a creature and points at it while it is
// introduced. The tag is resolved to a live position every frame so the caret
// tracks a moving animal; render draws a caret over it, or an edge chevron if
// it has drifted off-screen.
// A held overlook/CUT vista lowers on any key: it drops through its fade-out
// and hands the beat forward.
function releaseVista() {
  if (!S.vistaWait) return;
  S.vistaWait = false;
  S.vistaT = Math.min(S.vistaT, 1.0);       // count down through the fade-out
  S.inputLockT = Math.min(S.inputLockT, 1.0);
  S.caption = null;
  if (S.mode === 'prologue') {
    if (S.beat === 2) { S.beat = 3; S.beatT = 0; }
    else if (S.beat === 8) { S.beatT = 999; }   // lets the beat-9 hand-off fire
  }
}

function pointOut(tag, dur) { S.pointTag = tag; S.pointTagT = dur || 3.4; }
function resolvePointTarget(tag) {
  if (tag === 'aspen') return S.wolf;
  if (tag === 'willow') return S.willow;
  if (tag === 'elk') return S.elk[0];
  if (tag === 'yearlings') {
    const ys = S.pack.filter(p => p.yearling && p.state !== 'gone' && p.state !== 'dead');
    if (ys.length) return { x: (ys[0].x + (ys[1] || ys[0]).x) / 2, y: (ys[0].y + (ys[1] || ys[0]).y) / 2 };
    return null;
  }
  return S.pack.find(p => p.id === tag) || null;
}

// ── movement & collision ─────────────────────────────────────────────────────

// The overpass opens when the machines finish it: from then on its band of
// the road is earth, not asphalt. But it REEKS of people, and nothing has
// ever used it — adoption is played, not told. Aspen may scout it from day
// one; her pack refuses the deck until she crosses first and calls them
// (the F-conduct verb), and only after three conducted pack crossings is
// the bridge trusted. Prey won't set a hoof on it until then.
const OVERPASS_OPEN_DAY = 170;
function overpassOpen() {
  return S && S.era !== 'past' && day() >= OVERPASS_OPEN_DAY;
}
function overpassTrusted() {
  return S && (S.overpassCross || 0) >= 3;
}
function onDeck(x, y) {
  const h = OBSTACLES.highway, o = OBSTACLES.overpass;
  return x > h.x0 - 8 && x < h.x1 + 8 && y > o.y0 && y < o.y1;
}
// the rail ballast, where the trains run — deadly ground, never ambled onto
function onRail(x, y) {
  if (!S || S.era === 'past') return false;
  const rl = OBSTACLES.rail;
  if (x <= rl.x0 - 8 || x >= rl.x1 + 8) return false;
  if (y > rl.gapY0 && y < rl.gapY1) return false;   // under the trestle
  return true;
}

// asphalt, an untrusted deck, or the rail: the pack refuses them all
// unless Aspen is on it or already across, calling them through
function packRefuses(x, y) {
  return onRoad(x, y) || onRail(x, y)
    || (onDeck(x, y) && overpassOpen() && !overpassTrusted());
}

// The bridge at Water-Under-Stone crosses OVER the road: its deck (the gap
// band) never connects to the asphalt at grade. Thin walls seal the deck's
// north and south edges wherever they meet the road, so road→bridge and
// bridge→road are both impossible mid-span. The overpass deck is sealed
// the same way once it stands.
function bridgeWallAt(x, y, r) {
  if (S.era === 'past') return false;
  const h = OBSTACLES.highway;
  if (x <= h.x0 - 8 - r || x >= h.x1 + 8 + r) return false;
  if (Math.abs(y - h.gapY0) < 8 + r || Math.abs(y - h.gapY1) < 8 + r) return true;
  if (overpassOpen()) {
    const o = OBSTACLES.overpass;
    if (Math.abs(y - o.y0) < 8 + r || Math.abs(y - o.y1) < 8 + r) return true;
  }
  return false;
}

function blockedAt(x, y, r, canPassGap, margin) {
  const m = margin || 0;
  if (x < (WORLD.x0 || 0) + r - m || y < r - m || x > WORLD.w - r + m || y > WORLD.h - r + m) return true;
  // the rail line: fenced ballast, impassable but for the trestle
  if (S.era !== 'past') {
    const rl = OBSTACLES.rail;
    if (x > rl.x0 - r && x < rl.x1 + r
        && !(y > rl.gapY0 + r && y < rl.gapY1 - r)) return true;
  }
  const h = OBSTACLES.highway;
  if (x > h.x0 - r && x < h.x1 + r) {
    const inGap = canPassGap && y > h.gapY0 + r && y < h.gapY1 - r;
    // the overpass, once open AND trusted, is ground: prey follow the
    // wolves' example, never the other way around
    const o = OBSTACLES.overpass;
    const inOverpass = overpassOpen() && overpassTrusted() && y > o.y0 + r && y < o.y1 - r;
    // prey never sets foot on the road — unless Aspen is on it (or just
    // was, and the chase spills across), or the fire is driving everything
    // west in a truce of panic
    const driven = S.roadGraceT > 0 || (S.fire && S.fire.state === 'burning');
    if (!inGap && !inOverpass && !driven) return true;
  }
  if (bridgeWallAt(x, y, r)) return true;
  if (S.era === 'past') return false;  // none of it has been built yet
  if (inTreeAt(x, y, r)) return true;
  for (const key of ['construction', 'subdivision', 'gravelPit']) {
    const c = obstacleRect(key);
    if (x > c.x0 - r && x < c.x1 + r && y > c.y0 - r && y < c.y1 + r) return true;
  }
  const ms = OBSTACLES.mudSink;
  if (dist(x, y, ms.x, ms.y) < ms.r + r) return true;
  const f = OBSTACLES.fence;
  if (distSeg(x, y, f.x0, f.y0, f.x1, f.y1).d < r + 5) return true;
  return false;
}

// Wolves are blocked by fences and buildings but NOT by the road surface —
// the road can be walked onto. That is the whole problem with it.
// `margin` lets pack wolves roam the apron; Aspen never gets one.
function wolfBlockedAt(x, y, margin) {
  const m = margin || 0;
  if (x < (WORLD.x0 || 0) + WOLF_R - m || y < WOLF_R - m || x > WORLD.w - WOLF_R + m || y > WORLD.h - WOLF_R + m) return true;
  // the rail ballast is WALKABLE for wolves — crossing it is a choice.
  // What makes it a wall is what runs on it.
  if (bridgeWallAt(x, y, WOLF_R)) return true;
  // in the prologue the road cannot be stepped onto until Willow shows how
  if (S.mode === 'prologue' && !S.tut._b5go) {
    const h = OBSTACLES.highway;
    if (x > h.x0 - 8 - WOLF_R && x < h.x1 + 8 + WOLF_R) return true;
  }
  if (S.era === 'past') return false;
  if (inTreeAt(x, y, WOLF_R)) return true;
  for (const key of ['construction', 'subdivision', 'gravelPit']) {
    const c = obstacleRect(key);
    if (x > c.x0 - WOLF_R && x < c.x1 + WOLF_R && y > c.y0 - WOLF_R && y < c.y1 + WOLF_R) return true;
  }
  const ms = OBSTACLES.mudSink;
  if (dist(x, y, ms.x, ms.y) < ms.r + WOLF_R) return true;
  const f = OBSTACLES.fence;
  if (distSeg(x, y, f.x0, f.y0, f.x1, f.y1).d < WOLF_R + 5) return true;
  return false;
}

function packBlockedAt(x, y) { return wolfBlockedAt(x, y, APRON); }

function tryMove(who, dx, dy, blockFn) {
  const nx = who.x + dx;
  if (!blockFn(nx, who.y)) who.x = nx;
  const ny = who.y + dy;
  if (!blockFn(who.x, ny)) who.y = ny;
}

function onRoad(x, y) {
  const h = OBSTACLES.highway;
  if (x <= h.x0 - 8 || x >= h.x1 + 8) return false;
  if (y > h.gapY0 && y < h.gapY1) return false;
  const o = OBSTACLES.overpass;
  if (overpassOpen() && y > o.y0 && y < o.y1) return false;   // earth up here
  return true;
}

function onKnownRoute() {
  for (const e of S.edges) {
    if (e.torn || e.state === 'unknown') continue;
    if (distToEdgePath(e).d < 40) return true;
  }
  return false;
}

function moveAspen(dt) {
  // held fast: a sprung snare pins her while she wrenches free
  if ((S.snaredT || 0) > 0) { S.wolf.moving = false; return; }
  let vx = 0, vy = 0;
  if (S.senseBlend < 0.25 && S.inputLockT <= 0) {
    vx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    vy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  }
  if (vx || vy) {
    const m = Math.hypot(vx, vy);
    const rough = seasonIndex() === 3 && S.mode === 'play' ? SPEED_SNOW : SPEED_ROUGH;
    let sp = onKnownRoute() ? SPEED_ROUTE : rough;
    // the penalties stack, but never past a floor: directed effort must
    // always be able to reach clean water before starving (no death spiral)
    let penalty = 1;
    if (isInjured()) penalty *= INJURY_SPEED;
    if ((S.sickT || 0) > 0) penalty *= 0.6;   // wrong water — badly slow
    if (S.water <= 0) penalty *= 0.85;        // thirst dulls everything
    if (waterAt(S.wolf.x, S.wolf.y)) penalty *= 0.7;   // wading drags at her legs
    sp *= Math.max(0.5, penalty);
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

// Bram is the pack's stale memory: beside him, the far side of a tear shows
// clearer on the raised map — he walked those edges, before
function bramRemembers() {
  if (!S.ghostEdges.size) return false;
  const b = S.pack.find(w => w.id === 'bram');
  return !!b && b.state !== 'dead' && b.state !== 'gone'
    && dist(b.x, b.y, S.wolf.x, S.wolf.y) < 300;
}

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
    // a found short-way around a tear reconnects its two ends
    for (const g of TEAR_GROUPS) {
      if (!S.foundPaths[g.key]) continue;
      const a = g.chain[0], b = g.chain[g.chain.length - 1];
      const nb = a === nid ? b : b === nid ? a : null;
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
  // a fully-walked path names both of its ends on the map
  S.visited.add(e.a); S.visited.add(e.b);
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
    const { d, t } = distToEdgePath(e);
    if (d >= corridorFor(e)) continue;
    // Honest-but-generous knowledge: walking MOST of the edge (6 of 8
    // stretches, in however many visits) counts as a full pass.
    e.covBits |= 1 << Math.min(COV_BUCKETS - 1, Math.floor(t * COV_BUCKETS));
    if (e.state === 'unknown') { e.inkLo = Math.min(e.inkLo, t); e.inkHi = Math.max(e.inkHi, t); }
    let covered = 0;
    for (let bit = 0; bit < COV_BUCKETS; bit++) if (e.covBits & (1 << bit)) covered++;
    if (covered >= COV_NEEDED) {
      completeTraversal(e);
      e.covBits = 0;
    }
  }
  for (const n of NODES) {
    if (!S.visited.has(n.id) && dist(S.wolf.x, S.wolf.y, n.x, n.y) < NODE_VISIT_R) {
      const wasKnown = nodeKnownG(n.id);
      S.visited.add(n.id);
      // new territory names itself as she arrives
      if (!wasKnown && S.mode === 'play') say(`${n.name}. She will remember it.`);
    }
  }
  // arriving where she meant to go clears the way she had in mind
  if (S.routeTo) {
    const t = routeTargetPos();
    if (!t || dist(S.wolf.x, S.wolf.y, t.x, t.y) < NODE_VISIT_R) {
      S.routeTo = null;
      S.routePath = null;
    } else {
      S.routeT += 1 / 60;
      if (S.routeT > 2) {
        S.routeT = 0;
        S.routePath = computeRoute(S.routeTo.startsWith('site:')
          ? nearestKnownNodeTo(t.x, t.y) : S.routeTo);
      }
    }
  }
}

// Anywhere around the human-made thing is close enough to see what it did:
// distance to the footprint itself, not only the derived trigger circle.
function nearFootprint(g, margin) {
  if (!g.footprint) return false;
  const o = obstacleRect(g.footprint);
  if (o.r !== undefined) return dist(S.wolf.x, S.wolf.y, o.x, o.y) < o.r + margin;
  const dx = Math.max(o.x0 - S.wolf.x, 0, S.wolf.x - o.x1);
  const dy = Math.max(o.y0 - S.wolf.y, 0, S.wolf.y - o.y1);
  return Math.hypot(dx, dy) < margin;
}

// ...or near the tear's own PHYSICAL line — its rip path — never the
// abstract edges: the damage must be inside her (close-camera) vision
// before the map admits it
function nearTearLine(g, margin) {
  if (!g.ripPath) return false;
  for (let i = 1; i < g.ripPath.length; i++) {
    const [ax, ay] = g.ripPath[i - 1], [bx, by] = g.ripPath[i];
    if (distSeg(S.wolf.x, S.wolf.y, ax, ay, bx, by).d < margin) return true;
  }
  return false;
}

function tearCheck() {
  for (const g of TEAR_GROUPS) {
    if (groupTorn(g)) continue;
    if (dist(S.wolf.x, S.wolf.y, g.trigger.x, g.trigger.y) < g.trigger.r
        || nearFootprint(g, 150) || nearTearLine(g, 150)) {
      for (const eid of g.edges) S.edges.find(e => e.id === eid).torn = true;
      // the rip takes the obstacle's own shape, as it stands today
      if (g.footprint && !g.ripPath) { g.ripPath = footprintOutline(g.footprint); g.autoRip = true; }
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
      // a tear is a plan that no longer exists
      if (S.routeTo) {
        const tp = routeTargetPos();
        const p = tp ? computeRoute(S.routeTo.startsWith('site:')
          ? nearestKnownNodeTo(tp.x, tp.y) : S.routeTo) : null;
        if (!p && S.routePath) say('The way she had in mind is gone.');
        S.routePath = p;
      }
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

// A bridge records that she found a way past the tear. If she went the SHORT
// way — right around the rip, on her own feet — that walked path (foundPath) is
// kept and becomes a new inked route on the map, connecting the tear's two
// ends. The graph detour (checkBridges) has no foundPath: its new path is the
// detour edges she inked.
function doBridge(g, foundPath) {
  S.bridged.add(g.key);
  if (foundPath && foundPath.length >= 2) {
    S.foundPaths[g.key] = foundPath;
    S.visited.add(g.chain[0]); S.visited.add(g.chain[g.chain.length - 1]);
  }
  playPatchChime();
  S.history.push({ type: 'bridge', day: day(), group: g.key });
  say(foundPath ? 'A new way around, right past the tear. She will remember it.'
                : 'A new way around. She will remember it.');
  recomputeGhosts();
}

function simplifyPath(seg) {
  if (!seg.length) return [];
  const out = [seg[0]];
  for (let i = 1; i < seg.length; i++) {
    const last = out[out.length - 1];
    if (i === seg.length - 1 || dist(seg[i].x, seg[i].y, last.x, last.y) > 45) out.push(seg[i]);
  }
  return out.map(p => [Math.round(p.x), Math.round(p.y)]);
}
function pathLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
// the found short-way around a tear, keyed by its two chain endpoints
function foundTearBetween(idA, idB) {
  for (const g of TEAR_GROUPS) {
    if (!S.foundPaths[g.key]) continue;
    const a = g.chain[0], b = g.chain[g.chain.length - 1];
    if ((a === idA && b === idB) || (a === idB && b === idA)) return g;
  }
  return null;
}

function checkBridges() {
  for (const g of TEAR_GROUPS) {
    if (!groupTorn(g) || S.bridged.has(g.key)) continue;
    const a = g.chain[0], b = g.chain[g.chain.length - 1];
    if (a === b) continue;
    if (newInkPath(a, b)) doBridge(g);
  }
}

function checkBridges() {
  for (const g of TEAR_GROUPS) {
    if (!groupTorn(g) || S.bridged.has(g.key)) continue;
    const a = g.chain[0], b = g.chain[g.chain.length - 1];
    if (a === b) continue;
    if (newInkPath(a, b)) doBridge(g);
  }
}

// Finding a way around is what it says: ANY walked route from one side of
// the rip to the other, in either direction, that skirts the obstacle and
// never gambles on the asphalt — her feet are the ink that matters, whether
// or not they followed the graph.
function inFootprint(g, x, y, margin) {
  if (!g.footprint) return false;
  const o = obstacleRect(g.footprint);
  if (o.r !== undefined) return dist(x, y, o.x, o.y) < o.r + margin;
  return x > o.x0 - margin && x < o.x1 + margin && y > o.y0 - margin && y < o.y1 + margin;
}

function trailLegClear(g, i0, i1) {
  const lo = Math.min(i0, i1), hi = Math.max(i0, i1);
  for (let k = lo; k <= hi; k++) {
    const p = S.trail[k];
    if (inFootprint(g, p.x, p.y, 16) || onRoad(p.x, p.y)) return false;
  }
  return true;
}

function freeformBridgeCheck() {
  for (const g of TEAR_GROUPS) {
    if (!groupTorn(g) || S.bridged.has(g.key)) continue;
    const A = NbyId.get(g.chain[0]), B = NbyId.get(g.chain[g.chain.length - 1]);
    if (!A || !B || A === B) continue;
    let ai = -1, bi = -1;
    const leg = (lo, hi, rev) => {
      const seg = S.trail.slice(Math.min(lo, hi), Math.max(lo, hi) + 1).map(p => ({ x: p.x, y: p.y }));
      if (rev) seg.reverse();   // always store the path oriented chain[0] -> chain[last]
      return simplifyPath(seg);
    };
    for (let i = 0; i < S.trail.length; i++) {
      const p = S.trail[i];
      if (dist(p.x, p.y, A.x, A.y) < 170) {
        if (bi >= 0 && trailLegClear(g, bi, i)) { doBridge(g, leg(bi, i, true)); break; }
        ai = i;
      }
      if (dist(p.x, p.y, B.x, B.y) < 170) {
        if (ai >= 0 && trailLegClear(g, ai, i)) { doBridge(g, leg(ai, i, false)); break; }
        bi = i;
      }
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

// ── weather: spells of sky, a few days each ─────────────────────────────────
// Sun is the land's default. Cloud pulls the map's horizon in. Rain washes
// the scent stories out of the grass and darkens the light.
function weatherUpdate(dt) {
  if (S.era === 'past') { S.weather = { kind: 'sun', t: 0, dur: 30 }; return; }
  if (!S.weather) S.weather = { kind: 'sun', t: 0, dur: 20 + Math.random() * 15 };
  const w = S.weather;
  w.t += dt;
  if (w.t >= w.dur) {
    const r = Math.random();
    w.kind = r < 0.5 ? 'sun' : r < 0.78 ? 'cloud' : 'rain';
    w.t = 0;
    w.dur = 15 + Math.random() * 15;   // three to six days of it
    // a new sky brings a new wind
    if (S.wind) S.wind.a += (Math.random() - 0.5) * 2.4;
  }
  if (w.kind === 'rain') {
    // the grass forgets faster in the wet
    for (const p of S.scent) p.t -= dt * 2;
  }
  // and between skies, the wind wanders on its own
  if (S.wind) S.wind.a += (Math.random() - 0.5) * 0.12 * dt;
}

// The map's visible radius: a little over half the land's width — less
// under a grey ceiling.
function senseRadius() {
  return (WORLD.w - (WORLD.x0 || 0)) * 0.5 * (S.weather && S.weather.kind === 'cloud' ? 0.72 : 1);
}

// How far her senses reach in PLAY, in WORLD units — canvas-independent, so
// every monitor sees the same extent regardless of screen size. Night, human
// noise, and weather pull it in until a road crossing forces map-reliance.
function playSightWorld() {
  let r = SIGHT_WORLD;
  const v = clamp(violetAt(S.wolf.x, S.wolf.y), 0, 1);
  r *= 1 - 0.5 * v;                              // human chemical noise blinds the nose
  if (typeof daylight === 'function') r *= 0.5 + 0.5 * clamp(daylight(), 0, 1);   // deep night halves it
  if (S.weather) {
    if (S.weather.kind === 'rain') r *= 0.82;
    else if (S.weather.kind === 'cloud') r *= 0.9;
  }
  if ((S.vantageT || 0) > 0) r *= 1.7;           // high ground opens the land
  return Math.max(90, r);                        // a road at night in violet ≈ 90u: move on memory
}

// B1: hunger is a compass. When the near ground is hunted out, the NEXT food
// lives in a herd-region she has not reached — advertised only as a bearing
// (direction, never a dot), strengthening as she starves. Crossing into the
// region is what resolves the animals in the porthole.
function preyBearing() {
  if (!S || S.food > 55 || S.era === 'past') return null;
  const counts = {};
  for (const e of S.elk) if (!HERDS[e.herd].cattle) counts[e.herd] = (counts[e.herd] || 0) + 1;
  const reach = playSightWorld() * 1.3;
  let best = null, bd = Infinity;
  for (let h = 0; h < HERDS.length; h++) {
    if (!counts[h]) continue;                       // no living prey there
    const H = HERDS[h];
    const d = dist(S.wolf.x, S.wolf.y, H.anchor.x, H.anchor.y);
    if (d < reach) continue;                         // already within her reach
    if (d < bd) { bd = d; best = H; }
  }
  if (!best) return null;
  return {
    a: Math.atan2(best.anchor.y - S.wolf.y, best.anchor.x - S.wolf.x),
    intensity: clamp((55 - S.food) / 55, 0, 1),
  };
}

// B2: thirst is a second compass, often pointing a different way than food.
// When the near water is fouled or gone and clean water lies beyond her
// reach, it blooms cool at the fog edge — toward a clean source she can seek.
function waterBearing() {
  if (!S || S.water > 45 || S.era === 'past') return null;
  const near = waterAt(S.wolf.x, S.wolf.y);
  if (near && near.clean) return null;           // already at good water
  const reach = playSightWorld() * 1.3;
  let best = null, bd = Infinity;
  for (const p of PONDS) {
    if (waterFouled(p.x, p.y)) continue;         // only clean sources pull her
    const d = dist(S.wolf.x, S.wolf.y, p.x, p.y);
    if (d < reach) continue;
    if (d < bd) { bd = d; best = p; }
  }
  if (!best) return null;
  return {
    a: Math.atan2(best.y - S.wolf.y, best.x - S.wolf.x),
    intensity: clamp((45 - S.water) / 45, 0, 1),
  };
}

// The next un-reached node on the active plan — what a remembered route pulls
// her toward once she is back in the porthole, blind past the fog edge.
function routeNextNode() {
  if (!S.routePath || S.routePath.length < 1 || S.mode !== 'play') return null;
  let ni = 0, bd = Infinity;
  for (let i = 0; i < S.routePath.length; i++) {
    const n = NbyId.get(S.routePath[i]);
    if (!n) continue;
    const d = dist(S.wolf.x, S.wolf.y, n.x, n.y);
    if (d < bd) { bd = d; ni = i; }
  }
  // the node AFTER the nearest is the one still ahead; at the end, the target
  const ahead = NbyId.get(S.routePath[Math.min(ni + 1, S.routePath.length - 1)]);
  const here = NbyId.get(S.routePath[ni]);
  if (ahead && here && ahead !== here && dist(S.wolf.x, S.wolf.y, here.x, here.y) < 90) return ahead;
  return ahead || here;
}

// The raised map frames the whole territory, whatever the screen size.
function mapFitScale() {
  if (typeof canvas === 'undefined' || !canvas.width) return SCALE_MAP;
  return Math.min(canvas.width / (WORLD.w - (WORLD.x0 || 0) + 500), canvas.height / (WORLD.h + 500));
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

// ── map routing: click a place she knows, and the map shows the way ─────────
// Dijkstra over known, untorn ink only — so a tear is not an inconvenience,
// it is a plan that no longer exists.

function nodeKnownG(id) {
  if (S.visited.has(id)) return true;
  return S.edges.some(e => e.state === 'inherited' && !e.torn && (e.a === id || e.b === id));
}

function computeRoute(targetId) {
  let start = null, bd = Infinity;
  for (const n of NODES) {
    if (!nodeKnownG(n.id)) continue;
    const d = dist(S.wolf.x, S.wolf.y, n.x, n.y);
    if (d < bd) { bd = d; start = n.id; }
  }
  if (!start) return null;
  const distMap = new Map([[start, 0]]);
  const prev = new Map();
  const done = new Set();
  for (;;) {
    let u = null, best = Infinity;
    for (const [k, v] of distMap) if (!done.has(k) && v < best) { best = v; u = k; }
    if (u === null || u === targetId) break;
    done.add(u);
    for (const e of S.edges) {
      if (!isKnownEdge(e)) continue;
      const nb = e.a === u ? e.b : e.b === u ? e.a : null;
      if (!nb || done.has(nb)) continue;
      const A = NbyId.get(e.a), B = NbyId.get(e.b);
      const alt = best + dist(A.x, A.y, B.x, B.y);
      if (alt < (distMap.has(nb) ? distMap.get(nb) : Infinity)) {
        distMap.set(nb, alt);
        prev.set(nb, u);
      }
    }
    // a found short-way around a tear is a real leg, at its own walked length
    for (const g of TEAR_GROUPS) {
      if (!S.foundPaths[g.key]) continue;
      const a = g.chain[0], b = g.chain[g.chain.length - 1];
      const nb = a === u ? b : b === u ? a : null;
      if (!nb || done.has(nb)) continue;
      const alt = best + pathLen(S.foundPaths[g.key]);
      if (alt < (distMap.has(nb) ? distMap.get(nb) : Infinity)) {
        distMap.set(nb, alt);
        prev.set(nb, u);
      }
    }
  }
  if (targetId !== start && !prev.has(targetId)) return null;
  const path = [targetId];
  while (path[0] !== start) path.unshift(prev.get(path[0]));
  return path;
}

function nearestKnownNodeTo(x, y) {
  let best = null, bd = Infinity;
  for (const n of NODES) {
    if (!nodeKnownG(n.id)) continue;
    const d = dist(x, y, n.x, n.y);
    if (d < bd) { bd = d; best = n.id; }
  }
  return best;
}

// Where the current route is actually headed (a node, or a den hollow).
function routeTargetPos() {
  if (!S.routeTo) return null;
  if (S.routeTo.startsWith('site:')) {
    const site = DEN_SITES.find(s => s.id === S.routeTo.slice(5));
    return site ? { x: site.x, y: site.y } : null;
  }
  const n = NbyId.get(S.routeTo);
  return n ? { x: n.x, y: n.y } : null;
}

function mapClick(wx, wy) {
  if (S.mode !== 'play') return;   // no route-planning over Willow's shoulder
  if (S.senseBlend < 0.8) return;
  const reach = 34 / S.cam.scale;
  const swallowed = swallowedNodeIds();
  let target = null, bd = Infinity;
  for (const n of NODES) {
    if (swallowed.has(n.id) || !nodeKnownG(n.id)) continue;
    const d = dist(wx, wy, n.x, n.y);
    if (d < reach && d < bd) { bd = d; target = { id: n.id, node: n.id }; }
  }
  // before a den is chosen, the hollows are places you can plan toward
  if (!S.denId && S.tut.denPrompt) {
    for (const site of DEN_SITES) {
      const d = dist(wx, wy, site.x, site.y);
      if (d < reach && d < bd) { bd = d; target = { id: 'site:' + site.id, node: nearestKnownNodeTo(site.x, site.y) }; }
    }
  }
  if (!target) return;
  if (S.routeTo === target.id) { S.routeTo = null; S.routePath = null; return; }
  S.routeTo = target.id;
  S.routePath = target.node ? computeRoute(target.node) : null;
  if (!S.routePath) say('The map holds no way there.');
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

// ── the zone ─────────────────────────────────────────────────────────────────
// An invisible ring around Aspen. The pack drifts and wanders inside it,
// lopes back when outside it, and it tightens wherever the land pinches —
// the road, hard walls, the mud. F anchors the zone in place; releasing it
// hands it back to her heels. The zone may spill into the apron, and pack
// wolves may go where Aspen cannot.

const ZONE_R = 150;
const FREEZE_TIME = 70;   // real seconds a frightened wolf stays rooted (10x the old spell)

// safe ground: straight away from the threat, never onto asphalt or into walls
function safePointFrom(w, src) {
  const dx = w.x - src.x, dy = w.y - src.y;
  const d = Math.hypot(dx, dy) || 1;
  const R = 520;
  let a = Math.atan2(dy, dx);
  let tx = src.x + Math.cos(a) * R, ty = src.y + Math.sin(a) * R;
  for (let t = 1; t <= 12 && (packBlockedAt(tx, ty) || onRoad(tx, ty)); t++) {
    a += t * 0.5 * (t % 2 ? 1 : -1);
    tx = src.x + Math.cos(a) * R; ty = src.y + Math.sin(a) * R;
  }
  return { x: tx, y: ty };
}

// one stride of the run-then-root behavior: lope to safety, then stand
function fleeStep(w, dt) {
  if (!w.fleeTo) { w.moving = false; return; }
  const d = dist(w.x, w.y, w.fleeTo.x, w.fleeTo.y);
  if (d < 22) { w.fleeTo = null; w.moving = false; return; }
  const sp = 250 * w.mult;
  tryMove(w, (w.fleeTo.x - w.x) / d * sp * dt, (w.fleeTo.y - w.y) / d * sp * dt,
    (x, y) => packBlockedAt(x, y) || onRoad(x, y));
  w.heading = Math.atan2(w.fleeTo.y - w.y, w.fleeTo.x - w.x);
  w.gait += sp * dt;
  w.moving = true;
}

function zoneCenter() {
  // in the prologue the pack is her MOTHER's: they hold Willow's zone until
  // the inheritance passes the lead to Aspen
  if (S.mode === 'prologue' && S.willow && S.willow.alive && !S.inherited) {
    return { x: S.willow.x, y: S.willow.y };
  }
  const anyFollowing = S.pack.some(w => w.state === 'follow' || w.state === 'balk');
  if (!anyFollowing && S.zoneAnchor) return S.zoneAnchor;
  return { x: S.wolf.x, y: S.wolf.y };
}

function zoneRadius(c) {
  const h = OBSTACLES.highway;
  let clear = Infinity;
  clear = Math.min(clear, c.x < h.x0 ? h.x0 - c.x : c.x > h.x1 ? c.x - h.x1 : 0);
  if (S.era !== 'past') {
    for (const key of ['construction', 'subdivision', 'gravelPit']) {
      const o = obstacleRect(key);
      const dx = Math.max(o.x0 - c.x, 0, c.x - o.x1);
      const dy = Math.max(o.y0 - c.y, 0, c.y - o.y1);
      clear = Math.min(clear, Math.hypot(dx, dy));
    }
    const ms = OBSTACLES.mudSink;
    clear = Math.min(clear, Math.max(0, dist(c.x, c.y, ms.x, ms.y) - ms.r));
  }
  return clamp(clear * 0.8, 55, ZONE_R);
}

function packUpdate(dt) {
  // breadcrumbs kept for flavor and the record; movement no longer uses them
  const last = S.trail[S.trail.length - 1];
  if (dist(last.x, last.y, S.wolf.x, S.wolf.y) > 14) {
    S.trail.push({ x: S.wolf.x, y: S.wolf.y });
    if (S.trail.length > 400) S.trail.shift();
  }

  S.fear = Math.max(0, S.fear - 0.035 * dt);

  // the conducted crossing exists (F stages, cross alone, F calls) — teach
  // it once, the first time she brings the pack near the asphalt
  if (S.mode === 'play' && !S.tut.roadLesson && S.tut.fTaught) {
    const h = OBSTACLES.highway;
    const dRoad = S.wolf.x < h.x0 ? h.x0 - S.wolf.x : S.wolf.x > h.x1 ? S.wolf.x - h.x1 : 0;
    if (dRoad < 260 && S.pack.some(w => w.state === 'follow')) {
      S.tut.roadLesson = true;
      showPrompt('The road. F holds the pack. Cross when it is quiet, then F calls them through.', ['F'], 8);
      saveGame();
    }
  }

  // The pack freezes whenever fear shows in the bar, and only until it drains
  // back to nothing. At real terror they scatter to safe ground first (so
  // nothing can corner a rooted pack); a milder fright just roots them where
  // they stand. Either way, the moment fear is gone, they move again.
  const scared = S.fear > 0.03;
  if (scared && !S.packFrozen) {
    S.packFrozen = true;
    const flee = S.fear > 0.5;
    const src = S.fearSource || { x: S.wolf.x, y: S.wolf.y };
    for (const w of S.pack) {
      if (w.state === 'dead' || w.state === 'gone') continue;
      w.fleeTo = flee ? safePointFrom(w, src) : null;
    }
    if (S.mode === 'play') say(flee ? 'The pack scatters for safe ground, and roots there.' : 'The pack freezes.');
  }
  if (S.packFrozen && !scared) S.packFrozen = false;
  if (S.packFrozen) {
    for (const w of S.pack) {
      if (w.state === 'dead' || w.state === 'gone') { w.moving = false; continue; }
      fleeStep(w, dt);   // runs to safe ground if it has one, else stands still
    }
    return;
  }

  const c = zoneCenter();
  const zr = zoneRadius(c);
  const huntLimit = Math.max(320, zr * 2);   // how far a hunt may pull them

  const snow = seasonIndex() === 3 && S.era !== 'past' ? 0.85 : 1;

  for (const w of S.pack) {
    if (w.state === 'dead' || w.state === 'gone') { w.moving = false; continue; }

    // a lost wolf stands where it wandered until she comes for it — and if
    // no one ever comes, one day it simply isn't waiting anymore
    if (w.lost) {
      w.moving = false;
      w.lostT = (w.lostT || 0) + dt;
      if (w.lostT > 420 && S.mode === 'play') {
        w.lost = false;
        w.state = 'gone';
        S.history.push({ type: 'loss', day: day(), who: w.id, dispersed: true });
        say(`${w.name} is gone. The waiting outlasted the hope.`);
        saveGame();
      }
      continue;
    }

    // the bridge is learned by crossings: each wolf that goes over, counts
    if (overpassOpen() && !overpassTrusted()) {
      const mid = (OBSTACLES.highway.x0 + OBSTACLES.highway.x1) / 2;
      if (onDeck(w.x, w.y)) {
        if (w.deckFrom === undefined) w.deckFrom = w.x < mid ? -1 : 1;
      } else if (w.deckFrom !== undefined) {
        if ((w.x < mid ? -1 : 1) !== w.deckFrom) {
          S.overpassCross = (S.overpassCross || 0) + 1;
          if (overpassTrusted() && !S.tut.overpassTrust) {
            S.tut.overpassTrust = true;
            say('The pack knows the bridge now. The land will learn it from them.');
          }
        }
        w.deckFrom = undefined;
      }
    }

    // wounds heal on their own slow clock; a hurt wolf lags
    w.injuredT = Math.max(0, (w.injuredT || 0) - dt);
    const lag = (w.injuredT > 0 ? 0.65 : 1) * snow;

    // a balked wolf recovers as soon as the fear is gone from the bar
    if (w.balked && S.fear <= 0.03) {
      w.balked = false;
      if (w.state === 'balk') w.state = 'follow';
    }
    if (w.balked) {
      w.state = 'balk';
      fleeStep(w, dt);
      continue;
    }

    // a wolf told to HOLD keeps to the anchor no matter what the rest of the
    // pack does — its state is authoritative, so "holds" in the roster is
    // never a lie. Following wolves use the live zone (Aspen).
    const held = w.state === 'stay';
    const wc = (held && S.zoneAnchor) ? S.zoneAnchor : c;
    const wzr = (held && S.zoneAnchor) ? zoneRadius(wc) : zr;
    const wHuntLimit = Math.max(320, wzr * 2);
    const dZone = dist(w.x, w.y, wc.x, wc.y);

    // adults hunt on their own: chase near prey, break off beyond the
    // hunting radius, never set foot on the asphalt. Hysteresis keeps the
    // edge honest: a chase starts well inside the radius and is only
    // abandoned well outside it — no flickering at the line. A held wolf
    // does not leave its ground to hunt.
    if (!w.pup && !held && S.mode === 'play') {
      let prey = null, pd = 1e9;
      for (const e of S.elk) {
        const d = dist(w.x, w.y, e.x, e.y);
        if (d < 280 && d < pd) { pd = d; prey = e; }
      }
      const mayHunt = w.hunting ? dZone < wHuntLimit * 1.3 : dZone < wHuntLimit * 0.8;
      if (prey && mayHunt) {
        w.hunting = true;
        const d = pd || 1;
        const sp = 250 * w.mult * lag;
        tryMove(w, (prey.x - w.x) / d * sp * dt, (prey.y - w.y) / d * sp * dt,
          (x, y) => packBlockedAt(x, y) || onRoad(x, y));
        w.heading = Math.atan2(prey.y - w.y, prey.x - w.x);
        w.gait += sp * dt;
        w.moving = true;
        continue;
      }
      w.hunting = false;
    }

    // outside the zone: lope smoothly back to a stable personal slot in it
    // (a fixed angle per wolf — no per-frame re-rolls, no frenzy)
    if (dZone > wzr) {
      if (w.slotA === undefined) w.slotA = Math.random() * Math.PI * 2;
      w.tx = wc.x + Math.cos(w.slotA) * wzr * 0.5;
      w.ty = wc.y + Math.sin(w.slotA) * wzr * 0.5;
      w.wanderT = 0.5;
    } else {
      w.wanderT = (w.wanderT || 0) - dt;
      if (w.wanderT <= 0 || w.tx === undefined || dist(w.x, w.y, w.tx, w.ty) < 14) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * wzr;
        w.tx = wc.x + Math.cos(a) * r;
        w.ty = wc.y + Math.sin(a) * r;
        w.wanderT = 1.5 + Math.random() * 3;
      }
    }

    const d = dist(w.x, w.y, w.tx, w.ty);
    if (d < 10) { w.moving = false; continue; }
    // fear refuses the road: a frightened wolf will not step toward it
    const nx = w.x + (w.tx - w.x) / d * 24, ny = w.y + (w.ty - w.y) / d * 24;
    if ((onRoad(w.tx, w.ty) || onRoad(nx, ny)) && !onRoad(w.x, w.y)
        && S.fear > FEAR_BALK && S.mode === 'play') {
      w.state = 'balk';
      w.balked = true;
      w.frozenT = FREEZE_TIME;
      // it bolts back from the asphalt line before it roots
      const hm = OBSTACLES.highway;
      w.fleeTo = safePointFrom(w, { x: (hm.x0 + hm.x1) / 2, y: w.y });
      w.moving = false;
      continue;
    }
    // speed eases between amble and lope; heading turns, never snaps
    const urgency = clamp((dZone - zr * 0.7) / (zr * 0.6), 0, 1);
    let sp = lerp(120, 240, urgency) * w.mult * lag;
    if (dZone > 700) sp *= 1.8;
    // a wolf never ambles on asphalt: mid-road, or headed onto it, full lope
    if (onRoad(w.x, w.y) || onRoad(w.tx, w.ty)) sp = Math.max(sp, 240 * w.mult * lag);
    const step = Math.min(d, sp * dt);
    // and it NEVER takes asphalt — or an untrusted deck — Aspen is not on,
    // unless she is already across, calling it through (a conducted crossing)
    const hMid = (OBSTACLES.highway.x0 + OBSTACLES.highway.x1) / 2;
    const sealed = !packRefuses(S.wolf.x, S.wolf.y) && !packRefuses(w.x, w.y)
      && ((S.wolf.x - hMid > 0) === (w.x - hMid > 0));
    tryMove(w, (w.tx - w.x) / d * step, (w.ty - w.y) / d * step,
      (x, y) => packBlockedAt(x, y) || (sealed && packRefuses(x, y)));
    const want = Math.atan2(w.ty - w.y, w.tx - w.x);
    let dh = want - (w.heading || 0);
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    w.heading = (w.heading || 0) + dh * Math.min(1, dt * 6);
    w.gait = (w.gait || 0) + step;
    w.moving = true;
  }
}

// SPACE toggles the map: press to raise it, press again to lower it.
// In the prologue the map is Willow's — shown to Aspen in forced views,
// never held. Only the inheritance puts it in her jaws; before that, the
// held key at her mother's side is the inherit gesture, not the map.
function mapAllowed() {
  if (S.mode === 'prologue') return S.inherited;
  return S.tut.sawMap || S.tut.step >= 4;
}

// A5: the toggle is suppressed while any scripted map state owns the view —
// a forced lesson or ritual (forcedSenseT), the season overlay (seasonGhostT),
// and the beat-9 inherit hold — so a mistimed SPACE can't fight the auto-raise
// or close the map mid-inherit. The inherit HOLD still registers; only the
// toggle is ignored.
function toggleMap() {
  if (!S || (S.mode !== 'play' && S.mode !== 'prologue')) return;
  if (S.forcedSenseT > 0) return;
  if ((S.seasonGhostT || 0) > 0) return;
  if (S.mode === 'prologue' && S.beat === 9 && !S.inherited) return;   // the hold owns SPACE
  // beat 6 is the play-fight: SPACE is the lean-in, not the map
  if (S.mode === 'prologue' && S.beat === 6) { S.tut._bond = true; return; }
  if (!mapAllowed()) return;   // no map before the map is hers
  S.mapOpen = !S.mapOpen;
}

function togglePackStay() {
  // in the prologue, F is the bond gesture in beat 6, and from beat 7 —
  // once taught — the real verb, tested under Willow's eye
  if (S.mode === 'prologue') {
    // the pack is Willow's to lead here; the beat-6 lean-in is SPACE, not F
    return;
  }
  if (!S.tut.fTaught) return;   // no verb before it is given
  // at the western pack's line, F is the posture: stand the pack tall and be
  // measured against their strength (win a lane, or be driven back)
  if (S.westState === 'confrontation' && S.mode === 'play') { westResolvePosture(); return; }
  // during a standoff, F is the display: the pack stands tall together —
  // a faster win with the family at her back, bluster without it
  if (S.standoff && S.mode === 'play') {
    const adultsNear = alivePack().filter(w => !w.pup && dist(w.x, w.y, S.wolf.x, S.wolf.y) < 220).length;
    if (adultsNear >= 2) {
      S.standoff = null;
      S.standoffCd = 90;
      S.fear = Math.min(1, S.fear + 0.25);
      playGrowl();
      say('The pack stands tall as one. The shapes think better of it.');
    } else {
      S.standoff.t = Math.max(S.standoff.t, 5.9);   // the nip comes at once
      say('She stands tall alone. It reads as bluster.');
    }
    return;
  }
  const anyFollowing = S.pack.some(w => w.state === 'follow' || w.state === 'balk');
  for (const w of S.pack) {
    if (w.state === 'dead' || w.state === 'gone') continue;
    // F never overrides fear: a wolf that balked stays balked
    w.state = anyFollowing ? 'stay' : (w.balked ? 'balk' : 'follow');
  }
  // holding anchors the zone where she stands; releasing hands it back to her
  S.zoneAnchor = anyFollowing ? { x: S.wolf.x, y: S.wolf.y } : null;
  S.tut.usedHold = true;
  if (S.mode === 'prologue' && S.beat === 6) S.tut._bond = true;
  say(anyFollowing ? 'The pack holds this ground.' : 'The pack follows.');
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
        x: lane.x, y: lane.vy > 0 ? -APRON - 80 : WORLD.h + APRON + 80, vy: lane.vy,
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
  S.cars = S.cars.filter(c => c.y > -APRON - 220 && c.y < WORLD.h + APRON + 220);
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
          S.fearSource = { x: (h.x0 + h.x1) / 2, y: ref.y };
          S.food = Math.max(0, S.food - 8);
          if (S.mode === 'play') S.injuredT = INJURY_TIME;
          playHurt();
          say(S.era === 'past'
            ? 'The truck clips her. Willow is already there, pressing her to the grass.'
            : 'The Black River strikes. She drags herself back, limping.');
        } else {
          const w = S.pack.find(p => p.id === id);
          if (S.mode !== 'play') continue;  // the prologue does not kill family
          w.state = 'dead';
          S.fear = 1; S.flickerT = 0.6; S.shake = 14;
          S.fearSource = { x: (OBSTACLES.highway.x0 + OBSTACLES.highway.x1) / 2, y: w.y };
          playHurt();
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

// The seasonal squeeze: east of the highway the land empties as the year
// turns — respawns slow in autumn and stop in winter. The west holds steady;
// the cattle are fed by the rancher, which is the point of them.
function respawnMult(H) {
  if (H.cattle || H.anchor.x <= OBSTACLES.highway.x1) return 1;
  const si = seasonIndex();
  return si === 2 ? 2.5 : si === 3 ? 0 : 1;
}

// Wind: prey smell what the air carries. When the hunter stands upwind of
// the elk — the wind blowing her scent toward it — the smell arrives long
// before the sight of her; approach from downwind and she can come close.
// Rain drowns scent and is a hunting opportunity. The prologue's golden
// morning is windless — the first hunt is meant to be won.
function windDetectMult(hx, hy, ex, ey) {
  if (!S.wind || S.era === 'past') return 1;
  const d = dist(hx, hy, ex, ey) || 1;
  const align = ((ex - hx) * Math.cos(S.wind.a) + (ey - hy) * Math.sin(S.wind.a)) / d;
  let m = 1 + Math.max(0, align) * 1.1 - Math.max(0, -align) * 0.4;
  if (S.weather && S.weather.kind === 'rain') m *= 0.75;
  return m;
}

// Late autumn, the migration made visible: the eastern herds press against
// the road — milling at the barrier they cannot cross — and once the bridge
// is trusted, they trickle over it, day by day, draining the east. The
// squeeze stops being a respawn table and becomes something you watch.
function herdDriftUpdate() {
  if (S.era === 'past' || day() < 240) return;
  const h = OBSTACLES.highway, o = OBSTACLES.overpass;
  const oy = (o.y0 + o.y1) / 2;
  for (const H of HERDS) {
    if (H.cattle || H.anchor0.x <= h.x1) continue;   // eastern-born herds only
    if (!overpassTrusted()) {
      // pressed against the wire of traffic
      H.anchor.x = Math.max(h.x1 + 300, H.anchor.x - 60);
      H.anchor.y += clamp((oy - H.anchor.y) * 0.1, -80, 80);
    } else {
      // the trickle: over the bridge, west, day by day
      H.anchor.y += clamp((oy - H.anchor.y) * 0.25, -120, 120);
      H.anchor.x = Math.max(620, H.anchor.x - 90);
    }
  }
}

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

    // wedged inside something (spawned badly, or built around it): work free
    if (blockedAt(elk.x, elk.y, 2, false, APRON)) {
      const d = dist(elk.x, elk.y, H.anchor.x, H.anchor.y) || 1;
      elk.x += (H.anchor.x - elk.x) / d * 260 * dt;
      elk.y += (H.anchor.y - elk.y) / d * 260 * dt;
      continue;
    }
    let fx = 0, fy = 0, threat = 0;
    const flightR = 300 * elk.skittish * (elk.wary ? 1.3 : 1);
    for (const h of hunters) {
      const d = dist(elk.x, elk.y, h.x, h.y);
      const fr = flightR * windDetectMult(h.x, h.y, elk.x, elk.y);
      if (d < fr && d > 1) {
        fx += (elk.x - h.x) / d * (fr - d);
        fy += (elk.y - h.y) / d * (fr - d);
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

    // Smooth steering: desired velocity is damped into actual velocity, so
    // prey glides rather than vibrating; wander is low-frequency, not noise.
    elk.vx = elk.vx || 0; elk.vy = elk.vy || 0;
    let wantX = 0, wantY = 0, wantSp = 0;

    // the fire drives everything west, together; panic, not pursuit
    const burning = S.fire && S.fire.state === 'burning';
    if (burning) {
      fx -= 320;
      fy += Math.sin(S.time * 1.1 + elk.skittish * 23) * 60;
      threat++;
    }

    elk.fleeing = threat > 0;
    if (elk.fleeing) {
      if (!burning) elk.stamina = Math.max(0, elk.stamina - (elk.wary ? 8 : 12) * dt);
      fx += sx * 0.6; fy += sy * 0.6;
      const wob = Math.sin(S.time * 1.4 + elk.skittish * 17) * 0.9;
      const wa = Math.atan2(fy, fx) + wob;
      const dAnchor = dist(elk.x, elk.y, H.anchor.x, H.anchor.y);
      let ax = Math.cos(wa), ay = Math.sin(wa);
      if (dAnchor > H.leash && !elk.frail) {
        ax += (H.anchor.x - elk.x) / dAnchor * 0.4;
        ay += (H.anchor.y - elk.y) / dAnchor * 0.4;
      }
      const m = Math.hypot(ax, ay) || 1;
      wantSp = (elk.stamina > 25 ? H.speed : H.speed * 0.56)
        * (0.92 + 0.16 * elk.skittish) * (elk.frail || 1)
        * (seasonIndex() === 3 && S.era !== 'past' ? 0.8 : 1);   // snow drags at everyone
      wantX = ax / m * wantSp; wantY = ay / m * wantSp;
    } else {
      elk.stamina = Math.min(100, elk.stamina + 8 * dt);
      elk.grazeT -= dt;
      if (elk.grazeT <= 0) pickGrazeTarget(elk);
      const dT = dist(elk.x, elk.y, elk.tx, elk.ty);
      if (dT > 30) {
        let mx = (elk.tx - elk.x) / dT + sx * 0.02;
        let my = (elk.ty - elk.y) / dT + sy * 0.02;
        const mm = Math.hypot(mx, my) || 1;
        wantSp = 26 + 12 * Math.sin(S.time * 0.23 + elk.skittish * 31);
        wantX = mx / mm * wantSp; wantY = my / mm * wantSp;
      } else if (Math.hypot(sx, sy) > 12) {
        const mm = Math.hypot(sx, sy);
        wantX = sx / mm * 20; wantY = sy / mm * 20;
      }
    }

    const damp = Math.min(1, dt * (elk.fleeing ? 3.5 : 1.8));
    elk.vx += (wantX - elk.vx) * damp;
    elk.vy += (wantY - elk.vy) * damp;
    const spd = Math.hypot(elk.vx, elk.vy);
    if (spd > 2) {
      // prey may roam the apron, where Aspen cannot follow
      tryMove(elk, elk.vx * dt, elk.vy * dt, (x, y) => blockedAt(x, y, 14, false, APRON));
      const targetHd = Math.atan2(elk.vy, elk.vx);
      let dh = targetHd - elk.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      elk.heading += dh * Math.min(1, dt * 5);
      elk.gait += spd * dt;
    }

    // beyond the world's edge: it has escaped the land entirely
    if (elk.x < (WORLD.x0 || 0) || elk.y < 0 || elk.x > WORLD.w || elk.y > WORLD.h) {
      elk.outT = (elk.outT || 0) + dt;
    } else {
      elk.outT = 0;
    }

    S.scentDropT += dt;
  }

  // escapes: gone past the edge and staying there — a new deer wanders into
  // the heart of the land to replace what the land lost
  for (let i = S.elk.length - 1; i >= 0; i--) {
    const elk = S.elk[i];
    const gone = elk.x < (WORLD.x0 || 0) - APRON + 40 || elk.y < -APRON + 40
      || elk.x > WORLD.w + APRON - 40 || elk.y > WORLD.h + APRON - 40
      || (elk.outT || 0) > 7;
    if (gone) {
      S.elk.splice(i, 1);
      const nd = {
        herd: 1,
        x: WORLD.w / 2 + (Math.random() - 0.5) * 500,
        y: WORLD.h / 2 + (Math.random() - 0.5) * 500,
        heading: Math.random() * Math.PI * 2, stamina: 100, fleeing: false,
        gait: 0, bull: false, skittish: 0.75 + Math.random() * 0.5,
        grazeT: 2, tx: 0, ty: 0, vx: 0, vy: 0,
      };
      pickGrazeTarget(nd);
      S.elk.push(nd);
    }
  }
  if (S.scentDropT > 0.8) {
    S.scentDropT = 0;
    // violet is sampled once, when the scent is laid — never per frame
    for (const elk of S.elk) {
      S.scent.push({ x: elk.x, y: elk.y, t: S.time, v: violetAt(elk.x, elk.y) });
    }
    if (S.scent.length > 900) S.scent.splice(0, S.scent.length - 900);
  }

  // no kill exists until the hunt has been taught
  if (S.mode === 'prologue' && S.beat < 4) return;
  for (let i = S.elk.length - 1; i >= 0; i--) {
    const elk = S.elk[i];
    if (elk.stamina > 25) continue;
    const caught = hunters.some(h => dist(elk.x, elk.y, h.x, h.y) < 22);
    if (caught) {
      const H = HERDS[elk.herd];
      S.elk.splice(i, 1);
      let thinned = false;
      if (H.count > 0) {
        const m = respawnMult(H);
        if (m > 0) {
          S.elkRespawn.push({ day: day() + Math.round(H.respawnDays * m), herd: elk.herd });
          if (m > 1 && !S.tut.eastThins) { S.tut.eastThins = true; thinned = true; }
        }
      }
      const sedge = S.pack.find(w => w.id === 'sedge');
      const sedgeIn = sedge && sedge.state !== 'dead' && sedge.state !== 'gone'
        && dist(sedge.x, sedge.y, elk.x, elk.y) < 500;
      S.food = Math.min(100, S.food + H.food * (elk.wary ? 0.65 : 1) + (sedgeIn ? 10 : 0));
      S.tut.usedHold = true;
      S.history.push({ type: 'hunt', day: day() });
      if (H.cattle) {
        S.conflict = Math.min(1, S.conflict + 0.3);
        // her pack's hunger writes his ledger even when she is elsewhere
        if (!S.tut.packCalf && dist(S.wolf.x, S.wolf.y, elk.x, elk.y) > 500) {
          S.tut.packCalf = true;
          say('The pack took one of the cattle on its own. The house will not know the difference.');
        } else {
          say('Cattle — big, slow, easy meat. The house will know.');
        }
      } else if (thinned) {
        // the seasonal beat outranks the routine kill line
        say('The hunting thins. The east is emptying.');
      } else if (S.mode !== 'prologue') {
        // the prologue's scripted hunt speaks through its own caption
        say(sedgeIn ? 'A kill. Sedge ran it down with her.' : 'A kill. The pack eats.');
      }
      saveGame();
    }
  }
}

// ── hunger and Sedge's restlessness ──────────────────────────────────────────

function hungerUpdate(dt) {
  // fewer mouths, slower drain: a full pack of four eats at the old rate —
  // but sickness and thirst both burn the larder faster
  const mouths = Math.min(1.15, (1 + alivePack().length) / 5)
    * ((S.sickT || 0) > 0 ? 1.3 : 1) * (S.water <= 0 ? 1.25 : 1);
  S.food = Math.max(0, S.food - FOOD_PER_SEC * mouths * dt);
  if (S.food <= 0) S.starveT += dt; else S.starveT = 0;

  // in winter, an empty larder is the end of the year, not a setback
  if (S.starveT > 180 && seasonIndex() === 3) { startEnding('failed'); return; }

  const sedge = S.pack.find(w => w.id === 'sedge');
  if (!sedge || sedge.state === 'dead' || sedge.state === 'gone') return;
  if (S.starveT > 120) {
    sedge.state = 'gone';
    // her going leaves one mark at the world's edge, findable in the cold
    S.sedgeMark = { x: WORLD.w - 70, y: clamp(sedge.y, 300, WORLD.h - 300) };
    S.history.push({ type: 'loss', day: day(), who: 'sedge', dispersed: true });
    say('Sedge is gone. Hunger took her somewhere the map does not go.');
    saveGame();
  }
}

// ── the den bet and the pups ─────────────────────────────────────────────────

function denUpdate(dt) {
  if (!S.denId) {
    // (the choice is named the moment Act I opens — see applyPostPrologue)
    for (const site of DEN_SITES) {
      if (!S.seenDens.includes(site.id) && dist(S.wolf.x, S.wolf.y, site.x, site.y) < 200) {
        S.seenDens.push(site.id);
        say(`${site.name}. A den could be dug here.`);
      }
    }
    let near = null;
    for (const site of DEN_SITES) {
      if (dist(S.wolf.x, S.wolf.y, site.x, site.y) < 120) near = site;
    }
    // a den is a deliberate bet — but a quick one: pause close by, briefly
    if (near && !S.wolf.moving && S.senseBlend < 0.2 && S.tut.denPrompt) {
      S.denStandT += dt;
      if (S.denStandT > 1.2) chooseDen(near);
    } else {
      S.denStandT = 0;
    }
    if (day() >= DEN_DEADLINE_DAY) {
      chooseDen(DEN_SITES[0]);
      say('No choice was made. The old den will serve.');
    }
  }
}

// A chosen hollow becomes a real place on the graph — walkable, inkable,
// with unknown paths toward its nearest neighbors. The old den already is
// one. Dynamic pieces are stripped at newGame and rebuilt from denId on load.
function materializeDen(siteId) {
  if (!siteId || siteId === 'oldDen' || NbyId.has('home')) return;
  const site = DEN_SITES.find(s => s.id === siteId);
  if (!site) return;
  const node = { id: 'home', x: site.x, y: site.y, name: 'The Den', den: true, dynamic: true };
  NODES.push(node); NbyId.set('home', node);
  const near = NODES
    .filter(n => !n.dynamic)
    .sort((a, b) => dist(site.x, site.y, a.x, a.y) - dist(site.x, site.y, b.x, b.y))
    .slice(0, 3);
  for (const n of near) {
    const def = { id: `home-${n.id}`, a: 'home', b: n.id, state: 'unknown', dynamic: true };
    def.via = edgeVia(node, n);
    EDGES.push(def);
    S.edges.push({
      id: def.id, a: def.a, b: def.b, tearGroup: undefined, via: def.via,
      state: 'unknown', torn: false, passCount: 0, lastUsedDay: day(),
      inkLo: 1, inkHi: 0, covBits: 0,
    });
  }
  S.visited.add('home');
  recomputeGhosts();
}

function stripDynamicDen() {
  for (let i = NODES.length - 1; i >= 0; i--) {
    if (NODES[i].dynamic) { NbyId.delete(NODES[i].id); NODES.splice(i, 1); }
  }
  for (let i = EDGES.length - 1; i >= 0; i--) if (EDGES[i].dynamic) EDGES.splice(i, 1);
}

function chooseDen(site) {
  S.denId = site.id;
  S.denSite = { x: site.x, y: site.y };
  materializeDen(site.id);
  if (!S.seenDens.includes(site.id)) S.seenDens.push(site.id);
  S.history.push({ type: 'den', day: day(), site: site.id });
  say(`${site.name} is home now.`);
  // home chosen: the last two verbs are given, one at a time — each fades on
  // its own after a few seconds; no need to press the key to dismiss it
  showPrompt('R twice restarts the game (if you ever want to).', ['R'], 3.5);
  showPrompt('What she knows how to do: H.', ['H'], 3.5);
  S.tut.taughtHelp = true;
  saveGame();
}

function pupUpdate(dt) {
  if (!S.pups && S.denId && day() >= PUPS_BORN_DAY) {
    S.pups = { count: 2, food: 80, starveT: 0, traveling: false, lost: 0 };
    S.hud.pups = true;
    say('Pups. Two of them, blind and certain of you.');
    playMotif('pups');
    showPrompt('Carry food home in your belly — stand at the den, full, and they eat.', [], 8);
    saveGame();
  }
  if (!S.pups || S.pups.count <= 0 || S.pups.traveling) return;

  S.pups.food = Math.max(0, S.pups.food - PUP_FOOD_PER_SEC * dt);

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

// ── the rancher ──────────────────────────────────────────────────────────────
// One human thread, witnessed entirely from outside. His ledger (S.conflict)
// is hidden, permanent, and never explained: dogs, lights, and — one way or
// the other — either a gift by the fence or a rifle.

function rancherUpdate(dt) {
  S.seenCd = Math.max(0, S.seenCd - dt);
  S.shotCd = Math.max(0, S.shotCd - dt);

  const dHouse = dist(S.wolf.x, S.wolf.y, RANCH.house.x, RANCH.house.y);

  // being seen from the porch, in daylight
  if (dHouse < 400 && daylight() > 0.5 && S.seenCd <= 0) {
    S.seenCd = 10;
    if (S.conflict === 0) say('A silhouette on the porch. Watching.');
    S.conflict = Math.min(1, S.conflict + 0.02);
  }

  // the dogs: loosed farther the worse the ledger reads. They will run any
  // wolf — Aspen or family — and their teeth cost meat, blood, and nerve.
  const chaseR = S.conflict > 0.6 ? 1000 : 620;
  const quarry = [{ ref: S.wolf, aspen: true }, ...alivePack().map(w => ({ ref: w, aspen: false }))];
  const anyNear = quarry.some(q => dist(q.ref.x, q.ref.y, RANCH.house.x, RANCH.house.y) < 380);
  for (const dog of S.dogs) {
    dog.biteCd = Math.max(0, dog.biteCd - dt);
    const dHome = dist(dog.x, dog.y, RANCH.dogHome.x, RANCH.dogHome.y);
    let tx, ty, sp;
    if (anyNear && dHome < chaseR) {
      let target = quarry[0], bd = Infinity;
      for (const q of quarry) {
        const d = dist(dog.x, dog.y, q.ref.x, q.ref.y);
        if (d < bd) { bd = d; target = q; }
      }
      tx = target.ref.x; ty = target.ref.y; sp = 272;
      if (bd < 34 && dog.biteCd <= 0) {
        dog.biteCd = 8;
        S.conflict = Math.min(1, S.conflict + 0.05);
        S.shake = Math.max(S.shake, 6);
        playHurt();
        if (target.aspen) {
          S.food = Math.max(0, S.food - 15);
          S.fear = Math.min(1, S.fear + 0.35);
          S.injuredT = INJURY_TIME;
          say('Teeth find her. Meat lost, blood drawn — the dogs know their work.');
        } else {
          S.food = Math.max(0, S.food - 10);
          S.fear = Math.min(1, S.fear + 0.3);
          // a packmate carries a dog bite longer than Aspen carries hers
          target.ref.injuredT = INJURY_TIME * 2;
          say(`The dogs run ${target.ref.name} off the meat. The pack pays for this ground.`);
        }
        S.fearSource = { x: dog.x, y: dog.y };
      }
    } else {
      tx = RANCH.dogHome.x + Math.sin(S.time * 0.4 + dog.biteCd) * 50;
      ty = RANCH.dogHome.y + Math.cos(S.time * 0.3) * 40;
      sp = 150;
    }
    const d = dist(dog.x, dog.y, tx, ty);
    if (d > 12) {
      const step = Math.min(d, sp * dt);
      dog.x += (tx - dog.x) / d * step;
      dog.y += (ty - dog.y) / d * step;
      dog.heading = Math.atan2(ty - dog.y, tx - dog.x);
      dog.gait += step;
      dog.moving = true;
    } else {
      dog.moving = false;
    }
  }

  // kept low: once, in the cold, something is left by the fence line
  if (!S.gift.given && S.conflict < 0.35 && seasonIndex() >= 2) {
    S.gift.given = true;
    say('Ravens circle the fence line, east.');
  }
  // the gift is a rumor the whole valley can read: a raven column in the
  // sky, and a gold bloom in the scent view that stays fresh until claimed
  if (S.gift.given && !S.gift.taken) {
    S.giftBloomT = (S.giftBloomT || 0) - dt;
    if (S.giftBloomT <= 0) {
      S.giftBloomT = 2.2;
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 90;
        S.scent.push({
          x: RANCH.giftSpot.x + Math.cos(a) * r,
          y: RANCH.giftSpot.y + Math.sin(a) * r,
          t: S.time, v: 0,
        });
      }
    }
  }
  if (S.gift.given && !S.gift.taken
      && dist(S.wolf.x, S.wolf.y, RANCH.giftSpot.x, RANCH.giftSpot.y) < 60) {
    S.gift.taken = true;
    S.food = Math.min(100, S.food + 35);
    say('A gut pile, left by the wire. Maybe forgotten. Maybe not.');
    saveGame();
  }

  // kept high: the rifle
  if (S.conflict > 0.6 && day() > 200 && dHouse < 700 && S.shotCd <= 0) {
    S.shotCd = 30;
    playShot();
    S.fear = 1;
    S.shake = 10;
    S.flickerT = 0.3;
    if (S.conflict > 0.85 && Math.random() < 0.3) {
      S.injuredT = INJURY_TIME;
      playHurt();
      say('CRACK. Fire along her flank. Run.');
      S.fearSource = { x: RANCH.house.x, y: RANCH.house.y };
    } else {
      say('CRACK. The air splits beside her.');
    }
  }
}

// ── the silence zone ─────────────────────────────────────────────────────────
// Suburb-edge ground: move fast near the rooflines and light cascades into
// barking into being SEEN — which goes straight into the rancher's ledger.

function silenceUpdate(dt) {
  const c = OBSTACLES.subdivision;
  const dx = Math.max(c.x0 - S.wolf.x, 0, S.wolf.x - c.x1);
  const dy = Math.max(c.y0 - S.wolf.y, 0, S.wolf.y - c.y1);
  const d = Math.hypot(dx, dy);
  if (d < 480) {
    S.alarm = Math.min(1, S.alarm + dt * (S.wolf.moving ? 0.4 : 0.02) * (1 - d / 480));
    if (S.alarm >= 1) {
      S.alarm = 0;
      S.conflict = Math.min(1, S.conflict + 0.08);
      S.fear = Math.min(1, S.fear + 0.3);
      S.flickerT = 0.3;
      playBark();
      say('Porch lights. Barking, house to house. Seen.');
    }
  } else {
    S.alarm = Math.max(0, S.alarm - dt * 0.15);
  }
}

// ── the western pack ─────────────────────────────────────────────────────────
// A second pack, west of the road, holding the winter-range approach from
// midyear on — a mirror of Aspen, driven out by the clearcut. Not a wall:
// spatial pressure. Moving through their ground raises EXPOSURE; thresholds
// escalate scent-warning → sighting → posture standoff → (rarely) clash. A
// weak pack is never stuck — the southern detour always remains. This is a
// separate system from the eastern standoff; that pack stays passive.

function westActive() { return S && S.era !== 'past' && day() >= WEST_PACK.appearDay; }

function inWestTerritory(x, y) {
  const T = WEST_PACK.territory;
  return dist(x, y, T.x, T.y) < T.r;
}

// P4: the patrol's presence centroid — deterministic from S.time, so the
// rhythm is learnable. It loops the legs over `period` seconds.
function patrolCentroid() {
  const legs = WEST_PACK.patrol.legs, n = legs.length;
  const phase = ((S.time % WEST_PACK.patrol.period) / WEST_PACK.patrol.period) * n;
  const i = Math.floor(phase) % n, t = phase - Math.floor(phase);
  const a = legs[i], b = legs[(i + 1) % n];
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

// P4: a mark's freshness = how recently the patrol passed near it. Fresh
// marks (just patrolled) read bright; stale marks dim — a readout of where
// the pack HAS been, and therefore where it is NOT now.
function markFreshness(m) {
  const legs = WEST_PACK.patrol.legs, n = legs.length, P = WEST_PACK.patrol.period;
  // find the phase at which the centroid passes nearest this mark
  let bestPh = 0, bestD = Infinity;
  for (let s = 0; s < n * 12; s++) {
    const phase = (s / (n * 12)) * n;
    const i = Math.floor(phase) % n, t = phase - Math.floor(phase);
    const a = legs[i], b = legs[(i + 1) % n];
    const px = lerp(a.x, b.x, t), py = lerp(a.y, b.y, t);
    const d = dist(m.x, m.y, px, py);
    if (d < bestD) { bestD = d; bestPh = (s / (n * 12)); }
  }
  if (bestD > 340) return 0.15;                    // the loop never comes near — always stale
  const nowPh = (S.time % P) / P;
  const since = ((nowPh - bestPh + 1) % 1);        // fraction of a loop since last passed
  return clamp(1 - since, 0.15, 1);
}

// P6: Aspen's pack strength vs their fixed 5 — the year, graded at the gate.
function aspenStrength() {
  let s = 1;                                        // Aspen herself
  if (isInjured()) s -= 0.4;
  if (S.food < 35) s -= 0.4 * (1 - S.food / 35);    // her own hunger
  for (const w of alivePack()) {
    let c = w.yearling ? 0.5 : 1.0;
    c *= (S.food < 40 ? 0.5 + 0.5 * (S.food / 40) : 1.0);   // condition
    if ((w.injuredT || 0) > 0) c *= 0.5;
    s += c;
  }
  const fearFactor = 1 - 0.5 * clamp(S.fear, 0, 1); // a terrified pack bluffs weakly
  return Math.max(0, s * fearFactor);
}

// P3: the exposure meter. Rises inside the territory by depth + time + fresh-
// mark proximity + detection; drains outside, and slightly while hiding.
function westExposureStep(dt) {
  const T = WEST_PACK.territory;
  if (!inWestTerritory(S.wolf.x, S.wolf.y)) {
    S.exposure = Math.max(0, S.exposure - 0.16 * dt);   // drains outside
    return;
  }
  const depth = clamp(1 - dist(S.wolf.x, S.wolf.y, T.x, T.y) / T.r, 0, 1);
  let rise = 0.02;                                  // time: lingering is dangerous
  rise += depth * 0.06;                             // depth: deeper is worse
  // fresh-mark proximity
  for (const m of WEST_PACK.marks) {
    const d = dist(S.wolf.x, S.wolf.y, m.x, m.y);
    if (d < 220) rise += (1 - d / 220) * markFreshness(m) * 0.10;
  }
  // detection: a rival with sight/scent on her — upwind, in the open, by day
  const c = patrolCentroid();
  const seen = dist(S.wolf.x, S.wolf.y, c.x, c.y) < 460;
  let detect = 0;
  if (seen) {
    detect = 1;
    if (typeof daylight === 'function') detect *= 0.5 + 0.5 * clamp(daylight(), 0, 1);
    if (S.wind) {                                   // Aspen upwind of them = smelled
      const dx = S.wolf.x - c.x, dy = S.wolf.y - c.y, dd = Math.hypot(dx, dy) || 1;
      const align = (dx * Math.cos(S.wind.a) + dy * Math.sin(S.wind.a)) / dd;
      detect *= 0.6 + 0.6 * clamp(align, -1, 1);    // downwind halves, upwind boosts
    }
  }
  rise *= 1 + detect * 2.2;
  // hiding: still, low, downwind, and no one near — bleed a little back
  if (!S.wolf.moving && !seen) rise -= 0.05;
  // capped & smoothed: never cross more than one threshold in a tick
  S.exposure = clamp(S.exposure + clamp(rise, -0.05, 0.10) * dt, 0, 1);
}

function westPackUpdate(dt) {
  if (S.era === 'past') return;
  // P2: arrival — marks-first, midyear, caused not gradual
  if (!westActive()) { S.exposure = 0; S.westState = 'none'; S.westRivals = []; return; }
  if (!S.tut.westArrived) {
    S.tut.westArrived = true;
    say('New marks on the far side. Another pack, driven the same way we are.');
    saveGame();
  }

  S.westLaneT = Math.max(0, (S.westLaneT || 0) - dt);
  westExposureStep(dt);

  // P8: the reveal — reaching the scar that displaced them completes the
  // mirror wordlessly: another pack's version of her own highway
  if (!S.tut.westScarSeen && nearFootprint({ footprint: 'westCut' }, 180)) {
    S.tut.westScarSeen = true;
    say('This is what drove them. The same hands, a different corner.');
  }

  // P5: the encounter state machine, driven by exposure. A won lane holds
  // exposure down and the pack quiet while it lasts.
  if (S.westLaneT > 0) { S.exposure = Math.min(S.exposure, 0.2); }
  const e = S.exposure;
  const prev = S.westState;
  if (e >= 1.0) S.westState = 'clash';
  else if (e >= 0.66) S.westState = 'confrontation';
  else if (e >= 0.33) S.westState = 'sighting';
  else S.westState = 'calm';

  // rivals become visible from sighting on, pacing her at the vision edge
  if (S.westState === 'sighting' || S.westState === 'confrontation') {
    const c = patrolCentroid();
    if (!S.westRivals.length) {
      S.westRivals = [{ x: c.x, y: c.y, heading: 0, gait: 0, moving: true },
                      { x: c.x + 40, y: c.y + 30, heading: 0, gait: 0, moving: true }];
    }
    const closeR = S.westState === 'confrontation' ? 150 : 240;
    for (const rv of S.westRivals) {
      const d = dist(rv.x, rv.y, S.wolf.x, S.wolf.y) || 1;
      const want = closeR;
      const step = (d - want) * Math.min(1, dt * 1.5);
      rv.x += (S.wolf.x - rv.x) / d * step;
      rv.y += (S.wolf.y - rv.y) / d * step;
      rv.heading = Math.atan2(S.wolf.y - rv.y, S.wolf.x - rv.x);
      rv.gait += Math.abs(step); rv.moving = true;
    }
  } else {
    S.westRivals = [];
  }

  // transition voice
  if (prev !== 'sighting' && S.westState === 'sighting') {
    S.fear = Math.min(1, S.fear + 0.15);
    say('Shapes at the edge of the fog, west. They have seen her.');
  }
  if (prev !== 'confrontation' && S.westState === 'confrontation') {
    S.fear = Math.min(1, S.fear + 0.2);
    playGrowl();
    stickyPrompt('Their line. Stand the pack tall — F — or fall back.', ['F']);
  }
  // P5: a clash is only reached by forcing deeper with no withdraw; it is a
  // costly failure, resolved and then she is pushed out regardless
  if (S.westState === 'clash' && prev !== 'clash') {
    westResolveClash();
  }
}

// P6: the posture standoff resolves on relative strength. Win → a lane opens
// and she passes. Lose → driven back to the entry edge, unhurt, to try
// another way. Called by pressing F in confrontation.
function westResolvePosture() {
  const mine = aspenStrength();
  clearPrompt();
  if (mine >= WEST_PACK.strength * 0.9) {
    S.westLaneT = 40;                               // a corridor opens for a while
    S.exposure = 0.15;
    S.westState = 'calm';
    S.westRivals = [];
    playGrowl();
    say('They give way. Not friendship — arithmetic.');
  } else {
    westDriveBack();
    S.fear = Math.min(1, S.fear + 0.4);
    say('Stronger than us, today. She pulls the pack back.');
    westSurfaceTiming();
  }
}

// pushed back to the territory edge she entered from — repositioned, NOT hurt
function westDriveBack() {
  const T = WEST_PACK.territory;
  let dx = S.wolf.x - T.x, dy = S.wolf.y - T.y, d = Math.hypot(dx, dy);
  if (d < 1) { dx = 1; dy = 0; d = 1; }   // at the center: fall back east, toward the approach
  S.wolf.x = T.x + dx / d * (T.r + 80);
  S.wolf.y = T.y + dy / d * (T.r + 80);
  S.exposure = 0.4;
  S.westState = 'calm';
  S.westRivals = [];
}

// P5: the clash — brief, non-gory, costly; whoever is weaker is likelier to
// lose one. Winning still costs. She is forced out afterward regardless.
function westResolveClash() {
  const mine = aspenStrength(), theirs = WEST_PACK.strength;
  S.fear = 1; S.shake = Math.max(S.shake, 10); playHurt();
  const iAmWeaker = mine < theirs;
  // a possible loss on the weaker side (Aspen's side only affects her pack)
  if (iAmWeaker && Math.random() < 0.5) {
    const victims = alivePack().filter(w => !w.pup);
    if (victims.length) {
      const w = victims[Math.floor(Math.random() * victims.length)];
      w.state = 'dead';
      S.history.push({ type: 'loss', day: day(), who: w.id });
      say(`Teeth in the dark. ${w.name} does not get up. She breaks the pack away.`);
    } else {
      S.injuredT = INJURY_TIME;
      say('Teeth in the dark. She is hurt, and breaks the pack away.');
    }
  } else {
    S.injuredT = INJURY_TIME;
    say('A brief, ugly tangle. She drives them off a step and pulls back, bleeding.');
  }
  westDriveBack();
  westSurfaceTiming();
  saveGame();
}

// P7: there is NO way around their ground — a weak pack must READ them and
// slip through when the patrol turns away. On a loss, teach the timing.
function westSurfaceTiming() {
  if (S.tut.westTiming) return;
  S.tut.westTiming = true;
  showPrompt('No way around them. Read their marks — cross when the fresh sign is on the far side.', [], 8);
}

// ── the standoff ─────────────────────────────────────────────────────────────
// Rival ground, northeast. Two shapes at the treeline: hold with the pack
// at your back, leave, or press alone and learn about lines.

function nearestRedDist() {
  let bd = Infinity;
  for (const m of SCENT_RED) bd = Math.min(bd, dist(S.wolf.x, S.wolf.y, m.x, m.y));
  return bd;
}

function standoffUpdate(dt) {
  S.standoffCd = Math.max(0, S.standoffCd - dt);

  if (!S.standoff) {
    if (S.standoffCd <= 0 && nearestRedDist() < 500) {
      let mark = SCENT_RED[0], bd = Infinity;
      for (const m of SCENT_RED) {
        const d = dist(S.wolf.x, S.wolf.y, m.x, m.y);
        if (d < bd) { bd = d; mark = m; }
      }
      const a = Math.atan2(mark.y - S.wolf.y, mark.x - S.wolf.x);
      S.standoff = {
        t: 0,
        rivals: [-0.5, 0.5].map(off => ({
          x: S.wolf.x + Math.cos(a + off * 0.5) * 200,
          y: S.wolf.y + Math.sin(a + off * 0.5) * 200,
          heading: a + Math.PI, gait: 0, moving: false,
        })),
      };
      S.fear = Math.min(1, S.fear + 0.2);
      playGrowl();
      say('Shapes at the treeline. Still. Watching.');
    }
    return;
  }

  const so = S.standoff;
  so.t += dt;
  for (const rv of so.rivals) {
    // they hold a posture-distance from her, always facing
    const d = dist(rv.x, rv.y, S.wolf.x, S.wolf.y);
    const want = 130;
    if (Math.abs(d - want) > 12) {
      const dir = d > want ? 1 : -1;
      const step = 120 * dt * dir;
      rv.x += (S.wolf.x - rv.x) / d * step;
      rv.y += (S.wolf.y - rv.y) / d * step;
      rv.gait += Math.abs(step);
      rv.moving = true;
    } else {
      rv.moving = false;
    }
    rv.heading = Math.atan2(S.wolf.y - rv.y, S.wolf.x - rv.x);
  }

  const adultsNear = alivePack().filter(w => !w.pup && dist(w.x, w.y, S.wolf.x, S.wolf.y) < 220).length;

  if (nearestRedDist() > 560) {
    S.standoff = null;
    S.standoffCd = 60;
    say('Their ground. Not yours today.');
  } else if (adultsNear >= 2 && so.t > 4) {
    S.standoff = null;
    S.standoffCd = 90;
    say('The line holds. They give back into the trees.');
  } else if (adultsNear < 2 && so.t > 6) {
    S.standoff = null;
    S.standoffCd = 90;
    S.injuredT = INJURY_TIME;
    S.fear = Math.min(1, S.fear + 0.6);
    S.shake = 8;
    // shoved back toward home ground
    let mark = SCENT_RED[0], bd = Infinity;
    for (const m of SCENT_RED) {
      const d = dist(S.wolf.x, S.wolf.y, m.x, m.y);
      if (d < bd) { bd = d; mark = m; }
    }
    const a = Math.atan2(S.wolf.y - mark.y, S.wolf.x - mark.x);
    tryMove(S.wolf, Math.cos(a) * 120, Math.sin(a) * 120, wolfBlockedAt);
    playHurt();
    say('Teeth. A shove. A lesson about lines.');
  }
}

// ── Lichen ───────────────────────────────────────────────────────────────────
// An outsider from a different fragmented territory, come south. She brings
// the only knowledge of ground beyond Willow's range — and an unsettled pack.

function lichenUpdate() {
  if (S.lichenJoined || day() < 100) return;
  S.lichenJoined = true;
  // she arrives from the north — but never inside a pit, a berm, or the road
  let lx = S.wolf.x, ly = S.wolf.y - 300;
  for (let t = 0; t < 24 && (packBlockedAt(lx, ly) || onRoad(lx, ly)); t++) {
    const a = Math.random() * Math.PI * 2;
    lx = S.wolf.x + Math.cos(a) * (220 + Math.random() * 220);
    ly = S.wolf.y + Math.sin(a) * (220 + Math.random() * 220);
  }
  S.pack.push({
    id: 'lichen', name: 'Lichen', mult: 1.05, yearling: false,
    x: lx, y: ly, state: 'follow', gait: 0, moving: false,
  });
  for (const eid of ['northRidge-blackPines', 'blackPines-birchDraw', 'northRidge-ridgeSaddle']) {
    const e = S.edges.find(x => x.id === eid);
    if (e && e.state === 'unknown') {
      e.state = 'current-dotted';
      e.passCount = 1;
      e.inkLo = 0; e.inkHi = 1;
      e.lastUsedDay = day();
    }
  }
  recomputeGhosts();
  checkBridges();
  S.fear = Math.min(1, S.fear + 0.15);
  say('A stranger walks in from the north. Thin, watchful. She knows ground you do not.');
  saveGame();
}

// ── water, and the dangers the land grew this year ──────────────────────────
// Thirst runs beside hunger. Clean water is the land's; fouled water is
// people's, and it costs. Steel waits by the wire once the ledger rises;
// the road leaves meat on its shoulder; winter water bites back.

const WATER_PER_SEC = 0.10;

// The water is the DRAWN water: the creek's own line, and the real ponds.
// And water near people is wrong water — whatever people it is near.
function waterFouled(x, y) {
  if (S.era === 'past') return false;
  const ms = OBSTACLES.mudSink;
  if (dist(x, y, ms.x, ms.y) < 900) return true;                       // the impoundment
  for (const key of ['construction', 'subdivision', 'gravelPit']) {
    const o = obstacleRect(key);
    const dx = Math.max(o.x0 - x, 0, x - o.x1), dy = Math.max(o.y0 - y, 0, y - o.y1);
    if (Math.hypot(dx, dy) < 420) return true;
  }
  if (dist(x, y, RANCH.house.x, RANCH.house.y) < 900) return true;     // the cattle's ground
  const h = OBSTACLES.highway;
  const dRoad = x < h.x0 ? h.x0 - x : x > h.x1 ? x - h.x1 : 0;
  if (dRoad < 220) return true;                                        // asphalt runoff
  return false;
}

function waterAt(x, y) {
  for (const p of PONDS) {
    if (dist(x, y, p.x, p.y) < p.r) return { clean: !waterFouled(p.x, p.y), name: p.name };
  }
  for (const p of (S.foundWater || [])) {
    if (dist(x, y, p.x, p.y) < p.r) return { clean: true, name: p.name };
  }
  const cf = TERRAIN.creekFlow;
  for (let i = 1; i < cf.length; i++) {
    const [ax, ay] = cf[i - 1], [bx, by] = cf[i];
    if (distSeg(x, y, ax, ay, bx, by).d < 48) {
      const f = waterFouled(x, y);
      return { clean: !f, name: f ? 'this dead stretch of the creek' : 'the creek' };
    }
  }
  return null;
}

function waterUpdate(dt) {
  S.water = Math.max(0, S.water - WATER_PER_SEC * dt);
  S.sickT = Math.max(0, (S.sickT || 0) - dt);
  S.foulCd = Math.max(0, (S.foulCd || 0) - dt);
  S.iceCd = Math.max(0, (S.iceCd || 0) - dt);
  // thirst teaches itself before she ever finds a bank
  if (!S.tut.drinkTaught && S.water < 55 && S.mode === 'play') {
    S.tut.drinkTaught = true;
    showPrompt('Thirst. Find water — the creek, a pond — stand in it and hold Q to drink.', ['Q'], 9);
  }
  const ws = waterAt(S.wolf.x, S.wolf.y);
  if (!ws) return;
  // thin ice bites whether or not she means to drink
  if (seasonIndex() === 3 && S.iceCd <= 0 && Math.random() < 0.05 * dt * 20) {
    S.iceCd = 30;
    S.inputLockT = Math.max(S.inputLockT, 1.6);
    S.fear = Math.min(1, S.fear + 0.3);
    S.food = Math.max(0, S.food - 6);
    S.shake = Math.max(S.shake, 6);
    playHurt();
    say('The ice gives. Cold takes its tax.');
    if (!S.tut.iceTaught) {
      S.tut.iceTaught = true;
      setCaption('Through the ice.', 4.5, 'winter water bites — warmth and meat lost');
    }
  }
  if (!S.tut.drinkHere && S.water < 90) {
    S.tut.drinkHere = true;
    showPrompt('Water underfoot. Hold Q to drink.', ['Q'], 6);
  }
  // drinking is an ACT: standing in the water, head down, holding Q
  if (input.drink && !S.wolf.moving && S.water < 99) {
    S.water = Math.min(100, S.water + 30 * dt);
    if (!ws.clean && S.sickT <= 0 && S.foulCd <= 0) {
      S.sickT = 75;
      S.foulCd = 40;
      playHurt();
      say(`Wrong water at ${ws.name}. It sits in her like a stone.`);
      if (!S.tut.sickTaught) {
        S.tut.sickTaught = true;
        setCaption('Sick.', 4.5, 'wrong water — slower, and hungrier, until it passes');
      }
    }
  }
}

function snareUpdate(dt) {
  S.snaredT = Math.max(0, (S.snaredT || 0) - dt);
  // once his ledger rises, steel appears along the wire
  if (!S.snares.length && S.conflict > 0.4 && day() > 120) {
    const f = OBSTACLES.fence;
    for (let k = 0; k < 3; k++) {
      const t = 0.2 + k * 0.28;
      S.snares.push({
        x: f.x0 + (f.x1 - f.x0) * t - 46,
        y: f.y0 + (f.y1 - f.y0) * t + 46,
        sprung: false,
      });
    }
    say('New smells along the wire: steel, and cord, and patience.');
  }
  for (const sn of S.snares) {
    if (sn.sprung) continue;
    if (dist(S.wolf.x, S.wolf.y, sn.x, sn.y) < 26) {
      sn.sprung = true;
      S.snaredT = 3.5;
      S.injuredT = INJURY_TIME;
      S.fear = Math.min(1, S.fear + 0.4);
      S.fearSource = { x: sn.x, y: sn.y };
      S.shake = Math.max(S.shake, 8);
      playHurt();
      say('Steel jaws. She wrenches free, bleeding, wiser.');
      if (!S.tut.snareTaught) {
        S.tut.snareTaught = true;
        setCaption('A snare.', 4.5, "steel by the wire — the rancher's patience");
      }
      saveGame();
    }
  }
}

// Trains: very fast, very long, and final. The road maims; the rail kills —
// even Aspen. Crossing the ballast is always a bet against the timetable.
function trainUpdate(dt) {
  if (S.era === 'past') return;
  S.trainCd -= dt;
  if (S.trainCd <= 0 && !S.trains.length) {
    S.trainCd = 35 + Math.random() * 40;
    const south = Math.random() < 0.5;
    S.trains.push({
      y: south ? -APRON - 1600 : WORLD.h + APRON + 1600,
      vy: (south ? 1 : -1) * 1700,
      len: 1300,
      met: new Set(),
    });
    playRumble();
  }
  const rl = OBSTACLES.rail;
  const cx = (rl.x0 + rl.x1) / 2;
  for (let i = S.trains.length - 1; i >= 0; i--) {
    const t = S.trains[i];
    t.y += t.vy * dt;
    const y0 = Math.min(t.y, t.y - Math.sign(t.vy) * t.len);
    const y1 = Math.max(t.y, t.y - Math.sign(t.vy) * t.len);
    const wolves = [{ ref: S.wolf, id: 'aspen' }, ...alivePack().map(w => ({ ref: w, id: w.id }))];
    for (const q of wolves) {
      if (t.met.has(q.id)) continue;
      if (onRail(q.ref.x, q.ref.y) && q.ref.y > y0 - 24 && q.ref.y < y1 + 24) {
        t.met.add(q.id);
        if (q.id === 'aspen') {
          if (S.mode === 'play') { playHurt(); startEnding('dead'); return; }
        } else {
          q.ref.state = 'dead';
          S.fear = 1;
          S.fearSource = { x: cx, y: q.ref.y };
          playHurt();
          S.history.push({ type: 'loss', day: day(), who: q.id });
          say(`${q.ref.name} does not come off the rail.`);
          saveGame();
        }
      }
    }
    if (t.y < -APRON - 1800 || t.y > WORLD.h + APRON + 1800) S.trains.splice(i, 1);
  }
}

// B3: reaching a rumor cashes it — into a real feature, or an empty promise,
// or a memory the world has since changed.
function rumorUpdate() {
  if (S.era === 'past') return;
  for (const r of RUMORS) {
    if (S.rumorsSeen.includes(r.id)) continue;
    if (dist(S.wolf.x, S.wolf.y, r.x, r.y) >= 130) continue;
    S.rumorsSeen.push(r.id);
    markSeen(r.x, r.y, SIGHT_WORLD);
    if (r.resolvesTo === 'changed') {
      say('She remembered water here. It is a dead pond now, behind a berm.');
    } else if (r.type === 'water') {
      S.foundWater.push({ x: r.x, y: r.y, r: 70, clean: true, name: 'the hidden spring' });
      say('Water, where her mother said it would be. Clean, and cold.');
    } else if (r.type === 'carrion') {
      S.food = Math.min(100, S.food + 20);
      say('An old kill, half-buried. Enough to matter.');
    } else if (r.type === 'vantage') {
      S.vantageT = 30;
      say('High ground. For a while the land opens wide below her.');
    } else if (r.type === 'den') {
      const near = DEN_SITES.reduce((b, s) =>
        dist(r.x, r.y, s.x, s.y) < dist(r.x, r.y, b.x, b.y) ? s : b, DEN_SITES[0]);
      if (near && !S.seenDens.includes(near.id)) S.seenDens.push(near.id);
      say('A bank where a den could go, just as she was told.');
    }
    saveGame();
  }
}

function roadkillUpdate(dt) {
  if (S.roadkill) {
    if (dist(S.wolf.x, S.wolf.y, S.roadkill.x, S.roadkill.y) < 40) {
      S.roadkill = null;
      S.food = Math.min(100, S.food + 15);
      say('Something the road killed first. Meat, for nerve.');
    }
    return;
  }
  S.roadkillCd = (S.roadkillCd === undefined ? 50 : S.roadkillCd) - dt;
  if (S.roadkillCd <= 0) {
    S.roadkillCd = 45 + Math.random() * 40;
    const h = OBSTACLES.highway;
    const side = Math.random() < 0.5 ? h.x0 - 22 : h.x1 + 22;
    const rk = { x: side, y: 400 + Math.random() * (WORLD.h - 800) };
    S.roadkill = rk;
    // its rumor is laid in scent, not words
    for (let i = 0; i < 5; i++) {
      S.scent.push({ x: rk.x + (Math.random() - 0.5) * 60, y: rk.y + (Math.random() - 0.5) * 60, t: S.time, v: 0 });
    }
  }
}

// ── the fire ─────────────────────────────────────────────────────────────────
// Dry lightning in the east, one summer day. Everything that runs, runs west
// together — predator and prey in truce-by-panic. Afterward the eastern
// woods stand charred for the rest of the year.

function fireUpdate(dt) {
  const f = S.fire;
  if (f.state === 'none' && seasonIndex() === 1 && day() >= (f.day || 130)) {
    f.state = 'burning';
    f.t = 0;
    setCaption('Dry lightning, east.', 4, 'the world runs west together');
    playRumble();
    S.fear = Math.min(1, S.fear + 0.3);
    S.fearSource = { x: S.wolf.x + 900, y: S.wolf.y };
  }
  if (f.state === 'burning') {
    f.t += dt;
    if (f.t > 50) {
      f.state = 'done';
      say('Rain, at last, on black ground.');
      saveGame();
    }
  }
}

function totalCount() {
  let n = 1 + S.pack.length;
  if (S.pups) n += S.pups.traveling ? S.pups.lost : S.pups.count + S.pups.lost;
  return n;
}

// (The task/urge system was removed. What the year asks is carried by the
// world itself — hunger, thirst, the pups, the tears, the pull west.)

// What the year asks of her right now — shown quietly under the day counter.
function objectiveText() {
  const si = seasonIndex();
  if (si === 0) {
    if (!S.denId) return 'a den must be chosen';
    if (!S.pups) {
      // the birth is only news when it is close
      return day() >= PUPS_BORN_DAY - 10 ? 'the pups are coming' : 'walk her lines into your own ink';
    }
    return 'keep the pups fed';
  }
  if (si === 1) return (S.pups && S.pups.count > 0) ? 'keep the pups fed — the land is drying' : 'the land is drying';
  if (si === 2) return day() < PUPS_TRAVEL_DAY ? 'scout the way west — teach the young' : 'west, before the snow';
  return 'reach the Winter Range';
}

// ── the long tutorial (in-game path; the prologue teaches the early verbs) ───

// One voice at a time: a prompt that fires while another is showing waits
// its turn in a small queue rather than talking over it.
function showPrompt(text, keys, dur) {
  const p = { text, keys: keys || [], dur, t: 0, sticky: false };
  if (S.prompt || S.promptQueue.length) {
    if ((!S.prompt || S.prompt.text !== text) && !S.promptQueue.some(q => q.text === text)) {
      S.promptQueue.push(p);
    }
  } else {
    S.prompt = p;
  }
}
function stickyPrompt(text, keys) {
  if (S.prompt && !S.prompt.sticky) S.promptQueue.unshift(S.prompt);
  S.prompt = { text, keys: keys || [], dur: Infinity, t: 0, sticky: true };
}
function clearPrompt() { S.prompt = null; }

function promptTick(dt) {
  if (S.prompt) {
    S.prompt.t += dt;
    if (!S.prompt.sticky && S.prompt.t > S.prompt.dur + 0.8) S.prompt = null;
  } else if (S.promptQueue.length) {
    S.promptGap += dt;
    if (S.promptGap > 0.5) {
      S.promptGap = 0;
      S.prompt = S.promptQueue.shift();
      S.prompt.t = 0;
    }
  }
}

function queueCallout(id) {
  if (!S.callouts.includes(id)) S.callouts.push(id);
}

const CALLOUT_VIEW = {
  'willow-ink': 'map', den: 'map', 'own-ink': 'map', rip: 'map', goal: 'map',
  gold: 'scent', violet: 'scent', red: 'scent',
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
    if (T.step === 4) stickyPrompt('She left you her map of this land. Press SPACE to remember it.', ['SPACE']);
    if (T.step === 5) stickyPrompt('SPACE again returns her to the land.', ['SPACE']);
    if (T.step === 8) stickyPrompt('Prey leaves its scent on the land. Hold E to smell the wind.', ['E']);
    if (T.step === 10) stickyPrompt('Run the prey until it tires. F asks the pack to wait in ambush.', ['F']);
  }

  switch (T.step) {
    case 0:
      if (T.t > 2.4) { showPrompt('You are Aspen.', [], 4); tutStep(1); }
      break;
    case 1:
      if (T.t > 7) tutStep(2);
      break;
    case 2:
      if (T.moved > 150) {
        clearPrompt();
        S.hud.pack = true;
        showPrompt('They follow you now. Your mother led them for nine years.', [], 5.5);
        tutStep(3);
      }
      break;
    case 3:
      if (T.moved > 900 || T.t > 40) tutStep(4);
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
      if (S.senseBlend < 0.2 && T.t > 4) {
        showPrompt('Her memory is old. The land may have moved on.', [], 5.5);
        tutStep(6);
      }
      break;
    case 6:
      if ((day() >= 2 || S.food < 58) && T.t > 14) {
        S.hud.food = true;
        S.hud.day = true;
        showPrompt('The pack is hungry.', [], 4.5);
        tutStep(7);
      }
      break;
    case 7:
      if (T.t > 8) tutStep(8);
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
      if (T.t > 6) { T.fTaught = true; tutStep(10); }
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
        showPrompt('What she knows how to do: H.', ['H'], 5);
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
  if (!T.redSeen && input.scent
      && SCENT_RED.some(r => dist(S.wolf.x, S.wolf.y, r.x, r.y) < 700)) {
    T.redSeen = true;
    queueCallout('red');
  }
  if (!T.routeTaught && T.step >= 6 && S.senseBlend > 0.85) {
    T.routeTaught = true;
    showPrompt('Click a place she knows — the map will show her the way.', [], 6);
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
}

// ── THE PROLOGUE — nine beats, per the bible, in 2D ─────────────────────────
// A trap in the shape of a tutorial: every mechanic at its most generous,
// on land that no longer exists.

// Session-scoped only: a page reload always starts the entire game over,
// prologue included. Within one session, N after finishing it skips ahead.
let prologueDoneSession = false;
function prologueDone() { return prologueDoneSession; }
function markPrologueDone() { prologueDoneSession = true; }

function startPrologue() {
  S.mode = 'prologue';
  S.era = 'past';
  S.beat = 1; S.beatT = 0;
  // her map does not exist yet: the prologue draws it before your eyes
  for (const e of S.edges) { e.state = 'unknown'; e.torn = false; }
  recomputeGhosts();
  // no traffic; one calm morning
  S.cars.length = 0;
  // something to smell from the first breath: last night's passages, laid
  // as a readable freshness gradient arcing past the den
  let sx = DEN.x - 420, sy = DEN.y + 260, sa = -0.5;
  for (let k = 0; k < 26; k++) {
    sa += (Math.random() - 0.5) * 0.5;
    sx += Math.cos(sa) * 55; sy += Math.sin(sa) * 55;
    S.scent.push({ x: sx, y: sy, t: S.time - (26 - k) * 9, v: 0 });
  }
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
  for (const e of S.edges) {
    const d = EDGES.find(x => x.id === e.id);
    if (e.state === 'unknown' && d.state === 'inherited') e.state = 'inherited';
  }
  recomputeGhosts();
  // the migration corridor she walked with Willow is seen from the first
  // frame of Act I (seeds the skip path to match a played prologue)
  seedSeenAlong(['den', 'aspenStand', 'oldFord', 'sageFlat', 'farBench',
    'highMeadow', 'ashSaddle', 'winterRange']);
  // the prologue already taught move / scent / map / hunt / F
  S.tut.step = 6; S.tut.t = 0;
  // F is NOT taught here: the verb arrives in spring, when the pack is hers
  S.tut.sawMap = true; S.tut.scentHold = 1; S.tut.usedHold = true;
  S.hud.pack = true;
  S.clock.min = 8 * 60; S.lastDay = 1;
  // Spring opens away from every hollow: the den choice must be walked to,
  // and the map is how she weighs it
  const start = NbyId.get('aspenStand');
  S.wolf.x = start.x; S.wolf.y = start.y;
  S.trail = [{ x: start.x, y: start.y }];
  S.cam.x = start.x; S.cam.y = start.y;
  let i = 0;
  for (const w of S.pack) { i++; w.x = start.x - 30 * i; w.y = start.y + (i % 2 ? 20 : -20); w.state = 'follow'; }
  S.cars.length = 0;
  S.willow = null;
  S.mapOpen = false;
  // the land refills for Act I (the prologue emptied it for its scripted hunt)
  S.elk.length = 0; S.elkRespawn.length = 0;
  for (let h = 0; h < HERDS.length; h++) {
    for (let k = 0; k < HERDS[h].count; k++) spawnPrey(h);
  }
  S.passageFade = 1.8;   // the white lets go slowly over the first thaw
  setCaption('Spring.', 3.5, 'the first thaw after her — the pack is yours now');
  // the year's first decision, named at once
  S.tut.denPrompt = true;
  showPrompt('The pups will come with the late spring. A den must be chosen — raise the map; the hollows are marked.', ['SPACE'], 9);
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
  // a vista held for a keypress fades fully in, then waits; otherwise it lowers
  if (S.vistaWait) {
    S.vistaT = Math.max((S.vistaTMax || 3.4) - 0.7, S.vistaT - dt);
    S.inputLockT = Math.max(S.inputLockT, 0.5);   // stay put until she looks away
  } else {
    S.vistaT = Math.max(0, S.vistaT - dt);
  }
  S.bondGlow = Math.max(0, S.bondGlow - dt * 0.6);
  S.ghostPulse = Math.max(0, S.ghostPulse - dt);
  S.inheritBloom = Math.max(0, S.inheritBloom - dt * 0.25);

  moveAspen(dt);
  willowUpdate(dt);
  packUpdate(dt);
  moveCars(dt);
  carCollisions();
  preyUpdate(dt);   // the world's prey lives (and lays scent) from beat 1
  calloutUpdate(dt);

  if (S.caption) {
    S.caption.t += dt;
    if (S.caption.t > S.caption.dur + 1.2) S.caption = null;
  }

  // the soft chevron: where the prologue wants her to look
  S.guide = null;
  if (S.beat === 2 && dist(S.wolf.x, S.wolf.y, OVERLOOK.x, OVERLOOK.y) > 260) S.guide = OVERLOOK;
  if (S.beat === 9 && dist(S.wolf.x, S.wolf.y, DEN.x, DEN.y) > 300) S.guide = { x: DEN.x, y: DEN.y };

  // the "look here" caret follows the introduced creature until its time runs out
  S.pointAt = null;
  if ((S.pointTagT || 0) > 0) {
    S.pointTagT -= dt;
    const t = resolvePointTarget(S.pointTag);
    if (t) S.pointAt = { x: t.x, y: t.y };
  }

  const w = S.willow;
  const T = S.tut;

  switch (S.beat) {
    // Beat 1 — waking in the den: movement and scent, in the calmest place
    case 1:
      if (S.beatT > 5 && !S.prompt && T.moved < 120) stickyPrompt('Walk.', ['W', 'A', 'S', 'D']);
      // before the world, the family: you first, then the pack, each named and
      // pointed out as it wakes
      if (T.moved >= 120 && !T._b1pack) {
        T._b1pack = true;
        T._b1packT = 0;
        clearPrompt();
        setCaption('You are Aspen.', 3.4, "Willow's daughter, three springs old");
        pointOut('aspen', 3.2);
      }
      if (T._b1pack && !T._b1scent) {
        T._b1packT += dt;
        if (T._b1packT > 3.8 && !T._b1n1) {
          T._b1n1 = true;
          setCaption('Bram, grey at the muzzle.', 3.4, 'he knew this valley before the road had a name');
          pointOut('bram', 3.4);
        }
        if (T._b1packT > 7.6 && !T._b1n2) {
          T._b1n2 = true;
          setCaption('Sedge, restless.', 3.4, 'first to the kill, first to worry');
          pointOut('sedge', 3.4);
        }
        if (T._b1packT > 11.4 && !T._b1n3) {
          T._b1n3 = true;
          setCaption('Alder, a yearling.', 3.4, 'all legs and questions');
          pointOut('alder', 3.4);
        }
        if (T._b1packT > 15.2 && !T._b1n4) {
          T._b1n4 = true;
          setCaption('Fen, the other.', 3.4, 'a half-step behind her brother, always');
          pointOut('fen', 3.4);
        }
        if (T._b1packT > 19) {
          T._b1scent = true;
          stickyPrompt('The world speaks in scent. Hold E.', ['E']);
          // a deer crosses the morning from offscreen, close by, writing
          // its gold across her nose as the lesson is given
          S.elk.push({
            herd: 1, x: S.wolf.x + 460, y: S.wolf.y - 210,
            heading: Math.PI, stamina: 100, fleeing: false, gait: 0,
            bull: false, skittish: 0.1, grazeT: 90,
            tx: S.wolf.x - 460, ty: S.wolf.y + 110,
            vx: 0, vy: 0,
          });
        }
      }
      if (T._b1scent && input.scent) T.scentHold += dt;
      if (T.scentHold > 2.5) {   // long enough to actually read the gold
        clearPrompt();
        S.beat = 2; S.beatT = 0;
        setCaption('The scent of the whole valley.', 3.5);
        showPrompt('Morning light on the overlook, west of the den.', [], 6);
      }
      break;

    // Beat 2 — first sightline: the valley, unbroken. The vista holds until
    // she looks away (any key); only then does beat 3 begin.
    case 2:
      if (!T._b2held && dist(S.wolf.x, S.wolf.y, OVERLOOK.x, OVERLOOK.y) < 130) {
        T._b2held = true;
        S.vistaT = 3.4; S.vistaTMax = 3.4; S.inputLockT = 999; S.vistaWait = true;
        setCaption('The valley. Whole.', 900, 'press any key when you have seen it');
        // Willow appears and the map begins
        S.willow = {
          x: OVERLOOK.x - 60, y: OVERLOOK.y - 30, heading: Math.PI,
          gait: 0, moving: false, alive: true, lying: false, path: [],
        };
        inkInheritedEdge('den-aspenStand');
        S.visited.add('aspenStand');
      }
      break;

    // Beat 3 — following Willow: she shows you her map. You don't hold it yet.
    case 3:
      if (S.beatT > 3.5 && !T._b3go) {
        T._b3go = true;
        setCaption('Willow.', 3, 'your mother — follow her');
        pointOut('willow', 4);
        willowSetPath([nodePt('oldFord', 'aspenStand-oldFord')]);
      }
      if (T._b3go && !T._b3shown && S.beatT > 6.5) {
        T._b3shown = true;
        S.forcedSenseT = 5;              // her doing, not a key
        queueCallout('willow-ink');
        setCaption('Her map.', 4.5, 'not yours — not yet');
      }
      if (T._b3shown) {
        T._mapClosedT = (S.forcedSenseT <= 0 && S.senseBlend < 0.15)
          ? (T._mapClosedT || 0) + dt : 0;
        if (!T._b3follow && (T._mapClosedT || 0) > 0.5) {
          T._b3follow = true;
          showPrompt('Follow her.', [], 5);
        }
      }
      if (w && !w.path.length && dist(w.x, w.y, NbyId.get('oldFord').x, NbyId.get('oldFord').y) < 60
          && dist(S.wolf.x, S.wolf.y, w.x, w.y) < 260 && T._b3shown && (T._mapClosedT || 0) > 1.5) {
        S.beat = 4; S.beatT = 0;
        // an easy hunt on open, unbroken ground
        S.prologueElk = true;
        S.elk.length = 0;
        // spawn it just ahead of Aspen, toward the open ford — always on the
        // close-in camera when it is named, and pointed out
        const ford = NbyId.get('oldFord');
        const ea = Math.atan2(ford.y - S.wolf.y, ford.x - S.wolf.x);
        const ex = S.wolf.x + Math.cos(ea) * 160, ey = S.wolf.y + Math.sin(ea) * 160;
        S.elk.push({
          herd: 0, x: ex, y: ey,
          heading: Math.PI / 2, stamina: 32, fleeing: false, gait: 0,
          bull: false, skittish: 0.8, grazeT: 99, tx: ex, ty: ey,
          frail: 0.55,   // winter-thin: the first hunt is meant to be won
        });
        setCaption('An elk, winter-thin.', 3.5);
        pointOut('elk', 4);
        showPrompt('Run it down.', [], 6);
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
          // the waiting line is stale the moment the truck is past: replace
          // it now, not after its timer — and skip it if she already crossed
          S.prompt = null; S.promptQueue.length = 0;
          if (S.wolf.x >= 880) showPrompt('Now. Cross behind her.', [], 6);
        }
      }
      if (T._b5go && S.wolf.x < 880) {
        S.beat = 6; S.beatT = 0;
        setCaption('The far side.', 3);
        S.prompt = null; S.promptQueue.length = 0;  // crossing talk ends at the crossing
        stickyPrompt('Lean into her — press SPACE.', ['SPACE']);
      }
      break;

    // Beat 6 — rest and bonding (optional; it skips itself)
    case 6:
      if (S.bondT > 0 && w) {
        // the play-fight: two wolves circling, tails high
        S.bondT -= dt;
        const a2 = S.time * 5;
        S.wolf.x = S.bondC.x + Math.cos(a2) * 26;
        S.wolf.y = S.bondC.y + Math.sin(a2) * 26;
        S.wolf.heading = a2 + Math.PI / 2;
        S.wolf.moving = true; S.wolf.gait += 140 * dt;
        w.x = S.bondC.x - Math.cos(a2) * 26;
        w.y = S.bondC.y - Math.sin(a2) * 26;
        w.heading = a2 - Math.PI / 2;
        w.moving = true; w.gait += 140 * dt;
      }
      if ((S.tut._bond && w && dist(S.wolf.x, S.wolf.y, w.x, w.y) < 90) || S.beatT > 14) {
        clearPrompt();
        if (S.beatT <= 14 && S.bondT <= 0) {
          S.bondGlow = 1.6;
          S.bondT = 1.8;
          S.bondC = { x: (S.wolf.x + w.x) / 2, y: (S.wolf.y + w.y) / 2 };
          S.inputLockT = 1.8;
          playYip();
          setCaption('Hers. Yours.', 3);
        }
        if (S.beatT > 14) { /* the moment passed unnoticed; move on */ }
        else if (S.bondT > 0.05) break;   // let the circling finish first
        S.beat = 7; S.beatT = 0;
        // no verb is taught here: the pack is WILLOW's to lead. F becomes
        // Aspen's word only after the inheritance, in spring.
      }
      break;

    // Beat 7 — she walks the last miles to the range, and you follow
    case 7:
      if (!T._b7go && S.beatT > 2.5) {
        T._b7go = true;
        clearPrompt();
        showPrompt('Follow. The winter range is close now.', [], 5);
        willowSetPath([
          nodePt('farBench', 'sageFlat-farBench'),
          nodePt('highMeadow', 'farBench-highMeadow'),
          nodePt('ashSaddle', 'highMeadow-ashSaddle'),
          nodePt('winterRange', 'ashSaddle-winterRange'),
        ]);
      }
      if (w && T._b7go && !w.path.length
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
        S.zoneAnchor = null;   // the zone comes with her through the cut
        let i = 0;
        for (const p of S.pack) {
          i++;
          p.x = S.wolf.x - 26 * i; p.y = S.wolf.y + (i % 2 ? 18 : -18);
          p.state = 'follow'; p.tx = undefined;
        }
        S.cars.length = 0;
        S.vistaT = 3.6; S.vistaTMax = 3.6; S.inputLockT = 999; S.vistaWait = true;
        S.ghostPulse = 3.6;
        S.shake = 6;
        recomputeGhosts();
        setCaption('Three winters later.', 900, 'press any key when you have seen it');
      }
      if (T._b8cut && !S.vistaWait && S.beatT > 9.5 && S.beat === 8) {
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
      // close enough to see the circle over her is close enough to hold
      const nearHer = w && dist(S.wolf.x, S.wolf.y, w.x, w.y) < 110;
      if (!S.inherited) {
        // stillness first: the ask comes only after it has weight
        if (nearHer && !T._b9near) {
          T._b9near = true;
          setCaption('Her breathing is shallow.', 3.5);
        }
        if (T._b9near && !T._b9ask) {
          T._b9askT = (T._b9askT || 0) + dt;
          if (T._b9askT > 6) {
            T._b9ask = true;
            setCaption('She has been waiting for you.', 3.5);
            stickyPrompt('Stay at her side. Hold SPACE.', ['SPACE']);
          }
        }
        if (T._b9ask && nearHer && input.sense) {
          S.inheritHold += dt;
          if (S.inheritHold > INHERIT_HOLD) {
            S.inherited = true;
            w.alive = false;           // her breathing loop simply stops
            S.inheritBloom = 1;        // her warmth blooms around Aspen
            playMotif('inherit');      // five soft notes — the only ceremony
            S.tut.sawMap = true;       // the map is hers now
            clearPrompt();
            S.mapOpen = true;          // and it rises on its own
            queueCallout('rip');       // the damage is already waiting
            setCaption('Her map is yours now.', 4.5, 'and the land has already moved');
          }
        } else {
          S.inheritHold = Math.max(0, S.inheritHold - dt * 2);
        }
      } else {
        // lowering the map — or walking away — begins the passage
        if (!T._b9raised && S.senseBlend > 0.8) T._b9raised = true;
        const lowered = T._b9raised && !S.mapOpen && S.senseBlend < 0.15;
        if (lowered || dist(S.wolf.x, S.wolf.y, DEN.x, DEN.y) > 240) {
          S.beat = 10; S.beatT = 0;
          S.inputLockT = 7;
        }
      }
      break;
    }

    // Beat 10 — the pause after her: winter closes over the den, unwatched,
    // and the world goes white before the thaw
    case 10:
      if (!T._b10) {
        T._b10 = true;
        clearPrompt();
        playHowl();   // one far voice, for her
        setCaption('The winter closes over the den.', 4.5, 'no one watches her through it');
      }
      if (S.beatT > 6.5) {
        markPrologueDone();
        applyPostPrologue();
        S.mode = 'play';
        saveGame();
      }
      break;
  }
}

// ── the year's end ───────────────────────────────────────────────────────────

// The year ends when the PACK is through, not when Aspen tags the node.
const GATHER_R = 400;

function packGathered() {
  const wr = NbyId.get('winterRange');
  return alivePack().every(w => dist(w.x, w.y, wr.x, wr.y) < GATHER_R);
}

function endingCheck() {
  const wr = NbyId.get('winterRange');
  const atRange = dist(S.wolf.x, S.wolf.y, wr.x, wr.y) < 90;
  if (atRange) {
    if (day() < WINTER_START) {
      if (!S.tut.earlyRange) { S.tut.earlyRange = true; say('Not yet. The season has not turned.'); }
    } else if (packGathered()) {
      startEnding('arrived');
      return;
    } else if (!S.tut.rangeWait) {
      S.tut.rangeWait = true;
      say('Not all of them are through. She waits at the edge of the range.');
    }
  }
  if (day() > YEAR_DAYS) startEnding('failed');
}

function survivorCount() {
  if (S.endSurvivors != null) return S.endSurvivors;
  let n = 1 + alivePack().length;
  if (S.pups && !S.pups.traveling) n += Math.max(0, S.pups.count);
  return n;
}

function startEnding(kind) {
  if (kind === 'arrived') {
    // A wolf alive but stranded east walked the year; it did not come through.
    const wr = NbyId.get('winterRange');
    S.endSurvivors = 1 + alivePack().filter(w => dist(w.x, w.y, wr.x, wr.y) < GATHER_R).length;
  } else {
    S.endSurvivors = survivorCount();
  }
  S.mode = 'ending';
  S.endKind = kind;
  S.endT = 0;
  if (kind === 'arrived') playMotif('arrived');
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
    showPrompt('Press R again to restart the game (skips the prologue).', ['R'], 2.5);
  }
}

function beginFromIntro() {
  if (S.wantPrologue) startPrologue();
  else { applyPostPrologue(); S.mode = 'play'; }
}

// ── audio ────────────────────────────────────────────────────────────────────

let audioCtx = null;
let masterGain = null;   // every voice routes through here; M closes the valve
let muted = false;
function getAudioCtx() {
  const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  if (!audioCtx) {
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

function toggleMute() {
  muted = !muted;
  if (!masterGain) getAudioCtx();
  if (masterGain) masterGain.gain.value = muted ? 0 : 1;
  if (S) say(muted ? 'Quiet.' : 'The land has its sounds again.');
}

// ── ambience: the land's wind, and the construction's progress ──────────────
// One looping filtered-noise bed whose weight follows the season, plus the
// machines in the east: a distant clank every few quiet seconds, growing
// through the year — an audible progress bar — until the overpass opens
// and they fall silent. (No music. The land is the score.)

let amb = null;
const SEASON_WIND = [0.045, 0.03, 0.05, 0.08];   // spring summer autumn winter

function ensureAmbience() {
  if (amb) return;
  const ac = getAudioCtx();
  if (!ac || !ac.createBuffer || !ac.createBufferSource || !ac.createBiquadFilter) return;
  const len = Math.floor(ac.sampleRate * 2);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  let v = 0;
  for (let i = 0; i < len; i++) { v = v * 0.98 + (Math.random() * 2 - 1) * 0.05; data[i] = v; }
  const src = ac.createBufferSource();
  src.buffer = buf; src.loop = true;
  const filt = ac.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = 420;
  const g = ac.createGain(); g.gain.value = 0;
  src.connect(filt); filt.connect(g); g.connect(masterGain);
  src.start();
  // the road's low hum, faded in only when she stands near the asphalt
  const hum = ac.createOscillator(), hg = ac.createGain();
  hum.type = 'sawtooth'; hum.frequency.value = 52;
  hg.gain.value = 0;
  hum.connect(hg); hg.connect(masterGain); hum.start();
  amb = { gain: g, filt, hum: hg, clankT: 6, birdT: 5, locT: 0, nearCreek: false };
}

function ambienceUpdate(dt) {
  ensureAmbience();
  if (!amb) return;
  const live = S.mode === 'play' || S.mode === 'prologue';

  // where she stands colors the quiet, sampled a couple of times a second
  amb.locT -= dt;
  if (amb.locT <= 0) {
    amb.locT = 0.6;
    let dCreek = 1e9;
    const cf = TERRAIN.creekFlow;
    for (let i = 0; i < cf.length; i += 2) {
      const px = cf[i].x !== undefined ? cf[i].x : cf[i][0];
      const py = cf[i].y !== undefined ? cf[i].y : cf[i][1];
      dCreek = Math.min(dCreek, dist(S.wolf.x, S.wolf.y, px, py));
    }
    amb.nearCreek = dCreek < 260;
  }

  // wind bed: season sets the weight; water brightens and lifts it
  const target = !live ? 0
    : (S.era === 'past' ? 0.028 : SEASON_WIND[seasonIndex()]) * (amb.nearCreek ? 1.5 : 1);
  amb.gain.gain.value += (target - amb.gain.gain.value) * Math.min(1, dt * 0.5);
  amb.filt.frequency.value += ((amb.nearCreek ? 900 : 420) - amb.filt.frequency.value) * Math.min(1, dt * 1.5);

  // traffic: a low hum that grows as she nears the asphalt
  const h = OBSTACLES.highway;
  const dRoad = S.wolf.x < h.x0 ? h.x0 - S.wolf.x : S.wolf.x > h.x1 ? S.wolf.x - h.x1 : 0;
  const humT = (live && S.era !== 'past') ? 0.05 * clamp(1 - dRoad / 500, 0, 1) : 0;
  amb.hum.gain.value += (humT - amb.hum.gain.value) * Math.min(1, dt * 0.8);

  // birdsong in the green woods, by day
  amb.birdT -= dt;
  if (amb.birdT <= 0) {
    amb.birdT = 4 + Math.random() * 6;
    const inWood = TERRAIN.forests.some(f => dist(S.wolf.x, S.wolf.y, f.x, f.y) < f.r + 120);
    if (live && inWood && seasonIndex() <= 1 && S.era !== 'past'
        && typeof daylight === 'function' && daylight() > 0.5) playChirp();
  }

  if (S.mode === 'play' && S.era !== 'past' && !overpassOpen()) {
    amb.clankT -= dt;
    if (amb.clankT <= 0) {
      amb.clankT = 7 + Math.random() * 6;
      const prog = clamp(day() / OVERPASS_OPEN_DAY, 0, 1);          // the year works
      const east = clamp((S.wolf.x - 1600) / 2400, 0, 1);           // and it is east
      playClank((0.04 + prog * 0.1) * (0.3 + east * 0.7));
    }
  }
}

function playChirp() {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  const base = 2400 + Math.random() * 600;
  for (let i = 0; i < 3; i++) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(base * (1 + i * 0.06), now + i * 0.09);
    o.frequency.exponentialRampToValueAtTime(base * 0.8, now + i * 0.09 + 0.07);
    g.gain.setValueAtTime(0.001, now + i * 0.09);
    g.gain.linearRampToValueAtTime(0.035, now + i * 0.09 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.08);
    o.connect(g); g.connect(masterGain);
    o.start(now + i * 0.09); o.stop(now + i * 0.09 + 0.1);
  }
}

// ── the sparse score: short motifs at the beats that earn them ──────────────
const MOTIFS = {
  inherit: { notes: [392, 440, 523.25, 440, 392], step: 0.9, vol: 0.05 },
  pups:    { notes: [523.25, 587.33, 659.25], step: 0.55, vol: 0.045 },
  arrived: { notes: [329.63, 392, 440, 523.25, 587.33], step: 0.8, vol: 0.055 },
};

function playMotif(name) {
  const ac = getAudioCtx(); if (!ac) return;
  const mo = MOTIFS[name]; if (!mo) return;
  const now = ac.currentTime;
  mo.notes.forEach((f, i) => {
    for (const mult of [1, 1.5]) {           // each note carries a quiet fifth
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.value = f * mult;
      const at = now + i * mo.step, v = mo.vol * (mult === 1 ? 1 : 0.35);
      g.gain.setValueAtTime(0.001, at);
      g.gain.linearRampToValueAtTime(v, at + 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, at + mo.step * 1.8);
      o.connect(g); g.connect(masterGain);
      o.start(at); o.stop(at + mo.step * 2);
    }
  });
}

// A distant machine: a dull thump, sometimes with the back-up beep behind it.
function playClank(vol) {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(74, now);
  o.frequency.exponentialRampToValueAtTime(38, now + 0.22);
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  o.connect(g); g.connect(masterGain);
  o.start(now); o.stop(now + 0.35);
  if (Math.random() < 0.3) {
    for (let i = 0; i < 2; i++) {
      const o2 = ac.createOscillator(), g2 = ac.createGain();
      o2.type = 'square'; o2.frequency.value = 880;
      g2.gain.setValueAtTime(0.001, now + 0.5 + i * 0.5);
      g2.gain.linearRampToValueAtTime(vol * 0.25, now + 0.52 + i * 0.5);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.72 + i * 0.5);
      o2.connect(g2); g2.connect(masterGain);
      o2.start(now + 0.5 + i * 0.5); o2.stop(now + 0.75 + i * 0.5);
    }
  }
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
    o.connect(g); g.connect(masterGain);
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
    o.connect(g); g.connect(masterGain);
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
  o.connect(g); g.connect(masterGain);
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
  o1.connect(g1); g1.connect(masterGain);
  o1.start(now); o1.stop(now + 0.55);
  const o2 = ac.createOscillator(), g2 = ac.createGain();
  o2.type = 'square';
  o2.frequency.setValueAtTime(640, now);
  o2.frequency.exponentialRampToValueAtTime(180, now + 0.12);
  g2.gain.setValueAtTime(0.18, now);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  o2.connect(g2); g2.connect(masterGain);
  o2.start(now); o2.stop(now + 0.2);
}

// The ONE sound for things that happen to HER — every wound, every poison,
// every set of teeth plays this and only this. The tear keeps its own sting.
function playHurt() {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(150, now);
  o.frequency.exponentialRampToValueAtTime(48, now + 0.22);
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  o.connect(g); g.connect(masterGain);
  o.start(now); o.stop(now + 0.45);
}

// Dogs: three quick hard yips.
function playBark() {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(520, now + i * 0.14);
    o.frequency.exponentialRampToValueAtTime(360, now + i * 0.14 + 0.08);
    g.gain.setValueAtTime(0.001, now + i * 0.14);
    g.gain.linearRampToValueAtTime(0.16, now + i * 0.14 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.11);
    o.connect(g); g.connect(masterGain);
    o.start(now + i * 0.14); o.stop(now + i * 0.14 + 0.13);
  }
}

// The rifle: a crack and its body.
function playShot() {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  const o1 = ac.createOscillator(), g1 = ac.createGain();
  o1.type = 'square';
  o1.frequency.setValueAtTime(1900, now);
  o1.frequency.exponentialRampToValueAtTime(180, now + 0.06);
  g1.gain.setValueAtTime(0.34, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  o1.connect(g1); g1.connect(masterGain);
  o1.start(now); o1.stop(now + 0.14);
  const o2 = ac.createOscillator(), g2 = ac.createGain();
  o2.type = 'sawtooth';
  o2.frequency.setValueAtTime(90, now + 0.02);
  o2.frequency.exponentialRampToValueAtTime(36, now + 0.3);
  g2.gain.setValueAtTime(0.22, now + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  o2.connect(g2); g2.connect(masterGain);
  o2.start(now + 0.02); o2.stop(now + 0.5);
}

// Rivals: a low held growl.
function playGrowl() {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sawtooth'; o.frequency.value = 58;
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.16, now + 0.1);
  g.gain.setValueAtTime(0.16, now + 0.5);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
  o.connect(g); g.connect(masterGain);
  o.start(now); o.stop(now + 0.95);
}

// The pack's voice at each season's turning: two staggered gliding howls.
function playHowl() {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  for (const at of [0, 0.6]) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(392, now + at);
    o.frequency.linearRampToValueAtTime(587, now + at + 0.5);
    o.frequency.linearRampToValueAtTime(494, now + at + 1.8);
    g.gain.setValueAtTime(0.001, now + at);
    g.gain.linearRampToValueAtTime(0.1, now + at + 0.3);
    g.gain.setValueAtTime(0.1, now + at + 1.2);
    g.gain.exponentialRampToValueAtTime(0.001, now + at + 2.2);
    o.connect(g); g.connect(masterGain);
    o.start(now + at); o.stop(now + at + 2.3);
  }
}

// Play-fight: one soft happy yip.
function playYip() {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(680, now);
  o.frequency.exponentialRampToValueAtTime(920, now + 0.09);
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.14, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  o.connect(g); g.connect(masterGain);
  o.start(now); o.stop(now + 0.18);
}

// The fire: a long low rumble from the east.
function playRumble() {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sawtooth'; o.frequency.value = 38;
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.18, now + 0.6);
  g.gain.setValueAtTime(0.18, now + 2.2);
  g.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
  o.connect(g); g.connect(masterGain);
  o.start(now); o.stop(now + 3.6);
}

// A single soft note when a small task resolves.
function playTaskChime() {
  const ac = getAudioCtx(); if (!ac) return;
  const now = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'triangle'; o.frequency.value = 659.26;  // E5
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.12, now + 0.03);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  o.connect(g); g.connect(masterGain);
  o.start(now); o.stop(now + 0.55);
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
    o.connect(g); g.connect(masterGain);
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
      injuredT: S.injuredT,
      edges: S.edges.map(e => ({
        id: e.id, state: e.state, torn: e.torn, passCount: e.passCount,
        lastUsedDay: e.lastUsedDay, inkLo: e.inkLo, inkHi: e.inkHi,
        covBits: e.covBits,
      })),
      visited: [...S.visited], bridged: [...S.bridged], foundPaths: S.foundPaths,
      seen: S.seen ? Array.from(S.seen) : null,
      firstTear: S.firstTear,
      pack: S.pack.map(w => ({
        id: w.id, name: w.name, mult: w.mult, yearling: w.yearling,
        pup: !!w.pup, x: w.x, y: w.y, state: w.state,
        injuredT: w.injuredT || 0, lost: !!w.lost,
      })),
      fear: S.fear, food: S.food,
      water: S.water, sickT: S.sickT || 0,
      snares: S.snares, roadkill: S.roadkill,
      rumorsSeen: S.rumorsSeen, foundWater: S.foundWater,
      exposure: S.exposure, westLaneT: S.westLaneT,
      yearlingKnows: [...S.yearlingKnows],
      denId: S.denId, denSite: S.denSite, seenDens: S.seenDens,
      pups: S.pups,
      weather: S.weather, wind: S.wind,
      overpassCross: S.overpassCross || 0,
      herdAnchors: HERDS.map(H => ({ x: H.anchor.x, y: H.anchor.y })),
      sedgeMark: S.sedgeMark,
      conflict: S.conflict, gift: S.gift, alarm: S.alarm,
      lichenJoined: S.lichenJoined, fire: S.fire, standoffCd: S.standoffCd,
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
  materializeDen(d.denId);   // rebuild the dug den before its edges restore
  S.wolf.x = d.wolf.x; S.wolf.y = d.wolf.y;
  S.injuredT = d.injuredT || 0;   // pre-fix saves carried injuredUntilDay; read as healed
  S.trail = [{ x: S.wolf.x, y: S.wolf.y }];
  S.cam.x = S.wolf.x; S.cam.y = S.wolf.y;
  for (const se of d.edges) {
    const e = S.edges.find(x => x.id === se.id);
    if (e) Object.assign(e, se);
  }
  S.visited = new Set(d.visited); S.bridged = new Set(d.bridged);
  S.foundPaths = d.foundPaths || {};
  if (d.seen && d.seen.length === GRID_W * GRID_H) S.seen = Uint8Array.from(d.seen);
  S.firstTear = d.firstTear;
  for (const sw of d.pack) {
    const w = S.pack.find(x => x.id === sw.id);
    if (w) {
      w.x = sw.x; w.y = sw.y; w.state = sw.state === 'balk' ? 'follow' : sw.state;
      w.injuredT = sw.injuredT || 0;
      w.lost = !!sw.lost;
    } else {
      // pups, Lichen — anyone who joined along the way
      S.pack.push({ ...sw, state: sw.state === 'balk' ? 'follow' : sw.state, gait: 0, moving: false });
    }
  }
  S.fear = d.fear; S.food = d.food;
  S.water = typeof d.water === 'number' ? d.water : 90;
  S.sickT = d.sickT || 0;
  S.snares = d.snares || [];
  S.roadkill = d.roadkill || null;
  S.rumorsSeen = d.rumorsSeen || [];
  S.foundWater = d.foundWater || [];
  S.exposure = d.exposure || 0;
  S.westLaneT = d.westLaneT || 0;
  S.westState = 'none'; S.westRivals = [];
  S.yearlingKnows = new Set(d.yearlingKnows);
  S.denId = d.denId; S.denSite = d.denSite; S.seenDens = d.seenDens || [];
  S.pups = d.pups;
  S.weather = d.weather || null;
  S.wind = d.wind || { a: Math.random() * Math.PI * 2 };
  S.overpassCross = d.overpassCross || 0;
  if (d.herdAnchors) d.herdAnchors.forEach((a, i) => {
    if (HERDS[i]) { HERDS[i].anchor.x = a.x; HERDS[i].anchor.y = a.y; }
  });
  S.sedgeMark = d.sedgeMark || null;
  S.conflict = d.conflict || 0;
  S.gift = d.gift || { given: false, taken: false };
  S.alarm = d.alarm || 0;
  S.lichenJoined = !!d.lichenJoined;
  S.fire = d.fire || { state: 'none', t: 0 };
  S.standoffCd = d.standoffCd || 0;
  S.lastSeason = seasonIndex();
  Object.assign(S.hud, d.hud || {});
  Object.assign(S.tut, d.tut || {});
  S.callouts = d.callouts || [];
  S.elkRespawn = d.elkRespawn || [];
  S.history = d.history;
  S.time = d.time || 0;
  for (const g of TEAR_GROUPS) {
    if (g.footprint && !g.ripPath && groupTorn(g)) {
      g.ripPath = footprintOutline(g.footprint);
      g.autoRip = true;
    }
  }
  recomputeGhosts();
  S.mode = 'play';
  return true;
}

function clearSave() {
  if (storageOk()) try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
}

// peek only: is there a year worth returning to? (never loads anything)
function hasResumableSave() {
  if (!storageOk()) return false;
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    return !!d && d.v === 2;
  } catch (_) { return false; }
}

// ── the frame update ─────────────────────────────────────────────────────────

function update(dt) {
  if (!S) return;
  if (S.mode === 'intro') return;
  if (S.mode === 'ending') { S.endT += dt; return; }

  S.time += dt;
  promptTick(dt);
  ambienceUpdate(dt);
  weatherUpdate(dt);
  S.forcedSenseT = Math.max(0, S.forcedSenseT - dt);
  S.flickerT = Math.max(0, S.flickerT - dt);
  S.msgT = Math.max(0, S.msgT - dt);
  // a wound heals in real time, task freeze or no — the calendar has no say
  S.injuredT = Math.max(0, S.injuredT - dt);
  S.passageFade = Math.max(0, (S.passageFade || 0) - dt);
  S.shake = Math.max(0, S.shake - 30 * dt);
  S.inputLockT = Math.max(0, S.inputLockT - dt);
  S.confirmNewYearT = Math.max(0, S.confirmNewYearT - dt);

  const sensing = S.mapOpen || S.forcedSenseT > 0;
  S.senseBlend = clamp(S.senseBlend + (sensing ? dt / SENSE_IN : -dt / SENSE_OUT), 0, 1);

  // her senses register the ground around her onto the map's memory
  if (S.mode === 'play' || S.mode === 'prologue') markSeen(S.wolf.x, S.wolf.y, SIGHT_WORLD);

  if (S.mode === 'prologue') {
    prologueUpdate(dt);
  } else {
    // the world keeps changing whether or not you watch it: the calendar
    // never waits — not for tasks, not for anything
    S.clock.min += dt * MIN_PER_SEC;
    if (day() !== S.lastDay) { S.lastDay = day(); applyDecay(); herdDriftUpdate(); }

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
    S.roadGraceT = onR ? 8 : Math.max(0, S.roadGraceT - dt);

    traversalUpdate();
    tearCheck();
    freeformBridgeCheck();
    packUpdate(dt);
    trafficUpdate(dt);
    preyUpdate(dt);
    hungerUpdate(dt);
    denUpdate(dt);
    pupUpdate(dt);
    waterUpdate(dt);
    snareUpdate(dt);
    roadkillUpdate(dt);
    trainUpdate(dt);
    rumorUpdate();
    S.vantageT = Math.max(0, (S.vantageT || 0) - dt);

    // B4: the home range dies. In winter, when she paces the emptied ground
    // near the den with nothing answering the hunt, the land itself tells her
    // the living world has gone west — once.
    if (!S.tut.westCall && seasonIndex() === 3 && S.food < 50
        && dist(S.wolf.x, S.wolf.y, DEN.x, DEN.y) < 1300) {
      const preyNear = S.elk.some(e => !HERDS[e.herd].cattle
        && dist(S.wolf.x, S.wolf.y, e.x, e.y) < 1100);
      if (!preyNear) {
        S.tut.westCall = true;
        say('Nothing answers the hunt here. The living land has moved west.');
      }
    }
    rancherUpdate(dt);
    silenceUpdate(dt);
    standoffUpdate(dt);
    westPackUpdate(dt);
    lichenUpdate();
    fireUpdate(dt);
    tutorialUpdate(dt);
    calloutUpdate(dt);
    endingCheck();

    if (!S.tut.bramRecall && bramRemembers()) {
      S.tut.bramRecall = true;
      say('Bram remembers the far side. From before.');
    }

    // the verb of leadership arrives a little into spring, when the pack
    // has settled at her heels — hers now, not her mother's
    if (!S.tut.fTaught && S.tut.step >= 6) {
      S.tut.fTeachT = (S.tut.fTeachT || 0) + dt;
      if (S.tut.fTeachT > 14) {
        S.tut.fTaught = true;
        showPrompt('The pack is hers to lead now. F — they hold this ground, or follow.', ['F'], 8);
      }
    }

    // the overpass arc: it opens, she scouts it, her pack learns it by
    // conducted crossings, and only then does the land follow
    if (overpassOpen()) {
      if (!S.tut.overpassOpen) {
        S.tut.overpassOpen = true;
        say('The machines finished something in the north: earth banked over the asphalt.');
      }
      if (!S.tut.overpassWalked && onDeck(S.wolf.x, S.wolf.y)) {
        S.tut.overpassWalked = true;
        say('Earth over the roar — but it reeks of people. The pack will not follow her onto it. Not yet.');
      }
      if (!S.tut.overpassAdopted && overpassTrusted() && S.elk.some(e => onDeck(e.x, e.y))) {
        S.tut.overpassAdopted = true;
        say('A deer crosses above the traffic. The land is learning the bridge.');
      }
    }

    // the pack sings each season across — and the map is made to answer:
    // for ten seconds her mother's whole original map ghosts in over the
    // scarred truth of now, then fades. Three times a year, the player
    // watches the map die by comparison.
    const si = seasonIndex();
    if (si !== S.lastSeason) {
      S.lastSeason = si;
      playHowl();
      S.pendingSeasonRitual = true;   // fires at the next safe (off-road) frame
    }
    // the ritual: raise the map and ghost in Willow's whole confident map
    // over Aspen's sparse, torn, hard-won one — but never mid-crossing
    if (S.pendingSeasonRitual && !onRoad(S.wolf.x, S.wolf.y) && S.forcedSenseT <= 0) {
      S.pendingSeasonRitual = false;
      S.forcedSenseT = SEASON_RITUAL;
      S.seasonGhostT = SEASON_RITUAL;
      if (!S.tut.seasonRitual) {
        S.tut.seasonRitual = true;
        setCaption(seasonName() + '.', 4, 'What her mother knew. What is left of it.');
      } else {
        setCaption(seasonName() + '.', 3.5);   // wordless after the first
      }
    }
    S.seasonGhostT = Math.max(0, (S.seasonGhostT || 0) - dt);

    // Sedge's mark, out at the edge, read only in the cold
    if (S.sedgeMark && !S.tut.sedgeSeen && seasonIndex() === 3 && input.scent
        && dist(S.wolf.x, S.wolf.y, S.sedgeMark.x, S.sedgeMark.y) < 240) {
      S.tut.sedgeSeen = true;
      say('Sedge. Going somewhere the map does not go.');
    }

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

  // camera — the raised map pulls out to frame the entire land
  const mblend = smooth(S.senseBlend);
  // the world runs close-in (2x); the nose pulls the view back out wide
  const nearScale = input.scent && S.senseBlend < 0.2 ? SCALE_WORLD : SCALE_WORLD * 2;
  let targetScale = lerp(nearScale, mapFitScale(), mblend);
  if (S.vistaT > 0) targetScale = SCALE_VISTA;
  const targetX = lerp(S.wolf.x, ((WORLD.x0 || 0) + WORLD.w) / 2, mblend);
  const targetY = lerp(S.wolf.y, WORLD.h / 2, mblend);
  S.cam.scale += (targetScale - S.cam.scale) * Math.min(1, dt * 8);
  S.cam.x += (targetX - S.cam.x) * Math.min(1, dt * 6);
  S.cam.y += (targetY - S.cam.y) * Math.min(1, dt * 6);
}
