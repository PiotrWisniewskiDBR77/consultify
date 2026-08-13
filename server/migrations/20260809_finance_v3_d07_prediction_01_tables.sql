-- Finance v3 — Gate D (WP-D07b): Prediction / Scenario Engine domain schema, part 1/3 — tables.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D07_prediction_schema_ADR.md, sections 3
-- (ten new tables), 4 (full column-level definition per table), Zalacznik A (literal, live-tested
-- DDL for finance_prediction_scenarios — transcribed verbatim below). Turns the ADR's live-tested
-- design into a real, additive migration — same discipline WP-D01b/WP-D03b/WP-D05b applied to
-- WP-D01/WP-D03/WP-D05.
--
-- Depends on (already shipped, Gate B/C/D01/D03/D05, untouched by this file):
--   finance_artifacts, finance_business_versions, finance_value_status enum (b01)
--   finance_lineage_edges (MODEL_TO_SCENARIO already in edge_type CHECK, requires
--     assumption_snapshot_hash NOT NULL) (b03)
--   compute_jobs (b04)
--   finance_exceptions, finance_exceptions_current (b05)
--   finance_stmt_entities, finance_stmt_periods (d01)
--   financial_statement_lines (Gate A legacy taxonomy, reused as-is)
--   finance_analysis_kpi_catalog (d03)
--   finance_baseline_schedules.schedule_type (9-value enum, reused verbatim, not redefined here) (d05)
--   organizations(id)
--
-- Additive only. Zero DROP/RENAME/ALTER ... TYPE on any existing table.
--
-- Split into 3 files matching the ADR's own Zalacznik A grouping (tables -> integrity controls ->
-- readiness gate / detection / effective view). Filename suffix 01/02/03 pins the deterministic
-- same-date filename sort order the migration runner (server/scripts/migrate.postgres.ts) uses.
-- NOTE: no filename here contains the substring "seed" (WP-D03b found the runner's
-- isSqliteOnlyMigration() silently excludes any filename containing seed/mock/demo/a leading add_,
-- and WP-D05b independently re-confirmed the same trap) — this work package ships a small, honest
-- partial seed for finance_prediction_driver_line_map (section 7 below) inside a file named
-- "..._01_tables.sql", not "..._seed...", so the exclusion does not apply; names were checked
-- against that exclusion list before being finalized anyway.

BEGIN;

-- ============================================================================
-- 1. finance_prediction_scenarios — one row per business_version_id of a PREDICTION_SCENARIO
--    artifact (ADR section 4.1). Deliberately NO source_baseline_business_version_id column —
--    source is exclusively finance_lineage_edges (MODEL_TO_SCENARIO, already in b03's edge_type
--    CHECK, requires assumption_snapshot_hash NOT NULL), ADR section 2. Transcribed verbatim from
--    the ADR's Zalacznik A (already live-tested — TEST 1/4/6/6b/7).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_prediction_scenarios (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id       TEXT NOT NULL,
  business_version_id   TEXT NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT,
  scenario_mode         TEXT NOT NULL CHECK (scenario_mode IN (
                           'STANDARD_BASE','STANDARD_UPSIDE','STANDARD_DOWNSIDE',
                           'DRIVER_OVERRIDE','FUNDAMENTAL_INITIATIVE'
                         )),
  scenario_mode_promoted_at TIMESTAMPTZ,
  scenario_mode_promoted_by TEXT,
  created_by            TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_finance_prediction_scenarios_bv UNIQUE (business_version_id),
  CONSTRAINT fk_finance_prediction_scenarios_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_prediction_scenarios_org ON finance_prediction_scenarios(organization_id);

