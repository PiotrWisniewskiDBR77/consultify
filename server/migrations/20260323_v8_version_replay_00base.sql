-- Ordering guard: runtime extension sorts before the historical version/replay
-- base file.

CREATE TABLE IF NOT EXISTS v8_version_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES v8_collaboration_rooms(room_id),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  state_version INTEGER NOT NULL,
  state_data TEXT NOT NULL DEFAULT '{}',
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'manual_save', 'auto_cadence', 'ai_proposal_accepted',
    'milestone', 'pre_restore_safety', 'session_boundary'
  )),
  captured_by_actor_id TEXT NOT NULL,
  captured_by_actor_type TEXT NOT NULL CHECK (
    captured_by_actor_type IN ('human', 'ai_agent', 'system')
  ),
  captured_by_display_name TEXT NOT NULL DEFAULT '',
  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS v8_restore_requests (
  restore_id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES v8_collaboration_rooms(room_id),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  target_version_snapshot_id TEXT NOT NULL REFERENCES v8_version_snapshots(snapshot_id),
  requested_by_actor_id TEXT NOT NULL,
  requested_by_actor_type TEXT NOT NULL CHECK (
    requested_by_actor_type IN ('human', 'ai_agent', 'system')
  ),
  requested_by_display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'applied', 'rejected')
  ),
  safety_snapshot_id TEXT REFERENCES v8_version_snapshots(snapshot_id),
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
