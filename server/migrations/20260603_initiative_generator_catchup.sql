-- Migration 20260603: Initiative Generator catch-up (Postgres-clean)
--
-- Re-issues the schema from legacy 011_initiative_generator.sql.sql, which the
-- canonical Postgres runner (migrate.postgres.ts) SKIPS because it is a `.sql.sql`
-- double-extension file AND version < 500. On fresh Postgres DBs the tables below
-- were therefore never created, while server/src (Gateway.ts, AssessmentController.ts,
-- initiative-generator.routes.ts) queries them.
--
-- Date-prefixed so the app-startup auto-runner (DatabaseInitializer.runTablePlatformMigrations,
-- regex /^(7\d{2}|\d{8})_.*\.sql$/) AND migrate.postgres.ts both apply it.
-- Idempotent: safe to run against environments that already have these tables.

-- Draft initiatives staged before approval (PK = assessment_id, one draft set per assessment)
CREATE TABLE IF NOT EXISTS initiative_drafts (
    assessment_id    TEXT NOT NULL,
    initiatives_json TEXT NOT NULL,
    updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (assessment_id)
);

-- Links generated initiatives back to their source assessment + axis
CREATE TABLE IF NOT EXISTS assessment_initiatives (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    assessment_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    source_axis   TEXT,
    gap_size      REAL,
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (assessment_id, initiative_id)
);

-- Enhanced-tracking columns on initiatives (idempotent on Postgres)
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS created_from         TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS created_by           TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS estimated_roi        REAL;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS estimated_budget     REAL;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS timeline             TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS risk_level           TEXT;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS ai_generated         INTEGER DEFAULT 0;
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS source_assessment_id TEXT;

-- maturity_assessments may not exist on fresh Postgres (also a skipped-legacy table);
-- guard the ALTERs so this migration never hard-fails on its account.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'maturity_assessments') THEN
        ALTER TABLE maturity_assessments ADD COLUMN IF NOT EXISTS initiatives_generated    INTEGER DEFAULT 0;
        ALTER TABLE maturity_assessments ADD COLUMN IF NOT EXISTS initiatives_generated_at TIMESTAMPTZ;
        ALTER TABLE maturity_assessments ADD COLUMN IF NOT EXISTS initiatives_count        INTEGER DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_initiative_drafts_updated         ON initiative_drafts(updated_at);
CREATE INDEX IF NOT EXISTS idx_assessment_initiatives_assessment ON assessment_initiatives(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_initiatives_initiative ON assessment_initiatives(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_source_assessment     ON initiatives(source_assessment_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_created_from          ON initiatives(created_from);
