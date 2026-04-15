-- Migration: 512_report_builder_repair_sqlite.sql
-- Purpose: Repair/ensure Report Builder core tables exist in SQLite dev DBs.
-- Why: Some SQLite dev DBs can end up with schema_migrations marking report_builder migrations as applied,
--      while the actual report_builder_* tables were never created (e.g., due to mixed-dialect safe-mode skips).
-- Scope:
--  - Ensure core report builder tables exist (reports, sections, templates, sessions, activity)
--  - Ensure template_id exists on report_builder_reports
--  - (Re)seed the 9 comprehensive system templates (DRD/SIRI/ADMA × Full/Board/Bank)
--
-- Safe / idempotent:
--  - Uses CREATE TABLE IF NOT EXISTS
--  - Uses CREATE INDEX IF NOT EXISTS
--  - Uses INSERT OR REPLACE for templates
--  - ALTER TABLE may error if column exists; migration runner skips duplicate-column errors on SQLite.

-- ==========================================
-- CORE TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS report_builder_reports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  project_id TEXT,

  -- Source reference (polymorphic)
  source_type TEXT NOT NULL,  -- 'ASSESSMENT' | 'INTERVIEW' | 'TOOL' | 'INITIATIVE'
  source_id TEXT NOT NULL,
  source_name TEXT,
  source_framework TEXT,  -- e.g., 'DRD', 'SIRI', 'ADMA' for assessments

  -- Report metadata
  title TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,  -- e.g., 'ASSESSMENT_DRD'

  -- Selected template (optional)
  template_id TEXT,

  -- Configuration (JSON)
  config_json TEXT,

  -- Company context snapshot (JSON)
  company_context_json TEXT,

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'DRAFT',

  -- Ownership & timestamps
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT,

  -- Workflow timestamps
  generated_at TIMESTAMP,
  finalized_at TIMESTAMP,
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by TEXT,
  utilized_at TIMESTAMP,

  -- Version tracking
  version INTEGER DEFAULT 1,
  parent_report_id TEXT,

  -- Export paths
  pdf_path TEXT,
  pptx_path TEXT,

  -- Generation metadata (JSON)
  generation_metadata TEXT,

  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id),
  FOREIGN KEY (parent_report_id) REFERENCES report_builder_reports(id)
);

