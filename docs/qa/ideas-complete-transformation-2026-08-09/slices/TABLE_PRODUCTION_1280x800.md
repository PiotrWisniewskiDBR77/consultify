# Idea Table — row-actions column, acceptance slice @ 1280×800

Stream: **S19-SLICE**. This is the prepared acceptance matrix for the row-actions
column fix (S17/S18-NOOVERLAP + S13-STICKY), per the owner's binding testing
rules. It does not ask the owner to hunt for defects — every item below states
what it proves and what it does not.

## 0. SHA, URL, harness identity

- **Exact SHA (worktree HEAD)**: `6b28161bc469b9c622153fa12afa4ef952754e65`
  (verified with `git rev-parse HEAD` in
  `/Users/piotrwisniewski/.codex/worktrees/ideas-streams/s7-table`, branch
  `codex/ideas-s19-slice`, tree clean before this slice was added).
- **Harness URL (literal)**:
  `http://localhost:3020/?screen=idea-table-production&theme=light&lang=pl`
  (and `&theme=dark`, `&lang=en` combinations below). Served by
  `npx vite --config dev-render/vite.config.ts --port 3020` against this
  worktree's own `node_modules`.
- **Harness identity**: `dev-render/screens/idea-table-production.tsx`. Its
  outer wrapper (`<div className="flex-1 flex flex-col h-full min-h-0
  overflow-hidden bg-c-bg" ...><div className="flex flex-col flex-1
  min-h-0">`) is a byte-for-byte copy of the `viewMode === 'table'` branch in
  `src/components/MyWork/MyIdeasListContent.tsx:1786` / `:1791` — verified by
  reading both files side by side in this session. `IdeasTableContent` is
  mounted as the **sole child** of that column flex — no sibling
  `ArtifactRightPanel`, matching how production actually renders the table
  view. This makes it a **production-shape harness**: real component,
  real Tailwind/`c-*` CSS, real interaction code, but **mock data** (5
  hard-coded ideas), **no real backend**, and **no auth** — it does not
  prove anything about the deployed app, the live database, or any API call.
- **What the dev-render chrome is NOT part of the product**: every capture
  below shows two floating pills bottom-right, "← Lista" / "Uwagi". These
  come from `dev-render/PanelUwag.tsx`, mounted globally by
  `dev-render/main.tsx:949` for every screen in this harness — it is the
  acceptance-note tool for this harness, not part of `IdeasTableContent` or
  of production. See §9 for one place where it visually collides with the
  row-actions menu — a harness-only artifact, documented there.

## 1. Viewport 1280×800, zoom 100% — how it was enforced and verified

Every capture in §§2–8 used a fresh Playwright Chromium page created with
`viewport: { width: 1280, height: 800 }`. Enforcement was not assumed —
it was read back from the live DOM on the same page before/after each
capture:

```json
{
  "innerWidth": 1280,
  "innerHeight": 800,
  "devicePixelRatio": 2,
  "visualViewportScale": 1,
  "documentScrollWidth": 1280,
  "documentScrollHeight": 800,
  "bodyOverflowX": "visible"
}
```

