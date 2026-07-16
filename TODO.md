# The Corridor — user feedback checklist

Everything Arjun has asked for, with status. If a session dies mid-work,
resume from the ⏳ items, in order. Verify with the headless harness
(portable node in scratchpad; `document`/`window`/`localStorage` stubs).

## Bug fixes (specified precisely by Arjun)

- [x] 1. First tear could lock you on the highway (trigger overlapped the
      road + forced map froze movement). Fixed: trigger moved east of the
      shoulder AND forced-sense defers via `pendingForcedSense` until
      `!onRoad()`.
- [x] 2. Car hit could teleport you across the road (cheap crossing
      exploit). Fixed: thrown back to the recorded entry side
      (`roadEntrySide`), plus injury: speed ×0.7 for 2.5 days
      (`injuredUntilDay`).
- [x] 3. Coverage min/max let both-ends-touched count as a full traversal.
      Fixed: 8-bucket bitmask (`covBits`), all buckets required per pass.
- [x] 4. N instantly wiped the save. Fixed: press N twice within 2.5 s
      (`requestNewYear`).
- [x] 5. Tear sting was triple-booked. Fixed: car strikes use `playImpact`
      (blunt/mechanical); the sting belongs to tears alone.

## Design / feel (Arjun's requests)

- [x] Prey doesn't stick together: per-animal graze targets, separation
      force, temperament (`skittish`), panic wobble.
- [x] Prey depletion: multiple herds with per-herd respawns (5–7 days) so
      the land never empties.
- [x] Goals beyond hunting: den choice in spring (3 sites, stand to choose,
      auto at day 70) → pups born day 75, fed by standing at den with food →
      pups travel day 240 → migrate west by winter. Seasonal objective line
      under the day counter.
- [x] Long natural tutorial (game layer): staged steps teach walk → map →
      colors (map callouts) → hunger → scent → hunt; HUD appears
      contextually; sticky prompts self-heal; H = recall learned controls.
- [x] Realistic art + animations (render rewrite SHIPPED): pre-rendered
      terrain base layer per season/era, articulated walking
      wolves/elk/deer, day/night light + headlights, weather particles,
      screen shake, upgraded parchment map, keycap prompts, help overlay.
- [x] Scent view clouds the edges of vision, worse inside violet (edge fog
      scaled by `violetAt`).
- [x] NO route lines in the world view — routes exist only as map ink.
      (Planned-route guide lines are the deliberate exception, by request.)
- [x] Map bigger / zoomed out (SCALE_MAP 0.17, radius 900–2400).
- [x] A LOT more land ("I meant it"): world 5200×3600 (was 2600×1800), all
      geometry rescaled ×2 plus new territory: North Ridge / Black Pines
      (north), Long Marsh / Salt Lick (southeast), Low Flats (southwest,
      gives a second at-grade road crossing), 4 herds, more forests.
- [x] Time passed too slowly: MIN_PER_SEC 24 → 48 (1 day ≈ 30 s, year ≈ 3 h).

- [x] **The nine-beat prologue SHIPPED** (plays on first load; reload
      restarts it; N skips). Original ask — Arjun: "There should be these scenes like the prologue
      that are very important in learning how to play the game and
      connecting to it on an emotional level. Don't skip these beats.
      Refer back to the bible and keep making changes to make it match the
      bible perfectly (except it can stay 2-dimensional)." In progress:
      nine beats — den waking (move+scent) → unbroken vista → following
      Willow while her map inks itself → easy hunt → safe gravel crossing
      (same road, past era) → bonding (F) → winter range, map complete →
      THE CUT (era swap: road/rooflines/crane, ghost map, input locked) →
      Willow's death + the hold-to-inherit interaction (no sting, no
      music) with the already-torn Mud Spring spur found on the habitual
      map check. Prologue plays on first run; skipped automatically once
      completed (N skips for testers).

## Movement & world feel (Arjun, 2026-07-14)

- [x] Prey movement smooth — damped velocity steering, low-frequency
      wander, no per-frame jitter; zone wolves also lope smoothly to stable
      slots.
- [x] No black void outside the playable area: a 600 u **apron of land**
      (ground, forests, the road itself) renders beyond the world bounds.
      Aspen cannot walk into it; pack and prey can.
- [x] Cars slide in from the far edge of the apron and **pass under the
      bridge** — hidden beneath its deck, reappearing on the far side.
- [x] Water-Under-Stone is a real **bridge over the road**: earth deck,
      rails, abutments, shadows on the asphalt; thin walls seal deck↔road
      transitions mid-span (collision + visual).
- [x] Prey leaves longer scent trails (drops every 0.9 s, readable ~200 s).
- [x] **Pack AI v2 — the zone.** Invisible zone (≤150 u) around Aspen: pack
      wolves wander inside it (unhurried), lope back when outside; it
      shrinks to 55 u where the land pinches (road, walls, the mud sink);
      **F anchors the zone in place** ("The pack holds this ground"); the
      zone spills into the apron and pack wolves may enter it.
- [x] **Pack hunting.** Adults chase prey within 280 u on their own, only
      while within a hunting radius (max(320, 2× zone)) of the zone; they
      never step onto asphalt to hunt; they fall back to the zone when the
      prey is gone. Pups never hunt and stay in the zone.
- [x] **The Bend tear is earned now**: a mud sink (impassable to everything)
      sits where the diverted creek died — the drycreek tear reflects a real
      physical obstacle, drawn in the world with cracked sheen and snags.
- [x] Cars **slide** under the bridge deck (clipped nose-first, tail-last)
      instead of vanishing whole.
