-- Persist downstream action contracts and source lineage for Interview Insight outputs.
-- These columns are intentionally optional so existing artifacts remain readable.

ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS action_contract_json TEXT DEFAULT '{}';
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS source_pack_json TEXT DEFAULT '{}';
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS evidence_refs_json TEXT DEFAULT '[]';

ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS action_contract_json TEXT DEFAULT '{}';
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS source_pack_json TEXT DEFAULT '{}';
ALTER TABLE my_ideas ADD COLUMN IF NOT EXISTS evidence_refs_json TEXT DEFAULT '[]';

CREATE TABLE IF NOT EXISTS generated_workbooks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  prompt TEXT,
  schema_json TEXT,
  sheet_count INTEGER DEFAULT 1,
  file_name TEXT,
  file_size INTEGER,
  validation_errors TEXT,
  quality_score REAL,
  pipeline_log TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS action_contract_json TEXT DEFAULT '{}';
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS source_pack_json TEXT DEFAULT '{}';
ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS evidence_refs_json TEXT DEFAULT '[]';

ALTER TABLE presentation_decks ADD COLUMN IF NOT EXISTS source_refs_json TEXT DEFAULT '{}';
