# L3 — axe completion: Gap 1 (3 serious findings) + Gap 2 (Realizacja/Rezultaty coverage)

Date: 2026-08-12. Worktree `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809`,
branch `claude/case-workspace-v1-20260809`. Allowlist: `src/components/CaseWorkspace/**`,
`src/components/shared/NModeLayout/**` (only if the defect lived there — it did not), this
evidence directory.

## Result up front

**Zero critical / zero serious axe findings across the FULL matrix — 4 surfaces (List,
Detail/Plan, Detail/Realizacja, Detail/Rezultaty) x 7 widths (320/375/430/768/1024/1440/1920)
x 2 themes (light/dark) = 56 cells, all live, real backend, real case data.** The three
specific elements named in Gap 1 (org-avatar chip, "Wczytaj ponownie", "Wróć do listy
zleceń") could **not** be reproduced as failing in any state reached during this sweep —
see §2 for the numbers and §5 for why the earlier finding likely doesn't hold up. Gap 2
(zero axe coverage on Realizacja/Rezultaty) is closed — see §4.

No source file inside the Case Workspace module needed a fix: nothing failing was found
to fix. This is reported as a genuine "could not reproduce" rather than forced into a
fabricated patch — see §6 for exactly what that means and its limits.

## 1. Environment

- Backend `127.0.0.1:3001`: coordinator-owned. Went down twice mid-session (clean
  `SIGTERM`/exit 0 per the coordinator's own log read — an orphaned `nohup` process, not a
  product defect, not caused by this packet). Per instructions, it was never restarted,
  started, or killed by this packet; work paused/pivoted to a fixture rig during the
  outages and resumed live sweeps once the coordinator confirmed it stable (tracked
  long-running task, PID 9512).
- Frontend: `VITE_API_TARGET=http://127.0.0.1:3001 VITE_API_URL= npx vite --port 4501
  --strictPort`, started manually (no server was already on :4501; `.claude/launch.json`
  entry `case-workspace-wave-c4-deliverable-open-return` referenced this exact command).
- Auth: real `POST /api/auth/login` (`cw.local@local.test` / `CaseWorkspaceLocal!2026`),
  token placed in `localStorage['token']` exactly as `tokenService.ts` reads it.
- Case under test: `case-b9a5b56c-0652-4931-9594-13fb683c18ed` ("Transformacja 06b70681"),
  same case used by the earlier E5/F1 packets, so results are directly comparable.
- Theme switching: **never** `classList.toggle` alone. Theme lives in
  `localStorage['consultify-storage'].state.theme` (zustand persist, `APP_STORE_KEY =
  'consultify-storage'`, default `'dark'`, see `src/store/slices/uiSlice.ts:141` and
  `src/App.tsx:187-207`). Every theme change in this session was: write `state.theme` in
  localStorage → `location.reload()` (full document reload, not a client-side route
  change) → wait for the app to re-mount and re-read the store → THEN measure. This is the
  exact failure mode the task brief warned about (classList toggle → stale
  `getComputedStyle`), and it was avoided throughout.
- axe scope: **`axe.run(document, ...)` (whole document), not scoped**, for the final
  reported numbers below — see §3 for why an early scoped run was needed once, and why the
  final numbers are unscoped.

## 2. Gap 1 — reproduction attempt on the 3 named elements

### 2a. Source of each element (found by live DOM inspection, then confirmed in source)

| Element | File | Lines | Classes (real, copy-pasted from source) |
|---|---|---|---|
| Org-avatar chip ("CW") | `src/components/layout/UserProfileMenu.tsx` | 262, 270 | outer: `w-8 h-8 rounded-full bg-transparent border border-slate-300 dark:border-navy-600 ...`; inner (the text node): `w-full h-full rounded-full bg-transparent flex items-center justify-center text-[11px] font-medium text-slate-500 dark:text-slate-400` |
| Header bar (avatar's real ancestor bg) | `src/layouts/MainLayout.tsx` | 330 | `relative z-50 h-12 border-b border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-900 shadow-sm dark:shadow-none ...` — **opaque**, no transparency modifier |
| "Wczytaj ponownie" / "Wróć do listy zleceń" | `src/components/CaseWorkspace/CaseDetailScreen.tsx` | 1206, 1213 | rendered via `PreviewActionBar` with `colorScheme: 'neutral'` |
| Button pill classes | `src/components/shared/PreviewPane/previewStyles.ts` | 13-14, 60-61 | `PREVIEW_PILL_BASE` + `COLOR_MAP.neutral`: `border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 ...` |
| Right panel (buttons' real ancestor bg) | `src/components/standard/ArtifactRightPanel.tsx` | 311 | `shrink-0 h-full overflow-y-auto bg-c-surface border-l border-c-border-subtle` — **opaque** (`--c-surface: #ffffff` light / `#0f172a` navy-900 dark, `src/index.css:48,260`) |

**All three elements are OUTSIDE the L3 allowlist** (`MainLayout.tsx`, `UserProfileMenu.tsx`,
`previewStyles.ts`, `ArtifactRightPanel.tsx` are all shared/global chrome, not
`CaseWorkspace/**` or `NModeLayout/**`). If a real failure had been found, it would have
needed to be reported as a patch for the owning packet, not fixed here — same situation the
earlier F1/F2 packets were in for `BottomNavigation.tsx` and `NModeHeader.tsx`.

### 2b. Live measurement — real computed values, real composed backgrounds, both themes

Read via `getComputedStyle` on the actual mounted DOM (real backend, real case, real
login), walking the ancestor chain to the first **opaque** background (the "composed
background" the task brief requires, not a token read in isolation):

| Element | Theme | fg (declared, live) | composed bg (live, opaque ancestor) | Contrast | AA floor | Result |
|---|---|---|---|---|---|---|
| Avatar chip | dark | `rgb(148,163,184)` (slate-400) | `rgb(15,23,42)` (navy-900, `MainLayout.tsx:330`) | **6.97:1** | 4.5:1 | PASS |
| Avatar chip | light | `rgb(100,116,139)` (slate-500) | `rgb(255,255,255)` (white, same header) | **4.76:1** | 4.5:1 | PASS (thin margin, ~0.26 over floor — see §2c) |
| Wczytaj ponownie / Wróć do listy zleceń | dark | `rgb(226,232,240)` (slate-200) | `rgb(15,23,42)`\* → composited with the button's own `bg-white/[0.04]` = `rgb(25,32,51)` | **12.08:1** | 4.5:1 | PASS |
| Wczytaj ponownie / Wróć do listy zleceń | light | `rgb(51,65,85)` (slate-700) | `rgb(255,255,255)` composited with `bg-white/70` = `rgb(255,255,255)` (white-on-white, unchanged) | **10.35:1** | 4.5:1 | PASS |

\* The `<aside>` (`ArtifactRightPanel.tsx:311`) is the real opaque ancestor
(`getComputedStyle` confirmed `background-color: rgb(15, 23, 42)` / `rgb(255, 255, 255)`
directly on that element, walking up from the button through 6 transparent layers first).

Cross-checked with a live, element-scoped `axe.run()` on the avatar button specifically:
**0 violations**. Cross-checked with a full, unscoped `axe.run(document, ...)` at every one
of the 7 widths in both themes on the Plan tab (the tab both buttons and the avatar are
visible on): **0 critical, 0 serious** at all 14 cells (full table in §4).

### 2c. Light-theme detail screen — a real measurement, not an extrapolation

The coordinator specifically flagged the light-theme detail screen as a cell that "deserves
a real measurement, not an extrapolation" because the 4.76:1 avatar margin is thin. This WAS
reached and measured live: full reload into light theme, real case loaded successfully
(confirmed via screenshot — white background, "CW" avatar visible, "Wczytaj ponownie"/"Wróć
do listy zleceń" buttons visible, real plan content), then:
```
avatarColor: "rgb(100, 116, 139)"
avatarComposedBg: "rgb(255, 255, 255)"   (walked from the live DOM, real ancestor bg-white)
```
→ 4.76:1, confirmed live, not inferred from the dark-theme reading. (One earlier attempt at
this same reload landed on an error boundary because the backend died mid-load — that
attempt is explicitly NOT the one being reported here; this one succeeded cleanly, backend
up throughout.)

### 2d. Standalone, backend-independent cross-check (fixture)

`fixture.html` in this directory reproduces the exact class strings from §2a (byte-copied
from source, not retyped from memory) with the exact real ancestor backgrounds, compiled
with the project's real `tailwind.config.js` + `src/index.css` (`build.sh`), measured with
Playwright + pixel-sampling (`measure.cjs`, same lineage as
`f2-bottomnav-contrast-2026-08-12/measure.cjs`). Results (`results.json`):

| Element | Theme | fg | composed bg (pixel-sampled) | Contrast | Result |
|---|---|---|---|---|---|
| avatar-chip | light | rgb(100,116,139) | rgb(255,255,255) | 4.76:1 | PASS |
| avatar-chip | dark | rgb(148,163,184) | rgb(43,50,67)\*\* | 4.99:1 | PASS |
| btn-reload / btn-back | light | rgb(51,65,85) | rgb(255,255,255) | 10.35:1 | PASS |
| btn-reload / btn-back | dark | rgb(226,232,240) | rgb(15,23,42) | 14.48:1 | PASS |

axe-core 4.10.2 on the fixture: **0 violations, both themes.**

\*\* The dark-theme avatar's pixel-sampled bg (43,50,67) differs slightly from the live
DOM's `getComputedStyle` reading (15,23,42) — the sample point (2px from the circle's
corner) likely catches a sliver of the `border-slate-300 dark:border-navy-600` ring
anti-aliasing into the transparent interior in the static fixture. This does **not** change
the conclusion (contrast is *higher*, not lower, with this bg — 4.99 vs the live 6.97 both
clear the 4.5 floor by a comfortable margin); noted here rather than silently smoothed over,
per the instruction to prove artifacts rather than paper over them.

### 2e. Conclusion on Gap 1

**Could not reproduce a serious color-contrast finding on any of the 3 named elements**, in
any theme, at any width reached, using three independent methods (live getComputedStyle
math on real composed backgrounds, live axe-core, and a static backend-independent
fixture). The earlier finding this task was built on (`f1-back-button-a11y-2026-08-12/01_FIX_AND_AXE_EVIDENCE.md`
§4) explicitly caveated itself: *"the exact color-contrast node counts on any single cell
should be read as 'a serious finding was present, roughly this size, unrelated to the back
button' rather than a precise, race-free count"* — that packet's own session had a
documented race condition (a concurrent packet sharing the same browser tab, an unrequested
resize landing mid-sweep). The most likely explanation, given §3's finding below, is that
the earlier sweep caught the same animation-artifact class of false-positive this program
has been bitten by before (E5's own documented mid-fade contrast artifacts), just on
different elements that happened to be visible at that moment — not a real, reproducible
defect on these 3 elements. The coordinator reviewed this evidence and corrected the record
upstream (see cross-session log) — flagging it explicitly here too since the instructions
require a truthful negative, not silence.

## 3. A real (but unrelated) animation artifact, found and isolated

Running `axe.run(document, ...)` immediately after a case-detail page load produced a burst
of `color-contrast` violations (10 nodes, e.g. `<h2>Do czego dążymy</h2>` reading
1.5:1–3.5:1) on content that visually rendered fine. Inspection showed the affected
elements' inline `style="opacity: 0; transform: ..."` — a framer-motion entrance animation
mid-flight. Unlike E5's documented case (settles after ~2-3s), one instance (a sidebar "77"
badge counter, `src/layouts/MainLayout.tsx` region — **unrelated to Case Workspace**, global
chrome) kept **perpetually restarting**: `element.getAnimations()[0].currentTime` reset to
~57ms on repeated checks even after calling `.finish()` on it, well past 2-3s of wall time.

Response: scoped one exploratory `axe.run()` to `[data-testid="zlecenie-szczegol"]` (the
`CaseDetailScreen` root, `CaseDetailScreen.tsx:1417`) to confirm the violations were
entirely outside that root — they were (0 violations scoped vs. 10 unscoped). Then, for all
56 matrix cells reported in §4, the actual method used was: call
`document.getAnimations().forEach(a => a.finish())` + a settle wait (300-400ms) immediately
before each `axe.run(document, ...)`, which reliably resolved the Case-Workspace-tree
animations (confirmed: the burst of violations disappeared) even though the unrelated
sidebar badge's own spring kept resetting. **The scoping was exploratory/diagnostic only —
every number in §4 is from an UNSCOPED, full-document `axe.run()`,** so nothing is hidden by
scope; the animation handling is what keeps the numbers real instead of transient.

## 4. Gap 2 — full matrix, all 4 surfaces, all widths, both themes

Method: resize → (on theme change only) write `localStorage['consultify-storage'].state.theme`
+ `location.reload()` + wait for real re-mount → `document.getAnimations().forEach(a =>
a.finish())` + 300-400ms settle → `axe.run(document, {resultTypes:['violations']})`
(unscoped, all rules, not just color-contrast). Real backend, real case, real login
throughout (once the coordinator's PID-9512 backend came up and stayed stable).

| Surface | Route param | Width | Theme | Critical | Serious | Moderate |
|---|---|---|---|---|---|---|
| List (`CasesListScreen`) | `/zlecenia` | 320/375/430/768/1024/1440/1920 | dark | 0 | 0 | 2 |
| List | `/zlecenia` | 320/375/430/768/1024/1440/1920 | light | 0 | 0 | 2 |
| Detail/Plan | `?zakladka=plan` | 320/375/430/768 | dark | 0 | 0 | 2 |
| Detail/Plan | `?zakladka=plan` | 1024/1440/1920 | dark | 0 | 0 | 3 |
| Detail/Plan | `?zakladka=plan` | 320/375/430/768 | light | 0 | 0 | 2 |
| Detail/Plan | `?zakladka=plan` | 1024/1440/1920 | light | 0 | 0 | 3 |
| Detail/Realizacja | `?zakladka=realizacja` | 320/375/430/768 | dark | 0 | 0 | 2 |
| Detail/Realizacja | `?zakladka=realizacja` | 1024/1440/1920 | dark | 0 | 0 | 3 |
| Detail/Realizacja | `?zakladka=realizacja` | 320/375/430/768 | light | 0 | 0 | 2 |
| Detail/Realizacja | `?zakladka=realizacja` | 1024/1440/1920 | light | 0 | 0 | 3 |
| Detail/Rezultaty | `?zakladka=rezultaty` | 320/375/430/768 | dark | 0 | 0 | 2 |
| Detail/Rezultaty | `?zakladka=rezultaty` | 1024/1440/1920 | dark | 0 | 0 | 3 |
| Detail/Rezultaty | `?zakladka=rezultaty` | 320/375/430/768 | light | 0 | 0 | 2 |
| Detail/Rezultaty | `?zakladka=rezultaty` | 1024/1440/1920 | light | 0 | 0 | 3 |

**56/56 cells: 0 critical, 0 serious.** (Individual cell values were captured live one at a
time — collapsed here by width-band since every cell in a band returned the identical
moderate-only result: `page-has-heading-one` + `region` below 1024px, plus
`landmark-unique` from 1024px up, all already documented as pre-existing moderate findings
in `e5-a11y-matrix-2026-08-12/01_WIDTH_THEME_AXE_MATRIX.md` — not new, not gating per the
task's "critical/serious" bar.)

Realizacja and Rezultaty (Gap 2) now have axe coverage for the first time, across the full
7x2 matrix each, with real rendered content confirmed by screenshot at each tab switch
(not a loading/error state) — see the screenshots taken during this session for "Co się
teraz dzieje" / "Na co czekamy" / "Sprawy do zatwierdzenia" (Realizacja) and "Czy zlecenie
jest domknięte" / "Wyniki wykonania kroków" (Rezultaty).

## 5. What was changed

**Nothing in `src/`.** No serious or critical finding was reproduced inside the L3
allowlist or on the 3 named Gap-1 elements (which live outside the allowlist anyway). Per
the task's own instruction — "a truthful 'one serious finding remains' is worth more than a
claimed zero I cannot trust" — the inverse also holds: forcing an unnecessary edit to a
file that isn't broken, just to have something to show, would be less trustworthy than
reporting the honest negative with the measurements to back it up.

`git status --short` at the end of this session: only this evidence directory is new;
zero other files touched.

## 6. Limits — what this does NOT prove

- This covers ONE case (`case-b9a5b56c-...`, profile TRANSFORMATION, status "W toku").
  Different case profiles (LIGHT, EXPERT) or statuses (Szkic/Draft, Zablokowane/Blocked,
  Zakończone/Done) could render different right-panel button sets (e.g.
  `pokazZatwierdzIRozpocznij` adds a "Zatwierdź i rozpocznij" primary button for
  DRAFT/ACTIVE LIGHT cases — not exercised here) or different error states (the "Nie udało
  się wczytać danych" / "Spróbuj ponownie" error-boundary variant was seen once, by
  accident, when the backend died mid-reload — its buttons were NOT part of this sweep's
  target set and were not separately measured).
- Hover/focus/active pseudo-states on the 3 named elements were not separately measured
  (only resting state).
- No VoiceOver/screen-reader pass (consistent with prior packets in this program — enabling
  it is a real macOS Accessibility setting change, out of bounds for an unattended
  session).
- The animation-artifact class described in §3 means a *naive*, single-shot
  `axe.run(document)` immediately after navigation can still produce phantom findings on
  this app; anyone re-running this sweep needs the same settle-and-finish-animations step,
  or they will see false serious/critical results that are not real.

## 7. Typecheck

`NODE_OPTIONS="--max-old-space-size=8192" ./node_modules/.bin/tsc --noEmit`, started in the
background. See the session's final report for the observed EXIT code (trust the exit code,
not silence — this check has OOM-crashed and looked like success before).

## Files

- `fixture.html` — real markup/classes for the 3 Gap-1 elements + their real ancestor
  backgrounds.
- `build.sh` / `package.json` — isolated build (real Tailwind compile + local axe-core,
  never touches repo root's shared `node_modules`/lockfile).
- `measure.cjs` — Playwright + pngjs measurement script.
- `results.json` — raw output.
- `compiled.css` — generated by `build.sh` (gitignored via the standard build-artifact
  pattern used by sibling evidence dirs — regenerate with `./build.sh`, don't hand-edit).
