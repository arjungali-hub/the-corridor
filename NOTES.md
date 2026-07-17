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

## 2026-07-14 (third session)

Prologue (all nine beats, 2D), world doubled + apron, den/pups goal arc, art
rewrite, Arjun's five bug fixes + F-balk exploit fix, prey smoothing/escapes,
bridge-over-road, longer scent trails. Pushed to GitHub
(arjungali-hub/the-corridor, private). TODO.md is the live checklist — the
big pending items: zone-based pack AI + pack hunting, map click routing +
deeper zoom, obstacle-accurate tears, The Bend tear rework, slower tutorial +
scent color lessons, Aspen speed = Sedge.

**Tomorrow's first action:** implement map click routing (mapClick +
Dijkstra over known ink), then the zone pack AI.

## 2026-07-14 (later)

Map is a press-toggle (beat 9 keeps its hold); tasks freeze the calendar
("the day holds"); survival costs decoupled from the 6x clock (pups < half);
zone pack AI + autonomous pack hunting; mud sink grounds the drycreek tear;
road-spanning rip via ripPath; routes persist on the land until arrival;
general-area inking corridors; Twemoji wolf favicon; repo on GitHub
(arjungali-hub/the-corridor). TODO.md is the live checklist.

**Next session's first action:** more human obstacles (fence line, gravel
pit) with footprint-derived tears, then the bible content (rancher thread).

## 2026-07-16

Four-session batch: the rancher thread (homestead, cattle, dogs, hidden
permanent conflict meter, gift-or-rifle payoffs, stakes/sign squeeze),
Silence Zone stealth at the subdivision, Standoff encounters on rival
ground, Lichen at day 100 with northern fragments, the fire set piece
(scripted westward funnel + charred east woods), season-turning howls and
the new one-shot sound set, Beat 6 play-fight. 105-check harness passes
(three consecutive runs; herd-spacing check made time-sampled).

**Next session's first action:** play a full year in the browser — the
rancher/standoff/silence numbers (radii, conflict increments, alarm rate)
are harness-correct but tuned blind.

## 2026-07-16 (playtest feedback batch)

Performance pass (half-res base layer + visible-slice blits, cached
parchment/vignette, sprite-stamped scent glows with cached violet + culling,
world skipped under a raised map). Prologue: seeded scent trails at beat 1
(longer hold), guide chevrons (overlook, den), map gated until taught,
close-and-hold-closed before the hunt, "Run it down.", road sealed until the
truck passes, cut clears the zone anchor. R-twice restart (replaces N),
F/H gated until taught, prompt queue (one voice at a time), den hollows on
the map + clickable routes, contours softened. 108-check harness green x3.

**Next:** browser feel pass on the rancher/standoff/silence numbers.

## Review fixes (2026-07-17)

review fix 2: the ending is the pack's arrival. 'arrived' now needs Aspen at
the range AND every living packmate within 400 (GATHER_R); one-time waits:
'Not yet. The season has not turned.' before WINTER_START, 'Not all of them
are through…' when she's there alone. startEnding snapshots S.endSurvivors
(arrived = who was actually within the radius; failed = alive count), and
survivorCount() returns the snapshot. Harness: early-arrival, stranded-
packmate, snapshot-exclusion, gathered-pack scenarios.

review fix 3: the road. Pack wolves at or headed onto asphalt move at full
lope (240·mult floor) — no ambling mid-road. The conducted crossing is
taught once: first time Aspen is within 260 of the highway in play with the
pack following ('The road. F holds the pack. Cross when it is quiet, then F
calls them through.'), flag saved with the rest of S.tut. Harness: mid-road
displacement at lope, lesson survives save/load.
