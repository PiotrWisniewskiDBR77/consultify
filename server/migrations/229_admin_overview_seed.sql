-- Admin Overview Seed
-- Seeds demo data for metrics/org and admin-dashboard endpoints
-- Creates missing tables used by overview dashboards and fills them with sample data

-- Ensure required tables exist
CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    metadata_json TEXT,
    actor_user_id TEXT,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_events_org ON audit_events(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_ts ON audit_events(ts);

CREATE TABLE IF NOT EXISTS scheduled_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    location TEXT,
    is_all_day INTEGER DEFAULT 0,
    status TEXT DEFAULT 'SCHEDULED',
    project_id TEXT,
    attendees TEXT DEFAULT '[]',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_org ON scheduled_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_start ON scheduled_events(start_time);

CREATE TABLE IF NOT EXISTS ai_usage_stats (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    project_id TEXT,
    period_start DATETIME NOT NULL,
    period_end DATETIME NOT NULL,
    requests_count INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    tier TEXT DEFAULT 'STANDARD',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, period_start, period_end)
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_org ON ai_usage_stats(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_user ON ai_usage_stats(user_id);

-- Seed data only if tables are empty
WITH org AS (
    SELECT id FROM organizations LIMIT 1
),
usr AS (
    SELECT id, organization_id FROM users WHERE organization_id = (SELECT id FROM org) LIMIT 1
),
proj AS (
    SELECT id FROM projects WHERE organization_id = (SELECT id FROM org) LIMIT 1
)
INSERT OR IGNORE INTO audit_events (id, org_id, action_type, metadata_json, actor_user_id, ts)
SELECT
    'audit-evt-1',
    o.id,
    'USER_LOGIN',
    json('{"description":"Admin logged in","ip":"192.168.1.10"}'),
    u.id,
    datetime('now', '-2 hours')
FROM org o LEFT JOIN usr u ON o.id = u.organization_id
WHERE NOT EXISTS (SELECT 1 FROM audit_events);

INSERT OR IGNORE INTO audit_events (id, org_id, action_type, metadata_json, actor_user_id, ts)
SELECT
    'audit-evt-2',
    o.id,
    'PROJECT_CREATE',
    json('{"description":"Created Project Aurora","projectKey":"AUR-001"}'),
    u.id,
    datetime('now', '-1 hour')
FROM org o LEFT JOIN usr u ON o.id = u.organization_id
WHERE NOT EXISTS (SELECT 1 FROM audit_events WHERE id = 'audit-evt-2');

INSERT OR IGNORE INTO audit_events (id, org_id, action_type, metadata_json, actor_user_id, ts)
SELECT
    'audit-evt-3',
    o.id,
    'SETTINGS_UPDATE',
    json('{"description":"Updated security settings","section":"security"}'),
    u.id,
    datetime('now', '-30 minutes')
FROM org o LEFT JOIN usr u ON o.id = u.organization_id
WHERE NOT EXISTS (SELECT 1 FROM audit_events WHERE id = 'audit-evt-3');

INSERT OR IGNORE INTO scheduled_events (
    id, organization_id, title, description, event_type, start_time, end_time,
    location, is_all_day, status, project_id, attendees, created_by, created_at
)
SELECT
    'sched-evt-1',
    o.id,
    'Executive Steering Committee',
    'Quarterly steering committee to review KPIs and roadmap',
    'meeting',
    datetime('now', '+1 day'),
    datetime('now', '+1 day', '+90 minutes'),
    'HQ - Room 12 / Zoom',
    0,
    'SCHEDULED',
    p.id,
    json_array('ceo@consultinity.com', 'cto@consultinity.com'),
    u.id,
    datetime('now')
FROM org o
LEFT JOIN usr u ON o.id = u.organization_id
LEFT JOIN proj p ON 1=1
WHERE NOT EXISTS (SELECT 1 FROM scheduled_events);

INSERT OR IGNORE INTO scheduled_events (
    id, organization_id, title, description, event_type, start_time, end_time,
    location, is_all_day, status, project_id, attendees, created_by, created_at
)
SELECT
    'sched-evt-2',
    o.id,
    'Security Incident Review',
    'Post-incident RCA and action items',
    'review',
    datetime('now', '+2 days'),
    datetime('now', '+2 days', '+60 minutes'),
    'Virtual',
    0,
    'SCHEDULED',
    p.id,
    json_array('ciso@consultinity.com', 'devsecops@consultinity.com'),
    u.id,
    datetime('now')
FROM org o
LEFT JOIN usr u ON o.id = u.organization_id
LEFT JOIN proj p ON 1=1
WHERE NOT EXISTS (SELECT 1 FROM scheduled_events WHERE id = 'sched-evt-2');

-- Help analytics for metrics funnels
INSERT OR IGNORE INTO help_analytics (id, user_id, organization_id, session_id, event_type, content_type, content_id, metadata, duration_ms, created_at)
SELECT
    'help-evt-1',
    u.id,
    o.id,
    'session-1',
    'view',
    'module',
    'getting_started',
    json('{"playbookKey":"getting_started"}'),
    120000,
    datetime('now', '-3 days')
FROM org o LEFT JOIN usr u ON o.id = u.organization_id
WHERE NOT EXISTS (SELECT 1 FROM help_analytics);

INSERT OR IGNORE INTO help_analytics (id, user_id, organization_id, session_id, event_type, content_type, content_id, metadata, duration_ms, created_at)
SELECT
    'help-evt-2',
    u.id,
    o.id,
    'session-2',
    'complete',
    'module',
    'team_setup',
    json('{"playbookKey":"team_setup"}'),
    600000,
    datetime('now', '-1 day')
FROM org o LEFT JOIN usr u ON o.id = u.organization_id
WHERE NOT EXISTS (SELECT 1 FROM help_analytics WHERE id = 'help-evt-2');

INSERT OR IGNORE INTO help_analytics (id, user_id, organization_id, session_id, event_type, content_type, content_id, metadata, duration_ms, created_at)
SELECT
    'help-evt-3',
    u.id,
    o.id,
    'session-3',
    'click',
    'module',
    'integrations',
    json('{"playbookKey":"integrations"}'),
    90000,
    datetime('now', '-12 hours')
FROM org o LEFT JOIN usr u ON o.id = u.organization_id
WHERE NOT EXISTS (SELECT 1 FROM help_analytics WHERE id = 'help-evt-3');

-- AI usage logs for analytics and cost attribution
INSERT OR IGNORE INTO ai_usage_logs (id, user_id, organization_id, provider, model, action, prompt_tokens, completion_tokens, tokens_used, latency_ms, status, created_at)
SELECT
    'ai-log-1',
    u.id,
    o.id,
    'openai',
    'gpt-4o',
    'generate_report',
    1200,
    800,
    2000,
    1800,
    'success',
    datetime('now', '-2 days')
FROM org o LEFT JOIN usr u ON o.id = u.organization_id
WHERE NOT EXISTS (SELECT 1 FROM ai_usage_logs);

INSERT OR IGNORE INTO ai_usage_logs (id, user_id, organization_id, provider, model, action, prompt_tokens, completion_tokens, tokens_used, latency_ms, status, error_message, created_at)
SELECT
    'ai-log-2',
    u.id,
    o.id,
    'anthropic',
    'claude-3',
    'summarize_incident',
    900,
    600,
    1500,
    2100,
    'error',
    'Rate limit exceeded',
    datetime('now', '-1 day')
FROM org o LEFT JOIN usr u ON o.id = u.organization_id
WHERE NOT EXISTS (SELECT 1 FROM ai_usage_logs WHERE id = 'ai-log-2');

INSERT OR IGNORE INTO ai_usage_logs (id, user_id, organization_id, provider, model, action, prompt_tokens, completion_tokens, tokens_used, latency_ms, status, created_at)
SELECT
    'ai-log-3',
    u.id,
    o.id,
    'google',
    'gemini-pro',
    'generate_insights',
    600,
    500,
    1100,
    1500,
    'success',
    datetime('now', '-6 hours')
FROM org o LEFT JOIN usr u ON o.id = u.organization_id
WHERE NOT EXISTS (SELECT 1 FROM ai_usage_logs WHERE id = 'ai-log-3');

-- Aggregated usage stats for dashboard cost attribution
INSERT OR IGNORE INTO ai_usage_stats (id, organization_id, user_id, project_id, period_start, period_end, requests_count, tokens_used, cost_usd, tier)
SELECT
    'ai-stat-usr',
    o.id,
    u.id,
    p.id,
    date('now', '-7 days'),
    date('now'),
    42,
    120000,
    0.24,
    'STANDARD'
FROM org o LEFT JOIN usr u ON o.id = u.organization_id LEFT JOIN proj p ON 1=1
WHERE NOT EXISTS (SELECT 1 FROM ai_usage_stats WHERE id = 'ai-stat-usr');

INSERT OR IGNORE INTO ai_usage_stats (id, organization_id, user_id, project_id, period_start, period_end, requests_count, tokens_used, cost_usd, tier)
SELECT
    'ai-stat-proj',
    o.id,
    NULL,
    p.id,
    date('now', '-7 days'),
    date('now'),
    18,
    80000,
    0.16,
    'PROJECT'
FROM org o LEFT JOIN proj p ON 1=1
WHERE p.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_usage_stats WHERE id = 'ai-stat-proj');
