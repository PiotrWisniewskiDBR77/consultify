-- Explicit rollback for D-136 / QD20 (DEC-685) migration 20262304.
--
-- Drops ONLY what 20262304 added: the two indexes and the three `users` columns.
-- Nothing else is touched — in particular `scim_conflict_log` and
-- `scim_group_mappings` are owned by 20260719_baseline_gap.sql:8615-8651, not by
-- this chain (the D-133 lesson: a down that drops a foreign object silently
-- destroys another migration's work).
--
-- Fail-closed on data: once SCIM provisioning has written to these columns the
-- rollback would destroy directory state, so it refuses and asks for an explicit
-- operator decision instead (same posture as 20262280, ruled intentional in
-- DEC-683). A freshly applied 20262304 has all three columns at their
-- just-created values (NULL / FALSE / NULL), so UP -> DOWN -> UP passes.
--
-- Kept out of the forward chain by KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS
-- (migrate.postgres.ts:157). Rollback order is reverse-chronological.

BEGIN;

DO $$
DECLARE
  provisioned_rows BIGINT;
BEGIN
  SELECT count(*) INTO provisioned_rows
    FROM users
   WHERE scim_external_id IS NOT NULL
      OR scim_provisioned IS TRUE
      OR scim_last_sync_at IS NOT NULL;

  IF provisioned_rows > 0 THEN
    RAISE EXCEPTION
      '20262304 rollback conflict: % users row(s) carry SCIM provisioning state '
      '(scim_external_id / scim_provisioned / scim_last_sync_at). Export or '
      'deprovision them first, or restore the columns from a backup — this '
      'rollback will not delete directory state on its own.',
      provisioned_rows;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_scim_conflicts_org;
DROP INDEX IF EXISTS idx_users_scim_external_id;

ALTER TABLE users DROP COLUMN IF EXISTS scim_last_sync_at;
ALTER TABLE users DROP COLUMN IF EXISTS scim_provisioned;
ALTER TABLE users DROP COLUMN IF EXISTS scim_external_id;

COMMIT;
