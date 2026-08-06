-- Ordering guard: enforcement extension sorts before the historical tool
-- governance base file.

CREATE TABLE IF NOT EXISTS v8_tool_catalog (
  tool_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'retrieval', 'artifact_read', 'artifact_write', 'workflow_action',
    'communication', 'external_integration', 'system_utility'
  )),
  risk_class TEXT NOT NULL DEFAULT 'medium_risk' CHECK (risk_class IN (
    'no_risk', 'low_risk', 'medium_risk', 'high_risk', 'critical'
  )),
  mutation_type TEXT NOT NULL CHECK (mutation_type IN (
    'read_only', 'bounded_write', 'workflow_mutation',
    'external_side_effect', 'sensitive_data_access'
  )),
  classification_status TEXT NOT NULL DEFAULT 'proposed' CHECK (
    classification_status IN ('proposed', 'ratified', 'under_review')
  ),
  default_approval_mode TEXT NOT NULL DEFAULT 'requires_human_approval' CHECK (
    default_approval_mode IN (
      'requires_human_approval', 'policy_approvable', 'auto_executable'
    )
  ),
  classified_by TEXT,
  classified_at TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS v8_tool_invocation_log (
  invocation_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  tool_id TEXT NOT NULL REFERENCES v8_tool_catalog(tool_id),
  consumer_class TEXT NOT NULL CHECK (
    consumer_class IN ('chat', 'execution', 'retrieval', 'background', 'worker')
  ),
  context_snapshot_id TEXT NOT NULL,
  execution_run_id TEXT,
  initiator_user_id TEXT NOT NULL,
  parameters TEXT NOT NULL DEFAULT '{}',
  approval_result TEXT NOT NULL CHECK (
    approval_result IN (
      'allowed', 'blocked', 'requires_approval', 'deferred_approval'
    )
  ),
  policy_ref TEXT,
  block_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
