# G1 — BottomNavigation ACTIVE-item canon fix (2026-08-12)

**Defect (fan-in review finding):** `src/components/navigation/BottomNavigation.tsx`
painted the ACTIVE mobile-nav item (`text-primary-600 dark:text-primary-400`), its
top indicator bar (`bg-primary-600 dark:bg-primary-400`), and the inactive items'
CSS `:active` touch-press state (`active:text-primary-600 dark:active:text-primary-400`)
in crimson (`#85182F`) — the token this repo reserves EXCLUSIVELY for
critical/destructive/brand semantics.

## 1. Full active-state contract, as found

- **Colour** (defect): `text-primary-600` (light) / `dark:text-primary-400` (dark) on
  the label+icon; same pairing on the top indicator bar via `bg-*`.
- **Shape**: a `w-8 h-1 rounded-b-full` bar, absolutely positioned at the top of the
  button, present in the DOM **only** when `active` is true (not just recoloured —
  the element itself appears/disappears).
- **Weight**: `font-semibold` added to the label only when `active`.
- **Semantics**: `aria-current={active ? 'page' : undefined}` — already present,
  not something this packet had to add.
- **Selection logic**: `isActive()` maps `AppView` values to each of the 5 tabs
  (My Work/Licensed Tools/Initiatives/AI/More), including multi-view groups (e.g.
  "Initiatives" is active for `PORTFOLIO_ROADMAP`, `FULL_STEP2_INITIATIVES`, and
  `INITIATIVE_MANAGEMENT`) — untouched by this fix.
- **Press feedback** (defect, inactive items only): `active:text-primary-600
  dark:active:text-primary-400` — a CSS `:active` (touch-press) override, momentary,
  applies to all 4 non-selected tabs while pressed.

## 2. Canon reading

`docs/ui-standards/TRIADA_KANON.md` część A10: *"Czerwień = wyłącznie semantyka
krytyczna (overdue/error/blocked/delete). Aktywne stany UI = neutralne. Focus =
niebieski (nigdy akcent/crimson)… `primary` w tailwind = crimson #85182F — zakazany
jako kolor UI."* Część C1 token table repeats it: `--c-accent` = crimson, **"TYLKO
marka/nic-UI"**. CLAUDE.md's "Pułapka nr 1" states the same rule as a top-level,
non-negotiable trap: *"`primary` w tailwind = crimson #85182F. Czerwień TYLKO
semantyka krytyczna. CTA/stany aktywne = neutralne."*

**Confirmed wrong, not a permitted exception.** "Which tab am I on" is an ordinary
selection/navigation state, not overdue/error/blocked/delete. Nothing in
TRIADA_KANON.md carves out navigation "current page" indicators as a legal crimson
use — the closest analogous carve-out (Menu 2 "aktywna pigułka") explicitly says the
opposite: *"Aktywna pigułka = wypełniona wyraźnie innym, NEUTRALNYM kolorem (nigdy
crimson)"* (część A2). The sibling component in the SAME navigation family —
`src/components/navigation/Sidebar/NavItem.tsx` (desktop primary nav, same "current
page" semantic) — already implements this correctly: `isHighlighted ? 'bg-slate-200/60
dark:bg-white/10 text-c-text font-medium' : …` for its active state, and a
`bg-[var(--c-info)]` accent bar (`NavItem.tsx:108-109,181`). BottomNavigation was the
outlier, not NavItem.

## 3. Token chosen and why

- **Active label/icon**: `text-c-text` (was `text-primary-600 dark:text-primary-400`).
  `--c-text` is the app's primary-contrast neutral text token (`src/index.css`:
  `#0f172a` light / `#f4f7fb` dark, defined once in `:root` and again in `.dark`, so a
  single Tailwind class — no `dark:` prefix needed — resolves correctly in both
  themes). It is the EXACT token the sibling `NavItem.tsx` already uses for its own
  "currently selected" state (`text-c-text`, `NavItem.tsx:109,123`) — reusing it keeps
  the two "you are here" indicators in the app (desktop sidebar, mobile bottom nav)
  semantically consistent, not inventing a third convention.
- **Active indicator bar**: `bg-c-info` (was `bg-primary-600 dark:bg-primary-400`).
  `--c-info` is an existing semantic token (`src/index.css`, blue-family: `#3b2883`
  light / `#58a6ff` dark). Chosen because it is the literal, already-shipped precedent
  for "the selection indicator bar" in this exact component family —
  `NavItem.tsx:181`: `className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5
  bg-[var(--c-info)] rounded-r-full"`, its own "activeIndicator" accent bar. Not a new
  invented colour, not `slate-*`, not another crimson variant.
