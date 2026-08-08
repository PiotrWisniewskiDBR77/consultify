CREATE UNIQUE INDEX IF NOT EXISTS idx_playbook_template_version_unique
  ON ai_playbook_template_versions(template_id, version);

ALTER TABLE ai_playbook_template_versions ADD COLUMN IF NOT EXISTS runtime_bundle_json TEXT;
ALTER TABLE ai_playbook_template_versions ADD COLUMN IF NOT EXISTS runtime_bundle_digest TEXT;
ALTER TABLE ai_playbook_template_versions ADD COLUMN IF NOT EXISTS content_digest TEXT;

CREATE TABLE IF NOT EXISTS v8_agent_template_governance_events (
  event_id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  organization_id TEXT,
  version INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'revised', 'published', 'deprecated', 'instantiated', 'instantiated_to_planning_case')),
  actor_user_id TEXT NOT NULL,
  reason TEXT,
  execution_run_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id, version) REFERENCES ai_playbook_template_versions(template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_v8_agent_template_events
  ON v8_agent_template_governance_events(template_id, version, created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'v8_agent_template_governance_events'::regclass
       AND conname = 'v8_agent_template_governance_events_event_type_check'
  ) THEN
    ALTER TABLE v8_agent_template_governance_events
      ADD CONSTRAINT v8_agent_template_governance_events_event_type_check
      CHECK (event_type IN ('created','revised','published','deprecated','instantiated','instantiated_to_planning_case'));
  END IF;
END $$;
