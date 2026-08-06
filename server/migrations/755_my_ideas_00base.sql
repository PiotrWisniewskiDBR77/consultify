-- Strict runtime-order producer for My Ideas. The historical dated producer
-- sorts after 7xx consumers in the fail-closed runtime runner.
CREATE TABLE IF NOT EXISTS my_ideas (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  tags TEXT DEFAULT '[]',
  source_type TEXT,
  source_conversation_id TEXT,
  source_message_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_my_ideas_user_id ON my_ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_my_ideas_org_id ON my_ideas(organization_id);
CREATE INDEX IF NOT EXISTS idx_my_ideas_created_at ON my_ideas(created_at);
