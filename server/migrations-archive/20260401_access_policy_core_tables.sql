-- Access policy / chat gating (AccessLimitService + AccessUsageService)
-- Production DBs that skipped full init may be missing these tables, which breaks
-- /api/ai/chat/stream during checkAccess() with: relation "organization_limits" does not exist.

CREATE TABLE IF NOT EXISTS organization_limits (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    max_projects INTEGER NOT NULL DEFAULT 3,
    max_users INTEGER NOT NULL DEFAULT 4,
    max_ai_calls_per_day INTEGER NOT NULL DEFAULT 50,
    max_initiatives INTEGER NOT NULL DEFAULT 5,
    max_storage_mb INTEGER NOT NULL DEFAULT 100,
    max_total_tokens INTEGER DEFAULT 100000,
    ai_roles_enabled_json TEXT DEFAULT '["ADVISOR"]'
);

CREATE INDEX IF NOT EXISTS idx_organization_limits_org_id ON organization_limits(organization_id);

CREATE TABLE IF NOT EXISTS usage_counters (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    counter_date DATE NOT NULL,
    ai_calls_count INTEGER DEFAULT 0,
    projects_count INTEGER DEFAULT 0,
    users_count INTEGER DEFAULT 0,
    initiatives_count INTEGER DEFAULT 0,
    storage_used_mb INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, counter_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_counters_org_date ON usage_counters(organization_id, counter_date);
