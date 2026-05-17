# Sprint 3 — Confidence Algorithm + Validation Status (Block B)

**Sprint ID:** `B-S3`
**Owner:** Agent A
**Status:** `BACKEND COMPLETE`
**Estimate:** ~1.5 days
**Epic:** EPIC-T9

## Goal

Ship `ConfidenceScoringService` and `ValidationStatusService`. Wire
`RecordsService` write path to call `recompute`. Add validation-status flip
endpoint with role/transition check. Document algorithm in
`RECORD_PROVENANCE_V1.md`.

## Pre-sprint risk check

- **B-T2** (algorithm too aggressive) — telemetry baseline + tunable
  weights. → Weights live in `CONFIDENCE_WEIGHTS` (one-line calibration).
- **B-T4** (recompute throughput) — debounce + bulk path. → `recomputeBulk`
  is sequential by design; per-record recompute is gated on
  `(prev !== next)` so idempotent recomputes skip the UPDATE.
- **B-S2 service-level invariant** (AI auto-forge to `verified`).
  → `ValidationStatusService.setStatus` rejects calls without `actorUserId`
  and does not expose any system identity; AI agents have no surface to flip.

## Deliverables

- [x] `ConfidenceScoringService.ts` — `computeScore` (pure), `recompute`,
  `recomputeBulk`. Feature-flag gated by `ENABLE_RECORD_PROVENANCE`
  (default OFF). Idempotent UPDATE; zero DB I/O when flag is OFF.
- [x] `ValidationStatusService.ts` — `getStatus`, `getAllowedTransitions`,
  `isAdminOnlyTransition`, `setStatus`. State machine documented.
  Audit emit on every flip. Best-effort confidence recompute after flip.
- [x] `RecordsService` write hooks (`createRecord`, `updateRecord`) call
  `confidenceScoringService.recompute` AFTER formula recompute and BEFORE
  realtime notify. Failures are logged at `warn` and never roll back the
  mutation. Row refresh is conditional on `outcome.applied = true` to keep
  DB I/O parity with the pre-Block-B path while the flag is OFF.
- [x] Routes:
  - `POST /records/:recordId/validation-status` — body `{status, note?}`,
    error code map (`INVALID_INPUT→400`, `RECORD_NOT_FOUND→404`,
    `INVALID_VALIDATION_TRANSITION→409`,
    `TRANSITION_REQUIRES_SUPER_ADMIN→403`).
  - `GET  /records/:recordId/validation-status/transitions` — returns
    `{current, allowed[]}`.
- [x] Tests:
  - 18 unit tests for `ConfidenceScoringService` (algorithm, gate,
    idempotency, bulk error isolation, NUMERIC string handling).
  - 18 unit tests for `ValidationStatusService` (transitions, admin-only
    policy, audit emit shape, recompute best-effort).
  - 11 ACL/dispatch tests for the validation-status routes (happy path,
    auth gates, error code map).
- [x] `consultify/docs/product/RECORD_PROVENANCE_V1.md` documenting model
  and algorithm.
- [x] `ENABLE_RECORD_PROVENANCE` added to `FeatureFlags.ts` (default OFF).

## Files

### Created

- `consultify/server/src/services/tablePlatform/ConfidenceScoringService.ts`
- `consultify/server/src/services/tablePlatform/ValidationStatusService.ts`
- `consultify/server/src/services/tablePlatform/__tests__/ConfidenceScoringService.test.ts`
- `consultify/server/src/services/tablePlatform/__tests__/ValidationStatusService.test.ts`
- `consultify/server/src/routes/__tests__/validation-status-acl.test.ts`
- `consultify/docs/product/RECORD_PROVENANCE_V1.md`

### Updated

- `consultify/server/src/services/tablePlatform/RecordsService.ts`
  (write-hook in `createRecord` and `updateRecord`).
- `consultify/server/src/routes/table-platform.routes.ts` (validation-status
  routes mounted under `requireRecordAccess`).
- `consultify/server/src/services/tablePlatform/index.ts` (re-exports).
- `consultify/server/src/config/FeatureFlags.ts`
  (`ENABLE_RECORD_PROVENANCE`).

## Test results

```
ConfidenceScoringService.test.ts   18/18 PASS
ValidationStatusService.test.ts    18/18 PASS
validation-status-acl.test.ts      11/11 PASS
TOTAL B-S3 NEW                     47/47 PASS
```

Pre-existing test failures on baseline (RecordsService.test.ts (3),
smoke.test.ts (2), MetadataService changeFieldType (5),
ModuleSyncService (5), migrationRunner (5), settings.routes (1),
InterfaceService updateLayout (2)) are NOT regressions — they reproduce on
HEAD without the B-S3 patch. Tracked in baseline-quality block backlog.

## Sprint Entry Gate

- [x] S2 closed `GO`.

## Sprint Exit Gate

- [x] Algorithm + state machine documented in `RECORD_PROVENANCE_V1.md`.
- [x] Unit + integration tests green (47/47).
- [ ] Telemetry baseline captured for 100 sample records — DEFERRED to
  Anygravity P0 trial #2 (planned, prep card pending).
- [x] Audit rows on every flip (verified by `ValidationStatusService.test`
  audit-shape assertions).
- [x] Recommendation: `GO` to S4.

## Realised risks

- **R1: Hook adds extra `SELECT` on every record write.** Mitigated by
  conditional refresh — when `ENABLE_RECORD_PROVENANCE=false` (default),
  `recompute` short-circuits and the hook performs zero DB queries. With
  the flag ON the hook performs at most 3 queries (record SELECT, sources
  SELECT, conditional UPDATE) and re-fetches the record only when the score
  actually changed.
- **R2: Test-runner timeout on cold load of `table-platform.routes.ts`.**
  The validation-status ACL test bumps `testTimeout` to 25s via
  `vi.setConfig` (first-time transform of the ~5K-line router takes 6–9 s).
- **R3: Floating-point precision in algorithm tests.** Component
  assertions use `toBeCloseTo`; only the rounded `score` is matched with
  `toBe`.
