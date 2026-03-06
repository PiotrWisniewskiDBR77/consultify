-- V4-ENT-06, V4-IDEA-03, V4-TOOL-04, V4-TOOL-05
-- Realtime platform, CRDT store, facilitation, tool session realtime.

-- ============================================================
-- 1) V4-ENT-06: Realtime platform registry
-- ============================================================

CREATE TABLE IF NOT EXISTS realtime_channels (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_rtc_org_resource
  ON realtime_channels(organization_id, resource_type, resource_id);

CREATE TABLE IF NOT EXISTS realtime_presence (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  user_color TEXT,
  cursor_state TEXT DEFAULT '{}',
  active_element TEXT,
  is_connected INTEGER DEFAULT 1,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_heartbeat_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rtp_channel
  ON realtime_presence(channel_id, is_connected);
CREATE INDEX IF NOT EXISTS idx_rtp_user
  ON realtime_presence(user_id, is_connected);

-- ============================================================
-- 2) V4-IDEA-03: CRDT document store
-- ============================================================

CREATE TABLE IF NOT EXISTS crdt_documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  crdt_type TEXT NOT NULL DEFAULT 'yjs',
  state_vector TEXT,
  snapshot_data TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  last_updated_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_crdt_resource
  ON crdt_documents(organization_id, resource_type, resource_id);

CREATE TABLE IF NOT EXISTS crdt_updates (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  update_data TEXT NOT NULL,
  origin_user_id TEXT NOT NULL,
  origin_client_id TEXT,
  sequence_number INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crdt_updates_doc
  ON crdt_updates(document_id, sequence_number);

-- ============================================================
-- 3) V4-TOOL-04: Facilitation layer
-- ============================================================

CREATE TABLE IF NOT EXISTS tool_facilitation_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  tool_session_id TEXT NOT NULL,
  facilitator_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  timer_state TEXT DEFAULT '{}',
  current_phase TEXT,
  settings TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tfs_tool
  ON tool_facilitation_sessions(organization_id, tool_session_id);

CREATE TABLE IF NOT EXISTS tool_facilitation_votes (
  id TEXT PRIMARY KEY,
  facilitation_session_id TEXT NOT NULL,
  voter_id TEXT NOT NULL,
  voter_name TEXT,
  vote_target_id TEXT NOT NULL,
  vote_type TEXT NOT NULL DEFAULT 'upvote',
  vote_value INTEGER DEFAULT 1,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(facilitation_session_id, voter_id, vote_target_id, vote_type)
);

CREATE INDEX IF NOT EXISTS idx_tfv_session
  ON tool_facilitation_votes(facilitation_session_id);

CREATE TABLE IF NOT EXISTS tool_facilitation_roles (
  id TEXT PRIMARY KEY,
  facilitation_session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_name TEXT NOT NULL DEFAULT 'participant',
  permissions TEXT DEFAULT '[]',
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(facilitation_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tfr_session
  ON tool_facilitation_roles(facilitation_session_id);

CREATE TABLE IF NOT EXISTS tool_facilitation_outcomes (
  id TEXT PRIMARY KEY,
  facilitation_session_id TEXT NOT NULL,
  outcome_type TEXT NOT NULL DEFAULT 'decision',
  title TEXT NOT NULL,
  description TEXT,
  vote_summary TEXT DEFAULT '{}',
  exported_to_type TEXT,
  exported_to_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tfo_session
  ON tool_facilitation_outcomes(facilitation_session_id);

-- ============================================================
-- 4) V4-TOOL-05: Tool session realtime
-- ============================================================

CREATE TABLE IF NOT EXISTS tool_session_presence (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  tool_session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  user_color TEXT,
  cursor_state TEXT DEFAULT '{}',
  active_block_id TEXT,
  editing_field TEXT,
  is_connected INTEGER DEFAULT 1,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_heartbeat_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tsp_session
  ON tool_session_presence(organization_id, tool_session_id, is_connected);

CREATE TABLE IF NOT EXISTS tool_session_edit_locks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  tool_session_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  locked_by TEXT NOT NULL,
  locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  UNIQUE(organization_id, tool_session_id, block_id)
);

CREATE INDEX IF NOT EXISTS idx_tsel_session
  ON tool_session_edit_locks(organization_id, tool_session_id);
