-- V8 Chat → Execution Integration — Wave 2 tables
-- WP-W2-AI-01: Chat/Execution integration primitives
--
-- Note: v8_context_snapshots is defined in 20260323_v8_context_snapshot.sql
--       v8_execution_runs and v8_action_proposals are defined in 20260323_v8_execution_spine.sql
--       This file adds only the chat-specific handoff and facade tables.

-- ==========================================
-- 1. Chat-Execution Handoffs
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_chat_execution_handoffs (
  handoff_id            TEXT PRIMARY KEY,
  conversation_id       TEXT NOT NULL,
  context_snapshot_id   TEXT NOT NULL,
  execution_run_id      TEXT NOT NULL,
  organization_id       TEXT NOT NULL,
  initiator_user_id     TEXT NOT NULL,
  intent_classification TEXT NOT NULL DEFAULT '{}',
  goal                  TEXT NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- FRESH-DB GUARD (2026-07-14): this file sorts BEFORE 20260323_v8_context_snapshot.sql
-- and 20260323_v8_execution_spine.sql, which create the referenced tables. Add the FKs
-- (with the same default names Postgres generated for the original inline FKs) only
-- when the target tables exist; 20260323_v8_execution_spine.sql re-adds them as a
-- catch-up, so a fresh replay ends with the identical schema. No behaviour change on
-- already-migrated DBs (applied migrations are never re-run).
DO $$ BEGIN
  IF to_regclass('public.v8_context_snapshots') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'v8_chat_execution_handoffs_context_snapshot_id_fkey') THEN
    ALTER TABLE v8_chat_execution_handoffs
      ADD CONSTRAINT v8_chat_execution_handoffs_context_snapshot_id_fkey
      FOREIGN KEY (context_snapshot_id) REFERENCES v8_context_snapshots(snapshot_id);
  END IF;
  IF to_regclass('public.v8_execution_runs') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'v8_chat_execution_handoffs_execution_run_id_fkey') THEN
    ALTER TABLE v8_chat_execution_handoffs
      ADD CONSTRAINT v8_chat_execution_handoffs_execution_run_id_fkey
      FOREIGN KEY (execution_run_id) REFERENCES v8_execution_runs(run_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_v8_handoffs_org
  ON v8_chat_execution_handoffs(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_handoffs_conversation
  ON v8_chat_execution_handoffs(conversation_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_handoffs_run
  ON v8_chat_execution_handoffs(execution_run_id);
CREATE INDEX IF NOT EXISTS idx_v8_handoffs_user
  ON v8_chat_execution_handoffs(initiator_user_id);

-- ==========================================
-- 2. Chat Action Proposals (facade)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_chat_action_proposals (
  chat_proposal_id       TEXT PRIMARY KEY,
  conversation_id        TEXT NOT NULL,
  message_id             TEXT NOT NULL,
  underlying_proposal_id TEXT NOT NULL,
  organization_id        TEXT NOT NULL,
  display_summary        TEXT NOT NULL,
  rendering_hints        TEXT NOT NULL DEFAULT '{}',
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

-- FRESH-DB GUARD (2026-07-14): see note above — v8_action_proposals is created by
-- 20260323_v8_execution_spine.sql, which sorts after this file.
DO $$ BEGIN
  IF to_regclass('public.v8_action_proposals') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'v8_chat_action_proposals_underlying_proposal_id_fkey') THEN
    ALTER TABLE v8_chat_action_proposals
      ADD CONSTRAINT v8_chat_action_proposals_underlying_proposal_id_fkey
      FOREIGN KEY (underlying_proposal_id) REFERENCES v8_action_proposals(proposal_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_v8_chat_proposals_org
  ON v8_chat_action_proposals(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_chat_proposals_conversation
  ON v8_chat_action_proposals(conversation_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_chat_proposals_underlying
  ON v8_chat_action_proposals(underlying_proposal_id);
CREATE INDEX IF NOT EXISTS idx_v8_chat_proposals_message
  ON v8_chat_action_proposals(message_id);
