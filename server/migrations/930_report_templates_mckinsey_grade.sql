-- Migration 930: McKinsey/BCG-grade starting templates for Reports & Presentations (Materiały).
--
-- Tor 3 — treść. Analogiczny do #10-AB (40 szablonów idei). Dostarcza REALNE, ustrukturyzowane
-- szablony startowe (raporty · prezentacje · arkusze) z blueprintem sekcji zgodnym z metodyką
-- konsultingową (McKinsey/BCG). Zero placeholderów, zero "Lorem".
--
-- KANAŁY (zgodne z istniejącym systemem — patrz artifactRegistryService.ensureBackfilledOutputsForOrg):
--   • Dokumenty (Word)   → report_builder_templates  (sections_json)  — backfill auto-projektuje do
--                          v8_output_artifacts (artifact_family='template', outputType='report').
--   • Prezentacje (Deck) → presentation_templates    (outline_json)   — backfill auto-projektuje
--                          (artifact_family='template', outputType='presentation').
--   • Arkusze (Excel)    → v8_output_artifacts wprost (output_type='sheet', artifact_family='template')
--                          + v8_artifact_origin_links (origin_runtime='sheet_template'). Dla arkuszy NIE
--                          ma backfillu, więc — jak seed 20260412_seed_business_templates — wstawiamy
--                          bezpośrednio, z blueprintem w object-form: structureBlueprint.sections (front
--                          czyta .sections / .outline jako OBIEKT, nie tablicę).
--
-- IDEMPOTENTNE: ON CONFLICT DO NOTHING / WHERE NOT EXISTS. Addytywne — nic nie usuwa, nic nie nadpisuje.
-- SCOPE: system (organization_id NULL / '__system__') → widoczne dla wszystkich organizacji.
--
-- ⚠️ NIE URUCHAMIAĆ AUTOMATYCZNIE. Uruchomić świadomie na demo/staging (TROLLEY). NIE na centerbeam/prod
--    bez osobnej zgody i sprawdzenia stanu danych (złota reguła: baza = święte, deploy = nadzorca).

BEGIN;

-- =========================================================================
-- 1) DOKUMENTY (Word)  →  report_builder_templates
--    Kolumny: id TEXT PK, organization_id, name, description, source_type,
--             report_type, sections_json, default_options_json,
--             is_system, is_default, is_public, created_by, created_at, updated_at
--    sections_json[]: {key,type,title,order,required,defaultLength,purpose}
-- =========================================================================

