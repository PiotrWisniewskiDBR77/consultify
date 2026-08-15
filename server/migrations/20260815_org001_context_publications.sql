-- ORG-001: immutable, tenant-scoped Organization context publications.
-- The legacy organization_context_snapshots row remains a rebuild cache; this
-- append-only table is the publication authority consumed by Chat/Teresa.
ALTER TABLE organization_context_claims
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

ALTER TABLE organization_context_claims
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS organization_context_publications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  source_refs_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_context_publications_org_created
  ON organization_context_publications(organization_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_context_publications_org_hash
  ON organization_context_publications(organization_id, content_hash);
