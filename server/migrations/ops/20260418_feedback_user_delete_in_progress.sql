-- Feedback audit: superadmin user deletion CRIT unblocked
-- Schema migration: 20260418_users_deleted_at_column.sql (applied to prod + staging)
-- Code commit: 7516a7a25 fix(superadmin): unblock user deletion (#406b042a CRIT)
-- GitHub push: pushed to origin/develop
-- Note: Railway `up` API was intermittently timing out at time of audit write.
--       Schema change (the actual unblocker) is already live; code deploy will
--       pick up on next successful Railway upload.

BEGIN;

UPDATE feedback_items
SET
  status = 'IN_PROGRESS',
  updated_at = NOW(),
  metadata_json = (
    COALESCE(metadata_json::jsonb, '{}'::jsonb)
    || jsonb_build_object(
      'workflow',
      jsonb_build_object(
        'timeline',
        COALESCE(metadata_json::jsonb -> 'workflow' -> 'timeline', '[]'::jsonb)
        || jsonb_build_array(
          jsonb_build_object(
            'at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'actor', 'cto-agent',
            'event', 'IN_PROGRESS',
            'schema_migration', '20260418_users_deleted_at_column.sql',
            'commit', '7516a7a25',
            'root_cause', 'UserController.deleteUser UPDATE referenced users.deleted_at which did not exist on the PG schema, so every delete call errored server-side with `column "deleted_at" of relation "users" does not exist`. Additionally, the controller required organization_id match on the target user, blocking superadmin cross-org deletes. The unused hard-delete route (routes/users.routes.ts) would also fail due to 28+ FK constraints without ON DELETE actions.',
            'fix', 'Added missing deleted_at column via ALTER TABLE (idempotent migration, applied to prod + staging). Rewrote UserController.deleteUser to (a) allow SUPERADMIN to bypass org scoping, (b) purge sessions explicitly so live tokens are invalidated, (c) anonymize email to free the unique index for future re-registration, (d) soft-delete with status=deleted + deleted_at=NOW(). Frontend deleteUser now uses fetchWithRetry/handleResponse and surfaces backend error messages instead of the generic toast.',
            'files', jsonb_build_array(
              'server/src/controllers/UserController.ts',
              'src/services/api.ts',
              'src/components/shared/UserManagementCore.tsx',
              'server/migrations/ops/20260418_users_deleted_at_column.sql'
            )
          )
        )
      )
    )
  )::text
WHERE id = '406b042a-89ea-40f8-a811-bb880a1a2b8e';

COMMIT;
