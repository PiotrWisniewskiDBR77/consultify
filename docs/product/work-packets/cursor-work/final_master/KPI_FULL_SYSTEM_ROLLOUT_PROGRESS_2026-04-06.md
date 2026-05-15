# KPI Full-System Rollout Progress

Date: 2026-04-06
Owner: Product + Engineering
Status: active implementation snapshot

## Scope closed in this rollout slice

### 1. Documentation and SSOT

- Added `docs/product/KPI_FULL_SYSTEM_CANON_V8.md` as the cross-module KPI canon.
- Updated `DOCUMENTATION_REGISTRY.md` to register the KPI full-system canon and tighten authority split for Results and Finance linkage docs.
- Updated `RESULTS_V8_SSOT.md`, `RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`, and `REPORTING_CANONICAL_TEMPLATES.md` to align on:
  - initiative-centric KPI context,
  - `Initiatives / KPI / Reporting` cockpit IA,
  - template-first reporting,
  - AI as reasoning support only.
- Added historical interpretation notes to:
  - `FINAL_IMPLEMENTATION_PLAN_04_KPI_2026-03-29.md`
  - `WAVE1_FINAL_IMPLEMENTATION_PLAN_KPI_2026-03-29.md`
  - `POST_V81_BACKLOG_TRACKER.md`

### 2. Canonical KPI contract

- Extended frontend KPI types in `src/types/core.ts` with:
  - `mappingId`
  - `definitionSource`
  - `observationPhase`
  - tracked flags
  - phase expectations
- Extended V8 planning KPI read type in `src/services/api/v8/planning.ts` to match the richer initiative assignment runtime.
- Added `src/components/Initiatives/initiativeKpiContract.ts` to normalize V8 and legacy initiative KPI reads into one frontend contract.
- Rewired KPI read consumers to use the shared contract:
  - `InitiativeDocumentView.tsx`
  - `KpisSection.tsx`
  - `BenefitsHub.tsx`

### 3. Initiative KPI authoring

- Added a real create flow inside `InitiativeDocumentView.tsx`:
  - `manual KPI`
  - `link existing KPI`
- The initiative authoring flow now supports:
  - source selection
  - phase selection
  - realization target
  - post-implementation target
  - cadence
  - baseline
- Added visual source labeling in the initiative KPI table (`manual` vs `linked`).
- Updated initiative template apply flow in `server/src/routes/pmo/initiatives.routes.ts` so suggested KPI creation goes through `upsertInitiativeKpiAssignment()` instead of a raw insert that bypassed the mapping runtime.

### 4. Results cockpit, measurement, and reporting

- Enriched KPI preview in `ResultsKpisTableV3.tsx` with:
  - source visibility
  - observation phase visibility
  - realization target visibility
  - post-implementation target visibility
  - needs-entry signal in preview metadata
- Enriched `KPITimeSeriesDrawer.tsx` with:
  - phase expectation summary
  - freshness visibility
  - clearer audit/source semantics in measurement notes
- Upgraded `ResultsKpiReportsView.tsx` to a more template-first report creation flow:
  - report template selector
  - snapshot scope summary
  - optional AI draft for title and reporting brief
  - template and AI hint stored in report filters when explicitly used

## Validation

Regression command executed:

```bash
npx vitest run tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx tests/components/Results/ResultsKpiReadSurfaces.v8-catalog.test.tsx
```

Result:

- `2` test files passed
- `9` tests passed
- no failures after final fixes

Additional checks:

- `ReadLints` run on all touched frontend/backend files
- no linter errors reported for changed files

## Residual follow-up

- Add dedicated tests for the new initiative KPI create/link panel.
- Extend KPI report list/document surfaces to expose template metadata more explicitly after snapshot creation.
- Add browser proof for the initiative KPI authoring flow and template-seeding flow.
