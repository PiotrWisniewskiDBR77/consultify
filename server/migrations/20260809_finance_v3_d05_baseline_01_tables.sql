-- Finance v3 — Gate D (WP-D05b): Baseline Models domain schema, part 1/3 — tables.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D05_baseline_models_schema_ADR.md,
-- sections 4 (seven new tables), 5 (four-layer plug/financing exclusion), Zalacznik A (two blocks
-- of literal, live-tested DDL: finance_baseline_schedules table + payload-validation trigger +
-- cash-rollforward trigger — transcribed verbatim below). Turns the ADR's live-tested DDL into a
-- real, additive migration — same discipline WP-D01b/WP-D03b applied to WP-D01/WP-D03.
--
-- Depends on (already shipped, Gate B/C/D01/D03, untouched by this file):
--   finance_artifacts, finance_business_versions, finance_working_revisions (b01)
--   finance_value_status enum (b01)
--   finance_lineage_edges (STATEMENT_TO_MODEL / ANALYSIS_TO_MODEL already in edge_type CHECK) (b03)
--   compute_jobs (b04)
--   finance_exceptions, finance_exceptions_current (b05)
--   finance_stmt_entities, finance_stmt_periods (d01)
--   financial_statement_lines (Gate A legacy taxonomy, AUTO_MIGRATE, reused as-is)
--   organizations(id)
--
-- Additive only. Zero DROP/RENAME/ALTER ... TYPE on any existing table. One additive column
-- (financial_statement_lines.excluded_from_baseline, ADR section 4.7) and one additive UPDATE
-- (DIVIDENDS_DECLARED, the only line flagged today). All new tables use
-- TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, matching the live-schema convention
-- WP-C01/WP-D01b/WP-D03b already established.
--
-- Split into 3 files matching the ADR's own execution order (section "Zalacznik A", "Kolejnosc
-- wykonania": tables -> integrity controls -> readiness gate + roll-up views). Filename suffix
-- 01/02/03 pins the deterministic same-date filename sort order the migration runner
-- (server/scripts/migrate.postgres.ts) uses. NOTE: no filename here contains the substring "seed"
-- (WP-D03b found the migration runner's isSqliteOnlyMigration() silently excludes any filename
-- containing seed/mock/demo/a leading add_ — this work package ships zero seed data, so the trap
-- does not apply, but the naming was deliberately checked against that exclusion list anyway).

BEGIN;

-- ============================================================================
-- 0. financial_statement_lines.excluded_from_baseline — additive column (ADR section 4.7),
--    physical layer #3 of the no-plug/no-financing guarantee (section 5.3). Curated denylist,
--    today exactly one row: DIVIDENDS_DECLARED (the only existing taxonomy line representing a
--    distribution decision). DEBT_DRAWDOWN/EQUITY_INJECTION/SHARE_BUYBACK do not exist as line
--    codes today because no schedule_type can ever produce them (layers 1-2 below).
-- ============================================================================
ALTER TABLE financial_statement_lines
  ADD COLUMN IF NOT EXISTS excluded_from_baseline BOOLEAN NOT NULL DEFAULT false;

UPDATE financial_statement_lines
  SET excluded_from_baseline = true
  WHERE line_code = 'DIVIDENDS_DECLARED' AND excluded_from_baseline = false;

