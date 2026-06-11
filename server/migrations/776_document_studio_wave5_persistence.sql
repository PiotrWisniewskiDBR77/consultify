-- W5: M18 Document Studio — wave5 persistence migration
-- Replaces in-memory Map stores in documentVersionSnapshotService.ts
-- and documentCommentsService.ts with real Postgres tables.
-- Reference pattern: 752_p20_deck_version_and_history.sql (M19 presentation_deck_versions)

CREATE TABLE IF NOT EXISTS document_version_snapshots (
  version_id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
  captured_by TEXT NOT NULL,
  label TEXT,
  reason TEXT,
  status_at_capture TEXT NOT NULL,
  schema_json JSONB NOT NULL DEFAULT '{}',
  origin TEXT NOT NULL DEFAULT 'manual'
);

CREATE INDEX IF NOT EXISTS idx_dvs_artifact ON document_version_snapshots(artifact_id, version_number ASC);
CREATE INDEX IF NOT EXISTS idx_dvs_org ON document_version_snapshots(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dvs_artifact_version ON document_version_snapshots(artifact_id, version_number);

CREATE TABLE IF NOT EXISTS document_comments (
  comment_id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  parent_comment_id TEXT,
  anchor_json JSONB NOT NULL DEFAULT '{"kind":"document"}',
  author_id TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_by TEXT,
  resolved_at TEXT,
  resolve_reason TEXT,
  reopened_by TEXT,
  reopened_at TEXT,
  deleted_by TEXT,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dc_artifact ON document_comments(artifact_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_dc_org ON document_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_dc_thread ON document_comments(thread_id);
