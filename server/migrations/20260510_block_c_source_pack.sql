-- Block C — Source Pack Builder (EPIC-T12 · Sprint C-S6)
-- Adds:
--   * tp_source_packs   — curated bundle of records (and optional notes)
--                         that feed into AI Editor column/record/source
--                         level handlers as `payload.sourcePackId`. Each
--                         pack carries an immutable V8 snapshot so consumers
--                         see the data exactly as the curator approved it.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, indexes guarded.
-- Reversal: see migrations/rollback/20260510_block_c_source_pack.down.sql
--
-- CTO decisions: 00_CTO_DECISIONS.md Q4 (deterministic ranking — no LLM
-- spend), Q12 (pack addressability + ACL filter at every step).
-- Spec: tabele-full-product/block-C-ai-operator/epics/EPIC-T12_SOURCE_PACK_BUILDER.md
--
-- Notes on column types:
--   * organization_id / workspace_id are TEXT to match every other tp_*
--     table (tp_bases.organization_id, tp_record_sources.organization_id).
--   * owner_user_id is TEXT to match tp_record_sources.created_by.
--   * candidate_record_ids is UUID[] to match tp_records.id.
--   * v8_snapshot is JSONB. The shape is { records: [{id, data, confidence}],
--     fields: [{id, name, fieldType}], capturedAt: ISODateString,
--     captureSource: 'source_pack_create' }.

BEGIN;

-- FRESH-DB GUARD (2026-07-14): tp_tables is created by
-- 700_table_platform_foundation.sql, which sorts AFTER this file on a fresh
-- replay. The whole body is guarded on table existence; 700 re-applies this DDL
-- idempotently, so the final schema is identical. No behaviour change on DBs
-- where tp_tables already existed (staging/prod).
DO $mig20260510$
BEGIN
IF to_regclass('public.tp_tables') IS NOT NULL THEN

CREATE TABLE IF NOT EXISTS tp_source_packs (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      TEXT         NOT NULL,
  workspace_id         TEXT         NOT NULL,
  owner_user_id        TEXT         NOT NULL,
  table_id             UUID         NULL REFERENCES tp_tables(id) ON DELETE SET NULL,
  name                 TEXT         NOT NULL,
  description          TEXT         NULL,
  candidate_record_ids UUID[]       NOT NULL DEFAULT '{}',
  v8_snapshot          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  used_count           INTEGER      NOT NULL DEFAULT 0,
  archived_at          TIMESTAMPTZ  NULL,

  CONSTRAINT tp_source_packs_name_check
    CHECK (length(name) > 0 AND length(name) <= 200),
  CONSTRAINT tp_source_packs_used_count_check
    CHECK (used_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_tp_source_packs_org
  ON tp_source_packs(organization_id);
CREATE INDEX IF NOT EXISTS idx_tp_source_packs_workspace
  ON tp_source_packs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tp_source_packs_table
  ON tp_source_packs(table_id) WHERE table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tp_source_packs_active
  ON tp_source_packs(organization_id, created_at DESC) WHERE archived_at IS NULL;

END IF;
END
$mig20260510$;

COMMIT;
