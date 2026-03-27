## V8.1 Evidence - broader `Results / KPI / ROI` parity - KPI time-series record V8 write seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Results / KPI / ROI` parity
Status: `active`

### Packet

`KPI time-series record V8 write seam`

### Why this packet

After KPI create, ROI drawer writes, and KPI report creation continuity landed, the next smallest honest broader results packet was the visible `Record New Value` submit path inside `KPITimeSeriesDrawer`. The drawer already had governed V8-first read continuity, but the active measurement-recording form still posted directly to legacy `/benefits/kpis/:kpiId/time-series`.

This packet stays bounded because it closes one active KPI drawer submit path only. It does not broaden into KPI settings save, KPI delete, mapping add/remove, deviation-case workflow writes, or a full operator-drawer rewrite.

### What changed

1. extended `server/src/routes/v8/results.routes.ts` with governed write support for:
   - `POST /api/v8/results/kpis/:kpiId/time-series`
2. extended `src/services/api/v8/results.ts` with:
   - `V8ResultsApi.createKpiTimeSeriesValue()`
3. updated `src/components/Results/KPITimeSeriesDrawer.tsx` so the active `Record New Value` form now uses V8 first, with fallback to legacy writes only for bounded compatibility statuses
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

The active broader results lane now has its fifth real bounded packet after the split-brain map. The visible KPI drawer measurement-recording form no longer defaults to legacy benefits writes during normal operation, so the main Results write surfaces now extend further onto governed V8-first seams while still keeping the remaining KPI operator mutations explicitly out of scope for this packet.
