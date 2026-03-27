## V8.1 Evidence - broader `Results / KPI / ROI` parity - deviation acknowledge V8 write seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Results / KPI / ROI` parity
Status: `active`

### Packet

`deviation acknowledge V8 write seam`

### Why this packet

After KPI CRUD and mapping mutations were closed on governed seams, the next smallest honest broader results packet was the visible `Acknowledge` action inside the open deviation-case panel of `KPITimeSeriesDrawer`. The button still posted directly to legacy `/benefits/deviation-cases/:caseId/acknowledge`.

This packet stays bounded because it closes one deviation-case mutation only. It does not broaden into RCA save, action create/update, resolve, close, or a full deviation workflow rewrite.

### What changed

1. extended `server/src/routes/v8/results.routes.ts` with governed write support for:
   - `POST /api/v8/results/deviation-cases/:caseId/acknowledge`
2. extended `src/services/api/v8/results.ts` with:
   - `V8ResultsApi.acknowledgeDeviationCase()`
3. updated `src/components/Results/KPITimeSeriesDrawer.tsx` so the active deviation-case `Acknowledge` action now uses V8 first, with fallback to legacy writes only for bounded compatibility statuses
4. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/results.routes.test.ts`
   - `tests/unit/services/v8-results-api.test.ts`
   - `tests/components/Results/KPITimeSeriesDrawer.v8-catalog.test.tsx`

### Verification

- `npx vitest run server/src/routes/v8/__tests__/results.routes.test.ts tests/unit/services/v8-results-api.test.ts tests/components/Results/KPITimeSeriesDrawer.v8-catalog.test.tsx`
- `ReadLints` clean for:
  - `server/src/routes/v8/results.routes.ts`
  - `server/src/routes/v8/__tests__/results.routes.test.ts`
  - `src/services/api/v8/results.ts`
  - `src/components/Results/KPITimeSeriesDrawer.tsx`
  - `tests/unit/services/v8-results-api.test.ts`
  - `tests/components/Results/KPITimeSeriesDrawer.v8-catalog.test.tsx`

### Result

The active broader results lane now has its tenth real bounded packet after the split-brain map. The visible deviation-case acknowledge action no longer defaults to legacy benefits writes during normal operation, so the remaining Results residual in this drawer is now concentrated around the rest of the deviation workflow rather than core KPI and mapping mutations.
