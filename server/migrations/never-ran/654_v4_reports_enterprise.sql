-- V4-RPT-01..06: Reports Enterprise module
-- Source packs, data bindings, templates, brand voice, AI blocks, distribution.

-- ============================================================
-- 1) V4-RPT-01: Source Pack Builder
-- ============================================================

CREATE TABLE IF NOT EXISTS report_source_packs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  artifacts TEXT NOT NULL DEFAULT '[]',
  upload_bundle_url TEXT,
  citation_policy TEXT NOT NULL DEFAULT 'recommended',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rsp_report ON report_source_packs(organization_id, report_id);

CREATE TABLE IF NOT EXISTS report_source_pack_items (
  id TEXT PRIMARY KEY,
  source_pack_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  artifact_title TEXT,
  citation_label TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rspi_pack ON report_source_pack_items(source_pack_id);

-- ============================================================
-- 2) V4-RPT-02: Data bindings
-- ============================================================

CREATE TABLE IF NOT EXISTS report_data_bindings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  binding_type TEXT NOT NULL DEFAULT 'kpi',
  dataset_ref TEXT NOT NULL,
  last_refresh_at TIMESTAMP,
  last_value TEXT,
  previous_value TEXT,
  diff_data TEXT DEFAULT '{}',
  approval_status TEXT NOT NULL DEFAULT 'auto',
  approved_by TEXT,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rdb_report ON report_data_bindings(organization_id, report_id);

-- ============================================================
-- 3) V4-RPT-03: Template system
-- ============================================================

CREATE TABLE IF NOT EXISTS report_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  template_data TEXT NOT NULL DEFAULT '{}',
  variables TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  governance_level TEXT NOT NULL DEFAULT 'org',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS variables TEXT DEFAULT '[]';
ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE report_templates ADD COLUMN IF NOT EXISTS governance_level TEXT DEFAULT 'org';

CREATE INDEX IF NOT EXISTS idx_rtpl_org ON report_templates(organization_id, status);

CREATE TABLE IF NOT EXISTS report_template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  template_data TEXT NOT NULL DEFAULT '{}',
  variables TEXT NOT NULL DEFAULT '[]',
  changelog TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rtplv_template ON report_template_versions(template_id);

-- ============================================================
-- 4) V4-RPT-04: Brand voice
-- ============================================================

CREATE TABLE IF NOT EXISTS report_brand_voice_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  policy_name TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'professional',
  forbidden_phrases TEXT DEFAULT '[]',
  required_source_citation INTEGER DEFAULT 0,
  no_marketing_language INTEGER DEFAULT 0,
  custom_rules TEXT DEFAULT '[]',
  is_active INTEGER DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rbvp_org ON report_brand_voice_policies(organization_id, is_active);

-- ============================================================
-- 5) V4-RPT-05: Per-block AI propose → accept
-- ============================================================

CREATE TABLE IF NOT EXISTS report_ai_proposals (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  section_id TEXT,
  block_id TEXT,
  proposed_content TEXT NOT NULL,
  original_content TEXT,
  diff_preview TEXT DEFAULT '{}',
  citations TEXT DEFAULT '[]',
  ai_model_used TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',
  resolved_by TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_raip_report ON report_ai_proposals(organization_id, report_id, status);

-- ============================================================
-- 6) V4-RPT-06: Scheduled distribution
-- ============================================================

CREATE TABLE IF NOT EXISTS report_distribution_schedules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  schedule_cron TEXT,
  send_at TIMESTAMP,
  recipient_policy TEXT NOT NULL DEFAULT '{}',
  approval_required INTEGER DEFAULT 0,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMP,
  last_sent_at TIMESTAMP,
  delivery_proof TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rds_report ON report_distribution_schedules(organization_id, report_id);

CREATE TABLE IF NOT EXISTS report_distribution_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  schedule_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  recipient_email TEXT,
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'sent',
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rdl_schedule ON report_distribution_log(organization_id, schedule_id);
