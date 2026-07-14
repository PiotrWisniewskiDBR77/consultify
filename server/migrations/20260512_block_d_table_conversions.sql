-- Block D — Table → Doc/Deck Conversion (EPIC-T13 · Sprint D-S1)
-- Adds:
--   * tp_table_conversions  — append-only audit row for every Tabele → Wordy /
--                             Tabele → Prezentacje conversion. The actual
--                             artifact lives in the existing v8 artifact
--                             pipeline (presentations / report_modes); this
--                             table records the bridge so we can replay,
--                             re-target, and analytics-track conversions.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, indexes guarded.
-- Reversal:   server/migrations/rollback/20260512_block_d_table_conversions.down.sql
--
-- CTO decisions:
--   - 00_CTO_DECISIONS.md Q11 (reuse Document Studio / DeckBuilder runtimes;
--     no parallel doctrine, no new V8 snapshot kind).
--   - 00_CTO_DECISIONS.md Q16 (thin adapter inside
--     TableArtifactConversionService; this row is the audit, not the data).
--
-- Spec:
--   tabele-full-product/block-D-integration-evidence/audit-findings/
--     V8_CONTRACT_AUDIT_2026-05-08.md
--
-- Notes on column types:
--   * organization_id / workspace_id / initiated_by are TEXT to match the
--     rest of the tp_* family (tp_source_packs, tp_record_sources).
--   * source_pack_id is nullable — conversion may capture a fresh snapshot
--     without going through Block C's curator flow.
--   * artifact_run_id is NULL until the materialize step succeeds; we never
--     leave the row dangling because failures set status='failed' +
--     failure_reason.
--   * v8_snapshot is JSONB so the conversion can be replayed even after the
--     source records mutate.

BEGIN;

-- FRESH-DB GUARD (2026-07-14): tp_tables (and tp_source_packs, whose creation in
-- 20260510_block_c_source_pack.sql is itself deferred on a fresh replay) come from
-- 700_table_platform_foundation.sql and its parity section, which sort AFTER this
-- file. The whole body is guarded; 700 re-applies this DDL idempotently after
-- creating both referenced tables, so the final schema is identical.
DO $mig20260512$
BEGIN
IF to_regclass('public.tp_tables') IS NOT NULL
   AND to_regclass('public.tp_source_packs') IS NOT NULL THEN

CREATE TABLE IF NOT EXISTS tp_table_conversions (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     TEXT         NOT NULL,
  workspace_id        TEXT         NOT NULL,
  table_id            UUID         NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  source_pack_id      UUID         NULL REFERENCES tp_source_packs(id) ON DELETE SET NULL,
  target              TEXT         NOT NULL,
  title               TEXT         NULL,
  outline             JSONB        NULL,
  v8_snapshot         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  status              TEXT         NOT NULL,
  artifact_run_id     UUID         NULL,
  artifact_deep_link  TEXT         NULL,
  initiated_by        TEXT         NOT NULL,
  initiated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ  NULL,
  failure_reason      TEXT         NULL,
  failure_stage       TEXT         NULL,

  CONSTRAINT tp_table_conversions_target_check
    CHECK (target IN ('document','presentation')),
  CONSTRAINT tp_table_conversions_status_check
    CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  CONSTRAINT tp_table_conversions_failure_stage_check
    CHECK (
      failure_stage IS NULL OR
      failure_stage IN ('snapshot','materialize','register','retry')
    )
);

CREATE INDEX IF NOT EXISTS idx_tp_table_conversions_org
  ON tp_table_conversions(organization_id);
CREATE INDEX IF NOT EXISTS idx_tp_table_conversions_workspace
  ON tp_table_conversions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tp_table_conversions_table
  ON tp_table_conversions(table_id, initiated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tp_table_conversions_source_pack
  ON tp_table_conversions(source_pack_id) WHERE source_pack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tp_table_conversions_status
  ON tp_table_conversions(status, initiated_at DESC) WHERE status IN ('queued','running');

END IF;
END
$mig20260512$;

COMMIT;
