// The Corridor — world data. Pure data: geometry, graph, obstacles, roster.
// Distances are world units. Everything mutable at runtime is copied out of
// here at newGame(); this file is never written to.

const WORLD = { x0: -2400, w: 5200, h: 3600 };  // x0: the far west, won in Act IV

// Landmarks. Names are Aspen's names for places, not human ones.
const NODES = [
  { id: 'den',         x: 2600, y: 1800, name: 'The Old Den', den: true },

  // Migration route, west to the winter range — crosses the Black River (highway)
  { id: 'aspenStand',  x: 2100, y: 1560, name: 'Aspen Stand' },
  { id: 'oldFord',     x: 1600, y: 1640, name: 'The Old Ford' },
  { id: 'sageFlat',    x: 1120, y: 1520, name: 'Sage Flat' },
  { id: 'farBench',    x: 640,  y: 1400, name: 'Far Bench' },
  { id: 'highMeadow',  x: 320,  y: 1120, name: 'High Meadow' },

  // The far west: the last long miles to the winter range, across the rail
  { id: 'ashSaddle',   x: -700,  y: 1000, name: 'Ash Saddle' },
  { id: 'winterRange', x: -1900, y: 900,  name: 'Winter Range' },
  { id: 'longSlope',   x: -560,  y: 2150, name: 'Long Slope' },
  { id: 'railGap',     x: -1080, y: 3020, name: 'The Trestle' },
  { id: 'coldRise',    x: -1750, y: 2050, name: 'Cold Rise' },

  // Hunting loop, north — intact ground
  { id: 'birchDraw',   x: 3000, y: 1240, name: 'Birch Draw' },
  { id: 'elkMeadow',   x: 2500, y: 840,  name: 'Elk Meadow' },
  { id: 'ridgeSaddle', x: 1900, y: 1000, name: 'Ridge Saddle' },

  // Boundary loop, east — construction arrived
  { id: 'fenceLine',   x: 3800, y: 1600, name: 'Fence Line' },
  { id: 'dustyRise',   x: 3920, y: 2240, name: 'Dusty Rise' },

  // Water route, south — the creek was diverted
  { id: 'cutbank',     x: 2900, y: 2300, name: 'Cutbank' },
  { id: 'theBend',     x: 2700, y: 2800, name: 'The Bend' },
  { id: 'gravelBar',   x: 2200, y: 3000, name: 'Gravel Bar' },

  // Detour geography — unremarkable side-country until it is the only way
  { id: 'willowSlough', x: 1400, y: 2300, name: 'Willow Slough' },
  { id: 'culvert',      x: 920,  y: 2460, name: 'Water-Under-Stone' },
  { id: 'stonyBench',   x: 600,  y: 2100, name: 'Stony Bench' },
  { id: 'reeds',        x: 3200, y: 2700, name: 'The Reeds' },
  { id: 'springs',      x: 3440, y: 3040, name: 'Warm Springs' },
  { id: 'brokenOak',    x: 4560, y: 1400, name: 'Broken Oak' },

  // The wider land — grey void until she walks it
  { id: 'northRidge',  x: 2100, y: 340,  name: 'North Ridge' },
  { id: 'blackPines',  x: 3100, y: 300,  name: 'Black Pines' },
  { id: 'longMarsh',   x: 3700, y: 3300, name: 'Long Marsh' },
  { id: 'saltLick',    x: 4150, y: 2760, name: 'Salt Lick' },
  { id: 'lowFlats',    x: 800,  y: 3150, name: 'Low Flats' },
  { id: 'sandbar',     x: 2800, y: 3320, name: 'Sand Bar' },

  // A small spur Willow's map still shows — already torn when the game opens
];

