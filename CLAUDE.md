# The Corridor

A narrative-systems game: one year in the life of Aspen, a wolf who inherits
her dead mother Willow's mental map of a territory that no longer matches it.
Plain HTML/JS/canvas, no build step, no dependencies — open `index.html`.
The full design bible lives outside the repo; this file is the condensed,
load-bearing version. The thesis (fragmentation devalues inherited knowledge)
is delivered mechanically, never verbally — one editorial sentence exists, on
the ending card.

## Files

- `data.js` — pure data: world geometry, node/edge graph, tear groups,
  obstacles, terrain, pack roster, elk, scent sources. Never mutated.
- `game.js` — constants, state (`S`, rebuilt by `newGame()`), every system,
  audio, save/load, `update(dt)`.
- `render.js` — every drawing function; reads state, `draw()` dispatches on
  `S.mode` (`intro | play | ending`).
- `main.js` — canvas bootstrap, input, frame loop. The loop only starts if
  `requestAnimationFrame` exists, so the whole game runs headless under
  Node's `vm` for testing (stub `document`/`window`/`localStorage`, call
  `update`/`draw` directly).
- `test/harness.js` — the headless harness, 338 checks, no dependencies:
  `npm test` (or `node test/harness.js`). Drives the real keydown handler and
  the real `update(dt)` through the prologue and the year. Must print
  `ALL CHECKS PASSED` before every commit. Three stack traces just before the
  verdict are deliberate (the error-boundary and corrupt-save checks).
- `test/layout-probe.js` — `npm run layout`: reports `data.js` geometry that
  overlaps where it shouldn't. Prints `NO OVERLAPS` when clean. Run it after
  moving anything in `data.js`. See `test/README.md` for what neither can
  verify (feel, real WebAudio policy, touch, anything pre-JS).

## Locked design rules

- **World vs map.** The world view is what is physically around her (terrain,
  trails, the road, cars, elk, the pack). The map is a **held sense-state**:
  hold SPACE — she stops, the camera lifts, the world desaturates, the ink
  renders; release — ~0.5 s blend back. The world never pauses. The map's
  **visible radius scales with local ink density**: generous over known
  ground, tight in the void.
- **Three inks.** Willow's = warm double-stroked amber (`#7A3F12`/`#C7893F`),
  hand-wobbled, **frozen — walking it never changes it**. Aspen's = thin cool
  teal (`#4E7A8C`): unknown → dotted on first full pass, solid at 3 passes,
  decays (solid→dotted after 15 idle days, dotted→void after 25 more).
  Grey = unknowable without risk. Unknown routes exist physically as faint
  world-view trails but never appear on the map until walked.
- **Traversal = coverage.** A pass counts when persistent coverage of an
  edge's corridor (60 u) spans 0.15–0.85, however many visits it takes; then
  coverage resets for the next pass. Partial walks ink partially.
- **Tears trigger on arrival**, at each group's world trigger point — never on
  a map-check. The whole `tearGroup` chain tears at once; interior nodes are
  swallowed by one jagged grey rip; end-node stubs survive; knowledge beyond
  an unreachable tear renders as dashed amber ghost. **Nothing un-tears.**
  The first tear is scripted (map forced up 2.6 s); later tears are a sting +
  half-second world flicker, discovered on the player's next voluntary check.
- **Patches = going around.** A torn group bridges when its two surviving
  end-nodes are connected by **Aspen's own ink** (inherited never counts).
  Paper patch squares stitch at the end-nodes; the rip stays forever.
- **The road can be walked onto** — that is the whole problem with it. Traffic
  runs in learnable waves (~9 s on, ~7 s off). Near-misses raise pack **fear**
  (decays slowly); above 0.55 packmates **balk** at the road edge. A hit
  throws Aspen clear (hurt, terrified, never gory); a hit packmate is lost,
  permanently. The culvert (`Water-Under-Stone`) is the safe unknown detour.
  Elk never cross the highway at all.
- **The hunt**: elk flee all wolves, tire (stamina), and are caught when spent
  and adjacent. Stationed packmates (F = hold/follow) shape the chase. Food is
  shared; ~4.5/day drains it; at 0 for two days Sedge disperses, permanently.
- **Generational encoding**: edges traversed while a yearling (Alder/Fen)
  follows within 420 u are silently added to `S.yearlingKnows`. Never
  surfaced in play; pays off only in the ending.
- **The ending**: reach the Winter Range in winter (day ≥ 271), or the year
  runs out (day > 360). Camera pulls to whole-world satellite-style render;
  Aspen's actual traveled route (from `S.history` pos samples) traces over
  it; Willow's inherited map appears beside it; a dotted line for the next
  generation appears **only if** a surviving yearling walked new routes. Then
  the game's one editorial sentence.
- **Audio**: tear sting (A3 sawtooth + Eb4 square) is the sound of the map
  being wrong — reused by every tear forever. Patch chime = soft G4→D5
  triangles. Near-miss whoosh. No music.
- **Node conventions**: ring + centre dot, den filled/larger; solid ring =
  visited, dashed = uncertain/ghost. Authorship is carried by ink colour only;
  confidence by line/ring style (redundant non-hue encoding).

## What happens when Aspen walks into a mismatched segment?

Nothing happens on the map-check — the map lies until she is committed. When
she physically enters the tear group's trigger zone, the whole zone tears at
once: sting, world flicker, rip on the map, interior nodes swallowed, ghost
ink beyond, permanent. If she had already walked a detour connecting the
group's ends, it bridges instantly — the knowledge already existed.

## Conventions

- `data.js` stays pure data; systems in `game.js`; drawing in `render.js`.
- Deterministic PRNG (mulberry32 + string hash) for every texture/wobble.
- Feel numbers (speeds, decay days, fear rates, wave timing) are named
  constants — tuning is hands-on work, systems are delegable.
- Verify with `npm test` before committing — green, every time. The harness
  proves correctness, never feel: speeds, decay rates, fear rates, crossing
  timing and camera blends are a browser pass. An outside person plays at
  every phase end.
- Every session ends with NOTES.md updated and everything committed **and
  pushed** (standing instruction from Arjun — never ask first).
