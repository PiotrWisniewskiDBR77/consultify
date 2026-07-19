-- V4-TASK-05: Automation rules engine — triggers, conditions, actions
-- Minimal schema for triggers → conditions → actions; UI builder + dry-run + audit later

CREATE TABLE IF NOT EXISTS task_automation_rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  trigger_config_json TEXT DEFAULT '{}',
  conditions_json TEXT DEFAULT '[]',
  actions_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_automation_rules_org ON task_automation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_task_automation_rules_active ON task_automation_rules(is_active);
