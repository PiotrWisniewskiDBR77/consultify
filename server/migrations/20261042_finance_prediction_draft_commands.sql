BEGIN;

-- Fail closed before any DDL when a late/hostile partial shape already owns
-- one of this migration's identities. Canonical repeats are handled by the
-- migration ledger; an unledgered occupied identity is never overwritten.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (
         (table_name = 'finance_prediction_scenarios' AND column_name IN (
           'draft_version', 'source_baseline_version_id',
           'source_baseline_context_version', 'source_baseline_context_hash'
         ))
         OR (table_name = 'finance_prediction_driver_overrides' AND column_name = 'canonical_line_id')
       )
  ) OR to_regclass('public.finance_prediction_draft_command_receipts') IS NOT NULL
    OR to_regprocedure('public.finance_prediction_draft_receipt_immutable()') IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conname IN (
         'chk_finance_prediction_source_context_shape',
         'fk_finance_prediction_source_baseline_org',
         'uq_finance_prediction_scenario_bv_org',
         'fk_finance_prediction_draft_receipt_scenario'
       )
    )
    OR EXISTS (
      SELECT 1 FROM pg_trigger
       WHERE tgname = 'trg_finance_prediction_draft_receipt_immutable' AND NOT tgisinternal
    )
  THEN
    RAISE EXCEPTION '20261042 hostile or partial schema identity already exists';
  END IF;
END;
$$;

ALTER TABLE finance_prediction_scenarios
  ADD COLUMN draft_version INTEGER NOT NULL DEFAULT 1 CHECK (draft_version > 0),
  ADD COLUMN source_baseline_version_id TEXT,
  ADD COLUMN source_baseline_context_version INTEGER,
  ADD COLUMN source_baseline_context_hash TEXT,
  ADD CONSTRAINT chk_finance_prediction_source_context_shape CHECK (
    (source_baseline_version_id IS NULL
      AND source_baseline_context_version IS NULL
      AND source_baseline_context_hash IS NULL)
    OR
    (source_baseline_version_id IS NOT NULL
      AND source_baseline_context_version IS NOT NULL
      AND source_baseline_context_version > 0
      AND source_baseline_context_hash ~ '^[a-f0-9]{64}$')
  ),
  ADD CONSTRAINT fk_finance_prediction_source_baseline_org
    FOREIGN KEY (source_baseline_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),
  ADD CONSTRAINT uq_finance_prediction_scenario_bv_org
    UNIQUE (business_version_id, organization_id);

ALTER TABLE finance_prediction_driver_overrides
  ADD COLUMN canonical_line_id TEXT REFERENCES financial_statement_lines(id);

-- Compatibility backfill is intentionally limited to schedules with one
-- unambiguous canonical target. Ambiguous historical rows remain NULL and the
-- canonical reader reports PREDICTION_DRAFT_NOT_READY instead of guessing.
UPDATE finance_prediction_driver_overrides o
   SET canonical_line_id = unique_map.canonical_line_id
  FROM (
    SELECT schedule_type, min(canonical_line_id) AS canonical_line_id
      FROM finance_prediction_driver_line_map
     GROUP BY schedule_type
    HAVING count(*) = 1
  ) unique_map,
  finance_prediction_scenarios scenario,
  finance_business_versions version
 WHERE unique_map.schedule_type = o.schedule_type
   AND scenario.organization_id = o.organization_id
   AND scenario.business_version_id = o.business_version_id
   AND version.organization_id = scenario.organization_id
   AND version.business_version_id = scenario.business_version_id
   AND version.status = 'DRAFT'
   AND o.canonical_line_id IS NULL;

CREATE TABLE finance_prediction_draft_command_receipts (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  business_version_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) > 0),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  response_json JSONB NOT NULL,
  applied_version INTEGER NOT NULL CHECK (applied_version > 0),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, business_version_id, idempotency_key),
  CONSTRAINT fk_finance_prediction_draft_receipt_scenario
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_prediction_scenarios (business_version_id, organization_id)
);

CREATE FUNCTION finance_prediction_draft_receipt_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is immutable', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trg_finance_prediction_draft_receipt_immutable
  BEFORE UPDATE OR DELETE ON finance_prediction_draft_command_receipts
  FOR EACH ROW EXECUTE FUNCTION finance_prediction_draft_receipt_immutable();

COMMIT;
