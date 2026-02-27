-- Migration Tracking System
-- This is the foundation for tracking all database migrations
-- Created: 2026-01-06
-- PostgreSQL compatible version

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT NOT NULL,
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT NOT NULL,
    execution_time_ms INTEGER,
    status TEXT NOT NULL DEFAULT 'success'
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
    ON schema_migrations(applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_status 
    ON schema_migrations(status);

-- Insert this migration itself
-- NOTE: the migration runner (`migrate.postgres.ts`) creates and manages schema_migrations.
-- Keep this file purely structural to avoid bootstrapping conflicts.
