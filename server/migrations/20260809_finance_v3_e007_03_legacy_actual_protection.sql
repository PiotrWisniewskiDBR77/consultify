-- Finance v3 / ROI-E007 (Stream A): Finance/KPI Seams, part 3/3 — physical no-silent-overwrite
-- protection on the THREE legacy stores that hold "ROI Actual" today.
--
-- Source: docs/validation/finance-v3/generated/gate-d/ROI_E007_finance_kpi_seams_ADR.md section 5
-- (roi_realized_values / v8_roi_realization_entries — both, sections 5.1/5.2/Zalacznik A) PLUS
-- orchestrator scope item 2, which pulls a THIRD store into P0 that the ADR's own section 2.4 /
-- section 11 escalation #3 deliberately left out: benefit_tracking.actual_cost_savings /
-- actual_revenue_increase / actual_productivity_gains (server/migrations/067_economics_initiative_
-- integration.sql lines 62-105) — the epic's core promise ("Finance never overwrites Approved,
-- Forecast or Actual ROI truth", plan section 2.3) is only complete once all three stores that a
-- UI could plausibly label "ROI Actual" are covered, not just the two the ADR's author had time to
-- verify against a live call-site grep.
--
-- Zero ALTER on any of these three pre-existing tables — triggers only, no column/CHECK changes,
-- no row touched. Every UPDATE/DELETE call site these triggers can break, and the exact test
-- proving it, is documented in the migration report (docs/validation/finance-v3/generated/gate-d/
-- ROI_E007_streamA_migration_report.md) — this migration does not change any application code.

BEGIN;

-- ==============================================================================================
-- 5.1/5.2 roi_realized_values (server/migrations/565_kpi_time_series_roi_attribution_finance.sql)
-- — the most actively written ROI Actual store in the repo (4 live INSERT call sites, 0 UPDATE
-- call sites anywhere in server/, confirmed by repo-wide grep per the ADR). Deny ALL UPDATE/DELETE
-- physically — not because any known caller does it today, but because a DB trigger cannot
-- distinguish "which process/role" is asking (ADR section 5.3 reasoning), so the guarantee has to
-- be table-wide to be real. Corrections are new rows (source='correction' + variance_notes).
-- ==============================================================================================
CREATE OR REPLACE FUNCTION roi_realized_values_deny_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'roi_realized_values is append-only under ROI-E007 governance; % not permitted (row %) -- corrections must be new rows (variance_notes/source explaining the correction), reconciliation must open a row in rvn_roi_finance_reconciliations, never UPDATE realized_* here', TG_OP, COALESCE(OLD.id, NEW.id);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roi_realized_values_deny_update ON roi_realized_values;
CREATE TRIGGER trg_roi_realized_values_deny_update
  BEFORE UPDATE ON roi_realized_values
  FOR EACH ROW EXECUTE FUNCTION roi_realized_values_deny_mutation();
DROP TRIGGER IF EXISTS trg_roi_realized_values_deny_delete ON roi_realized_values;
CREATE TRIGGER trg_roi_realized_values_deny_delete
  BEFORE DELETE ON roi_realized_values
  FOR EACH ROW EXECUTE FUNCTION roi_realized_values_deny_mutation();

-- ==============================================================================================
-- v8_roi_realization_entries (server/migrations/20260323_v8_results_roi.sql) — KPI-scoped, one
-- service (resultsROIService.ts), same risk shape (append-only in practice today, no physical
-- guarantee before this migration). Primary key column is entry_id, not id — a dedicated function,
-- same idiom as WP-D09's own documented divergence to per-table explicit functions rather than one
-- generic function reused across tables with different column shapes (WP-D09b migration report
-- section 2.1).
-- ==============================================================================================
CREATE OR REPLACE FUNCTION v8_roi_realization_entries_deny_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'v8_roi_realization_entries is append-only under ROI-E007 governance; % not permitted (row %) -- corrections must be new rows, reconciliation must open a row in rvn_roi_finance_reconciliations, never UPDATE realized_value here', TG_OP, COALESCE(OLD.entry_id, NEW.entry_id);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_v8_roi_realization_entries_deny_update ON v8_roi_realization_entries;
CREATE TRIGGER trg_v8_roi_realization_entries_deny_update
  BEFORE UPDATE ON v8_roi_realization_entries
  FOR EACH ROW EXECUTE FUNCTION v8_roi_realization_entries_deny_mutation();
DROP TRIGGER IF EXISTS trg_v8_roi_realization_entries_deny_delete ON v8_roi_realization_entries;
CREATE TRIGGER trg_v8_roi_realization_entries_deny_delete
  BEFORE DELETE ON v8_roi_realization_entries
  FOR EACH ROW EXECUTE FUNCTION v8_roi_realization_entries_deny_mutation();

