# V8.1 Reports / Presentations Action-Target Seam

Date: 2026-03-26
Lane: `Reports / Presentations`
Taxonomy: `T1`
Tranche: `Tranche 1`

## What changed

The outputs library no longer relies on scattered local assumptions for the primary
report/presentation action authority.

Instead:

1. registry-backed list reads still come from `GET /api/artifacts`
2. registry artifacts can now resolve their origin-owned authority through
   `GET /api/artifacts/:id/action-target`
3. UI actions in `useRapData` now consume that seam for primary mutations:
   - report delete/export
   - presentation delete/export

## Why this matters

Before this packet, the library used the canonical registry for list rows but still
constructed origin action paths from local assumptions spread across multiple
components.

After this packet:

- the live UI has one explicit seam between artifact registry and origin runtime
- reports/presentations no longer need to infer action ownership ad hoc
- the split-brain surface is narrowed from "list vs actions in many places" to
  one backend seam plus a small remaining cleanup area

## Verification

Passed:

- `tests/integration/routes/artifacts.routes.test.ts`
- `tests/components/ReportsAndPresentations/useRapData.canonicalArtifacts.test.tsx`

Key assertions now covered:

- `GET /api/artifacts/:id/action-target` returns report action metadata
- `GET /api/artifacts/:id/action-target` returns presentation action metadata
- `useRapActions` resolves report delete authority through `action-target`
- `useRapActions` resolves presentation delete authority through `action-target`
