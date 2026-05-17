-- Rollback for 20260513_block_d_form_intake.sql
-- Drops tp_form_submissions and the four tp_forms columns added in D-S2.
--
-- DESTRUCTIVE: all submission audit rows are lost. Existing form records in
-- tp_records are NOT affected — they live in their own table.
--
-- Confirm zero feature-flag traffic on `ENABLE_TABLE_FORM_INTAKE_JWT`
-- before running.
--
-- Usage on staging:
--   psql $STAGING_DATABASE_URL -f server/migrations/rollback/20260513_block_d_form_intake.down.sql

BEGIN;

DROP INDEX IF EXISTS idx_tp_form_submissions_form;
DROP INDEX IF EXISTS idx_tp_form_submissions_table;
DROP INDEX IF EXISTS idx_tp_form_submissions_jwt_subject;
DROP TABLE IF EXISTS tp_form_submissions;

DROP INDEX IF EXISTS idx_tp_forms_embed_target;

ALTER TABLE tp_forms DROP COLUMN IF EXISTS public_link_expires_at;
ALTER TABLE tp_forms DROP COLUMN IF EXISTS field_allow_list;
ALTER TABLE tp_forms DROP COLUMN IF EXISTS public_jwt_secret;
ALTER TABLE tp_forms DROP COLUMN IF EXISTS embed_target_table_id;

COMMIT;
