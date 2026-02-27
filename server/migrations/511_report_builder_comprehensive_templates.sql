-- Migration: 511_report_builder_comprehensive_templates.sql
-- Comprehensive Report Templates for DRD, SIRI, ADMA assessments
-- Date: 2026-02-04
-- 
-- Creates 9 professional templates:
-- - 3 for DRD (Full Diagnostic, Board Pack, Bank Pack)
-- - 3 for SIRI (Full Diagnostic, Board Pack, Bank Pack)
-- - 3 for ADMA (Full Diagnostic, Board Pack, Bank Pack)

-- ==========================================
-- DRD TEMPLATES
-- ==========================================

-- DRD Full Diagnostic Report (Pełny Raport Diagnostyczny)
INSERT INTO report_builder_templates (
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
    {
      "key": "cover",
      "type": "cover",
      "title": "Strona Tytułowa",
      "required": true,
      "order": 0,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "showLogo": true,
        "showDate": true,
        "showVersion": true,
        "showOrganization": true,
        "subtitle": "Digital Readiness Diagnosis"
      }
    },
    {
      "key": "executive_summary",
      "type": "summary",
      "title": "Streszczenie Zarządcze",
      "required": true,
      "order": 1,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Napisz profesjonalne streszczenie zarządcze skupiające się na kluczowych wnioskach, ogólnym poziomie dojrzałości cyfrowej, największych lukach oraz strategicznych priorytetach transformacji. Uwzględnij kontekst rynkowy i porównanie do benchmarków branżowych."
    },
    {
      "key": "methodology",
      "type": "methodology",
      "title": "Metodologia Oceny DRD",
      "required": true,
      "order": 2,
      "defaultLength": "medium",
      "defaultLanguage": "technical",
      "promptHints": "Opisz metodologię Digital Readiness Diagnosis opartą na książce Digital Pathfinder dr Piotra Wiśniewskiego. Wyjaśnij 7 osi transformacji cyfrowej, skalę oceny (1-7 dla procesów i danych, 1-5 dla pozostałych), oraz proces zbierania danych i walidacji wyników."
    },
    {
      "key": "overall_maturity",
      "type": "scorecard",
      "title": "Ogólny Poziom Dojrzałości",
      "required": true,
      "order": 3,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "config": {
        "showOverallScore": true,
        "showGap": true,
        "showComparison": true
      }
    },
    {
      "key": "maturity_matrix",
      "type": "matrix",
      "title": "Macierz Dojrzałości Cyfrowej",
      "required": true,
      "order": 4,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "config": {
        "matrixType": "heatmap",
        "showAxes": true,
        "showAreas": true,
        "showGaps": true,
        "colorScheme": "professional"
      },
      "promptHints": "Przedstaw szczegółową analizę macierzy dojrzałości. Dla każdej osi pokaż wynik aktualny vs docelowy, zidentyfikuj największe luki oraz wskaż obszary priorytetowe. Uwzględnij wizualizację heatmap."
    },
    {
      "key": "radar_chart",
      "type": "chart",
      "title": "Wykres Radarowy - 7 Osi Transformacji",
      "required": true,
      "order": 5,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "config": {
        "chartType": "radar",
        "showCurrent": true,
        "showTarget": true,
        "showBenchmark": true
      }
    },
    {
      "key": "axis_1",
      "type": "axis_analysis",
      "title": "Oś 1: Procesy Cyfrowe",
      "required": true,
      "order": 10,
      "repeatFor": "axis",
      "repeatKey": "1",
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Przeprowadź dogłębną analizę wszystkich 9 obszarów procesowych: sprzedaż, marketing, R&D/technologia, zakupy, logistyka, produkcja, jakość, finanse, HR. Dla każdego obszaru opisz aktualny stan, zidentyfikowane luki oraz konkretne rekomendacje poprawy. Odnieś się do poziomów 1-7 skali dojrzałości."
    },
    {
      "key": "axis_2",
      "type": "axis_analysis",
      "title": "Oś 2: Produkty Cyfrowe",
      "required": true,
      "order": 11,
      "repeatFor": "axis",
      "repeatKey": "2",
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Analizuj 5 wymiarów produktów cyfrowych: produkty cyfrowe, produkty społecznościowe, produkty ICT, dopasowanie do oczekiwań klientów, skalowalność produktów. Oceń potencjał cyfryzacji portfolio produktowego."
    },
    {
      "key": "axis_3",
      "type": "axis_analysis",
      "title": "Oś 3: Cyfrowe Modele Biznesowe",
      "required": true,
      "order": 12,
      "repeatFor": "axis",
      "repeatKey": "3",
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Oceń 5 modeli biznesowych: e-commerce, rozwiązania platformowe, model as-a-service, współdzielenie zasobów, monetyzacja danych. Zidentyfikuj możliwości innowacji modelu biznesowego."
    },
    {
      "key": "axis_4",
      "type": "axis_analysis",
      "title": "Oś 4: Zarządzanie Danymi",
      "required": true,
      "order": 13,
      "repeatFor": "axis",
      "repeatKey": "4",
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Przeanalizuj 5 wymiarów zarządzania danymi: zbieranie danych, metodologia przechowywania, komunikacja danych, analiza Big Data, przetwarzanie (computing). Odnieś się do 7-poziomowej skali dojrzałości."
    },
    {
      "key": "axis_5",
      "type": "axis_analysis",
      "title": "Oś 5: Kultura Transformacji",
      "required": true,
      "order": 14,
      "repeatFor": "axis",
      "repeatKey": "5",
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Oceń 5 wymiarów kultury organizacyjnej: styl przywództwa, gotowość na zmiany, ciągłe doskonalenie, kultura innowacji, dostępność zasobów. Zidentyfikuj bariery kulturowe transformacji."
    },
    {
      "key": "axis_6",
      "type": "axis_analysis",
      "title": "Oś 6: Cyberbezpieczeństwo",
      "required": true,
      "order": 15,
      "repeatFor": "axis",
      "repeatKey": "6",
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Przeanalizuj 5 obszarów cyberbezpieczeństwa: strategia i zarządzanie ryzykiem, ochrona sieci i systemów, bezpieczeństwo danych, edukacja i szkolenia, reagowanie na incydenty. Oceń odporność organizacji na zagrożenia cybernetyczne."
    },
    {
      "key": "axis_7",
      "type": "axis_analysis",
      "title": "Oś 7: Dojrzałość AI",
      "required": true,
      "order": 16,
      "repeatFor": "axis",
      "repeatKey": "7",
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Oceń 5 wymiarów dojrzałości AI: dane i fundamenty AI, procesy wspierane przez AI, AI w produktach i usługach, governance/bezpieczeństwo/etyka, kompetencje i kultura AI. Określ gotowość organizacji do wdrożenia rozwiązań AI."
    },
    {
      "key": "gap_analysis",
      "type": "analysis",
      "title": "Analiza Luk",
      "required": true,
      "order": 50,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw kompleksową analizę luk między stanem aktualnym a docelowym. Zidentyfikuj 5-7 najważniejszych luk, określ ich wpływ na biznes oraz priorytetyzuj według pilności i potencjału wartości."
    },
    {
      "key": "strengths",
      "type": "list",
      "title": "Mocne Strony",
      "required": true,
      "order": 100,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Zidentyfikuj 7-10 kluczowych mocnych stron organizacji w kontekście transformacji cyfrowej. Dla każdej mocnej strony opisz jej znaczenie strategiczne i potencjał do dalszego rozwoju."
    },
    {
      "key": "weaknesses",
      "type": "list",
      "title": "Obszary do Poprawy",
      "required": true,
      "order": 101,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Zidentyfikuj 7-10 kluczowych obszarów wymagających poprawy. Dla każdego obszaru opisz ryzyko związane z brakiem działań oraz potencjalną wartość z adresowania problemu."
    },
    {
      "key": "benchmarking",
      "type": "comparison",
      "title": "Benchmarking Branżowy",
      "required": true,
      "order": 102,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Porównaj wyniki oceny z benchmarkami branżowymi. Wskaż obszary, gdzie organizacja wyprzedza konkurencję oraz gdzie pozostaje w tyle. Uwzględnij kontekst wielkości firmy i specyfiki sektora."
    },
    {
      "key": "recommendations",
      "type": "recommendations",
      "title": "Rekomendacje Strategiczne",
      "required": true,
      "order": 110,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Opracuj 10-15 konkretnych rekomendacji strategicznych pogrupowanych według osi transformacji. Dla każdej rekomendacji określ: priorytet (wysoki/średni/niski), horyzont czasowy, szacowany nakład, oczekiwany wpływ, powiązania z innymi inicjatywami."
    },
    {
      "key": "roadmap",
      "type": "action_plan",
      "title": "Roadmapa Transformacji",
      "required": true,
      "order": 120,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw szczegółową roadmapę transformacji na 12-24 miesięcy. Podziel na fazy: Quick Wins (0-3 miesiące), Short-term (3-12 miesięcy), Long-term (12-24 miesiące). Dla każdej inicjatywy określ zależności, kamienie milowe i KPI sukcesu."
    },
    {
      "key": "investment_priorities",
      "type": "priorities",
      "title": "Priorytety Inwestycyjne",
      "required": true,
      "order": 125,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Określ priorytety inwestycyjne według macierzy wpływ/nakład. Przedstaw rekomendowaną alokację budżetu transformacji między poszczególne osie i inicjatywy."
    },
    {
      "key": "risk_assessment",
      "type": "risk",
      "title": "Ocena Ryzyka Transformacji",
      "required": true,
      "order": 130,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Zidentyfikuj kluczowe ryzyka związane z transformacją cyfrową. Dla każdego ryzyka określ prawdopodobieństwo, wpływ oraz strategie mitygacji."
    },
    {
      "key": "next_steps",
      "type": "action_plan",
      "title": "Następne Kroki",
      "required": true,
      "order": 140,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Określ 5-7 konkretnych następnych kroków do podjęcia w ciągu najbliższych 30-90 dni. Uwzględnij osoby odpowiedzialne, terminy i mierniki sukcesu."
    },
    {
      "key": "appendix_data",
      "type": "appendix",
      "title": "Załącznik: Szczegółowe Dane",
      "required": false,
      "order": 200,
      "defaultLength": "long",
      "defaultLanguage": "technical",
      "config": {
        "showRawScores": true,
        "showAllAreas": true,
        "showEvidence": true
      }
    },
    {
      "key": "appendix_methodology",
      "type": "appendix",
      "title": "Załącznik: Metodologia Oceny",
      "required": false,
      "order": 201,
      "defaultLength": "medium",
      "defaultLanguage": "technical"
    }
  ]',
  '{"length": "long", "language": "business", "includeCharts": true, "includeMatrices": true}',
  true,
  true,
  true,
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
  created_at = EXCLUDED.created_at;