- **Inactive `:active` (touch-press)**: `active:text-c-text dark:active:text-c-text`
  (was `active:text-primary-600 dark:active:text-primary-400`) — same reasoning as
  active label; see §6 for why this token specifically (not, say,
  `c-text-secondary`).

No hex was hand-picked; both tokens already exist in `src/index.css`, are already
wired through `tailwind.config.js`'s `cTok(...)` helper (`text: cTok('text')`,
`info: cTok('info')`, confirmed present in the compiled Tailwind output used for
measurement below), and are both already used elsewhere in the app for
materially the same purpose.

## 4. Measured contrast — composed background, real pixels, both themes, 4 widths

Method: `fixture.html` reproduces the exact JSX/class output of
`BottomNavigation.tsx` (`before` = original crimson, `after` = this fix's tokens),
compiled with the project's real `tailwind.config.js` + `src/index.css` (see
`tailwind.config.evidence.mjs` — one important correction to the F2 rig's pattern,
below), rendered with Playwright, foreground read via `getComputedStyle`, background
sampled from a **real screenshot pixel** of the composed `bg-white/95`/
`bg-navy-900/95` + `backdrop-blur-xl` nav over the app's `bg-c-bg` wrapper (never a
token read in isolation). Full page reload between themes is inherent here (`.dark`
class is toggled and then the page waits 350ms for the `transition-all duration-200`
colour transition to fully settle before any pixel is sampled — same discipline as
F2, and necessary here too, see §7 below for what happens without it).

**Active item, label (WCAG AA text floor 4.5:1), at 320/375/430 (all three identical —
`BottomNavigation` is `md:hidden`, does not render at 768):**

| Theme | Before (fg → ratio) | After (fg → ratio) |
|---|---|---|
| light | `rgb(133,24,47)` on `rgb(255,255,255)` → **9.68:1 PASS** | `rgb(15,23,42)` on `rgb(255,255,255)` → **17.85:1 PASS** |
| dark | `rgb(228,88,104)` on `rgb(15,23,42)` → **5.01:1 PASS** | `rgb(244,247,251)` on `rgb(15,23,42)` → **16.61:1 PASS** |

**Active indicator bar, non-text UI component (WCAG 1.4.11 floor 3:1):**

| Theme | Before (bar → ratio) | After (bar → ratio) |
|---|---|---|
| light | `rgb(133,24,47)` on `rgb(255,255,255)` → **9.68:1 PASS** | `rgb(59,40,131)` on `rgb(255,255,255)` → **11.56:1 PASS** |
| dark | `rgb(228,88,104)` on `rgb(15,23,42)` → **5.01:1 PASS** | `rgb(88,166,255)` on `rgb(15,23,42)` → **7.07:1 PASS** |

**Inactive items, resting state — unchanged since packet F2, reproduced for parity
only (375px sample; identical at 320/430):**

| Theme | Before/After (fg → ratio) |
|---|---|
| light | `rgb(71,85,105)` on `rgb(255,255,255)` → **7.58:1 PASS** (untouched by G1) |
| dark | `rgb(138,153,176)` on `rgb(15,23,42)` → **6.18:1 PASS** (F2's fix, untouched by G1) |

**Inactive items, `:active` touch-press (375px sample, all 4 non-selected tabs
identical):**

| Theme | Before (fg → ratio) | After (fg → ratio) |
|---|---|---|
| light | `rgb(133,24,47)` on `rgb(255,255,255)` → **9.68:1 PASS** | `rgb(15,23,42)` on `rgb(255,255,255)` → **17.85:1 PASS** |
| dark | `rgb(228,88,104)` on `rgb(15,23,42)` → **5.01:1 PASS** | `rgb(244,247,251)` on `rgb(15,23,42)` → **16.61:1 PASS** |

**768px, all rows:** `BottomNavigation` returns `null` (`if (!isMobile) return null`)
and additionally carries `md:hidden` — at 768px and above it does not render at all,
by design (mobile-only component, doc comment at the top of the file). No violation
possible where there is no nav.

**axe-core (`color-contrast` rule only), full matrix (4 widths × 2 themes × 2
variants = 16 rows, each covering all 5 nav items):** **0 violations in every row,
before AND after.** This is expected and correctly diagnosed: the original crimson
already had adequate NUMERIC contrast on both backgrounds (9.68:1 and 5.01:1, both
comfortably above 4.5:1) — the defect was never a contrast failure, it was semantic
misuse of a colour this repo reserves for critical/destructive meaning. Fixing it is
a canon-compliance fix, not a WCAG-contrast fix (though the numbers improve
regardless, see table above).

Raw data: `results.json` (156 rows). Visual proof: `nav-{light,dark}-{before,after}.png`
(375px; screenshots below, §5).

### One bug found building this rig (documented so the pattern doesn't repeat)

The F2 rig's `build.sh` compiles CSS using the REAL `tailwind.config.js`, whose
`content` globs never scan the evidence directory. That's harmless for F2 (it ran
BEFORE this fix landed, so the original crimson classes were still live in the real
component source and got compiled normally). It is NOT harmless here: this fix
**already landed** in `BottomNavigation.tsx` before this rig ran, so the ORIGINAL
compound-variant classes (`active:text-primary-600`, `dark:active:text-primary-400`)
no longer appear ANYWHERE in the scanned source tree — Tailwind's JIT never
generates their CSS rule, and the fixture's "before" `:active`-state button silently
fell back to whatever cascaded from elsewhere (looked like a clean PASS at
`slate-600`/`c-text-muted`, i.e. the *resting* colour — not real, not caught by
inspection). Caught by an explicit `el.matches(':active')` + `getComputedStyle` probe
(kept as the debugging method, not committed as a separate file) that showed the
:active rule simply wasn't in `compiled.css`. Fixed by `tailwind.config.evidence.mjs`
— wraps the real config unchanged, widens ONLY `content` to also scan this
directory's `fixture.html` (which statically contains both the before AND after
class strings side by side), so both variants compile correctly regardless of the
real component's current state. Re-verified after the fix: `debug-active.cjs` probe
(transient, not committed) confirmed `matches(':active') === true` and the correct
pressed colour (`rgb(133,24,47)`) once a **350ms** wait was added after
`mouse.down()` — the same `transition-all duration-200` interpolation issue F2's
README already flagged for the theme toggle applies identically to a live `:active`
engagement; 50ms sampled mid-transition (`rgb(81,75,96)`, neither endpoint colour).

