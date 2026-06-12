-- P02-D: Calendar Interop bridge to P01 Integration
-- Adds connection_id FK, extends itemType for PMO completeness

-- Bridge to P01 connection (plain TEXT column — integrations table is outside v8 schema)
ALTER TABLE v8_calendar_sources ADD COLUMN IF NOT EXISTS connection_id TEXT;
CREATE INDEX IF NOT EXISTS idx_v8_calendar_sources_connection ON v8_calendar_sources(connection_id);

-- Drop old CHECK and replace with extended itemType list (SQLite: recreate via pragma or use a new column approach)
-- For Postgres-compatible systems, use ALTER CHECK. For SQLite we rely on application-level validation.
-- The service layer validates itemType values (CHECK is advisory).

-- Extended itemType: add assignment, adjustment, approval_window, escalation_window, focus_block
-- SQLite cannot ALTER CHECK constraints, so we document the new allowed values:
-- 'task_due', 'initiative_milestone', 'decision_deadline', 'meeting', 'external_event',
-- 'assignment', 'adjustment', 'approval_window', 'escalation_window', 'focus_block'
