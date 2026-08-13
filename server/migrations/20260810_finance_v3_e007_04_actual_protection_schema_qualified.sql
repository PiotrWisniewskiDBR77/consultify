-- Finance v3 / ROI-E007 CLOSEOUT CO-4 — schema-qualified re-attachment of the "ROI Actual"
-- no-silent-overwrite protection.
--
-- WHY THIS FILE EXISTS (finding F-1, docs/validation/finance-v3/generated/gate-d/
-- ROI_E007_FANIN_VERIFICATION_report.md section "Finding F-1"):
--
-- `20260809_finance_v3_e007_03_legacy_actual_protection.sql` attaches its triggers with
-- UNQUALIFIED identifiers (`... ON v8_roi_realization_entries`). An unqualified table name is
-- resolved through the migration session's `search_path`, which lands on `public` and stops
-- there. But this database physically contains TWO copies of that table:
--
--     public.v8_roi_realization_entries   <- created by 20260323_v8_results_roi.sql (unqualified)
--     v8.v8_roi_realization_entries       <- created by 20260719_baseline_gap.sql  (qualified)
--
-- Only the `public` copy got the triggers. Proven physically on a freshly migrated database
-- (fan-in verification, and re-confirmed as the starting state of this work package):
--
--     INSERT INTO v8.v8_roi_realization_entries ... realized_value = 500   -> 1 row
--     UPDATE v8.v8_roi_realization_entries SET realized_value = 777777     -> UPDATE 1, NO ERROR
--     SELECT realized_value                                                -> 777777  (OVERWRITTEN)
--
-- This is not a live hole today — the runtime issues `SET search_path TO public, v8`
-- (server/src/database/PostgresDatabase.ts:470,609; server/src/utils/queryHelpers.ts:242) so every
-- unqualified application write resolves to the PROTECTED `public` copy, and no code anywhere
-- references the `v8.` twin explicitly. It is a LATENT hole: one schema-qualified write, one
-- change to search_path ordering, or one `SET search_path TO v8, public` in a future migration or
-- psql session silently bypasses ROI-E007 governance. The epic's promise ("ROI Actual cannot be
-- silently overwritten") must be a property of the DATA, not of a session variable.
--
-- WHAT THIS MIGRATION DOES: re-attaches the SAME protection functions to EVERY physical instance
-- of the protected tables using SCHEMA-QUALIFIED identifiers, so the result is independent of
-- `search_path`. Trigger names are byte-identical to the 20260809 file's, so on the `public`
-- copies this is a no-op replacement (DROP IF EXISTS + CREATE), not a second, duplicate trigger.
--
-- ADDITIVE / IDEMPOTENT: zero ALTER, zero DDL on the tables themselves, zero rows touched, no
-- application code changed. Safe to re-run any number of times. Every instance is probed with
-- `to_regclass()` INDIVIDUALLY — a missing instance skips only ITSELF (with an explicit
-- RAISE NOTICE naming it), never the rest of the block.
--
-- SCOPE — the other two protected stores were checked physically on a freshly migrated database,
-- not assumed:
--   * roi_realized_values  — ONE instance only (public). `20260719_baseline_gap.sql:8493` creates
--     it as "public"."roi_realized_values"; there is no `v8.roi_realized_values`. It is
--     nonetheless re-attached QUALIFIED below, and a `v8.` slot is probed, so that if a twin is
--     ever introduced it is protected automatically instead of silently unguarded.
--   * benefit_tracking     — ZERO instances on a fresh/strict install (its producer,
--     067_economics_initiative_integration.sql, is excluded by migrate.postgres.ts's
--     isSqliteOnlyMigration() blanket <500 rule — documented at length in the 20260809 file), and
--     no `v8.benefit_tracking` twin exists in `20260719_baseline_gap.sql` either. Deliberately NOT
--     re-attached here: benefit_tracking's protection is column-scoped, not table-wide, and is
--     owned by a separate closeout work package. A twin-detection probe below raises a WARNING
--     rather than staying silent if that ever changes.
--
-- Context: of the 121 tables in the `v8` schema, 119 have a same-named twin in `public` — the
-- twinning is a systemic property of the baseline-gap import, not a one-off. Any FUTURE
-- protection trigger on a v8_* table must be written schema-qualified from the start.

BEGIN;

