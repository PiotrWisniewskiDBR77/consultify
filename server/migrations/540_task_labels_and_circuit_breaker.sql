-- Migration: 540_task_labels_and_circuit_breaker.sql
-- Purpose: Add task_labels, circuit_breaker_state columns, and notifications columns for PostgreSQL
-- Date: 2026-02-17

-- task_labels: custom labels per project (referenced by pmo-context routes)
CREATE TABLE IF NOT EXISTS task_labels (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_task_labels_project ON task_labels(project_id);

-- circuit_breaker_state: ensure table exists (older DBs may not have baseline stub)
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
    id TEXT PRIMARY KEY,
    service TEXT,
    breaker_key TEXT UNIQUE,
    state TEXT DEFAULT 'CLOSED',
    failures INTEGER DEFAULT 0,
    last_failure TIMESTAMP,
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMP,
    opened_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- circuit_breaker_state: add failures and last_failure (code expects these; initdb uses failure_count, last_failure_at)
ALTER TABLE circuit_breaker_state ADD COLUMN IF NOT EXISTS failures INTEGER DEFAULT 0;
ALTER TABLE circuit_breaker_state ADD COLUMN IF NOT EXISTS last_failure TIMESTAMP;

-- notifications: add columns from 534_notification_enhancements (for DBs that didn't run that migration)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'INFO';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_object_type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_object_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_actionable INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMP;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS checklist TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS initiative_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS task_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_name TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_dismissed INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP;
