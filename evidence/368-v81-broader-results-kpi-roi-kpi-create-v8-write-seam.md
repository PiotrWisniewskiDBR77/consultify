## V8.1 Evidence - broader `Results / KPI / ROI` parity - KPI create V8 write seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Results / KPI / ROI` parity
Status: `active`

### Packet

`KPI create V8 write seam`

### Why this packet

After the broader results split-brain map, the smallest honest first packet was not KPI reports or ROI editing. It was the visible KPI creation flow: `KPICreateModal` remained on legacy `/benefits/kpis` and `/benefits/kpi-mappings` writes even though the accepted results lane had already moved active reads and runtime truth onto governed V8-first seams.

This packet stays bounded because it closes one active write path on the live results surface without broadening into the wider results operator/reporting program.

### What changed

1. extended `server/src/routes/v8/results.routes.ts` with governed write endpoints for:
   - `POST /api/v8/results/kpis`
   - `POST /api/v8/results/kpi-mappings`
2. extended `src/services/api/v8/results.ts` with:
   - `V8ResultsApi.createKpi()`
   - `V8ResultsApi.createKpiMapping()`
3. updated `src/components/Results/KPICreateModal.tsx` to create KPIs and initiative mappings through V8 first, with fallback to legacy writes only for bounded compatibility statuses
4. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/results.routes.test.ts`
   - `tests/unit/services/v8-results-api.test.ts`
   - `tests/components/Results/KPICreateModal.v8-write.test.tsx`

### Verification

- `npx vitest run server/src/routes/v8/__tests__/results.routes.test.ts tests/unit/services/v8-results-api.test.ts tests/components/Results/KPICreateModal.v8-write.test.tsx`
- `ReadLints` clean for:
  - `server/src/routes/v8/results.routes.ts`
  - `server/src/routes/v8/__tests__/results.routes.test.ts`
  - `src/services/api/v8/results.ts`
  - `src/components/Results/KPICreateModal.tsx`
  - `tests/unit/services/v8-results-api.test.ts`
  - `tests/components/Results/KPICreateModal.v8-write.test.tsx`

### Result

The active broader results lane now has its first real bounded packet after the split-brain map. The visible KPI create workflow no longer defaults to legacy write routes during normal operation, so active results write continuity now starts to match the governed V8-first read/runtime surface already established in the accepted bounded results lane.
