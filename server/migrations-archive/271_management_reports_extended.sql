-- Migration: Extend Management Reports for new report types + templates
-- Purpose: Add new report types and templates for reporting module
-- Date: 2026-01-20

PRAGMA foreign_keys=off;

DROP VIEW IF EXISTS v_multi_framework_assessment_summary;

-- =====================================================
-- Update management_reports for new report types
-- =====================================================
ALTER TABLE management_reports RENAME TO management_reports_old;

CREATE TABLE IF NOT EXISTS management_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    report_type TEXT NOT NULL CHECK (report_type IN ('TEAM_MEETING', 'TEAM_WEEKLY', 'STEERING_COMMITTEE', 'PORTFOLIO_HEALTH', 'RAID')),
    scope TEXT NOT NULL DEFAULT 'PROJECT' CHECK (scope IN ('PROJECT', 'PORTFOLIO')),
    title TEXT NOT NULL,
    period_start DATE,
    period_end DATE,
    status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL', 'ARCHIVED')),
    generated_by TEXT NOT NULL,
    content JSON,
    ai_narrative TEXT,
    ai_warnings JSON,
    pdf_path TEXT,
    pptx_path TEXT,
    share_token TEXT UNIQUE,
    share_expires_at DATETIME,
    pmo_domain TEXT DEFAULT 'PERFORMANCE_MONITORING',
    iso21500_mapping TEXT DEFAULT 'Project Performance Measurement (Clause 4.4.22)',
    pmbok_mapping TEXT DEFAULT 'Measurement Performance Domain',
    prince2_mapping TEXT DEFAULT 'Highlight Report / Progress Theme',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    current_version INTEGER DEFAULT 1,
    approval_status TEXT DEFAULT 'NONE',
    requires_approval BOOLEAN DEFAULT 0,
    approval_config JSON,
    locked_at DATETIME,
    locked_by TEXT,
    finalized_at DATETIME,
    finalized_by TEXT,
    integrity_hash TEXT,
    previous_report_id TEXT,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO management_reports (
  id,
  organization_id,
  project_id,
  report_type,
  scope,
  title,
  period_start,
  period_end,
  status,
  generated_by,
  content,
  ai_narrative,
  ai_warnings,
  pdf_path,
  pptx_path,
  share_token,
  share_expires_at,
  pmo_domain,
  iso21500_mapping,
  pmbok_mapping,
  prince2_mapping,
  created_at,
  updated_at,
  current_version,
  approval_status,
  requires_approval,
  approval_config,
  locked_at,
  locked_by,
  finalized_at,
  finalized_by,
  integrity_hash,
  previous_report_id
)
SELECT
  id,
  organization_id,
  project_id,
  report_type,
  scope,
  title,
  period_start,
  period_end,
  status,
  generated_by,
  content,
  ai_narrative,
  ai_warnings,
  pdf_path,
  pptx_path,
  share_token,
  share_expires_at,
  pmo_domain,
  iso21500_mapping,
  pmbok_mapping,
  prince2_mapping,
  created_at,
  updated_at,
  current_version,
  approval_status,
  requires_approval,
  approval_config,
  locked_at,
  locked_by,
  finalized_at,
  finalized_by,
  integrity_hash,
  previous_report_id
FROM management_reports_old;

DROP TABLE management_reports_old;

CREATE INDEX IF NOT EXISTS idx_mr_organization ON management_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_mr_project ON management_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_mr_type ON management_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_mr_scope ON management_reports(scope);
CREATE INDEX IF NOT EXISTS idx_mr_status ON management_reports(status);
CREATE INDEX IF NOT EXISTS idx_mr_created ON management_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mr_share_token ON management_reports(share_token);
CREATE INDEX IF NOT EXISTS idx_mr_org_type_date ON management_reports(organization_id, report_type, created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_management_reports_updated
    AFTER UPDATE ON management_reports
    FOR EACH ROW
    BEGIN
        UPDATE management_reports SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- =====================================================
-- Update management_report_schedules for new types
-- =====================================================
ALTER TABLE management_report_schedules RENAME TO management_report_schedules_old;

CREATE TABLE IF NOT EXISTS management_report_schedules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    project_id TEXT,
    report_type TEXT NOT NULL CHECK (report_type IN ('TEAM_MEETING', 'TEAM_WEEKLY', 'STEERING_COMMITTEE', 'PORTFOLIO_HEALTH', 'RAID')),
    scope TEXT NOT NULL DEFAULT 'PROJECT' CHECK (scope IN ('PROJECT', 'PORTFOLIO')),
    frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY')),
    day_of_week INTEGER,
    day_of_month INTEGER,
    time_of_day TEXT DEFAULT '09:00',
    timezone TEXT DEFAULT 'Europe/Warsaw',
    is_active BOOLEAN DEFAULT 1,
    last_generated_at DATETIME,
    next_scheduled_at DATETIME,
    recipients JSON,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO management_report_schedules (
  id,
  organization_id,
  project_id,
  report_type,
  scope,
  frequency,
  day_of_week,
  day_of_month,
  time_of_day,
  timezone,
  is_active,
  last_generated_at,
  next_scheduled_at,
  recipients,
  created_by,
  created_at,
  updated_at
)
SELECT
  id,
  organization_id,
  project_id,
  report_type,
  scope,
  frequency,
  day_of_week,
  day_of_month,
  time_of_day,
  timezone,
  is_active,
  last_generated_at,
  next_scheduled_at,
  recipients,
  created_by,
  created_at,
  updated_at
FROM management_report_schedules_old;

DROP TABLE management_report_schedules_old;

CREATE INDEX IF NOT EXISTS idx_mrs_org ON management_report_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_mrs_next ON management_report_schedules(next_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_mrs_active ON management_report_schedules(is_active);

CREATE TRIGGER IF NOT EXISTS trg_management_report_schedules_updated
    AFTER UPDATE ON management_report_schedules
    FOR EACH ROW
    BEGIN
        UPDATE management_report_schedules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- =====================================================
-- Table: management_report_templates
-- =====================================================
CREATE TABLE IF NOT EXISTS management_report_templates (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    report_type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sections JSON,
    is_default BOOLEAN DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mrt_org ON management_report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_mrt_type ON management_report_templates(organization_id, report_type);

PRAGMA foreign_keys=on;
