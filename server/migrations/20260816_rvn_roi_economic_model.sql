-- ROI-E002 — Economic Model — core schema.
--
-- Design: docs/product/results-vnext/ROI_E002_DESIGN.md §3 (FROZEN, full DDL
-- copied verbatim from that document — do not hand-modify without updating
-- the design doc first). Builds on ROI-E001's rvn_roi_cases (server/migrations/
-- 20260815_rvn_roi_core.sql) — zero ALTER TABLE on rvn_roi_cases/rvn_roi_baselines,
-- every new table here is a sibling FK'd to rvn_roi_cases(case_id) (design §0).
--
-- Visibility (Decision D15): every new table inherits visibility via case_id
-- only, no new resource_type — same pattern rvn_roi_baselines already uses.
--
-- Freeze protection (Decision D7): every mutable table below (all except
-- rvn_roi_calculation_runs, immutable by construction) gets a BEFORE UPDATE
-- trigger blocking mutation of its content columns once frozen_at is set,
-- same shape as rvn_roi_baselines_protect_frozen. Bookkeeping columns
-- (row_version/updated_at) remain legal to touch post-freeze.
--
-- rvn_roi_benefit_evidence_links (AC-02) references rvn_kpi_definitions /
-- rvn_kpi_definition_versions (server/migrations/20260810_rvn_kpi_core.sql) —
-- a typed KPI relationship, never a loose kpi_id.

