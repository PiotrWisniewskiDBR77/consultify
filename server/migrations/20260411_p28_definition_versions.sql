-- P28 Assessment definition/version separation + stricter workbench metadata.

ALTER TABLE assessments ADD COLUMN IF NOT EXISTS assessment_definition_id TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS assessment_definition_version TEXT;

CREATE TABLE IF NOT EXISTS assessment_definitions (
  id TEXT PRIMARY KEY,
  methodology_id TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  is_read_only INTEGER NOT NULL DEFAULT 0,
  definition_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_definitions_methodology_version
  ON assessment_definitions(methodology_id, version);

CREATE INDEX IF NOT EXISTS idx_assessment_definitions_status
  ON assessment_definitions(status, methodology_id);
