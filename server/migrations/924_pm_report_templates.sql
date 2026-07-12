-- Migration 924: 3 szablony raportów Program Management ("raporty PM na start").
--
-- KONTEKST: decyzje właściciela D12+D13 (`Harvard/wdrozenie-100/_DECYZJE_PIOTRA_2026-07-12.md`):
--   D13 — pierwsze 3 raporty PM = Sponsor One-Pager + Steering + PMO weekly.
--   D12 — 3. oś (W = wartość) rozbita na DWIE osobne perspektywy: wartość finansowa
--         i KPI operacyjny (nie jeden zlany wskaźnik). `threeAxisReportService.computeAxisW`
--         zostaje NIETKNIĘTY (inne raporty go używają) — rozdział jest PREZENTACYJNY,
--         zaimplementowany w `programManagementReportsService.fetchProgramValueAxisSplit`
--         (grupowanie value_baselines+initiative_kpis wg `unit`: waluty = finansowe,
--         reszta = operacyjne) i widoczny w sekcji `three_axis_snapshot` Sponsora.
--
-- SIOSTRZANA migracja do 913_program_3axis_report.sql (ten sam wzorzec: wpis w
-- `report_definitions` — rejestr F5 — + wpis w `report_builder_templates` — kanon
-- Report Buildera, żeby szablon był wybieralny w picker/library). ZERO nowych
-- silników: sekcje renderowane przez `programManagementReportsService.ts`, kompozyt
-- nad już istniejącymi read-modelami (threeAxisReportService, executionControlReadService,
-- aiRiskChangeControl, workloadCapacityService, initiativeLineageService, tabela `tasks`).
--
-- Idempotentna (ON CONFLICT DO NOTHING) — bezpieczna do wielokrotnego uruchomienia.
-- MIGRACJI NIE URUCHAMIAMY tutaj — artefakt do przeglądu (promocja przez skill
-- `consultify-promocja-demo`, NIE-auto-apply).

-- ============================================================================
-- 1. report_definitions — rejestr F5 (katalog raportów PM, tryb 'live')
-- ============================================================================
INSERT INTO report_definitions
  (id, organization_id, key, name, kind, audience, cadence, scope, read_mode, sections_json, source_binding, is_system)
VALUES
  ('pm-report-sponsor-onepager', NULL, 'pm-report-sponsor-onepager',
   'Sponsor One-Pager', 'PROGRAM_MANAGEMENT_PACK', 'Executive Sponsors', 'On demand',
   'Program lub projekt — agregat', 'live',
   '["Nagłówek i werdykt RAG","Trzy osie (agregat) + D12 split wartość/KPI","Top 3 alerty","Decyzje czekające"]'::jsonb,
   '{"service":"programManagementReportsService.buildSponsorOnePager","dataSources":["threeAxisReportService (T,Z,W)","executionControlReadService.getTimelineWarningsSnapshot (alerty)","decisions (decyzje czekające)","value_baselines+initiative_kpis (D12 split finansowa/operacyjna)"],"followUpActions":["Zamknąć top alerty","Rozstrzygnąć decyzje czekające"],"icon":{"name":"FileText","className":"text-indigo-500"},"highlights":[{"label":"RAG","metric":"programRag"},{"label":"Alerty","metric":"topAlertsCount","variant":"warnIfPos"}]}'::jsonb,
   TRUE),

  ('pm-report-steering', NULL, 'pm-report-steering',
   'Raport Steering', 'PROGRAM_MANAGEMENT_PACK', 'Steering Committee', 'Bi-weekly',
   'Program lub projekt — per inicjatywa', 'live',
   '["Nagłówek i werdykt RAG","Trzy osie per inicjatywa","Ryzyka otwarte","Zmiany zakresu (30 dni)"]'::jsonb,
   '{"service":"programManagementReportsService.buildSteering","dataSources":["threeAxisReportService (T,Z,W per inicjatywa)","aiRiskChangeControl.getOpenRisks (risk_register)","aiRiskChangeControl.getScopeChangeSummary (scope_change_log)"],"followUpActions":["Zamknąć krytyczne ryzyka","Zatwierdzić/odrzucić niekontrolowane zmiany zakresu"],"icon":{"name":"Shield","className":"text-emerald-500"},"highlights":[{"label":"Ryzyka","metric":"openRisksCount","variant":"critIfPos"},{"label":"Kontrola zakresu","metric":"scopeControlRate"}]}'::jsonb,
   TRUE),

  ('pm-report-pmo-weekly', NULL, 'pm-report-pmo-weekly',
   'PMO Weekly', 'PROGRAM_MANAGEMENT_PACK', 'PMO, Team Leads', 'Weekly',
   'Organizacja lub projekt — operacyjny', 'live',
   '["Nagłówek","Zadania on-time / late","Obciążenia (workload) + przeciążeni","Cycle-time per status"]'::jsonb,
   '{"service":"programManagementReportsService.buildPmoWeekly","dataSources":["tasks (on-time/late — due_date vs completed_at)","workloadCapacityService.getCapacityOverview + getOverloadAlerts (/api/capacity)","initiativeLineageService.getInitiativeFunnel.cycleTime (Observability)"],"followUpActions":["Rozładować przeciążone osoby","Przyspieszyć zadania po terminie"],"icon":{"name":"Clock","className":"text-amber-500"},"highlights":[{"label":"Po terminie","metric":"openLate","variant":"critIfPos"},{"label":"Wykorzystanie","metric":"avgUtilization"}]}'::jsonb,
   TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. report_builder_templates — kanon Report Buildera (picker/library)
-- ============================================================================

INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public,
  audience, use_case, category,
  created_by, created_at, updated_at
) VALUES (
  'tpl-pm-sponsor-onepager',
  NULL,
  'Sponsor One-Pager',
  '1 strona dla sponsora: agregat 3 osi (czas × zadania × wartość, z rozbiciem D12 na wartość finansową i KPI operacyjny), top 3 alerty (overdue/blocked) i decyzje czekające na akceptację.',
  'PROGRAM_MANAGEMENT',
  'SPONSOR_ONEPAGER',
  '[
    {"key":"header","type":"cover","title":"Nagłówek i werdykt","order":0,"required":true,"defaultLength":"short","defaultLanguage":"business"},
    {"key":"three_axis_snapshot","type":"matrix","title":"Trzy osie (agregat) + D12 split","order":1,"required":true,"defaultLength":"short","defaultLanguage":"business"},
    {"key":"top_alerts","type":"list","title":"Top 3 alerty","order":2,"required":true,"defaultLength":"short","defaultLanguage":"business"},
    {"key":"pending_decisions","type":"list","title":"Decyzje czekające","order":3,"required":true,"defaultLength":"short","defaultLanguage":"business"}
  ]',
  '{"length":"short","language":"business","verbosity":"concise","invocationProfile":"program_3axis_executive"}',
  true, false, false,
  'Executive Sponsors', 'Raport na start — 1 strona, cotygodniowy/na żądanie przegląd sponsora', 'Program Management',
  'system',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  source_type = EXCLUDED.source_type,
  report_type = EXCLUDED.report_type,
  sections_json = EXCLUDED.sections_json,
  default_options_json = EXCLUDED.default_options_json,
  audience = EXCLUDED.audience,
  use_case = EXCLUDED.use_case,
  category = EXCLUDED.category,
  updated_at = EXCLUDED.updated_at;

INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public,
  audience, use_case, category,
  created_by, created_at, updated_at
) VALUES (
  'tpl-pm-steering',
  NULL,
  'Raport Steering',
  'Pełniejszy przegląd dla komitetu sterującego: 3 osie per inicjatywa, ryzyka otwarte (risk_register) i zmiany zakresu z ostatnich 30 dni (scope_change_log).',
  'PROGRAM_MANAGEMENT',
  'STEERING',
  '[
    {"key":"header","type":"cover","title":"Nagłówek i werdykt","order":0,"required":true,"defaultLength":"short","defaultLanguage":"business"},
    {"key":"three_axis_by_initiative","type":"matrix","title":"Trzy osie per inicjatywa","order":1,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"risks","type":"list","title":"Ryzyka otwarte","order":2,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"scope_changes","type":"list","title":"Zmiany zakresu (30 dni)","order":3,"required":false,"defaultLength":"short","defaultLanguage":"business"}
  ]',
  '{"length":"medium","language":"business","verbosity":"standard","invocationProfile":"program_3axis_executive"}',
  true, false, false,
  'Steering Committee', 'Przegląd bi-weekly dla komitetu sterującego — wymaga projectId dla sekcji ryzyk/zakresu', 'Program Management',
  'system',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  source_type = EXCLUDED.source_type,
  report_type = EXCLUDED.report_type,
  sections_json = EXCLUDED.sections_json,
  default_options_json = EXCLUDED.default_options_json,
  audience = EXCLUDED.audience,
  use_case = EXCLUDED.use_case,
  category = EXCLUDED.category,
  updated_at = EXCLUDED.updated_at;

INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public,
  audience, use_case, category,
  created_by, created_at, updated_at
) VALUES (
  'tpl-pm-weekly',
  NULL,
  'PMO Weekly',
  'Raport operacyjny PMO: zadania on-time/late, obciążenia zespołu (capacity/overload) i cycle-time per status inicjatyw (Observability).',
  'PROGRAM_MANAGEMENT',
  'PMO_WEEKLY',
  '[
    {"key":"header","type":"cover","title":"Nagłówek","order":0,"required":true,"defaultLength":"short","defaultLanguage":"business"},
    {"key":"tasks_on_time_late","type":"list","title":"Zadania on-time / late","order":1,"required":true,"defaultLength":"short","defaultLanguage":"business"},
    {"key":"capacity_workload","type":"list","title":"Obciążenia (workload)","order":2,"required":true,"defaultLength":"medium","defaultLanguage":"business"},
    {"key":"cycle_time","type":"matrix","title":"Cycle-time per status","order":3,"required":false,"defaultLength":"medium","defaultLanguage":"technical"}
  ]',
  '{"length":"medium","language":"business","verbosity":"standard","invocationProfile":"program_3axis_executive"}',
  true, false, false,
  'PMO, Team Leads', 'Raport tygodniowy PMO — kadencja domyślna ON (D5)', 'Program Management',
  'system',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  source_type = EXCLUDED.source_type,
  report_type = EXCLUDED.report_type,
  sections_json = EXCLUDED.sections_json,
  default_options_json = EXCLUDED.default_options_json,
  audience = EXCLUDED.audience,
  use_case = EXCLUDED.use_case,
  category = EXCLUDED.category,
  updated_at = EXCLUDED.updated_at;
