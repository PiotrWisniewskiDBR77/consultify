-- CHAT-OWN-013: make shared project context auditable and reproducible.
-- Existing rows remain explicitly legacy when their provenance/hash is NULL;
-- new writes populate every field and pair the mutation with audit_events in a
-- pinned PostgreSQL transaction.

-- Do not backfill an invented version onto legacy rows. New writes explicitly
-- set version=1; NULL means the old record has not yet entered this lifecycle.
ALTER TABLE project_knowledge ADD COLUMN IF NOT EXISTS version INTEGER;
ALTER TABLE project_knowledge ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE project_knowledge ADD COLUMN IF NOT EXISTS hash_basis TEXT;
ALTER TABLE project_knowledge ADD COLUMN IF NOT EXISTS provenance_json TEXT;
ALTER TABLE project_knowledge ADD COLUMN IF NOT EXISTS updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_project_knowledge_project_version
  ON project_knowledge(project_id, version);

