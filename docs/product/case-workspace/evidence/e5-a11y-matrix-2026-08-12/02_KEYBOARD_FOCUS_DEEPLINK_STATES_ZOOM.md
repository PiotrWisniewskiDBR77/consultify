# E5 — keyboard, focus-return, deep-link, zoom, reduced-motion, states, VoiceOver

Live stack, same session as `01_WIDTH_THEME_AXE_MATRIX.md`. Real backend 127.0.0.1:3001,
real Postgres, real login, no mocked `/api/*`.

## Zoom 200%

Method: `document.documentElement.style.zoom = '2'` (the same mechanism Chromium's
own page-zoom uses internally) at two representative widths.

| Screen | Width | Theme | Hidden h-scroll | axe critical/serious |
|---|---|---|---|---|
| Detail (Plan) | 1440 | dark | NO | same as unzoomed (F2 only) |
| Detail (Plan) | 375  | dark | NO | not re-run (visual pass only) |

At 375×zoom-200% one **visual** defect was observed (not a scroll/axe failure):
the floating environment badge ("LOCAL") and the bottom-nav's leftmost two
labels ("Work"/"Tools") overlap at this extreme combination. Not part of the
CaseWorkspace allowlist (the LOCAL badge and BottomNavigation are shared/env
chrome) — noted for completeness, not patched.

## Keyboard-only operation

**Tooling caveat found and proven, read before trusting any Enter/Space result
below:** this session's Browser-pane `key` action does not reproduce a native
browser's default "activate control on Enter/Space" behavior for `<button>`
elements. Proven with a decisive, isolated control: a plain vanilla
`document.createElement('button')` with a bare `addEventListener('click', …)`,
focused, received a correct `keydown`/`keyup` (`key: "Enter"`, `defaultPrevented:
false`) from this tool but **never received a `click` event** — while the
identical key action on a focused `<a href="#app-main-content">` DID trigger
real navigation (`location.href` gained the hash). Also: this tool's `key:
"space"` produces a `KeyboardEvent` with an **empty `.key` string** (should be
`" "`). Conclusion: Enter/Space activation results from this specific tool are
not trustworthy signal for THIS session — a real user in a real browser is not
affected, because native `<button>` elements are activated by the browser
engine itself, not by this test harness.

Given that, keyboard evidence here is built from what IS reliable through this
tool: **Tab order** (real, DOM-level `document.activeElement`), **focus
visibility** (screenshotted), **ARIA correctness** (real DOM reads), and
**Escape / mouse-driven open+close** (Escape is a plain `keydown` listener,
not dependent on native click-synthesis, and fired correctly every time).

- List screen (`CasesListScreen`) Tab order, sampled: Search → view tabs
  → filter chips → column sort buttons → column resize handles → "View
  settings" → per-row "Row actions" kebab (only Tab-stop inside a row — the
  row `<tr>`/title div is `tabIndex={-1}` **by deliberate design**, see below).
  All stops carry a visible blue `--c-focus` ring (screenshotted at 320/1280).
- Row title div (`data-zlecenie-wiersz`, `CasesListScreen.tsx:677,710`) is
  `tabIndex={-1}` on purpose — the in-code comment explains it's the **focus-
  restoration anchor for "back" navigation** (owner requirement), not the
  primary open-trigger. The row's `<tr>` has a plain `onClick`, mouse-only,
  same as most data-grid patterns; the **keyboard-equivalent path is the
  kebab → "Otwórz zlecenie" menu item**, confirmed present (see below). Not
  reported as a defect: this is a real, working, alternate path — just less
  direct than clicking the row.
- `RowActionsMenu.tsx` kebab (shared, out of allowlist): `aria-haspopup="menu"`,
  `aria-expanded` toggles correctly on a real (ref-based) mouse click, opens
  a `role="menu"` with real items (`"Otwórz zlecenie"`, `"Rozpocznij
  zlecenie"`, `"Open preview"`, `"Anuluj zlecenie"` for the sampled row).
  **Escape closes the menu AND returns focus to the exact trigger button** —
  reproduced twice independently (list-row kebab, and the Detail screen's
  header "More" kebab) — see Focus return below.
