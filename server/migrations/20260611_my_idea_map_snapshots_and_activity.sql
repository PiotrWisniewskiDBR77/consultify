-- Migration: my_idea_map_snapshots + my_idea_activity
-- Fixes: M05/M06/M08 — these tables were missing, causing 503 on snapshot and activity endpoints.

CREATE TABLE IF NOT EXISTS my_idea_map_snapshots (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  label TEXT,
  node_count INTEGER DEFAULT 0,
  edge_count INTEGER DEFAULT 0,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (idea_id) REFERENCES my_ideas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_my_idea_map_snapshots_idea ON my_idea_map_snapshots(idea_id);
CREATE INDEX IF NOT EXISTS idx_my_idea_map_snapshots_org ON my_idea_map_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_my_idea_map_snapshots_created ON my_idea_map_snapshots(created_at DESC);

CREATE TABLE IF NOT EXISTS my_idea_activity (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  type TEXT NOT NULL,
  actor TEXT,
  node_id TEXT,
  node_label TEXT,
  detail TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (idea_id) REFERENCES my_ideas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_my_idea_activity_idea ON my_idea_activity(idea_id);
CREATE INDEX IF NOT EXISTS idx_my_idea_activity_org ON my_idea_activity(organization_id);
CREATE INDEX IF NOT EXISTS idx_my_idea_activity_created ON my_idea_activity(created_at DESC);
