-- Rollback for 20260508_block_a_template_lifecycle.sql
-- Removes lifecycle columns + CHECK + indexes from tp_base_templates.
-- Promoted legacy rows revert to status implicit (column removed) but their original
-- is_featured flag is preserved (untouched by forward migration).
--
-- Usage on staging:
--   psql $STAGING_DATABASE_URL -f server/migrations/rollback/20260508_block_a_template_lifecycle.down.sql
--
-- NOTE: dropping these columns is destructive for any data written into
--   approval_history / governance_rules. Confirm there are no in-flight approval
--   records before running rollback in production.

BEGIN;

DROP INDEX IF EXISTS idx_tp_templates_status;
DROP INDEX IF EXISTS idx_tp_templates_owner_user;

ALTER TABLE tp_base_templates
  DROP CONSTRAINT IF EXISTS tp_base_templates_status_check;

ALTER TABLE tp_base_templates
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS owner_user_id,
  DROP COLUMN IF EXISTS approval_history,
  DROP COLUMN IF EXISTS governance_rules;

COMMIT;
