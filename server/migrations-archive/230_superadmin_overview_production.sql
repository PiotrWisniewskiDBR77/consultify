-- ============================================================
-- SUPERADMIN OVERVIEW MODULE - PRODUCTION READY
-- Enterprise SaaS Tables & Demo Data
-- ============================================================

-- 1. CONVERSION TRACKING
CREATE TABLE IF NOT EXISTS conversion_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    user_id TEXT,
    event_type TEXT NOT NULL, -- 'VISIT', 'LEAD', 'TRIAL_START', 'DEMO', 'PAID', 'CHURN'
    source TEXT DEFAULT 'direct', -- 'direct', 'organic', 'referral', 'paid', 'social', 'partner'
    utm_campaign TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    referrer_url TEXT,
    partner_id TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conversion_events_type ON conversion_events(event_type);
CREATE INDEX IF NOT EXISTS idx_conversion_events_source ON conversion_events(source);
CREATE INDEX IF NOT EXISTS idx_conversion_events_created ON conversion_events(created_at);
CREATE INDEX IF NOT EXISTS idx_conversion_events_org ON conversion_events(organization_id);

-- 2. HELP PROGRESS TRACKING
CREATE TABLE IF NOT EXISTS help_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,
    playbook_key TEXT NOT NULL,
    step_index INTEGER DEFAULT 0,
    total_steps INTEGER NOT NULL DEFAULT 5,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completion_percentage INTEGER DEFAULT 0,
    UNIQUE(user_id, playbook_key)
);
CREATE INDEX IF NOT EXISTS idx_help_progress_playbook ON help_progress(playbook_key);
CREATE INDEX IF NOT EXISTS idx_help_progress_user ON help_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_help_progress_org ON help_progress(organization_id);

-- 3. EARLY WARNING SIGNALS
CREATE TABLE IF NOT EXISTS churn_warnings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    warning_type TEXT NOT NULL, -- 'USAGE_DROP', 'NO_LOGIN', 'FEATURE_ABANDON', 'SUPPORT_ISSUES', 'PAYMENT_RISK'
    severity TEXT DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    message TEXT,
    metrics TEXT, -- JSON with details
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_churn_warnings_org ON churn_warnings(organization_id);
CREATE INDEX IF NOT EXISTS idx_churn_warnings_status ON churn_warnings(status);
CREATE INDEX IF NOT EXISTS idx_churn_warnings_severity ON churn_warnings(severity);

-- 4. LOGIN HISTORY (if not exists)
CREATE TABLE IF NOT EXISTS login_history (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    email TEXT,
    organization_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'success', -- 'success', 'failed'
    failure_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at);
CREATE INDEX IF NOT EXISTS idx_login_history_status ON login_history(status);

