# The Corridor — checklist (feedback + code review, combined)

Everything Arjun has asked for, with status. If a session dies mid-work,
resume from the first unchecked item, in order. Verify with the headless
harness (portable node in scratchpad; `document`/`window`/`localStorage`
stubs).

This file used to be two documents — `TODO.md` (raw feedback log) and
`REVIEW.md` (the structured code-review work order) — combined here on
2026-07-19 now that both are fully closed.

## Bug fixes (specified precisely by Arjun)

- [x] 1. First tear could lock you on the highway (trigger overlapped the
      road + forced map froze movement). Fixed: trigger moved east of the
      shoulder AND forced-sense defers via `pendingForcedSense` until
      `!onRoad()`.
- [x] 2. Car hit could teleport you across the road (cheap crossing
      exploit). Fixed: thrown back to the recorded entry side
      (`roadEntrySide`), plus injury: speed ×0.7 for 2.5 days
      (`injuredUntilDay`, later replaced by real-time `injuredT` — see
      Part 10).
- [x] 3. Coverage min/max let both-ends-touched count as a full traversal.
      Fixed: 8-bucket bitmask (`covBits`), all buckets required per pass.
- [x] 4. N instantly wiped the save. Fixed: press N twice within 2.5 s
      (`requestNewYear`, later R twice — see below).
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
      completed (N skips for testers). Later redesigned — see Part 13.

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
      roughly doubled (900–2400 u), later fixed flat — see Part 13.
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
      from state (with a soft chime) or quietly expire after 120 s. Later
      expanded with direction words and two new task kinds — see Part 14.
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
      fire on the asphalt). Powerline cut later added — see gap list below.
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
      (fear +0.15) and inking three northern routes she alone knew. Later
      hardened against spawning inside blocked ground — see Part 14.
- [x] **The fire**: dry lightning east at day ≥130 (summer, later randomized
      per year — see Part 11); 50 s of amber air, drifting smoke, and every
      herd running west together in truce-by-panic (no stamina drain —
      panic, not pursuit, and later allowed onto the road itself — see
      Part 14); afterward the northeastern woods render charred for the
      rest of the year.
- [x] **Pack vocal language starter set**: season-turning howls (two
      staggered gliding voices), dog barks, rival growl, rifle crack +
      body, fire rumble, play-fight yip.
- [x] **Beat 6 play-fight**: Aspen and Willow circle each other, tails
      high, for the bond moment (input locked 1.8 s, yip, warm glow).

## Playtest feedback (Arjun, 2026-07-16)

- [x] **PERFORMANCE — main focus.** Everything is SUPER laggy. Fix: blit
      only the visible slice of the base layer (9-arg drawImage), render the
      base layer at half resolution, cache the parchment + vignette,
      pre-render the scent-glow sprite (no per-point gradients), cache
      violet at scent-drop time, cull/cap scent points, skip world render
      under a fully-raised map.
- [x] Beat 1: there must be something to SMELL — seed prey scent trails
      near the den (freshness gradient visible) and let prey drop scent all
      through the prologue, not just in the hunt beat.
- [x] Beat 1 gives barely enough time with scent view — require a longer
      hold, don't rush on.
- [x] Beat 2 never says where to go — add a guiding arrow toward the
      overlook (and toward the den in beat 9).
- [x] Beat 3 advances the moment the map opens — instead wait for the map
      to be closed and *stay* closed a few seconds. (Beat 3 later redesigned
      into a forced view entirely — see Part 13.)
- [x] Kills impossible until the hunt is taught (beat 4); gold trails
      exist from the start and should be even longer.
- [x] Beat 4 text: just "Run it down." — Willow doesn't actually turn it.
- [x] Beat 5: the road is physically impossible to step onto until the
      truck has passed and Willow crosses.
- [x] The map is not openable until beat 3 teaches it (and, on the skip
      path, until the tutorial's map step). Later redesigned so it isn't
      openable until the inheritance — see Part 13.
- [x] Beat 8 bug: after the cut the wolves run off — the zone anchor
      doesn't move with the teleport. Clear the anchor + set follow on the
      cut.
- [x] Replace N-twice with **R twice = "restart the game (skips
      prologue)"**; ending screen says R too.
- [x] Den sites appear on the map (all three, once the choice is named)
      and are **clickable route targets** before a den is chosen.
- [x] Prompts collide when triggered together — queue them; a new
      non-sticky prompt waits for the current one to finish.
- [x] F does nothing until taught; taught right after "lean into her"
      resolves (never before); in the prologue F is only the bond gesture.
- [x] H does nothing until taught; its help row reads "open or close
      this".
- [x] Explain (or fix) blue ink turning faded light brown mid-path
      (answer: edge boundary — Aspen's teal meets Willow's unverified ghost
      amber past a tear; two different edges).
- [x] Explain the red-marked arcs near High Meadow (answer: contour
      lines = high ground; soften them so they read as terrain, not marks).

## Playtest feedback (Arjun, 2026-07-16, second round)

- [x] A deer was trapped inside the gravel pit — prey must never spawn or
      graze-target inside blocked ground, and any animal wedged inside an
      obstacle frees itself.
