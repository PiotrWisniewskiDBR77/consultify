-- V8 CollaborationRoom — multiplayer core primitives
-- WP-W1-MP-01: CollaborationRoom core primitives

-- ==========================================
-- 1. Collaboration Rooms
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_collaboration_rooms (
  room_id           TEXT PRIMARY KEY,
  resource_type     TEXT NOT NULL,
  resource_id       TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  room_state        TEXT NOT NULL DEFAULT 'active'
                    CHECK (room_state IN ('active', 'idle', 'closed', 'error')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at         TEXT,
  metadata          TEXT NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_collab_rooms_resource
  ON v8_collaboration_rooms(organization_id, resource_type, resource_id)
  WHERE room_state != 'closed';

CREATE INDEX IF NOT EXISTS idx_v8_collab_rooms_org
  ON v8_collaboration_rooms(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_collab_rooms_state
  ON v8_collaboration_rooms(organization_id, room_state);

-- ==========================================
-- 2. Room Presence (ephemeral-ish, cleaned on stale)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_room_presence (
  presence_id     TEXT PRIMARY KEY,
  room_id         TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  presence_type   TEXT NOT NULL DEFAULT 'viewer'
                  CHECK (presence_type IN ('viewer', 'editor', 'facilitator', 'observer', 'ai_agent')),
  cursor_state    TEXT,
  last_heartbeat  TEXT NOT NULL DEFAULT (datetime('now')),
  connected_at    TEXT NOT NULL DEFAULT (datetime('now')),
  client_id       TEXT NOT NULL,
  is_stale        INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (room_id) REFERENCES v8_collaboration_rooms(room_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_presence_room
  ON v8_room_presence(room_id);
CREATE INDEX IF NOT EXISTS idx_v8_presence_room_active
  ON v8_room_presence(room_id, is_stale)
  WHERE is_stale = 0;
CREATE INDEX IF NOT EXISTS idx_v8_presence_user
  ON v8_room_presence(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_presence_client
  ON v8_room_presence(room_id, user_id, client_id);
CREATE INDEX IF NOT EXISTS idx_v8_presence_heartbeat
  ON v8_room_presence(last_heartbeat);

-- ==========================================
-- 3. Room Memberships (durable history)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_room_memberships (
  membership_id   TEXT PRIMARY KEY,
  room_id         TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  joined_at       TEXT NOT NULL DEFAULT (datetime('now')),
  left_at         TEXT,
  role            TEXT NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('viewer', 'editor', 'facilitator', 'observer', 'ai_agent')),
  FOREIGN KEY (room_id) REFERENCES v8_collaboration_rooms(room_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_memberships_room
  ON v8_room_memberships(room_id);
CREATE INDEX IF NOT EXISTS idx_v8_memberships_user
  ON v8_room_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_v8_memberships_active
  ON v8_room_memberships(room_id, left_at)
  WHERE left_at IS NULL;

-- ==========================================
-- 4. Collaboration Events (append-only durable stream)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_collaboration_events (
  event_id        TEXT PRIMARY KEY,
  room_id         TEXT NOT NULL,
  event_type      TEXT NOT NULL
                  CHECK (event_type IN (
                    'room.created', 'room.activated', 'room.idle', 'room.closed', 'room.error',
                    'membership.joined', 'membership.left', 'membership.role_changed',
                    'presence.updated', 'presence.stale_removed',
                    'collaboration.edit_started', 'collaboration.edit_completed', 'collaboration.conflict_detected',
                    'awareness.cursor_moved', 'awareness.selection_changed', 'awareness.typing_started', 'awareness.typing_stopped',
                    'system.heartbeat', 'system.reconnected', 'system.degraded'
                  )),
  actor_id        TEXT NOT NULL,
  actor_type      TEXT NOT NULL DEFAULT 'human'
                  CHECK (actor_type IN ('human', 'ai_agent', 'system')),
  delivery        TEXT NOT NULL DEFAULT 'durable'
                  CHECK (delivery IN ('ephemeral', 'durable')),
  payload         TEXT NOT NULL DEFAULT '{}',
  timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
  state_version   INTEGER,
  FOREIGN KEY (room_id) REFERENCES v8_collaboration_rooms(room_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_collab_events_room
  ON v8_collaboration_events(room_id);
CREATE INDEX IF NOT EXISTS idx_v8_collab_events_room_type
  ON v8_collaboration_events(room_id, event_type);
CREATE INDEX IF NOT EXISTS idx_v8_collab_events_time
  ON v8_collaboration_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_v8_collab_events_actor
  ON v8_collaboration_events(actor_id);
