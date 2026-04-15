-- Ported from: 20260412_module_interest_waitlist.sql
-- Module interest / waitlist tracking
-- Captures user interest in upcoming modules (Meeting, MCP IRIS, MCP Marketplace)

CREATE TABLE IF NOT EXISTS module_interest (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  module_key TEXT NOT NULL,
  user_email TEXT,
  user_name TEXT,
  org_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_module_interest_module ON module_interest (module_key);
CREATE INDEX IF NOT EXISTS idx_module_interest_created ON module_interest (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_module_interest_org ON module_interest (org_id);
