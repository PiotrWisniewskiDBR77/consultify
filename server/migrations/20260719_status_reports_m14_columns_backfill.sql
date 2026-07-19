-- Odbiór 2026-07-19 (reportPdf mini-followup): table-name collision fix for
-- `status_reports`. Same class of bug as 20260716_odbior_500_fixes.sql —
-- codified here because a real-runtime smoke test (parity pg18 :5443) found
-- it while proving the /api/report-pdf mount actually works end-to-end.
--
-- ROOT CAUSE: two independent "status_reports" schemas share one table name.
--   1. LEGACY (bootstrap): server/src/database/PostgresDatabase.ts initDb()
--      creates a thin `status_reports(id, organization_id, project_id,
--      title, content, health, period, created_by, created_at)` on first
--      boot. Still used live by server/src/routes/status-reports.routes.ts
--      (simple per-project status notes) — untouched by this migration.
--   2. M14/ExecutionHub RICH schema: server/migrations/066_status_reports.sql
--      defines a much richer `status_reports` (initiative_id, period_type,
--      sections_json, RAG rollup, narrative fields, ...) via
--      `CREATE TABLE IF NOT EXISTS status_reports (...)`. On any DB where
--      the legacy bootstrap already ran first, that IF NOT EXISTS is a
--      silent no-op — the rich columns never get created. This breaks
--      StatusReportService.generateReport/getReport, reportCadenceService
--      (findDueReports → GET /api/report-pdf/cadence/due), and
--      reportPdfService's caller (GET /api/report-pdf/:reportId/pdf) with
--      "column ... does not exist" on ANY environment bootstrapped this way
--      — parity pg18 confirmed 2026-07-19; presumed same on demo/prod since
--      they share the same PostgresDatabase.ts bootstrap path.
--
-- FIX: additive ALTER TABLE ADD COLUMN IF NOT EXISTS for every rich-schema
-- column missing from the legacy table, plus the sibling tables 066 also
-- defines. Nullable / defaulted — never NOT NULL — so existing legacy rows
-- (title/content/health/period) are untouched and remain valid. No renames,
-- no drops: fully additive, no rollback needed (CLAUDE.md: "migracje sesji
-- addytywne=bez rollbacku"). Prefiks daty → wpada w autorun (DatabaseInitializer
-- regex /^(7\d{2}|\d{8})_/).

ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS initiative_id TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS period_type TEXT DEFAULT 'WEEKLY';
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS period_start TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS period_end TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS period_label TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS overall_status TEXT DEFAULT 'GREEN';
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS overall_trend TEXT DEFAULT 'STABLE';
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS sections_json TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS executive_summary TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS accomplishments TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS next_steps TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS escalations TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS risks_and_issues TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS recommendations TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS budget_consumed_percent INTEGER DEFAULT 0;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS tasks_completed INTEGER DEFAULT 0;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS tasks_total INTEGER DEFAULT 0;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS open_risks INTEGER DEFAULT 0;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS open_issues INTEGER DEFAULT 0;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS pending_decisions INTEGER DEFAULT 0;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS generation_method TEXT DEFAULT 'MANUAL';
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS ai_model_used TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT';
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS reviewed_at TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS approved_at TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS published_at TEXT;
ALTER TABLE status_reports ADD COLUMN IF NOT EXISTS updated_at TEXT DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_status_reports_initiative ON status_reports(initiative_id);
CREATE INDEX IF NOT EXISTS idx_status_reports_period ON status_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_status_reports_status ON status_reports(status);

-- 066_status_reports.sql's other 4 tables are name-unique, so most of them
-- landed fine. report_section_history was confirmed MISSING on parity pg18
-- (verified via information_schema, 2026-07-19) — recreated here verbatim.
CREATE TABLE IF NOT EXISTS report_section_history (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    section_name TEXT NOT NULL,
    status TEXT NOT NULL,
    previous_status TEXT,
    content TEXT,
    highlights TEXT,
    issues TEXT,
    action_items TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES status_reports(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_report_section_history_report ON report_section_history(report_id);
