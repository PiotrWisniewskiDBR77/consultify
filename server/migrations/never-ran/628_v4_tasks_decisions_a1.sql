-- V4-TASK-02: Custom fields framework (minimal)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS custom_fields_json TEXT DEFAULT '{}';
CREATE TABLE IF NOT EXISTS task_custom_field_schemas (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'task',
  field_key TEXT NOT NULL,
  field_type TEXT NOT NULL,
  label TEXT,
  required INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, entity_type, field_key)
);
CREATE INDEX IF NOT EXISTS idx_task_custom_field_schemas_org ON task_custom_field_schemas(organization_id);

-- V4-TASK-03: Workflow transitions (from -> to, optional guard)
CREATE TABLE IF NOT EXISTS task_status_transitions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  guard_expression TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, from_status, to_status)
);
CREATE INDEX IF NOT EXISTS idx_task_status_transitions_org ON task_status_transitions(organization_id);

-- V4-TASK-07: Decision playbooks — workflow_status
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS workflow_status TEXT DEFAULT 'proposed';
CREATE INDEX IF NOT EXISTS idx_decisions_workflow_status ON decisions(workflow_status);