INSERT INTO report_builder_templates (
  id, organization_id, name, description,
  source_type, report_type,
  sections_json, default_options_json,
  is_system, is_default, is_public,
  created_by, created_at, updated_at
) VALUES
(
  'mck-doc-sponsor-onepager',
  NULL,
  'Jednostronicowy raport dla sponsora (Sponsor One-Pager)',
  'Zwięzły, jednostronicowy status dla sponsora projektu — RAG, postęp vs plan, decyzje i eskalacje. Używaj między komitetami sterującymi, gdy sponsor potrzebuje szybkiego obrazu i jasnego "o co proszę".',
  'DELIVERABLE',
  'sponsor_one_pager',
  '[{"key":"status_header","type":"summary","title":"Nagłówek statusu (RAG)","order":0,"required":true,"defaultLength":"short","purpose":"Jeden wskaźnik ogólny (zielony/żółty/czerwony) + jedno zdanie uzasadnienia — natychmiastowy obraz sytuacji"},{"key":"progress","type":"findings","title":"Postęp vs plan","order":1,"required":true,"defaultLength":"short","purpose":"Co ukończono od ostatniego raportu, % realizacji kamieni milowych, kluczowa liczba"},{"key":"decisions_needed","type":"recommendations","title":"Decyzje potrzebne od sponsora","order":2,"required":true,"defaultLength":"short","purpose":"Konkretne pytania decyzyjne z rekomendacją i terminem — jasne wezwanie do działania"},{"key":"risks_escalations","type":"findings","title":"Ryzyka i eskalacje","order":3,"required":true,"defaultLength":"short","purpose":"Top 1-3 ryzyka wymagające uwagi sponsora, z proponowanym działaniem łagodzącym"},{"key":"next_steps","type":"list","title":"Następne kroki","order":4,"required":true,"defaultLength":"short","purpose":"3-5 działań na najbliższy okres z właścicielem i terminem"}]',
  '{"length":"short","language":"business","verbosity":"concise"}',
  true, false, true,
  '__system__', NOW(), NOW()
),
(
  'mck-doc-steering-update',
  NULL,
  'Aktualizacja dla komitetu sterującego (Steering Committee Update)',
  'Pełny brief dla komitetu sterującego: streszczenie wykonawcze, status RAG w wymiarach, kamienie i prognoza, ryzyka, decyzje wymagane. Standard PMBOK/PRINCE2 dla przeglądów zarządczych.',
  'DELIVERABLE',
  'steering_committee',
  '[{"key":"executive_summary","type":"summary","title":"Streszczenie wykonawcze","order":0,"required":true,"defaultLength":"short","purpose":"3-4 zdania: gdzie jesteśmy, co się zmieniło, o co prosimy komitet"},{"key":"rag_status","type":"findings","title":"Status RAG (zakres · harmonogram · budżet · ryzyko · jakość)","order":1,"required":true,"defaultLength":"medium","purpose":"Tabela świateł dla każdego wymiaru z krótkim komentarzem uzasadniającym kolor i trend vs poprzedni okres"},{"key":"milestones_forecast","type":"findings","title":"Kamienie milowe i prognoza","order":2,"required":true,"defaultLength":"medium","purpose":"Status najbliższych kamieni, prognoza ukończenia, pewność prognozy; odchylenia od baseline"},{"key":"risks_issues","type":"findings","title":"Ryzyka i problemy","order":3,"required":true,"defaultLength":"medium","purpose":"Top 5 ryzyk/problemów: opis, wpływ, prawdopodobieństwo, właściciel, działanie łagodzące"},{"key":"decisions_required","type":"recommendations","title":"Decyzje wymagane","order":4,"required":true,"defaultLength":"medium","purpose":"Decyzje wymagające mandatu komitetu — opcje, rekomendacja, konsekwencje zwłoki"},{"key":"next_steps","type":"list","title":"Następne kroki","order":5,"required":true,"defaultLength":"short","purpose":"Kluczowe działania do następnego przeglądu z właścicielami i terminami"}]',
  '{"length":"medium","language":"business","verbosity":"standard"}',
  true, false, true,
  '__system__', NOW(), NOW()
),
(
  'mck-doc-diagnostic',
  NULL,
  'Raport diagnostyczny DRD (Diagnostic Report)',
  'Ustrukturyzowany raport diagnostyczny w układzie DRD: kontekst → metodyka → ustalenia → analiza luk → rekomendacje → roadmapa. Rdzeń doradztwa: od faktów, przez wnioski, do planu działania.',
  'DELIVERABLE',
  'diagnostic_report',
  '[{"key":"context","type":"context","title":"Kontekst i cel diagnozy","order":0,"required":true,"defaultLength":"medium","purpose":"Tło biznesowe, powód diagnozy, pytania badawcze i oczekiwany rezultat"},{"key":"methodology","type":"methodology","title":"Metodyka i zakres","order":1,"required":true,"defaultLength":"short","purpose":"Podejście, źródła danych (wywiady, dane, benchmarki), zakres i ograniczenia badania"},{"key":"findings","type":"findings","title":"Kluczowe ustalenia","order":2,"required":true,"defaultLength":"long","purpose":"Ustalenia pogrupowane w obszary; każde poparte dowodem (dane, cytat, obserwacja) — fakty, nie opinie"},{"key":"gap_analysis","type":"findings","title":"Analiza luk (stan obecny vs docelowy)","order":3,"required":true,"defaultLength":"medium","purpose":"Rozziew między AS-IS a TO-BE dla każdego obszaru; skwantyfikowany wpływ luki"},{"key":"recommendations","type":"recommendations","title":"Rekomendacje priorytetowe","order":4,"required":true,"defaultLength":"medium","purpose":"Rekomendacje uszeregowane wg wpływu i wykonalności (macierz 2x2); powiązane z ustaleniami"},{"key":"roadmap","type":"recommendations","title":"Roadmapa wdrożenia","order":5,"required":true,"defaultLength":"medium","purpose":"Sekwencja działań w horyzontach (quick wins / 90 dni / 12 mies.), właściciele, zależności, oczekiwane korzyści"}]',
  '{"length":"long","language":"business","verbosity":"detailed"}',
  true, false, true,
  '__system__', NOW(), NOW()
),
(
  'mck-doc-business-case',
  NULL,
  'Uzasadnienie biznesowe (Business Case)',
  'Dokument decyzyjny inwestycji: problem, rozważane opcje, analiza kosztów i korzyści (NPV/ROI), ryzyka i rekomendacja. Standard dla bramek finansowania inicjatyw.',
  'DELIVERABLE',
  'business_case',
  '[{"key":"summary","type":"summary","title":"Streszczenie i rekomendacja","order":0,"required":true,"defaultLength":"short","purpose":"Rekomendowana opcja, wymagana inwestycja, spodziewany zwrot i horyzont — decyzja na jednej stronie"},{"key":"context_problem","type":"context","title":"Kontekst i problem","order":1,"required":true,"defaultLength":"medium","purpose":"Sytuacja biznesowa, koszt bezczynności (cost of inaction), powiązanie ze strategią"},{"key":"options","type":"list","title":"Rozważane opcje","order":2,"required":true,"defaultLength":"medium","purpose":"Min. 3 opcje (w tym \"nic nie robić\") z krótką oceną plusów/minusów każdej"},{"key":"cost_benefit","type":"findings","title":"Analiza kosztów i korzyści","order":3,"required":true,"defaultLength":"long","purpose":"CapEx/OpEx, korzyści twarde i miękkie, NPV, IRR, okres zwrotu; horyzont i stopa dyskonta"},{"key":"risks_assumptions","type":"findings","title":"Ryzyka i założenia","order":4,"required":true,"defaultLength":"medium","purpose":"Kluczowe założenia modelu, wrażliwość wyniku, ryzyka realizacji i ich łagodzenie"},{"key":"recommendation_funding","type":"recommendations","title":"Rekomendacja i plan finansowania","order":5,"required":true,"defaultLength":"short","purpose":"Rekomendowana opcja z uzasadnieniem, harmonogram wydatków, bramki i kryteria kontynuacji"}]',
  '{"length":"long","language":"business","verbosity":"detailed"}',
  true, false, true,
  '__system__', NOW(), NOW()
),
(
  'mck-doc-exec-summary',
  NULL,
  'Streszczenie wykonawcze (Executive Summary)',
  'Samodzielne streszczenie w piramidzie Minto: główny wniosek na górze, argumenty wspierające, dowody, implikacje i rekomendacja. Do otwierania każdego większego raportu.',
  'DELIVERABLE',
  'executive_summary',
  '[{"key":"governing_thought","type":"summary","title":"Główny wniosek (governing thought)","order":0,"required":true,"defaultLength":"short","purpose":"Jedna nadrzędna teza odpowiadająca na pytanie kluczowe — reszta dokumentu ją uzasadnia"},{"key":"key_arguments","type":"findings","title":"Kluczowe argumenty","order":1,"required":true,"defaultLength":"medium","purpose":"3 wzajemnie wykluczające się, łącznie wyczerpujące (MECE) argumenty wspierające tezę"},{"key":"evidence","type":"findings","title":"Dowody i dane","order":2,"required":true,"defaultLength":"medium","purpose":"Twarde dowody pod każdy argument: liczby, benchmarki, obserwacje — bez ogólników"},{"key":"implications","type":"findings","title":"Implikacje","order":3,"required":true,"defaultLength":"short","purpose":"Co to oznacza dla organizacji — szanse, zagrożenia, koszt zwłoki"},{"key":"recommendation","type":"recommendations","title":"Rekomendacja","order":4,"required":true,"defaultLength":"short","purpose":"Jasna rekomendacja z wezwaniem do działania i kolejnym krokiem decyzyjnym"}]',
  '{"length":"medium","language":"business","verbosity":"standard"}',
  true, false, true,
  '__system__', NOW(), NOW()
),
(
  'mck-doc-pmo-weekly',
  NULL,
  'Cotygodniowy status PMO (PMO Weekly Status)',
  'Rytmiczny raport operacyjny zespołu/PMO: podsumowanie, zrealizowane, w toku, blokery, plan na następny tydzień. Do cotygodniowej synchronizacji i śladu decyzyjnego.',
  'DELIVERABLE',
  'pmo_weekly',
  '[{"key":"status_summary","type":"summary","title":"Podsumowanie statusu","order":0,"required":true,"defaultLength":"short","purpose":"Ogólny RAG tygodnia + jedno zdanie: czy jesteśmy na kursie i co jest największym tematem"},{"key":"completed","type":"findings","title":"Zrealizowane w tym tygodniu","order":1,"required":true,"defaultLength":"medium","purpose":"Ukończone zadania i produkty; podkreśl kamienie i wyniki, nie aktywność"},{"key":"in_progress","type":"findings","title":"W toku","order":2,"required":true,"defaultLength":"medium","purpose":"Aktywne prace z % postępu i przewidywanym ukończeniem; sygnalizuj ślizgi"},{"key":"blockers","type":"findings","title":"Blokery i problemy","order":3,"required":true,"defaultLength":"short","purpose":"Impedymenty z wiekiem, wpływem i tym kto/co jest potrzebne do odblokowania"},{"key":"next_week","type":"list","title":"Plan na następny tydzień","order":4,"required":true,"defaultLength":"short","purpose":"Priorytety kolejnego okresu z właścicielami — jasne zobowiązania"}]',
  '{"length":"medium","language":"business","verbosity":"standard"}',
  true, false, true,
  '__system__', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- 2) PREZENTACJE (Deck)  →  presentation_templates
