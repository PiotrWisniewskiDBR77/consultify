-- Migration: 225_security_mock_seed_extra.sql
-- Purpose: Add richer demo data for Security (sessions, login history, API keys usage, activity logs)

WITH org AS (
    SELECT id FROM organizations ORDER BY created_at LIMIT 1
),
usr AS (
    SELECT id, email, first_name, last_name FROM users ORDER BY created_at LIMIT 1
)

-- Extra sessions (SQLite-friendly schema)
INSERT OR IGNORE INTO user_sessions (
    id, user_id, organization_id, session_token, ip_address, user_agent,
    device_type, browser, os, location_country, location_city, login_method,
    started_at, last_activity_at, expires_at, is_active
)
SELECT 'sess-mock-3', usr.id, org.id, 'sess-token-3', '172.16.0.10', 'Edge/120',
       'desktop', 'Edge', 'Windows', 'PL', 'Gdansk', 'password',
       datetime('now','-12 hours'), datetime('now','-30 minutes'), datetime('now','+10 days'), 0
FROM org, usr;

INSERT OR IGNORE INTO user_sessions (
    id, user_id, organization_id, session_token, ip_address, user_agent,
    device_type, browser, os, location_country, location_city, login_method,
    started_at, last_activity_at, expires_at, is_active
)
SELECT 'sess-mock-4', usr.id, org.id, 'sess-token-4', '172.16.0.11', 'Mobile Safari',
       'tablet', 'Safari', 'iOS', 'PL', 'Poznan', 'password',
       datetime('now','-3 days'), datetime('now','-2 days'), datetime('now','+3 days'), 0
FROM org, usr;

-- Extra login history
INSERT OR IGNORE INTO login_history (id, user_id, organization_id, ip_address, user_agent, location, status, failure_reason, created_at)
SELECT 'login-mock-3', usr.id, org.id, '172.16.0.10', 'Edge/120', 'Gdansk, PL', 'success', NULL, datetime('now','-12 hours') FROM org, usr;

INSERT OR IGNORE INTO login_history (id, user_id, organization_id, ip_address, user_agent, location, status, failure_reason, created_at)
SELECT 'login-mock-4', usr.id, org.id, '172.16.0.11', 'Mobile Safari', 'Poznan, PL', 'failed', 'mfa_required', datetime('now','-2 days') FROM org, usr;

-- Extra API key (read-only) and usage
INSERT OR IGNORE INTO api_keys (
    id, organization_id, user_id, name, description, key_hash, key_prefix, key_type,
    scopes, rate_limit_per_minute, rate_limit_per_day, allowed_ips, usage_count, is_active, created_by
)
SELECT 'api-mock-2', org.id, usr.id, 'Read-Only Key', 'Seeded read-only key', 'sha256-demo-hash-ro', 'demo5678', 'org',
       '["read:projects","read:tasks"]', 200, 20000, '["172.16.0.0/16"]', 40, 1, usr.id
FROM org, usr;

INSERT OR IGNORE INTO api_key_usage (id, api_key_id, endpoint, method, status_code, response_time_ms, ip_address, user_agent, created_at)
SELECT 'usage-mock-3', 'api-mock-2', '/api/tasks', 'GET', 200, 180, '172.16.0.10', 'Edge/120', datetime('now','-30 minutes')
UNION ALL
SELECT 'usage-mock-4', 'api-mock-2', '/api/reports', 'GET', 429, 50, '172.16.0.11', 'Mobile Safari', datetime('now','-1 day');

-- Extra activity logs (if table exists)
INSERT OR IGNORE INTO activity_logs (id, user_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
SELECT 'act-mock-3', usr.id, 'password_policy_update', 'security', 'policy', '172.16.0.10', 'Edge/120', datetime('now','-11 hours')
FROM usr
WHERE EXISTS (SELECT 1 FROM pragma_table_info('activity_logs'));

INSERT OR IGNORE INTO activity_logs (id, user_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
SELECT 'act-mock-4', usr.id, 'api_key_usage_spike', 'api_key', 'api-mock-2', '172.16.0.11', 'Mobile Safari', datetime('now','-1 day')
FROM usr
WHERE EXISTS (SELECT 1 FROM pragma_table_info('activity_logs'));

