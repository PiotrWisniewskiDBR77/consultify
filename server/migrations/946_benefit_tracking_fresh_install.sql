-- ROI-E007 closeout CO-3 — make `benefit_tracking` exist on a strict fresh install.
--
-- WHY THIS FILE EXISTS
-- --------------------
-- `benefit_tracking` had exactly ONE producer in the repo:
-- `server/migrations/067_economics_initiative_integration.sql` (line 62). Version 67 < 500, so
-- `server/scripts/migrate.postgres.ts`'s `isSqliteOnlyMigration()` blanket-excludes it as a
-- "pre-baseline SQLite-first fragment". Consequence on a genuinely fresh strict run: the table is
-- never created, even though the code that uses it is mounted and live.
--
-- That gap made the ROI-E007 fan-in verification report record point 6c as EVIDENCE_MISSING
-- (docs/validation/finance-v3/generated/gate-d/ROI_E007_FANIN_VERIFICATION_report.md, section 6c):
-- `20260809_finance_v3_e007_03_legacy_actual_protection.sql` guards its trigger block behind
-- `to_regclass('public.benefit_tracking')`, so with no table it took the ELSE branch, emitted a
-- NOTICE and exited 0 — the `actual_*` append-only protection was written but could not be proven
-- to exist anywhere.
--
-- WHY (a) CREATE THE TABLE AND NOT (b) RETIRE THE ENDPOINT
-- -------------------------------------------------------
-- The table is NOT an orphan. Live consumers, verified by grep, not assumed:
--   * `server/src/routes/economics.routes.ts` — `GET /api/economics/analyses/:id/benefits`
--     (SELECT, line ~1511) and `PUT /api/economics/analyses/:id/benefits` (SELECT + UPDATE +
--     INSERT, lines ~1602-1745). The router is mounted at `server/src/Gateway.ts:1110`
--     (`app.use('/api/economics', betaGate, economicsRoutes)`).
--   * The PUT handler was deliberately REWRITTEN in ROI-E007 Stream C to cooperate with the
--     append-only trigger (omit `actual_cost_savings` from the UPDATE on divergence, route the
--     disagreement to `rvn_roi_finance_reconciliations`, answer 409 instead of 500). Retiring the
--     endpoint would discard that work.
--   * Frontend: `src/components/Economics/BenefitsTrackingDashboard.tsx` calls
--     `Api.getAnalysisBenefits()` / `Api.updateAnalysisBenefits()`; exported from
--     `src/components/Economics/index.ts:25`.
--   * Tests: `server/src/services/finance/canonical/__tests__/roiFinanceReconciliationAdapter.pg.test.ts`
--     (HTTP-level regression suite) and
--     `tests/integration/routes/economics.missing-table-honesty.postgres.integration.test.ts:103`.
-- Route (b) is therefore wrong: this is a live path, not dead code.
--
-- SHAPE — WHERE EACH DECISION COMES FROM (no invention)
-- ----------------------------------------------------
-- Columns, defaults and CHECKs are 067 lines 62-105 plus 068's `tracking_period` ALTER
-- (`server/migrations/068_economics_analysis_financials.sql:87`), translated to Postgres types.
-- This is byte-for-byte the same shape the Stream C suite already builds for itself in
-- `BENEFIT_TRACKING_DDL`, which is the shape the live route is written against.
--
-- Three deliberate, documented deviations from 067's literal text — each forced, none cosmetic:
--
--   1. `financial_id` is NULLABLE with NO foreign key. 067 declares
--      `financial_id TEXT NOT NULL REFERENCES initiative_financials(id)`. Both halves are
--      impossible here: (i) the only writer in the codebase, the PUT handler, inserts
--      `financial_id = NULL` (economics.routes.ts, INSERT parameter list — `null` is passed
--      literally), so NOT NULL would break the live route on every first save; (ii)
--      `initiative_financials` is created only by that same excluded 067, so the FK target does
--      not exist on a strict fresh install.
--   2. `organization_id` is TEXT, not 067's INTEGER. The application passes
--      `req.user.organizationId`, a string id. TEXT also matches what the real-database pg_dump
--      holds (`server/migrations-v2/001_baseline_20260413.sql:6872`, `organization_id text`).
--   3. `period_start` / `period_end` are TIMESTAMPTZ, not DATE. The handler writes
--      `new Date().toISOString()` into both, and `GET` falls back to `row.period_start` as the
--      display value for `trackingPeriod`; DATE would silently truncate it.
--
-- No `initiative_id` FK either: 067's `REFERENCES initiatives(id)` cannot be assumed to typecheck
-- against whatever `initiatives.id` is on the baseline path, and adding a constraint the live
-- database does not have would make fresh installs STRICTER than production — the opposite of the
-- point. 067's five indexes are reproduced; 067's `CREATE VIEW IF NOT EXISTS
-- v_benefit_tracking_summary` is NOT (invalid Postgres syntax, and grep finds zero consumers of
-- that view in `server/src/` or `src/`).
--
-- IDEMPOTENCE / EXISTING DATABASES
-- --------------------------------
-- `CREATE TABLE IF NOT EXISTS` only. On demo/dev/prod, where `benefit_tracking` already exists,
-- this migration is a strict no-op: it adds no column, alters no type, drops nothing and touches
-- no row. It cannot reshape an existing table even if that table's historical shape differs from
-- the one below.
--
-- ORDERING — WHY THIS UNBLOCKS THE PROTECTION TRIGGERS
-- ---------------------------------------------------
-- `migrate.postgres.ts` sorts phase 0 (NUMBERED) entirely before phase 1 (DATED)
-- (`phaseAndKeyFor()`, and the phase rationale at lines 99-145). This file is numbered (946), the
-- protection migration is dated (20260809_...), so this table exists by the time
-- `20260809_finance_v3_e007_03_legacy_actual_protection.sql` evaluates its
-- `to_regclass('public.benefit_tracking')` guard — the ELSE branch is no longer taken and both
-- `trg_benefit_tracking_deny_actual_overwrite` and `trg_benefit_tracking_deny_delete` are created.
-- No second migration is needed to attach the triggers, and trigger DDL stays single-owned by the
-- protection migration rather than being duplicated here.

