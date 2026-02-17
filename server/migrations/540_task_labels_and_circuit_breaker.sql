-- Migration: 540_task_labels_and_circuit_breaker.sql
-- Purpose: Add task_labels table and circuit_breaker_state columns for PostgreSQL
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

-- circuit_breaker_state: add failures and last_failure (code expects these; initdb uses failure_count, last_failure_at)
ALTER TABLE circuit_breaker_state ADD COLUMN IF NOT EXISTS failures INTEGER DEFAULT 0;
ALTER TABLE circuit_breaker_state ADD COLUMN IF NOT EXISTS last_failure TIMESTAMP;
