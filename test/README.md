# Tests

No dependencies, no build step — the same as the game itself. Any Node 18+
will do (`package.json` exists only to name the two scripts; there is nothing
to `npm install`).

```
npm test          # or: node test/harness.js    — the full harness
npm run layout    # or: node test/layout-probe.js — data.js geometry check
```

## harness.js — the headless harness

338 checks. It loads `data.js`, `game.js`, `render.js`, and `main.js` into a
`vm` context with stubbed `document` / `window` / `localStorage` /
`AudioContext`, then drives the game through **the real keydown handler and
the real `update(dt)`** — not a reimplementation. `main.js` starts its frame
loop only when `requestAnimationFrame` exists, which is what makes this
possible.

It plays the whole prologue beat by beat, then exercises the year: tears and
bridges, car strikes, balk and recovery, kills, ink decay, save/load
round-trips, the western pack encounter machine, weather and wind, the
overpass adoption arc, both endings, the options/accessibility slate, and
`draw()` smoke tests across every mode.

The last line is the verdict:

```
ALL CHECKS PASSED
```

**Three logged stack traces just before it are expected** — the error-boundary
checks throw inside `update()` and reject a promise on purpose, and the
save-migration check feeds `loadGame` a structurally corrupt save. They are
proof the boundaries caught them, not failures. Trust the verdict line and the
absence of `FAIL`.

### What it cannot verify

- **Feel.** Speeds, decay rates, fear rates, crossing timing, camera blends —
  the harness proves correctness, never whether the year plays well. That is a
  browser pass, every time.
- **Real WebAudio autoplay policy.** The `AudioContext` stub has a `resume()`
  spy, so the harness proves the unlock is *wired*; it cannot prove a real
  browser lets the sound through. Safari specifically still needs a human.
- **Anything pre-JS**, e.g. the `#loading` overlay in `index.html`.
- **Touch and mobile.** The boot gate is verified inert on a desktop/headless
  context and `drawMobileCard`/touch layout are smoke-drawn, but the real
  touch path is a devtools check.

## layout-probe.js

Reads `data.js` and reports geometry that overlaps where it shouldn't: ponds
on dens, forests, or human works; dens inside forests or too near the
construction/pit/subdivision; nodes swallowed by the mud sink or standing on
the rail. Prints `NO OVERLAPS` when the land is clean. Run it after moving
anything in `data.js` — several past playtest bugs (a deer trapped in the
gravel pit, a pond on a den) were layout collisions this catches.

## Adding checks

`check(label, cond)` counts a failure and keeps going. Helpers: `step(dt, n)`
ticks `update`; `key(k)` fires the real keydown; `stepTo(x, y)` walks Aspen to
a point; `goNode(id)` walks her to a graph node through waypoints so the walk
stays inside the route corridor; `G(expr)` evaluates an expression inside the
game's context.

Keep the ritual: harness green before every commit, and a browser pass for
anything that touches feel.
