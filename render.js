// The Corridor — all rendering. Reads state from game.js, draws to the canvas
// created in main.js (loaded after this file; globals resolve at call time).

// ── palette ──────────────────────────────────────────────────────────────────

const C_PARCHMENT = '#EDE2C9';
const C_INK_DARK  = '#7A3F12';   // Willow's hand, under-stroke
const C_INK_LIGHT = '#C7893F';   // Willow's hand, over-stroke
const C_TRAIL     = '#4E7A8C';   // Aspen's ink
const C_TORN      = '#9C9C94';
const C_PATCH     = '#E4DCC0';
const C_STITCH    = '#8A795A';
const C_NODE      = '#5B4632';

// world greens per season (spring, summer, autumn, winter)
const SEASON_GROUND = ['#97a37a', '#a3a06b', '#a89263', '#c9cdd1'];
const SEASON_FOREST = ['#6b8259', '#6f7f50', '#7d7448', '#8a9297'];

// ── transform ────────────────────────────────────────────────────────────────

function applyCamera() {
  ctx.setTransform(S.cam.scale, 0, 0, S.cam.scale,
    canvas.width / 2 - S.cam.x * S.cam.scale,
    canvas.height / 2 - S.cam.y * S.cam.scale);
}

function screenPos(x, y) {
  return {
    x: (x - S.cam.x) * S.cam.scale + canvas.width / 2,
    y: (y - S.cam.y) * S.cam.scale + canvas.height / 2,
  };
}

function resetTransform() { ctx.setTransform(1, 0, 0, 1, 0, 0); }

// ── world layer ──────────────────────────────────────────────────────────────

