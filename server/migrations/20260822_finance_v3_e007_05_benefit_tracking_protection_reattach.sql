-- Finance v3 / ROI-E007 CLOSEOUT CO-6 — finding F-1: re-attach the `benefit_tracking.actual_*`
-- append-only protection on the UPGRADE path, where it was never attached at all.
--
-- ==============================================================================================
-- WHAT WAS BROKEN (measured physically, not inferred)
-- ==============================================================================================
-- `20260809_finance_v3_e007_03_legacy_actual_protection.sql` wraps its entire `benefit_tracking`
-- block — the protection FUNCTION and both TRIGGERS — in
--
--     IF to_regclass('public.benefit_tracking') IS NOT NULL THEN ... ELSE RAISE NOTICE ... END IF;
--
-- because at the time it was written `benefit_tracking` had no producer that survived
-- `migrate.postgres.ts`'s `isSqliteOnlyMigration()` <500 exclusion (its only producer was
-- `067_economics_initiative_integration.sql`). `946_benefit_tracking_fresh_install.sql`
-- (closeout CO-3) later supplied that producer, and reasoned — correctly, for a FRESH install —
-- that phase 0 (NUMBERED) runs entirely before phase 1 (DATED), so 946 creates the table before
-- the 20260809 guard evaluates and no second migration is needed.
--
-- That reasoning holds for a fresh install and fails for an UPGRADE, because a migration runs at
-- most once:
--
--   * A database migrated BEFORE 946 existed ran 20260809 with no `benefit_tracking` in the
--     catalog. The guard took its ELSE branch, emitted a NOTICE, and the migration was recorded
--     `status = 'success'` (it did not error — `RAISE NOTICE` is not a failure). `migrate.
--     postgres.ts` only re-runs migrations whose recorded status is NOT 'success'
--     (`pending = filtered.filter(m => !a || a.status !== 'success')`), so 20260809 will never
--     run again on that database.
--   * 946 is then applied on top and creates the table. Nothing re-evaluates the guard.
--   * Result: `benefit_tracking` EXISTS and is COMPLETELY UNPROTECTED — no triggers, and not even
--     the protection function, since that too lives inside the skipped branch.
--
-- Reproduced end-to-end on an ephemeral Postgres 15 cluster (report:
-- docs/validation/finance-v3/generated/gate-d/CLOSEOUT_06_F1_upgrade_protection_report.md):
--
--     -- after a strict full run WITHOUT 946, then 946 applied on top:
--     SELECT count(*) FROM pg_trigger ... WHERE relname='benefit_tracking'  -> 0
--     SELECT count(*) FROM pg_proc WHERE proname='benefit_tracking_deny_actual_overwrite' -> 0
--     INSERT INTO public.benefit_tracking (... actual_cost_savings) VALUES (..., 4200);  INSERT 0 1
--     UPDATE public.benefit_tracking SET actual_cost_savings = 9999999 WHERE ...;         UPDATE 1
--     SELECT actual_cost_savings ...                                       -> 9.999999e+06
--     DELETE FROM public.benefit_tracking WHERE ...;                                      DELETE 1
--
-- i.e. exactly the silent overwrite of a recorded ROI Actual that the whole ROI-E007 epic exists
-- to make physically impossible.
--
-- AFFECTED POPULATION: every database whose migration history recorded 20260809_..._e007_03 as
-- success while `benefit_tracking` did not yet exist — strict/fresh installs built between the
-- landing of 20260809 and the landing of 946 (CI databases, ephemeral verification clusters, and
-- the verification database of the previous fan-in). Demo/dev/prod are NOT in that set: there
-- `benefit_tracking` was created by `PostgresDatabase.ts`'s own `initDb()` long before 20260809
-- ran, so the guard took its THEN branch. This migration is a no-op replacement there (identical
-- trigger names, DROP IF EXISTS + CREATE), not a second set of triggers.
--
-- ==============================================================================================
-- WHY A NEW FILE AND NOT AN EDIT
-- ==============================================================================================
-- Neither `946_benefit_tracking_fresh_install.sql` nor `20260809_finance_v3_e007_03_legacy_actual_
-- protection.sql` may be edited: both are already recorded as applied (with their checksums) on
-- other databases, so editing them changes nothing on those databases while silently invalidating
-- their recorded checksums. The fix has to be ADDITIVE — a new migration that runs everywhere,
-- including on the databases that are already in the broken state.
--
-- ORDERING: `2026-08-22` is a phase-1 (DATED) prefix, sorted by calendar date, so this file runs
-- after every phase-0 NUMBERED migration (including 946) and after every earlier dated migration
-- (including 20260809_..._e007_03 and 20260810_..._e007_04). It is the last word on ROI Actual
-- protection in both phases.
--
-- ==============================================================================================
-- SCHEMA QUALIFICATION (lesson from closeout CO-4)
-- ==============================================================================================
-- Every identifier below is schema-qualified. CO-4
-- (`20260810_finance_v3_e007_04_actual_protection_schema_qualified.sql`) proved that unqualified
-- protection DDL resolves through `search_path` to `public` only, while 119 of the 121 tables in
-- the `v8` schema have a same-named twin in `public` — so an unqualified `CREATE TRIGGER` can
-- leave a physical copy of the table bare.
--
-- `benefit_tracking` twin status — CHECKED, not assumed:
--   * Repo-wide grep for a producer: `CREATE TABLE ... benefit_tracking` exists in exactly three
--     places — `067_economics_initiative_integration.sql:62` (unqualified),
--     `946_benefit_tracking_fresh_install.sql:87` (unqualified) and
--     `server/migrations-v2/001_baseline_20260413.sql:6872` (`public.benefit_tracking`). There is
--     no `v8.benefit_tracking` anywhere, including in `20260719_baseline_gap.sql`, which is what
--     imported the `v8.` twins of the other ROI stores.
--   * Confirmed physically on the freshly migrated cluster used for this work package:
--     `SELECT table_schema FROM information_schema.tables WHERE table_name='benefit_tracking'`
--     returned `public` and nothing else; `to_regclass('v8.benefit_tracking')` was NULL.
-- A `v8` slot is nonetheless probed in the loop below (exactly as CO-4 does for
-- `roi_realized_values`), so that if a twin is ever introduced it gets protected automatically
-- instead of silently unguarded — and CO-4's standing `RAISE WARNING` twin probe stops firing.
--
-- ==============================================================================================
-- THE OTHER TWO PROTECTED STORES — WHY THEY ARE **NOT** VULNERABLE TO THIS PATTERN
-- ==============================================================================================
-- `roi_realized_values` and `v8_roi_realization_entries` are protected by the same 20260809 file
-- but CANNOT be in the F-1 state, and the proof does not depend on migration ordering at all:
-- their trigger DDL in 20260809 is NOT guarded. `CREATE TRIGGER ... ON roi_realized_values`
-- executes unconditionally, so on a database where those tables did not exist the migration would
-- have RAISED (`relation ... does not exist`) and been recorded `failed` (strict) or `skipped`
-- (`--safe`) — never 'success'. In both of those states the runner's pending filter re-runs it on
-- the next migration pass. "Recorded as success" therefore PROVES both tables existed at that
-- moment; there is no silent-skip branch for them to fall through.
-- Corroborating ordering evidence (belt and braces): `roi_realized_values` is created by
-- `565_kpi_time_series_roi_attribution_finance.sql` (phase 0, version >= 500, not excluded) and
-- `v8_roi_realization_entries` by `20260323_v8_results_roi.sql` plus the `v8.` twin from
-- `20260719_baseline_gap.sql` — all strictly before `20260809`, in both phase order and calendar
-- order, and no other producer of either table exists in the repo.
-- Measured on the F-1 upgrade database (the one with the unprotected `benefit_tracking`): all six
-- expected triggers were present on all three physical instances of those two stores.
-- They are therefore NOT re-attached here (trigger ownership stays with 20260809/CO-4); instead
-- the final block below AUDITS them read-only and raises a WARNING if any physical instance is
-- ever found bare, so the same class of defect cannot go unnoticed a third time.

