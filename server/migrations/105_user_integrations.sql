-- Migration: 105_user_integrations.sql
-- Purpose: User-level integrations and notification preferences
-- Part of: User-Level Notifications & Integrations System
-- Date: 2026-01-01

-- ============================================
-- 1. User Integrations (each user has their own connections)
-- ============================================
CREATE TABLE IF NOT EXISTS user_integrations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,  -- 'slack', 'teams', 'jira', 'clickup'
    
    -- OAuth tokens (encrypted)
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at DATETIME,
    
    -- Provider-specific data
    external_user_id TEXT,          -- ID of user in external system
    external_workspace_id TEXT,     -- e.g., Slack workspace, Jira site
    external_workspace_name TEXT,
    
    -- Configuration
    config_json TEXT,               -- provider-specific settings (JSON)
    
    -- Status
    status TEXT DEFAULT 'active',   -- 'active', 'expired', 'revoked', 'error'
    last_sync_at DATETIME,
    last_error TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, provider),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 2. User Notification Preferences V2 (extended)
-- ============================================
CREATE TABLE IF NOT EXISTS user_notification_preferences_v2 (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    
    -- Global toggle
    global_enabled INTEGER DEFAULT 1,
    
    -- Schedule settings (JSON)
    -- { quietHoursEnabled, quietHoursStart, quietHoursEnd, quietDays, timezone }
    schedule_json TEXT DEFAULT '{"quietHoursEnabled":false,"quietHoursStart":"22:00","quietHoursEnd":"08:00","quietDays":[],"timezone":"UTC"}',
    
    -- Urgency settings (JSON)
    -- { criticalOverridesQuietHours, escalationDelayMinutes }
    urgency_json TEXT DEFAULT '{"criticalOverridesQuietHours":true,"escalationDelayMinutes":30}',
    
    -- Categories preferences (JSON) - which notification types are enabled per category
    -- { tasks: {...}, governance: {...}, collaboration: {...}, ai: {...}, system: {...} }
    categories_json TEXT DEFAULT '{}',
    
    -- Channel preferences per notification type (JSON)
    -- { in_app: true, email: true, push: false, slack: false, teams: false }
    channel_preferences_json TEXT DEFAULT '{"in_app":true,"email":true,"push":false}',
    
    -- Digests settings (JSON)
    -- { dailyEnabled, dailyTime, weeklyEnabled, weeklyDay, weeklyTime, ... }
    digests_json TEXT DEFAULT '{"dailyEnabled":false,"dailyTime":"09:00","weeklyEnabled":true,"weeklyDay":"monday","weeklyTime":"09:00"}',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 3. User Watchers (what objects user is watching)
-- ============================================
CREATE TABLE IF NOT EXISTS user_watchers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    object_type TEXT NOT NULL,      -- 'task', 'initiative', 'project'
    object_id TEXT NOT NULL,
    notify_on TEXT DEFAULT 'all',   -- 'all', 'mentions', 'status_changes'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, object_type, object_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 4. User Integration Sync Logs
-- ============================================
CREATE TABLE IF NOT EXISTS user_integration_sync_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    integration_id TEXT NOT NULL,
    direction TEXT NOT NULL,        -- 'inbound', 'outbound'
    action TEXT,                    -- 'create', 'update', 'delete', 'notify'
    object_type TEXT,               -- 'task', 'notification', etc.
    object_id TEXT,
    external_id TEXT,
    status TEXT,                    -- 'success', 'failed', 'pending'
    error_message TEXT,
    request_payload TEXT,           -- JSON of what was sent
    response_payload TEXT,          -- JSON of response received
    latency_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(integration_id) REFERENCES user_integrations(id) ON DELETE CASCADE
);

-- ============================================
-- 5. Due Date Reminders Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS due_date_reminders_sent (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    reminder_type TEXT NOT NULL,    -- '1_week', '3_days', '1_day', '1_hour', 'at_due'
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    channel TEXT,                   -- 'email', 'in_app', 'slack', etc.
    
    UNIQUE(user_id, task_id, reminder_type),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- ============================================
-- 6. MCP Audit Logs (for AI integrations)
-- ============================================
CREATE TABLE IF NOT EXISTS mcp_audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    tool_name TEXT,
    resource_path TEXT,
    prompt_name TEXT,
    request_json TEXT,
    response_json TEXT,
    success INTEGER DEFAULT 1,
    error_message TEXT,
    latency_ms INTEGER,
    tokens_used INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

-- ============================================
-- 7. Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_integrations_user ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON user_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_user_integrations_status ON user_integrations(status);

CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_user ON user_notification_preferences_v2(user_id);

CREATE INDEX IF NOT EXISTS idx_user_watchers_user ON user_watchers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_watchers_object ON user_watchers(object_type, object_id);

CREATE INDEX IF NOT EXISTS idx_user_sync_logs_user ON user_integration_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sync_logs_integration ON user_integration_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_user_sync_logs_created ON user_integration_sync_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_due_reminders_user ON due_date_reminders_sent(user_id);
CREATE INDEX IF NOT EXISTS idx_due_reminders_task ON due_date_reminders_sent(task_id);

CREATE INDEX IF NOT EXISTS idx_mcp_audit_user ON mcp_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_created ON mcp_audit_logs(created_at);

-- ============================================
-- 8. Default Notification Categories Template
-- ============================================
-- This is the default categories_json structure for reference:
-- {
--   "tasks": {
--     "enabled": true,
--     "channels": { "in_app": true, "email": true, "push": false, "slack": true, "teams": false },
--     "types": {
--       "TASK_ASSIGNED": true,
--       "TASK_STATUS_CHANGED": true,
--       "TASK_COMMENT_ADDED": true,
--       "TASK_DUE_SOON": true,
--       "TASK_OVERDUE": true,
--       "TASK_COMPLETED": true,
--       "TASK_BLOCKED": true
--     },
--     "dueReminders": { "1_week": false, "3_days": true, "1_day": true, "1_hour": true }
--   },
--   "governance": {
--     "enabled": true,
--     "channels": { "in_app": true, "email": true, "push": true, "slack": true, "teams": true },
--     "types": {
--       "DECISION_REQUIRED": true,
--       "DECISION_MADE": true,
--       "GATE_PENDING_APPROVAL": true,
--       "GATE_APPROVED": true,
--       "CHANGE_REQUEST_SUBMITTED": true
--     }
--   },
--   "collaboration": {
--     "enabled": true,
--     "channels": { "in_app": true, "email": true, "push": true, "slack": true, "teams": true },
--     "types": {
--       "MENTION": true,
--       "COMMENT_REPLY": true,
--       "DOCUMENT_SHARED": true
--     }
--   },
--   "ai": {
--     "enabled": true,
--     "channels": { "in_app": true, "email": false, "push": false, "slack": true, "teams": false },
--     "types": {
--       "AI_RISK_DETECTED": true,
--       "AI_RECOMMENDATION": true,
--       "AI_WORKLOAD_WARNING": true
--     }
--   },
--   "system": {
--     "enabled": true,
--     "channels": { "in_app": true, "email": true, "push": false, "slack": false, "teams": false },
--     "types": {
--       "SYSTEM_MAINTENANCE": true,
--       "FEATURE_ANNOUNCEMENT": false,
--       "PERMISSION_CHANGED": true
--     }
--   }
-- }





