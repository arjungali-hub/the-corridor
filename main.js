// ── CANVAS SETUP ─────────────────────────────────────────────────────────────

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
canvas.width  = 1050;
canvas.height = 760;

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

const MARGIN     = 70;   // padding between canvas edge and outermost node (px)
const NODE_R     = 14;   // node ring radius (canvas px)
const NODE_DOT_R = 3;    // center dot radius
const DEN_R      = 20;   // filled den-node radius
const DECAY_DAYS = 15;   // idle days before an edge degrades
const SOLID_AT   = 3;    // total traversals to lift current-dotted → current-solid
const FLASH_MS   = 500;  // tear flash duration

const C_PARCHMENT = '#EDE2C9';
const C_BORDER    = '#C9B99A';
const C_NODE      = '#5B4632';
const C_INK_DARK  = '#7A3F12';
const C_INK_LIGHT = '#C7893F';
const C_TRAIL     = '#4E7A8C';
const C_PATCH     = '#E4DCC0';
const C_STITCH    = '#8A795A';

// ── GAME STATE ────────────────────────────────────────────────────────────────

// `nodes` and `edges` come from data.js (loaded before this script)

const nodesById = new Map(nodes.map(n => [n.id, n]));
const adjacency = new Map();  // "a,b" → edge, both directions

let playerNode;  // id of the node the token currently occupies
let day;         // current in-game day number

// Runtime counters per edge — kept separate from the data so data.js stays clean
const edgeRT = new Map();  // edge.id → { traverseCount, lastTraversedDay }

// Whether each node has been confirmed (visited, or on an inherited edge)
const confirmed = new Map();  // node.id → boolean

// Nodes/edges that lie beyond a tear, cut off from the den — rendered as
// faint, uncertain "ghost" memory rather than solid confirmed ink.
const ghostNodes = new Set();
const ghostEdges = new Set();

// Every traversal ever made, in order — the raw material for the ending's
// satellite-dissolve route trace. Cheap to keep now, painful to retrofit.
const travelHistory = [];  // { day, from, to, edgeId }

// Torn groups whose two surviving end-nodes have been reconnected by a path
// of Aspen's own new ink. The rip scar stays; a paper patch marks the stitch.
const bridgedGroups = new Set();  // tearGroup keys

// Recomputes ghost status from scratch: anything not reachable from the den
// through non-torn edges, but still connected to the graph via a torn-off
// inherited/current route, is a ghost of what the map used to promise.
function recomputeGhosts() {
  ghostNodes.clear();
  ghostEdges.clear();

  const denId = nodes.find(n => n.isDen)?.id ?? 0;
  const reachable = new Set([denId]);
  const queue = [denId];
  while (queue.length > 0) {
    const nid = queue.shift();
    for (const e of edges) {
      if (e.state === 'torn') continue;
      let nb = null;
      if      (e.a === nid) nb = e.b;
      else if (e.b === nid) nb = e.a;
      else continue;
      if (!reachable.has(nb)) { reachable.add(nb); queue.push(nb); }
    }
  }

  for (const e of edges) {
    if (e.state === 'torn') continue;
    const aReach = reachable.has(e.a), bReach = reachable.has(e.b);
    if (!aReach || !bReach) {
      ghostEdges.add(e.id);
      if (!aReach) ghostNodes.add(e.a);
      if (!bReach) ghostNodes.add(e.b);
    }
  }
}

// True if a path of Aspen's own new ink (current-dotted / current-solid)
// connects nodes a and b. Inherited ink never counts — a patch is new
// knowledge stitched around the tear, not the memory that just failed.
function newInkPathExists(a, b) {
  const seen  = new Set([a]);
  const queue = [a];
  while (queue.length > 0) {
    const nid = queue.shift();
    if (nid === b) return true;
    for (const e of edges) {
      if (e.state !== 'current-dotted' && e.state !== 'current-solid') continue;
      const nb = e.a === nid ? e.b : e.b === nid ? e.a : null;
      if (nb !== null && !seen.has(nb)) { seen.add(nb); queue.push(nb); }
    }
  }
  return false;
}

