-- Finance v3 — Gate D (WP-D09b): Enterprise Valuation domain schema, part 1/2 — tables.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D09_valuation_schema_ADR.md, sections
-- 4 (Case/Variant/lineage exclusivity), 6 (WACC), 7 (methods — flagship N/A!=zero + basket
-- weight=100 mechanism), 8 (terminal — Gordon/exit multiple + g<WACC), 9 (EV->Equity bridge —
-- as_of alignment), 10 (Sensitivity 5x5), 11 (comps — readiness gate), 12 (Advisor — freeze/
-- staleness/many-to-many compare/AI policy), Zalacznik A (literal, live-tested DDL for the
-- lineage exclusivity index + finance_valuation_methods + the weight-sum constraint trigger +
-- the two Advisor business_versions triggers — transcribed verbatim below where the ADR gives the
-- exact SQL; the remaining eight tables and their CHECKs are transcribed from the ADR's own
-- prose (sections 4/6/8/9/10/11/12), same "unikanie duplikowania" situation WP-D07b was already
-- in relative to WP-D07). Turns the accepted ADR into a real, additive migration — same
-- discipline WP-D01b/WP-D03b/WP-D05b/WP-D07b applied to their respective ADRs.
--
-- Depends on (already shipped, Gate B/C/D01/D03/D05/D07, untouched by this file):
--   finance_artifacts (artifact_type already includes 'VALUATION_CASE') (b01)
--   finance_business_versions, finance_value_status enum (b01)
--   finance_lineage_edges (edge_type already includes MODEL_TO_VALUATION/SCENARIO_TO_VALUATION,
--     both requiring assumption_snapshot_hash NOT NULL via chk_finance_lineage_assumption_hash) (b03)
--   finance_compute_snapshots (append-only freshness anchor for the Advisor) (b06)
--   organizations(id)
--
-- Additive only. Zero DROP/RENAME/ALTER ... TYPE on any existing table or column. The only change
-- to a pre-existing table is one new partial unique index on finance_lineage_edges (section 0
-- below) — no column, no CHECK, no existing row is touched, and the table's own append-only
-- deny-update/delete triggers (b03) are untouched (CREATE INDEX is DDL, not a row mutation, so
-- those triggers never fire for it). All twelve new tables use
-- TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, matching the live-schema convention
-- WP-C01/WP-D01b/WP-D03b/WP-D05b/WP-D07b already established.
--
-- Split into 2 files (not the usual 3): tables -> integrity controls. Unlike WP-D01/D03/D05/D07,
-- this work package ships no third "readiness" file — the ADR's own section 13 explicitly scopes
-- `finance_valuation_can_start_compute()` as "kontrakt, nie implementacja... zakres przyszlego WP",
-- the same documented boundary WP-D07's ADR section 6.2 drew for the two-stage Prediction Compute
-- gate before WP-D07b (which DID implement its own gate, because WP-D07's ADR asked for it). This
-- ADR asks for the opposite for Valuation: do not implement the gate yet. Filename suffix 01/02
-- pins the deterministic same-date filename sort order the migration runner
-- (server/scripts/migrate.postgres.ts) uses — file 2's triggers reference file 1's tables. No
-- filename contains the substring "seed"/"mock"/"demo"/a leading "add_" (WP-D03b found the
-- runner's isSqliteOnlyMigration() silently excludes such filenames, WP-D05b/D07b independently
-- re-confirmed the trap) — this work package ships zero seed data, so the exclusion does not
-- apply, but names were checked against that list anyway before being finalized.

BEGIN;

-- ============================================================================
-- 0. Lineage exclusivity — closes the WP-B03 gap the ADR section 4.3 documents: nothing today
--    stops ONE target version from having both a MODEL_TO_VALUATION and a SCENARIO_TO_VALUATION
--    edge pointing at it simultaneously. Same idiom as uq_finance_bv_one_approved (WP-B01) —
--    partial unique index enforcing "at most one row of a given shape" across sibling rows that
--    same-row CHECK cannot reach. Purely additive: no column, no CHECK on finance_lineage_edges
--    itself is touched.
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_lineage_edges_one_valuation_source
  ON finance_lineage_edges (target_version_id)
  WHERE edge_type IN ('MODEL_TO_VALUATION', 'SCENARIO_TO_VALUATION');

-- ============================================================================
-- 1. finance_valuation_cases — pure naming/grouping container (ADR section 4.1). Deliberately
--    NOT a finance_artifacts/finance_business_versions row: no lifecycle, no risk_tier, no
--    version chain. Variants (table 2) carry all of that; a Case is closer to a folder than a
--    file. "Approved Case" has no defined meaning while its variants can be in different states
--    simultaneously (DEC-FIN-006 does not resolve this, and does not need to).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_valuation_cases (
  case_id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id   TEXT NOT NULL REFERENCES organizations(id),
  name              TEXT NOT NULL,
  description       TEXT,
  created_by        TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at       TIMESTAMPTZ,
  archived_reason   TEXT
);

CREATE INDEX IF NOT EXISTS idx_finance_valuation_cases_org ON finance_valuation_cases(organization_id);

-- ============================================================================
-- 2. finance_valuation_variants — one row per business_version_id of a VALUATION_CASE artifact
--    (ADR section 4.2), many variants per Case. Same "one row per business_version_id, no source
--    column" pattern WP-D05's finance_baseline_models / WP-D07's finance_prediction_scenarios
--    already established — exact source lives exclusively in finance_lineage_edges
--    (MODEL_TO_VALUATION / SCENARIO_TO_VALUATION), never duplicated here. name/description are
--    domain-local for the same reason WP-D07 section 4.1 gives: finance_artifacts has no name
--    column, and Compare needs a human label per variant.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_valuation_variants (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id       TEXT NOT NULL,
  business_version_id   TEXT NOT NULL,
  case_id               TEXT NOT NULL REFERENCES finance_valuation_cases(case_id),
  name                  TEXT NOT NULL,
  description           TEXT,
  created_by            TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_valuation_variants_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT uq_finance_valuation_variants_bv UNIQUE (business_version_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_valuation_variants_case ON finance_valuation_variants(case_id);
CREATE INDEX IF NOT EXISTS idx_finance_valuation_variants_org ON finance_valuation_variants(organization_id);

-- ============================================================================
-- 3. finance_valuation_wacc_inputs — one bundle per variant (ADR section 6). Capital-structure
--    sums use a tolerance CHECK (DEC-FIN-009 source-rounding tolerance, +/-0.01pp), not exact
--    equality — inputs come from spreadsheets/peer sources that round.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_valuation_wacc_inputs (
  id                                        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id                           TEXT NOT NULL,
  business_version_id                       TEXT NOT NULL,

  risk_free_rate_pct                        NUMERIC,
  equity_risk_premium_pct                   NUMERIC,
  beta_peer_set_ref                         JSONB, -- pointer to finance_valuation_comps rows used for beta, not a copy
  beta_unlevered                            NUMERIC,
  beta_relevered                            NUMERIC,

  target_capital_structure_debt_pct         NUMERIC,
  target_capital_structure_equity_pct       NUMERIC,
  current_capital_structure_debt_pct        NUMERIC,
  current_capital_structure_equity_pct      NUMERIC,

  cost_of_debt_pretax_pct                   NUMERIC,
  credit_spread_pct                         NUMERIC,
  cash_tax_rate_pct                         NUMERIC,

  currency                                  TEXT NOT NULL,
  nominal_or_real                           TEXT NOT NULL CHECK (nominal_or_real IN ('NOMINAL', 'REAL')),
  pre_or_post_tax                           TEXT NOT NULL CHECK (pre_or_post_tax IN ('PRE_TAX', 'POST_TAX')),

  wacc_computed_pct                         NUMERIC, -- NULL until computed; no silent zero (ADR section 6)

  created_by                                TEXT NOT NULL,
  created_at                                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_valuation_wacc_inputs_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT uq_finance_valuation_wacc_inputs_bv UNIQUE (business_version_id),

  -- DEC-FIN-009 source-rounding tolerance (ADR section 6) — not exact 100.
  CONSTRAINT chk_finance_wacc_target_structure_sum CHECK (
    target_capital_structure_debt_pct IS NULL OR target_capital_structure_equity_pct IS NULL
    OR abs(target_capital_structure_debt_pct + target_capital_structure_equity_pct - 100) <= 0.01
  ),
  CONSTRAINT chk_finance_wacc_current_structure_sum CHECK (
    current_capital_structure_debt_pct IS NULL OR current_capital_structure_equity_pct IS NULL
    OR abs(current_capital_structure_debt_pct + current_capital_structure_equity_pct - 100) <= 0.01
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_valuation_wacc_inputs_org ON finance_valuation_wacc_inputs(organization_id);

-- ============================================================================
-- 4. finance_valuation_methods — flagship mechanism of this ADR (section 7): recommendation
--    basket (weighted, sums to 100 or 0 while empty/DRAFT) vs. unweighted cross-checks
--    (weight_pct physically NULL, never 0), N/A!=zero as a TWO-layer physical guarantee (Layer 1:
--    reused WP-B01 section 2.7 bundle; Layer 2: readiness<->result_value_status cross-check, new
--    in this ADR). Transcribed verbatim from the ADR's own Zalacznik A DDL block.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_valuation_methods (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id             TEXT NOT NULL,
  business_version_id         TEXT NOT NULL,
  method_type                 TEXT NOT NULL CHECK (method_type IN (
                                 'DCF_FCFF', 'DCF_FCFE', 'DIVIDEND_DISCOUNT', 'TRADING_COMPS',
                                 'PRECEDENT_TRANSACTIONS', 'ASSET_BASED', 'OTHER_WITH_POLICY'
                               )),
  readiness                   TEXT NOT NULL DEFAULT 'NOT_CONFIGURED'
                                 CHECK (readiness IN ('NOT_CONFIGURED','DATA_INCOMPLETE','READY','COMPUTE_FAILED')),
  result_value_status         finance_value_status NOT NULL DEFAULT 'MISSING',
  result_ev_decimal           NUMERIC,
  is_in_recommendation_basket BOOLEAN NOT NULL DEFAULT false,
  weight_pct                  NUMERIC,
  applicability_policy_ref    TEXT, -- required (below) when method_type = 'OTHER_WITH_POLICY'

  created_by                  TEXT NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_valuation_methods_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT uq_finance_valuation_methods_bv_type UNIQUE (business_version_id, method_type),

  -- Layer 2 of N/A!=zero (ADR section 7.2) — a method's readiness and its result status must agree.
  CONSTRAINT chk_finance_methods_result_matches_readiness CHECK (
    (readiness IN ('NOT_CONFIGURED','DATA_INCOMPLETE','COMPUTE_FAILED') AND result_value_status IN ('MISSING','NA','NOT_APPLICABLE'))
    OR (readiness = 'READY' AND result_value_status IN ('PRESENT_ZERO','PRESENT_NONZERO'))
  ),

  -- Cross-check rows never carry a weight (NULL, never 0) — ADR section 7.3.
  CONSTRAINT chk_finance_methods_weight_basket_only CHECK (
    (is_in_recommendation_basket = false AND weight_pct IS NULL)
    OR (is_in_recommendation_basket = true AND weight_pct IS NOT NULL)
  ),

  -- "Inne metody tylko z applicability policy" (ADR section 7.1 / handoff sec. 9), physical.
  CONSTRAINT chk_finance_methods_other_policy CHECK (
    method_type != 'OTHER_WITH_POLICY' OR applicability_policy_ref IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_valuation_methods_bv ON finance_valuation_methods(business_version_id);
CREATE INDEX IF NOT EXISTS idx_finance_valuation_methods_org ON finance_valuation_methods(organization_id);

-- ============================================================================
-- 5. finance_valuation_terminal — per method_id, not per variant (Trading Comps/Precedent
--    Transactions have no terminal value in this sense; ADR section 8). UNIQUE(method_id,
--    convention) allows exactly two rows per DCF method: one GORDON_GROWTH, one EXIT_MULTIPLE
--    cross-check. g<WACC is enforced by a trigger in file 2 (cross-table read to
--    finance_valuation_wacc_inputs, Postgres forbids subqueries in CHECK).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_valuation_terminal (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id          TEXT NOT NULL,
  method_id                TEXT NOT NULL REFERENCES finance_valuation_methods(id),
  convention               TEXT NOT NULL CHECK (convention IN ('GORDON_GROWTH', 'EXIT_MULTIPLE')),
  g_pct                    NUMERIC,
  exit_multiple_value      NUMERIC,
  reinvestment_rate_pct    NUMERIC, -- documents g = reinvestment_rate x ROIC rationale; not CHECK-enforced (ADR sec. 8)
  roic_pct                 NUMERIC,
  terminal_value_decimal   NUMERIC,
  terminal_share_pct       NUMERIC, -- terminal value's share of total EV, for the "high terminal share" flag
  is_primary               BOOLEAN NOT NULL DEFAULT false, -- which row feeds the method's headline result
  rationale                TEXT,

  created_by                TEXT NOT NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_valuation_terminal_method_convention UNIQUE (method_id, convention),

  -- XOR per convention (same idiom as WP-D07's driver_schedule_type+driver_code XOR kpi_catalog_id).
  CONSTRAINT chk_finance_terminal_convention_fields CHECK (
    (convention = 'GORDON_GROWTH' AND g_pct IS NOT NULL AND exit_multiple_value IS NULL)
    OR (convention = 'EXIT_MULTIPLE' AND exit_multiple_value IS NOT NULL AND g_pct IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_valuation_terminal_method ON finance_valuation_terminal(method_id);

-- ============================================================================
-- 6. finance_valuation_ev_equity_bridge (header) + finance_valuation_ev_equity_bridge_components
--    (child) — jawna sekwencja (ADR section 9). as_of alignment (component vs. header) is
--    enforced by a trigger in file 2 (cross-row, Postgres forbids subqueries in CHECK).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_valuation_ev_equity_bridge (
  id                        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id           TEXT NOT NULL,
  business_version_id       TEXT NOT NULL,
  as_of_date                DATE NOT NULL,
  enterprise_value_decimal  NUMERIC,
  equity_value_decimal      NUMERIC,

  created_by                TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_valuation_ev_bridge_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT uq_finance_valuation_ev_bridge_bv UNIQUE (business_version_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_valuation_ev_bridge_org ON finance_valuation_ev_equity_bridge(organization_id);

CREATE TABLE IF NOT EXISTS finance_valuation_ev_equity_bridge_components (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id   TEXT NOT NULL,
  bridge_id         TEXT NOT NULL REFERENCES finance_valuation_ev_equity_bridge(id),
  sequence_order    INTEGER NOT NULL,
  component_kind    TEXT NOT NULL CHECK (component_kind IN (
                       'DEBT', 'LEASES', 'PENSIONS_PROVISIONS', 'MINORITIES',
                       'ASSOCIATES_INVESTMENTS', 'CASH', 'RESTRICTED_CASH',
                       'NON_OPERATING_ASSETS', 'OPTIONS_DILUTION', 'OTHER'
                     )),
  sign              TEXT NOT NULL CHECK (sign IN ('SUBTRACT_FROM_EV', 'ADD_TO_EV')), -- explicit, not inferred from amount sign
  amount_decimal    NUMERIC NOT NULL,
  as_of_date        DATE NOT NULL,
  rationale         TEXT,

  created_by        TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_valuation_ev_bridge_components_seq UNIQUE (bridge_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS idx_finance_valuation_ev_bridge_components_bridge ON finance_valuation_ev_equity_bridge_components(bridge_id);

-- ============================================================================
-- 7. finance_valuation_sensitivity_grids (header) + finance_valuation_sensitivity_cells (child) —
--    physical 5x5 structure (ADR section 10). 25-cell + exactly-1-base-cell is enforced ONLY when
--    grid_status='COMPLETE' (trigger in file 2, mirroring WP-D05's readiness-gate philosophy).
--    Monotonicity is explicitly out of scope (ADR section 10 / task point 5).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_valuation_sensitivity_grids (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id       TEXT NOT NULL,
  method_id             TEXT NOT NULL REFERENCES finance_valuation_methods(id),
  grid_label            TEXT NOT NULL,
  row_axis_variable     TEXT NOT NULL,
  column_axis_variable  TEXT NOT NULL,
  grid_status           TEXT NOT NULL DEFAULT 'DRAFT' CHECK (grid_status IN ('DRAFT', 'COMPLETE')),

  created_by            TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_valuation_sensitivity_grids_method_label UNIQUE (method_id, grid_label)
);

CREATE INDEX IF NOT EXISTS idx_finance_valuation_sensitivity_grids_method ON finance_valuation_sensitivity_grids(method_id);

CREATE TABLE IF NOT EXISTS finance_valuation_sensitivity_cells (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id       TEXT NOT NULL,
  grid_id               TEXT NOT NULL REFERENCES finance_valuation_sensitivity_grids(id),
  row_index             INTEGER NOT NULL CHECK (row_index BETWEEN 1 AND 5),
  col_index             INTEGER NOT NULL CHECK (col_index BETWEEN 1 AND 5),
  row_axis_value        NUMERIC,
  column_axis_value     NUMERIC,
  cell_value_decimal    NUMERIC,
  is_base_cell          BOOLEAN NOT NULL DEFAULT false,

  created_by            TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_valuation_sensitivity_cells_pos UNIQUE (grid_id, row_index, col_index)
);

CREATE INDEX IF NOT EXISTS idx_finance_valuation_sensitivity_cells_grid ON finance_valuation_sensitivity_cells(grid_id);

-- ============================================================================
-- 8. finance_valuation_comps — peer table (ADR section 11). Reuses the WP-B01 section 2.7 value
--    bundle for metric_value_status/metric_value_decimal (peer metrics can be MISSING/NA too).
--    Readiness gate closing "0 comps but READY" is a trigger in file 2 (cross-table).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_valuation_comps (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id        TEXT NOT NULL,
  method_id              TEXT NOT NULL REFERENCES finance_valuation_methods(id),
  peer_name              TEXT NOT NULL,
  peer_identifier        TEXT,
  metric_type            TEXT NOT NULL,
  metric_value_status    finance_value_status NOT NULL DEFAULT 'MISSING',
  metric_value_decimal   NUMERIC,
  is_outlier_excluded    BOOLEAN NOT NULL DEFAULT false,
  exclusion_rationale    TEXT,
  source_ref             JSONB,

  created_by             TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- WP-B01 2.7 value_status <-> value_decimal shape, same as every other value bundle table.
  CONSTRAINT chk_finance_comps_value_shape CHECK (
    (metric_value_status = 'PRESENT_NONZERO' AND metric_value_decimal IS NOT NULL AND metric_value_decimal != 0)
    OR (metric_value_status = 'PRESENT_ZERO' AND metric_value_decimal = 0)
    OR (metric_value_status IN ('MISSING', 'NA', 'NOT_APPLICABLE') AND metric_value_decimal IS NULL)
  ),

  -- Never a silent exclusion decision (ADR section 11).
  CONSTRAINT chk_finance_comps_exclusion_rationale CHECK (NOT is_outlier_excluded OR exclusion_rationale IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_finance_valuation_comps_method ON finance_valuation_comps(method_id);

-- ============================================================================
-- 9. finance_valuation_advisor_outputs — facts/hypotheses/risks/questions/actions (ADR section
--    12). Freshness anchor is compute_snapshot_id (append-only, WP-B06), NOT business_version_id
--    directly — Advisor FK-s to a concrete, immutable snapshot so "fresh computed candidate" is
--    structural, not conventional. Freeze-on-approval / stale-on-recompute triggers live in file
--    2, attached to finance_business_versions (zero new code in approveVersion()).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_valuation_advisor_outputs (
  id                              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id                 TEXT NOT NULL,
  business_version_id             TEXT NOT NULL,
  compute_snapshot_id             TEXT NOT NULL REFERENCES finance_compute_snapshots(compute_snapshot_id),

  output_kind                     TEXT NOT NULL CHECK (output_kind IN ('FACT', 'HYPOTHESIS', 'RISK', 'QUESTION', 'ACTION')),
  title                           TEXT NOT NULL,
  narrative                       TEXT NOT NULL,
  evidence_ref                    JSONB NOT NULL,
  driver_ref                      TEXT,
  impact_decimal                  NUMERIC,
  confidence                      TEXT CHECK (confidence IN ('LOW', 'MEDIUM', 'HIGH')),

  is_comparison                   BOOLEAN NOT NULL DEFAULT false, -- true => this finding compares variants (table 10)

  is_frozen                       BOOLEAN NOT NULL DEFAULT false,
  frozen_at                       TIMESTAMPTZ,
  is_stale                        BOOLEAN NOT NULL DEFAULT false,
  stale_since                     TIMESTAMPTZ,

  -- Required AI output policy (ADR section 12.6) — first place in the program needing this as data.
  ai_provider                     TEXT NOT NULL,
  ai_model                        TEXT NOT NULL,
  ai_prompt_version               TEXT NOT NULL,
  ai_residency_region             TEXT,
  ai_no_training_commitment       BOOLEAN NOT NULL,
  ai_estimated_cost_decimal       NUMERIC,
  ai_rate_limit_bucket            TEXT,
  ai_evidence_digest              TEXT NOT NULL,
  ai_hallucination_eval_status    TEXT NOT NULL DEFAULT 'NOT_EVALUATED'
                                     CHECK (ai_hallucination_eval_status IN ('NOT_EVALUATED', 'PASSED', 'FLAGGED')),

  created_by                      TEXT NOT NULL,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_valuation_advisor_outputs_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_valuation_advisor_outputs_bv ON finance_valuation_advisor_outputs(business_version_id);
CREATE INDEX IF NOT EXISTS idx_finance_valuation_advisor_outputs_snapshot ON finance_valuation_advisor_outputs(compute_snapshot_id);

-- ============================================================================
-- 10. finance_valuation_advisor_output_variants — many-to-many compare bridge (ADR section
--     12.4). A finding compares N variants (typically 2-4) instead of exactly two via a single
--     compared_variant_id column, which would cap comparisons at two and force denormalization
--     for a third. A row may exist only when the parent finding has is_comparison=true (trigger,
--     file 2).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_valuation_advisor_output_variants (
  advisor_output_id             TEXT NOT NULL REFERENCES finance_valuation_advisor_outputs(id),
  compared_business_version_id  TEXT NOT NULL,
  organization_id               TEXT NOT NULL,
  role                           TEXT NOT NULL CHECK (role IN ('PRIMARY', 'COMPARED_AGAINST')),
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (advisor_output_id, compared_business_version_id),

  CONSTRAINT fk_finance_valuation_advisor_output_variants_bv_org
    FOREIGN KEY (compared_business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_valuation_advisor_output_variants_bv ON finance_valuation_advisor_output_variants(compared_business_version_id);

COMMIT;
