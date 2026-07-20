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
