# Migration Rehearsal — Block B Sprint 0

**Date:** 2026-05-08
**Author:** Cursor agent (Orchestrator, CTO mode)
**Status:** `PAPER REHEARSAL — live execution deferred to S1`

---

## Why paper rehearsal

S0 is read-only by program rule. Live rehearsal requires:
- Direct DB connection to staging Postgres.
- Production-shaped snapshot (≥1M `tp_records` rows ideal).
- Maintenance window or replica.

Agent operates without these. The rehearsal here documents exact migration shape, expected durations, and the rollback procedure. Live rehearsal occurs at S1 entry gate.

---

## Migration script (final shape)

File: `DRD/consultify/server/migrations/20260508_block_b_record_sources.sql`

```sql
-- 20260508_block_b_record_sources.sql
-- Block B — Record Provenance: sources + confidence + validation
-- Forward-only. Rollback at _rollbacks/20260508_block_b_record_sources_rollback.sql.

-- 1. New table for source provenance ---------------------------------------
CREATE TABLE IF NOT EXISTS tp_record_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  record_id UUID NOT NULL REFERENCES tp_records(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN
    ('document','url','record','ai_generation','form_submission')),
  source_ref TEXT NOT NULL,
  label TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ NULL,
  last_verified_by TEXT NULL,
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_tp_record_sources_record
  ON tp_record_sources(record_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tp_record_sources_tenant
  ON tp_record_sources(organization_id);
CREATE INDEX IF NOT EXISTS idx_tp_record_sources_record_type
  ON tp_record_sources(record_id, source_type) WHERE deleted_at IS NULL;

-- 2. Confidence + validation columns on tp_records --------------------------
ALTER TABLE tp_records
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2) NULL,
  ADD COLUMN IF NOT EXISTS validation_status TEXT NULL;

-- 3. CHECK constraint (NOT VALID — does not scan) ---------------------------
ALTER TABLE tp_records
  ADD CONSTRAINT chk_validation_status
    CHECK (validation_status IS NULL
        OR validation_status IN ('unverified','auto_validated','human_validated','rejected'))
    NOT VALID;

-- 4. Validate constraint (background-safe on PG11+) -------------------------
ALTER TABLE tp_records VALIDATE CONSTRAINT chk_validation_status;

-- 5. Indexes for confidence and validation ---------------------------------
-- NOTE: not CONCURRENTLY because migration runner wraps the file in a
-- transaction. Acceptable on tp_records: < 60 s lock on 1M rows.
-- If unacceptable: split into 20260509_block_b_record_indexes.sql with raw
-- session (no transaction).
CREATE INDEX IF NOT EXISTS idx_tp_records_confidence
  ON tp_records(confidence_score)
  WHERE confidence_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tp_records_validation
  ON tp_records(validation_status)
  WHERE validation_status IS NOT NULL;
```

---

## Rollback script

File: `DRD/consultify/server/migrations/_rollbacks/20260508_block_b_record_sources_rollback.sql`

```sql
-- Rollback: 20260508_block_b_record_sources.sql

DROP INDEX IF EXISTS idx_tp_records_confidence;
DROP INDEX IF EXISTS idx_tp_records_validation;

ALTER TABLE tp_records
  DROP CONSTRAINT IF EXISTS chk_validation_status,
  DROP COLUMN IF EXISTS confidence_score,
  DROP COLUMN IF EXISTS validation_status;

DROP TABLE IF EXISTS tp_record_sources CASCADE;
```

Manual application: super-admin runs against staging; verifies SELECT on `tp_records` returns rows without the new columns.

---

## Expected durations (model-based)

| Step | Operation | Est. duration |
|---|---|---|
| 1 | `CREATE TABLE tp_record_sources` + 3 indexes (empty) | < 200 ms |
| 2 | `ALTER TABLE tp_records ADD COLUMN ... NULL` (×2) | < 200 ms (metadata only on PG11+) |
| 3 | `ADD CONSTRAINT ... NOT VALID` | < 100 ms |
| 4 | `VALIDATE CONSTRAINT` on 1M rows | 5–30 s, AccessShareLock only |
| 5 | `CREATE INDEX` on `tp_records` (×2) | 10–40 s each, blocks writes |
| **Total worst case** | | **~90 s blocking on `tp_records` writes** |

For a low-traffic deploy window this is acceptable. For tenants on hot bases, consider Q1 in audit findings (split into two migration files).

---

## Pre-deploy checks (S1)

- [ ] Confirm staging snapshot row count for `tp_records`: `SELECT count(*) FROM tp_records;`
- [ ] Confirm no `tp_record_sources` table pre-exists: `SELECT to_regclass('tp_record_sources');`
- [ ] Backup hint: snapshot taken automatically by Postgres replication; no manual dump needed.
- [ ] Apply migration; capture `\timing on` durations into evidence file.
- [ ] Verify counts: `SELECT count(*) FROM tp_records;` (must equal pre-deploy value).
- [ ] Verify constraint visible: `SELECT conname FROM pg_constraint WHERE conname='chk_validation_status';`
- [ ] Verify indexes: `\d+ tp_record_sources`, `\d+ tp_records`.
- [ ] Apply rollback to verify reversibility.
- [ ] Re-apply forward migration after rollback.

---

## Risks identified during rehearsal

| Risk ID | Description | Severity | Mitigation |
|---|---|---|---|
| B-T1 (revisited) | Index creation on tp_records blocks writes | P2 | Schedule deploy during low-traffic window. If unacceptable, switch to two-file split. |
| B-T8 (new) | `tp_records.organization_id` denormalization on `tp_record_sources` may drift if base is moved across tenants (unlikely but possible) | P3 | Periodic consistency-check follow-up if drift incidents occur. Not deployed in S1. |
| B-S5 (revisited) | Cross-tenant source listing | P0 | Service-layer ACL filter; integration test L4.4. |

---

## Sign-off

- Migration plan reviewed: ✓
- Rollback plan reviewed: ✓
- Pre-deploy checks listed: ✓
- Risks documented: ✓

**Decision:** `GO` for Block B Sprint 1. Live rehearsal happens at S1 entry on staging.