-- ============================================================================
-- 1. finance_baseline_models — one row per business_version_id of a BASELINE_MODEL artifact
--    (ADR section 4.1). Deliberately NO source_statement_pack_version_id /
--    source_analysis_version_id column — source is exclusively finance_lineage_edges
--    (STATEMENT_TO_MODEL / ANALYSIS_TO_MODEL, already in b03's edge_type CHECK), ADR section 2.3.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_baseline_models (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id               TEXT NOT NULL,
  business_version_id             TEXT NOT NULL,

  horizon_months                    INTEGER NOT NULL CHECK (horizon_months > 0 AND horizon_months <= 240),
  horizon_rationale                   TEXT NOT NULL CHECK (horizon_rationale IN (
                                         'STEADY_STATE', 'DEBT_MATURITY', 'BUSINESS_CYCLE'
                                       )),
  horizon_rationale_note                TEXT NOT NULL, -- free-text justification; "36 months" with no reason does not pass review even though it passes the CHECK (ADR section 4.1)

  circularity_max_iterations              INTEGER NOT NULL DEFAULT 50 CHECK (circularity_max_iterations > 0),
  circularity_tolerance_currency            NUMERIC NOT NULL DEFAULT 1 CHECK (circularity_tolerance_currency >= 0),

  -- Two explicit design flags declaring WHICH (if any) contractual, non-discretionary mechanism
  -- is the source of circularity for this specific model (ADR section 6.1). Both false by default
  -- => model has no circularity, solver converges in one iteration.
  interest_income_on_cash_modeled           BOOLEAN NOT NULL DEFAULT false,
  mandatory_contractual_cash_sweep_modeled    BOOLEAN NOT NULL DEFAULT false,

  created_by                                    TEXT NOT NULL,
  created_at                                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_baseline_models_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT uq_finance_baseline_models_bv UNIQUE (business_version_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_baseline_models_org ON finance_baseline_models(organization_id);

-- ============================================================================
-- 2. finance_baseline_schedules — ONE table, discriminated schedule_type + payload JSONB
--    (ADR section 4.2, decision-and-rationale vs. 9 separate tables in section 10.1).
--    Physical layer #1 of the no-plug guarantee: the CHECK enum below has exactly the nine
--    schedule families from the brief, no 'financing'/'dividend'/'plug' value exists.
--    Transcribed verbatim from the ADR's Zalacznik A (already live-tested — TEST 1-4).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_baseline_schedules (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id         TEXT NOT NULL,
  business_version_id     TEXT NOT NULL,
  schedule_type           TEXT NOT NULL CHECK (schedule_type IN (
                             'revenue_pvm','headcount','cogs_opex','wc_dso_dio_dpo',
                             'capex_depreciation','leases','debt_maturity','tax_nol','equity_re'
                           )),
  entity_id                TEXT NOT NULL REFERENCES finance_stmt_entities(id),
  schedule_item_code         TEXT NOT NULL,
  effective_from_period_id     TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),
  effective_to_period_id         TEXT REFERENCES finance_stmt_periods(period_id),
  payload                          JSONB NOT NULL,
  source_ref                         JSONB,
  created_by                           TEXT NOT NULL,
  created_at                             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_finance_baseline_schedules_item
    UNIQUE (business_version_id, schedule_type, entity_id, schedule_item_code, effective_from_period_id),
  CONSTRAINT fk_finance_baseline_schedules_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_baseline_schedules_version ON finance_baseline_schedules(business_version_id, schedule_type);
CREATE INDEX IF NOT EXISTS idx_finance_baseline_schedules_entity ON finance_baseline_schedules(entity_id);

-- ============================================================================
-- 3. finance_baseline_assumptions — driver grid (ADR section 4.3): history/base period/rule/
--    unit/source/forecast value/range/quality, per entity/period. driver_code is an application
--    catalog (Zalacznik B), NOT a DB enum — same deliberate choice WP-D03 made for org-custom
--    kpi_code (ADR section 12 point 1: a full catalog-table would be premature scope for this P0).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_baseline_assumptions (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id               TEXT NOT NULL,
  business_version_id             TEXT NOT NULL,

  schedule_type                     TEXT NOT NULL CHECK (schedule_type IN (
                                       'revenue_pvm','headcount','cogs_opex','wc_dso_dio_dpo',
                                       'capex_depreciation','leases','debt_maturity','tax_nol','equity_re'
                                     )),
  driver_code                         TEXT NOT NULL, -- application catalog (Zalacznik B), not a DB enum
  entity_id                             TEXT NOT NULL REFERENCES finance_stmt_entities(id),
  period_id                               TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),
  base_period_id                            TEXT REFERENCES finance_stmt_periods(period_id), -- what the history is anchored to; nullable (not every rule needs one, e.g. MANUAL_OVERRIDE)

  rule                                         TEXT NOT NULL CHECK (rule IN (
                                                  'HISTORICAL_AVERAGE', 'GROWTH_RATE', 'FIXED_VALUE',
                                                  'LINKED_TO_ANALYSIS_KPI', 'FORMULA', 'MANUAL_OVERRIDE'
                                                )),

  -- WP-B01 section 2.7 bundle (value_status/value_decimal), plus a driver-specific unit label
  -- (e.g. 'PCT'/'DAYS'/'CURRENCY'/'MULTIPLE'/'COUNT' — not DB-enforced, driver_code determines
  -- the expected unit at the application layer, same rationale as driver_code itself).
  value_status                                   finance_value_status NOT NULL DEFAULT 'MISSING',
  value_decimal                                    NUMERIC,
  unit                                                TEXT NOT NULL,
  source_ref                                            JSONB, -- provenance: Analysis KPI / benchmark / manual input

  range_low                                               NUMERIC, -- sensitivity band
  range_high                                                NUMERIC,
  quality                                                     TEXT NOT NULL DEFAULT 'ESTIMATED' CHECK (quality IN (
                                                                 'CONFIRMED', 'ESTIMATED', 'DEGRADED_INSUFFICIENT_HISTORY'
                                                               )),

  created_by                                                    TEXT NOT NULL,
  created_at                                                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                                        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_baseline_assumptions_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT chk_finance_baseline_assumptions_range CHECK (range_low IS NULL OR range_high IS NULL OR range_low <= range_high),

  -- WP-B01 2.7 value_status <-> value_decimal shape, same as finance_stmt_lines/finance_analysis_kpi_values.
  CONSTRAINT chk_finance_baseline_assumptions_value_shape CHECK (
    (value_status = 'PRESENT_NONZERO' AND value_decimal IS NOT NULL AND value_decimal != 0)
    OR (value_status = 'PRESENT_ZERO' AND value_decimal = 0)
    OR (value_status IN ('MISSING', 'NA', 'NOT_APPLICABLE') AND value_decimal IS NULL)
  ),

  -- One authoritative assumption cell per driver, per entity, per period.
  CONSTRAINT uq_finance_baseline_assumptions_cell
    UNIQUE (business_version_id, entity_id, schedule_type, driver_code, period_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_baseline_assumptions_version ON finance_baseline_assumptions(business_version_id, schedule_type);
CREATE INDEX IF NOT EXISTS idx_finance_baseline_assumptions_entity_period ON finance_baseline_assumptions(entity_id, period_id);

-- ============================================================================
-- 4. finance_baseline_outputs — future P&L/BS/CF, literally the same shape as finance_stmt_lines
--    (ADR section 4.4), plus value_kind (ACTUAL/FORECAST) and driving_schedule_type. quality_flag
--    carries FUNDING_GAP (section 7). uq_finance_baseline_outputs_cell deliberately does NOT
--    include accumulation_basis (Baseline has no notion of quarter-only/YTD/LTM at STORAGE level
--    — that is a property of the roll-up, section 8) nor value_kind (a description of the one
--    authoritative cell, not a second dimension creating a second row for the same period).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_baseline_outputs (
  id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id              TEXT NOT NULL,
  business_version_id            TEXT NOT NULL,

  statement_type                   TEXT NOT NULL CHECK (statement_type IN ('P&L', 'BS', 'CF')),
  canonical_line_id                  TEXT NOT NULL REFERENCES financial_statement_lines(id),
  entity_id                            TEXT NOT NULL REFERENCES finance_stmt_entities(id),
  period_id                              TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),
  consolidation_scope                      TEXT NOT NULL DEFAULT 'CONSOLIDATED' CHECK (consolidation_scope IN (
                                              'STANDALONE', 'CONSOLIDATED', 'ELIMINATION'
                                            )),

  -- WP-B01 section 2.7 mandatory bundle:
  value_status                               finance_value_status NOT NULL DEFAULT 'MISSING',
  value_decimal                                NUMERIC,
  native_currency                                TEXT NOT NULL,
  presentation_currency                            TEXT NOT NULL,
  unit                                                TEXT NOT NULL CHECK (unit IN ('UNITS', 'THOUSANDS', 'MILLIONS', 'BILLIONS')),
  multiplier                                            NUMERIC NOT NULL DEFAULT 1,
  source_ref                                              JSONB,
  is_adjustment                                             BOOLEAN NOT NULL DEFAULT false,
  adjustment_reason                                           TEXT,

  -- Baseline-domain-specific (ADR section 4.4):
  value_kind                                                    TEXT NOT NULL CHECK (value_kind IN ('ACTUAL', 'FORECAST')),
  driving_schedule_type                                           TEXT CHECK (driving_schedule_type IS NULL OR driving_schedule_type IN (
                                                                     'revenue_pvm','headcount','cogs_opex','wc_dso_dio_dpo',
                                                                     'capex_depreciation','leases','debt_maturity','tax_nol','equity_re'
                                                                   )), -- NULL for roll-up/solver lines (CASH/TOTAL_ASSETS/NET_INCOME, ...) not directly produced by one schedule_type
  quality_flag                                                      TEXT CHECK (quality_flag IS NULL OR quality_flag IN ('FUNDING_GAP')), -- set by finance_baseline_mark_funding_gap() (section 7)

  created_by                                                          TEXT NOT NULL,
  created_at                                                            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                                              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_baseline_outputs_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT chk_finance_baseline_outputs_value_shape CHECK (
    (value_status = 'PRESENT_NONZERO' AND value_decimal IS NOT NULL AND value_decimal != 0)
    OR (value_status = 'PRESENT_ZERO' AND value_decimal = 0)
    OR (value_status IN ('MISSING', 'NA', 'NOT_APPLICABLE') AND value_decimal IS NULL)
  ),
  CONSTRAINT chk_finance_baseline_outputs_adjustment_reason CHECK (NOT is_adjustment OR adjustment_reason IS NOT NULL),

  CONSTRAINT uq_finance_baseline_outputs_cell UNIQUE (
    business_version_id, entity_id, canonical_line_id, period_id, consolidation_scope
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_baseline_outputs_version ON finance_baseline_outputs(business_version_id, statement_type);
CREATE INDEX IF NOT EXISTS idx_finance_baseline_outputs_entity_period ON finance_baseline_outputs(entity_id, period_id);
CREATE INDEX IF NOT EXISTS idx_finance_baseline_outputs_canonical ON finance_baseline_outputs(canonical_line_id);

-- ============================================================================
-- 5. finance_baseline_solver_diagnostics — per-period circularity solver log (ADR section 4.5).
--    compute_job_id references compute_jobs(id) directly (not compute_job_outputs) because a
--    non-converged run never commits compute_job_outputs (WP-B04 "commit only on success") but
--    its diagnostics must still be recorded somewhere.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_baseline_solver_diagnostics (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id               TEXT NOT NULL,
  business_version_id             TEXT NOT NULL,
  compute_job_id                    TEXT NOT NULL REFERENCES compute_jobs(id),
  period_id                           TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),

  iterations_used                       INTEGER NOT NULL CHECK (iterations_used > 0),
  converged                               BOOLEAN NOT NULL,
  final_residual_currency                   NUMERIC NOT NULL,
  tolerance_applied                           NUMERIC NOT NULL,

  created_at                                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_baseline_solver_diag_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT uq_finance_baseline_solver_diag UNIQUE (compute_job_id, period_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_baseline_solver_diag_version ON finance_baseline_solver_diagnostics(business_version_id, period_id);

-- ============================================================================
-- 6. finance_baseline_backtest_runs / finance_baseline_backtest_line_results — holdout
--    actual-vs-forecast comparisons (ADR section 4.6). Deliberately plain composite FKs, NOT a
--    finance_lineage_edges row — "measured against", not "transforms into" (section 10.4).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_baseline_backtest_runs (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id               TEXT NOT NULL,

  baseline_business_version_id    TEXT NOT NULL,
  actual_statement_pack_business_version_id TEXT NOT NULL,

  holdout_period_start_id                     TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),
  holdout_period_end_id                         TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),

  history_months_available                        INTEGER NOT NULL CHECK (history_months_available >= 0),
  -- Conservative choice (ADR section 4.6): degraded until PROVEN sufficient (>=24 months), the
  -- lower bound of the addendum's "24-36 months" range, not the upper one.
  seasonality_degraded                              BOOLEAN GENERATED ALWAYS AS (history_months_available < 24) STORED,

  created_by                                          TEXT NOT NULL,
  created_at                                            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_baseline_backtest_runs_baseline_bv_org
    FOREIGN KEY (baseline_business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),
  CONSTRAINT fk_finance_baseline_backtest_runs_actual_bv_org
    FOREIGN KEY (actual_statement_pack_business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_baseline_backtest_runs_baseline ON finance_baseline_backtest_runs(baseline_business_version_id);
CREATE INDEX IF NOT EXISTS idx_finance_baseline_backtest_runs_actual ON finance_baseline_backtest_runs(actual_statement_pack_business_version_id);

CREATE TABLE IF NOT EXISTS finance_baseline_backtest_line_results (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id               TEXT NOT NULL,
  backtest_run_id                 TEXT NOT NULL REFERENCES finance_baseline_backtest_runs(id),

  canonical_line_id                 TEXT NOT NULL REFERENCES financial_statement_lines(id),
  entity_id                           TEXT NOT NULL REFERENCES finance_stmt_entities(id),
  period_id                             TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),

  forecast_value                          NUMERIC NOT NULL,
  actual_value                              NUMERIC NOT NULL,
  bias                                        NUMERIC GENERATED ALWAYS AS (actual_value - forecast_value) STORED,
  -- "never silently zero" (same discipline as WP-D01 section 5.6): NULL, not 0, when actual_value=0.
  abs_pct_error                                 NUMERIC GENERATED ALWAYS AS (
                                                   CASE WHEN actual_value = 0 THEN NULL
                                                        ELSE ABS((actual_value - forecast_value) / actual_value) END
                                                 ) STORED,
  is_material_line                                BOOLEAN NOT NULL DEFAULT false,

  created_at                                        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_baseline_backtest_line_results
    UNIQUE (backtest_run_id, canonical_line_id, entity_id, period_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_baseline_backtest_line_results_run ON finance_baseline_backtest_line_results(backtest_run_id);

COMMIT;
