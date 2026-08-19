-- FIN-CANONICAL-SUCCESSORS-WAVE4
-- Typed extensions to the existing canonical valuation aggregate. No legacy
-- payload shadow table: every supported field has an explicit domain column.

CREATE TABLE IF NOT EXISTS finance_valuation_direct_assumptions (
  organization_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  business_version_id TEXT NOT NULL,
  source_working_revision_id TEXT NOT NULL,
  source_working_revision_version INTEGER NOT NULL,
  direct_wacc_pct NUMERIC NOT NULL CHECK (direct_wacc_pct > 0),
  currency TEXT NOT NULL,
  terminal_method TEXT NOT NULL CHECK (terminal_method IN ('gordon','exit_multiple')),
  terminal_growth_pct NUMERIC,
  exit_multiple NUMERIC,
  exit_multiple_metric TEXT,
  net_debt_decimal NUMERIC NOT NULL,
  cash_tax_rate_pct NUMERIC NOT NULL CHECK (cash_tax_rate_pct BETWEEN 0 AND 100),
  valuation_as_of_date DATE NOT NULL,
  command_idempotency_key TEXT NOT NULL,
  command_request_sha256 TEXT NOT NULL CHECK (command_request_sha256 ~ '^[0-9a-f]{64}$'),
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,business_version_id),
  FOREIGN KEY (artifact_id,organization_id) REFERENCES finance_artifacts(artifact_id,organization_id),
  FOREIGN KEY (source_working_revision_id,organization_id) REFERENCES finance_working_revisions(working_revision_id,organization_id),
  CHECK ((terminal_method='gordon' AND terminal_growth_pct IS NOT NULL AND exit_multiple IS NULL)
      OR (terminal_method='exit_multiple' AND exit_multiple IS NOT NULL AND terminal_growth_pct IS NULL))
);

ALTER TABLE finance_valuation_direct_assumptions
  ADD COLUMN IF NOT EXISTS cash_tax_rate_pct NUMERIC CHECK (cash_tax_rate_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS valuation_as_of_date DATE;
ALTER TABLE finance_valuation_direct_assumptions
  ALTER COLUMN cash_tax_rate_pct SET NOT NULL,
  ALTER COLUMN valuation_as_of_date SET NOT NULL;

ALTER TABLE finance_valuation_methods
  ADD COLUMN IF NOT EXISTS comps_metric_type TEXT,
  ADD COLUMN IF NOT EXISTS comps_min_multiple NUMERIC,
  ADD COLUMN IF NOT EXISTS comps_median_multiple NUMERIC,
  ADD COLUMN IF NOT EXISTS comps_max_multiple NUMERIC,
  ADD COLUMN IF NOT EXISTS source_working_revision_id TEXT REFERENCES finance_working_revisions(working_revision_id),
  ADD COLUMN IF NOT EXISTS source_working_revision_version INTEGER,
  ADD COLUMN IF NOT EXISTS command_idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS command_request_sha256 TEXT;
ALTER TABLE finance_valuation_methods DROP CONSTRAINT IF EXISTS finance_valuation_methods_comps_metric_check;
ALTER TABLE finance_valuation_methods ADD CONSTRAINT finance_valuation_methods_comps_metric_check
  CHECK (comps_metric_type IS NULL OR comps_metric_type='EV/EBITDA');

ALTER TABLE finance_valuation_terminal
  ADD COLUMN IF NOT EXISTS source_working_revision_id TEXT REFERENCES finance_working_revisions(working_revision_id),
  ADD COLUMN IF NOT EXISTS source_working_revision_version INTEGER;

ALTER TABLE finance_valuation_ev_equity_bridge
  ADD COLUMN IF NOT EXISTS source_working_revision_id TEXT REFERENCES finance_working_revisions(working_revision_id),
  ADD COLUMN IF NOT EXISTS source_working_revision_version INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_valuation_comps_method_peer
  ON finance_valuation_comps(method_id, peer_name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_valuation_methods_bv_type
  ON finance_valuation_methods(organization_id,business_version_id,method_type);

CREATE TABLE IF NOT EXISTS finance_valuation_input_command_events (
  event_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  input_kind TEXT NOT NULL CHECK (input_kind IN ('WACC_ASSUMPTIONS','TRADING_COMPS')),
  request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
  artifact_id TEXT NOT NULL,
  business_version_id TEXT NOT NULL,
  working_revision_id TEXT NOT NULL,
  working_revision_version INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_compute_jobs_id_org ON compute_jobs(id,organization_id);

CREATE TABLE IF NOT EXISTS finance_valuation_compute_command_receipts (
  organization_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_sha256 TEXT NOT NULL CHECK(request_sha256 ~ '^[0-9a-f]{64}$'),
  business_version_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  enterprise_value_decimal NUMERIC NOT NULL,
  equity_value_decimal NUMERIC,
  terminal_value_decimal NUMERIC NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,idempotency_key),
  FOREIGN KEY(business_version_id,organization_id) REFERENCES finance_business_versions(business_version_id,organization_id),
  FOREIGN KEY(job_id,organization_id) REFERENCES compute_jobs(id,organization_id)
);

CREATE OR REPLACE FUNCTION finance_valuation_command_ledger_immutable() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'finance valuation command ledger is append-only'; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_finance_valuation_input_events_immutable ON finance_valuation_input_command_events;
CREATE TRIGGER trg_finance_valuation_input_events_immutable BEFORE UPDATE OR DELETE ON finance_valuation_input_command_events FOR EACH ROW EXECUTE FUNCTION finance_valuation_command_ledger_immutable();
DROP TRIGGER IF EXISTS trg_finance_valuation_compute_receipts_immutable ON finance_valuation_compute_command_receipts;
CREATE TRIGGER trg_finance_valuation_compute_receipts_immutable BEFORE UPDATE OR DELETE ON finance_valuation_compute_command_receipts FOR EACH ROW EXECUTE FUNCTION finance_valuation_command_ledger_immutable();
