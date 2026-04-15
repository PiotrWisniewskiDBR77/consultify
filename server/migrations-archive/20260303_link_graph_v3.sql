-- Link Graph v3 (Embedded References + Backlinks) — MVP schema
-- SSOT: docs/product/LINK_GRAPH_V3.md
--
-- Minimal: one relation type ('ref'), stable on (type + id).
-- This table is the single source of truth for platform-wide backlinks ("Used in").

CREATE TABLE IF NOT EXISTS link_graph_edges (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  created_by TEXT NOT NULL,

  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,

  relation TEXT NOT NULL DEFAULT 'ref',

  -- Context: where this reference lives (optional but recommended)
  container_type TEXT,
  container_id TEXT,
  block_id TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prevent duplicates for the same reference in the same container (best-effort).
CREATE UNIQUE INDEX IF NOT EXISTS ux_link_graph_edges_ref
  ON link_graph_edges(
    organization_id,
    created_by,
    source_type,
    source_id,
    target_type,
    target_id,
    relation,
    COALESCE(container_type, ''),
    COALESCE(container_id, ''),
    COALESCE(block_id, '')
  );

CREATE INDEX IF NOT EXISTS idx_link_graph_edges_org ON link_graph_edges(organization_id);
CREATE INDEX IF NOT EXISTS idx_link_graph_edges_source ON link_graph_edges(organization_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_link_graph_edges_target ON link_graph_edges(organization_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_link_graph_edges_container ON link_graph_edges(organization_id, container_type, container_id);

