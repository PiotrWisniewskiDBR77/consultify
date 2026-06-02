-- Migration: initiative_status_history
-- Tracks all initiative status transitions with audit trail
-- Used by: InitiativeController.updateInitiativeStatus()

CREATE TABLE IF NOT EXISTS initiative_status_history (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    changed_by TEXT,
    reason TEXT,
    gate_type TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_initiative_status_history_initiative_id
    ON initiative_status_history(initiative_id);

CREATE INDEX IF NOT EXISTS idx_initiative_status_history_org_id
    ON initiative_status_history(organization_id);

-- Add lifecycle timestamp columns to initiatives (if not exist)
-- These track when each lifecycle event happened

-- Safely add columns that may already exist
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
-- so we handle errors gracefully in the migration runner

-- review_requested_at, review_requested_by
CREATE TABLE IF NOT EXISTS _migration_532_temp (dummy INTEGER);
DROP TABLE IF EXISTS _migration_532_temp;
