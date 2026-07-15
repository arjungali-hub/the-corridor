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
];

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

function buildBaseLayer() {
  const si = S.era === 'past' ? 0 : seasonIndex();
  baseKey = S.era + '|' + si;
  if (!baseLayer) {
    baseLayer = document.createElement('canvas');
    baseLayer.width = WORLD.w; baseLayer.height = WORLD.h;
  }
  const b = baseLayer.getContext('2d');
  const past = S.era === 'past';

  // ground
  b.fillStyle = past ? PAST_GROUND : SEASON_GROUND[si];
  b.fillRect(0, 0, WORLD.w, WORLD.h);

  const rng = makePrng(710);
  // broad tonal patches
  for (let i = 0; i < 46; i++) {
    const x = rng() * WORLD.w, y = rng() * WORLD.h, r = 260 + rng() * 480;
    const g = b.createRadialGradient(x, y, r * 0.2, x, y, r);
    const dark = rng() > 0.5;
    g.addColorStop(0, dark ? 'rgba(50,60,30,0.10)' : 'rgba(240,240,200,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    b.fillStyle = g;
    b.beginPath(); b.arc(x, y, r, 0, Math.PI * 2); b.fill();
  }
  // mottling
  b.fillStyle = SEASON_GROUND_DARK[si];
  for (let i = 0; i < 700; i++) {
    b.globalAlpha = 0.05 + rng() * 0.05;
    b.beginPath();
    b.ellipse(rng() * WORLD.w, rng() * WORLD.h, 30 + rng() * 90, 18 + rng() * 50, rng() * 3, 0, Math.PI * 2);
    b.fill();
  }
  b.globalAlpha = 1;
  // fine speckle: grass tufts / stones
  for (let i = 0; i < 2600; i++) {
    b.fillStyle = rng() > 0.5 ? 'rgba(40,55,25,0.12)' : 'rgba(235,235,205,0.10)';
    b.fillRect(rng() * WORLD.w, rng() * WORLD.h, 2 + rng() * 3, 1.5 + rng() * 2);
  }
  // season dressing
  if (si === 0) {
    for (let i = 0; i < 500; i++) {   // wildflowers
      b.fillStyle = rng() > 0.5 ? 'rgba(250,245,220,0.7)' : 'rgba(230,200,120,0.6)';
      b.beginPath(); b.arc(rng() * WORLD.w, rng() * WORLD.h, 1.6 + rng() * 1.6, 0, Math.PI * 2); b.fill();
    }
  } else if (si === 2 && !past) {
    for (let i = 0; i < 600; i++) {   // leaf litter
      b.fillStyle = `rgba(${150 + rng() * 60 | 0},${70 + rng() * 40 | 0},30,0.5)`;
      b.beginPath(); b.ellipse(rng() * WORLD.w, rng() * WORLD.h, 3, 1.6, rng() * 3, 0, Math.PI * 2); b.fill();
    }
  } else if (si === 3 && !past) {
    for (let i = 0; i < 260; i++) {   // drifts
      b.fillStyle = 'rgba(255,255,255,0.5)';
      b.beginPath(); b.ellipse(rng() * WORLD.w, rng() * WORLD.h, 40 + rng() * 90, 8 + rng() * 16, rng() * 0.6 - 0.3, 0, Math.PI * 2); b.fill();
    }
  }

  // water: banks, then living water; the dry bed; the wash under the road
  strokeSmooth(b, TERRAIN.creekFlow, 44, 'rgba(80,70,45,0.45)');
  strokeSmooth(b, TERRAIN.creekFlow, 30, si === 3 && !past ? '#aebfc9' : '#6f9cae');
  strokeSmooth(b, TERRAIN.creekFlow, 12, si === 3 && !past ? '#d5dfe5' : '#a9c6d2');
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
  b.fillStyle = 'rgba(80,70,45,0.4)';
  b.beginPath(); b.ellipse(sp.x, sp.y, sp.r + 10, sp.r * 0.8 + 8, 0.2, 0, Math.PI * 2); b.fill();
  const pg = b.createRadialGradient(sp.x, sp.y, 6, sp.x, sp.y, sp.r);
  pg.addColorStop(0, '#b7d2dc'); pg.addColorStop(1, si === 3 && !past ? '#aebfc9' : '#5f8ea0');
  b.fillStyle = pg;
  b.beginPath(); b.ellipse(sp.x, sp.y, sp.r, sp.r * 0.8, 0.2, 0, Math.PI * 2); b.fill();
  const rrng = makePrng(77);
  for (let i = 0; i < 26; i++) {   // reeds
    const a = rrng() * Math.PI * 2, d = sp.r * (0.9 + rrng() * 0.3);
    b.strokeStyle = 'rgba(90,110,50,0.8)';
    b.lineWidth = 1.6;
    b.beginPath();
    b.moveTo(sp.x + Math.cos(a) * d, sp.y + Math.sin(a) * d * 0.8);
    b.lineTo(sp.x + Math.cos(a) * d + (rrng() - 0.5) * 6, sp.y + Math.sin(a) * d * 0.8 - 8 - rrng() * 8);
    b.stroke();
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

  // forests: shadowed, clustered trees
  for (const f of TERRAIN.forests) {
    const frng = makePrng(hashStr('f' + f.x + ',' + f.y));
    b.fillStyle = 'rgba(35,50,30,0.18)';
    b.beginPath(); b.arc(f.x + 14, f.y + 18, f.r, 0, Math.PI * 2); b.fill();
    const trees = Math.floor(f.r * f.r / 1700);
    for (let i = 0; i < trees; i++) {
      const a = frng() * Math.PI * 2, d = Math.sqrt(frng()) * f.r;
      drawTree(b, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 12 + frng() * 16, frng, si, past);
    }
  }
  // lone trees
  const lrng = makePrng(4242);
  for (let i = 0; i < 120; i++) {
    const x = lrng() * WORLD.w, y = lrng() * WORLD.h;
    if (x > 820 && x < 1020) continue;  // not in the road bed
    drawTree(b, x, y, 10 + lrng() * 12, lrng, si, past);
  }

  // THE ROAD — asphalt in the present; pale gravel in her mother's time
  const h = OBSTACLES.highway;
  if (past) {
    b.fillStyle = 'rgba(190,175,140,0.9)';
    b.fillRect(h.x0 + 6, 0, h.x1 - h.x0 - 12, WORLD.h);
    b.strokeStyle = 'rgba(140,125,95,0.6)';
    b.lineWidth = 3;
    for (const lx of [h.x0 + 18, h.x1 - 18]) {   // wheel ruts
      b.beginPath(); b.moveTo(lx, 0); b.lineTo(lx, WORLD.h); b.stroke();
    }
  } else {
    b.fillStyle = 'rgba(60,60,60,0.35)';
    b.fillRect(h.x0 - 14, 0, h.x1 - h.x0 + 28, WORLD.h);  // shoulders
    const ag = b.createLinearGradient(h.x0, 0, h.x1, 0);
    ag.addColorStop(0, '#3c3f44'); ag.addColorStop(0.5, '#484b50'); ag.addColorStop(1, '#3c3f44');
    b.fillStyle = ag;
    b.fillRect(h.x0, 0, h.x1 - h.x0, WORLD.h);
    b.strokeStyle = 'rgba(225,220,200,0.8)';
    b.lineWidth = 2.5;
    b.beginPath(); b.moveTo(h.x0 + 5, 0); b.lineTo(h.x0 + 5, WORLD.h); b.stroke();
    b.beginPath(); b.moveTo(h.x1 - 5, 0); b.lineTo(h.x1 - 5, WORLD.h); b.stroke();
    b.strokeStyle = 'rgba(235,205,120,0.75)';
    b.lineWidth = 3;
    b.setLineDash([34, 40]);
    b.beginPath(); b.moveTo((h.x0 + h.x1) / 2, 0); b.lineTo((h.x0 + h.x1) / 2, WORLD.h); b.stroke();
    b.setLineDash([]);
    // the culvert: concrete headwalls and the dark passage under
    b.fillStyle = '#8e8d88';
    b.fillRect(h.x0 - 26, h.gapY0 - 8, 26, h.gapY1 - h.gapY0 + 16);
    b.fillRect(h.x1, h.gapY0 - 8, 26, h.gapY1 - h.gapY0 + 16);
    b.fillStyle = '#232528';
    b.fillRect(h.x0 - 6, h.gapY0, h.x1 - h.x0 + 12, h.gapY1 - h.gapY0);
    const crng = makePrng(55);
    for (let i = 0; i < 24; i++) {   // riprap
      b.fillStyle = 'rgba(140,138,130,0.9)';
      b.beginPath();
      b.arc(h.x0 - 30 + crng() * (h.x1 - h.x0 + 60), (crng() > 0.5 ? h.gapY0 - 14 : h.gapY1 + 14) + (crng() - 0.5) * 10, 3 + crng() * 4, 0, Math.PI * 2);
      b.fill();
    }
  }

  if (!past) {
    // construction: graded dirt, spoil, machines, stakes
    const c = OBSTACLES.construction;
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

    // subdivision: street, houses with gabled roofs, fences
    const sub = OBSTACLES.subdivision;
    b.fillStyle = '#9aa07c';
    b.fillRect(sub.x0, sub.y0, sub.x1 - sub.x0, sub.y1 - sub.y0);
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
  const m = S.clock.min % 1440;
  if (m < 270) return 0.1;
  if (m < 420) return 0.1 + (m - 270) / 150 * 0.9;
  if (m < 1080) return 1;
  if (m < 1230) return 1 - (m - 1080) / 150 * 0.9;
  return 0.1;
}

function drawLightAndAir() {
  resetTransform();
  const dl = daylight();
  if (dl < 1) {
    ctx.fillStyle = `rgba(13,22,38,${(1 - dl) * 0.34})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const warm = dl > 0.15 && dl < 0.95 ? (1 - Math.abs(2 * ((dl - 0.15) / 0.8) - 1)) : 0;
  if (warm > 0) {
    ctx.fillStyle = `rgba(255,150,60,${warm * 0.1})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (S.era === 'past' || S.vistaT > 0) {
    ctx.fillStyle = `rgba(255,180,90,${S.era === 'past' ? 0.10 : 0.14})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // vignette
  const vg = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.45,
    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10,14,8,0.26)');
  ctx.fillStyle = vg;
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
  const key = S.era + '|' + (S.era === 'past' ? 0 : seasonIndex());
  if (!baseLayer || baseKey !== key) buildBaseLayer();

  resetTransform();
  ctx.fillStyle = '#22261f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  applyCamera();
  ctx.drawImage(baseLayer, 0, 0);

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

  // the chosen den: trampled, home
  if (S.denSite) {
    ctx.strokeStyle = 'rgba(90,70,50,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(S.denSite.x, S.denSite.y, 56, 0, Math.PI * 2); ctx.stroke();
  }

  for (const car of S.cars) drawCar(car);
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

  // the pack, then Willow, then Aspen
  for (const w of S.pack) {
    if (w.state === 'dead' || w.state === 'gone') continue;
    const tone = WOLF_TONES[w.pup ? 'pup' : w.id] || WOLF_TONES.fen;
    const hd = w.moving ? Math.atan2(S.wolf.y - w.y, S.wolf.x - w.x) : (w.heading || 0);
    w.heading = hd;
    drawWolfBody(w.x, w.y, hd, w.pup ? 6.5 : (w.id === 'bram' ? 11 : 10), tone, w.moving, w.gait || 0, false);
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

  drawWeather();
  drawLightAndAir();
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
  ctx.fillStyle = 'rgba(12,12,24,0.5)';
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

  // gold: prey trails with freshness falloff — blotted where violet sits
  for (const p of S.scent) {
    const age = S.time - p.t;
    if (age > 90) continue;
    if (violetAt(p.x, p.y) > 0.45) continue;
    const a = 0.7 * (1 - age / 90);
    const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 16);
    g.addColorStop(0, `rgba(240,195,90,${a})`);
    g.addColorStop(1, 'rgba(240,195,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.fill();
  }

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

  // the edges of her senses cloud over — and the human noise closes them in
  const v = clamp(violetAt(S.wolf.x, S.wolf.y), 0, 1);
  const R = Math.min(canvas.width, canvas.height) * (0.52 - 0.24 * v);
  const fog = ctx.createRadialGradient(wp0.x, wp0.y, R * 0.55, wp0.x, wp0.y, R * 1.5);
  const fr = Math.round(lerp(14, 58, v)), fg = Math.round(lerp(14, 30, v)), fb = Math.round(lerp(22, 86, v));
  fog.addColorStop(0, `rgba(${fr},${fg},${fb},0)`);
  fog.addColorStop(1, `rgba(${fr},${fg},${fb},${0.72 + 0.24 * v})`);
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawCallout('scent');
}

// ── the mental map ───────────────────────────────────────────────────────────

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
    const off = (rng() - 0.5) * 26;
    pts.push([A.x + (B.x - A.x) * t + nx / L * off, A.y + (B.y - A.y) * t + ny / L * off]);
  }
  pts.push([B.x, B.y]);
  wobbleCache.set(e.id, pts);
  return pts;
}

function drawInkEdge(e, m) {
  const sc = S.cam.scale;
  if (e.torn) return;

  if (S.ghostEdges.has(e.id)) {
    ctx.globalAlpha = 0.3 * m;
    strokePolyline(ctx, edgePolyline(e), 2.4 / sc, C_INK_LIGHT, [10 / sc, 8 / sc]);
    ctx.globalAlpha = 1;
    return;
  }

  if (e.state === 'inherited') {
    ctx.globalAlpha = m;
    strokePolyline(ctx, edgePolyline(e), 6 / sc, C_INK_DARK);
    strokePolyline(ctx, edgePolyline(e), 2.6 / sc, C_INK_LIGHT);
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

function drawRip(g, m) {
  const pts = chainPoints(g);
  const total = pathLength(pts);
  const margin = Math.min(70, total * 0.25);
  const rng = makePrng(hashStr(g.key));
  const W = Math.max(36, Math.min(110, (total - 2 * margin) * 0.14));
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
  const sc = S.cam.scale;
  for (const [endIdx, sDist] of [[0, margin], [pts.length - 1, total - margin]]) {
    const end = pts[endIdx];
    const stubTo = pointAt(pts, sDist);
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

function drawPatchSquare(x, y, seed, m) {
  const rng = makePrng(seed);
  const s = 120 + rng() * 26;
  const sc = S.cam.scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rng() - 0.5) * 0.45);
  ctx.globalAlpha = m;
  ctx.fillStyle = 'rgba(60,50,30,0.18)';
  ctx.fillRect(-s / 2 + 5, -s / 2 + 6, s, s);
  ctx.fillStyle = C_PATCH;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeStyle = C_STITCH;
  ctx.lineWidth = 1.6 / sc;
  ctx.setLineDash([12 / sc, 9 / sc]);
  ctx.strokeRect(-s / 2 + 8, -s / 2 + 8, s - 16, s - 16);
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

  resetTransform();
  ctx.globalAlpha = 0.95 * m;
  ctx.fillStyle = C_PARCHMENT;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // aged corners
  const cg = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35,
    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.8);
  cg.addColorStop(0, 'rgba(120,90,40,0)');
  cg.addColorStop(1, 'rgba(120,90,40,0.22)');
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const rng = makePrng(42);
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = `rgba(90,55,20,${rng() * 0.05})`;
    ctx.beginPath();
    ctx.arc(rng() * canvas.width, rng() * canvas.height, rng() * 1.6 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
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
  // contour whispers on the western heights
  ctx.strokeStyle = 'rgba(120,110,80,0.5)';
  ctx.lineWidth = 1.4 / sc;
  for (const [cx, cy] of [[320, 1120], [1900, 1000]]) {
    for (const r of [90, 150, 210]) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0.4, 2.2); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

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
      ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.setLineDash(S.visited.has(n.id) && !ghost ? [] : [4, 3]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    if (m > 0.7 && S.visited.has(n.id)) {
      ctx.font = `italic 11px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = `rgba(74,58,38,${m})`;
      ctx.fillText(n.name, p.x, p.y + 14);
    }
    ctx.globalAlpha = 1;
  }

  // the chosen home, if it isn't the old den node
  if (S.denSite && S.denId !== 'oldDen') {
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
  // seen but unchosen hollows
  if (!S.denId) {
    for (const id of S.seenDens) {
      const site = DEN_SITES.find(s => s.id === id);
      if (!site || site.id === 'oldDen') continue;
      const p = screenPos(site.x, site.y);
      ctx.globalAlpha = 0.8 * m;
      ctx.strokeStyle = C_NODE;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
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

  if (m > 0.7) {
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
      const g = TEAR_GROUPS.find(g2 => groupTorn(g2) && g2.key !== 'mudspring') || TEAR_GROUPS.find(groupTorn);
      if (!g) return null;
      const pts = chainPoints(g);
      const mid = pointAt(pts, pathLength(pts) / 2);
      return { x: mid.x, y: mid.y };
    }
    case 'goal': { const wr = NbyId.get('winterRange'); return { x: wr.x, y: wr.y }; }
    case 'gold': return near(S.scent, p => p);
    case 'violet': return near(SCENT_VIOLET, p => p);
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
  }
  ctx.shadowBlur = 0;

  let by = 60;
  if (S.hud.food) { drawBar(20, by, 140, 'FOOD', S.food / 100, S.food < 25 ? '#b0473a' : '#b08d3f'); by += 16; }
  if (S.hud.fear) { drawBar(20, by, 140, 'FEAR', S.fear, '#a5443a'); by += 16; }
  if (S.hud.pups && S.pups && !S.pups.traveling && S.pups.count > 0) {
    drawBar(20, by, 140, `PUPS ×${S.pups.count}`, S.pups.food / 100, '#8d6f4a'); by += 16;
  }
  if (isInjured()) {
    ctx.font = `italic 12px ${FONT}`;
    ctx.fillStyle = onMap ? '#7a2f1a' : '#e8a090';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('hurt — she limps', 20, by + 2);
  }

  if (S.hud.pack) {
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    if (!onMap) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 5; }
    let ry = 18;
    for (const w of S.pack) {
      const glyph = { follow: '', stay: ' · holds', balk: ' · balks!', dead: ' · lost to the road', gone: ' · gone' }[w.state];
      ctx.fillStyle = (w.state === 'dead' || w.state === 'gone')
        ? (onMap ? 'rgba(120,60,45,0.8)' : 'rgba(230,150,130,0.8)') : inkText;
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
  if (S.tut.sawMap) rows.push(['SPACE (hold)', 'remember — her map, and yours']);
  if (S.tut.scentHold > 0.6) rows.push(['E (hold)', 'smell the wind']);
  if (S.tut.usedHold) rows.push(['F', 'the pack holds, or follows']);
  rows.push(['N  N', 'abandon the year']);
  rows.push(['H', 'close this']);
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
}

// ── the ending: the satellite dissolve ───────────────────────────────────────

function endingCamera() {
  const sc = Math.min(canvas.width / WORLD.w, canvas.height / WORLD.h) * 0.94;
  ctx.setTransform(sc, 0, 0, sc,
    canvas.width / 2 - WORLD.w / 2 * sc, canvas.height / 2 - WORLD.h / 2 * sc);
  return sc;
}

function drawSatellite() {
  ctx.fillStyle = '#6a705c';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  const rng = makePrng(99);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(${120 + rng() * 60},${115 + rng() * 40},${70 + rng() * 30},0.25)`;
    ctx.fillRect(rng() * WORLD.w, rng() * WORLD.h, 160 + rng() * 480, 120 + rng() * 340);
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
  const hasLegacy = yearlingAlive && S.yearlingKnows.size > 0;
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
      : 'The winter closed before the map was finished.';
    ctx.fillText(line1, canvas.width / 2, canvas.height / 2 - 66);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = `rgba(200,190,165,${a})`;
    ctx.fillText(`Of the seven, ${survivorCount()} came through the year.`, canvas.width / 2, canvas.height / 2 - 34);
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
  if (S.mode === 'play') drawHUD();
  drawPrompt();
  drawCaption();
  drawHelp();
}
