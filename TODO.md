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
- [ ] ⏳ No black void outside the playable area: an **apron of extra land**
      is rendered beyond the world bounds. Aspen cannot walk into it
      (invisible wall at the current bounds).
- [ ] ⏳ Cars slide in from the edge of the apron (never pop in at the world
      edge) and **pass under the bridge** — hidden beneath its deck, then
      reappearing on the far side.
- [ ] ⏳ The crossing at Water-Under-Stone is a real **bridge over the road**
      with an elevation difference: you can never step from the road onto the
      bridge or from the bridge onto the road within its span.
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
- [ ] ⏳ **Aspen's movement speed should equal Sedge's** (Arjun) — Sedge
      moves at 230 × 1.12 ≈ 258; Aspen currently walks 185 off-route / 265
      on-route. Rework so Aspen's base speed matches Sedge's (and keep the
      pack's relative speeds sensible when the zone AI lands).
- [ ] ⏳ **Tutorial slower**, and it must teach what the scent-view colors
      mean as each is first seen: gold = prey passed, brighter is fresher;
      violet = human noise that blinds the nose; red = rival pack marks.
- [ ] ⏳ **Tears must mirror the actual human obstacles** (Arjun): a tear
      should exist because a real obstacle severs that ground, and should
      span the whole obstacle — the road tear spans the entire road (every
      inherited route that crosses it tears, the rip drawn along the road,
      not just one segment). Add more human-made obstacles (fence lines, a
      gravel pit, a powerline cut …) and derive tears from their footprints
      rather than from hand-placed trigger circles.
- [ ] ⏳ **Clickable map routing** (Arjun): click a node on the map and be
      shown how to get there along known ink (Dijkstra over untorn edges);
      no path = the map says so — this is what makes tears matter. Plus the
      map should zoom out further.
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
