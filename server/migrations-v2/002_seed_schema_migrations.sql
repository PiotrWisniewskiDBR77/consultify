-- Migration: 002_seed_schema_migrations.sql
-- Purpose: Bootstrap the v2 migration tracking table and record the baseline as applied.
--
-- The schema_migrations table may already exist from the legacy runner.
-- This migration resets it for the v2 system: it keeps the table structure
-- but inserts the baseline entry so the runner knows 001 is already applied.

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT NOT NULL,
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT NOT NULL,
    execution_time_ms INTEGER,
    status TEXT NOT NULL DEFAULT 'success'
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_status ON schema_migrations(status);

INSERT INTO schema_migrations (version, filename, checksum, execution_time_ms, status)
VALUES ('001', '001_baseline_20260413.sql', 'baseline-snapshot', 0, 'success')
ON CONFLICT (filename) DO UPDATE
SET status = 'success',
    applied_at = CURRENT_TIMESTAMP;

INSERT INTO schema_migrations (version, filename, checksum, execution_time_ms, status)
VALUES ('002', '002_seed_schema_migrations.sql', 'self-bootstrap', 0, 'success')
ON CONFLICT (filename) DO UPDATE
SET status = 'success',
    applied_at = CURRENT_TIMESTAMP;