// state: 'inherited' (Willow's frozen ink) or 'unknown' (grey void).
const EDGES = [
  // Migration (6 segments)
  { id: 'den-aspenStand',      a: 'den',         b: 'aspenStand',  state: 'inherited', tearGroup: null },
  { id: 'aspenStand-oldFord',  a: 'aspenStand',  b: 'oldFord',     state: 'inherited', tearGroup: null },
  { id: 'oldFord-sageFlat',    a: 'oldFord',     b: 'sageFlat',    state: 'inherited', tearGroup: 'blackriver' },
  { id: 'sageFlat-farBench',   a: 'sageFlat',    b: 'farBench',    state: 'inherited', tearGroup: 'blackriver' },
  { id: 'farBench-highMeadow', a: 'farBench',    b: 'highMeadow',  state: 'inherited', tearGroup: null },
  { id: 'highMeadow-ashSaddle', a: 'highMeadow', b: 'ashSaddle',   state: 'inherited', tearGroup: null },
  { id: 'ashSaddle-winterRange', a: 'ashSaddle', b: 'winterRange', state: 'inherited', tearGroup: 'railline' },

  // The far west's grey void: the long way around the rail, through the
  // trestle — new ground that must be walked into ink
  { id: 'ashSaddle-longSlope',  a: 'ashSaddle',  b: 'longSlope',   state: 'unknown', tearGroup: null },
  { id: 'longSlope-railGap',    a: 'longSlope',  b: 'railGap',     state: 'unknown', tearGroup: null },
  { id: 'railGap-coldRise',     a: 'railGap',    b: 'coldRise',    state: 'unknown', tearGroup: null },
  { id: 'coldRise-winterRange', a: 'coldRise',   b: 'winterRange', state: 'unknown', tearGroup: null },

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

  // The torn spur — inherited ink into a wound, from the very first map-check

  // Detours (grey void until walked)
  { id: 'oldFord-willowSlough',   a: 'oldFord',      b: 'willowSlough', state: 'unknown', tearGroup: null },
  { id: 'willowSlough-culvert',   a: 'willowSlough', b: 'culvert',      state: 'unknown', tearGroup: null },
  { id: 'culvert-stonyBench',     a: 'culvert',      b: 'stonyBench',   state: 'unknown', tearGroup: null },
  { id: 'stonyBench-farBench',    a: 'stonyBench',   b: 'farBench',     state: 'unknown', tearGroup: null },
  { id: 'cutbank-reeds',          a: 'cutbank',      b: 'reeds',        state: 'unknown', tearGroup: null },
  { id: 'reeds-springs',          a: 'reeds',        b: 'springs',      state: 'unknown', tearGroup: null },
  { id: 'springs-sandbar',        a: 'springs',      b: 'sandbar',      state: 'unknown', tearGroup: null },
  { id: 'sandbar-gravelBar',      a: 'sandbar',      b: 'gravelBar',    state: 'unknown', tearGroup: null },
  { id: 'birchDraw-brokenOak',    a: 'birchDraw',    b: 'brokenOak',    state: 'unknown', tearGroup: null },
  { id: 'brokenOak-dustyRise',    a: 'brokenOak',    b: 'dustyRise',    state: 'unknown', tearGroup: null },

  // The wider land
  { id: 'elkMeadow-northRidge',   a: 'elkMeadow',    b: 'northRidge',   state: 'unknown', tearGroup: null },
  { id: 'northRidge-ridgeSaddle', a: 'northRidge',   b: 'ridgeSaddle',  state: 'unknown', tearGroup: null },
  { id: 'northRidge-blackPines',  a: 'northRidge',   b: 'blackPines',   state: 'unknown', tearGroup: null },
  { id: 'blackPines-birchDraw',   a: 'blackPines',   b: 'birchDraw',    state: 'unknown', tearGroup: null },
  { id: 'springs-longMarsh',      a: 'springs',      b: 'longMarsh',    state: 'unknown', tearGroup: null },
  { id: 'longMarsh-saltLick',     a: 'longMarsh',    b: 'saltLick',     state: 'unknown', tearGroup: null },
  { id: 'saltLick-dustyRise',     a: 'saltLick',     b: 'dustyRise',    state: 'unknown', tearGroup: null },
  { id: 'stonyBench-lowFlats',    a: 'stonyBench',   b: 'lowFlats',     state: 'unknown', tearGroup: null },
  { id: 'lowFlats-gravelBar',     a: 'lowFlats',     b: 'gravelBar',    state: 'unknown', tearGroup: null },
  { id: 'highMeadow-stonyBench',  a: 'highMeadow',   b: 'stonyBench',   state: 'unknown', tearGroup: null },
];