// Marks any torn group whose surviving end-nodes are now connected by new ink
// as bridged. Run after every arrival and after every tear (a detour walked
// before the tear counts — the knowledge already existed when the map broke).
function checkBridges() {
  for (const group of computeTornGroups().values()) {
    if (bridgedGroups.has(group.key)) continue;
    const path = reconstructPath(group);
    const a = path[0], b = path[path.length - 1];
    if (a === b) continue;
    if (newInkPathExists(a, b)) {
      bridgedGroups.add(group.key);
      playPatchChime();
    }
  }
}

function initGameState() {
  playerNode = 0;
  day        = 1;

  ghostNodes.clear();
  ghostEdges.clear();
  travelHistory.length = 0;
  bridgedGroups.clear();
  edgeRT.clear();
  for (const edge of edges) {
    edgeRT.set(edge.id, { traverseCount: 0, lastTraversedDay: null });
  }

  // Nodes that appear at either end of an inherited edge begin confirmed
  const inheritedEnds = new Set();
  for (const edge of edges) {
    if (edge.state === 'inherited') {
      inheritedEnds.add(edge.a);
      inheritedEnds.add(edge.b);
    }
  }
  confirmed.clear();
  for (const node of nodes) confirmed.set(node.id, inheritedEnds.has(node.id));
  confirmed.set(playerNode, true);  // den is always confirmed
}

function buildAdjacency() {
  adjacency.clear();
  for (const edge of edges) {
    adjacency.set(`${edge.a},${edge.b}`, edge);
    adjacency.set(`${edge.b},${edge.a}`, edge);
  }
}

function edgeBetween(a, b) {
  return adjacency.get(`${a},${b}`) ?? null;
}

// ── ANIMATION ────────────────────────────────────────────────────────────────

let animating = false;
let tokenX = 0, tokenY = 0;  // current drawn position of the player token

function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

// Runs an ordered list of animation steps: { toX, toY, ms, onDone? }
// Each step starts from wherever tokenX/Y are when the previous step finishes.
function runAnim(steps) {
  animating = true;
  function runStep(i) {
    if (i >= steps.length) { animating = false; return; }
    const { toX, toY, ms, onDone } = steps[i];
    const fromX = tokenX, fromY = tokenY;
    const t0 = performance.now();
    function tick(now) {
      const p = Math.min((now - t0) / ms, 1);
      const e = easeInOut(p);
      tokenX = fromX + (toX - fromX) * e;
      tokenY = fromY + (toY - fromY) * e;
      draw();
      if (p < 1) { requestAnimationFrame(tick); }
      else { tokenX = toX; tokenY = toY; if (onDone) onDone(); runStep(i + 1); }
    }
    requestAnimationFrame(tick);
  }
  runStep(0);
}

// ── AUDIO ─────────────────────────────────────────────────────────────────────

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// A short discordant two-tone sting for when a route tears.
function playTearSting() {
  const ac  = getAudioCtx();
  const now = ac.currentTime;

  const o1 = ac.createOscillator(), g1 = ac.createGain();
  o1.type = 'sawtooth'; o1.frequency.value = 220; // A3
  g1.gain.setValueAtTime(0.001, now);
  g1.gain.linearRampToValueAtTime(0.25, now + 0.02);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
  o1.connect(g1); g1.connect(ac.destination);
  o1.start(now); o1.stop(now + 0.9);

  const o2 = ac.createOscillator(), g2 = ac.createGain();
  o2.type = 'square'; o2.frequency.value = 311.1; // Eb4 — dissonant against A3
  g2.gain.setValueAtTime(0.0001, now);
  g2.gain.linearRampToValueAtTime(0.18, now + 0.05);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
  o2.connect(g2); g2.connect(ac.destination);
  o2.start(now + 0.03); o2.stop(now + 0.8);
}

