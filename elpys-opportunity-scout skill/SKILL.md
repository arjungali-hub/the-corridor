---
name: elpys-opportunity-scout
description: Find and verify new teen volunteer opportunities for Elpys within roughly a 20-minute radius of a specified location, applying Elpys's full listing criteria (no adult required on-site, clear completable signup, free, open to teens) and producing both a research report and ready-to-paste database rows. Use this whenever the user asks to find, source, scout, research, or expand into new volunteer opportunities, orgs, or listings for a city or neighborhood — including phrasings like "what else could we list in Kirkland", "expand to Redmond", "find 10 more orgs near Sammamish", "who should I email this month", or any request to grow the Elpys directory in a new area. Also use when the user wants an existing candidate org checked against the Elpys criteria.
---

# Elpys Opportunity Scout

Find volunteer opportunities that a teen can actually sign up for and show up to,
within ~20 minutes of a given location, and verify them well enough that they can be
listed on Elpys without a follow-up correction.

Elpys exists because the KCLS list it replaced was full of homepage links, stale
programs, and buried age rules. Every shortcut taken here reintroduces exactly the
problem the site was built to solve — so the standard of proof matters more than the
number of candidates found. **Ten verified listings beat forty plausible ones.**

## The two things that make this skill useful

1. **The criteria are strict and non-obvious.** Most volunteer orgs fail them, usually
   on friction rather than on principle. Read `references/criteria.md` before judging
   any candidate — it holds the full criteria, the disqualifiers observed in practice,
   and the accuracy corrections already paid for once.
2. **Verification is against live pages, never search snippets.** A stale snippet once
   caused a correct Sophia Way signup link to be "fixed" into a wrong one. Fetch the
   org's actual volunteer page and read it.

---

## Workflow

Work through these in order. Steps 1–3 are cheap and prevent wasted verification
effort; don't skip ahead to searching.

### Step 1 — Establish the search frame

The user names an anchor (a city, a neighborhood, an address, a ZIP). Convert it into
a concrete geographic frame before searching, because "20 minutes" is not a search
term — place names are.

Produce, and state to the user:

- **Anchor**: the exact place the radius is measured from. If the user said only a city
  name, use its civic center or downtown core and say which point you used.
- **Inner ring** — places reliably within ~10 minutes' drive.
- **Outer ring** — places at roughly 10–20 minutes.
- **Excluded but nearby** — places just outside the radius, listed explicitly so the
  user can see what was consciously left out.

As a working rule, 20 minutes of suburban Eastside driving is roughly 8–12 miles;
freeway-connected places stretch further, and anything crossing a bridge, a lake, or
downtown Seattle traffic is much shorter in miles than the map suggests. Where a
candidate sits near the boundary, verify rather than assume: fetch a routing estimate
if a tool is available, and otherwise flag it as borderline in the report rather than
quietly including it.

Teens frequently can't drive. Where a candidate is at the outer edge, note whether it
sits on a direct bus route from the anchor — this is often the difference between a
listing that gets used and one that doesn't.

### Step 2 — Load what already exists

Don't research an org that's already listed, already rejected, or already emailed.

If a Supabase connector is available, read the current listings:

```sql
SELECT id, name, website, address, status FROM "Opportunities" ORDER BY name;
```

The table name is `"Opportunities"` with a capital O and must stay double-quoted —
unquoted identifiers get lowercased and the query fails. If no connector is available,
ask the user to paste an export rather than guessing at the contents.

Then read the **explicitly rejected** list and the **previously removed for distance**
list in `references/criteria.md`. Re-proposing Boys & Girls Club or Seattle Humane
without acknowledging why they were rejected wastes the user's time and signals the
criteria weren't read.

### Step 3 — Build a candidate list

Cast wide here; the filtering happens later. `references/sourcing.md` lists the source
types that have actually produced listings, in rough order of yield, along with search
patterns that work. Aim for roughly 3–4× as many candidates as the user wants final
listings, because the pass rate against these criteria is genuinely low.

Record for each candidate only what's needed to decide whether to verify it: name,
what they do, rough location, and the URL you'll check.

### Step 4 — Verify each candidate against live sources

For each candidate, fetch the organization's own volunteer page. Not a directory
listing, not a search result summary, not a cached description — their page. Where the
signup runs through a portal (Bloomerang, VolunteerHub, Golden, SignUpGenius), fetch the
portal URL too and confirm it resolves to a real form.

Extract, and record the source URL for each:

- Minimum age, and whether it differs for solo vs. accompanied volunteers
- Whether an adult must be **present on-site** (the single most common disqualifier)
- The exact signup path, step by step, as a teen would experience it
- Any fee, application, interview, background check, orientation, or minimum commitment
- Days and times, and whether the program is seasonal or currently paused
- Street address, or an explicit note that the org operates at rotating locations
- Contact email and phone

When a page contradicts itself, or an FAQ and a signup form disagree, record both and
flag it. Do not silently pick the more convenient reading.

