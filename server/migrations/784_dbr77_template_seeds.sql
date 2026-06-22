-- Migration 784: DBR77 curated deliverable templates (doc / deck / table)
-- Idempotent via ON CONFLICT DO NOTHING.
-- Doc templates: source_type='DELIVERABLE' (generic deliverable docs, nie assessment).
-- Deck templates: TEXT id (presentation_templates.id = TEXT PRIMARY KEY).
-- Table templates: UUID id auto-generated (tp_base_templates.id = UUID PRIMARY KEY).

-- ============================================================
-- DOC templates  →  report_builder_templates
-- Kolumny: id TEXT PK, organization_id TEXT, name TEXT NOT NULL,
--          description TEXT, source_type TEXT NOT NULL,
--          report_type TEXT, sections_json TEXT NOT NULL,
--          default_options_json TEXT, is_system BOOLEAN,
--          is_default BOOLEAN, is_public BOOLEAN,
--          created_by TEXT, created_at TIMESTAMP, updated_at TIMESTAMP
-- ============================================================

INSERT INTO report_builder_templates (
  id, organization_id, name, description,
  source_type, report_type,
  sections_json, default_options_json,
  is_system, is_default, is_public,
  created_by, created_at, updated_at
) VALUES
(
  'dbr77-doc-audit-report',
  NULL,
  'Raport audytowy',
  'Ustrukturyzowany raport z audytu organizacyjnego lub procesowego. Sekcje: streszczenie, metodologia, wyniki, rekomendacje.',
  'DELIVERABLE',
  'audit_report',
  '[{"key":"executive_summary","type":"summary","title":"Streszczenie wykonawcze","order":0,"required":true,"defaultLength":"short","purpose":"Kluczowe wyniki i rekomendacje w skrócie"},{"key":"methodology","type":"methodology","title":"Metodologia","order":1,"required":true,"defaultLength":"short","purpose":"Zakres i podejście badawcze"},{"key":"findings","type":"findings","title":"Wyniki","order":2,"required":true,"defaultLength":"long","purpose":"Szczegółowe ustalenia według obszarów"},{"key":"recommendations","type":"recommendations","title":"Rekomendacje","order":3,"required":true,"defaultLength":"medium","purpose":"Priorytety działań i plan wdrożenia"}]',
  '{"length":"medium","language":"business","verbosity":"standard"}',
  true, false, true,
  NULL, NOW(), NOW()
),
(
  'dbr77-doc-exec-memo',
  NULL,
  'Executive memo',
  'Zwięzłe memo decyzyjne dla zarządu. Sekcje: kontekst, problem, opcje, rekomendacja.',
  'DELIVERABLE',
  'exec_memo',
  '[{"key":"context","type":"context","title":"Kontekst","order":0,"required":true,"defaultLength":"short","purpose":"Sytuacja i tło decyzji"},{"key":"problem","type":"findings","title":"Problem","order":1,"required":true,"defaultLength":"short","purpose":"Kluczowe wyzwanie do rozwiązania"},{"key":"options","type":"list","title":"Opcje","order":2,"required":true,"defaultLength":"medium","purpose":"Warianty rozwiązania z analizą"},{"key":"recommendation","type":"recommendations","title":"Rekomendacja","order":3,"required":true,"defaultLength":"short","purpose":"Rekomendowana opcja z uzasadnieniem"}]',
  '{"length":"short","language":"business","verbosity":"concise"}',
  true, false, true,
  NULL, NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DECK templates  →  presentation_templates
-- Kolumny: id TEXT PK DEFAULT gen_random_uuid()::text,
--          organization_id TEXT, name TEXT NOT NULL,
--          description TEXT, deck_type TEXT NOT NULL,
--          audience TEXT, goal TEXT, language_default TEXT,
--          confidentiality_default TEXT, theme TEXT,
--          outline_json TEXT NOT NULL, max_slides INTEGER,
--          min_slides INTEGER, must_have_intents TEXT,
--          recommended_visuals TEXT, is_system BOOLEAN,
--          is_active BOOLEAN, cloned_from TEXT,
--          created_by TEXT, created_at TIMESTAMP, updated_at TIMESTAMP
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
  'dbr77-deck-board',
  NULL,
  'Board deck',
  'Prezentacja dla zarządu lub rady nadzorczej. Układ: okładka, agenda, kontekst, wyniki, plan, Q&A.',
  'board_presentation',
  'executive',
  'align',
  '[{"intent":"cover","title":"Tytuł prezentacji"},{"intent":"agenda","title":"Agenda"},{"intent":"context","title":"Kontekst i tło"},{"intent":"performance_overview","title":"Wyniki i status"},{"intent":"roadmap","title":"Plan działania"},{"intent":"next_steps","title":"Decyzje i Q&A"}]',
  '["cover","agenda","next_steps"]',
  '["kpi_strip","roadmap_band"]',
  15, 6,
  true, true,
  NULL, NOW(), NOW()
),
(
  'dbr77-deck-diagnostic',
  NULL,
  'Diagnostic deck',
  'Diagnoza organizacji lub procesu. Układ: teza, dane, analiza, wnioski, rekomendacje.',
  'diagnostic',
  'executive',
  'persuade',
  '[{"intent":"cover","title":"Diagnoza"},{"intent":"executive_summary","title":"Teza i kluczowe wnioski"},{"intent":"data_overview","title":"Dane i obserwacje"},{"intent":"analysis","title":"Analiza"},{"intent":"key_messages","title":"Wnioski"},{"intent":"recommendations","title":"Rekomendacje"}]',
  '["cover","executive_summary","recommendations"]',
  '["data_chart","finding_cards","priority_matrix"]',
  20, 8,
  true, true,
  NULL, NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TABLE templates  →  tp_base_templates
-- Kolumny: id UUID PK DEFAULT gen_random_uuid(),
--          name TEXT NOT NULL, description TEXT,
--          category TEXT NOT NULL, thumbnail_url TEXT,
--          schema_snapshot JSONB NOT NULL, is_featured BOOLEAN,
--          usage_count INTEGER, created_by TEXT,
--          created_at TIMESTAMPTZ
-- UWAGA: id = UUID — nie podajemy tekstu; guard na duplikaty przez name+category.
-- ============================================================

INSERT INTO tp_base_templates (
  name, description,
  category, schema_snapshot,
  is_featured, created_by, created_at
)
SELECT
  'Rejestr ryzyk',
  'Tabela do śledzenia ryzyk projektu lub organizacji. Kolumny: ryzyko, prawdopodobieństwo, wpływ, właściciel, status.',
  'risk',
  '{"fields":[{"name":"Ryzyko","type":"text"},{"name":"Prawdopodobieństwo","type":"singleSelect","options":["Niskie","Średnie","Wysokie"]},{"name":"Wpływ","type":"singleSelect","options":["Niski","Średni","Wysoki"]},{"name":"Właściciel","type":"text"},{"name":"Status","type":"singleSelect","options":["Otwarty","W trakcie","Zamknięty"]}]}'::jsonb,
  true, NULL, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM tp_base_templates WHERE name = 'Rejestr ryzyk' AND category = 'risk'
);

INSERT INTO tp_base_templates (
  name, description,
  category, schema_snapshot,
  is_featured, created_by, created_at
)
SELECT
  'Dashboard KPI',
  'Tabela wskaźników KPI z celami i aktualnymi wynikami. Kolumny: wskaźnik, cel, wynik, odchylenie, trend.',
  'kpi',
  '{"fields":[{"name":"Wskaźnik","type":"text"},{"name":"Cel","type":"number"},{"name":"Wynik","type":"number"},{"name":"Odchylenie","type":"number"},{"name":"Trend","type":"singleSelect","options":["↑ Wzrost","→ Stabilny","↓ Spadek"]}]}'::jsonb,
  true, NULL, NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM tp_base_templates WHERE name = 'Dashboard KPI' AND category = 'kpi'
);
