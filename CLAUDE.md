# The Corridor — grey-box prototype (Phase 1)

Browser edition of the mental-map core loop. Plain HTML/JS/canvas, no build step,
no dependencies. Open `index.html` in a browser to play. Full design bible lives
outside the repo; this file is the condensed, load-bearing version.

## Premise (one paragraph)

You are Aspen, a wolf who inherits her dead mother Willow's mental map of the
territory. The map is wrong — the world changed faster than a wolf's lifetime.
One year: discover the tears, scout detours, redraw the map or die holding the
old one. The player never sees human vocabulary; a highway is a phenomenon, not
an object. The thesis (fragmentation devalues inherited knowledge) is delivered
mechanically, never verbally.

## Locked rules — the core loop

- **The map is a graph.** Nodes + edges in `data.js`. Edge states:
  `inherited` / `unknown` / `current-dotted` / `current-solid` / `torn`.
  Runtime per-edge counters (`traverseCount`, `lastTraversedDay`) live in
  `edgeRT` in `main.js`, keeping `data.js` pure data.
- **Three inks.** Inherited = warm double-stroked amber (`#7A3F12` under
  `#C7893F`), **frozen — never updates from being walked**. Aspen's ink =
  thin cool blue-teal (`#4E7A8C`), drawn by walking: unknown → dotted on first
  pass, solid at 3 passes (`SOLID_AT`), decays back toward dotted after 15 idle
  days (`DECAY_DAYS`). Grey = unknowable without risk.
- **Tears trigger on arrival, never on map-check.** Each edge carries
  `expected` vs `actual`. When Aspen tries to walk a mismatched edge, the token
  bounces back and the edge's whole `tearGroup` tears at once (a lone edge if
  `tearGroup` is null). Interior nodes of the group are swallowed by one big
  jagged grey rip; ink stubs survive at the two end-nodes; inherited ink beyond
  an unreachable tear renders as faded dashed ghost. **Nothing un-tears.**
- **Patching = going around, never covering over.** Every planned tear has
  detour geography: off-line nodes on unknown, higher-day-cost edges. A torn
  group becomes **bridged** when its two surviving end-nodes are connected by a
  path of Aspen's own new ink (inherited ink never counts). Bridging stitches a
  small paper patch (`#E4DCC0`) at each end-node; **the grey rip stays visible
  forever**. A detour walked before the tear counts (check runs after every
  arrival and after every tear).
- **Nodes:** ring + center dot; den larger and filled. Solid ring = confirmed,
  dashed = uncertain/ghost. Confidence is the node's only encoding; authorship
  is carried entirely by ink color (redundant non-hue encoding for
  colorblindness).
- **Audio:** the discordant tear sting (A3 + Eb4) is *the* sound of the map
  being wrong — reuse it for every tear, forever. The patch chime (G4 → D5,
  soft) is its consonant counterpart. Willow's death gets no sting and no music.
- **Travel history** (`travelHistory`: day/from/to/edgeId per traversal) is
  kept from day one — it feeds the ending's satellite-dissolve route trace.

## Test territory (`data.js`)

Den hub (Alpha) · migration loop Alpha–Beta–Gamma–Delta–Epsilon (Beta→Epsilon
segment tears as group `highway`, detour via Mu–Nu) · westward chain beyond
Epsilon (tears as `rift`, **no detour — permanent loss is allowed to exist**) ·
hunting loop Alpha–Xi–Omicron (intact) · water route Beta–Pi–Rho–Mu (tears as
`creek`, detour via Sigma). Greek names are grey-box placeholders.

## Answers to questions Claude should get right

**What happens when Aspen walks into a mismatched segment?** The mismatch check
runs on arrival/commitment, not on consulting the map. The token bounces back,
the entire tearGroup tears at once (sting + flash), interior nodes are
swallowed, end-nodes go uncertain, anything cut off becomes ghost memory, and
the tear is permanent. The map lied until she was already committed.

## Conventions

- No frameworks, no build step. `data.js` = pure data; `main.js` = everything
  else, organized in banner-comment sections.
- Deterministic PRNG (mulberry32 seeded by stable hashes) for all texture so
  redraws are identical.
- Numbers that tune feel (decay, day costs, tear width) are named constants or
  data fields — tuning is the developer's hands-on job, systems are delegable.
- Every session ends with: NOTES.md updated (one line + tomorrow's first
  action), everything committed.
