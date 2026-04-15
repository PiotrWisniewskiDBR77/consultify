-- Migration: 226_compliance_mock_seed.sql
-- Purpose: Seed demo compliance data (GDPR, cookie settings, retention) for the first organization.

WITH org AS (
    SELECT id FROM organizations ORDER BY created_at LIMIT 1
),
usr AS (
    SELECT id FROM users ORDER BY created_at LIMIT 1
)

-- Compliance settings: GDPR
INSERT OR IGNORE INTO compliance_settings (
    id, organization_id, setting_type, settings_data, enabled, updated_by
) SELECT
    'comp-gdpr-mock', org.id, 'gdpr',
    '{"features":["right_to_access","right_to_erasure","data_portability","consent_logging"]}',
    1,
    usr.id
FROM org, usr;
WHERE EXISTS (
    SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'compliance_settings'
);

-- Compliance settings: Cookies
INSERT OR IGNORE INTO compliance_settings (
    id, organization_id, setting_type, settings_data, enabled, updated_by
) SELECT
    'comp-cookies-mock', org.id, 'cookies',
    '{"bannerTitle":"We use cookies","bannerDescription":"We use cookies to improve your experience on our site.","acceptButtonText":"Accept All","rejectButtonText":"Reject All","customizeButtonText":"Manage Preferences","categories":{"essential":true,"analytics":true,"marketing":false,"functional":true},"version":"1.0.0"}',
    1,
    usr.id
FROM org, usr;
WHERE EXISTS (
    SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'compliance_settings'
);

-- Compliance settings: Data Requests (dummy feature flags)
INSERT OR IGNORE INTO compliance_settings (
    id, organization_id, setting_type, settings_data, enabled, updated_by
) SELECT
    'comp-data-requests-mock', org.id, 'data_requests',
    '{"export_enabled":true,"delete_enabled":true,"contact":"privacy@demo.com"}',
    1,
    usr.id
FROM org, usr;
WHERE EXISTS (
    SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'compliance_settings'
);

-- Organization data retention defaults
INSERT OR IGNORE INTO organization_data_retention (
    organization_id, audit_log_retention, auto_delete_inactive, inactive_days, updated_by
) SELECT org.id, 'forever', 0, 365, usr.id FROM org, usr
WHERE EXISTS (
    SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'organization_data_retention'
);

