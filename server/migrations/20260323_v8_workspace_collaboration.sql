-- V8 Workspace Collaboration — Sessions, Shared Context, Activity Feed
-- Wave 13: Workspace-level collaboration layer above tool rooms

-- ==========================================
-- 1. Workspace Sessions
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_workspace_sessions (
  session_id        TEXT PRIMARY KEY,
  workspace_id      TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  title             TEXT NOT NULL,
  state             TEXT NOT NULL DEFAULT 'active'
                    CHECK (state IN ('active', 'paused', 'completed', 'abandoned')),
  created_by        TEXT NOT NULL,
  linked_room_ids   TEXT NOT NULL DEFAULT '[]',
  shared_context    TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  completed_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_v8_ws_sessions_workspace
  ON v8_workspace_sessions(workspace_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_ws_sessions_org_state
  ON v8_workspace_sessions(organization_id, state);

-- ==========================================
-- 2. Activity Feed (append-only)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_activity_feed (
  entry_id            TEXT PRIMARY KEY,
  session_id          TEXT NOT NULL,
  organization_id     TEXT NOT NULL,
  entry_type          TEXT NOT NULL
                      CHECK (entry_type IN (
                        'session.started', 'session.paused', 'session.resumed', 'session.completed',
                        'participant.joined', 'participant.left',
                        'room.linked', 'room.unlinked',
                        'context.shared', 'context.updated',
                        'decision.made', 'action.assigned'
                      )),
  actor_id            TEXT NOT NULL,
  actor_display_name  TEXT NOT NULL,
  payload             TEXT NOT NULL DEFAULT '{}',
  created_at          TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES v8_workspace_sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_activity_feed_session
  ON v8_activity_feed(session_id, organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_v8_activity_feed_actor
  ON v8_activity_feed(actor_id);