BEGIN;

-- ==============================================================================================
-- 1/3 — protection function.
--
-- `20260809_..._e007_03` is the OWNER of `benefit_tracking_deny_actual_overwrite()` and this file
-- deliberately does not redefine it when it is already there: on databases that took the THEN
-- branch the function below is left exactly as 20260809 wrote it (no CREATE OR REPLACE, no
-- second, differently-named function). It is created here ONLY on the F-1 databases, where the
-- function does not exist at all because it lives inside the branch that was skipped — and then
-- with a body byte-identical to 20260809's, so both paths converge on one definition.
-- ==============================================================================================
DO $fnblock$
BEGIN
  IF to_regprocedure('public.benefit_tracking_deny_actual_overwrite()') IS NOT NULL THEN
    RAISE NOTICE 'ROI-E007 CO-6: public.benefit_tracking_deny_actual_overwrite() already exists (created by 20260809_finance_v3_e007_03) -- reused as-is, not redefined.';
  ELSE
    RAISE NOTICE 'ROI-E007 CO-6: public.benefit_tracking_deny_actual_overwrite() is MISSING -- this database took the skipped ELSE branch of 20260809_finance_v3_e007_03 (finding F-1). Creating it now, verbatim from that file.';
    EXECUTE $ddl$
      CREATE FUNCTION public.benefit_tracking_deny_actual_overwrite() RETURNS TRIGGER AS $fn$
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
  END IF;
