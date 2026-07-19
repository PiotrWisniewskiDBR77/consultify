-- V4-TASK-07: Decision playbooks
CREATE TABLE IF NOT EXISTS decision_playbooks (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  decision_type TEXT NOT NULL,
  required_fields_json TEXT NOT NULL DEFAULT '[]',
  workflow_stages_json TEXT NOT NULL DEFAULT '[]',
  approval_config_json TEXT DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE decision_playbooks ADD COLUMN IF NOT EXISTS organization_id TEXT;
ALTER TABLE decision_playbooks ADD COLUMN IF NOT EXISTS decision_type TEXT;

CREATE INDEX IF NOT EXISTS idx_decision_playbooks_org ON decision_playbooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_decision_playbooks_type ON decision_playbooks(decision_type);

ALTER TABLE decisions ADD COLUMN IF NOT EXISTS playbook_id TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS required_fields_status TEXT DEFAULT 'incomplete';
