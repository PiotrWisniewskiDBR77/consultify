-- Migration: 224_security_mock_seed.sql
-- Purpose: Seed demo security data into real tables so Security UI has data without stubbed endpoints.

WITH org AS (
    SELECT id FROM organizations ORDER BY created_at LIMIT 1
),
usr AS (
    SELECT id, email, first_name, last_name FROM users ORDER BY created_at LIMIT 1
)

-- Security settings per org
INSERT OR IGNORE INTO security_settings (
    organization_id, require_2fa, password_min_length, password_require_uppercase,
    password_require_number, password_require_special, password_expiry_days,
    session_timeout_minutes, max_sessions_per_user, ip_whitelist, updated_by
)
SELECT org.id, 1, 8, 1, 1, 1, 90, 30, 5, '["192.168.1.0/24","10.0.0.0/8"]', usr.id
FROM org, usr
;

-- User 2FA status
INSERT OR IGNORE INTO user_2fa (user_id, is_enabled, secret, backup_codes, enabled_at, last_used_at)
SELECT usr.id, 1, 'SECRET-DEMO', '["code1","code2"]', datetime('now','-10 days'), datetime('now','-1 day')
FROM usr
;

-- Sessions
INSERT OR IGNORE INTO user_sessions (id, user_id, token_jti, device_info, ip_address, user_agent, location, created_at, last_active_at, expires_at, is_current)
SELECT 'sess-mock-1', usr.id, 'jti-mock-1', 'MacOS Chrome', '192.168.1.10', 'Chrome/120', 'Warsaw, PL', datetime('now','-2 days'), datetime('now','-1 hour'), datetime('now','+7 days'), 0 FROM usr;

INSERT OR IGNORE INTO user_sessions (id, user_id, token_jti, device_info, ip_address, user_agent, location, created_at, last_active_at, expires_at, is_current)
SELECT 'sess-mock-2', usr.id, 'jti-mock-2', 'iPhone Safari', '10.0.0.5', 'Mobile Safari', 'Krakow, PL', datetime('now','-1 day'), datetime('now','-10 minutes'), datetime('now','+5 days'), 1 FROM usr;

-- Login history
INSERT OR IGNORE INTO login_history (id, user_id, organization_id, ip_address, user_agent, location, status, failure_reason, created_at)
SELECT 'login-mock-1', usr.id, org.id, '192.168.1.10', 'Chrome/120', 'Warsaw, PL', 'success', NULL, datetime('now','-1 day') FROM org, usr;

INSERT OR IGNORE INTO login_history (id, user_id, organization_id, ip_address, user_agent, location, status, failure_reason, created_at)
SELECT 'login-mock-2', usr.id, org.id, '10.0.0.5', 'Mobile Safari', 'Krakow, PL', 'failed', 'invalid_password', datetime('now','-3 hours') FROM org, usr;

-- API keys (hashed key placeholder)
INSERT OR IGNORE INTO api_keys (
    id, organization_id, user_id, name, description, key_hash, key_prefix, key_type,
    scopes, rate_limit_per_minute, rate_limit_per_day, allowed_ips, usage_count, is_active, created_by
)
SELECT 'api-mock-1', org.id, usr.id, 'Demo Integration Key', 'Seeded demo key', 'sha256-demo-hash', 'demo1234', 'org',
       '["read:projects","ai:execute"]', 100, 10000, '["192.168.1.0/24"]', 25, 1, usr.id
FROM org, usr
;

-- API key usage
INSERT OR IGNORE INTO api_key_usage (id, api_key_id, endpoint, method, status_code, response_time_ms, ip_address, user_agent, created_at)
SELECT 'usage-mock-1', 'api-mock-1', '/api/projects', 'GET', 200, 120, '192.168.1.10', 'Chrome/120', datetime('now','-2 hours')
UNION ALL
SELECT 'usage-mock-2', 'api-mock-1', '/api/ai/execute', 'POST', 200, 450, '10.0.0.5', 'Mobile Safari', datetime('now','-1 hour');

-- Activity logs / audit (if activity_logs exists)
INSERT OR IGNORE INTO activity_logs (id, user_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
SELECT 'act-mock-1', usr.id, 'login_success', 'auth', usr.id, '192.168.1.10', 'Chrome/120', datetime('now','-1 day')
FROM usr
WHERE EXISTS (
    SELECT 1 FROM sqlite_master
    WHERE type = 'table' AND name = 'activity_logs'
);

INSERT OR IGNORE INTO activity_logs (id, user_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
SELECT 'act-mock-2', usr.id, 'api_key_created', 'api_key', 'api-mock-1', '10.0.0.5', 'Mobile Safari', datetime('now','-3 hours')
FROM usr
WHERE EXISTS (
    SELECT 1 FROM sqlite_master 
    WHERE type = 'table' AND name = 'activity_logs'
);
