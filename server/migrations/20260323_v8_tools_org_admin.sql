-- V8 Tools / Org / Admin Hardening — core tables
-- WP-W7-ROOF-02: Shared tools registry, session+action governance,
-- admin surface ownership, V3→V8 bridging contracts.
--
-- Decisions implemented:
--   W7-5 — one shared registry, typed families
--   W7-6 — session sets the sandbox, action decides the gate
--   W7-7 — shared IA at top, module settings underneath
--   W7-8 — bridging Tools V8 SSOT

-- ==========================================
-- 1. Shared Tools Registry (W7-5)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_shared_tools_registry (
  tool_id                    TEXT PRIMARY KEY,
  organization_id            TEXT NOT NULL,
  tool_name                  TEXT NOT NULL,
  tool_family                TEXT NOT NULL
                             CHECK (tool_family IN (
                               'consulting_framework', 'assessment',
                               'diagnostic', 'workshop', 'custom'
                             )),
  tool_subtype               TEXT,
  is_classic_framework_template INTEGER NOT NULL DEFAULT 0,
  knowledge_bank_ref         TEXT,
  catalog_visibility         TEXT NOT NULL DEFAULT 'draft'
                             CHECK (catalog_visibility IN (
                               'published', 'draft', 'internal_only'
                             )),
  created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                 TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_shared_tools_org
  ON v8_shared_tools_registry(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_shared_tools_family
  ON v8_shared_tools_registry(organization_id, tool_family);
CREATE INDEX IF NOT EXISTS idx_v8_shared_tools_visibility
  ON v8_shared_tools_registry(organization_id, catalog_visibility);
CREATE INDEX IF NOT EXISTS idx_v8_shared_tools_classic
  ON v8_shared_tools_registry(organization_id, is_classic_framework_template)
  WHERE is_classic_framework_template = 1;

-- ==========================================
-- 2. Tool Session Governance (W7-6 session level)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_tool_session_governance (
  session_id                 TEXT PRIMARY KEY,
  tool_id                    TEXT NOT NULL,
  user_id                    TEXT NOT NULL,
  organization_id            TEXT NOT NULL,
  session_mode               TEXT NOT NULL
                             CHECK (session_mode IN (
                               'guided', 'expert', 'ai_assisted'
                             )),
  permission_scope           TEXT NOT NULL,
  context_boundary           TEXT NOT NULL,
  ai_enabled                 INTEGER NOT NULL DEFAULT 1,
  created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tool_id) REFERENCES v8_shared_tools_registry(tool_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_session_gov_org
  ON v8_tool_session_governance(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_session_gov_tool
  ON v8_tool_session_governance(organization_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_v8_session_gov_user
  ON v8_tool_session_governance(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_v8_session_gov_mode
  ON v8_tool_session_governance(organization_id, session_mode);

-- ==========================================
-- 3. Tool Action Governance (W7-6 action level)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_tool_action_governance (
  action_id                  TEXT PRIMARY KEY,
  session_id                 TEXT NOT NULL,
  organization_id            TEXT NOT NULL,
  action_type                TEXT NOT NULL,
  gate_decision              TEXT NOT NULL
                             CHECK (gate_decision IN (
                               'execute', 'propose', 'requires_approval', 'blocked'
                             )),
  gate_reason                TEXT,
  created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES v8_tool_session_governance(session_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_action_gov_session
  ON v8_tool_action_governance(session_id);
CREATE INDEX IF NOT EXISTS idx_v8_action_gov_org
  ON v8_tool_action_governance(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_action_gov_decision
  ON v8_tool_action_governance(organization_id, gate_decision);

-- ==========================================
-- 4. Admin Surface Ownership (W7-7)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_admin_surface_ownership (
  surface_id                 TEXT PRIMARY KEY,
  surface_name               TEXT NOT NULL,
  organization_id            TEXT NOT NULL,
  owner_layer                TEXT NOT NULL
                             CHECK (owner_layer IN (
                               'organization_settings', 'superadmin', 'module_embedded'
                             )),
  module_name                TEXT,
  horizontal_layer_ref       TEXT,
  created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                 TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_admin_surface_org
  ON v8_admin_surface_ownership(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_admin_surface_layer
  ON v8_admin_surface_ownership(organization_id, owner_layer);
CREATE INDEX IF NOT EXISTS idx_v8_admin_surface_module
  ON v8_admin_surface_ownership(organization_id, module_name)
  WHERE module_name IS NOT NULL;

-- ==========================================
-- 5. V3→V8 Bridging Contracts (W7-8)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_tools_v8_bridging_contracts (
  contract_id                TEXT PRIMARY KEY,
  tool_id                    TEXT NOT NULL,
  organization_id            TEXT NOT NULL,
  v3_tool_contract_ref       TEXT NOT NULL,
  v8_platform_requirements   TEXT NOT NULL DEFAULT '[]',
  v8_ai_governance_ref       TEXT,
  v8_session_knowledge_rules TEXT,
  bridging_status            TEXT NOT NULL DEFAULT 'draft'
                             CHECK (bridging_status IN (
                               'draft', 'active', 'superseded'
                             )),
  created_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                 TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tool_id) REFERENCES v8_shared_tools_registry(tool_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_bridging_org
  ON v8_tools_v8_bridging_contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_bridging_tool
  ON v8_tools_v8_bridging_contracts(organization_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_v8_bridging_status
  ON v8_tools_v8_bridging_contracts(organization_id, bridging_status);
