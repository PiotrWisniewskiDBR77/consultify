## V8.1 Evidence - broader `Results / KPI / ROI` parity - KPI delete V8 write seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Results / KPI / ROI` parity
Status: `active`

### Packet

`KPI delete V8 write seam`

### Why this packet

After KPI create, ROI drawer writes, KPI report creation, KPI time-series record, KPI settings save, and KPI initiative link/unlink continuity landed, the next smallest honest broader results packet was the visible delete action inside `KPITimeSeriesDrawer`. The drawer still deleted KPIs through legacy `/benefits/kpis/:kpiId`, including legacy-owned cascade cleanup for mappings, measurements, and deviation cases.

This packet stays bounded because it closes one active delete workflow only. It does not broaden into deviation-case write chains or a full KPI operator drawer rewrite.

### What changed

1. extended `server/src/routes/v8/results.routes.ts` with governed write support for:
   - `DELETE /api/v8/results/kpis/:kpiId`
2. extended `src/services/api/v8/results.ts` with:
   - `V8ResultsApi.deleteKpi()`
3. updated `src/components/Results/KPITimeSeriesDrawer.tsx` so the active KPI delete action now uses V8 first, with fallback to legacy writes only for bounded compatibility statuses
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

The active broader results lane now has its ninth real bounded packet after the split-brain map. The visible KPI drawer delete action no longer defaults to legacy benefits writes during normal operation, so the remaining Results residual in this drawer is now concentrated around individual deviation-case mutations rather than core KPI CRUD and mapping actions.