- [x] Prey can never step onto the road **unless Aspen is on it or just
      crossed it** (a short grace window — so a chase can drive them across;
      later also true during the fire's panic-truce — see Part 14).
- [x] Crossing **most** of a path fully inks it (6 of 8 coverage buckets,
      not all 8).
- [x] Dog attacks cost a lot of **food** and **injure** Aspen; dogs also
      attack pack wolves (food + fear; later a longer real-time wound for
      packmates specifically — see Part 14).
- [x] **Fear is more costly**: at high fear the whole pack freezes in
      place (~a day and more) until fear falls low enough; fear decays a
      touch faster so the freeze ends. Redesigned entirely in Part 14 (the
      pack flees to safety first, then freezes, ~10× longer).
- [x] The obstacle at the Bend must be **a lot bigger and clearly
      human-induced** — a bermed dredge impoundment where the creek was
      diverted, with pipe, machine, and its own violet, r 110 → 260, later
      340 — see Part 13.
- [x] The map **always frames the entire land** (camera pulls to the
      world's center at full raise, zoom fits the world) and the visible
      radius is a little over half the land's width (~2750). Later fixed to
      a flat, position-independent radius — see Part 13.
- [x] Wolves vibrate at the edge of the hunting radius when prey is near
      — hysteresis: a chase starts well inside the radius (0.8×) and only
      breaks well outside it (1.3×).

## Bible gaps closed (2026-07-18)

- [x] Beat-8 matte-quality art for the cut — two seeded mattes of the same
      ridgelines, past and present (drawVistaMatte, beats 2 and 8).
- [x] Drought parameter — summer bakes toward straw until the fire's own
      rolled day (tint in drawLightAndAir).
- [x] Construction as an audible eastward progress bar — distant clanks,
      louder east and later, silenced the day the overpass opens.
- [x] Overpass adoption arc — OBSTACLES.overpass opens day 170: earth over
      the asphalt, prey may cross, three told moments (opening, her
      discovery, the first deer seen using it).
- [x] Music decision — sparse motifs at earned emotional beats only (the
      inheritance, the pups' birth, the pack's arrival); no looped score.
      The land is otherwise the score: seasonal wind beds, event stings,
      the howl at each season's turn.
- [x] Per-season ambience beds — looping filtered-noise wind, weight per
      season, hushed in the prologue, all through the master gain. Later
      made location-aware (road hum, creek, birdsong) — see Part 14.
- [x] Powerline cut — a cleared strip with pylons, wires, and slash from
      the construction ground to the subdivision; prey refuse to graze in
      it (pickGrazeTarget).

## Code review work order (Arjun, 2026-07-17 → 2026-07-18)

A structured code-review pass, worked in order; after each part: harness
green (checks added where a part called for it), browser feel-check where
it touched feel, a NOTES.md line, and a commit named `review fix N: …`.

- [x] **Part 0 — TODO.md housekeeping.** The bible-gaps section listed only
      what wasn't built yet (rancher, standoff, silence, Lichen, fire were
      all already implemented) — corrected.
- [x] **Part 1 — Base layer rebuilds every frame.** `drawWorld`'s key must
      equal `buildBaseLayer`'s three-segment key (era | season | burned).
      Harness proves one build across repeated frames.
- [x] **Part 2 — The ending is the pack's arrival.** 'arrived' requires the
      living pack gathered within ~400 of the range; waiting message when
      Aspen is there alone ('Not all of them are through…'); survivorCount
      snapshots who was actually there at `startEnding`; early arrival
      before WINTER_START says 'Not yet. The season has not turned.'
- [x] **Part 3 — Road: pack sprints on asphalt** (240·mult when position or
      target is on the road) **and the conducted crossing is taught** once
      near the road (F holds → cross → F calls them through), flag saved.
- [x] **Part 4 — Seasonal squeeze.** Eastern herds (anchor east of the
      highway, cattle exempt): respawn ×1 spring/summer, ×2.5 autumn, none
      in winter; western herd ×1 all year. One-time autumn message: 'The
      hunting thins. The east is emptying.'
- [x] **Part 5 — Winter starvation ends the year.** In winter, food at 0
      continuously for 180 real s (extend `starveT`) → `startEnding
      ('failed')`. Other seasons unchanged.
- [x] **Part 6 — Daylight decoupled from the 5-s calendar.** `daylight()`
      runs off `S.time` (~75 s per visual day, same curve; keeps the
      past-era branch). Night tint, headlights, rancher sighting inherit
      it. Calendar untouched.
- [x] **Part 7 — Resume.** Intro screen offers a resume line when a valid
      v2 save exists; `r` loads it, any other key starts fresh (boot
      `clearSave()` moved into that path). Never auto-loads. Text later
      reworded — see Part 14.
- [x] **Part 8 — Beat 9 scaffold** — absorbed into Part 13: the map raises
      itself at the inherit and the rip callout labels Mud Spring.
- [x] **Part 9 — Bram's recall (one line).** Ghost edges render at 0.55·m
      (instead of 0.3·m) while Bram lives and is within ~300 of Aspen;
      first time: say('Bram remembers the far side. From before.') Once.
- [x] **Part 10 — Injury goes real-time.** Replaced `injuredUntilDay` with
      `S.injuredT` seconds (75), ticking regardless of task freeze; old
      save field read defensively as 0.
- [x] **Part 11 — Small fixes** (one commit):
      1. [x] Master GainNode + M to mute ('M — quiet' in help).
      2. [x] `mapClick` only in play mode.
      3. [~] `senseRadius` ghost-skip — superseded while the radius is a
             flat WORLD.w·0.53; revisit only if ink-density radius returns.
      4. [x] Past-era strike text: 'The truck clips her. Willow is already
             there, pressing her to the grass.'
      5. [x] Fire day randomized 115+rand·45, rolled at newGame (S.fire.day).
      6. [x] Distinct message for pack-initiated cattle kills (Aspen > 500
             away): 'The pack took a calf on its own. The house will not
             know the difference.'
      7. [x] Prologue beat-4 kill: generic 'A kill…' say suppressed.
      8. [x] SPACE ignored while `forcedSenseT > 0` (no stuck-open map).
- [x] **Part 12 — Play-test watch list** (executed 2026-07-18): fire-driven
      prey may cross the road (the jam breaks in panic-truce); cattle
      anchor moved to (4120, 830), off the dog/fence stack; Salt
      Lick–silence overlap kept as deliberate; pup cadence left as tuned.
- [x] **Part 13 — Prologue map-flow redesign (the big one).** The inherit
      is the FIRST moment the map can be opened on command. Beat 3's map
      moment is a forced view (she shows you; no SPACE teaching); beat 7's
      winter-range map stays a forced view of *Willow's* map; SPACE stays
      locked until after the beat-9 inheritance. When the inherit hold
      completes, the map RAISES ITSELF, the rip callout labels Mud Spring
      (absorbs Part 8), and there is more emotional buildup before the
      hold (longer stillness, captions). After the map is lowered, Act I
      starts promptly.
  - [x] Spring opens away from every den site (at Aspen Stand), with a
        prompt to open the map; all three hollows are shown on it.
  - [x] A chosen den becomes a real graph node ("home") with unknown edges
        to the 3 nearest nodes, walkable and inkable after selection
        (dynamic nodes/edges stripped at newGame; recreated from denId on
        load).
  - [x] Den choice: needs only ~1.2 s standing within 120 u (was 2.5 s / 60).
  - [x] Old den naming: always "The Old Den" until chosen as home, then
        "The Den"; no doubled label at the old den site.
  - [x] H's intro reads "What she knows how to do: H."; after a den is
        chosen the game teaches R, then, a beat later, H.
  - [x] The Bend impoundment bigger again (r 260 → 340); the southern
        detour rerouted around it through a new Sand Bar node.
  - [x] Map radius: flat half-the-territory-width, never position-dependent.
  - [x] First arrival in new (grey-void) territory names the node ("Salt
        Lick. She will remember it.").
  - [x] The patch task names its tear ("find a way around the Black
        River / the machines / the drowned Bend / the pit").
  - [x] Patching works from both sides — `checkBridges` runs an undirected
        BFS between the chain ends.
- [x] **Part 14 — Playtest batch (2026-07-18).**
  - [x] Intro resume line reworded: 'R — resume the year from where you
        left off', placed further down the screen.
  - [x] Patching around a tear works for ANY walked route around the
        obstacle, from any direction (trail-based freeform bridging,
        alongside the edge-ink BFS).
  - [x] Being anywhere around a human-made object causes its tear
        (footprint proximity, not only the derived trigger circles).
  - [x] Fear redesign: frightened wolves RUN to safe ground away from the
        threat and THEN freeze (dogs can no longer chew a rooted pack);
        applies to road encounters too; label reads 'freezes' (never
        'balks'); the frozen spell lasts ~10× longer.
  - [x] Lichen must never spawn inside blocked ground.
  - [x] Pup HUD bar labelled 'PUP FOOD'. 'The pups are coming' goal line
        only within ~10 days of the birth; a different line before that.
  - [x] Dog bites injure packmates too, for longer than Aspen (real time),
        shown as 'hurt'.
  - [x] Winter snow slows all animals (prey and pack), not just Aspen.
  - [x] Weather, a few days per spell: sun (normal), cloud (visible radius
        shrinks), rain (scent washes out faster + the world darkens).
  - [x] Food drains slower when the pack is smaller.
  - [x] Ambience follows location: traffic hum near the road, water near
        the creek, birds in the woods in the green seasons.
  - [x] Sparse music at the emotional beats (the inheritance, the pups'
        birth, the pack's arrival) — short motifs, nothing looped.
  - [x] A packmate never steps onto asphalt unless Aspen herself is on it.
  - [x] Prologue beat 1 introduces the pack by name before the scent
        lesson.
  - [x] In the prologue the pack's zone follows Willow while she lives;
        leadership passes to Aspen at the inheritance.
  - [x] The patch task marks its tear on the raised map (emphasis pulse);
        the scout task names the compass direction of the unknown ground.
  - [x] More task variety: a carry-it-home delivery task and a
        lost-packmate search task (with direction words), alongside
        hunt/patch/pups.

## Part 15 — Design drifts (Arjun, 2026-07-19)

- [x] **Drift 1 — the task system fights the thesis.** Un-freeze time:
      the calendar runs ALWAYS (no task freeze); slow the ambient clock to
      ~9 s/day (a 50-60 minute year) so nothing feels missable. Keep task
      detection but re-theme as URGES in Aspen's register: no timer, no
      chime, no 'Done' line — an urge clears because the world changed.
      Drop the 'renew a fading route' task entirely (route maintenance is
      the player's own discovered dilemma). Kind-specific quiet endings
      where the world must move on (a lost wolf finds its own way back; an
      unclaimed carcass goes to the ravens). Rescale ink-decay day counts
      so real-time decay pace is unchanged.
- [x] **Drift 2 — the overpass arc must be played, not told.** For ~2
      weeks after opening the deck reeks of people: pack wolves refuse the
      band unless Aspen crosses first and calls them through (the existing
      F-conduct verb); after ~3 conducted pack crossings the bridge is
      trusted. Prey won't touch it until then — only afterwards can 'the
      first deer seen crossing' fire. Then the migration image: from late
      autumn the eastern herd anchors drift to the road and MILL against
      it; once the bridge is trusted they trickle across over days,
      draining the east — the squeeze becomes something you watch.
- [x] **Drift 3 — the rancher thread must be findable.** The gift becomes
      a magnetic rumor: a tall raven column over the gift spot (visible
      from far, like the crane beacon) plus a gold scent bloom that keeps
      refreshing until the gift is taken.
- [x] **Drift 4 — wind makes the hunt.** Wind gets a direction (slow
      random walk, re-rolled with the weather). Prey smell Aspen much
      farther when she approaches from upwind; downwind approach shrinks
      their detection. Rain dampens detection (a hunting opportunity).
      The scent view shows the wind (drifting streaks) so approach becomes
      a tactical read.
- [x] **Season-turn ritual.** At each season boundary (with the howl): a
      forced ~10 s map raise where Willow's original complete map ghosts
      in over the current scarred state, then fades — three times a year
      the player watches her map die by comparison.
- [x] **Sedge's epilogue.** If she dispersed: one red mark of hers near
      the world's edge, findable in scent view in winter — 'Sedge. Going
      somewhere the map does not go.'
- [x] **The standoff verb.** F during a standoff = the pack stands tall
      together: with ≥2 adults it ends the standoff at once, at a fear
      cost — display/hold/retreat from the existing input.
- [x] **The lean west (reframed as design).** Winter's final corridor
      holds one lean, hard-to-catch herd: the western herd in winter is
      warier and yields less — every calorie out there is earned.

## Part 16 — Playtest batch (Arjun, 2026-07-19)

- [x] Normal view 2× zoomed in; scent view zooms back out to the old
      framing — but much darker, so little reads except trails and marks.
- [x] The world is a lot longer horizontally toward the winter range;
      getting there is genuinely hard (a long human barrier — a fenced
      rail line — with one way under, torn inherited ink, new unknown
      ground to ink).
- [x] More danger, mostly (not only) human-induced — brainstormed set:
      water as a need beside food (WATER bar, drink at sources); fouled
      sources (below the impoundment, the cattle pond, the pit sump)
      cause sickness (slow, hungry); snare lines near the wire once the
      ledger rises (held fast + wound); roadkill lures on the shoulder
      (meat next to the traffic); thin ice on winter water (a plunge:
      cold, fear, lost meat).
- [x] 'The moment passes' must NOT return a missing packmate: an unfound
      lost wolf stays lost, and eventually is gone for good.
- [x] Aspen slightly faster; Sedge reduced to prey speed.
- [x] Full inking requires 80% of the path walked (10 coverage buckets,
      8 required); a completed path names BOTH end nodes on the map.
- [x] Remove the tear right next to the den and the spur path it sat on
      (mudspring is gone; the rip callout waits for the first real tear).
- [x] Paths need not be straight: when an obstacle stands between nodes,
      the path curves around it (auto-derived via points; traversal and
      rendering follow the curve).
- [x] Season-to-season change everywhere: by year's end barely any
      unchanged territory (construction grows each season and its tear
      zone with it; subdivision second row; pit deepens; impoundment
      spreads; winter freezes the water).
- [x] Being anywhere next to a tear's line (its edges, or its rip path)
      activates it — not only the obstacle footprint.
- [x] Walking in water slows her down (wading drag at every source).
- [x] Drinking is an ACTION: she must stand still in the shallows —
      never a passive refill (taught once, in place).

## Verification ritual

Run the harness (all checks must pass) before every commit; play a year in
the browser for feel. NOTES.md gets a session entry + tomorrow's first
action; commit everything.

## Part 17 — Prologue polish (Arjun, 2026-07-19)

- [x] Beat 1: a deer spawns offscreen and walks close past Aspen exactly
      when 'Hold E' is taught — live gold laid across her nose in place.
- [x] Beat 4: the winter-thin elk spawns close enough to SEE at the new
      close-in camera when it is named.
- [x] F is introduced AFTER spring starts, when Aspen leads the pack —
      never in the prologue. Beat 6 keeps the lean-in bond only; beat 7
      simply walks on; ~14 s into Act I: 'The pack is hers to lead now.
      F — they hold this ground, or follow.'
- [x] The inherit hold works from wherever the circle over Willow is
      visible (radius 110, matching the render), not only right on top
      of her.
- [x] A held pause between Willow's death and Spring: beat 10 — a far
      howl, 'The winter closes over the den.', the screen whiting over
      with drifting snow for ~6.5 s, then the white letting go slowly
      into 'Spring. the first thaw after her'.
- [x] Drinking is a held KEY (Q), never passive: standing in water does
      nothing until Q is held, head down. Taught in place; help row.
- [x] The water is the DRAWN water: the creek's own line and four real
      rendered ponds (banks, shine, scummed film when fouled, winter
      lids) — they wade-slow her and supply drink; the invented ellipse
      sources are gone.
- [x] Water near people is what sickens — derived, not hand-flagged:
      anything within reach of the impoundment, construction, pit,
      subdivision, ranch, or asphalt runoff fouls the water it touches.
- [x] A tear only fires when its damage is inside her reduced vision:
      the obstacle's footprint, its rip line, or the trigger spot —
      never the abstract path edges.
- [x] The rip on the map is shaped almost exactly like its obstacle
      (footprint outline traced at tear time, at that season's true
      size; regenerated on load).
- [x] 'The machines' renamed: the patch urge reads 'find a way around the
      broken ground at Fence Line' — a place, not a category.
- [x] First-time dangers announce themselves with a caption: 'Sick.',
      'A snare.', 'Through the ice.' — each once, with its cost named.
- [x] Curved paths actually curve now: detection margins widened (they
      were tight enough that only already-torn edges qualified), and the
      planned-route glow follows the curved ink leg by leg.
- [x] One negative sound (playHurt — a low blunt bite) for EVERYTHING
      that happens to Aspen: car, dogs, rifle wound, standoff nip, snare,
      wrong water, ice. The tear keeps its own sting. Barks, growls, and
      the gunshot remain as world sounds only.
- [x] The rip drawn for a footprint tear is the obstacle's OWN outline,
      traced jagged — the old width-band self-overlapped into a grey blob
      on closed shapes (the Ridge Hollow screenshot).

## Part 17b — Deep playtest batch (Arjun, 2026-07-19/20)

- [x] Ponds are painted into the terrain (irregular mud-banked bodies,
      shallows, reeds, scum when fouled, winter ice) — not overlay rings.
- [x] Drinking is hold-Q, standing in water; thirst teaches it before she
      ever reaches a bank, and again at the water's edge; help row.
- [x] Water near ANY people fouls it (impoundment, construction, pit,
      subdivision, ranch, asphalt) — derived, not flagged.
- [x] Being sick slows her hard (0.6x — worse than injury's 0.7x).
- [x] One hurt sound (playHurt) for everything that happens to Aspen; the
      tear keeps its own sting. First sickness/snare/ice each caption once.
- [x] 'Find your way around' names the specific tear; every tear is named
      on the map, and the urge asks for that same name.
- [x] The rip drawn is the obstacle's own jagged outline (closed shapes no
      longer bloat into a width-band blob).
- [x] A tear only fires when its physical damage (footprint / rip line /
      trigger) is in her reduced vision — never the abstract graph edge.
- [x] Layout de-overlapped: pit sump off Ridge Hollow, dens off the pit and
      the mud sink, Fence Line off the construction; ponds clear of dens,
      nodes, forests, obstacles.
- [x] The railroad is CROSSABLE (walkable ballast) — the wall is the trains.
- [x] Trains: very fast (1700 u/s), very long, and lethal — a train on the
      ballast kills even Aspen (the 'dead' ending).
- [x] Weather made unmistakable: cloud is a grey ceiling with drifting cloud
      shadows; rain is real sheets.
- [x] The prologue map is the full west-extended land.
- [x] The road scar runs on under the overpass (dark asphalt strip + cast
      deck shadows) — the bridge is over a continuing road, not a gap.

## Part 18 — Map centrality & directed exploration (Arjun, 2026-07-20)

Goal: make the MAP the thing the player navigates BY, and make Aspen
travel toward reasons that live in unknown ground. Strict order A1→B5;
commit per part. Additive only — weaken no existing system.

Block A — make the map central:
- [x] A1 Exploration fog: the map remembers only what she has SEEN. Coarse
      seen-grid (120u cells) marked within 240u sight each tick, saved,
      prologue route pre-seen. Three map tiers: seen = full; unseen-but-
      inherited = faint cold ghost-thread, nodes dimmed/unlabeled; unseen-
      uninherited = grey void. Names resolve on first sight. Routing still
      works over inherited-unseen edges, but a planned leg over unseen
      ground draws dashed/cold.
- [x] A2 The planned route persists into the porthole: drifting pale motes
      at the fog edge toward routeNextNode(); dies the instant a tear nulls
      the path. (Also added the play-view porthole fog itself — drawPlayFog.)
- [x] A3 Fog/night force map-reliance + fix the screen-space bug: play sight
      is world-units × cam scale (fair on every monitor), base 240u; night +
      violet pull it to the 90u floor at a road; rain/cloud shrink it. Scent
      view's clear radius also converted to world units.
- [x] A4 Season-turn map ritual: at each howl a 5.5s forced map raise where
      Willow's full confident ink ghosts over the live map, then fades.
      Once: 'What her mother knew. What is left of it.' Defers off the road.
- [x] A5 Guard the map toggle against forcedSenseT, seasonGhostT, and the
      beat-9 inherit hold: the hold still inherits; only toggleMap suppressed.

Block B — make exploration directed (bearing, not waypoint):
- [x] B1 Deplete near, smell far: preyBearing() — when food < 55 a distant
      herd-region with living prey reads as a faint gold bloom at the fog
      edge, intensity by hunger; direction only, no dot.
- [x] B2 Thirst is a second compass (waterBearing, cool bloom) toward clean
      water she hasn't reached. waterFouled already point-based (western
      pool reads clean); stacked slow multiplier floored at 0.5.
- [x] B3 Rumors on the inherited map: 5 RUMORS (water/den/vantage/carrion)
      as faint marks on threads into dim ground; reaching one resolves it —
      a real spring, +food, a vantage that widens sight, a den bank, or a
      'changed' note that is now the fouled impoundment. Saved.
- [x] B4 The home range dies: winter escalation line 'Nothing answers the
      hunt here. The living land has moved west.' near the emptied den; the
      seasonal squeeze + herd drift keep the west comparatively alive.
- [x] B5 Distant goals are the spine: in travel seasons the top task is a
      'range' (reach the winter range, named by compass) or scout; only a
      starving pup / starving pack interrupts as a real counter-pull.

## Part 19 — The western pack (Arjun, 2026-07-22)

A second rival pack, west of the road, blocking the winter-range approach —
a mirror of Aspen, displaced by a human scar. Spatial PRESSURE, never a
mandatory fight. Strict order 1→9; commit per part. Additive only.
GUARDRAIL: avoidance (patrol timing) and yielding (the detour) must ALWAYS
stay viable — a ruined pack must always have a survivable way through.

- [x] 1 Data: OBSTACLES.westCut (a clearcut that drove them) + its violet;
      WEST_PACK {appearDay 155, territory (480,1300) r620 over the
      farBench/highMeadow approach but NOT winterRange, 6 marks in their
      OWN array (east SCENT_RED untouched), strength 5, patrol period 90};
      + stonyBench-longSlope detour edge.
- [x] 2 Arrival: marks-first at appearDay (westActive), one-time line 'New
      marks on the far side…', permanent static presence, save/load safe.
- [x] 3 Exposure (S.exposure 0..1): rises inside by depth + time + fresh-mark
      proximity + detection (upwind/daylit/in-sight); drains outside and
      while hidden; clamped so one tick never crosses two thresholds.
- [x] 4 Reading them: patrolCentroid() deterministic+periodic from S.time;
      markFreshness() = recency the loop passed; drawn freshness-lit in scent
      view beyond the sight fog.
- [x] 5 Encounter machine: calm → sighting(.33, rivals appear) →
      confrontation(.66, F posture) → clash(1.0, costly, forced out). Win
      opens a 40s lane; losing repositions to the edge, unhurt.
- [x] 6 Relative strength: aspenStrength (self + adults 1 / yearlings .5 ×
      condition × injury, × fear factor) vs fixed 5, k .9. Fixed strength —
      the variable is Aspen's year.
- [x] 7 NO skirt-it route (Arjun overrode the spec 2026-07-22): the detour
      edge was removed; every winter-range path passes through the territory
      (verified BFS: no territory-avoiding route). A ruined pack must TIME
      it, not go around; losing teaches 'No way around them. Read their
      marks — cross when the fresh sign is on the far side.'
- [x] 8 The reveal: westCut renders as a clearcut (construction family,
      stumps/slash/skid ruts) + one-time 'This is what drove them. The same
      hands, a different corner.'
- [x] 9 East pack stays passive — verified it never raises western exposure,
      state, lane, or rivals; separate code paths.

GUARDRAIL (revised by Arjun 2026-07-22): the "skirt it" / detour option is
REMOVED — there is no way around the territory. Avoidance now rides entirely
on TIMING the patrol (verified: a crossing with the patrol away never forces
a confrontation). Yielding a posture still repositions unhurt and lets her
retry indefinitely, so it is still never a mandatory fight and cannot
soft-lock — but a ruined pack must read the marks and slip through.

## Part 20 — Playtest batch (Arjun, 2026-07-23)

- [x] Trees are actual obstacles (collision, like the other obstacles).
      `inForestCore()` blocks the dense trunk core (r*0.5) in the present era
      only; three canopies that straddled trails were nudged clear (data.js).
- [x] Q (drink) added to the help overlay of what Aspen knows how to do.
      Now unconditional in play (a core verb), not gated on first thirst.
- [x] Prologue beat-6 play-fight: interact with SPACE, not F (F isn't taught
      until spring). SPACE routes through toggleMap's beat-6 branch.
- [x] HUD bars other than food/water disappear when empty (fear, pups...).
- [x] Remove tasks entirely (the whole urge/task system + its HUD line).
- [x] Prologue visibility (rebuilt for the old larger/porthole vision):
  - [x] Willow is in view when introduced, and pointed out somehow.
  - [x] The other packmates are pointed out somehow when introduced.
  - [x] Aspen (you) is introduced among the introductions (named first).
  - [x] The elk is in view when you're told to run it down (spawns ahead of
        Aspen toward the ford, and is pointed out).
  - [x] The overlook arrow is on-screen, slightly smaller, closer to Aspen.
  - [x] The overlook vista holds until the player presses a key to lower it
        (chosen over a fixed longer hold — player-paced for the emotional beat).
        Applies to both the overlook (beat 2) and THE CUT (beat 8).
- [x] Tears no longer circled (tasks gone); tear NAMES centered and fully
      inside their tear shape.
- [x] Curved node-to-node routes: the on-land route drew straight chords while
      the map drew the edge's curve — the land route now follows edgePolyline too.
- [x] The map's bottom "what she remembers of the territory" caption must NOT
      show in the prologue when Willow opens the map.

New "look here" system: `pointOut(tag, dur)` + `resolvePointTarget()` set
`S.pointAt` to a live creature position each prologue frame; render draws a
bobbing caret over it (or an edge chevron toward it if off the close-in camera).
Vista hold: `S.vistaWait` pins the matte fully-in until any key calls
`releaseVista()`, which lowers it and hands the beat forward.

## Part 21 — Map centrality, no-fog reconciliation (Arjun, 2026-07-24)

Direction (Arjun): the map stays central through knowledge the world does NOT
reveal — NO fog/darkness (the porthole was removed and stays removed). Audited
Part 18 Block A/B: all A1–A5 / B1–B5 present and working; the map keeps its own
vignette (senseRadius, "what she cannot call to mind stays void"), the seen
tiers, the goal marker, rumors, and the season ritual. Two casualties of the
porthole + task removals, both fixed additively:

- [x] A2 route cue was washed out: the drifting motes used additive `lighter`
      blending tuned to glow on the dark porthole. With the world fully lit they
      vanished. `driftMotes()` now gives each mote a soft dark halo (source-over)
      so the remembered route reads over any terrain.
- [x] B5 lost its compass: the "range" spine was a task (removed). With no route
      planned, in travel seasons (si>=2, goalSet) a fainter goal bearing now
      drifts toward the Winter Range — nudging her to raise the map and choose a
      way. Suppressed the moment a route is planned (the route motes take over).

A3's "fog forces map-reliance" is intentionally relaxed under the no-fog
direction; sight radius still drives bearings and scent reach.

## Part 22 — Playtest batch (Arjun, 2026-07-24)

- [x] Bram earns his memory: at Aspen's side he surfaces rumors (water/carcass/
      den/vantage) onto the map, one at a time on a cooldown, need-first. B3's
      rumors are no longer inherited-visible — bramTellsRumor is the source;
      render gates on S.rumorsTold. A lost Bram tells nothing.
- [x] The river (creek) continues north into the distance the way the road does
      — extended creekFlow to y=-600 (the apron), like the road.
- [x] Train-death ending: when the pack is lost to a train, the end screen must
      NOT read "5 of 5 survived". endKind 'dead' now reads "Without her map, the
      pack scatters into a land it cannot read. None come through." and drops the
      legacy line (the map died with her).
- [x] Suggestions replace tasks. S.suggestion, picked by context (starving pack,
      travel spine, thirst, hunger, den, or a rotating explore nudge), shown as a
      '›' line under the objective. Never freezes the day, never required, expires
      on a timer and re-picks. Always present. Names a compass DIRECTION, never a
      point. B5's travel spine rides here (west, before the snow).
- [x] F (pack follows/holds) is TAUGHT, not told: at ~6s into spring the lesson
      opens (fLesson), F becomes usable, and a sticky prompt walks her through
      holding the pack (F) then calling it back on (F again); only then is
      fLessonDone. Replaces the old one-line tell.
- [x] Prologue pack intro: use only a CIRCLE on the introduced wolf, not the
      circle + caret (the on-screen point-out is now a ring only). Alder and Fen
      introduced SEPARATELY, each circled, so you learn which is which.
- [x] Routes go straight around a tear, not out and back: walking the short way
      right past a rip now records that path (S.foundPaths[key]) via the freeform
      bridge; it inks as new map ground, reconnects the tear's ends for
      recomputeGhosts + computeRoute, and the route follows it (routeLegPoly).
      Saved/loaded; reset each year (tears re-tear, ways re-found).
- [x] Trees are individual obstacles, not a blocked core in the middle of a
      canopy zone. Shared TREES list (~310, scarce) built in game.js from the
      forest zones + lone trees, carved off nodes/dens/herd-anchors/ponds/road;
      each trunk (s*0.42) blocks wolves AND prey in the present via inTreeAt.
      Render draws from the same list. inForestCore removed.
- [x] Cattle are CATTLE, not calves — they're big. Fix the naming.

## Part 23 — Established fixes, ship-readiness work order (Arjun, 2026-07-25)

Settled fixes (no playtest dependency). Strict order 1→9; 1–2 release-blocking.
Additive only — preserve every system. Harness + NOTES + commit per part.

- [x] 1 Train telegraph (RELEASE-BLOCKING): a spawned train now enters a WARNING
      phase (warnT, warning) — parked off-map, harmless — for TRAIN_WARN (3.2s):
      playTrainHorn (a lower/longer sawtooth diesel variant of the beat-8 horn,
      via masterGain) fires at spawn + a nearer blast 1s before launch; render
      throws a headlight glow+beam that races down the rail ahead of the parked
      train (headY from warnT) and jitters ballast dust, both scaling with warnT;
      S.shake trembles when the head bears down near her. Only after warnT>=3.2
      does it launch and strike. Death + 'dead' ending unchanged. Harness:
      spawn-warns; no strike (and train parked) during the warning; still kills
      after; measured invariant — strike time from spawn >= TRAIN_WARN.
- [x] 2 Resume AudioContext (RELEASE-BLOCKING): resumeAudio() (latched once,
      try/caught) creates the context inside the gesture and resumes it if
      suspended; wired into the keydown and canvas-click handlers. Harness:
      suspended-context stub + first keydown => resume() called, state running,
      unlock fires once. MANUAL SAFARI CHECK STILL OWED (Node can't verify it).
- [x] 3 Loading state: a #loading overlay (THE CORRIDOR + "loading…" on #191b16,
      inline CSS, Georgia, no fetch) shows instantly pre-JS; main.js adds .hidden
      (0.6s fade) on the first frame after draw(). MANUAL: throttle + confirm.
- [x] 4 Error boundary: a `crashed` latch + drawCrashCard ("The land slipped
      away. Press R to return."); the frame body is try/caught (update/draw throw
      => handleCrash, no reschedule), and window 'error'/'unhandledrejection'
      handlers catch the rest. R-on-crash is handled at the TOP of the existing
      keydown handler (no second listener, so the harness key() path is intact).
      Harness: a throw inside update() via frame(0) trips the boundary; an
      unhandled rejection trips it too.
- [x] 5 Save migration: migrateSave(d) fills any absent field with its default
      (keeping valid falsy values); the whole load body is wrapped in try/catch
      so a structurally-unusable save calls clearSave()+newGame() and returns
      false (fail safe). No version bump. Harness: an old save missing water/
      exposure/foundPaths/rumorsTold/wind loads with sane defaults; a corrupt
      save (edges: 12345) fails safe to intro.
- [x] 6 Ending card integrity: the false "The average corridor now closes within
      one." is replaced by "Now the map is torn before it is handed down." (true,
      no number). A sourced Banff impact card fades in at endT>19: "Wildlife
      crossings work. In Banff National Park, crossings and fencing cut wildlife-
      vehicle collisions by over 80% — and elk and deer deaths by 96%, across
      250,000+ animal crossings. The land can be reconnected." + link line (Y2Y
      y2y.net · ARC arc-solutions.org). Grep confirmed no other unsourced stat in
      copy. OWED (external): cite Banff/Parks Canada/Y2Y in the itch page + the
      educator guide. Manual: reach each ending, read cleanly.
