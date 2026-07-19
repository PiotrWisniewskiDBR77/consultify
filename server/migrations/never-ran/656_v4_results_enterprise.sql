-- V4-RSLT-02, 04, 05, 06: Results Enterprise module
-- KPI connectors, ROI evidence, scheduled reporting, wallboard mode.

-- ============================================================
-- 1) V4-RSLT-02: KPI connectors + ingestion
-- ============================================================

CREATE TABLE IF NOT EXISTS kpi_connectors (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  connector_name TEXT NOT NULL,
  connector_type TEXT NOT NULL DEFAULT 'api',
  config TEXT NOT NULL DEFAULT '{}',
  target_kpi_ids TEXT DEFAULT '[]',
  schedule_cron TEXT,
  last_run_at TIMESTAMP,
  last_run_status TEXT DEFAULT 'never',
  next_run_at TIMESTAMP,
  is_active INTEGER DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpic_org ON kpi_connectors(organization_id, is_active);

CREATE TABLE IF NOT EXISTS kpi_ingestion_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  connector_id TEXT NOT NULL,
  kpi_id TEXT NOT NULL,
  ingested_value REAL,
  period TEXT NOT NULL,
  provenance TEXT NOT NULL DEFAULT '{}',
  quality_score REAL DEFAULT 1.0,
  status TEXT NOT NULL DEFAULT 'accepted',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpiil_connector ON kpi_ingestion_log(organization_id, connector_id);
CREATE INDEX IF NOT EXISTS idx_kpiil_kpi ON kpi_ingestion_log(kpi_id, period);

-- ============================================================
-- 2) V4-RSLT-04: ROI evidence + provenance
-- ============================================================

CREATE TABLE IF NOT EXISTS roi_evidence (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  initiative_id TEXT,
  benefit_id TEXT,
  evidence_type TEXT NOT NULL DEFAULT 'measurement',
  value REAL NOT NULL,
  currency TEXT DEFAULT 'PLN',
  period TEXT NOT NULL,
  source_description TEXT,
  provenance_assumptions TEXT DEFAULT '[]',
  finance_model_id TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  verified_by TEXT,
  verified_at TIMESTAMP,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roie_org ON roi_evidence(organization_id);
CREATE INDEX IF NOT EXISTS idx_roie_initiative ON roi_evidence(initiative_id);
CREATE INDEX IF NOT EXISTS idx_roie_benefit ON roi_evidence(benefit_id);

-- ============================================================
-- 3) V4-RSLT-05: Scheduled KPI reporting
-- ============================================================

CREATE TABLE IF NOT EXISTS kpi_report_schedules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  report_name TEXT NOT NULL,
  template_config TEXT NOT NULL DEFAULT '{}',
  kpi_ids TEXT NOT NULL DEFAULT '[]',
  schedule_cron TEXT,
  send_at TIMESTAMP,
  recipient_policy TEXT NOT NULL DEFAULT '{}',
  approval_required INTEGER DEFAULT 0,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMP,
  last_sent_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpirs_org ON kpi_report_schedules(organization_id, status);

CREATE TABLE IF NOT EXISTS kpi_report_delivery_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  schedule_id TEXT NOT NULL,
  recipient_email TEXT,
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'sent',
  delivered_at TIMESTAMP,
  opened_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpirdl_schedule ON kpi_report_delivery_log(organization_id, schedule_id);

-- ============================================================
-- 4) V4-RSLT-06: Wallboard mode
-- ============================================================

CREATE TABLE IF NOT EXISTS kpi_wallboards (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  layout_config TEXT NOT NULL DEFAULT '{}',
  kpi_ids TEXT NOT NULL DEFAULT '[]',
  refresh_interval_seconds INTEGER DEFAULT 60,
  auto_rotation_seconds INTEGER DEFAULT 30,
  alert_thresholds TEXT DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpiw_org ON kpi_wallboards(organization_id, is_active);

CREATE TABLE IF NOT EXISTS kpi_wallboard_alerts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  wallboard_id TEXT NOT NULL,
  kpi_id TEXT NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'threshold',
  threshold_value REAL,
  current_value REAL,
  severity TEXT NOT NULL DEFAULT 'warning',
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kpiwa_wallboard ON kpi_wallboard_alerts(organization_id, wallboard_id);