--    Kolumny: id TEXT PK, organization_id, name, description, deck_type,
--             audience, goal, outline_json, must_have_intents,
--             recommended_visuals, max_slides, min_slides,
--             is_system, is_active, created_by, created_at, updated_at
--    outline_json[]: {intent,title}
-- =========================================================================

INSERT INTO presentation_templates (
  id, organization_id, name, description,
  deck_type, audience, goal,
  outline_json, must_have_intents, recommended_visuals,
  max_slides, min_slides,
  is_system, is_active,
  created_by, created_at, updated_at
) VALUES
(
  'mck-deck-kickoff',
  NULL,
  'Deck otwarcia projektu (Kickoff Deck)',
  'Prezentacja rozpoczęcia projektu: cel, zakres, zespół, plan i zasady współpracy. Ustawia wspólne rozumienie i mandat na starcie.',
  'kickoff',
  'mixed',
  'align',
  '[{"intent":"cover","title":"Otwarcie projektu"},{"intent":"agenda","title":"Agenda"},{"intent":"context","title":"Cel i tło biznesowe"},{"intent":"scope","title":"Zakres i cele (co jest / czego nie ma)"},{"intent":"team","title":"Zespół, role i RACI"},{"intent":"roadmap","title":"Plan i kamienie milowe"},{"intent":"ways_of_working","title":"Zasady współpracy i kadencja"},{"intent":"next_steps","title":"Następne kroki i zobowiązania"}]',
  '["cover","scope","roadmap","next_steps"]',
  '["roadmap_band","raci_matrix","milestone_timeline"]',
  16, 6,
  true, true,
  '__system__', NOW(), NOW()
),
(
  'mck-deck-findings-readout',
  NULL,
  'Prezentacja ustaleń SCR (Findings Readout)',
  'Odczyt ustaleń w strukturze Situation–Complication–Resolution: sytuacja, komplikacja, kluczowe ustalenia, implikacje, rekomendacja. Klasyczny format prezentacji wyników diagnozy.',
  'findings_readout',
  'executive',
  'persuade',
  '[{"intent":"cover","title":"Ustalenia i wnioski"},{"intent":"executive_summary","title":"Sytuacja (gdzie jesteśmy)"},{"intent":"context","title":"Komplikacja (co się zmieniło / co boli)"},{"intent":"key_messages","title":"Kluczowe ustalenia (3-5)"},{"intent":"analysis","title":"Implikacje dla organizacji"},{"intent":"recommendations","title":"Rekomendacja"},{"intent":"next_steps","title":"Następne kroki"}]',
  '["cover","key_messages","recommendations"]',
  '["finding_cards","data_chart","before_after"]',
  18, 7,
  true, true,
  '__system__', NOW(), NOW()
),
(
  'mck-deck-recommendation',
  NULL,
  'Deck rekomendacji Minto (Recommendation Deck)',
  'Prezentacja rekomendacji w piramidzie Minto: rekomendacja na górze, argumenty wspierające, dowody, rozważane opcje, plan wdrożenia i decyzja. Do przekonania decydentów.',
  'recommendation',
  'executive',
  'persuade',
  '[{"intent":"cover","title":"Rekomendacja"},{"intent":"executive_summary","title":"Rekomendacja (governing thought)"},{"intent":"key_messages","title":"Argumenty wspierające (MECE)"},{"intent":"data_overview","title":"Dowody i dane"},{"intent":"analysis","title":"Rozważane opcje i wybór"},{"intent":"roadmap","title":"Plan wdrożenia"},{"intent":"next_steps","title":"Decyzja i wezwanie do działania"}]',
  '["cover","executive_summary","next_steps"]',
  '["pyramid_diagram","option_matrix","roadmap_band"]',
  18, 7,
  true, true,
  '__system__', NOW(), NOW()
),
(
  'mck-deck-steering-review',
  NULL,
  'Przegląd komitetu sterującego (Steering Review)',
  'Deck na komitet sterujący: status RAG i KPI, kamienie i prognoza, ryzyka i decyzje wymagane. Format zarządczego przeglądu portfela/projektu.',
  'steering_review',
  'executive',
  'align',
  '[{"intent":"cover","title":"Przegląd sterujący"},{"intent":"agenda","title":"Agenda"},{"intent":"executive_summary","title":"Streszczenie wykonawcze"},{"intent":"performance_overview","title":"Status RAG i KPI"},{"intent":"roadmap","title":"Kamienie milowe i prognoza"},{"intent":"analysis","title":"Ryzyka i problemy"},{"intent":"recommendations","title":"Decyzje wymagane"},{"intent":"next_steps","title":"Następne kroki"}]',
  '["cover","performance_overview","recommendations"]',
  '["rag_dashboard","kpi_strip","risk_heatmap"]',
  16, 6,
  true, true,
  '__system__', NOW(), NOW()
),
(
  'mck-deck-final-report',
  NULL,
  'Deck raportu końcowego (Final Report Deck)',
  'Prezentacja zamknięcia projektu: cele vs osiągnięte wyniki, kluczowe wnioski, rekomendacje na przyszłość i utrzymanie korzyści. Domyka narrację i przekazuje wartość.',
  'final_report',
  'executive',
  'inform',
  '[{"intent":"cover","title":"Raport końcowy"},{"intent":"agenda","title":"Agenda"},{"intent":"executive_summary","title":"Streszczenie wykonawcze"},{"intent":"context","title":"Cele projektu"},{"intent":"performance_overview","title":"Osiągnięte wyniki vs cele"},{"intent":"key_messages","title":"Kluczowe wnioski i lekcje"},{"intent":"recommendations","title":"Rekomendacje na przyszłość"},{"intent":"next_steps","title":"Utrzymanie korzyści i przekazanie"}]',
  '["cover","performance_overview","recommendations"]',
  '["scorecard","benefit_bridge","lessons_grid"]',
  18, 7,
  true, true,
  '__system__', NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- 3) ARKUSZE (Excel)  →  v8_output_artifacts + v8_artifact_origin_links
