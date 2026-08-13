-- Finance v3 — Gate D (WP-D01b): Statements Truth Engine domain schema, part 1/3 — tables.
--
-- Source: docs/validation/finance-v3/generated/gate-d/WP-D01_statements_schema_ADR.md, Zalacznik A,
-- block 1 (7 tables). Turns the ADR's live-tested DDL sketch into a real, additive migration —
-- same discipline WP-C01 applied to the 7 Gate B ADRs
-- (docs/validation/finance-v3/generated/gate-c/WP-C01_migration_report.md).
--
-- Depends on (already shipped, Gate B/C, untouched by this file):
--   finance_artifacts, finance_business_versions, finance_working_revisions (b01)
--   finance_value_status enum (b01)
--   finance_lineage_edges, finance_artifact_stage_rank() (b03)
--   finance_exceptions, finance_reconciliation_runs (b05)
--   finance_business_versions.version_kind/restatement_reason/restatement_class (b06)
--   financial_statement_lines (Gate A legacy taxonomy, AUTO_MIGRATE, reused as-is)
--   organizations(id)
--
-- Additive only. Zero DROP/RENAME/ALTER ... TYPE on any existing table (Gate A's ~60 Finance
-- tables, or any other table). All identifiers TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
-- matching the live-schema convention WP-C01 already established (organizations(id) is TEXT).
--
-- Split into 3 files matching the ADR's own execution order (section "Kolejność wykonania",
-- Zalacznik A): this file (tables, one transaction) must run before
-- ..._02_statements_integrity.sql (functions/triggers reference these tables) and
-- ..._03_statements_readiness.sql (readiness-gate functions query these tables). Filename suffix
-- 01/02/03 pins the deterministic same-date filename sort order the migration runner uses
-- (server/scripts/migrate.postgres.ts) so they always apply in the required order.
--
-- Discrepancies vs. the literal ADR sketch: none in this file — the DDL below is transcribed
-- verbatim from the ADR's Zalacznik A block 1 (already live-tested by the ADR author on an
-- ephemeral cluster). See WP-D01b_statements_migration_report.md section 6 for the full
-- discrepancy list (all in files 02/03, none here).

BEGIN;