- `innerWidth`/`innerHeight` = exactly 1280×800 (not "close to" — exact).
- `visualViewport.scale` = `1` → zoom is 100%, not reduced. This is the
  literal proof requested by item 3/item 5 ("a visible route to the action
  **without reducing zoom**").
- `devicePixelRatio` = 2 (this machine's Playwright default) — screenshots
  are therefore physically 2560×1600px files, but every measurement and
  every "does it fit" check below is in **CSS pixels** against the
  1280×800 viewport, which is what `getBoundingClientRect()` reports and
  what the owner's rule ("`0 <= left` and `right <= 1280`") is stated in.
- `documentScrollWidth` = 1280 = `innerWidth` → **zero horizontal overflow**
  at rest (Fix A's `scrollMax = 0` claim, confirmed independently here, not
  assumed from the commit message).

This was re-run for light/PL, dark/PL and light/EN — identical numbers all
three times (full JSON logged in this session; geometry does not depend on
theme or language, only on layout).

## 2. Per-row `getBoundingClientRect()` — kebab, "Updated" cell, actions cell

Read directly from the live DOM at 1280×800, light theme, PL, at rest (no
scroll, no zoom). One row per visible idea, keyed by its on-screen title.

| # | Row title (as shown) | Updated cell (`right`) | Actions cell (`left`–`right`) | Kebab button (`left`–`right`, `top`–`bottom`) | `updated.right <= actions.left`? | Kebab within `0<=left, right<=1280`? |
|---|---|---|---|---|---|---|
| 1 | Ekspansja DE — mapa hipotez | 1217 | 1217–1273 | 1230–1262, 63–95 | **1217 <= 1217 — yes** | **yes** (1230 >= 0, 1262 <= 1280) |
| 2 | Automatyzacja raportowania OEE | 1217 | 1217–1273 | 1230–1262, 122–154 | **yes** | **yes** |
| 3 | Program lojalnościowy B2B | 1217 | 1217–1273 | 1230–1262, 181–213 | **yes** | **yes** |
| 4 | Ujednolicenie modelu danych produkcyjnych | 1217 | 1217–1273 | 1230–1262, 240–272 | **yes** | **yes** |
| 5 | Pilotaż DACH — wejście na rynek | 1217 | 1217–1273 | 1230–1262, 299–331 | **yes** | **yes** |

Viewport-fit check per row: every kebab has `top >= 0` and `bottom <= 800`
(largest `bottom` is row 5's 331, far under 800). Every kebab is fully
inside `[0, 1280] × [0, 800]` — nothing sits past the right edge, nothing
requires scrolling.

Additional structural numbers from the same read: `scrollerScrollWidth =
1280`, `scrollerClientWidth = 1280` (identical → the table's own scroll
container, not just `document`, has zero overflow — this is the container
`TableWithPreviewLayout.tsx` actually scrolls, so it is the correct place to
check, not a proxy).

This table was re-captured for dark/PL and light/EN — **identical pixel
values** in both (theme and language affect paint, not layout, in this
component; confirmed, not assumed).

**What this proves**: at this exact SHA, at this exact viewport, with this
exact mock dataset, every row's kebab is on-screen and the Updated column
never overlaps the actions column — the two defects named in the brief
(Fix A overflow, Fix B 8px sliver) are both independently absent here.
**What this does NOT prove**: behavior with real (longer/shorter/localized)
titles and dates from the live backend, behavior with more than 5 rows,
or anything about any other viewport not listed in §8's context section.

## 3. Menu geometry — does the open menu itself fit the viewport?

Item 6 asks for DOM proof the *menu* fits, not just the trigger. Captured
by opening the menu (mouse click on row 1, and separately via keyboard
`Enter` on row 1) and reading `role="menu"`'s own `getBoundingClientRect()`:

| Trigger | Menu `left`–`right` | Menu `top`–`bottom` | Fits `0<=left,right<=1280,top>=0,bottom<=800`? |
|---|---|---|---|
| Row 1, opened via mouse click | 1041–1261 | 101–601 | **yes** |
| Row 1, opened via keyboard `Enter` | 1041–1261 | 101–601 | **yes** (identical — same anchor) |
| Row 5 (last row), opened via mouse click | 1041–1261 | 288–788 | **yes** (788 <= 800, no bottom clipping even for the row closest to the viewport edge) |

Row 5 is the interesting edge case: it is the row closest to the bottom of
the viewport, so its menu is the one most likely to overflow downward. It
does not — the menu's own collision-aware positioning (`RowActionsMenu.tsx`,
"grows leftward"/flips as needed, anchored to the button's right edge) keeps
`bottom = 788`, 12px short of the 800px floor. See §9 for a harness-only
visual caveat on this specific row.

**What this proves**: the primary route to per-row actions — opening the
menu — does not itself become a new off-screen element once the trigger fix
is verified reachable. **What this does NOT prove**: menu geometry with a
row's kebab located anywhere other than the 5 positions this mock dataset
produces, or with a real viewport shorter than 800 (see §8 for the 720×450
picture).

## 4. Screenshots — resting state (item 7)

- `01_resting_light_pl.png` — 1280×800, light, PL. I looked at this myself:
  all 5 rows visible, "Data" column header and every date value (`15/07/2026`
  … `05/07/2026`) render in full, the kebab (⋮) sits inside the header's
  gear-icon column at the far right with no visible clipping, no horizontal
  scrollbar. **Proves**: the resting layout is clean at this exact viewport
  for this exact dataset. **Does not prove**: anything about longer titles,
  more rows, or a live dataset.
- `02_resting_dark_pl.png` — same, dark theme. Same layout; verified myself
  no crimson leaks into the dark chrome (borders/backgrounds are the dark
  `c-surface`/`c-border` tokens, not `primary-*`).
- `03_resting_light_en.png` — same, `lang=en`. Headers translate ("Title",
  "Stage", "Tags", "Tool", "Updated") and Stage badges translate ("Shaping",
  "Ready", "Growing", "Spark", "Promoted"). Tag chips (`rynek`, `DE`,
  `operacje`, …) do **not** translate — those are free-text tag values in
  the mock data, not UI strings, so that is expected, not a defect. The
  "← Lista"/"Uwagi" harness pills stay Polish regardless of `lang` — that is
  `PanelUwag`, outside the product screen, and is not wired to the app's
  i18n. **Proves**: PL/EN both render without breaking the row-actions
  layout. **Does not prove**: full i18n coverage of the Idea Table beyond
  what's visible in this mock (e.g., RTL, very long translated strings).

## 5. Screenshot — menu open (item 8)

- `05_menu_open_row1_light_pl.png` — row 1's kebab clicked with the mouse;
  the menu (`Otwórz`, `Diagram procesu`, `Czat AI`/`Wglądy AI` disabled,
  `Inicjatywa`, `Zadania`, `Decyzja`, `Czat zespołu`, `Prezentacja`,
  `Raport`, `Otwórz podgląd`, `Edytuj`, and `Usuń` in red as the destructive
  item) renders fully inside the viewport, right edge flush against — not
  past — the right chrome. I looked at this myself: nothing is cut off,
  nothing needs scrolling to read.
- `06_menu_open_row1_dark_pl.png` — same, dark theme; same layout, `Usuń`
  still the only red/destructive item, no other crimson.
- `12_menu_open_row5_light_pl_harness_overlap_note.png` — row 5 (the
  bottom-most row)'s menu opened with the mouse, to test the harder case
  (menu closest to the bottom edge). Geometrically it still fits (§3). See
  §9 for a visible-but-harness-only caveat on this specific capture.

**Proves**: mouse-driven menu-open works and stays fully on-screen for the
first and last row. **Does not prove**: menu-open behavior for rows beyond
this 5-row mock, or any menu action's actual server-side effect (every
non-favorite item in this menu — `Otwórz`, `Edytuj`, `Usuń`, etc. — is wired
to a no-op handler in the harness; see §0).

## 6. Screenshot — after one safe, reversible action (item 9)

**Action used: the row's favourite/star toggle**, not the kebab menu.
Chosen because it is the textbook non-destructive, instantly reversible
action named in the brief — toggling it again restores the prior state
exactly, it changes no other data, and (unlike every item inside the kebab
menu, including the destructive `Usuń`) it needs no confirmation dialog to
be safe to demonstrate.

- `07_favorite_before_row2_light_pl.png` — row 2 ("Automatyzacja
  raportowania OEE") shows a **hollow** star, `aria-pressed="false"`
  (confirmed via DOM read, not just eyeballed).
- `08_favorite_after_row2_light_pl.png` — after clicking that row's star
  button: it is now a **filled amber star**, matching the pre-existing
  favorited row 5 exactly. I compared both images myself — the only visual
  difference between them is that one star; every other pixel (dates,
  kebabs, badges, other rows) is identical.

**Proves**: the favourite toggle's UI wiring (click → prop callback →
visual star fill) reproduces byte-for-byte the same render path production
uses at `MyIdeasListContent.tsx:1824-1825` (`isFavorite={isFavorite}
onToggleFavorite={toggleFavorite}` from the real `useFavoriteIdeas()`
hook). **Does not prove**: server-side persistence — this harness's
`onToggleFavorite` is a local `useState` setter
(`dev-render/screens/idea-table-production.tsx`), not the real
`useFavoriteIdeas` hook, so no network call happens here. Whether the real
hook persists favorites correctly against a live backend is **NOT
VERIFIED** by this slice — that would require the real app, not a
production-shape harness.

## 7. Annotated capture, every visible row (item 4)

- `04_annotated_kebabs_light_pl.png` — every row's kebab button outlined in
  green with a "row N kebab" label, drawn by measuring
  `getBoundingClientRect()` on each `button[aria-label="Row actions"]` and
  overlaying a `position: fixed` box at those exact coordinates (no manual
  placement — the boxes are generated from the same numbers as §2's table).
  I looked at this myself: all 5 boxes land cleanly on their kebabs, none
  clipped by the viewport edge, confirming §2's table matches what is
  actually painted, not just what the DOM claims.

## 8. Keyboard and focus-visible assessment (item 10)

Driven with a dedicated Playwright script (not `shot.mjs`, which cannot
branch on `document.activeElement` between steps) against the same harness
URL, 1280×800, `devicePixelRatio: 2`.

| Finding | Result | How verified |
|---|---|---|
| Tab reachability to row 1's kebab | **Reached in 13 Tab presses** from a neutral click-away point (outside the table). Path: header column-sort buttons → "Data↓" sort → "Ustawienia widoku" (view settings) → row 1's select checkbox → row 1's star → row 1's kebab (`aria-label="Row actions"`). | **Automated driver** — `document.activeElement` polled after every `Tab`, full 13-step path logged. |
| Focus-visible ring color | Light: `box-shadow` includes `rgba(37, 99, 235, 0.4)` = `#2563eb`. Dark: `rgba(91, 141, 239, 0.45)` = `#5b8def`. Both are the exact literal values of `--c-focus`/`--c-focus-solid` defined in `src/index.css:70-73` (light) and `:283-286` (dark) — **not** crimson (`#85182F`, nowhere in either computed style). | **Automated driver** — `getComputedStyle(document.activeElement).boxShadow`, cross-checked against the token source in `src/index.css`. |
| Enter opens the menu | Yes — `role="menu"` appears, `getBoundingClientRect()` = `{left:1041, right:1261, top:101, bottom:601}`, fully inside the viewport (see §3). | **Automated driver**. |
| Escape closes the menu and returns focus | Yes — `role="menu"` is removed from the DOM, and `document.activeElement` afterward is the same kebab button (`aria-label="Row actions"`) that had focus before Enter was pressed — not `document.body`, not some other element. | **Automated driver**. |
| Visual confirmation of the above | `09_kbd_focus_trigger_light_pl.png` (blue ring around row 1's kebab, nothing else focused), `10_kbd_menu_open_via_enter_light_pl.png` (menu open, same position as the mouse-opened one in §5), `11_kbd_after_escape_focus_return_light_pl.png` (menu gone, blue ring back on the kebab). I looked at all three myself; they match the automated numbers above. | **By eye**, corroborating the automated numbers — not a substitute for them. |
| Screen-reader announcement / actual assistive-tech behavior | — | **NOT VERIFIED** — no screen reader was run against this harness this session. |
| Roving focus / arrow-key navigation inside the open menu | `RowActionsMenu.tsx` source shows `ArrowUp`/`ArrowDown`/`Home`/`End`/typeahead handling (comment block, lines ~26-27) | **NOT VERIFIED by this slice** — read from source, not exercised by the driver here. |

## 9. Harness-only finding (not a product defect) — flagged for the record

In `12_menu_open_row5_light_pl_harness_overlap_note.png`, the bottom of row
5's open menu (its `Usuń` item) visually sits directly behind the
dev-render-only "← Lista" pill from `PanelUwag.tsx`. Measured: the menu's
own `Usuń` button is at `bottom≈788` inside the viewport (well within
budget, §3), and `PanelUwag`'s "Uwagi" button occupies
`left:1193–1264, top:744–784` — the two elements' fixed-position boxes
overlap by design of the *harness*, not the product: `PanelUwag` is
mounted globally by `dev-render/main.tsx:949` for every dev-render screen,
independent of `IdeasTableContent`, and does not exist in the shipped app.
**This is not being reported as a product defect** — it cannot occur in
production, since production never renders `PanelUwag`. It is flagged here
only because a screenshot showing an overlapping red delete label could
otherwise be misread as a real collision bug. Rows 1–4's menus (further
from the harness's fixed pills) show no such overlap, and every functional
measurement in §3 confirms the actual `role="menu"` element itself never
overlaps the panel — this is a purely visual z-index coincidence between
two independently-fixed-position UI layers in the harness at this one row.

## 10. Context: 720×450, the viewport this was NOT rejected-again on

Kept out of the main matrix (this slice is scoped to 1280×800) but included
because the owner explicitly rejected an earlier round on the strength of a
narrower viewport, and the truth there needs to be stated plainly, not
implied by silence:

- **The fixed (non-title) columns alone sum to 794px** — wider than a
  720px viewport — so at 720×450 not everything is visible in one screen at
  once, by construction (title has to flex down to its 360px floor, and
  even then the optional columns plus actions do not all fit unscrolled).
  This is unchanged by S18-NOOVERLAP; Fix A's `clamp(360, …)` guarantees a
  usable *minimum*, not that 720px shows the whole table without scrolling.
- Reusing already-committed evidence at this exact SHA (not recaptured
  this session, but opened and inspected this session):
  `docs/qa/ideas-table-overlap-s18-2026-08-12/720x450-light-rest.png` and
  `.../720x450-light-scrolled-max.png`. I looked at both: at rest, Title /
  Stage / Tags and the kebab column are visible (Tool/Updated are scrolled
  off, requiring a scroll); at `scrollLeft = max`, "Updated" renders in
  full with complete date values (`15/07/2026` etc.) and the kebab (⋮)
  remains visible with **zero pixels covered**, at every column combination
  — confirming the "reachable at every scroll position" claim in the
  brief for this narrower viewport. Dark-theme counterparts
  (`720x450-dark-rest.png`, `720x450-dark-scrolled-max.png`) exist in the
  same directory but were not individually re-opened this session — **NOT
  VERIFIED by this slice** (they were verified in the S18 commit this SHA
  already carries, per that commit's own message, but that is a different
  session's claim, not this one's).
- **What this proves**: the "kebab always reachable, no overlap once
  scrolled" property holds down to 720×450, not only at 1280×800.
  **What this does NOT prove**: that 720×450 is an acceptable *resting*
  experience — it plainly is not, by the 794px-vs-720px arithmetic above,
  and this slice does not claim otherwise.

## 11. Guards (run this session, in this worktree, before writing this file)

```
bash scripts/check-focus-canon.sh   → rc=0  (pre-existing repo-wide crimson-focus debt: 130 files/261
                                       occurrences, unrelated to this slice — this script reports and
                                       exits 0, it does not gate; no product code was touched)
bash scripts/check-list-canon.sh    → rc=0  ("no NEW canon violations" — full-repo fallback scan since
                                       staging was empty; existing debt count went DOWN by 1, unrelated
                                       to this slice — likely another session's concurrent commit)
bash scripts/check-artefakt.sh      → rc=0  ("no new crimson violations in the artefact shell" —
                                       baseline 7, still 7)
```

`scripts/check-gestosc.sh` was **not run**: this slice made **zero product
code changes** (evidence and this document only — `git status --porcelain`
before writing this file showed nothing but this new `slices/` directory as
untracked), so there is nothing for a density gate to check. Running it
with zero arguments would scan zero files and report a false pass, per the
brief's own warning — so it was skipped rather than run for a hollow green.

**Type-check / regression gate**: not run, for the same reason — this
stream changed no `.ts`/`.tsx` file. The fix itself
(`src/components/MyWork/IdeasTableContent.tsx`) was already integrated and
gated in the prior commits on this branch (`f86afc077f`,
`a11441233a`, `19f78356f9`, `a18b625a78`), which this slice's job was to
produce owner-facing evidence for — not to re-implement or re-gate.

## 12. File index

All paths relative to
`docs/qa/ideas-complete-transformation-2026-08-09/slices/TABLE_PRODUCTION_1280x800/`:

| File | What it is |
|---|---|
| `01_resting_light_pl.png` | Resting state, light, PL |
| `02_resting_dark_pl.png` | Resting state, dark, PL |
| `03_resting_light_en.png` | Resting state, light, EN |
| `04_annotated_kebabs_light_pl.png` | All 5 kebabs outlined from measured rects |
| `05_menu_open_row1_light_pl.png` | Menu open, row 1, mouse, light |
| `06_menu_open_row1_dark_pl.png` | Menu open, row 1, mouse, dark |
| `07_favorite_before_row2_light_pl.png` | Before the safe action |
| `08_favorite_after_row2_light_pl.png` | After the safe action (star toggled) |
| `09_kbd_focus_trigger_light_pl.png` | Tab-reached focus ring on row 1's kebab |
| `10_kbd_menu_open_via_enter_light_pl.png` | Menu opened via `Enter` |
| `11_kbd_after_escape_focus_return_light_pl.png` | After `Escape` — menu closed, focus restored |
| `12_menu_open_row5_light_pl_harness_overlap_note.png` | Menu open, row 5 (bottom row); see §9 |

## 13. Summary against the owner's rules

1. Prepared matrix, not a hunt-the-defect exercise — this document. ✅
2. Every item above states what it proves and does not. ✅
3. Product (`IdeasTableContent.tsx`, unchanged this session) vs.
   production-shape harness (`idea-table-production.tsx`) vs. dev-only
   chrome (`PanelUwag.tsx`) are named explicitly throughout, including one
   harness-only visual artifact in §9. ✅
4. No push/deploy/migration performed or proposed. ✅
5. No detector flags exist for this specific check beyond the three guard
   scripts, all reported with their own baselines above, unmodified. ✅
6. No product code changed this session → full type-check/regression not
   applicable; explained in §11 rather than skipped silently. ⚠️ (see note)
7. This document, its 12 images, and the DOM tables are the finished
   slice.
