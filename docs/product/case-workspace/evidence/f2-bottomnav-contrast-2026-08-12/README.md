# F2 — BottomNavigation dark-mode contrast fix (2026-08-12)

**Defect (as reported):** `src/components/navigation/BottomNavigation.tsx` line ~161,
`dark:text-slate-500` on inactive nav-item labels/icons measured ~3.75:1 against its
composed background in dark theme, below the WCAG AA text floor of 4.5:1. Found live via
axe-core 4.10.2, `color-contrast` rule, severity `serious`. Widths below 768px, dark
theme only.

**Fix:** `dark:text-slate-500` → `dark:text-c-text-muted` (one line,
`src/components/navigation/BottomNavigation.tsx`). `text-c-text-muted` is an **existing**
canonical token (`src/index.css` `--c-text-muted`, wired through `tailwind.config.js`'s
`cTok('text-muted')` → Tailwind class `text-c-text-muted`), already used elsewhere in the
app. Its own doc comment in `src/index.css` states the design intent directly:

```
/* Text scale — HARD CONTRAST FLOOR (VISUAL_STANDARD.md §1.3):
 * nothing informational below --c-text-muted (≈5.5:1 on --c-bg).
 * Previous secondary #94a3b8 / muted #64748b were too dark on navy. */
--c-text-muted: #8a99b0; /* muted / placeholder ~5.5:1 — the floor */
```

`#64748b` is exactly `slate-500` (the old, broken class) — this token was created
specifically to retire this exact mistake elsewhere in the codebase. It is **not**
`primary-*`/crimson (canon-compliant: crimson stays reserved for critical/CTA/brand
semantics per `docs/ui-standards/TRIADA_KANON.md`), and it is not a new/invented color.

Light mode (`text-slate-600` on white-ish) was already compliant and is untouched. The
active-item color (`text-primary-600 dark:text-primary-400`) and the `:active` touch-press
color are pre-existing, out of scope for this defect, and are untouched.

## Why "composed background", not a token read in isolation

