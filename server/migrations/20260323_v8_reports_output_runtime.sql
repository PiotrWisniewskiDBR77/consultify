-- V8 Reports & Presentations — output runtime: exports + quality scores (Wave 17)

CREATE TABLE IF NOT EXISTS v8_output_exports (
  export_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  format TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  completed_at TEXT
);

ALTER TABLE v8_output_artifacts ADD COLUMN IF NOT EXISTS quality_scores TEXT;
CREATE INDEX IF NOT EXISTS idx_v8_artifacts_org_type ON v8_output_artifacts(organization_id, output_type);
CREATE INDEX IF NOT EXISTS idx_v8_exports_artifact ON v8_output_exports(artifact_id, organization_id);