// A soft consonant two-note chime (perfect fifth) for when a torn route is
// bridged — the gentle counterpart to the tear sting.
function playPatchChime() {
  const ac  = getAudioCtx();
  const now = ac.currentTime;

  const o1 = ac.createOscillator(), g1 = ac.createGain();
  o1.type = 'triangle'; o1.frequency.value = 392;   // G4
  g1.gain.setValueAtTime(0.001, now);
  g1.gain.linearRampToValueAtTime(0.16, now + 0.03);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
  o1.connect(g1); g1.connect(ac.destination);
  o1.start(now); o1.stop(now + 0.75);

  const o2 = ac.createOscillator(), g2 = ac.createGain();
  o2.type = 'triangle'; o2.frequency.value = 587.33; // D5
  g2.gain.setValueAtTime(0.001, now);
  g2.gain.linearRampToValueAtTime(0.13, now + 0.18);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
  o2.connect(g2); g2.connect(ac.destination);
  o2.start(now + 0.15); o2.stop(now + 0.95);
}

// ── TEAR FLASH ────────────────────────────────────────────────────────────────

let flashStart = null;

function startFlash() {
  flashStart = performance.now();
  function tick(now) {
    const t = Math.min((now - flashStart) / FLASH_MS, 1);
    draw();
    if (t < 1) requestAnimationFrame(tick);
    else flashStart = null;
  }
  requestAnimationFrame(tick);
}

function drawFlash() {
  if (flashStart === null) return;
  const t = Math.min((performance.now() - flashStart) / FLASH_MS, 1);
  ctx.fillStyle = `rgba(20,8,0,${0.28 * (1 - t)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ── MAP TRANSFORM ─────────────────────────────────────────────────────────────

let tf = { scale: 1, ox: 0, oy: 0 };

function computeTransform() {
  const xs   = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const dW   = maxX - minX || 1;
  const dH   = maxY - minY || 1;

  const scale = Math.min(
    (canvas.width  - 2 * MARGIN) / dW,
    (canvas.height - 2 * MARGIN) / dH,
  );
  tf = {
    scale,
    ox: (canvas.width  - dW * scale) / 2 - minX * scale,
    oy: (canvas.height - dH * scale) / 2 - minY * scale,
  };
}

function toCanvas(x, y) {
  return { x: x * tf.scale + tf.ox, y: y * tf.scale + tf.oy };
}

function nodePos(node) { return toCanvas(node.x, node.y); }

// ── RENDERING ─────────────────────────────────────────────────────────────────

// Deterministic PRNG (mulberry32) so speckle texture is identical on every redraw
function makePrng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Turns a string (e.g. a tearGroup id) into a stable numeric seed
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function drawParchment() {
  ctx.fillStyle = C_PARCHMENT;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const rng = makePrng(42);
  for (let i = 0; i < 1600; i++) {
    ctx.beginPath();
    ctx.arc(rng() * canvas.width, rng() * canvas.height, rng() * 1.4 + 0.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(90,55,20,${rng() * 0.055 + 0.008})`;
    ctx.fill();
  }

  const bm = 14;
  ctx.setLineDash([]);
  ctx.strokeStyle = C_BORDER;
  ctx.lineWidth   = 7;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.roundRect(bm, bm, canvas.width - 2 * bm, canvas.height - 2 * bm, 10);
  ctx.stroke();
}