// A tear group is a chain of segments that fails as one zone. `chain` is the
// node path (interior nodes are swallowed by the rip); `trigger` is where the
// world contradicts the memory — entering it while untorn tears the group.
// Triggers sit clear of the asphalt: the tear must never fire while she is
// standing in traffic.
const TEAR_GROUPS = [
  // ripPath: the rip on the map follows the obstacle itself — the whole
  // road, from the north edge down to the bridge (the one stitch that holds).
  { key: 'blackriver', edges: ['oldFord-sageFlat', 'sageFlat-farBench'],
    chain: ['oldFord', 'sageFlat', 'farBench'],
    trigger: { x: 1180, y: 1510, r: 100 },
    ripPath: [[920, 60], [920, 1200], [920, 2340]] },
  // The rail line: the far west's wall. Her mother's last miles cross it;
  // the only way under is the trestle, far to the south.
  { key: 'railline', edges: ['ashSaddle-winterRange'],
    chain: ['ashSaddle', 'winterRange'],
    trigger: { x: -1100, y: 950, r: 240 },
    ripPath: [[-1100, -400], [-1100, 1600], [-1100, 2960]] },
  // footprint: the trigger is derived from the obstacle itself at newGame
  { key: 'machines',   edges: ['birchDraw-fenceLine', 'fenceLine-dustyRise'],
    chain: ['birchDraw', 'fenceLine', 'dustyRise'],
    footprint: 'construction',
    trigger: { x: 3600, y: 1545, r: 110 } },
  { key: 'drycreek',   edges: ['cutbank-theBend', 'theBend-gravelBar'],
    chain: ['cutbank', 'theBend', 'gravelBar'],
    footprint: 'mudSink',
    trigger: { x: 2710, y: 2780, r: 95 } },
  { key: 'gravelpit',  edges: ['elkMeadow-ridgeSaddle'],
    chain: ['elkMeadow', 'ridgeSaddle'],
    footprint: 'gravelPit',
    trigger: { x: 2200, y: 920, r: 190 } },
];

const OBSTACLES = {
  // The Black River That Roars. Wolves may enter (and be hit); the culvert
  // gap passes under it safely. Prey never crosses at all.
  highway: { x0: 890, x1: 950, gapY0: 2380, gapY1: 2540 },
  // What the machines were building all year: a wildlife overpass on the
  // north stretch. Earth over the asphalt from OVERPASS_OPEN_DAY on —
  // anything may cross above the traffic there.
  overpass: { y0: 620, y1: 760 },
  // The rail line: the far west's wall, fenced ballast pole to pole. One
  // way under — the trestle, far south. Nothing crosses anywhere else.
  rail: { x0: -1130, x1: -1070, gapY0: 2940, gapY1: 3110 },
  // Groundwork for something Aspen has no word for.
  construction: { x0: 3640, y0: 1440, x1: 4040, y1: 1960 },
  // Rooflines, southeast. Impassable fenced ground.
  subdivision: { x0: 4280, y0: 2760, x1: 4840, y1: 3240 },
  // Where they diverted the creek, a bermed dredge impoundment drowned the
  // Bend — the human truth behind the drycreek tear. Nothing walks through.
  mudSink: { x: 2700, y: 2800, r: 340 },
  // A gravel pit, opened in the saddle between the elk meadow and the ridge:
  // the hunting loop's own wound.
  gravelPit: { x0: 2080, y0: 800, x1: 2320, y1: 1040 },
  // A ranch fence along the northeast — the rancher's edge of the world.
  fence: { x0: 4400, y0: 300, x1: 5100, y1: 900 },
};

const TERRAIN = {
  creekFlow: [[3240, 0], [3160, 600], [3240, 1200], [3120, 1800], [3040, 2300],
              [3240, 2600], [3400, 2900], [3440, 3040], [3560, 3200], [3700, 3300]],
  creekDry:  [[3040, 2300], [2840, 2660], [2700, 2800], [2400, 2940], [2200, 3000], [1800, 3200]],
  wash:      [[1520, 2240], [1200, 2360], [920, 2460], [680, 2360], [600, 2100]],
  springsPond: { x: 3440, y: 3040, r: 80 },
  forests: [
    { x: 3400, y: 560,  r: 300 }, { x: 2900, y: 400,  r: 220 }, { x: 3900, y: 840,  r: 240 },
    { x: 480,  y: 2900, r: 270 }, { x: 960,  y: 3240, r: 210 }, { x: 240,  y: 440,  r: 240 },
    { x: 640,  y: 240,  r: 190 }, { x: 1800, y: 2700, r: 175 }, { x: 4700, y: 2000, r: 210 },
    { x: 2000, y: 200,  r: 260 }, { x: 2600, y: 150,  r: 200 }, { x: 1200, y: 500,  r: 230 },
    { x: 4200, y: 3300, r: 240 }, { x: 3300, y: 3500, r: 200 }, { x: 700,  y: 1700, r: 200 },
    { x: 4600, y: 700,  r: 260 }, { x: 5000, y: 1600, r: 230 }, { x: 1500, y: 3400, r: 240 },
    { x: 2500, y: 3350, r: 190 }, { x: 4950, y: 2600, r: 200 },
    // the far west, past the rail: older, colder woods
    { x: -500,  y: 500,  r: 280 }, { x: -900,  y: 1800, r: 240 },
    { x: -1600, y: 400,  r: 260 }, { x: -2100, y: 1400, r: 250 },
    { x: -1900, y: 2700, r: 270 }, { x: -400,  y: 2900, r: 220 },
    { x: -2100, y: 3200, r: 230 }, { x: -1400, y: 1200, r: 190 },
  ],
};

