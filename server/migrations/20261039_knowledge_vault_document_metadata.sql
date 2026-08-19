-- UIA-001/J: the mounted Vault upload service persists these metadata fields.
-- Older fresh schemas created knowledge_docs without them, causing the
-- compatibility DB adapter to accept an upload outside the authoritative PG
-- table and making the subsequent cold Vault read return an empty list.
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS parent_doc_id TEXT;
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS chunk_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE knowledge_docs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_org_category
  ON knowledge_docs (organization_id, category)
  WHERE deleted_at IS NULL;