-- DRD Board Pack (Raport dla Zarządu)
INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type, 
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-drd-board-pack',
  NULL,
  'DRD - Raport dla Zarządu',
  'Zwięzły raport strategiczny dla zarządu i kadry kierowniczej. Koncentruje się na kluczowych wnioskach, strategicznych implikacjach i decyzjach do podjęcia.',
  'ASSESSMENT',
  'ASSESSMENT_DRD',
  '[
    {
      "key": "cover",
      "type": "cover",
      "title": "Strona Tytułowa",
      "required": true,
      "order": 0,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "style": "executive",
        "showLogo": true,
        "subtitle": "Raport Strategiczny dla Zarządu"
      }
    },
    {
      "key": "executive_summary",
      "type": "summary",
      "title": "Podsumowanie dla Zarządu",
      "required": true,
      "order": 1,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Napisz zwięzłe, strategiczne podsumowanie w formie executive brief. Skup się na: ogólnej ocenie dojrzałości cyfrowej, 3-5 najważniejszych wnioskach, strategicznych implikacjach dla biznesu, kluczowych decyzjach wymagających uwagi zarządu. Używaj języka biznesowego, unikaj żargonu technicznego."
    },
    {
      "key": "key_findings",
      "type": "scorecard",
      "title": "Kluczowe Ustalenia",
      "required": true,
      "order": 2,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "format": "dashboard",
        "showKPIs": true
      },
      "promptHints": "Przedstaw 5-7 najważniejszych ustaleń z oceny w formie punktowej. Każde ustalenie powinno zawierać krótki opis i implikację biznesową."
    },
    {
      "key": "maturity_overview",
      "type": "matrix",
      "title": "Przegląd Dojrzałości Cyfrowej",
      "required": true,
      "order": 3,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "config": {
        "matrixType": "executive_summary",
        "showRadar": true,
        "simplified": true
      },
      "promptHints": "Przedstaw uproszczoną wizualizację dojrzałości cyfrowej. Skup się na 7 osiach transformacji, pokazując wyniki vs cele w prostej formie graficznej. Podkreśl największe luki wymagające uwagi zarządu."
    },
    {
      "key": "strategic_position",
      "type": "analysis",
      "title": "Pozycja Strategiczna",
      "required": true,
      "order": 4,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Opisz pozycję strategiczną organizacji w kontekście transformacji cyfrowej. Uwzględnij: pozycję względem konkurencji, gotowość do zmian rynkowych, szanse i zagrożenia związane z digitalizacją."
    },
    {
      "key": "strengths_weaknesses",
      "type": "list",
      "title": "Mocne Strony i Wyzwania",
      "required": true,
      "order": 5,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw 5 głównych mocnych stron i 5 głównych wyzwań w formie zwięzłej listy. Każdy punkt powinien być sformułowany w kontekście strategicznych implikacji dla biznesu."
    },
    {
      "key": "strategic_recommendations",
      "type": "recommendations",
      "title": "Rekomendacje Strategiczne",
      "required": true,
      "order": 10,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw 5-7 kluczowych rekomendacji strategicznych wymagających decyzji zarządu. Dla każdej rekomendacji określ: kontekst biznesowy, oczekiwane korzyści, szacowany nakład, harmonogram realizacji."
    },
    {
      "key": "investment_overview",
      "type": "priorities",
      "title": "Przegląd Inwestycji",
      "required": true,
      "order": 11,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw zarys wymaganych inwestycji w transformację cyfrową. Uwzględnij podział na kategorie: technologia, ludzie, procesy. Pokaż zwrot z inwestycji i harmonogram."
    },
    {
      "key": "risks_opportunities",
      "type": "risk",
      "title": "Ryzyka i Szanse",
      "required": true,
      "order": 12,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw matrycę kluczowych ryzyk i szans związanych z transformacją cyfrową. Zidentyfikuj 3-5 ryzyk krytycznych oraz 3-5 strategicznych szans."
    },
    {
      "key": "decisions_required",
      "type": "action_plan",
      "title": "Decyzje do Podjęcia",
      "required": true,
      "order": 20,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw listę 3-5 konkretnych decyzji wymagających uwagi zarządu. Dla każdej decyzji określ: kontekst, opcje, rekomendowaną ścieżkę, termin podjęcia decyzji."
    },
    {
      "key": "next_steps",
      "type": "action_plan",
      "title": "Następne Kroki",
      "required": true,
      "order": 21,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Określ 3-5 natychmiastowych następnych kroków po prezentacji raportu. Uwzględnij osoby odpowiedzialne i terminy."
    }
  ]',
  '{"length": "medium", "language": "business", "style": "executive", "includeCharts": true}',
  true,
  false,
  true,
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
  created_at = EXCLUDED.created_at;

