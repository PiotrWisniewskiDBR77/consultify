## V8.1 Evidence - broader `Results / KPI / ROI` parity - KPI initiative link V8 write seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Results / KPI / ROI` parity
Status: `active`

### Packet

`KPI initiative link V8 write seam`

### Why this packet

After KPI create, ROI drawer writes, KPI report creation, KPI time-series record, and KPI settings save continuity landed, the next smallest honest broader results packet was the visible initiative-link action inside `KPITimeSeriesDrawer`. The governed V8 KPI-mapping create seam already existed, but the active drawer still posted directly to legacy `/benefits/kpi-mappings`.

This packet stays bounded because it closes one active link action only. It does not broaden into KPI unlink, KPI delete, deviation-case workflow writes, or a full KPI operator drawer rewrite.

### What changed

1. updated `src/components/Results/KPITimeSeriesDrawer.tsx` so the active initiative-link action now uses the existing governed `V8ResultsApi.createKpiMapping()` seam first, with fallback to legacy writes only for bounded compatibility statuses
2. extended focused regression coverage in:
   - `tests/components/Results/KPITimeSeriesDrawer.v8-catalog.test.tsx`
3. reused the already-landed governed KPI mapping create route and client coverage in:
   - `server/src/routes/v8/__tests__/results.routes.test.ts`
   - `tests/unit/services/v8-results-api.test.ts`

### Verification

- `npx vitest run tests/components/Results/KPITimeSeriesDrawer.v8-catalog.test.tsx tests/unit/services/v8-results-api.test.ts`
- `ReadLints` clean for:
  - `src/components/Results/KPITimeSeriesDrawer.tsx`
  - `tests/components/Results/KPITimeSeriesDrawer.v8-catalog.test.tsx`

### Result

The active broader results lane now has its seventh real bounded packet after the split-brain map. The visible KPI drawer initiative-link action no longer defaults to legacy benefits writes during normal operation, so the remaining Results residual inside this drawer is now narrower around unlink, delete, and deviation-case mutations.
