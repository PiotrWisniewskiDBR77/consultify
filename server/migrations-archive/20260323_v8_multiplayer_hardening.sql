-- V8 Multiplayer Platform Hardening — WP-W4-COLLAB-01
-- Extends Wave 1 CollaborationRoom baseline with surface-aware routing,
-- per-tool room mapping, facilitation lifecycle, and platform seam registry.

-- ==========================================
-- 1. Resource Type Mappings (per-tool room mapping)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_resource_type_mappings (
  mapping_id        TEXT PRIMARY KEY,
  resource_type     TEXT NOT NULL
                    CHECK (resource_type IN ('workspace', 'whiteboard', 'table', 'notebook', 'mindmap', 'processflow')),
  room_granularity  TEXT NOT NULL
                    CHECK (room_granularity IN ('per_workspace', 'per_resource')),
  embedded_in       TEXT
                    CHECK (embedded_in IS NULL OR embedded_in IN ('workspace', 'whiteboard', 'table', 'notebook', 'mindmap', 'processflow')),
  surface_aware     INTEGER NOT NULL DEFAULT 0,
  organization_id   TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_rtm_org_resource
  ON v8_resource_type_mappings(organization_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_v8_rtm_org
  ON v8_resource_type_mappings(organization_id);

-- ==========================================
-- 2. Surface Presence (Decision W4-5: unified presence with surface detail)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_surface_presence (
  surface_presence_id TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL,
  room_id             TEXT NOT NULL,
  active_surface      TEXT NOT NULL
                      CHECK (active_surface IN ('mindmap', 'whiteboard', 'process_flow', 'table', 'notebook')),
  presence_type       TEXT NOT NULL DEFAULT 'viewer'
                      CHECK (presence_type IN ('viewer', 'editor', 'facilitator', 'observer', 'ai_agent')),
  cursor_state        TEXT,
  last_heartbeat      TEXT NOT NULL DEFAULT (datetime('now')),
  organization_id     TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES v8_collaboration_rooms(room_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_sp_room
  ON v8_surface_presence(room_id);
CREATE INDEX IF NOT EXISTS idx_v8_sp_room_surface
  ON v8_surface_presence(room_id, active_surface);
CREATE INDEX IF NOT EXISTS idx_v8_sp_org
  ON v8_surface_presence(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_sp_user_room
  ON v8_surface_presence(room_id, user_id);
CREATE INDEX IF NOT EXISTS idx_v8_sp_heartbeat
  ON v8_surface_presence(last_heartbeat);

-- ==========================================
-- 3. Facilitation Sessions (Decision W4-2: pause/resume lifecycle)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_facilitation_sessions (
  session_id          TEXT PRIMARY KEY,
  room_id             TEXT NOT NULL,
  facilitator_user_id TEXT NOT NULL,
  session_state       TEXT NOT NULL DEFAULT 'active'
                      CHECK (session_state IN ('active', 'paused_degraded', 'ended')),
  current_phase       TEXT,
  phase_history       TEXT NOT NULL DEFAULT '[]',
  started_at          TEXT NOT NULL DEFAULT (datetime('now')),
  paused_at           TEXT,
  ended_at            TEXT,
  pause_reason        TEXT
                      CHECK (pause_reason IS NULL OR pause_reason IN ('facilitator_disconnect', 'room_degraded', 'manual')),
  organization_id     TEXT NOT NULL,
  FOREIGN KEY (room_id) REFERENCES v8_collaboration_rooms(room_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_fs_room
  ON v8_facilitation_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_v8_fs_org
  ON v8_facilitation_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_fs_state
  ON v8_facilitation_sessions(session_state)
  WHERE session_state != 'ended';
CREATE INDEX IF NOT EXISTS idx_v8_fs_facilitator
  ON v8_facilitation_sessions(facilitator_user_id);

-- ==========================================
-- 4. Platform Seam Registry
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_platform_seam_registry (
  seam_id           TEXT PRIMARY KEY,
  tool_name         TEXT NOT NULL
                    CHECK (tool_name IN ('workspace', 'whiteboard', 'table', 'notebook', 'mindmap', 'processflow')),
  seam_type         TEXT NOT NULL
                    CHECK (seam_type IN ('room_binding', 'presence', 'events', 'locking', 'degraded_state', 'reconnect', 'authorization', 'facilitation')),
  current_state     TEXT NOT NULL DEFAULT 'module_local'
                    CHECK (current_state IN ('module_local', 'platform_migrated', 'eliminated')),
  v4_seam_ref       TEXT,
  organization_id   TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  migrated_at       TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_psr_org_tool_seam
  ON v8_platform_seam_registry(organization_id, tool_name, seam_type);
CREATE INDEX IF NOT EXISTS idx_v8_psr_org
  ON v8_platform_seam_registry(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_psr_state
  ON v8_platform_seam_registry(current_state);

-- ==========================================
-- 5. Tool Event Registry
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_tool_event_registry (
  registration_id   TEXT PRIMARY KEY,
  event_type        TEXT NOT NULL,
  tool_name         TEXT NOT NULL
                    CHECK (tool_name IN ('workspace', 'whiteboard', 'table', 'notebook', 'mindmap', 'processflow')),
  delivery_tier     TEXT NOT NULL DEFAULT 'durable'
                    CHECK (delivery_tier IN ('ephemeral', 'durable')),
  surface_context   INTEGER NOT NULL DEFAULT 0,
  registered        INTEGER NOT NULL DEFAULT 1,
  organization_id   TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_ter_org_event_tool
  ON v8_tool_event_registry(organization_id, event_type, tool_name);
CREATE INDEX IF NOT EXISTS idx_v8_ter_org
  ON v8_tool_event_registry(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_ter_tool
  ON v8_tool_event_registry(tool_name);
