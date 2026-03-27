## V8.1 Evidence - broader `Results / KPI / ROI` parity - deviation action status V8 write seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Results / KPI / ROI` parity
Status: `active`

### Packet

`deviation action status V8 write seam`

### Why this packet

After deviation action-create continuity landed, the next smallest honest broader results packet was the visible checklist-toggle workflow inside the open deviation-case panel of `KPITimeSeriesDrawer`. The action status flip between `OPEN` and `DONE` still wrote directly to legacy `/benefits/deviation-cases/:caseId/actions/:actionId`.

This packet stays bounded because it closes one deviation action-status workflow only. It does not broaden into action editing breadth, resolve, close, or a full deviation workflow rewrite.

### What changed

1. extended `server/src/routes/v8/results.routes.ts` with governed write support for:
   - `PUT /api/v8/results/deviation-cases/:caseId/actions/:actionId`
2. extended `src/services/api/v8/results.ts` with:
   - `V8ResultsApi.updateDeviationAction()`
3. updated `src/components/Results/KPITimeSeriesDrawer.tsx` so the active deviation action checklist toggle now uses V8 first, with fallback to legacy writes only for bounded compatibility statuses
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

The active broader results lane now has its thirteenth real bounded packet after the split-brain map. The visible deviation action status-toggle flow no longer defaults to legacy benefits writes during normal operation, so the remaining Results residual in this drawer is now concentrated around resolve and close mutations.