--    (brak backfillu dla sheet → wstawiamy bezpośrednio, jak 20260412_seed_business_templates)
--    structureBlueprint w OBJECT-FORM: {"sections":[...]} — zgodnie z kontraktem frontu
--    (mapCanonicalTemplateArtifact / previews).
-- =========================================================================

INSERT INTO v8_output_artifacts (
  artifact_id, organization_id, output_type, artifact_family,
  title_snapshot, owner_user_id, created_by, canonical_home, visibility_scope,
  delivery_state, origin_summary_json, created_at, updated_at
) VALUES
('mck-sheet-cost-benefit', '__system__', 'sheet', 'template',
 'Model kosztów i korzyści (Cost-Benefit Model)', '__system__', '__system__', 'outputs_library', 'organization', 'ready',
 '{"template":{"scope":"application","status":"active","description":"Model NPV/IRR: założenia, koszty (CapEx/OpEx), korzyści twarde i miękkie, przepływy netto, analiza wrażliwości. Do uzasadnienia inwestycji.","structureBlueprint":{"sections":[{"key":"assumptions","title":"Założenia","purpose":"Stopa dyskonta, horyzont, wzrost, kursy — wszystkie sterowniki modelu w jednym miejscu"},{"key":"costs","title":"Koszty (CapEx / OpEx)","purpose":"Nakłady jednorazowe i bieżące rozłożone w czasie, z podziałem na kategorie"},{"key":"benefits","title":"Korzyści (twarde i miękkie)","purpose":"Oszczędności, przychód, uniknięte koszty; miękkie oznaczone i skwantyfikowane gdzie się da"},{"key":"net_npv","title":"Przepływy netto i NPV / IRR","purpose":"Zdyskontowane przepływy, NPV, IRR, okres zwrotu — wynik finansowy inwestycji"},{"key":"sensitivity","title":"Analiza wrażliwości","purpose":"Jak wynik reaguje na zmianę kluczowych założeń (scenariusze +/- )"}]}}}',
 NOW(), NOW()),
