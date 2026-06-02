-- V8 Concurrent Editing & Notification Spine
-- WP-W4-COLLAB-03: Concurrent editing model, conflict resolution, locking, notification spine
-- Decisions: W4-8 (CRDT deferred), W4-9 (aggregated notifications), W4-10 (governance-sensitive LWW)

-- ==========================================
-- 1. Concurrency Strategies (per-resource-type registry)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_concurrency_strategies (
  strategy_id              TEXT PRIMARY KEY,
  resource_type            TEXT NOT NULL,
  organization_id          TEXT NOT NULL,
  collaboration_mode       TEXT NOT NULL
                           CHECK (collaboration_mode IN (
                             'realtime_coediting', 'controlled_coediting',
                             'review_first', 'facilitated_input', 'role_gated'
                           )),
  merge_strategy           TEXT NOT NULL
                           CHECK (merge_strategy IN (
                             'crdt_object_level', 'crdt_block_level',
                             'ot_block_level', 'field_lww', 'server_authoritative'
                           )),
  lock_strategy            TEXT NOT NULL
                           CHECK (lock_strategy IN (
                             'none', 'advisory_object', 'optimistic_row',
                             'optimistic_section', 'exclusive_schema', 'exclusive_document'
                           )),
  offline_policy           TEXT NOT NULL
                           CHECK (offline_policy IN (
                             'queue_and_merge', 'queue_and_review',
                             'reject_on_reconnect', 'stale_warning'
                           )),
  comment_anchor_strategy  TEXT NOT NULL
                           CHECK (comment_anchor_strategy IN (
                             'block', 'node', 'edge', 'cell',
                             'row', 'section', 'slide', 'range'
                           )),
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_concurrency_strategies_resource
  ON v8_concurrency_strategies(organization_id, resource_type);

CREATE INDEX IF NOT EXISTS idx_v8_concurrency_strategies_org
  ON v8_concurrency_strategies(organization_id);

-- ==========================================
-- 2. Conflict Resolutions
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_conflict_resolutions (
  conflict_id          TEXT PRIMARY KEY,
  organization_id      TEXT NOT NULL,
  conflict_class       TEXT NOT NULL
                       CHECK (conflict_class IN (
                         'concurrent_property_edit', 'structural_conflict',
                         'schema_conflict', 'state_transition_conflict',
                         'ai_proposal_vs_human_edit'
                       )),
  resource_type        TEXT NOT NULL,
  resource_id          TEXT NOT NULL,
  room_id              TEXT,
  affected_path        TEXT NOT NULL,
  actor_ids            TEXT NOT NULL DEFAULT '[]',
  resolution_strategy  TEXT NOT NULL
                       CHECK (resolution_strategy IN (
                         'crdt_auto_merge', 'ot_transform', 'last_write_wins',
                         'optimistic_lock_retry', 'advisory_lock_warning',
                         'review_first_gating', 'ai_staleness_detection'
                       )),
  resolution_status    TEXT NOT NULL DEFAULT 'pending_user_action'
                       CHECK (resolution_status IN (
                         'auto_resolved', 'pending_user_action',
                         'user_resolved', 'escalated'
                       )),
  resolved_at          TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  metadata             TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_v8_conflict_resolutions_org
  ON v8_conflict_resolutions(organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_conflict_resolutions_resource
  ON v8_conflict_resolutions(organization_id, resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_v8_conflict_resolutions_status
  ON v8_conflict_resolutions(organization_id, resolution_status);

CREATE INDEX IF NOT EXISTS idx_v8_conflict_resolutions_room
  ON v8_conflict_resolutions(room_id)
  WHERE room_id IS NOT NULL;

-- ==========================================
-- 3. Lock Records (lock lifecycle)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_lock_records (
  lock_id            TEXT PRIMARY KEY,
  organization_id    TEXT NOT NULL,
  lock_type          TEXT NOT NULL
                     CHECK (lock_type IN (
                       'advisory_object', 'optimistic_row', 'optimistic_section',
                       'exclusive_schema', 'exclusive_document', 'phase_lock'
                     )),
  lock_scope         TEXT NOT NULL,
  holder_id          TEXT NOT NULL,
  holder_client_id   TEXT NOT NULL,
  room_id            TEXT NOT NULL,
  ttl                INTEGER NOT NULL,
  acquired_at        TEXT NOT NULL DEFAULT (datetime('now')),
  released_at        TEXT,
  release_reason     TEXT
                     CHECK (release_reason IS NULL OR release_reason IN (
                       'explicit', 'timeout', 'disconnect'
                     ))
);

CREATE INDEX IF NOT EXISTS idx_v8_lock_records_org
  ON v8_lock_records(organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_lock_records_room_active
  ON v8_lock_records(organization_id, room_id)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_v8_lock_records_scope_active
  ON v8_lock_records(organization_id, lock_scope)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_v8_lock_records_holder
  ON v8_lock_records(holder_id)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_v8_lock_records_acquired
  ON v8_lock_records(acquired_at);

-- ==========================================
-- 4. Notification Triggers (event-to-notification mapping)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_notification_triggers (
  trigger_id         TEXT PRIMARY KEY,
  organization_id    TEXT NOT NULL,
  event_type         TEXT NOT NULL,
  notification_type  TEXT NOT NULL,
  recipient_rule     TEXT NOT NULL,
  priority           TEXT NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('high', 'medium', 'low')),
  channels           TEXT NOT NULL DEFAULT '["in_app_inbox"]',
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_notification_triggers_org
  ON v8_notification_triggers(organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_notification_triggers_event
  ON v8_notification_triggers(organization_id, event_type)
  WHERE is_active = 1;

-- ==========================================
-- 5. Notification Records (delivered notifications)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_notification_records (
  notification_id    TEXT PRIMARY KEY,
  organization_id    TEXT NOT NULL,
  recipient_id       TEXT NOT NULL,
  event_ref          TEXT NOT NULL,
  channel            TEXT NOT NULL
                     CHECK (channel IN ('in_app_realtime', 'in_app_inbox', 'email_digest')),
  state              TEXT NOT NULL DEFAULT 'unread'
                     CHECK (state IN ('unread', 'read', 'actioned', 'snoozed')),
  aggregation_key    TEXT,
  priority           TEXT NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('high', 'medium', 'low')),
  title              TEXT NOT NULL,
  body               TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_notification_records_org
  ON v8_notification_records(organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_notification_records_recipient
  ON v8_notification_records(organization_id, recipient_id);

CREATE INDEX IF NOT EXISTS idx_v8_notification_records_recipient_state
  ON v8_notification_records(organization_id, recipient_id, state);

CREATE INDEX IF NOT EXISTS idx_v8_notification_records_aggregation
  ON v8_notification_records(organization_id, recipient_id, aggregation_key)
  WHERE aggregation_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_v8_notification_records_created
  ON v8_notification_records(created_at);

-- ==========================================
-- 6. Governance-Sensitive Fields (Decision W4-10)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_governance_sensitive_fields (
  field_id               TEXT PRIMARY KEY,
  organization_id        TEXT NOT NULL,
  table_id               TEXT NOT NULL,
  field_name             TEXT NOT NULL,
  is_governance_sensitive INTEGER NOT NULL DEFAULT 1,
  conflict_policy        TEXT NOT NULL DEFAULT 'review_required'
                         CHECK (conflict_policy IN (
                           'review_required', 'blocking', 'explicit_authority'
                         )),
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_governance_fields_unique
  ON v8_governance_sensitive_fields(organization_id, table_id, field_name);

CREATE INDEX IF NOT EXISTS idx_v8_governance_fields_org
  ON v8_governance_sensitive_fields(organization_id);

CREATE INDEX IF NOT EXISTS idx_v8_governance_fields_table
  ON v8_governance_sensitive_fields(organization_id, table_id);
