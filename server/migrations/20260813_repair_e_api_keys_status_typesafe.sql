-- Forward repair E (release gate closeout, 2026-08-13) — 548 type-safe status contract.
--
-- WHY: 548_audit_log_api_keys_compatibility.sql derives api_keys.status from is_active using
-- BOOLEAN logic: COALESCE(is_active, TRUE) = FALSE. Demo's api_keys.is_active is INTEGER
-- (verified read-only 2026-08-13), so that expression is a genuine TYPE ERROR there, not merely a
-- checksum difference. Approving the historical checksum silences the drift but leaves the wrong
-- contract in place, so this migration establishes the correct one for BOTH shapes.
--
-- Works for INTEGER and BOOLEAN, fails closed on anything else. Idempotent: it only writes rows
-- whose status does not already reflect is_active. Never widens beyond api_keys and never touches
-- tenant-scoped columns, so tenant safety is unaffected.
DO $repair_e$
DECLARE
  t text;
BEGIN
  IF to_regclass('public.api_keys') IS NULL THEN
    RETURN;
  END IF;

  SELECT data_type INTO t
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'is_active';

  IF t IS NULL THEN
    RETURN; -- no is_active column: nothing to derive from
  END IF;

  IF to_regclass('public.api_keys') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='api_keys' AND column_name='status') THEN
    ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
  END IF;

  IF t = 'boolean' THEN
    UPDATE api_keys
       SET status = 'revoked'
     WHERE COALESCE(is_active, TRUE) = FALSE
       AND status IS DISTINCT FROM 'revoked';
  ELSIF t IN ('integer', 'smallint', 'bigint') THEN
    UPDATE api_keys
       SET status = 'revoked'
     WHERE COALESCE(is_active, 1) = 0
       AND status IS DISTINCT FROM 'revoked';
  ELSE
    RAISE EXCEPTION
      'repair_e: api_keys.is_active has unsupported type % — refusing to derive status (fail closed)', t;
  END IF;
END
$repair_e$;
