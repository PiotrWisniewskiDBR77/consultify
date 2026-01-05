-- Migration: 019_audit_events.sql
-- Purpose: Create audit_events table for comprehensive activity logging

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    actor_user_id TEXT,
    actor_type TEXT NOT NULL DEFAULT 'USER', -- USER, CONSULTANT, SYSTEM, AI
    org_id TEXT,
    action_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    metadata_json TEXT DEFAULT '{}',
    ip TEXT,
    user_agent TEXT,
    FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_events_org_id ON audit_events(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_user_id ON audit_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_ts ON audit_events(ts);
CREATE INDEX IF NOT EXISTS idx_audit_events_action_type ON audit_events(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
