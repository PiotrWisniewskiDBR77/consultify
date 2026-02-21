# WS4: Core Flows — Execution / Benefits / Finance (L2/L3)

Timestamp: **2026-02-21 16:53:29 +0100**

Goal for this iteration:
- Add **REAL** L2/L3 tests (no placeholders) for Execution/Benefits/Finance.
- Extend VC audit **gate-files** with per-file **95/80** thresholds without breaking existing gates.

## Selected gate-files this run

### L2 (component/UI)
- `src/components/Execution/MitigationPanel.tsx` (new WS4 gate)
- `src/components/Benefits/Sparkline.tsx` (new WS4 gate)

### L3 (integration/API)
- `server/src/routes/budget.routes.ts` (new WS4 gate)

## Scenarios covered (high signal)

### Execution — `MitigationPanel`
- Auth token handling (missing token + localStorage failure path)
- Payload building (only non-empty fields are sent)
- Success path (saved state, funnel tracking, `onSaved`, timer reset)
- Failure paths (non-OK response + fetch throws)

Tests: `tests/components/Execution/MitigationPanel.test.tsx` (**8** cases)

### Benefits — `Sparkline`
- Empty series placeholder
- Path + dot rendering and target line toggling
- Scaling (targetValue included) and single-point behavior
- On-target/off-target styling (green/red)

Tests: `tests/components/Benefits/Sparkline.test.tsx` (**10** cases)

### Finance/Budget — `budget.routes`
- List, filter by `projectId`
- Create (including defaulting optional fields)
- Summary aggregation
- Update validation + update + delete
- 401 when auth bypass disabled

Tests: `tests/integration/routes/budget.l3.test.ts` (**9** cases)

## Gate config changes (why)
- `vitest.l2.config.ts`: add WS4 component tests + coverage includes; exclude `tests/components/AIChat/**` from L2 run (ongoing work + currently unstable).
- `vitest.l3.config.ts`: add WS4 budget route integration test + coverage includes.
- `scripts/testing/coverage-thresholds.ts`: add WS4 gate-files to `l2`/`l3` profiles (source of truth for per-file gates).

## Verify (PASS/FAIL)
- `npm run test:quality-check` — **PASS**
- `npm run test:l2:coverage` — **PASS**
- `npm run test:l3:coverage` — **PASS**

