-- P02-J: Extend item_type CHECK to include all 10 PMO-complete values
-- Applies to both Postgres and SQLite via table recreation

-- For Postgres: drop old constraint, add new one
-- ALTER TABLE v8_calendar_items DROP CONSTRAINT IF EXISTS v8_calendar_items_item_type_check;
-- ALTER TABLE v8_calendar_items ADD CONSTRAINT v8_calendar_items_item_type_check
--   CHECK(item_type IN ('task_due','initiative_milestone','decision_deadline','meeting','external_event','assignment','adjustment','approval_window','escalation_window','focus_block'));

-- For SQLite: recreate the table (SQLite cannot ALTER CHECK constraints)
CREATE TABLE IF NOT EXISTS v8_calendar_items_new (
  calendar_item_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  source_id TEXT REFERENCES v8_calendar_sources(calendar_source_id) ON DELETE SET NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('task_due','task_window','initiative_milestone','decision_deadline','meeting','external_event','assignment','adjustment','approval_window','escalation_window','focus_block')),
  source_system TEXT NOT NULL CHECK(source_system IN ('consultify','google_calendar','outlook_calendar','caldav')),
  source_object_ref TEXT NOT NULL,
  title TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT,
  all_day INTEGER NOT NULL DEFAULT 0,
  timezone TEXT,
  visibility_class TEXT NOT NULL DEFAULT 'details' CHECK(visibility_class IN ('free_busy_only','details')),
  edit_authority TEXT NOT NULL DEFAULT 'none' CHECK(edit_authority IN ('none','local_only','remote_owner','delegate')),
  recurrence_model_json TEXT,
  sync_state TEXT NOT NULL DEFAULT 'in_sync' CHECK(sync_state IN ('in_sync','pending','conflict','blocked','stale')),
  etag TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO v8_calendar_items_new SELECT * FROM v8_calendar_items;
DROP TABLE IF EXISTS v8_calendar_items;
ALTER TABLE v8_calendar_items_new RENAME TO v8_calendar_items;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_calendar_items_source_ref
  ON v8_calendar_items(organization_id, source_id, source_object_ref);