-- ==============================================================================================
-- Protection functions — recreated verbatim from 20260809_finance_v3_e007_03, but with the
-- function names SCHEMA-QUALIFIED so this migration is self-contained and its own resolution
-- does not depend on search_path either. CREATE OR REPLACE => idempotent, and identical bodies
-- => re-running 20260809 afterwards is also harmless.
-- ==============================================================================================
CREATE OR REPLACE FUNCTION public.roi_realized_values_deny_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'roi_realized_values is append-only under ROI-E007 governance; % not permitted (row %) -- corrections must be new rows (variance_notes/source explaining the correction), reconciliation must open a row in rvn_roi_finance_reconciliations, never UPDATE realized_* here', TG_OP, COALESCE(OLD.id, NEW.id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.v8_roi_realization_entries_deny_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'v8_roi_realization_entries is append-only under ROI-E007 governance; % not permitted (row %) -- corrections must be new rows, reconciliation must open a row in rvn_roi_finance_reconciliations, never UPDATE realized_value here', TG_OP, COALESCE(OLD.entry_id, NEW.entry_id);
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================================
-- Re-attach, per PHYSICAL INSTANCE, schema-qualified.
-- ==============================================================================================
DO $mig$
DECLARE
  target      record;
  attached    integer := 0;
  skipped     integer := 0;
BEGIN
  FOR target IN
    SELECT *
    FROM (VALUES
      -- schema, table, protection function, trigger-name prefix
      ('public', 'v8_roi_realization_entries', 'public.v8_roi_realization_entries_deny_mutation', 'trg_v8_roi_realization_entries_deny'),
      ('v8',     'v8_roi_realization_entries', 'public.v8_roi_realization_entries_deny_mutation', 'trg_v8_roi_realization_entries_deny'),
      ('public', 'roi_realized_values',        'public.roi_realized_values_deny_mutation',        'trg_roi_realized_values_deny'),
      ('v8',     'roi_realized_values',        'public.roi_realized_values_deny_mutation',        'trg_roi_realized_values_deny')
    ) AS t(schema_name, table_name, fn_name, trg_prefix)
  LOOP
    -- to_regclass() returns NULL (never raises) for a missing table AND for a missing schema, so
    -- one absent instance skips only itself.
    IF to_regclass(format('%I.%I', target.schema_name, target.table_name)) IS NULL THEN
      skipped := skipped + 1;
      RAISE NOTICE 'ROI-E007 CO-4: SKIPPED %.% -- this physical instance does not exist in this database; protection NOT attached to it (this is expected where the table has only one instance, e.g. there is no v8.roi_realization twin of a public-only table). Re-run this migration if the instance is created later.',
        target.schema_name, target.table_name;
      CONTINUE;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I',
      target.trg_prefix || '_update', target.schema_name, target.table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION %s()',
      target.trg_prefix || '_update', target.schema_name, target.table_name, target.fn_name);

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I',
      target.trg_prefix || '_delete', target.schema_name, target.table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION %s()',
      target.trg_prefix || '_delete', target.schema_name, target.table_name, target.fn_name);

    attached := attached + 1;
    RAISE NOTICE 'ROI-E007 CO-4: protection attached (schema-qualified) to %.% [% , %]',
      target.schema_name, target.table_name,
      target.trg_prefix || '_update', target.trg_prefix || '_delete';
  END LOOP;

  RAISE NOTICE 'ROI-E007 CO-4 summary: % physical instance(s) protected, % absent instance(s) skipped.',
    attached, skipped;

  IF attached = 0 THEN
    RAISE EXCEPTION 'ROI-E007 CO-4: not a single physical instance of the protected ROI Actual stores was found -- refusing to report success on a database where the protection provably protects nothing';
  END IF;
END
$mig$;

-- ==============================================================================================
-- benefit_tracking twin probe — read-only, WARNING not silence (see SCOPE note in the header).
-- Owned by a separate closeout work package; this migration deliberately attaches nothing to it.
-- ==============================================================================================
DO $bt$
BEGIN
  IF to_regclass('v8.benefit_tracking') IS NOT NULL THEN
    RAISE WARNING 'ROI-E007 CO-4: a v8.benefit_tracking TWIN now exists. benefit_tracking protection (trg_benefit_tracking_deny_actual_overwrite, 20260809_finance_v3_e007_03) is attached UNQUALIFIED and therefore covers only public.benefit_tracking -- the v8 twin is UNPROTECTED. Same class of defect as finding F-1; qualify it before relying on the actual_* guarantee.';
  ELSE
    RAISE NOTICE 'ROI-E007 CO-4: no v8.benefit_tracking twin present (checked, not assumed) -- benefit_tracking''s single-instance protection needs no re-qualification here.';
  END IF;
END
$bt$;

COMMIT;