BEGIN;

CREATE TABLE IF NOT EXISTS benefit_tracking (
    id TEXT PRIMARY KEY,
    financial_id TEXT NULL,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,

    -- Tracking Period (067 "Step 3")
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    period_type TEXT DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
    -- added by 068_economics_analysis_financials.sql:87
    tracking_period TEXT NULL,

    -- Planned Values (from financial model at period start)
    planned_cost_savings REAL DEFAULT 0,
    planned_revenue_increase REAL DEFAULT 0,
    planned_productivity_gains REAL DEFAULT 0,

    -- Actual Values — append-only under ROI-E007 (see protection migration)
    actual_cost_savings REAL DEFAULT 0,
    actual_revenue_increase REAL DEFAULT 0,
    actual_productivity_gains REAL DEFAULT 0,

    -- Variance Calculations
    variance_cost_savings_percent REAL,
    variance_revenue_percent REAL,
    variance_productivity_percent REAL,
    overall_variance_percent REAL,

    -- Qualitative Data
    variance_notes TEXT,
    achievements TEXT,
    challenges TEXT,

    -- Evidence and Verification
    evidence_links TEXT,
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    verification_status TEXT DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'verified', 'disputed')),

    -- Audit
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_benefit_tracking_financial ON benefit_tracking(financial_id);
CREATE INDEX IF NOT EXISTS idx_benefit_tracking_initiative ON benefit_tracking(initiative_id);
CREATE INDEX IF NOT EXISTS idx_benefit_tracking_org ON benefit_tracking(organization_id);
CREATE INDEX IF NOT EXISTS idx_benefit_tracking_period ON benefit_tracking(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_benefit_tracking_status ON benefit_tracking(verification_status);

COMMIT;