The nav's background is `bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl`, positioned as
a sibling `<div>` behind the button row (not a CSS-cascade ancestor). The real rendered
color under the text is that translucent, blurred layer composited over whatever is
scrolled underneath the fixed nav (the app's `bg-c-bg` wrapper) — not `navy-900` read
straight from the token table. Measuring the token in isolation would have been wrong in
either direction (mostly harmless here since opacity is 95%, but wrong in principle, and
the kind of shortcut that has produced false P0s in this repo before).

## Method

1. `fixture.html` reproduces the **exact** JSX output of `BottomNavigation.tsx` — same
   nesting, same Tailwind classes, both the `before` (original `dark:text-slate-500`) and
   `after` (`dark:text-c-text-muted`) variants side by side, wrapped in the same
   `bg-c-bg` app shell the real nav sits on top of.
2. `build.sh` compiles that markup's CSS with the project's **real** `tailwind.config.js`
   + `src/index.css` (same token pipeline the app ships — not hand-copied hex values),
   and installs axe-core 4.10.2 into an isolated `node_modules/` scoped to this directory
   only (own `package.json`, `npm install --no-save` — never touches the repo's root
   `package.json`/`package-lock.json`/shared `node_modules`).
3. `measure.cjs` (Playwright + Chromium) opens the fixture at four widths × two themes ×
   two variants (`before`/`after`) × five nav items, and for each item:
   - reads the **foreground** as the exact CSS `color` via `getComputedStyle` (the
     correct WCAG input — not an anti-aliased pixel);
   - reads the **composed background** by screenshotting the actual button and sampling a
     real rendered pixel (captures the true `opacity` + `backdrop-blur` composite as
     painted, not a token in isolation);
   - computes the WCAG contrast ratio from those two colors;
   - separately runs `axe.run()` (`color-contrast` rule only) against the live DOM of the
     visible nav, as an independent confirmation of the math.
   Output: `results.json`.
4. `screenshot.cjs` captures whole-nav PNGs (`nav-<theme>-<variant>.png`) for eyes-on
   confirmation of the visual hierarchy (active vs. inactive still reads correctly).

Re-run any time: `./build.sh && node measure.cjs && node screenshot.cjs`.

### One correctness note baked into the script

Nav buttons carry `transition-all duration-200`. Toggling the `dark` class right after
`page.goto()` starts a 200ms color transition; the very first item sampled right after the
toggle came back ~8% off the other four (verified against this same harness) because it
was caught mid-interpolation, not because its class list differs. `measure.cjs` waits
350ms after the theme toggle before sampling anything, for all rows.

## Every item, every state checked

All 5 items (`My Work`, `Licensed Tools`/assessment, `Initiatives`, `AI`, `More`) were
measured, not just the flagged one — `Licensed Tools` is the **active** item
(`aria-current="page"`, `text-primary-600`/`dark:text-primary-400`) and the other four are
**inactive** (the fixed class under test). `active:` (touch-press) and `hover:` states use
the same pre-existing `active:text-primary-600 dark:active:text-primary-400` on all
inactive buttons — untouched by this fix, not flagged as broken, not remeasured
separately (same color, same math as the "active" row below). There is no `disabled`
state on this component (all 5 items are always actionable) and no `focus` state beyond
the browser default focus ring, which does not touch text/icon color.

## Results (measured, `results.json`)

Composed background, dark theme: `rgb(15, 23, 42)` (nav's `bg-navy-900/95` +
`backdrop-blur-xl` over the app's `bg-c-bg` wrapper — matches the hand-derived alpha-composite
of navy-900 `#0F172A` at 95% over `--c-bg` dark `#0A0F1E` to within rounding).
Composed background, light theme: `rgb(255, 255, 255)` (`bg-white/95` over `--c-bg` light
`#FAFAF9`, rounds to pure white).

| Width | Theme | Item | State | Before (fg → ratio) | After (fg → ratio) |
|---|---|---|---|---|---|
| 320/375/430 | dark | My Work | inactive | `rgb(100,116,139)` → **3.75:1 FAIL** | `rgb(138,153,176)` → **6.18:1 PASS** |
| 320/375/430 | dark | Initiatives | inactive | `rgb(100,116,139)` → **3.75:1 FAIL** | `rgb(138,153,176)` → **6.18:1 PASS** |
| 320/375/430 | dark | AI | inactive | `rgb(100,116,139)` → **3.75:1 FAIL** | `rgb(138,153,176)` → **6.18:1 PASS** |
| 320/375/430 | dark | More | inactive | `rgb(100,116,139)` → **3.75:1 FAIL** | `rgb(138,153,176)` → **6.18:1 PASS** |
| 320/375/430 | dark | Licensed Tools | ACTIVE (untouched) | `rgb(228,88,104)` → 5.01:1 PASS | `rgb(228,88,104)` → 5.01:1 PASS |
| 320/375/430 | light | My Work/Initiatives/AI/More | inactive (untouched) | `rgb(71,85,105)` → 7.58:1 PASS | `rgb(71,85,105)` → 7.58:1 PASS |
| 320/375/430 | light | Licensed Tools | ACTIVE (untouched) | `rgb(133,24,47)` → 9.68:1 PASS | `rgb(133,24,47)` → 9.68:1 PASS |
| 768 | both | all | — | nav not rendered (`md:hidden`, by design — mobile-only component) | same |

All four inactive items reproduce the reported **~3.75:1** before the fix, at every
mobile width, identically — the negative control. All four reach **6.18:1** after the
fix, comfortably above the 4.5:1 AA floor (and above the token's own documented ~5.5:1
floor; the extra headroom here is because the real composed background, `rgb(15,23,42)`,
is very slightly lighter than the raw `navy-900`/`--c-bg` values the doc comment's ~5.5:1
was anchored to).

768px: `BottomNavigation` returns `null` off-hook (`if (!isMobile) return null;`) and
additionally carries `md:hidden` — at 768px and above (Tailwind `md` breakpoint,
`min-width: 768px`) it does not render at all, by design (component doc: "Mobile-only
bottom navigation bar"). No violation is possible where there is no nav; this is expected
and unchanged by the fix.

## Negative control (both directions, from the same script — see `results.json`)

```
BEFORE (dark:text-slate-500), dark theme, inactive items, all mobile widths:
  fg rgb(100,116,139) on composed bg rgb(15,23,42) → 3.75:1  → FAILS 4.5:1 AA

AFTER (dark:text-c-text-muted), dark theme, inactive items, all mobile widths:
  fg rgb(138,153,176) on composed bg rgb(15,23,42) → 6.18:1  → PASSES 4.5:1 AA
```

## axe-core before/after (`results.json`, `axe` rows; rule scoped to `color-contrast`)

```
320/375/430, dark, BEFORE: 1 violation — color-contrast, impact "serious"
  targets: bottom-nav-mywork, bottom-nav-initiatives, bottom-nav-ai, bottom-nav-more (label spans)
320/375/430, dark, AFTER:  0 violations — color-contrast passes

320/375/430, light, BEFORE: 0 violations
320/375/430, light, AFTER:  0 violations

768, both themes, both variants: 0 violations, 0 passes (nav not in the DOM at this width — by design)
```

No new violation was introduced anywhere in the matrix.

## Visual hierarchy check

`nav-dark-before.png` / `nav-dark-after.png` / `nav-light-before.png` /
`nav-light-after.png` (375px). Side by side, the active item ("Licensed Tools", crimson +
top indicator bar + bold label) still reads clearly as the selected one; the four inactive
items are visibly *more legible* after the fix without becoming as prominent as the active
item — hierarchy preserved, not traded for a usability regression.

## Files

- `fixture.html` — static reproduction of the real component markup/classes (before + after).
- `build.sh` — compiles `compiled.css` from the project's real Tailwind config/tokens, installs
  axe-core 4.10.2 locally (`node_modules/`, `.gitignore`d, isolated `package.json`).
- `measure.cjs` — Playwright measurement script; writes `results.json`.
- `screenshot.cjs` — writes the four `nav-*.png` visual-proof screenshots.
- `results.json` — full raw output (all widths × themes × variants × items, plus axe rows).
- `nav-{light,dark}-{before,after}.png` — visual proof.

## What was NOT verified live in the real running app

The coordinator-owned dev server on `:4501` was unstable during this session (concurrent
agents editing shared files, e.g. `src/index.css`, triggered repeated Vite full-reloads;
the SPA also failed to mount / the router bounced to an unrelated stored case route
several times). Rather than depend on that shared, moving target, this evidence was built
from a static fixture using the byte-identical markup and the project's own compiled
Tailwind CSS — which is deterministic, reproducible, and (per the negative control above)
reproduces the originally reported ~3.75:1 finding exactly. What was **not** re-confirmed
is a live screenshot of the actual mounted `<BottomNavigation>` inside the running app on
`:4501`; the component only takes a static `className` string with no dynamic/runtime
color logic, so the fixture's fidelity to `src/components/navigation/BottomNavigation.tsx`
is a straight line-for-line copy of its `NavItem` render output at the time of this fix
(diff: `git diff -- src/components/navigation/BottomNavigation.tsx`).
