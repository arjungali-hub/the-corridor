# Session log

## 2026-07-13 (second session — full restart)

The earlier map-only click prototype was judged a different, simplified
project and deleted (it survives in git history before this restart). Rebuilt
from the design bible as a real-time world + held-map game, and kept going
through the companion systems and the year arc:

- **Core loop**: free movement, held sense-map (stop / lift / desaturate /
  0.5 s release blend, radius from ink density), three inks with hand-wobbled
  inherited strokes, coverage-based traversal, tears-on-arrival with rips,
  ghosts, detour patching, decay, travel history.
- **Companion systems**: traffic waves + pack fear + balking + non-gory hits;
  pack follow on breadcrumb rails (Bram slow, F to station); elk hunt with
  stamina/exhaustion and pack blocking; scent layer (gold prey trails blotted
  by violet human noise that grows each season; red rival marks);
  localStorage save/load.
- **Year arc**: seasons with palette + winter movement penalty, shared food,
  Sedge dispersal under starvation, silent yearling route-copying, and the
  satellite-dissolve ending (traveled route vs Willow's map vs the yearling
  projection, one editorial card, arrived/failed variants).

Verified: 60-check headless harness (Node vm + stubbed DOM/canvas/audio/
storage) drives the real input handlers and update() through the whole year —
all three tears and bridges, a car strike, balk/recover, a kill, decay chain,
save/load round-trip, both endings.

Design decisions made while building (flag if they feel wrong in play):

- Traversal is **persistent coverage**, not a single continuous walk — 8-way
  input can't hold shallow diagonals, and piecewise-walked ground still
  counts as knowledge.
- Near-misses only register once a car has swept past, so an approaching car
  can still become a hit.
- The road is physically walkable everywhere (the gamble); only the culvert
  is safe. Elk never cross — the herd is already severed from the west.
- Aspen survives car hits (hurt + fear + food loss); packmates do not.

Not built yet (parked, in cut-list order): prologue beats 1–9 (Willow, the
inherit interaction, Beat 8), the rancher thread + conflict meter, standoffs
and silence zones, Lichen, the fire, den selection, pup timer, exportable
end-map, music.

**Tomorrow's first action:** play a real year in the browser start to finish
and tune feel numbers (traffic wave rhythm, fear rates, decay days, day
length) — the harness proves correctness, not feel.