function strokePolyline(pts, width, style, dash) {
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash || []);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawWolfShape(w, bodyColor, size) {
  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.rotate(w.heading || 0);
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = '#2b2b26';
  ctx.lineWidth = 1.5;
  // body
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 1.35, size * 0.75, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // head
  ctx.beginPath();
  ctx.arc(size * 1.35, 0, size * 0.62, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  // ears
  ctx.beginPath();
  ctx.arc(size * 1.5, -size * 0.45, size * 0.2, 0, Math.PI * 2);
  ctx.arc(size * 1.5, size * 0.45, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
  // tail
  ctx.strokeStyle = bodyColor;
  ctx.lineWidth = size * 0.35;
  ctx.beginPath();
  ctx.moveTo(-size * 1.3, 0);
  ctx.lineTo(-size * 2.1, Math.sin(S.time * 5) * size * 0.25);
  ctx.stroke();
  ctx.restore();
}

function drawWorld() {
  const si = seasonIndex();
  resetTransform();
  ctx.fillStyle = SEASON_GROUND[si];
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  applyCamera();

  // ground mottling, deterministic
  const rng = makePrng(7);
  ctx.fillStyle = 'rgba(40,50,25,0.06)';
  for (let i = 0; i < 130; i++) {
    ctx.beginPath();
    ctx.ellipse(rng() * WORLD.w, rng() * WORLD.h, 40 + rng() * 90, 25 + rng() * 55, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // forests
  ctx.fillStyle = SEASON_FOREST[si];
  for (const f of TERRAIN.forests) {
    const frng = makePrng(hashStr('f' + f.x));
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(f.x + (frng() - 0.5) * f.r, f.y + (frng() - 0.5) * f.r, f.r * (0.35 + frng() * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // water: the living creek, the dry bed, the wash, the springs
  strokePolyline(TERRAIN.creekFlow, 26, si === 3 ? '#aebfc9' : '#7fa8b8');
  strokePolyline(TERRAIN.creekFlow, 10, si === 3 ? '#cfdbe2' : '#a9c6d2');
  strokePolyline(TERRAIN.creekDry, 20, '#b3a37f', [26, 18]);
  strokePolyline(TERRAIN.wash, 12, 'rgba(179,163,127,0.6)', [16, 12]);
  const sp = TERRAIN.springsPond;
  ctx.fillStyle = si === 3 ? '#aebfc9' : '#7fa8b8';
  ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2); ctx.fill();

  // physical trails: the routes exist on the ground whether or not she knows them
  ctx.globalAlpha = 0.3;
  for (const e of S.edges) {
    const A = NbyId.get(e.a), B = NbyId.get(e.b);
    strokePolyline([[A.x, A.y], [B.x, B.y]], 7, '#84765a');
  }
  ctx.globalAlpha = 1;

  // landmark hints
  for (const n of NODES) {
    ctx.fillStyle = 'rgba(90,80,60,0.55)';
    ctx.beginPath(); ctx.arc(n.x, n.y, 5, 0, Math.PI * 2); ctx.fill();
  }

  // the den
  ctx.fillStyle = C_NODE;
  ctx.beginPath(); ctx.arc(DEN.x, DEN.y, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2e2318';
  ctx.beginPath(); ctx.ellipse(DEN.x, DEN.y + 4, 9, 5, 0, 0, Math.PI * 2); ctx.fill();

  // the Black River That Roars
  const h = OBSTACLES.highway;
  ctx.fillStyle = '#43464a';
  ctx.fillRect(h.x0, 0, h.x1 - h.x0, WORLD.h);
  ctx.strokeStyle = 'rgba(230,225,200,0.5)';
  ctx.lineWidth = 3;
  ctx.setLineDash([30, 34]);
  ctx.beginPath(); ctx.moveTo((h.x0 + h.x1) / 2, 0); ctx.lineTo((h.x0 + h.x1) / 2, WORLD.h); ctx.stroke();
  ctx.setLineDash([]);
  // culvert mouth shadows
  ctx.fillStyle = '#2e3033';
  ctx.fillRect(h.x0 - 8, h.gapY0, h.x1 - h.x0 + 16, h.gapY1 - h.gapY0);

  // cars
  for (const car of S.cars) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.fillStyle = '#23252a';
    ctx.fillRect(-13, -30, 26, 60);
    ctx.fillStyle = 'rgba(255,240,180,0.85)';
    const front = car.vy > 0 ? 26 : -30;
    ctx.fillRect(-10, front, 6, 4); ctx.fillRect(4, front, 6, 4);
    ctx.restore();
  }

  // construction and rooflines
  const c = OBSTACLES.construction;
  ctx.fillStyle = '#a08a63';
  ctx.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
  ctx.fillStyle = '#6f6a5f';
  ctx.fillRect(c.x0 + 30, c.y0 + 40, 70, 40);
  ctx.fillRect(c.x0 + 120, c.y0 + 140, 50, 90);
  const sub = OBSTACLES.subdivision;
  ctx.fillStyle = '#9b9186';
  ctx.fillRect(sub.x0, sub.y0, sub.x1 - sub.x0, sub.y1 - sub.y0);
  ctx.fillStyle = '#7d6b5c';
  for (let rx = sub.x0 + 20; rx < sub.x1 - 50; rx += 70) {
    for (let ry = sub.y0 + 20; ry < sub.y1 - 40; ry += 80) {
      ctx.fillRect(rx, ry, 46, 34);
    }
  }

  // elk
  for (const elk of S.elk) {
    ctx.save();
    ctx.translate(elk.x, elk.y);
    ctx.rotate(elk.heading);
    ctx.fillStyle = '#8a6f4d';
    ctx.strokeStyle = '#463723';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 19, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(19, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // the pack, then Aspen
  for (const w of S.pack) {
    if (w.state === 'dead' || w.state === 'gone') continue;
    const tones = { bram: '#a8a49a', sedge: '#9b8a80', alder: '#9aa1a6', fen: '#9aa1a6' };
    w.heading = Math.atan2(S.wolf.y - w.y, S.wolf.x - w.x);
    drawWolfShape(w, tones[w.id] || '#9aa1a6', w.yearling ? 8 : 10);
    if (w.state === 'balk') {
      resetTransformTextAt(w.x, w.y - 26, '!', 'bold 16px serif', '#7a2f1a');
      applyCamera();
    }
  }
  drawWolfShape(S.wolf, '#8d9298', 11);

  // landmark names, when close
  resetTransform();
  for (const n of NODES) {
    if (dist(S.wolf.x, S.wolf.y, n.x, n.y) < 130) {
      const p = screenPos(n.x, n.y);
      ctx.font = 'italic 13px serif';
      ctx.fillStyle = 'rgba(35,30,18,0.85)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(n.name, p.x, p.y - 10);
    }
  }
}

function resetTransformTextAt(wx, wy, text, font, color) {
  resetTransform();
  const p = screenPos(wx, wy);
  ctx.font = font; ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(text, p.x, p.y);
}

// ── scent layer ──────────────────────────────────────────────────────────────

function violetAt(x, y) {
  const scale = 1 + 0.25 * seasonIndex();  // the year-long squeeze
  let v = 0;
  for (const s of SCENT_VIOLET) {
    const d = dist(x, y, s.x, s.y);
    const r = s.r * scale;
    v += Math.exp(-(d * d) / (r * r));
  }
  return v;
}

function drawScent() {
  resetTransform();
  ctx.fillStyle = 'rgba(15,12,25,0.45)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  applyCamera();
  const scale = 1 + 0.25 * seasonIndex();
  const pulse = 0.8 + 0.2 * Math.sin(S.time * 1.8);

  // violet: volumetric, directionless — a cloud, not a path
  for (const s of SCENT_VIOLET) {
    const r = s.r * scale * pulse;
    const g = ctx.createRadialGradient(s.x, s.y, r * 0.1, s.x, s.y, r);
    g.addColorStop(0, 'rgba(150,90,220,0.4)');
    g.addColorStop(1, 'rgba(150,90,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
  }

  // gold: directional prey trails with freshness falloff — blotted where violet sits
  for (const p of S.scent) {
    const age = S.time - p.t;
    if (age > 90) continue;
    if (violetAt(p.x, p.y) > 0.45) continue;  // sensory pollution, rendered literally
    ctx.fillStyle = `rgba(235,190,80,${0.75 * (1 - age / 90)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
  }

  // red: rival marks
  for (const m of SCENT_RED) {
    if (violetAt(m.x, m.y) > 0.45) continue;
    ctx.fillStyle = 'rgba(200,60,50,0.7)';
    ctx.beginPath(); ctx.arc(m.x, m.y, 12, 0, Math.PI * 2); ctx.fill();
  }
}

// ── map layer: the mental map ────────────────────────────────────────────────

const wobbleCache = new Map();
function edgePolyline(e) {
  if (wobbleCache.has(e.id)) return wobbleCache.get(e.id);
  const A = NbyId.get(e.a), B = NbyId.get(e.b);
  const rng = makePrng(hashStr(e.id));
  const pts = [[A.x, A.y]];
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const nx = -(B.y - A.y), ny = B.x - A.x;
    const L = Math.hypot(nx, ny) || 1;
    const off = (rng() - 0.5) * 16;
    pts.push([A.x + (B.x - A.x) * t + nx / L * off, A.y + (B.y - A.y) * t + ny / L * off]);
  }
  pts.push([B.x, B.y]);
  wobbleCache.set(e.id, pts);
  return pts;
}

function drawInkEdge(e, m) {
  const sc = S.cam.scale;
  if (e.torn) return;  // the rip renders instead

  if (S.ghostEdges.has(e.id)) {
    // memory beyond a tear: where the route was supposed to go, unverified
    ctx.globalAlpha = 0.3 * m;
    strokePolyline(edgePolyline(e), 2.4 / sc, C_INK_LIGHT, [10 / sc, 8 / sc]);
    ctx.globalAlpha = 1;
    return;
  }

  if (e.state === 'inherited') {
    ctx.globalAlpha = m;
    strokePolyline(edgePolyline(e), 6 / sc, C_INK_DARK);
    strokePolyline(edgePolyline(e), 2.6 / sc, C_INK_LIGHT);
    ctx.globalAlpha = 1;
    return;
  }

  if (e.state === 'current-dotted' || e.state === 'current-solid') {
    ctx.globalAlpha = m;
    const dash = e.state === 'current-dotted' ? [7 / sc, 6 / sc] : [];
    const A = NbyId.get(e.a), B = NbyId.get(e.b);
    strokePolyline([[A.x, A.y], [B.x, B.y]], 2.6 / sc, C_TRAIL, dash);
    ctx.globalAlpha = 1;
    return;
  }

  // unknown but partially walked: provisional ink only where her feet have been
  if (e.inkHi > e.inkLo) {
    const A = NbyId.get(e.a), B = NbyId.get(e.b);
    ctx.globalAlpha = 0.85 * m;
    strokePolyline(
      [[lerp(A.x, B.x, e.inkLo), lerp(A.y, B.y, e.inkLo)],
       [lerp(A.x, B.x, e.inkHi), lerp(A.y, B.y, e.inkHi)]],
      2.4 / sc, C_TRAIL, [6 / sc, 7 / sc]);
    ctx.globalAlpha = 1;
  }
}

function chainPoints(g) { return g.chain.map(id => { const n = NbyId.get(id); return { x: n.x, y: n.y }; }); }

function pathLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
  return L;
}

function pointAt(pts, s) {
  let rem = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    if (rem <= seg || i === pts.length - 1) {
      const t = seg ? rem / seg : 0;
      return {
        x: lerp(pts[i - 1].x, pts[i].x, t), y: lerp(pts[i - 1].y, pts[i].y, t),
        ux: (pts[i].x - pts[i - 1].x) / (seg || 1), uy: (pts[i].y - pts[i - 1].y) / (seg || 1),
      };
    }
    rem -= seg;
  }
  const p = pts[pts.length - 1];
  return { x: p.x, y: p.y, ux: 1, uy: 0 };
}

function drawRip(g, m) {
  const pts = chainPoints(g);
  const total = pathLength(pts);
  const margin = Math.min(60, total * 0.25);
  const rng = makePrng(hashStr(g.key));
  const W = Math.max(30, Math.min(80, (total - 2 * margin) * 0.14));
  const N = 12;

  const pos = [], neg = [];
  for (let i = 0; i <= N; i++) {
    const p = pointAt(pts, margin + (i / N) * (total - 2 * margin));
    const w = W + (rng() * 2 - 1) * W * 0.4;
    pos.push([p.x - p.uy * w, p.y + p.ux * w]);
    neg.push([p.x + p.uy * w, p.y - p.ux * w]);
  }
  const poly = pos.concat(neg.reverse());

  ctx.globalAlpha = m;
  // amber stubs entering from the surviving ends
  const sc = S.cam.scale;
  for (const [endIdx, sDist] of [[0, margin], [pts.length - 1, total - margin]]) {
    const end = pts[endIdx];
    const stubTo = pointAt(pts, sDist);
    const ghost = S.ghostNodes.has(g.chain[endIdx]);
    if (ghost) {
      ctx.globalAlpha = 0.3 * m;
      strokePolyline([[end.x, end.y], [stubTo.x, stubTo.y]], 2.4 / sc, C_INK_LIGHT, [10 / sc, 8 / sc]);
      ctx.globalAlpha = m;
    } else {
      strokePolyline([[end.x, end.y], [stubTo.x, stubTo.y]], 6 / sc, C_INK_DARK);
      strokePolyline([[end.x, end.y], [stubTo.x, stubTo.y]], 2.6 / sc, C_INK_LIGHT);
    }
  }

  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
  ctx.fillStyle = C_TORN;
  ctx.fill();
  ctx.strokeStyle = '#5a5a54';
  ctx.lineWidth = 1.6 / sc;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPatchSquare(x, y, seed, m) {
  const rng = makePrng(seed);
  const s = 84 + rng() * 18;
  const sc = S.cam.scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rng() - 0.5) * 0.45);
  ctx.globalAlpha = m;
  ctx.fillStyle = C_PATCH;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeStyle = C_STITCH;
  ctx.lineWidth = 1.4 / sc;
  ctx.setLineDash([10 / sc, 8 / sc]);
  ctx.strokeRect(-s / 2 + 6, -s / 2 + 6, s - 12, s - 12);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function nodeKnown(n) {
  if (S.visited.has(n.id)) return true;
  return S.edges.some(e => e.state === 'inherited' && !e.torn && (e.a === n.id || e.b === n.id));
}

function drawMap() {
  const m = smooth(S.senseBlend);

  // parchment wash over the dimming world
  resetTransform();
  ctx.globalAlpha = 0.94 * m;
  ctx.fillStyle = C_PARCHMENT;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // parchment speckle
  const rng = makePrng(42);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(90,55,20,${rng() * 0.05})`;
    ctx.beginPath();
    ctx.arc(rng() * canvas.width, rng() * canvas.height, rng() * 1.5 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  applyCamera();
  const sc = S.cam.scale;

  // terrain hinted as geography, never as routes
  ctx.globalAlpha = 0.35 * m;
  strokePolyline(TERRAIN.creekFlow, 8 / sc, '#8fa8b0');
  ctx.fillStyle = '#a8b592';
  for (const f of TERRAIN.forests) {
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ink
  for (const e of S.edges) drawInkEdge(e, m);
  for (const g of TEAR_GROUPS) if (groupTorn(g)) drawRip(g, m);
  for (const g of TEAR_GROUPS) {
    if (!groupTorn(g) || !S.bridged.has(g.key)) continue;
    for (const nid of [g.chain[0], g.chain[g.chain.length - 1]]) {
      const n = NbyId.get(nid);
      drawPatchSquare(n.x, n.y, hashStr(g.key + ':' + nid), m);
    }
  }

  // nodes, in screen space so rings stay a constant size
  resetTransform();
  const swallowed = swallowedNodeIds();
  for (const n of NODES) {
    if (swallowed.has(n.id)) continue;
    if (!nodeKnown(n)) continue;
    const p = screenPos(n.x, n.y);
    const ghost = S.ghostNodes.has(n.id);
    ctx.globalAlpha = (ghost ? 0.5 : 1) * m;
    ctx.strokeStyle = C_NODE; ctx.fillStyle = C_NODE;
    ctx.lineWidth = 2;
    if (n.den) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.setLineDash(S.visited.has(n.id) && !ghost ? [] : [4, 3]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    if (m > 0.7 && S.visited.has(n.id)) {
      ctx.font = 'italic 11px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = `rgba(74,58,38,${m})`;
      ctx.fillText(n.name, p.x, p.y + 15);
    }
    ctx.globalAlpha = 1;
  }

  // she is here
  const wp = screenPos(S.wolf.x, S.wolf.y);
  ctx.fillStyle = C_TRAIL;
  ctx.beginPath();
  ctx.arc(wp.x, wp.y, 5 + Math.sin(S.time * 4) * 1.5, 0, Math.PI * 2);
  ctx.fill();

  // limited visible radius: what she cannot call to mind stays void
  const r = senseRadius() * S.cam.scale;
  const g = ctx.createRadialGradient(wp.x, wp.y, r * 0.65, wp.x, wp.y, r);
  g.addColorStop(0, 'rgba(185,178,158,0)');
  g.addColorStop(1, `rgba(185,178,158,${0.97 * m})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (m > 0.7) {
    ctx.font = 'italic 13px serif';
    ctx.fillStyle = `rgba(91,70,50,${m * 0.8})`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('— what she remembers of the territory —', canvas.width / 2, canvas.height - 14);
  }
}

// ── HUD ──────────────────────────────────────────────────────────────────────

function drawBar(x, y, w, label, frac, color) {
  ctx.fillStyle = 'rgba(20,18,12,0.35)';
  ctx.fillRect(x, y, w, 10);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), 10);
  ctx.font = 'bold 10px serif';
  ctx.fillStyle = '#f4efdd';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 4, y + 5.5);
}

function drawHUD() {
  resetTransform();
  const onMap = S.senseBlend > 0.5;
  const inkText = onMap ? '#4a3a26' : '#20200f';

  ctx.font = 'bold 17px serif';
  ctx.fillStyle = inkText;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  let head = `Day ${day()} · ${seasonName()}`;
  if (day() >= WINTER_START) head += ' · the Winter Range waits';
  ctx.fillText(head, 20, 16);

  drawBar(20, 44, 140, 'FOOD', S.food / 100, '#b08d3f');
  drawBar(20, 60, 140, 'FEAR', S.fear, '#a5443a');

  // pack roster
  ctx.font = '13px serif';
  ctx.textAlign = 'right';
  let ry = 18;
  for (const w of S.pack) {
    const glyph = { follow: '', stay: ' · holds', balk: ' · balks!', dead: ' · lost to the road', gone: ' · gone' }[w.state];
    ctx.fillStyle = (w.state === 'dead' || w.state === 'gone') ? 'rgba(90,50,40,0.8)' : inkText;
    ctx.fillText(w.name + glyph, canvas.width - 20, ry);
    ry += 18;
  }

  // message
  if (S.msgT > 0) {
    ctx.font = 'italic 16px serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(30,24,12,${clamp(S.msgT, 0, 1)})`;
    if (onMap) ctx.fillStyle = `rgba(74,58,38,${clamp(S.msgT, 0, 1)})`;
    ctx.fillText(S.msg, canvas.width / 2, 30);
  }

  // controls
  if (!onMap) {
    ctx.font = '12px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(25,22,10,0.75)';
    ctx.fillText('WASD move · hold SPACE remember · hold E scent · F pack holds/follows · N new year',
      canvas.width / 2, canvas.height - 10);
  }
}

function drawFlicker() {
  if (S.flickerT <= 0) return;
  resetTransform();
  ctx.fillStyle = `rgba(150,150,144,${0.45 * (S.flickerT / 0.5)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ── intro ────────────────────────────────────────────────────────────────────

function drawIntro() {
  resetTransform();
  ctx.fillStyle = '#191b16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2, cy = canvas.height / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 44px serif'; ctx.fillStyle = C_PARCHMENT;
  ctx.fillText('THE CORRIDOR', cx, cy - 130);
  ctx.font = 'italic 17px serif'; ctx.fillStyle = '#b8ac8d';
  const lines = [
    'Your mother knew this land completely. She led for nine years.',
    'Now she is gone, and her map is yours.',
    'The land has not stayed what she knew.',
    '',
    'It is spring. The pack is hungry.',
    'By winter, they must reach the Winter Range — on a map that still works.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, cx, cy - 60 + i * 26));
  ctx.font = '14px serif'; ctx.fillStyle = '#8d8468';
  ctx.fillText('WASD / arrows — move        hold SPACE — remember the map        hold E — scent', cx, cy + 130);
  ctx.fillText('F — pack holds or follows        N — begin a new year', cx, cy + 152);
  ctx.font = 'bold 16px serif'; ctx.fillStyle = C_PARCHMENT;
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 400);
  ctx.fillText('press any key', cx, cy + 205);
  ctx.globalAlpha = 1;
}

// ── the ending: the satellite dissolve ───────────────────────────────────────

function endingCamera() {
  const sc = Math.min(canvas.width / WORLD.w, canvas.height / WORLD.h) * 0.92;
  ctx.setTransform(sc, 0, 0, sc,
    canvas.width / 2 - WORLD.w / 2 * sc, canvas.height / 2 - WORLD.h / 2 * sc);
  return sc;
}

function drawSatellite() {
  // the world as the other species sees it
  ctx.fillStyle = '#6a705c';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  const rng = makePrng(99);
  for (let i = 0; i < 60; i++) {  // field patchwork
    ctx.fillStyle = `rgba(${120 + rng() * 60},${115 + rng() * 40},${70 + rng() * 30},0.25)`;
    ctx.fillRect(rng() * WORLD.w, rng() * WORLD.h, 120 + rng() * 300, 90 + rng() * 220);
  }
  ctx.fillStyle = 'rgba(40,55,35,0.8)';
  for (const f of TERRAIN.forests) {
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
  }
  strokePolyline(TERRAIN.creekFlow, 18, '#5d7d8a');
  const h = OBSTACLES.highway;
  ctx.fillStyle = '#33353a';
  ctx.fillRect(h.x0 - 6, 0, h.x1 - h.x0 + 12, WORLD.h);
  ctx.strokeStyle = 'rgba(235,225,190,0.7)';
  ctx.lineWidth = 2.5; ctx.setLineDash([26, 26]);
  ctx.beginPath(); ctx.moveTo((h.x0 + h.x1) / 2, 0); ctx.lineTo((h.x0 + h.x1) / 2, WORLD.h); ctx.stroke();
  ctx.setLineDash([]);
  const c = OBSTACLES.construction;
  ctx.fillStyle = '#b5a074'; ctx.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
  const sub = OBSTACLES.subdivision;
  ctx.fillStyle = '#8e8478'; ctx.fillRect(sub.x0, sub.y0, sub.x1 - sub.x0, sub.y1 - sub.y0);
  ctx.fillStyle = '#c9beac';
  for (let rx = sub.x0 + 16; rx < sub.x1 - 44; rx += 56) {
    for (let ry = sub.y0 + 16; ry < sub.y1 - 34; ry += 62) ctx.fillRect(rx, ry, 38, 26);
  }
}

function drawEnding() {
  const t = S.endT;
  resetTransform();
  ctx.fillStyle = '#101210';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sc = endingCamera();
  ctx.globalAlpha = clamp(t / 2.5, 0, 1);
  drawSatellite();
  ctx.globalAlpha = 1;

  // her actual year, traced
  const posPts = S.history.filter(e => e.type === 'pos');
  if (t > 2.5 && posPts.length > 1) {
    const frac = clamp((t - 2.5) / 6, 0, 1);
    const n = Math.max(2, Math.floor(posPts.length * frac));
    ctx.strokeStyle = C_TRAIL;
    ctx.lineWidth = 3 / sc * 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(posPts[0].x, posPts[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(posPts[i].x, posPts[i].y);
    ctx.stroke();
  }

  // Willow's map beside it
  if (t > 9) {
    ctx.globalAlpha = clamp((t - 9) / 2, 0, 1) * 0.8;
    for (const d of EDGES) {
      if (d.state !== 'inherited') continue;
      const A = NbyId.get(d.a), B = NbyId.get(d.b);
      strokePolyline([[A.x, A.y], [B.x, B.y]], 5, C_INK_LIGHT);
    }
    ctx.globalAlpha = 1;
  }

  // the next generation's inheritance — only if someone walked the new ways
  const yearlingAlive = S.pack.some(w => w.yearling && w.state !== 'dead' && w.state !== 'gone');
  const hasLegacy = yearlingAlive && S.yearlingKnows.size > 0;
  if (t > 12 && hasLegacy) {
    ctx.globalAlpha = clamp((t - 12) / 2, 0, 1) * 0.9;
    ctx.setLineDash([14, 12]);
    for (const eid of S.yearlingKnows) {
      const d = EDGES.find(x => x.id === eid);
      const A = NbyId.get(d.a), B = NbyId.get(d.b);
      strokePolyline([[A.x, A.y], [B.x, B.y]], 3.5, '#e8e4d4', [14, 12]);
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // the one editorial sentence in the game
  resetTransform();
  if (t > 15) {
    const a = clamp((t - 15) / 2, 0, 1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(16,18,16,${0.72 * a})`;
    ctx.fillRect(0, canvas.height / 2 - 90, canvas.width, 180);
    ctx.font = 'italic 19px serif';
    ctx.fillStyle = `rgba(237,226,201,${a})`;
    const line1 = S.endKind === 'arrived'
      ? 'She brought them through. The map that did it was hers, not her mother’s.'
      : 'The winter closed before the map was finished.';
    ctx.fillText(line1, canvas.width / 2, canvas.height / 2 - 44);
    ctx.font = '17px serif';
    ctx.fillText('A wolf’s territory once passed from mother to daughter, unchanged, for generations.',
      canvas.width / 2, canvas.height / 2 + 2);
    ctx.fillText('The average corridor now closes within one.', canvas.width / 2, canvas.height / 2 + 28);
    ctx.font = 'italic 14px serif';
    ctx.fillStyle = `rgba(184,172,141,${a})`;
    ctx.fillText(hasLegacy
      ? 'Two walk behind her who know the new ways. The dotted line is theirs.'
      : 'No one walks behind her who learned the new ways.',
      canvas.width / 2, canvas.height / 2 + 62);
  }
  if (t > 18) {
    ctx.font = 'bold 15px serif';
    ctx.fillStyle = C_PARCHMENT;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 400);
    ctx.textAlign = 'center';
    ctx.fillText('press N to begin again', canvas.width / 2, canvas.height - 40);
    ctx.globalAlpha = 1;
  }
}

// ── dispatcher ───────────────────────────────────────────────────────────────

function draw() {
  if (!S) return;
  if (S.mode === 'intro') { drawIntro(); return; }
  if (S.mode === 'ending') { drawEnding(); return; }

  drawWorld();
  if (input.scent && S.senseBlend < 0.2) drawScent();
  if (S.senseBlend > 0.01) drawMap();
  drawFlicker();
  drawHUD();
}