-- DRD Bank Pack (Raport do Banku)
INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type, 
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-drd-bank-pack',
  NULL,
  'DRD - Raport do Banku',
  'Raport przygotowany dla instytucji finansowych. Koncentruje się na zdolności transformacyjnej, zarządzaniu ryzykiem i bezpieczeństwie jako wskaźnikach wiarygodności kredytowej.',
  'ASSESSMENT',
  'ASSESSMENT_DRD',
  '[
    {
      "key": "cover",
      "type": "cover",
      "title": "Strona Tytułowa",
      "required": true,
      "order": 0,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "style": "formal",
        "showLogo": true,
        "subtitle": "Ocena Dojrzałości Cyfrowej - Raport dla Instytucji Finansowej"
      }
    },
    {
      "key": "company_profile",
      "type": "summary",
      "title": "Profil Organizacji",
      "required": true,
      "order": 1,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw profil organizacji w kontekście istotnym dla instytucji finansowej. Uwzględnij: podstawowe dane o firmie, branżę i pozycję rynkową, historię i trajektorię rozwoju, strukturę organizacyjną."
    },
    {
      "key": "executive_summary",
      "type": "summary",
      "title": "Podsumowanie Oceny",
      "required": true,
      "order": 2,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw formalne podsumowanie oceny dojrzałości cyfrowej. Skup się na: ogólnej ocenie zdolności transformacyjnej, kluczowych wskaźnikach dojrzałości, zgodności z najlepszymi praktykami branżowymi, gotowości do realizacji planów rozwojowych."
    },
    {
      "key": "methodology",
      "type": "methodology",
      "title": "Metodologia Oceny",
      "required": true,
      "order": 3,
      "defaultLength": "short",
      "defaultLanguage": "technical",
      "promptHints": "Opisz metodologię DRD jako uznaną metodykę oceny dojrzałości cyfrowej. Podkreśl obiektywność i systematyczność podejścia."
    },
    {
      "key": "maturity_assessment",
      "type": "matrix",
      "title": "Wyniki Oceny Dojrzałości",
      "required": true,
      "order": 4,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "config": {
        "matrixType": "formal",
        "showScores": true,
        "showBenchmarks": true
      },
      "promptHints": "Przedstaw szczegółowe wyniki oceny w formie tabelarycznej. Dla każdej osi transformacji pokaż: wynik aktualny, wynik docelowy, lukę, odniesienie do benchmarku branżowego."
    },
    {
      "key": "transformation_capability",
      "type": "analysis",
      "title": "Zdolność Transformacyjna",
      "required": true,
      "order": 5,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Oceń zdolność organizacji do przeprowadzenia transformacji cyfrowej. Uwzględnij: kompetencje wewnętrzne, zasoby dostępne, historię udanych zmian, kulturę organizacyjną wspierającą transformację."
    },
    {
      "key": "strengths",
      "type": "list",
      "title": "Czynniki Pozytywne",
      "required": true,
      "order": 10,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Zidentyfikuj czynniki pozytywne wpływające na wiarygodność organizacji jako beneficjenta finansowania. Uwzględnij: silne obszary dojrzałości cyfrowej, przewagi konkurencyjne, stabilność operacyjną, zdolność do adaptacji."
    },
    {
      "key": "risk_factors",
      "type": "list",
      "title": "Czynniki Ryzyka",
      "required": true,
      "order": 11,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Zidentyfikuj czynniki ryzyka wynikające z oceny dojrzałości cyfrowej. Uwzględnij: luki kompetencyjne, zależności od przestarzałych systemów, ryzyka cyberbezpieczeństwa, bariery kulturowe."
    },
    {
      "key": "cybersecurity_posture",
      "type": "axis_analysis",
      "title": "Stan Cyberbezpieczeństwa",
      "required": true,
      "order": 15,
      "repeatFor": "axis",
      "repeatKey": "6",
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw szczegółową ocenę stanu cyberbezpieczeństwa organizacji. Ten obszar jest szczególnie istotny dla instytucji finansowych ze względu na regulacje i ryzyka operacyjne."
    },
    {
      "key": "data_management",
      "type": "axis_analysis",
      "title": "Zarządzanie Danymi",
      "required": true,
      "order": 16,
      "repeatFor": "axis",
      "repeatKey": "4",
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw ocenę praktyk zarządzania danymi. Uwzględnij zgodność z regulacjami (RODO, branżowe) oraz jakość danych wykorzystywanych w decyzjach biznesowych."
    },
    {
      "key": "operational_resilience",
      "type": "analysis",
      "title": "Odporność Operacyjna",
      "required": true,
      "order": 17,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Oceń odporność operacyjną organizacji wynikającą z poziomu cyfryzacji. Uwzględnij: ciągłość działania, redundancję systemów, plany awaryjne, zdolność do pracy zdalnej."
    },
    {
      "key": "transformation_plan",
      "type": "action_plan",
      "title": "Plan Transformacji",
      "required": true,
      "order": 20,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw plan transformacji cyfrowej organizacji. Skup się na: głównych inicjatywach, harmonogramie, wymaganych nakładach, oczekiwanych rezultatach, miernikach postępu."
    },
    {
      "key": "investment_requirements",
      "type": "priorities",
      "title": "Potrzeby Inwestycyjne",
      "required": true,
      "order": 21,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw szacunkowe potrzeby inwestycyjne związane z transformacją cyfrową. Uwzględnij podział na: infrastrukturę IT, oprogramowanie, szkolenia, usługi zewnętrzne."
    },
    {
      "key": "expected_outcomes",
      "type": "analysis",
      "title": "Oczekiwane Rezultaty",
      "required": true,
      "order": 22,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw oczekiwane rezultaty transformacji cyfrowej. Uwzględnij: wpływ na efektywność operacyjną, potencjał wzrostu przychodów, redukcję kosztów, poprawę pozycji konkurencyjnej."
    },
    {
      "key": "conclusion",
      "type": "summary",
      "title": "Wnioski",
      "required": true,
      "order": 30,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw formalne wnioski z oceny. Podsumuj ogólną ocenę dojrzałości cyfrowej i zdolności transformacyjnej organizacji w kontekście wiarygodności jako beneficjenta finansowania."
    }
  ]',
  '{"length": "medium", "language": "business", "style": "formal", "includeCharts": true}',
  true,
  false,
  true,
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
  created_at = EXCLUDED.created_at;

