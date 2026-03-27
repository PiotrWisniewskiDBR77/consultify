## V8.1 Evidence - broader `Results / KPI / ROI` parity - ROI assumptions V8 write seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Results / KPI / ROI` parity
Status: `active`

### Packet

`ROI assumptions V8 write seam`

### Why this packet

After the KPI create closure, the next smallest honest broader results packet was the visible ROI assumptions save flow inside `ROIDetailDrawer`. The accepted bounded results lane had already moved ROI reads and variance truth onto governed V8-first seams, but the live assumptions editor still wrote directly to legacy `/benefits/roi/:initiativeId/assumptions`.

This packet stays bounded because it closes one active ROI write surface without broadening into realized-entry writes, KPI report creation, or wider results operator/reporting breadth.

### What changed

1. extended `server/src/routes/v8/results.routes.ts` with governed write support for:
   - `PUT /api/v8/results/roi/initiative/:initiativeId/assumptions`
2. extended `src/services/api/v8/results.ts` with:
   - `V8ResultsApi.updateRoiInitiativeAssumptions()`
3. updated `src/components/Results/ROIDetailDrawer.tsx` so ROI assumptions save now uses V8 first, with fallback to legacy writes only for bounded compatibility statuses
4. added focused regression coverage in:
   - `server/src/routes/v8/__tests__/results.routes.test.ts`
   - `tests/unit/services/v8-results-api.test.ts`
   - `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx`

### Verification

- `npx vitest run server/src/routes/v8/__tests__/results.routes.test.ts tests/unit/services/v8-results-api.test.ts tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx`
- `ReadLints` clean for:
  - `server/src/routes/v8/results.routes.ts`
  - `server/src/routes/v8/__tests__/results.routes.test.ts`
  - `src/services/api/v8/results.ts`
  - `src/components/Results/ROIDetailDrawer.tsx`
  - `tests/unit/services/v8-results-api.test.ts`
  - `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx`

### Result

The active broader results lane now has its second real bounded packet after the split-brain map. The visible ROI assumptions editor no longer defaults to legacy benefits writes during normal operation, so active ROI mutation continuity is now closer to the governed V8-first read/runtime surface that already existed in the accepted bounded results lane.
