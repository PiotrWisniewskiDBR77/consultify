-- Migration 785: DBR77 curated templates — 3rd per format (F3.2 DoD ≥3/format)
-- Extends migration 784. Idempotent (ON CONFLICT / WHERE NOT EXISTS).
-- Adds: doc 'Raport statusowy', deck 'Investor pitch', table 'Rejestr inicjatyw'.

-- ============================================================
-- DOC: status report  →  report_builder_templates
-- ============================================================
INSERT INTO report_builder_templates (
  id, organization_id, name, description,
  source_type, report_type,
  sections_json, default_options_json,
  is_system, is_default, is_public,
  created_by, created_at, updated_at
) VALUES
(
  'dbr77-doc-status-report',
  NULL,
  'Raport statusowy',
  'Okresowy raport postępu projektu dla sponsora. Sekcje: streszczenie statusu, zakres, postęp, ryzyka, następne kroki.',
  'DELIVERABLE',
  'status_report',
  '[{"key":"status_summary","type":"summary","title":"Streszczenie statusu","order":0,"required":true,"defaultLength":"short","purpose":"Status RAG, kluczowe osiągnięcia i alerty"},{"key":"scope","type":"context","title":"Zakres i cele","order":1,"required":true,"defaultLength":"short","purpose":"Cele okresu i zakres prac"},{"key":"progress","type":"findings","title":"Postęp i osiągnięcia","order":2,"required":true,"defaultLength":"long","purpose":"Co zrobiono względem planu"},{"key":"risks","type":"list","title":"Ryzyka i blokery","order":3,"required":true,"defaultLength":"medium","purpose":"Otwarte ryzyka, blokery, plan mitygacji"},{"key":"next_steps","type":"recommendations","title":"Następne kroki","order":4,"required":true,"defaultLength":"short","purpose":"Priorytety i decyzje na kolejny okres"}]',
  '{"length":"medium","language":"business","verbosity":"standard"}',
  true, false, true,
  NULL, NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DECK: investor pitch  →  presentation_templates
-- ============================================================
INSERT INTO presentation_templates (
  id, organization_id, name, description,
  deck_type, audience, goal,
  outline_json, must_have_intents, recommended_visuals,
  max_slides, min_slides,
  is_system, is_active,
  created_by, created_at, updated_at
) VALUES
(
  'dbr77-deck-investor-pitch',
  NULL,
  'Investor pitch',
  'Pitch inwestorski: problem→rozwiązanie→trakcja→ask. Układ: okładka, teza, problem/rynek, rozwiązanie, model+trakcja, plan, ask.',
  'investor_pitch',
  'investor',
  'persuade',
  '[{"intent":"cover","title":"Pitch inwestorski"},{"intent":"executive_summary","title":"Teza i ask"},{"intent":"context","title":"Problem i rynek"},{"intent":"key_messages","title":"Rozwiązanie i przewaga"},{"intent":"performance_overview","title":"Trakcja i model"},{"intent":"roadmap","title":"Plan i kamienie milowe"},{"intent":"next_steps","title":"Ask i następne kroki"}]',
  '["cover","executive_summary","next_steps"]',
  '["kpi_strip","data_chart","roadmap_band"]',
  18, 7,
  true, true,
  NULL, NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TABLE: initiative register  →  tp_base_templates (UUID PK, guard by name+category)
-- ============================================================
INSERT INTO tp_base_templates (
  name, description,
  category, schema_snapshot,
  is_featured, created_by, created_at
)
SELECT
  'Rejestr inicjatyw',
  'Tabela do śledzenia inicjatyw/zadań z priorytetem i postępem. Kolumny: inicjatywa, właściciel, priorytet, status, postęp.',
  'initiative',
  '{"fields":[{"name":"Inicjatywa","type":"text"},{"name":"Właściciel","type":"text"},{"name":"Priorytet","type":"singleSelect","options":["Wysoki","Średni","Niski"]},{"name":"Status","type":"singleSelect","options":["Backlog","W toku","Zrobione"]},{"name":"Postęp (%)","type":"number"}]}'::jsonb,
  true, NULL, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM tp_base_templates WHERE name = 'Rejestr inicjatyw' AND category = 'initiative'
);