-- ==========================================
-- SIRI TEMPLATES
-- ==========================================

-- SIRI Full Diagnostic Report
INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type, 
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-siri-full-diagnostic',
  NULL,
  'SIRI - Pełny Raport Diagnostyczny',
  'Kompleksowy raport Smart Industry Readiness Index obejmujący wszystkie 3 Building Blocks, 8 Dimensions i 16 Prioritisation Areas. Idealny dla firm produkcyjnych planujących transformację Industry 4.0.',
  'ASSESSMENT',
  'ASSESSMENT_SIRI',
  '[
    {
      "key": "cover",
      "type": "cover",
      "title": "Strona Tytułowa",
      "required": true,
      "order": 0,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "showLogo": true,
        "subtitle": "Smart Industry Readiness Index Assessment"
      }
    },
    {
      "key": "executive_summary",
      "type": "summary",
      "title": "Streszczenie Zarządcze",
      "required": true,
      "order": 1,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Napisz profesjonalne streszczenie zarządcze oceny SIRI. Skup się na: ogólnym poziomie gotowości do Industry 4.0, wynikach dla 3 Building Blocks (Process, Technology, Organization), kluczowych lukach i priorytetach transformacji. Uwzględnij porównanie z benchmarkami dla sektora produkcyjnego."
    },
    {
      "key": "methodology",
      "type": "methodology",
      "title": "Metodologia SIRI",
      "required": true,
      "order": 2,
      "defaultLength": "medium",
      "defaultLanguage": "technical",
      "promptHints": "Opisz metodologię Smart Industry Readiness Index opracowaną przez Singapore Economic Development Board we współpracy z TÜV SÜD. Wyjaśnij strukturę: 3 Building Blocks, 8 Dimensions, 16 Prioritisation Areas, oraz skalę dojrzałości 0-5."
    },
    {
      "key": "overall_readiness",
      "type": "scorecard",
      "title": "Ogólny Poziom Gotowości Industry 4.0",
      "required": true,
      "order": 3,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "config": {
        "showOverallScore": true,
        "showBlockScores": true,
        "showBenchmark": true
      }
    },
    {
      "key": "readiness_matrix",
      "type": "matrix",
      "title": "Macierz Gotowości SIRI",
      "required": true,
      "order": 4,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "config": {
        "matrixType": "siri_heatmap",
        "showBlocks": true,
        "showDimensions": true,
        "showPrioritisationAreas": true
      },
      "promptHints": "Przedstaw macierz gotowości SIRI w formie heatmap. Pokaż wyniki dla każdego Building Block, każdego Dimension oraz 16 Prioritisation Areas. Zidentyfikuj obszary o najniższych i najwyższych wynikach."
    },
    {
      "key": "radar_chart",
      "type": "chart",
      "title": "Wykres Radarowy - 8 Dimensions",
      "required": true,
      "order": 5,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "config": {
        "chartType": "radar",
        "dimensions": ["operations", "supply_chain", "product_lifecycle", "automation", "connectivity", "intelligence", "talent_readiness", "structure_management"]
      }
    },
    {
      "key": "block_process",
      "type": "block_analysis",
      "title": "Building Block: Process",
      "required": true,
      "order": 10,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "block",
      "repeatKey": "PROCESS",
      "promptHints": "Przeanalizuj Building Block Process obejmujący: Operations (shop floor, quality), Supply Chain (planning, execution, visibility), Product Lifecycle (design, engineering). Dla każdego Dimension przedstaw szczegółową ocenę i rekomendacje."
    },
    {
      "key": "block_technology",
      "type": "block_analysis",
      "title": "Building Block: Technology",
      "required": true,
      "order": 11,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "block",
      "repeatKey": "TECHNOLOGY",
      "promptHints": "Przeanalizuj Building Block Technology obejmujący: Automation (shop floor, enterprise, facility), Connectivity (IT/OT integration, IoT), Intelligence (analytics, AI/ML). Oceń poziom automatyzacji i inteligencji procesów."
    },
    {
      "key": "block_organization",
      "type": "block_analysis",
      "title": "Building Block: Organization",
      "required": true,
      "order": 12,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "block",
      "repeatKey": "ORGANIZATION",
      "promptHints": "Przeanalizuj Building Block Organization obejmujący: Talent Readiness (workforce skills, learning), Structure & Management (governance, collaboration). Oceń gotowość ludzi i organizacji do transformacji Industry 4.0."
    },
    {
      "key": "prioritisation_matrix",
      "type": "matrix",
      "title": "Macierz Priorytetyzacji",
      "required": true,
      "order": 20,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "config": {
        "showAllAreas": true,
        "showPriorities": true
      },
      "promptHints": "Przedstaw macierz priorytetyzacji 16 obszarów SIRI. Dla każdego obszaru określ: aktualny poziom, docelowy poziom, lukę, priorytet transformacji. Zastosuj macierz wpływ/nakład do rekomendacji kolejności działań."
    },
    {
      "key": "gap_analysis",
      "type": "analysis",
      "title": "Analiza Luk",
      "required": true,
      "order": 50,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw szczegółową analizę luk między stanem aktualnym a Industry 4.0 best practices. Zidentyfikuj największe luki w każdym Building Block i Dimension."
    },
    {
      "key": "strengths",
      "type": "list",
      "title": "Mocne Strony",
      "required": true,
      "order": 100,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Zidentyfikuj 7-10 mocnych stron organizacji w kontekście Industry 4.0. Uwzględnij: istniejącą infrastrukturę, kompetencje, osiągnięte poziomy dojrzałości."
    },
    {
      "key": "weaknesses",
      "type": "list",
      "title": "Obszary do Poprawy",
      "required": true,
      "order": 101,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Zidentyfikuj 7-10 obszarów wymagających poprawy. Dla każdego obszaru opisz potencjalny wpływ na efektywność produkcji i konkurencyjność."
    },
    {
      "key": "benchmarking",
      "type": "comparison",
      "title": "Benchmarking Industry 4.0",
      "required": true,
      "order": 102,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Porównaj wyniki z benchmarkami Industry 4.0 dla sektora produkcyjnego. Uwzględnij porównanie regionalne (Europa/Azja) i sektorowe."
    },
    {
      "key": "recommendations",
      "type": "recommendations",
      "title": "Rekomendacje Transformacji Industry 4.0",
      "required": true,
      "order": 110,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Opracuj 10-15 konkretnych rekomendacji dla transformacji Industry 4.0. Pogrupuj według Building Blocks. Dla każdej określ: technologie do wdrożenia, wymagane kompetencje, szacowany nakład i zwrot."
    },
    {
      "key": "technology_roadmap",
      "type": "action_plan",
      "title": "Roadmapa Technologiczna Industry 4.0",
      "required": true,
      "order": 120,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw roadmapę technologiczną na 24-36 miesięcy. Uwzględnij: IoT, MES, Cloud, AI/ML, Digital Twin. Pokaż zależności między inicjatywami i kamienie milowe."
    },
    {
      "key": "investment_priorities",
      "type": "priorities",
      "title": "Priorytety Inwestycyjne",
      "required": true,
      "order": 125,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Określ priorytety inwestycyjne w technologie Industry 4.0. Uwzględnij: infrastrukturę IT/OT, automatyzację, systemy analityczne, szkolenia."
    },
    {
      "key": "risk_assessment",
      "type": "risk",
      "title": "Ocena Ryzyka",
      "required": true,
      "order": 130,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Zidentyfikuj ryzyka związane z transformacją Industry 4.0. Uwzględnij: ryzyka technologiczne, organizacyjne, bezpieczeństwa, integracji systemów."
    },
    {
      "key": "next_steps",
      "type": "action_plan",
      "title": "Następne Kroki",
      "required": true,
      "order": 140,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Określ 5-7 następnych kroków do podjęcia w ciągu 90 dni. Uwzględnij: Quick Wins, pilotaże, budowanie kompetencji."
    },
    {
      "key": "appendix",
      "type": "appendix",
      "title": "Załącznik: Szczegółowe Wyniki",
      "required": false,
      "order": 200,
      "defaultLength": "long",
      "defaultLanguage": "technical"
    }
  ]',
  '{"length": "long", "language": "business", "includeCharts": true, "includeMatrices": true}',
  true,
  true,
  true,
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
  created_at = EXCLUDED.created_at;