## 5. Non-colour recognisability (WCAG 1.4.1, use of colour)

`aria-current="page"` was **already present** before this packet (not something G1
added) — `BottomNavigation.tsx:147`, `aria-current={active ? 'page' : undefined}`.

Beyond that, THREE independent non-colour affordances mark the active tab, verified
in `nav-{light,dark}-{before,after}.png` and asserted by the new test's fourth case
(§7): (1) `aria-current="page"` (screen reader / assistive tech), (2)
`font-semibold` on the label (only when active — a weight change, not a colour
change), (3) the top indicator bar's very PRESENCE in the DOM (only rendered when
`active`, not just recoloured — its shape and position, not its hue, is what a user
scanning without colour perception would key off of). Colour was never, even before
this fix, the ONLY differentiator — but it was the WRONG colour semantically. Both
screenshots (before/after, both themes) show the active tab reading unambiguously as
selected; the fix does not trade hierarchy for compliance.

## 6. Verdict on the `:active` press-state crimson

**Also wrong, also fixed.** It is momentary (only visible while a finger/cursor is
down on the button), but per TRIADA_KANON.md część A10 — *"Aktywne stany UI =
neutralne"* — a CSS `:active` press-feedback state is exactly an "active UI state,"
and the canon draws no durability threshold (it does not say "except momentary
ones"). Concretely, before this fix, briefly touching ANY of the 4 non-selected tabs
(AI, More, Initiatives, My Work when a different tab is current) flashed crimson —
the same "critical/destructive" colour appearing on an ordinary tap, diluting its
meaning everywhere else it's legitimately used (overdue, blocked, delete). Fixed to
`active:text-c-text dark:active:text-c-text` — same token as the true active state,
chosen deliberately: a press is "you are about to select this," semantically closer
to "as if selected" than to the quieter resting `text-c-text-muted`, so reusing the
active token (rather than introducing a fourth distinct greyscale) keeps the state
count minimal and the semantics legible ("pressed" and "selected" read as the same
family of engagement, both above the muted resting baseline).

## 7. Guard — what it detects, and proof it fires

**New test:** `tests/components/navigation/BottomNavigation.activeStateCanon.test.tsx`
(4 cases). Renders the REAL component (not a fixture) via React Testing Library and
asserts on the live DOM `className` output:

1. No `primary-<number>` utility (regex `primary-(50|100|…|900)(?![0-9])`) appears
   ANYWHERE in the nav subtree — covers the active label, the indicator bar, AND the
   inactive items' `active:`/`dark:active:` press classes in one pass, because
   Tailwind bakes variant classes into the static `class` attribute regardless of
   pseudo-state (no need to simulate a real `:active` engagement to catch a
   regression here — the class string itself is the evidence).
2. The active item carries `text-c-text` and NOT the crimson pattern.
3. The indicator bar carries `bg-c-info` and NOT the crimson pattern.
4. The non-colour affordances (§5) are all present together: `aria-current`,
   `font-semibold` only on the active label, and the indicator bar's DOM presence
   gated correctly (present for active, absent for inactive).

**Proof it fires — captured transcript, this session:**

- Ran against the FIXED component (current working tree): **4/4 PASS.**
- `git stash push -- src/components/navigation/BottomNavigation.tsx` (temporarily
  reverted ONLY that file to its pre-fix content, nothing else touched) → re-ran the
  same test file → **3/4 FAIL**, with the exact offending class strings in the
  assertion diffs:
  ```
  AssertionError: expected [] to equal [
    "<button class=\"… text-primary-600 dark:text-primary-400\">",
    "<div class=\"absolute top-0 … bg-primary-600 dark:bg-primary-400 rounded-b-full\">",
    "<button class=\"… active:text-primary-600 dark:active:text-primary-400\">",
    … (4 inactive buttons, each with the crimson :active class)
  ]
  AssertionError: expected '… text-primary-600 dark:text-primary-400' to match /\btext-c-text\b/
  AssertionError: expected '… bg-primary-600 dark:bg-primary-400 …' to match /\bbg-c-info\b/
  ```
  (4th case — non-colour affordances — still PASSED on the reverted file, correctly,
  since `aria-current`/`font-semibold`/bar-presence were never part of the defect.)
- `git stash pop` (restored the fix) → `git diff` confirmed the restored file is
  byte-identical to the fix (3 insertions / 3 deletions, matching the intended edit)
  → re-ran the test file → **4/4 PASS** again.

This is a real, reproducible RED→GREEN transition on the actual defect, not an
assertion that trivially always passes.

**Existing, complementary guard already in the repo:** `scripts/check-triada.sh`
already scans ALL of `src/components/**/*.tsx` and `src/views/**/*.tsx` (this file's
scope includes `src/components/navigation/BottomNavigation.tsx`) for
`primary-(50|…|900)` and is wired into `.husky/pre-commit` (gate 3) — it is a
repo-wide ratchet against `scripts/check-triada.baseline.txt`, which currently
records `3\tsrc/components/navigation/BottomNavigation.tsx` (the 3 crimson LINES
this fix removed). That baseline number is now stale (the file has 0 violations
after this fix) but I did **not** regenerate it myself: `--update` recomputes counts
for the ENTIRE repo scope (~600+ files), and this workspace is one of several
concurrent packets touching shared files — mutating a shared ratchet baseline is
coordinator territory, not a single packet's. **Recommendation for the coordinator:**
once this packet lands without conflicting concurrent edits, run
`scripts/check-triada.sh --update` (or confirm the fan-in integration step already
does) so the ratchet floor for this file drops from 3 to 0 and ANY future
reintroduction of `primary-*` here is caught immediately, repo-wide, without relying
on the new component-level test alone.

## 8. Impact on other modules

`BottomNavigation` has exactly ONE mount point in the entire codebase:
`src/layouts/MainLayout.tsx:303`, inside the app's global layout shell (rendered
alongside `<Sidebar />`, always present on `md:hidden` viewports regardless of which
module is active). Confirmed via `grep -rn "BottomNavigation" src/ dev-render/`:
only the component's own definition (`BottomNavigation.tsx`), its barrel export
(`src/components/navigation/index.ts`), and this one `MainLayout.tsx` import/usage.
No per-module override, no second copy, no dev-render-only variant. **Effect: every
module's mobile view (My Work, Assessment/Licensed Tools, Initiatives, AI Chat,
anything reachable via "More") gets the corrected active-tab colour uniformly** —
this is a single shared shell component, not something that needed per-module
propagation.

## 9. What could NOT be verified

- **Live app, mounted in the running dev server.** Per this packet's HARD RULES, no
  dev server was started (port 3001 backend is coordinator-owned and intentionally
  down for gate measurement; the fixture-based rig does not need it). Verified
  instead via (a) a byte-for-byte class fixture compiled with the project's real
  Tailwind pipeline, measured with real screenshot-pixel sampling — the same method
  packet F2 already established and validated for this exact component, and (b) a
  React Testing Library render of the ACTUAL component module (not a markup copy),
  which exercises the real `isActive()` selection logic, the real conditional
  indicator-bar rendering, and the real `aria-current` wiring.
- **Real touch-press visual feel on a physical device.** The `:active` CSS
  pseudo-class was engaged via Playwright's synthetic `mouse.down()`/`mouse.up()`
  (confirmed via `el.matches(':active')`), which is the standard, correct way to
  test `:active` styling in a headless browser — but it is not the same as a finger
  on a touchscreen; iOS/Android touch-to-`:active` timing quirks were not tested
  here (out of scope — same component, same caveat would apply regardless of this
  fix).