-- 5. API LOGS (if not exists)
CREATE TABLE IF NOT EXISTS api_logs (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    method TEXT,
    user_id TEXT,
    organization_id TEXT,
    status_code INTEGER,
    response_time_ms INTEGER,
    error_message TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_logs(status_code);

-- 6. AI USAGE LOGS - Extended columns (if not exists or add columns)
-- Note: ai_usage_logs is the primary table, created in migration 208
-- This adds any missing columns for compatibility
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    provider TEXT,
    model TEXT,
    action TEXT,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    latency_ms INTEGER,
    cost_usd REAL DEFAULT 0,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_ext ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_ext ON ai_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_org_ext ON ai_usage_logs(organization_id);

-- ============================================================
-- SEED: CONVERSION FUNNEL DATA (realistic enterprise demo)
-- ============================================================

-- Visits → Leads
INSERT OR IGNORE INTO conversion_events (id, event_type, source, created_at) VALUES
    ('conv-visit-001', 'VISIT', 'organic', datetime('now', '-30 days')),
    ('conv-visit-002', 'VISIT', 'organic', datetime('now', '-29 days')),
    ('conv-visit-003', 'VISIT', 'direct', datetime('now', '-28 days')),
    ('conv-visit-004', 'VISIT', 'paid', datetime('now', '-27 days')),
    ('conv-visit-005', 'VISIT', 'referral', datetime('now', '-26 days')),
    ('conv-visit-006', 'VISIT', 'social', datetime('now', '-25 days')),
    ('conv-visit-007', 'VISIT', 'organic', datetime('now', '-24 days')),
    ('conv-visit-008', 'VISIT', 'partner', datetime('now', '-23 days')),
    ('conv-visit-009', 'VISIT', 'direct', datetime('now', '-22 days')),
    ('conv-visit-010', 'VISIT', 'organic', datetime('now', '-21 days'));

-- Leads
INSERT OR IGNORE INTO conversion_events (id, event_type, source, created_at, metadata) VALUES
    ('conv-lead-001', 'LEAD', 'organic', datetime('now', '-28 days'), '{"email":"lead1@example.com"}'),
    ('conv-lead-002', 'LEAD', 'direct', datetime('now', '-26 days'), '{"email":"lead2@example.com"}'),
    ('conv-lead-003', 'LEAD', 'paid', datetime('now', '-24 days'), '{"email":"lead3@example.com"}'),
    ('conv-lead-004', 'LEAD', 'referral', datetime('now', '-22 days'), '{"email":"lead4@example.com"}'),
    ('conv-lead-005', 'LEAD', 'organic', datetime('now', '-20 days'), '{"email":"lead5@example.com"}');

-- Demos
INSERT OR IGNORE INTO conversion_events (id, event_type, source, created_at, metadata) VALUES
    ('conv-demo-001', 'DEMO', 'organic', datetime('now', '-25 days'), '{"duration_min":45}'),
    ('conv-demo-002', 'DEMO', 'direct', datetime('now', '-23 days'), '{"duration_min":30}'),
    ('conv-demo-003', 'DEMO', 'paid', datetime('now', '-21 days'), '{"duration_min":60}');

-- Trial starts
INSERT OR IGNORE INTO conversion_events (id, organization_id, event_type, source, created_at) 
SELECT 'conv-trial-001', id, 'TRIAL_START', 'organic', datetime('now', '-20 days')
FROM organizations WHERE name LIKE '%DBR77%' OR name LIKE '%Technolex%' LIMIT 1;

INSERT OR IGNORE INTO conversion_events (id, organization_id, event_type, source, created_at) 
SELECT 'conv-trial-002', id, 'TRIAL_START', 'direct', datetime('now', '-18 days')
FROM organizations WHERE name LIKE '%Digitrans%' LIMIT 1;

-- Paid conversions
INSERT OR IGNORE INTO conversion_events (id, organization_id, event_type, source, created_at, metadata) 
SELECT 'conv-paid-001', id, 'PAID', 'organic', datetime('now', '-10 days'), '{"plan":"enterprise","mrr":2500}'
FROM organizations WHERE name LIKE '%DBR77%' LIMIT 1;

-- ============================================================
-- SEED: HELP PROGRESS DATA
-- ============================================================

INSERT OR IGNORE INTO help_progress (id, user_id, organization_id, playbook_key, step_index, total_steps, started_at, completed_at, completion_percentage)
SELECT 
    'help-prog-' || u.id || '-gs',
    u.id,
    u.organization_id,
    'getting_started',
    5,
    5,
    datetime('now', '-14 days'),
    datetime('now', '-12 days'),
    100
FROM users u WHERE u.role = 'admin' OR u.role = 'ADMIN' OR u.role = 'superadmin' LIMIT 3;

INSERT OR IGNORE INTO help_progress (id, user_id, organization_id, playbook_key, step_index, total_steps, started_at, completion_percentage)
SELECT 
    'help-prog-' || u.id || '-fp',
    u.id,
    u.organization_id,
    'first_project',
    3,
    5,
    datetime('now', '-7 days'),
    60
FROM users u WHERE u.role = 'admin' OR u.role = 'ADMIN' LIMIT 2;

INSERT OR IGNORE INTO help_progress (id, user_id, organization_id, playbook_key, step_index, total_steps, started_at, completion_percentage)
SELECT 
    'help-prog-' || u.id || '-ts',
    u.id,
    u.organization_id,
    'team_setup',
    4,
    5,
    datetime('now', '-5 days'),
    80
FROM users u LIMIT 2;

INSERT OR IGNORE INTO help_progress (id, user_id, organization_id, playbook_key, step_index, total_steps, started_at, completion_percentage)
SELECT 
    'help-prog-' || u.id || '-int',
    u.id,
    u.organization_id,
    'integrations',
    2,
    5,
    datetime('now', '-3 days'),
    40
FROM users u LIMIT 1;

-- ============================================================
-- SEED: SUPERADMIN SIGNALS (Notifications)
-- ============================================================

-- System Alerts
INSERT OR IGNORE INTO notifications (id, user_id, type, title, message, severity, is_read, created_at)
SELECT 
    'signal-sys-001',
    u.id,
    'SYSTEM_ALERT',
    'High API Latency Detected',
    'Average API response time exceeded 2s threshold for 15 minutes. Affected endpoints: /api/ai/*, /api/reports/*',
    'HIGH',
    0,
    datetime('now', '-2 hours')
FROM users u WHERE u.role = 'superadmin' OR u.email LIKE '%dbr77%' OR u.email LIKE '%admin%' LIMIT 1;

INSERT OR IGNORE INTO notifications (id, user_id, type, title, message, severity, is_read, created_at)
SELECT 
    'signal-sys-002',
    u.id,
    'SYSTEM_ALERT',
    'Database Connection Pool Warning',
    'Connection pool usage at 85%. Consider scaling database resources.',
    'WARNING',
    0,
    datetime('now', '-4 hours')
FROM users u WHERE u.role = 'superadmin' OR u.email LIKE '%dbr77%' LIMIT 1;

INSERT OR IGNORE INTO notifications (id, user_id, type, title, message, severity, is_read, created_at)
SELECT 
    'signal-sys-003',
    u.id,
    'SYSTEM_ALERT',
    'LLM Provider Rate Limit Approaching',
    'OpenAI API usage at 78% of daily limit. Consider load balancing across providers.',
    'MEDIUM',
    0,
    datetime('now', '-1 day')
FROM users u WHERE u.role = 'superadmin' OR u.email LIKE '%dbr77%' LIMIT 1;

-- Client Tickets
INSERT OR IGNORE INTO notifications (id, user_id, type, title, message, severity, is_read, data, created_at)
SELECT 
    'signal-ticket-001',
    u.id,
    'CLIENT_TICKET',
    'Integration Issue - TechnoLex Corp',
    'Customer reports SSO integration failing intermittently. Priority: High. Ticket #4521',
    'HIGH',
    0,
    '{"ticketId":"4521","organization":"TechnoLex Corp","category":"integration"}',
    datetime('now', '-3 hours')
FROM users u WHERE u.role = 'superadmin' OR u.email LIKE '%dbr77%' LIMIT 1;

INSERT OR IGNORE INTO notifications (id, user_id, type, title, message, severity, is_read, data, created_at)
SELECT 
    'signal-ticket-002',
    u.id,
    'CLIENT_TICKET',
    'Feature Request - Digitrans GmbH',
    'Enterprise customer requesting bulk export functionality for compliance audit. Ticket #4518',
    'MEDIUM',
    0,
    '{"ticketId":"4518","organization":"Digitrans GmbH","category":"feature_request"}',
    datetime('now', '-8 hours')
FROM users u WHERE u.role = 'superadmin' OR u.email LIKE '%dbr77%' LIMIT 1;

INSERT OR IGNORE INTO notifications (id, user_id, type, title, message, severity, is_read, data, created_at)
SELECT 
    'signal-ticket-003',
    u.id,
    'CLIENT_TICKET',
    'Billing Inquiry - Nordic Solutions',
    'Customer questioning invoice line items. Requires finance review. Ticket #4515',
    'LOW',
    0,
    '{"ticketId":"4515","organization":"Nordic Solutions","category":"billing"}',
    datetime('now', '-1 day')
FROM users u WHERE u.role = 'superadmin' OR u.email LIKE '%dbr77%' LIMIT 1;

-- User Feedback
INSERT OR IGNORE INTO notifications (id, user_id, type, title, message, severity, is_read, data, created_at)
SELECT 
    'signal-feedback-001',
    u.id,
    'USER_FEEDBACK',
    'Positive Review - AI Assessment',
    'User @maria.kowalska: "The AI-powered assessment saved us weeks of manual work. Excellent accuracy!" Rating: 5/5',
    'INFO',
    0,
    '{"rating":5,"feature":"ai_assessment","sentiment":"positive"}',
    datetime('now', '-6 hours')
FROM users u WHERE u.role = 'superadmin' OR u.email LIKE '%dbr77%' LIMIT 1;

INSERT OR IGNORE INTO notifications (id, user_id, type, title, message, severity, is_read, data, created_at)
SELECT 
    'signal-feedback-002',
    u.id,
    'USER_FEEDBACK',
    'UX Suggestion - Dashboard',
    'User feedback: "Would be helpful to have customizable dashboard widgets." Source: In-app feedback widget',
    'LOW',
    0,
    '{"category":"ux","feature":"dashboard","sentiment":"neutral"}',
    datetime('now', '-12 hours')
FROM users u WHERE u.role = 'superadmin' OR u.email LIKE '%dbr77%' LIMIT 1;

INSERT OR IGNORE INTO notifications (id, user_id, type, title, message, severity, is_read, data, created_at)
SELECT 
    'signal-feedback-003',
    u.id,
    'USER_FEEDBACK',
    'Performance Concern - Report Generation',
    'User reports: "Large report exports take too long (>30s). Can this be optimized?" Priority suggested by AI: Medium',
    'MEDIUM',
    0,
    '{"category":"performance","feature":"reports","sentiment":"negative"}',
    datetime('now', '-1 day')
FROM users u WHERE u.role = 'superadmin' OR u.email LIKE '%dbr77%' LIMIT 1;

-- ============================================================
-- SEED: LOGIN HISTORY
-- ============================================================

INSERT OR IGNORE INTO login_history (id, user_id, email, organization_id, ip_address, user_agent, status, created_at)
SELECT 
    'login-' || u.id || '-001',
    u.id,
    u.email,
    u.organization_id,
    '192.168.1.' || (ABS(RANDOM()) % 255),
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'success',
    datetime('now', '-' || (ABS(RANDOM()) % 24) || ' hours')
FROM users u LIMIT 10;

INSERT OR IGNORE INTO login_history (id, user_id, email, organization_id, ip_address, user_agent, status, created_at)
SELECT 
    'login-' || u.id || '-002',
    u.id,
    u.email,
    u.organization_id,
    '10.0.0.' || (ABS(RANDOM()) % 255),
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'success',
    datetime('now', '-' || (1 + ABS(RANDOM()) % 48) || ' hours')
FROM users u LIMIT 8;

-- Some failed logins for security monitoring
INSERT OR IGNORE INTO login_history (id, email, ip_address, user_agent, status, failure_reason, created_at) VALUES
    ('login-failed-001', 'unknown@attacker.com', '45.33.32.156', 'curl/7.64.1', 'failed', 'Invalid credentials', datetime('now', '-30 minutes')),
    ('login-failed-002', 'test@test.com', '45.33.32.156', 'curl/7.64.1', 'failed', 'User not found', datetime('now', '-25 minutes'));

-- ============================================================
-- SEED: AI USAGE LOGS (AI metrics for dashboard)
-- ============================================================

INSERT OR IGNORE INTO ai_usage_logs (id, user_id, organization_id, provider, model, action, prompt_tokens, completion_tokens, tokens_used, latency_ms, cost_usd, status, created_at)
SELECT 
    'ai-usage-' || u.id || '-001',
    u.id,
    u.organization_id,
    'openai',
    'gpt-4o',
    'assessment_analysis',
    1500,
    800,
    2300,
    2100,
    0.069,
    'success',
    datetime('now', '-' || (ABS(RANDOM()) % 24) || ' hours')
FROM users u WHERE u.id IS NOT NULL LIMIT 5;

INSERT OR IGNORE INTO ai_usage_logs (id, user_id, organization_id, provider, model, action, prompt_tokens, completion_tokens, tokens_used, latency_ms, cost_usd, status, created_at)
SELECT 
    'ai-usage-' || u.id || '-002',
    u.id,
    u.organization_id,
    'anthropic',
    'claude-3-sonnet',
    'report_generation',
    2000,
    1200,
    3200,
    3500,
    0.048,
    'success',
    datetime('now', '-' || (1 + ABS(RANDOM()) % 48) || ' hours')
FROM users u WHERE u.id IS NOT NULL LIMIT 4;

INSERT OR IGNORE INTO ai_usage_logs (id, user_id, organization_id, provider, model, action, prompt_tokens, completion_tokens, tokens_used, latency_ms, cost_usd, status, created_at)
SELECT 
    'ai-usage-' || u.id || '-003',
    u.id,
    u.organization_id,
    'openai',
    'gpt-4o-mini',
    'chat_response',
    500,
    300,
    800,
    800,
    0.002,
    'success',
    datetime('now', '-' || (ABS(RANDOM()) % 72) || ' hours')
FROM users u WHERE u.id IS NOT NULL LIMIT 6;

-- Additional seed for recent AI activity visible in dashboard
INSERT OR IGNORE INTO ai_usage_logs (id, user_id, organization_id, provider, model, action, prompt_tokens, completion_tokens, tokens_used, latency_ms, cost_usd, status, created_at)
SELECT 
    'ai-usage-recent-' || (ABS(RANDOM()) % 1000),
    u.id,
    u.organization_id,
    'openai',
    'gpt-4o',
    'initiative_recommendation',
    1200,
    600,
    1800,
    1500,
    0.054,
    'success',
    datetime('now', '-' || (ABS(RANDOM()) % 6) || ' hours')
FROM users u WHERE u.id IS NOT NULL AND (u.role = 'admin' OR u.role = 'ADMIN') LIMIT 3;

-- ============================================================
-- SEED: CHURN WARNINGS (Early Warning System)
-- ============================================================

INSERT OR IGNORE INTO churn_warnings (id, organization_id, warning_type, severity, message, metrics, status, created_at)
SELECT 
    'warn-001',
    o.id,
    'USAGE_DROP',
    'HIGH',
    'Weekly active users dropped by 45% compared to previous week',
    '{"previous_wau":25,"current_wau":14,"drop_percent":44}',
    'ACTIVE',
    datetime('now', '-2 days')
FROM organizations o WHERE o.status = 'active' OR o.status IS NULL LIMIT 1;

INSERT OR IGNORE INTO churn_warnings (id, organization_id, warning_type, severity, message, metrics, status, created_at)
SELECT 
    'warn-002',
    o.id,
    'NO_LOGIN',
    'MEDIUM',
    'No admin login for 14 days',
    '{"last_login":"2025-12-25","days_since":16}',
    'ACTIVE',
    datetime('now', '-1 day')
FROM organizations o WHERE o.status = 'active' OR o.status IS NULL LIMIT 1 OFFSET 1;

-- ============================================================
-- SEED: API LOGS (Performance metrics)
-- ============================================================

INSERT OR IGNORE INTO api_logs (id, endpoint, method, status_code, response_time_ms, created_at) VALUES
    ('api-log-001', '/api/assessments', 'GET', 200, 45, datetime('now', '-5 minutes')),
    ('api-log-002', '/api/ai/analyze', 'POST', 200, 2100, datetime('now', '-10 minutes')),
    ('api-log-003', '/api/reports/generate', 'POST', 200, 1850, datetime('now', '-15 minutes')),
    ('api-log-004', '/api/initiatives', 'GET', 200, 120, datetime('now', '-20 minutes')),
    ('api-log-005', '/api/users', 'GET', 200, 35, datetime('now', '-25 minutes')),
    ('api-log-006', '/api/ai/chat', 'POST', 500, 5000, datetime('now', '-30 minutes')),
    ('api-log-007', '/api/dashboard', 'GET', 200, 250, datetime('now', '-35 minutes')),
    ('api-log-008', '/api/projects', 'GET', 200, 80, datetime('now', '-40 minutes'));
