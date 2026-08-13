-- Finance v3 — Gate D (WP-D03b): Historical Analysis domain schema, part 1/4 — tables.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D03_analysis_schema_ADR.md, sections 4-6.
-- Unlike WP-D01 (which had a literal Zalacznik A DDL sketch to transcribe), this ADR deliberately
-- does NOT carry a separate DDL appendix (ADR "Uwaga o Zalaczniku A", end of file) — every column,
-- CHECK, and trigger name below is taken from the ADR's prose (section 4 per-table, section 5.2-5.5
-- formula AST schema, section 6.2 unit-resolution rules, section 10 literal test messages), the same
-- discipline WP-D01b applied when turning WP-D01's ADR into real SQL
-- (WP-D01b_statements_migration_report.md).
--
-- Depends on (already shipped, Gate B/C/D01, untouched by this file):
--   finance_artifacts, finance_business_versions, finance_value_status enum (b01)
--   finance_lineage_edges (b03) — Analysis -> source Statement Pack Version link, edge_type
--     'STATEMENT_TO_ANALYSIS', already in the CHECK enum, not modified here.
--   finance_stmt_entities, finance_stmt_periods (d01_01) — Analysis reuses these directly, does not
--     project its own entity/period tables (ADR section 2.1).
--   organizations(id)
--
-- Additive only. Zero DROP/RENAME/ALTER ... TYPE on any existing table. All identifiers
-- TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, matching the live-schema convention.
--
-- Split into 4 files matching the ADR's own logical blocks: this file (tables) must run before
-- ..._02_integrity.sql (formula-compile / maker-checker / immutability triggers reference these
-- tables), which must run before ..._03_kpi_p0_catalog.sql (18 P0 KPI INSERTs exercise the compile
-- trigger and the formula_ref cross-row lookup, in dependency order), which must run before
-- ..._04_readiness.sql (readiness-gate functions query all of the above). Filename suffix
-- 01/02/03/04 pins the deterministic same-date filename sort order the migration runner uses
-- (server/scripts/migrate.postgres.ts).

BEGIN;

-- ============================================================================
-- 1. finance_analysis_kpi_catalog — three-tier KPI catalog (UNIVERSAL/INDUSTRY/ORG_CUSTOM),
--    versioned formula-as-AST, own lightweight lifecycle (DRAFT/ACTIVE/DEPRECATED — NOT a full
--    finance_business_versions row; ADR section 5.1 explains and rejects that alternative:
--    a catalog entry is shared master/config data read by many organizations at once, not a
--    single-org work artifact).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_analysis_kpi_catalog (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kpi_code                   TEXT NOT NULL,
  catalog_version               INTEGER NOT NULL DEFAULT 1,
  status                          TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'DEPRECATED')),
  superseded_by_id                  TEXT REFERENCES finance_analysis_kpi_catalog(id),

  tier                                 TEXT NOT NULL CHECK (tier IN ('UNIVERSAL', 'INDUSTRY', 'ORG_CUSTOM')),
  industry_code                          TEXT,
  organization_id                          TEXT REFERENCES organizations(id),

  category                                   TEXT NOT NULL CHECK (category IN (
                                                'LIQUIDITY', 'PROFITABILITY', 'LEVERAGE', 'COVERAGE',
                                                'EFFICIENCY', 'CASH_FLOW', 'GROWTH', 'RETURNS'
                                              )),
  kpi_name                                     TEXT NOT NULL,
  description                                    TEXT,

  -- Author-declared OUTPUT type, cross-checked at write time (section 2/3 below, file 02) against
  -- what the formula AST actually resolves to structurally. Mismatch = COMPILE_ERROR (or a rejected
  -- write, if the row is being activated) — never a silent wrong-unit save.
  unit_type                                        TEXT NOT NULL CHECK (unit_type IN (
                                                      'RATIO', 'PERCENT', 'MULTIPLE', 'DAYS', 'MONETARY', 'COUNT'
                                                    )),
  formula_ast                                        JSONB NOT NULL,
  compile_status                                       TEXT CHECK (compile_status IN ('COMPILED_OK', 'COMPILE_ERROR')),
  resolved_output_unit                                   TEXT,

  period_convention                                        TEXT NOT NULL CHECK (period_convention IN (
                                                                'POINT_IN_TIME', 'AVERAGE_BALANCE', 'LTM',
                                                                'INTERIM_ANNUALIZED', 'FLOW_PERIOD'
                                                              )),
  -- NULL is legitimate here (ADR section 5.3 row 13, CASH_CONVERSION_CYCLE: "n/a (add/subtract, not
  -- a ratio)") — only ratio-shaped KPI carry a negative-denominator policy.
  negative_denominator_policy                                TEXT CHECK (negative_denominator_policy IN (
                                                                'SHOW_WITH_FLAG', 'FORCE_NA'
                                                              )),
  required_canonical_line_codes                                TEXT[] NOT NULL DEFAULT '{}',

  created_by                                                     TEXT NOT NULL,
  approved_by                                                      TEXT,
  created_at                                                         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                                           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- "Exactly one dimension set" per tier (ADR section 4.2, same pattern as finance_stmt_periods'
  -- per-period_type shape CHECKs, WP-D01 section 4.2).
  CONSTRAINT chk_finance_analysis_kpi_catalog_tier_dims CHECK (
    (tier = 'UNIVERSAL' AND industry_code IS NULL AND organization_id IS NULL)
    OR (tier = 'INDUSTRY' AND industry_code IS NOT NULL AND organization_id IS NULL)
    OR (tier = 'ORG_CUSTOM' AND organization_id IS NOT NULL AND industry_code IS NULL)
  )
);

