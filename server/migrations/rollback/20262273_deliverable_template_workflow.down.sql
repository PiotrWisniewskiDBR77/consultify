-- Explicit rollback for TPL-1b / DEC-558 migration 20262273.
-- Drops only the two workflow tables introduced by the forward migration.
-- Test receipts are removed first because they reference workflow rows.
-- Destructive by nature for post-migration template workflow data; kept out of
-- the forward chain by KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS.
-- [ODMROZENIE 11_MATERIALS DEC-558] [ODMROZENIE WSPOLNE DEC-558]

BEGIN;

DROP TABLE IF EXISTS deliverable_template_test_runs;
DROP TABLE IF EXISTS deliverable_template_workflows;

COMMIT;
