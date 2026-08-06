-- P17-C: Add 'cancelled' as a terminal run_status for ArtifactRun.
-- PostgreSQL-safe, data-preserving constraint replacement.

DO $$
DECLARE
  existing_constraint RECORD;
BEGIN
  IF to_regclass('public.v8_artifact_runs') IS NULL THEN
    RETURN;
  END IF;

  FOR existing_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.v8_artifact_runs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%run_status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.v8_artifact_runs DROP CONSTRAINT %I',
      existing_constraint.conname
    );
  END LOOP;

  ALTER TABLE public.v8_artifact_runs
    ADD CONSTRAINT v8_artifact_runs_run_status_check
    CHECK (run_status IN (
      'planned',
      'proposal_created',
      'retry_requested',
      'completed',
      'failed',
      'cancelled'
    ));
END $$;
