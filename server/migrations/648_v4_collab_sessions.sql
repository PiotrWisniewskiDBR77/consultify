-- V4-IDEA-02: Collaboration session tracking & events
CREATE TABLE IF NOT EXISTS collab_sessions (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  idea_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  actions_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_collab_sessions_idea ON collab_sessions(idea_id);
CREATE INDEX IF NOT EXISTS idx_collab_sessions_user ON collab_sessions(user_id);

CREATE TABLE IF NOT EXISTS collab_session_events (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  session_id TEXT NOT NULL REFERENCES collab_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload_json TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collab_events_session ON collab_session_events(session_id);