-- ============================================================================
-- 1. finance_stmt_calendars — fiscal calendar definitions.
--    Claims ownership of "fiscal_calendar_id" flagged as an unassigned forward
--    reference by WP-B06 section 10.3 ("prawdopodobnie WP-D01... WP-D01
--    potwierdza właścicielstwo przy swoim starcie").
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_stmt_calendars (
  fiscal_calendar_id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id             TEXT NOT NULL REFERENCES organizations(id),
  entity_code                   TEXT, -- NULL = organization default calendar; else scoped to one entity_code (soft key, see ADR section 10.1 on why finance_stmt_entities has no separate master row)
  calendar_type                   TEXT NOT NULL CHECK (calendar_type IN ('STANDARD', 'FOUR_FOUR_FIVE', 'FIFTY_THREE_WEEK')),
  fiscal_year_end_month              INTEGER NOT NULL CHECK (fiscal_year_end_month BETWEEN 1 AND 12),
  fiscal_year_end_reference             TEXT NOT NULL DEFAULT 'LAST_DAY_OF_MONTH'
                                           CHECK (fiscal_year_end_reference IN ('LAST_DAY_OF_MONTH', 'NEAREST_WEEKDAY')),
  fiscal_year_end_weekday                 INTEGER CHECK (fiscal_year_end_weekday BETWEEN 0 AND 6),
  four_four_five_pattern                    TEXT CHECK (four_four_five_pattern IN ('445', '454', '544')),
  effective_from                              DATE NOT NULL,
  effective_to                                  DATE,
  created_by                                     TEXT NOT NULL,
  created_at                                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_finance_stmt_cal_weekday_required
    CHECK (fiscal_year_end_reference = 'LAST_DAY_OF_MONTH' OR fiscal_year_end_weekday IS NOT NULL),
  CONSTRAINT chk_finance_stmt_cal_445_required
    CHECK (calendar_type != 'FOUR_FOUR_FIVE' OR four_four_five_pattern IS NOT NULL),
  CONSTRAINT chk_finance_stmt_cal_effective_range
    CHECK (effective_to IS NULL OR effective_to > effective_from),

  CONSTRAINT uq_finance_stmt_cal_scope UNIQUE (organization_id, entity_code, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_finance_stmt_cal_org ON finance_stmt_calendars(organization_id, entity_code);

-- ============================================================================
-- 2. finance_stmt_periods — fiscal period windows (FY/Q/month/week; stub-aware).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_stmt_periods (
  period_id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id             TEXT NOT NULL REFERENCES organizations(id),
  fiscal_calendar_id            TEXT NOT NULL REFERENCES finance_stmt_calendars(fiscal_calendar_id),
  period_type                     TEXT NOT NULL CHECK (period_type IN ('FY', 'Q', 'MONTH', 'WEEK')),
  fiscal_year                       INTEGER NOT NULL,
  fiscal_quarter                      INTEGER CHECK (fiscal_quarter BETWEEN 1 AND 4),
  fiscal_month                          INTEGER CHECK (fiscal_month BETWEEN 1 AND 12),
  fiscal_week                             INTEGER CHECK (fiscal_week BETWEEN 1 AND 53),
  period_start                              DATE NOT NULL,
  period_end                                  DATE NOT NULL,
  is_stub                                       BOOLEAN NOT NULL DEFAULT false,
  stub_reason                                     TEXT,
  label                                             TEXT NOT NULL,
  previous_period_id                                  TEXT REFERENCES finance_stmt_periods(period_id), -- explicit chain link for roll-forward checks (section 5.2/5.3) instead of a period_end heuristic, robust across 4-4-5/53-week/stub boundaries
  created_by                                          TEXT NOT NULL,
  created_at                                            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_finance_stmt_period_range CHECK (period_end > period_start),
  CONSTRAINT chk_finance_stmt_period_stub_reason CHECK (NOT is_stub OR stub_reason IS NOT NULL),

  -- Exactly one dimension set per period_type; the other two stay NULL (enforced per-type below).
  CONSTRAINT chk_finance_stmt_period_fy_shape
    CHECK (period_type != 'FY' OR (fiscal_quarter IS NULL AND fiscal_month IS NULL AND fiscal_week IS NULL)),
  CONSTRAINT chk_finance_stmt_period_q_shape
    CHECK (period_type != 'Q' OR (fiscal_quarter IS NOT NULL AND fiscal_month IS NULL AND fiscal_week IS NULL)),
  CONSTRAINT chk_finance_stmt_period_month_shape
    CHECK (period_type != 'MONTH' OR (fiscal_month IS NOT NULL AND fiscal_quarter IS NULL AND fiscal_week IS NULL)),
  CONSTRAINT chk_finance_stmt_period_week_shape
    CHECK (period_type != 'WEEK' OR (fiscal_week IS NOT NULL AND fiscal_quarter IS NULL AND fiscal_month IS NULL))
);

-- Postgres UNIQUE treats NULL as distinct, so a single composite UNIQUE across all four
-- period_type shapes would NOT catch two identical FY rows (fiscal_quarter/month/week all
-- NULL on both). Four partial unique indexes, one per period_type, close that gap.
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_stmt_period_fy
  ON finance_stmt_periods (fiscal_calendar_id, fiscal_year) WHERE period_type = 'FY';
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_stmt_period_q
  ON finance_stmt_periods (fiscal_calendar_id, fiscal_year, fiscal_quarter) WHERE period_type = 'Q';
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_stmt_period_month
  ON finance_stmt_periods (fiscal_calendar_id, fiscal_year, fiscal_month) WHERE period_type = 'MONTH';
CREATE UNIQUE INDEX IF NOT EXISTS uq_finance_stmt_period_week
  ON finance_stmt_periods (fiscal_calendar_id, fiscal_year, fiscal_week) WHERE period_type = 'WEEK';

CREATE INDEX IF NOT EXISTS idx_finance_stmt_period_range ON finance_stmt_periods(fiscal_calendar_id, period_start, period_end);

-- WEEK period_type only makes sense for 4-4-5/53-week calendars; cross-table, needs a trigger.
CREATE OR REPLACE FUNCTION finance_stmt_period_check_week_calendar() RETURNS TRIGGER AS $$
DECLARE v_calendar_type TEXT;
BEGIN
  IF NEW.period_type = 'WEEK' THEN
    SELECT calendar_type INTO v_calendar_type FROM finance_stmt_calendars WHERE fiscal_calendar_id = NEW.fiscal_calendar_id;
    IF v_calendar_type NOT IN ('FOUR_FOUR_FIVE', 'FIFTY_THREE_WEEK') THEN
      RAISE EXCEPTION 'finance_stmt_periods: WEEK period_type requires a FOUR_FOUR_FIVE/FIFTY_THREE_WEEK calendar, got %', v_calendar_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_stmt_period_check_week_calendar ON finance_stmt_periods;
CREATE TRIGGER trg_finance_stmt_period_check_week_calendar
  BEFORE INSERT OR UPDATE ON finance_stmt_periods
  FOR EACH ROW EXECUTE FUNCTION finance_stmt_period_check_week_calendar();

-- ============================================================================
-- 3. finance_stmt_entities — legal entity + consolidation perimeter, scoped to
--    ONE Statement Pack business_version_id (perimeter changes every period:
--    acquisitions/disposals/step-up/step-down are period-scoped facts, not
--    org-level master data — see ADR section 10.1 for the rejected alternative).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_stmt_entities (
  id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id              TEXT NOT NULL,
  business_version_id            TEXT NOT NULL,

  entity_code                      TEXT NOT NULL, -- stable natural key across versions/periods for the same legal entity
  legal_name                         TEXT NOT NULL,
  jurisdiction                         TEXT,

  role                                   TEXT NOT NULL CHECK (role IN (
                                            'GROUP_PARENT', 'SUBSIDIARY', 'ASSOCIATE', 'JOINT_VENTURE', 'ELIMINATION_BUCKET'
                                          )),
  parent_entity_row_id                     TEXT REFERENCES finance_stmt_entities(id),
  consolidation_method                       TEXT NOT NULL CHECK (consolidation_method IN (
                                                'FULL', 'PROPORTIONAL', 'EQUITY_METHOD', 'NOT_CONSOLIDATED'
                                              )),
  ownership_pct                                NUMERIC(7,4) CHECK (ownership_pct >= 0 AND ownership_pct <= 100),
  nci_pct                                        NUMERIC(7,4) GENERATED ALWAYS AS (
                                                    CASE WHEN consolidation_method = 'FULL'
                                                         THEN GREATEST(0, 100 - COALESCE(ownership_pct, 100))
                                                         ELSE 0 END
                                                  ) STORED,

  functional_currency                              TEXT NOT NULL, -- ISO 4217

  perimeter_event                                    TEXT NOT NULL DEFAULT 'NONE' CHECK (perimeter_event IN (
                                                        'NONE', 'ACQUISITION', 'DISPOSAL', 'STEP_UP', 'STEP_DOWN', 'ORGANIC'
                                                      )),
  perimeter_event_date                                 DATE,
  discontinued_operation                                 BOOLEAN NOT NULL DEFAULT false,

  created_by                                               TEXT NOT NULL,
  created_at                                                 TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_stmt_entities_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT uq_finance_stmt_entities_version_code UNIQUE (business_version_id, entity_code),

  CONSTRAINT chk_finance_stmt_entities_parent_shape
    CHECK (role NOT IN ('GROUP_PARENT', 'ELIMINATION_BUCKET') OR parent_entity_row_id IS NULL),
  CONSTRAINT chk_finance_stmt_entities_ownership_required
    CHECK (consolidation_method = 'NOT_CONSOLIDATED' OR role = 'ELIMINATION_BUCKET' OR ownership_pct IS NOT NULL),
  CONSTRAINT chk_finance_stmt_entities_elimination_shape
    CHECK (role != 'ELIMINATION_BUCKET' OR (consolidation_method = 'NOT_CONSOLIDATED' AND ownership_pct IS NULL)),
  CONSTRAINT chk_finance_stmt_entities_perimeter_event_date
    CHECK (perimeter_event = 'NONE' OR perimeter_event_date IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_finance_stmt_entities_version ON finance_stmt_entities(business_version_id);
CREATE INDEX IF NOT EXISTS idx_finance_stmt_entities_code ON finance_stmt_entities(organization_id, entity_code);

-- ============================================================================
-- 4. finance_stmt_fx — transaction/functional/presentation currency rates,
--    frozen per Statement Pack Version (rates must not silently drift once a
--    version is Approved — same "aligned as-of" requirement as market data).
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_stmt_fx (
  fx_rate_id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id              TEXT NOT NULL,
  business_version_id            TEXT NOT NULL,
  period_id                        TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),

  from_currency                      TEXT NOT NULL, -- ISO 4217
  to_currency                          TEXT NOT NULL, -- ISO 4217
  rate_type                              TEXT NOT NULL CHECK (rate_type IN ('AVERAGE', 'CLOSING', 'HISTORICAL')),
  rate                                     NUMERIC NOT NULL CHECK (rate > 0),
  rate_source                                TEXT, -- e.g. 'NBP', 'ECB', 'manual_override:<user>'; forward-ref only, no market-data FK (owner not yet assigned, WP-B06 §10.3)
  as_of                                        TIMESTAMPTZ NOT NULL,

  created_by                                     TEXT NOT NULL,
  created_at                                       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_stmt_fx_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT chk_finance_stmt_fx_pair CHECK (from_currency != to_currency),
  CONSTRAINT uq_finance_stmt_fx UNIQUE (business_version_id, period_id, from_currency, to_currency, rate_type)
);

CREATE INDEX IF NOT EXISTS idx_finance_stmt_fx_version ON finance_stmt_fx(business_version_id, period_id);

-- ============================================================================
-- 5. finance_stmt_lines — the statement value table (P&L/BS/CF cells).
--    Adopts the mandatory value-cell column bundle from WP-B01 section 2.7
--    verbatim (value_status/value_decimal/native_currency/presentation_currency/
--    unit/multiplier/period_id/entity_id/source_ref/is_adjustment/adjustment_reason),
--    plus Statements-domain-specific columns.
--
--    uq_finance_stmt_lines_cell is the exact constraint AP-00's CellRef
--    (server/src/types/finance/CellRef.ts) and AP-01/AP-04
--    (server/src/services/finance/grid/, .../collaboration/) already assume —
--    see WP-D01b_statements_migration_report.md section "AP-01/AP-04
--    compatibility" for the column-by-column check.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_stmt_lines (
  id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id              TEXT NOT NULL,
  business_version_id            TEXT NOT NULL,

  statement_type                   TEXT NOT NULL CHECK (statement_type IN ('P&L', 'BS', 'CF')),
  canonical_line_id                  TEXT NOT NULL REFERENCES financial_statement_lines(id), -- reuse Gate A taxonomy (AUTO_MIGRATE), not duplicated
  entity_id                            TEXT NOT NULL REFERENCES finance_stmt_entities(id),
  period_id                              TEXT NOT NULL REFERENCES finance_stmt_periods(period_id),
  accumulation_basis                       TEXT NOT NULL DEFAULT 'FULL_YEAR' CHECK (accumulation_basis IN (
                                              'QUARTER_ONLY', 'YTD', 'LTM', 'FULL_YEAR'
                                            )),
  consolidation_scope                        TEXT NOT NULL DEFAULT 'CONSOLIDATED' CHECK (consolidation_scope IN (
                                                'STANDALONE', 'CONSOLIDATED', 'ELIMINATION'
                                              )),

  -- WP-B01 section 2.7 mandatory bundle:
  value_status                                 finance_value_status NOT NULL DEFAULT 'MISSING',
  value_decimal                                  NUMERIC,
  native_currency                                  TEXT NOT NULL, -- ISO 4217, currency the source figure was denominated in
  presentation_currency                              TEXT NOT NULL, -- ISO 4217, currency after translation for group reporting
  unit                                                 TEXT NOT NULL CHECK (unit IN ('UNITS', 'THOUSANDS', 'MILLIONS', 'BILLIONS')),
  multiplier                                             NUMERIC NOT NULL DEFAULT 1, -- scale factor applied on top of `unit`, e.g. FX-translation rounding residual absorption; 1 by default
  source_ref                                               JSONB, -- {source_document_ref, page, row, raw_label}; superset feeds finance_stmt_source_evidence
  is_adjustment                                              BOOLEAN NOT NULL DEFAULT false,
  adjustment_reason                                            TEXT,

  -- Statements-domain-specific:
  sign_convention                                                TEXT NOT NULL DEFAULT 'NATURAL' CHECK (sign_convention IN ('NATURAL', 'CONTRA')),
  accounting_policy                                                TEXT NOT NULL CHECK (accounting_policy IN ('IFRS', 'LOCAL_GAAP', 'US_GAAP')),
  ifrs16_treatment                                                   TEXT CHECK (ifrs16_treatment IN ('APPLIED', 'NOT_APPLICABLE', 'EXEMPT')),
  discontinued_operations                                              BOOLEAN NOT NULL DEFAULT false,
  exceptional_item                                                       BOOLEAN NOT NULL DEFAULT false,
  reclassified_from_line_id                                                TEXT REFERENCES finance_stmt_lines(id),

  created_by                                                                 TEXT NOT NULL,
  created_at                                                                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                                                                     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_stmt_lines_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  -- WP-B01 2.7 value_status <-> value_decimal shape, enforced here per-table as instructed.
  CONSTRAINT chk_finance_stmt_lines_value_shape CHECK (
    (value_status = 'PRESENT_NONZERO' AND value_decimal IS NOT NULL AND value_decimal != 0)
    OR (value_status = 'PRESENT_ZERO' AND value_decimal = 0)
    OR (value_status IN ('MISSING', 'NA', 'NOT_APPLICABLE') AND value_decimal IS NULL)
  ),
  CONSTRAINT chk_finance_stmt_lines_adjustment_reason CHECK (NOT is_adjustment OR adjustment_reason IS NOT NULL),

  -- One authoritative cell per dimensional combination — the "stable canonical key"
  -- the Finance Data Grid (master plan section 10) addresses cells by, and the exact
  -- constraint AP-00's CellRef.ts maps onto (rowKey {entityId, canonicalLineId,
  -- consolidationScope} x columnKey {periodId, accumulationBasis}).
  CONSTRAINT uq_finance_stmt_lines_cell UNIQUE (
    business_version_id, entity_id, canonical_line_id, period_id, accumulation_basis, consolidation_scope
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_stmt_lines_version ON finance_stmt_lines(business_version_id, statement_type);
CREATE INDEX IF NOT EXISTS idx_finance_stmt_lines_entity_period ON finance_stmt_lines(entity_id, period_id);
CREATE INDEX IF NOT EXISTS idx_finance_stmt_lines_canonical ON finance_stmt_lines(canonical_line_id);

-- Content freeze once the parent business_version is APPROVED — finance_business_versions'
-- own immutability trigger (B01 §2.4) only protects that one row; every Gate D content table
-- needs the equivalent guard against its own parent lookup (documented, not silent — same
-- "no subquery-in-CHECK, route to a trigger" pattern the B01/B03/B05 trigger authors already used).
CREATE OR REPLACE FUNCTION finance_stmt_lines_enforce_parent_immutability() RETURNS TRIGGER AS $$
DECLARE v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM finance_business_versions
    WHERE business_version_id = COALESCE(NEW.business_version_id, OLD.business_version_id);
  IF v_status = 'APPROVED' THEN
    RAISE EXCEPTION 'finance_stmt_lines: parent business_version % is APPROVED and immutable; % not permitted',
      COALESCE(NEW.business_version_id, OLD.business_version_id), TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_stmt_lines_parent_immutability ON finance_stmt_lines;
CREATE TRIGGER trg_finance_stmt_lines_parent_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON finance_stmt_lines
  FOR EACH ROW EXECUTE FUNCTION finance_stmt_lines_enforce_parent_immutability();

-- ============================================================================
-- 6. finance_stmt_reconciliation — per-row/bucket waterfall detail. Rolls up
--    INTO an existing finance_reconciliation_runs row (Gate B/C, already
--    shipped as the artifact-level aggregate) rather than re-deriving the
--    waterfall shape; this table supplies the row-level detail that aggregate
--    does not carry.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_stmt_reconciliation (
  id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id              TEXT NOT NULL,
  business_version_id            TEXT NOT NULL,
  reconciliation_run_id            TEXT NOT NULL REFERENCES finance_reconciliation_runs(id),

  source_row_ref                     JSONB NOT NULL, -- {source_document_ref, page, row, raw_label}
  canonical_line_id                    TEXT REFERENCES financial_statement_lines(id), -- NULL until mapped
  entity_id                              TEXT REFERENCES finance_stmt_entities(id),
  period_id                                TEXT REFERENCES finance_stmt_periods(period_id),

  bucket                                     TEXT NOT NULL CHECK (bucket IN (
                                                'MAPPED', 'EXCLUDED', 'UNMAPPED', 'DUPLICATE', 'RECLASS', 'ELIMINATION', 'CANONICAL'
                                              )),
  source_amount                                NUMERIC NOT NULL,
  mapped_amount                                  NUMERIC, -- amount actually contributed to the canonical total; NULL for EXCLUDED/UNMAPPED/DUPLICATE (contribute 0 by definition)

  duplicate_of_row_id                              TEXT REFERENCES finance_stmt_reconciliation(id),
  reclass_target_line_id                             TEXT REFERENCES financial_statement_lines(id),
  elimination_counterparty_entity_id                   TEXT REFERENCES finance_stmt_entities(id),

  reason_code                                            TEXT,
  notes                                                    TEXT,

  created_by                                                 TEXT NOT NULL,
  created_at                                                   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_stmt_recon_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT chk_finance_stmt_recon_duplicate CHECK (bucket != 'DUPLICATE' OR duplicate_of_row_id IS NOT NULL),
  CONSTRAINT chk_finance_stmt_recon_reclass CHECK (bucket != 'RECLASS' OR reclass_target_line_id IS NOT NULL),
  CONSTRAINT chk_finance_stmt_recon_elimination CHECK (bucket != 'ELIMINATION' OR elimination_counterparty_entity_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_finance_stmt_recon_run ON finance_stmt_reconciliation(reconciliation_run_id, bucket);
CREATE INDEX IF NOT EXISTS idx_finance_stmt_recon_version ON finance_stmt_reconciliation(business_version_id);

-- ============================================================================
-- 7. finance_stmt_source_evidence — per row/cell provenance. Extends the Gate A
--    financial_statement_value_evidence shape with the page/bbox capture the
--    extractor today leaves NULL (a known, confirmed-live gap, session memory
--    "p4-apator-realny-upload-2026-08-06"), targeting the new finance_stmt_lines
--    cell instead of legacy financial_statement_values.
-- ============================================================================
CREATE TABLE IF NOT EXISTS finance_stmt_source_evidence (
  id                         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id              TEXT NOT NULL,
  business_version_id            TEXT NOT NULL,
  stmt_line_id                     TEXT NOT NULL REFERENCES finance_stmt_lines(id),

  evidence_type                      TEXT NOT NULL CHECK (evidence_type IN (
                                        'SOURCE_DOCUMENT_CELL', 'AGGREGATED', 'DERIVED_FORMULA', 'MANUAL_OVERRIDE', 'RECONCILIATION_ADJUSTMENT'
                                      )),
  source_document_ref                  TEXT, -- opaque pointer into ingest storage; no FK (source doc tables are Gate A legacy, not yet migrated)
  source_page                            INTEGER,
  source_row                               INTEGER,
  bbox                                       JSONB, -- {x0,y0,x1,y1,page}; NEW column closing the confirmed-live extractor gap
  raw_label                                    TEXT,
  raw_value                                      TEXT,
  confidence                                       NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  contribution_weight                                NUMERIC NOT NULL DEFAULT 1,
  explanation                                          TEXT,

  created_by                                             TEXT NOT NULL,
  created_at                                               TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_finance_stmt_evidence_bv_org
    FOREIGN KEY (business_version_id, organization_id)
    REFERENCES finance_business_versions (business_version_id, organization_id),

  CONSTRAINT chk_finance_stmt_evidence_derivation CHECK (
    evidence_type NOT IN ('DERIVED_FORMULA', 'MANUAL_OVERRIDE', 'RECONCILIATION_ADJUSTMENT') OR explanation IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_stmt_evidence_line ON finance_stmt_source_evidence(stmt_line_id);
CREATE INDEX IF NOT EXISTS idx_finance_stmt_evidence_version ON finance_stmt_source_evidence(business_version_id);

COMMIT;
