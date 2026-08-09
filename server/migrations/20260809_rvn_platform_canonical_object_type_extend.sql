-- RN-G1 Platform Foundation — extend v8_canonical_object_states.object_type.
--
-- Design: docs/product/results-vnext/RN_G1_PLATFORM_DESIGN.md §C.1.
--
-- PRZED PROMOCJĄ NA DEMO: zweryfikować przez information_schema który schema
-- (public vs v8) jest realnie żywy na demo — patrz EXECUTION_LEDGER.md §7
-- decyzja #3. Ta migracja NIE jest auto-promowana przez sam fakt istnienia
-- w gałęzi.
--
-- Verified against source (not guessed from the design doc) via:
--   grep -rn "v8_canonical_object_states_object_type_check\|CREATE TABLE.*v8_canonical_object_states" server/migrations/ server/migrations-v2/
-- Findings:
--   - server/migrations/20260323_v8_mywork_roof.sql:9-21 creates
--     `v8_canonical_object_states` (no explicit schema prefix — resolves to
--     `public` under the search_path this repo's runner uses) with an
--     inline CHECK on object_type IN ('task','decision','initiative',
--     'milestone','approval','ai_proposal','notification','signal') — this
--     is the file that, run through Postgres, produces the
--     auto-generated constraint name used below.
--   - server/migrations-v2/001_baseline_20260413.sql:33409-33416 confirms
--     `public.v8_canonical_object_states` with the SAME 8-value list under
--     the exact name `v8_canonical_object_states_object_type_check`; the
--     same table/constraint is duplicated again for `v8.v8_canonical_object_states`
--     at migrations-v2 line 37297-37304.
--   - server/migrations/20260719_baseline_gap.sql:30617-30622 re-applies
--     the identical CHECK (as a NOT VALID + VALIDATE pair) against
--     `v8"."v8_canonical_object_states` — i.e. the v8 schema copy, not public.
-- This migration follows the design's chosen target (`public.`, "wzorzec
-- wszystkich innych tabel znalezionych w audycie") and does NOT touch the
-- v8-schema duplicate — see the gate comment above for why that must be
-- confirmed against the live demo database before promotion, not assumed.

DO $$
BEGIN
  ALTER TABLE public.v8_canonical_object_states
    DROP CONSTRAINT IF EXISTS v8_canonical_object_states_object_type_check;

  ALTER TABLE public.v8_canonical_object_states
    ADD CONSTRAINT v8_canonical_object_states_object_type_check
    CHECK (object_type = ANY (ARRAY[
      'task','decision','initiative','milestone','approval',
      'ai_proposal','notification','signal',
      'kpi','roi_case','okr_set','deviation_case'
    ]::text[]))
    NOT VALID;

  ALTER TABLE public.v8_canonical_object_states
    VALIDATE CONSTRAINT v8_canonical_object_states_object_type_check;
EXCEPTION WHEN undefined_table THEN
  -- Fresh/partial environments where v8_canonical_object_states has not
  -- been created yet (e.g. 20260323_v8_mywork_roof.sql has not run):
  -- nothing to extend, skip rather than fail the whole --safe chain.
  NULL;
END $$;