function drawEdge(edge) {
  const pa = nodePos(nodesById.get(edge.a));
  const pb = nodePos(nodesById.get(edge.b));
  const rt = edgeRT.get(edge.id);

  ctx.lineCap     = 'round';
  ctx.globalAlpha = 1;

  // Ghost: faint dashed amber — the memory of a route past a tear
  if (ghostEdges.has(edge.id)) {
    ctx.setLineDash([8, 5]);
    ctx.strokeStyle = C_INK_LIGHT;
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.30;
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    return;
  }

  switch (edge.state) {

    case 'inherited':
      ctx.setLineDash([]);
      ctx.strokeStyle = C_INK_DARK; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      ctx.strokeStyle = C_INK_LIGHT; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      break;

    case 'unknown':
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(150,140,120,0.35)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      break;

    case 'current-dotted':
    case 'current-solid': {
      const decayed = rt.lastTraversedDay !== null
        && (day - rt.lastTraversedDay) >= DECAY_DAYS;
      ctx.globalAlpha = decayed ? 0.3 : 1;
      ctx.strokeStyle = C_TRAIL;
      ctx.lineWidth   = 2.5;
      ctx.setLineDash(edge.state === 'current-dotted' ? [6, 4] : []);
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
  }

  ctx.setLineDash([]);
}

// ── TORN GROUPS ───────────────────────────────────────────────────────────────
// Torn edges don't render as ink at all — instead every group of edges that
// tore together (same tearGroup id, or a lone edge if tearGroup is null) is
// rendered as ONE jagged grey rip spanning its full footprint, with amber ink
// stubs still visible entering from the two surviving end-nodes.

// Groups all currently-torn edges by tearGroup id (a bare edge id if ungrouped).
function computeTornGroups() {
  const groups = new Map();  // key → { key, edges: [], nodeIds: Set }
  for (const e of edges) {
    if (e.state !== 'torn') continue;
    const key = e.tearGroup ?? `single-${e.id}`;
    if (!groups.has(key)) groups.set(key, { key, edges: [], nodeIds: new Set() });
    const g = groups.get(key);
    g.edges.push(e);
    g.nodeIds.add(e.a);
    g.nodeIds.add(e.b);
  }
  return groups;
}

// Walks a group's edges (assumed to form a simple chain) into an ordered
// node-id path from one surviving end to the other.
function reconstructPath(group) {
  const adj = new Map();
  for (const e of group.edges) {
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a).push(e.b);
    adj.get(e.b).push(e.a);
  }
  let startId = [...adj.keys()].find(id => adj.get(id).length === 1);
  if (startId === undefined) startId = group.edges[0].a;  // fallback: closed loop

  const path = [startId];
  const seen = new Set([startId]);
  let current = startId;
  for (;;) {
    const next = (adj.get(current) || []).find(n => !seen.has(n));
    if (next === undefined) break;
    path.push(next);
    seen.add(next);
    current = next;
  }
  return path;
}

function pathTotalLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
  return len;
}

// Point (and local tangent) at a given arc-length distance along a polyline
function pointAtArcLength(pts, s) {
  let remaining = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const segLen = Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
    if (remaining <= segLen || i === pts.length - 1) {
      const t = segLen === 0 ? 0 : remaining / segLen;
      const ux = (pts[i].x - pts[i-1].x) / (segLen || 1);
      const uy = (pts[i].y - pts[i-1].y) / (segLen || 1);
      return { x: pts[i-1].x + (pts[i].x - pts[i-1].x) * t, y: pts[i-1].y + (pts[i].y - pts[i-1].y) * t, ux, uy };
    }
    remaining -= segLen;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, ux: 1, uy: 0 };
}

// Narrow jagged rip along a single straight edge (small tear, no group).
// Width is capped relative to the torn span's own length so the jagged
// sides can never overshoot each other and cross (a "bowtie").
function buildTearPolygon(pa, pb, seed) {
  const dx = pb.x - pa.x, dy = pb.y - pa.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;

  const T0 = 0.30, T1 = 0.70, N = 8;
  const tearLen = len * (T1 - T0);
  const W = Math.max(6, Math.min(22, tearLen * 0.3));
  const J = W * 0.45;
  const rng = makePrng(seed);
  function jag() { return W + (rng() * 2 - 1) * J; }

  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = T0 + (i / N) * (T1 - T0);
    const w = jag();
    pts.push([pa.x + ux * len * t + nx * w, pa.y + uy * len * t + ny * w]);
  }
  for (let i = N; i >= 0; i--) {
    const t = T0 + (i / N) * (T1 - T0);
    const w = jag();
    pts.push([pa.x + ux * len * t - nx * w, pa.y + uy * len * t - ny * w]);
  }
  return pts;
}

