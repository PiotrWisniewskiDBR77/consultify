# 529 - V8.1 KPI must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `KPI` / `Results` must-have closure - shared results truth refresh contract

## Problem before closeout

- `ResultsHub`, `ResultsSummaryView`, and `OperationalAnalysisView` each maintained partially separate refresh lifecycles.
- KPI create/update/measurement flows could refresh one surface while leaving another stale:
  - hub runtime chips,
  - KPI table/grid,
  - summary cards,
  - KPI drawers,
  - ROI chip/readback.
- Some KPI write paths still failed silently, making stale truth look like “no data”.

## What landed

### 1. Shared results truth refresh contract

- `src/components/Results/ResultsHub.tsx`
  - added a shared `refreshResultsTruth()` flow,
  - refreshes both:
    - KPI catalog truth,
    - governed dashboard snapshot truth,
  - propagates refresh to summary/ROI surfaces through refresh nonces.

### 2. ResultsSummary now aligns with hub snapshot truth

- `src/components/Results/ResultsSummaryView.tsx`
  - accepts governed snapshot from the hub,
  - refreshes on hub nonce,
  - no longer relies on an independently drifting snapshot lifecycle when embedded in `ResultsHub`,
  - uses the shared truth refresh callback after KPI create and ROI save.

### 3. Operational KPI analysis no longer needs its own competing fetch path

- `src/components/Results/OperationalAnalysisView.tsx`
  - supports controlled KPI data from `ResultsHub`,
  - uses the shared results truth refresh callback from KPI drawer actions,
  - avoids another separate KPI truth branch when rendered inside the hub.

### 4. KPI write seams are less silent

- `src/components/Results/KPICreateModal.tsx`
  - now errors if KPI create does not return a stable id,
  - emits success/error toast feedback instead of silent failure.
- `src/components/Results/KPITimeSeriesDrawer.tsx`
  - key write paths now emit success/error toast feedback for:
    - measurement record,
    - KPI settings save,
    - KPI delete.

## Automated verification

Passed:

- `npx vitest run tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx tests/components/Results/ResultsSummaryView.runtime-truth.test.tsx tests/components/Results/KPICreateModal.v8-write.test.tsx`

Coverage includes:

- governed runtime strip remains visible and stable,
- KPI create still prefers governed V8 write seam,
- Results summary preserves governed snapshot truth,
- new regression guard:
  - `ResultsHub` refreshes both KPI catalog and governed snapshot after create success and drawer value updates.

## Manual acceptance checklist

- Open `Results` and confirm KPI runtime strip matches the refreshed hub state after:
  - creating a KPI,
  - recording a KPI value,
  - deleting a KPI.
- Confirm `Summary` cards stay aligned with hub runtime chips after KPI creation from the summary surface.
- Open `Operational Analysis`, record a KPI value, and confirm the module-level KPI truth refreshes without a hard reload.
- Trigger an invalid KPI write and confirm the user gets a visible error instead of silent failure.

## Residual risk

- This packet closes the client-side refresh split-brain, but the backend still contains multiple KPI/ROI aggregate worlds (`catalog`, `dashboard`, ROI rollups) that may need deeper schema-level convergence later.
- `ResultsSummaryView` still owns its own initiative list composition, because that surface needs completed-initiative monitoring semantics not identical to the KPI catalog.
- Full repo `type-check` remains noisy from unrelated pre-existing areas outside this packet.

## Status

- `KPI / Results` now have a single clearer refresh spine for must-have user flows.
- Current closure status at time of write: code landed, focused tests green, pre-ratification snapshot.
- Current authority: final Wave 1 module ratification is recorded in `548-v81-wave1-final-module-gate-ratification.md`.
