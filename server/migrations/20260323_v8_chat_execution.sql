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
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (context_snapshot_id) REFERENCES v8_context_snapshots(snapshot_id),
  FOREIGN KEY (execution_run_id)    REFERENCES v8_execution_runs(run_id)
);

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
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (underlying_proposal_id) REFERENCES v8_action_proposals(proposal_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_chat_proposals_org
  ON v8_chat_action_proposals(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_chat_proposals_conversation
  ON v8_chat_action_proposals(conversation_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_chat_proposals_underlying
  ON v8_chat_action_proposals(underlying_proposal_id);
CREATE INDEX IF NOT EXISTS idx_v8_chat_proposals_message
  ON v8_chat_action_proposals(message_id);