// One big jagged rip that follows a multi-node path, engulfing the
// stranded interior nodes. Leaves ~40px of untorn margin at each end so
// ink stubs from the surviving boundary nodes have somewhere to run into.
function buildGroupTearPolygon(pathPoints, seed) {
  const total  = pathTotalLength(pathPoints);
  const margin = Math.min(40, total * 0.3);
  const T0 = margin, T1 = total - margin;
  const N = 12;
  const tearLen = T1 - T0;
  const W = Math.max(14, Math.min(46, tearLen * 0.12));
  const J = W * 0.4;

  const rng = makePrng(seed);
  function jag() { return W + (rng() * 2 - 1) * J; }

  const posSide = [], negSide = [];
  for (let i = 0; i <= N; i++) {
    const s = T0 + (i / N) * (T1 - T0);
    const { x, y, ux, uy } = pointAtArcLength(pathPoints, s);
    const nx = -uy, ny = ux;
    const w = jag();
    posSide.push([x + nx * w, y + ny * w]);
    negSide.push([x - nx * w, y - ny * w]);
  }
  return posSide.concat(negSide.reverse());
}

function fillTornPolygon(pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle   = '#9C9C94';
  ctx.fill();
  ctx.strokeStyle = '#5a5a54';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
}

// `faint` renders the stub as ghost memory (dashed, 30% amber) instead of
// solid ink — used when the boundary node it comes from is itself unreachable.
function drawInkStub(from, to, faint) {
  ctx.setLineDash([]);
  if (faint) {
    ctx.globalAlpha = 0.30;
    ctx.strokeStyle = C_INK_LIGHT;
    ctx.lineWidth   = 2;
    ctx.setLineDash([8, 5]);
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.strokeStyle = C_INK_DARK; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.strokeStyle = C_INK_LIGHT; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
}

// Draws one group's rip + ink stubs, and returns the node ids it swallows.
function drawTornGroup(group) {
  const path       = reconstructPath(group);
  const pathPoints = path.map(id => nodePos(nodesById.get(id)));
  const seed       = hashStr(String(group.key));

  if (pathPoints.length <= 2) {
    const [pa, pb] = pathPoints;
    drawInkStub(pa, { x: pa.x + (pb.x - pa.x) * 0.30, y: pa.y + (pb.y - pa.y) * 0.30 }, ghostNodes.has(path[0]));
    drawInkStub(pb, { x: pb.x + (pa.x - pb.x) * 0.30, y: pb.y + (pa.y - pb.y) * 0.30 }, ghostNodes.has(path[1]));
    fillTornPolygon(buildTearPolygon(pa, pb, seed));
    return [];
  }

  const total  = pathTotalLength(pathPoints);
  const margin = Math.min(40, total * 0.3);
  const startStub = pointAtArcLength(pathPoints, margin);
  const endStub   = pointAtArcLength(pathPoints, total - margin);
  drawInkStub(pathPoints[0], startStub, ghostNodes.has(path[0]));
  drawInkStub(pathPoints[pathPoints.length - 1], endStub, ghostNodes.has(path[path.length - 1]));
  fillTornPolygon(buildGroupTearPolygon(pathPoints, seed));

  return path.slice(1, -1);  // interior nodes are swallowed
}

// ── PATCHES ───────────────────────────────────────────────────────────────────
// A bridged group keeps its grey rip, but each surviving end-node — where the
// new route stitches back into the old map — gets a small lighter-paper patch
// with dashed stitch marks, drawn under the node ring.

function drawPatchSquare(x, y, seed) {
  const rng = makePrng(seed);
  const s   = 38 + rng() * 8;              // patch side length
  const rot = (rng() - 0.5) * 0.45;        // slight crooked hand-stitched angle

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  ctx.setLineDash([]);
  ctx.fillStyle = C_PATCH;
  ctx.beginPath();
  ctx.rect(-s / 2, -s / 2, s, s);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,55,20,0.15)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  // Stitch marks just inside the patch edge
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = C_STITCH;
  ctx.lineWidth   = 1.3;
  ctx.beginPath();
  ctx.rect(-s / 2 + 3, -s / 2 + 3, s - 6, s - 6);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

function drawPatches() {
  for (const group of computeTornGroups().values()) {
    if (!bridgedGroups.has(group.key)) continue;
    const path = reconstructPath(group);
    for (const nid of [path[0], path[path.length - 1]]) {
      const p = nodePos(nodesById.get(nid));
      drawPatchSquare(p.x, p.y, hashStr(group.key + ':' + nid));
    }
  }
}

// The player token: a small front-facing wolf head (pointed ears, grey fur,
// white muzzle, amber eyes with angled brows) — a mini version of a classic
// front-on wolf-face illustration.
function drawToken() {
  const r = 11;
  ctx.setLineDash([]);
  ctx.lineJoin = 'round';
  ctx.save();
  ctx.translate(tokenX, tokenY);

  const FUR       = '#9aa1a6';
  const FUR_DARK  = '#7d8388';
  const FUR_WHITE = '#f2f1ee';
  const EAR_INNER = '#d9a8ad';
  const OUTLINE   = '#1a1a1a';

  function ear(sign) {
    ctx.beginPath();
    ctx.moveTo(sign * r * 0.35, -r * 0.75);
    ctx.lineTo(sign * r * 1.05, -r * 1.55);
    ctx.lineTo(sign * r * 0.95, -r * 0.55);
    ctx.closePath();
    ctx.fillStyle   = FUR;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth   = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(sign * r * 0.55, -r * 0.85);
    ctx.lineTo(sign * r * 0.92, -r * 1.32);
    ctx.lineTo(sign * r * 0.82, -r * 0.68);
    ctx.closePath();
    ctx.fillStyle = EAR_INNER;
    ctx.fill();
  }
  ear(-1);
  ear(1);

  // Head silhouette — jagged shield tapering to a chin point
  const pts = [
    [0,          -r * 0.95],
    [r * 0.55,   -r * 0.75],
    [r * 0.85,   -r * 0.35],
    [r * 0.7,     r * 0.05],
    [r * 0.95,    r * 0.15],
    [r * 0.5,     r * 0.55],
    [r * 0.65,    r * 0.65],
    [0,           r * 1.15],
    [-r * 0.65,   r * 0.65],
    [-r * 0.5,    r * 0.55],
    [-r * 0.95,   r * 0.15],
    [-r * 0.7,    r * 0.05],
    [-r * 0.85,  -r * 0.35],
    [-r * 0.55,  -r * 0.75],
  ];
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle   = FUR;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth   = 1.2;
  ctx.stroke();

  // White muzzle/chin patch
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, 0);
  ctx.lineTo(r * 0.45, 0);
  ctx.lineTo(r * 0.3, r * 0.5);
  ctx.lineTo(0, r * 1.1);
  ctx.lineTo(-r * 0.3, r * 0.5);
  ctx.closePath();
  ctx.fillStyle = FUR_WHITE;
  ctx.fill();

  // Forehead center part
  ctx.strokeStyle = FUR_DARK;
  ctx.lineWidth   = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.85);
  ctx.lineTo(0, -r * 0.35);
  ctx.stroke();

  // Relaxed, arched brows (raised, not furrowed) for a friendlier look
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth   = 1.2;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.46, -r * 0.2);
  ctx.quadraticCurveTo(-r * 0.3, -r * 0.32, -r * 0.15, -r * 0.22);
  ctx.moveTo(r * 0.46, -r * 0.2);
  ctx.quadraticCurveTo(r * 0.3, -r * 0.32, r * 0.15, -r * 0.22);
  ctx.stroke();

  // Eyes — round and slightly bigger, with a small highlight for warmth
  ctx.fillStyle = '#f2b53d';
  ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.02, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.3, r * 0.02, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth   = 0.8;
  ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.02, r * 0.16, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(r * 0.3, r * 0.02, r * 0.16, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff8e6';
  ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.03, r * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.25, -r * 0.03, r * 0.05, 0, Math.PI * 2); ctx.fill();

  // Nose
  ctx.beginPath();
  ctx.ellipse(0, r * 0.45, r * 0.16, r * 0.11, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#111';
  ctx.fill();

  // Upturned smile
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth   = 1.4;
  ctx.beginPath();
  ctx.moveTo(-r * 0.28, r * 0.64);
  ctx.quadraticCurveTo(0, r * 0.92, r * 0.28, r * 0.64);
  ctx.stroke();

  ctx.restore();
}

