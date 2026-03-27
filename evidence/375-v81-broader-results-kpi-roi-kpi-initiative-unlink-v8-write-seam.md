## V8.1 Evidence - broader `Results / KPI / ROI` parity - KPI initiative unlink V8 write seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Results / KPI / ROI` parity
Status: `active`

### Packet

`KPI initiative unlink V8 write seam`

### Why this packet

After KPI create, ROI drawer writes, KPI report creation, KPI time-series record, KPI settings save, and KPI initiative link continuity landed, the next smallest honest broader results packet was the visible initiative-unlink action inside `KPITimeSeriesDrawer`. The governed V8 mapping-create seam was already live, but removing a mapping still defaulted to legacy `/benefits/kpi-mappings/:mappingId`.

This packet stays bounded because it closes one active unlink action only. It does not broaden into KPI delete, deviation-case workflow writes, or a full KPI operator drawer rewrite.

### What changed

1. extended `server/src/routes/v8/results.routes.ts` with governed write support for:
   - `DELETE /api/v8/results/kpi-mappings/:mappingId`
2. extended `src/services/api/v8/results.ts` with:
   - `V8ResultsApi.deleteKpiMapping()`
3. updated `src/components/Results/KPITimeSeriesDrawer.tsx` so the active initiative-unlink action now uses V8 first, with fallback to legacy writes only for bounded compatibility statuses
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

The active broader results lane now has its eighth real bounded packet after the split-brain map. The visible KPI drawer initiative-unlink action no longer defaults to legacy benefits writes during normal operation, so the remaining Results residual inside this drawer is narrower around KPI delete and individual deviation-case mutations.
