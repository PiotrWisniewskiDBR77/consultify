-- M14/F6 (6.2): Real distribution worker support.
-- report_distributions only tracked intent (created_at / sent_at) but had no
-- delivery-state columns the email-worker can claim/settle on.
-- delivered_at IS NULL = "not yet delivered" → the worker's work queue.

-- FRESH-DB GUARD (2026-08-02, MW-07 release-gate finding): report_distributions
-- FKs to status_reports, but status_reports ITSELF has the exact same fresh-DB
-- gap as report_distributions below — both are declared only in
-- 066_status_reports.sql, which `isSqliteOnlyMigration()` in
-- server/scripts/migrate.postgres.ts filters out (<500 legacy fragment, not
-- `000_z_core_baseline`). On staging/prod this stays invisible because
-- server/src/database/PostgresDatabase.ts's boot-time bootstrap creates a
-- thin `status_reports` table first (see 20260719_status_reports_m14_columns_
-- backfill.sql for that history) — but a genuinely fresh `db:migrate:strict`
-- run (no app bootstrap involved) hits `relation "status_reports" does not
-- exist` right here, before the FK below can even be declared. Create it here
-- with the shape 066 declared, same SQLite→Postgres TEXT-default correction
-- already used for report_distributions (`CURRENT_TIMESTAMP` -> `(now()::text)`).
-- CREATE IF NOT EXISTS = no-op on DBs where the table already exists
-- (staging/prod/TROLLEY).
--
-- CORRECTION (2026-08-02, MW-07 acceptance): the paragraph above is only half
-- true, and the `CREATE TABLE IF NOT EXISTS` alone is NOT sufficient. A
-- genuinely fresh `db:migrate:strict` replay DOES involve the app bootstrap:
-- the `.ts` migrations that sort earlier (first one:
-- `20260620_2000_notebook_fts_repair.ts`) import the app database module, and
-- that import runs `PostgresDatabase.ts`'s `initDb()` — which creates the THIN
-- legacy `status_reports(id, organization_id, project_id, title, content,
-- health, period, created_by, created_at)`. By the time this file runs, the
-- table therefore already exists WITHOUT `initiative_id`, the CREATE below is
-- a silent no-op (exactly the failure mode
-- `20260719_status_reports_m14_columns_backfill.sql` documents at length), and
-- `CREATE INDEX ... ON status_reports(initiative_id)` a few lines down aborts
-- the whole replay with `column "initiative_id" does not exist`.
-- Reproduced on a clean Postgres 16 container with `MOCK_DB=false`; the
-- earlier `relation "status_reports" does not exist` reading came from a run
-- where `MOCK_DB` was left at its `NODE_ENV=test` default, so those `.ts`
-- migrations silently got a mock database and never bootstrapped anything.
-- FIX: the additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` guard below,
-- covering exactly the columns this file's own indexes reference. Same
-- additive, no-rollback-needed pattern already accepted in
-- `20260719_status_reports_m14_columns_backfill.sql`; nullable on purpose, so
-- existing legacy rows stay valid.
CREATE TABLE IF NOT EXISTS status_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    initiative_id TEXT NOT NULL,
    project_id TEXT,

    -- Report Period
    period_type TEXT NOT NULL DEFAULT 'WEEKLY', -- WEEKLY, MONTHLY, QUARTERLY
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    period_label TEXT, -- e.g., "Week 52, 2024"

    -- Overall Status (RAG)
    overall_status TEXT NOT NULL DEFAULT 'GREEN', -- GREEN, AMBER, RED
    overall_trend TEXT DEFAULT 'STABLE', -- IMPROVING, STABLE, DECLINING

    -- Section Statuses (JSON)
    sections_json TEXT, -- {schedule: {status, content, highlights, issues}, budget: {...}, ...}

    -- Narrative Content
    executive_summary TEXT,
    accomplishments TEXT, -- JSON array
    next_steps TEXT, -- JSON array
    escalations TEXT, -- JSON array
    risks_and_issues TEXT,
    recommendations TEXT,

    -- Metrics at report time
    progress_percent INTEGER DEFAULT 0,
    budget_consumed_percent INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_total INTEGER DEFAULT 0,
    open_risks INTEGER DEFAULT 0,
    open_issues INTEGER DEFAULT 0,
    pending_decisions INTEGER DEFAULT 0,

    -- Generation metadata
    generation_method TEXT DEFAULT 'MANUAL', -- MANUAL, AUTO, AI_ASSISTED
    ai_model_used TEXT,

    -- Workflow
    status TEXT DEFAULT 'DRAFT', -- DRAFT, PENDING_REVIEW, APPROVED, PUBLISHED, ARCHIVED
    reviewed_by TEXT,
    reviewed_at TEXT,
    approved_by TEXT,
    approved_at TEXT,
    published_at TEXT,

    -- Timestamps
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT (now()::text),
    updated_at TEXT DEFAULT (now()::text),

    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Bridges the legacy-thin bootstrap shape to the columns the indexes below
-- need. No-op on a DB where the CREATE above actually created the rich table,
-- and no-op again on staging/demo/prod where
-- `20260719_status_reports_m14_columns_backfill.sql` has already added them.
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS initiative_id TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS period_start TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS period_end TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT';

CREATE INDEX IF NOT EXISTS idx_status_reports_initiative ON status_reports(initiative_id);
CREATE INDEX IF NOT EXISTS idx_status_reports_org ON status_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_status_reports_period ON status_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_status_reports_status ON status_reports(status);

-- FRESH-DB GUARD (2026-07-14): report_distributions was originally created by
-- 066_status_reports.sql, which the Postgres runner filters out (<500 legacy).
-- On a fresh replay the table therefore never exists — create it here with the
-- shape 066 declared (created_at default corrected from the SQLite-ism
-- `TEXT DEFAULT CURRENT_TIMESTAMP` to `(now()::text)`, same as the 2026-06-08
-- drift catch-up did for other tables). CREATE IF NOT EXISTS = no-op on DBs
-- where the table already exists (staging/prod).
CREATE TABLE IF NOT EXISTS report_distributions (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    recipient_id TEXT,
    recipient_email TEXT,
    recipient_type TEXT DEFAULT 'STAKEHOLDER', -- STAKEHOLDER, SPONSOR, TEAM, EXTERNAL
    distribution_method TEXT DEFAULT 'EMAIL', -- EMAIL, LINK, PDF
    sent_at TEXT,
    opened_at TEXT,
    link_token TEXT,
    created_at TEXT DEFAULT (now()::text),
    FOREIGN KEY (report_id) REFERENCES status_reports(id) ON DELETE CASCADE
);

ALTER TABLE report_distributions ADD COLUMN IF NOT EXISTS delivered_at TEXT;
ALTER TABLE report_distributions ADD COLUMN IF NOT EXISTS delivery_status TEXT;
