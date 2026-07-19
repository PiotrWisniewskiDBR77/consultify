-- RED-SYNC (2026-07-19): schema-500 regression fix for the sync/integrations/
-- connectors/webhooks rewir (integrations/automation.routes.ts + integrations/
-- integrations.routes.ts).
--
-- Root cause #1 (real 5xx): `integration_api_keys` is defined in
-- server/migrations/256_integrations_system.sql, but that filename does NOT
-- match the live migration runner's pattern (/^(7\d{2}|\d{8})_.*\.sql$/ in
-- DatabaseInitializer.ts:3198 / migrationRunner.ts:26) — "256_" is neither a
-- 7xx nor an 8-digit prefix, so this legacy migration has NEVER auto-run on
-- demo/parity. Result: GET/POST /api/integrations/automation/keys
-- (integrations/automation.routes.ts) hard-503s for every org
-- ("Service temporarily unavailable due to missing configuration") because
-- its `tableExists('integration_api_keys')` guard is always false — the
-- integration API-key management feature is completely dead on demo.
-- Recreated here verbatim from 256_integrations_system.sql, PLUS the
-- `updated_at` column that the live POST /keys INSERT writes to but which
-- the legacy migration never defined (would have been a second 42703 the
-- moment the table existed).
--
-- Root cause #2 (masked 42703, swallowed by DbPromise.all() fallback=true):
-- integration_providers exists on parity but was created by a different path
-- than 256_integrations_system.sql and is missing `sort_order` (+ 3 other
-- columns from the canonical definition). GET /api/integrations/available
-- (legacy helper, integrations.routes.ts) hardcodes
-- `ORDER BY sort_order, display_name` with no column-existence guard (unlike
-- the sibling GET /providers, which correctly probes columns first) — the
-- query throws 42703 column "sort_order" does not exist, DbPromise.all()
-- swallows it (fallback=true is the default), and the endpoint silently
-- returns `[]` with a 200 instead of the real provider catalog. Table was
-- also completely empty (0 rows) — the canonical provider catalog seed from
-- 256_integrations_system.sql never ran either. Both are fixed additively
-- below (idempotent: ADD COLUMN IF NOT EXISTS + INSERT ... ON CONFLICT DO
-- NOTHING against the existing primary key).

-- ── integration_api_keys (missing table → 503 on /automation/keys) ─────────
CREATE TABLE IF NOT EXISTS integration_api_keys (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,

    name TEXT NOT NULL,
    api_key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,

    permissions TEXT DEFAULT '["read","write"]',
    allowed_events TEXT DEFAULT '[]',
    allowed_actions TEXT DEFAULT '[]',

    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 10000,

    last_used_at TIMESTAMP,
    request_count INTEGER DEFAULT 0,

    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,

    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Written by POST /keys (integrations/automation.routes.ts) but absent
    -- from the original 256_ definition.
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP,
    revoked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON integration_api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON integration_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON integration_api_keys(is_active);

-- ── integration_providers (masked 42703 on sort_order + empty catalog) ─────
ALTER TABLE integration_providers ADD COLUMN IF NOT EXISTS is_enterprise_only BOOLEAN DEFAULT FALSE;
ALTER TABLE integration_providers ADD COLUMN IF NOT EXISTS documentation_url TEXT;
ALTER TABLE integration_providers ADD COLUMN IF NOT EXISTS setup_guide_url TEXT;
ALTER TABLE integration_providers ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

INSERT INTO integration_providers (id, name, display_name, category, description, auth_type, is_active, sort_order) VALUES
    ('int-slack', 'slack', 'Slack', 'communication', 'Real-time notifications and decision requests in Slack', 'oauth2', TRUE, 1),
    ('int-teams', 'microsoft_teams', 'Microsoft Teams', 'communication', 'Notifications and collaboration in Teams', 'oauth2', TRUE, 2),
    ('int-jira', 'jira', 'Jira', 'project_management', 'Bi-directional sync with Jira issues', 'oauth2', TRUE, 10),
    ('int-asana', 'asana', 'Asana', 'project_management', 'Sync tasks with Asana', 'oauth2', TRUE, 11),
    ('int-monday', 'monday', 'Monday.com', 'project_management', 'Sync with Monday.com boards', 'oauth2', TRUE, 12),
    ('int-gdrive', 'google_drive', 'Google Drive', 'storage', 'Store files and reports in Google Drive', 'oauth2', TRUE, 20),
    ('int-gcalendar', 'google_calendar', 'Google Calendar', 'productivity', 'Sync deadlines and meetings', 'oauth2', TRUE, 21),
    ('int-onedrive', 'onedrive', 'OneDrive', 'storage', 'Store files in OneDrive/SharePoint', 'oauth2', TRUE, 30),
    ('int-outlook', 'outlook', 'Outlook Calendar', 'productivity', 'Sync with Outlook calendar', 'oauth2', TRUE, 31),
    ('int-s3', 'aws_s3', 'AWS S3', 'storage', 'Store files in Amazon S3', 'api_key', TRUE, 40),
    ('int-azure-blob', 'azure_blob', 'Azure Blob Storage', 'storage', 'Store files in Azure', 'api_key', TRUE, 41),
    ('int-zapier', 'zapier', 'Zapier', 'automation', 'Connect with 5000+ apps via Zapier', 'api_key', TRUE, 50),
    ('int-make', 'make', 'Make (Integromat)', 'automation', 'Advanced automation workflows', 'api_key', TRUE, 51),
    ('int-salesforce', 'salesforce', 'Salesforce', 'crm', 'Sync with Salesforce CRM', 'oauth2', FALSE, 60),
    ('int-hubspot', 'hubspot', 'HubSpot', 'crm', 'Connect with HubSpot CRM', 'oauth2', FALSE, 61),
    ('int-powerbi', 'power_bi', 'Power BI', 'bi', 'Export data to Power BI', 'oauth2', FALSE, 70),
    ('int-tableau', 'tableau', 'Tableau', 'bi', 'Connect to Tableau dashboards', 'api_key', FALSE, 71)
ON CONFLICT (id) DO NOTHING;

UPDATE integration_providers SET is_beta = TRUE WHERE name IN ('salesforce', 'hubspot', 'power_bi', 'tableau');
UPDATE integration_providers SET is_enterprise_only = TRUE WHERE name IN ('azure_blob', 'salesforce', 'power_bi', 'tableau');
