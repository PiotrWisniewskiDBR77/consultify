-- Migration Tracking System
-- This is the foundation for tracking all database migrations
-- Created: 2026-01-06
-- PostgreSQL compatible version

CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
INSERT OR IGNORE INTO schema_migrations (filename, version, checksum, status)
VALUES ('000_schema_migrations.sql', '000', 'initial', 'success');
