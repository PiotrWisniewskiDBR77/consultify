# RN-G5 — ROI / OKR full-tool deep links (2026-08-12)

## Problem

`routeConfig.ts` reserved two routes that were never mounted:

```
RESULTS_ROI.CASE = '/results/roi/cases/:roiCaseId'
RESULTS_OKR.SET  = '/results/okr/sets/:okrSetId'
```

`grep -rn "RESULTS_ROI.CASE\|RESULTS_OKR.SET" src/` returned zero hits outside
`routeConfig.ts` itself — no `<Route>`, no `navigate()`, no `<Link>`. The real
full-tool screens (`RoiCaseFullTool`, `OkrSetWorkspace`) were reachable only
by first loading the registry and clicking a row: local `useState`
(`ResultsRoiHub.tsx`'s `modelCase`, `ResultsOkrHub.tsx`'s `drill.level ===
'workspace'`), lost on reload, unreachable by direct URL, unreachable from a
Teresa link or a notification.

`RN_G2_UI_SCOPE.md` §H's persistence-across-cold-reopen requirement is
explicit: *"a deep link to a specific KPI/ROI-case/OKR-set opens the right
record after a fresh load, not just client-side navigation."* KPI already
satisfies this (`ROUTES.RESULTS_KPI.TOOL`, `KpiToolPage.tsx`). ROI and OKR
did not — structurally could not, with no route to land on.

## Why this was previously deferred, and why that reason is gone

`RoiCaseFullTool.tsx`'s original header (RN-G2 §G #12-14 era) declined to add
a route because `RN_G2_UI_SCOPE.md` §G Open Question #2 — "is the full tool
klasa S (a rich preview) or klasa L (its own screen)?" — was still open, and
minting a route would have silently pre-decided it.

That question is closed. `RESUME_HANDOFF_2026-08-11.md` §7 records decision
**D03**: *"pełne narzędzia to klasa L, żadnych wielkich edytorów w
podglądzie"* — full tools are klasa L, no big editors in a preview. A route
no longer pre-decides anything; it implements an already-made decision.
`routeConfig.ts` already reserved the exact two paths master plan §11 named —
this package mounts them, it does not invent a new shape.

## What changed

1. **Routes mounted** (`src/routes/AppRoutes.tsx`): `ROUTES.RESULTS_ROI.CASE`
   → `RoiCaseToolPage`, `ROUTES.RESULTS_OKR.SET` → `OkrSetToolPage`. Same
   entitlement chain (`BetaGate MODULE_BENEFITS` → `ProductionModuleGate` →
   `RouteErrorBoundary`) and the same per-domain flag gate
   (`roiRegistry`/`okrRegistry`) the sibling ROOT/TOOL routes already use —
   nothing new invented, both flags stay default OFF.

2. **Load-by-id added where it didn't exist**
   (`src/components/ResultsVNext/roi/roiApi.ts`): `getRoiCase(caseId)`. The
   server route (`GET /vnext/results/roi/cases/:caseId`, `roi.routes.ts`)
   already existed and was already org-scoped + `includeArchived: true` — no
   client wrapper called it before this package (the registry's own
   lazy per-row fetches only ever needed `listRoiCases`/
   `getLatestRoiCalculationRun`, never the single-case GET). **No server
   change.**

   OKR needed no equivalent addition: `getOkrSet(setId)` already existed
   (`okrApi.ts`), used by `ResultsOkrHub.tsx`'s pre-existing `?setId=`
   query-param deep link. `OkrSetToolPage` reuses that exact function.

3. **New page components** — `RoiCaseToolPage.tsx` / `OkrSetToolPage.tsx`
   (both new files, mirroring `kpiTool/KpiToolPage.tsx` byte-for-byte for
   loading/error/forbidden shape): read the id from `useParams`, fetch the
   full record, and render the existing full-tool component
   (`RoiCaseFullTool`/`OkrSetWorkspace`) — both of which already take an
   ALREADY-LOADED object as a prop, not an id, because their only caller
   before this package was a registry row click. This is the "did the full
   tool component already know how to load from a bare id?" answer: **no,
   for both** — the load-by-id path lives entirely in these two new page
   components, not inside the tool components themselves (which stay
   unmodified, still row-driven when opened from the registry-side
   `onModel`/`onOpenWorkspace` navigation — see next point).

