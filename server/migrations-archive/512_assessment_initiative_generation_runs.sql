-- Migration: 512_assessment_initiative_generation_runs
-- Purpose: Enterprise initiative generation runs (orchestration for 50+ items)
-- Date: 2026-02-04
--
-- Notes:
-- - SQLite doesn't support ADD COLUMN IF NOT EXISTS; migration runner should ignore duplicates.
-- - `assessment_initiative_links` remains the canonical linkage between assessment and initiatives.

-- ==========================================
-- GENERATION RUNS (orchestration)
-- ==========================================

CREATE TABLE IF NOT EXISTS assessment_initiative_generation_runs (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  report_id TEXT,
  mode TEXT NOT NULL, -- 'ASSESSMENT_REPORT' | 'REPORT_ONLY'
  methodology_id TEXT NOT NULL,
  requested_count INTEGER NOT NULL,
  batch_size INTEGER NOT NULL DEFAULT 7,
  status TEXT NOT NULL DEFAULT 'RUNNING', -- RUNNING | SUCCEEDED | PARTIAL | FAILED | CANCELLED
  created_by TEXT NOT NULL,
  inputs_json TEXT, -- wizard answers/constraints/brief
  stats_json TEXT,  -- progress + retries + dedupe signals
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (report_id) REFERENCES assessment_reports(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_assessment_init_runs_assessment
  ON assessment_initiative_generation_runs(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_init_runs_status
  ON assessment_initiative_generation_runs(status);
CREATE INDEX IF NOT EXISTS idx_assessment_init_runs_created_at
  ON assessment_initiative_generation_runs(created_at);

-- ==========================================
-- BATCHES: link batches to runs
-- ==========================================

ALTER TABLE assessment_initiative_batches ADD COLUMN run_id TEXT;
CREATE INDEX IF NOT EXISTS idx_assessment_batches_run ON assessment_initiative_batches(run_id);

