-- Day 131: make document governance and embedding ownership explicit.
ALTER TABLE knowledge_docs
  ADD COLUMN IF NOT EXISTS ai_visibility TEXT NOT NULL DEFAULT 'allowed';

ALTER TABLE knowledge_docs
  ADD COLUMN IF NOT EXISTS sensitivity TEXT NOT NULL DEFAULT 'internal';

ALTER TABLE ai_knowledge_embeddings
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

UPDATE ai_knowledge_embeddings
SET organization_id = NULLIF(metadata->>'organization_id', '')
WHERE organization_id IS NULL
  AND NULLIF(metadata->>'organization_id', '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_embeddings_org_source
  ON ai_knowledge_embeddings (organization_id, source_type);
