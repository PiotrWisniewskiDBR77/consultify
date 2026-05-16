-- V8 Reports & Presentations — output runtime: exports + quality scores (Wave 17)

CREATE TABLE IF NOT EXISTS v8_output_artifacts (
  artifact_id              TEXT PRIMARY KEY,
  organization_id          TEXT NOT NULL,
  output_type              TEXT NOT NULL
                           CHECK (output_type IN ('report', 'presentation')),
  delivery_state           TEXT NOT NULL DEFAULT 'draft'
                           CHECK (delivery_state IN (
                             'draft', 'generated', 'editing', 'in_review',
                             'ready', 'shared', 'archived'
                           )),
  template_family_ref      TEXT,
  source_initiative_id     TEXT,
  ai_governance_preset_ref TEXT,
  created_by               TEXT NOT NULL,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  last_transition_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_output_artifacts_org
  ON v8_output_artifacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_output_artifacts_state
  ON v8_output_artifacts(organization_id, delivery_state);
CREATE INDEX IF NOT EXISTS idx_v8_output_artifacts_initiative
  ON v8_output_artifacts(source_initiative_id)
  WHERE source_initiative_id IS NOT NULL;

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
