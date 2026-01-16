-- Migration: 224_security_mock_seed.sql
-- Purpose: Seed demo security data into real tables so Security UI has data without stubbed endpoints.

WITH org AS (
    SELECT id FROM organizations ORDER BY created_at LIMIT 1
),
usr AS (
    SELECT id, email, first_name, last_name FROM users ORDER BY created_at LIMIT 1
)

-- Security settings per org
INSERT INTO security_settings (
    organization_id, require_2fa, password_min_length, password_require_uppercase,
    password_require_number, password_require_special, password_expiry_days,
    session_timeout_minutes, max_sessions_per_user, ip_whitelist, updated_by
)
SELECT org.id, TRUE::boolean, 8, TRUE::boolean, TRUE::boolean, TRUE::boolean, 90, 30, 5, ARRAY['192.168.1.0/24','10.0.0.0/8']::text[], usr.id
FROM org, usr
ON CONFLICT DO NOTHING;

-- User 2FA status
INSERT INTO user_2fa (user_id, is_enabled, secret, backup_codes, enabled_at, last_used_at)
SELECT usr.id, TRUE::boolean, 'SECRET-DEMO', ARRAY['code1','code2']::text[], CURRENT_TIMESTAMP - INTERVAL '10 days', CURRENT_TIMESTAMP - INTERVAL '1 day'
FROM usr
ON CONFLICT DO NOTHING;

-- Sessions
INSERT INTO user_sessions (id, user_id, token_jti, device_info, ip_address, user_agent, location, created_at, last_active_at, expires_at, is_current)
SELECT 'sess-mock-1'::uuid, usr.id, 'jti-mock-1', 'MacOS Chrome', '192.168.1.10'::inet, 'Chrome/120', 'Warsaw, PL', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 hour', CURRENT_TIMESTAMP + INTERVAL '7 days', FALSE::boolean FROM usr
ON CONFLICT DO NOTHING;

INSERT INTO user_sessions (id, user_id, token_jti, device_info, ip_address, user_agent, location, created_at, last_active_at, expires_at, is_current)
SELECT 'sess-mock-2'::uuid, usr.id, 'jti-mock-2', 'iPhone Safari', '10.0.0.5'::inet, 'Mobile Safari', 'Krakow, PL', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '10 minutes', CURRENT_TIMESTAMP + INTERVAL '5 days', TRUE::boolean FROM usr
ON CONFLICT DO NOTHING;

-- Login history
INSERT INTO login_history (id, user_id, organization_id, ip_address, user_agent, location, status, failure_reason, created_at)
SELECT 'login-mock-1'::uuid, usr.id, org.id, '192.168.1.10'::inet, 'Chrome/120', 'Warsaw, PL', 'success', NULL, CURRENT_TIMESTAMP - INTERVAL '1 day' FROM org, usr
ON CONFLICT DO NOTHING;

INSERT INTO login_history (id, user_id, organization_id, ip_address, user_agent, location, status, failure_reason, created_at)
SELECT 'login-mock-2'::uuid, usr.id, org.id, '10.0.0.5'::inet, 'Mobile Safari', 'Krakow, PL', 'failed', 'invalid_password', CURRENT_TIMESTAMP - INTERVAL '3 hours' FROM org, usr
ON CONFLICT DO NOTHING;

-- API keys (hashed key placeholder)
INSERT INTO api_keys (
    id, organization_id, user_id, name, description, key_hash, key_prefix, key_type,
    scopes, rate_limit_per_minute, rate_limit_per_day, allowed_ips, usage_count, is_active, created_by
)
SELECT 'api-mock-1', org.id, usr.id, 'Demo Integration Key', 'Seeded demo key', 'sha256-demo-hash', 'demo1234', 'org',
       ARRAY['read:projects','ai:execute']::text[], 100, 10000, ARRAY['192.168.1.0/24']::text[], 25, TRUE::boolean, usr.id
FROM org, usr
ON CONFLICT DO NOTHING;

-- API key usage
INSERT INTO api_key_usage (id, api_key_id, endpoint, method, status_code, response_time_ms, ip_address, user_agent, created_at)
SELECT 'usage-mock-1', 'api-mock-1', '/api/projects', 'GET', 200, 120, '192.168.1.10'::inet, 'Chrome/120', CURRENT_TIMESTAMP - INTERVAL '2 hours'
UNION ALL
SELECT 'usage-mock-2', 'api-mock-1', '/api/ai/execute', 'POST', 200, 450, '10.0.0.5'::inet, 'Mobile Safari', CURRENT_TIMESTAMP - INTERVAL '1 hour'
ON CONFLICT DO NOTHING;

-- Activity logs / audit (if activity_logs exists)
INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
SELECT 'act-mock-1', usr.id, 'login_success', 'auth', usr.id, '192.168.1.10'::inet, 'Chrome/120', CURRENT_TIMESTAMP - INTERVAL '1 day'
FROM usr
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'activity_logs'
)
ON CONFLICT DO NOTHING;

INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, ip_address, user_agent, created_at)
SELECT 'act-mock-2', usr.id, 'api_key_created', 'api_key', 'api-mock-1', '10.0.0.5'::inet, 'Mobile Safari', CURRENT_TIMESTAMP - INTERVAL '3 hours'
FROM usr
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'activity_logs'
)
ON CONFLICT DO NOTHING;
