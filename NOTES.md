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

review fix 4: the seasonal squeeze. respawnMult(H): eastern herds (anchor
east of the highway, cattle exempt) respawn x1 spring/summer, x2.5 autumn,
not at all in winter; the west holds x1 all year. One-time autumn line 'The
hunting thins. The east is emptying.' replaces the routine kill message for
that kill (it was being clobbered otherwise). Harness: autumn 2.5x math,
winter east no-refill, winter west refill.

review fix 5: winter starvation ends the year. starveT now accumulates
whenever food is 0 (it used to stop once Sedge left); at 180 real seconds
on empty in winter, startEnding('failed') — the existing failed line
already reads right for it. Other seasons keep their current costs only.
Harness: autumn 180s+ no ending, winter ends.

review fix 6: daylight decoupled from the calendar. daylight() now runs on
S.time (~75 real seconds per visual day, same curve, past-era branch kept);
S.time already ticks through task freezes, so the light never stalls and
never strobes. Night tint, headlights, and the porch-sighting gate inherit
it. Harness: midday light at calendar midnight, smooth motion.

review fix 7: resume. hasResumableSave() peeks localStorage (v2) without
loading; the intro screen shows 'R — return to the year' when it's true.
In intro-mode keys: r loads the save (fallback: fresh), any other key runs
clearSave() + beginFromIntro() — the clearSave moved out of boot, so the
save survives until the player chooses. Never auto-loads. Harness: reboot →
r restores day/pack/edges; non-r key starts day 1 and clears the save.

review fix 9: Bram's recall. bramRemembers() — ghost edges exist, Bram
alive and within 300 of Aspen — brightens ghost ink on the raised map to
0.55·m (from 0.3·m); first time it's true: 'Bram remembers the far side.
From before.' (S.tut.bramRecall). Pure render + one line, no pathing.
(Part 8 is deliberately skipped here: absorbed into Part 13's prologue
map-flow redesign, where the map raises itself at the inherit.)

review fix 10: injury joins the real-time rule. injuredUntilDay is gone;
S.injuredT (INJURY_TIME 75 real seconds) decrements with the other global
timers, so a task freeze no longer stretches a wound. isInjured() =
injuredT > 0; all four wound sites (car, rifle, standoff, dogs) set it.
Save schema keeps v2 and reads old saves' missing field as healed.
Harness: day frozen by an open task, wound still heals (and: the rifle
really does refresh a wound if she stands in the yard — moved the test).

review fix 11: small fixes. (1) master GainNode — every voice routes
through it; M toggles mute ('Quiet.' / 'The land has its sounds again.'),
'M — quiet' in help. (4) past-era truck strike: 'The truck clips her.
Willow is already there, pressing her to the grass.' (5) fire day rolled
at newGame: 115 + rand·45, stored on S.fire.day (old saves fall back to
130). (6) first pack-initiated calf kill (Aspen >500 away): 'The pack took
a calf on its own. The house will not know the difference.' (2,7,8 were
done earlier; 3 superseded by the flat map radius.)

playtest fix: beat-5 prompt lag (Arjun). 'Now. Cross behind her.' was
queueing behind the still-showing 'She waits…' line, surfacing after the
crossing; and beat 6's 'Lean into her.' stickied whatever prompt was
current — freezing the stale waiting line on screen. The truck's passing
now replaces the waiting prompt immediately (and skips 'Now. Cross' if she
already crossed); the crossing flushes beat-5 talk and uses stickyPrompt
properly.

review fix 13 (the big one): the prologue map-flow redesign + the den as a
real place.
- The map is Willow's until the inheritance: mapAllowed() in the prologue
  is simply S.inherited. Beat 3's SPACE lesson is gone — at ~6.5s she
  forces the view herself ('Her map.' / 'not yours — not yet') with the
  willow-ink callout; beat 7's range view stays forced.