('mck-sheet-kpi-dashboard', '__system__', 'sheet', 'template',
 'Dashboard KPI (KPI Dashboard)', '__system__', '__system__', 'outputs_library', 'organization', 'ready',
 '{"template":{"scope":"application","status":"active","description":"Panel wskaźników: definicje KPI, cele vs wyniki, trendy okresowe, odchylenia z alertami, podsumowanie zarządcze. Do monitorowania realizacji.","structureBlueprint":{"sections":[{"key":"definitions","title":"Definicje KPI","purpose":"Nazwa, formuła, źródło danych, częstotliwość i właściciel każdego wskaźnika"},{"key":"target_actual","title":"Cele vs wyniki","purpose":"Wartość docelowa, aktualna i status (na kursie / zagrożony / poza celem)"},{"key":"trends","title":"Trendy okresowe","purpose":"Wynik w kolejnych okresach — kierunek i tempo zmiany"},{"key":"variance_alerts","title":"Odchylenia i alerty","purpose":"Automatyczne flagi tam gdzie odchylenie przekracza próg tolerancji"},{"key":"exec_summary","title":"Podsumowanie zarządcze","purpose":"Kilka zdań interpretacji dla decydenta — co liczby oznaczają"}]}}}',
 NOW(), NOW()),
('mck-sheet-initiative-tracker', '__system__', 'sheet', 'template',
 'Tracker inicjatyw (Initiative Tracker)', '__system__', '__system__', 'outputs_library', 'organization', 'ready',
 '{"template":{"scope":"application","status":"active","description":"Rejestr realizacji inicjatyw: lista, status RAG, właściciele i terminy, zależności, realizacja korzyści. Do zarządzania portfelem zmian.","structureBlueprint":{"sections":[{"key":"initiatives","title":"Lista inicjatyw","purpose":"Nazwa, cel, powiązanie ze strategią i faza cyklu życia każdej inicjatywy"},{"key":"status_rag","title":"Status i RAG","purpose":"Ogólny status, postęp % i światło RAG z krótkim uzasadnieniem"},{"key":"owners_dates","title":"Właściciele i terminy","purpose":"Sponsor, lider, kluczowe daty (start, kamienie, koniec)"},{"key":"dependencies","title":"Zależności","purpose":"Powiązania i blokady między inicjatywami — sekwencja i ryzyko kaskady"},{"key":"benefit_realization","title":"Realizacja korzyści","purpose":"Oczekiwana vs zrealizowana korzyść i moment jej materializacji"}]}}}',
 NOW(), NOW()),
