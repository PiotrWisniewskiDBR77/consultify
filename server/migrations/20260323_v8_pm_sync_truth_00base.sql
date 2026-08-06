-- Ordering guard: operator-recovery extension sorts before the historical
-- PM sync truth base under the runtime's locale ordering.

CREATE TABLE IF NOT EXISTS v8_conflict_records (
  conflict_id TEXT PRIMARY KEY,
  object_sync_state_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  conflict_class TEXT NOT NULL CHECK (conflict_class IN (
    'field_authority_conflict', 'concurrent_edit_conflict',
    'status_model_conflict', 'schema_mismatch_conflict',
    'deleted_externally_conflict', 'stale_snapshot_conflict',
    'custom_field_conflict'
  )),
  severity TEXT NOT NULL CHECK (
    severity IN ('blocking', 'degraded', 'informational')
  ),
  resolution_path TEXT CHECK (resolution_path IS NULL OR resolution_path IN (
    'auto_resolve_by_authority', 'manual_review', 'remap',
    'replay_after_fix', 'dismiss', 'escalate'
  )),
  resolved_at TEXT,
  resolved_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
