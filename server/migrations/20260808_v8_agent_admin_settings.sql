CREATE TABLE IF NOT EXISTS v8_agent_tenant_settings (
  settings_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  calendar_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  cadence TEXT NOT NULL DEFAULT 'manual' CHECK (cadence IN ('manual','daily','weekly','monthly')),
  timezone TEXT NOT NULL DEFAULT 'Europe/Warsaw',
  auto_actions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  retention_detail_days INTEGER NOT NULL DEFAULT 30 CHECK (retention_detail_days = 30),
  retention_aggregate_months INTEGER NOT NULL DEFAULT 13 CHECK (retention_aggregate_months = 13),
  export_enabled BOOLEAN NOT NULL DEFAULT FALSE CHECK (export_enabled = FALSE),
  purge_enabled BOOLEAN NOT NULL DEFAULT FALSE CHECK (purge_enabled = FALSE),
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_agent_settings_scope
  ON v8_agent_tenant_settings (organization_id, COALESCE(project_id, ''));

CREATE TABLE IF NOT EXISTS v8_agent_tenant_activation_receipts (
  receipt_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  idempotency_key TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  seed_version TEXT NOT NULL,
  policy_count INTEGER NOT NULL CHECK (policy_count = 17),
  activated_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS v8_agent_admin_audit_events (
  event_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,
  actor_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('settings_updated','a06_activated')),
  before_json JSONB,
  after_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_v8_agent_admin_audit_scope
  ON v8_agent_admin_audit_events (organization_id, project_id, created_at DESC);
