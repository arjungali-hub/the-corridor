# The Corridor — review fixes and design changes (work order)

Arjun's code review converted into ordered tasks (received 2026-07-17).
Work parts **in order**; after each: harness green (add checks where a part
says so), browser feel-check if it touches feel, NOTES.md line, commit named
`review fix N: …`. Do not refactor beyond what a task asks.

Status legend: [ ] open · [x] done · [~] partially done (note inline).

- [x] **Part 0 — TODO.md housekeeping.** The bible-gaps section must list
      only: Beat-8 matte vista art, overpass adoption arc, drought/
      construction ambient escalation, music/fuller audio. Everything else
      (rancher `rancherUpdate`, standoff `standoffUpdate`, silence
      `silenceUpdate`, Lichen `lichenUpdate`, fire `fireUpdate`) is built.
      (Done in the bible-content batch; re-verified 2026-07-17.)
- [x] **Part 1 — Base layer rebuilds every frame.** `drawWorld`'s key must
      equal `buildBaseLayer`'s three-segment key (era | season | burned).
      (Already fixed in the perf pass; harness now proves one build across
      repeated frames — see 'terrain builds once' check.)
- [x] **Part 2 — The ending is the pack's arrival.** 'arrived' requires the
      living pack gathered within ~400 of the range; waiting message when
      Aspen is there alone ('Not all of them are through…'); survivorCount
      snapshots who was actually there at `startEnding`; early arrival
      before WINTER_START says 'Not yet. The season has not turned.'
      Harness: stranded-packmate scenarios.
- [x] **Part 3 — Road: pack sprints on asphalt** (240·mult when position or
      target is on the road) **and the conducted crossing is taught** once
      near the road (F holds → cross → F calls them through), flag saved.
- [x] **Part 4 — Seasonal squeeze.** Eastern herds (anchor east of the
      highway, cattle exempt): respawn ×1 spring/summer, ×2.5 autumn, none
      in winter; western herd ×1 all year. One-time autumn message: 'The
      hunting thins. The east is emptying.' Harness: respawn-day math.
- [x] **Part 5 — Winter starvation ends the year.** In winter, food at 0
      continuously for 180 real s (extend `starveT`) → `startEnding
      ('failed')`. Other seasons unchanged. Harness: winter vs autumn.
- [x] **Part 6 — Daylight decoupled from the 5-s calendar.** `daylight()`
      runs off `S.time` (~75 s per visual day, same curve; keep the past-era
      branch). Night tint, headlights, rancher sighting inherit it. Calendar
      untouched. Harness: smooth change, unaffected by task freeze.
- [x] **Part 7 — Resume.** Intro screen offers 'R — return to the year' when
      a valid v2 save exists; `r` loads it, any other key starts fresh (move
      boot `clearSave()` into that path). Never auto-load. Harness: reboot →
      r restores day/edges/pack; non-r clears.
- [x] **Part 8 — Beat 9 scaffold** — absorbed into Part 13: the map now
      raises itself at the inherit and the rip callout labels Mud Spring. After the inherit, sticky 'Her map is
      yours now.' + SPACE until the map is raised once; then clear and queue
      the `rip` callout (Mud Spring labelled in place). Leaving the den
      unchanged.
- [x] **Part 9 — Bram's recall (one line).** Ghost edges render at 0.55·m
      (instead of 0.3·m) while Bram lives and is within ~300 of Aspen; first
      time: say('Bram remembers the far side. From before.') Once.
- [x] **Part 10 — Injury goes real-time.** Replace `injuredUntilDay` with
      `S.injuredT` seconds (75), ticking regardless of task freeze; read old
      save field defensively as 0. Harness: recovery proceeds while `day()`
      holds still.
- [x] **Part 11 — Small fixes** (one commit):
      1. [x] Master GainNode + M to mute ('M — quiet' in help).
      2. [x] `mapClick` only in play mode.
      3. [~] `senseRadius` ghost-skip — superseded while the radius is
             a flat WORLD.w·0.53; revisit only if ink-density radius returns.
      4. [x] Past-era strike text: 'The truck clips her. Willow is already
             there, pressing her to the grass.'
      5. [x] Fire day randomized 115+rand·45, rolled at newGame (S.fire.day).
      6. [x] Distinct message for pack-initiated cattle kills (Aspen > 500
             away): 'The pack took a calf on its own. The house will not
             know the difference.'
      7. [x] Prologue beat-4 kill: generic 'A kill…' say suppressed.
      8. [x] SPACE ignored while `forcedSenseT > 0` (no stuck-open map).
- [ ] **Part 12 — Play-test watch list** (no code unless it plays badly):
      fire jam at the road; the stacked northeast corner; Salt Lick detour
      grazing the Silence Zone; pup-feeding cadence vs western trips.

