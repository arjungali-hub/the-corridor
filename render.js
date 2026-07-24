// The Corridor — all rendering and animation. Reads state from game.js;
// draws to the canvas created in main.js (globals resolve at call time).

// ── palette ──────────────────────────────────────────────────────────────────

const FONT = 'Georgia, "Times New Roman", serif';

const C_PARCHMENT = '#EDE2C9';
const C_INK_DARK  = '#7A3F12';
const C_INK_LIGHT = '#C7893F';
const C_TRAIL     = '#4E7A8C';
const C_TORN      = '#9C9C94';
const C_PATCH     = '#E4DCC0';
const C_STITCH    = '#8A795A';
const C_NODE      = '#5B4632';

const SEASON_GROUND = ['#8fa06f', '#a09b63', '#a68f5c', '#ccd0d4'];
const SEASON_GROUND_DARK = ['#7a8c5c', '#8a8752', '#93794a', '#b4bac0'];
const SEASON_FOREST = ['#5e7a4e', '#647547', '#7d6f3f', '#7c878c'];
const PAST_GROUND = '#96a468';   // the remembered valley, warm and whole

const WOLF_TONES = {
  aspen:  { base: '#8f959b', dark: '#666c72', light: '#c6cacd' },
  bram:   { base: '#a9a69d', dark: '#7c786e', light: '#d5d2c8' },
  sedge:  { base: '#9a8578', dark: '#6f5d51', light: '#c9b8ab' },
  alder:  { base: '#98a1a8', dark: '#6d767d', light: '#c8cdd2' },
  fen:    { base: '#8e9198', dark: '#63666d', light: '#c0c3c8' },
  pup:    { base: '#9aa1a6', dark: '#71787d', light: '#cbd0d3' },
  willow: { base: '#a89a84', dark: '#77694f', light: '#dccfb4' },
  willowDead: { base: '#9a958c', dark: '#6f6a62', light: '#c2beb6' },
};
const HERD_TONES = [
  { body: '#7d6349', dark: '#4f3d28', rump: '#d9c9a8' },
  { body: '#96714f', dark: '#5d452f', rump: '#e2d2b0' },
  { body: '#7d6349', dark: '#4f3d28', rump: '#d9c9a8' },
  { body: '#96714f', dark: '#5d452f', rump: '#e2d2b0' },
  { body: '#443c35', dark: '#292420', rump: '#d8d3c8' },   // black-baldy cattle
];
const DOG_TONES   = { base: '#7a5c3a', dark: '#53402a', light: '#b39872' };
const RIVAL_TONES = { base: '#8d7f7a', dark: '#5c4c47', light: '#bcaea8' };

// ── transform ────────────────────────────────────────────────────────────────

function applyCamera() {
  const jx = (Math.random() - 0.5) * S.shake, jy = (Math.random() - 0.5) * S.shake;
  ctx.setTransform(S.cam.scale, 0, 0, S.cam.scale,
    canvas.width / 2 - S.cam.x * S.cam.scale + jx,
    canvas.height / 2 - S.cam.y * S.cam.scale + jy);
}

function screenPos(x, y) {
  return {
    x: (x - S.cam.x) * S.cam.scale + canvas.width / 2,
    y: (y - S.cam.y) * S.cam.scale + canvas.height / 2,
  };
}

function resetTransform() { ctx.setTransform(1, 0, 0, 1, 0, 0); }

function strokePolyline(c, pts, width, style, dash) {
  c.strokeStyle = style;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.setLineDash(dash || []);
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.stroke();
  c.setLineDash([]);
}

// smooth curve through a polyline (quadratic through midpoints)
function smoothPath(c, pts) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
}

function strokeSmooth(c, pts, width, style, dash) {
  c.strokeStyle = style; c.lineWidth = width;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.setLineDash(dash || []);
  smoothPath(c, pts);
  c.stroke();
  c.setLineDash([]);
}

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// ── the pre-rendered world (rebuilt on season or era change) ─────────────────

let baseLayer = null, baseKey = '';
const BASE_SCALE = 0.5;   // half-resolution terrain: painterly, and 4× cheaper

// A bog/pond of standing drinking water: mud bank → shallows → dark deep
// center, a sky-sheen crescent, rim reeds, algal scum when fouled, and a
// cracked pale ice lid in winter. Smooth-edged. (The one art kept from the
// overhaul, by request.)
function paintPond(b, x, y, r, squash, si, past, foul) {
  const prng = makePrng(hashStr('pond' + Math.round(x) + '_' + Math.round(y)));
  const iced = !past && si === 3;
  const NR = 12, prof = [];
  for (let i = 0; i < NR; i++) prof.push(0.9 + prng() * 0.16);
  const lobe = (rad) => {
    const p = (i) => {
      const a = (i / NR) * Math.PI * 2, rr = rad * prof[((i % NR) + NR) % NR];
      return [x + Math.cos(a) * rr, y + Math.sin(a) * rr * squash];
    };
    b.beginPath();
    const a0 = p(0), aPrev = p(NR - 1);
    b.moveTo((aPrev[0] + a0[0]) / 2, (aPrev[1] + a0[1]) / 2);
    for (let i = 0; i < NR; i++) {
      const cur = p(i), nxt = p(i + 1);
      b.quadraticCurveTo(cur[0], cur[1], (cur[0] + nxt[0]) / 2, (cur[1] + nxt[1]) / 2);
    }
    b.closePath();
  };
  b.fillStyle = mixTone('#6f6446', '#4f4630', 0.3);
  lobe(r * 1.2); b.fill();
  b.fillStyle = 'rgba(60,54,38,0.5)';
  lobe(r * 1.08); b.fill();
  const deep = iced ? '#b7c6cf' : foul ? '#565b3c' : '#3f647a';
  const shallow = iced ? '#dfe8ec' : foul ? '#767a4e' : '#6f9fb2';
  const wg = b.createRadialGradient(x - r * 0.2, y - r * 0.2 * squash, r * 0.1, x, y, r);
  wg.addColorStop(0, shallow); wg.addColorStop(0.55, iced ? '#c8d6dc' : foul ? '#61653f' : '#557f96'); wg.addColorStop(1, deep);
  b.fillStyle = wg;
  lobe(r); b.fill();
  b.save(); lobe(r * 0.99); b.clip();
  if (iced) {
    b.strokeStyle = 'rgba(150,170,182,0.6)'; b.lineWidth = 1.2;
    for (let k = 0; k < 7; k++) {
      const a = prng() * Math.PI * 2;
      b.beginPath(); b.moveTo(x, y);
      let cx = x, cy = y, ca = a;
      for (let seg = 0; seg < 4; seg++) { ca += (prng() - 0.5) * 0.8; cx += Math.cos(ca) * r * 0.3; cy += Math.sin(ca) * r * 0.3 * squash; b.lineTo(cx, cy); }
      b.stroke();
    }
    b.fillStyle = 'rgba(255,255,255,0.35)';
    b.beginPath(); b.ellipse(x - r * 0.3, y - r * 0.3 * squash, r * 0.5, r * 0.3, 0.3, 0, Math.PI * 2); b.fill();
  } else {
    b.fillStyle = foul ? 'rgba(180,186,120,0.3)' : 'rgba(210,232,240,0.4)';
    b.beginPath(); b.ellipse(x + LIGHT.x * r * 0.35, y + LIGHT.y * r * 0.35 * squash, r * 0.5, r * 0.22, Math.atan2(LIGHT.y, LIGHT.x), 0, Math.PI * 2); b.fill();
    if (foul) {
      b.fillStyle = 'rgba(120,140,70,0.4)';
      for (let k = 0; k < 6; k++) { b.beginPath(); b.arc(x + (prng() - 0.5) * r * 1.4, y + (prng() - 0.5) * r * squash * 1.4, r * (0.12 + prng() * 0.16), 0, Math.PI * 2); b.fill(); }
    }
  }
  b.restore();
  if (!iced) {
    b.strokeStyle = mixTone('#6a7a38', '#4a5a26', 0.4); b.lineWidth = 2; b.lineCap = 'round';
    for (let k = 0; k < 16; k++) {
      const a = prng() * Math.PI * 2, rx = x + Math.cos(a) * r * 1.02, ry = y + Math.sin(a) * r * squash * 1.02;
      const h = 8 + prng() * 12;
      b.beginPath(); b.moveTo(rx, ry); b.quadraticCurveTo(rx + (prng() - 0.5) * 4, ry - h * 0.6, rx + (prng() - 0.5) * 8, ry - h); b.stroke();
    }
  }
}

