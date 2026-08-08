-- Forward-only PostgreSQL prerequisite for governed Agent process templates.
--
-- Some long-lived Consultify databases contain ai_playbook_templates but never
-- received the legacy SQLite-oriented content migration that introduced the
-- version table. Agent governance must not depend on replaying that unrelated
-- historical migration, so establish the canonical version owner additively.

CREATE TABLE IF NOT EXISTS ai_playbook_template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES ai_playbook_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  trigger_signal TEXT,
  template_graph TEXT,
  estimated_duration_mins INTEGER,
  changed_by TEXT,
  change_notes TEXT,
  change_type TEXT DEFAULT 'UPDATE',
  status_at_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_playbook_template_versions_template
  ON ai_playbook_template_versions(template_id);

CREATE INDEX IF NOT EXISTS idx_playbook_template_versions_version
  ON ai_playbook_template_versions(template_id, version);
