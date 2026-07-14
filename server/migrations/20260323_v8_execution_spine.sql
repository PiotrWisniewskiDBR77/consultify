-- V8 Execution/Approval Spine — core governance tables
-- WP-W1-AI-03: Execution/Approval Spine core primitives

-- ==========================================
-- 1. Execution Runs
-- ==========================================

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

-- ==========================================
-- 2. Action Proposals
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_action_proposals (
  proposal_id          TEXT PRIMARY KEY,
  execution_run_id     TEXT NOT NULL,
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
  resolved_by          TEXT,
  FOREIGN KEY (execution_run_id) REFERENCES v8_execution_runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_proposals_run
  ON v8_action_proposals(execution_run_id);
CREATE INDEX IF NOT EXISTS idx_v8_proposals_status
  ON v8_action_proposals(execution_run_id, status);
CREATE INDEX IF NOT EXISTS idx_v8_proposals_risk
  ON v8_action_proposals(risk_class);

-- ==========================================
-- 3. Run State Transitions (audit trail)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_run_state_transitions (
  transition_id   TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL,
  from_state      TEXT NOT NULL,
  to_state        TEXT NOT NULL,
  triggered_by    TEXT NOT NULL,
  reason          TEXT,
  transitioned_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES v8_execution_runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_transitions_run
  ON v8_run_state_transitions(run_id);
CREATE INDEX IF NOT EXISTS idx_v8_transitions_time
  ON v8_run_state_transitions(transitioned_at);

-- ==========================================
-- 4. FRESH-DB PARITY catch-up (2026-07-14)
-- ==========================================
-- 20260323_v8_chat_execution.sql sorts BEFORE this file, so on a fresh replay its
-- FK constraints could not be created inline (referenced tables did not exist yet).
-- Re-add them here idempotently (same default constraint names). No-op on DBs where
-- the constraints already exist (staging/prod).
DO $$ BEGIN
  IF to_regclass('public.v8_chat_execution_handoffs') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'v8_chat_execution_handoffs_context_snapshot_id_fkey') THEN
      ALTER TABLE v8_chat_execution_handoffs
        ADD CONSTRAINT v8_chat_execution_handoffs_context_snapshot_id_fkey
        FOREIGN KEY (context_snapshot_id) REFERENCES v8_context_snapshots(snapshot_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'v8_chat_execution_handoffs_execution_run_id_fkey') THEN
      ALTER TABLE v8_chat_execution_handoffs
        ADD CONSTRAINT v8_chat_execution_handoffs_execution_run_id_fkey
        FOREIGN KEY (execution_run_id) REFERENCES v8_execution_runs(run_id);
    END IF;
  END IF;
  IF to_regclass('public.v8_chat_action_proposals') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'v8_chat_action_proposals_underlying_proposal_id_fkey') THEN
    ALTER TABLE v8_chat_action_proposals
      ADD CONSTRAINT v8_chat_action_proposals_underlying_proposal_id_fkey
      FOREIGN KEY (underlying_proposal_id) REFERENCES v8_action_proposals(proposal_id);
  END IF;
END $$;