function buildBaseLayer() {
  const si = S.era === 'past' ? 0 : seasonIndex();
  const burned = S.era !== 'past' && S.fire && S.fire.state === 'done';
  baseKey = S.era + '|' + si + '|' + burned;
  const X0 = WORLD.x0 || 0;
  if (!baseLayer) {
    baseLayer = document.createElement('canvas');
    baseLayer.width = (WORLD.w - X0 + 2 * APRON) * BASE_SCALE;
    baseLayer.height = (WORLD.h + 2 * APRON) * BASE_SCALE;
  }
  const b = baseLayer.getContext('2d');
  // world coords at half scale; the apron is negative space
  b.setTransform(BASE_SCALE, 0, 0, BASE_SCALE, (APRON - X0) * BASE_SCALE, APRON * BASE_SCALE);
  const past = S.era === 'past';
  const AX = X0 - APRON, AY = -APRON, AW = WORLD.w - X0 + 2 * APRON, AH = WORLD.h + 2 * APRON;

  // ground — the land continues past where she can walk; no black void
  b.fillStyle = past ? PAST_GROUND : SEASON_GROUND[si];
  b.fillRect(AX, AY, AW, AH);

  const rng = makePrng(710);
  // broad tonal patches
  for (let i = 0; i < 60; i++) {
    const x = AX + rng() * AW, y = AY + rng() * AH, r = 260 + rng() * 480;
    const g = b.createRadialGradient(x, y, r * 0.2, x, y, r);
    const dark = rng() > 0.5;
    g.addColorStop(0, dark ? 'rgba(50,60,30,0.10)' : 'rgba(240,240,200,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    b.fillStyle = g;
    b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill();
  }
  // mottling
  b.fillStyle = SEASON_GROUND_DARK[si];
  for (let i = 0; i < 900; i++) {
    b.globalAlpha = 0.05 + rng() * 0.05;
    b.beginPath();
    b.ellipse(AX + rng() * AW, AY + rng() * AH, 30 + rng() * 90, 18 + rng() * 50, rng() * 3, 0, Math.PI * 2);
    b.fill();
  }
  b.globalAlpha = 1;
  // fine speckle: grass tufts / stones
  for (let i = 0; i < 3200; i++) {
    b.fillStyle = rng() > 0.5 ? 'rgba(40,55,25,0.12)' : 'rgba(235,235,205,0.10)';
    b.fillRect(AX + rng() * AW, AY + rng() * AH, 2 + rng() * 3, 1.5 + rng() * 2);
  }
  // season dressing
  if (si === 0) {
    for (let i = 0; i < 640; i++) {   // wildflowers
      b.fillStyle = rng() > 0.5 ? 'rgba(250,245,220,0.7)' : 'rgba(230,200,120,0.6)';
      b.beginPath(); b.arc(AX + rng() * AW, AY + rng() * AH, 1.6 + rng() * 1.6, 0, Math.PI * 2); b.fill();
    }
  } else if (si === 2 && !past) {
    for (let i = 0; i < 760; i++) {   // leaf litter
      b.fillStyle = `rgba(${150 + rng() * 60 | 0},${70 + rng() * 40 | 0},30,0.5)`;
      b.beginPath(); b.ellipse(AX + rng() * AW, AY + rng() * AH, 3, 1.6, rng() * 3, 0, Math.PI * 2); b.fill();
    }
  } else if (si === 3 && !past) {
    for (let i = 0; i < 330; i++) {   // drifts
      b.fillStyle = 'rgba(255,255,255,0.5)';
      b.beginPath(); b.ellipse(AX + rng() * AW, AY + rng() * AH, 40 + rng() * 90, 8 + rng() * 16, rng() * 0.6 - 0.3, 0, Math.PI * 2); b.fill();
    }
  }

  // water: banks, then living water; the dry bed; the wash under the road
  strokeSmooth(b, TERRAIN.creekFlow, 44, 'rgba(80,70,45,0.45)');
  strokeSmooth(b, TERRAIN.creekFlow, 30, si === 3 && !past ? '#aebfc9' : '#6f9cae');
  strokeSmooth(b, TERRAIN.creekFlow, 12, si === 3 && !past ? '#d5dfe5' : '#a9c6d2');

  // ponds: standing drinking water — the one art kept from the overhaul
  for (const p of PONDS) {
    paintPond(b, p.x, p.y, p.r, 0.74, si, past,
      !past && typeof waterFouled === 'function' && S && waterFouled(p.x, p.y));
  }
  if (!past) {
    strokeSmooth(b, TERRAIN.creekDry, 26, 'rgba(150,132,96,0.8)');
    strokeSmooth(b, TERRAIN.creekDry, 14, 'rgba(190,172,130,0.9)');
    const drng = makePrng(31);
    for (const [px, py] of TERRAIN.creekDry) {
      for (let i = 0; i < 6; i++) {
        b.fillStyle = 'rgba(120,105,80,0.5)';
        b.beginPath(); b.arc(px + (drng() - 0.5) * 70, py + (drng() - 0.5) * 40, 2 + drng() * 3, 0, Math.PI * 2); b.fill();
      }
    }
  } else {
    // in her mother's time the creek ran the whole way
    strokeSmooth(b, TERRAIN.creekDry, 30, '#6f9cae');
    strokeSmooth(b, TERRAIN.creekDry, 12, '#a9c6d2');
  }
  strokeSmooth(b, TERRAIN.wash, 16, 'rgba(165,150,112,0.55)', [22, 16]);
  const sp = TERRAIN.springsPond;
  paintPond(b, sp.x, sp.y, sp.r, 0.8, si, past, false);

  // the impoundment at the Bend — where they diverted the creek into a
  // bermed dredge pond. Geometry too straight to be anything but built.
  if (!past) {
    const ms = OBSTACLES.mudSink;
    const sides = 7;
    const ringPts = [];
    const rrng = makePrng(313);
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + 0.3;
      const rr2 = ms.r * (0.94 + rrng() * 0.1);
      ringPts.push([ms.x + Math.cos(a) * rr2, ms.y + Math.sin(a) * rr2 * 0.9]);
    }
    // outer berm: graded, pale, machine-made
    b.strokeStyle = '#b7a57e';
    b.lineWidth = 34;
    b.lineJoin = 'round';
    b.beginPath();
    b.moveTo(ringPts[0][0], ringPts[0][1]);
    for (let i = 1; i <= sides; i++) b.lineTo(ringPts[i % sides][0], ringPts[i % sides][1]);
    b.stroke();
    b.strokeStyle = 'rgba(90,80,60,0.5)';
    b.lineWidth = 4;
    b.stroke();
    // the sludge inside
    const mg = b.createRadialGradient(ms.x, ms.y, 12, ms.x, ms.y, ms.r);
    mg.addColorStop(0, '#3f382b'); mg.addColorStop(0.7, '#514434'); mg.addColorStop(1, '#5f5140');
    b.fillStyle = mg;
    b.beginPath();
    b.moveTo(ringPts[0][0], ringPts[0][1]);
    for (let i = 1; i <= sides; i++) b.lineTo(ringPts[i % sides][0], ringPts[i % sides][1]);
    b.closePath(); b.fill();
    b.fillStyle = 'rgba(140,150,120,0.18)';   // chemical sheen
    b.beginPath(); b.ellipse(ms.x - 40, ms.y - 30, ms.r * 0.5, ms.r * 0.3, 0.4, 0, Math.PI * 2); b.fill();
    // the discharge pipe, running in from the works to the northeast
    b.strokeStyle = '#6d6f72';
    b.lineWidth = 12;
    b.beginPath(); b.moveTo(ms.x + ms.r + 260, ms.y - 340); b.lineTo(ms.x + ms.r * 0.5, ms.y - ms.r * 0.4); b.stroke();
    b.fillStyle = '#4a4c4f';
    b.beginPath(); b.arc(ms.x + ms.r * 0.5, ms.y - ms.r * 0.4, 12, 0, Math.PI * 2); b.fill();
    // a dozer parked on the berm; warning posts around it
    b.fillStyle = '#c9a12e';
    b.fillRect(ms.x + ms.r * 0.7, ms.y + ms.r * 0.55, 44, 26);
    b.fillStyle = '#3a3d35';
    b.fillRect(ms.x + ms.r * 0.7 - 6, ms.y + ms.r * 0.55 + 20, 56, 10);
    const prng2 = makePrng(717);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = ms.x + Math.cos(a) * (ms.r + 40), py = ms.y + Math.sin(a) * (ms.r + 40) * 0.9;
      b.fillStyle = '#e8e2d0'; b.fillRect(px, py, 3, 10);
      b.fillStyle = '#d96a2b'; b.fillRect(px + 3, py, 8, 4 + prng2() * 2);
    }
    // drowned snags at the rim
    b.strokeStyle = '#3d3226';
    b.lineWidth = 4;
    for (let i = 0; i < 5; i++) {
      const a = prng2() * Math.PI * 2, r1 = ms.r * (0.3 + prng2() * 0.5);
      const sx2 = ms.x + Math.cos(a) * r1, sy2 = ms.y + Math.sin(a) * r1 * 0.85;
      b.beginPath(); b.moveTo(sx2, sy2); b.lineTo(sx2 + 10 - prng2() * 20, sy2 - 26 - prng2() * 14); b.stroke();
    }
  }

  // den hollows (all three candidate sites read as diggable ground)
  for (const site of DEN_SITES) {
    b.fillStyle = 'rgba(70,55,35,0.35)';
    b.beginPath(); b.ellipse(site.x, site.y, 42, 26, 0.3, 0, Math.PI * 2); b.fill();
    b.fillStyle = 'rgba(46,35,24,0.8)';
    b.beginPath(); b.ellipse(site.x, site.y + 4, 16, 9, 0.3, 0, Math.PI * 2); b.fill();
    b.strokeStyle = 'rgba(120,100,70,0.5)';
    b.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      b.beginPath();
      b.moveTo(site.x - 30 + i * 16, site.y + 18);
      b.lineTo(site.x - 22 + i * 16, site.y + 26);
      b.stroke();
    }
  }

  // forests: loose groves — a soft canopy shadow, then the individual trees
  // (each a real obstacle; positions shared with collision via TREES). Charred
  // east of the burn line for the rest of the year, once the fire has passed.
  for (const f of TERRAIN.forests) {
    const charred = burned && f.x > 3400 && f.y < 2400;
    b.fillStyle = charred ? 'rgba(20,18,16,0.16)' : 'rgba(35,50,30,0.11)';
    b.beginPath(); b.arc(f.x + 14, f.y + 18, f.r * 0.82, 0, Math.PI * 2); b.fill();
  }
  for (const t of TREES) {
    const charred = burned && t.x > 3400 && t.y < 2400;
    const rng = makePrng(hashStr('tdraw' + Math.round(t.x) + ',' + Math.round(t.y)));
    if (charred) {
      b.strokeStyle = '#2e2a26';
      b.lineWidth = 3;
      b.beginPath(); b.moveTo(t.x, t.y + 8); b.lineTo(t.x + (rng() - 0.5) * 8, t.y - 14 - rng() * 10); b.stroke();
      b.fillStyle = 'rgba(60,56,52,0.5)';
      b.beginPath(); b.arc(t.x, t.y, 5 + rng() * 5, 0, Math.PI * 2); b.fill();
    } else {
      drawTree(b, t.x, t.y, t.s, rng, si, past);
    }
  }
  // the wilder country beyond her bounds: apron forest
  const apr = makePrng(9911);
  for (let i = 0; i < 90; i++) {
    const x = AX + apr() * AW, y = AX + apr() * AH;
    const inWorld = x > 60 && y > 60 && x < WORLD.w - 60 && y < WORLD.h - 60;
    if (inWorld) continue;
    const r = 100 + apr() * 170;
    b.fillStyle = 'rgba(35,50,30,0.15)';
    b.beginPath(); b.arc(x + 12, y + 16, r, 0, Math.PI * 2); b.fill();
    const trees = Math.floor(r * r / 2400);
    for (let t = 0; t < trees; t++) {
      const a = apr() * Math.PI * 2, d = Math.sqrt(apr()) * r;
      const tx = x + Math.cos(a) * d;
      if (tx > 820 && tx < 1020) continue;
      drawTree(b, tx, y + Math.sin(a) * d, 11 + apr() * 15, apr, si, past);
    }
  }

  // THE ROAD — asphalt in the present; pale gravel in her mother's time.
  // It runs the full apron: cars slide in from beyond her world.
  const h = OBSTACLES.highway;
  const RY0 = -APRON, RY1 = WORLD.h + APRON;
  if (past) {
    b.fillStyle = 'rgba(190,175,140,0.9)';
    b.fillRect(h.x0 + 6, RY0, h.x1 - h.x0 - 12, RY1 - RY0);
    b.strokeStyle = 'rgba(140,125,95,0.6)';
    b.lineWidth = 3;
    for (const lx of [h.x0 + 18, h.x1 - 18]) {   // wheel ruts
      b.beginPath(); b.moveTo(lx, RY0); b.lineTo(lx, RY1); b.stroke();
    }
  } else {
    b.fillStyle = 'rgba(60,60,60,0.35)';
    b.fillRect(h.x0 - 14, RY0, h.x1 - h.x0 + 28, RY1 - RY0);  // shoulders
    const ag = b.createLinearGradient(h.x0, 0, h.x1, 0);
    ag.addColorStop(0, '#3c3f44'); ag.addColorStop(0.5, '#484b50'); ag.addColorStop(1, '#3c3f44');
    b.fillStyle = ag;
    b.fillRect(h.x0, RY0, h.x1 - h.x0, RY1 - RY0);
    b.strokeStyle = 'rgba(225,220,200,0.8)';
    b.lineWidth = 2.5;
    b.beginPath(); b.moveTo(h.x0 + 5, RY0); b.lineTo(h.x0 + 5, RY1); b.stroke();
    b.beginPath(); b.moveTo(h.x1 - 5, RY0); b.lineTo(h.x1 - 5, RY1); b.stroke();
    b.strokeStyle = 'rgba(235,205,120,0.75)';
    b.lineWidth = 3;
    b.setLineDash([34, 40]);
    b.beginPath(); b.moveTo((h.x0 + h.x1) / 2, RY0); b.lineTo((h.x0 + h.x1) / 2, RY1); b.stroke();
    b.setLineDash([]);

    // THE BRIDGE — earth carried over the road. Cars pass beneath it;
    // its deck never touches the asphalt.
    const bx0 = h.x0 - 30, bx1 = h.x1 + 30;
    // shadow cast on the asphalt at both openings
    b.fillStyle = 'rgba(0,0,0,0.35)';
    b.fillRect(h.x0, h.gapY0 - 14, h.x1 - h.x0, 14);
    b.fillRect(h.x0, h.gapY1, h.x1 - h.x0, 14);
    // abutments
    b.fillStyle = '#8e8d88';
    b.fillRect(bx0 - 8, h.gapY0 - 6, 12, h.gapY1 - h.gapY0 + 12);
    b.fillRect(bx1 - 4, h.gapY0 - 6, 12, h.gapY1 - h.gapY0 + 12);
    // the deck itself: living ground, over the road
    b.fillStyle = SEASON_GROUND[si];
    b.fillRect(bx0, h.gapY0, bx1 - bx0, h.gapY1 - h.gapY0);
    const drg = makePrng(55);
    for (let i = 0; i < 40; i++) {
      b.fillStyle = drg() > 0.5 ? 'rgba(40,55,25,0.14)' : 'rgba(235,235,205,0.12)';
      b.fillRect(bx0 + drg() * (bx1 - bx0), h.gapY0 + drg() * (h.gapY1 - h.gapY0), 3, 2);
    }
    // rails along the deck edges — the elevation line she cannot cross
    b.strokeStyle = '#4a4238';
    b.lineWidth = 4;
    b.beginPath(); b.moveTo(bx0, h.gapY0 + 2); b.lineTo(bx1, h.gapY0 + 2); b.stroke();
    b.beginPath(); b.moveTo(bx0, h.gapY1 - 2); b.lineTo(bx1, h.gapY1 - 2); b.stroke();
  }

  if (!past) {
    // construction: graded dirt, spoil, machines, stakes
    const c = obstacleRect("construction");
    b.fillStyle = '#a8905f';
    b.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
    b.strokeStyle = 'rgba(140,115,70,0.5)';
    b.lineWidth = 4;
    for (let gy = c.y0 + 16; gy < c.y1; gy += 26) {   // grader stripes
      b.beginPath(); b.moveTo(c.x0 + 8, gy); b.lineTo(c.x1 - 8, gy); b.stroke();
    }
    const prng = makePrng(88);
    for (let i = 0; i < 5; i++) {   // spoil piles
      const px = c.x0 + 40 + prng() * (c.x1 - c.x0 - 80), py = c.y0 + 40 + prng() * (c.y1 - c.y0 - 80);
      const g = b.createRadialGradient(px - 6, py - 6, 4, px, py, 26);
      g.addColorStop(0, '#c2a878'); g.addColorStop(1, '#8a7048');
      b.fillStyle = g;
      b.beginPath(); b.arc(px, py, 24 + prng() * 10, 0, Math.PI * 2); b.fill();
    }
    // an excavator, idle
    const ex = c.x0 + 120, ey = c.y0 + 300;
    b.fillStyle = 'rgba(30,30,30,0.3)';
    b.fillRect(ex - 26, ey + 20, 76, 14);
    b.fillStyle = '#3a3d35';
    b.fillRect(ex - 24, ey - 18, 30, 44);   // tracks
    b.fillStyle = '#c9a12e';
    b.fillRect(ex - 16, ey - 12, 48, 32);   // body
    b.fillRect(ex + 24, ey - 6, 52, 10);    // boom
    b.fillStyle = '#8a6f1e';
    b.fillRect(ex + 70, ey - 2, 16, 18);    // bucket
    // survey stakes with flags
    const srng = makePrng(99);
    for (let i = 0; i < 8; i++) {
      const sx = c.x0 - 60 + srng() * (c.x1 - c.x0 + 120), sy = c.y0 - 50 + srng() * (c.y1 - c.y0 + 100);
      b.fillStyle = '#e8e2d0'; b.fillRect(sx, sy, 3, 10);
      b.fillStyle = '#d96a2b'; b.fillRect(sx + 3, sy, 8, 5);
    }

    // the western clearcut: the wound that drove the western pack — a raw
    // felled patch of stumps, slash, and skid ruts, kin to the construction
    {
      const wc = obstacleRect('westCut');
      b.fillStyle = '#9c8a63';
      b.fillRect(wc.x0, wc.y0, wc.x1 - wc.x0, wc.y1 - wc.y0);
      const wrng = makePrng(57);
      // skid ruts dragged out to the east
      b.strokeStyle = 'rgba(110,90,58,0.5)'; b.lineWidth = 5;
      for (let gy = wc.y0 + 30; gy < wc.y1; gy += 40) {
        b.beginPath(); b.moveTo(wc.x0 + 10, gy); b.lineTo(wc.x1 + 60, gy - 12); b.stroke();
      }
      // stumps: pale rings on the bared ground
      for (let i = 0; i < 22; i++) {
        const sx = wc.x0 + 14 + wrng() * (wc.x1 - wc.x0 - 28);
        const sy = wc.y0 + 14 + wrng() * (wc.y1 - wc.y0 - 28);
        b.fillStyle = '#c8b487'; b.beginPath(); b.arc(sx, sy, 4 + wrng() * 3, 0, Math.PI * 2); b.fill();
        b.strokeStyle = 'rgba(90,72,44,0.6)'; b.lineWidth = 1.4;
        b.beginPath(); b.arc(sx, sy, 4 + wrng() * 3, 0, Math.PI * 2); b.stroke();
      }
      // slash piles of cut branches
      b.strokeStyle = 'rgba(70,58,38,0.55)'; b.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const px = wc.x0 + wrng() * (wc.x1 - wc.x0), py = wc.y0 + wrng() * (wc.y1 - wc.y0), a = wrng() * Math.PI;
        b.beginPath(); b.moveTo(px - Math.cos(a) * 10, py - Math.sin(a) * 10);
        b.lineTo(px + Math.cos(a) * 10, py + Math.sin(a) * 10); b.stroke();
      }
    }

    // the gravel pit: benched excavation, spoil, dust
    const gp = OBSTACLES.gravelPit;
    b.fillStyle = 'rgba(60,55,45,0.25)';
    b.fillRect(gp.x0 - 26, gp.y0 - 20, gp.x1 - gp.x0 + 52, gp.y1 - gp.y0 + 46);
    const benches = ['#b0a184', '#97876c', '#7d6f58', '#665a47'];
    for (let i = 0; i < benches.length; i++) {
      const inset = i * 26;
      b.fillStyle = benches[i];
      b.fillRect(gp.x0 + inset, gp.y0 + inset, (gp.x1 - gp.x0) - inset * 2, (gp.y1 - gp.y0) - inset * 2);
    }
    b.fillStyle = '#4f4638';
    b.fillRect(gp.x0 + 92, gp.y0 + 92, (gp.x1 - gp.x0) - 184, (gp.y1 - gp.y0) - 184);
    b.strokeStyle = 'rgba(90,80,60,0.8)';   // haul ramp
    b.lineWidth = 10;
    b.beginPath(); b.moveTo(gp.x1 - 20, gp.y0 + 20); b.lineTo(gp.x1 + 60, gp.y0 - 50); b.stroke();
    const grng = makePrng(717);
    for (let i = 0; i < 6; i++) {   // spoil piles around the rim
      const px = gp.x0 - 30 + grng() * (gp.x1 - gp.x0 + 60);
      const py = grng() > 0.5 ? gp.y0 - 26 : gp.y1 + 26;
      const g2 = b.createRadialGradient(px - 5, py - 5, 3, px, py, 20);
      g2.addColorStop(0, '#c2b28a'); g2.addColorStop(1, '#8a7a58');
      b.fillStyle = g2;
      b.beginPath(); b.arc(px, py, 16 + grng() * 8, 0, Math.PI * 2); b.fill();
    }

    // the ranch fence: posts and two runs of wire, with a worn track beside
    const fe = OBSTACLES.fence;
    const flen = Math.hypot(fe.x1 - fe.x0, fe.y1 - fe.y0);
    const fux = (fe.x1 - fe.x0) / flen, fuy = (fe.y1 - fe.y0) / flen;
    b.strokeStyle = 'rgba(120,100,70,0.35)';
    b.lineWidth = 10;
    b.beginPath(); b.moveTo(fe.x0 + fuy * 16, fe.y0 - fux * 16); b.lineTo(fe.x1 + fuy * 16, fe.y1 - fux * 16); b.stroke();
    for (const off of [2, 5]) {   // wire
      b.strokeStyle = `rgba(60,55,48,0.${7 - off})`;
      b.lineWidth = 1.4;
      b.beginPath(); b.moveTo(fe.x0, fe.y0 - off); b.lineTo(fe.x1, fe.y1 - off); b.stroke();
    }
    for (let s = 0; s <= flen; s += 64) {   // posts
      const px = fe.x0 + fux * s, py = fe.y0 + fuy * s;
      b.fillStyle = 'rgba(30,25,18,0.4)';
      b.fillRect(px + 2, py + 2, 4, 7);
      b.fillStyle = '#5d4c38';
      b.fillRect(px - 2, py - 6, 4, 10);
    }
    if (si >= 2) {   // his own squeeze: survey stakes down the wire, come autumn
      for (let s = 40; s < flen; s += 120) {
        const px = fe.x0 + fux * s - fuy * 26, py = fe.y0 + fuy * s + fux * 26;
        b.fillStyle = '#e8e2d0'; b.fillRect(px, py, 3, 9);
        b.fillStyle = '#d96a2b'; b.fillRect(px + 3, py, 7, 4);
      }
    }
    if (si === 3) {  // and in winter, a pale sign by the west end, unreadable
      b.fillStyle = '#5d4c38'; b.fillRect(fe.x0 - 8, fe.y0 + 40, 5, 26);
      b.fillStyle = '#e5e0d2'; b.fillRect(fe.x0 - 20, fe.y0 + 26, 30, 18);
    }

    // the rail line: fenced ballast wall of the far west, one trestle under
    {
      const rl = OBSTACLES.rail;
      b.fillStyle = '#8d8878';                             // ballast bed
      b.fillRect(rl.x0 - 14, AY, rl.x1 - rl.x0 + 28, AH);
      b.strokeStyle = '#4a4c50'; b.lineWidth = 3;          // the rails
      for (const rx of [rl.x0 + 14, rl.x1 - 14]) {
        b.beginPath(); b.moveTo(rx, AY); b.lineTo(rx, AY + AH); b.stroke();
      }
      b.strokeStyle = 'rgba(70,55,38,0.8)'; b.lineWidth = 2;  // ties
      for (let ty = AY + 10; ty < AY + AH; ty += 26) {
        if (ty > rl.gapY0 && ty < rl.gapY1) continue;
        b.beginPath(); b.moveTo(rl.x0 + 6, ty); b.lineTo(rl.x1 - 6, ty); b.stroke();
      }
      b.strokeStyle = 'rgba(60,58,52,0.6)'; b.lineWidth = 1.4;  // the fences
      for (const fx of [rl.x0 - 26, rl.x1 + 26]) {
        b.beginPath(); b.moveTo(fx, AY); b.lineTo(fx, rl.gapY0); b.stroke();
        b.beginPath(); b.moveTo(fx, rl.gapY1); b.lineTo(fx, AY + AH); b.stroke();
      }
      // the trestle: timber over dark passage
      b.fillStyle = 'rgba(20,22,20,0.75)';
      b.fillRect(rl.x0 - 20, rl.gapY0, rl.x1 - rl.x0 + 40, rl.gapY1 - rl.gapY0);
      b.strokeStyle = '#5d4c38'; b.lineWidth = 4;
      for (const ty of [rl.gapY0 + 8, rl.gapY1 - 8]) {
        b.beginPath(); b.moveTo(rl.x0 - 22, ty); b.lineTo(rl.x1 + 22, ty); b.stroke();
      }
    }

    // the powerline cut: forest cleared pole to pole, slash left where it fell
    {
      const pl = POWERLINE;
      const plen = Math.hypot(pl.x1 - pl.x0, pl.y1 - pl.y0);
      const pux = (pl.x1 - pl.x0) / plen, puy = (pl.y1 - pl.y0) / plen;
      b.strokeStyle = 'rgba(178,168,132,0.45)';   // the pale strip itself
      b.lineWidth = 104;
      b.beginPath(); b.moveTo(pl.x0, pl.y0); b.lineTo(pl.x1, pl.y1); b.stroke();
      const prng3 = makePrng(29);
      b.strokeStyle = 'rgba(96,82,58,0.5)';       // slash piles
      b.lineWidth = 3;
      for (let s = 12; s < plen; s += 26) {
        const off = (prng3() - 0.5) * 88;
        const sx = pl.x0 + pux * s - puy * off, sy = pl.y0 + puy * s + pux * off;
        const a2 = prng3() * Math.PI;
        b.beginPath(); b.moveTo(sx - Math.cos(a2) * 9, sy - Math.sin(a2) * 9);
        b.lineTo(sx + Math.cos(a2) * 9, sy + Math.sin(a2) * 9); b.stroke();
      }
      for (let s = 60; s < plen; s += 210) {      // pylons, marching
        const px = pl.x0 + pux * s, py = pl.y0 + puy * s;
        b.fillStyle = 'rgba(20,20,20,0.3)';
        b.fillRect(px - 12, py + 4, 26, 8);
        b.strokeStyle = '#4c4f52'; b.lineWidth = 2.6;
        b.beginPath();
        b.moveTo(px - 11, py + 8); b.lineTo(px - 3, py - 30);
        b.moveTo(px + 11, py + 8); b.lineTo(px + 3, py - 30);
        b.moveTo(px - 14, py - 20); b.lineTo(px + 14, py - 20);
        b.moveTo(px - 10, py - 28); b.lineTo(px + 10, py - 28);
        b.stroke();
      }
      b.strokeStyle = 'rgba(40,42,46,0.5)';       // the wires between them
      b.lineWidth = 1.2;
      for (const drop of [-26, -24]) {
        b.beginPath();
        for (let s = 60; s + 210 < plen + 210; s += 210) {
          const ax = pl.x0 + pux * s, ay = pl.y0 + puy * s + drop;
          const bx2 = pl.x0 + pux * Math.min(s + 210, plen), by2 = pl.y0 + puy * Math.min(s + 210, plen) + drop;
          b.moveTo(ax, ay);
          b.quadraticCurveTo((ax + bx2) / 2, (ay + by2) / 2 + 12, bx2, by2);
        }
        b.stroke();
      }
    }

    // the homestead: house, porch, barn, corral
    const rh = RANCH.house;
    b.fillStyle = 'rgba(30,30,30,0.3)';
    b.fillRect(rh.x - 34, rh.y - 22, 78, 58);
    b.fillStyle = '#8a5f47'; b.fillRect(rh.x - 40, rh.y - 30, 80, 30);   // roof A
    b.fillStyle = '#9c6e52'; b.fillRect(rh.x - 40, rh.y, 80, 26);        // roof B
    b.strokeStyle = 'rgba(40,25,20,0.7)'; b.lineWidth = 2;
    b.beginPath(); b.moveTo(rh.x - 40, rh.y); b.lineTo(rh.x + 40, rh.y); b.stroke();
    b.fillStyle = '#d9c9a0'; b.fillRect(rh.x - 46, rh.y + 26, 92, 10);   // porch
    b.fillStyle = '#7d3b30';                                              // the barn
    b.fillRect(rh.x + 80, rh.y + 40, 54, 44);
    b.fillStyle = '#93483a'; b.fillRect(rh.x + 76, rh.y + 34, 62, 16);
    b.strokeStyle = '#6a5137'; b.lineWidth = 3;                           // corral
    b.strokeRect(rh.x - 20, rh.y + 70, 90, 60);

    // subdivision: street, houses with gabled roofs, fences
    const sub = OBSTACLES.subdivision;
    b.fillStyle = '#9aa07c';
    b.fillRect(sub.x0, sub.y0, sub.x1 - sub.x0, sub.y1 - sub.y0);
    if (si >= 2) {   // by autumn a second row stands framed north of the first
      for (let k = 0; k < 5; k++) {
        const hx = sub.x0 + 70 + k * 110, hy = sub.y0 - 46;
        b.fillStyle = '#8b8578';
        b.fillRect(hx - 26, hy - 12, 52, 24);
        b.fillStyle = '#6e5a44';
        b.beginPath(); b.moveTo(hx - 30, hy - 10); b.lineTo(hx, hy - 32); b.lineTo(hx + 30, hy - 10); b.closePath(); b.fill();
      }
    }
    b.strokeStyle = '#b9b3a2'; b.lineWidth = 3;
    b.strokeRect(sub.x0 + 4, sub.y0 + 4, sub.x1 - sub.x0 - 8, sub.y1 - sub.y0 - 8);
    b.fillStyle = '#7e7f82';
    b.fillRect(sub.x0 + 30, sub.y0 + (sub.y1 - sub.y0) / 2 - 14, sub.x1 - sub.x0 - 60, 28);  // street
    let hcount = 0;
    for (let rx = sub.x0 + 40; rx < sub.x1 - 100; rx += 96) {
      for (const ry of [sub.y0 + 40, sub.y1 - 110]) {
        hcount++;
        b.fillStyle = 'rgba(30,30,30,0.25)';
        b.fillRect(rx + 6, ry + 8, 64, 52);
        b.fillStyle = hcount % 2 ? '#8a4f3d' : '#71554a';    // roof planes
        b.fillRect(rx, ry, 60, 24);
        b.fillStyle = hcount % 2 ? '#a05d47' : '#836357';
        b.fillRect(rx, ry + 24, 60, 24);
        b.strokeStyle = 'rgba(40,25,20,0.6)'; b.lineWidth = 2;
        b.beginPath(); b.moveTo(rx, ry + 24); b.lineTo(rx + 60, ry + 24); b.stroke();  // ridgeline
        b.fillStyle = '#5a4a42'; b.fillRect(rx + 44, ry + 4, 8, 8);  // chimney
        b.fillStyle = '#9a9a94'; b.fillRect(rx + 22, ry + 48, 16, 18); // drive
      }
    }
  }
}

