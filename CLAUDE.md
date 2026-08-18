# The Corridor

A narrative-systems game: one year in the life of Aspen, a wolf who inherits
her dead mother Willow's mental map of a territory that no longer matches it.

**In progress: the fun pass (TODO Part 32).** The game was finished and worked,
and was not fun — two verbs, neither deepening over a year. Parts 1–7 add a hunt
with a skill ceiling, prey species, a pack that grows, a bloodline across years,
goals, juice, and a rebalance. Some austerity is being spent **on purpose and
with authorization**: numbers appear on screen, a level-up is a small
celebration. Where the choice is "satisfying" vs "restrained", choose
satisfying — the thesis survives because the new systems carry it (the
bloodline), not because the game stays quiet. Locked rules below are amended as
each part lands; anything marked *superseded* was deliberately replaced.
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
- **The BLOODLINE** (Part 32/4, superseding "a year is the whole game"). A year
  ends; the line does not. `LEGACY` lives under its own key
  (`the-corridor-legacy-v1`) that neither `clearSave()` nor New Year touches — only
  an explicit "forget the bloodline" on the legacy page. Every ending, including
  `failed` and `dead`, banks the year: survivors become **heirs** carrying half of
  what they became (a surviving yearling is an adult now and keeps it), the roster
  is topped up to four with untried newcomers, and every edge she walked to
  **solid** ink becomes the next generation's **inherited amber**. Then the land
  moves again: one more escalation footprint stands per generation (capped at four,
  and a flood-fill check proves the winter range stays reachable), and it **tears
  one of the ways she earned** — the prologue's blow, dealt to the player's own map
  with their own miles in it. That is the thesis as a loop, not an ending flourish;
  it must not be softened into a bonus.
  Flow: ending card → the bloodline page → the next year. Unlocks are modest and
  never gate the game (the long year, a strong start after a clean year, names
  remembered at `prime`, the legacy map at three generations).
- **The pack GROWS** (Part 32/3, superseding "the pack only ever shrinks"). Every
  wolf, Aspen included, carries three counters — `hunting`, `nerve`, `endurance` —
  earned only by doing: hunting at kills it was part of (+2 on it, +1 merely near),
  nerve at barriers crossed without balking or being hit and at lines held, and
  endurance at distance walked. Tiers at 15 / 40 / 80 (`untried`, `capable`,
  `seasoned`, `prime`) drive chase speed, how fast prey is worn down, the fear a
  wolf will still cross at (`nerveBalk` replaced the flat `FEAR_BALK`), what it
  costs to keep, and how well it travels. `capable` is exactly the old baseline, so
  a mid-year pack plays as the game always did.
  **Yearlings** start at `youth` 0.55, which scales what their hunting and nerve
  are WORTH and how they move; it rises only through participation, so a protected
  yearling ends the year still a child while an invested one becomes a hunter.
  That trade is the point — do not add a way to buy it.
  There is **no resurrection or replacement**: losing a wolf you raised is meant to
  cost a real capability. `w.onHunt` is the "currently chasing" flag; `w.hunting`
  is the trait (they collided once).
  Tier-ups **queue** (`S.tierQueue` / `tierUpTick`) and wait for a free voice —
  `say()` is one line, and announcing on the spot stomped whatever the land was
  already telling her.
- **Four prey species** (Part 32/2), each asking for something different, so there
  is never one answer. `HERDS` carries `species` plus `detectR`, `ambushR` and
  `stam` (how fast a running animal spends itself). **Elk** — rich and
  long-winded, and **one wolf cannot bring one down**: the catch is refused and
  the animal turns, with a 35% chance of a wound, doubled if she came at it
  head-on. That is what teaches the pack. **Deer** — takeable alone, but only off
  a clean stalk: `detectR` 420 makes wind and cover compulsory. **Hare** —
  scattered singletons over the whole land, all year, near cover; an ambush takes
  one outright with no chase, for almost no meat. It is the floor under a bad
  winter and the reason a ruined pack still has something to do. **Cattle** —
  slow, rich, and watched; the ledger is unchanged. Availability is per species
  (`respawnMult` scales the respawn DELAY, and 0 means gone for the season), which
  is what gives the year its curve: summer fat, autumn asking for pack elk hunts,
  winter down to hares and nerve.
