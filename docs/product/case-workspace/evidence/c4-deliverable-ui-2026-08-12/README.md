# C4 — Deliverable Open/Return UI — live evidence (2026-08-12)

Scenario: Golden Case item 12 ("opening a deliverable in its module" / "returning
to the Case"). Backend contract: `GET /api/v8/case-workspace/artifact-links/:linkId/open`
(`server/src/services/caseWorkspace/artifactLinkService.ts` `resolveArtifactLinkOpen`,
routed in `server/src/routes/caseWorkspace/artifactLinks.routes.ts`).

**Finding at the start of this packet**: the UI wiring (`src/components/CaseWorkspace/RezultatyView.tsx`,
`CaseDetailScreen.tsx`, `types.ts`, `api.ts`) was already fully implemented by a
prior session (commit `be4bb504d9`, "pakiet B5/C4" comments throughout). No
source changes were made in this pass — the work here is exclusively live
verification against the real backend, because no live evidence for this
scenario existed yet.

## Test data (real backend, not mocked)

Case used: `case-94b37954-c4a1-4417-8eed-9edefd570f95` ("Transformacja
cab9cd8b"), org `cw-local-org`. Four `case_workspace_artifact_links` rows
created via the live backend's own mutating endpoints (POST .../artifact-links,
POST .../mark-stale, POST .../mark-unavailable, DELETE .../artifact-links/:id
— i.e. `unlinkArtifactFromCase`), one per state:

| linkId (suffix) | artifactType | relation | how the state was produced | resulting state |
|---|---|---|---|---|
| `ff42e7a0` | decision | DELIVERABLE | left as created | AVAILABLE |
| `47fdc46f` | initiative | OUTPUT | `POST /mark-stale` | STALE |
| `c3454638` | task | EVIDENCE | `POST /mark-unavailable` | UNAVAILABLE |
| `3a98af73` | kpi | DECISION_BASIS | `DELETE` (unlink) | DELETED |

All four `GET .../artifact-links/:linkId/open` responses were pulled directly
and are reproduced in `run-results.json` (`deepLinkResolution`) and were
re-verified via curl before any screenshot was taken.

## Screenshots

- `desktop-dark-four-states-table.png` / `desktop-light-four-states-table.png`
  — the "Powiązane obiekty" table on the Case's Rezultaty tab, 1440×900,
  real theme toggle (profile menu → Theme), all four states visible with
  correct pills (Powiązany/Nieaktualny/Niedostępny/Odpięty) and correct
  Otwórz button state (enabled+warning for STALE, disabled for
  UNAVAILABLE/DELETED, enabled for AVAILABLE).
- `mobile-dark-four-states-table.png` / `mobile-light-four-states-table.png`
  — 390×844, real theme toggle. `mobile-dark-otworz-column-scrolled.png`
  scrolls the table's own horizontal scroller to confirm the Otwórz column
  and all four buttons are reachable on a narrow viewport, not just
  visually cut off.
- `keyboard-01-focused-before-open.png` — the AVAILABLE row's Otwórz button
  focused (Tab-reachable), visible `--c-focus` blue ring.
- `keyboard-02-opened-target-module.png` — after `Enter`, navigated to
  `/my-work?decisionId=c4-evid-decision-0001` (My Work's own URL
  normalization of `getArtifactPath('decision', …)`'s
  `?artifact=decision:...&code=...` — confirmed via `keyboard-results.json`
  `urlAfterOpen`). Screenshot caught My Work still loading (spinner) —
  harmless timing, the URL is the proof, not this frame.
  **Caveat**: `c4-evid-decision-0001` is a synthetic id (never a real
  Decision), so My Work correctly reports "not found" for the object itself
  — that is a My Work concern, out of this packet's scope, and does not
  affect what this evidence is actually proving (that Case Workspace
  dispatches to the right module via the shared `getArtifactPath` helper).
- `keyboard-03-returned-focus-restored.png` — after browser back, the SAME
  Otwórz button (Decyzja row) has the manual blue outline applied by
  `CaseDetailScreen`'s restore effect. `keyboard-results.json` has the full
  trace: `sessionStorage['zlecenia.powrot']` written before navigating away,
  consumed (removed) on return, `document.activeElement` confirmed as that
  exact button with `aria-label="Otwórz obiekt: Decyzja"` and
  `outlineStyle: "solid"`, and the aria-live announcement text
  ("Wróciłeś do zlecenia — kursor stoi przy: Decyzja. Sekcja: rezultaty.")
  captured verbatim.
- `refresh-01-results-tab-survived.png` — hard reload of the Case URL
  (`?zakladka=rezultaty&widok-planu=prosty`) after the round trip: all four
  rows/states render identically post-refresh (`keyboard-results.json`
  `refreshedRows`).
- `deeplink-01-direct-url-fresh-tab.png` / `run-results.json` — opening
  `getArtifactPath('decision', …)`'s URL directly in a brand-new tab with no
  prior Case navigation in its history. Loads (no crash), lands on
  `/my-work` — same synthetic-id caveat as above.

## An intermittent false alarm, and how it was ruled out

Several early automated runs (Playwright, headless) showed focus staying on
`<body>` after the return trip — looked exactly like a P0. Chased it down
with instrumentation before reporting it:

1. First suspected a real race in `CaseDetailScreen`'s
   `requestAnimationFrame`-based restore effect.
2. Checked `document.visibilityState` in the failing runs: **`hidden: true`**.
   Headless Chromium throttles `requestAnimationFrame` on a backgrounded
   document — this alone reproduced the exact symptom.
3. Re-ran with `headless: false` (a real, foregrounded window,
   `visibilityState: "visible"`): focus landed correctly at ~1.8s
   (`focus-repro-CLEAN-SUCCESS.log`).
4. Later `headless:false` re-runs on this SAME shared dev box *still*
   intermittently failed — but this time `sessionStorage` instrumentation
   showed the restore effect never even reached its `wyczyscStanPowrotu()`
   call, and the target button was verifiably **absent from the DOM**
   (`keyboard-03` screenshot from that run shows the Rezultaty tab's
   skeleton/loading state, not real data). This machine runs many
   concurrent Claude Code agent sessions (`ps aux` showed 300+ node
   processes and several other parallel `tsc --noEmit` runs during this
   packet); the Case bundle's 8-parallel-endpoint fetch simply hadn't
   finished within the wait window — not a focus-restore bug.
5. Final clean run (`capture-keyboard.mjs`, saved as `keyboard-results.json`)
   succeeded fully end-to-end with full instrumentation: write → consume →
   focus → announcement, all confirmed.

Net: the mechanism is correct. The environment noise was real and is
documented here rather than silently discarded, per this repo's "measure,
don't round up" rule.

## Scripts (kept for reproducibility)

`capture.mjs` (original 4-state pass), `capture-theme-fix.mjs` (real
profile-menu theme toggle — a localStorage-write-then-reload shortcut was
tried first and silently failed to flip `<html class="dark">`, most likely
because the app's zustand-persist storage adapter debounces/schedules
writes rather than using the default synchronous `localStorage` adapter),
`capture-keyboard.mjs` (keyboard open/return/refresh), `capture-mobile-scroll.mjs`,
`focus-repro.mjs` (the isolated headless-vs-headed diagnostic).
