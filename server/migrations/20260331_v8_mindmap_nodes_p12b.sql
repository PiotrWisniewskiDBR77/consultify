-- P12-B: Mindmap nodes table
-- Canonical storage for mindmap graph nodes with hierarchy, kind, collapse state.

CREATE TABLE IF NOT EXISTS v8_mindmap_nodes (
  id TEXT PRIMARY KEY,
  mindmap_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  parent_id TEXT,
  label TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'topic'
    CHECK (kind IN ('topic', 'subtopic', 'hypothesis', 'option', 'risk', 'action', 'decision_point')),
  position_index INTEGER NOT NULL DEFAULT 0,
  collapsed INTEGER NOT NULL DEFAULT 0
    CHECK (collapsed IN (0, 1)),
  metadata TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES v8_mindmap_nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_v8_mindmap_nodes_mindmap
  ON v8_mindmap_nodes(mindmap_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_mindmap_nodes_parent
  ON v8_mindmap_nodes(parent_id);

-- AI proposals table for mindmap
CREATE TABLE IF NOT EXISTS v8_mindmap_ai_proposals (
  id TEXT PRIMARY KEY,
  mindmap_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT '',
  operations_json TEXT NOT NULL DEFAULT '[]',
  diff_summary_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_v8_mindmap_ai_proposals_mindmap
  ON v8_mindmap_ai_proposals(mindmap_id, organization_id);
