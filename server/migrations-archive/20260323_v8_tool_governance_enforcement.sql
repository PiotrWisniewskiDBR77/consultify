-- V8 Tool Governance Enforcement — deferred approval columns & index
-- Wave 5: Consumer Class Enforcement, Deferred Approval, Subagent Governance

ALTER TABLE v8_tool_invocation_log ADD COLUMN deferred_at TEXT;
ALTER TABLE v8_tool_invocation_log ADD COLUMN deferred_resolved_at TEXT;
ALTER TABLE v8_tool_invocation_log ADD COLUMN deferred_resolved_by TEXT;

CREATE INDEX IF NOT EXISTS idx_v8_tool_inv_deferred
  ON v8_tool_invocation_log(organization_id, approval_result)
  WHERE approval_result = 'deferred_approval';
