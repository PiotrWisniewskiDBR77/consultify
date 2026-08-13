-- Forward repair D (release gate closeout, 2026-08-13) — 542 schema parity.
--
-- WHY: 542_project_members_consultant_overlay_and_steering_board.sql declares the steering-board
-- timestamps as TIMESTAMPTZ, so a FRESH database gets TIMESTAMPTZ. Demo ran an older version and
-- has TEXT, and because the declaration sits inside CREATE TABLE IF NOT EXISTS the newer file can
-- never converge them. That left two environments with genuinely different column types — an
-- unstated divergence, which is exactly what this closeout removes.
--
-- Verified read-only against demo on 2026-08-13 before writing this:
--   * exactly four columns diverge: project_steering_board.{created_at,updated_at} and
--     project_steering_board_members.{created_at,updated_at} are TEXT; every other TEXT column
--     legitimately matches the file's own TEXT declaration.
--   * both tables contain ZERO rows, so no value can fail to convert.
--   * no consumer in server/src reads, sorts or does date arithmetic on these two columns.
-- Conversion is therefore safe; attestation of a permanent divergence would be the weaker answer.
--
-- Guarded and idempotent: converts only when the column is still TEXT, so it is a no-op on a
-- fresh database (already TIMESTAMPTZ) and on a second run. USING makes the cast explicit rather
-- than relying on an implicit one, which Postgres does not provide for text -> timestamptz.
DO $repair_d$
DECLARE
  tbl  text;
  col  text;
  curr text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['project_steering_board', 'project_steering_board_members'] LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE; -- table absent (e.g. partial environment): nothing to converge
    END IF;
    FOREACH col IN ARRAY ARRAY['created_at', 'updated_at'] LOOP
      SELECT data_type INTO curr
        FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = tbl AND column_name = col;

      IF curr IS NULL THEN
        CONTINUE; -- column absent
      ELSIF curr = 'text' THEN
        EXECUTE format(
          'ALTER TABLE public.%I ALTER COLUMN %I TYPE TIMESTAMPTZ USING NULLIF(%I, '''')::timestamptz',
          tbl, col, col
        );
        EXECUTE format(
          'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT CURRENT_TIMESTAMP', tbl, col
        );
      ELSIF curr LIKE 'timestamp%' THEN
        NULL; -- already canonical
      ELSE
        RAISE EXCEPTION
          'repair_d: %.% has unsupported type % — refusing to convert (fail closed)', tbl, col, curr;
      END IF;
    END LOOP;
  END LOOP;
END
$repair_d$;
