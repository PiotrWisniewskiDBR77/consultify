## V8.1 Evidence - broader `Results / KPI / ROI` parity - KPI report create V8 write seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Results / KPI / ROI` parity
Status: `active`

### Packet

`KPI report create V8 write seam`

### Why this packet

After KPI create plus both active ROI drawer writes landed, the next smallest honest broader results packet was the visible KPI report creation flow inside `ResultsKpiReportsView`. The active create modal still posted directly to legacy `/results/kpi-reports`, even though the broader results lane had already started closing visible write continuity on governed V8-first seams.

This packet stays bounded because it closes the report creation submit path only. It does not broaden into report list reads, report snapshot reads, task-materialization actions, or a full report lifecycle rewrite.

### What changed

1. extended `server/src/routes/v8/results.routes.ts` with governed write orchestration for:
   - `POST /api/v8/results/kpi-reports`
2. extended `src/services/api/v8/results.ts` with:
   - `V8ResultsApi.createKpiReport()`
3. updated `src/components/Results/ResultsKpiReportsView.tsx` so KPI report creation now uses V8 first, with fallback to legacy create only for bounded compatibility statuses
4. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/results.routes.test.ts`
   - `tests/unit/services/v8-results-api.test.ts`
   - `tests/components/Results/ResultsKpiReadSurfaces.v8-catalog.test.tsx`

### Verification

- `npx vitest run server/src/routes/v8/__tests__/results.routes.test.ts tests/unit/services/v8-results-api.test.ts tests/components/Results/ResultsKpiReadSurfaces.v8-catalog.test.tsx`
- `ReadLints` clean for:
  - `server/src/routes/v8/results.routes.ts`
  - `server/src/routes/v8/__tests__/results.routes.test.ts`
  - `src/services/api/v8/results.ts`
  - `src/components/Results/ResultsKpiReportsView.tsx`
  - `tests/unit/services/v8-results-api.test.ts`
  - `tests/components/Results/ResultsKpiReadSurfaces.v8-catalog.test.tsx`

### Result

The active broader results lane now has its fourth real bounded packet after the split-brain map. The visible KPI report creation flow no longer defaults to the legacy route during normal operation, so the main live write surfaces in KPI creation, ROI drawer editing, and KPI report creation now all start from governed V8-first seams.
