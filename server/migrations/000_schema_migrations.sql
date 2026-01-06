-- Migration Tracking System
-- This is the foundation for tracking all database migrations
-- Created: 2026-01-06

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT,
    execution_time_ms INTEGER,
    status TEXT DEFAULT 'success' CHECK(status IN ('success', 'failed', 'rolled_back'))
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
    ON schema_migrations(applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_status 
    ON schema_migrations(status);

-- Insert this migration itself
INSERT OR IGNORE INTO schema_migrations (version, filename, checksum, status)
VALUES ('000', '000_schema_migrations.sql', 'initial', 'success');
