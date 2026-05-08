# Sprint 3 — Confidence Algorithm + Validation Status (Block B)

**Sprint ID:** `B-S3`
**Owner:** Agent A
**Status:** `PLANNED`
**Estimate:** ~1.5 days
**Epic:** EPIC-T9

## Goal

Ship `ConfidenceScoringService` and `ValidationStatusService`. Wire `RecordsService` write path to call `recompute`. Add validation-status flip endpoint with role/transition check. Document algorithm in `RECORD_PROVENANCE_V1.md`.

## Pre-sprint risk check

B-T2 (algorithm too aggressive) — telemetry baseline + tunable weights. B-T4 (recompute throughput) — debounce + bulk path. B-S2 (AI auto-forge) — service-level invariant.

## Deliverables

- `ConfidenceScoringService.ts` with `recompute`, `recomputeBulk`.
- `ValidationStatusService.ts` with `setStatus`, `getAllowedTransitions`.
- `RecordsService.ts` extended: write hook calls `recompute`; `getRecordWithProvenance`.
- Route `POST /records/:id/validation-status`.
- Unit tests for both services + integration test for end-to-end flow.
- `consultify/docs/product/RECORD_PROVENANCE_V1.md` documenting model and algorithm.

## Files

### Created
- `consultify/server/src/services/tablePlatform/ConfidenceScoringService.ts`
- `consultify/server/src/services/tablePlatform/ValidationStatusService.ts`
- `consultify/server/src/services/tablePlatform/__tests__/ConfidenceScoringService.test.ts`
- `consultify/server/src/services/tablePlatform/__tests__/ValidationStatusService.test.ts`
- `consultify/docs/product/RECORD_PROVENANCE_V1.md`

### Updated
- `consultify/server/src/services/tablePlatform/RecordsService.ts` (write-hook + new helper only)
- `consultify/server/src/routes/table-platform.routes.ts` (add validation-status route)
- `consultify/server/src/services/tablePlatform/index.ts`

## Sprint Entry Gate

- [ ] S2 closed `GO`.

## Sprint Exit Gate

- [ ] Algorithm + state machine documented.
- [ ] Unit + integration tests green.
- [ ] Telemetry baseline captured for 100 sample records.
- [ ] Audit rows on every flip.
- [ ] Recommendation: `GO` to S4.
