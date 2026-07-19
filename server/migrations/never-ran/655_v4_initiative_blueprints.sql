-- V4-INIT-03: Initiative blueprint templates
-- Extends initiative_templates with WBS, milestone dependencies, role templates, and DoD per level.

ALTER TABLE initiative_templates ADD COLUMN IF NOT EXISTS wbs_template_json TEXT;
ALTER TABLE initiative_templates ADD COLUMN IF NOT EXISTS milestone_dependencies_json TEXT;
ALTER TABLE initiative_templates ADD COLUMN IF NOT EXISTS role_templates_json TEXT;
ALTER TABLE initiative_templates ADD COLUMN IF NOT EXISTS dod_per_level_json TEXT;
ALTER TABLE initiative_templates ADD COLUMN IF NOT EXISTS blueprint_version INTEGER DEFAULT 1;
ALTER TABLE initiative_templates ADD COLUMN IF NOT EXISTS complexity_level TEXT DEFAULT 'medium';
ALTER TABLE initiative_templates ADD COLUMN IF NOT EXISTS estimated_duration_weeks INTEGER;
ALTER TABLE initiative_templates ADD COLUMN IF NOT EXISTS tags TEXT;

CREATE TABLE IF NOT EXISTS blueprint_wbs_items (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  template_id TEXT NOT NULL REFERENCES initiative_templates(id) ON DELETE CASCADE,
  parent_id TEXT,
  title TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'work_package',
  level INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  estimated_hours REAL,
  deliverables TEXT,
  acceptance_criteria TEXT,
  assigned_role TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wbs_items_template ON blueprint_wbs_items(template_id);
CREATE INDEX IF NOT EXISTS idx_wbs_items_parent ON blueprint_wbs_items(parent_id);
