CREATE TABLE IF NOT EXISTS idea_node_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_name TEXT,
  text TEXT NOT NULL,
  mentions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idea_node_comments_idea_node ON idea_node_comments (idea_id, node_id);
CREATE INDEX IF NOT EXISTS idx_idea_node_comments_created ON idea_node_comments (created_at);
CREATE INDEX IF NOT EXISTS idx_idea_node_comments_org ON idea_node_comments (organization_id);