function drawNode(node) {
  const pos     = nodePos(node);
  const isConf  = confirmed.get(node.id);
  const isGhost = ghostNodes.has(node.id);

  ctx.strokeStyle = C_NODE;
  ctx.fillStyle   = C_NODE;
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';

  if (node.isDen) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, DEN_R, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Ghost nodes and unconfirmed nodes both show as dashed uncertain rings
    ctx.setLineDash(isConf && !isGhost ? [] : [4, 3]);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, NODE_R, 0, Math.PI * 2);
    ctx.stroke();
    // Center dot
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, NODE_DOT_R, 0, Math.PI * 2);
    ctx.fill();
  }
}

let hoverNode = null;

function drawTooltip() {
  if (!hoverNode) return;
  const pos  = nodePos(hoverNode);
  const text = hoverNode.name;

  ctx.font = '12px serif';
  const tw   = ctx.measureText(text).width;
  const pad  = 7;
  const boxW = tw + pad * 2;
  const boxH = 18 + pad * 2;

  // Prefer top-right of the node; clamp to canvas edges
  let lx = pos.x + 18;
  let ly = pos.y - boxH - 4;
  if (lx + boxW > canvas.width  - 8) lx = pos.x - boxW - 12;
  if (ly < 8)                         ly = pos.y + 20;

  ctx.setLineDash([]);
  ctx.fillStyle   = '#f5ecd6';
  ctx.strokeStyle = '#9a7a50';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.roundRect(lx, ly, boxW, boxH, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle    = '#3a2500';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, lx + pad, ly + boxH / 2);
}