## Part 13 — Playtest additions (Arjun, 2026-07-17)

- [x] **Prologue map-flow redesign (the big one).** The inherit is the FIRST
      moment the map can be opened on command. Beat 3's map moment becomes a
      forced view (she shows you; no SPACE teaching); beat 7's winter-range
      map stays a forced view of *Willow's* map; SPACE stays locked until
      after the beat-9 inheritance. When the inherit hold completes, the map
      RAISES ITSELF (fixing "holding space doesn't open it"), the rip
      callout labels Mud Spring (absorbs Part 8), and there is more
      emotional buildup before the hold (longer stillness, a caption or
      two). After the map is lowered, Act I starts promptly — no long dead
      wander out of the den radius.
- [x] **Spring opens away from every den site** (at Aspen Stand), with
      a prompt to open the map; all three hollows are shown on it.
- [x] **A chosen den becomes a real graph node** ("home") with unknown
      edges to the 3 nearest nodes, walkable and inkable after selection
      (strip dynamic nodes/edges at newGame; recreate from denId on load).
- [x] Den choice: needs only ~1.2 s standing within 120 u (was 2.5 s / 60).
- [x] Old den naming: always "The Old Den" until chosen as home, then
      "The Den"; no doubled label at the old den site.
- [x] H's intro reads "What she knows how to do: H."; after a den is chosen
      the game teaches R ("R twice restarts the game (if you ever want
      to).") and then, a beat later, H.
- [x] The Bend impoundment bigger again (r 260 → 340); the southern detour
      rerouted around it through a new Sand Bar node (springs→sandbar→
      gravelBar replaces springs→gravelBar).
- [x] Map radius: flat half-the-territory-width, never position-dependent —
      confirmed already shipped (WORLD.w × 0.53, partial circle off-map is
      fine).
- [x] First arrival in new (grey-void) territory names the node ("Salt
      Lick. She will remember it.").
- [x] The patch task names its tear ("find a way around the Black River /
      the machines / the drowned Bend / the pit").
- [x] Patching works from both sides — verified: `checkBridges` runs an
      undirected BFS between the chain ends, so new ink laid from either
      side (or both, meeting in the middle) bridges identically.

## Part 14 — Playtest batch (Arjun, 2026-07-18)

- [ ] Intro resume line: 'R — resume the year from where you left off',
      placed a little further down the screen.
- [ ] Patching around a tear must work for ANY walked route around the
      obstacle, from any direction (the red-path screenshot around the
      pit): trail-based freeform bridging in addition to edge-ink BFS.
- [ ] Being anywhere around a human-made object causes its tear (footprint
      proximity, not only the derived trigger circles).
- [ ] Part 12 executed: fire-driven prey may cross the road (the jam
      breaks); NE corner spacing widened (cattle anchor shifted off the
      dog/fence stack); Salt Lick–silence overlap kept (deliberate); pup
      cadence left as tuned.
- [ ] Fear redesign: frightened wolves RUN to safe ground away from the
      threat and THEN freeze (dogs can no longer chew a rooted pack);
      applies to road encounters too; label reads 'freezes' (never
      'balks'); the frozen spell lasts ~10× longer.
- [ ] Lichen must never spawn inside blocked ground (she appeared in the
      pit).
- [ ] Pup HUD bar labelled 'pup food'. 'The pups are coming' goal line
      only within ~10 days of the birth; a different line before that.
- [ ] Dog bites injure packmates too, for longer than Aspen (slow, real
      time), visible in their gait/speed.
- [ ] Winter snow slows all animals (prey and pack), not just Aspen.
- [ ] Weather, a few days per spell: sun (normal), cloud (visible radius
      shrinks), rain (scent washes out faster + the world darkens).
- [ ] Food drains slower when the pack is smaller.
- [ ] Ambience follows location: traffic hum near the road, water near the
      creek, birds in the woods in the green seasons.
- [ ] Sparse music at the emotional beats (the inheritance, the pups'
      birth, the year's end) — short motifs, nothing looped.
- [ ] A packmate must NEVER step onto asphalt unless Aspen herself is on
      it (Fen died following a zone slot onto the road while Aspen stood
      beside it).
- [ ] Prologue beat 1 introduces the pack by name before the scent lesson.
- [ ] In the prologue the pack's zone follows WILLOW while she lives;
      leadership passes to Aspen at the inheritance.
- [ ] The patch task marks its tear on the raised map (emphasis pulse);
      the scout task names the compass direction of the unknown ground.
- [ ] More task variety: a carry-it-home delivery task and a lost-packmate
      search task (with direction words), alongside hunt/patch/pups.

When all parts are done: NOTES.md session entry, full harness, one complete
browser year, commit.
