-- ASM-003: retry-safe identity for Assessment initiative generation runs.
ALTER TABLE assessment_initiative_generation_runs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_generation_run_idempotency
  ON assessment_initiative_generation_runs(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
