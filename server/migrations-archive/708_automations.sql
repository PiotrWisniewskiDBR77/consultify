-- 708: Automations engine for Table Platform
-- Triggers, actions, run history, and monthly run accounting

CREATE TABLE IF NOT EXISTS tp_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES tp_bases(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tp_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_automations_table ON tp_automations(table_id, enabled);

CREATE TABLE IF NOT EXISTS tp_automation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES tp_automations(id) ON DELETE CASCADE,
  action_order INTEGER NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tp_automation_actions_automation ON tp_automation_actions(automation_id, action_order);

CREATE TABLE IF NOT EXISTS tp_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES tp_automations(id) ON DELETE CASCADE,
  trigger_record_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  action_results JSONB DEFAULT '[]',
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tp_automation_runs_automation ON tp_automation_runs(automation_id, started_at DESC);

CREATE TABLE IF NOT EXISTS tp_automation_run_counts (
  organization_id TEXT NOT NULL,
  month TEXT NOT NULL,
  run_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, month)
);