- [x] 7 Mobile gate: isTouchOnly() (touch UA/maxTouchPoints AND no `(pointer:
      fine)`) at the boot gate => drawMobileCard ("The Corridor is a keyboard
      game. / Please visit on a computer to play." on dusk) and newGame()/RAF are
      NOT called; desktop/headless boots normally. Harness: gate inert on
      headless; card draws clean. Manual: emulate mobile in devtools.
- [x] 8 OG/social meta in <head>: og:title/description/type/url/image + twitter
      summary_large_image set. Text tags final ("You are the wolf. The map you
      inherited is wrong."). OWED before sharing: replace the placeholder
      the-corridor.vercel.app domain with the real deployed URL and add og-cover.
      png (1200x630) at the site root (og:image must be absolute). Manual: paste
      link into a preview debugger.
- [x] 9 Accessibility slate (each additive, all best-practice):
  - [x] 9a Key remapping: OPTIONS.bindings + rebuildKeymap; an options screen
        (O from the intro) rebinds by picking a number then a key; persisted to
        OPTIONS_KEY, separate from SAVE_KEY, so it survives New Year. Arrows stay
        as fixed movement alternates; R/M/H/F/Esc/O reserved.
  - [x] 9b Hold->toggle: OPTIONS.holdToggle; a tap flips the sustained verbs
        (sense/scent/drink) instead of holding, keyup doesn't release.
  - [x] 9c Scent colorblind safety ALWAYS-ON: prey trails FLOW (a bright band
        travels the trail — spatial wave on gold alpha), rival marks PULSE (a
        discrete in-place throb on red alpha/width) — distinct motion signatures,
        not hue.
  - [x] 9d Text scale (OPTIONS.textScale 1–2×, − / +): scales caption/msg/
        suggestion fonts AND lengthens caption/msg lifetimes (textLinger) so
        nothing flashes past at 1.5×.
  - [x] 9e True pause: ESC toggles gamePaused; update() early-returns wholesale;
        any key resumes; quiet drawPause overlay. Distinct from the map.
  - [x] 9f Flash ceiling: drawFlicker's full-screen tear/strike flash peak capped
        (~0.54 → 0.26); headlight cones are low-alpha moving glows, the train
        headlight ramps smoothly, fire glow is steady — no >3Hz full-screen jump.

## Part 24 — Playtest batch (Arjun, 2026-07-25)

- [x] 1 Holding behind Aspen: when told to hold, the pack holds WHERE IT IS, not
      at Aspen's spot — anchor each held wolf to its own position, not hers.
- [x] 2 Pack can't cross the rail when behind her: with her, crossing is fine;
      behind her (she's across, they aren't) it acts like a wall. Fix the
      pack/rail gating so a following/holding pack can follow her across.
- [x] 3 Housing complex: when the pack is seen from the subdivision, animate
      people (and maybe pets) walking OUT of the houses toward the wolves.
- [x] 4 Finite suggestions advance on completion: a finishable suggestion (pick a
      den, bring a carcass home) moves to the next one once done — not just the
      directional ("explore east") ones that only time out.
- [x] 5 Drink prompt timing: "hold Q to drink" stays the whole time she's over
      water (first drink), and lingers a few seconds after she leaves if she
      didn't drink — then "water underfoot" clears.
- [x] 6 The "click a place to plan a route" hint shows only on the FIRST map
      toggle, not every time.
- [x] 7 Den chosen => every "choose a den" line disappears (objective + prompts).
- [x] 8 Willow's dying circle (point-out) only appears AFTER the "hold SPACE"
      prompt, not before.
- [x] 9 Arrow keys always move (prologue teaching + options say so); WASD is
      rebindable, arrows are not.
- [x] 10 Taught controls reflect remaps: if WASD -> IJKL, the teaching text says
      "IJKL to move", etc. (read the live bindings, not hardcoded letters).
- [x] 11 Train warning has NO visible tremble/lights in play (only sound), and
      all three cues should last longer. Make headlight + tremble actually show
      and extend TRAIN_WARN.
- [x] 12 ALL trees are obstacles — none passable. Grow the collision to the whole
      tree (canopy), not just the trunk core.
- [x] 13 The carcass suggestion must say WHERE the carcass is (a bearing/mark),
      not just "find a carcass".
- [x] 14 A carcass gives a significant amount of food — a little less than an elk.
- [x] 15 Edge of territory: when she can't walk further at the world edge, tell
      her it's the edge of her territory (not a glitch).
- [x] 16 Contrast: on a lighter background (or as it lightens) switch prompt/HUD
      font to black for readability.
- [x] 17 Stale bottom prompts clear: a bottom-line instruction that no longer
      applies (e.g. "run it down" after the elk is being hunted) disappears.
- [x] 18 The prologue elk is NOT circled at "An elk, winter-thin." (drop the
      point-out there).
- [x] 19 The prologue should look more like winter.

## Part 25 — Follow-ups (Arjun, 2026-07-25)

- [x] A If the OLD den is chosen as home, its node label should read "The Den",
      not "The Old Den" (rename the node when the old den becomes home).
- [x] B Bram's water rumor: where he says water is, there is no VISIBLE water yet
      Q drinks and works — the resolved/rumored spring must be RENDERED so
      drinkable water is always visible where you can drink it.

## Part 26 — Bram's aging memory (Arjun, 2026-07-26)

- [x] Bram is wrong sometimes: when he surfaces a rumor there's a ~34% chance his
      memory is off (S.bramWrong) and there is nothing there. She searches the
      spot (~4.5s within 160u), then it reveals itself and the mark clears, so she
      is never left hunting an empty place. The FIRST wrong one explains why
      (his aging memory — not all he offers is still there); later ones are terse.
      Saved/migrated. Harness: a wrong rumor waits, then reveals as nothing.

## Part 27 — Pack rounds trees (Arjun, 2026-07-26)

- [x] A packmate stuck to the near face of a tree between it and Aspen now rounds
      it. The axis-separated tryMove sticks on a convex obstacle dead-ahead (no
      slide axis); moveAround() keeps that cheap slide for walls but, when it
      yields no progress, sweeps the heading outward (±0.6…±2.2 rad) and takes the
      first clear tangent. Applied to the follow AND hunt moves. Harness: a wolf
      rounds a circular trunk to the far side where plain tryMove sticks.

## Part 28 — Prologue look + tree shape (Arjun, 2026-07-26)

- [x] Prologue winter: (thaw REVERSED) the past land is now a LUSH spring green.
      PAST_GROUND was #96a468 (olive, ~= spring's own #8fa06f — so matching spring
      was invisible); bumped it to #79ac54 (G-R 14 -> 51, clearly green). Green
      wash dropped; snow a little lighter (90). Act I's own seasons unchanged.
- [x] Trees are circles/ellipses with soft imperfections, not many-sided
      polygons: the canopy is now a smooth closed curve (16 points, gentle 0.93–
      1.05 wobble + a slight random ellipse, quadratics through edge midpoints).

## Part 35 — The roadside vibration, found properly (Arjun, 2026-08-11)

- [x] Measured instead of guessed: path length vs NET displacement over 2 s. Beside
      the road the pack walked **~150u per 2 s with no net movement (ratio 9–37)**
      at amble speed. The cause was the wander, not the barrier: a wolf re-picked a
      fresh random point **the instant it arrived**, and the zone pinches to ~55u at
      a pinch like the road — so it crossed its whole zone in under a second and
      changed direction several times a second. A wolf that arrives now **stands**
      1.2–3.6 s before choosing again, and the new point is ≥ a third of the zone
      away. After: **ratio 1.0–1.1**. Regression check measures exactly this.
- [x] Real but NOT the cause (recorded so the distinction survives): `moveAround`
      alternated tangent sides with no memory, so it could flip left/right frame to
      frame against a long wall — it commits to a side now and remembers until it
      makes real progress. Old and new measured as vibrating equally.
- [x] Also real: a wolf that truly cannot get anywhere settles after 0.5 s of no
      progress (`stuckT`) instead of grinding.

## Part 34 — Playtest batch: slow wolves + fixes (Arjun, 2026-08-11)

- [x] **All wolves significantly slower** ("the current hunt mechanic isn't really
      necessary"): one `WOLF_PACE` dial (0.62) drives Aspen, the pack and Willow —
      `SPEED_ROUGH` 165, `SPEED_ROUTE` 185, `SPEED_SNOW` 134, `PACK_LOPE`,
      `PACK_AMBLE`, `PACK_ROAD`, `WILLOW_PACE`. Now under prey speed (deer 296,
      elk 272), so nothing can be run down at full stamina and the STALK is the
      hunt; a spent animal drops to ~0.56 speed, which is slower than she is, and
      that is the only window a chase still has. Rival wolves ease to a posture
      distance rather than running at a speed, so they are untouched; dogs keep
      their own pace.
- [x] The prologue elk was killed instantly by the pack. Two causes: any packmate
      (or Willow) counted as a catcher and the elk spawns nearly spent — in the
      prologue **only Aspen** may make that kill now; and it spawned 160u away,
      now ~330 clamped inside the close-in camera so it is still visible when named.
- [x] The prologue elk could also **leave the world**: a frail animal is exempt
      from the herd leash, so it ran in a straight line, escaped, and the escape
      rule REPLACED it with an ordinary full-stamina deer — uncatchable at the new
      pace, so beat 4 never ended. It is `scripted` now and leashed to where the
      beat put it; escapes/replacements never run during the prologue at all. A
      frail animal also no longer regains stamina, no longer retreats before it
      breaks, and is capped below `SPEED_ROUGH` so the first hunt stays winnable
      through any future re-tune.
- [x] Wolves vibrated beside the road when they could not cross: a target they may
      not reach is clamped back to their own side of the barrier (and the slot stops
      being re-rolled onto the asphalt every frame). **Not a confirmed
      reproduction** — see NOTES; needs Arjun's situation.
- [x] Willow's head was invisible while she died: it was drawn at 1.5·size in the
      same fill as a body reaching 1.9·size, i.e. inside its own silhouette. Now
      clear of the flank with a neck, a dark rim, muzzle, nose, laid-back ear, and
      an eye — open while she lives, closed once she does not.
- [x] The roster lied. Every death read "lost to the road" (a train or the western
      pack got the same line) — `deadCause` is recorded per wolf, saved, and named.
      And it said "freezes" for a wolf visibly running to safe ground: it now says
      "scatters" while moving, "freezes" only when actually rooted, and "waits to
      cross" at a barrier.
- [x] Sickness lifts **gradually** (`SICK_SPEED` 0.6 easing back over `SICK_EASE`)
      instead of snapping to full speed when the timer expires.
- [x] People carry violet: each of the townsfolk spilling out of the houses has its
      own cloud in `violetAt` and in the scent view, so pressing smell while they
      come out fills the nose with purple exactly where they are.
- [x] Mobile never names a key: the H and R lessons are skipped on touch (there are
      no such buttons), the F lesson reads "tap Wait", the help overlay drops every
      keyboard-only row (M/O/ESC/R R/H) and says "the pad" and "tap to open", and
      the crash card reads "Tap to return."
- [x] Mobile dead end fixed: the ending screen had **no touch handler at all** — a
      tap did nothing on the game's own last frame. It now restarts, and reads
      "tap to begin again".
- [x] All text fits any screen: `fitLines`/`drawFitted` step a line's size down
      toward a floor and then wrap, applied to prompts (growing upward so extra
      lines do not fall off the bottom), captions and their subtitles, the
      objective, the suggestion and the pack roster; the help panel width is
      `min(460, canvas.width - 24)` with proportional columns and row height.
- [x] `O` opens the settings mid-year (Part 33) — and the world holds while open.

## Part 33 — Playtest batch (Arjun, 2026-08-11, after Part 32/1)

- [x] The wind indicator was hidden behind the pack roster's names. Moved to the
      top CENTRE — the only strip nothing else claims (roster top-right, day and
      objective top-left, captions at 24% height, prompts at the bottom).
- [x] Ponds overlapped. `TERRAIN.springsPond` is a pond that is NOT in the
      `PONDS` array, so the layout probe never saw it — it overlapped the marsh
      pond by 88u and swallowed the springs node whole. The probe now checks
      every drawn water body against every other and against nodes, dens,
      forests, obstacles, herd anchors, the powerline, rail and highway; plus
      dens vs dens, rects vs rects, and rumors inside impassable ground. Marsh
      pond moved to (3080,3230) and the stock pond to (4270,1030), off the
      cattle's own grazing anchor. Two overlaps are exempted as intentional with
      reasons in the probe: the springs pond IS the springs node, and a
      `resolvesTo: 'changed'` rumor is *supposed* to sit on what changed.
- [x] Teaching moments piled up: answering a prompt with SPACE opened the next
      lesson on the same frame, and a tear could arrive on top with its forced
      map view and rip callout. A shared **moment gate** (`MOMENT_GAP` 4.5 s)
      now spaces them: every teaching trigger and callout must claim it, and each
      is latched on state that only grows, so a moment that cannot be had is
      **deferred, never dropped**. The tear itself still fires on arrival (that
      rule is load-bearing) but its teaching queues; a tear also claims a longer
      quiet so nothing stacks on it. Deliberately NOT gated on "no prompt
      showing" — several lessons are sticky prompts cleared only by the
      transition that follows them, which would deadlock the tutorial.
- [x] `X` (pounce) appeared to do nothing: pressing it outside the ambush window
      was completely silent, which reads as a broken key. It always answers now
      and names the reason — nothing near, already seen her, or too tall (with
      the crouch key named) — on a 5 s cooldown so it cannot nag.
- [x] `O` opens the settings mid-year, not just from the intro, and is listed on
      the `H` overlay. The world holds while they are open.

## Part 32 — THE FUN PASS (Arjun, 2026-08-11)

The game is finished and it works. It is also not fun: two verbs (open the map,
hunt), neither deepening over a year; survival is a pressure, never a pull; the
pack only shrinks; nothing accumulates. This adds the missing engine — a hunt
with a skill ceiling, a pack that grows, a bloodline across years, goals that
teach mastery, and feedback that makes it feel good.

**The explicit trade (authorized):** some austerity is spent on purpose. Numbers
go up on screen. A level-up is a small celebration. Where the choice is
"satisfying" vs "restrained", choose satisfying. The thesis survives because the
new systems CARRY it (the bloodline, Part 4) — not because the game stays quiet.
Do not soften these back toward solemnity in the name of tone.

Strict order 1→7. Parts 1–3 are the fun engine (stopping after 3 already
transforms the game). Part 4 is what makes it replayable and must not be skipped
for Part 5. After each part: harness green (`npm test`), `npm run layout` if
data.js geometry moved, **a browser play pass** (this order is all feel),
NOTES.md line, CLAUDE.md amended where a locked rule is superseded, commit+push.

Never in this order: rebuilding the map/tear/ending systems; touching the
prologue except the 1.7 lessons; multiplayer, crafting, inventory; a skill TREE
(traits grow by doing, never by spending points).

### Part 1 — The hunt gets a skill ceiling (stalk → ambush → chase)

- [x] 1.1 Prey `alert` (0..1) + `alertState`: grazing <0.35 (head down, no
      tracking), wary 0.35–0.7 (head up, stops feeding, orients, drifts),
      alarmed 0.7–0.999 (trots off, herd bunches), fleeing 1.0 (sprint).
- [x] 1.1 Alertness RISE per second while a wolf is inside `detectR`, summed:
      base `0.9 * clamp01(1 - d/detectR)`; wind (via `windAt`) upwind ×2.6 /
      crosswind ×1.0 / downwind ×0.45 by dot of wind vs (animal→wolf), dot>0.4
      upwind, dot<-0.4 downwind; motion sprint ×1.5 / walk ×1.0 / crouch ×0.35;
      cover (tree/forest disc or tall grass) ×0.55; light via `daylight()` full
      day ×1.15 / night ×0.7; herd transmission — any animal reaching alarmed
      raises herd-mates within 260u at +0.5/s.
- [x] 1.1 Alertness FALL −0.32/s with no wolf inside `detectR`, but never below
      0.2 for 25 s after a full flee (no immediate re-stalk).
- [x] 1.2 The crouch verb: sustained `crouch` input, default **Shift**, added to
      `OPTIONS.bindings` / `SLOT_FOR` / `REBIND_ACTIONS` / `HELD_SLOTS` (so
      hold-toggle works) + a touch button. Speed ×0.42, alert contribution
      ×0.35, sprite low with a slower gait. Cannot crouch while
      injured-sprinting, on the road, or during a chase (auto-release).
- [x] 1.3 The ambush window: within `ambushR` (~110u) of a grazing/wary animal,
      an ambush is available — contextual cue + commit on the existing
      interact/attack input (**add no new key if one can serve**; tap the crouch
      key while crouched). From grazing → prey enters the chase at 40% stamina
      and −12% flee speed for 2 s (a stumble); on small prey, an outright kill.
      From wary → 70% stamina, no stumble. Blown (alarmed/fleeing before commit)
      → full stamina, full speed, 25 s jumpy floor; most blown stalks should end
      in escape — that is the teacher.
- [x] 1.4 The chase keeps its logic; prey stamina drain scales with active
      pursuers `1 + 0.25*(pursuers-1)` capped ×2; catch still requires spent
      (stamina ≤0.12) AND adjacent.
- [x] 1.5 The pack in the stalk: packmates in the zone crouch when Aspen
      crouches and hold position (contributing alert at the crouched rate). A
      packmate blundering upright inside `detectR` is the main early failure
      source — this teaches F as a stalking tool. Once, contextually, on the
      first spoiled stalk: `'Fen went ahead of her. The elk had its head up
      before she was close.'` + the hint that F holds them.
- [x] 1.6 Reading the stalk: a persistent **wind indicator** (drift motes or an
      edge arrow — now load-bearing info); **alert pips** over prey (raised-head
      marker at wary, stronger at alarmed; prey visibly lifts its head — shape
      and posture, no numeric bar); an **ambush cue** (tightening vignette/pulse
      on the target + key prompt), unmissable the first three times via `S.tut`,
      then quiet.
- [x] 1.7 Teaching: first hunt teaches crouch (`'Low. Slow. The wind in her
      face.'`); first blown-upwind stalk teaches wind (`'The wind carried her
      ahead of herself. It knew before it saw.'`); first successful ambush names
      it (`'Close enough to choose the moment.'`). Each once, `S.tut`, saved.
- [x] 1 Harness: upwind vs downwind rates differ by the multipliers; crouch cuts
      rise and speed; ambush from grazing = 40% stamina, from wary = 70%; a
      blown stalk sets the 25 s floor; herd transmission alarms within 260u;
      pursuers scale drain; catch still needs spent+adjacent; a packmate upright
      inside `detectR` raises alert at the upright rate.

### Part 2 — Prey species with distinct tactics

- [x] 2 Add a `species` field and per-species stats to `HERDS`:
      **Elk** food 45, speed 272, stamina high, detectR 300, ambushR 120 —
      DANGEROUS: needs ≥2 pursuers or the catch fails and the elk turns, 35%
      chance to injure that wolf (existing injury system, no gore); front-on
      approach doubles injury chance. Teaches pack coordination.
      **Deer** 26, 296, low, detectR 420 (skittish), ambushR 95 — solo-able only
      via a clean ambush; wind and cover mandatory. Teaches the stalk.
      **Hare** 7, 330 (erratic), very low, detectR 180, ambushR 70 — NEW, always
      everywhere year-round, ambush = instant kill, tiny food. The
      anti-death-spiral valve and lean-winter filler.
      **Cattle** 60, 190, very low, detectR 200, ambushR 130 — slow, rich,
      watched; conflict ledger unchanged. The greedy option.
- [x] 2 Seasonal availability layered on the existing squeeze: hare ×1 all year
      everywhere; deer plentiful spring/summer, ×2 autumn, ×3 winter; elk ×1
      until autumn, ×2.5 autumn, none in winter east (existing rule); cattle
      unchanged. Net: summer fat and forgiving, autumn demands pack elk hunts,
      winter is hares and desperation — a difficulty curve driven by what you
      can eat.
- [x] 2 Hares spawn as many small scattered singletons (not herds), respawning
      on a ~40 s timer near cover. (Rides the existing day-based respawn at
      `respawnDays: 4`, which is ~36 s at the current 9 s day.)
- [x] 2 Harness: each species carries its stat block; a solo elk catch fails and
      can injure; a two-wolf elk catch succeeds; hare ambush is an instant kill;
      hares exist in every season; per-species seasonal respawn multipliers.
- [x] 2 (found while building it) `preyUpdate` built its `hunters` list with a
      positional COPY of Aspen — `{x, y}` only. Every rule reading a wolf's state
      read nothing, so **her crouch and her stillness did nothing in actual play**
      (`alertMotionMult` saw `undefined` and assumed upright), and identity checks
      against `S.wolf` could never match. Part 1's crouch check passed because it
      called `alertRiseFrom(S.wolf, …)` by hand. Fixed, with a check that goes
      through the real `update()`.

### Part 3 — The pack grows (the progression engine)

- [x] 3.1 Three trait counters per wolf (and Aspen): **Hunting** +1 within 200u
      of a kill, +2 as a pursuer at the catch; **Nerve** +2 crossing road/rail
      with no strike or balk, +1 surviving a near-miss, +2 a won
      standoff/posture; **Endurance** +1 per 1200u travelled while following.
- [x] 3.1 Tiers (all three tracks): untried 0–14, capable 15–39, seasoned 40–79,
      prime 80+. Effects multiplicative on existing values —
      Hunting: chase speed ×0.92/×1.00/×1.06/×1.12, prey drain
      ×0.9/×1.00/×1.15/×1.30; Nerve: balk threshold 0.45/0.55 (current)/0.68/
      0.80; Endurance: food drain ×1.06/×1.00/×0.94/×0.88, travel
      ×0.96/×1.00/×1.05/×1.09.
- [x] 3.2 Yearlings grow up: Alder and Fen start at `youth` 0.55 on speed,
      hunting contribution and nerve, rising ONLY through participation
      (`youth += 0.006` per hunting/nerve gain event, capped 1.0 by autumn). A
      protected yearling ends the year ~0.7; an invested one reaches 1.0 and
      earns tiers normally. The central risk/reward: take them along and they
      become hunters, keep them safe and they stay children.
- [x] 3.3 Roster read-out: each wolf shows their name + three small tier marks
      (shape/position, not colour alone), visibly filling across a year.
- [x] 3.4 Loss costs a build — preserve the intent; add NO resurrection or
      replacement mechanic.
- [x] 3 Harness: each gain event increments the right counter by the right
      amount; tiers flip at the stated values; effects apply multiplicatively to
      chase speed, prey drain, balk threshold, food drain, travel speed; youth
      rises only on participation and is capped; traits + youth survive
      save/load.

### Part 4 — The bloodline: progression that survives the year

- [ ] 4.1 A legacy record under its OWN key (`the-corridor-legacy-v1`), never
      cleared by `clearSave()` or New Year — only by an explicit "forget the
      bloodline" on the legacy screen: `{ generation, years[] (outcome,
      daysLived, packEnd, notableWolf; last 10), heirs[] (name + halved traits),
      inheritedWays[] (edgeIds), unlocks{} }`.
- [ ] 4.2 On ANY ending (arrived / failed / dead — a bloodline continues even
      when its leader does not): **heirs** — every wolf alive at the end carries
      its three counters at 50% floored; surviving yearlings become adults
      (`youth` 1.0) and KEEP what they learned; next year's pack is built from
      heirs first, topped up with untried newcomers to a roster of four.
- [ ] 4.2 **Inherited ways** — every `foundPath` walked into solid ink carries
      forward as inherited (amber) ink next year: the player's own map becomes
      the next generation's frozen inheritance. Build exactly this way; it is
      the thesis as a mechanic.
- [ ] 4.2 **And it will be wrong** — each new generation activates one more human
      obstacle from a defined escalation list (a second construction footprint,
      an extended subdivision, a new rail spur, a widened powerline) and it TEARS
      one of the inherited ways the player earned last year: *I walked this. It
      worked. It is gone.* Escalation caps after 4 generations.
- [ ] 4.2 Generation counter + the bloodline's best year on the intro; New Year
      (R) starts the next generation, not a reset.
- [ ] 4.3 Unlocks (modest, earned, never gating): finish any year → "the long
      year" (a longer, harder calendar) at the intro; finish with no losses →
      next founding pack starts one Hunting tier higher; reach prime in any track
      → that wolf's name persists in the bloodline's story; three generations →
      the **legacy map** (every generation's route overlaid on one satellite
      frame — also the best shareable image).
- [ ] 4.4 The legacy screen, after the ending card and before the intro: the
      generation, the outcome, which wolves survived and what they became, which
      ways carried forward, and (gen 2+) previous generations' routes ghosted
      beneath. Then "Press any key to begin the next year."
- [ ] 4 Harness: legacy survives `clearSave()` and New Year; traits carry at
      50%; surviving yearlings adult with traits intact; solid found-ways become
      inherited ink next generation; exactly one inherited way is torn per
      generation; escalation caps at 4; unlocks fire at their conditions.

### Part 5 — Goals that teach mastery

Achievements as a CURRICULUM, not a checklist — each points at a system worth
learning. Stored in the legacy record (they persist across years).

- [ ] 5.1 Hunting: *Downwind* (10 ambush kills); *Patience* (an ambush from
      grazing on an elk); *The Whole Pack* (an elk with ≥3 pursuers); *Lean
      Season* (survive a full winter month on hares alone).
- [ ] 5.1 Map: *Cartographer* (bridge every tear in one year); *Her Ways, Mine*
      (carry five found-ways into the next generation); *Blind Faith* (reach a
      node by a planned route without raising the map en route).
- [ ] 5.1 Pack: *She Taught Them* (both yearlings reach capable Hunting);
      *Whole* (a year with no losses); *Prime* (any wolf to prime in any track).
- [ ] 5.1 Nerve: *Through Their Ground, Unseen* (cross the western territory
      with no posture triggered); *Quiet Neighbour* (finish with rancher
      conflict at zero); *The Gap* (the whole pack across the highway inside one
      traffic gap).
- [ ] 5.1 Legacy: *Second Year* (begin gen 2); *Dynasty* (reach gen 4); *The
      Long Year* (finish the long calendar).
- [ ] 5.2 Presentation: a small quiet card on unlock (name + one line, ~3 s,
      soft chime, never blocking input); a list reachable from the intro;
      wording in the game's register — observations, not trophies.
- [ ] 5.3 In-run milestones: **hunt streak** (consecutive successful hunts with
      no failed chase, a small mark near the food bar; breaking it is silent,
      past 3 gives a soft acknowledgement); **pack strength** (one derived
      number, sum of tiers across living wolves, on the roster — it should
      visibly climb across a good year; this is the wanted "numbers go up");
      **season summary card** at each season turn beside the existing howl —
      days survived, hunts, kills by species, pack strength then vs now, ways
      found, territory mapped %. Four lines, three seconds, dismissible.
- [ ] 5 Harness: each achievement fires exactly once at its condition and
      persists; streaks count and break correctly; pack strength recomputes from
      tiers; the season card assembles real numbers.

### Part 6 — Juice

- [ ] 6.1 The kill: ~110 ms hit-stop on the catch, a low body-fall thud, a dust
      puff, and the pack converging to feed with a warm idle-feeding cluster.
- [ ] 6.2 The ambush: on commit a 0.25 s slow-motion (time scale 0.35) through
      the pounce, then snap back. **Reserved entirely for the ambush** so it
      reads as THE skill moment.
- [ ] 6.3 Level-up: on a tier crossing, a short howl, a mark-fill animation on
      the roster, and one line in the register (`'Fen runs like she means it
      now.'`).
