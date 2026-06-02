-- V8 Tool Governance & HITL — core governance tables
-- WP-W1-AI-04: Tool Governance and HITL core primitives
--
-- Decisions implemented:
--   D19 — new tool defaults to requires_human_approval until classified
--   D20 — project admin may tighten but never loosen (enforced in service layer)
--   D22 — background jobs use deferred_approval (enforced in service layer)

-- ==========================================
-- 1. Tool Catalog
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_tool_catalog (
  tool_id                TEXT PRIMARY KEY,
  organization_id        TEXT NOT NULL,
  name                   TEXT NOT NULL,
  description            TEXT NOT NULL,
  category               TEXT NOT NULL
                         CHECK (category IN (
                           'retrieval', 'artifact_read', 'artifact_write',
                           'workflow_action', 'communication',
                           'external_integration', 'system_utility'
                         )),
  risk_class             TEXT NOT NULL DEFAULT 'medium_risk'
                         CHECK (risk_class IN (
                           'no_risk', 'low_risk', 'medium_risk',
                           'high_risk', 'critical'
                         )),
  mutation_type          TEXT NOT NULL
                         CHECK (mutation_type IN (
                           'read_only', 'bounded_write', 'workflow_mutation',
                           'external_side_effect', 'sensitive_data_access'
                         )),
  classification_status  TEXT NOT NULL DEFAULT 'proposed'
                         CHECK (classification_status IN (
                           'proposed', 'ratified', 'under_review'
                         )),
  default_approval_mode  TEXT NOT NULL DEFAULT 'requires_human_approval'
                         CHECK (default_approval_mode IN (
                           'requires_human_approval', 'policy_approvable', 'auto_executable'
                         )),
  classified_by          TEXT,
  classified_at          TEXT,
  version                TEXT NOT NULL DEFAULT '1.0.0',
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_tool_catalog_org
  ON v8_tool_catalog(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_tool_catalog_risk
  ON v8_tool_catalog(organization_id, risk_class);
CREATE INDEX IF NOT EXISTS idx_v8_tool_catalog_status
  ON v8_tool_catalog(organization_id, classification_status);

-- ==========================================
-- 2. Consumer Tool Policies
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_consumer_tool_policies (
  policy_id              TEXT PRIMARY KEY,
  organization_id        TEXT NOT NULL,
  project_id             TEXT,
  consumer_class         TEXT NOT NULL
                         CHECK (consumer_class IN (
                           'chat', 'execution', 'retrieval', 'background', 'worker'
                         )),
  tool_id                TEXT NOT NULL,
  allowed                INTEGER NOT NULL DEFAULT 1,
  approval_override      TEXT NOT NULL DEFAULT 'inherit_from_tool'
                         CHECK (approval_override IN (
                           'inherit_from_tool', 'force_human_approval',
                           'force_policy_gate', 'force_blocked'
                         )),
  max_invocations_per_run INTEGER,
  effective_from         TEXT NOT NULL DEFAULT (datetime('now')),
  effective_until        TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tool_id) REFERENCES v8_tool_catalog(tool_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_consumer_policies_org
  ON v8_consumer_tool_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_consumer_policies_tool
  ON v8_consumer_tool_policies(organization_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_v8_consumer_policies_consumer
  ON v8_consumer_tool_policies(organization_id, consumer_class);
CREATE INDEX IF NOT EXISTS idx_v8_consumer_policies_project
  ON v8_consumer_tool_policies(organization_id, project_id)
  WHERE project_id IS NOT NULL;

-- ==========================================
-- 3. Tool Invocation Log
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_tool_invocation_log (
  invocation_id          TEXT PRIMARY KEY,
  organization_id        TEXT NOT NULL,
  tool_id                TEXT NOT NULL,
  consumer_class         TEXT NOT NULL
                         CHECK (consumer_class IN (
                           'chat', 'execution', 'retrieval', 'background', 'worker'
                         )),
  context_snapshot_id    TEXT NOT NULL,
  execution_run_id       TEXT,
  initiator_user_id      TEXT NOT NULL,
  parameters             TEXT NOT NULL DEFAULT '{}',
  approval_result        TEXT NOT NULL
                         CHECK (approval_result IN (
                           'allowed', 'blocked', 'requires_approval', 'deferred_approval'
                         )),
  policy_ref             TEXT,
  block_reason           TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tool_id) REFERENCES v8_tool_catalog(tool_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_invocation_log_org
  ON v8_tool_invocation_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_invocation_log_tool
  ON v8_tool_invocation_log(organization_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_v8_invocation_log_run
  ON v8_tool_invocation_log(execution_run_id)
  WHERE execution_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_v8_invocation_log_time
  ON v8_tool_invocation_log(created_at);

-- ==========================================
-- 4. Tool Invocation Traces (7-step support visibility)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_tool_invocation_traces (
  trace_id               TEXT PRIMARY KEY,
  invocation_id          TEXT NOT NULL,
  tool_id                TEXT NOT NULL,
  consumer_class         TEXT NOT NULL
                         CHECK (consumer_class IN (
                           'chat', 'execution', 'retrieval', 'background', 'worker'
                         )),
  execution_run_id       TEXT,
  delegation_id          TEXT,
  initiating_user_ref    TEXT NOT NULL,
  effective_role_ref     TEXT NOT NULL,
  context_snapshot_ref   TEXT NOT NULL,
  tool_risk_class        TEXT NOT NULL
                         CHECK (tool_risk_class IN (
                           'no_risk', 'low_risk', 'medium_risk',
                           'high_risk', 'critical'
                         )),
  consumer_policy_ref    TEXT NOT NULL,
  approval_state         TEXT NOT NULL
                         CHECK (approval_state IN (
                           'human_approved', 'policy_approved', 'blocked',
                           'expired', 'auto_executed'
                         )),
  block_reason           TEXT,
  blocking_policy_ref    TEXT,
  approval_ref           TEXT,
  invocation_result      TEXT NOT NULL
                         CHECK (invocation_result IN (
                           'success', 'failed', 'not_executed'
                         )),
  timestamp              TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (invocation_id) REFERENCES v8_tool_invocation_log(invocation_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_traces_invocation
  ON v8_tool_invocation_traces(invocation_id);
CREATE INDEX IF NOT EXISTS idx_v8_traces_tool
  ON v8_tool_invocation_traces(tool_id);
CREATE INDEX IF NOT EXISTS idx_v8_traces_time
  ON v8_tool_invocation_traces(timestamp);