function drawTree(b, x, y, r, frng, si, past) {
  const conifer = frng() > 0.3;
  b.fillStyle = 'rgba(30,45,25,0.25)';
  b.beginPath(); b.ellipse(x + r * 0.5, y + r * 0.6, r * 1.05, r * 0.6, 0, 0, Math.PI * 2); b.fill();
  if (!conifer && si === 3 && !past) {
    // bare deciduous in winter
    b.strokeStyle = '#5b4a3a'; b.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = frng() * Math.PI * 2;
      b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); b.stroke();
    }
    return;
  }
  const tone = past ? SEASON_FOREST[0] : SEASON_FOREST[si];
  const g = b.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.15, x, y, r);
  g.addColorStop(0, conifer ? lightenTone(tone, 20) : lightenTone(tone, 34));
  g.addColorStop(1, darkenTone(tone, 22));
  b.fillStyle = g;
  b.beginPath();
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr2 = r * (0.85 + frng() * 0.3);
    const px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2;
    if (i === 0) b.moveTo(px, py); else b.lineTo(px, py);
  }
  b.closePath(); b.fill();
  if (si === 3 && !past) {
    b.fillStyle = 'rgba(255,255,255,0.55)';
    b.beginPath(); b.arc(x - r * 0.2, y - r * 0.25, r * 0.5, 0, Math.PI * 2); b.fill();
  }
}

