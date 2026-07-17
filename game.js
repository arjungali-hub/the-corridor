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
const COV_BUCKETS   = 8;     // a pass requires every stretch of the edge walked
const COV_FULL      = (1 << COV_BUCKETS) - 1;
const NODE_VISIT_R  = 70;
const SPEED_ROUGH   = 258;   // off-route — matches Sedge's pace
const SPEED_ROUTE   = 290;   // along a known, untorn route
const SPEED_SNOW    = 210;   // off-route in winter
const INJURY_SPEED  = 0.7;   // while hurt
const INJURY_DAYS   = 15;    // ≈ 75 real seconds — same real recovery as before the 6× clock
const MIN_PER_SEC   = 288;   // game minutes per real second (1 day ≈ 5 s; a year ≈ 30 min)
const SOLID_AT      = 3;     // full traversals to lift dotted → solid
// Ink decay alone rides the fast calendar at 2× its old real-time pace:
// solid fades after ~225 real s idle, dotted vanishes ~375 real s later.
const DECAY_SOLID_DAYS  = 45;
const DECAY_DOTTED_DAYS = 75;
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
    roadGraceT: 0,       // while > 0, driven prey may follow her across
    packFrozen: false,   // terror: the pack roots itself until fear fades

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
    task: null, taskCooldown: 30,                // small demands; time holds for them
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
    fire: { state: 'none', t: 0 },
    lastSeason: 0, bondT: 0, bondC: null,

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
  deriveTriggers();
  recomputeGhosts();
}

// Tears mirror the obstacles that cause them: any group naming a footprint
// gets its trigger computed from the obstacle itself, not a hand-set circle.
function deriveTriggers() {
  for (const g of TEAR_GROUPS) {
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
    grazeT: Math.random() * 6,
    tx: 0, ty: 0,
  };
  pickGrazeTarget(elk);
  S.elk.push(elk);
}

function pickGrazeTarget(elk) {
  const H = HERDS[elk.herd];
  for (let tries = 0; tries < 10; tries++) {
    const a = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * Math.max(60, H.leash - 80);
    const tx = H.anchor.x + Math.cos(a) * r, ty = H.anchor.y + Math.sin(a) * r;
    if (blockedAt(tx, ty, 14, false, APRON)) continue;  // never aim into a wall
    elk.tx = tx; elk.ty = ty;
    break;
  }
  elk.grazeT = 3 + Math.random() * 9;
}

function day() { return Math.floor(S.clock.min / 1440) + 1; }
function seasonIndex() { return clamp(Math.floor((day() - 1) / 90), 0, 3); }
function seasonName() { return SEASONS[seasonIndex()]; }
function isInjured() { return day() < S.injuredUntilDay; }

function say(text) { S.msg = text; S.msgT = 7; }
function setCaption(text, dur, sub) { S.caption = { text, sub: sub || '', t: 0, dur: dur || 4 }; }

// ── movement & collision ─────────────────────────────────────────────────────

// The bridge at Water-Under-Stone crosses OVER the road: its deck (the gap
// band) never connects to the asphalt at grade. Thin walls seal the deck's
// north and south edges wherever they meet the road, so road→bridge and
// bridge→road are both impossible mid-span.
function bridgeWallAt(x, y, r) {
  if (S.era === 'past') return false;
  const h = OBSTACLES.highway;
  if (x <= h.x0 - 8 - r || x >= h.x1 + 8 + r) return false;
  return Math.abs(y - h.gapY0) < 8 + r || Math.abs(y - h.gapY1) < 8 + r;
}

