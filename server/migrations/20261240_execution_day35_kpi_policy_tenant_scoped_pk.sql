-- Day 35 D.1. policy_id TEXT PRIMARY KEY was global: the first organization to
-- author a policy would lock the name for every other tenant. Re-key to
-- (organization_id, policy_id). Safe only while the table is empty because it
-- has had no writer since day 17.
DO $$
DECLARE
  pk_name TEXT;
  pk_def TEXT;
  rows_present BIGINT;
BEGIN
  IF to_regclass('public.execution_control_kpi_policies') IS NULL THEN
    RAISE NOTICE 'execution_control_kpi_policies absent - nothing to re-key';
    RETURN;
  END IF;

  SELECT conname, pg_get_constraintdef(oid)
    INTO pk_name, pk_def
    FROM pg_constraint
   WHERE conrelid = 'public.execution_control_kpi_policies'::regclass
     AND contype = 'p';

  IF pk_def IS NOT NULL AND pk_def LIKE '%organization_id%' THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO rows_present FROM execution_control_kpi_policies;
  IF rows_present > 0 THEN
    RAISE EXCEPTION
      'execution_control_kpi_policies holds % row(s); re-keying needs an owner decision',
      rows_present;
  END IF;

  IF pk_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE execution_control_kpi_policies DROP CONSTRAINT %I',
      pk_name
    );
  END IF;

  ALTER TABLE execution_control_kpi_policies
    ADD CONSTRAINT execution_control_kpi_policies_pkey
    PRIMARY KEY (organization_id, policy_id);
END $$;