**Automated fetches sometimes return 404 on JavaScript-heavy portals that work fine in a
real browser.** Treat a single 404 as "needs a human to open it in a browser," not as
proof the link is dead — that exact ambiguity is already an open flag on the Sophia Way
listing.

### Step 5 — Judge against the criteria

Sort every candidate into one of four buckets:

- **PASS** — meets all six criteria with evidence for each.
- **PASS WITH FLAG** — listable, but with a caveat a teen needs to know up front
  (background check, minimum commitment, narrow age window). Hopelink is listed this
  way. The flag must be stated in the listing itself, not just in the report.
- **UNVERIFIED** — promising, but one fact can't be confirmed from a live source.
- **REJECT** — fails a criterion. Name which one and cite the evidence.

Verdicts of "probably fine" or "likely 14+" don't belong in any bucket.

#### UNVERIFIED is a primary deliverable, not a fallback

In practice this bucket is usually the largest and often the most valuable part of a run.
The user emails organizations regularly; a well-formed unverified entry is one email away
from becoming a listing, which makes it worth more than a fourth marginal pass. Treat it
as a real output and give it real effort:

- Reduce each entry to **one specific question**, not a list of uncertainties. If three
  things are unclear, name the one that decides the verdict; the rest follow from it.
- Name **who to ask** — a real address or phone number from the org's own page.
- **Order the section by how cheaply the question can be answered.** An org with a
  published volunteer email and one crisp yes/no question goes first; one needing a phone
  call during business hours to reach a specific coordinator goes last. The user works
  down this list, so the ordering is the useful part.
- Say what the answer would mean: "if the facilities role is staff-supervised, this
  passes; if not, it fails criterion 1." That way a one-line reply resolves the listing
  without re-researching the org.

#### When no age minimum is published

Common enough to need a settled rule rather than a per-case judgment call. Both of these
came up in the same run and were initially sorted inconsistently:

- Unstated age **plus** explicit "all ages" or "all community members welcome" language,
  and no sign an adult is required → **PASS WITH FLAG**. The flag goes in `card_note` as
  a note to confirm before a first shift. The org has signalled openness; the gap is
  documentation, not policy.
- Unstated age **plus** an application, a screening step, or "apply to be considered"
  language → **UNVERIFIED**. Selective intake plus an unknown age floor is two unknowns
  compounding, and the answer to one changes the other.
- Unstated age **plus** any indication of adult accompaniment, background checks, or
  18+ roles elsewhere on the site → **UNVERIFIED**, leaning reject. Ask before listing.

### Step 6 — Write the output

Produce both deliverables, in this order: the report first, then the paste-ready rows
for the PASS and PASS-WITH-FLAG entries only. `references/output-format.md` has the
exact templates and the database field conventions, which are fiddly and easy to get
wrong (pipe-separated steps, lowercase comma-separated categories, `status` always
`pending`).

Never write to the database directly. New listings go in as `pending` for the user to
review through the admin page, because the whole value proposition is that a human
verified them.

---

## Standards of proof

These are the difference between a scouting run that saves the user time and one that
creates a cleanup task.

**Cite a URL for every factual claim about an org.** Age minimums, fees, and signup
steps all need a source the user can re-check in under a minute.

**Prefer "unknown" to a plausible guess.** An unverified age minimum that turns out to
be wrong sends a 13-year-old to a site that will turn them away — the precise failure
mode Elpys was built to prevent.

**Never invent coordinates.** `lat`/`lng` must come from a real geocode of the real
address. If geocoding isn't available in the session, leave the fields empty, mark them
`TODO — geocode`, and say so; a wrong pin is worse than a missing one.

**Don't smooth over friction.** If signup requires an application and an interview, the
report says so plainly even if that kills an otherwise attractive listing. The user has
been explicit about preferring honest assessment over encouragement.

**Distinguish a directory from an opportunity.** United Way and JustServe were excluded
deliberately: they're places to *mine* for candidates, not things to list. If a
candidate just aggregates other orgs' shifts, mine it and list what it points to.

---

## Judgment calls worth making deliberately

*Age floors.* Elpys sets no hard floor, but the audience is middle and high school. An
org that only takes 18+ is a reject; one that takes 16+ is a narrow but real listing.
Say which teens it actually serves.

*Waivers.* A parent-signed waiver completed at home is fine. A parent who must be
physically present is not. Watch for the middle case — a waiver that must be printed and
brought to the site, as with WTA and King County Parks — which is listable but belongs
in the signup steps, since a teen who shows up without it gets turned away.

*Seasonality.* A program that runs only in summer is still worth listing if it's clearly
labeled, but check whether the current application window is open. Sold-out or closed
windows are a reject until they reopen.

*Episodic vs. ongoing.* One-off events (park cleanups, market days) are often the best
listings for teens precisely because they require no commitment. Don't undervalue them
against a more "serious" ongoing role.

---

## Reference files

- `references/criteria.md` — the six criteria, disqualifiers, the explicit reject list,
  and the accuracy corrections not to regress. **Read this before judging candidates.**
- `references/sourcing.md` — where candidates actually come from, with search patterns.
- `references/output-format.md` — report template, database field conventions, and a
  worked example row.
