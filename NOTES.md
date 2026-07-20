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
