-- Presentation production closure: executable template recipes and AI/export audit records.

ALTER TABLE presentation_templates
  ADD COLUMN IF NOT EXISTS template_family TEXT,
  ADD COLUMN IF NOT EXISTS template_recipe_json TEXT DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS layout_policy_json TEXT DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_requirements_json TEXT DEFAULT '[]';

ALTER TABLE presentation_decks
  ADD COLUMN IF NOT EXISTS export_qa_json TEXT DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS export_url TEXT,
  ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'local';

CREATE TABLE IF NOT EXISTS presentation_ai_operations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  deck_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  operation_type TEXT NOT NULL DEFAULT 'agent_edit',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'accepted', 'rejected', 'applied', 'failed')),
  prompt TEXT,
  reply TEXT,
  actions_json TEXT DEFAULT '[]',
  diff_json TEXT DEFAULT '{}',
  original_deck_json TEXT,
  proposed_deck_json TEXT,
  version_before INTEGER,
  version_after INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_presentation_ai_ops_deck ON presentation_ai_operations(deck_id);
CREATE INDEX IF NOT EXISTS idx_presentation_ai_ops_org ON presentation_ai_operations(organization_id);
CREATE INDEX IF NOT EXISTS idx_presentation_ai_ops_status ON presentation_ai_operations(status);

CREATE TABLE IF NOT EXISTS presentation_export_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  deck_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed', 'blocked')),
  quality_result TEXT,
  quality_report_json TEXT DEFAULT '{}',
  fidelity_score INTEGER,
  file_path TEXT,
  file_url TEXT,
  storage_provider TEXT DEFAULT 'local',
  error_category TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_presentation_export_records_deck ON presentation_export_records(deck_id);
CREATE INDEX IF NOT EXISTS idx_presentation_export_records_org ON presentation_export_records(organization_id);

UPDATE presentation_templates
SET template_family = CASE deck_type
  WHEN 'steering_committee' THEN 'Steering Committee Deck'
  WHEN 'program_update' THEN 'Steering Committee Deck'
  WHEN 'assessment_summary' THEN 'DRD Diagnostic Deck'
  WHEN 'tool_workshop' THEN 'Initiative Kickoff Deck'
  ELSE COALESCE(template_family, name)
END
WHERE template_family IS NULL;
