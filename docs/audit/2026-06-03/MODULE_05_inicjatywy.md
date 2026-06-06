# Module 05 — Inicjatywy — Readiness Scorecard

**Readiness: 74/100 — Tier: Beta  |  Baseline: 58/100 — Delta: +16**
**Route(s):** `/initiatives`, `/portfolio`, `/roadmap` (→ redirect), `/roi`
**One-line verdict:** Three of the four prior blockers are resolved: FullROIView is now a real ModuleHub dashboard, /roadmap redirects cleanly to /portfolio, and the initiative-generator is promoted to a production-live real mount with a backing migration. Remaining gaps: GapAnalysisDashboard uses raw `alert()` for generator feedback, the generator POST only stubs title (no real AI call), and frontend test coverage is shallow smoke-only.

---

## Readiness delta — what changed since 58/100

| Gap (2026-06-02) | Status now | Evidence |
|---|---|---|
| `/roi` = "Under Construction" stub | **FIXED** — real ModuleHub dashboard | `src/views/FullROIView.tsx:1-490` — full KPI cards, table, scenario compare, real `Api.getEconomicsAnalyses()` call |
| `/roadmap` — deprecated view still mounted | **FIXED** — hard redirect | `src/routes/AppRoutes.tsx:1682` — `<Navigate to={ROUTES.PORTFOLIO} replace />` |
| `FullRoadmapView` still referenced | **FIXED** — not imported | `src/routes/AppRoutes.tsx:88-89` — explicit comment + import omitted |
| Generator blocked by `mountStub` in prod | **FIXED** — real mount | `server/src/Gateway.ts:758-768` — `app.use('/api/initiative-generator', gatewayVerifyToken, trialEntryGuard, initiativeGeneratorRoutes)` |
| `generated_initiatives` table missing | **FIXED** — migration added | `server/migrations/20260603_generated_initiatives.sql:20-38` — `CREATE TABLE IF NOT EXISTS generated_initiatives` |
| Zero frontend tests | **PARTIAL** — two smoke tests added | `src/components/Initiatives/__tests__/InitiativesHub.smoke.test.tsx`, `Analysis/__tests__/PortfolioAnalysisView.smoke.test.tsx` — mount + empty-state only |
| Zero backend generator tests | **FIXED** | `server/src/routes/__tests__/initiative-generator.routes.test.ts` — list/generate/update covered |

---

## Functionality

**REAL and wired:**
- `FullROIView`: fetches `GET /api/economics/analyses`, maps `npv`, `roi_percent`, `payback_months`; renders KPI cards (Portfolio ROI, NPV, Payback, count); table view sorted by NPV desc; scenario compare toggle; loading/error/empty states all implemented (`src/views/FullROIView.tsx:149-181`).
- Initiative generator: `POST /api/initiative-generator/generate` is live in production with auth guards; `Api.generateInitiatives()` at `src/services/api.ts:8981`; `handleGenerateWithTeresa` at `InitiativesHub.tsx:1487` calls it and refreshes portfolio on success.
- `/roadmap` redirect: deterministic — no old view code is reachable.
- Demo data (Atelier Toys): ROI view shows 3 demo analyses when `shouldAllowDemoData()` and list is empty (`FullROIView.tsx:166`). Does not pollute real sessions.

**MOCK / stub quality:**
- Generator POST creates a row titled `'AI Generated Initiative'` with `description = JSON.stringify(context)` — no LLM call, no Teresa integration behind the endpoint (`initiative-generator.routes.ts:46-57`). UI succeeds but no real AI content is generated.
- `GapAnalysisDashboard.generateInitiatives()` calls `/api/initiatives/generate-from-assessments` (axios, `GapAnalysisDashboard.tsx:63`) — **this endpoint does not exist** in any server route file; it will 404 silently. Uses bare `alert()` for success/error feedback (`GapAnalysisDashboard.tsx:68,71`).

**BROKEN / NO_GO:**
- `GapAnalysisDashboard` → `generate-from-assessments` is a dangling 404 path with `alert()` UX — regression from the pre-wave baseline.
- Generator PUT (`/:id`) cannot update `estimated_impact` (not in allowed fields, `initiative-generator.routes.ts:63-88`); GET returns it but it can never be set via this router.

