-- P02-B: Calendar Interoperability tables
-- Contract: FINAL_IMPLEMENTATION_PLAN_02_KALENDARZ §2.3

-- Calendar sources (external provider connections)
CREATE TABLE IF NOT EXISTS v8_calendar_sources (
  calendar_source_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('google', 'microsoft', 'caldav')),
  account_ref TEXT NOT NULL,
  selected_calendars_json TEXT NOT NULL DEFAULT '[]',
  declared_mode TEXT NOT NULL CHECK(declared_mode IN ('read', 'write', 'bidir')),
  effective_mode TEXT NOT NULL CHECK(effective_mode IN ('read', 'write', 'bidir')),
  permission_gradient TEXT NOT NULL CHECK(permission_gradient IN ('free_busy', 'read', 'write', 'delegate')),
  lifecycle_state TEXT NOT NULL DEFAULT 'connected' CHECK(lifecycle_state IN ('connected', 'degraded', 'requires_action', 'blocked', 'recoverable')),
  requires_action_reason TEXT,
  last_ok_at TEXT,
  last_sync_at TEXT,
  sync_checkpoint_json TEXT NOT NULL DEFAULT '{"cursor":null,"rangeWatermark":null,"lastFullSyncAt":null,"lastIncrementalSyncAt":null,"integrityGuards":[]}',
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_v8_calendar_sources_org ON v8_calendar_sources(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_calendar_sources_user ON v8_calendar_sources(organization_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_calendar_sources_provider_account ON v8_calendar_sources(organization_id, provider, account_ref);

-- Calendar items (unified time items: internal + external)
CREATE TABLE IF NOT EXISTS v8_calendar_items (
  calendar_item_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  source_id TEXT,
  item_type TEXT NOT NULL CHECK(item_type IN ('task_due', 'initiative_milestone', 'decision_deadline', 'meeting', 'external_event')),
  source_system TEXT NOT NULL CHECK(source_system IN ('consultify', 'google_calendar', 'outlook_calendar', 'caldav')),
  source_object_ref TEXT NOT NULL,
  title TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT,
  all_day INTEGER NOT NULL DEFAULT 0,
  timezone TEXT,
  visibility_class TEXT NOT NULL DEFAULT 'details' CHECK(visibility_class IN ('free_busy_only', 'details')),
  edit_authority TEXT NOT NULL DEFAULT 'none' CHECK(edit_authority IN ('none', 'local_only', 'remote_owner', 'delegate')),
  recurrence_model_json TEXT,
  sync_state TEXT NOT NULL DEFAULT 'in_sync' CHECK(sync_state IN ('in_sync', 'pending', 'conflict', 'blocked', 'stale')),
  etag TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES v8_calendar_sources(calendar_source_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_v8_calendar_items_org ON v8_calendar_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_calendar_items_source ON v8_calendar_items(source_id);
CREATE INDEX IF NOT EXISTS idx_v8_calendar_items_time ON v8_calendar_items(organization_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_v8_calendar_items_sync ON v8_calendar_items(organization_id, sync_state);
CREATE INDEX IF NOT EXISTS idx_v8_calendar_items_type ON v8_calendar_items(organization_id, item_type);