-- "Jeden APPROVED per artefakt" pattern (uq_finance_bv_one_approved, WP-B01 section 2.2) applied
-- to KPI definitions instead of artifacts: at most one ACTIVE row per kpi_code at any time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_analysis_kpi_catalog_active_code
  ON finance_analysis_kpi_catalog (kpi_code) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_finance_analysis_kpi_catalog_code ON finance_analysis_kpi_catalog(kpi_code, catalog_version);
CREATE INDEX IF NOT EXISTS idx_finance_analysis_kpi_catalog_tier ON finance_analysis_kpi_catalog(tier, organization_id);

-- ============================================================================
-- 2. finance_analysis_definitions — one row per Analysis Definition Version
--    (= one finance_business_versions row with finance_artifacts.artifact_type='HISTORICAL_ANALYSIS').
--    Deliberately NO source Statement Pack Version column (ADR section 2.3: that relationship lives
--    exclusively in finance_lineage_edges, edge_type='STATEMENT_TO_ANALYSIS', to avoid a second,
--    unsynchronized source of truth about the same fact) and NO periods/KPI-selection column (ADR
--    section 4.4: selection = presence of a finance_analysis_kpi_values row).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_analysis_definitions (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id            TEXT NOT NULL,
  business_version_id          TEXT NOT NULL,

  purpose                        TEXT NOT NULL CHECK (purpose IN (
                                    'INTERNAL_REVIEW', 'INVESTOR_REPORTING', 'LENDER_COVENANT',
                                    'ACQUISITION_DILIGENCE', 'BENCHMARKING', 'BOARD_REPORTING'
                                  )),
  industry_code                    TEXT,
  analysis_type                      TEXT NOT NULL CHECK (analysis_type IN (
                                        'STANDARD', 'DEEP_DIVE', 'COVENANT_FOCUSED', 'BENCHMARK_FOCUSED'
                                      )),

  entity_scope_mode                    TEXT NOT NULL CHECK (entity_scope_mode IN ('GROUP_CONSOLIDATED', 'SINGLE_ENTITY')),
  entity_code                            TEXT, -- required when entity_scope_mode='SINGLE_ENTITY'; validated against the source Statement Pack Version's finance_stmt_entities by the readiness gate (cross-version lookup, not a CHECK — ADR section 4.1)

  presentation_currency                    TEXT NOT NULL, -- ISO 4217
  unit                                        TEXT NOT NULL CHECK (unit IN ('UNITS', 'THOUSANDS', 'MILLIONS', 'BILLIONS')),

  created_by                                    TEXT NOT NULL,
  created_at                                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_analysis_def_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT uq_finance_analysis_def_bv UNIQUE (business_version_id),

  CONSTRAINT chk_finance_analysis_def_entity_scope
    CHECK (entity_scope_mode = 'GROUP_CONSOLIDATED' OR entity_code IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_finance_analysis_def_org ON finance_analysis_definitions(organization_id);

-- ============================================================================
-- 3. finance_analysis_kpi_values — value per KPI per period. Adopts the WP-B01 section 2.7
--    mandatory value-cell bundle verbatim (value_status/value_decimal/native_currency/
--    presentation_currency/unit/multiplier/source_ref/is_adjustment/adjustment_reason), exactly
--    like finance_stmt_lines did (WP-D01 section 4.3), plus domain-specific quality_flag/delta/
--    interpretation columns.
--
--    kpi_catalog_id points at a SPECIFIC catalog_version row (finance_analysis_kpi_catalog.id),
--    not at kpi_code — reproducibility: once a newer catalog_version goes ACTIVE, historical values
--    keep pointing at the exact formula that actually produced them (ADR section 4.3).
--
--    uq_finance_analysis_kpi_values_cell mirrors uq_finance_stmt_lines_cell's shape (business
--    version + rowKey{entityId,kpiCatalogId} + columnKey{periodId}).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_analysis_kpi_values (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id            TEXT NOT NULL,
  business_version_id          TEXT NOT NULL,
  kpi_catalog_id                 TEXT NOT NULL REFERENCES finance_analysis_kpi_catalog(id),
  entity_id                        TEXT NOT NULL REFERENCES finance_stmt_entities(id),
  period_id                          TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),

  -- WP-B01 section 2.7 mandatory bundle:
  value_status                         finance_value_status NOT NULL DEFAULT 'MISSING',
  value_decimal                          NUMERIC,
  native_currency                          TEXT,
  presentation_currency                      TEXT,
  unit                                         TEXT CHECK (unit IN ('UNITS', 'THOUSANDS', 'MILLIONS', 'BILLIONS')),
  multiplier                                     NUMERIC NOT NULL DEFAULT 1,
  source_ref                                       JSONB,
  is_adjustment                                      BOOLEAN NOT NULL DEFAULT false,
  adjustment_reason                                    TEXT,

  -- Domain-specific:
  quality_flag                                           TEXT CHECK (quality_flag IN (
                                                              'DIVISION_BY_ZERO', 'NEGATIVE_DENOMINATOR',
                                                              'INSUFFICIENT_HISTORY', 'ESTIMATED_ANNUALIZED'
                                                            )),
  delta_vs_prior_period                                    NUMERIC,
  delta_pct_vs_prior_period                                  NUMERIC,
  interpretation_text                                          TEXT,

  created_by                                                     TEXT,
  created_at                                                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                                         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_analysis_kpi_values_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT uq_finance_analysis_kpi_values_cell
    UNIQUE (business_version_id, kpi_catalog_id, entity_id, period_id),

  -- Same value_status <-> value_decimal shape as chk_finance_stmt_lines_value_shape (WP-D01 4.3).
  CONSTRAINT chk_finance_analysis_kpi_values_value_shape CHECK (
    (value_status = 'PRESENT_NONZERO' AND value_decimal IS NOT NULL AND value_decimal != 0)
    OR (value_status = 'PRESENT_ZERO' AND value_decimal = 0)
    OR (value_status IN ('MISSING', 'NA', 'NOT_APPLICABLE') AND value_decimal IS NULL)
  ),
  CONSTRAINT chk_finance_analysis_kpi_values_adjustment_reason
    CHECK (NOT is_adjustment OR adjustment_reason IS NOT NULL),

  -- ADR section 4.3 / 6.5: physically impossible to save "0.5 but flagged as a division by zero".
  -- Same-row logic only (no cross-row lookup needed), so a plain CHECK, not a trigger.
  CONSTRAINT chk_finance_analysis_kpi_values_division_by_zero_shape CHECK (
    quality_flag IS DISTINCT FROM 'DIVISION_BY_ZERO' OR value_status = 'NOT_APPLICABLE'
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_analysis_kpi_values_version ON finance_analysis_kpi_values(business_version_id);
CREATE INDEX IF NOT EXISTS idx_finance_analysis_kpi_values_entity_period ON finance_analysis_kpi_values(entity_id, period_id);
CREATE INDEX IF NOT EXISTS idx_finance_analysis_kpi_values_catalog ON finance_analysis_kpi_values(kpi_catalog_id);

-- ============================================================================
-- 4. finance_analysis_benchmarks — peer set / source / date / percentile, frozen per Analysis
--    Definition Version ("aligned as-of", same convention as finance_stmt_fx — ADR section 4 point
--    4 — which likewise carries no separate content-freeze trigger of its own; freeze is a
--    convention on write path, not enforced independently per this ADR's own scope).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_analysis_benchmarks (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id            TEXT NOT NULL,
  business_version_id          TEXT NOT NULL,
  kpi_catalog_id                 TEXT NOT NULL REFERENCES finance_analysis_kpi_catalog(id),

  peer_set_definition               TEXT NOT NULL,
  source_name                         TEXT NOT NULL,
  source_license                        TEXT,
  as_of_date                              DATE NOT NULL,
  normalization_method                      TEXT,

  p25                                         NUMERIC,
  median                                        NUMERIC,
  p75                                             NUMERIC,
  target_min                                        NUMERIC,
  target_max                                          NUMERIC,

  created_by                                            TEXT,
  created_at                                              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_analysis_benchmarks_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT uq_finance_analysis_benchmarks UNIQUE (business_version_id, kpi_catalog_id, source_name, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_finance_analysis_benchmarks_version ON finance_analysis_benchmarks(business_version_id);

-- ============================================================================
-- 5. finance_analysis_variance — actual vs prior/budget/forecast, HYBRID immutability: numeric
--    facts frozen once the parent business_version reaches APPROVED, but owner/comment/action/
--    due_date/status/resolved_* stay editable (ADR section 4 point 5, section 10 TEST F/G) — the
--    same allow-list pattern finance_business_versions itself already uses for its own row
--    (finance_bv_enforce_immutability, WP-B01 migration), here applied to a CONTENT table for the
--    first time in Gate D (WP-D01 only ever had binary immutability, no partially-mutable content
--    table).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_analysis_variance (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id            TEXT NOT NULL,
  business_version_id          TEXT NOT NULL,
  kpi_catalog_id                 TEXT REFERENCES finance_analysis_kpi_catalog(id),
  entity_id                        TEXT REFERENCES finance_stmt_entities(id),
  period_id                          TEXT REFERENCES finance_stmt_periods(period_id),

  comparison_type                      TEXT NOT NULL CHECK (comparison_type IN ('PRIOR_PERIOD', 'BUDGET', 'FORECAST')),
  actual_value                           NUMERIC,
  comparison_value                         NUMERIC,
  variance_abs                               NUMERIC,
  variance_pct                                 NUMERIC,

  -- Editable after APPROVED (hybrid immutability allow-list, file 02):
  owner                                           TEXT,
  comment                                           TEXT,
  action                                              TEXT,
  due_date                                              DATE,
  status                                                  TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN (
                                                             'OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED'
                                                           )),
  resolved_by                                               TEXT,
  resolved_at                                                 TIMESTAMPTZ,

  created_by                                                    TEXT,
  created_at                                                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                                        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_analysis_variance_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_finance_analysis_variance_version ON finance_analysis_variance(business_version_id);
CREATE INDEX IF NOT EXISTS idx_finance_analysis_variance_status ON finance_analysis_variance(business_version_id, status);

COMMIT;