- [ ] 6.4 Near-miss/escape: keep the whoosh; add a brief chromatic/desaturation
      pulse on a prey escape so failure has weight.
- [ ] 6.5 The pack feels alive: idles when stationary and fed — play-bows
      between yearlings, a wolf lying down, one drifting to Aspen to touch
      noses. Attachment is what makes both the fun and the loss land.
- [ ] 6.6 Wind and weather presence, now that wind is mechanical: drifting
      motes, grass lean, a stronger gust sound on high wind.
- [ ] 6 Harness (thin — browser-judged): hit-stop and slow-mo set AND restore
      the time scale; a tier crossing fires exactly one level-up; idles only
      when stationary, fed, and unthreatened.

### Part 7 — Rebalance for the new engine

- [ ] 7.1 Food economy: with hares as a floor and ambush efficiency as a skill,
      raise baseline drain ~+10% so hunting stays a live pressure. Verify a
      skilled player is comfortable and a careless one is not.
- [ ] 7.2 The difficulty fork: one diegetic question at year start — "A mild
      year, or a hard one?" Mild = drains ×0.75 and wider warnings; hard = these
      values. Persisted in options.
- [ ] 7.3 Winter: with deer ×3 and no eastern elk, winter is hare-and-nerve —
      genuinely lean, survivable by a strong pack, brutal for a weak one. Verify
      both the strong and the ruined run still finish (standing fairness rule).
