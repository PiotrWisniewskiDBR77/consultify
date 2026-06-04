-- F3: per-project knowledge shared with team members (text snippets + uploaded
-- files). Text is appended to Teresa's system prompt; file doc_ids are merged
-- into the RAG scope for chats in the project. Additive + idempotent.

CREATE TABLE IF NOT EXISTS project_knowledge (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'text',  -- 'text' | 'file'
  title      TEXT,
  content    TEXT,                          -- for kind='text'
  doc_id     TEXT,                          -- for kind='file' (knowledge_docs.id)
  added_by   TEXT,
  added_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_pk_project ON project_knowledge(project_id);
