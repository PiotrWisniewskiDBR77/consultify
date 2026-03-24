-- V8 Landing / Onboarding / Superadmin Package — core tables
-- WP-W7-ROOF-03: Landing, Onboarding and Broader Superadmin
--
-- Decisions implemented:
--   W7-9  — ANNA LP assistant contract (identity roles, degraded state)
--   W7-10 — Superadmin V8 SSOT (horizontal IA, domain/surface registry)
--   W7-11 — Demo/trial V8 refresh (narrative version, refresh flag)

-- ==========================================
-- 1. Landing Page Sections (content model)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_landing_page_sections (
  section_id             TEXT PRIMARY KEY,
  organization_id        TEXT NOT NULL,
  section_type           TEXT NOT NULL
                         CHECK (section_type IN (
                           'hero', 'value_proposition', 'expert_showcase',
                           'use_case_mapping', 'cta', 'social_proof'
                         )),
  content                TEXT NOT NULL DEFAULT '{}',
  display_order          INTEGER NOT NULL DEFAULT 0,
  is_active              INTEGER NOT NULL DEFAULT 1,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_landing_sections_org
  ON v8_landing_page_sections(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_landing_sections_order
  ON v8_landing_page_sections(organization_id, display_order);
CREATE INDEX IF NOT EXISTS idx_v8_landing_sections_type
  ON v8_landing_page_sections(organization_id, section_type);

-- ==========================================
-- 2. ANNA LP Assistant Configs (W7-9)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_anna_lp_configs (
  config_id              TEXT PRIMARY KEY,
  organization_id        TEXT NOT NULL,
  identity_role          TEXT NOT NULL
                         CHECK (identity_role IN (
                           'landing_guide', 'onboarding_assistant'
                         )),
  conversation_contract  TEXT NOT NULL DEFAULT '{}',
  platform_integration_ref TEXT,
  ai_governance_ref      TEXT,
  degraded_state_behavior TEXT NOT NULL DEFAULT 'static_fallback',
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_anna_lp_org
  ON v8_anna_lp_configs(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_anna_lp_org_role
  ON v8_anna_lp_configs(organization_id, identity_role);

-- ==========================================
-- 3. Demo/Trial Configs (W7-11)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_demo_trial_configs (
  config_id              TEXT PRIMARY KEY,
  organization_id        TEXT NOT NULL,
  narrative_version      TEXT NOT NULL DEFAULT 'v3'
                         CHECK (narrative_version IN ('v3', 'v8')),
  trial_duration         INTEGER NOT NULL DEFAULT 7,
  demo_scenarios         TEXT NOT NULL DEFAULT '[]',
  onboarding_flow_ref    TEXT,
  is_refreshed           INTEGER NOT NULL DEFAULT 0,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_demo_trial_org
  ON v8_demo_trial_configs(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_demo_trial_org_unique
  ON v8_demo_trial_configs(organization_id);

-- ==========================================
-- 4. Superadmin Domains (W7-10 horizontal IA)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_superadmin_domains (
  domain_id              TEXT PRIMARY KEY,
  organization_id        TEXT NOT NULL,
  domain_name            TEXT NOT NULL,
  ownership_type         TEXT NOT NULL
                         CHECK (ownership_type IN (
                           'platform_operator', 'tenant_admin'
                         )),
  vertical_packages      TEXT NOT NULL DEFAULT '[]',
  cross_domain_capabilities TEXT NOT NULL DEFAULT '[]',
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_superadmin_domains_org
  ON v8_superadmin_domains(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_superadmin_domains_name
  ON v8_superadmin_domains(organization_id, domain_name);

-- ==========================================
-- 5. Superadmin Surfaces (surface registry)
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_superadmin_surfaces (
  surface_id             TEXT PRIMARY KEY,
  domain_id              TEXT NOT NULL,
  organization_id        TEXT NOT NULL,
  surface_name           TEXT NOT NULL,
  access_level           TEXT NOT NULL
                         CHECK (access_level IN (
                           'platform', 'tenant', 'module'
                         )),
  module_ref             TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (domain_id) REFERENCES v8_superadmin_domains(domain_id)
);

CREATE INDEX IF NOT EXISTS idx_v8_superadmin_surfaces_domain
  ON v8_superadmin_surfaces(domain_id);
CREATE INDEX IF NOT EXISTS idx_v8_superadmin_surfaces_org
  ON v8_superadmin_surfaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_superadmin_surfaces_access
  ON v8_superadmin_surfaces(organization_id, access_level);
