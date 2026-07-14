// The Corridor — world data. Pure data: geometry, graph, obstacles, roster.
// Distances are world units. Everything mutable at runtime is copied out of
// here at newGame(); this file is never written to.

const WORLD = { w: 2600, h: 1800 };

// Landmarks. Names are Aspen's names for places, not human ones.
const NODES = [
  { id: 'den',         x: 1300, y: 900,  name: 'The Den', den: true },

  // Migration route, west to the winter range — crosses the Black River (highway)
  { id: 'aspenStand',  x: 1050, y: 780,  name: 'Aspen Stand' },
  { id: 'oldFord',     x: 800,  y: 820,  name: 'The Old Ford' },
  { id: 'sageFlat',    x: 560,  y: 760,  name: 'Sage Flat' },
  { id: 'farBench',    x: 320,  y: 700,  name: 'Far Bench' },
  { id: 'highMeadow',  x: 160,  y: 560,  name: 'High Meadow' },
  { id: 'winterRange', x: 90,   y: 380,  name: 'Winter Range' },

  // Hunting loop, north — intact ground
  { id: 'birchDraw',   x: 1500, y: 620,  name: 'Birch Draw' },
  { id: 'elkMeadow',   x: 1250, y: 420,  name: 'Elk Meadow' },
  { id: 'ridgeSaddle', x: 950,  y: 500,  name: 'Ridge Saddle' },

  // Boundary loop, east — construction arrived
  { id: 'fenceLine',   x: 1900, y: 800,  name: 'Fence Line' },
  { id: 'dustyRise',   x: 1960, y: 1120, name: 'Dusty Rise' },

  // Water route, south — the creek was diverted
  { id: 'cutbank',     x: 1450, y: 1150, name: 'Cutbank' },
  { id: 'theBend',     x: 1350, y: 1400, name: 'The Bend' },
  { id: 'gravelBar',   x: 1100, y: 1500, name: 'Gravel Bar' },

  // Detour geography — unremarkable side-country until it is the only way
  { id: 'willowSlough', x: 700,  y: 1150, name: 'Willow Slough' },
  { id: 'culvert',      x: 460,  y: 1230, name: 'Water-Under-Stone' },
  { id: 'stonyBench',   x: 300,  y: 1050, name: 'Stony Bench' },
  { id: 'reeds',        x: 1600, y: 1350, name: 'The Reeds' },
  { id: 'springs',      x: 1720, y: 1520, name: 'Warm Springs' },
  { id: 'brokenOak',    x: 2280, y: 700,  name: 'Broken Oak' },
];

// state: 'inherited' (Willow's frozen ink) or 'unknown' (grey void).
const EDGES = [
  // Migration (6 segments)
  { id: 'den-aspenStand',      a: 'den',         b: 'aspenStand',  state: 'inherited', tearGroup: null },
  { id: 'aspenStand-oldFord',  a: 'aspenStand',  b: 'oldFord',     state: 'inherited', tearGroup: null },
  { id: 'oldFord-sageFlat',    a: 'oldFord',     b: 'sageFlat',    state: 'inherited', tearGroup: 'blackriver' },
  { id: 'sageFlat-farBench',   a: 'sageFlat',    b: 'farBench',    state: 'inherited', tearGroup: 'blackriver' },
  { id: 'farBench-highMeadow', a: 'farBench',    b: 'highMeadow',  state: 'inherited', tearGroup: null },
  { id: 'highMeadow-winterRange', a: 'highMeadow', b: 'winterRange', state: 'inherited', tearGroup: null },

  // Hunting loop
  { id: 'den-birchDraw',       a: 'den',         b: 'birchDraw',   state: 'inherited', tearGroup: null },
  { id: 'birchDraw-elkMeadow', a: 'birchDraw',   b: 'elkMeadow',   state: 'inherited', tearGroup: null },
  { id: 'elkMeadow-ridgeSaddle', a: 'elkMeadow', b: 'ridgeSaddle', state: 'inherited', tearGroup: null },
  { id: 'ridgeSaddle-den',     a: 'ridgeSaddle', b: 'den',         state: 'inherited', tearGroup: null },
  { id: 'ridgeSaddle-aspenStand', a: 'ridgeSaddle', b: 'aspenStand', state: 'unknown', tearGroup: null },

  // Boundary loop
  { id: 'birchDraw-fenceLine', a: 'birchDraw',   b: 'fenceLine',   state: 'inherited', tearGroup: 'machines' },
  { id: 'fenceLine-dustyRise', a: 'fenceLine',   b: 'dustyRise',   state: 'inherited', tearGroup: 'machines' },
  { id: 'dustyRise-cutbank',   a: 'dustyRise',   b: 'cutbank',     state: 'inherited', tearGroup: null },

  // Water route
  { id: 'den-cutbank',         a: 'den',         b: 'cutbank',     state: 'inherited', tearGroup: null },
  { id: 'cutbank-theBend',     a: 'cutbank',     b: 'theBend',     state: 'inherited', tearGroup: 'drycreek' },
  { id: 'theBend-gravelBar',   a: 'theBend',     b: 'gravelBar',   state: 'inherited', tearGroup: 'drycreek' },
  { id: 'gravelBar-den',       a: 'gravelBar',   b: 'den',         state: 'inherited', tearGroup: null },

  // Detours (grey void until walked)
  { id: 'oldFord-willowSlough',   a: 'oldFord',      b: 'willowSlough', state: 'unknown', tearGroup: null },
  { id: 'willowSlough-culvert',   a: 'willowSlough', b: 'culvert',      state: 'unknown', tearGroup: null },
  { id: 'culvert-stonyBench',     a: 'culvert',      b: 'stonyBench',   state: 'unknown', tearGroup: null },
  { id: 'stonyBench-farBench',    a: 'stonyBench',   b: 'farBench',     state: 'unknown', tearGroup: null },
  { id: 'cutbank-reeds',          a: 'cutbank',      b: 'reeds',        state: 'unknown', tearGroup: null },
  { id: 'reeds-springs',          a: 'reeds',        b: 'springs',      state: 'unknown', tearGroup: null },
  { id: 'springs-gravelBar',      a: 'springs',      b: 'gravelBar',    state: 'unknown', tearGroup: null },
  { id: 'birchDraw-brokenOak',    a: 'birchDraw',    b: 'brokenOak',    state: 'unknown', tearGroup: null },
  { id: 'brokenOak-dustyRise',    a: 'brokenOak',    b: 'dustyRise',    state: 'unknown', tearGroup: null },
];

