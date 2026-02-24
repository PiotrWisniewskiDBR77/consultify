-- T009 Enhancement — My Ideas Recommendation Map (per-idea graph)
-- Stores the working map (nodes + edges) for a single idea.
--
-- Notes:
-- - Use TEXT JSON columns for cross-DB compatibility (SQLite/Postgres).
-- - Ownership is per-user (private working space), org_id included for multi-tenant filtering.

CREATE TABLE IF NOT EXISTS my_idea_maps (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  nodes_json TEXT NOT NULL DEFAULT '[]',
  edges_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(idea_id) REFERENCES my_ideas(id) ON DELETE CASCADE
);

-- One working map per idea per user
CREATE UNIQUE INDEX IF NOT EXISTS ux_my_idea_maps_user_idea
  ON my_idea_maps(user_id, idea_id);

CREATE INDEX IF NOT EXISTS idx_my_idea_maps_user_id ON my_idea_maps(user_id);
CREATE INDEX IF NOT EXISTS idx_my_idea_maps_org_id ON my_idea_maps(organization_id);
CREATE INDEX IF NOT EXISTS idx_my_idea_maps_idea_id ON my_idea_maps(idea_id);