-- SIRI Board Pack
INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type, 
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-siri-board-pack',
  NULL,
  'SIRI - Raport dla Zarządu',
  'Zwięzły raport strategiczny gotowości Industry 4.0 dla zarządu i kadry kierowniczej firm produkcyjnych.',
  'ASSESSMENT',
  'ASSESSMENT_SIRI',
  '[
    {
      "key": "cover",
      "type": "cover",
      "title": "Strona Tytułowa",
      "required": true,
      "order": 0,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "style": "executive",
        "subtitle": "Industry 4.0 Readiness - Raport Strategiczny"
      }
    },
    {
      "key": "executive_summary",
      "type": "summary",
      "title": "Podsumowanie dla Zarządu",
      "required": true,
      "order": 1,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Napisz zwięzłe podsumowanie gotowości do Industry 4.0. Skup się na: ogólnej ocenie, pozycji względem konkurencji, strategicznych implikacjach dla produkcji, kluczowych decyzjach inwestycyjnych."
    },
    {
      "key": "readiness_overview",
      "type": "scorecard",
      "title": "Przegląd Gotowości Industry 4.0",
      "required": true,
      "order": 2,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "format": "executive_dashboard"
      }
    },
    {
      "key": "building_blocks",
      "type": "matrix",
      "title": "3 Filary Transformacji",
      "required": true,
      "order": 3,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw wyniki dla 3 Building Blocks (Process, Technology, Organization) w formie wizualnej. Pokaż największe luki i priorytety."
    },
    {
      "key": "strategic_position",
      "type": "analysis",
      "title": "Pozycja Konkurencyjna",
      "required": true,
      "order": 4,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Oceń pozycję konkurencyjną firmy w kontekście Industry 4.0. Porównaj z konkurencją i trendami sektorowymi."
    },
    {
      "key": "key_findings",
      "type": "list",
      "title": "Kluczowe Ustalenia",
      "required": true,
      "order": 5,
      "defaultLength": "short",
      "defaultLanguage": "business"
    },
    {
      "key": "strategic_recommendations",
      "type": "recommendations",
      "title": "Rekomendacje Strategiczne",
      "required": true,
      "order": 10,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw 5-7 strategicznych rekomendacji dla transformacji Industry 4.0. Skup się na decyzjach wymagających zaangażowania zarządu."
    },
    {
      "key": "investment_overview",
      "type": "priorities",
      "title": "Nakłady Inwestycyjne",
      "required": true,
      "order": 11,
      "defaultLength": "short",
      "defaultLanguage": "business"
    },
    {
      "key": "risks_opportunities",
      "type": "risk",
      "title": "Ryzyka i Szanse",
      "required": true,
      "order": 12,
      "defaultLength": "short",
      "defaultLanguage": "business"
    },
    {
      "key": "decisions_required",
      "type": "action_plan",
      "title": "Decyzje do Podjęcia",
      "required": true,
      "order": 20,
      "defaultLength": "short",
      "defaultLanguage": "business"
    },
    {
      "key": "next_steps",
      "type": "action_plan",
      "title": "Następne Kroki",
      "required": true,
      "order": 21,
      "defaultLength": "short",
      "defaultLanguage": "business"
    }
  ]',
  '{"length": "medium", "language": "business", "style": "executive"}',
  true,
  false,
  true,
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
  created_at = EXCLUDED.created_at;

