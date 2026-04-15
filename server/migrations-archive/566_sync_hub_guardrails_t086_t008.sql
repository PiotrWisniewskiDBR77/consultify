-- Migration 564: T086 Unified Sync Hub + T008 Sync Guardrails
-- Adds sync runs history, integration audit log, guardrails config

-- ============================================================
-- Extend integrations table with sync hub fields
-- ============================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'is_paused') THEN
        ALTER TABLE integrations ADD COLUMN is_paused BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'paused_at') THEN
        ALTER TABLE integrations ADD COLUMN paused_at TIMESTAMP;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'sync_schedule') THEN
        ALTER TABLE integrations ADD COLUMN sync_schedule TEXT DEFAULT 'manual';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'scopes') THEN
        ALTER TABLE integrations ADD COLUMN scopes JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'display_name') THEN
        ALTER TABLE integrations ADD COLUMN display_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'icon_url') THEN
        ALTER TABLE integrations ADD COLUMN icon_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'error_count') THEN
        ALTER TABLE integrations ADD COLUMN error_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'last_healthy_at') THEN
        ALTER TABLE integrations ADD COLUMN last_healthy_at TIMESTAMP;
    END IF;
END $$;

-- ============================================================
-- Sync runs — detailed history of each sync execution
-- ============================================================
CREATE TABLE IF NOT EXISTS integration_sync_runs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL,
    integration_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'pull' CHECK (direction IN ('pull', 'push', 'bidirectional')),
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'partial')),
    items_processed INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    error_summary TEXT,
    error_details JSONB,
    duration_ms INTEGER,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    triggered_by TEXT DEFAULT 'manual',
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_integration ON integration_sync_runs(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_org ON integration_sync_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_started ON integration_sync_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON integration_sync_runs(status);

-- ============================================================
-- Integration audit log — who did what
-- ============================================================
CREATE TABLE IF NOT EXISTS integration_audit_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL,
    integration_id TEXT,
    action TEXT NOT NULL,
    actor_id TEXT,
    actor_name TEXT,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_int_audit_org ON integration_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_int_audit_integration ON integration_audit_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_int_audit_created ON integration_audit_log(created_at DESC);

-- ============================================================
-- T008: Sync guardrails — rate limit tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_rate_limits (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL,
    integration_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    window_start TIMESTAMP NOT NULL,
    window_minutes INTEGER NOT NULL DEFAULT 60,
    request_count INTEGER DEFAULT 0,
    max_requests INTEGER NOT NULL DEFAULT 100,
    is_throttled BOOLEAN DEFAULT FALSE,
    last_request_at TIMESTAMP,
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_integration ON sync_rate_limits(integration_id, window_start);

-- ============================================================
-- T008: Sync error tracking for retry policy
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_error_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    organization_id TEXT NOT NULL,
    integration_id TEXT NOT NULL,
    sync_run_id TEXT,
    error_type TEXT NOT NULL CHECK (error_type IN ('AUTH', 'RATE_LIMIT', 'NETWORK', 'VALIDATION', 'PROVIDER', 'UNKNOWN')),
    error_code TEXT,
    error_message TEXT NOT NULL,
    is_retryable BOOLEAN DEFAULT TRUE,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_errors_integration ON sync_error_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_errors_unresolved ON sync_error_log(integration_id) WHERE resolved_at IS NULL;
