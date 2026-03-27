# V8.1 Results Route Canonicalization

Date: 2026-03-26
Lane: `Results / KPI / ROI`
Taxonomy: `T2`
Tranche: `Tranche 2`

## What changed

The routed results lane now treats `/benefits` as canonical.

Changes:

- `KpiOkrView` became a redirect shim to `/benefits`
- `/kpi-okr` now resolves through that compatibility redirect instead of acting as a second live hub entry
- `RouterSync` now protects `/kpi-okr` the same way it protects `/benefits`
- action/chat/source navigation now points to `/benefits`

## Why this matters

Before this packet, the same routed results hub had two user-facing entry URLs with different
navigation and protection behavior.

This packet removes the duplicate routed authority and gives the results lane one canonical
entry path before deeper runtime convergence work.

## Verification

Passed:

- `tests/components/Results/KpiOkrView.redirect.test.tsx`
- `tests/components/RouterSync.idea-artifact.test.tsx`
