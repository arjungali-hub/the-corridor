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
- [ ] ⏳ Realistic art + animations (render rewrite in progress):
      pre-rendered terrain base layer (trees w/ shadows, creek banks, road
      texture, construction, rooflines, season dressing), articulated
      walking wolves/elk/deer (legs, tails, gaits), day/night light,
      weather particles, screen shake, upgraded parchment map (wobbled ink,
      compass, fibered rips), nicer HUD/prompt/keycap art, help overlay.
- [ ] ⏳ Scent view must cloud the edges of Aspen's vision, worse inside
      violet human noise (edge fog scaled by `violetAt`).
- [ ] ⏳ NO route lines in the world view — trails told you where to go.
      Routes appear only as ink on the map, only once walked (inherited ink
      from the start, per the bible).
- [ ] ⏳ Map bigger / zoomed out more (SCALE_MAP 0.26 for the big world,
      larger senseRadius) — verify feel in browser.
- [x] A LOT more land ("I meant it"): world 5200×3600 (was 2600×1800), all
      geometry rescaled ×2 plus new territory: North Ridge / Black Pines
      (north), Long Marsh / Salt Lick (southeast), Low Flats (southwest,
      gives a second at-grade road crossing), 4 herds, more forests.
- [x] Time passed too slowly: MIN_PER_SEC 24 → 48 (1 day ≈ 30 s, year ≈ 3 h).

- [ ] ⏳ **The game must follow the production bible — including the
      prologue.** Arjun: "There should be these scenes like the prologue
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

- [ ] ⏳ Prey movement must be smooth — no rapid vibration. Damped steering,
      low-frequency wander; kill the per-frame panic jitter and separation
      flip-flop.
- [x] No black void outside the playable area: a 600 u **apron of land**
      (ground, forests, the road itself) renders beyond the world bounds.
      Aspen cannot walk into it; pack and prey can.
- [x] Cars slide in from the far edge of the apron and **pass under the
      bridge** — hidden beneath its deck, reappearing on the far side.
- [x] Water-Under-Stone is a real **bridge over the road**: earth deck,
      rails, abutments, shadows on the asphalt; thin walls seal deck↔road
      transitions mid-span (collision + visual).
- [x] Prey leaves longer scent trails (drops every 0.9 s, readable ~200 s).
- [ ] ⏳ **Pack AI v2 — the zone.** An invisible zone around Aspen: pack
      wolves wander randomly while inside it and steer back toward it when
      outside; near a road/wall/the bridge's elevation the zone shrinks (the
      pack tightens around her); **F anchors the zone in place** instead of
      it following Aspen. The zone may extend into the apron, and pack wolves
      may enter apron ground even though Aspen cannot.
- [ ] ⏳ **Pack hunting.** Adult wolves close to prey chase it on their own,
      breaking off once beyond a hunting radius (~2× the zone) from the zone,
      and returning to the zone when the prey escapes. They avoid roads and
      obstacles while hunting. **Pups always stay inside the zone.**
- [ ] ⏳ Prey slightly **slower**, and prey may flee into the apron (where
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
- [ ] ⏳ **Tears must mirror the actual human obstacles** (Arjun): a tear
      should exist because a real obstacle severs that ground, and should
      span the whole obstacle — the road tear spans the entire road (every
      inherited route that crosses it tears, the rip drawn along the road,
      not just one segment). Add more human-made obstacles (fence lines, a
      gravel pit, a powerline cut …) and derive tears from their footprints
      rather than from hand-placed trigger circles.
- [x] **Clickable map routing**: click a known place on the raised map and
      the way there glows along known ink (Dijkstra over untorn edges);
      clicking again dismisses it; arriving clears it; a tear that breaks
      the plan says "The way she had in mind is gone." No path: "The map
      holds no way there." Map zoomed out further (0.17). Old-den standing
      can't accidentally choose the den anymore (needs the choice prompt
      first, and never while the map is up).
- [ ] ⏳ **The tear at The Bend isn't earned** (Arjun): nothing physically
      blocks the old way there — you can still walk it. Either give the
      drycreek break a real physical cause in the world, or don't tear it at
      all and let the water route fail differently (the creek is dry, so the
      route's *purpose* is gone while the path itself survives — e.g. its
      ink fades to a "dry" state instead of ripping).

## Acknowledged gaps vs the production bible (future sessions)

- [ ] Beat-8-quality art for the cut (matte vista layers); Beat 6 play-fight
      animation beyond the warm nuzzle glow.
- [ ] The rancher thread + hidden conflict meter + gate/rifle payoffs.
- [ ] Standoff and Silence Zone encounter systems.
- [ ] Lichen, the fire set piece, drought parameter, construction as
      audible eastward progress bar, overpass adoption arc.
- [ ] Music decision; fuller audio (pack vocal language, per-season ambience).

## Verification ritual

Run the harness (all checks must pass) before every commit; play a year in
the browser for feel. NOTES.md gets a session entry + tomorrow's first
action; commit everything.