function drawDayCounter() {
  ctx.setLineDash([]);
  ctx.font         = 'bold 14px serif';
  ctx.fillStyle    = C_NODE;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`Day ${day}`, 28, 28);
}

function drawHint() {
  ctx.setLineDash([]);
  ctx.font         = 'italic 12px serif';
  ctx.fillStyle    = 'rgba(91,70,50,0.7)';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Click a connected place to travel — unfamiliar ground costs more days.', 28, canvas.height - 26);
}

function draw() {
  ctx.save();
  drawParchment();

  for (const edge of edges) {
    if (edge.state !== 'torn') drawEdge(edge);
  }

  const swallowed = new Set();
  for (const group of computeTornGroups().values()) {
    for (const id of drawTornGroup(group)) swallowed.add(id);
  }

  drawPatches();
  for (const node of nodes) {
    if (!swallowed.has(node.id)) drawNode(node);
  }
  drawToken();
  drawTooltip();
  drawDayCounter();
  drawHint();
  drawFlash();
  ctx.restore();
}

// ── INPUT ─────────────────────────────────────────────────────────────────────

function nodeAtPos(mx, my) {
  for (const node of nodes) {
    const pos = nodePos(node);
    const r   = node.isDen ? DEN_R : NODE_R;
    if (Math.hypot(mx - pos.x, my - pos.y) <= r) return node;
  }
  return null;
}