-- SIRI Bank Pack
INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type, 
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-siri-bank-pack',
  NULL,
  'SIRI - Raport do Banku',
  'Raport gotowości Industry 4.0 przygotowany dla instytucji finansowych wspierających transformację sektora produkcyjnego.',
  'ASSESSMENT',
  'ASSESSMENT_SIRI',
  '[
    {
      "key": "cover",
      "type": "cover",
      "title": "Strona Tytułowa",
      "required": true,
      "order": 0,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "style": "formal",
        "subtitle": "Industry 4.0 Readiness Assessment - Raport dla Instytucji Finansowej"
      }
    },
    {
      "key": "company_profile",
      "type": "summary",
      "title": "Profil Organizacji Produkcyjnej",
      "required": true,
      "order": 1,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw profil firmy produkcyjnej. Uwzględnij: sektor, produkty, moce produkcyjne, pozycję rynkową, historię modernizacji."
    },
    {
      "key": "executive_summary",
      "type": "summary",
      "title": "Podsumowanie Oceny",
      "required": true,
      "order": 2,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "methodology",
      "type": "methodology",
      "title": "Metodologia SIRI",
      "required": true,
      "order": 3,
      "defaultLength": "short",
      "defaultLanguage": "technical"
    },
    {
      "key": "readiness_assessment",
      "type": "matrix",
      "title": "Wyniki Oceny Gotowości",
      "required": true,
      "order": 4,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "transformation_capability",
      "type": "analysis",
      "title": "Zdolność do Modernizacji",
      "required": true,
      "order": 5,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Oceń zdolność firmy do przeprowadzenia modernizacji produkcji. Uwzględnij: historię wdrożeń, kompetencje techniczne, kulturę organizacyjną."
    },
    {
      "key": "strengths",
      "type": "list",
      "title": "Czynniki Pozytywne",
      "required": true,
      "order": 10,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "risk_factors",
      "type": "list",
      "title": "Czynniki Ryzyka",
      "required": true,
      "order": 11,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "technology_assessment",
      "type": "block_analysis",
      "title": "Ocena Technologii",
      "required": true,
      "order": 15,
      "repeatFor": "block",
      "repeatKey": "TECHNOLOGY",
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Oceń stan infrastruktury technologicznej. Uwzględnij: automatyzację, systemy IT/OT, cyberbezpieczeństwo przemysłowe."
    },
    {
      "key": "operational_efficiency",
      "type": "analysis",
      "title": "Efektywność Operacyjna",
      "required": true,
      "order": 16,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Oceń efektywność operacyjną produkcji. Uwzględnij: OEE, jakość, elastyczność produkcji."
    },
    {
      "key": "transformation_plan",
      "type": "action_plan",
      "title": "Plan Modernizacji",
      "required": true,
      "order": 20,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "investment_requirements",
      "type": "priorities",
      "title": "Potrzeby Inwestycyjne",
      "required": true,
      "order": 21,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "expected_outcomes",
      "type": "analysis",
      "title": "Oczekiwane Rezultaty",
      "required": true,
      "order": 22,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw oczekiwane rezultaty modernizacji: wzrost produktywności, redukcja kosztów, poprawa jakości, nowe możliwości produkcyjne."
    },
    {
      "key": "conclusion",
      "type": "summary",
      "title": "Wnioski",
      "required": true,
      "order": 30,
      "defaultLength": "short",
      "defaultLanguage": "business"
    }
  ]',
  '{"length": "medium", "language": "business", "style": "formal"}',
  true,
  false,
  true,
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
  created_at = EXCLUDED.created_at;

-- ==========================================
-- ADMA TEMPLATES
-- ==========================================

