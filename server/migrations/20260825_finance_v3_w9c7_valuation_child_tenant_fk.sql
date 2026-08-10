-- =============================================================================
-- Finance v3 — W9-C-7 structural fix: composite (parent, organization_id) FKs
-- on the valuation/baseline CHILD tables that were leaking tenant isolation.
--
-- Source: docs/validation/finance-v3/generated/gate-d/W9_FAULT_CONCURRENCY_TENANT_MATRIX_report.md
-- section 4.2. Companion service-layer fixes: P0_TENANT_ISOLATION_FIX_report.md
-- (this same work package) for W9-C-1..C-5.
--
-- ADDITIVE ONLY. No DROP/RENAME/ALTER ... TYPE on any existing column. Every
-- table below already has a NOT NULL `organization_id` column (verified
-- against `20260809_finance_v3_d09_valuation_01_tables.sql` /
-- `20260809_finance_v3_d05_baseline_01_tables.sql`); this file only ADDS a
-- UNIQUE(id, organization_id) on each PARENT (the same idiom
-- `uq_finance_bv_id_org`/`uq_finance_wr_id_org` already established in
-- `20260809_finance_v3_b01_core_artifacts.sql`) and a composite FK on each
-- CHILD referencing that pair.
--
-- WHY THIS CLOSES THE CLASS, NOT JUST THE TWO INSTANCES ALREADY FIXED IN
-- SERVICE CODE: `writeSensitivityGrid()` (P0 W9-C-4) and `findOrCreateMethod()`
-- (P1 W9-C-3) now validate the caller's organizationId in application code.
-- But every other, not-yet-written or future caller of these tables gets the
-- SAME guarantee for free once the FK exists — a service bug can no longer
-- silently attribute a child row to a mismatched (organization_id, parent)
-- pair; Postgres raises 23503 instead. This is exactly the defense-in-depth
-- pattern `fk_finance_baseline_outputs_bv_org` and
-- `fk_finance_prediction_preflight_runs_bv_org` already provide for their own
-- tables (and which is what actually stopped W9-C-1/W9-C-2 from becoming
-- WRITES, per the report's family 4/5 rows).
--
-- SAFE ON EXISTING DATA: `ADD CONSTRAINT ... FOREIGN KEY` is validated by
-- Postgres against every existing row in the SAME transaction; if any row's
-- (parent_id, organization_id) pair does not exist in the parent's own
-- (id, organization_id) pair, the whole migration transaction rolls back with
-- a clear 23503/23505 error rather than silently applying a partial fix. On a
-- fresh schema (this work package's own ephemeral cluster) there is no
-- existing data, so this is a no-op concern here; it is called out because
-- this migration is written to be safe to attempt on a populated database
-- too, not just this test cluster.
--
-- SCOPE — six of the seven tables named in the W9 report get a REAL composite
-- FK below (they all have a genuine parent id column to compose against):
--   finance_valuation_sensitivity_grids   -> finance_valuation_methods
--   finance_valuation_sensitivity_cells   -> finance_valuation_sensitivity_grids
--   finance_valuation_terminal            -> finance_valuation_methods
--   finance_valuation_comps               -> finance_valuation_methods
--   finance_valuation_ev_equity_bridge_components -> finance_valuation_ev_equity_bridge
--   finance_baseline_backtest_line_results -> finance_baseline_backtest_runs
--
-- DELIBERATELY EXCLUDED — `finance_valuation_cases`: the W9 report's own
-- table listing groups it with the six above, but structurally it is NOT a
-- child of any parent id column — it is a ROOT table (`case_id`,
-- `organization_id REFERENCES organizations(id)`, no
-- business_version_id/method_id/grid_id of its own; see
-- `20260809_finance_v3_d09_valuation_01_tables.sql` section 1, "Deliberately
-- NOT a finance_artifacts/finance_business_versions row"). It is in the same
-- class as `finance_stmt_calendars`/`finance_stmt_periods`, which the same
-- report explicitly calls out as "skalowane tylko org FK — poprawnie"
-- (correctly scoped by a plain single-column org FK alone) — there is no
-- "(parent, organization_id)" pair to compose because there is no parent.
-- Confirmed by grep over `server/src`: zero production services read or
-- write `finance_valuation_cases`, so there is also no live leak vector to
-- close here (see the tenantMatrix test's re-scoped W9-C-7 assertion, which
-- documents this exclusion explicitly rather than silently narrowing the
-- pinned list).
-- =============================================================================

BEGIN;

-- ============================================================================
-- 1. finance_valuation_methods — parent for sensitivity_grids/terminal/comps.
--    id is already the PRIMARY KEY (globally unique), so UNIQUE(id, org) adds
--    no new uniqueness guarantee on its own — it exists purely so a composite
--    FK can reference the pair, same as uq_finance_bv_id_org.
-- ============================================================================
ALTER TABLE finance_valuation_methods
  ADD CONSTRAINT uq_finance_valuation_methods_id_org UNIQUE (id, organization_id);

ALTER TABLE finance_valuation_sensitivity_grids
  ADD CONSTRAINT fk_finance_valuation_sensitivity_grids_method_org
  FOREIGN KEY (method_id, organization_id)
  REFERENCES finance_valuation_methods (id, organization_id);

ALTER TABLE finance_valuation_terminal
  ADD CONSTRAINT fk_finance_valuation_terminal_method_org
  FOREIGN KEY (method_id, organization_id)
  REFERENCES finance_valuation_methods (id, organization_id);

ALTER TABLE finance_valuation_comps
  ADD CONSTRAINT fk_finance_valuation_comps_method_org
  FOREIGN KEY (method_id, organization_id)
  REFERENCES finance_valuation_methods (id, organization_id);

-- ============================================================================
-- 2. finance_valuation_sensitivity_grids — parent for sensitivity_cells. Needs
--    its own UNIQUE(id, org) now that it is itself a composite-FK target.
-- ============================================================================
ALTER TABLE finance_valuation_sensitivity_grids
  ADD CONSTRAINT uq_finance_valuation_sensitivity_grids_id_org UNIQUE (id, organization_id);

ALTER TABLE finance_valuation_sensitivity_cells
  ADD CONSTRAINT fk_finance_valuation_sensitivity_cells_grid_org
  FOREIGN KEY (grid_id, organization_id)
  REFERENCES finance_valuation_sensitivity_grids (id, organization_id);

-- ============================================================================
-- 3. finance_valuation_ev_equity_bridge — parent for
--    ev_equity_bridge_components.
-- ============================================================================
ALTER TABLE finance_valuation_ev_equity_bridge
  ADD CONSTRAINT uq_finance_valuation_ev_bridge_id_org UNIQUE (id, organization_id);

ALTER TABLE finance_valuation_ev_equity_bridge_components
  ADD CONSTRAINT fk_finance_valuation_ev_bridge_components_bridge_org
  FOREIGN KEY (bridge_id, organization_id)
  REFERENCES finance_valuation_ev_equity_bridge (id, organization_id);

-- ============================================================================
-- 4. finance_baseline_backtest_runs — parent for backtest_line_results.
-- ============================================================================
ALTER TABLE finance_baseline_backtest_runs
  ADD CONSTRAINT uq_finance_baseline_backtest_runs_id_org UNIQUE (id, organization_id);

ALTER TABLE finance_baseline_backtest_line_results
  ADD CONSTRAINT fk_finance_baseline_backtest_line_results_run_org
  FOREIGN KEY (backtest_run_id, organization_id)
  REFERENCES finance_baseline_backtest_runs (id, organization_id);

COMMIT;