function lightenTone(hex, amt) { return shiftTone(hex, amt); }
function darkenTone(hex, amt) { return shiftTone(hex, -amt); }
function shiftTone(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), bl = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${bl})`;
}
// helpers kept only for the ponds' water rendering (the one art the rest of
// this file's revert preserves)
const LIGHT = { x: -0.62, y: -0.78 };
function toRGB(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixTone(a, b, t) {
  const A = toRGB(a), B = toRGB(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}

// ── creatures ────────────────────────────────────────────────────────────────

function drawWolfBody(x, y, heading, size, tone, moving, gait, limp) {
  ctx.fillStyle = 'rgba(20,25,15,0.28)';
  ctx.beginPath(); ctx.ellipse(x + 4, y + 6, size * 2.1, size * 1.0, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  if (!moving) ctx.scale(1, 1 + 0.02 * Math.sin(S.time * 2.2 + size));

  const ph = gait * 0.085;
  const stride = moving ? size * 0.5 : 0;
  // legs, trotting in diagonal pairs
  const legs = [
    [0.85, 0.5, 0], [0.85, -0.5, Math.PI], [-0.75, 0.5, Math.PI], [-0.75, -0.5, 0],
  ];
  for (let i = 0; i < 4; i++) {
    const [lx, ly, off] = legs[i];
    let st = stride;
    if (limp && i === 0) st *= 0.35;   // the hurt foreleg barely swings
    const px = lx * size + Math.sin(ph + off) * st;
    ctx.strokeStyle = tone.dark;
    ctx.lineWidth = size * 0.28;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lx * size * 0.55, ly * size * 0.55);
    ctx.lineTo(px, ly * size * 0.95);
    ctx.stroke();
    ctx.fillStyle = tone.dark;
    ctx.beginPath(); ctx.arc(px, ly * size * 0.95, size * 0.15, 0, Math.PI * 2); ctx.fill();
  }
  // tail, swaying
  const sway = Math.sin(S.time * 2.6 + ph * 0.4) * size * (moving ? 0.5 : 0.22);
  ctx.strokeStyle = tone.base;
  ctx.lineCap = 'round';
  ctx.lineWidth = size * 0.5;
  ctx.beginPath();
  ctx.moveTo(-size * 1.2, 0);
  ctx.quadraticCurveTo(-size * 1.8, sway * 0.5, -size * 2.25, sway);
  ctx.stroke();
  ctx.strokeStyle = tone.dark;
  ctx.lineWidth = size * 0.26;
  ctx.beginPath();
  ctx.moveTo(-size * 1.6, sway * 0.3);
  ctx.quadraticCurveTo(-size * 1.95, sway * 0.7, -size * 2.3, sway);
  ctx.stroke();
  // body: hips + chest
  ctx.fillStyle = tone.base;
  ctx.beginPath(); ctx.ellipse(-size * 0.55, 0, size * 0.95, size * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(size * 0.3, 0, size * 1.0, size * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  // light flanks
  ctx.fillStyle = tone.light;
  ctx.globalAlpha = 0.4;
  ctx.beginPath(); ctx.ellipse(size * 0.2, 0, size * 0.8, size * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // dorsal stripe
  ctx.fillStyle = tone.dark;
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.ellipse(-size * 0.1, 0, size * 1.1, size * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // neck + head
  ctx.fillStyle = tone.base;
  ctx.beginPath(); ctx.ellipse(size * 0.95, 0, size * 0.55, size * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(size * 1.45, 0, size * 0.52, size * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  // muzzle + nose
  ctx.fillStyle = tone.light;
  ctx.beginPath(); ctx.ellipse(size * 1.95, 0, size * 0.32, size * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a18';
  ctx.beginPath(); ctx.arc(size * 2.2, 0, size * 0.1, 0, Math.PI * 2); ctx.fill();
  // ears
  ctx.fillStyle = tone.dark;
  for (const sgn of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(size * 1.2, sgn * size * 0.16);
    ctx.lineTo(size * 1.05, sgn * size * 0.5);
    ctx.lineTo(size * 1.42, sgn * size * 0.38);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Willow lying in the den — breathing, until she isn't.
function drawWillowLying(w) {
  const tone = w.alive ? WOLF_TONES.willow : WOLF_TONES.willowDead;
  const size = 13;
  ctx.fillStyle = 'rgba(20,25,15,0.3)';
  ctx.beginPath(); ctx.ellipse(w.x + 3, w.y + 5, size * 2.3, size * 1.3, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.rotate(0.25);
  const breath = w.alive ? 1 + 0.035 * Math.sin(S.time * 1.4) : 1;
  ctx.scale(1, breath);
  ctx.fillStyle = tone.base;
  ctx.beginPath(); ctx.ellipse(0, 0, size * 1.9, size * 1.0, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = tone.dark;
  ctx.globalAlpha = 0.45;
  ctx.beginPath(); ctx.ellipse(-size * 0.2, -size * 0.2, size * 1.5, size * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // head tucked toward her flank
  ctx.fillStyle = tone.base;
  ctx.beginPath(); ctx.ellipse(size * 1.5, size * 0.4, size * 0.55, size * 0.42, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = tone.light;
  ctx.beginPath(); ctx.ellipse(size * 1.85, size * 0.65, size * 0.3, size * 0.18, 0.5, 0, Math.PI * 2); ctx.fill();
  // tail curled
  ctx.strokeStyle = tone.dark;
  ctx.lineWidth = size * 0.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-size * 1.6, size * 0.3);
  ctx.quadraticCurveTo(-size * 2.2, size * 0.9, -size * 1.4, size * 1.2);
  ctx.stroke();
  ctx.restore();
}

function drawPrey(e) {
  const H = HERDS[e.herd];
  const tone = HERD_TONES[e.herd];
  const s = H.size;
  ctx.fillStyle = 'rgba(20,25,15,0.25)';
  ctx.beginPath(); ctx.ellipse(e.x + 4, e.y + 6, s * 1.9, s * 0.95, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.heading);
  const ph = e.gait * 0.07;
  const moving = e.fleeing || e.gait % 1 > 0;   // legs settle when grazing
  const stride = e.fleeing ? s * 0.7 : s * 0.2;
  for (let i = 0; i < 4; i++) {
    const lx = i < 2 ? s * 0.75 : -s * 0.7;
    const ly = (i % 2 ? 1 : -1) * s * 0.42;
    const off = (i === 0 || i === 3) ? 0 : Math.PI;
    ctx.strokeStyle = tone.dark;
    ctx.lineWidth = s * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lx * 0.7, ly * 0.7);
    ctx.lineTo(lx + Math.sin(ph + off) * stride, ly * 1.15);
    ctx.stroke();
  }
  ctx.fillStyle = tone.body;
  ctx.beginPath(); ctx.ellipse(-s * 0.1, 0, s * 1.15, s * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = tone.rump;
  ctx.beginPath(); ctx.ellipse(-s * 0.95, 0, s * 0.34, s * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  // neck + head, dipping when grazing
  const grazeDip = e.fleeing ? 0 : 0.25 + 0.2 * Math.sin(S.time * 0.6 + s);
  ctx.fillStyle = tone.body;
  ctx.beginPath(); ctx.ellipse(s * 0.9, 0, s * 0.5, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s * (1.35 - grazeDip * 0.2), 0, s * 0.34, s * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = tone.dark;
  ctx.beginPath(); ctx.arc(s * (1.62 - grazeDip * 0.2), 0, s * 0.1, 0, Math.PI * 2); ctx.fill();
  if (e.bull) {
    ctx.strokeStyle = tone.dark;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (const sgn of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(s * 1.2, sgn * s * 0.14);
      ctx.quadraticCurveTo(s * 0.7, sgn * s * 0.65, s * 0.2, sgn * s * 0.8);
      ctx.stroke();
      for (let tine = 0; tine < 3; tine++) {
        const tx = s * (0.95 - tine * 0.28);
        ctx.beginPath();
        ctx.moveTo(tx, sgn * s * (0.34 + tine * 0.13));
        ctx.lineTo(tx - s * 0.1, sgn * s * (0.6 + tine * 0.15));
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawCar(car) {
  const w = car.truck ? 34 : 26, l = car.truck ? 96 : 58;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.fillStyle = 'rgba(10,10,10,0.3)';
  ctx.fillRect(-w / 2 + 3, -l / 2 + 4, w, l);
  ctx.fillStyle = car.tone;
  rr(ctx, -w / 2, -l / 2, w, l, 6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  rr(ctx, -w / 2 + 3, -l / 2 + 3, w - 6, l - 6, 4); ctx.fill();
  ctx.fillStyle = 'rgba(20,26,34,0.85)';
  const wsY = car.vy > 0 ? l / 2 - 20 : -l / 2 + 12;
  ctx.fillRect(-w / 2 + 4, wsY, w - 8, 8);
  const front = car.vy > 0 ? l / 2 - 4 : -l / 2;
  ctx.fillStyle = 'rgba(255,240,180,0.95)';
  ctx.fillRect(-w / 2 + 3, front, 7, 4);
  ctx.fillRect(w / 2 - 10, front, 7, 4);
  // headlight cones at night
  const dl = daylight();
  if (dl < 0.55) {
    ctx.globalAlpha = (0.55 - dl) * 0.5;
    ctx.fillStyle = 'rgba(255,240,190,0.8)';
    const dir = car.vy > 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 6, dir * l / 2);
    ctx.lineTo(-w / 2 - 8, dir * (l / 2 + 130));
    ctx.lineTo(w / 2 + 8, dir * (l / 2 + 130));
    ctx.lineTo(w / 2 - 6, dir * l / 2);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ── light and weather ────────────────────────────────────────────────────────

function daylight() {
  if (S.era === 'past') return 1;    // the prologue is one golden morning
  // light runs on its own slow cycle (~75 real seconds per visual day),
  // not the 5-second calendar — and it keeps moving while a task holds
  // the days still
  const m = (S.time * (1440 / 75)) % 1440;
  if (m < 270) return 0.1;
  if (m < 420) return 0.1 + (m - 270) / 150 * 0.9;
  if (m < 1080) return 1;
  if (m < 1230) return 1 - (m - 1080) / 150 * 0.9;
  return 0.1;
}

function drawLightAndAir() {
  resetTransform();
  const dl = daylight();
  // days are 5 seconds long now: night is a suggestion, never a strobe
  if (dl < 1) {
    ctx.fillStyle = `rgba(13,22,38,${(1 - dl) * 0.10})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const warm = dl > 0.15 && dl < 0.95 ? (1 - Math.abs(2 * ((dl - 0.15) / 0.8) - 1)) : 0;
  if (warm > 0) {
    ctx.fillStyle = `rgba(255,150,60,${warm * 0.04})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (S.era === 'past' || S.vistaT > 0) {
    ctx.fillStyle = `rgba(255,180,90,${S.era === 'past' ? 0.10 : 0.14})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // the drought: summer bakes toward straw until the lightning comes
  if (S.era !== 'past' && S.fire && S.fire.state === 'none' && seasonIndex() === 1) {
    const dr = clamp((day() - 91) / Math.max(1, (S.fire.day || 130) - 91), 0, 1);
    ctx.fillStyle = `rgba(214,190,120,${dr * 0.08})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // weather, unmistakably: a grey ceiling with drifting cloud shadows, or
  // real rain — sheets of it
  if (S.weather && S.era !== 'past') {
    if (S.weather.kind === 'cloud') {
      ctx.fillStyle = 'rgba(116,122,128,0.20)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const crng = makePrng(31);
      ctx.fillStyle = 'rgba(60,66,74,0.10)';
      for (let i = 0; i < 5; i++) {
        const bx = crng() * canvas.width, by = crng() * canvas.height;
        const x = ((bx + S.time * (14 + crng() * 10)) % (canvas.width + 700)) - 350;
        ctx.beginPath();
        ctx.ellipse(x, by, 320 + crng() * 200, 150 + crng() * 90, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (S.weather.kind === 'rain') {
      ctx.fillStyle = 'rgba(36,46,60,0.24)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(205,220,230,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const rrng = makePrng(47);
      for (let i = 0; i < 150; i++) {
        const bx = rrng() * canvas.width, by = rrng() * canvas.height, spd = 700 + rrng() * 300;
        const y = (by + S.time * spd) % canvas.height;
        const x = (bx - (y - by) * 0.18 % canvas.width + canvas.width) % canvas.width;
        ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 16);
      }
      ctx.stroke();
    }
  }
  // vignette, cached per canvas size
  if (!drawLightAndAir._vg || drawLightAndAir._key !== canvas.width + 'x' + canvas.height) {
    drawLightAndAir._key = canvas.width + 'x' + canvas.height;
    const vg = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.45,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(10,14,8,0.26)');
    drawLightAndAir._vg = vg;
  }
  ctx.fillStyle = drawLightAndAir._vg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

let weatherParts = [], weatherLastT = 0;
function drawWeather() {
  const si = seasonIndex();
  if (S.era === 'past') { weatherParts.length = 0; return; }
  const dtp = clamp(S.time - weatherLastT, 0, 0.1);
  weatherLastT = S.time;
  const want = si === 3 ? 70 : si === 2 ? 26 : si === 0 ? 10 : 0;
  while (weatherParts.length < want) {
    weatherParts.push({
      x: Math.random() * canvas.width, y: -10 - Math.random() * 60,
      vx: -14 - Math.random() * 20, vy: si === 3 ? 46 + Math.random() * 44 : 24 + Math.random() * 20,
      rot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 3,
      size: si === 3 ? 1.4 + Math.random() * 1.8 : 3 + Math.random() * 3,
    });
  }
  if (weatherParts.length > want) weatherParts.length = want;
  resetTransform();
  for (const p of weatherParts) {
    p.x += (p.vx + Math.sin(S.time * 1.3 + p.rot) * 10) * dtp;
    p.y += p.vy * dtp;
    p.rot += p.spin * dtp;
    if (p.y > canvas.height + 12) { p.y = -10; p.x = Math.random() * canvas.width; }
    if (p.x < -12) p.x = canvas.width + 10;
    if (si === 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    } else if (si === 2) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = 'rgba(178,102,40,0.8)';
      ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(245,240,225,0.6)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ── the world ────────────────────────────────────────────────────────────────

function drawWorld() {
  const key = S.era + '|' + (S.era === 'past' ? 0 : seasonIndex()) + '|'
    + (S.era !== 'past' && S.fire && S.fire.state === 'done');
  if (!baseLayer || baseKey !== key) buildBaseLayer();

  resetTransform();
  ctx.fillStyle = '#22261f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  applyCamera();
  // blit only the visible slice of the terrain (from the half-res layer)
  const vw = canvas.width / S.cam.scale, vh = canvas.height / S.cam.scale;
  const wx0 = Math.max((WORLD.x0 || 0) - APRON, S.cam.x - vw / 2 - 60);
  const wy0 = Math.max(-APRON, S.cam.y - vh / 2 - 60);
  const wx1 = Math.min(WORLD.w + APRON, S.cam.x + vw / 2 + 60);
  const wy1 = Math.min(WORLD.h + APRON, S.cam.y + vh / 2 + 60);
  if (wx1 > wx0 && wy1 > wy0) {
    ctx.drawImage(baseLayer,
      (wx0 + APRON - (WORLD.x0 || 0)) * BASE_SCALE, (wy0 + APRON) * BASE_SCALE,
      (wx1 - wx0) * BASE_SCALE, (wy1 - wy0) * BASE_SCALE,
      wx0, wy0, wx1 - wx0, wy1 - wy0);
  }

  // living water glints
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < TERRAIN.creekFlow.length - 1; i++) {
    const [ax, ay] = TERRAIN.creekFlow[i];
    const ph = Math.sin(S.time * 2 + i * 1.7);
    if (ph > 0.4) {
      ctx.globalAlpha = (ph - 0.4) * 0.6;
      ctx.beginPath(); ctx.ellipse(ax + ph * 8, ay + 20, 8, 2, 0.3, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // the way she has in mind stays with her on the land until she arrives
  if (S.routePath && S.routePath.length > 1 && S.mode === 'play') {
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.12 * Math.sin(S.time * 2);
    ctx.lineDashOffset = -S.time * 50;
    for (let i = 1; i < S.routePath.length; i++) {
      // follow the drawn edge's own curve (or a found short-way around a tear),
      // not a straight chord between centres
      strokePolyline(ctx, routeLegPoly(S.routePath[i - 1], S.routePath[i]), 7, 'rgba(78,122,140,0.75)', [26, 22]);
    }
    ctx.lineDashOffset = 0;
    const t = routeTargetPos();
    if (t) {
      // the last leg, off the known ink and out to the destination itself
      const last = NbyId.get(S.routePath[S.routePath.length - 1]);
      if (dist(last.x, last.y, t.x, t.y) > 40) {
        strokePolyline(ctx, [[last.x, last.y], [t.x, t.y]], 5, 'rgba(78,122,140,0.55)', [10, 14]);
      }
      const pulse = 0.5 + 0.5 * Math.sin(S.time * 3);
      ctx.globalAlpha = 0.5 + 0.35 * pulse;
      ctx.strokeStyle = 'rgba(78,122,140,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(t.x, t.y, 28 + pulse * 10, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // the chosen den: trampled, home
  if (S.denSite) {
    ctx.strokeStyle = 'rgba(90,70,50,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(S.denSite.x, S.denSite.y, 56, 0, Math.PI * 2); ctx.stroke();
  }

  for (const car of S.cars) {
    // near the bridge, cars slide smoothly under the deck: everything the
    // deck covers is clipped away, nose first, tail last
    const h = OBSTACLES.highway;
    const nearDeck = S.era !== 'past' && car.y > h.gapY0 - 220 && car.y < h.gapY1 + 220;
    if (!nearDeck) { drawCar(car); continue; }
    ctx.save();
    ctx.beginPath();
    const n0 = car.y - 220, n1 = Math.min(h.gapY0, car.y + 220);
    if (n1 > n0) ctx.rect(car.x - 70, n0, 140, n1 - n0);
    const s0 = Math.max(h.gapY1, car.y - 220), s1 = car.y + 220;
    if (s1 > s0) ctx.rect(car.x - 70, s0, 140, s1 - s0);
    ctx.clip();
    drawCar(car);
    ctx.restore();
  }

  // the overpass, once open: an earth band over the asphalt — drawn after
  // the cars so the traffic passes beneath it
  if (overpassOpen()) {
    const h = OBSTACLES.highway, o = OBSTACLES.overpass;
    const x0 = h.x0 - 26, x1 = h.x1 + 26;
    // the road runs on UNDER the bridge: a dark asphalt strip through the
    // deck's shadow, so the black scar of the highway is never severed
    ctx.fillStyle = 'rgba(24,24,26,0.9)';
    ctx.fillRect(h.x0, o.y0, h.x1 - h.x0, o.y1 - o.y0);
    // cast shadows where the deck overhangs the road, north and south edges
    const sN = ctx.createLinearGradient(0, o.y0 - 26, 0, o.y0);
    sN.addColorStop(0, 'rgba(20,20,22,0)'); sN.addColorStop(1, 'rgba(20,20,22,0.55)');
    ctx.fillStyle = sN; ctx.fillRect(h.x0, o.y0 - 26, h.x1 - h.x0, 26);
    const sS = ctx.createLinearGradient(0, o.y1, 0, o.y1 + 26);
    sS.addColorStop(0, 'rgba(20,20,22,0.55)'); sS.addColorStop(1, 'rgba(20,20,22,0)');
    ctx.fillStyle = sS; ctx.fillRect(h.x0, o.y1, h.x1 - h.x0, 26);
    ctx.fillStyle = 'rgba(30,30,26,0.35)';
    ctx.fillRect(x0 - 6, o.y0 + 4, x1 - x0 + 12, o.y1 - o.y0);
    const g = ctx.createLinearGradient(0, o.y0, 0, o.y1);
    g.addColorStop(0, '#5d6647'); g.addColorStop(0.5, '#6b7350'); g.addColorStop(1, '#575f43');
    ctx.fillStyle = g;
    ctx.fillRect(x0, o.y0, x1 - x0, o.y1 - o.y0);
    ctx.fillStyle = '#8b8578';
    ctx.fillRect(x0, o.y0 - 4, x1 - x0, 5);
    ctx.fillRect(x0, o.y1 - 1, x1 - x0, 5);
    const rng = makePrng(83);
    for (let i = 0; i < 26; i++) {
      const sx = x0 + 8 + rng() * (x1 - x0 - 16);
      const sy = o.y0 + 10 + rng() * (o.y1 - o.y0 - 20);
      ctx.fillStyle = `rgba(${Math.round(52 + rng() * 24)},${Math.round(66 + rng() * 22)},${Math.round(38 + rng() * 14)},0.85)`;
      ctx.beginPath(); ctx.arc(sx, sy, 3 + rng() * 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // (ponds live in the terrain base layer now — no overlay rings)

  // snares: near-invisible stakes and a wire glint by the fence
  if (S.snares) {
    for (const sn of S.snares) {
      if (sn.sprung) continue;
      ctx.fillStyle = 'rgba(70,58,40,0.8)';
      ctx.fillRect(sn.x - 2, sn.y - 5, 4, 7);
      ctx.strokeStyle = `rgba(220,225,230,${0.25 + 0.2 * Math.sin(S.time * 3 + sn.x)})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sn.x, sn.y + 3, 8, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // roadkill on the shoulder, with its low attendants
  if (S.roadkill) {
    const rk = S.roadkill;
    ctx.fillStyle = 'rgba(96,50,40,0.75)';
    ctx.beginPath(); ctx.ellipse(rk.x, rk.y, 13, 6, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(25,22,20,0.8)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 2; i++) {
      const bx = rk.x + Math.cos(S.time * 1.1 + i * 3) * 22;
      const by2 = rk.y - 26 - i * 14 + Math.sin(S.time * 1.7 + i) * 5;
      ctx.beginPath();
      ctx.moveTo(bx - 6, by2 - 2); ctx.quadraticCurveTo(bx, by2 + 2, bx + 6, by2 - 2);
      ctx.stroke();
    }
  }

  // trains: long, indifferent, and faster than anything alive
  if (S.trains && S.trains.length) {
    const rl = OBSTACLES.rail;
    const tcx = (rl.x0 + rl.x1) / 2;
    for (const t of S.trains) {
      const dir = Math.sign(t.vy);
      for (let c = 0; c < 9; c++) {
        const top = dir > 0 ? t.y - c * 150 - 140 : t.y + c * 150;
        ctx.fillStyle = 'rgba(10,10,10,0.3)';
        ctx.fillRect(tcx - 30, top + 8, 60, 140);
        ctx.fillStyle = c === 0 ? '#33383e' : (c % 2 ? '#5a4a42' : '#474f4c');
        ctx.fillRect(tcx - 26, top, 52, 140);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(tcx - 26, top, 10, 140);
      }
    }
  }

  // the gift is findable from far: a raven column stands tall over the
  // fence line until the gut pile is claimed
  if (S.gift && S.gift.given && !S.gift.taken && S.era !== 'past') {
    const gs = RANCH.giftSpot;
    ctx.fillStyle = 'rgba(90,45,35,0.5)';
    ctx.beginPath(); ctx.ellipse(gs.x, gs.y + 4, 14, 7, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(25,22,20,0.85)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const ph = i * 1.9, hgt = 60 + i * 70;
      const bx = gs.x + Math.cos(S.time * (0.7 + i * 0.07) + ph) * (26 + i * 9);
      const by = gs.y - hgt + Math.sin(S.time * 1.3 + ph) * 8;
      const s = 7 + (i % 3) * 2;
      const flap = Math.sin(S.time * 6 + ph) * 0.35;
      ctx.beginPath();
      ctx.moveTo(bx - s, by - s * (0.35 + flap));
      ctx.quadraticCurveTo(bx, by + s * 0.2, bx, by);
      ctx.quadraticCurveTo(bx, by + s * 0.2, bx + s, by - s * (0.35 + flap));
      ctx.stroke();
    }
  }
  for (const e of S.elk) drawPrey(e);

  // pups at the den, tumbling
  if (S.pups && !S.pups.traveling && S.pups.count > 0 && S.denSite) {
    for (let i = 0; i < S.pups.count; i++) {
      const a = S.time * (0.5 + i * 0.23) + i * 2.6;
      const px = S.denSite.x + Math.cos(a) * (26 + 10 * Math.sin(S.time * 0.7 + i));
      const py = S.denSite.y + Math.sin(a) * (20 + 8 * Math.cos(S.time * 0.9 + i));
      drawWolfBody(px, py, a + Math.PI / 2, 5.5, WOLF_TONES.pup, true, S.time * 60 + i * 40, false);
    }
  }

  // the gut pile by the wire, while it lasts
  if (S.gift && S.gift.given && !S.gift.taken) {
    const gs = RANCH.giftSpot;
    ctx.fillStyle = '#5d3a2e';
    ctx.beginPath(); ctx.ellipse(gs.x, gs.y, 14, 9, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(140,60,40,0.6)';
    ctx.beginPath(); ctx.ellipse(gs.x - 4, gs.y - 2, 7, 4, 0.4, 0, Math.PI * 2); ctx.fill();
  }

  // the rancher's dogs
  if (S.dogs && S.era !== 'past') {
    for (const dog of S.dogs) {
      drawWolfBody(dog.x, dog.y, dog.heading, 8, DOG_TONES, dog.moving, dog.gait, false);
    }
  }

  // rivals, when a standoff is live (eastern pack)
  if (S.standoff) {
    for (const rv of S.standoff.rivals) {
      drawWolfBody(rv.x, rv.y, rv.heading, 10.5, RIVAL_TONES, rv.moving, rv.gait, false);
    }
  }

  // the western pack's wolves, pacing at the fog edge from sighting on
  if (S.westRivals && S.westRivals.length) {
    for (const rv of S.westRivals) {
      drawWolfBody(rv.x, rv.y, rv.heading, 10.5, RIVAL_TONES, rv.moving, rv.gait, false);
    }
  }

  // the pack, then Willow, then Aspen
  for (const w of S.pack) {
    if (w.state === 'dead' || w.state === 'gone') continue;
    const tone = WOLF_TONES[w.pup ? 'pup' : w.id] || WOLF_TONES.fen;
    drawWolfBody(w.x, w.y, w.heading || 0, w.pup ? 6.5 : (w.id === 'bram' ? 11 : 10), tone, w.moving, w.gait || 0, false);
    if (w.state === 'balk') {
      const p = screenPos(w.x, w.y);
      resetTransform();
      ctx.font = `bold 16px ${FONT}`;
      ctx.fillStyle = '#7a2f1a';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('!', p.x, p.y - 22);
      applyCamera();
    }
  }
  if (S.willow) {
    if (S.willow.lying) drawWillowLying(S.willow);
    else drawWolfBody(S.willow.x, S.willow.y, S.willow.heading, 13,
      WOLF_TONES.willow, S.willow.moving, S.willow.gait, false);
  }
  drawWolfBody(S.wolf.x, S.wolf.y, S.wolf.heading, 11, WOLF_TONES.aspen,
    S.wolf.moving, S.wolf.gait, isInjured());

  drawPrologueWorldBits();

  // the soft chevron: where to look, when the land won't say. Kept small and
  // close to her so it never sails off the edge of the close-in camera.
  if (S.guide) {
    const a = Math.atan2(S.guide.y - S.wolf.y, S.guide.x - S.wolf.x);
    const gx = S.wolf.x + Math.cos(a) * 104, gy = S.wolf.y + Math.sin(a) * 104;
    const pulse = 0.55 + 0.45 * Math.sin(S.time * 3);
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(a);
    ctx.globalAlpha = 0.5 + 0.3 * pulse;
    ctx.strokeStyle = 'rgba(255,214,140,0.95)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const off of [0, -12]) {
      ctx.beginPath();
      ctx.moveTo(off - 8, -11);
      ctx.lineTo(off + 5, 0);
      ctx.lineTo(off - 8, 11);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // the prologue "look here" marker: a soft ring drawn AROUND the introduced
  // creature (just a circle, no arrow), or an edge chevron toward it if it has
  // drifted off the close-in camera
  if (S.pointAt) {
    const halfW = (canvas.width / 2) / S.cam.scale;
    const halfH = (canvas.height / 2) / S.cam.scale;
    const onScreen = Math.abs(S.pointAt.x - S.cam.x) < halfW - 40
                  && Math.abs(S.pointAt.y - S.cam.y) < halfH - 40;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,224,150,0.95)';
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (onScreen) {
      const pulse = Math.sin(S.time * 3);
      ctx.globalAlpha = 0.6 + 0.2 * pulse;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(S.pointAt.x, S.pointAt.y, 32 + 4 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const a = Math.atan2(S.pointAt.y - S.wolf.y, S.pointAt.x - S.wolf.x);
      ctx.translate(S.wolf.x + Math.cos(a) * 150, S.wolf.y + Math.sin(a) * 150);
      ctx.rotate(a);
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 5;
      for (const off of [0, -16]) {
        ctx.beginPath();
        ctx.moveTo(off - 10, -14);
        ctx.lineTo(off + 6, 0);
        ctx.lineTo(off - 10, 14);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // landmark names, when close — the land teaches its own geography
  resetTransform();
  for (const n of NODES) {
    if (dist(S.wolf.x, S.wolf.y, n.x, n.y) < 150) {
      const p = screenPos(n.x, n.y);
      ctx.font = `italic 13px ${FONT}`;
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
      ctx.fillStyle = 'rgba(245,240,225,0.92)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(n.name, p.x, p.y - 12);
      ctx.shadowBlur = 0;
    }
  }
  // den sites announce themselves while the choice is open
  if (!S.denId && S.mode === 'play') {
    for (const site of DEN_SITES) {
      if (dist(S.wolf.x, S.wolf.y, site.x, site.y) < 170) {
        const p = screenPos(site.x, site.y);
        ctx.font = `italic 12px ${FONT}`;
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
        ctx.fillStyle = 'rgba(240,228,200,0.95)';
        ctx.textAlign = 'center';
        ctx.fillText(site.name + ' — stay a while to make it home', p.x, p.y + 34);
        ctx.shadowBlur = 0;
      }
    }
  }

  // the silence zone answering her: window light, house by house
  if (S.alarm > 0.35 && S.era !== 'past') {
    const sub = OBSTACLES.subdivision;
    const glow = (S.alarm - 0.35) / 0.65;
    for (let rx = sub.x0 + 40; rx < sub.x1 - 100; rx += 96) {
      for (const ry of [sub.y0 + 40, sub.y1 - 110]) {
        ctx.fillStyle = `rgba(255,220,130,${0.25 + glow * 0.6})`;
        ctx.fillRect(rx + 18, ry + 14, 10, 8);
        ctx.fillRect(rx + 38, ry + 30, 8, 8);
      }
    }
  }

  drawWeather();
  drawFireAir();
  drawRouteCue();
  drawLightAndAir();
  drawPlayFog();
}

// The porthole: past her senses the land goes dark. A world-unit sight
// distance (fair on every monitor) scaled to the screen, soft-edged.
// The play-view porthole darkness was removed by request — the world stays
// fully visible. (playSightWorld() still drives scent reach and bearing cues.)
function drawPlayFog() {}

// Drifting pale motes at the sight edge in a bearing — a scent she follows
// from memory, not an arrow or a line. Each mote gets a soft dark halo so it
// reads over the fully-lit world (there is no porthole dark to glow against).
function driftMotes(a, R, rgb, strength) {
  const wp = screenPos(S.wolf.x, S.wolf.y);
  for (let i = 0; i < 7; i++) {
    const phase = (S.time * 0.5 + i / 7) % 1;
    const rr = R * (0.62 + phase * 0.5);
    const spread = (i - 3) * 0.09;
    const mx = wp.x + Math.cos(a + spread) * rr;
    const my = wp.y + Math.sin(a + spread) * rr;
    const fade = (1 - phase) * (1 - Math.abs(i - 3) / 4) * strength;
    if (fade <= 0.01) continue;
    const rad = 3 + phase * 2;
    ctx.fillStyle = `rgba(24,30,34,${0.30 * fade})`;   // halo for contrast
    ctx.beginPath(); ctx.arc(mx, my, rad + 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(${rgb},${0.9 * fade})`;
    ctx.beginPath(); ctx.arc(mx, my, rad, 0, Math.PI * 2); ctx.fill();
  }
}

// A2 / B5: the remembered route pulls first — motes toward the next un-reached
// node. With no route planned, in travel seasons the distant Winter Range keeps
// a fainter bearing of its own: the year's spine, nudging her to raise the map
// and choose a way there (it replaced the removed 'range' task's compass).
function drawRouteCue() {
  if (S.mode !== 'play' || S.senseBlend > 0.2) return;
  let next = routeNextNode();
  let rgb = '208,226,236', strength = 1;
  if (!next && S.era !== 'past' && seasonIndex() >= 2 && S.tut.goalSet) {
    next = NbyId.get('winterRange');
    rgb = '212,216,226'; strength = 0.55;
  }
  if (!next) return;
  const d = dist(S.wolf.x, S.wolf.y, next.x, next.y);
  if (d < 60) return;
  resetTransform();
  const R = playSightWorld() * S.cam.scale;
  const a = Math.atan2(next.y - S.wolf.y, next.x - S.wolf.x);
  ctx.save();
  driftMotes(a, R, rgb, strength);
  ctx.restore();
}

// the burning east: a wall of amber air and drifting smoke
let smokeParts = [];
function drawFireAir() {
  if (!S.fire || S.fire.state !== 'burning') { smokeParts.length = 0; return; }
  resetTransform();
  const g = ctx.createLinearGradient(canvas.width, 0, canvas.width * 0.3, 0);
  g.addColorStop(0, 'rgba(214,110,40,0.30)');
  g.addColorStop(1, 'rgba(214,110,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  while (smokeParts.length < 26) {
    smokeParts.push({
      x: canvas.width + Math.random() * 200, y: Math.random() * canvas.height,
      vx: -60 - Math.random() * 60, r: 20 + Math.random() * 40,
    });
  }
  for (const p of smokeParts) {
    p.x += p.vx / 60;
    if (p.x < -60) { p.x = canvas.width + 60; p.y = Math.random() * canvas.height; }
    const sg = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r);
    sg.addColorStop(0, 'rgba(120,110,100,0.22)');
    sg.addColorStop(1, 'rgba(120,110,100,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
}

// prologue-only world effects: the guiding light, the ghost map, the bloom
function drawPrologueWorldBits() {
  if (S.mode !== 'prologue') return;

  if (S.beat === 2) {
    const g = ctx.createRadialGradient(OVERLOOK.x, OVERLOOK.y, 20, OVERLOOK.x, OVERLOOK.y, 220);
    g.addColorStop(0, `rgba(255,220,140,${0.22 + 0.1 * Math.sin(S.time * 2)})`);
    g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(OVERLOOK.x, OVERLOOK.y, 220, 0, Math.PI * 2); ctx.fill();
  }

  if (S.ghostPulse > 0) {
    // her map, hanging over the changed world
    ctx.globalAlpha = clamp(S.ghostPulse / 3.6, 0, 1) * (0.3 + 0.15 * Math.sin(S.time * 3));
    for (const e of S.edges) {
      if (e.state !== 'inherited') continue;
      const A = NbyId.get(e.a), B = NbyId.get(e.b);
      strokePolyline(ctx, [[A.x, A.y], [B.x, B.y]], 5, C_INK_LIGHT);
    }
    ctx.globalAlpha = 1;
  }

  if (S.bondGlow > 0 && S.willow) {
    const g = ctx.createRadialGradient(S.willow.x, S.willow.y, 8, S.willow.x, S.willow.y, 130);
    g.addColorStop(0, `rgba(255,190,110,${S.bondGlow * 0.3})`);
    g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(S.willow.x, S.willow.y, 130, 0, Math.PI * 2); ctx.fill();
  }

  if (S.inheritBloom > 0) {
    const g = ctx.createRadialGradient(S.wolf.x, S.wolf.y, 10, S.wolf.x, S.wolf.y, 420);
    g.addColorStop(0, `rgba(199,137,63,${S.inheritBloom * 0.4})`);
    g.addColorStop(1, 'rgba(199,137,63,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(S.wolf.x, S.wolf.y, 420, 0, Math.PI * 2); ctx.fill();
  }

  // beat 9: the wordless prompt, in the map's own ink language
  if (S.beat === 9 && !S.inherited && S.willow
      && dist(S.wolf.x, S.wolf.y, S.willow.x, S.willow.y) < 110) {
    const p = { x: S.willow.x, y: S.willow.y - 46 };
    const pulse = 0.6 + 0.4 * Math.sin(S.time * 2.4);
    ctx.strokeStyle = C_INK_LIGHT;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = C_INK_DARK;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    // hold progress
    if (S.inheritHold > 0) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = C_INK_DARK;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (S.inheritHold / INHERIT_HOLD));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// ── scent view ───────────────────────────────────────────────────────────────

function drawScent() {
  resetTransform();
  // the nose sees almost nothing of the land: only what carries a story
  ctx.fillStyle = 'rgba(10,10,20,0.82)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  applyCamera();
  const scale = 1 + 0.25 * seasonIndex();
  const pulse = 0.8 + 0.2 * Math.sin(S.time * 1.8);

  ctx.globalCompositeOperation = 'lighter';

  // violet: volumetric, directionless — a cloud, not a path
  if (S.era !== 'past') {
    for (const s of SCENT_VIOLET) {
      const r = s.r * scale * pulse;
      const g = ctx.createRadialGradient(s.x, s.y, r * 0.08, s.x, s.y, r);
      g.addColorStop(0, 'rgba(120,70,190,0.34)');
      g.addColorStop(0.6, 'rgba(120,70,190,0.16)');
      g.addColorStop(1, 'rgba(120,70,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // gold: prey trails with freshness falloff — blotted where violet sits.
  // Drawn from a pre-rendered glow sprite (no per-point gradients), culled
  // to the view, capped, newest first.
  const vw2 = canvas.width / S.cam.scale, vh2 = canvas.height / S.cam.scale;
  const gx0 = S.cam.x - vw2 / 2 - 40, gy0 = S.cam.y - vh2 / 2 - 40;
  const gx1 = S.cam.x + vw2 / 2 + 40, gy1 = S.cam.y + vh2 / 2 + 40;
  let drawn = 0;
  for (let i = S.scent.length - 1; i >= 0 && drawn < 320; i--) {
    const p = S.scent[i];
    const age = S.time - p.t;
    if (age > 260) break;      // long trails: a story readable hours later
    if (p.x < gx0 || p.x > gx1 || p.y < gy0 || p.y > gy1) continue;
    if (p.v > 0.45) continue;  // violet, cached when the scent was laid
    ctx.globalAlpha = 0.7 * (1 - age / 260);
    ctx.drawImage(goldSprite(), p.x - 16, p.y - 16, 32, 32);
    drawn++;
  }
  ctx.globalAlpha = 1;

  // red: rival marks, raked
  if (S.era !== 'past') {
    for (const m of SCENT_RED) {
      if (violetAt(m.x, m.y) > 0.45) continue;
      ctx.strokeStyle = 'rgba(210,60,50,0.7)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (const off of [-6, 4]) {
        ctx.beginPath();
        ctx.moveTo(m.x - 12 + off, m.y - 14);
        ctx.lineTo(m.x + 10 + off, m.y + 14);
        ctx.stroke();
      }
    }
    // the WESTERN pack's marks — freshness-lit, so the pattern of bright
    // (just-patrolled) vs dim reads where the pack has been, and where it is
    // not. Drawn brighter/larger than the eastern marks so they carry beyond
    // the sight fog: a scent problem before a sight problem.
    if (typeof westActive === 'function' && westActive()) {
      for (const m of WEST_PACK.marks) {
        if (violetAt(m.x, m.y) > 0.6) continue;
        const fresh = markFreshness(m);
        ctx.strokeStyle = `rgba(224,74,58,${0.35 + 0.55 * fresh})`;
        ctx.lineWidth = 4 + 2 * fresh;
        ctx.lineCap = 'round';
        for (const off of [-7, 5]) {
          ctx.beginPath();
          ctx.moveTo(m.x - 14 + off, m.y - 16);
          ctx.lineTo(m.x + 12 + off, m.y + 16);
          ctx.stroke();
        }
        if (fresh > 0.7) {   // a fresh mark still steams
          ctx.fillStyle = `rgba(255,120,90,${(fresh - 0.7) * 0.6})`;
          ctx.beginPath(); ctx.arc(m.x, m.y, 22, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // Sedge's one mark at the world's edge, legible only in the cold
    if (S.sedgeMark && seasonIndex() === 3) {
      const sm = S.sedgeMark;
      ctx.strokeStyle = 'rgba(210,60,50,0.55)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (const off of [-6, 4]) {
        ctx.beginPath();
        ctx.moveTo(sm.x - 12 + off, sm.y - 14);
        ctx.lineTo(sm.x + 10 + off, sm.y + 14);
        ctx.stroke();
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  // her own nose: a small certain warmth at the center
  const wp0 = screenPos(S.wolf.x, S.wolf.y);
  resetTransform();
  const ng = ctx.createRadialGradient(wp0.x, wp0.y, 2, wp0.x, wp0.y, 40);
  ng.addColorStop(0, 'rgba(220,235,255,0.25)');
  ng.addColorStop(1, 'rgba(220,235,255,0)');
  ctx.fillStyle = ng;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // the edges of her senses cloud over — and the human noise closes them in.
  // In WORLD units × cam scale, so every monitor smells the same distance
  // (the nose reaches farther than the eye).
  const v = clamp(violetAt(S.wolf.x, S.wolf.y), 0, 1);
  const R = SIGHT_WORLD * 2.6 * (1 - 0.42 * v) * S.cam.scale;
  const fog = ctx.createRadialGradient(wp0.x, wp0.y, R * 0.55, wp0.x, wp0.y, R * 1.5);
  const fr = Math.round(lerp(14, 58, v)), fg = Math.round(lerp(14, 30, v)), fb = Math.round(lerp(22, 86, v));
  fog.addColorStop(0, `rgba(${fr},${fg},${fb},0)`);
  fog.addColorStop(1, `rgba(${fr},${fg},${fb},${0.86 + 0.14 * v})`);
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // the wind, made visible: pale streaks drifting the way it blows — the
  // nose reads which approaches will be smelled first
  if (S.wind && S.era !== 'past') {
    const a = S.wind.a;
    const dx = Math.cos(a), dy = Math.sin(a);
    ctx.strokeStyle = 'rgba(215,228,222,0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const rngW = makePrng(7);
    for (let i = 0; i < 26; i++) {
      const bx = rngW() * canvas.width, by = rngW() * canvas.height;
      const drift = (S.time * 55 + i * 41) % 260;
      const x = ((bx + dx * drift) % canvas.width + canvas.width) % canvas.width;
      const y = ((by + dy * drift) % canvas.height + canvas.height) % canvas.height;
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx * 26, y + dy * 26);
    }
    ctx.stroke();
  }

  // B1: hunger's compass — a faint gold bloom at the fog edge in the bearing
  // of distant living prey. Direction, never a dot; it does not reveal the
  // animals, only which way the living land lies.
  const edgeBloom = (b, rgb) => {
    const R = Math.min(canvas.width, canvas.height) * 0.42;
    const gx = wp0.x + Math.cos(b.a) * R, gy = wp0.y + Math.sin(b.a) * R;
    const pulse = 0.6 + 0.4 * Math.sin(S.time * 1.6);
    const bloom = ctx.createRadialGradient(gx, gy, 4, gx, gy, 120);
    bloom.addColorStop(0, `rgba(${rgb},${0.3 * b.intensity * pulse})`);
    bloom.addColorStop(1, `rgba(${rgb},0)`);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = bloom;
    ctx.beginPath(); ctx.arc(gx, gy, 120, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };
  const pb = preyBearing();
  if (pb) edgeBloom(pb, '240,195,90');       // gold: distant living prey
  const wb = waterBearing();
  if (wb) edgeBloom(wb, '110,170,200');      // cool: clean water she hasn't reached

  drawCallout('scent');
}

// the gold glow, rendered once and stamped thereafter
let _goldSprite = null;
function goldSprite() {
  if (_goldSprite) return _goldSprite;
  _goldSprite = document.createElement('canvas');
  _goldSprite.width = 32; _goldSprite.height = 32;
  const c = _goldSprite.getContext('2d');
  const g = c.createRadialGradient(16, 16, 1, 16, 16, 16);
  g.addColorStop(0, 'rgba(240,195,90,1)');
  g.addColorStop(1, 'rgba(240,195,90,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 32, 32);
  return _goldSprite;
}

// ── the mental map ───────────────────────────────────────────────────────────

const wobbleCache = new Map();
function edgePolyline(e) {
  if (wobbleCache.has(e.id)) return wobbleCache.get(e.id);
  const A = NbyId.get(e.a), B = NbyId.get(e.b);
  const rng = makePrng(hashStr(e.id));
  // a path is not a ruler: where something stands in the way, it curves
  const base = e.via ? [A, ...e.via, B] : [A, B];
  const pts = [[base[0].x, base[0].y]];
  for (let s = 1; s < base.length; s++) {
    const P = base[s - 1], Q = base[s];
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const nx = -(Q.y - P.y), ny = Q.x - P.x;
      const L = Math.hypot(nx, ny) || 1;
      const off = (rng() - 0.5) * 26;
      pts.push([P.x + (Q.x - P.x) * t + nx / L * off, P.y + (Q.y - P.y) * t + ny / L * off]);
    }
    pts.push([Q.x, Q.y]);
  }
  wobbleCache.set(e.id, pts);
  return pts;
}

// The polyline for one route leg between two nodes: the drawn edge's curve if
// they share one, else the found short-way around a tear (oriented idA->idB),
// else a straight chord.
function routeLegPoly(idA, idB) {
  const e = S.edges.find(x => (x.a === idA && x.b === idB) || (x.a === idB && x.b === idA));
  if (e) return edgePolyline(e);
  const g = foundTearBetween(idA, idB);
  if (g && S.foundPaths[g.key]) {
    const pts = S.foundPaths[g.key];
    return g.chain[0] === idB ? pts.slice().reverse() : pts;
  }
  const A = NbyId.get(idA), B = NbyId.get(idB);
  return [[A.x, A.y], [B.x, B.y]];
}

function drawInkEdge(e, m) {
  const sc = S.cam.scale;
  if (e.torn) return;

  if (S.ghostEdges.has(e.id)) {
    // the far side of a tear brightens when the old wolf stands beside her:
    // Bram walked these edges before the rip
    ctx.globalAlpha = (bramRemembers() ? 0.55 : 0.3) * m;
    strokePolyline(ctx, edgePolyline(e), 2.4 / sc, C_INK_LIGHT, [10 / sc, 8 / sc]);
    ctx.globalAlpha = 1;
    return;
  }

  if (e.state === 'inherited') {
    // three tiers: ground she has WALKED shows her mother's ink in full;
    // ground only INHERITED (never seen) is a faint cold rumor-thread
    const walked = edgeSeenFrac(e) >= 0.5;
    if (walked) {
      ctx.globalAlpha = m;
      strokePolyline(ctx, edgePolyline(e), 6 / sc, C_INK_DARK);
      strokePolyline(ctx, edgePolyline(e), 2.6 / sc, C_INK_LIGHT);
    } else {
      ctx.globalAlpha = 0.34 * m;
      strokePolyline(ctx, edgePolyline(e), 2.2 / sc, C_INK_LIGHT, [11 / sc, 9 / sc]);
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (e.state === 'current-dotted' || e.state === 'current-solid') {
    ctx.globalAlpha = m;
    const dash = e.state === 'current-dotted' ? [8 / sc, 7 / sc] : [];
    const A = NbyId.get(e.a), B = NbyId.get(e.b);
    strokePolyline(ctx, [[A.x, A.y], [B.x, B.y]], 2.8 / sc, C_TRAIL, dash);
    ctx.globalAlpha = 1;
    return;
  }

  if (e.inkHi > e.inkLo) {
    const A = NbyId.get(e.a), B = NbyId.get(e.b);
    ctx.globalAlpha = 0.85 * m;
    strokePolyline(ctx,
      [[lerp(A.x, B.x, e.inkLo), lerp(A.y, B.y, e.inkLo)],
       [lerp(A.x, B.x, e.inkHi), lerp(A.y, B.y, e.inkHi)]],
      2.6 / sc, C_TRAIL, [7 / sc, 8 / sc]);
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

function nearestOnPath(pts, x, y) {
  let best = null, bd = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const { d, t } = distSeg(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    if (d < bd) {
      bd = d;
      best = { x: lerp(pts[i - 1].x, pts[i].x, t), y: lerp(pts[i - 1].y, pts[i].y, t) };
    }
  }
  return best;
}

function drawRip(g, m) {
  // if the group names its obstacle (ripPath), the rip follows the obstacle
  // itself — the wound is the road, not just the place she found it
  const pts = g.ripPath ? g.ripPath.map(p => ({ x: p[0], y: p[1] })) : chainPoints(g);
  const total = pathLength(pts);
  const margin = g.ripPath ? 0 : Math.min(70, total * 0.25);
  const rng = makePrng(hashStr(g.key));
  const W = Math.max(36, Math.min(110, (total - 2 * margin) * 0.14));
  const N = g.ripPath ? 22 : 12;

  // a CLOSED rip path is the obstacle's own outline: the rip is that shape,
  // traced jagged — never a width-band, which self-overlaps into a blob
  const closed = g.ripPath && pts.length > 3
    && Math.abs(pts[0].x - pts[pts.length - 1].x) < 0.001
    && Math.abs(pts[0].y - pts[pts.length - 1].y) < 0.001;
  let poly;
  if (closed) {
    const cx0 = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy0 = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    poly = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const P = pts[i], Q = pts[i + 1];
      for (const t of [0, 0.5]) {
        const x = P.x + (Q.x - P.x) * t, y = P.y + (Q.y - P.y) * t;
        const dx = x - cx0, dy = y - cy0;
        const n = Math.hypot(dx, dy) || 1;
        const off = (rng() - 0.35) * 30;
        poly.push([x + dx / n * off, y + dy / n * off]);
      }
    }
  } else {
    const pos = [], neg = [];
    for (let i = 0; i <= N; i++) {
      const p = pointAt(pts, margin + (i / N) * (total - 2 * margin));
      const w = W + (rng() * 2 - 1) * W * 0.4;
      pos.push([p.x - p.uy * w, p.y + p.ux * w]);
      neg.push([p.x + p.uy * w, p.y - p.ux * w]);
    }
    poly = pos.concat(neg.reverse());
  }

  ctx.globalAlpha = m;
  const sc = S.cam.scale;
  const chain = chainPoints(g);
  for (const endIdx of [0, chain.length - 1]) {
    const end = chain[endIdx];
    const stubTo = g.ripPath
      ? (() => { const n = nearestOnPath(pts, end.x, end.y);
          return { x: lerp(end.x, n.x, 0.72), y: lerp(end.y, n.y, 0.72) }; })()
      : pointAt(pts, endIdx === 0 ? margin : total - margin);
    const ghost = S.ghostNodes.has(g.chain[endIdx]);
    if (ghost) {
      ctx.globalAlpha = 0.3 * m;
      strokePolyline(ctx, [[end.x, end.y], [stubTo.x, stubTo.y]], 2.4 / sc, C_INK_LIGHT, [10 / sc, 8 / sc]);
      ctx.globalAlpha = m;
    } else {
      strokePolyline(ctx, [[end.x, end.y], [stubTo.x, stubTo.y]], 6 / sc, C_INK_DARK);
      strokePolyline(ctx, [[end.x, end.y], [stubTo.x, stubTo.y]], 2.6 / sc, C_INK_LIGHT);
    }
  }

  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
  ctx.fillStyle = C_TORN;
  ctx.fill();
  ctx.strokeStyle = '#5a5a54';
  ctx.lineWidth = 1.8 / sc;
  ctx.stroke();
  // torn paper fibers
  const frng = makePrng(hashStr(g.key + 'f'));
  ctx.strokeStyle = 'rgba(90,90,84,0.5)';
  ctx.lineWidth = 1.2 / sc;
  for (let i = 0; i < poly.length; i += 2) {
    const [px, py] = poly[i];
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + (frng() - 0.5) * 26, py + (frng() - 0.5) * 26);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function nodeKnown(n) {
  if (S.visited.has(n.id)) return true;
  return S.edges.some(e => e.state === 'inherited' && !e.torn && (e.a === n.id || e.b === n.id));
}

// parchment (fill + aged corners + speckle) cached per canvas size
let _parchment = null, _parchKey = '';
function parchmentLayer() {
  const key = canvas.width + 'x' + canvas.height;
  if (_parchment && _parchKey === key) return _parchment;
  _parchKey = key;
  _parchment = document.createElement('canvas');
  _parchment.width = canvas.width; _parchment.height = canvas.height;
  const c = _parchment.getContext('2d');
  c.fillStyle = C_PARCHMENT;
  c.fillRect(0, 0, canvas.width, canvas.height);
  const cg = c.createRadialGradient(
    canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35,
    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.8);
  cg.addColorStop(0, 'rgba(120,90,40,0)');
  cg.addColorStop(1, 'rgba(120,90,40,0.22)');
  c.fillStyle = cg;
  c.fillRect(0, 0, canvas.width, canvas.height);
  const rng = makePrng(42);
  for (let i = 0; i < 420; i++) {
    c.fillStyle = `rgba(90,55,20,${rng() * 0.05})`;
    c.beginPath();
    c.arc(rng() * canvas.width, rng() * canvas.height, rng() * 1.6 + 0.4, 0, Math.PI * 2);
    c.fill();
  }
  return _parchment;
}

function drawMap() {
  const m = smooth(S.senseBlend);

  resetTransform();
  ctx.globalAlpha = m >= 0.98 ? 1 : 0.95 * m;
  ctx.drawImage(parchmentLayer(), 0, 0);
  ctx.globalAlpha = 1;

  applyCamera();
  const sc = S.cam.scale;

  // terrain hinted as geography, never as routes
  ctx.globalAlpha = 0.3 * m;
  strokeSmooth(ctx, TERRAIN.creekFlow, 9 / sc, '#8fa8b0');
  ctx.fillStyle = '#aab694';
  for (const f of TERRAIN.forests) {
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.8, 0, Math.PI * 2); ctx.fill();
  }
  // contour whispers on the western heights — terrain, not routes, so they
  // stay barely-there
  ctx.strokeStyle = 'rgba(120,110,80,0.26)';
  ctx.lineWidth = 1 / sc;
  for (const [cx, cy] of [[320, 1120], [1900, 1000]]) {
    for (const r of [90, 150, 210]) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0.4, 2.2); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // the way she has in mind — a soft emphasis over her own knowledge; a leg
  // over ground she has NOT walked draws cold and dashed: remembered, unconfirmed
  if (S.routePath && S.routePath.length > 1) {
    for (let i = 1; i < S.routePath.length; i++) {
      const idA = S.routePath[i - 1], idB = S.routePath[i];
      const e = S.edges.find(x => (x.a === idA && x.b === idB) || (x.a === idB && x.b === idA));
      const foundG = e ? null : foundTearBetween(idA, idB);
      const confirmed = e ? edgeSeenFrac(e) >= 0.5 : (!!foundG || (nodeSeen(idA) && nodeSeen(idB)));
      const poly = routeLegPoly(idA, idB);
      if (confirmed) {
        ctx.globalAlpha = m * (0.35 + 0.15 * Math.sin(S.time * 2.5));
        strokePolyline(ctx, poly, 16 / sc, 'rgba(78,122,140,0.6)');
      } else {
        ctx.globalAlpha = m * (0.28 + 0.12 * Math.sin(S.time * 2.5));
        strokePolyline(ctx, poly, 9 / sc, 'rgba(120,150,170,0.5)', [16 / sc, 12 / sc]);
      }
    }
    ctx.globalAlpha = 1;
  }

  for (const e of S.edges) drawInkEdge(e, m);

  // the short ways she found around tears — her own ink, a new path the map did
  // not hold before
  for (const g of TEAR_GROUPS) {
    if (!S.foundPaths[g.key]) continue;
    ctx.globalAlpha = m;
    strokePolyline(ctx, S.foundPaths[g.key], 6 / sc, C_INK_DARK);
    strokePolyline(ctx, S.foundPaths[g.key], 2.6 / sc, C_INK_LIGHT);
    ctx.globalAlpha = 1;
  }

  // the season ritual: her mother's original, whole map ghosts in over the
  // scarred truth of now, holds, and fades
  if (S.seasonGhostT > 0) {
    const elapsed = SEASON_RITUAL - S.seasonGhostT;
    const ga = Math.min(1, elapsed * 1.5) * Math.min(1, S.seasonGhostT / 2) * 0.5 * m;
    if (ga > 0.01) {
      ctx.globalAlpha = ga;
      // Willow's WHOLE original map, at full confidence, un-torn, labelled —
      // her memory as it was, over the scarred present
      for (const d of EDGES) {
        if (d.state !== 'inherited' || d.dynamic) continue;
        const e = S.edges.find(x => x.id === d.id);
        if (e) {
          strokePolyline(ctx, edgePolyline(e), 5 / sc, C_INK_DARK);
          strokePolyline(ctx, edgePolyline(e), 2.4 / sc, C_INK_LIGHT);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  // B3: rumors — the old ground Bram remembers, told to her at his side and set
  // on the map. A dim thread from an inherited node into grey country, a word at
  // its end. Only what he has surfaced shows; once walked to and cashed, it goes.
  if (typeof RUMORS !== 'undefined' && S.era !== 'past') {
    for (const r of RUMORS) {
      if (S.rumorsSeen.includes(r.id) || !S.rumorsTold.includes(r.id)) continue;
      const from = NbyId.get(r.from);
      if (!from) continue;
      ctx.globalAlpha = (0.22 + 0.1 * Math.sin(S.time * 1.5)) * m;
      strokePolyline(ctx, [[from.x, from.y], [r.x, r.y]], 1.6 / sc, C_INK_LIGHT, [6 / sc, 9 / sc]);
      ctx.globalAlpha = 0.5 * m;
      ctx.fillStyle = C_INK_LIGHT;
      ctx.beginPath(); ctx.arc(r.x, r.y, 3 / sc, 0, Math.PI * 2); ctx.fill();
      if (m > 0.7) {
        ctx.font = `italic ${10 / sc}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = `rgba(120,104,74,${0.7 * m})`;
        ctx.fillText(r.label, r.x, r.y + 6 / sc);
      }
      ctx.globalAlpha = 1;
    }
  }

  for (const g of TEAR_GROUPS) {
    if (!groupTorn(g)) continue;
    drawRip(g, m);
    // the wound wears its name — centered on the rip and sized to fit inside it
    if (m > 0.7 && TEAR_NAMES[g.key]) {
      const pts = g.ripPath ? g.ripPath.map(p => ({ x: p[0], y: p[1] }))
        : g.chain.map(id => NbyId.get(id));
      let sx = 0, sy = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) { sx += p.x; sy += p.y; minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
      const cx = sx / pts.length, cy = sy / pts.length, bw = maxX - minX;
      const name = TEAR_NAMES[g.key];
      // shrink to fit the tear's width (rough char-width estimate, headless-safe)
      let fs = 13 / sc;
      if (bw > 140) fs = Math.min(fs, (bw * 0.82) / (name.length * 0.5));
      fs = Math.max(fs, 7 / sc);
      ctx.font = `italic ${fs}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // a soft dark backing so the name reads over the torn grey
      ctx.fillStyle = `rgba(40,38,34,${0.4 * m})`;
      ctx.fillText(name, cx + 1 / sc, cy + 1 / sc);
      ctx.fillStyle = `rgba(244,236,216,${0.96 * m})`;
      ctx.fillText(name, cx, cy);
    }
  }
  // (no patch squares: the new ink around a rip is its own record)

  // nodes, in screen space so rings stay a constant size
  resetTransform();
  const swallowed = swallowedNodeIds();
  for (const n of NODES) {
    if (swallowed.has(n.id)) continue;
    if (!nodeKnown(n)) continue;
    const p = screenPos(n.x, n.y);
    const ghost = S.ghostNodes.has(n.id);
    // seen once (within sight, or ever visited) resolves the node; an
    // inherited-but-unwalked node is a dim unnamed dot on a rumor-thread
    const seen = S.visited.has(n.id) || nodeSeen(n.id);
    ctx.globalAlpha = (ghost ? 0.5 : seen ? 1 : 0.4) * m;
    ctx.strokeStyle = C_NODE; ctx.fillStyle = C_NODE;
    ctx.lineWidth = 2;
    if (n.den && seen) {
      ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.setLineDash(S.visited.has(n.id) && !ghost ? [] : [4, 3]);
      ctx.beginPath(); ctx.arc(p.x, p.y, seen ? 10 : 6, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    if (m > 0.7 && seen) {
      ctx.font = `italic 11px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = `rgba(74,58,38,${m})`;
      const label = n.id === 'den' && S.denId === 'oldDen' ? 'The Den' : n.name;
      ctx.fillText(label, p.x, p.y + 14);
    }
    ctx.globalAlpha = 1;
  }

  // the chosen home, if it isn't a graph node yet (older saves only —
  // a dug den is materialized as the 'home' node now)
  if (S.denSite && S.denId !== 'oldDen' && !NbyId.has('home')) {
    const p = screenPos(S.denSite.x, S.denSite.y);
    ctx.globalAlpha = m;
    ctx.fillStyle = C_NODE;
    ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.font = `italic 11px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = `rgba(74,58,38,${m})`;
    ctx.fillText('home', p.x, p.y + 14);
    ctx.globalAlpha = 1;
  }
  // the hollows, once the choice is named: all three, plannable, clickable
  if (!S.denId && S.tut.denPrompt) {
    for (const site of DEN_SITES) {
      if (site.id === 'oldDen') continue;   // the old den already has its node
      const p = screenPos(site.x, site.y);
      ctx.globalAlpha = 0.85 * m;
      ctx.strokeStyle = C_NODE;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      if (m > 0.7) {
        ctx.font = `italic 10px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = `rgba(74,58,38,${m * 0.9})`;
        ctx.fillText(site.name, p.x, p.y + 12);
      }
      ctx.globalAlpha = 1;
    }
  }

  // the destination she has chosen
  const rt = routeTargetPos();
  if (rt) {
    const p = screenPos(rt.x, rt.y);
    const pulse = 0.5 + 0.5 * Math.sin(S.time * 3);
    ctx.globalAlpha = m * (0.5 + 0.4 * pulse);
    ctx.strokeStyle = C_TRAIL;
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16 + pulse * 5, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // the winter range calls, once autumn names it
  if (S.tut.goalSet) {
    const wr = NbyId.get('winterRange');
    const p = screenPos(wr.x, wr.y);
    const pulse = 0.5 + 0.5 * Math.sin(S.time * 2.2);
    ctx.globalAlpha = m * (0.35 + 0.4 * pulse);
    ctx.strokeStyle = C_INK_LIGHT;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 18 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // she is here
  const wp = screenPos(S.wolf.x, S.wolf.y);
  ctx.fillStyle = C_TRAIL;
  ctx.beginPath();
  ctx.arc(wp.x, wp.y, 5 + Math.sin(S.time * 4) * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C_TRAIL;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wp.x + Math.cos(S.wolf.heading) * 9, wp.y + Math.sin(S.wolf.heading) * 9);
  ctx.lineTo(wp.x + Math.cos(S.wolf.heading) * 15, wp.y + Math.sin(S.wolf.heading) * 15);
  ctx.stroke();

  // limited visible radius: what she cannot call to mind stays void
  const r = senseRadius() * S.cam.scale;
  const g2 = ctx.createRadialGradient(wp.x, wp.y, r * 0.6, wp.x, wp.y, r);
  g2.addColorStop(0, 'rgba(185,178,158,0)');
  g2.addColorStop(1, `rgba(185,178,158,${0.97 * m})`);
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // compass rose
  if (m > 0.5) {
    const cx = canvas.width - 54, cy = 60;
    ctx.globalAlpha = (m - 0.5) * 2 * 0.7;
    ctx.strokeStyle = C_NODE; ctx.fillStyle = C_NODE;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 17); ctx.lineTo(cx - 5, cy + 6); ctx.lineTo(cx, cy); ctx.lineTo(cx + 5, cy + 6);
    ctx.closePath(); ctx.fill();
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('N', cx, cy - 22);
    ctx.globalAlpha = 1;
  }

  // in the prologue the map is Willow's, opened by her hand — not yet hers to
  // "remember", so the caption stays off until Act I
  if (m > 0.7 && S.mode !== 'prologue') {
    ctx.font = `italic 13px ${FONT}`;
    ctx.fillStyle = `rgba(91,70,50,${m * 0.8})`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('— what she remembers of the territory —', canvas.width / 2, canvas.height - 14);
  }

  drawCallout('map');
}

// ── callouts: the map's vocabulary, labelled once, in place ──────────────────

const CALLOUT_TEXT = {
  'willow-ink': 'Her paths — inked deep by nine years.',
  den: 'The den. All ways home start here.',
  'own-ink': 'Your own ink — ground you have walked yourself.',
  rip: 'A tear. The land no longer matches her memory.',
  goal: 'The winter range. Be there before deep snow.',
  gold: 'Prey passed here. Brighter is fresher.',
  violet: 'The human noise. The nose is blind inside it.',
  red: "Another pack's marks. That ground is claimed.",
};

function calloutAnchor(id) {
  const near = (arr, fx) => {
    let best = null, bd = Infinity;
    for (const it of arr) {
      const p = fx(it);
      if (!p) continue;
      const d = dist(p.x, p.y, S.wolf.x, S.wolf.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
  switch (id) {
    case 'willow-ink':
      return near(S.edges.filter(e => e.state === 'inherited' && !e.torn), e => {
        const A = NbyId.get(e.a), B = NbyId.get(e.b);
        return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      });
    case 'den': return { x: DEN.x, y: DEN.y };
    case 'own-ink':
      return near(S.edges.filter(e => e.state.startsWith('current')), e => {
        const A = NbyId.get(e.a), B = NbyId.get(e.b);
        return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      });
    case 'rip': {
      const g = TEAR_GROUPS.find(groupTorn);
      if (!g) return null;
      const pts = chainPoints(g);
      const mid = pointAt(pts, pathLength(pts) / 2);
      return { x: mid.x, y: mid.y };
    }
    case 'goal': { const wr = NbyId.get('winterRange'); return { x: wr.x, y: wr.y }; }
    case 'gold': return near(S.scent, p => p);
    case 'violet': return near(SCENT_VIOLET, p => p);
    case 'red': return near(SCENT_RED, p => p);
  }
  return null;
}

function drawCallout(view) {
  const a = S.calloutActive;
  if (!a || a.view !== view) return;
  const anchor = calloutAnchor(a.id);
  if (!anchor) return;
  const p = screenPos(anchor.x, anchor.y);
  const alpha = clamp(a.t / 0.4, 0, 1) * clamp((5.5 - a.t) / 0.6, 0, 1);
  resetTransform();

  const text = CALLOUT_TEXT[a.id];
  ctx.font = `italic 14px ${FONT}`;
  const tw = ctx.measureText(text).width;
  let lx = clamp(p.x + 40, 20, canvas.width - tw - 40);
  let ly = clamp(p.y - 60, 30, canvas.height - 60);

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = view === 'map' ? C_STITCH : 'rgba(230,220,200,0.7)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(lx + tw / 2, ly + 24);
  ctx.stroke();

  if (view === 'map') {
    ctx.fillStyle = '#e7dcbc';
    ctx.strokeStyle = C_STITCH;
    rr(ctx, lx - 10, ly - 6, tw + 20, 30, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3a26';
  } else {
    ctx.fillStyle = 'rgba(16,16,28,0.85)';
    rr(ctx, lx - 10, ly - 6, tw + 20, 30, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(235,228,210,0.95)';
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(text, lx, ly + 9);
  ctx.globalAlpha = 1;
}

// ── HUD ──────────────────────────────────────────────────────────────────────

function drawKeycaps(keys, cx, cy, alpha) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold 12px ${FONT}`;
  let totalW = 0;
  const widths = keys.map(k => Math.max(26, ctx.measureText(k).width + 14));
  for (const w of widths) totalW += w + 8;
  let x = cx - totalW / 2;
  for (let i = 0; i < keys.length; i++) {
    const w = widths[i];
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(20,18,10,0.35)';
    rr(ctx, x + 2, cy - 9, w, 22, 4); ctx.fill();
    ctx.fillStyle = '#efe6cd';
    ctx.strokeStyle = '#5b4632';
    ctx.lineWidth = 1.2;
    rr(ctx, x, cy - 11, w, 22, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2d1c';
    ctx.fillText(keys[i], x + w / 2, cy + 1);
    x += w + 8;
    ctx.globalAlpha = 1;
  }
}

function drawPrompt() {
  const p = S.prompt;
  if (!p) return;
  resetTransform();
  const inRamp = clamp(p.t / 0.5, 0, 1);
  const outRamp = p.sticky ? 1 : clamp((p.dur + 0.8 - p.t) / 0.8, 0, 1);
  let alpha = inRamp * outRamp;
  if (p.sticky) alpha *= 0.8 + 0.2 * Math.sin(S.time * 2.2);
  if (alpha <= 0) return;

  const onMap = S.senseBlend > 0.5;
  ctx.font = `italic 17px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const y = canvas.height - (p.keys.length ? 92 : 64);
  ctx.globalAlpha = alpha;
  if (!onMap) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6; }
  ctx.fillStyle = onMap ? 'rgba(74,58,38,0.95)' : 'rgba(240,234,216,0.95)';
  ctx.fillText(p.text, canvas.width / 2, y);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  if (p.keys.length) drawKeycaps(p.keys, canvas.width / 2, y + 32, alpha);
}

function drawCaption() {
  const c = S.caption;
  if (!c) return;
  resetTransform();
  const alpha = clamp(c.t / 0.8, 0, 1) * clamp((c.dur + 1.2 - c.t) / 1.2, 0, 1);
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `28px ${FONT}`;
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 10;
  ctx.fillStyle = '#f2ead4';
  ctx.fillText(c.text, canvas.width / 2, canvas.height * 0.24);
  if (c.sub) {
    ctx.font = `italic 15px ${FONT}`;
    ctx.fillStyle = 'rgba(230,218,190,0.85)';
    ctx.fillText(c.sub, canvas.width / 2, canvas.height * 0.24 + 32);
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawBar(x, y, w, label, frac, color) {
  ctx.fillStyle = 'rgba(20,18,12,0.4)';
  rr(ctx, x, y, w, 11, 5); ctx.fill();
  if (frac > 0.01) {
    ctx.fillStyle = color;
    rr(ctx, x + 1, y + 1, Math.max(6, (w - 2) * clamp(frac, 0, 1)), 9, 4); ctx.fill();
  }
  ctx.font = `bold 9px ${FONT}`;
  ctx.fillStyle = '#f4efdd';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 6, y + 6);
}

function drawHUD() {
  resetTransform();
  const onMap = S.senseBlend > 0.5;
  const inkText = onMap ? '#4a3a26' : '#f0ead8';

  if (!onMap) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 5; }

  if (S.hud.day) {
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillStyle = inkText;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`Day ${day()} · ${seasonName()}`, 20, 16);
    ctx.font = `italic 12px ${FONT}`;
    ctx.fillStyle = onMap ? 'rgba(91,70,50,0.85)' : 'rgba(235,228,208,0.85)';
    ctx.fillText(objectiveText(), 20, 38);
    // a suggestion: help, never an order — a direction to try, not a task
    if (S.suggestion) {
      ctx.fillStyle = onMap ? 'rgba(120,82,40,0.9)' : 'rgba(226,206,150,0.92)';
      ctx.fillText('› ' + S.suggestion.text, 20, 56);
    }
  }
  ctx.shadowBlur = 0;

  // food and water always show; the others only when they have something in
  // them (an empty bar is clutter, not information)
  let by = S.suggestion ? 78 : 60;
  if (S.hud.food) { drawBar(20, by, 140, 'FOOD', S.food / 100, S.food < 25 ? '#b0473a' : '#b08d3f'); by += 16; }
  if (S.hud.food) { drawBar(20, by, 140, 'WATER', S.water / 100, S.water < 25 ? '#b0473a' : '#5f7d92'); by += 16; }
  if (S.hud.fear && S.fear > 0.01) { drawBar(20, by, 140, 'FEAR', S.fear, '#a5443a'); by += 16; }
  if (S.hud.pups && S.pups && !S.pups.traveling && S.pups.count > 0 && S.pups.food > 0.5) {
    drawBar(20, by, 140, `PUP FOOD ×${S.pups.count}`, S.pups.food / 100, '#8d6f4a'); by += 16;
  }
  if (isInjured() || (S.sickT || 0) > 0) {
    ctx.font = `italic 12px ${FONT}`;
    ctx.fillStyle = onMap ? '#7a2f1a' : '#e8a090';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(isInjured() ? 'hurt — she limps' : 'sick — the water was wrong', 20, by + 2);
  }

  if (S.hud.pack) {
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    if (!onMap) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 5; }
    let ry = 18;
    for (const w of S.pack) {
      let glyph = { follow: '', stay: ' · holds', balk: ' · freezes', dead: ' · lost to the road', gone: ' · gone' }[w.state];
      const alive = w.state !== 'dead' && w.state !== 'gone';
      if (alive && (S.packFrozen || (w.frozenT || 0) > 0)) glyph = ' · freezes';
      if (alive && w.lost) glyph = ' · missing';
      if (alive && (w.injuredT || 0) > 0) glyph += ' · hurt';
      ctx.fillStyle = alive ? inkText : (onMap ? 'rgba(120,60,45,0.8)' : 'rgba(230,150,130,0.8)');
      ctx.fillText(w.name + glyph, canvas.width - 20, ry);
      ry += 18;
    }
    if (S.pups && !S.pups.traveling && S.pups.count > 0) {
      ctx.fillStyle = inkText;
      ctx.fillText(`Pups ×${S.pups.count} · at the den`, canvas.width - 20, ry);
    }
    ctx.shadowBlur = 0;
  }

  if (S.msgT > 0) {
    ctx.font = `italic 16px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    if (!onMap) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6; }
    ctx.fillStyle = onMap
      ? `rgba(74,58,38,${clamp(S.msgT, 0, 1)})`
      : `rgba(242,234,214,${clamp(S.msgT, 0, 1)})`;
    ctx.fillText(S.msg, canvas.width / 2, 24);
    ctx.shadowBlur = 0;
  }
}

function drawFlicker() {
  if (S.flickerT <= 0) return;
  resetTransform();
  ctx.fillStyle = `rgba(150,150,144,${0.45 * (S.flickerT / 0.5)})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawHelp() {
  if (!S.showHelp) return;
  resetTransform();
  ctx.fillStyle = 'rgba(15,14,10,0.55)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const w = 460, rows = [];
  rows.push(['W A S D', 'walk']);
  if (S.tut.sawMap) rows.push(['SPACE', 'the map — press to open, press to close']);
  if (S.tut.scentHold > 0.6) rows.push(['E (hold)', 'smell the wind']);
  if (S.tut.fTaught) rows.push(['F', 'the pack holds, or follows']);
  if (S.tut.drinkTaught || S.mode === 'play') rows.push(['Q (hold)', 'drink, standing in water']);
  rows.push(['M', 'quiet']);
  rows.push(['R  R', 'restart the game (skips prologue)']);
  rows.push(['H', 'open or close this']);
  const h = 90 + rows.length * 40;
  const x = canvas.width / 2 - w / 2, y = canvas.height / 2 - h / 2;
  ctx.fillStyle = C_PARCHMENT;
  ctx.strokeStyle = C_STITCH;
  ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, 8); ctx.fill(); ctx.stroke();
  ctx.font = `italic 18px ${FONT}`;
  ctx.fillStyle = '#4a3a26';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('what she knows how to do', canvas.width / 2, y + 22);
  let ry = y + 66;
  for (const [k, txt] of rows) {
    drawKeycaps(k.split('  ').length > 1 ? k.split('  ') : [k], x + 110, ry + 2, 1);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = '#4a3a26';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, x + 190, ry + 2);
    ry += 40;
  }
}

// ── intro ────────────────────────────────────────────────────────────────────

function drawIntro() {
  resetTransform();
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#151812');
  g.addColorStop(1, '#1e241b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2, cy = canvas.height / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold 46px ${FONT}`;
  ctx.fillStyle = C_PARCHMENT;
  ctx.fillText('T H E   C O R R I D O R', cx, cy - 60);
  ctx.font = `italic 17px ${FONT}`;
  ctx.fillStyle = '#b8ac8d';
  ctx.fillText('one year', cx, cy - 12);
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = C_PARCHMENT;
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(Date.now() / 420);
  ctx.fillText('press any key', cx, cy + 90);
  ctx.globalAlpha = 1;
  if (hasResumableSave()) {
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = '#b8ac8d';
    ctx.fillText('R — resume the year from where you left off', cx, cy + 152);
  }
}

// ── the ending: the satellite dissolve ───────────────────────────────────────

function endingCamera() {
  const X0 = WORLD.x0 || 0, span = WORLD.w - X0;
  const sc = Math.min(canvas.width / span, canvas.height / WORLD.h) * 0.94;
  ctx.setTransform(sc, 0, 0, sc,
    canvas.width / 2 - (X0 + WORLD.w) / 2 * sc, canvas.height / 2 - WORLD.h / 2 * sc);
  return sc;
}

function drawSatellite() {
  const X0 = WORLD.x0 || 0, span = WORLD.w - X0;
  ctx.fillStyle = '#6a705c';
  ctx.fillRect(X0, 0, span, WORLD.h);
  const rng = makePrng(99);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(${120 + rng() * 60},${115 + rng() * 40},${70 + rng() * 30},0.25)`;
    ctx.fillRect(X0 + rng() * span, rng() * WORLD.h, 160 + rng() * 480, 120 + rng() * 340);
  }
  ctx.fillStyle = 'rgba(40,55,35,0.8)';
  for (const f of TERRAIN.forests) {
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
  }
  strokeSmooth(ctx, TERRAIN.creekFlow, 20, '#5d7d8a');
  const h = OBSTACLES.highway;
  ctx.fillStyle = '#33353a';
  ctx.fillRect(h.x0 - 8, 0, h.x1 - h.x0 + 16, WORLD.h);
  ctx.strokeStyle = 'rgba(235,225,190,0.7)';
  ctx.lineWidth = 3; ctx.setLineDash([30, 30]);
  ctx.beginPath(); ctx.moveTo((h.x0 + h.x1) / 2, 0); ctx.lineTo((h.x0 + h.x1) / 2, WORLD.h); ctx.stroke();
  ctx.setLineDash([]);
  const c = OBSTACLES.construction;
  ctx.fillStyle = '#b5a074'; ctx.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
  const sub = OBSTACLES.subdivision;
  ctx.fillStyle = '#8e8478'; ctx.fillRect(sub.x0, sub.y0, sub.x1 - sub.x0, sub.y1 - sub.y0);
  ctx.fillStyle = '#c9beac';
  for (let rx = sub.x0 + 24; rx < sub.x1 - 60; rx += 84) {
    for (let ry = sub.y0 + 24; ry < sub.y1 - 50; ry += 92) ctx.fillRect(rx, ry, 52, 36);
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

  const posPts = S.history.filter(e => e.type === 'pos');
  if (t > 2.5 && posPts.length > 1) {
    const frac = clamp((t - 2.5) / 6, 0, 1);
    const n = Math.max(2, Math.floor(posPts.length * frac));
    ctx.strokeStyle = C_TRAIL;
    ctx.lineWidth = 5 / sc;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(posPts[0].x, posPts[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(posPts[i].x, posPts[i].y);
    ctx.stroke();
  }

  if (t > 9) {
    ctx.globalAlpha = clamp((t - 9) / 2, 0, 1) * 0.8;
    for (const d of EDGES) {
      if (d.state !== 'inherited') continue;
      const A = NbyId.get(d.a), B = NbyId.get(d.b);
      strokePolyline(ctx, [[A.x, A.y], [B.x, B.y]], 8 / sc, C_INK_LIGHT);
    }
    ctx.globalAlpha = 1;
  }

  const yearlingAlive = S.pack.some(w => w.yearling && w.state !== 'dead' && w.state !== 'gone');
  // when the rail takes HER, the map dies with her — the pack is leaderless in a
  // country it never learned to read, so no legacy carries forward
  const dead = S.endKind === 'dead';
  const hasLegacy = yearlingAlive && S.yearlingKnows.size > 0 && !dead;
  if (t > 12 && hasLegacy) {
    ctx.globalAlpha = clamp((t - 12) / 2, 0, 1) * 0.9;
    for (const eid of S.yearlingKnows) {
      const d = EDGES.find(x => x.id === eid);
      const A = NbyId.get(d.a), B = NbyId.get(d.b);
      strokePolyline(ctx, [[A.x, A.y], [B.x, B.y]], 5 / sc, '#e8e4d4', [22 / sc, 18 / sc]);
    }
    ctx.globalAlpha = 1;
  }

  resetTransform();
  if (t > 15) {
    const a = clamp((t - 15) / 2, 0, 1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(16,18,16,${0.74 * a})`;
    ctx.fillRect(0, canvas.height / 2 - 105, canvas.width, 215);
    ctx.font = `italic 19px ${FONT}`;
    ctx.fillStyle = `rgba(237,226,201,${a})`;
    const line1 = S.endKind === 'arrived'
      ? 'She brought them through. The map that did it was hers, not her mother’s.'
      : S.endKind === 'dead'
        ? 'The train did not notice her. The map ends where she did.'
        : 'The winter closed before the map was finished.';
    ctx.fillText(line1, canvas.width / 2, canvas.height / 2 - 66);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = `rgba(200,190,165,${a})`;
    ctx.fillText(dead
      ? 'Without her map, the pack scatters into a land it cannot read. None come through.'
      : `Of the ${totalCount()} that walked the year, ${survivorCount()} came through.`,
      canvas.width / 2, canvas.height / 2 - 34);
    ctx.font = `17px ${FONT}`;
    ctx.fillStyle = `rgba(237,226,201,${a})`;
    ctx.fillText('A wolf’s territory once passed from mother to daughter, unchanged, for generations.',
      canvas.width / 2, canvas.height / 2 + 6);
    ctx.fillText('The average corridor now closes within one.', canvas.width / 2, canvas.height / 2 + 32);
    ctx.font = `italic 14px ${FONT}`;
    ctx.fillStyle = `rgba(184,172,141,${a})`;
    ctx.fillText(hasLegacy
      ? 'The young walk behind her knowing the new ways. The dotted line is theirs.'
      : 'No one walks behind her who learned the new ways.',
      canvas.width / 2, canvas.height / 2 + 68);
  }
  if (t > 18) {
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = C_PARCHMENT;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() / 400);
    ctx.textAlign = 'center';
    ctx.fillText('press R to begin again', canvas.width / 2, canvas.height - 40);
    ctx.globalAlpha = 1;
  }
}

// ── the vista mattes ─────────────────────────────────────────────────────────
// Two held paintings of the same land: the overlook in the past ('The
// valley. Whole.') and the cut ('Three winters later.'). The ridgelines are
// seeded identically so the land reads as the same land — only what people
// did to it changes.

let _matte = null, _matteKey = '';

function ridgeY(base, amp, x, w, p1, p2, p3) {
  return base
    + Math.sin(x / w * Math.PI * 2 * 1.7 + p1) * amp
    + Math.sin(x / w * Math.PI * 2 * 3.9 + p2) * amp * 0.45
    + Math.sin(x / w * Math.PI * 2 * 8.3 + p3) * amp * 0.16;
}

function buildVistaMatte(era, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const b = c.getContext('2d');
  const past = era === 'past';
  const rng = makePrng(47);   // one seed: one land, both winters

  // sky
  const sky = b.createLinearGradient(0, 0, 0, h * 0.62);
  if (past) {
    sky.addColorStop(0, '#8fb3cd');
    sky.addColorStop(0.55, '#d9d7b2');
    sky.addColorStop(1, '#f0debc');
  } else {
    sky.addColorStop(0, '#5d6a7c');
    sky.addColorStop(0.55, '#9aa0a2');
    sky.addColorStop(1, '#c6bfae');
  }
  b.fillStyle = sky;
  b.fillRect(0, 0, w, h);

  // the sun, low in the east — gold once, a smeared coin later
  const sx = w * 0.76, sy = h * (past ? 0.30 : 0.34);
  const sun = b.createRadialGradient(sx, sy, 4, sx, sy, past ? h * 0.34 : h * 0.2);
  sun.addColorStop(0, past ? 'rgba(255,238,190,0.95)' : 'rgba(235,228,210,0.55)');
  sun.addColorStop(1, 'rgba(255,238,190,0)');
  b.fillStyle = sun;
  b.fillRect(0, 0, w, h * 0.7);

  // birds, only in the whole valley
  if (past) {
    b.strokeStyle = 'rgba(60,60,55,0.55)'; b.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) {
      const bx = w * (0.2 + rng() * 0.45), by = h * (0.12 + rng() * 0.14), s = 4 + rng() * 4;
      b.beginPath(); b.moveTo(bx - s, by); b.quadraticCurveTo(bx - s * 0.4, by - s * 0.55, bx, by);
      b.quadraticCurveTo(bx + s * 0.4, by - s * 0.55, bx + s, by); b.stroke();
    }
  } else { for (let i = 0; i < 5; i++) { rng(); rng(); rng(); } }   // keep the seed in step

  // ridge phases: rolled once, shared by both eras
  const phases = [];
  for (let i = 0; i < 6; i++) phases.push([rng() * 6.3, rng() * 6.3, rng() * 6.3]);

  const farC  = past ? [176, 188, 172] : [166, 170, 168];
  const nearC = past ? [56, 72, 48]    : [56, 62, 54];
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const base = h * (0.40 + 0.085 * i);
    const amp = 14 + i * 7;
    const col = `rgb(${Math.round(farC[0] + (nearC[0] - farC[0]) * t)},${
      Math.round(farC[1] + (nearC[1] - farC[1]) * t)},${
      Math.round(farC[2] + (nearC[2] - farC[2]) * t)})`;

    // haze band behind each nearer ridge
    b.fillStyle = past ? `rgba(240,225,190,${0.05 + t * 0.05})` : `rgba(205,205,200,${0.08 + t * 0.06})`;
    b.fillRect(0, base - amp * 2, w, amp * 3);

    b.fillStyle = col;
    b.beginPath();
    b.moveTo(0, h);
    for (let x = 0; x <= w; x += 6) {
      b.lineTo(x, ridgeY(base, amp, x, w, phases[i][0], phases[i][1], phases[i][2]));
    }
    b.lineTo(w, h);
    b.closePath();
    b.fill();

    // conifers along the crest of the nearer ridges
    if (i >= 2) {
      b.strokeStyle = col; b.lineWidth = 2;
      const n = 40 + i * 30;
      for (let k = 0; k < n; k++) {
        const x = rng() * w;
        const y = ridgeY(base, amp, x, w, phases[i][0], phases[i][1], phases[i][2]);
        const tall = (2 + rng() * 3) * (1 + t);
        b.beginPath(); b.moveTo(x, y + 1); b.lineTo(x, y - tall); b.stroke();
      }
    }

    // what three winters built, hung on the middle ridges
    if (!past && i === 3) {
      // the highway: a pale scar tracing the ridge, with lights strung on it
      b.strokeStyle = 'rgba(200,196,184,0.85)'; b.lineWidth = 3.2;
      b.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = ridgeY(base, amp, x, w, phases[i][0], phases[i][1], phases[i][2]) + 6;
        x === 0 ? b.moveTo(x, y) : b.lineTo(x, y);
      }
      b.stroke();
      for (let k = 0; k < 7; k++) {
        const x = w * (0.08 + k * 0.14);
        const y = ridgeY(base, amp, x, w, phases[i][0], phases[i][1], phases[i][2]) + 6;
        b.fillStyle = k % 2 ? 'rgba(255,244,200,0.9)' : 'rgba(255,120,90,0.8)';
        b.fillRect(x, y - 1, 2, 2);
        // power poles pacing it
        b.strokeStyle = 'rgba(50,50,48,0.7)'; b.lineWidth = 1;
        b.beginPath(); b.moveTo(x + 20, y); b.lineTo(x + 20, y - 8);
        b.moveTo(x + 16, y - 7); b.lineTo(x + 24, y - 7); b.stroke();
      }
    }
    if (!past && i === 4) {
      // construction in the east: blocks, a crane, one red beacon
      const cx = w * 0.72;
      const cy = ridgeY(base, amp, cx, w, phases[i][0], phases[i][1], phases[i][2]);
      b.fillStyle = 'rgba(70,72,70,0.95)';
      b.fillRect(cx - 26, cy - 10, 22, 10);
      b.fillRect(cx + 2, cy - 7, 16, 7);
      b.strokeStyle = 'rgba(60,60,58,0.95)'; b.lineWidth = 1.6;
      b.beginPath();
      b.moveTo(cx + 30, cy); b.lineTo(cx + 30, cy - 26);
      b.lineTo(cx + 52, cy - 22); b.moveTo(cx + 30, cy - 26); b.lineTo(cx + 22, cy - 22);
      b.stroke();
      b.fillStyle = 'rgba(255,70,60,0.9)';
      b.fillRect(cx + 29, cy - 28, 2, 2);
      // the subdivision, right of center: gables and lit windows
      for (let k = 0; k < 6; k++) {
        const hx = w * (0.56 + k * 0.024), hy = cy + 6 + (k % 2) * 3;
        b.fillStyle = 'rgba(64,66,64,0.95)';
        b.beginPath(); b.moveTo(hx - 5, hy); b.lineTo(hx, hy - 6); b.lineTo(hx + 5, hy); b.closePath(); b.fill();
        b.fillRect(hx - 4, hy, 8, 4);
        b.fillStyle = 'rgba(255,236,180,0.85)';
        b.fillRect(hx - 1, hy + 1, 2, 2);
      }
    }
  }

  // the creek, catching the light on the valley floor
  b.strokeStyle = past ? 'rgba(220,235,235,0.5)' : 'rgba(205,215,215,0.35)';
  b.lineWidth = 3;
  b.beginPath();
  let cy2 = h * 0.78;
  b.moveTo(w * 0.18, cy2);
  for (let x = w * 0.18; x < w * 0.95; x += 30) {
    cy2 += (rng() - 0.35) * 16;
    b.lineTo(x, cy2);
  }
  b.stroke();

  // matte grain
  b.globalAlpha = 0.05;
  for (let i = 0; i < 900; i++) {
    b.fillStyle = rng() > 0.5 ? '#000' : '#fff';
    b.fillRect(rng() * w, rng() * h, 1, 1);
  }
  b.globalAlpha = 1;
  return c;
}

function drawVistaMatte() {
  const key = S.era + '|' + canvas.width + 'x' + canvas.height;
  if (!_matte || _matteKey !== key) {
    _matteKey = key;
    _matte = buildVistaMatte(S.era, canvas.width, canvas.height);
  }
  const total = S.vistaTMax || 3.4;
  const a = Math.min(1, (total - S.vistaT) * 2.2) * Math.min(1, S.vistaT * 1.1);
  resetTransform();
  ctx.globalAlpha = Math.max(0, a);
  ctx.drawImage(_matte, 0, 0);
  ctx.globalAlpha = 1;
}

// The passage: winter closing over the den in white, snow drifting through
// it, then letting go slowly into the first thaw. Drawn under the caption.
function drawPassage() {
  let a = 0;
  if (S.mode === 'prologue' && S.beat === 10) a = Math.min(1, S.beatT / 1.5) * 0.96;
  else if ((S.passageFade || 0) > 0) a = (S.passageFade / 1.8) * 0.96;
  if (a <= 0.01) return;
  resetTransform();
  ctx.fillStyle = `rgba(236,239,241,${a})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `rgba(255,255,255,${Math.min(1, a + 0.2)})`;
  const rngS = makePrng(13);
  for (let i = 0; i < 40; i++) {
    const bx = rngS() * canvas.width, by = rngS() * canvas.height, spd = 12 + rngS() * 22;
    const y = (by + S.time * spd) % canvas.height;
    const x = ((bx + Math.sin(S.time * 0.8 + i) * 14) % canvas.width + canvas.width) % canvas.width;
    ctx.beginPath(); ctx.arc(x, y, 1.2 + rngS() * 1.4, 0, Math.PI * 2); ctx.fill();
  }
}

// ── dispatcher ───────────────────────────────────────────────────────────────

function draw() {
  if (!S) return;
  if (S.mode === 'intro') { drawIntro(); return; }
  if (S.mode === 'ending') { drawEnding(); return; }

  // under a fully-raised map the world is invisible — don't pay for it
  if (S.senseBlend < 0.98) drawWorld();
  else { resetTransform(); ctx.fillStyle = '#22261f'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  if (input.scent && S.senseBlend < 0.2) drawScent();
  if (S.senseBlend > 0.01) drawMap();
  if (S.vistaT > 0 && S.mode === 'prologue') drawVistaMatte();
  drawFlicker();
  if (S.mode === 'play') drawHUD();
  drawPassage();
  drawPrompt();
  drawCaption();
  drawHelp();
}
