-- Odbiór 2026-07-16: kodyfikacja fixów schema-500 znalezionych przez automatyczny
-- odbiór E2E i zaaplikowanych bezpośrednio na demo (TROLLEY). Ta migracja czyni
-- repo zgodnym z rzeczywistością demo — na demo to no-op (kolumny/tabela istnieją),
-- na świeżych środowiskach zapobiega regresji 500. Prefiks daty → wpada w autorun
-- (DatabaseInitializer regex /^(7\d{2}|\d{8})_/). CZYSTY Postgres (bez SQLite-izmów —
-- migracje idą raw, bez shim-translacji: patrz bug initiatives.progress).
--
-- Źródłowe (nieuruchomione, .sql.sql/poza-regex) migracje:
--   003_add_initiative_progress.sql.sql       -> initiatives.progress
--   021_initiatives_created_from_plan_id.sql.sql -> initiatives.created_from_plan_id
--   010_assessment_workflow.sql.sql (SQLite-izmy) -> assessment_workflows

-- Execution Hub one-look (GET /api/execution/:projectId/summary|health) — 500 bez tej kolumny
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;

-- AI-onboarding tworzenie inicjatyw (created_from='AI_ONBOARDING') — 500 bez tej kolumny
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS created_from_plan_id TEXT;

-- Assessment root list (GET /api/assessments/) LEFT JOIN assessment_workflows — 500 bez tabeli.
-- Postgres-safe (DATETIME->TIMESTAMP, bez FK/CHECK by uniknąć type-mismatch org id).
CREATE TABLE IF NOT EXISTS assessment_workflows (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  project_id INTEGER,
  organization_id INTEGER NOT NULL,
  status TEXT DEFAULT 'DRAFT',
  current_version INTEGER DEFAULT 1,
  submitted_by TEXT,
  submitted_at TIMESTAMP,
  approved_by TEXT,
  approved_at TIMESTAMP,
  approval_notes TEXT,
  rejected_by TEXT,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  axis_issues TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sla_deadline TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_asmwf_assessment ON assessment_workflows(assessment_id);
CREATE INDEX IF NOT EXISTS idx_asmwf_org ON assessment_workflows(organization_id);
