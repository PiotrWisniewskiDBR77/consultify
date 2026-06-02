-- Persist Interview Insight Report Packs and their worksheet states.
-- Purpose:
--  - Turn generated report pack drafts into refresh-resistant artifacts
--  - Preserve per-worksheet status, completeness, warnings, rows, and markdown
--  - Keep the schema additive and organization-scoped

CREATE TABLE IF NOT EXISTS interview_report_packs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  insight_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  completeness_score INTEGER NOT NULL DEFAULT 0,
  degraded INTEGER NOT NULL DEFAULT 0,
  degraded_reasons_json TEXT DEFAULT '[]',
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_report_packs_insight
  ON interview_report_packs(organization_id, insight_id);

CREATE INDEX IF NOT EXISTS idx_interview_report_packs_org
  ON interview_report_packs(organization_id);

CREATE TABLE IF NOT EXISTS interview_report_pack_worksheets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  report_pack_id TEXT NOT NULL,
  insight_id TEXT NOT NULL,
  worksheet_key TEXT NOT NULL,
  title TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'empty',
  completeness_score INTEGER NOT NULL DEFAULT 0,
  warnings_json TEXT DEFAULT '[]',
  rows_json TEXT DEFAULT '[]',
  markdown TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_report_pack_worksheets_key
  ON interview_report_pack_worksheets(report_pack_id, worksheet_key);

CREATE INDEX IF NOT EXISTS idx_interview_report_pack_worksheets_org
  ON interview_report_pack_worksheets(organization_id);

CREATE TABLE IF NOT EXISTS interview_report_pack_revisions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  report_pack_id TEXT NOT NULL,
  insight_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  manifest_hash TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_report_pack_revisions_version
  ON interview_report_pack_revisions(report_pack_id, version);

CREATE INDEX IF NOT EXISTS idx_interview_report_pack_revisions_insight
  ON interview_report_pack_revisions(organization_id, insight_id);