function blockedAt(x, y, r, canPassGap, margin) {
  const m = margin || 0;
  if (x < r - m || y < r - m || x > WORLD.w - r + m || y > WORLD.h - r + m) return true;
  const h = OBSTACLES.highway;
  if (x > h.x0 - r && x < h.x1 + r) {
    const inGap = canPassGap && y > h.gapY0 + r && y < h.gapY1 - r;
    // prey never sets foot on the road — unless Aspen is on it, or was
    // moments ago, and the chase spills across behind her
    const driven = S.roadGraceT > 0;
    if (!inGap && !driven) return true;
  }
  if (bridgeWallAt(x, y, r)) return true;
  if (S.era === 'past') return false;  // none of it has been built yet
  for (const key of ['construction', 'subdivision', 'gravelPit']) {
    const c = OBSTACLES[key];
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
  if (x < WOLF_R - m || y < WOLF_R - m || x > WORLD.w - WOLF_R + m || y > WORLD.h - WOLF_R + m) return true;
  if (bridgeWallAt(x, y, WOLF_R)) return true;
  // in the prologue the road cannot be stepped onto until Willow shows how
  if (S.mode === 'prologue' && !S.tut._b5go) {
    const h = OBSTACLES.highway;
    if (x > h.x0 - 8 - WOLF_R && x < h.x1 + 8 + WOLF_R) return true;
  }
  if (S.era === 'past') return false;
  for (const key of ['construction', 'subdivision', 'gravelPit']) {
    const c = OBSTACLES[key];
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
    if (d >= corridorFor(e)) continue;
    // Honest-but-generous knowledge: walking MOST of the edge (6 of 8
    // stretches, in however many visits) counts as a full pass.
    e.covBits |= 1 << Math.min(COV_BUCKETS - 1, Math.floor(t * COV_BUCKETS));
    if (e.state === 'unknown') { e.inkLo = Math.min(e.inkLo, t); e.inkHi = Math.max(e.inkHi, t); }
    let covered = 0;
    for (let bit = 0; bit < COV_BUCKETS; bit++) if (e.covBits & (1 << bit)) covered++;
    if (covered >= 6) {
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

// The map's visible radius: a little over half the land's width, always.
function senseRadius() {
  return WORLD.w * 0.53;
}

// The raised map frames the whole territory, whatever the screen size.
function mapFitScale() {
  if (typeof canvas === 'undefined' || !canvas.width) return SCALE_MAP;
  return Math.min(canvas.width / (WORLD.w + 500), canvas.height / (WORLD.h + 500));
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

function zoneCenter() {
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
      const o = OBSTACLES[key];
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

  // terror roots the whole pack: past the threshold they freeze where they
  // stand — for a day and more — until the fear has genuinely faded
  if (!S.packFrozen && S.fear > 0.85) {
    S.packFrozen = true;
    if (S.mode === 'play') say('The pack freezes. Nothing will move them until the terror fades.');
  }
  if (S.packFrozen && S.fear < 0.6) S.packFrozen = false;
  if (S.packFrozen) {
    for (const w of S.pack) w.moving = false;
    return;
  }

  const c = zoneCenter();
  const zr = zoneRadius(c);
  const huntLimit = Math.max(320, zr * 2);   // how far a hunt may pull them

  for (const w of S.pack) {
    if (w.state === 'dead' || w.state === 'gone') { w.moving = false; continue; }

    // fear is not a toggle: `balked` persists until fear truly fades
    if (w.balked && S.fear < 0.35) { w.balked = false; if (w.state === 'balk') w.state = 'follow'; }
    if (w.balked) { w.state = 'balk'; w.moving = false; continue; }

    const dZone = dist(w.x, w.y, c.x, c.y);

    // adults hunt on their own: chase near prey, break off beyond the
    // hunting radius, never set foot on the asphalt. Hysteresis keeps the
    // edge honest: a chase starts well inside the radius and is only
    // abandoned well outside it — no flickering at the line.
    if (!w.pup && S.mode === 'play') {
      let prey = null, pd = 1e9;
      for (const e of S.elk) {
        const d = dist(w.x, w.y, e.x, e.y);
        if (d < 280 && d < pd) { pd = d; prey = e; }
      }
      const mayHunt = w.hunting ? dZone < huntLimit * 1.3 : dZone < huntLimit * 0.8;
      if (prey && mayHunt) {
        w.hunting = true;
        const d = pd || 1;
        const sp = 250 * w.mult;
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
    if (dZone > zr) {
      if (w.slotA === undefined) w.slotA = Math.random() * Math.PI * 2;
      w.tx = c.x + Math.cos(w.slotA) * zr * 0.5;
      w.ty = c.y + Math.sin(w.slotA) * zr * 0.5;
      w.wanderT = 0.5;
    } else {
      w.wanderT = (w.wanderT || 0) - dt;
      if (w.wanderT <= 0 || w.tx === undefined || dist(w.x, w.y, w.tx, w.ty) < 14) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * zr;
        w.tx = c.x + Math.cos(a) * r;
        w.ty = c.y + Math.sin(a) * r;
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
      w.moving = false;
      continue;
    }
    // speed eases between amble and lope; heading turns, never snaps
    const urgency = clamp((dZone - zr * 0.7) / (zr * 0.6), 0, 1);
    let sp = lerp(120, 240, urgency) * w.mult;
    if (dZone > 700) sp *= 1.8;
    const step = Math.min(d, sp * dt);
    tryMove(w, (w.tx - w.x) / d * step, (w.ty - w.y) / d * step, packBlockedAt);
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
// In beat 9, the held key at her mother's side is the inherit gesture —
// there, and only there, the press is not the map.
function mapAllowed() {
  if (S.tut.sawMap) return true;
  if (S.mode === 'prologue') return S.beat === 3 && !!S.tut._b3go;
  return S.tut.step >= 4;
}

function toggleMap() {
  if (!S || (S.mode !== 'play' && S.mode !== 'prologue')) return;
  if (S.forcedSenseT > 0) return;  // a forced lesson can't be latched open
  if (!mapAllowed()) return;   // no map before the map is given
  if (S.mode === 'prologue' && S.beat === 9 && !S.inherited
      && S.willow && dist(S.wolf.x, S.wolf.y, S.willow.x, S.willow.y) < 70) return;
  S.mapOpen = !S.mapOpen;
}

function togglePackStay() {
  // in the prologue, F is the bond gesture in beat 6, and from beat 7 —
  // once taught — the real verb, tested under Willow's eye
  if (S.mode === 'prologue') {
    if (S.beat === 6) { S.tut._bond = true; return; }
    if (!(S.beat >= 7 && S.tut.fTaught)) return;
    S.tut._fTested = true;
  }
  if (!S.tut.fTaught) return;   // no verb before it is given
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

    // wedged inside something (spawned badly, or built around it): work free
    if (blockedAt(elk.x, elk.y, 2, false, APRON)) {
      const d = dist(elk.x, elk.y, H.anchor.x, H.anchor.y) || 1;
      elk.x += (H.anchor.x - elk.x) / d * 260 * dt;
      elk.y += (H.anchor.y - elk.y) / d * 260 * dt;
      continue;
    }
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
      if (!burning) elk.stamina = Math.max(0, elk.stamina - 12 * dt);
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
        * (0.92 + 0.16 * elk.skittish) * (elk.frail || 1);
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
    if (elk.x < 0 || elk.y < 0 || elk.x > WORLD.w || elk.y > WORLD.h) {
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
    const gone = elk.x < -APRON + 40 || elk.y < -APRON + 40
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
      if (H.count > 0) S.elkRespawn.push({ day: day() + H.respawnDays, herd: elk.herd });
      const sedge = S.pack.find(w => w.id === 'sedge');
      const sedgeIn = sedge && sedge.state !== 'dead' && sedge.state !== 'gone'
        && dist(sedge.x, sedge.y, elk.x, elk.y) < 500;
      S.food = Math.min(100, S.food + H.food + (sedgeIn ? 10 : 0));
      S.tut.usedHold = true;
      S.history.push({ type: 'hunt', day: day() });
      if (H.cattle) {
        S.conflict = Math.min(1, S.conflict + 0.3);
        say('A calf. Easy meat. The house will know.');
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
  S.food = Math.max(0, S.food - FOOD_PER_SEC * dt);
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

function chooseDen(site) {
  S.denId = site.id;
  S.denSite = { x: site.x, y: site.y };
  if (!S.seenDens.includes(site.id)) S.seenDens.push(site.id);
  S.history.push({ type: 'den', day: day(), site: site.id });
  say(`${site.name} is home now.`);
  // home chosen: the last two verbs are given, one at a time
  showPrompt('R twice restarts the game (if you ever want to).', ['R'], 5);
  showPrompt('What she knows how to do: H.', ['H'], 5);
  S.tut.taughtHelp = true;
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
        playBark();
        if (target.aspen) {
          S.food = Math.max(0, S.food - 15);
          S.fear = Math.min(1, S.fear + 0.35);
          S.injuredUntilDay = day() + INJURY_DAYS;
          say('Teeth find her. Meat lost, blood drawn — the dogs know their work.');
        } else {
          S.food = Math.max(0, S.food - 10);
          S.fear = Math.min(1, S.fear + 0.3);
          say(`The dogs run ${target.ref.name} off the meat. The pack pays for this ground.`);
        }
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
      S.injuredUntilDay = day() + INJURY_DAYS;
      say('CRACK. Fire along her flank. Run.');
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
    S.injuredUntilDay = day() + INJURY_DAYS;
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
    playGrowl();
    say('Teeth. A shove. A lesson about lines.');
  }
}

// ── Lichen ───────────────────────────────────────────────────────────────────
// An outsider from a different fragmented territory, come south. She brings
// the only knowledge of ground beyond Willow's range — and an unsettled pack.

function lichenUpdate() {
  if (S.lichenJoined || day() < 100) return;
  S.lichenJoined = true;
  S.pack.push({
    id: 'lichen', name: 'Lichen', mult: 1.05, yearling: false,
    x: S.wolf.x, y: S.wolf.y - 300, state: 'follow', gait: 0, moving: false,
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

// ── the fire ─────────────────────────────────────────────────────────────────
// Dry lightning in the east, one summer day. Everything that runs, runs west
// together — predator and prey in truce-by-panic. Afterward the eastern
// woods stand charred for the rest of the year.

function fireUpdate(dt) {
  const f = S.fire;
  if (f.state === 'none' && seasonIndex() === 1 && day() >= 130) {
    f.state = 'burning';
    f.t = 0;
    setCaption('Dry lightning, east.', 4, 'the world runs west together');
    playRumble();
    S.fear = Math.min(1, S.fear + 0.3);
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

// ── tasks: the small demands of a day ────────────────────────────────────────
// Roughly half of play carries a task. While one is open, the calendar holds
// still — the day is spent on the thing itself. When none is open, days flow.

const TASK_TIMEOUT = 120;

function taskDone(t) {
  switch (t.kind) {
    case 'patch': return S.bridged.has(t.key);
    case 'pups': return !S.pups || S.pups.count <= 0 || S.pups.traveling || S.pups.food > 70;
    case 'hunt': return S.food > 60;
    case 'den-look': return S.seenDens.includes(t.key) || S.denId !== null;
    case 'scout': {
      const e = S.edges.find(x => x.id === t.key);
      return e.passCount > 0 || S.visited.has(t.far);
    }
    case 'renew': {
      const e = S.edges.find(x => x.id === t.key);
      return e.torn || e.lastUsedDay >= t.sinceDay || e.state === 'current-solid';
    }
  }
  return true;
}

function issueTask() {
  if (S.tut.step < 7) { S.taskCooldown = 10; return; }
  const mk = (kind, text, extra) => { S.task = { kind, text, t: 0, ...(extra || {}) }; };

  const torn = TEAR_GROUPS.find(g => g.key !== 'mudspring' && groupTorn(g) && !S.bridged.has(g.key));
  if (torn) {
    const TEAR_NAMES = {
      blackriver: 'the Black River', machines: 'the machines',
      drycreek: 'the drowned Bend', gravelpit: 'the pit',
    };
    mk('patch', `find a way around ${TEAR_NAMES[torn.key] || 'the tear'}`, { key: torn.key });
    return;
  }
  if (S.pups && !S.pups.traveling && S.pups.count > 0 && S.pups.food < 40) {
    mk('pups', 'the pups are hungry — carry food home', {}); return;
  }
  if (S.food < 45) { mk('hunt', 'the pack is hungry — bring something down', {}); return; }
  if (!S.denId) {
    const unseen = DEN_SITES.find(s => !S.seenDens.includes(s.id));
    if (unseen) { mk('den-look', `go and look at ${unseen.name}`, { key: unseen.id }); return; }
  }
  // walk new ground: an unknown edge leading out of somewhere she has stood
  const scouts = S.edges.filter(e => !e.torn && e.state === 'unknown'
    && (S.visited.has(e.a) || S.visited.has(e.b)));
  if (scouts.length) {
    const e = scouts[Math.floor(Math.random() * scouts.length)];
    const far = S.visited.has(e.a) ? e.b : e.a;
    mk('scout', `walk new ground, toward ${NbyId.get(far).name}`, { key: e.id, far });
    return;
  }
  // renew fading ink
  const fading = S.edges.filter(e => !e.torn && e.state === 'current-dotted' && e.passCount > 0);
  if (fading.length) {
    const e = fading[Math.floor(Math.random() * fading.length)];
    mk('renew', `renew a fading way: ${NbyId.get(e.a).name} to ${NbyId.get(e.b).name}`,
      { key: e.id, sinceDay: day() });
    return;
  }
  S.taskCooldown = 15;
}

function taskUpdate(dt) {
  if (S.task) {
    S.task.t += dt;
    if (taskDone(S.task)) {
      S.task = null;
      S.taskCooldown = 18 + Math.random() * 22;
      playTaskChime();
      say('Done. The day moves on.');
    } else if (S.task.t > TASK_TIMEOUT) {
      S.task = null;
      S.taskCooldown = 24 + Math.random() * 20;
      say('The moment passes.');
    }
  } else {
    S.taskCooldown -= dt;
    if (S.taskCooldown <= 0) issueTask();
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
  // the spur near the den is already gone when the game opens (beat 9's find)
  for (const e of S.edges) {
    const d = EDGES.find(x => x.id === e.id);
    if (e.state === 'unknown' && d.state === 'inherited') e.state = 'inherited';
    if (e.tearGroup === 'mudspring') e.torn = true;
  }
  recomputeGhosts();
  // the prologue already taught move / scent / map / hunt / F
  S.tut.step = 6; S.tut.t = 0;
  S.tut.sawMap = true; S.tut.scentHold = 1; S.tut.usedHold = true; S.tut.fTaught = true;
  S.hud.pack = true;
  S.clock.min = 8 * 60; S.lastDay = 1;
  S.wolf.x = DEN.x; S.wolf.y = DEN.y;
  S.trail = [{ x: DEN.x, y: DEN.y }];
  S.cam.x = DEN.x; S.cam.y = DEN.y;
  let i = 0;
  for (const w of S.pack) { i++; w.x = DEN.x - 30 * i; w.y = DEN.y + (i % 2 ? 20 : -20); w.state = 'follow'; }
  S.cars.length = 0;
  S.willow = null;
  S.mapOpen = false;
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
      if (T.scentHold > 2.5) {   // long enough to actually read the gold
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
        stickyPrompt('Watch her map become yours. Press SPACE.', ['SPACE']);
      }
      if (S.senseBlend > 0.8 && !T.sawMap) {
        T.sawMap = true;
        clearPrompt();
        queueCallout('willow-ink');
        showPrompt('SPACE again lowers the map. Follow her.', [], 6);
      }
      // the lesson isn't over until the map is down and stays down
      if (T.sawMap) {
        T._mapClosedT = S.senseBlend < 0.15 ? (T._mapClosedT || 0) + dt : 0;
      }
      if (w && !w.path.length && dist(w.x, w.y, NbyId.get('oldFord').x, NbyId.get('oldFord').y) < 60
          && dist(S.wolf.x, S.wolf.y, w.x, w.y) < 260 && T.sawMap && (T._mapClosedT || 0) > 3) {
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
        S.tut.fTaught = true;   // only now does the verb exist
        // Willow waits while the new verb is tried
        stickyPrompt('F — the pack holds its ground, or follows. Try it.', ['F']);
      }
      break;

    // Beat 7 — F is tested under her eye; then she walks the last miles
    case 7:
      if (!T._fTested && S.beatT > 20) T._fTested = true;   // never a softlock
      if (T._fTested && !T._b7go) {
        T._b7go = true;
        clearPrompt();
        showPrompt('Follow. The winter range is close now.', [], 5);
        willowSetPath([
          nodePt('farBench', 'sageFlat-farBench'),
          nodePt('highMeadow', 'farBench-highMeadow'),
          nodePt('winterRange', 'highMeadow-winterRange'),
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
    showPrompt('Press R again to restart the game (skips the prologue).', ['R'], 2.5);
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
    o.connect(g); g.connect(ac.destination);
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
  o1.connect(g1); g1.connect(ac.destination);
  o1.start(now); o1.stop(now + 0.14);
  const o2 = ac.createOscillator(), g2 = ac.createGain();
  o2.type = 'sawtooth';
  o2.frequency.setValueAtTime(90, now + 0.02);
  o2.frequency.exponentialRampToValueAtTime(36, now + 0.3);
  g2.gain.setValueAtTime(0.22, now + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  o2.connect(g2); g2.connect(ac.destination);
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
  o.connect(g); g.connect(ac.destination);
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
    o.connect(g); g.connect(ac.destination);
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
  o.connect(g); g.connect(ac.destination);
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
  o.connect(g); g.connect(ac.destination);
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
  o.connect(g); g.connect(ac.destination);
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
      task: S.task, taskCooldown: S.taskCooldown,
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
    const w = S.pack.find(x => x.id === sw.id);
    if (w) {
      w.x = sw.x; w.y = sw.y; w.state = sw.state === 'balk' ? 'follow' : sw.state;
    } else {
      // pups, Lichen — anyone who joined along the way
      S.pack.push({ ...sw, state: sw.state === 'balk' ? 'follow' : sw.state, gait: 0, moving: false });
    }
  }
  S.fear = d.fear; S.food = d.food;
  S.yearlingKnows = new Set(d.yearlingKnows);
  S.denId = d.denId; S.denSite = d.denSite; S.seenDens = d.seenDens || [];
  S.pups = d.pups;
  S.task = d.task || null;
  S.taskCooldown = typeof d.taskCooldown === 'number' ? d.taskCooldown : 30;
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
  promptTick(dt);
  S.forcedSenseT = Math.max(0, S.forcedSenseT - dt);
  S.flickerT = Math.max(0, S.flickerT - dt);
  S.msgT = Math.max(0, S.msgT - dt);
  S.shake = Math.max(0, S.shake - 30 * dt);
  S.inputLockT = Math.max(0, S.inputLockT - dt);
  S.confirmNewYearT = Math.max(0, S.confirmNewYearT - dt);

  const sensing = S.mapOpen || S.forcedSenseT > 0;
  S.senseBlend = clamp(S.senseBlend + (sensing ? dt / SENSE_IN : -dt / SENSE_OUT), 0, 1);

  if (S.mode === 'prologue') {
    prologueUpdate(dt);
  } else {
    // an open task holds the calendar still: the day is spent on the thing
    if (!S.task) S.clock.min += dt * MIN_PER_SEC;
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
    S.roadGraceT = onR ? 8 : Math.max(0, S.roadGraceT - dt);

    traversalUpdate();
    tearCheck();
    packUpdate(dt);
    trafficUpdate(dt);
    preyUpdate(dt);
    hungerUpdate(dt);
    denUpdate(dt);
    pupUpdate(dt);
    rancherUpdate(dt);
    silenceUpdate(dt);
    standoffUpdate(dt);
    lichenUpdate();
    fireUpdate(dt);
    taskUpdate(dt);
    tutorialUpdate(dt);
    calloutUpdate(dt);
    endingCheck();

    // the pack sings each season across
    const si = seasonIndex();
    if (si !== S.lastSeason) { S.lastSeason = si; playHowl(); }

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
  let targetScale = lerp(SCALE_WORLD, mapFitScale(), mblend);
  if (S.vistaT > 0) targetScale = SCALE_VISTA;
  const targetX = lerp(S.wolf.x, WORLD.w / 2, mblend);
  const targetY = lerp(S.wolf.y, WORLD.h / 2, mblend);
  S.cam.scale += (targetScale - S.cam.scale) * Math.min(1, dt * 8);
  S.cam.x += (targetX - S.cam.x) * Math.min(1, dt * 6);
  S.cam.y += (targetY - S.cam.y) * Math.min(1, dt * 6);
}
