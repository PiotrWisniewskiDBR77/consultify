-- Migration 913: raport wykonawczy „3 osie" (flagowy raport PM) — pod kanon F5.
--
-- KONTEKST: `Harvard/wdrozenie-100/_KONCEPT_PROGRAM_MANAGEMENT_2026-07-10.md` §6
-- ("wzorzec 3 osie — czas × zadania × parametr fin-op", McKinsey Wave) +
-- `_KONCEPT_RDZEN_2026-07-10.md` §4.3 punkt 3 ("Pierwszy raport nowego toru F5 =
-- raport 3 osi PM. Wzorzec dla pozostałych."). Read-model: `threeAxisReportService.ts`
-- (server/src/services/execution/). Kontynuacja sekwencji migracji po 904/905/910/912.
--
-- DWIE CZĘŚCI:
--   1. `report_definitions` (migracja 910) — wiersz 'sponsor-3axis': definicja
--      widoczna w katalogu Execution/Reporting (Tryb 2, live). source_binding
--      wskazuje na threeAxisReportService (dataSources = nazwy osi/serwisów, nie
--      URL-e — front/kokpit czyta je i renderuje na żywo).
--   2. `report_builder_templates` — seed dla source_type='PROGRAM_3AXIS' (kanon F5
--      `reportBuilderService`), żeby `createReport({sourceType:'PROGRAM_3AXIS'})`
--      (wołane z `threeAxisReportService.publishThreeAxisSnapshot`) miało z czego
--      utworzyć sekcje — DOKŁADNIE wzorzec 614_report_builder_results_kpi_report_template.sql
--      (RESULTS_KPI_REPORT), sekcje wg anatomii §6: nagłówek+RAG / 3 osie / wyjątki /
--      alerty+decyzje / narracja / aneks.
--
-- Idempotentna (ON CONFLICT DO NOTHING / DO UPDATE) — bezpieczna do wielokrotnego
-- uruchomienia. MIGRACJI NIE URUCHAMIAMY tutaj — artefakt do przeglądu (promocja
-- przez skill `consultify-promocja-demo`).

-- ============================================================================
-- 1. report_definitions — 'sponsor-3axis'
-- ============================================================================
INSERT INTO report_definitions
  (id, organization_id, key, name, kind, audience, cadence, scope, read_mode, sections_json, source_binding, is_system)
VALUES
  ('sponsor-3axis', NULL, 'sponsor-3axis', 'Raport wykonawczy — 3 osie (czas × zadania × wartość)',
   'PROGRAM_3AXIS', 'Sponsor, Steering Committee, PMO', 'Weekly (Z-vs-T) / Monthly (W value review)',
   'Program lub projekt — agregat + top inicjatywy', 'live',
   '["Nagłówek i werdykt RAG","Trzy osie — program i inicjatywy","Wyjątki (odchylenia Z-vs-T i W-vs-Z)","Alerty i decyzje wymagane","Narracja","Aneks — pełna tabela"]'::jsonb,
   '{"service":"threeAxisReportService","dataSources":["evmService (T,Z,SPI)","value_baselines+value_ledger_entries+initiative_kpis (W)","criticalPathService (TODO — earned-schedule alternative dla T)"],"ragLogic":"Worst-of(scheduleHealth Z-vs-T, impactGap W-vs-Z, deliveryPromise W-vs-T); progi identyczne z evmService.indexRag (>=0.95 GREEN, >=0.85 AMBER, else RED)","followUpActions":["Zamrozić brakujące baseline''y wartości (KPI bez target)","Uzupełnić daty harmonogramu (planned_start_date/planned_end_date)","Zbadać top odchylenia W-vs-Z (luka wpływu)"],"icon":{"name":"Activity","className":"text-indigo-500"},"highlights":[{"label":"T","metric":"programT"},{"label":"Z","metric":"programZ"},{"label":"W","metric":"programW","variant":"warnIfPos"}]}'::jsonb,
   TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. report_builder_templates — seed dla PROGRAM_3AXIS (kanon reportBuilderService)
-- ============================================================================
INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public,
  created_by, created_at, updated_at
) VALUES (
  'tpl-program-3axis',
  NULL,
  'Program — Raport 3 osi (czas × zadania × wartość)',
  'Flagowy raport wykonawczy PM: T (earned-schedule) × Z (EV/BAC) × W (value_ledger banked/target). Wzorzec McKinsey Wave. Kontrakt F5 (_KONCEPT_RDZEN §4).',
  'PROGRAM_3AXIS',
  NULL,
  '[
    {"key":"header","type":"cover","title":"Nagłówek i werdykt","order":0,"required":true,"defaultLength":"short","defaultLanguage":"business"},
    {"key":"three_axis_overview","type":"matrix","title":"Trzy osie — program i inicjatywy","order":1,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"exceptions","type":"list","title":"Wyjątki (odchylenia)","order":2,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"alerts_decisions","type":"list","title":"Alerty i decyzje wymagane","order":3,"required":false,"defaultLength":"short","defaultLanguage":"business"},
    {"key":"narrative","type":"summary","title":"Narracja","order":4,"required":false,"defaultLength":"short","defaultLanguage":"business"},
    {"key":"appendix","type":"appendix","title":"Aneks — pełna tabela","order":5,"required":false,"defaultLength":"long","defaultLanguage":"technical"}
  ]',
  '{"length":"medium","language":"business","verbosity":"standard","invocationProfile":"program_3axis_executive"}',
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
