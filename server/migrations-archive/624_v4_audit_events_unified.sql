-- V4-ENT-03: Unified audit log
-- DoD: audit_events (actorId, actorType, action, resourceType, resourceId, before, after, metadata, timestamp)
-- Creates canonical table; adds columns if 019_audit_events already exists with legacy schema.

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actor_id TEXT,
    actor_type TEXT NOT NULL DEFAULT 'USER',
    org_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    before_json TEXT,
    after_json TEXT,
    metadata_json TEXT DEFAULT '{}',
    ip TEXT,
    user_agent TEXT,
    FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- Add V4 columns if table existed from 019 (Postgres ADD COLUMN IF NOT EXISTS)
-- Compatibility: 019 used actor_user_id, action_type, entity_type, entity_id
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS before_json TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS after_json TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS actor_id TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS resource_id TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_events_org ON audit_events(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_ts ON audit_events(ts);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON audit_events(resource_type, resource_id);
