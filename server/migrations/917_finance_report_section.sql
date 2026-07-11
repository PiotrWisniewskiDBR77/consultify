-- Migration 916: sekcja finansowa raportu ("finance-section") — pod kanon F5.
--
-- KONTEKST: `Harvard/wdrozenie-100/_KONCEPT_FINANCE_2026-07-10.md` §3 (silnik wskaźnikowy
-- Z111 "silnik liczy → LLM tylko ubiera w język") + §5 (koszyk EV) + `_SPEC_RECONCILE_R1R8_2026-07-10.md`
-- (reconcile shadow) + `_KONCEPT_RDZEN_2026-07-10.md` §4 (kontrakt F5). Read-model:
-- `financeReportSectionService.ts` (server/src/services/). Kontynuacja sekwencji migracji
-- po 910/912/913/914/915 — WZORZEC DOSŁOWNY migracji 913 (PROGRAM_3AXIS/sponsor-3axis),
-- tylko dla Finance zamiast Program Management.
--
-- CEL (zadanie): doprowadzić TRZY istniejące, ale dotąd "niewidoczne dla usera" silniki
-- Finance do papieru raportu — bez przeliczania ich drugi raz:
--   - financeRatioFamilyCatalog (Z111, 24 wskaźniki / 5 rodzin + DuPont) — silnik był
--     martwy (żaden route/service go nie importował); ta sekcja jest jego pierwszym callerem.
--   - reconciliationService R1-R8 (shadow) — wyniki JUŻ persystowane per pakiet w
--     `financial_statement_validations` (scope='pack') przy każdym recompute; sekcja
--     TYLKO CZYTA ten wynik, nie przelicza drugi raz.
--   - valuationBasketService (koszyk EV, football-field) — synteza nad już policzonym
--     valuationService.computeValuation.
--
-- DWIE CZĘŚCI (dokładnie jak 913):
--   1. `report_definitions` (migracja 910) — wiersz 'finance-section': definicja widoczna
--      w katalogu Finance/Reporting (Tryb 2, live). source_binding wskazuje na
--      financeReportSectionService (dataSources = nazwy silników, front/kokpit czyta i
--      renderuje na żywo).
--   2. `report_builder_templates` — seed dla source_type='FINANCE_SECTION' (kanon F5
--      `reportBuilderService`), żeby `createReport({sourceType:'FINANCE_SECTION'})`
--      (wołane z `financeReportSectionService.publishFinanceReportSectionSnapshot`) miało
--      z czego utworzyć sekcje — wzorzec 614_report_builder_results_kpi_report_template.sql
--      / migracja 913: nagłówek+werdykt / tabela wskaźników+benchmark / wynik reconcile /
--      football-field EV / narracja.
--
-- Idempotentna (ON CONFLICT DO NOTHING / DO UPDATE) — bezpieczna do wielokrotnego
-- uruchomienia. MIGRACJI NIE URUCHAMIAMY tutaj — artefakt do przeglądu (promocja przez
-- skill `consultify-promocja-demo`). Numer sekwencyjny po ostatniej istniejącej migracji
-- na origin/demo w chwili pisania (915_finance_aggregate_scope.sql).

-- ============================================================================
-- 1. report_definitions — 'finance-section'
-- ============================================================================
INSERT INTO report_definitions
  (id, organization_id, key, name, kind, audience, cadence, scope, read_mode, sections_json, source_binding, is_system)
VALUES
  ('finance-section', NULL, 'finance-section', 'Sekcja finansowa raportu (wskaźniki + reconcile + EV)',
   'FINANCE_SECTION', 'CFO, Sponsor, Steering Committee', 'On demand (per pakiet sprawozdań)',
   'Jeden pakiet sprawozdań (financial_statement_packs) + opcjonalnie powiązana wycena', 'live',
   '["Nagłówek i werdykt","Tabela wskaźników (z benchmarkiem)","Wynik reconcile (R1-R8)","Koszyk EV — football field","Narracja"]'::jsonb,
   '{"service":"financeReportSectionService","dataSources":["financeRatioFamilyCatalog (Z111, 24 wskaźników/5 rodzin + DuPont)","reconciliationService R1-R8 (shadow, czytane z financial_statement_validations)","valuationBasketService (koszyk EV M1-M4, football-field)"],"ragLogic":"Worst-of(reconcile.overallStatus, EV consistencyFlag); reconcile: fail=RED/warning=AMBER/pass=GREEN/brak=NA; EV: rozjazd metod >20%=AMBER, spójne=GREEN, brak wyceny=NA","followUpActions":["Uzupełnić mapowanie linii kanonicznych (wskaźniki skipped)","Przeliczyć pakiet (recomputeStatementPack) jeśli reconcile niedostępny","Przejrzeć założenia wyceny gdy koszyk EV rozjeżdża się >20%"],"icon":{"name":"Calculator","className":"text-emerald-600"},"highlights":[{"label":"Wskaźniki","metric":"ratiosComputed"},{"label":"Reconcile","metric":"reconcileStatus","variant":"warnIfPos"},{"label":"EV rozjazd","metric":"evDivergencePct","variant":"warnIfPos"}]}'::jsonb,
   TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. report_builder_templates — seed dla FINANCE_SECTION (kanon reportBuilderService)
-- ============================================================================
INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public,
  created_by, created_at, updated_at
) VALUES (
  'tpl-finance-section',
  NULL,
  'Finance — Sekcja finansowa raportu',
  'Sekcja finansowa: wskaźniki Z111 (financeRatioFamilyCatalog, 24/5 rodzin) + reconcile R1-R8 (shadow, czytane nie przeliczane) + koszyk EV (valuationBasketService, football-field). Deterministyczna — zero liczb z LLM. Kontrakt F5 (_KONCEPT_RDZEN §4).',
  'FINANCE_SECTION',
  NULL,
  '[
    {"key":"header","type":"cover","title":"Nagłówek i werdykt","order":0,"required":true,"defaultLength":"short","defaultLanguage":"business"},
    {"key":"ratio_table","type":"matrix","title":"Tabela wskaźników (z benchmarkiem)","order":1,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"reconcile_result","type":"list","title":"Wynik reconcile (R1-R8)","order":2,"required":true,"defaultLength":"medium","defaultLanguage":"technical"},
    {"key":"ev_football_field","type":"matrix","title":"Koszyk EV — football field","order":3,"required":false,"defaultLength":"short","defaultLanguage":"business"},
    {"key":"narrative","type":"summary","title":"Narracja","order":4,"required":false,"defaultLength":"short","defaultLanguage":"business"}
  ]',
  '{"length":"medium","language":"business","verbosity":"standard","invocationProfile":"finance_section_executive"}',
  true, true, false,
  'system',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  source_type = EXCLUDED.source_type,
  report_type = EXCLUDED.report_type,
  sections_json = EXCLUDED.sections_json,
  default_options_json = EXCLUDED.default_options_json,
  is_system = EXCLUDED.is_system,
  is_default = EXCLUDED.is_default,
  is_public = EXCLUDED.is_public,
  created_by = EXCLUDED.created_by,
  updated_at = EXCLUDED.updated_at;
