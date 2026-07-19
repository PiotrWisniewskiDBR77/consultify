-- V4-NOTE-01/02/04/06/07: Notebook capture, ingestion, semantic search, AI audit, embeds
-- Extends notebook_pages with capture metadata and adds supporting tables.

-- ============================================================
-- 1) Capture source metadata on notebook_pages (V4-NOTE-01)
-- ============================================================

ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS capture_source TEXT DEFAULT 'upload';
ALTER TABLE notebook_pages ADD COLUMN IF NOT EXISTS capture_metadata TEXT DEFAULT '{}';

-- ============================================================
-- 2) Embedding chunks for semantic search (V4-NOTE-02, V4-NOTE-04)
-- ============================================================

CREATE TABLE IF NOT EXISTS notebook_embeddings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding_vector TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nb_embed_org ON notebook_embeddings(organization_id);
CREATE INDEX IF NOT EXISTS idx_nb_embed_page ON notebook_embeddings(organization_id, page_id);

-- ============================================================
-- 3) AI block proposals with audit (V4-NOTE-06)
-- ============================================================

CREATE TABLE IF NOT EXISTS notebook_ai_proposals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  proposal_type TEXT NOT NULL DEFAULT 'insert',
  block_content TEXT NOT NULL DEFAULT '{}',
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_nb_proposals_page ON notebook_ai_proposals(organization_id, page_id, status);
CREATE INDEX IF NOT EXISTS idx_nb_proposals_actor ON notebook_ai_proposals(organization_id, actor_id);