END
$fnblock$;

-- ==============================================================================================
-- 2/3 — attach the triggers to every PHYSICAL instance, schema-qualified.
--
-- Trigger names are byte-identical to 20260809's, so `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`
-- REPLACES rather than duplicates on databases that already have them: re-running this migration
-- any number of times leaves exactly two triggers per instance. Each instance is probed with
-- `to_regclass()` individually (returns NULL, never raises, for a missing table AND for a missing
-- schema), so an absent instance skips only itself.
--
-- Zero ALTER, zero DDL on the table itself, zero rows touched, no application code changed.
-- ==============================================================================================
DO $mig$
DECLARE
  target      record;
  attached    integer := 0;
  skipped     integer := 0;
  have_update boolean;
  have_delete boolean;
BEGIN
  FOR target IN
    SELECT *
    FROM (VALUES
      ('public', 'benefit_tracking'),
      -- No `v8.benefit_tracking` exists today (checked — see header). Probed anyway so a future
      -- twin is protected on this migration's next run instead of being silently bare.
      ('v8',     'benefit_tracking')
    ) AS t(schema_name, table_name)
  LOOP
    IF to_regclass(format('%I.%I', target.schema_name, target.table_name)) IS NULL THEN
      skipped := skipped + 1;
      RAISE NOTICE 'ROI-E007 CO-6: SKIPPED %.% -- this physical instance does not exist in this database; actual_* protection NOT attached to it. Re-run this migration if the instance is created later.',
        target.schema_name, target.table_name;
      CONTINUE;
    END IF;

    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_benefit_tracking_deny_actual_overwrite ON %I.%I',
      target.schema_name, target.table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_benefit_tracking_deny_actual_overwrite BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.benefit_tracking_deny_actual_overwrite()',
      target.schema_name, target.table_name);

    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_benefit_tracking_deny_delete ON %I.%I',
      target.schema_name, target.table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_benefit_tracking_deny_delete BEFORE DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.benefit_tracking_deny_actual_overwrite()',
      target.schema_name, target.table_name);

    -- Post-condition, read back from the catalog: "the DDL ran" and "the protection is there" are
    -- two different claims. Both triggers must be visible on THIS instance before we count it.
    SELECT
      bool_or(t.tgname = 'trg_benefit_tracking_deny_actual_overwrite'),
      bool_or(t.tgname = 'trg_benefit_tracking_deny_delete')
      INTO have_update, have_delete
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND n.nspname = target.schema_name
      AND c.relname = target.table_name;

    IF NOT COALESCE(have_update, false) OR NOT COALESCE(have_delete, false) THEN
      RAISE EXCEPTION 'ROI-E007 CO-6: failed to attach actual_* protection to %.% (update trigger present: %, delete trigger present: %) -- refusing to report success',
        target.schema_name, target.table_name, COALESCE(have_update, false), COALESCE(have_delete, false);
    END IF;

    attached := attached + 1;
    RAISE NOTICE 'ROI-E007 CO-6: actual_* protection attached (schema-qualified) to %.% [trg_benefit_tracking_deny_actual_overwrite, trg_benefit_tracking_deny_delete]',
      target.schema_name, target.table_name;
  END LOOP;

  IF attached = 0 THEN
    -- Explicit, loud no-op — NOT a silent skip, and NOT an error either: a database that has no
    -- `benefit_tracking` at all (e.g. a fresh install that has not yet reached phase-0 946, or a
    -- deployment where the economics tables were never created) has nothing to protect, and
    -- failing the whole migration run over it would be worse than saying so.
    RAISE WARNING 'ROI-E007 CO-6: NO-OP -- no physical instance of benefit_tracking exists in this database (public and v8 both probed), so the actual_* append-only protection was attached to NOTHING. This is expected only where the economics benefit-tracking table is genuinely absent; if this database is supposed to have it, 946_benefit_tracking_fresh_install.sql has not run and this migration must be re-run after it.';
  ELSE
    RAISE NOTICE 'ROI-E007 CO-6 summary: % benefit_tracking instance(s) protected, % absent instance(s) skipped.', attached, skipped;
  END IF;
