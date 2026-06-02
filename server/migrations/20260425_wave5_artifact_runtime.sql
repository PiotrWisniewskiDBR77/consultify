CREATE TABLE IF NOT EXISTS wave5_artifacts (
  artifact_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  project_id TEXT,
  conversation_id TEXT,
  research_session_id TEXT,
  ai_run_id TEXT,
  trust_bundle_id TEXT,
  citations_json TEXT NOT NULL DEFAULT '[]',
  source_refs_json TEXT NOT NULL DEFAULT '[]',
  provenance_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  committed_at TEXT
);

CREATE TABLE IF NOT EXISTS wave5_artifact_versions (
  version_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  mutation_id TEXT,
  provenance_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wave5_mutation_proposals (
  mutation_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  status TEXT NOT NULL,
  mutation_type TEXT NOT NULL,
  summary TEXT,
  before_content TEXT NOT NULL,
  proposed_content TEXT NOT NULL,
  diff_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT,
  committed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_wave5_artifacts_org_status
  ON wave5_artifacts(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_wave5_versions_artifact
  ON wave5_artifact_versions(artifact_id, version);

CREATE INDEX IF NOT EXISTS idx_wave5_mutations_artifact
  ON wave5_mutation_proposals(artifact_id, status);
