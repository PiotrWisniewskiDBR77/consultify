-- V8 Reports & Presentations Operating Model — core tables
-- WP-W6-OUT-01: Delivery lifecycle, template families, recurring automation, AI governance
-- Decisions: W6-1 (shared AI governance), W6-2 (separate presets), W6-3 (3 template families), W6-4 (recurring scope)
--
-- Note: v8_output_artifacts is defined in 20260323_v8_reports_output_runtime.sql

-- ==========================================
-- 1. Template Families — Decision W6-3
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_template_families (
  family_id                TEXT PRIMARY KEY,
  organization_id          TEXT NOT NULL,
  family_name              TEXT NOT NULL
                           CHECK (family_name IN (
                             'executive_steering_pack',
                             'transformation_status_pack',
                             'diagnostic_assessment_pack'
                           )),
  report_form_ref          TEXT,
  presentation_form_ref    TEXT,
  governed_mapping_enabled INTEGER NOT NULL DEFAULT 0,
  created_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_template_families_org
  ON v8_template_families(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_template_families_org_name
  ON v8_template_families(organization_id, family_name);

-- ==========================================
-- 2. Recurring Output Programs — Decision W6-4
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_recurring_output_programs (
  program_id               TEXT PRIMARY KEY,
  organization_id          TEXT NOT NULL,
  output_type              TEXT NOT NULL
                           CHECK (output_type IN ('report', 'presentation')),
  template_family_ref      TEXT,
  cadence                  TEXT NOT NULL
                           CHECK (cadence IN (
                             'daily', 'weekly', 'biweekly', 'monthly', 'quarterly'
                           )),
  source_data_binding      TEXT NOT NULL DEFAULT '{}',
  is_active                INTEGER NOT NULL DEFAULT 1,
  last_run_at              TEXT,
  next_run_at              TEXT,
  governance_level         TEXT NOT NULL DEFAULT 'standard'
                           CHECK (governance_level IN ('standard', 'strict')),
  created_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_recurring_programs_org
  ON v8_recurring_output_programs(organization_id);
CREATE INDEX IF NOT EXISTS idx_v8_recurring_programs_active
  ON v8_recurring_output_programs(organization_id, is_active)
  WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_v8_recurring_programs_next
  ON v8_recurring_output_programs(next_run_at)
  WHERE is_active = 1 AND next_run_at IS NOT NULL;

-- ==========================================
-- 3. Output AI Governance — Decisions W6-1, W6-2
-- ==========================================

CREATE TABLE IF NOT EXISTS v8_output_ai_governance (
  config_id                TEXT PRIMARY KEY,
  organization_id          TEXT NOT NULL,
  output_type              TEXT NOT NULL
                           CHECK (output_type IN ('report', 'presentation')),
  preset_ref               TEXT NOT NULL,
  eval_gate_ref            TEXT,
  quality_thresholds       TEXT NOT NULL DEFAULT '{}',
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_v8_ai_governance_org
  ON v8_output_ai_governance(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v8_ai_governance_org_type
  ON v8_output_ai_governance(organization_id, output_type);
