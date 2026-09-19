-- D-136 / QD20 (DEC-685) — the five SCIM objects that never reached any database.
--
-- Provenance (measured, not assumed):
--   * staging `schema_migrations` holds `656_v4_scim_enhanced.sql` with
--     status='skipped', applied_at=2026-03-16T17:31:37.078Z,
--     checksum='skipped:cf5aec4e30dda698a16219cf05f161b6761571a1cee40712eb46d74f513a5b75'.
--   * The git blob whose sha256 equals that checksum is the source of the
--     definitions below (audit D-126, copy kept at
--     evidence/d126-skipped-migrations-20260919/historia/zrodla/). The file that
--     survives in server/migrations/never-ran/656_v4_scim_enhanced.sql has
--     DIVERGED (sha256=1db8422dc439c2c13f9e2f99cdf3d0b53fde805f8b6c8902d8933d37b97eb856):
--     it carries a `scim_group_mappings` CREATE TABLE block the ledger-era file
--     never had, so the ledger-era bytes — not the surviving copy — are quoted here.
--   * object -> ledger-era line: users.scim_external_id :3, users.scim_provisioned :4,
--     users.scim_last_sync_at :5, idx_users_scim_external_id :7, idx_scim_conflicts_org :25.
--   * 5/5 measured ABSENT on live staging at deployment 30 (read-only) and on a
--     fresh restore of staging-auto-20260919T0330.dump, while both parents exist
--     (`users` 52 rows, `scim_conflict_log` 0 rows):
--     evidence/d136-scim-objects-20260919/krok0-staging-zywy.txt, krok0-kopia.txt.
--
-- Why it matters: server/src/routes/integrations/scim.routes.ts reads these
-- columns in 12 places (:193, :201, :320, :327, :388, :403, :442, :488, :489,
-- :614, :647, :1161) and is mounted unconditionally (Gateway.ts:173, :1027-1028).
-- DbPromise.all() defaults to `fallback: true`, so those reads resolved to []
-- instead of failing: GET /api/scim/v2/Users answered totalResults: 0 for a
-- directory holding 52 users.
--
-- Scope: EXACTLY these five objects, types verbatim from the ledger-era blob.
-- Additive, idempotent (IF NOT EXISTS), no other DDL, no data writes. The rest of
-- 656 (`scim_group_mappings` columns, `scim_conflict_log` table) already exists
-- through 20260719_baseline_gap.sql:8615-8651 and is deliberately NOT repeated.
-- SCIM routes are not disabled by this migration.
-- GO: KANAL.md [D] Wpis 214 (DEC-685); pool 20262304-20262319.

ALTER TABLE users ADD COLUMN IF NOT EXISTS scim_external_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scim_provisioned BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scim_last_sync_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_scim_external_id
    ON users (scim_external_id)
    WHERE scim_external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scim_conflicts_org
    ON scim_conflict_log (organization_id);

-- Readback: a half-applied SCIM surface is worse than a failed migration, because
-- the routes swallow read errors (fallback: true) and would answer empty again.
DO $$
DECLARE
  cols_found INTEGER;
  idx_found  INTEGER;
BEGIN
  SELECT count(*) INTO cols_found
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'users'
     AND column_name IN ('scim_external_id', 'scim_provisioned', 'scim_last_sync_at');

  SELECT count(*) INTO idx_found
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND indexname IN ('idx_users_scim_external_id', 'idx_scim_conflicts_org');

  IF cols_found <> 3 OR idx_found <> 2 THEN
    RAISE EXCEPTION
      'SCIM-20262304 readback: expected 3 users columns + 2 indexes, found % + %',
      cols_found, idx_found;
  END IF;
END $$;
