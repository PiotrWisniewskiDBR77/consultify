-- ŁOWCA RED (assess/reports/finance rewir, 2026-07-19): assessment_reports is
-- missing `version` / `content_json` — columns the codebase actively expects.
--
-- ROOT CAUSE: server/src/controllers/AssessmentController.ts has an inline
-- `CREATE TABLE IF NOT EXISTS assessment_reports (... version INTEGER
-- DEFAULT 1, ... content_json TEXT DEFAULT '{}' ...)` self-heal block
-- (~line 388), but it is a silent no-op on any DB where assessment_reports
-- already exists via the real migration path (which never defined these two
-- columns — see `information_schema.columns` on parity pg18: id,
-- assessment_id, organization_id, project_id, name, status, template_id,
-- axis_data, executive_summary, detailed_analysis, recommendations, ...).
-- Confirmed by real-runtime smoke (parity pg18 :5443, 2026-07-19):
--   - GET  /api/assessment-workflow-v2/:id/report/versions
--       -> 500 42703 column "version" does not exist
--       (`SELECT ... version ... FROM assessment_reports ORDER BY version DESC`)
--   - AssessmentController.ts:1798 `SELECT MAX(version) ... FROM assessment_reports`
--     and :1945 `INSERT INTO assessment_reports (..., version, ..., content_json, ...)`
--     reference the same two columns and would 42703/42703 the same way the
--     first time either code path executes on this schema.
--
-- FIX: additive ADD COLUMN IF NOT EXISTS, nullable/defaulted — mirrors the
-- exact types/defaults already declared in AssessmentController's own
-- CREATE TABLE self-heal block, so no existing row/reader is affected.
-- No renames, no drops: fully additive, no rollback needed (CLAUDE.md:
-- "migracje sesji addytywne=bez rollbacku"). Date prefix -> autorun via
-- DatabaseInitializer regex /^(7\d{2}|\d{8})_/.

ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE assessment_reports ADD COLUMN IF NOT EXISTS content_json TEXT DEFAULT '{}';
