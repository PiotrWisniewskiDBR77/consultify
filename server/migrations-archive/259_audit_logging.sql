-- FLOW-AUDIT-001: Audit Logging
-- Migration: 259_audit_logging.sql

-- ==========================================
-- MAIN AUDIT LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Actor (who performed the action)
    actor_type TEXT NOT NULL, -- 'user', 'system', 'ai', 'integration', 'superadmin', 'cron'
    actor_id TEXT,
    actor_email TEXT,
    actor_name TEXT,
    actor_ip TEXT,
    actor_user_agent TEXT,
    actor_session_id TEXT,
    
    -- Action
    action TEXT NOT NULL, -- e.g., 'auth.login.success', 'data.create', 'admin.user.update'
    action_category TEXT NOT NULL, -- 'auth', 'data', 'admin', 'ai', 'system', 'billing'
    action_description TEXT, -- Human-readable description
    
    -- Resource (what was acted upon)
    resource_type TEXT NOT NULL, -- 'user', 'project', 'initiative', 'task', 'assessment', 'organization', etc.
    resource_id TEXT,
    resource_name TEXT,
    
    -- Context
    organization_id TEXT,
    project_id TEXT,
    
    -- Changes (for data mutations)
    previous_values TEXT, -- JSON: previous state
    new_values TEXT, -- JSON: new state
    changed_fields TEXT, -- JSON array of changed field names
    
    -- Metadata
    metadata TEXT, -- JSON: additional context
    request_id TEXT, -- For correlating related actions
    
    -- Result
    result TEXT NOT NULL DEFAULT 'success', -- 'success', 'failure', 'partial'
    error_code TEXT,
    error_message TEXT,
    
    -- Compliance
    retention_category TEXT DEFAULT 'standard', -- 'security', 'compliance', 'standard', 'debug'
    retention_until DATE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- For GDPR
    contains_pii BOOLEAN DEFAULT FALSE,
    anonymized_at TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor_id ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor_type ON audit_log(actor_type);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_log(action_category);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_result ON audit_log(result);
CREATE INDEX IF NOT EXISTS idx_audit_retention ON audit_log(retention_until);
CREATE INDEX IF NOT EXISTS idx_audit_request ON audit_log(request_id);

-- ==========================================
-- AUDIT LOG ARCHIVE
-- ==========================================

CREATE TABLE IF NOT EXISTS audit_log_archive (
    id TEXT PRIMARY KEY,
    original_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    
    -- Summary info
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    action TEXT NOT NULL,
    action_category TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    organization_id TEXT,
    result TEXT NOT NULL,
    
    -- Compressed full data
    compressed_data BYTEA, -- GZIP compressed JSON
    
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archive_reason TEXT -- 'retention_policy', 'manual', 'compliance'
);

CREATE INDEX IF NOT EXISTS idx_archive_timestamp ON audit_log_archive(timestamp);
CREATE INDEX IF NOT EXISTS idx_archive_org ON audit_log_archive(organization_id);
CREATE INDEX IF NOT EXISTS idx_archive_action ON audit_log_archive(action);

-- ==========================================
-- AUDIT EXPORT HISTORY
-- ==========================================

CREATE TABLE IF NOT EXISTS audit_export_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    exported_by TEXT NOT NULL,
    
    -- Filter criteria used
    date_from DATE,
    date_to DATE,
    action_category TEXT,
    actor_id TEXT,
    resource_type TEXT,
    
    -- Export details
    total_records INTEGER NOT NULL,
    file_format TEXT NOT NULL, -- 'csv', 'json', 'xlsx'
    file_size_bytes INTEGER,
    file_hash TEXT, -- SHA256 for integrity
    
    -- Download tracking
    storage_path TEXT, -- Internal path
    download_url TEXT,
    download_token TEXT,
    expires_at TIMESTAMP,
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_export_org ON audit_export_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_export_expires ON audit_export_history(expires_at);

-- ==========================================
-- AUDIT RETENTION POLICIES
-- ==========================================

CREATE TABLE IF NOT EXISTS audit_retention_policies (
    id TEXT PRIMARY KEY,
    organization_id TEXT, -- NULL for system default
    
    -- Category retention (in days)
    security_retention_days INTEGER DEFAULT 2555, -- 7 years
    compliance_retention_days INTEGER DEFAULT 2555, -- 7 years
    standard_retention_days INTEGER DEFAULT 365, -- 1 year
    debug_retention_days INTEGER DEFAULT 30, -- 30 days
    
    -- Auto-archive settings
    auto_archive_enabled BOOLEAN DEFAULT TRUE,
    archive_after_days INTEGER DEFAULT 365,
    
    -- Delete settings
    auto_delete_enabled BOOLEAN DEFAULT FALSE,
    delete_after_days INTEGER DEFAULT 2555,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id)
);

-- Default retention policy
INSERT INTO audit_retention_policies (id, organization_id) VALUES ('default', NULL)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- AUDIT ALERTS
-- ==========================================

CREATE TABLE IF NOT EXISTS audit_alerts (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    
    -- Alert definition
    name TEXT NOT NULL,
    description TEXT,
    
    -- Trigger conditions (JSON)
    conditions TEXT NOT NULL, -- e.g., {"action": "auth.login.failure", "count_threshold": 5, "time_window_minutes": 5}
    
    -- Notification
    notify_channels TEXT DEFAULT '["email"]', -- JSON array
    notify_recipients TEXT, -- JSON array of user IDs or emails
    
    -- Status
    is_enabled BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP,
    trigger_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_alerts_org ON audit_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_alerts_enabled ON audit_alerts(is_enabled);

-- ==========================================
-- AUDIT STATISTICS (materialized)
-- ==========================================

CREATE TABLE IF NOT EXISTS audit_statistics (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    date DATE NOT NULL,
    
    -- Counts by category
    auth_count INTEGER DEFAULT 0,
    data_count INTEGER DEFAULT 0,
    admin_count INTEGER DEFAULT 0,
    ai_count INTEGER DEFAULT 0,
    system_count INTEGER DEFAULT 0,
    
    -- Success/Failure
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    
    -- Top actions (JSON)
    top_actions TEXT, -- [{action, count}]
    top_actors TEXT, -- [{actorId, count}]
    
    -- Computed
    total_count INTEGER DEFAULT 0,
    
    UNIQUE(organization_id, date)
);

CREATE INDEX IF NOT EXISTS idx_audit_stats_org ON audit_statistics(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_stats_date ON audit_statistics(date);
