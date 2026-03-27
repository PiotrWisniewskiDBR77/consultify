## V8.1 Evidence - broader `Results / KPI / ROI` parity - deviation close V8 write seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Results / KPI / ROI` parity
Status: `active`

### Packet

`deviation close V8 write seam`

### Why this packet

After deviation resolve continuity landed, the next smallest honest broader results packet was the visible `Close` workflow inside the open deviation-case panel of `KPITimeSeriesDrawer`. The close action still posted directly to legacy `/benefits/deviation-cases/:caseId/close` with the closure evidence payload.

This packet stays bounded because it closes one deviation-case close workflow only. It does not broaden into wider linked-artifact choreography, extra closure automation, or a full deviation workflow rewrite.

### What changed

1. extended `server/src/routes/v8/results.routes.ts` with governed write support for:
   - `POST /api/v8/results/deviation-cases/:caseId/close`
2. extended `src/services/api/v8/results.ts` with:
   - `V8ResultsApi.closeDeviationCase()`
3. updated `src/components/Results/KPITimeSeriesDrawer.tsx` so the active deviation-case `Close` action now uses V8 first, with fallback to legacy writes only for bounded compatibility statuses
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

The active broader results lane now has its fifteenth real bounded packet after the split-brain map. The visible deviation-case close flow no longer defaults to legacy benefits writes during normal operation, so the remaining question in this drawer is no longer about an active mixed-truth mutation seam but whether the broader lane is now ready for bounded acceptance.