-- ADMA Full Diagnostic Report
INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type, 
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-adma-full-diagnostic',
  NULL,
  'ADMA - Pełny Raport Diagnostyczny',
  'Kompleksowy raport Advanced Digital Maturity Assessment obejmujący wszystkie 5 Filarów i 12 Wymiarów. Raport zgodny ze standardami European Digital Innovation Hubs.',
  'ASSESSMENT',
  'ASSESSMENT_ADMA',
  '[
    {
      "key": "cover",
      "type": "cover",
      "title": "Strona Tytułowa",
      "required": true,
      "order": 0,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "showLogo": true,
        "subtitle": "Advanced Digital Maturity Assessment"
      }
    },
    {
      "key": "executive_summary",
      "type": "summary",
      "title": "Streszczenie Zarządcze",
      "required": true,
      "order": 1,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Napisz profesjonalne streszczenie zarządcze oceny ADMA. Skup się na: ogólnym poziomie dojrzałości cyfrowej przedsiębiorstwa produkcyjnego, wynikach dla 5 Filarów (Strategy, Smart Products, Smart Operations, Smart Supply Chain, Data-Driven Services), kluczowych lukach i priorytetach transformacji."
    },
    {
      "key": "methodology",
      "type": "methodology",
      "title": "Metodologia ADMA",
      "required": true,
      "order": 2,
      "defaultLength": "medium",
      "defaultLanguage": "technical",
      "promptHints": "Opisz metodologię Advanced Digital Maturity Assessment opracowaną przez European Commission w ramach Digital Innovation Hubs. Wyjaśnij strukturę: 5 Filarów, 12 Wymiarów, oraz skalę dojrzałości 1-5 (Newcomer do Expert)."
    },
    {
      "key": "overall_maturity",
      "type": "scorecard",
      "title": "Ogólny Poziom Dojrzałości Cyfrowej",
      "required": true,
      "order": 3,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "config": {
        "showOverallScore": true,
        "showPillarScores": true,
        "showMaturityLevel": true
      }
    },
    {
      "key": "maturity_matrix",
      "type": "matrix",
      "title": "Macierz Dojrzałości ADMA",
      "required": true,
      "order": 4,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "config": {
        "matrixType": "adma_heatmap",
        "showPillars": true,
        "showDimensions": true
      },
      "promptHints": "Przedstaw macierz dojrzałości ADMA. Dla każdego Filaru i Wymiaru pokaż wynik aktualny, docelowy i lukę. Uwzględnij poziomy dojrzałości: Newcomer (1), Beginner (2), Intermediate (3), Experienced (4), Expert (5)."
    },
    {
      "key": "radar_chart",
      "type": "chart",
      "title": "Wykres Radarowy - 5 Filarów",
      "required": true,
      "order": 5,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "config": {
        "chartType": "radar",
        "dimensions": ["strategy", "smart_products", "smart_operations", "smart_supply", "data_driven"]
      }
    },
    {
      "key": "pillar_strategy",
      "type": "pillar_analysis",
      "title": "Filar: Strategia i Organizacja",
      "required": true,
      "order": 10,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "pillar",
      "repeatKey": "strategy",
      "promptHints": "Przeanalizuj Filar Strategy & Organization obejmujący: Digital Strategy, Digital Investments, Digital Culture. Oceń zgodność strategii cyfrowej z celami biznesowymi i gotowość organizacyjną."
    },
    {
      "key": "pillar_products",
      "type": "pillar_analysis",
      "title": "Filar: Inteligentne Produkty",
      "required": true,
      "order": 11,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "pillar",
      "repeatKey": "smart_products",
      "promptHints": "Przeanalizuj Filar Smart Products obejmujący: Smart Product Features, Product Data Usage. Oceń poziom cyfryzacji produktów, integracji IoT i możliwości serwicyzacji."
    },
    {
      "key": "pillar_operations",
      "type": "pillar_analysis",
      "title": "Filar: Inteligentne Operacje",
      "required": true,
      "order": 12,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "pillar",
      "repeatKey": "smart_operations",
      "promptHints": "Przeanalizuj Filar Smart Operations obejmujący: Production Technologies, Production IT. Oceń poziom automatyzacji produkcji i integrację systemów (MES, SCADA, ERP)."
    },
    {
      "key": "pillar_supply",
      "type": "pillar_analysis",
      "title": "Filar: Inteligentny Łańcuch Dostaw",
      "required": true,
      "order": 13,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "pillar",
      "repeatKey": "smart_supply",
      "promptHints": "Przeanalizuj Filar Smart Supply Chain obejmujący: Supply Chain Integration, Supply Chain Visibility. Oceń cyfryzację łańcucha dostaw i poziom integracji z partnerami."
    },
    {
      "key": "pillar_data",
      "type": "pillar_analysis",
      "title": "Filar: Usługi Oparte na Danych",
      "required": true,
      "order": 14,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "repeatFor": "pillar",
      "repeatKey": "data_driven",
      "promptHints": "Przeanalizuj Filar Data-Driven Services obejmujący: Data Collection, Data Analytics, Data-Based Services. Oceń zdolność do monetyzacji danych i tworzenia wartości z analityki."
    },
    {
      "key": "gap_analysis",
      "type": "analysis",
      "title": "Analiza Luk",
      "required": true,
      "order": 50,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw szczegółową analizę luk między stanem aktualnym a docelowym. Zidentyfikuj 5-7 najważniejszych luk, określ ich wpływ na konkurencyjność i priorytetyzuj według wartości biznesowej."
    },
    {
      "key": "strengths",
      "type": "list",
      "title": "Mocne Strony",
      "required": true,
      "order": 100,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Zidentyfikuj 7-10 mocnych stron organizacji w kontekście dojrzałości cyfrowej. Uwzględnij odniesienie do poziomów ADMA i porównanie z benchmarkami EU."
    },
    {
      "key": "weaknesses",
      "type": "list",
      "title": "Obszary do Poprawy",
      "required": true,
      "order": 101,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Zidentyfikuj 7-10 obszarów wymagających poprawy. Określ wpływ na możliwości biznesowe i konkurencyjność europejską."
    },
    {
      "key": "benchmarking",
      "type": "comparison",
      "title": "Benchmarking Europejski",
      "required": true,
      "order": 102,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Porównaj wyniki z benchmarkami europejskimi ADMA. Uwzględnij porównanie sektorowe i regionalne w ramach EU."
    },
    {
      "key": "recommendations",
      "type": "recommendations",
      "title": "Rekomendacje Transformacji",
      "required": true,
      "order": 110,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Opracuj 10-15 rekomendacji pogrupowanych według Filarów ADMA. Uwzględnij możliwości wsparcia z programów EU (Digital Europe, Horizon Europe)."
    },
    {
      "key": "roadmap",
      "type": "action_plan",
      "title": "Roadmapa Transformacji Cyfrowej",
      "required": true,
      "order": 120,
      "defaultLength": "long",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw roadmapę transformacji na 18-24 miesięcy. Uwzględnij: fazy wdrożenia, kamienie milowe, integrację z inicjatywami EU."
    },
    {
      "key": "investment_priorities",
      "type": "priorities",
      "title": "Priorytety Inwestycyjne",
      "required": true,
      "order": 125,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "eu_funding",
      "type": "analysis",
      "title": "Możliwości Finansowania EU",
      "required": true,
      "order": 126,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Zidentyfikuj możliwości finansowania transformacji z programów EU: Digital Innovation Hubs, Horizon Europe, Digital Europe Programme, fundusze strukturalne."
    },
    {
      "key": "risk_assessment",
      "type": "risk",
      "title": "Ocena Ryzyka",
      "required": true,
      "order": 130,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "next_steps",
      "type": "action_plan",
      "title": "Następne Kroki",
      "required": true,
      "order": 140,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "appendix",
      "type": "appendix",
      "title": "Załącznik: Szczegółowe Wyniki",
      "required": false,
      "order": 200,
      "defaultLength": "long",
      "defaultLanguage": "technical"
    }
  ]',
  '{"length": "long", "language": "business", "includeCharts": true, "includeMatrices": true}',
  true,
  true,
  true,
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
  created_at = EXCLUDED.created_at;

