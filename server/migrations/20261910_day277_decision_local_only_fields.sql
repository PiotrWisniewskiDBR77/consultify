CREATE TABLE IF NOT EXISTS decision_enhancements (
  decision_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  reminders JSONB NOT NULL DEFAULT '[]'::jsonb,
  escalation_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  context_details TEXT NOT NULL DEFAULT '',
  consequence_scenarios JSONB,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_enhancements_org
  ON decision_enhancements (organization_id);
