-- Block C — Table QA Engine (EPIC-T11 · Sprint C-S4)
-- Adds:
--   * tp_qa_reports                    — append-only health reports computed by TableQaService.
--                                        Each row captures one 5-axis run for a single table.
--   * tp_qa_suggestion_dismissals      — per-table durable suppression of QA suggestions.
--                                        Keyed on a stable fingerprint so subsequent recomputes
--                                        keep dismissed suggestions hidden until the underlying
--                                        deviation changes shape.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, indexes guarded.
-- Reversal: see migrations/rollback/20260509_block_c_qa_engine.down.sql
--
-- CTO decisions: 00_CTO_DECISIONS.md Q4 (token cost-control invariant — QA is
-- deterministic and does NOT touch AiUsageService), Q11 (5-axis health model).
-- Spec: tabele-full-product/block-C-ai-operator/epics/EPIC-T11_TABLE_QA_ENGINE.md
--
-- workspace_id / organization_id are TEXT to match tp_bases.workspace_id /
-- tp_bases.organization_id. computed_by is TEXT (user id or 'system:scheduler').

BEGIN;

-- FRESH-DB GUARD (2026-07-14): tp_tables is created by
-- 700_table_platform_foundation.sql, which sorts AFTER this file on a fresh
-- replay. The whole body is guarded on table existence; 700 re-applies this DDL
-- idempotently, so the final schema is identical. No behaviour change on DBs
-- where tp_tables already existed (staging/prod).
DO $mig20260509$
BEGIN
IF to_regclass('public.tp_tables') IS NOT NULL THEN

-- ---------------------------------------------------------------------------
-- 1) tp_qa_reports — append-only ledger of QA computations.
--    The latest row per table_id is the canonical "current" report; older rows
--    are retained for audit/trend analysis. Cleanup (≥30 days) is owned by an
--    external cron, not by this migration.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tp_qa_reports (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id        UUID         NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  organization_id TEXT         NOT NULL,
  workspace_id    TEXT         NOT NULL,
  computed_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  computed_by     TEXT         NOT NULL,
  trigger_kind    TEXT         NOT NULL,
  overall_score   NUMERIC(4,3) NOT NULL,
  axes            JSONB        NOT NULL DEFAULT '{}'::jsonb,
  suggestions     JSONB        NOT NULL DEFAULT '[]'::jsonb,
  computation_ms  INTEGER      NULL,

  CONSTRAINT tp_qa_reports_overall_range_check
    CHECK (overall_score >= 0.000 AND overall_score <= 1.000),
  CONSTRAINT tp_qa_reports_trigger_check
    CHECK (trigger_kind IN ('on_demand','scheduled','record_write','migration'))
);

CREATE INDEX IF NOT EXISTS idx_tp_qa_reports_table_recent
  ON tp_qa_reports(table_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tp_qa_reports_org
  ON tp_qa_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_tp_qa_reports_workspace
  ON tp_qa_reports(workspace_id);

-- ---------------------------------------------------------------------------
-- 2) tp_qa_suggestion_dismissals — durable per-table suppression list.
--    fingerprint is computed by TableQaService and is stable across recomputes
--    when the underlying deviation has the same shape (same axis +
--    recommendedAction.kind + level + payload anchor fields). Reasons live in
--    a free-text column; UI renders them on the suggestion card history view.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tp_qa_suggestion_dismissals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id        UUID        NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  organization_id TEXT        NOT NULL,
  fingerprint     TEXT        NOT NULL,
  reason          TEXT        NULL,
  dismissed_by    TEXT        NOT NULL,
  dismissed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tp_qa_suggestion_dismissals_unique
    UNIQUE (table_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_tp_qa_dismissals_table
  ON tp_qa_suggestion_dismissals(table_id);
CREATE INDEX IF NOT EXISTS idx_tp_qa_dismissals_org
  ON tp_qa_suggestion_dismissals(organization_id);

END IF;
END
$mig20260509$;

COMMIT;
