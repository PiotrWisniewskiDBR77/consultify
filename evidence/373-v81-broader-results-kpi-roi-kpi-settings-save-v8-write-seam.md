## V8.1 Evidence - broader `Results / KPI / ROI` parity - KPI settings save V8 write seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Results / KPI / ROI` parity
Status: `active`

### Packet

`KPI settings save V8 write seam`

### Why this packet

After KPI create, ROI drawer writes, KPI report creation, and KPI time-series record continuity landed, the next smallest honest broader results packet was the visible `Save` action in the `KPITimeSeriesDrawer` settings panel. The drawer already had governed V8-first reads, but settings edits still wrote directly to legacy `/benefits/kpis/:kpiId`.

This packet stays bounded because it closes one active KPI drawer save path only. It does not broaden into KPI delete, mapping add/remove, deviation-case workflow writes, or a full KPI operator drawer rewrite.

### What changed

1. extended `server/src/routes/v8/results.routes.ts` with governed write support for:
   - `PUT /api/v8/results/kpis/:kpiId`
2. extended `src/services/api/v8/results.ts` with:
   - `V8ResultsApi.updateKpi()`
3. updated `src/components/Results/KPITimeSeriesDrawer.tsx` so the active settings `Save` action now uses V8 first, with fallback to legacy writes only for bounded compatibility statuses
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

The active broader results lane now has its sixth real bounded packet after the split-brain map. The visible KPI drawer settings-save flow no longer defaults to legacy benefits writes during normal operation, so the remaining broader Results residual is narrower and more explicit around delete, mapping, and deviation-case mutations rather than the main KPI settings path.