4. **Registry → tool is now real navigation**
   (`ResultsRoiHub.tsx`/`ResultsOkrHub.tsx`): the row-menu "Open full tool" /
   "Otwórz obszar roboczy" actions now `navigate()` to the route instead of
   flipping local state. `ResultsRoiHub.tsx`'s `modelCase` state and its
   early-return branch are deleted entirely; `ResultsOkrHub.tsx`'s
   `OkrDrill` union drops the `'workspace'` member (the
   `'objectives'|'keyResults'|'checkIns'` breadcrumb-drill levels are
   untouched — they were never part of Open Question #2).

5. **Return-context preservation.** Navigating to the full tool and back
   unmounts/remounts the Hub (different `<Route>`s) — plain `useState` for
   `tab`/chip filter/selected-row id would silently reset on return.
   Restored from / persisted to `sessionStorage` under
   `results-vnext.roi-registry.ui-state` /
   `results-vnext.okr-registry.ui-state` — **one key per surface**, never a
   per-record key (D09's warning about `persistKey` extends in spirit to
   this new mechanism too). `sessionStorage`, not `localStorage`: this is
   transient "where was I" navigation context, not a durable user
   preference. Table column order/width/visibility keep using the
   pre-existing `persistKey` (`results-vnext.roi-registry` /
   `results-vnext.okr-registry.<tab>`) — **unchanged**, that mechanism
   already survives remounts via `localStorage` and was never the gap.

   OKR-specific fix needed alongside this: `ResultsOkrHub.tsx`'s tab-switch
   effect unconditionally called `setSelectedSetId(null)` on every run,
   including the very first (mount) run — which would have immediately
   discarded a just-restored selection before the list even loaded. Guarded
   with an `isInitialTabEffect` ref so only a genuine user-initiated tab
   switch clears the selection, not the initial restore.

6. **OKR Programs/Cycles discoverability.** `ROUTES.RESULTS_OKR.PROGRAMS`/
   `.CYCLES` were already mounted, real, working routes with **zero** links
   to them anywhere in the app (confirmed by the same
   `RESULTS_OKR.PROGRAMS\|RESULTS_OKR.CYCLES` grep that found the dead
   `RESULTS_ROI.CASE`/`RESULTS_OKR.SET` constants — these two were reachable
   by URL but not discoverable by clicking anything). Added two ghost/
   secondary `Button`s (`primaryCtaContent` — `StandardModuleBar`'s
   documented escape hatch for "more than one CTA-area element", same slot
   `FullROIView.tsx` already uses for a `navigate()`-driven button) to the
   OKR Sets registry's Menu 2 bar. Neutral variants only — `brand` (crimson)
   stays reserved for actual brand moments per `VISUAL_STANDARD.md` §5.1.

## Deny-reason honesty (D06/D07)

Both `getRoiCase` and `getOkrSet` collapse "does not exist" and "exists but
in a different organization" into the identical 404 → the identical
`NO_VISIBILITY_RECORD` forbidden state, client-side. Neither page can
distinguish the two cases because the server does not tell it which one
happened — the server-side query is itself organization-scoped, so a
cross-org id simply returns no row, structurally indistinguishable from a
row that was never created. This is not a shortcut; it is the same
fail-closed default `RN_G1_PLATFORM_DESIGN.md` §B already documents and
`kpiApi.ts`'s `getKpi` already established as precedent — confirming
existence to a caller who cannot see a record would itself be a disclosure.

## What this does NOT change

- The four ROI phase workspaces (`RoiCaseModelWorkspace` /
  `RoiCaseDecisionWorkspace` / `RoiCaseRealizeValueWorkspace` /
  `RoiCaseLearnWorkspace`) and the six OKR workspace tabs
  (`OkrSetOverviewView` / objectives drill / `OkrAlignmentsView` /
  `OkrSupportView` / `OkrReviewReflectionView` / `OkrHistoryView`) are
  unmodified — they still take an already-loaded case/set object, exactly as
  before.
- The pre-existing OKR `?setId=` query-param deep link on `/results/okr`
  (select+preview a row in the Sets list) is unchanged and untouched — it is
  a different mechanism from the new path-param route (which opens the full
  workspace, not just a preview).
- No server file was touched. `getRoiCase`'s server route already existed;
  `getOkrSet`'s server route already existed.
