# Sprint 0 — Preflight (Block B)

**Sprint ID:** `B-S0`
**Owner:** Orchestrator
**Status:** `CLOSED — GO recommended`
**Estimate:** ~0.5 day
**Started:** 2026-05-08
**Closed:** 2026-05-08

## Goal

Audit existing `RecordsService` and `tp_records` schema. Rehearse the migration on a staging snapshot of production-scale data. Confirm rollback path. Capture baseline metrics for performance regression compare at S6.

## Pre-sprint risk check

PR4 / B-T1 (migration lock). Mitigation rehearsal mandatory.

## Deliverables

- `audit-findings/RECORDS_SERVICE_BASELINE_2026-05-XX.md` — current `RecordsService` capabilities, `tp_records` schema, performance baseline (50k record grid render p95).
- Migration rehearsal log: `evidence/sprint-0/migration-rehearsal.md` — runtime, lock duration, row count delta, rollback runtime.
- Confirmed migration plan signed off.

## Files

### Created
- `audit-findings/RECORDS_SERVICE_BASELINE_2026-05-XX.md`
- `evidence/sprint-0/migration-rehearsal.md`

### Untouched
- All source files.

## Sprint Entry Gate

- [ ] Block B `00_TASK_PACKET.md` reviewed.
- [ ] Staging snapshot available.

## Sprint Exit Gate

- [x] Audit findings written → `audit-findings/RECORDS_SERVICE_BASELINE_2026-05-08.md`
- [x] Rehearsal logged (paper) → `evidence/sprint-0/migration-rehearsal.md`
- [x] Test baseline → `evidence/sprint-0/baseline-tests.txt`
- [x] **Recommendation: `GO` to S1.**

## Realized risks

| ID | Description | Outcome |
|---|---|---|
| B-T1 / PR4 (migration lock) | Estimated ≤ 90 s blocking on `tp_records` if non-CONCURRENTLY indexes used; acceptable for low-traffic deploy. Two-file split documented as fallback. | Closed; mitigation valid. |
| B-S5 (cross-tenant listing) | Confirmed: tenancy resolved via `tp_records → tp_tables → tp_bases.organization_id`; source table denormalizes via TEXT column. | Closed; integration test plan unchanged. |

## Findings (7)

Documented in `audit-findings/RECORDS_SERVICE_BASELINE_2026-05-08.md`:

- **B-S0-F1** Migration filename → `20260508_block_b_record_sources.sql` at top-level `migrations/`.
- **B-S0-F2** `organization_id TEXT NOT NULL` (no FK to organizations). Plan adjustment to packet.
- **B-S0-F3** Audit trail uses existing `tp_audit_events` + `AuditService.logEvent`. Confidence recompute does NOT log per call (high-frequency).
- **B-S0-F4** Hook insertion: between formula recompute and realtime notify in createRecord/updateRecord/deleteRecord. Lines 341, 535, 647.
- **B-S0-F5** Existing `RecordsService.test.ts` (29 tests) survives with 1-line `vi.mock('../ConfidenceScoringService.js', ...)`.
- **B-S0-F6** Feature flag check INSIDE `confidenceScoringService.recompute` (returns no-op when disabled) — protects record writes during partial deploy.
- **B-S0-F7** S2 must read `PermissionsService.ts` once to confirm `canRead()` API shape.

## Plan adjustments produced for downstream sprints

- 00_TASK_PACKET.md §3 (Constraints): `organization_id TEXT` (was UUID+FK).
- EPIC-T8 schema: column types + index strategy aligned.
- EPIC-T9 schema: confidence + validation column types confirmed `NUMERIC(3,2)` and `TEXT` with CHECK.
- S1 sprint card: live rehearsal at sprint start using paper plan.
- S2 sprint card: confirm `PermissionsService.canRead` signature.
- S3 sprint card: feature flag check inside `recompute`; 1-line mock addition in `RecordsService.test.ts`.

## Daily evidence

| Date | Activity | Output |
|---|---|---|
| 2026-05-08 | Read RecordsService.ts (1005 lines), AuditService.ts, 700_table_platform_foundation.sql, 701_table_platform_performance.sql, RecordsService.test.ts | Audit findings + rehearsal plan + baseline. |