END
$mig$;

-- ==============================================================================================
-- 3/3 — read-only audit of the other two ROI Actual stores.
--
-- They are not vulnerable to the F-1 pattern (see header: their 20260809 trigger DDL is
-- unguarded, so a missing table would have failed the migration rather than silently skipping it)
-- and this block therefore attaches nothing and changes nothing. It exists so that a bare
-- physical instance can never again be discovered only by manual audit.
-- ==============================================================================================
DO $audit$
DECLARE
  target  record;
  bare    integer := 0;
  n_trg   integer;
BEGIN
  FOR target IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND c.relname IN ('roi_realized_values', 'v8_roi_realization_entries')
      AND n.nspname IN ('public', 'v8')
    ORDER BY 1, 2
  LOOP
    SELECT count(*) INTO n_trg
    FROM pg_trigger t
    JOIN pg_class c2 ON c2.oid = t.tgrelid
    JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
    WHERE NOT t.tgisinternal
      AND n2.nspname = target.schema_name
      AND c2.relname = target.table_name
      AND t.tgname LIKE '%_deny_%';

    IF n_trg < 2 THEN
      bare := bare + 1;
      RAISE WARNING 'ROI-E007 CO-6 audit: %.% carries only % append-only deny trigger(s) (expected 2, one BEFORE UPDATE and one BEFORE DELETE). ROI Actual on this instance is NOT protected -- same class of defect as finding F-1.',
        target.schema_name, target.table_name, n_trg;
    ELSE
      RAISE NOTICE 'ROI-E007 CO-6 audit: %.% protected (% deny trigger(s)).',
        target.schema_name, target.table_name, n_trg;
    END IF;
  END LOOP;

  IF bare = 0 THEN
    RAISE NOTICE 'ROI-E007 CO-6 audit: every physical instance of roi_realized_values / v8_roi_realization_entries carries its append-only protection.';
  END IF;
END
$audit$;

COMMIT;
