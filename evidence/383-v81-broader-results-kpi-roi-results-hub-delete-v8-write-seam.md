## V8.1 Evidence - broader `Results / KPI / ROI` parity - ResultsHub delete V8 write seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: broader `Results / KPI / ROI` parity
Status: `active`

### Packet

`ResultsHub delete V8 write seam`

### Why this packet

After deviation close continuity landed, one visible broader results mutation still defaulted directly to legacy benefits writes: deleting a KPI from the `ResultsHub` KPI table surface.

This packet stays bounded because it closes that one remaining hub delete workflow only. It does not broaden into wider results redesign, reporting breadth, or new operator flows.

### What changed

1. updated `src/components/Results/ResultsHub.tsx` so the active hub delete action now uses `V8ResultsApi.deleteKpi()` first and falls back to legacy `/benefits/kpis/:id` only for bounded compatibility statuses
2. extended `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` with focused coverage proving:
   - hub delete uses the governed V8 seam first
   - hub delete falls back to legacy only for bounded compatibility errors

### Verification

- `npx vitest run tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx`
- `ReadLints` clean for:
  - `src/components/Results/ResultsHub.tsx`
  - `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx`

### Result

The active broader results lane now has its sixteenth real bounded packet after the split-brain map. Visible KPI deletion no longer defaults to legacy benefits writes from the hub surface during normal operation, so the broader lane is now ready for bounded acceptance rather than one more honest write packet.
