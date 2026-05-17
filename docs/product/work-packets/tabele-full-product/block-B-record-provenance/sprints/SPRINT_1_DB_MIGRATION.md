# Sprint 1 — DB Migration (Block B)

**Sprint ID:** `B-S1`
**Owner:** Agent C
**Status:** `STATIC VERIFICATION COMPLETE — 2026-05-08` (migration + 21-test static verification shipped; staging deploy is the remaining gate item)
**Estimate:** ~0.5 day
**Epic:** EPIC-T8 + EPIC-T9

## Goal

Ship migration that creates `tp_record_sources` and adds 2 columns to `tp_records`. Deploy on staging. Confirm production-readiness.

## Pre-sprint risk check

B-T1 / PR4 — production lock. Already rehearsed in S0. CTO Q8 (2026-05-08): non-CONCURRENTLY index creation accepted; revisit if staging telemetry shows real lock > 30 s.

## Deliverables

- [x] **Migration `20260508_block_b_record_provenance.sql` shipped to `consultify/server/migrations/`.** Creates `tp_record_sources`, adds `confidence_score` + `validation_status` to `tp_records`, CHECK constraints, indexes (non-CONCURRENTLY).
- [x] **Rollback `rollback/20260508_block_b_record_provenance.down.sql` shipped** alongside.
- [x] Migration discoverable by `tablePlatform/migrationRunner.ts` (`MIGRATION_PATTERN` matches `20260508_*` and sort order places it after Block A migration).
- [x] Static migration test (`migrations.block-a-b.test.ts`) — 21 tests verifying file presence, column shape, CHECK vocabulary, FK + cascade, index names, paren balance, rollback symmetry, and migration runner pattern compatibility for both Block A and Block B migrations.
- [ ] Migration applies cleanly on staging in < 30 s wall-clock. **(staging deploy is the remaining gate item)**
- [ ] Rollback path verified on staging.

## Files

### Created — shipped (2026-05-08)
- `consultify/server/migrations/20260508_block_b_record_provenance.sql`
- `consultify/server/migrations/rollback/20260508_block_b_record_provenance.down.sql`
- `consultify/server/src/services/tablePlatform/__tests__/migrations.block-a-b.test.ts` (covers BOTH blocks)

### Created — pending
- (none — migration runner auto-discovers; no `index.ts` registration step needed)

### Updated — pending
- (none beyond static verification covered above)

### Untouched
- All other source files.

## Sprint Entry Gate

- [x] S0 closed `GO`.
- [ ] Block A migration deployed (chronological ordering — guaranteed by date prefix; both ship in same deploy window).

## Sprint Exit Gate

- [ ] Migration applies cleanly on staging in < 30 s wall-clock. **(staging deploy is the remaining gate item)**
- [ ] Rollback verified on staging.
- [x] CI green — 21/21 static verification tests passing in `migrations.block-a-b.test.ts`.
- [ ] Recommendation: `GO` to S2 once staging deploy confirmed.
