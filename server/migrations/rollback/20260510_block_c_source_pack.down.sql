-- Rollback for 20260510_block_c_source_pack.sql
-- Drops tp_source_packs.
--
-- DESTRUCTIVE: all pack rows are lost.
-- Confirm zero feature-flag traffic on `featureSourcePackEnabled` before running.
--
-- Usage on staging:
--   psql $STAGING_DATABASE_URL -f server/migrations/rollback/20260510_block_c_source_pack.down.sql

BEGIN;

DROP INDEX IF EXISTS idx_tp_source_packs_org;
DROP INDEX IF EXISTS idx_tp_source_packs_workspace;
DROP INDEX IF EXISTS idx_tp_source_packs_table;
DROP INDEX IF EXISTS idx_tp_source_packs_active;
DROP TABLE IF EXISTS tp_source_packs;

COMMIT;
