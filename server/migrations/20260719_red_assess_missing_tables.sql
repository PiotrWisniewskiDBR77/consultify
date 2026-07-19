-- ŁOWCA RED (assess rewir, 2026-07-19): trzy tabele assessment nigdy nie powstały
-- na realnym torze migracji Postgres (istnieją tylko referencje w dialekcie SQLite:
-- 010_assessment_workflow.sql.sql — nie odpala, oraz 248_assessment_enhancements.sql).
-- Konsekwencja: 500 42P01 (undefined_table) na żywych endpointach.
--
-- SMOKE (parity pg18 :5443, 2026-07-19) — potwierdzone brakiem tabel w pg_tables:
--   - GET /api/assessment-workflow/:id/report/versions  (i .../versions)
--       -> SELECT ... FROM assessment_versions  -> 500 (assessment_versions brak)
--   - GET /api/assessment-workflow/:id/versions/:from/diff/:to
--       -> SELECT version,data FROM assessment_versions -> 500
--   - GET /api/assessment-workflow/pending-reviews
--       -> SELECT ... FROM assessment_reviews r LEFT JOIN assessments -> 500 (assessment_reviews brak)
--   - GET /api/assessment-evidence/:id/report (AssessmentEvidenceService.getEvidenceReport)
--       -> SELECT DISTINCT dimension_id FROM assessment_questions -> 500 (assessment_questions brak)
--
-- KONTRAKT wyprowadzony Z KODU-KONSUMENTA (złota reguła: schemat = realne query, nie stara migracja):
--   assessment_versions  -> assessment-workflow.routes.ts:
--       SELECT id, assessment_id, version, data, created_at, created_by, change_log (l.568)
--       INSERT (id, assessment_id, version, assessment_data, data, created_at, created_by,
--               change_summary, change_log, changed_axes) (l.658)
--       => wymaga OBU kolumn data + assessment_data ORAZ change_log + change_summary
--          (referencja SQLite 010 miała tylko assessment_data/change_summary — niekompletna).
--   assessment_reviews   -> assessment-workflow.routes.ts:
--       INSERT (id, workflow_id, assessment_id, reviewer_id, status, assigned_at, message) (l.369)
--       SELECT r.id, r.workflow_id, r.assessment_id, r.reviewer_id, r.status, r.feedback,
--              r.rating, r.assigned_at, r.started_at, r.completed_at, r.due_date, r.message (l.900)
--       => referencja SQLite 010 nie miała assessment_id/feedback/assigned_at/message — dodane.
--   assessment_questions -> assessments.routes.ts:419 (SELECT * WHERE framework_id AND is_active=1
--       ORDER BY dimension_id, question_order) + AssessmentEvidenceService.ts:170 (SELECT DISTINCT
--       dimension_id WHERE framework_id AND is_active=1 AND dimension_id IS NOT NULL).
--       Schemat wg referencji 248_assessment_enhancements.sql (dialekt SQLite -> Postgres).
--
-- Idempotentna: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS (2x run = no-op).
-- Prefiks 8-cyfrowy -> autorun DatabaseInitializer /^(7\d{2}|\d{8})_/. Addytywna, bez rollbacku.
-- FK -> assessments(id) TEXT tam gdzie sensowne (versions, reviews). assessment_frameworks
-- NIE istnieje na tym schemacie => questions bez FK.

CREATE TABLE IF NOT EXISTS assessment_versions (
    id              TEXT PRIMARY KEY,
    assessment_id   TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    version         INTEGER NOT NULL,
    data            TEXT,
    assessment_data TEXT,
    change_log      TEXT,
    change_summary  TEXT,
    changed_axes    TEXT,
    created_by      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_assessment_versions_assessment_version UNIQUE (assessment_id, version)
);
CREATE INDEX IF NOT EXISTS idx_assessment_versions_assessment ON assessment_versions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_versions_version ON assessment_versions(assessment_id, version);

CREATE TABLE IF NOT EXISTS assessment_reviews (
    id            TEXT PRIMARY KEY,
    workflow_id   TEXT NOT NULL,
    assessment_id TEXT REFERENCES assessments(id) ON DELETE CASCADE,
    reviewer_id   TEXT NOT NULL,
    status        TEXT DEFAULT 'PENDING',
    feedback      TEXT,
    rating        INTEGER,
    message       TEXT,
    assigned_at   TIMESTAMPTZ DEFAULT now(),
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    due_date      TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assessment_reviews_reviewer ON assessment_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_assessment_reviews_workflow ON assessment_reviews(workflow_id);
CREATE INDEX IF NOT EXISTS idx_assessment_reviews_assessment ON assessment_reviews(assessment_id);

CREATE TABLE IF NOT EXISTS assessment_questions (
    id                          TEXT PRIMARY KEY,
    framework_id                TEXT NOT NULL,
    dimension_id                TEXT,
    subdimension_id             TEXT,
    question_order              INTEGER DEFAULT 0,
    question_text               TEXT,
    question_text_translations  TEXT,
    help_text                   TEXT,
    help_text_translations      TEXT,
    scoring_criteria            TEXT,
    evidence_required           INTEGER DEFAULT 0,
    weight                      REAL DEFAULT 1.0,
    is_active                   INTEGER DEFAULT 1,
    created_at                  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_framework ON assessment_questions(framework_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_dimension ON assessment_questions(dimension_id);