// The pack. Aspen is the player; these follow on rails.
// yearling: routes walked while they follow are silently copied to their map.
const PACK_DEF = [
  { id: 'bram',  name: 'Bram',  mult: 0.80, yearling: false },
  { id: 'sedge', name: 'Sedge', mult: 1.08, yearling: false },   // prey-pace, no faster
  { id: 'alder', name: 'Alder', mult: 1.00, yearling: true },
  { id: 'fen',   name: 'Fen',   mult: 1.00, yearling: true },
];

// Four herds across the widened land, so hunting is never finished and never
// exhausted: elk north and west of the river, deer south and east.
const HERDS = [
  { anchor: { x: 2500, y: 760 },  count: 6, leash: 500, respawnDays: 7, food: 45, size: 16, speed: 272, antlers: true },
  { anchor: { x: 1560, y: 3120 }, count: 5, leash: 420, respawnDays: 5, food: 26, size: 11, speed: 296, antlers: false },
  { anchor: { x: 700,  y: 2950 }, count: 4, leash: 420, respawnDays: 7, food: 45, size: 16, speed: 272, antlers: true },
  { anchor: { x: 4050, y: 2400 }, count: 4, leash: 350, respawnDays: 5, food: 26, size: 11, speed: 296, antlers: false },
  // The rancher's cattle, grazing outside the wire. Slow, rich, and watched:
  // taking one is arithmetic he will do.
  { anchor: { x: 4120, y: 830 },  count: 4, leash: 260, respawnDays: 20, food: 60, size: 18, speed: 190, antlers: false, cattle: true },
];

// The rancher's homestead, behind the fence. He is weather, not a character.
const RANCH = {
  house: { x: 4750, y: 470 },
  dogHome: { x: 4690, y: 560 },
  giftSpot: { x: 4460, y: 660 },
};

// Candidate den sites — spring's bet. Each is a distance argument: near the
// hunts, near the water, or the known middle ground. No hidden modifiers;
// geography is the consequence.
// The powerline cut: a strip of forest cleared pole to pole, feeding the
// subdivision from the construction ground. Open, silent, humming — prey
// will not graze in it.
const POWERLINE = { x0: 4000, y0: 1900, x1: 4400, y1: 2800 };

// Water. The clean sources are the land's own; the fouled ones sit
// downstream of what people built — drink there and sickness follows.
const WATER_SOURCES = [
  { x: 1560, y: 1180, r: 110, clean: true,  name: 'the springs' },
  { x: 1120, y: 2120, r: 130, clean: true,  name: 'the creek' },
  { x: 3350, y: 3150, r: 140, clean: true,  name: 'the marsh' },
  { x: 2700, y: 3260, r: 120, clean: false, name: 'the dead channel' },  // below the impoundment
  { x: 2200, y: 1150, r: 90,  clean: false, name: 'the pit sump' },      // gravel-pit runoff
  { x: 4180, y: 950,  r: 90,  clean: false, name: 'the stock pond' },    // cattle-fouled
  { x: -1550, y: 1750, r: 120, clean: true, name: 'the cold creek' },    // the far west's own
];

const DEN_SITES = [
  { id: 'oldDen',   x: 2600, y: 1800, name: 'The Old Den' },
  { id: 'ridgeDen', x: 2120, y: 1140, name: 'Ridge Hollow' },
  { id: 'bankDen',  x: 2340, y: 2660, name: 'Bank Hollow' },
];

// Scent geography. Violet = human chemical noise: volumetric, directionless.
// Radii scale up each season — the year-long squeeze.
const SCENT_VIOLET = [
  { x: 920,  y: 500,  r: 520 }, { x: 920,  y: 1240, r: 520 }, { x: 920,  y: 1960, r: 520 },
  { x: 920,  y: 3000, r: 520 },
  { x: 3840, y: 1700, r: 620 },
  { x: 4560, y: 3000, r: 620 },
  { x: 2200, y: 920,  r: 420 },   // the gravel pit's dust and diesel
  { x: 2700, y: 2800, r: 460 },   // the impoundment's chemical rot
];
// Red = rival pack marks, along the northeast edge of the territory.
const SCENT_RED = [
  { x: 4700, y: 600 }, { x: 4400, y: 360 }, { x: 4960, y: 920 }, { x: 5040, y: 1440 },
];
