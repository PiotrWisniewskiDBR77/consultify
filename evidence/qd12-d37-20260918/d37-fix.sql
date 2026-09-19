-- ============================================================================
-- QD12 / D-37 — Northwind: dopięcie planu transformacji do sprawy (RUNBOOK, idempotentny)
-- ----------------------------------------------------------------------------
-- Źródło długu: DLUG-PO-MVP.md D-37 (17.09). Mandat QD12 (KOLEJKI-DO-KONCA, Qoder D):
-- "TYLKO symulacja na kopii, staging nietknięty bez słowa CTO".
--
-- Org: Northwind = 468b234c-66c4-54e1-b626-5e0fb3a92f6a
-- Sprawa: transformation_case_id = 565fa3f3-5cd3-5589-889b-9fcec0c5cd28
--         status=active, lifecycle_stage=portfolio_decision, active_plan_id=NULL
--
-- KROK 0 (pomiar na kopii dumpu staging-pre-wdrozenie29-20260918T2052.dump):
--  * transformation_plans: 2 wiersze globalnie, OBA w DBR77 (a3e05d4a); **0** dla Northwind.
--  * transformation_case_artifact_links: **9** powiązań sprawy NW z inicjatywami NW
--    (artifact_type='initiative') — noga (1) joina spełniona.
--  * resolveInitiativeTransitionCase (initiativeLifecycleGateDecisionService.ts:280-292)
--    robi INNER JOIN transformation_plans p ON p.plan_id=c.active_plan_id … → bo
--    active_plan_id=NULL i planów NW=0, join zwraca **0 wierszy** → linia 295 rzuca
--    INITIATIVE_TRANSITION_CASE_REQUIRED → trasa oddaje **409** dla KAŻDEJ z 9 inicjatyw NW.
--    Zmierzone realnym SQL-em produktu: join dla inicjatywy 88013795 = 0 wierszy (409).
--
-- FIX (wariant „dopiąć plan transformacji do sprawy NW" z D-37): 1 plan + active_plan_id.
--   Treść summary WYPROWADZONA z istniejącego mandate/desired_outcomes sprawy (nie fabrykowana):
--   mandate = "Northwind 2027: reduce unplanned downtime, cut handling cost per unit and
--   certify the energy management system."; outcomes = [downtime -30%, handling cost -20%, ISO 50001].
--   created_by_user_id = initiated_by_user_id sprawy (08c54d75 = james.whitfield@northwind.example).
--   methodology_key/status/version jak w jedynym wzorcu DBR77 (consultify-transformation-v1, approved, v1).
--
-- DECYZJA dla CTO: D-37 daje alternatywę „ALBO poluzować wymóg planu w rodowodzie — po MVP"
--   (zmiana KODU, zakres Codex, post-MVP). Ten runbook to wariant DANYCH (demo-data completion),
--   rekomendowany teraz, bo odblokowuje kolejkę „Do akceptacji" (A05) na danych pokazowych bez
--   zmiany kontraktu rodowodu. Bez słowa CTO nie stosuję na stagingu.
--
-- Idempotencja: INSERT … ON CONFLICT (transformation_case_id, version) DO NOTHING;
--   UPDATE … WHERE active_plan_id IS NULL → 2. przebieg = 0 zmian.
-- Kopia przed-zmiany: tabela d37_fix_backup (before-image sprawy).
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS d37_fix_backup (
  captured_at timestamptz NOT NULL DEFAULT now(),
  tbl         text        NOT NULL,
  row_id      text        NOT NULL,
  row_json    jsonb       NOT NULL
);

-- ---- backup before-image sprawy (jedyny record, który zmieniamy) -----------
INSERT INTO d37_fix_backup (tbl, row_id, row_json)
SELECT 'transformation_cases', c.transformation_case_id::text, to_jsonb(c)
FROM public.transformation_cases c
WHERE c.transformation_case_id = '565fa3f3-5cd3-5589-889b-9fcec0c5cd28'
  AND c.active_plan_id IS NULL;

-- ---- (1) dopnij plan transformacji do sprawy NW ----------------------------
INSERT INTO public.transformation_plans
  (plan_id, transformation_case_id, organization_id, version, status, methodology_key, summary, created_by_user_id)
VALUES
  ('d37a5f00-0000-4000-8000-565fa3f3cd28',
   '565fa3f3-5cd3-5589-889b-9fcec0c5cd28',
   '468b234c-66c4-54e1-b626-5e0fb3a92f6a',
   1,
   'approved',
   'consultify-transformation-v1',
   'Transformation plan: Northwind 2027 — reduce unplanned downtime by 30%, cut handling cost per unit by 20%, and certify the energy management system to ISO 50001.',
   '08c54d75-5260-57b1-9db6-a30aed89a587')
ON CONFLICT (transformation_case_id, version) DO NOTHING;

-- ---- (2) ustaw active_plan_id sprawy na nowy plan (FK deferred) ------------
UPDATE public.transformation_cases
SET active_plan_id = 'd37a5f00-0000-4000-8000-565fa3f3cd28',
    updated_at     = now()
WHERE transformation_case_id = '565fa3f3-5cd3-5589-889b-9fcec0c5cd28'
  AND active_plan_id IS NULL;

COMMIT;
