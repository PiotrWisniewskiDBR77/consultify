-- Rollback for 20260512_block_d_table_conversions.sql
-- Drops tp_table_conversions.
--
-- DESTRUCTIVE: all conversion audit rows are lost. Materialized artifact
-- runs in the V8 pipeline are NOT affected — they live in their own tables.
--
-- Confirm zero feature-flag traffic on `ENABLE_TABLE_ARTIFACT_CONVERSION`
-- before running.
--
-- Usage on staging:
--   psql $STAGING_DATABASE_URL -f server/migrations/rollback/20260512_block_d_table_conversions.down.sql

BEGIN;

DROP INDEX IF EXISTS idx_tp_table_conversions_org;
DROP INDEX IF EXISTS idx_tp_table_conversions_workspace;
DROP INDEX IF EXISTS idx_tp_table_conversions_table;
DROP INDEX IF EXISTS idx_tp_table_conversions_source_pack;
DROP INDEX IF EXISTS idx_tp_table_conversions_status;
DROP TABLE IF EXISTS tp_table_conversions;

COMMIT;
