-- V4-DECK-02..07: Presentations Enterprise module
-- Refresh engine, layout rules, template governance, PPTX import, realtime, media governance.

-- ============================================================
-- 1) V4-DECK-02: Deck refresh engine
-- ============================================================

CREATE TABLE IF NOT EXISTS deck_data_bindings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  slide_index INTEGER NOT NULL DEFAULT 0,
  block_id TEXT,
  binding_type TEXT NOT NULL DEFAULT 'artifact',
  artifact_type TEXT,
  artifact_id TEXT,
  dataset_ref TEXT,
  last_refresh_at TIMESTAMP,
  last_value_hash TEXT,
  diff_preview TEXT DEFAULT '{}',
  approval_status TEXT NOT NULL DEFAULT 'auto',
  approved_by TEXT,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ddb_deck ON deck_data_bindings(organization_id, deck_id);

-- ============================================================
-- 2) V4-DECK-03: Layout rules
-- ============================================================

CREATE TABLE IF NOT EXISTS deck_layout_rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'spacing',
  config TEXT NOT NULL DEFAULT '{}',
  is_global INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dlr_org ON deck_layout_rules(organization_id);

CREATE TABLE IF NOT EXISTS deck_export_qa_results (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  export_format TEXT NOT NULL DEFAULT 'pptx',
  fidelity_score REAL,
  issues TEXT DEFAULT '[]',
  regression_baseline_id TEXT,
  passed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deqa_deck ON deck_export_qa_results(organization_id, deck_id);

-- ============================================================
-- 3) V4-DECK-04: Template governance
-- ============================================================

CREATE TABLE IF NOT EXISTS deck_template_governance (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  template_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  variables TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  governance_level TEXT NOT NULL DEFAULT 'org',
  consulting_pack_type TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dtg_org ON deck_template_governance(organization_id, status);

CREATE TABLE IF NOT EXISTS deck_template_versions (
  id TEXT PRIMARY KEY,
  governance_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  template_snapshot TEXT NOT NULL DEFAULT '{}',
  variables TEXT NOT NULL DEFAULT '[]',
  changelog TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dtv_gov ON deck_template_versions(governance_id);

-- ============================================================
-- 4) V4-DECK-05: PPTX import
-- ============================================================

CREATE TABLE IF NOT EXISTS deck_pptx_imports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  deck_id TEXT,
  original_filename TEXT NOT NULL,
  file_size_bytes INTEGER,
  slide_count INTEGER DEFAULT 0,
  mapping_data TEXT DEFAULT '[]',
  import_status TEXT NOT NULL DEFAULT 'pending',
  import_warnings TEXT DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dpi_org ON deck_pptx_imports(organization_id);

-- ============================================================
-- 5) V4-DECK-06: Realtime collaboration
-- ============================================================

CREATE TABLE IF NOT EXISTS deck_collab_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  cursor_position TEXT DEFAULT '{}',
  active_slide_index INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_heartbeat_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dcs_deck ON deck_collab_sessions(organization_id, deck_id, is_active);

-- ============================================================
-- 6) V4-DECK-07: Media library governance
-- ============================================================

CREATE TABLE IF NOT EXISTS deck_media_library (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER,
  storage_url TEXT,
  rights_status TEXT NOT NULL DEFAULT 'unknown',
  license_type TEXT,
  license_expiry TIMESTAMP,
  entitlement_scope TEXT DEFAULT 'org',
  watermark_applied INTEGER DEFAULT 0,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dml_org ON deck_media_library(organization_id, rights_status);

CREATE TABLE IF NOT EXISTS deck_media_usage_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  slide_index INTEGER,
  action TEXT NOT NULL DEFAULT 'inserted',
  actor_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dmul_media ON deck_media_usage_log(organization_id, media_id);
