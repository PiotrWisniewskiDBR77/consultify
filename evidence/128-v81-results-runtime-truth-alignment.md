# V8.1 Results Runtime Truth Alignment

Date: 2026-03-26
Lane: `Results / KPI / ROI`
Taxonomy: `T2`
Status: `done`

## Goal

Remove the remaining mixed-truth behavior in the active results lane where governed V8 runtime strips
could coexist with synthetic `DEMO_*` fallback content inside the same live surface.

## What changed

1. `src/components/Results/ResultsHub.tsx`
   - removed the `DEMO_KPIS` fallback from the active KPI surface
   - empty or failed legacy payloads now resolve to an empty live state instead of synthetic KPI rows

2. `src/components/Results/ResultsSummaryView.tsx`
   - removed the `DEMO_SUMMARY_ITEMS` fallback from the active summary surface
   - governed V8 snapshot cards can still render, but the initiative table now stays empty when live inputs are unavailable

3. Regression coverage
   - extended `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx`
   - added `tests/components/Results/ResultsSummaryView.runtime-truth.test.tsx`

## Why this matters

This closes the most obvious active-lane split-brain after route canonicalization:

- `/benefits` no longer presents governed V8 summary chips next to fake KPI/demo records
- operator trust improves because empty data is now shown as empty, not silently backfilled
- the next packets can focus on real V8-first client/runtime convergence instead of masking gaps with demo data

## Verification

`npx vitest run tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx tests/components/Results/ResultsSummaryView.runtime-truth.test.tsx`