-- ==============================================================================================
-- benefit_tracking.actual_cost_savings / actual_revenue_increase / actual_productivity_gains
-- (orchestrator scope item 2 — the ADR's own section 2.4 explicitly left this out of P0; the
-- orchestrator has now pulled it into scope as the third store).
--
-- Column-scoped, not table-wide, and that is a deliberate choice, not a partial implementation:
-- unlike roi_realized_values / v8_roi_realization_entries (which this program has zero live UPDATE
-- call sites for), benefit_tracking has a REAL, currently-running route —
-- `PUT /api/economics/analyses/:id/benefits` (server/src/routes/economics.routes.ts lines
-- 1529-1620) — that legitimately UPDATEs verification_status/verified_by/verified_at/
-- variance_notes/achievements/challenges/planned_*/updated_at as part of an ordinary
-- verify-a-tracking-row workflow. A blanket deny-all trigger (the literal "same idiom" reading)
-- would 500 that route on every call, not just the overwrite path — a regression the orchestrator's
-- own instruction ("chroń kolumny actual_*", not "chroń cały wiersz") does not ask for. What IS
-- blocked, physically: any UPDATE that changes the value of any of the three actual_* columns once
-- a row exists, and any DELETE (deleting the row destroys its actual_* values too — an overwrite by
-- omission).
--
-- KNOWN, DELIBERATE CONSEQUENCE — flagged prominently for Streams B/C/D and for whoever owns
-- server/src/routes/economics.routes.ts next: the SAME route's existing UPDATE branch (lines
-- 1576-1584) sets `actual_cost_savings = ?` on an existing (organization_id, initiative_id,
-- tracking_period) row — i.e. it silently overwrote a previously recorded actual before this
-- migration. After this migration, that specific UPDATE is physically rejected by
-- trg_benefit_tracking_deny_actual_overwrite whenever the new value differs from what is already
-- stored, and the route will surface a 500 (routes.ts's existing try/catch only special-cases
-- FinanceStorageUnavailableError, not this new trigger's exception) until that route is changed to
-- either INSERT a new period row for a correction or call an explicit correction/reconciliation
-- path instead of UPDATE. This is the exact "cichy overwrite" the whole ROI-E007 epic exists to
-- close — the trigger is working as designed by closing it, not a migration defect — but it is a
-- real, live incompatibility, not a hypothetical one, and it is NOT this Stream A's job to change
-- application code. Proven live in the migration report (test: re-running that route's exact
-- UPDATE statement against a period row with a pre-existing actual_cost_savings value).
--
-- KNOWN, SEPARATE FRESH-INSTALL GAP (found live while testing this file, not a defect of this
-- migration): benefit_tracking's own producer, server/migrations/067_economics_initiative_
-- integration.sql (version 067 < 500), is silently excluded by server/scripts/migrate.postgres.ts's
-- `isSqliteOnlyMigration()` blanket rule on a genuinely fresh/strict install (same class of gap
-- STRICT_SCHEMA_REPAIR_REPORT.md already documented for 081_studio_tables.sql / 073_conversations
-- .sql / 215_partner_portal.sql / 256_integrations_system.sql — 067 was not in that repair's
-- PROMOTED_LEGACY_PRODUCERS list). On the live demo/dev databases the table exists (created via
-- PostgresDatabase.ts's own initDb(), a separate code path from this migration runner), so this is
-- a fresh-install-only gap, not a "does the table exist in production" gap — but it means this
-- migration's benefit_tracking block cannot assume the table is present. Guarded below with a
-- runtime to_regclass() check instead of promoting 067 into the runner's manifest, which is a
-- platform-wide decision (touches every other in-flight worktree/stream) out of this Stream A's
-- scope — flagged in the migration report as a P1 for whoever owns migrate.postgres.ts next.
-- ==============================================================================================
DO $$
BEGIN
  IF to_regclass('public.benefit_tracking') IS NOT NULL THEN
    EXECUTE $ddl$
      CREATE OR REPLACE FUNCTION benefit_tracking_deny_actual_overwrite() RETURNS TRIGGER AS $fn$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'benefit_tracking is append-only for actual_* under ROI-E007 governance; DELETE not permitted (row %) -- deleting the row destroys previously recorded actual_cost_savings/actual_revenue_increase/actual_productivity_gains', OLD.id;
        END IF;

        IF NEW.actual_cost_savings IS DISTINCT FROM OLD.actual_cost_savings
           OR NEW.actual_revenue_increase IS DISTINCT FROM OLD.actual_revenue_increase
           OR NEW.actual_productivity_gains IS DISTINCT FROM OLD.actual_productivity_gains
        THEN
          RAISE EXCEPTION 'benefit_tracking.actual_* is append-only under ROI-E007 governance; UPDATE of actual_cost_savings/actual_revenue_increase/actual_productivity_gains not permitted (row %) -- record a correction as a new benefit_tracking row for a new tracking_period, or open a row in rvn_roi_finance_reconciliations; other columns (planned_*, verification_status, verified_by, verified_at, variance_notes, achievements, challenges, updated_at) remain freely updatable', OLD.id;
        END IF;

        RETURN NEW;
      END;
      $fn$ LANGUAGE plpgsql;
    $ddl$;

    EXECUTE 'DROP TRIGGER IF EXISTS trg_benefit_tracking_deny_actual_overwrite ON benefit_tracking';
    EXECUTE 'CREATE TRIGGER trg_benefit_tracking_deny_actual_overwrite BEFORE UPDATE ON benefit_tracking FOR EACH ROW EXECUTE FUNCTION benefit_tracking_deny_actual_overwrite()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_benefit_tracking_deny_delete ON benefit_tracking';
    EXECUTE 'CREATE TRIGGER trg_benefit_tracking_deny_delete BEFORE DELETE ON benefit_tracking FOR EACH ROW EXECUTE FUNCTION benefit_tracking_deny_actual_overwrite()';
  ELSE
    RAISE NOTICE 'ROI-E007: benefit_tracking not present in this schema (067_economics_initiative_integration.sql is excluded by migrate.postgres.ts isSqliteOnlyMigration() on a fresh/strict install) -- actual_* protection triggers skipped; re-run this migration after benefit_tracking exists (e.g. via CREATE TABLE/OR/initDb(), or once 067 is promoted) to apply them';
  END IF;
END $$;

COMMIT;
