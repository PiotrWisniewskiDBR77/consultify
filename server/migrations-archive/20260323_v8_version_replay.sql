-- V8 Version/Replay/Audit Spine — core primitives
-- WP-W1-MP-02: Version, Replay and Audit Spine

-- ==========================================
-- 1. Version Snapshots
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_version_snapshots (
  snapshot_id       TEXT PRIMARY KEY,
  room_id           TEXT,
  resource_type     TEXT NOT NULL,
  resource_id       TEXT NOT NULL,
  organization_id   TEXT NOT NULL,
  state_version     INTEGER NOT NULL,
  state_data        TEXT NOT NULL DEFAULT '{}',
  trigger_type      TEXT NOT NULL
                    CHECK (trigger_type IN (
                      'manual_save', 'auto_cadence', 'ai_proposal_accepted',
                      'milestone', 'pre_restore_safety', 'session_boundary'
                    )),
  captured_by_actor_id    TEXT NOT NULL,
  captured_by_actor_type  TEXT NOT NULL
                          CHECK (captured_by_actor_type IN ('human', 'ai_agent', 'system')),
  captured_by_display_name TEXT NOT NULL DEFAULT '',
  captured_at       TEXT NOT NULL DEFAULT (datetime('now')),
  metadata          TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (room_id) REFERENCES v8_collaboration_rooms(room_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_snapshots_resource
  ON v8_version_snapshots(organization_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_v8_snapshots_room
  ON v8_version_snapshots(room_id);
CREATE INDEX IF NOT EXISTS idx_v8_snapshots_org
  ON v8_version_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_snapshots_version
  ON v8_version_snapshots(organization_id, resource_type, resource_id, state_version);
CREATE INDEX IF NOT EXISTS idx_v8_snapshots_trigger
  ON v8_version_snapshots(trigger_type);
CREATE INDEX IF NOT EXISTS idx_v8_snapshots_captured_at
  ON v8_version_snapshots(captured_at);

-- ==========================================
-- 2. Restore Requests
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_restore_requests (
  restore_id                TEXT PRIMARY KEY,
  room_id                   TEXT,
  resource_type             TEXT NOT NULL,
  resource_id               TEXT NOT NULL,
  organization_id           TEXT NOT NULL,
  target_version_snapshot_id TEXT NOT NULL,
  requested_by_actor_id     TEXT NOT NULL,
  requested_by_actor_type   TEXT NOT NULL
                            CHECK (requested_by_actor_type IN ('human', 'ai_agent', 'system')),
  requested_by_display_name TEXT NOT NULL DEFAULT '',
  status                    TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'applied', 'rejected')),
  safety_snapshot_id        TEXT,
  requested_at              TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at               TEXT,
  FOREIGN KEY (room_id) REFERENCES v8_collaboration_rooms(room_id),
  FOREIGN KEY (target_version_snapshot_id) REFERENCES v8_version_snapshots(snapshot_id),
  FOREIGN KEY (safety_snapshot_id) REFERENCES v8_version_snapshots(snapshot_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_restores_resource
  ON v8_restore_requests(organization_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_v8_restores_room
  ON v8_restore_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_v8_restores_status
  ON v8_restore_requests(status);

-- ==========================================
-- 3. Audit Entries
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_audit_entries (
  entry_id                  TEXT PRIMARY KEY,
  room_id                   TEXT,
  resource_type             TEXT NOT NULL,
  resource_id               TEXT NOT NULL,
  organization_id           TEXT NOT NULL,
  actor_id                  TEXT NOT NULL,
  actor_type                TEXT NOT NULL
                            CHECK (actor_type IN ('human', 'ai_agent', 'system')),
  actor_display_name        TEXT NOT NULL DEFAULT '',
  action                    TEXT NOT NULL
                            CHECK (action IN (
                              'snapshot.created', 'snapshot.restored', 'version.compared',
                              'restore.requested', 'restore.applied', 'restore.rejected',
                              'edit.committed',
                              'ai.proposal_submitted', 'ai.proposal_accepted',
                              'ai.proposal_rejected', 'ai.proposal_stale'
                            )),
  state_version_before      INTEGER,
  state_version_after       INTEGER,
  metadata                  TEXT NOT NULL DEFAULT '{}',
  timestamp                 TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (room_id) REFERENCES v8_collaboration_rooms(room_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_audit_resource
  ON v8_audit_entries(organization_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_v8_audit_room
  ON v8_audit_entries(room_id);
CREATE INDEX IF NOT EXISTS idx_v8_audit_actor
  ON v8_audit_entries(actor_id);
CREATE INDEX IF NOT EXISTS idx_v8_audit_action
  ON v8_audit_entries(action);
CREATE INDEX IF NOT EXISTS idx_v8_audit_timestamp
  ON v8_audit_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_v8_audit_org
  ON v8_audit_entries(organization_id);