---

## Intra-module flow & states

- Empty portfolio → honest `EmptyState` with "Create First Initiative" CTA. Confirmed in smoke test.
- Loading → skeleton pulse (ROI) and spinner (InitiativesHub) — both implemented.
- Error → `ErrorState` with retry in ROI (`FullROIView.tsx:371-384`); InitiativesHub falls back to demo data on error when flag is set.
- Generator success: `toast.success` + portfolio refresh (`InitiativesHub.tsx:1497-1499`). Generator error: `toast.error`. No dead-end.
- No DELETE endpoint on `generated_initiatives` — drafts can never be removed.

---

## UI/UX adherence

- `FullROIView`: `ModuleHub` shell (line 456), crimson/navy tokens (`bg-crimson-50`, `text-crimson-600`, `text-navy-900`), `rounded-2xl`/`rounded-xl` cards — fully consistent.
- `InitiativesHub`: `ModuleHub` shell (line 1672 per baseline, unchanged), no `@ts-nocheck`.
- `FullRoadmapView`: dead/unreachable — no UX concern.
- Teresa badge rendered on every KPI card (`FullROIView.tsx:118`) — consistent with AI-hint pattern.

---

## Cross-module handoffs

- **Insights/Tools → Initiatives**: `useAssessmentAI.generateInitiatives` (`src/hooks/useAssessmentAI.ts:396`) and `DiscoveryToolsHub.tsx:4673` both call `Api.generateInitiatives()` (correct endpoint). `GapAnalysisDashboard` uses a **different, non-existent** `/api/initiatives/generate-from-assessments` path — broken handoff.
- **Initiatives → Results**: `hasExecutingInitiative` useMemo at `InitiativesHub.tsx:1506`; "View Results" CTA navigates to `ROUTES.BENEFITS` (`InitiativesHub.tsx:1530`); `ROUTES.BENEFITS = '/benefits'` is mounted (`AppRoutes.tsx:2083`). Handoff is live.
- **ROI ↔ Economics**: `FullROIView` reads economics analyses; the "Go to Portfolio" CTA (`FullROIView.tsx:479`) navigates to `/portfolio` — correct round-trip.

---

## Risks / regressions / runtime

1. **`GapAnalysisDashboard` → 404 generator path** (`GapAnalysisDashboard.tsx:63`): `POST /api/initiatives/generate-from-assessments` has no matching server route. Silent fail + `alert()` is a regression.
2. **Generator stub-only AI**: `/api/initiative-generator/generate` persists a row but does not call any LLM. Teresa button succeeds but produces no useful output for the user.
3. **No DELETE on `generated_initiatives`**: drafts accumulate forever; no cleanup path.
4. **`estimated_impact` read-only via generator router**: selected in GET but excluded from PUT field list — schema/API mismatch.
5. **Shallow smoke tests only**: `InitiativesHub.smoke.test.tsx` asserts mount + empty state; no card lifecycle, no wizard, no Kanban/Grid/Timeline/Matrix view tests.
6. **ROI `any` casts**: `FullROIView.tsx:156` maps `(a: any)` — economics API response shape is not type-safe; field-name drift (e.g., `financial_npv` vs `npv`) handled by conditional chaining but not validated.

---

## Top gaps to reach market-ready (prioritized)

1. **Fix GapAnalysisDashboard generator path** — replace `/api/initiatives/generate-from-assessments` with `/api/initiative-generator/generate` and replace `alert()` with `toast`. (`GapAnalysisDashboard.tsx:63,68,71`)
2. **Wire real AI into generator POST** — `initiative-generator.routes.ts:46-57` currently saves a stub title; connect Teresa/LLM to produce real initiative drafts.
3. **Add DELETE to generator router + `estimated_impact` to PUT** — clean up orphan drafts; fix schema mismatch.
4. **Expand frontend tests** — Kanban, Grid, Timeline, Matrix views; card lifecycle (create → update → status change); wizard happy-path.
5. **Type-safe economics API** — define response interface; remove `(a: any)` cast in FullROIView.