- Beat 9 buildup: 'Her breathing is shallow.' on approach, six seconds of
  stillness, 'She has been waiting for you.', then the ask (sticky 'Stay
  at her side. Hold SPACE.'). The hold only counts after the ask.
- On inherit: sawMap becomes true, the map RAISES ITSELF (S.mapOpen =
  true), the rip callout labels the Mud Spring tear (absorbs Part 8), and
  Act I starts promptly when she lowers it (walking out still works).
- Spring opens at Aspen Stand — away from every hollow — with the den
  prompt up immediately ('raise the map; the hollows are marked') and
  denPrompt true from the first frame of Act I.
- chooseDen materializes the hollow as graph node 'home' (den dot, 'The
  Den', visited) with unknown edges to its 3 nearest nodes — walkable into
  ink like any path. Dynamic node/edges strip at newGame and are rebuilt
  from denId in loadGame before edge states restore.
Also: fire-day check pinned in the harness (the roll is random now).
Harness green x4 including new checks: forced beat-3 view, SPACE refusal,
stillness-then-ask, auto-raise, rip labelled, prompt Act I, spring away
from hollows, den-node creation/inking/save-load.

gap feature: beat-2/beat-8 vista mattes. drawVistaMatte() paints two held
full-screen mattes from one seed — the same six ridgelines both times.
Past: golden morning, birds, unbroken conifers, the creek. Present: cold
sky, the highway scar with strung lights and power poles pacing it, the
construction blocks + crane + red beacon in the east, the subdivision's
lit gables. Cached per era + canvas size; alpha follows vistaT in/out
(S.vistaTMax stamped at both set sites). Drawn only while a prologue
vista holds.

gap feature: the overpass adoption arc. OBSTACLES.overpass (y 620-760 on
the north stretch) opens at day 170 — what the construction was building.
From then: its band of road is earth (onRoad false — no cars, no balk, no
strikes), prey may cross there (blockedAt gap), edges sealed at grade like
the culvert bridge, deck drawn over the traffic with parapets and shrubs.
Three told moments, once each: the opening ('The machines finished
something in the north…'), Aspen's discovery ('Earth over the roar…'),
and the first deer seen crossing ('The land is learning the bridge.').

gap feature: ambience beds + the construction progress bar. One looping
filtered-noise wind bed, weight per season (winter heaviest, prologue a
hush), eased toward its target; and the machines in the east — a distant
thump (sometimes with the back-up beep) every 7-13s, louder as the year
advances and the farther east she stands, silenced forever the day the
overpass opens: that is what they were building. All through masterGain
(M mutes everything). Music decision recorded: no melodic score — the
land is the whole soundtrack, per the bible's austerity.

gap features: drought + the powerline cut. Summer tints toward straw as
day approaches the fire's rolled date. POWERLINE (construction ground →
subdivision): pale cleared strip, slash piles, pylons with sagging wires
in the base layer; inPowerlineCut() keeps prey from grazing under the hum.
TODO.md's gap list is now fully closed — every bible feature has a
build. Next: Arjun's browser pass on the Part-12 watch list (fire jam,
NE corner, Salt Lick/silence, pup cadence) and general feel.

## Part 14 batch (2026-07-18, Arjun's playtest)

14a: fear runs before it roots (safePointFrom + fleeStep; FREEZE_TIME 70s,
10x; 'freezes' label); road sealed to the pack unless Aspen is on it or
already across; packmate dog wounds (2x, 'hurt'); Lichen spawn rescue;
fire-jam relief; cattle off the NE stack; winter snow slows everyone;
food drains by mouths; PUP FOOD bar; pups-are-coming within 10 days only;
resume line reworded and lowered.
14b: tears fire anywhere within 150 of the human-made footprint; a way
around is ANY walked trail between the rip's ends that skirts the
obstacle and the asphalt (freeform bridging, either direction); the
active patch-task tear pulses on the map; scout tasks name compass
directions; new findwolf ('missing', self-resolving) and cache-carry
(+18 food) tasks.
14c: beat 1 names Bram, Sedge, Alder and Fen before the scent lesson;
zoneCenter follows Willow until the inheritance.
14d: weather spells (sun / cloud shrinks senseRadius to 0.72 / rain ages
scent 3x and darkens, saved in v2); location ambience (road hum, creek
brightening the wind bed, birdsong in green woods by day); sparse motifs
at the inherit, the pups' birth, and the pack's arrival — music exists
now, only where it is earned.

Harness green x4 through the batch. Next: Arjun plays a full year.

## Part 15 — design drifts (2026-07-19, Arjun's review)

Audited first: every Part-14 item (weather included) confirmed present in
code before starting.

Drift 1 — the world never waits. MIN_PER_SEC 288->160 (day ~9 s, year
~54 min); the calendar runs unconditionally, no task freeze. Tasks are
URGES now: no chime, no 'Done' line, no 120 s expiry — an urge clears
because the world changed. 'Renew' is gone (decay is the discovered
dilemma). World-clocked endings only: a lost wolf comes back alone
(~240 s); ravens finish an unclaimed carcass (~300 s). Decay day-counts
rescaled 45/75 -> 25/42 (same real-time pace).

Drift 2 — adoption is played. The deck reeks: packRefuses() seals it to
the pack until Aspen conducts them (same F verb, opposite-sides rule);
per-wolf deckFrom counts completed crossings; at 3, overpassTrusted() and
'The pack knows the bridge now.' Prey blockedAt honors trust — no deer on
the deck before the wolves taught it. From day 240 the eastern-born herd
anchors mill against the road (h.x1+300, easing toward the deck's y);
once trusted they trickle west 90/day to x 620 — the east visibly drains
across the bridge. Anchors reset at newGame (anchor0) and ride the save.

Drift 3 — the gift is a rumor: a raven column (8 circling birds, 60-550
up) over the gift spot until claimed, plus a gold scent bloom refreshed
every 2.2 s. Low-conflict players get found by their reward.

Drift 4 — wind. S.wind.a random-walks, re-rolls with each sky.
windDetectMult: upwind approach seen at up to 2.1x flight radius,
downwind 0.6x, rain x0.75; windless in the past era (the first hunt is
meant to be won). Scent view shows drifting streaks the way it blows.

Smaller: season-turn ritual (forced 10 s raise; Willow's original
inherited map ghosts over the scarred present, fades over the last 3 s);
Sedge's mark at the world's edge in winter ('Sedge. Going somewhere the
map does not go.'); F during a standoff = the pack stands tall (instant
win with >=2 adults at fear +0.25, bluster alone — the nip comes at
once); lean west (winter west-side spawns are wary: 1.3x flight radius,
slower tiring, 0.65x meat).

Harness green x3 (new checks: urge/no-freeze, wind up/down/rain, distrust
-> three crossings -> trust -> prey follow, mill/trickle anchors, season
ghost smoke, standoff F, Sedge's mark). Next: Arjun plays a full year —
the new pacing (9 s days, no freeze) is the thing to feel first.

## Part 16 — playtest batch (2026-07-19)

The land is bigger, closer, and meaner.
- View: normal play runs at 2x zoom; holding E pulls the camera back out
  to the old framing — and the scent view is near-black now (0.82 wash,
  deeper fog): only trails and marks read.
- The far west: WORLD.x0 = -2400. Winter Range moved to (-1900, 900),
  reached through Ash Saddle; the fenced RAIL LINE (x -1130..-1070, one
  trestle under at y ~3025) walls the west. Her mother's last miles
  (ashSaddle-winterRange, inherited) tear at the rail; the way around is
  four unknown edges south through The Trestle and Cold Rise. Base layer,
  camera, map fit, sense radius (0.5 span), satellite, bounds all honor
  x0. The prologue crosses in the past era, where no rail exists.
- Danger: WATER runs beside food (0.10/s; WATER bar). Drinking is an ACT
  — stand still in the shallows (taught once). Fouled sources (dead
  channel, pit sump, stock pond) sicken her 75 s (slow, hungry, 'sick'
  line); wading drags (0.7x); winter water can plunge her through thin
  ice; snare lines appear by the wire at conflict > 0.4 (held 3.5 s +
  wound); roadkill appears on the shoulder (+15 food beside the traffic);
  a clean cold creek waits in the far west. All saved.
- 'The moment passes' no longer returns a lost wolf: unfound for ~420 s,
  they are gone for good.
- Aspen 266/298/216; Sedge mult 1.08 (prey pace). Inking needs 8 of 10
  buckets (80%); a completed pass names both end nodes. The mudspring
  spur and its tear are gone (the rip callout waits for the first real
  tear). Tears also fire within 150 of their edge lines or rip path.
- Paths curve: edgeVia() derives waypoints around the impoundment, pit,
  construction, subdivision; traversal, route-speed, and rendering all
  follow the curved path (distToEdgePath).
- Seasons change the territory: construction's effective rect grows 80/
  season (collision + tear zone + drawing), a second subdivision row
  stands by autumn, winter lids every water source in ice — with the
  existing palette shifts, stakes, drought, and char, little of the land
  stays unchanged by year's end.
Harness green x3 (new checks: drink action, wrong water, wading, curves,
construction growth, rail wall/trestle/tear, radius span).

## Part 17 — prologue polish (2026-07-19)

Beat 1's scent lesson now has a live subject: a low-skittish deer spawns
460 u offscreen as 'Hold E' appears and grazes a line right past Aspen.
Beat 4's winter-thin elk spawns at (w.x-50, w.y-140) — inside the 2x
viewport when named. And F left the prologue entirely: beat 6 is only
the lean-in, beat 7 walks on with no lesson, togglePackStay is inert in
the prologue past the bond, applyPostPrologue no longer grants fTaught —
the verb is taught ~14 s into spring ('The pack is hers to lead now.').
Harness green x2 (beat-7 rewritten: no-F checks; deer-nearby check).

## Water made real + tears made honest (2026-07-19, follow-up batch)

Drinking is hold-Q, standing in water (input.drink; blur-safe; taught in
place; help row). WATER_SOURCES is gone: waterAt() reads the DRAWN water
— TERRAIN.creekFlow within 48, plus four rendered PONDS (marsh pond, pit
sump, stock pond, the far-west cold pool) with banks/shine/film/winter
lids. waterFouled(x,y) derives sickness from proximity to people: the
impoundment (900), construction/subdivision/pit rects (420, seasonal
growth included), the ranch house (900), asphalt runoff (220). Wading
drag rides waterAt too. Tears: nearTearLine uses only the PHYSICAL rip
path (edge-proximity removed — the damage must be in the close camera's
vision); footprint groups get an auto ripPath tracing the obstacle's
outline at fire time (obstacleRect-true, cleared at newGame, rebuilt on
load) so every rip is shaped like the thing that caused it.

## Deep playtest batch (2026-07-19/20)

Water is the drawn water: ponds painted into the base terrain (banks,
shallows, reeds, scum, winter ice) + the creek line, fouled by proximity to
any human works (waterFouled). Drinking is hold-Q standing still, taught by
thirst and at the bank. Sick = 0.6x speed. One playHurt sting for all harm
to her; first sick/snare/ice captions once. TEAR_NAMES is the single source
of truth: named on the map and asked for by the patch urge. Rips draw as the
obstacle's jagged outline (closed-shape fix). Tears fire only when physical
damage is in her 2x-close vision. Layout de-overlapped (overlap-probe.js).
Railroad walkable; TRAINS (1700 u/s, 1300-long) kill even Aspen ->
startEnding('dead'). Weather visuals strengthened. Overpass shows the road
continuing beneath. Prologue forced views use the west-extended mapFitScale.
Harness green x3.

## map-central 1: exploration fog (2026-07-20)

The map is now a record of what Aspen has SEEN, not what Willow knew. A
coarse seen-grid (SEEN_CELL 120u, SIGHT_WORLD 240u) marks ground within
sight each tick, saved in v2 (read defensively), the migration corridor
pre-seeded in applyPostPrologue. Three map tiers in drawInkEdge/drawMap:
walked inherited ink = full; unseen inherited = faint cold dashed rumor-
thread with dim unnamed nodes; unseen-uninherited = grey void. Node names
resolve on first sight (visited OR nodeSeen). Routing still plans over
inherited-unseen edges, but such legs draw cold+dashed (remembered, not
confirmed). Harness: corridor seen, far ground rumor, walk-to-resolve,
seen-grid save round-trip.

## map-central 2: route persists as a bearing cue (2026-07-20)

The play view now has a real porthole (drawPlayFog) fading the land to dark
past playSightWorld() world-units x cam scale — the map is something you
navigate BY, not glance at. routeNextNode() finds the next un-reached node on
S.routePath; drawRouteCue paints drifting pale motes at the fog edge in that
bearing (not a line, not an arrow — a remembered pull). The cue dies the
instant a tear nulls the path. Harness: bearing exists + points west, dies
with the path.

## map-central 3-5 + directed exploration B1-B5 (2026-07-20/22)

Block A finished. A3: playSightWorld() is world-units (canvas-independent),
pulled down by violet (×1-0.5v), night (×0.5-1 of daylight), rain/cloud;
floor 90u so a night road forces map-reliance. The scent view's clear radius
was the screen-space bug (min(canvas.w,h)) — now SIGHT_WORLD×2.6×camScale.
A4: the season-turn ritual (already partly built) now defers off the road
(pendingSeasonRitual), holds 5.5s, ghosts Willow's WHOLE confident un-torn
map over the live sparse one, and says 'What her mother knew. What is left
of it.' once. A5: toggleMap ignores forcedSenseT, seasonGhostT, and the
beat-9 pre-inherit hold — a stray SPACE can't fight the auto-raise.

Block B — exploration is now directed (bearing, never waypoint). B1
preyBearing(): food<55 → nearest distant herd-region with living prey blooms
gold at the scent-fog edge, intensity by hunger. B2 waterBearing(): water<45
and no clean water underfoot → nearest clean pond blooms cool; waterFouled
is point-based so the western pool reads clean; the stacked slow multiplier
(injury×sick×thirst×wading) is floored at 0.5 — no death spiral. B3 RUMORS
(5): faint threads from inherited nodes into grey ground; walking to one
cashes it — a hidden spring (real clean water via S.foundWater), +20 food, a
30s sight-widening vantage, a den bank, or a 'changed' note that is now the
fouled impoundment. Saved. B4: winter near the emptied den says 'Nothing
answers the hunt here. The living land has moved west.' once; the squeeze +
drift keep the west alive. B5: issueTask now leads with the distant spine in
travel seasons — a 'range' task (reach the winter range, named by compass)
or scout — with pups/hunger as interrupting counter-pulls only when dying.

Harness 232 checks, green x3. Next: play a full year in the browser watching
for whether you ever wander randomly (you should not) and whether the map
feels like the center.

## westpack 1: data (2026-07-22)

The western pack's ground: OBSTACLES.westCut (a clearcut at 260-620,1500-1900
— the human act that drove them) + its violet source. WEST_PACK: appearDay
155, territory (480,1300) r620 over the farBench/highMeadow pinch but clear
of winterRange, strength 5, 6 marks in their OWN array (SCENT_RED untouched),
patrol {period 90, 4 legs}. Added the stonyBench-longSlope edge — the seed of
the southern detour that skirts the territory (Part 7). Optional shared-cause
tear SKIPPED: no inherited edge runs cleanly through the suggested scar, and
the spec says don't force it. Harness: footprint+violet, territory overlaps
the approach and excludes the range, marks distinct + inside.

## westpack 2-6: arrival, exposure, patrol, encounter, strength (2026-07-22)

westPackUpdate(dt) wired after standoffUpdate. P2 arrival: westActive() =
day>=155; marks-first, one-time 'New marks on the far side…', static after,
survives save/load. P3 exposure (S.exposure 0..1): rises inside by time
(.02) + depth (×.06) + fresh-mark proximity (×.10) + detection (×up to 3.2,
from patrol-in-sight, daylit, upwind), drains .16/s outside and bleeds while
hidden; clamped so one tick never crosses two thresholds. P4 patrolCentroid()
deterministic+periodic from S.time; markFreshness() = recency the loop passed
near a mark (readable in scent view). P5 state machine calm→sighting(.33,
rivals appear)→confrontation(.66, F posture)→clash(1.0, costly, forced out).
P6 aspenStrength() = self + Σ(adult 1 / yearling .5)×condition×injury, ×
fear factor, vs fixed 5 at k .9. Win → 40s lane opens (exposure pinned low);
lose → westDriveBack to the edge (repositioned, NOT hurt) + detour guidance;
clash → a possible loss on the weaker side, always forced out. F at the
western line routes to westResolvePosture. Fixed a real edge case: drive-back
from the exact center (zero vector) now falls back east. Harness: full run
of P2-P6, 20+ checks; ALL green.

## westpack 7-9 + rendering (2026-07-22)

P7: the stonyBench-longSlope edge (added P1) completes a winter-range route
that skirts the territory entirely (oldFord→willowSlough→culvert→stonyBench→
longSlope→railGap→coldRise→winterRange, all nodes outside r620) — verified by
BFS, and it is >1.3× the direct path (days, distance, hunger); a lost posture
already surfaces the guidance line. P8: westCut renders in the base layer as a
clearcut (bared ground, pale stump-rings, slash, skid ruts dragged east) —
kin to construction; reaching it fires 'This is what drove them. The same
hands, a different corner.' once. P9: verified the eastern pack (SCENT_RED /
standoffUpdate) never touches S.exposure/westState/westLaneT/westRivals —
separate systems, its passivity intact. Rendering: western marks drawn
freshness-lit in scent view (brighter/larger than the eastern marks, a fresh
one steams) so the patrol pattern reads beyond the sight fog; westRivals drawn
as RIVAL_TONES wolves at the fog edge from sighting on. GUARDRAIL satisfied —
timing avoids, the detour yields, a loss never injures; never a mandatory
fight. 261 checks green x3. Next: play to the western corridor with a strong
pack and a deliberately ruined one — both must finish.

## westpack: remove the "skirt it" detour (Arjun, 2026-07-22)

Design reversal of the spec's guardrail: the southern detour is removed
(dropped the stonyBench-longSlope edge), so there is NO route to the winter
range that avoids the western territory — every path runs through farBench/
highMeadow, both inside r620. A ruined pack must now TIME the patrol and slip
through, not go around. westSurfaceDetour → westSurfaceTiming ('No way around
them. Read their marks — cross when the fresh sign is on the far side.').
Guardrail re-reasoned: avoidance still viable (verified — a crossing with the
patrol far away, no detection, never reaches confrontation); yielding a
posture still repositions unhurt and allows unlimited retries, so it remains
not-a-mandatory-fight and cannot soft-lock — only the difficulty floor rose,
which is the intent. Harness P7 inverted (no skirt-it route + timing stays
viable). 261 checks green x3.

## art overhaul, batch 1: palette, wolves, trees, terrain (2026-07-22)

A deep visual pass. Shared LIGHT direction (upper-left) drives every cast
shadow and rim light. New color helpers (toRGB/mixTone/tempTone) + richer,
warmed season palettes with LIGHT/DARK/SKYLIGHT variants. Wolves rebuilt:
one flowing bezier torso with a light→mid→belly form gradient, a rim-light
bead on the lit back, fur-direction strokes, two-segment legs drawn far-then-
near for real overlap, a tapered brush tail with a dark tip, a wedge head
with pale cheek/muzzle, amber eye-glints, and filled ears with dark inners;
soft feathered directional contact shadow. Trees rebuilt: conifers as stacked
tapered tiers lit on one shoulder (snow-loaded in winter); deciduous as
6-lobe canopies over a trunk hint with per-lobe radial light; bare-winter
trees get a recursive branch skeleton; all cast a long soft shadow away from
the light. Terrain: a vertical sunlit→cool ground wash, large painterly
meadow blobs, directional leaning grass blades (dense in growth, sparse in
winter), clumped wildflowers w/ stems (spring), warm rotated leaf litter
(autumn), lee-shadowed wind drifts (winter). Harness green (draw() smoke
across intro/prologue/Act I/scent/map/ending).

## art overhaul, batch 2: prey, water, lighting, Willow (2026-07-22)

Prey rebuilt like the wolves: contact shadow, two-segment legs w/ hooves
(far-then-near), a barrel body with a lit-back/shadow-belly gradient, hide
dappling (deer/elk) or a pale baldy belt (cattle), rump patch, tail, a
tapering neck that dips to graze, ears, better antlers (a sweeping elk rack
with upward tines, stubby cattle horns). Water is now paintPond(): mud bank →
shallows → dark deep-center depth gradient, a sky-sheen crescent offset
toward the light, rim reeds, algal scum when fouled, a cracked pale ice lid
in winter — used for every pond AND the spring pond; the creek got a bank/
mid/bright-ribbon three-pass with a light-offset sunlit highlight. Lighting:
a global directional warm→cool diagonal grade from the sun corner, a season-
colored ambient skylight wash, golden-hour as a vertical gradient, a softer
warmer atmospheric vignette. Willow-lying rebuilt: curled form-shaded mass,
fur-fold strokes, tail wrapped to the nose, resting head + ear and (in death)
a closed-eye line + flatter cold light. Harness green x3.

## art overhaul, batch 3: water shimmer, parchment, HUD, title (2026-07-22)

Runtime water now lives: drifting creek glints plus a slow specular shimmer
breathing across each pond's sunlit crescent, with a few sun-catch sparkles
that twinkle — frozen off in winter. Parchment map rebuilt: warm vellum with
a vertical tone shift, ~22 soft tea-stain blooms, faint horizontal laid-line
grain, foxing speckle, darkened burnished corners, and two soft fold
creaselines — reads like real aged paper. HUD bars: recessed track with a
hairline rim, a vertical top-light→bottom-dark sheen on the fill and a bright
top highlight, shadowed label. Intro screen rebuilt from a flat gradient into
a dusk scene: graded sky, a low moon with halo/maria, twinkling stars, a
black timber ridgeline, and a warm-glow title. That completes the pass —
palette+light, wolves, trees, terrain, prey, all water, lighting, Willow,
map, HUD, title. Harness 261 green x3+. The judge is the browser: every
season, day/night, weather, and the map.

## art revert (2026-07-23)

Per Arjun: reverted render.js entirely to the pre-overhaul state (935ad86) —
old wolves, trees, terrain, prey, cattle, lighting, Willow, parchment, HUD,
title — EXCEPT the bog/pond drinking-water rendering, which is kept as the
overhaul paintPond (mud bank -> shallows -> deep-center depth gradient,
sky-sheen, reeds, scum when fouled, cracked winter ice, smooth edges), used
for every pond and the spring. Carried only the three helpers it needs
(LIGHT, toRGB, mixTone). The play-view porthole darkness stays removed
(drawPlayFog no-op), matching the prior request. Harness 261 green x3.

## pack-state + fear-freeze fixes (2026-07-23)

Three playtest bugs. (1) The "holds" desync: the per-wolf pack movement never
checked w.state, so once ANY wolf was set to follow (e.g. a just-found Sedge
forced to "follow"), the zone re-centered on Aspen and the "holding" wolves
got dragged along while the roster still said "holds". Fixed: a wolf in
"stay" is now authoritative — it keeps to S.zoneAnchor (its own center/radius)
and does not leave to hunt, regardless of the rest of the pack; and a found
lost wolf rejoins in the pack CURRENT stance (S.zoneAnchor ? stay : follow),
so roster and ground never disagree. (2) Fear freeze re-tied to the bar: the
pack freezes whenever fear > 0.03 (anything showing) and unfreezes the
instant fear drains to ~0 — real terror (>0.5) still scatters them to safe
ground first, milder fright just roots them where they stand; dropped the
fixed 70s spell. Balk recovery is likewise fear-only now. (3) The R/H teach
prompts shortened to 3.5s so they fade on their own. Harness updated (fear-
bar freeze, held-wolf-holds-while-another-follows) + a latent car-strike
flake in the season-defer test fixed; green x6.

## playtest batch — trees, prologue visibility, vista hold (2026-07-23)

Ten-item playtest pass (Part 20).

Trees as obstacles. `inForestCore(x,y,pad)` blocks the dense trunk core of
each TERRAIN.forests clump at r*0.5 — the canopy edge (outer half) stays
walkable. Present era only (the scripted prologue paths are never obstructed),
wired into both `blockedAt` (prey) and `wolfBlockedAt` after their past-era
early return. Probed every node/den/pond/herd-anchor and every graph edge
against the cores: three canopies straddled trails, so they were nudged clear
in data.js (2900,400->490; 960,3240->3300; 700,1700->790,1700). northRidge
sits 172 from a core (clears the 130 radius). No via waypoints exist, so the
"curve" of a route is just edgePolyline's hand-wobble.

Curved routes. The map route already drew each leg through `edgePolyline(e)`;
the on-LAND route drew straight chords between node centres. Fixed — the land
route now looks up the edge and follows the same polyline, so the two agree.

Prologue "look here". New `pointOut(tag, dur)` + `resolvePointTarget(tag)` set
`S.pointAt` to a live position every prologue frame (tags: aspen, willow, elk,
a pack id, or 'yearlings' -> midpoint). Render draws a bobbing caret over it,
or, if it has drifted off the close-in 2.2x camera, an edge chevron toward it.
Used in beat 1 (Aspen named FIRST, then Bram/Sedge/yearlings each pointed
out), beat 3 (Willow), beat 4 (the elk). The beat-4 elk now spawns 160px ahead
of Aspen toward the ford (guaranteed on-camera) instead of relative to Willow.

Vista holds for a keypress. `S.vistaWait` pins the vista matte fully-in (floor
= vistaTMax-0.7) and keeps input locked; any key calls `releaseVista()`, which
drops vistaT into its fade-out, unlocks, clears the caption, and hands the beat
forward (beat 2 -> 3; beat 8 -> 9 via beatT). main.js consumes that key so it
does nothing else. Applies to the overlook (beat 2) AND THE CUT (beat 8). The
beat-8 hand-off is gated on `!S.vistaWait` so it can't fire while held.

Beat-6 lean-in is SPACE, not F. `toggleMap()` has a beat-6 branch that sets
`S.tut._bond` and swallows the map; togglePackStay no longer sets _bond in the
prologue (F is dead there until spring). Overlook guide chevron shrunk (dist
130->104, thinner strokes). Map's "what she remembers" caption hidden while
`S.mode === 'prologue'` (the map is Willow's, not hers yet). Q added to the
help overlay unconditionally in play; HUD already hides empty fear/pup bars.

Harness: beat-2/beat-8 drives press a key to lower the held vista; beat-6 uses
SPACE; beat-3->4 walk single-steps and breaks the instant beat>=4 (the elk now
sits on the path, so a coarse loop ran her into beats 5-6 before we saw 4); the
held-wolf test pins fear off (a held wolf DOES flee real terror — correct — but
that confounds the hold check). 259 green, x12.

## map centrality without fog (2026-07-24)

Direction chosen by Arjun: the map is central through knowledge the world does
NOT show — no fog/darkness (the porthole stays removed). Audited Part 18 Block
A/B — all present and working; only two things had quietly broken when the
porthole and the task system were removed:

drawRouteCue was invisible. Its motes used `globalCompositeOperation =
'lighter'` at ~0.32 alpha — designed to glow against the dark porthole. With
the world fully lit, additive light over bright terrain does nothing. Extracted
`driftMotes(a, R, rgb, strength)`: each mote now paints a soft dark halo
(source-over) under a brighter core, so the remembered route reads over any
ground. The B1/B2 bearing blooms were NOT affected — they live in the scent
view, which still lays a near-black `rgba(10,10,20,0.82)` backdrop.

B5's spine got a bearing back. The old "range" task named the winter range by
compass; with tasks gone, drawRouteCue now falls back — when no route is
planned and it's a travel season (seasonIndex>=2 && S.tut.goalSet) — to a
fainter (strength 0.55) mote bearing toward winterRange, nudging her to raise
the map and plan. A real planned route overrides it. objectiveText + the
goalSet map marker still carry the worded/visual spine as before. A3's "fog
forces map reliance" is intentionally relaxed under the no-fog direction.
