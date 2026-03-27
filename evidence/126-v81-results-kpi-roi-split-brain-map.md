# V8.1 Results / KPI / ROI Split-Brain Map

Date: 2026-03-26
Lane: `Results / KPI / ROI`
Taxonomy: `T2`
Tranche: `Tranche 2`
Status: `active`

## Current live surface

The live results lane is centered on:

- `/benefits`
- `/kpi-okr`
- `src/components/Results/ResultsHub.tsx`

with `ResultsHub` serving as the active routed hub.

## Split-brain findings

1. `/benefits` and `/kpi-okr` both land on the same routed results hub
2. auth protection was inconsistent across those duplicate entry URLs
3. the active results hub mixes governed V8 runtime strip reads with legacy `benefits/*` reads
4. historical alternate surfaces such as `BenefitsHub` and the standalone `/roi` route remain parallel
5. chat/action/source navigation still referenced non-canonical `/kpi-okr` entry points

## Smallest clean starting packet

Chosen packet:

- canonicalize routed results entry to `/benefits`
- reduce `/kpi-okr` to a compatibility redirect shim
- align `/kpi-okr` protected-route behavior with `/benefits`

Why this packet:

- smallest bounded authority cut
- removes duplicate live entry truth
- keeps the next runtime packet smaller and easier to reason about

## Follow-up candidates

- bounded V8-first runtime alignment between results strip and summary surfaces
- explicit handling for remaining demo/legacy fallback truth inside active results tabs
- decision on legacy `BenefitsHub` / standalone `/roi` residuals
