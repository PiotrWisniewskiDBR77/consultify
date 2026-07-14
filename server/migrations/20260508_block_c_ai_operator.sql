-- Block C — AI Operator (EPIC-T10 + EPIC-T11 + EPIC-T12 backbone migration)
-- Adds:
--   * tp_schema_proposals.level         — AI Editor level (cell..source) when proposal originates from TableAiEditorService.
--                                          NULL preserves existing chat-to-schema rows untouched.
--   * tp_workspace_settings (NEW)       — per-workspace AI cost-control envelope.
--                                          ai_daily_token_budget defaults to 2_000_000 per CTO Q4 + Q14
--                                          calibration (audit-findings/AI_OPERATOR_BASELINE_2026-05-08.md).
--   * tp_ai_usage (NEW)                 — append-only ledger of every AI call routed
--                                          through TableAiEditorService / TableQaService /
--                                          SourcePackBuilderService.
--
-- Idempotent: each ADD COLUMN guarded; CREATE TABLE IF NOT EXISTS; constraints
-- guarded with EXISTS checks. Reversal: see migrations/rollback/20260508_block_c_ai_operator.down.sql
--
-- CTO decisions: 00_CTO_DECISIONS.md Q4 (token cost control), Q10 (AI Editor 8 levels),
-- Q14 (AI cost control in C-S0 before any AI mutation endpoint).
-- Spec: tabele-full-product/block-C-ai-operator/audit-findings/AI_OPERATOR_BASELINE_2026-05-08.md
--
-- workspace_id is TEXT (matches existing tp_schema_proposals.workspace_id TEXT
-- convention). actor_user_id is TEXT (matches tp_audit_events.actor_id convention).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) tp_schema_proposals.level — extend the existing schema-proposal envelope
--    so the AI Editor can co-exist with the chat-to-schema flow without forking
--    the proposal table.
-- ---------------------------------------------------------------------------
-- FRESH-DB GUARD (2026-07-14): tp_schema_proposals is created by
-- 700_table_platform_foundation.sql, which sorts AFTER this file on a fresh
-- replay. Section 1 is guarded on table existence; 700 re-applies it
-- idempotently, so the final schema is identical. Sections 2-3 below are
-- self-contained and unaffected.
DO $$
BEGIN
  IF to_regclass('public.tp_schema_proposals') IS NOT NULL THEN
    ALTER TABLE tp_schema_proposals
      ADD COLUMN IF NOT EXISTS level TEXT NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM   pg_constraint
      WHERE  conname = 'tp_schema_proposals_level_check'
    ) THEN
      ALTER TABLE tp_schema_proposals
        ADD CONSTRAINT tp_schema_proposals_level_check
        CHECK (level IS NULL OR level IN (
          'cell','record','column','structure',
          'view','relational','methodological','source'
        ));
    END IF;

    CREATE INDEX IF NOT EXISTS idx_tp_schema_proposals_level
      ON tp_schema_proposals(level)
      WHERE level IS NOT NULL;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2) tp_workspace_settings — per-workspace AI cost-control envelope.
--    Default budget 2_000_000 tokens / day (CTO Q14 calibration).
--    tokens_used_today resets daily via cron (no scheduling enforced here;
--    AiUsageService.consume() resets row whenever last_reset_at is older than
--    the current UTC date).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tp_workspace_settings (
  workspace_id          TEXT        PRIMARY KEY,
  ai_daily_token_budget INTEGER     NOT NULL DEFAULT 2000000,
  tokens_used_today     INTEGER     NOT NULL DEFAULT 0,
  last_reset_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tp_workspace_settings_budget_check
    CHECK (ai_daily_token_budget > 0),
  CONSTRAINT tp_workspace_settings_used_check
    CHECK (tokens_used_today >= 0)
);

CREATE INDEX IF NOT EXISTS idx_tp_workspace_settings_last_reset
  ON tp_workspace_settings(last_reset_at);

-- ---------------------------------------------------------------------------
-- 3) tp_ai_usage — append-only audit ledger for every AI call.
--    surface enumerates the consumer ('ai_editor', 'qa_engine', 'source_pack',
--    plus any pre-existing surface that re-uses the budget gate after C-S0
--    re-targeting).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tp_ai_usage (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    TEXT        NOT NULL REFERENCES tp_workspace_settings(workspace_id),
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  surface         TEXT        NOT NULL,
  level           TEXT        NULL,
  proposal_id     UUID        NULL,
  actor_user_id   TEXT        NOT NULL,
  tokens_input    INTEGER     NOT NULL,
  tokens_output   INTEGER     NOT NULL,
  model           TEXT        NOT NULL,
  status          TEXT        NOT NULL,
  error_code      TEXT        NULL,

  CONSTRAINT tp_ai_usage_surface_check
    CHECK (surface IN (
      'ai_editor','qa_engine','source_pack',
      'summarizer','classification','schema_proposal','other'
    )),
  CONSTRAINT tp_ai_usage_level_check
    CHECK (level IS NULL OR level IN (
      'cell','record','column','structure',
      'view','relational','methodological','source'
    )),
  CONSTRAINT tp_ai_usage_status_check
    CHECK (status IN ('success','soft_warn','hard_cap_429','error')),
  CONSTRAINT tp_ai_usage_tokens_check
    CHECK (tokens_input >= 0 AND tokens_output >= 0)
);

CREATE INDEX IF NOT EXISTS idx_tp_ai_usage_workspace
  ON tp_ai_usage(workspace_id);
-- Anchor to UTC so the expression is IMMUTABLE: date_trunc on a timestamptz is
-- session-timezone dependent (not immutable) and cannot be indexed directly.
CREATE INDEX IF NOT EXISTS idx_tp_ai_usage_workspace_day
  ON tp_ai_usage(workspace_id, date_trunc('day', occurred_at AT TIME ZONE 'UTC'));
CREATE INDEX IF NOT EXISTS idx_tp_ai_usage_proposal
  ON tp_ai_usage(proposal_id) WHERE proposal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tp_ai_usage_actor
  ON tp_ai_usage(actor_user_id);

COMMIT;
