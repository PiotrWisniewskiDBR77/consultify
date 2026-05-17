-- Rollback for 20260509_block_c_qa_engine.sql
-- Drops tp_qa_reports and tp_qa_suggestion_dismissals.
--
-- DESTRUCTIVE: all rows in both tables are lost.
-- Confirm zero feature-flag traffic on `featureTableQaEngineEnabled` before running.
--
-- Usage on staging:
--   psql $STAGING_DATABASE_URL -f server/migrations/rollback/20260509_block_c_qa_engine.down.sql

BEGIN;

DROP INDEX IF EXISTS idx_tp_qa_dismissals_table;
DROP INDEX IF EXISTS idx_tp_qa_dismissals_org;
DROP TABLE IF EXISTS tp_qa_suggestion_dismissals;

DROP INDEX IF EXISTS idx_tp_qa_reports_table_recent;
DROP INDEX IF EXISTS idx_tp_qa_reports_org;
DROP INDEX IF EXISTS idx_tp_qa_reports_workspace;
DROP TABLE IF EXISTS tp_qa_reports;

COMMIT;
