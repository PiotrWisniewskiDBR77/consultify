-- ==========================================
-- Initiative Benefits Tracking Window (v1)
-- ==========================================
-- Date: 2026-02-15
--
-- Adds a canonical tracking window for the Benefits module.
-- This is used when transitioning DONE -> TRACKING (Gate: START_TRACKING).
--
-- Notes:
-- - SQLite uses DATETIME TEXT values commonly stored as ISO strings.
-- - These columns are optional; backend will set defaults when START_TRACKING is executed.
--

ALTER TABLE initiatives ADD COLUMN tracking_start_date DATETIME;
ALTER TABLE initiatives ADD COLUMN tracking_end_date DATETIME;
ALTER TABLE initiatives ADD COLUMN tracking_started_at DATETIME;
ALTER TABLE initiatives ADD COLUMN tracking_started_by TEXT;

CREATE INDEX IF NOT EXISTS idx_initiatives_tracking_start ON initiatives(tracking_start_date);
CREATE INDEX IF NOT EXISTS idx_initiatives_tracking_end ON initiatives(tracking_end_date);

