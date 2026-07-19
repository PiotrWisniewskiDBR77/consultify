-- RED-MISC (Odbiór 2026-07-19) — schema-500 on system_health_alerts writes.
--
-- ROOT CAUSE: two divergent schemas share the table name `system_health_alerts`.
--   1. LEGACY migration schema (live on parity/demo): columns
--      (id, name, metric, condition NOT NULL, threshold, severity, channels,
--       is_enabled, last_triggered_at, created_at, updated_at).
--   2. RUNTIME code contract — server/src/routes/systemHealth.routes.ts
--      `ensureAlertsTable()` (CREATE TABLE IF NOT EXISTS) and every write
--      handler (POST/PUT/PUT toggle) expect columns `operator` and `enabled`
--      and NEVER write `condition`. Because the table already exists with the
--      legacy shape, the CREATE-IF-NOT-EXISTS is a no-op and the columns are
--      never reconciled.
--
-- SYMPTOM (confirmed, parity pg18 :5443, superadmin JWT):
--   POST /api/system-health/alerts
--     -> 42703  column "operator" of relation "system_health_alerts" does not exist
--   (after adding operator/enabled the same INSERT would then hit 23502 on the
--    legacy NOT-NULL `condition`, which the router never supplies.)
--
-- FIX (additive + idempotent): add the two columns the runtime expects and
-- relax the legacy `condition` NOT NULL so the router's INSERT (which omits it)
-- succeeds. Nothing is dropped; legacy readers of condition/severity/is_enabled
-- are unaffected.

ALTER TABLE IF EXISTS system_health_alerts
  ADD COLUMN IF NOT EXISTS operator TEXT NOT NULL DEFAULT 'gt';

ALTER TABLE IF EXISTS system_health_alerts
  ADD COLUMN IF NOT EXISTS enabled INTEGER NOT NULL DEFAULT 1;

-- Relax the legacy NOT-NULL `condition` only if that column exists (a DB whose
-- table was first created by ensureAlertsTable() has no `condition` column).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_health_alerts' AND column_name = 'condition'
  ) THEN
    EXECUTE 'ALTER TABLE system_health_alerts ALTER COLUMN "condition" DROP NOT NULL';
  END IF;
END $$;
