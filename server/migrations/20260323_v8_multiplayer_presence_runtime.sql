-- V8 Wave 7: Multiplayer Presence Runtime
-- Adds heartbeat tracking, degraded-mode column, and org+state index.

ALTER TABLE v8_room_presence ADD COLUMN last_heartbeat_at TEXT;
ALTER TABLE v8_collaboration_rooms ADD COLUMN degraded_since TEXT;
CREATE INDEX IF NOT EXISTS idx_v8_rooms_org_state ON v8_collaboration_rooms(organization_id, state) WHERE state != 'closed';