// Node ids currently swallowed by a torn group's rip polygon — invisible,
// and therefore unreachable regardless of what any individual edge says.
function computeSwallowedNodes() {
  const swallowed = new Set();
  for (const group of computeTornGroups().values()) {
    const path = reconstructPath(group);
    if (path.length > 2) for (const id of path.slice(1, -1)) swallowed.add(id);
  }
  return swallowed;
}

function applyDecay() {
  // current-solid edges not walked recently demote to current-dotted
  for (const edge of edges) {
    if (edge.state !== 'current-solid') continue;
    const rt = edgeRT.get(edge.id);
    if (rt.lastTraversedDay !== null && (day - rt.lastTraversedDay) >= DECAY_DAYS) {
      edge.state = 'current-dotted';
      rt.lastTraversedDay = day;  // reset so faint timer starts from demotion, not last walk
    }
  }
}

canvas.addEventListener('click', e => {
  if (animating) return;

  const rect   = canvas.getBoundingClientRect();
  const target = nodeAtPos(e.clientX - rect.left, e.clientY - rect.top);
  if (!target || target.id === playerNode) return;

  // Nodes swallowed by a rip no longer exist on the map — nothing travels there
  if (computeSwallowedNodes().has(target.id)) return;

  const edge = edgeBetween(playerNode, target.id);
  if (!edge || edge.state === 'torn') return;

  // Mismatch: memory says one thing, the ground says another — bounce back
  // and tear the whole group (or just this edge, if it belongs to no group).
  if (edge.expected !== edge.actual) {
    const pa     = nodePos(nodesById.get(edge.a));
    const pb     = nodePos(nodesById.get(edge.b));
    const T      = playerNode === edge.a ? 0.35 : 0.65;
    const entryX = pa.x + (pb.x - pa.x) * T;
    const entryY = pa.y + (pb.y - pa.y) * T;
    const origX  = tokenX, origY = tokenY;
    runAnim([
      { toX: entryX, toY: entryY, ms: 220 },
      { toX: origX,  toY: origY,  ms: 200, onDone: () => {
          const group = edge.tearGroup
            ? edges.filter(e => e.tearGroup === edge.tearGroup)
            : [edge];
          for (const e of group) e.state = 'torn';
          recomputeGhosts();
          checkBridges();  // a detour walked before the tear already bridges it
          console.log('TEAR', group.length);
          playTearSting();
          startFlash();
          draw();
        }
      },
    ]);
    return;
  }

  // Update game state immediately, animate the token
  const rt = edgeRT.get(edge.id);
  if (edge.state === 'unknown') edge.state = 'current-dotted';
  rt.traverseCount++;
  rt.lastTraversedDay = day;
  if (edge.state === 'current-dotted' && rt.traverseCount >= SOLID_AT) {
    edge.state = 'current-solid';
  }
  travelHistory.push({ day, from: playerNode, to: target.id, edgeId: edge.id });
  day += edge.days ?? 1;
  applyDecay();

  const dest = nodePos(target);
  runAnim([{
    toX: dest.x, toY: dest.y, ms: 250,
    onDone: () => {
      playerNode = target.id;
      confirmed.set(playerNode, true);
      checkBridges();
      draw();
    },
  }]);
});

canvas.addEventListener('mousemove', e => {
  const rect  = canvas.getBoundingClientRect();
  const found = nodeAtPos(e.clientX - rect.left, e.clientY - rect.top);
  if (found !== hoverNode) { hoverNode = found; draw(); }
});

canvas.addEventListener('mouseleave', () => {
  if (hoverNode) { hoverNode = null; draw(); }
});

// ── INIT ──────────────────────────────────────────────────────────────────────

initGameState();
buildAdjacency();
computeTransform();
const _start = nodePos(nodesById.get(playerNode));
tokenX = _start.x;
tokenY = _start.y;
draw();
