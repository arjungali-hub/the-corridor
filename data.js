const nodes = [
  { id: 0,  x: 400,  y: 200, name: 'Alpha',   isDen: true },
  { id: 1,  x: 620,  y: 360, name: 'Beta' },
  { id: 2,  x: 530,  y: 580, name: 'Gamma' },
  { id: 3,  x: 270,  y: 580, name: 'Delta' },
  { id: 4,  x: 80,   y: 360, name: 'Epsilon' },
  { id: 5,  x: 750,  y: 200, name: 'Zeta' },     // unconfirmed; only via unknown edge from Beta
  { id: 6,  x: -140, y: 360, name: 'Eta' },       // straight beyond the Epsilon tear
  { id: 7,  x: -320, y: 360, name: 'Theta' },
  { id: 8,  x: -500, y: 360, name: 'Iota' },
  { id: 9,  x: -680, y: 360, name: 'Kappa' },
  { id: 10, x: -860, y: 360, name: 'Lambda' },
  { id: 11, x: 480,  y: 760, name: 'Mu' },        // detour, off to the side of the highway tear
  { id: 12, x: 220,  y: 760, name: 'Nu' },        // detour

  // Hunting loop — north of the den; intact inherited ground, no planned tear
  { id: 13, x: 250,  y: 20,  name: 'Xi' },
  { id: 14, x: 560,  y: -10, name: 'Omicron' },

  // Water route — southeast; tears as the 'creek' group (Rho is swallowed)
  { id: 15, x: 820,  y: 480, name: 'Pi' },
  { id: 16, x: 900,  y: 660, name: 'Rho' },
  { id: 17, x: 1020, y: 840, name: 'Sigma' },     // detour around the creek tear (outside the bend)
];

const edges = [
  { id: 0,  a: 0,  b: 1,  state: 'inherited', days: 1, expected: 'open', actual: 'open',    tearGroup: null },
  { id: 1,  a: 1,  b: 2,  state: 'inherited', days: 1, expected: 'open', actual: 'blocked', tearGroup: 'highway' },
  { id: 2,  a: 2,  b: 3,  state: 'inherited', days: 1, expected: 'open', actual: 'blocked', tearGroup: 'highway' },
  { id: 3,  a: 3,  b: 4,  state: 'inherited', days: 1, expected: 'open', actual: 'blocked', tearGroup: 'highway' },
  { id: 4,  a: 4,  b: 0,  state: 'inherited', days: 1, expected: 'open', actual: 'open',    tearGroup: null },
  { id: 5,  a: 0,  b: 2,  state: 'inherited', days: 2, expected: 'open', actual: 'open',    tearGroup: null },
  { id: 6,  a: 1,  b: 3,  state: 'unknown',   days: 1, expected: 'open', actual: 'open',    tearGroup: null },
  { id: 7,  a: 1,  b: 5,  state: 'unknown',   days: 1, expected: 'open', actual: 'open',    tearGroup: null },

  // Straight chain beyond Epsilon — Epsilon→Eta→Theta→Iota tear together as
  // one wide rift (swallowing Eta and Theta); the rest becomes ghost memory
  { id: 8,  a: 4,  b: 6,  state: 'inherited', days: 1, expected: 'open', actual: 'blocked', tearGroup: 'rift' },
  { id: 9,  a: 6,  b: 7,  state: 'inherited', days: 1, expected: 'open', actual: 'blocked', tearGroup: 'rift' },
  { id: 10, a: 7,  b: 8,  state: 'inherited', days: 1, expected: 'open', actual: 'blocked', tearGroup: 'rift' },
  { id: 11, a: 8,  b: 9,  state: 'inherited', days: 1, expected: 'open', actual: 'open',    tearGroup: null },
  { id: 12, a: 9,  b: 10, state: 'inherited', days: 1, expected: 'open', actual: 'open',    tearGroup: null },

  // Detour around the highway tear zone — unused until the highway tears
  { id: 13, a: 1,  b: 11, state: 'unknown',   days: 3, expected: 'open', actual: 'open',    tearGroup: null },
  { id: 14, a: 11, b: 12, state: 'unknown',   days: 2, expected: 'open', actual: 'open',    tearGroup: null },
  { id: 15, a: 12, b: 4,  state: 'unknown',   days: 3, expected: 'open', actual: 'open',    tearGroup: null },

  // Hunting loop — den → Xi → Omicron → den; all intact
  { id: 16, a: 0,  b: 13, state: 'inherited', days: 1, expected: 'open', actual: 'open',    tearGroup: null },
  { id: 17, a: 13, b: 14, state: 'inherited', days: 1, expected: 'open', actual: 'open',    tearGroup: null },
  { id: 18, a: 14, b: 0,  state: 'inherited', days: 1, expected: 'open', actual: 'open',    tearGroup: null },

  // Water route — Beta → Pi → Rho → Mu; Pi→Rho→Mu tears as one 'creek' group
  { id: 19, a: 1,  b: 15, state: 'inherited', days: 1, expected: 'open', actual: 'open',    tearGroup: null },
  { id: 20, a: 15, b: 16, state: 'inherited', days: 1, expected: 'open', actual: 'blocked', tearGroup: 'creek' },
  { id: 21, a: 16, b: 11, state: 'inherited', days: 1, expected: 'open', actual: 'blocked', tearGroup: 'creek' },

  // Detour around the creek tear — unknown, higher day cost
  { id: 22, a: 15, b: 17, state: 'unknown',   days: 2, expected: 'open', actual: 'open',    tearGroup: null },
  { id: 23, a: 17, b: 11, state: 'unknown',   days: 3, expected: 'open', actual: 'open',    tearGroup: null },
];
