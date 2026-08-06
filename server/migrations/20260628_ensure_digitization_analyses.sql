-- Gwarantuje istnienie tabeli digitization_analyses na wszystkich środowiskach.
--
-- Problem: oryginalna migracja 060_digitization_analyses.sql miała
-- organization_id INTEGER (stary format int-ID), przez co mogła nie zadziałać
-- na demo (SQLite) kiedy org-IDs przeszły na UUID/TEXT. dbRun z fallback=true
-- kasował błąd cicho. Efekt: INSERT + immediacy-GET zwracały niespójne wyniki.
--
-- Ta migracja używa zaktualizowanego schematu z TEXT organization_id.
-- CREATE TABLE IF NOT EXISTS = bezpieczna (additive, idempotentna).
-- Na środowiskach gdzie tabela już istnieje: no-op.

CREATE TABLE IF NOT EXISTS digitization_analyses (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT,
  status           TEXT DEFAULT 'draft',
  initiative_id    TEXT,
  project_id       TEXT,
  initiative_type  TEXT,
  analysis_type    TEXT DEFAULT 'financial',
  organization_id  TEXT NOT NULL,
  created_by       TEXT,
  overall_score    REAL,
  completion_percent INTEGER DEFAULT 0,
  axis_scores      TEXT DEFAULT '{}',
  imported_from    TEXT,
  import_date      TIMESTAMP,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_digitization_analyses_org
  ON digitization_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_digitization_analyses_status
  ON digitization_analyses(status);
CREATE INDEX IF NOT EXISTS idx_digitization_analyses_project
  ON digitization_analyses(project_id);