CREATE INDEX IF NOT EXISTS idx_rb_reports_organization ON report_builder_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_rb_reports_source ON report_builder_reports(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_rb_reports_status ON report_builder_reports(status);
CREATE INDEX IF NOT EXISTS idx_rb_reports_created_by ON report_builder_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_rb_reports_type ON report_builder_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_rb_reports_created_at ON report_builder_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rb_reports_template_id ON report_builder_reports(template_id);

CREATE TABLE IF NOT EXISTS report_builder_sections (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,

  -- Section identity
  section_key TEXT NOT NULL,
  section_type TEXT NOT NULL,
  title TEXT NOT NULL,

  -- Ordering
  order_index INTEGER NOT NULL DEFAULT 0,

  -- Configuration
  enabled BOOLEAN DEFAULT 1,
  required BOOLEAN DEFAULT 0,

  -- Generation options
  length TEXT DEFAULT 'medium',
  language TEXT DEFAULT 'business',
  custom_prompt TEXT,

  -- Content
  generated_content TEXT,
  edited_content TEXT,
  content_format TEXT DEFAULT 'markdown',
  tiptap_content TEXT,
  source_data_snapshot TEXT,

  -- Generation metadata
  generated_at TIMESTAMP,
  tokens_used INTEGER,
  generation_model TEXT,

  -- Edit metadata
  edited_at TIMESTAMP,
  edited_by TEXT,

  -- Repeat info
  repeat_for TEXT,
  repeat_key TEXT,
  repeat_name TEXT,
  repeat_data TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (report_id) REFERENCES report_builder_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (edited_by) REFERENCES users(id),

  UNIQUE(report_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_rb_sections_report ON report_builder_sections(report_id);
CREATE INDEX IF NOT EXISTS idx_rb_sections_key ON report_builder_sections(report_id, section_key);
CREATE INDEX IF NOT EXISTS idx_rb_sections_order ON report_builder_sections(report_id, order_index);

-- ==========================================
-- BLOCK TYPES + SECTION EXTENSIONS (506)
-- ==========================================

CREATE TABLE IF NOT EXISTS report_builder_block_types (
  id TEXT PRIMARY KEY,
  organization_id TEXT, -- NULL for system block types
  name TEXT NOT NULL,
  description TEXT,
  source_types_json TEXT, -- JSON array
  render_kind TEXT NOT NULL DEFAULT 'markdown',
  prompt_template TEXT,
  input_schema_json TEXT,
  default_length TEXT DEFAULT 'medium',
  default_language TEXT DEFAULT 'business',
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_rb_block_types_org ON report_builder_block_types(organization_id);
CREATE INDEX IF NOT EXISTS idx_rb_block_types_active ON report_builder_block_types(is_active);

ALTER TABLE report_builder_sections ADD COLUMN block_type_id TEXT;
ALTER TABLE report_builder_sections ADD COLUMN block_config_json TEXT;
ALTER TABLE report_builder_sections ADD COLUMN render_kind TEXT;
CREATE INDEX IF NOT EXISTS idx_rb_sections_block_type ON report_builder_sections(block_type_id);

CREATE TABLE IF NOT EXISTS report_builder_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT,  -- NULL for system templates

  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL,
  report_type TEXT,

  sections_json TEXT NOT NULL,
  default_options_json TEXT,

  is_system BOOLEAN DEFAULT 0,
  is_default BOOLEAN DEFAULT 0,
  is_public BOOLEAN DEFAULT 0,

  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_rb_templates_org ON report_builder_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_rb_templates_type ON report_builder_templates(source_type, report_type);

CREATE TABLE IF NOT EXISTS report_builder_sessions (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,

  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  navigation_state TEXT,

  UNIQUE(report_id, user_id),
  FOREIGN KEY (report_id) REFERENCES report_builder_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_rb_sessions_user ON report_builder_sessions(user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_rb_sessions_opened ON report_builder_sessions(opened_at DESC);

CREATE TABLE IF NOT EXISTS report_builder_activity (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_by TEXT NOT NULL,
  action_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,
  FOREIGN KEY (report_id) REFERENCES report_builder_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (action_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_rb_activity_report ON report_builder_activity(report_id);
CREATE INDEX IF NOT EXISTS idx_rb_activity_time ON report_builder_activity(action_at DESC);

-- ==========================================
-- COMPREHENSIVE SYSTEM TEMPLATES (9)
-- ==========================================

-- DRD Full Diagnostic Report (Pełny Raport Diagnostyczny)
INSERT OR REPLACE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-drd-full-diagnostic',
  NULL,
  'DRD - Pełny Raport Diagnostyczny',
  'Kompleksowy raport dojrzałości cyfrowej obejmujący wszystkie 7 osi transformacji cyfrowej z pełną analizą, macierzami i rekomendacjami strategicznymi. Idealny dla zespołów transformacyjnych.',
  'ASSESSMENT',
  'ASSESSMENT_DRD',
  '[
    {"key":"cover","type":"cover","title":"Strona Tytułowa","required":true,"order":0,"defaultLength":"short","defaultLanguage":"business","config":{"showLogo":true,"showDate":true,"showVersion":true,"showOrganization":true,"subtitle":"Digital Readiness Diagnosis"}},
    {"key":"executive_summary","type":"summary","title":"Streszczenie Zarządcze","required":true,"order":1,"defaultLength":"long","defaultLanguage":"business","promptHints":"Napisz profesjonalne streszczenie zarządcze skupiające się na kluczowych wnioskach, ogólnym poziomie dojrzałości cyfrowej, największych lukach oraz strategicznych priorytetach transformacji. Uwzględnij kontekst rynkowy i porównanie do benchmarków branżowych."},
    {"key":"company_profile","type":"context","title":"Profil Organizacji i Kontekst Biznesowy","required":true,"order":2,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Opisz profil firmy: branża, skala, model operacyjny, rynki, kluczowe wyzwania oraz czynniki zewnętrzne wpływające na transformację cyfrową."},
    {"key":"methodology","type":"methodology","title":"Metodologia DRD i Skala Dojrzałości","required":true,"order":3,"defaultLength":"medium","defaultLanguage":"technical","promptHints":"Wyjaśnij metodologię DRD: 7 osi, obszary oceny, skala poziomów, sposób liczenia wyników, interpretacja poziomów i luk (gap)."},
    {"key":"overall_scorecard","type":"dashboard","title":"Dashboard Wyników (7 Osi)","required":true,"order":4,"defaultLength":"short","defaultLanguage":"business","promptHints":"Zbuduj czytelny dashboard: aktualny wynik vs cel dla 7 osi, top 3 luki, top 3 mocne strony, ogólny poziom dojrzałości."},
    {"key":"maturity_matrix","type":"matrix","title":"Macierz Dojrzałości (Heatmap)","required":true,"order":5,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Wygeneruj macierz dojrzałości 7 osi (np. ASCII/markdown) pokazującą poziom aktualny i docelowy oraz gap. Dodaj legendę i krótką interpretację."},
    {"key":"gaps_analysis","type":"gap_analysis","title":"Analiza Luk (Gap Analysis)","required":true,"order":6,"defaultLength":"long","defaultLanguage":"business","promptHints":"Przeanalizuj luki dla każdej osi: przyczyny, konsekwencje biznesowe, zależności między osiami. Wyróżnij luki krytyczne."},
    {"key":"axis_analysis","type":"axis_analysis","title":"Analiza Osi DRD","required":true,"order":10,"defaultLength":"long","defaultLanguage":"business","repeatFor":"axis","promptHints":"Dla danej osi: podsumuj wynik, opisz stan obecny, kluczowe dowody, mocne strony, słabości, rekomendacje i quick wins. Dodaj tabelę obszarów w osi z wynikami."},
    {"key":"strengths","type":"list","title":"Mocne Strony (Strengths)","required":true,"order":100,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Wypisz 8-12 mocnych stron w formie punktów. Każdy punkt powiąż z osią/obszarem i konsekwencją biznesową."},
    {"key":"improvement_areas","type":"list","title":"Obszary do Poprawy (Improvement Areas)","required":true,"order":101,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Wypisz 8-12 obszarów do poprawy. Każdy punkt opisz: objaw, przyczyna, ryzyko, potencjalna korzyść."},
    {"key":"priorities","type":"prioritization","title":"Priorytety Transformacji (Top Initiatives)","required":true,"order":102,"defaultLength":"long","defaultLanguage":"business","promptHints":"Zaproponuj 10-15 inicjatyw (portfolio) z priorytetem, nakładem, wpływem, ownerem, horyzontem czasowym. Użyj tabeli i krótkiej narracji."},
    {"key":"roadmap","type":"roadmap","title":"Roadmapa Transformacji (12-24 miesiące)","required":true,"order":103,"defaultLength":"long","defaultLanguage":"business","promptHints":"Zbuduj roadmapę w 4 fazach (Foundation/Build/Scale/Optimize) z kamieniami milowymi, zależnościami i KPI. Dodaj oś czasu w ASCII/markdown."},
    {"key":"kpis","type":"kpis","title":"KPI i Mechanizmy Kontroli","required":true,"order":104,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Zaproponuj zestaw KPI (min. 12) do mierzenia postępu transformacji. Podziel na: wartość biznesowa, delivery, adopcja, ryzyko. Dodaj częstotliwość i właściciela."},
    {"key":"risks","type":"risk","title":"Ryzyka i Działania Mitygujące","required":true,"order":105,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Przedstaw macierz ryzyk (min. 10) z prawdopodobieństwem, wpływem i planem mitygacji. Uwzględnij ryzyka technologiczne, organizacyjne, finansowe i cyber."},
    {"key":"appendix","type":"appendix","title":"Aneks: Szczegółowe Wyniki i Dowody","required":false,"order":200,"defaultLength":"long","defaultLanguage":"technical","promptHints":"Dodaj aneks z tabelami wyników per obszar, opisem skali poziomów i listą dowodów/artefaktów (np. systemy, procesy, polityki)."}
  ]',
  '{"length":"long","language":"business","includeCharts":true,"includeMatrices":true}',
  1, 1, 1, CURRENT_TIMESTAMP
);

-- DRD Board Pack (Raport dla Zarządu)
INSERT OR REPLACE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-drd-board-pack',
  NULL,
  'DRD - Raport dla Zarządu',
  'Zwięzły pakiet dla zarządu: kluczowe wnioski, priorytety, decyzje, ryzyka i budżet. Minimalna objętość, maksymalna wartość strategiczna.',
  'ASSESSMENT',
  'ASSESSMENT_DRD',
  '[
    {"key":"cover","type":"cover","title":"Strona Tytułowa","required":true,"order":0,"defaultLength":"short","defaultLanguage":"business","config":{"showLogo":true,"showDate":true,"showVersion":true,"showOrganization":true,"subtitle":"Digital Readiness Diagnosis - Board Pack"}},
    {"key":"executive_summary","type":"summary","title":"Executive Summary (1 strona)","required":true,"order":1,"defaultLength":"short","defaultLanguage":"business","promptHints":"Jednostronicowe streszczenie: wynik ogólny, 3 kluczowe wnioski, 3 priorytety, 3 ryzyka, rekomendowane decyzje zarządu."},
    {"key":"dashboard","type":"dashboard","title":"Dashboard Dojrzałości (7 Osi)","required":true,"order":2,"defaultLength":"short","defaultLanguage":"business","promptHints":"Dashboard: wyniki 7 osi (aktualny vs cel) + top 3 luki. Forma tabeli + mini-wykres ASCII."},
    {"key":"strategic_implications","type":"analysis","title":"Implikacje Strategiczne","required":true,"order":3,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Opisz co oznaczają wyniki dla strategii: konkurencyjność, koszty, czas wdrożeń, ryzyka, zdolność skalowania."},
    {"key":"investment_priorities","type":"prioritization","title":"Priorytety Inwestycyjne i ROI","required":true,"order":4,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Lista 5-7 inicjatyw z budżetem, ROI, payback, wpływem. Zaproponuj alokację budżetu w %."},
    {"key":"roadmap_high_level","type":"roadmap","title":"Roadmapa 4-Fazowa (High-Level)","required":true,"order":5,"defaultLength":"short","defaultLanguage":"business","promptHints":"Roadmapa 4 fazy na 24 miesiące. Tylko kluczowe milestone’y i decyzje."},
    {"key":"risks","type":"risk","title":"Ryzyka (Top 10)","required":true,"order":6,"defaultLength":"short","defaultLanguage":"business","promptHints":"Macierz ryzyk (Top 10): prawdopodobieństwo, wpływ, mitygacja."},
    {"key":"decisions","type":"decisions","title":"Decyzje do Podjęcia","required":true,"order":7,"defaultLength":"short","defaultLanguage":"business","promptHints":"Wypisz 3-5 decyzji zarządu z terminem i konsekwencjami."},
    {"key":"appendix","type":"appendix","title":"Aneks (opcjonalnie)","required":false,"order":200,"defaultLength":"short","defaultLanguage":"technical","promptHints":"Jeśli potrzebne: definicja skali DRD i krótka metodologia."}
  ]',
  '{"length":"short","language":"business","includeCharts":true,"includeMatrices":true}',
  1, 0, 1, CURRENT_TIMESTAMP
);

-- DRD Bank Pack (Raport do Banku)
INSERT OR REPLACE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-drd-bank-pack',
  NULL,
  'DRD - Raport do Banku',
  'Raport dla instytucji finansowych: profil firmy, zdolność transformacyjna, ryzyka, plan inwestycyjny, KPI, ROI i wiarygodność realizacji.',
  'ASSESSMENT',
  'ASSESSMENT_DRD',
  '[
    {"key":"cover","type":"cover","title":"Strona Tytułowa","required":true,"order":0,"defaultLength":"short","defaultLanguage":"business","config":{"showLogo":true,"showDate":true,"showVersion":true,"showOrganization":true,"subtitle":"Digital Readiness Diagnosis - Bank Pack"}},
    {"key":"company_profile","type":"context","title":"Profil Firmy i Parametry Finansowe (Streszczenie)","required":true,"order":1,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Opisz firmę z perspektywy finansowej: skala, rynki, produkty, przychody (jeśli znane), stabilność operacyjna."},
    {"key":"assessment_summary","type":"summary","title":"Podsumowanie Oceny Dojrzałości Cyfrowej","required":true,"order":2,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Wynik ogólny DRD, 7 osi, kluczowe luki i mocne strony. Uwzględnij wpływ na konkurencyjność i ryzyko kredytowe."},
    {"key":"matrix","type":"matrix","title":"Macierz Dojrzałości (7 Osi)","required":true,"order":3,"defaultLength":"short","defaultLanguage":"business","promptHints":"Macierz wyników DRD (ASCII/markdown): aktualny vs cel dla 7 osi + legenda."},
    {"key":"transformation_capability","type":"analysis","title":"Zdolność do Realizacji Transformacji (Delivery Capability)","required":true,"order":4,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Oceń zdolność realizacyjną: governance, kompetencje, backlog, PMO, doświadczenie wdrożeń, zarządzanie zmianą. Nadaj ocenę jakościową i uzasadnij."},
    {"key":"investment_plan","type":"prioritization","title":"Plan Inwestycyjny i Wymagane Nakłady","required":true,"order":5,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Przedstaw budżet transformacji (24 mies.) w kategoriach: IT/OT, dane/analityka, cyber, ludzie. Dodaj harmonogram CAPEX/OPEX."},
    {"key":"roi","type":"analysis","title":"Ekonomia Transformacji (ROI / Payback)","required":true,"order":6,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Osadź ROI: źródła korzyści, payback, wrażliwość. Wskaż założenia i ryzyka."},
    {"key":"risk_matrix","type":"risk","title":"Ryzyka i Mitygacja (Bank View)","required":true,"order":7,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Macierz ryzyk transformacji z perspektywy banku: delivery risk, cyber risk, vendor risk, data risk, compliance risk. Dodaj mitygacje i warunki brzegowe."},
    {"key":"kpis","type":"kpis","title":"KPI i Monitorowanie (Covenants operacyjne)","required":true,"order":8,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Zaproponuj KPI do monitorowania postępu (min. 10) oraz progi alarmowe (np. opóźnienia, budżet, incydenty cyber, adopcja)."},
    {"key":"conclusion","type":"conclusion","title":"Wniosek Końcowy","required":true,"order":9,"defaultLength":"short","defaultLanguage":"business","promptHints":"Podsumuj wiarygodność i zdolność do absorpcji finansowania. Zaproponuj rekomendowane warunki/etapy finansowania (transze, milestones)."}
  ]',
  '{"length":"medium","language":"business","includeCharts":true,"includeMatrices":true}',
  1, 0, 1, CURRENT_TIMESTAMP
);

-- SIRI Full Diagnostic
INSERT OR REPLACE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-siri-full-diagnostic',
  NULL,
  'SIRI - Pełny Raport Diagnostyczny',
  'Kompleksowy raport gotowości Industry 4.0 w oparciu o SIRI: 3 bloki, 8 wymiarów, 16 obszarów priorytetyzacji, rekomendacje i roadmapa.',
  'ASSESSMENT',
  'ASSESSMENT_SIRI',
  '[
    {"key":"cover","type":"cover","title":"Strona Tytułowa","required":true,"order":0,"defaultLength":"short","defaultLanguage":"business","config":{"showLogo":true,"showDate":true,"showVersion":true,"showOrganization":true,"subtitle":"Smart Industry Readiness Index"}},
    {"key":"executive_summary","type":"summary","title":"Streszczenie Zarządcze","required":true,"order":1,"defaultLength":"long","defaultLanguage":"business","promptHints":"Streszczenie: poziom gotowości, największe luki, priorytety, korzyści biznesowe, ryzyka. Użyj języka Industry 4.0."},
    {"key":"methodology","type":"methodology","title":"Metodologia SIRI (3 Bloki / 8 Wymiarów / 16 Obszarów)","required":true,"order":2,"defaultLength":"medium","defaultLanguage":"technical","promptHints":"Wyjaśnij SIRI: Process/Technology/Organization, 8 dimensions, 16 prioritisation areas, skala 0-5."},
    {"key":"dashboard","type":"dashboard","title":"Dashboard Wyników SIRI","required":true,"order":3,"defaultLength":"short","defaultLanguage":"business","promptHints":"Dashboard: wyniki 3 bloków, 8 wymiarów, top 5 luk."},
    {"key":"matrix","type":"matrix","title":"Macierz SIRI (Heatmap)","required":true,"order":4,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Wygeneruj heatmapę 3 bloków × 8 wymiarów + 16 obszarów. Użyj ASCII/markdown + legenda."},
    {"key":"block_analysis","type":"block_analysis","title":"Analiza Bloków SIRI","required":true,"order":10,"defaultLength":"long","defaultLanguage":"business","repeatFor":"block","promptHints":"Dla bloku: wynik, interpretacja, luki, rekomendacje i quick wins. Dodaj tabelę wymiarów."},
    {"key":"priorities","type":"prioritization","title":"Priorytetyzacja (16 Obszarów) i Portfolio Inicjatyw","required":true,"order":100,"defaultLength":"long","defaultLanguage":"business","promptHints":"Zaproponuj portfolio inicjatyw mapujące się do 16 obszarów. Podaj nakład, wpływ, ryzyko, czas."},
    {"key":"roadmap","type":"roadmap","title":"Roadmapa Industry 4.0","required":true,"order":101,"defaultLength":"long","defaultLanguage":"business","promptHints":"Roadmapa 18-24 mies.: Foundation/Connect/Automate/Optimize. Uwzględnij IT/OT, dane, cyber, kompetencje."},
    {"key":"kpis","type":"kpis","title":"KPI dla Transformacji Industry 4.0","required":true,"order":102,"defaultLength":"medium","defaultLanguage":"business","promptHints":"KPI: OEE, scrap, lead time, OT uptime, data quality, predictive coverage itd."},
    {"key":"risks","type":"risk","title":"Ryzyka Industry 4.0","required":true,"order":103,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Ryzyka: OT cyber, integracja, vendor lock-in, data governance, safety."}
  ]',
  '{"length":"long","language":"business","includeCharts":true,"includeMatrices":true}',
  1, 0, 1, CURRENT_TIMESTAMP
);

-- SIRI Board Pack
INSERT OR REPLACE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-siri-board-pack',
  NULL,
  'SIRI - Raport dla Zarządu',
  'Zwięzły pakiet zarządczy SIRI: dashboard, implikacje strategiczne, budżet i decyzje.',
  'ASSESSMENT',
  'ASSESSMENT_SIRI',
  '[
    {"key":"cover","type":"cover","title":"Strona Tytułowa","required":true,"order":0,"defaultLength":"short","defaultLanguage":"business","config":{"showLogo":true,"showDate":true,"showVersion":true,"showOrganization":true,"subtitle":"SIRI - Board Pack"}},
    {"key":"one_pager","type":"summary","title":"One-pager dla Zarządu","required":true,"order":1,"defaultLength":"short","defaultLanguage":"business","promptHints":"1 strona: wynik, 3 wnioski, 3 priorytety, 3 ryzyka, decyzje."},
    {"key":"dashboard","type":"dashboard","title":"Dashboard SIRI","required":true,"order":2,"defaultLength":"short","defaultLanguage":"business","promptHints":"3 bloki + top luki. Mini-wykres ASCII."},
    {"key":"investments","type":"prioritization","title":"Priorytety Inwestycyjne (Top 5-7)","required":true,"order":3,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Inicjatywy z budżetem, ROI, czasem."},
    {"key":"roadmap","type":"roadmap","title":"Roadmapa High-Level","required":true,"order":4,"defaultLength":"short","defaultLanguage":"business","promptHints":"4 fazy na 24 mies. Tylko milestones."},
    {"key":"decisions","type":"decisions","title":"Decyzje Zarządu","required":true,"order":5,"defaultLength":"short","defaultLanguage":"business","promptHints":"3-5 decyzji z terminami."}
  ]',
  '{"length":"short","language":"business","includeCharts":true,"includeMatrices":true}',
  1, 0, 1, CURRENT_TIMESTAMP
);

-- SIRI Bank Pack
INSERT OR REPLACE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-siri-bank-pack',
  NULL,
  'SIRI - Raport do Banku',
  'Raport SIRI dla instytucji finansowej: gotowość Industry 4.0, plan inwestycyjny, ryzyka i zdolność realizacyjna.',
  'ASSESSMENT',
  'ASSESSMENT_SIRI',
  '[
    {"key":"cover","type":"cover","title":"Strona Tytułowa","required":true,"order":0,"defaultLength":"short","defaultLanguage":"business","config":{"showLogo":true,"showDate":true,"showVersion":true,"showOrganization":true,"subtitle":"SIRI - Bank Pack"}},
    {"key":"company_profile","type":"context","title":"Profil Organizacji","required":true,"order":1,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Profil firmy z perspektywy finansowania."},
    {"key":"summary","type":"summary","title":"Podsumowanie Wyników SIRI","required":true,"order":2,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Wynik, luki, wpływ na konkurencyjność i ryzyko."},
    {"key":"matrix","type":"matrix","title":"Macierz SIRI","required":true,"order":3,"defaultLength":"short","defaultLanguage":"business","promptHints":"Heatmap ASCII dla 3 bloków / 8 wymiarów."},
    {"key":"capability","type":"analysis","title":"Zdolność Transformacyjna","required":true,"order":4,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Governance, kompetencje, doświadczenie wdrożeń."},
    {"key":"investment_plan","type":"prioritization","title":"Plan Inwestycyjny","required":true,"order":5,"defaultLength":"medium","defaultLanguage":"business","promptHints":"CAPEX/OPEX, harmonogram, ROI."},
    {"key":"risks","type":"risk","title":"Ryzyka (Bank View)","required":true,"order":6,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Delivery/cyber/vendor/data."},
    {"key":"conclusion","type":"conclusion","title":"Wniosek","required":true,"order":7,"defaultLength":"short","defaultLanguage":"business","promptHints":"Rekomendacja dot. finansowania (transze/milestones)."}
  ]',
  '{"length":"medium","language":"business","includeCharts":true,"includeMatrices":true}',
  1, 0, 1, CURRENT_TIMESTAMP
);

-- ADMA Full Diagnostic
INSERT OR REPLACE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-adma-full-diagnostic',
  NULL,
  'ADMA - Pełny Raport Diagnostyczny',
  'Kompleksowy raport ADMA (EU): 5 filarów, 12 wymiarów, benchmarking europejski, rekomendacje i roadmapa.',
  'ASSESSMENT',
  'ASSESSMENT_ADMA',
  '[
    {"key":"cover","type":"cover","title":"Strona Tytułowa","required":true,"order":0,"defaultLength":"short","defaultLanguage":"business","config":{"showLogo":true,"showDate":true,"showVersion":true,"showOrganization":true,"subtitle":"Advanced Digital Maturity Assessment (EU)"}},
    {"key":"executive_summary","type":"summary","title":"Streszczenie Zarządcze","required":true,"order":1,"defaultLength":"long","defaultLanguage":"business","promptHints":"Streszczenie: wynik ogólny, filary, największe luki, priorytety, benchmarking EU/CEE."},
    {"key":"methodology","type":"methodology","title":"Metodologia ADMA 2.0","required":true,"order":2,"defaultLength":"medium","defaultLanguage":"technical","promptHints":"Wyjaśnij ADMA: 5 filarów, 12 wymiarów, skala 1-5, jak interpretować wyniki."},
    {"key":"dashboard","type":"dashboard","title":"Dashboard ADMA (5 Filarów)","required":true,"order":3,"defaultLength":"short","defaultLanguage":"business","promptHints":"Dashboard: filary (current vs target), top 3 gaps."},
    {"key":"matrix","type":"matrix","title":"Macierz ADMA (Heatmap)","required":true,"order":4,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Macierz 5 filarów × 12 wymiarów w ASCII/markdown. Current vs target."},
    {"key":"pillar_analysis","type":"pillar_analysis","title":"Analiza Filarów ADMA","required":true,"order":10,"defaultLength":"long","defaultLanguage":"business","repeatFor":"pillar","promptHints":"Dla filaru: wynik, dowody, luki, rekomendacje, quick wins."},
    {"key":"benchmarking","type":"benchmark","title":"Benchmarking Europejski","required":true,"order":100,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Porównaj do CEE/EU avg i top performers. Wyciągnij wnioski."},
    {"key":"priorities","type":"prioritization","title":"Priorytety Transformacji","required":true,"order":101,"defaultLength":"long","defaultLanguage":"business","promptHints":"10-12 inicjatyw z nakładem, wpływem, ROI, ryzykiem."},
    {"key":"roadmap","type":"roadmap","title":"Roadmapa 24 miesiące","required":true,"order":102,"defaultLength":"long","defaultLanguage":"business","promptHints":"Fazy 1-4 z milestones, KPI i budżetem."},
    {"key":"risks","type":"risk","title":"Ryzyka","required":true,"order":103,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Ryzyka AI/data/integration/regulatory."}
  ]',
  '{"length":"long","language":"business","includeCharts":true,"includeMatrices":true}',
  1, 0, 1, CURRENT_TIMESTAMP
);

-- ADMA Board Pack
INSERT OR REPLACE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-adma-board-pack',
  NULL,
  'ADMA - Raport dla Zarządu',
  'Pakiet zarządczy ADMA: pozycja w EU, priorytety, budżet, decyzje.',
  'ASSESSMENT',
  'ASSESSMENT_ADMA',
  '[
    {"key":"cover","type":"cover","title":"Strona Tytułowa","required":true,"order":0,"defaultLength":"short","defaultLanguage":"business","config":{"showLogo":true,"showDate":true,"showVersion":true,"showOrganization":true,"subtitle":"ADMA - Board Pack"}},
    {"key":"one_pager","type":"summary","title":"One-pager","required":true,"order":1,"defaultLength":"short","defaultLanguage":"business","promptHints":"1 strona: wynik, 3 wnioski, 3 priorytety, 3 ryzyka, decyzje."},
    {"key":"positioning","type":"benchmark","title":"Pozycja w Europie","required":true,"order":2,"defaultLength":"short","defaultLanguage":"business","promptHints":"CEE vs EU avg vs top performers. Interpretacja."},
    {"key":"investments","type":"prioritization","title":"Priorytety Inwestycyjne","required":true,"order":3,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Top 4-6 inicjatyw z budżetem i ROI."},
    {"key":"roadmap","type":"roadmap","title":"Roadmapa High-Level","required":true,"order":4,"defaultLength":"short","defaultLanguage":"business","promptHints":"Fazy + milestones."},
    {"key":"decisions","type":"decisions","title":"Decyzje","required":true,"order":5,"defaultLength":"short","defaultLanguage":"business","promptHints":"3-5 decyzji zarządu."}
  ]',
  '{"length":"short","language":"business","includeCharts":true,"includeMatrices":true}',
  1, 0, 1, CURRENT_TIMESTAMP
);

-- ADMA Bank Pack
INSERT OR REPLACE INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type,
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-adma-bank-pack',
  NULL,
  'ADMA - Raport do Banku',
  'Raport ADMA dla instytucji finansowej: profil, zdolność transformacyjna, ryzyka, plan inwestycyjny, ROI i finansowanie EU.',
  'ASSESSMENT',
  'ASSESSMENT_ADMA',
  '[
    {"key":"cover","type":"cover","title":"Strona Tytułowa","required":true,"order":0,"defaultLength":"short","defaultLanguage":"business","config":{"showLogo":true,"showDate":true,"showVersion":true,"showOrganization":true,"subtitle":"ADMA - Bank Pack"}},
    {"key":"company_profile","type":"context","title":"Profil Organizacji","required":true,"order":1,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Profil firmy z perspektywy finansowania."},
    {"key":"summary","type":"summary","title":"Podsumowanie Wyników ADMA","required":true,"order":2,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Wynik ogólny, filary, luki, benchmarking EU."},
    {"key":"matrix","type":"matrix","title":"Macierz ADMA","required":true,"order":3,"defaultLength":"short","defaultLanguage":"business","promptHints":"Heatmap ASCII: current vs target."},
    {"key":"capability","type":"analysis","title":"Zdolność Transformacyjna","required":true,"order":4,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Governance, kompetencje, track-record wdrożeń."},
    {"key":"investment_plan","type":"prioritization","title":"Plan Inwestycyjny","required":true,"order":5,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Nakłady, harmonogram, CAPEX/OPEX, ROI."},
    {"key":"eu_funding","type":"analysis","title":"Możliwości Finansowania EU","required":true,"order":6,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Programy EU, potencjał dofinansowania, kroki."},
    {"key":"risks","type":"risk","title":"Ryzyka (Bank View)","required":true,"order":7,"defaultLength":"medium","defaultLanguage":"business","promptHints":"Delivery/cyber/regulatory/vendor/data."},
    {"key":"conclusion","type":"conclusion","title":"Wniosek","required":true,"order":8,"defaultLength":"short","defaultLanguage":"business","promptHints":"Rekomendacja dot. finansowania (transze/milestones)."}
  ]',
  '{"length":"medium","language":"business","includeCharts":true,"includeMatrices":true}',
  1, 0, 1, CURRENT_TIMESTAMP
);