('mck-sheet-budget-actual', '__system__', 'sheet', 'template',
 'Budżet vs wykonanie (Budget vs Actual)', '__system__', '__system__', 'outputs_library', 'organization', 'ready',
 '{"template":{"scope":"application","status":"active","description":"Kontrola budżetu: założenia, plan, wykonanie, analiza odchyleń i prognoza (forecast). Do dyscypliny finansowej projektu/portfela.","structureBlueprint":{"sections":[{"key":"assumptions","title":"Założenia budżetu","purpose":"Podstawa planu: wolumeny, stawki, alokacje i okres budżetowy"},{"key":"budget_plan","title":"Budżet (plan)","purpose":"Zaplanowane koszty/przychody w rozbiciu na pozycje i okresy"},{"key":"actual","title":"Wykonanie (actual)","purpose":"Rzeczywiste wartości do daty, zaciągnięte i rozliczone"},{"key":"variance","title":"Analiza odchyleń","purpose":"Różnica plan vs wykonanie kwotowo i %, z komentarzem przyczyny"},{"key":"forecast","title":"Prognoza (forecast)","purpose":"Przewidywane wykonanie na koniec okresu (EAC) i ryzyko przekroczenia"}]}}}',
 NOW(), NOW())
ON CONFLICT (artifact_id) DO NOTHING;