- [ ] 7.4 Session length: target 45–70 min for a year. If the stalk pushes past
      80, shorten the CALENDAR rather than speeding the clock — the stalk needs
      its time.
- [ ] 7 Harness: mild/hard multipliers apply and persist; a scripted "strong"
      run and a scripted "ruined" run both reach an ending.

### Part 32 closing gate

- [ ] `npm test` green three runs; `npm run layout` clean; CLAUDE.md's
      superseded locked rules (pack only shrinks, hunt = spot-and-chase, no
      persistent progression, austere feedback) all amended.
- [ ] **Play a full year in the browser and answer honestly in NOTES.md — was
      that fun?** If no, the next session tunes Parts 1–3 rather than building
      anything new.

## Part 31 — The beat-6 lean-in gets its own mark on touch (Arjun, 2026-08-11)

- [x] On touch, the lean-in after the road crossing with Willow is no longer the
      Map button in the fixed column — it is a separate contextual mark that
      stands OVER Willow and disappears once the interaction is spent. Being
      told to press "Map" to lean into your mother read as operating a control,
      not making a gesture. `touchLayout()` returns `over` (a world-anchored
      button, projected from Willow's position each frame and clamped on-screen)
      alongside the four fixed buttons; it exists only in beat 6 before the bond
      lands. `leanIntoWillow()` is the verb; the mark is checked first in
      `classifyTouch` so it wins the rare frame it overlaps the pad. Map's
      beat-6 force-enable is gone (the beat-9 vigil keeps its own). The prompt
      reads "Lean into her — tap the mark over her." on touch, and the keyboard
      path (SPACE via `toggleMap`'s beat-6 branch) is untouched.

## Part 30 — Auto-mute on tab leave (Arjun, 2026-08-02)

- [x] Leaving the tab mutes the land (the constant ambience shouldn't play into a
      backgrounded tab); returning reopens it. A separate tabHidden flag ORs with
      the manual mute at the master gain (applyMasterGain), so returning never
      overrides an M-mute. Wired on visibilitychange, backed by window blur/focus;
      setTabHidden also resumes a context the browser suspended while hidden.
      Harness: auto-mute sets/clears, resumes the context, and a manual mute
      survives a leave/return.

## Part 29 — Prompt wording + touch controls (Arjun, 2026-07-27)

- [x] Act I spring ground now matches the prologue's lush green (SEASON_GROUND[0]
      #8fa06f -> #79ac54); summer/autumn/winter unchanged.
- [x] Scrambled movement ("still says WSAD"; "s is right, a is down") traced to a
      stale persisted binding set in the browser, not the code (DEFAULT_BINDINGS
      has always been correct WASD, and loadOptions merged the old blob over it).
      Bumped OPTIONS_KEY v1 -> v2 so those stale bindings are retired (returning
      player gets WASD back), and loadOptions now rejects a structurally-corrupt
      set (missing/duplicate key) back to the defaults. Harness: defaults spell
      WASD; a duplicate-key set self-heals.
- [x] The opening movement prompt reads "Walk — WASD or the arrow keys." (built
      from moveCaps() so a remap shows the real keys), instead of "the arrow keys
      move her, too." Fixes the WSAD confusion — the letters are spelled in order.
- [x] The held prologue vista now says "press a key to exit" instead of "press
      any key when you have seen it".
- [x] Touch devices (no keyboard) get on-screen controls instead of the "play on
      a computer" card: a LEFT action column (Smell / Drink / Map / Wait) and a
      MOVEMENT pad in the bottom-right corner. Everything scales off the screen's
      shorter side (clamped), so the controls take the same slice of the view on
      any device and leave the same land showing. touchMode (set by the boot gate
      via isTouchOnly) drives it; touchLayout() is shared by render + input so
      hit-tests match what's drawn. The pad gives 8-way movement (per-axis
      thresholds); Smell/Drink are held verbs, Map mirrors the map key (toggle +
      input.sense so the beat-9 vigil and beat-6 lean-in still work — Map is
      force-enabled in those two beats even before the map is hers), Wait = F.
      capOf() now returns button names on touch, so every teaching prompt reads
      "Hold Smell…", "Press Map…" etc. Intro/vista/pause say "tap…". Removed the
      block card. Harness: layout/draw/capOf/pad-drive/held-verb all covered.