- Detail screen's view-mode switch (`Prosty`/`Ekspercki`/`Lista`,
  `CaseDetailScreen.tsx:1363-1390`) is a correct native ARIA radiogroup:
  `role="radiogroup"` + `role="radio"` + `aria-checked` on each option,
  verified live (`Prosty` → `aria-checked:"true"`, others `"false"`). I
  initially suspected a missing-state bug here from a shallow query
  (checking `aria-pressed`, the wrong attribute) — checked the source before
  reporting and confirmed it's correctly built; no defect, no patch made.

**Net verdict on keyboard-only**: every primary action (open a case, open the
row-actions menu, open a deliverable, close a menu, switch view mode,
expand/collapse a right-panel accordion) is backed by a real `<button>` (or
correctly-ARIA'd radio) reachable by Tab — HTML gives real users native
Enter/Space activation on all of these for free. I could directly demonstrate
Escape-close + focus-return and mouse-click functionality; I could **not**
directly demonstrate Enter/Space-opens-the-menu through this specific tool
due to the proven tool limitation above. This is flagged, not swept under
the rug: **treat the Enter/Space cells as "verified structurally correct,
not behaviorally demonstrated" rather than a clean PASS.**

A prior, independent packet in this same worktree (`evidence/c4-deliverable-ui-2026-08-12/`,
which used real Playwright — a different automation path than this session's
Browser pane, and one that does not share this tool's key-dispatch gap) DID
drive a full Tab → Enter → open-module → Back → focus-restored round trip
successfully (`keyboard-results.json`: focus lands on the exact trigger
button at 6ms after return, `outlineStyle: "solid"`, aria-live announcement
captured verbatim: *"Wróciłeś do zlecenia — kursor stoi przy: Decyzja. Sekcja:
rezultaty."*). That is real, independent, corroborating evidence that Enter
DOES work for end users — it just couldn't be re-demonstrated through this
session's specific tool.

## Focus return

Two independent, clean, real reproductions this session:
1. List screen row-actions kebab: mouse-open → `Escape` → focus returns to
   that exact `button[aria-label="Row actions"]` (confirmed via
   `document.activeElement.getAttribute('aria-label') === "Row actions"`
   immediately after Escape, menu removed from DOM).
2. Detail screen header "More" kebab (`NModeHeader.tsx`, shared/out of
   allowlist but exercised here): identical result — mouse-open → `Escape` →
   focus back on the "More" button.

Plus the corroborating C4 packet evidence above for the deliverable-open →
back round trip (`sessionStorage['zlecenia.powrot']` written/consumed,
target button re-focused, aria-live announcement fired).

**Verdict: PASS**, multiple independent reproductions, no counter-example found.

## Deep-link restoration

- Fresh full-page `navigate()` (not SPA-internal) directly to
  `/zlecenia/case-b9a5b56c-...?zakladka=realizacja` → Realizacja tab
  correctly selected and populated with real backend data on first paint
  (screenshotted).
- Same for `?zakladka=rezultaty` and `?zakladka=plan&widok-planu=prosty`.
- Theme-reload (localStorage patch + full navigate) preserves the case id +
  tab + view-mode query string exactly.
- C4 packet's independent evidence: a brand-new tab with **no prior Case
  Workspace history at all**, opened directly at a deep artifact link URL,
  loads without crashing (`deeplink-01-direct-url-fresh-tab.png`).

**Verdict: PASS** across both this session's and the C4 packet's independent runs.

## Refresh / reopen

- Full navigate to an identical URL after a state-mutating detour (org
  membership suspend/restore, see States below) correctly re-fetches and
  re-renders, recovering from the induced error state cleanly.
- C4 packet: `refresh-01-results-tab-survived.png` + `keyboard-results.json`
  `refreshedRows` — hard reload of `?zakladka=rezultaty&widok-planu=prosty`
  reproduces the same four artifact-link rows/states (`Otwórz obiekt: Wskaźnik`
  disabled, `Zadanie` disabled, `Inicjatywa (przypięta rewizja jest starsza)`
  enabled, `Decyzja` enabled) — i.e. state survives refresh.

**Verdict: PASS.**

## Deliverable open/return

Not re-driven end-to-end in THIS session (would duplicate work), but
independently, freshly **verified still live**: navigated to the exact case
used by the C4 packet (`case-94b37954-c4a1-4417-8eed-9edefd570f95`,
"Transformacja cab9cd8b") right now and confirmed, live, on screen:
- Header shows a real "Otwórz rezultat" button (this case has a linked
  deliverable).
- POWIĄZANIA (Relations) accordion, expanded live, shows all **four** real
  artifact-link rows with correct icons/labels/states:
  - Wskaźnik (KPI) — "Powiązanie zostało odpięte od tego zlecenia" (DELETED)
  - Zadanie (Task) — "Moduł źródłowy potwierdził, że tego obiektu już nie ma" (UNAVAILABLE)
  - Inicjatywa — "Wynik pracy · nieaktualny" (STALE)
  - Decyzja — "Dostawa dla klienta" (AVAILABLE, opens)
- axe on this screen: same baseline as elsewhere (F2 only), 0 new criticals.

The actual click-through/open/return mechanics (Tab → Enter → new module →
Back → focus restored → announcement) are the C4 packet's evidence, cited
above, produced via real Playwright against this same live backend — not
duplicated here to avoid mutating shared demo data twice, but re-confirmed
today that the underlying data and UI are still live and rendering correctly.

## Reduced motion

No live OS/browser-level `prefers-reduced-motion` emulation was available
through this session's tools (the Browser pane's `resize_window` exposes a
`colorScheme` override but nothing for reduced-motion; CDP `Emulation.setEmulatedMedia`
is not exposed to this session). Static + structural evidence instead:

- `src/components/CaseWorkspace/**` has **zero** `framer-motion` (`motion.`)
  usage — confirmed by grep. The one real transform animation found
  (`ui.tsx:582`, a chevron `rotate-180` on the "Więcej" dropdown) had no
  `motion-reduce:` guard — **patched this session** (see Code changes below)
  to match the pattern already established in `PlanView.tsx` (which
  documents, in a code comment, that it was deliberately measured to have
  **zero** non-`motion-reduce`-guarded transitions inside `[role="application"]`).
  The other `transition` usages in `CaseDetailScreen.tsx`/`RezultatyView.tsx`
  are plain color/background hover transitions, not the kind of motion WCAG
  2.3.3 targets — left as-is.
- **F5 (out of allowlist, moderate)**: `NModeHeader.tsx:332-335` — the Menu-1
  bar's own entrance (`initial={{opacity:0,y:-10}}`, 0.3s) is unconditional,
  no `useReducedMotion()`/`reducedMotion` prop check, even though the prop
  plumbing for it already exists elsewhere in the same file tree
  (`NModeShell.tsx`, `NModeCanvas.tsx` both accept and honor a `reducedMotion`
  prop, just not wired into this specific header animation). Reported, not
  patched (shared shell, out of allowlist).
- Separately, a real, reproducible **timing finding**, not a reduced-motion
  bug: on this environment the Detail screen's data-driven fade can take
  several seconds (observed up to ~5s) to visually settle after a
  navigation/resize — this tracks with the backend doing ~11 DB queries per
  case-bundle fetch per the LIVE_STACK_RUNBOOK's own logged evidence, not an
  unbounded/infinite animation. Documented in `01_WIDTH_THEME_AXE_MATRIX.md`
  because it produced transient axe false-positives that had to be filtered
  by waiting for settle.

**Verdict: PARTIAL.** CaseWorkspace's own code is clean by design and grep.
One real gap found and patched in-scope (`ui.tsx` chevron). One real gap
found, out of scope, reported (`NModeHeader.tsx` entrance fade). Could not
independently confirm the OS-level `prefers-reduced-motion` media query
actually suppresses the `motion-reduce:` Tailwind variants live, because no
tool in this session could toggle that browser preference without touching
real system accessibility settings on the host Mac (explicitly avoided per
this packet's safety constraints — see VoiceOver below for the same
reasoning).

## VoiceOver on macOS — NOT ATTEMPTED, explicit reason

VoiceOver was **not run**. Turning it on is a real macOS Accessibility
setting change on the host machine (not an in-browser emulation) — it takes
over system-wide keyboard/mouse semantics and speaks audibly, and this is an
unattended background packet with no live user in the loop to confirm that's
welcome on their physical Mac at this moment. That crosses this session's
own safety boundary against changing system settings without a real-time,
in-chat confirmation, so it was skipped rather than forced through
`computer-use`. What I did instead, as the closest honest substitute:
- Read every screen's accessible-tree output (`read_page`) — role, name,
  and state for every interactive element shown in this report were taken
  from the real accessibility tree, not just visual inspection.
- Ran axe-core (which flags most of what VoiceOver would trip on structurally
  — missing names, bad landmark structure, contrast) across the full matrix.
- Explicitly did **not** claim a VoiceOver pass anywhere in this report.

**This cell is honestly EVIDENCE_MISSING.** If a real interactive session
with the owner present is available, re-run this cell live with VoiceOver
(Cmd+F5) sweeping the List and Detail screens' primary flows.

## Required states — what was produced on the REAL backend, and how

| State | Produced how | Evidence |
|---|---|---|
| empty | Real cases with zero plan steps / zero results / zero relations, from the live DB (349 real cases, several are drafts with no plan) | screenshotted: Plan "Ten plan nie ma jeszcze kroków", Rezultaty "Żaden krok nie ma jeszcze zapisanego wyniku", Źródła i założenia "Zlecenie nie wskazuje jeszcze kryteriów..." |
| loading | Observed as the real data-fetch-then-fade window on navigation (several seconds, backend-driven, not simulated) | timing note above; not a dedicated spinner screenshot — the app doesn't show a distinct skeleton in the cases exercised, content simply fades in once the real fetch resolves |
| error / blocked | Real 403: `UPDATE organization_members SET status='SUSPENDED'` on the disposable local Postgres (the runbook's own documented, reversible negative control), then loaded the case live → real enumeration-safe "Nie znaleźliśmy tego zlecenia" screen (SEC-009 pattern: doesn't distinguish "blocked" from "not found" on purpose) → **restored** membership immediately after, re-verified access recovered | screenshotted before/after; axe clean once settled |
| stale | Real `artifact_link` row with `mark-stale` applied via the live backend's own mutation endpoint (from the C4 packet, re-verified live today) | "Inicjatywa — Wynik pracy · nieaktualny", `case-94b37954-...` |
| partial | **Not produced.** `ValueMeasurementStatus.PARTIAL` / `RunOutcomeStatus.PARTIALLY_ACCEPTED` / case status `COMPLETED_PARTIAL` were not exercised — would need either a specific seeded case or driving a run through the lifecycle via the API, not attempted this session. **EVIDENCE_MISSING.** |
| blocked | Same as error/blocked above (403 → enumeration-safe not-found screen) | as above |
| skipped | **Not produced.** `NodeCompletionState.SKIPPED` (Rezultaty per-node completion) requires marking a specific plan node skipped through the run-lifecycle API; not attempted this session. **EVIDENCE_MISSING.** |

## Code changes made this session, and typecheck

Single additive change, inside allowlist:
- `src/components/CaseWorkspace/ui.tsx:582` — added `motion-reduce:transition-none`
  to the "Więcej" dropdown's chevron rotation, matching the existing pattern
  in `PlanView.tsx`. Diff:
  ```diff
  - className={open ? 'rotate-180 transition' : 'transition'}
  + className={open ? 'rotate-180 transition motion-reduce:transition-none' : 'transition motion-reduce:transition-none'}
  ```
- Considered and explicitly **did not** patch a suspected missing
  `aria-current`/`aria-pressed` on the Prosty/Ekspercki/Lista switch — checked
  the source first and found it already correctly uses `role="radiogroup"` +
  `role="radio"` + `aria-checked`, confirmed live. No bug, no patch.

Typecheck: `NODE_OPTIONS="--max-old-space-size=8192" ./node_modules/.bin/tsc --noEmit`
run in the background per instructions. **`EXIT=0`**, zero errors in the log
(`/tmp/e5-tsc-output.log`).