-- Origin links dla arkuszy (origin_runtime='sheet_template' — dopuszczony przez 20260412_seed_business_templates)
INSERT INTO v8_artifact_origin_links (link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin)
VALUES
('ol-mck-sheet-cost-benefit', 'mck-sheet-cost-benefit', '__system__', 'sheet_template', 'mck-sheet-cost-benefit', 1),
('ol-mck-sheet-kpi-dashboard', 'mck-sheet-kpi-dashboard', '__system__', 'sheet_template', 'mck-sheet-kpi-dashboard', 1),
('ol-mck-sheet-initiative-tracker', 'mck-sheet-initiative-tracker', '__system__', 'sheet_template', 'mck-sheet-initiative-tracker', 1),
('ol-mck-sheet-budget-actual', 'mck-sheet-budget-actual', '__system__', 'sheet_template', 'mck-sheet-budget-actual', 1)
ON CONFLICT (link_id) DO NOTHING;

COMMIT;

-- Weryfikacja po świadomym uruchomieniu (oczekiwane: 6 doc, 5 deck, 4 sheet = 15 nowych):
--   SELECT COUNT(*) FROM report_builder_templates WHERE id LIKE 'mck-doc-%';          -- 6
--   SELECT COUNT(*) FROM presentation_templates   WHERE id LIKE 'mck-deck-%';         -- 5
--   SELECT COUNT(*) FROM v8_output_artifacts       WHERE artifact_id LIKE 'mck-sheet-%'; -- 4
-- Doc/Deck pojawią się w zakładce Materiały → Szablony po pierwszym otwarciu modułu (backfill per-org, TTL).
