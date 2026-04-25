-- V8 Chat → Execution Integration — Wave 2 tables
-- WP-W2-AI-01: Chat/Execution integration primitives

-- ==========================================
-- 1. Chat-Execution Handoffs
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_context_snapshots (
  snapshot_id       TEXT PRIMARY KEY,
  snapshot_version  INTEGER NOT NULL DEFAULT 1,
  captured_at       TEXT NOT NULL DEFAULT (datetime('now')),
  workspace_id      TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  project_id        TEXT,
  conversation_id   TEXT,
  execution_run_id  TEXT,
  artifact_refs     TEXT NOT NULL DEFAULT '[]',
  effective_scope_ref TEXT NOT NULL,
  resolved_role_ref TEXT NOT NULL,
  initiator_user_id TEXT NOT NULL,
  consumer_class    TEXT NOT NULL CHECK (consumer_class IN ('chat', 'execution', 'retrieval', 'background', 'worker')),
  privacy_mode      INTEGER NOT NULL DEFAULT 0,
  source_context_refs TEXT NOT NULL DEFAULT '[]',
  drift_events      TEXT NOT NULL DEFAULT '[]',
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_ctx_snap_org      ON v8_context_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_ctx_snap_conv     ON v8_context_snapshots(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_ctx_snap_run      ON v8_context_snapshots(execution_run_id) WHERE execution_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_ctx_snap_user     ON v8_context_snapshots(initiator_user_id);
CREATE INDEX IF NOT EXISTS idx_v8_ctx_snap_captured ON v8_context_snapshots(captured_at);

CREATE TABLE IF NOT EXISTS v8_execution_runs (
  run_id              TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL,
  context_snapshot_id TEXT NOT NULL,
  initiator_user_id   TEXT NOT NULL,
  state               TEXT NOT NULL DEFAULT 'drafting'
                      CHECK (state IN (
                        'drafting', 'planning', 'proposals_ready',
                        'waiting_for_review', 'approved_for_apply', 'rejected',
                        'applying', 'completed', 'failed', 'cancelled', 'expired'
                      )),
  plan_version        INTEGER NOT NULL DEFAULT 1,
  goal                TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at         TEXT,
  expires_at          TEXT,
  metadata            TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_v8_exec_runs_org
  ON v8_execution_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_exec_runs_state
  ON v8_execution_runs(organization_id, state);
CREATE INDEX IF NOT EXISTS idx_v8_exec_runs_initiator
  ON v8_execution_runs(initiator_user_id);
CREATE INDEX IF NOT EXISTS idx_v8_exec_runs_snapshot
  ON v8_execution_runs(context_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_v8_exec_runs_expires
  ON v8_execution_runs(expires_at)
  WHERE expires_at IS NOT NULL AND state = 'waiting_for_review';

CREATE TABLE IF NOT EXISTS v8_action_proposals (
  proposal_id          TEXT PRIMARY KEY,
  execution_run_id     TEXT NOT NULL REFERENCES v8_execution_runs(run_id),
  context_snapshot_ref TEXT NOT NULL,
  proposal_type        TEXT NOT NULL
                       CHECK (proposal_type IN (
                         'create_artifact', 'update_artifact', 'transform_artifact',
                         'link_artifacts', 'workflow_transition',
                         'generate_structured_output', 'review_or_quality_pass',
                         'request_human_decision'
                       )),
  target_ref           TEXT NOT NULL DEFAULT '{}',
  summary              TEXT NOT NULL,
  reason               TEXT NOT NULL,
  mutation_description TEXT NOT NULL DEFAULT '{}',
  risk_class           TEXT NOT NULL
                       CHECK (risk_class IN (
                         'safe_additive', 'safe_update', 'sensitive_update',
                         'destructive', 'governance_transition'
                       )),
  approval_class       TEXT NOT NULL
                       CHECK (approval_class IN (
                         'requires_human_approval', 'policy_approvable', 'auto_executable'
                       )),
  preview_payload      TEXT,
  depends_on           TEXT NOT NULL DEFAULT '[]',
  status               TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN (
                         'draft', 'pending_review', 'approved', 'rejected',
                         'expired', 'policy_allowed'
                       )),
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at          TEXT,
  resolved_by          TEXT
);

CREATE INDEX IF NOT EXISTS idx_v8_proposals_run
  ON v8_action_proposals(execution_run_id);
CREATE INDEX IF NOT EXISTS idx_v8_proposals_status
  ON v8_action_proposals(execution_run_id, status);
CREATE INDEX IF NOT EXISTS idx_v8_proposals_risk
  ON v8_action_proposals(risk_class);

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
