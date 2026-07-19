-- Migration: my_idea_map_versions
-- Version history for idea workspace maps (auto-snapshots every 5 min)

CREATE TABLE IF NOT EXISTS my_idea_map_versions (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  node_count INTEGER DEFAULT 0,
  edge_count INTEGER DEFAULT 0,
  preferred_tool TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (idea_id) REFERENCES my_ideas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_idea_map_versions_idea ON my_idea_map_versions(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_map_versions_org ON my_idea_map_versions(organization_id);
CREATE INDEX IF NOT EXISTS idx_idea_map_versions_created ON my_idea_map_versions(created_at);