- [x] Map is a **toggle** (SPACE opens, SPACE closes; right-click too); the
      beat-9 inheritance keeps its deliberate hold. Visible map radius
      roughly doubled (900–2400 u).
- [x] **Inking is much easier**: being in the general area counts — corridor
      200 u on her mother's routes, 150 u on new ground, +50 on very long
      segments.
- [x] Prey slightly **slower**, and prey may flee into the apron (where
      Aspen can't follow) and right off the land — an **escape**. Each escape
      spawns a replacement deer near the center of the map.
- [x] **Days pass 6× faster** (Arjun): MIN_PER_SEC 48 → 288, one day ≈ 5 s,
      a year ≈ 30 minutes.
- [x] **Decouple survival pressure from the fast calendar** (Arjun): food,
      injury recovery, starvation timers keep the same *real-time* pace they
      had before the 6× clock (food 0.15/s; injury 75 s). **Pups drain at
      less than half** even of that old pace (0.45/s, ~3.7 min from full).
      **Ink decay alone runs 2× faster than before** in real time
      (solid→dotted 225 s idle, dotted→void 375 s more).
- [x] **Tasks** (Arjun): small objectives fill roughly half of play time.
      While a task is open **the calendar holds still** ("the day holds");
      when none is open, days flow at 6×. Tasks are drawn from the world by
      priority: find a way around an unbridged tear → feed hungry pups →
      hunt when food is low → go look at an unvisited den hollow → walk new
      ground toward a named place → renew a fading route. Tasks complete
      from state (with a soft chime) or quietly expire after 120 s.
- [x] **Aspen's movement speed equals Sedge's**: 258 off-route (Sedge's
      pace), 290 on known routes, 210 in snow.
- [x] **Tutorial slower** (longer gaps between every step) and the scent
      colors are each taught in place the first time they're seen: gold =
      prey, brighter is fresher; violet = human noise that blinds the nose;
      red = another pack's marks (new callout). Map routing gets its own
      one-time hint the first time the map is raised in Act I.
- [x] **Tears mirror the actual human obstacles** — partially done: tear
      groups can carry a `ripPath` following the obstacle itself, and the
      Black River rip now runs along the whole road from the north edge down
      to the bridge (the one stitch that holds); the mud sink grounds the
      drycreek tear. Now also done: a benched **gravel pit** severs the
      hunting loop (with a North Ridge detour, and its own violet dust), a
      **ranch fence line** closes the northeast, and `deriveTriggers()`
      computes machines/drycreek/gravelpit triggers from their obstacle
      footprints. Only the Black River keeps a hand trigger (it must never
      fire on the asphalt). Optional later: a powerline cut.
- [x] **Clickable map routing**: click a known place on the raised map and
      the way there glows along known ink (Dijkstra over untorn edges);
      clicking again dismisses it; arriving clears it; a tear that breaks
      the plan says "The way she had in mind is gone." No path: "The map
      holds no way there." Map zoomed out further (0.17). Old-den standing
      can't accidentally choose the den anymore (needs the choice prompt
      first, and never while the map is up).
- [x] **The tear at The Bend is now earned**: resolved by the mud sink at
      the Bend (see above) — the old way is physically impassable, so the
      tear tells the truth.

## Bible content (2026-07-16 batch — SHIPPED)

- [x] **The rancher thread**: homestead (house/porch/barn/corral) behind the
      fence; cattle grazing outside the wire (killing one: +60 food,
      conflict +0.3, "the house will know"); two dogs that chase within 380
      of the house (farther when conflict > 0.6), bite = fear + conflict;
      being seen from the porch in daylight ticks the ledger. **Hidden,
      permanent conflict meter — never displayed.** Kept low: one gut pile
      left by the wire in the cold ("Maybe forgotten. Maybe not.", +35
      food). Kept high (> 0.6, after day 200, near the house): rifle cracks
      (fear 1, shake), and above 0.85 a shot can wound. Survey stakes
      appear along his fence in autumn; an unreadable pale sign in winter —
      his own squeeze, wordless.
- [x] **Silence Zone**: within 480 of the subdivision, moving fast raises a
      hidden alarm — window lights answer house by house; at full alarm:
      barking, SEEN, conflict +0.08, fear +0.3. Walk slowly and nothing
      wakes.
- [x] **Standoff**: on rival ground (within 500 of red marks), two rivals
      materialize at posture distance and hold, facing her. Leave → they
      let you ("Their ground. Not yours today."). Hold with ≥2 pack adults
      at your back → the line holds. Press alone → a nip (injury), a shove
      back, a lesson about lines.
- [x] **Lichen** joins at day 100 from the north, unsettling the pack
      (fear +0.15) and inking three northern routes she alone knew.
- [x] **The fire**: dry lightning east at day ≥130 (summer); 50 s of amber
      air, drifting smoke, and every herd running west together in
      truce-by-panic (no stamina drain — panic, not pursuit); afterward the
      northeastern woods render charred for the rest of the year.
- [x] **Pack vocal language starter set**: season-turning howls (two
      staggered gliding voices), dog barks, rival growl, rifle crack +
      body, fire rumble, play-fight yip.
- [x] **Beat 6 play-fight**: Aspen and Willow circle each other, tails
      high, for the bond moment (input locked 1.8 s, yip, warm glow).

## Still open (future sessions)

- [ ] Beat-8 matte-quality art for the cut; drought parameter; construction
      as an audible eastward progress bar; overpass adoption arc; music
      decision; per-season ambience beds; a powerline cut obstacle.

## Verification ritual

Run the harness (all checks must pass) before every commit; play a year in
the browser for feel. NOTES.md gets a session entry + tomorrow's first
action; commit everything.