-- ============================================================
-- rvn_roi_calculation_policy — 1:1 shell, engine's scalar parameters
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_calculation_policy (
  policy_row_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID NOT NULL UNIQUE REFERENCES rvn_roi_cases(case_id),
  organization_id       TEXT NOT NULL,

  discount_rate_pct     NUMERIC NULL,     -- annual rate, see Decision D13
  tax_treatment         TEXT NULL CHECK (tax_treatment IN ('pre_tax','post_tax','not_modeled')),
  inflation_rate_pct    NUMERIC NULL,

  -- Decision D11: safe default, not left null — a computation knob, not a
  -- business fact.
  rounding_policy       TEXT NOT NULL DEFAULT 'half_up_2dp'
                           CHECK (rounding_policy IN ('half_up_2dp','half_even_2dp','none')),

  -- Which headline metrics this Case's policy requires. NULL/empty array =
  -- engine computes all of roi/npv/payback/discounted_payback/bcr by
  -- default; IRR only computed if 'irr' is listed (plan: "IRR is optional
  -- and policy-controlled").
  required_metrics      TEXT[] NULL,

  notes                 TEXT NULL,
  confidence             TEXT NULL CHECK (confidence IN ('low','medium','high')),
  owner_user_id           TEXT NULL,

  frozen_at              TIMESTAMPTZ NULL,
  frozen_by              TEXT NULL,

  row_version             INT NOT NULL DEFAULT 1,
  created_by              TEXT NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_calc_policy_org ON rvn_roi_calculation_policy(organization_id, case_id);

CREATE OR REPLACE FUNCTION rvn_roi_calculation_policy_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.frozen_at IS NOT NULL THEN
    IF NEW.discount_rate_pct IS DISTINCT FROM OLD.discount_rate_pct
       OR NEW.tax_treatment IS DISTINCT FROM OLD.tax_treatment
       OR NEW.inflation_rate_pct IS DISTINCT FROM OLD.inflation_rate_pct
       OR NEW.rounding_policy IS DISTINCT FROM OLD.rounding_policy
       OR NEW.required_metrics IS DISTINCT FROM OLD.required_metrics
    THEN
      RAISE EXCEPTION 'rvn_roi_calculation_policy: policy % is frozen', OLD.policy_row_id USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_rvn_roi_calc_policy_protect_frozen ON rvn_roi_calculation_policy;
CREATE TRIGGER trg_rvn_roi_calc_policy_protect_frozen
  BEFORE UPDATE ON rvn_roi_calculation_policy
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_calculation_policy_protect_frozen();

-- ============================================================
-- rvn_roi_assumptions — material assumption list (AC-01)
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_assumptions (
  assumption_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id    TEXT NOT NULL,

  category           TEXT NOT NULL,
  label              TEXT NOT NULL,
  unit               TEXT NULL,

  base_value         NUMERIC NULL,
  downside_value     NUMERIC NULL,
  upside_value       NUMERIC NULL,

  confidence         TEXT NULL CHECK (confidence IN ('low','medium','high')),
  evidence_ref       TEXT NULL,
  source             TEXT NULL,
  owner_user_id      TEXT NULL,
  sensitivity_rank   INT NULL,
  notes              TEXT NULL,

  deleted_at         TIMESTAMPTZ NULL,
  deleted_by         TEXT NULL,
  frozen_at          TIMESTAMPTZ NULL,
  frozen_by          TEXT NULL,

  row_version        INT NOT NULL DEFAULT 1,
  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_assumptions_case ON rvn_roi_assumptions(organization_id, case_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION rvn_roi_assumptions_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.frozen_at IS NOT NULL THEN
    IF NEW.base_value IS DISTINCT FROM OLD.base_value
       OR NEW.downside_value IS DISTINCT FROM OLD.downside_value
       OR NEW.upside_value IS DISTINCT FROM OLD.upside_value
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.label IS DISTINCT FROM OLD.label
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    THEN
      RAISE EXCEPTION 'rvn_roi_assumptions: assumption % is frozen', OLD.assumption_id USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_rvn_roi_assumptions_protect_frozen ON rvn_roi_assumptions;
CREATE TRIGGER trg_rvn_roi_assumptions_protect_frozen
  BEFORE UPDATE ON rvn_roi_assumptions
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_assumptions_protect_frozen();

-- ============================================================
-- rvn_roi_cost_lines
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_cost_lines (
  cost_line_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                 UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id         TEXT NOT NULL,

  category                TEXT NOT NULL,
  label                   TEXT NOT NULL,
  description             TEXT NULL,

  amount                  NUMERIC NOT NULL,
  currency                TEXT NOT NULL,

  timing_type             TEXT NOT NULL CHECK (timing_type IN ('one_time','recurring')),
  one_time_period_date    DATE NULL,
  recurrence_start_date   DATE NULL,
  recurrence_end_date     DATE NULL,
  recurrence_cadence      TEXT NULL CHECK (recurrence_cadence IN ('monthly','quarterly','annual')),

  confidence              TEXT NULL CHECK (confidence IN ('low','medium','high')),
  source                  TEXT NULL,
  owner_user_id           TEXT NULL,

  deleted_at              TIMESTAMPTZ NULL,
  deleted_by              TEXT NULL,
  frozen_at               TIMESTAMPTZ NULL,
  frozen_by               TEXT NULL,

  row_version              INT NOT NULL DEFAULT 1,
  created_by               TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_cost_lines_case ON rvn_roi_cost_lines(organization_id, case_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION rvn_roi_cost_lines_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.frozen_at IS NOT NULL THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.timing_type IS DISTINCT FROM OLD.timing_type
       OR NEW.one_time_period_date IS DISTINCT FROM OLD.one_time_period_date
       OR NEW.recurrence_start_date IS DISTINCT FROM OLD.recurrence_start_date
       OR NEW.recurrence_end_date IS DISTINCT FROM OLD.recurrence_end_date
       OR NEW.recurrence_cadence IS DISTINCT FROM OLD.recurrence_cadence
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    THEN
      RAISE EXCEPTION 'rvn_roi_cost_lines: cost line % is frozen', OLD.cost_line_id USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_rvn_roi_cost_lines_protect_frozen ON rvn_roi_cost_lines;
CREATE TRIGGER trg_rvn_roi_cost_lines_protect_frozen
  BEFORE UPDATE ON rvn_roi_cost_lines
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_cost_lines_protect_frozen();

-- ============================================================
-- rvn_roi_benefit_lines
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_benefit_lines (
  benefit_line_id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                            UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                    TEXT NOT NULL,

  category                           TEXT NOT NULL,
  label                              TEXT NOT NULL,
  description                        TEXT NULL,

  is_financial                       BOOLEAN NOT NULL DEFAULT true,
  amount                             NUMERIC NULL,
  currency                           TEXT NULL,

  timing_type                        TEXT NOT NULL CHECK (timing_type IN ('one_time','recurring')),
  one_time_period_date               DATE NULL,
  recurrence_start_date              DATE NULL,
  recurrence_end_date                DATE NULL,
  recurrence_cadence                 TEXT NULL CHECK (recurrence_cadence IN ('monthly','quarterly','annual')),
  ramp_periods                       INT NULL,

  double_counting_group              TEXT NULL,
  double_counting_resolution_note    TEXT NULL,

  confidence                         TEXT NULL CHECK (confidence IN ('low','medium','high')),
  source                             TEXT NULL,
  owner_user_id                      TEXT NULL,

  deleted_at                         TIMESTAMPTZ NULL,
  deleted_by                         TEXT NULL,
  frozen_at                          TIMESTAMPTZ NULL,
  frozen_by                          TEXT NULL,

  row_version                        INT NOT NULL DEFAULT 1,
  created_by                         TEXT NOT NULL,
  created_at                         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                         TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- is_financial=false rows must never carry an amount (honest N/A, not a
  -- fabricated $0) — DB-enforced, not just command-layer.
  CONSTRAINT chk_rvn_roi_benefit_lines_financial_amount
    CHECK (NOT (is_financial = false AND amount IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_benefit_lines_case ON rvn_roi_benefit_lines(organization_id, case_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rvn_roi_benefit_lines_dcgroup ON rvn_roi_benefit_lines(case_id, double_counting_group) WHERE deleted_at IS NULL AND double_counting_group IS NOT NULL;

CREATE OR REPLACE FUNCTION rvn_roi_benefit_lines_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.frozen_at IS NOT NULL THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.is_financial IS DISTINCT FROM OLD.is_financial
       OR NEW.timing_type IS DISTINCT FROM OLD.timing_type
       OR NEW.one_time_period_date IS DISTINCT FROM OLD.one_time_period_date
       OR NEW.recurrence_start_date IS DISTINCT FROM OLD.recurrence_start_date
       OR NEW.recurrence_end_date IS DISTINCT FROM OLD.recurrence_end_date
       OR NEW.recurrence_cadence IS DISTINCT FROM OLD.recurrence_cadence
       OR NEW.ramp_periods IS DISTINCT FROM OLD.ramp_periods
       OR NEW.double_counting_group IS DISTINCT FROM OLD.double_counting_group
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    THEN
      RAISE EXCEPTION 'rvn_roi_benefit_lines: benefit line % is frozen', OLD.benefit_line_id USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_rvn_roi_benefit_lines_protect_frozen ON rvn_roi_benefit_lines;
CREATE TRIGGER trg_rvn_roi_benefit_lines_protect_frozen
  BEFORE UPDATE ON rvn_roi_benefit_lines
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_benefit_lines_protect_frozen();

-- Note: double_counting_resolution_note is intentionally NOT in the frozen
-- guard's protected-field list — resolving a double-counting group after
-- freeze (during a later reapproval cycle) must remain possible; only the
-- financial facts (amount/currency/timing) are locked.

-- ============================================================
-- rvn_roi_benefit_evidence_links — typed, not a loose kpi_id (AC-02)
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_benefit_evidence_links (
  link_id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  benefit_line_id                     UUID NOT NULL REFERENCES rvn_roi_benefit_lines(benefit_line_id),
  case_id                             UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                     TEXT NOT NULL,

  kpi_id                              UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id),
  pinned_kpi_definition_version_id    UUID NOT NULL REFERENCES rvn_kpi_definition_versions(definition_version_id),

  expected_unit                       TEXT NULL,
  purpose                             TEXT NOT NULL CHECK (purpose IN ('primary_evidence','supporting')),

  linked_by                           TEXT NOT NULL,
  linked_at                           TIMESTAMPTZ NOT NULL DEFAULT now(),
  freshness_checked_at                TIMESTAMPTZ NULL,
  dispute_status                      TEXT NOT NULL DEFAULT 'none' CHECK (dispute_status IN ('none','stale','disputed')),
  notes                               TEXT NULL,

  row_version                         INT NOT NULL DEFAULT 1,
  created_by                          TEXT NOT NULL,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_bel_case ON rvn_roi_benefit_evidence_links(organization_id, case_id);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_bel_benefit_line ON rvn_roi_benefit_evidence_links(benefit_line_id);

-- ============================================================
-- rvn_roi_scenarios / rvn_roi_scenario_overrides (AC-04)
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_scenarios (
  scenario_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id    TEXT NOT NULL,

  -- No 'base' row — base is implicit (scenario_id = NULL on a run means
  -- "use each line's own base value directly"). Decision D10.
  scenario_type      TEXT NOT NULL CHECK (scenario_type IN ('downside','upside','custom')),
  label              TEXT NOT NULL,
  description        TEXT NULL,

  deleted_at         TIMESTAMPTZ NULL,
  deleted_by         TEXT NULL,
  frozen_at          TIMESTAMPTZ NULL,
  frozen_by          TEXT NULL,

  row_version        INT NOT NULL DEFAULT 1,
  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_scenarios_case ON rvn_roi_scenarios(organization_id, case_id) WHERE deleted_at IS NULL;

-- -- DEVIATION FROM DESIGN (real Postgres gap, caught by
-- roiEconomicModelFreeze.realdb.test.ts's first run, not by tsc or by
-- reading the code): the design doc's §3 migration header comment states
-- "every mutable table below ... gets a BEFORE UPDATE trigger", and
-- freezeRoiEconomicModel (roiEconomicModelFreeze.ts) freezes
-- rvn_roi_scenarios' frozen_at/frozen_by columns exactly like the other
-- four tables — but the design doc's own literal §3 DDL block never
-- actually included a rvn_roi_scenarios_protect_frozen trigger (only
-- calculation_policy/assumptions/cost_lines/benefit_lines got one). Without
-- this trigger, a raw UPDATE on a frozen scenario's scenario_type/label/
-- description/deleted_at would silently succeed — the DB-enforced half of
-- the freeze guarantee every other table has. Added here to match the
-- design's own stated intent (and the identical shape every other table's
-- trigger already uses), not a new design decision.
CREATE OR REPLACE FUNCTION rvn_roi_scenarios_protect_frozen()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.frozen_at IS NOT NULL THEN
    IF NEW.scenario_type IS DISTINCT FROM OLD.scenario_type
       OR NEW.label IS DISTINCT FROM OLD.label
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    THEN
      RAISE EXCEPTION 'rvn_roi_scenarios: scenario % is frozen', OLD.scenario_id USING ERRCODE = '23001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_rvn_roi_scenarios_protect_frozen ON rvn_roi_scenarios;
CREATE TRIGGER trg_rvn_roi_scenarios_protect_frozen
  BEFORE UPDATE ON rvn_roi_scenarios
  FOR EACH ROW EXECUTE FUNCTION rvn_roi_scenarios_protect_frozen();

CREATE TABLE IF NOT EXISTS rvn_roi_scenario_overrides (
  override_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id        UUID NOT NULL REFERENCES rvn_roi_scenarios(scenario_id),
  organization_id    TEXT NOT NULL,

  target_type        TEXT NOT NULL CHECK (target_type IN ('assumption','cost_line','benefit_line')),
  target_id          UUID NOT NULL,

  override_value     NUMERIC NULL,
  override_amount    NUMERIC NULL,
  note               TEXT NULL,

  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (scenario_id, target_type, target_id)
);

-- ============================================================
-- rvn_roi_calculation_runs — immutable (AC-06)
-- ============================================================
CREATE TABLE IF NOT EXISTS rvn_roi_calculation_runs (
  run_id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                           UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id                   TEXT NOT NULL,

  engine_version                    TEXT NOT NULL,
  policy_version_stamp              TEXT NOT NULL,
  scenario_id                       UUID NULL REFERENCES rvn_roi_scenarios(scenario_id),

  status                            TEXT NOT NULL CHECK (status IN ('completed','failed')),

  input_snapshot                    JSONB NOT NULL,
  input_hash                        TEXT NOT NULL,

  total_costs                       NUMERIC NULL,
  total_financial_benefits          NUMERIC NULL,
  simple_roi                        NUMERIC NULL,
  npv                               NUMERIC NULL,
  irr_pct                           NUMERIC NULL,
  irr_status                        TEXT NOT NULL DEFAULT 'not_applicable'
                                       CHECK (irr_status IN ('computed','not_applicable','no_sign_change','not_required_by_policy')),
  payback_periods                   NUMERIC NULL,
  discounted_payback_periods        NUMERIC NULL,
  benefit_cost_ratio                NUMERIC NULL,

  period_series                     JSONB NOT NULL,

  has_unresolved_double_counting    BOOLEAN NOT NULL DEFAULT false,
  has_mixed_currency_failure        BOOLEAN NOT NULL DEFAULT false,
  validation_findings                JSONB NOT NULL DEFAULT '[]',
  warnings                          JSONB NOT NULL DEFAULT '[]',

  initiated_by                      TEXT NOT NULL,
  started_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No row_version, no UPDATE path, no frozen_at, no trigger — immutable by
  -- construction, never mutated after INSERT.
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_calc_runs_case ON rvn_roi_calculation_runs(organization_id, case_id, created_at DESC);