- **`hunters` holds the real wolves, never copies.** It once held `{x, y}` for
  Aspen, and every rule that reads a wolf's state silently read nothing — the
  crouch did nothing in play while its unit check passed. If you need a list of
  wolves, pass the wolves.
- **Wolves are SLOW** (Part 34, superseding "Aspen's speed equals Sedge's"). One
  dial, `WOLF_PACE`, drives every wolf — Aspen, the pack, Willow. They are
  deliberately slower than prey, so nothing can be run down at full stamina; a
  SPENT animal (≤ `PREY_SPENT`) drops below her speed, and that is the only window
  a chase has. Rival wolves ease to a posture distance rather than running at a
  speed; dogs keep their own pace. A `scripted` animal (the prologue elk) is
  leashed to where its beat put it, never regains stamina, does not retreat before
  it breaks, and is capped under `SPEED_ROUGH` — that is what keeps the first hunt
  winnable, and it must survive any re-tune of `WOLF_PACE`.
- **One teaching moment at a time** (Part 33). Every lesson, callout and tutorial
  transition claims a shared gate (`momentFree()` / `claimMoment()`,
  `MOMENT_GAP`); each trigger is latched on state that only grows, so a moment
  that cannot be had is deferred, never dropped. A tear still fires on arrival,
  but its forced view and rip callout queue behind the gate. Never gate on "no
  prompt showing" — sticky lessons are cleared only by the transition that follows
  them, so that deadlocks the tutorial.
- **Nothing on screen may lie.** The roster names how a wolf was actually lost
  (`deadCause`), says "scatters" only while a frightened wolf is moving and
  "freezes" only when it is rooted. Text is fitted with `fitLines`/`drawFitted` so
  it fits any screen, and on touch nothing ever names a key — `capOf()` returns
  button names, and keyboard-only verbs are omitted entirely rather than described.
- **The hunt is a STALK** (superseded the old spot-and-chase in the fun pass,
  Part 32/1 — the approach is the skill, the chase is the consequence). Prey
  carry `alert` 0..1 → `grazing` / `wary` / `alarmed` / `fleeing`. It rises while
  a wolf is inside the animal's `detectR`, scaled by distance, **wind** (upwind
  ×2.6, cross ×1.0, downwind ×0.45 — the game's `wind.a` is the direction the air
  MOVES, so a positive dot with wolf→animal means her scent is landing on it),
  **motion** (crouched ×0.35, still ×0.8, walking ×1.0), **cover** (×0.55 in a
  tree or grove), and **light**; an alarmed animal infects herd-mates within
  260u, so a blown stalk costs the whole herd. Flight has hysteresis — a running
  animal keeps running while a wolf is inside `detectR × 1.6` — without which
  flight flickers at the threshold and prey can never be worn down.
  **Crouch** (hold, default Shift) is the one lever: ×0.42 speed, and it refuses
  the asphalt and any live chase. **Pounce** (default X) commits inside
  `ambushR`: out of `grazing` the animal starts at 40% stamina and stumbling, out
  of `wary` at 70%; blown, it runs at full and stays jumpy for 25 s. Pounce needs
  its own key — the map key must stay free mid-stalk, F is the pack-staging verb
  the stalk depends on, and a tap-while-held commit cannot be distinguished from
  the hold nor exist under hold-to-toggle. The catch is unchanged: **spent
  (stamina ≤ `PREY_SPENT`) AND adjacent**. Packmates go low with her and hold;
  one left upright inside `detectR` is the main early failure, which is what
  teaches F. A **frail** animal never regains stamina — that is what keeps the
  prologue's scripted hunt a guaranteed win. Food is shared; ~4.5/day drains it;
  at 0 for two days Sedge disperses, permanently.
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