-- ADMA Board Pack
INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type, 
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-adma-board-pack',
  NULL,
  'ADMA - Raport dla Zarządu',
  'Zwięzły raport strategiczny dojrzałości cyfrowej dla zarządu, oparty na standardach European Digital Innovation Hubs.',
  'ASSESSMENT',
  'ASSESSMENT_ADMA',
  '[
    {
      "key": "cover",
      "type": "cover",
      "title": "Strona Tytułowa",
      "required": true,
      "order": 0,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "style": "executive",
        "subtitle": "Digital Maturity Assessment - Raport Strategiczny"
      }
    },
    {
      "key": "executive_summary",
      "type": "summary",
      "title": "Podsumowanie dla Zarządu",
      "required": true,
      "order": 1,
      "defaultLength": "medium",
      "defaultLanguage": "business",
      "promptHints": "Napisz zwięzłe podsumowanie dojrzałości cyfrowej według ADMA. Skup się na: ogólnej ocenie (poziom Newcomer do Expert), pozycji konkurencyjnej w EU, strategicznych implikacjach."
    },
    {
      "key": "maturity_overview",
      "type": "scorecard",
      "title": "Przegląd Dojrzałości",
      "required": true,
      "order": 2,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "format": "executive_dashboard"
      }
    },
    {
      "key": "five_pillars",
      "type": "matrix",
      "title": "5 Filarów Dojrzałości",
      "required": true,
      "order": 3,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "eu_position",
      "type": "comparison",
      "title": "Pozycja w Europie",
      "required": true,
      "order": 4,
      "defaultLength": "short",
      "defaultLanguage": "business"
    },
    {
      "key": "key_findings",
      "type": "list",
      "title": "Kluczowe Ustalenia",
      "required": true,
      "order": 5,
      "defaultLength": "short",
      "defaultLanguage": "business"
    },
    {
      "key": "strategic_recommendations",
      "type": "recommendations",
      "title": "Rekomendacje Strategiczne",
      "required": true,
      "order": 10,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "investment_overview",
      "type": "priorities",
      "title": "Nakłady i Finansowanie",
      "required": true,
      "order": 11,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw przegląd nakładów inwestycyjnych oraz możliwości współfinansowania z programów EU."
    },
    {
      "key": "risks_opportunities",
      "type": "risk",
      "title": "Ryzyka i Szanse",
      "required": true,
      "order": 12,
      "defaultLength": "short",
      "defaultLanguage": "business"
    },
    {
      "key": "decisions_required",
      "type": "action_plan",
      "title": "Decyzje do Podjęcia",
      "required": true,
      "order": 20,
      "defaultLength": "short",
      "defaultLanguage": "business"
    },
    {
      "key": "next_steps",
      "type": "action_plan",
      "title": "Następne Kroki",
      "required": true,
      "order": 21,
      "defaultLength": "short",
      "defaultLanguage": "business"
    }
  ]',
  '{"length": "medium", "language": "business", "style": "executive"}',
  true,
  false,
  true,
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
  created_at = EXCLUDED.created_at;

-- ADMA Bank Pack
INSERT INTO report_builder_templates (
  id, organization_id, name, description, source_type, report_type, 
  sections_json, default_options_json, is_system, is_default, is_public, created_at
) VALUES (
  'tpl-adma-bank-pack',
  NULL,
  'ADMA - Raport do Banku',
  'Raport dojrzałości cyfrowej dla instytucji finansowych, oparty na standardach europejskich Digital Innovation Hubs.',
  'ASSESSMENT',
  'ASSESSMENT_ADMA',
  '[
    {
      "key": "cover",
      "type": "cover",
      "title": "Strona Tytułowa",
      "required": true,
      "order": 0,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "config": {
        "style": "formal",
        "subtitle": "Digital Maturity Assessment - Raport dla Instytucji Finansowej"
      }
    },
    {
      "key": "company_profile",
      "type": "summary",
      "title": "Profil Organizacji",
      "required": true,
      "order": 1,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "executive_summary",
      "type": "summary",
      "title": "Podsumowanie Oceny",
      "required": true,
      "order": 2,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "methodology",
      "type": "methodology",
      "title": "Metodologia ADMA (EU Standard)",
      "required": true,
      "order": 3,
      "defaultLength": "short",
      "defaultLanguage": "technical",
      "promptHints": "Opisz ADMA jako uznany europejski standard oceny dojrzałości cyfrowej przedsiębiorstw produkcyjnych."
    },
    {
      "key": "maturity_assessment",
      "type": "matrix",
      "title": "Wyniki Oceny Dojrzałości",
      "required": true,
      "order": 4,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "transformation_capability",
      "type": "analysis",
      "title": "Zdolność Transformacyjna",
      "required": true,
      "order": 5,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "strengths",
      "type": "list",
      "title": "Czynniki Pozytywne",
      "required": true,
      "order": 10,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "risk_factors",
      "type": "list",
      "title": "Czynniki Ryzyka",
      "required": true,
      "order": 11,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "operations_assessment",
      "type": "pillar_analysis",
      "title": "Ocena Operacji Produkcyjnych",
      "required": true,
      "order": 15,
      "repeatFor": "pillar",
      "repeatKey": "smart_operations",
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "data_management",
      "type": "pillar_analysis",
      "title": "Zarządzanie Danymi",
      "required": true,
      "order": 16,
      "repeatFor": "pillar",
      "repeatKey": "data_driven",
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "transformation_plan",
      "type": "action_plan",
      "title": "Plan Transformacji",
      "required": true,
      "order": 20,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "investment_requirements",
      "type": "priorities",
      "title": "Potrzeby Inwestycyjne",
      "required": true,
      "order": 21,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "eu_funding_potential",
      "type": "analysis",
      "title": "Potencjał Finansowania EU",
      "required": true,
      "order": 22,
      "defaultLength": "short",
      "defaultLanguage": "business",
      "promptHints": "Przedstaw możliwości pozyskania współfinansowania z programów EU, co może zmniejszyć wymagania kredytowe."
    },
    {
      "key": "expected_outcomes",
      "type": "analysis",
      "title": "Oczekiwane Rezultaty",
      "required": true,
      "order": 23,
      "defaultLength": "medium",
      "defaultLanguage": "business"
    },
    {
      "key": "conclusion",
      "type": "summary",
      "title": "Wnioski",
      "required": true,
      "order": 30,
      "defaultLength": "short",
      "defaultLanguage": "business"
    }
  ]',
  '{"length": "medium", "language": "business", "style": "formal"}',
  true,
  false,
  true,
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
  created_at = EXCLUDED.created_at;

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_rb_templates_type_framework ON report_builder_templates(source_type, report_type);
CREATE INDEX IF NOT EXISTS idx_rb_templates_public ON report_builder_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_rb_templates_system ON report_builder_templates(is_system);
