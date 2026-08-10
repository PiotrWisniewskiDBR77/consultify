-- ROI-E004 — Forecast & Actual.
--
-- Design: docs/product/results-vnext/ROI_E004_DESIGN.md §3.
--
-- Five new tables: rvn_roi_forecast_versions (immutable, AC-01),
-- rvn_roi_actual_entries (append-only, AC-02/AC-06), rvn_roi_actual_snapshots
-- (immutable rollup, fills current_actual_snapshot_id — D8/D17),
-- rvn_roi_variances/rvn_roi_variance_causes (stored, AC-05). Closes both of
-- ROI-E001's reserved pointer columns on rvn_roi_cases at the end, same
-- pattern ROI-E003 already used for its own three FKs onto E001-reserved
-- columns.

-- ============================================================
-- rvn_roi_forecast_versions — immutable, AC-01
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_forecast_versions (
  forecast_version_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                       UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id               TEXT NOT NULL,

  sequence_number                INT NOT NULL,
  reason                         TEXT NOT NULL,
  published_by                   TEXT NOT NULL,
  published_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- AC-01: explicit pin of what this forecast is measured against — never
  -- re-derived implicitly at read time.
  compared_against_snapshot_id   UUID NOT NULL REFERENCES rvn_roi_approval_snapshots(snapshot_id),

  engine_version                  TEXT NOT NULL,
  policy_version_stamp            TEXT NOT NULL,
  input_overrides                 JSONB NOT NULL DEFAULT '[]',
  input_snapshot                  JSONB NOT NULL,
  input_hash                      TEXT NOT NULL,

  status                          TEXT NOT NULL CHECK (status IN ('completed','failed')),
  total_costs                      NUMERIC NULL,
  total_financial_benefits         NUMERIC NULL,
  simple_roi                       NUMERIC NULL,
  npv                              NUMERIC NULL,
  irr_pct                          NUMERIC NULL,
  irr_status                       TEXT NOT NULL DEFAULT 'not_applicable'
                                      CHECK (irr_status IN ('computed','not_applicable','no_sign_change','not_required_by_policy')),
  payback_periods                   NUMERIC NULL,
  discounted_payback_periods        NUMERIC NULL,
  benefit_cost_ratio                NUMERIC NULL,
  period_series                     JSONB NOT NULL,
  has_unresolved_double_counting     BOOLEAN NOT NULL DEFAULT false,
  has_mixed_currency_failure         BOOLEAN NOT NULL DEFAULT false,
  validation_findings                JSONB NOT NULL DEFAULT '[]',
  warnings                           JSONB NOT NULL DEFAULT '[]',

  created_at                         TIMESTAMPTZ NOT NULL DEFAULT now()
  -- immutable by construction — same shape as rvn_roi_calculation_runs.
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_forecast_versions_case_seq
  ON rvn_roi_forecast_versions(case_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_forecast_versions_case
  ON rvn_roi_forecast_versions(organization_id, case_id, sequence_number DESC);

-- ============================================================
-- rvn_roi_actual_entries — append-only, AC-02/AC-06
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_actual_entries (
  actual_entry_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                       UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id               TEXT NOT NULL,

  entry_type                     TEXT NOT NULL CHECK (entry_type IN ('cost','benefit','observation')),
  cost_line_id                    UUID NULL REFERENCES rvn_roi_cost_lines(cost_line_id),
  benefit_line_id                  UUID NULL REFERENCES rvn_roi_benefit_lines(benefit_line_id),

  period_start                      DATE NOT NULL,
  period_end                        DATE NOT NULL,

  amount                             NUMERIC NULL,
  currency                           TEXT NULL,

  data_quality_status                 TEXT NOT NULL DEFAULT 'unverified'
                                         CHECK (data_quality_status IN ('unverified','verified','disputed','estimated')),

  correction_of_actual_entry_id         UUID NULL REFERENCES rvn_roi_actual_entries(actual_entry_id),
  correction_reason                      TEXT NULL,

  source                                  TEXT NOT NULL,
  evidence_refs                            JSONB NOT NULL DEFAULT '[]',
  notes                                    TEXT NULL,

  recorded_by                               TEXT NOT NULL,
  recorded_at                               TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- D10: verification must not be by the entry's own original recorder.
  verified_by                                TEXT NULL,
  verified_at                                TIMESTAMPTZ NULL,

  CONSTRAINT chk_rvn_roi_actual_entries_line_ref CHECK (
    (entry_type = 'cost'        AND cost_line_id IS NOT NULL AND benefit_line_id IS NULL) OR
    (entry_type = 'benefit'     AND benefit_line_id IS NOT NULL AND cost_line_id IS NULL) OR
    (entry_type = 'observation' AND cost_line_id IS NULL AND benefit_line_id IS NULL)
  ),
  CONSTRAINT chk_rvn_roi_actual_entries_currency CHECK (amount IS NULL OR currency IS NOT NULL)
);

-- Postgres NULL <> NULL: a unique index directly on two nullable FK columns
-- would not catch duplicates where both are NULL — collapse to one
-- deterministic key first via a generated column.
ALTER TABLE rvn_roi_actual_entries
  ADD COLUMN IF NOT EXISTS line_key TEXT GENERATED ALWAYS AS (
    COALESCE(cost_line_id::text, benefit_line_id::text, 'case_level')
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_actual_entries_period
  ON rvn_roi_actual_entries(case_id, line_key, period_start, period_end)
  WHERE correction_of_actual_entry_id IS NULL AND entry_type IN ('cost','benefit');

CREATE INDEX IF NOT EXISTS idx_rvn_roi_actual_entries_case
  ON rvn_roi_actual_entries(organization_id, case_id, period_start);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_actual_entries_correction_of
  ON rvn_roi_actual_entries(correction_of_actual_entry_id) WHERE correction_of_actual_entry_id IS NOT NULL;

-- Same limitation documented elsewhere in this program (rvn_kpi_measurements,
-- rvn_platform_events): REVOKE from PUBLIC does not stop an owner/superuser
-- connection — no named least-privilege application role exists yet.
REVOKE UPDATE, DELETE ON rvn_roi_actual_entries FROM PUBLIC;

-- ============================================================
-- rvn_roi_actual_snapshots — immutable rollup, fills current_actual_snapshot_id (D8/D17)
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_actual_snapshots (
  actual_snapshot_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                         UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                 TEXT NOT NULL,

  sequence_number                  INT NOT NULL,
  as_of_period_end                  DATE NOT NULL,
  published_by                      TEXT NOT NULL,
  published_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  total_actual_costs                  NUMERIC NULL,
  total_actual_financial_benefits      NUMERIC NULL,
  actual_simple_roi                     NUMERIC NULL,
  actual_npv                             NUMERIC NULL,
  periods_with_actual_count               INT NOT NULL,
  periods_expected_count                  INT NOT NULL,
  coverage_pct                             NUMERIC NULL,
  unverified_entry_count                    INT NOT NULL,
  disputed_entry_count                      INT NOT NULL,
  entry_ids_included                         JSONB NOT NULL,

  created_at                                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_actual_snapshots_case_seq
  ON rvn_roi_actual_snapshots(case_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_actual_snapshots_case
  ON rvn_roi_actual_snapshots(organization_id, case_id, sequence_number DESC);

-- ============================================================
-- rvn_roi_variances / rvn_roi_variance_causes — stored, AC-05
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_variances (
  variance_id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                          UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                  TEXT NOT NULL,

  comparison_type                    TEXT NOT NULL
                                        CHECK (comparison_type IN ('approved_vs_forecast','approved_vs_actual','forecast_vs_actual')),
  metric                              TEXT NOT NULL,
  reference_approval_snapshot_id        UUID NULL REFERENCES rvn_roi_approval_snapshots(snapshot_id),
  reference_forecast_version_id          UUID NULL REFERENCES rvn_roi_forecast_versions(forecast_version_id),
  reference_actual_snapshot_id            UUID NULL REFERENCES rvn_roi_actual_snapshots(actual_snapshot_id),

  baseline_value                           NUMERIC NULL,
  comparison_value                          NUMERIC NULL,
  variance_amount                            NUMERIC NULL,
  variance_pct                                NUMERIC NULL,

  status                                      TEXT NOT NULL DEFAULT 'open'
                                                 CHECK (status IN ('open','explained','action_planned','resolved')),
  owner_user_id                                TEXT NULL,

  row_version                                  INT NOT NULL DEFAULT 1,
  created_by                                    TEXT NOT NULL,
  created_at                                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                                    TEXT NULL,
  updated_at                                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_variances_case
  ON rvn_roi_variances(organization_id, case_id, created_at DESC);

-- Unconditional fact-protection: the comparison facts are permanent history
-- the instant the row is created — no "unfrozen" state to gate on. Only
-- status/owner_user_id/row_version/updated_at may ever change.
CREATE OR REPLACE FUNCTION rvn_roi_variances_protect_facts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.comparison_type IS DISTINCT FROM OLD.comparison_type
     OR NEW.metric IS DISTINCT FROM OLD.metric
     OR NEW.reference_approval_snapshot_id IS DISTINCT FROM OLD.reference_approval_snapshot_id
     OR NEW.reference_forecast_version_id IS DISTINCT FROM OLD.reference_forecast_version_id
     OR NEW.reference_actual_snapshot_id IS DISTINCT FROM OLD.reference_actual_snapshot_id
     OR NEW.baseline_value IS DISTINCT FROM OLD.baseline_value
     OR NEW.comparison_value IS DISTINCT FROM OLD.comparison_value
     OR NEW.variance_amount IS DISTINCT FROM OLD.variance_amount
     OR NEW.variance_pct IS DISTINCT FROM OLD.variance_pct
     OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'rvn_roi_variances: variance % facts are immutable', OLD.variance_id USING ERRCODE = '23001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_rvn_roi_variances_protect_facts ON rvn_roi_variances;
CREATE TRIGGER trg_rvn_roi_variances_protect_facts
  BEFORE UPDATE ON rvn_roi_variances
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_variances_protect_facts();

CREATE TABLE IF NOT EXISTS rvn_roi_variance_causes (
  cause_id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variance_id                  UUID NOT NULL REFERENCES rvn_roi_variances(variance_id),
  organization_id               TEXT NOT NULL,

  cause_category                  TEXT NOT NULL,
  contribution_pct                 NUMERIC NULL,
  narrative                         TEXT NOT NULL,

  created_by                         TEXT NOT NULL,
  created_at                         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_variance_causes_variance ON rvn_roi_variance_causes(variance_id);

-- ============================================================
-- Close out ROI-E001's two reservations. Wrapped in the same
-- IF NOT EXISTS (pg_constraint) idempotency guard ROI-E003's migration
-- already established for its own three FKs onto E001-reserved columns —
-- `ADD CONSTRAINT` has no native `IF NOT EXISTS` clause, and the migration
-- runner's `--safe` mode may re-run this file.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_rvn_roi_cases_current_forecast_version'
  ) THEN
    ALTER TABLE rvn_roi_cases
      ADD CONSTRAINT fk_rvn_roi_cases_current_forecast_version
        FOREIGN KEY (current_forecast_version_id) REFERENCES rvn_roi_forecast_versions(forecast_version_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_rvn_roi_cases_current_actual_snapshot'
  ) THEN
    ALTER TABLE rvn_roi_cases
      ADD CONSTRAINT fk_rvn_roi_cases_current_actual_snapshot
        FOREIGN KEY (current_actual_snapshot_id) REFERENCES rvn_roi_actual_snapshots(actual_snapshot_id);
  END IF;
END $$;