-- ============================================================================
-- 2. finance_prediction_driver_overrides (tryb B, ADR section 4.2) — driver grid override:
--    schedule_type+driver_code+entity+period, new value, WP-B01 2.7 bundle. schedule_type reuses
--    the exact 9-value enum d05_baseline_01_tables.sql already established on
--    finance_baseline_schedules — not redefined, transcribed literally so the two enums can never
--    drift apart. baseline_value_decimal is a snapshot for quick-diff/audit only (ADR section 4.2)
--    — NOT authoritative; the authoritative Baseline value is always finance_baseline_assumptions/
--    finance_baseline_outputs via the MODEL_TO_SCENARIO edge.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_prediction_driver_overrides (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id               TEXT NOT NULL,
  business_version_id             TEXT NOT NULL,

  schedule_type                     TEXT NOT NULL CHECK (schedule_type IN (
                                       'revenue_pvm','headcount','cogs_opex','wc_dso_dio_dpo',
                                       'capex_depreciation','leases','debt_maturity','tax_nol','equity_re'
                                     )),
  driver_code                         TEXT NOT NULL, -- application catalog (D05 Zalacznik B), not a DB enum — same choice D05 made for finance_baseline_assumptions.driver_code
  entity_id                             TEXT NOT NULL REFERENCES finance_stmt_entities(id),
  period_id                               TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),

  override_source                           TEXT NOT NULL CHECK (override_source IN (
                                               'MANUAL', 'STANDARD_PRESET_UPSIDE', 'STANDARD_PRESET_DOWNSIDE'
                                             )),

  -- WP-B01 section 2.7 bundle.
  value_status                                 finance_value_status NOT NULL DEFAULT 'MISSING',
  value_decimal                                  NUMERIC,
  unit                                              TEXT NOT NULL,

  baseline_value_decimal                              NUMERIC, -- informational snapshot only (ADR section 4.2) — not authoritative
  rationale                                             TEXT,

  created_by                                              TEXT NOT NULL,
  created_at                                                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_prediction_driver_overrides_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT chk_finance_prediction_driver_overrides_value_shape CHECK (
    (value_status = 'PRESENT_NONZERO' AND value_decimal IS NOT NULL AND value_decimal != 0)
    OR (value_status = 'PRESENT_ZERO' AND value_decimal = 0)
    OR (value_status IN ('MISSING', 'NA', 'NOT_APPLICABLE') AND value_decimal IS NULL)
  ),

  -- One authoritative override per driver cell, per scenario (ADR section 4.2) — a second change
  -- to the same cell is an UPDATE, not a new conflicting row.
  CONSTRAINT uq_finance_prediction_driver_overrides_cell
    UNIQUE (business_version_id, schedule_type, driver_code, entity_id, period_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_prediction_driver_overrides_version ON finance_prediction_driver_overrides(business_version_id, schedule_type);
CREATE INDEX IF NOT EXISTS idx_finance_prediction_driver_overrides_entity_period ON finance_prediction_driver_overrides(entity_id, period_id);

-- ============================================================================
-- 3. finance_prediction_initiatives (tryb C, ADR section 4.3) — initiative card: name/description/
--    source/owner/confidence, default start/ramp/duration/implementation cost envelope. Values are
--    DEFAULTS, individually overridable per-impact on finance_prediction_impact_chain (section 4.4).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_prediction_initiatives (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id               TEXT NOT NULL,
  business_version_id             TEXT NOT NULL,

  initiative_code                   TEXT NOT NULL, -- stable natural key within the scenario
  name                                 TEXT NOT NULL,
  description                           TEXT,
  source                                   TEXT, -- free text: 'MANAGEMENT_PLAN'/'CONSULTANT_RECOMMENDATION'/'BOARD_DECISION'/... (same deliberate non-enum choice as D05's driver_code, ADR section 4.3)
  owner                                       TEXT,
  confidence_pct                                NUMERIC CHECK (confidence_pct IS NULL OR (confidence_pct >= 0 AND confidence_pct <= 100)),

  default_start_period_id                         TEXT REFERENCES finance_stmt_periods(period_id),
  default_ramp_months                               INTEGER CHECK (default_ramp_months IS NULL OR default_ramp_months >= 0),
  default_duration_months                             INTEGER CHECK (default_duration_months IS NULL OR default_duration_months >= 0),
  implementation_cost_decimal                           NUMERIC,

  status                                                  TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED', 'REJECTED')),

  created_by                                                TEXT NOT NULL,
  created_at                                                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_prediction_initiatives_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT uq_finance_prediction_initiatives_code UNIQUE (business_version_id, initiative_code)
);

CREATE INDEX IF NOT EXISTS idx_finance_prediction_initiatives_version ON finance_prediction_initiatives(business_version_id);

-- ============================================================================
-- 4. finance_prediction_impact_chain (ADR section 4.4) — core chain: initiative -> assumption ->
--    driver/KPI -> statement_line -> forecast. driver_schedule_type+driver_code XOR kpi_catalog_id
--    (an impact is expressed either in driver terms or KPI terms, never both, never neither).
--    start_period_id/ramp_months/duration_months/decay_pct_per_period are nullable and inherit from
--    finance_prediction_initiatives.default_* when NULL (ADR section 4.3/4.4) — enforced at the
--    application/compute layer, not by a DB default, since the inheritance source is a sibling row,
--    not a static value.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_prediction_impact_chain (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id               TEXT NOT NULL,
  business_version_id             TEXT NOT NULL,

  initiative_id                     TEXT NOT NULL REFERENCES finance_prediction_initiatives(id),
  assumption_label                    TEXT NOT NULL, -- free text describing the underlying assumption, e.g. "5% COGS reduction from production efficiency"

  driver_schedule_type                  TEXT CHECK (driver_schedule_type IS NULL OR driver_schedule_type IN (
                                           'revenue_pvm','headcount','cogs_opex','wc_dso_dio_dpo',
                                           'capex_depreciation','leases','debt_maturity','tax_nol','equity_re'
                                         )),
  driver_code                             TEXT,
  kpi_catalog_id                            TEXT REFERENCES finance_analysis_kpi_catalog(id),

  statement_line_id                           TEXT NOT NULL REFERENCES financial_statement_lines(id),
  entity_id                                     TEXT NOT NULL REFERENCES finance_stmt_entities(id),

  amount_kind                                     TEXT NOT NULL CHECK (amount_kind IN ('ABSOLUTE_AMOUNT', 'PERCENT_OF_BASE', 'PERCENT_DELTA')),
  amount_decimal                                    NUMERIC NOT NULL,
  amount_unit                                         TEXT NOT NULL,
  sign                                                  TEXT NOT NULL CHECK (sign IN ('POSITIVE', 'NEGATIVE')), -- explicit, never inferred from the value's own sign (ADR section 4.4)

  start_period_id                                         TEXT REFERENCES finance_stmt_periods(period_id), -- NULL => inherit finance_prediction_initiatives.default_start_period_id
  ramp_months                                               INTEGER CHECK (ramp_months IS NULL OR ramp_months >= 0),
  duration_months                                             INTEGER CHECK (duration_months IS NULL OR duration_months >= 0),
  decay_pct_per_period                                          NUMERIC,

  implementation_cost_decimal                                     NUMERIC, -- per-impact breakdown, additive to finance_prediction_initiatives.implementation_cost_decimal

  confidence_pct                                                    NUMERIC CHECK (confidence_pct IS NULL OR (confidence_pct >= 0 AND confidence_pct <= 100)), -- how confident is the size estimate
  probability_pct                                                     NUMERIC CHECK (probability_pct IS NULL OR (probability_pct >= 0 AND probability_pct <= 100)), -- how likely is the initiative to happen at all

  capacity_constraint_ref                                               JSONB, -- e.g. {max_units, unit} — soft constraint, not trigger-validated in this P0 (ADR section 15 pt 3)
  cannibalizes_impact_id                                                  TEXT REFERENCES finance_prediction_impact_chain(id), -- explicit, named "this impact reduces another impact" relation — a DECLARED relationship, distinct from double-counting DETECTION (section 7)

  created_by                                                                TEXT NOT NULL,
  created_at                                                                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                                                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_prediction_impact_chain_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  -- driver terms XOR kpi terms — exactly one of the two representations, never both, never neither.
  CONSTRAINT chk_finance_prediction_impact_chain_driver_xor_kpi CHECK (
    (driver_schedule_type IS NOT NULL AND driver_code IS NOT NULL AND kpi_catalog_id IS NULL)
    OR (driver_schedule_type IS NULL AND driver_code IS NULL AND kpi_catalog_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_prediction_impact_chain_version ON finance_prediction_impact_chain(business_version_id);
CREATE INDEX IF NOT EXISTS idx_finance_prediction_impact_chain_initiative ON finance_prediction_impact_chain(initiative_id);
CREATE INDEX IF NOT EXISTS idx_finance_prediction_impact_chain_line ON finance_prediction_impact_chain(statement_line_id);
CREATE INDEX IF NOT EXISTS idx_finance_prediction_impact_chain_entity_period ON finance_prediction_impact_chain(entity_id, start_period_id);

-- ============================================================================
-- 5. finance_prediction_financing (ADR section 4.5) — one discriminated table, financing_kind CHECK
--    + payload JSONB, same scaffolding pattern and rationale as finance_baseline_schedules
--    (D05 section 10.1). This is exactly where DEC-FIN-002's discretionary financing/repayment/
--    dividend/surplus-allocation decisions live — the concepts finance_baseline_validate_schedule_
--    payload() forbids in Baseline's payload are here modeled explicitly, not hidden (ADR section
--    4.5). period_id nullable: populated for point-in-time events, NULL for horizon-wide policies.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_prediction_financing (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id               TEXT NOT NULL,
  business_version_id             TEXT NOT NULL,

  financing_kind                    TEXT NOT NULL CHECK (financing_kind IN (
                                       'FACILITY_DRAWDOWN', 'DISCRETIONARY_REPAYMENT', 'EQUITY_INJECTION',
                                       'DIVIDEND_DECLARATION', 'SHARE_BUYBACK', 'SURPLUS_ALLOCATION_POLICY',
                                       'COVENANT_DEFINITION', 'MIN_CASH_POLICY'
                                     )),
  entity_id                           TEXT NOT NULL REFERENCES finance_stmt_entities(id),
  period_id                             TEXT REFERENCES finance_stmt_periods(period_id), -- NULL only for horizon-wide policies (see CHECK below)

  payload                                 JSONB NOT NULL,
  source_ref                                JSONB, -- e.g. ORCH-DEC-001 legacy migration provenance (ADR section 10): {migrated_from, legacy_event_id, legacy_model_id, source}
  rationale                                   TEXT, -- this work package's own additive column (not literally named in the ADR's column list, same documented-not-hidden discipline WP-D05b used for its 9th readiness check) — mirrors driver_overrides.rationale for audit consistency across the two "tryb B" input tables

  created_by                                    TEXT NOT NULL,
  created_at                                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_prediction_financing_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT chk_finance_prediction_financing_payload_object CHECK (jsonb_typeof(payload) = 'object'),

  -- period_id required for point events, forbidden (NULL) for horizon-wide policies (ADR section 4.5).
  CONSTRAINT chk_finance_prediction_financing_period_shape CHECK (
    (financing_kind IN ('COVENANT_DEFINITION', 'MIN_CASH_POLICY', 'SURPLUS_ALLOCATION_POLICY') AND period_id IS NULL)
    OR (financing_kind NOT IN ('COVENANT_DEFINITION', 'MIN_CASH_POLICY', 'SURPLUS_ALLOCATION_POLICY') AND period_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_prediction_financing_version ON finance_prediction_financing(business_version_id, financing_kind);
CREATE INDEX IF NOT EXISTS idx_finance_prediction_financing_entity_period ON finance_prediction_financing(entity_id, period_id);

-- ============================================================================
-- 6. finance_prediction_outputs (ADR section 4.6, poza doslowna lista z zadania) — computed
--    scenario P&L/BS/CF, literally the same shape as finance_baseline_outputs (D05 section 4.4),
--    plus variance_vs_baseline_decimal (denormalized convenience for Compare — a function of two
--    already-stored numbers, recomputed at every compute, not an independent second source of
--    truth). Physically FORBIDDEN for scenario_mode='STANDARD_BASE' — enforced by a trigger in file
--    02 (finance_prediction_forbid_standard_base_outputs), this is the "Base = Baseline" output-side
--    guarantee (ADR section 8.2).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_prediction_outputs (
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

  -- Prediction-domain-specific (ADR section 4.6):
  variance_vs_baseline_decimal                                  NUMERIC, -- convenience denormalization for Compare, recomputed every compute, never independently edited

  created_by                                                      TEXT NOT NULL,
  created_at                                                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                                          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_prediction_outputs_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT chk_finance_prediction_outputs_value_shape CHECK (
    (value_status = 'PRESENT_NONZERO' AND value_decimal IS NOT NULL AND value_decimal != 0)
    OR (value_status = 'PRESENT_ZERO' AND value_decimal = 0)
    OR (value_status IN ('MISSING', 'NA', 'NOT_APPLICABLE') AND value_decimal IS NULL)
  ),
  CONSTRAINT chk_finance_prediction_outputs_adjustment_reason CHECK (NOT is_adjustment OR adjustment_reason IS NOT NULL),

  CONSTRAINT uq_finance_prediction_outputs_cell UNIQUE (
    business_version_id, entity_id, canonical_line_id, period_id, consolidation_scope
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_prediction_outputs_version ON finance_prediction_outputs(business_version_id, statement_type);
CREATE INDEX IF NOT EXISTS idx_finance_prediction_outputs_entity_period ON finance_prediction_outputs(entity_id, period_id);
CREATE INDEX IF NOT EXISTS idx_finance_prediction_outputs_canonical ON finance_prediction_outputs(canonical_line_id);

-- ============================================================================
-- 7. finance_prediction_driver_line_map (ADR section 4.7, poza doslowna lista z zadania) — small,
--    hand-maintained catalog mirroring which schedule_type produces which canonical_line_id inside
--    baselineScheduleEngine.ts (WP-D06 section 1.2). NOT org-scoped / NOT business_version-scoped —
--    same nature as a code-mirror catalog, not tenant data (parity with the engine's own hardcoded
--    assembly, not per-customer configuration). Honestly partial (ADR section 13 escalation #1):
--    seeded only for schedule_type/canonical_line_id pairs whose target line already exists in the
--    live financial_statement_lines canonical taxonomy today (confirmed via a live catalog read of
--    this worktree's own migrations before writing this file — see section 7 comment block below for
--    exactly which pairs and why the rest are deliberately left unmapped, not guessed).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_prediction_driver_line_map (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  schedule_type       TEXT NOT NULL CHECK (schedule_type IN (
                         'revenue_pvm','headcount','cogs_opex','wc_dso_dio_dpo',
                         'capex_depreciation','leases','debt_maturity','tax_nol','equity_re'
                       )),
  canonical_line_id   TEXT NOT NULL REFERENCES financial_statement_lines(id),
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_finance_prediction_driver_line_map UNIQUE (schedule_type, canonical_line_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_prediction_driver_line_map_schedule ON finance_prediction_driver_line_map(schedule_type);

-- Seed: only pairs whose canonical_line_id is confirmed present in this worktree's live
-- financial_statement_lines taxonomy (565_kpi_time_series_roi_attribution_finance.sql,
-- 20260317_finance_v1_canonical_layer.sql, 567_financial_statements_ratios.sql,
-- 20260809_finance_v3_d01_statements_02_integrity.sql — REVENUE/COGS/OPEX/CAPEX/FIXED_ASSETS/
-- DEPRECIATION/INVENTORY/AR/AP/WORKING_CAPITAL/LONG_TERM_DEBT/INTEREST_EXPENSE/TAX_EXPENSE/
-- RETAINED_EARNINGS all exist). headcount and leases are deliberately left with zero rows — no
-- canonical payroll-cost or lease-liability/ROU-asset line exists in the taxonomy today (documented
-- gap, ADR section 13 escalation #1, not guessed at with an invented line).
INSERT INTO finance_prediction_driver_line_map (schedule_type, canonical_line_id, note)
SELECT v.schedule_type, l.id, v.note
FROM (VALUES
  ('revenue_pvm',         'REVENUE',            'P&L'),
  ('cogs_opex',           'COGS',               'P&L'),
  ('cogs_opex',           'OPEX',               'P&L'),
  ('capex_depreciation',  'CAPEX',              'CF'),
  ('capex_depreciation',  'DEPRECIATION',       'P&L'),
  ('capex_depreciation',  'FIXED_ASSETS',       'BS'),
  ('wc_dso_dio_dpo',      'INVENTORY',          'BS'),
  ('wc_dso_dio_dpo',      'AR',                 'BS'),
  ('wc_dso_dio_dpo',      'AP',                 'BS'),
  ('wc_dso_dio_dpo',      'WORKING_CAPITAL',    'BS'),
  ('debt_maturity',       'LONG_TERM_DEBT',     'BS'),
  ('debt_maturity',       'INTEREST_EXPENSE',   'P&L'),
  ('tax_nol',             'TAX_EXPENSE',        'P&L'),
  ('equity_re',           'RETAINED_EARNINGS',  'BS')
) AS v(schedule_type, line_code, note)
JOIN financial_statement_lines l ON l.line_code = v.line_code
ON CONFLICT (schedule_type, canonical_line_id) DO NOTHING;

-- ============================================================================
-- 8. finance_prediction_preflight_runs (ADR section 4.8) — Stage 1 of DEC-FIN-004's two-stage
--    Compute contract: snapshot hash of the whole assumption set analyzed, denormalized
--    findings/required-resolutions counters, superseded_by chain (append-in-spirit — a new preflight
--    after assumptions change supersedes the previous one; old rows/resolutions stay, historical).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_prediction_preflight_runs (
  id                              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id                   TEXT NOT NULL,
  business_version_id                 TEXT NOT NULL,

  assumption_set_semantic_hash          TEXT NOT NULL,
  findings_count                          INTEGER NOT NULL DEFAULT 0 CHECK (findings_count >= 0),
  required_resolutions_count                INTEGER NOT NULL DEFAULT 0 CHECK (required_resolutions_count >= 0),
  superseded_by_preflight_run_id              TEXT REFERENCES finance_prediction_preflight_runs(id),

  run_by                                        TEXT NOT NULL,
  run_at                                          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_prediction_preflight_runs_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_prediction_preflight_runs_version ON finance_prediction_preflight_runs(business_version_id, run_at DESC);

-- At most one CURRENT (non-superseded) preflight run per scenario — same "exactly one open row"
-- partial-unique-index pattern finance_working_revisions (b01) already established for
-- is_current, applied here to "superseded_by_preflight_run_id IS NULL" instead of a boolean flag,
-- to match the ADR's own literal column name.
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_prediction_preflight_runs_current
  ON finance_prediction_preflight_runs (business_version_id)
  WHERE superseded_by_preflight_run_id IS NULL;

-- ============================================================================
-- 9. finance_prediction_preflight_findings (ADR section 4.9, poza doslowna lista z zadania) —
--    normalized child of preflight_runs; without this table finance_prediction_conflict_resolutions
--    has no stable finding_id to FK to ("user decision per konflikt" requires the conflict to be an
--    addressable row, not a JSON array element with no identity/FK/state of its own).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_prediction_preflight_findings (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id               TEXT NOT NULL,
  business_version_id             TEXT NOT NULL,
  preflight_run_id                  TEXT NOT NULL REFERENCES finance_prediction_preflight_runs(id),

  finding_kind                        TEXT NOT NULL CHECK (finding_kind IN (
                                         'OVERLAP_DOUBLE_COUNTING', 'CONTRADICTORY_SIGNS', 'MISSING_REQUIRED_INPUT',
                                         'INCONSISTENT_UNIT', 'ORPHAN_IMPACT_NO_INITIATIVE', 'DUPLICATE_SOURCE_ROW'
                                       )),
  requires_resolution                   BOOLEAN NOT NULL DEFAULT true, -- per-row, not hardcoded per finding_kind (ADR section 4.9 / section 13 escalation #8 — application decision, kept explicit here)

  entity_id                               TEXT REFERENCES finance_stmt_entities(id),
  canonical_line_id                         TEXT REFERENCES financial_statement_lines(id),
  period_id                                   TEXT REFERENCES finance_stmt_periods(period_id),

  involved_sources                              JSONB NOT NULL, -- read-model: list of {source_type, source_id} — source of truth is the actual driver_overrides/impact_chain/financing rows
  combined_impact_decimal                         NUMERIC,
  proposed_resolution_numeric_preview               JSONB, -- numeric preview required explicitly by DEC-FIN-004 / task point 2

  created_at                                          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_prediction_preflight_findings_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_prediction_preflight_findings_run ON finance_prediction_preflight_findings(preflight_run_id);
CREATE INDEX IF NOT EXISTS idx_finance_prediction_preflight_findings_version ON finance_prediction_preflight_findings(business_version_id);

-- ============================================================================
-- 10. finance_prediction_conflict_resolutions (ADR section 4.10) — user decision per finding:
--     accepted the system's proposal or provided a custom one, mandatory rationale either way
--     (DEC-FIN-004: "system nie sumuje konfliktow po cichu" — even accepting the proposal is a
--     decision requiring a trace of "why this is OK"). Materially-flagged resolutions
--     (requires_review=true) go through the same maker-checker infrastructure as the rest of the
--     program (finance_business_versions.risk_tier / DEC-FIN-001), not a new SoD mechanism.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_prediction_conflict_resolutions (
  id                          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id               TEXT NOT NULL,
  business_version_id             TEXT NOT NULL,
  finding_id                        TEXT NOT NULL REFERENCES finance_prediction_preflight_findings(id),

  resolution_choice                   TEXT NOT NULL CHECK (resolution_choice IN ('ACCEPTED_PROPOSED', 'CUSTOM')),
  custom_resolution_detail              TEXT,
  rationale                               TEXT NOT NULL, -- mandatory regardless of resolution_choice (ADR section 4.10)

  requires_review                           BOOLEAN NOT NULL DEFAULT false,
  state                                       TEXT NOT NULL DEFAULT 'RESOLVED' CHECK (state IN ('RESOLVED', 'PENDING_REVIEW', 'REJECTED')),
  reviewed_by                                   TEXT,
  reviewed_at                                     TIMESTAMPTZ,

  resolved_by                                       TEXT NOT NULL,
  resolved_at                                         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_prediction_conflict_resolutions_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT uq_finance_prediction_conflict_resolutions_finding UNIQUE (finding_id),

  CONSTRAINT chk_finance_prediction_conflict_resolutions_custom_detail
    CHECK (resolution_choice != 'CUSTOM' OR (custom_resolution_detail IS NOT NULL AND custom_resolution_detail != '')),

  -- Maker-checker: a materially-flagged, RESOLVED resolution must carry a reviewer (ADR section
  -- 4.10, live-tested TEST 12).
  CONSTRAINT chk_finance_prediction_conflict_resolutions_review
    CHECK (NOT (requires_review AND state = 'RESOLVED') OR reviewed_by IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_finance_prediction_conflict_resolutions_version ON finance_prediction_conflict_resolutions(business_version_id);

COMMIT;
