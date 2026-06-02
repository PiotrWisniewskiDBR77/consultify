-- T009 Enhancement — My Ideas Mind Map Edges (persistent relationships)
-- Stores user-defined connections between ideas (used by IdeasMindMap).
--
-- Notes:
-- - Use TEXT columns for cross-DB compatibility (SQLite/Postgres).
-- - Ownership is per-user (private idea graph).

CREATE TABLE IF NOT EXISTS my_idea_edges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  source_idea_id TEXT NOT NULL,
  target_idea_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'relates_to',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(source_idea_id) REFERENCES my_ideas(id) ON DELETE CASCADE,
  FOREIGN KEY(target_idea_id) REFERENCES my_ideas(id) ON DELETE CASCADE
);

-- Prevent duplicates per user graph
CREATE UNIQUE INDEX IF NOT EXISTS ux_my_idea_edges_user_source_target_kind
  ON my_idea_edges(user_id, source_idea_id, target_idea_id, kind);

CREATE INDEX IF NOT EXISTS idx_my_idea_edges_user_id ON my_idea_edges(user_id);
CREATE INDEX IF NOT EXISTS idx_my_idea_edges_org_id ON my_idea_edges(organization_id);
CREATE INDEX IF NOT EXISTS idx_my_idea_edges_source ON my_idea_edges(source_idea_id);
CREATE INDEX IF NOT EXISTS idx_my_idea_edges_target ON my_idea_edges(target_idea_id);

