-- Migration 711: SSO (SAML 2.0 / OIDC) + SCIM 2.0 provisioning + Service Accounts
-- Enterprise auth for Table Platform

CREATE TABLE IF NOT EXISTS tp_sso_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'saml',
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  metadata_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tp_service_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['records:read', 'records:write', 'metadata:read'],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tp_service_accounts_org ON tp_service_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_tp_service_accounts_prefix ON tp_service_accounts(token_prefix);

CREATE TABLE IF NOT EXISTS tp_scim_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
