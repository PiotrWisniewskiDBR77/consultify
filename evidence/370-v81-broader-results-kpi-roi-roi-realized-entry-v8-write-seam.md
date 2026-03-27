## V8.1 Evidence - broader `Results / KPI / ROI` parity - ROI realized entry V8 write seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Results / KPI / ROI` parity
Status: `active`

### Packet

`ROI realized entry V8 write seam`

### Why this packet

After KPI create and ROI assumptions save continuity landed, the next smallest honest broader results packet was the visible realized-entry submit flow inside `ROIDetailDrawer`. The accepted bounded results lane had already moved ROI reads and variance truth onto governed V8-first seams, but the live realized-entry form still posted directly to legacy `/benefits/roi/:initiativeId/realized`.

This packet stays bounded because it closes one active ROI mutation submit path without broadening into KPI reports, wider results operator/reporting surfaces, or a full ROI workflow rewrite.

### What changed

1. extended `server/src/routes/v8/results.routes.ts` with governed write support for:
   - `POST /api/v8/results/roi/initiative/:initiativeId/realized`
2. extended `src/services/api/v8/results.ts` with:
   - `V8ResultsApi.createRoiInitiativeRealizedEntry()`
3. updated `src/components/Results/ROIDetailDrawer.tsx` so realized-entry submit now uses V8 first, with fallback to legacy writes only for bounded compatibility statuses
4. extended focused regression coverage in:
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

The active broader results lane now has its third real bounded packet after the split-brain map. The visible ROI realized-entry form no longer defaults to legacy benefits writes during normal operation, so the active ROI drawer now covers both assumptions save and realized-entry submit continuity on governed V8-first seams.
