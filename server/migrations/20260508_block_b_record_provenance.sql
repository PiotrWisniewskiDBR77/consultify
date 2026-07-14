-- Block B — Record Provenance & Confidence (EPIC-T8 + EPIC-T9 backbone)
-- Adds:
--   * tp_record_sources             — per-record provenance ledger (multi-source)
--   * tp_records.confidence_score   — 0.00 … 1.00 (NULL = not measured)
--   * tp_records.validation_status  — 'unverified' | 'verified' | 'flagged'
--
-- CTO decisions: 00_CTO_DECISIONS.md Q2 (full migration), Q8 (non-CONCURRENTLY indexes
-- on tp_records, accepting ≤90 s lock window during low-traffic deploy).
-- Spec: tabele-full-product/block-B-record-provenance/evidence/sprint-0/migration-rehearsal.md
--
-- organization_id on tp_record_sources is denormalized TEXT NOT NULL (matches
-- tp_bases.organization_id TEXT convention; per S0-F2). The two-step NOT NULL
-- pattern (DEFAULT then ALTER ... SET NOT NULL) is unnecessary because the table
-- is created empty.
--
-- Idempotent: each ADD COLUMN guarded; CREATE TABLE IF NOT EXISTS; constraints
-- and indexes guarded with EXISTS checks.
-- Reversal: see migrations/rollback/20260508_block_b_record_provenance.down.sql
--
-- FRESH-DB GUARD (2026-07-14): tp_records is created by
-- 700_table_platform_foundation.sql, which sorts AFTER this file on a fresh
-- replay. The whole body is guarded on table existence; 700 re-applies this DDL
-- idempotently, so the final schema is identical. No behaviour change on DBs
-- where tp_records already existed (staging/prod).

BEGIN;

DO $mig20260508b$
BEGIN
IF to_regclass('public.tp_records') IS NOT NULL THEN

  -- -------------------------------------------------------------------------
  -- 1) tp_record_sources: per-record provenance ledger.
  -- -------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS tp_record_sources (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id          TEXT        NOT NULL,
    record_id                UUID        NOT NULL REFERENCES tp_records(id) ON DELETE CASCADE,
    source_type              TEXT        NOT NULL,
    source_uri               TEXT        NULL,
    source_metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    confidence_contribution  NUMERIC(3,2) NULL,
    created_by               TEXT        NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_verified_at         TIMESTAMPTZ NULL,
    last_verified_by         TEXT        NULL,
    archived_at              TIMESTAMPTZ NULL,

    CONSTRAINT tp_record_sources_source_type_check
      CHECK (source_type IN ('manual','document','presentation','external_api','ai_generated','imported')),
    CONSTRAINT tp_record_sources_confidence_range_check
      CHECK (confidence_contribution IS NULL OR (confidence_contribution >= 0.00 AND confidence_contribution <= 1.00))
  );

  CREATE INDEX IF NOT EXISTS idx_tp_record_sources_record         ON tp_record_sources(record_id);
  CREATE INDEX IF NOT EXISTS idx_tp_record_sources_org            ON tp_record_sources(organization_id);
  CREATE INDEX IF NOT EXISTS idx_tp_record_sources_record_active  ON tp_record_sources(record_id) WHERE archived_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_tp_record_sources_source_type    ON tp_record_sources(source_type);

  -- -------------------------------------------------------------------------
  -- 2) tp_records: confidence + validation columns.
  --    Non-CONCURRENTLY index creation per CTO Q8. Worst-case lock estimated
  --    ≤ 90 s in evidence/sprint-0/migration-rehearsal.md.
  -- -------------------------------------------------------------------------
  ALTER TABLE tp_records
    ADD COLUMN IF NOT EXISTS confidence_score   NUMERIC(3,2) NULL,
    ADD COLUMN IF NOT EXISTS validation_status  TEXT         NOT NULL DEFAULT 'unverified';

  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'tp_records_confidence_range_check'
  ) THEN
    ALTER TABLE tp_records
      ADD CONSTRAINT tp_records_confidence_range_check
      CHECK (confidence_score IS NULL OR (confidence_score >= 0.00 AND confidence_score <= 1.00));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'tp_records_validation_status_check'
  ) THEN
    ALTER TABLE tp_records
      ADD CONSTRAINT tp_records_validation_status_check
      CHECK (validation_status IN ('unverified', 'verified', 'flagged'));
  END IF;

  CREATE INDEX IF NOT EXISTS idx_tp_records_validation_status
    ON tp_records(validation_status);

  CREATE INDEX IF NOT EXISTS idx_tp_records_confidence_low
    ON tp_records(confidence_score)
    WHERE confidence_score IS NOT NULL AND confidence_score < 0.60;

END IF;
END
$mig20260508b$;

COMMIT;