// A tear group is a chain of segments that fails as one zone. `chain` is the
// node path (interior nodes are swallowed by the rip); `trigger` is where the
// world contradicts the memory — entering it while untorn tears the group.
const TEAR_GROUPS = [
  { key: 'blackriver', edges: ['oldFord-sageFlat', 'sageFlat-farBench'],
    chain: ['oldFord', 'sageFlat', 'farBench'],
    trigger: { x: 520, y: 750, r: 90 } },
  { key: 'machines',   edges: ['birchDraw-fenceLine', 'fenceLine-dustyRise'],
    chain: ['birchDraw', 'fenceLine', 'dustyRise'],
    trigger: { x: 1800, y: 770, r: 90 } },
  { key: 'drycreek',   edges: ['cutbank-theBend', 'theBend-gravelBar'],
    chain: ['cutbank', 'theBend', 'gravelBar'],
    trigger: { x: 1355, y: 1390, r: 85 } },
];

const OBSTACLES = {
  // The Black River That Roars. Wolves may enter (and be hit); the culvert
  // gap passes under it safely. Elk never cross at all.
  highway: { x0: 430, x1: 490, gapY0: 1180, gapY1: 1280 },
  // Groundwork for something Aspen has no word for.
  construction: { x0: 1820, y0: 720, x1: 2020, y1: 980 },
  // Rooflines, southeast. Impassable fenced ground.
  subdivision: { x0: 2140, y0: 1380, x1: 2420, y1: 1620 },
};

const TERRAIN = {
  creekFlow: [[1620, 0], [1580, 300], [1620, 600], [1560, 900], [1520, 1150], [1620, 1300], [1700, 1450], [1720, 1520]],
  creekDry:  [[1520, 1150], [1420, 1330], [1350, 1400], [1200, 1470], [1100, 1500], [900, 1600]],
  wash:      [[760, 1120], [600, 1180], [460, 1230], [340, 1180], [300, 1050]],
  springsPond: { x: 1720, y: 1520, r: 55 },
  forests: [
    { x: 1700, y: 280, r: 190 }, { x: 1450, y: 200, r: 140 }, { x: 1950, y: 420, r: 150 },
    { x: 240, y: 1450, r: 170 }, { x: 480, y: 1620, r: 130 },
    { x: 120, y: 220, r: 150 }, { x: 320, y: 120, r: 120 },
    { x: 900, y: 1350, r: 110 }, { x: 2350, y: 1000, r: 130 },
  ],
};

// The pack. Aspen is the player; these follow on rails.
// yearling: routes walked while they follow are silently copied to their map.
const PACK_DEF = [
  { id: 'bram',  name: 'Bram',  mult: 0.80, yearling: false },
  { id: 'sedge', name: 'Sedge', mult: 1.12, yearling: false },
  { id: 'alder', name: 'Alder', mult: 1.00, yearling: true },
  { id: 'fen',   name: 'Fen',   mult: 1.00, yearling: true },
];

const ELK_DEF = { anchor: { x: 1250, y: 380 }, count: 5, leash: 420, respawnDays: 18 };

// Scent geography. Violet = human chemical noise: volumetric, directionless.
// Radii scale up each season — the year-long squeeze.
const SCENT_VIOLET = [
  { x: 460, y: 250,  r: 300 }, { x: 460, y: 620,  r: 300 }, { x: 460, y: 980,  r: 300 },
  { x: 460, y: 1500, r: 300 },
  { x: 1920, y: 850,  r: 360 },
  { x: 2280, y: 1500, r: 360 },
];
// Red = rival pack marks, along the northeast edge of the territory.
const SCENT_RED = [
  { x: 2350, y: 300 }, { x: 2200, y: 180 }, { x: 2480, y: 460 }, { x: 2520, y: 720 },
];
