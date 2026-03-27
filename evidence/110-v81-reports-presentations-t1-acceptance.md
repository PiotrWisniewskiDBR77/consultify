# V8.1 Reports / Presentations T1 Acceptance

Date: 2026-03-26
Lane: `Reports / Presentations`
Taxonomy: `T1`
Tranche: `Tranche 1`
Decision: `accepted`

## Acceptance basis

The active `T1` split-brain packet for `Reports / Presentations` is accepted as complete.

Accepted closure points:

1. canonical reports deep-link contract standardized to `/presentations?tab=documents`
2. registry-backed list reads aligned to `GET /api/artifacts`
3. primary report/presentation actions aligned to one explicit authority seam via
   `GET /api/artifacts/:id/action-target`
4. dead live-router leftovers removed
5. historical report entry leftovers neutralized into redirect shims

## Evidence chain

- `evidence/107-v81-reports-presentations-split-brain-map.md`
- `evidence/108-v81-reports-presentations-action-target-seam.md`
- `evidence/109-v81-reports-presentations-legacy-entry-neutralization.md`

## Verification basis

Passed:

- `tests/integration/routes/artifacts.routes.test.ts`
- `tests/components/ReportsAndPresentations/useRapData.canonicalArtifacts.test.tsx`

## Residual scope now out of lane

What remains in the repo is no longer an active split-brain blocker for this lane.
Any broader reports/presentations product evolution now belongs to a future promoted
packet, not the current `T1` debt-closure slice.
