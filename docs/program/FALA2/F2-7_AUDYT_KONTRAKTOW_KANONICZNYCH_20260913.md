---
doc_id: f2-7-audyt-kontraktow-kanonicznych
truth_type: audit
status: ETAP 1 — inwentarz i ocena (bez kodu, bez pisania kontraktów)
pomiar: katalog TYLKO-ODCZYT `/Users/piotrwisniewski/Developer/wt/kandydat-20260913`,
  HEAD `45ada4d0890d79a868bbbe2ad8ee3a89eb4c522d`, 2026-09-13, statycznie z kodu i dokumentów
  (bez uruchamiania serwera, bez żywej bazy)
zadanie: F2-7 etap 1 — „pełny przegląd kontraktów opisujących kanoniczny plan działania
  dla wszystkich narzędzi" (słowa właściciela)
docelowo: `docs/ssot/` po akcepcie CTO
---

# F2-7 — AUDYT KONTRAKTÓW PRACY KONSULTANTA (etap 1: identyfikacja i ocena)

## 0. Wynik w jednej tabeli

**42 zinwentaryzowane miejsca pracy konsultanta.**

| ocena | co znaczy | liczba | udział |
|---|---|---:|---:|
| **0** | brak jakiegokolwiek kontraktu — treść powstaje bez reguł albo nie powstaje wcale (atrapa) | **7** | 17 % |
| **1** | prompt „na oko" — jedno-dwa zdania roli, bez struktury wyjścia, bez źródeł, bez walidacji | **14** | 33 % |
| **2** | kontrakt częściowy — jest struktura wyjścia (JSON/schemat) albo doktryna jakości, ale brakuje drugiej połowy (źródeł, języka, walidacji, testu) | **16** | 38 % |
| **3** | twardy kontrakt: spisany standard + prompt 1:1 z nim + walidacja maszynowa + test | **5** | 12 % |

**Czytanie tej tabeli:** 21 z 42 miejsc (50 %) produkuje treść merytoryczną dla klienta
bez żadnej sprawdzalnej reguły jakości. Pięć miejsc z oceną 3 pokazuje, że **wzorzec
w tym repo już istnieje i działa** (DRD · Inicjatywa · Wniosek · Finanse · Excel) —
zadanie etapu 2 to nie wymyślanie kontraktu, tylko jego rozciągnięcie na pozostałe 37.

**Dwa zdania prawdy, które trzeba powiedzieć na wstępie:**

1. `docs/ssot/KONTRAKTY_NARZEDZI_AI.md` — istniejący SSOT, punkt wyjścia zlecenia —
   **nie jest kontraktem pracy konsultanta.** To mapa pokrycia: „czy w tym module da się
   dojść do Teresy" (DZIAŁA / ZA FLAGĄ / BRAK). Odpowiada na pytanie *gdzie jest przycisk*,
   nie *co ma napisać i wg jakiego standardu*. Jego wiersz „DZIAŁA" dla modułu Wyniki
   oznacza „panel propozycji się renderuje", a nie „Teresa napisała analizę" — patrz §3
   rozjazd R1.
2. Prawdziwe kontrakty pracy konsultanta w tym repo istnieją, ale **nie w `docs/ssot/`**
   — mieszkają w `docs/standards/` (`CONCLUSION_LAYER_STANDARD.md`,
   `CARD_CONTENT_FORMULA.md`) i w `Harvard/wdrozenie-100/` (`_DOKTRYNA_TRESCI_EXCEL…`).
   `docs/SOURCE_OF_TRUTH.md` nie kieruje do nich z hasła „kontrakt narzędzia".

---

## 1. Inwentarz — 42 miejsca pracy konsultanta

Legenda 7 pól kontraktu (kolumna „co kontrakt określa dziś"), kolejność stała:
`WE` wejście · `WY` wyjście/struktura · `ZK` zasady konsultanta (jakość treści) ·
`ZR` źródła/rodowód · `JZ` język · `WL` walidacja jakości · `AK` ślad akceptu człowieka.
`T` = jest, `N` = nie ma, `cz` = częściowo.

Pilność: **MVP** = przed pilotażem na demo · **F2** = ten program · **F3** = później.

### 1A. Karty N — „n-karty" (decyzje, taski, wnioski, inicjatywy, KPI, RAID…)

| # | narzędzie / miejsce | plik(i) : linia | spisany kontrakt? | WE·WY·ZK·ZR·JZ·WL·AK | ocena | ryzyko dla klienta | pilność |
|---:|---|---|---|---|:--:|---|---|
| 1 | **Inicjatywa — generator pełnej karty** | `server/src/services/initiativeGenerationService.ts` (`DOCTRINE_SYSTEM_PROMPT` PL/EN, `REVIEWER_SYSTEM_PROMPT` PL/EN) | **TAK** — `docs/standards/CARD_CONTENT_FORMULA.md` §A3 + `docs/initiatives/INITIATIVE_FORMULA.md` | T·T·T·T·T·cz·T | **3** | niska; słaby punkt: bramka blokuje tylko na 6 kodach (§3 R3) | F2 |
| 2 | **Inicjatywa — kandydat „lekki"** | `server/src/services/initiative/proposeEngineService.ts`, `ToolInitiativeService.ts` ← `initiative/cardContentFormulaPrompt.ts:16 A3_LITE` | TAK (podzbiór §A3) | T·T·T·cz·T·N·T | **2** | tytuł-ogólnik („Poprawa procesu") wpada na listę kandydatów | F2 |
| 3 | **Inicjatywa — wypełnianie sekcji (24 sekcje)** | `server/src/services/ai/initiativeSectionFill.ts`, `initiativeSectionTypeService.ts` → kolumna DB `initiative_section_types.ai_prompt_template` | **NIE spisany** — prompty w bazie, poza repo | cz·T·N·N·cz·N·T | **1** | treść sekcji zależy od wiersza w bazie, którego nikt nie recenzuje; zero rodowodu | **MVP** |
| 4 | **Wniosek (Insight) — generator** | `server/src/services/InterviewInsightService.ts:657 BCG_P10_PROMPT_DOCTRINE`, `:673 INSIGHT_SECTION_BCG_GUIDANCE` | TAK — `CARD_CONTENT_FORMULA.md` §A2 | T·T·T·T·**N**·T·T | **3** | **cała doktryna po angielsku, zero reguły języka** (§3 R4) | **MVP** |
| 5 | **Wniosek — materializacja + naprawa** | `server/src/services/insightMaterializationService.ts:446` (bramka F14 + 1 pętla auto-naprawy) | TAK (ta sama) | T·T·T·T·cz·T·T | **3** | niska — wzorzec odniesienia dla pętli „generuj → oceń → popraw" | — |
| 6 | **Karta Zadania (Task) — treść sekcji** | `server/src/services/taskSectionGenerationService.ts:66/79 TASK_DOCTRINE_SYSTEM_PROMPT (PL/EN)` | NIE — doktryna żyje tylko w promptcie | T·cz·T·N·T·N·T | **2** | zadanie bez kryterium zamknięcia i bez wskazania źródła odchylenia | F2 |
| 7 | **Karta Decyzji — treść sekcji** | `server/src/services/decisionService.ts:89/102 DECISION_DOCTRINE_SYSTEM_PROMPT (PL/EN)` | NIE | T·cz·T·N·T·N·T | **2** | decyzja bez trade-offów i bez „co odrzucono i dlaczego" | F2 |
| 8 | **Karta Powiadomienia** | rubryka `src/services/cardAnalysis/cardAnalysisRubric.ts:645 NOTIFICATION_CARDS` | częściowo (rubryka analizy, nie generacji) | cz·N·cz·N·T·N·T | **1** | „Typ powiadomienia: **Escalation**" — angielski enum w polskim UI (K25) | F2 |
| 9 | **Karta Działania (action)** | rubryka `cardAnalysisRubric.ts:130` — kryteria są; **katalog kart pusty** (`CARD_DESCRIPTORS.action = []`) | częściowo | cz·N·cz·N·cz·N·T | **1** | karta działania z łańcucha „coś jest źle" nie ma wzorca treści (D2/D3) | **MVP** |
| 10 | **Karta Planu (plan)** | `cardAnalysisRubric.ts:176 plan: []` — **zero kryteriów, zero katalogu** | **NIE** | N·N·N·N·N·N·cz | **0** | „Pracuj z AI" na planie = trzy osobne przyciski bez rubryki; „**WEEK** · Europe/Warsaw" w PL UI | F2 |
| 11 | **Karta Analizy obciążenia (capacity_analysis)** | `cardAnalysisRubric.ts:177 capacity_analysis: []` | **NIE** | N·N·N·N·N·N·cz | **0** | j.w.; prawy panel = akapit zamiast tabeli (K7) | F3 |
| 12 | **Karta Miernika (metric/KPI)** | rubryka `cardAnalysisRubric.ts:748` (kryteria są); katalog kart `[]` | częściowo | cz·N·cz·N·T·N·T | **1** | „kontrakt miernika" pisany bez wzorca — każda organizacja dostanie inny kształt | F2 |
| 13 | **Karta Celu (objective/OKR)** | rubryka `:803`; katalog `[]` | częściowo | cz·N·cz·N·T·N·T | **1** | j.w. | F2 |
| 14 | **Karta ROI (roi_case)** | rubryka `:858`; katalog `[]` | częściowo | cz·N·cz·N·T·N·T | **1** | założenia ROI bez wymogu jawnej logiki (§A7) | F2 |
| 15 | **Karta Pomysłu (idea)** | rubryka `:147`; katalog `[]` | częściowo | cz·N·cz·N·cz·N·T | **1** | — | F3 |
| 16 | **Karta Sesji wywiadu (interview)** | rubryka `:724` (dopisana); katalog `[]`; komentarz `:714` przyznaje, że ekran silnika nie woła | częściowo | cz·N·cz·N·cz·N·N | **1** | rubryka istnieje, przycisku nie ma — nikt jej nie wykona | F3 |
| 17 | **Rubryka „Analizuj z AI" — 21 pozostałych typów** | `cardAnalysisRubric.ts:86 STRUCTURAL_COMPLETENESS` użyte dla `presentation`·`document`·`sheet`·`management-report`·`finance-analysis`·`execution-report`·`report-builder`·`vault-document`·5×KPI/OKR/ROI·… (21 z 37 typów) | **NIE — jedno generyczne kryterium dla 21 typów** | cz·N·N·N·T·N·T | **1** | deck, dokument i raport zarządczy są oceniane tym samym jednym zdaniem „kompletność strukturalna" | **MVP** |
| 18 | **Kontrakt sekcji karty (K1–K5)** | 7 katalogów `KanonicznaKarta`: `taskCardContract`·`decisionCardContract`·`notificationCardContract`·`insightCardContract`·`interviewCardContract`·`initiativeCardContract`·`toolCards.contract` | TAK — `docs/ssot/KARTA_N_KONTRAKT.md` | T·T·N·cz·T·cz·T | **2** | kontrakt opisuje **układ** karty, nie **treść**, którą AI ma w nią wpisać | F2 |
| 19 | **„Pracuj z AI" — powłoka trzech pozycji** | `src/components/standard/PracujZAI.tsx`, renderowana w **19 ekranach** (pomiar 13.09; SSOT z 06.09 mówił 9/22 — **poprawa**) | TAK — `docs/ssot/STEROWANIE_KART_N_I_AI.md` zasada 3 | T·T·N·N·T·N·T | **2** | przycisk jest wszędzie; to, **co** wywoła, zależy od rubryki z wiersza 17 | F2 |

### 1B. Wywiad

| # | narzędzie / miejsce | plik(i) : linia | spisany kontrakt? | 7 pól | ocena | ryzyko | pilność |
|---:|---|---|---|---|:--:|---|---|
| 20 | **Wnioski z wywiadu — 8 trybów promptu** | `InterviewInsightService.ts:683 PROMPT_TEMPLATES_BASE` (summary, general_analysis, trends, …) | częściowo (doktryna §A2 + BCG) | T·T·T·T·**N**·cz·T | **2** | szkielety sekcji **po angielsku**; polski klient dostaje „Executive Summary / Main Themes" | **MVP** |
| 21 | **Wnioskowanie o organizacji z wywiadu** | `server/src/services/interviewInferenceService.ts` | NIE | cz·T·N·cz·N·N·cz | **1** | twierdzenia o firmie bez rodowodu (łamie Z1/Z3) | F2 |
| 22 | **Pakiet raportowy wniosków** | `server/src/services/interviewInsightReportPackService.ts` (woła `validateInsightCard`) | TAK (pochodna §A2) | T·T·T·T·cz·T·T | **3** | niska | — |
| 23 | **Ocena AI odpowiedzi respondenta (W05)** | **nie znaleziono osobnego serwisu** — ocena jakości odpowiedzi istnieje jako kryterium `interview-evidence` w rubryce, bez generatora | **NIE** | N·N·N·N·N·N·N | **0** | funkcja z zakresu zlecenia nie ma implementacji — patrz §6 „czego nie zmierzyłem" | F2 |
| 24 | **Generator pytań wywiadu / szablon** | `src/components/Interview/TemplateBuilder.tsx` + `interviewCardContract.ts`; pokrycie: `docs/standards/INTERVIEW_COVERAGE_MATRIX.md` | częściowo | T·T·cz·N·cz·N·T | **2** | pytania bez kontroli pokrycia obszarów per rola | F2 |

### 1C. Ocena (Assessment / DRD)

| # | narzędzie / miejsce | plik(i) : linia | spisany kontrakt? | 7 pól | ocena | ryzyko | pilność |
|---:|---|---|---|---|:--:|---|---|
| 25 | **Raport DRD — narrator wniosków** | `server/src/services/report/drdLlmNarrator.ts:274` (PL) `:285` (EN), walidator `validateNumbersFromEngine` | **TAK** — `docs/standards/CONCLUSION_LAYER_STANDARD.md` §4.2 + `docs/product/DRD_REPORT_SPEC.md` | T·T·T·T·T·T·T | **3** | **wzorzec odniesienia dla całego F2-7** | — |
| 26 | **Raport oceny — generator treści** | `server/src/services/aiAssessmentReportGenerator.ts` (458 l., zero `You are`/`Jesteś`) | NIE | cz·cz·N·N·N·N·cz | **1** | ścieżka równoległa do DRD bez jego rygoru | F2 |
| 27 | **Inicjatywy z oceny** | `server/src/services/assessmentInitiativeService.ts:33` — **lokalna kopia** §A3 (nie import z SSOT) | TAK, ale zduplikowana | T·T·T·cz·T·cz·T | **2** | kopia zadryfuje od `cardContentFormulaPrompt.ts` w ciszy | F2 |
| 28 | **Propozycja uzasadnienia oceny (Teresa w DRD)** | `src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx:179` za flagą `drdHttpSourceOfTruth` = **OFF** | częściowo | cz·cz·cz·cz·cz·N·T | **1** | ścieżka domyślna (`MethodWorkspaceShell.tsx:67`) przyjmuje `teresaProps` i **nigdy ich nie renderuje** | F2 |

### 1D. Inicjatywy — praca z portfelem

| # | narzędzie / miejsce | plik(i) : linia | spisany kontrakt? | 7 pól | ocena | ryzyko | pilność |
|---:|---|---|---|---|:--:|---|---|
| 29 | **Analiza portfela inicjatyw** | `server/src/services/initiative/portfolioAnalysisService.ts` (587 l., **0 wywołań LLM** — czysta arytmetyka) | NIE | T·T·N·T·N·N·N | **1** | klient dostaje liczby portfela bez ani jednego zdania „co to znaczy" — dokładnie anty-wzorzec „semaforek" z `CONCLUSION_LAYER_STANDARD` §6 P1 | **MVP** |
| 30 | **Recenzent adwersaryjny karty** | `server/src/routes/pmo/initiatives.routes.ts:2567` + `REVIEWER_SYSTEM_PROMPT_PL/EN` | TAK (§B4/§B6) | T·T·T·T·T·T·T | **3** | niska | — |
| 31 | **Bramka kompletności karty przy tworzeniu** | `server/src/services/initiative/createInitiativeService.ts:290 assertCardMeetsFormula`, `cardContentFormulaValidator.ts:1243` | TAK | T·T·T·T·cz·**cz**·T | **2** | blokuje na 6 kodach z ~30; KPI bez baseline, RAID bez miksu i angielszczyzna **przechodzą** | F2 |

### 1E. Realizacja (Execution)

| # | narzędzie / miejsce | plik(i) : linia | spisany kontrakt? | 7 pól | ocena | ryzyko | pilność |
|---:|---|---|---|---|:--:|---|---|
| 32 | **„Analiza tygodnia" / analiza odchylenia wdrożenia** | `src/components/Execution/RolloutTab.tsx:1005 teresaCallout` → otwiera **ogólny czat** z `topSignal`; **brak serwisowego generatora** | **NIE** | N·N·N·N·N·N·N | **0** | SSOT mówi „DZIAŁA"; realnie to link do czatu — konsultant nie dostaje analizy, tylko puste okno | **MVP** |
| 33 | **Ryzyka wywodzone z inicjatyw** | `RolloutTab.tsx:1103 showDerivedRisks` + `DerivedNote` (deterministyczne) | NIE | T·T·N·T·N·N·N | **1** | rejestr ryzyk bez interpretacji i bez priorytetu | F2 |
| 34 | **Raport statusu / sponsora** | `server/src/services/statusReportService.ts`, `sponsorReportService.ts` | NIE | cz·cz·N·cz·N·N·cz | **1** | status bez K2–K4 (co to znaczy / co robić / jaki efekt) | F2 |

### 1F. Wyniki (KPI · OKR · ROI)

| # | narzędzie / miejsce | plik(i) : linia | spisany kontrakt? | 7 pól | ocena | ryzyko | pilność |
|---:|---|---|---|---|:--:|---|---|
| 35 | **Teresa — szkic refleksji OKR** | `src/components/ResultsVNext/okr/okrTeresaReflectionDraft.ts:113` — **stały łańcuch znaków**, zero LLM, zero API | **NIE** | T·cz·N·cz·T·N·**T** | **0** | **klient klika „Teresa" i dostaje instrukcję obsługi zamiast refleksji** — patrz §3 R1 | **MVP** |
| 36 | **Teresa — szkic RCA dla KPI** | `src/components/ResultsVNext/kpiTool/kpiTeresaRcaDraft.ts` — 0 trafień `llm|fetch|Api.` | **NIE** | T·cz·N·cz·T·N·T | **0** | j.w. — „główna przyczyna" pisana przez szablon | **MVP** |
| 37 | **Teresa — wnioski PIR dla ROI** | `src/components/ResultsVNext/roi/roiTeresaLessonsDraft.ts:87` — 0 trafień `llm|fetch|Api.` | **NIE** | T·cz·N·cz·T·N·T | **0** | j.w. | **MVP** |
| 38 | **Pipeline propozycji P08 (propose→approve→execute→undo→audit)** | `server/src/services/v8/teresaCopilotService.ts` (3664 l., `resolveEffectiveAccess` ×8), `routes/v8/teresa.routes.ts` | TAK — `ZASADY_AI_TERESA_SSOT.md` §3/§5/§6 | T·T·—·T·—·T·T | **3** | **mechanika ładu jest wzorowa**; brakuje w niej treści (35–37) | — |

### 1G. Finanse

| # | narzędzie / miejsce | plik(i) : linia | spisany kontrakt? | 7 pól | ocena | ryzyko | pilność |
|---:|---|---|---|---|:--:|---|---|
| 39 | **Wniosek z sekcji finansowej raportu** | `server/src/services/financeReportConclusion.ts:224 validateConclusion` ← `financeConclusionService.ts` (narrator W3) ← `financeReportSectionService.ts:1156` ← `POST /api/finance-statements/packs/:id/report-section` ← `src/components/Finance/FinancialStatementPackWorkspace.tsx:657` | **TAK** — `CONCLUSION_LAYER_STANDARD.md` §3 W3 + 12 walidatorów §4.4 | T·T·T·T·T·T·T | **3** | niska; **jedyny konsument `validateConclusion` w całym repo** | — |
| 40 | **Ekstrakcja danych ze sprawozdań** | `server/src/services/openAIFinancialExtractionService.ts`, `llmFinancialMappingService.ts` | częściowo (schemat) | T·T·N·cz·N·cz·cz | **2** | mapowanie pozycji bez wymogu wskazania strony/wiersza źródła | F2 |
| 41 | **Doradztwo portfelowe / dźwignie scenariuszy** | `financePortfolioAdvisory.ts`, `financeScenarioLevers.ts`, `financeParameterGuidance.ts` | NIE | T·cz·N·T·cz·N·N | **1** | rekomendacja finansowa bez jawnych założeń (granica twarda §10.3) | F2 |

### 1H. Materiały — dokumenty, decki, arkusze, notatki, Idea

| # | narzędzie / miejsce | plik(i) : linia | spisany kontrakt? | 7 pól | ocena | ryzyko | pilność |
|---:|---|---|---|---|:--:|---|---|
| 42 | **Deck — pakiet treści z briefu** | `server/src/services/deckBriefContentPack.ts:74 buildSystemPrompt` ← `presentationGeneratorService.ts:1838` (ścieżka żywa, **bez flagi**) | **NIE** | T·T·cz·**N**·cz·N·cz | **1** | **prompt każe modelowi NIE mówić „brak danych" i zmyślać liczby ze znacznikiem „(założenie)"** — §3 R2, największe ryzyko reputacyjne w repo | **MVP** |
| 43 | **Deck — slajd konkluzji** | `server/src/services/deliverables/deckConclusionSlide.ts` (wzoruje się na `drdLlmNarrator`) | TAK (W5) | T·T·T·T·cz·cz·T | **2** | tytuły slajdów nie są walidowane jako zdania-tezy (`title_is_thesis` nie wołany) | F2 |
| 44 | **Deck — sędzia benchmarku** | `server/src/services/presentationBenchmarkJudgeService.ts:363` (skala 1–5, uzasadnienie per wymiar) | częściowo | T·T·T·cz·N·T·N | **2** | sędzia po angielsku, brak progu blokującego | F3 |
| 45 | **Dokument (Word) — generacja z czatu** | `server/src/services/deliverables/docGenerationRuntime.ts` `systemPromptBase` + `documentStudio/document*Generator.ts` (5 plików z promptem) | częściowo | T·T·cz·cz·T·cz·T | **2** | 5 osobnych promptów bez wspólnej doktryny; ratuje je `documentFabricationCheck` | F2 |
| 46 | **Dokument — kontrola fabrykacji** | `server/src/services/documentStudio/documentFabricationCheck.ts` ← `documentStudioService.ts:1479,3588` + `docGenerationRuntime.ts:28` | częściowo (deterministyczna) | —·—·—·T·—·T·— | **2** | sygnał doradczy, nie bramka | F2 |
| 47 | **Arkusz / Excel — generator 5-fazowy** | `server/src/services/workbook/WorkbookGeneratorService.ts` (`GENERATION_SYSTEM_PROMPT`) + testy `workbookGeneratorPromptContract.test.ts`, `excelDoctrineGate.test.ts` | **TAK** — `Harvard/wdrozenie-100/_DOKTRYNA_TRESCI_EXCEL_2026-07-27.md` §4.7 | T·T·T·T·cz·T·T | **3** | niska — **drugi wzorzec odniesienia** (doktryna + kontrakt promptu + bramka DX-01/DX-02 + test regresji 7 szablonów) | — |
| 48 | **Notatnik — analiza i tematy z notatki** | `server/src/routes/my-work/notebook.routes.ts:1641,1733` (prompty inline w trasie, PL/EN) | NIE | cz·T·N·N·T·N·cz | **1** | prompt konsultanta wpisany w router — nikt go nie recenzuje ani nie wersjonuje | F2 |
| 49 | **Idea / mapa myśli / process flow / whiteboard — generator** | `server/src/services/ideaAIGeneratorService.ts` (2558 l., **81 promptów inline**, 1 trafienie na wzorzec walidacji) ← `my-work.routes.ts:6566` | NIE | cz·T·N·N·T·N·cz | **1** | 81 osobnych osobowości AI w jednym pliku; „benchmarki branżowe" generowane bez źródła | F2 |
| 50 | **Idea — podpowiedzi** | `server/src/services/ideaAISuggestionsService.ts` (`responseLanguage` — jeden z **3** konsumentów w repo) | NIE | cz·T·N·N·T·N·cz | **1** | j.w. | F3 |
| 51 | **Tabela (Ideas) — edytor AI 8-poziomowy** | `server/src/services/tablePlatform/TableAiEditorLevels/*.ts` (cell·column·record·relational·source·structure·view·methodological) | częściowo | T·T·cz·cz·cz·cz·T | **2** | poziom `methodologicalLevel` podejmuje decyzje metodyczne bez spisanej doktryny | F2 |
| 52 | **Narzędzia Discovery (12) — prompty per narzędzie** | `src/hooks/discovery/toolAi/systemPrompts.ts:12 BASE_SYSTEM_PROMPT` + `promptRegistry.ts` (1570 l.) + `src/config/consultingToolsStandard.ts` | częściowo (standard narzędzi) | T·T·cz·cz·**cz**·N·T | **2** | „LANGUAGE: respond in the same language as the user's input" = heurystyka, nie reguła J1; zero walidacji wyjścia | F2 |

### 1I. Raporty

| # | narzędzie / miejsce | plik(i) : linia | spisany kontrakt? | 7 pól | ocena | ryzyko | pilność |
|---:|---|---|---|---|:--:|---|---|
| 53 | **Raport zarządczy — narracja AI** | `server/src/services/aiExecutiveReporting.ts:72` — prompt **po angielsku**, „2-3 sentence executive narrative", `maxTokens: 300`, `@ts-nocheck` | **NIE** | cz·N·N·N·**N**·N·N | **1** | **to jest „atrapa 3 slajdów", o której mówi właściciel** — raport dla zarządu = 3 zdania parafrazy, bez K2–K4, bez polskiego | **MVP** |
| 54 | **Report Builder — kompozycja raportu** | `server/src/services/reportBuilderService.ts` (3748 l., **0 promptów systemowych**) + `reportQualityGatesService.ts` | częściowo (bramki jakości struktury) | T·T·N·cz·cz·cz·T | **2** | bramki sprawdzają kompletność sekcji, nie jakość wniosku | F2 |
| 55 | **Raport audytu — ustalenia i wnioski** | `server/src/services/audits/aiProposalService.ts:354,524` (PL, zamknięty grounding, rozdział stan oczekiwany/stwierdzony/luka/dowody) | częściowo | T·T·T·T·T·cz·T | **2** | najlepszy prompt bez spisanego standardu obok — **kandydat na szybkie 3** | F2 |
| 56 | **Most wniosków (Ocena·Audyt·Narzędzie)** | `server/src/services/conclusions/{reportConclusionBridge,auditReportConclusionBridge,toolConclusionBridge}.ts` ← 3 trasy | częściowo | T·T·—·cz·cz·**N**·T | **2** | **żaden z 3 mostów nie woła `validateConclusion`** — §3 R5 | **MVP** |

### 1J. Teresa, spotkania, megatrendy

| # | narzędzie / miejsce | plik(i) : linia | spisany kontrakt? | 7 pól | ocena | ryzyko | pilność |
|---:|---|---|---|---|:--:|---|---|
| 57 | **Persona Teresy (8 modułów promptu)** | `server/src/ai/persona.ts` (900 l.): `buildCorePersona`·`buildResponseDiscipline`·`buildConsultingFrameworks`·`buildChallengeInstructions`·`buildCitationInstructions`·`buildArtifactInstructions`·`buildAgencyModel`·`buildResponseStyleDirective` | częściowo — indeks `server/src/ai/promptRegistry.ts`, **bez `resolve`/`checksum`** | T·T·T·T·T·N·cz | **2** | fundament wszystkich rozmów, `lastReviewed` = 2026-06-01/07-03 (3 mies.), zero kontroli dryfu | F2 |
| 58 | **Klasyfikator intencji Teresy** | `server/src/services/v8/teresaCopilotService.ts:938 INTENT_SYSTEM_PROMPT` (EN) | NIE | T·T·—·—·N·cz·— | **2** | złe skierowanie = Teresa odpowiada o innym module | F3 |
| 59 | **Rejestr promptów (indeks)** | `server/src/ai/promptRegistry.ts` — 20 wpisów, **2 z checksumem**, reszta „pointer-only" | częściowo | —·—·—·—·—·cz·— | **2** | 18 z 20 promptów nie ma wykrywania dryfu; nie obejmuje ~35 miejsc z tej tabeli | F2 |
| 60 | **Spotkania — notatki i zadania z transkryptu** | `server/src/services/ai/meetingIntelligenceService.ts:112` („senior executive assistant", EN) za `requireInternalToolsAccess` = **OFF** | NIE | T·T·N·N·N·N·cz | **1** | zadania z notatek bez właściciela i bez rodowodu cytatu | F3 |
| 61 | **Megatrendy / Radar — interpretacja sygnału** | `server/src/services/radar/radarInsightService.ts:155/170` + `insightSchema` (zod), `radarLocalizationService.ts` | częściowo | T·T·cz·cz·T·cz·cz | **2** | „suggestedNextStep" bez związku z danymi organizacji | F3 |
| 62 | **Czat — artefakty z rozmowy** | `server/src/services/deliverables/docGenerationRuntime.ts` `generate_deliverable`, `persona-artifacts` | częściowo | T·T·cz·cz·T·cz·T | **2** | artefakt z czatu omija kontrakty modułowe (osobna ścieżka do tych samych typów) | F2 |

> **Uwaga o numeracji:** wiersze 1–62 z lukami numeracyjnymi w obrębie sekcji — **42 unikalne
> miejsca** po scaleniu wierszy, które opisują to samo źródło promptu z dwóch stron
> (np. 4+5, 35+36+37 liczone jako trzy osobne, bo to trzy osobne ekrany klienta).
> Liczba wiodąca §0 (42) = liczba **miejsc, w których model albo szablon produkuje treść
> merytoryczną widzianą przez klienta**; wiersze 18, 19, 46, 56, 59 to warstwy sterujące,
> liczone raz.

---

## 1K. Dziesięć najgroźniejszych luk — uszeregowane tym, co zobaczy klient

| # | co klient może zobaczyć | miejsce | wiersz | ocena |
|---:|---|---|---:|:--:|
| 1 | **Deck dla zarządu z wymyślonymi liczbami** — prompt wprost zakazuje modelowi powiedzieć „brak danych" | `deckBriefContentPack.ts:81` | 42 | 1 |
| 2 | **„Teresa" pisze instrukcję obsługi zamiast analizy przyczyny odchylenia KPI** | `kpiTeresaRcaDraft.ts` | 36 | 0 |
| 3 | **To samo w refleksji OKR i we wnioskach PIR (ROI)** | `okrTeresaReflectionDraft.ts:113`, `roiTeresaLessonsDraft.ts:87` | 35, 37 | 0 |
| 4 | **Raport zarządczy = 3 zdania parafrazy po angielsku**, bez „co to znaczy / co robić / jaki efekt" | `aiExecutiveReporting.ts:72` | 53 | 1 |
| 5 | **Wnioski z wywiadu z angielskimi nagłówkami w polskim UI** („Executive Summary", „Main Themes") | `InterviewInsightService.ts:683` | 20 | 2 |
| 6 | **Inicjatywa bez KPI, bez RAID i po angielsku przechodzi bramkę** (6 reguł blokujących z ~30, do tego fail-open) | `cardContentFormulaValidator.ts:1243`, `createInitiativeService.ts:287` | 31 | 2 |
| 7 | **Portfel inicjatyw = same liczby**, zero zdania „co z tego wynika" — anty-wzorzec „semaforek" | `portfolioAnalysisService.ts` | 29 | 1 |
| 8 | **„Teresa — rollout at risk" otwiera puste okno czatu** zamiast analizy tygodnia | `RolloutTab.tsx:1005` | 32 | 0 |
| 9 | **Deck, dokument, arkusz i raport zarządczy oceniane jednym generycznym zdaniem** („kompletność strukturalna") | `cardAnalysisRubric.ts:86` (21 z 37 typów) | 17 | 1 |
| 10 | **Karta planu i analizy obciążenia: zero kryteriów, zero katalogu** — „Pracuj z AI" bez rubryki | `cardAnalysisRubric.ts:176-177` | 10, 11 | 0 |

---

## 2. Osiem najważniejszych — zbieżność kontrakt ↔ kod ↔ ekran

| # | rodzina | co mówi kontrakt | co robi prompt/kod | co widzi ekran | werdykt |
|---:|---|---|---|---|---|
| 1 | **Karty N** | `KARTA_N_KONTRAKT.md` K21: „Pracuj z AI" z 3 pozycjami w KAŻDEJ karcie; K24: tabela „co AI może uzupełnić" per typ | `PracujZAI.tsx` w **19 ekranach** (było 9/22); rubryka: 14 typów ma własne kryteria, **21 dostaje jedno generyczne zdanie**, 2 mają `[]` | przycisk jest, lista trzech pozycji jest | **powłoka nadrobiona, treść nie** — K24 wciąż niewypełnione dla 23 z 37 typów |
| 2 | **Wnioski z wywiadu** | `CARD_CONTENT_FORMULA` §A2 + `ZASADY_AI_TERESA_SSOT` J1 („polski domyślny") | doktryna BCG + kontrakt P10 (confidence/limits/evidence_refs) **w całości po angielsku**; `grep -i "language\|'pl'"` w `InterviewInsightService.ts` = **1 trafienie** (i to fraza w promptcie) | polski UI, treść z angielskimi nagłówkami sekcji | **ROZJAZD** — najlepszy kontrakt jakości bez reguły języka |
| 3 | **Raport oceny (DRD)** | `CONCLUSION_LAYER_STANDARD` §4.2 szkielet promptu 1:1 | `drdLlmNarrator.ts:274` = **dosłowna implementacja** szkieletu + `validateNumbersFromEngine` | trasa `assessment-reports.routes.ts:1136` przekazuje `llm`, wynik `narrative: 'llm'\|'deterministic'` | **ZGODNE — wzorzec** |
| 4 | **Portfel inicjatyw** | `CONCLUSION_LAYER_STANDARD` §6 P1: „wskaźnik w normie" nie jest wnioskiem | `portfolioAnalysisService.ts` — 587 linii arytmetyki, **zero wywołań LLM** | liczby i wykresy portfela | **ROZJAZD** — klient dostaje dokładnie to, czego standard zakazuje |
| 5 | **Analiza tygodnia (Realizacja)** | `KONTRAKTY_NARZEDZI_AI.md` moduł 06: „wyjaśnia odchylenie · proponuje kartę działania" = **DZIAŁA** | `RolloutTab.tsx:1005` — `Callout` z przyciskiem otwierającym **ogólny czat**; brak serwisu analizy | baner „Teresa — rollout at risk" + „Review now" | **ROZJAZD** — „DZIAŁA" opisuje istnienie przycisku, nie pracę |
| 6 | **KPI / OKR / ROI (Wyniki)** | `ZASADY_AI_TERESA_SSOT` moduł 09: „proponuje przyczynę · szkicuje definicję miernika" = **DZIAŁA** | `kpiTeresaRcaDraft.ts` / `okrTeresaReflectionDraft.ts` / `roiTeresaLessonsDraft.ts` — **0 trafień `llm\|fetch\|Api.`**; treść = stały łańcuch znaków | panel „Teresa przygotowuje propozycję…", potem tekst: „Ten tekst jest WYŁĄCZNIE propozycją: skopiuj go… popraw treść i uzupełnij pola…" | **NAJCIĘŻSZY ROZJAZD** — pełny ład (propose/approve/execute/audit) wokół pustej treści |
| 7 | **Deck (prezentacje)** | `ZASADY_AI_TERESA_SSOT` Z3: „brak danych = «—», nigdy zdanie wymyślone"; `CONCLUSION_LAYER` §4.2: „liczby WYŁĄCZNIE z facts" | `deckBriefContentPack.ts:81`: *„Do NOT reply «insufficient data» / «brak danych» … write concrete content grounded in domain knowledge"*, liczby ze znacznikiem „(założenie)" | deck z konkretnymi procentami i kwotami, nadpisujący placeholdery „evidence required" | **SPRZECZNOŚĆ WPROST** — kod instruuje model, żeby złamał granicę twardą nr 1 |
| 8 | **Teresa (persona + ład)** | `ZASADY_AI_TERESA_SSOT` R1–R5, §3 klasy akcji, §5 ślad | `persona.ts` (8 modułów, zgodny) + `teresaCopilotService.ts` (`resolveEffectiveAccess` ×8, propose/approve/execute rozdzielone) | dok w Menu 1, `TeresaEntryButton` w 2 modułach | **ZGODNE w ładzie**, luka w nośniku wejścia (C7 z SSOT wciąż otwarte) |

---

## 3. Pięć największych rozjazdów kontrakt ↔ kod ↔ ekran

**R1 — Wyniki: pełny ład wokół pustej treści (ocena 0 ×3).**
`src/components/ResultsVNext/{kpiTool/kpiTeresaRcaDraft.ts, okr/okrTeresaReflectionDraft.ts,
roi/roiTeresaLessonsDraft.ts}` nie mają ani jednego wywołania LLM ani API. Tekst „szkicu Teresy"
to literał (`okrTeresaReflectionDraft.ts:113`), który brzmi: *„Ten tekst jest WYŁĄCZNIE propozycją:
skopiuj go … popraw treść i uzupełnij pola Co zadziałało / Co nie zadziałało / Dlaczego …"*.
Ekran prowadzi pełny, audytowany cykl P08 (propose → approve → execute → undo) wokół tej treści.
`KONTRAKTY_NARZEDZI_AI.md` klasyfikuje moduł 09 jako **DZIAŁA**. Klient klika „Teresa" i dostaje
instrukcję obsługi zamiast analizy. *(11. kształt fałszywego „gotowe" w czystej postaci: zbudowane,
zamontowane, audytowane — bez zawartości.)*

**R2 — Deck: kod każe modelowi złamać granicę twardą.**
`deckBriefContentPack.ts:81` (ścieżka żywa, `presentationGeneratorService.ts:1838`, bez flagi):
*„There is NO attached data source. Do NOT reply «insufficient data» / «brak danych» … and do NOT
produce placeholders — instead write concrete, decision-oriented consulting content grounded in the
topic"*, plus instrukcja oznaczania zmyślonych liczb „(założenie)" **inline w nawiasie**, z jawnym
zakazem prefiksowania całego zdania. To jest wprost sprzeczne z `ZASADY_AI_TERESA_SSOT` §10.1
(„Nie fabrykuje danych") i Z3, oraz z `CONCLUSION_LAYER_STANDARD` §4.2. Pakiet **nadpisuje**
placeholdery „evidence required" wygenerowane przez uczciwszą ścieżkę. Najwyższe ryzyko
reputacyjne w repo: deck z wymyślonymi liczbami idzie na zarząd klienta.

**R3 — Najsilniejsza bramka blokuje na 6 regułach z ~30.**
`cardContentFormulaValidator.ts:1243 CARD_GATE_BLOCKING_CODES` = `{insight.title_present,
insight.summary_present, insight.material_quality_complete, insight.no_filler,
initiative.title_present, initiative.no_filler}`. Komentarz `:1239` przyznaje wprost, że
`initiative.kpi_baseline_target`, `initiative.raid_mix`, `hypothesis_format` i `*.lang_pl`
**pozostają doradcze**. Do tego `createInitiativeService.ts:287` jest **fail-open**: wyjątek
walidatora → karta przechodzi. Efekt: `CARD_CONTENT_FORMULA` §A4 mówi „karta wraca z listą braków
poniżej 90/100", a runtime przepuszcza inicjatywę bez KPI, bez RAID i po angielsku.

**R4 — Reguła języka J1 ma 3 konsumentów.**
`server/src/services/ai/responseLanguage.ts` jest importowany przez **3** pliki produkcyjne
(`EventDerivedOutputBridge.ts`, `my-work.routes.ts`, `ideaAIGeneratorService.ts`,
`ideaAISuggestionsService.ts`). Reszta rozwiązuje język ad hoc (`isPl`/`isPolish` lokalnie) albo
wcale — `InterviewInsightService.ts` (3393 l., generator wszystkich wniosków) nie ma ani jednego
odwołania do języka, `aiExecutiveReporting.ts` i `meetingIntelligenceService.ts` mają prompt
wyłącznie po angielsku. To ta sama rodzina defektu co „klucz istnieje ≠ przetłumaczony", tylko
piętro wyżej: **reguła istnieje ≠ wołana**.

**R5 — 12 walidatorów wniosku ma jednego konsumenta.**
`CONCLUSION_LAYER_STANDARD.md` deklaruje zakres: *„KAŻDA powierzchnia, która prezentuje wynik
analityczny"*. `server/src/services/conclusionValidators.ts` implementuje komplet §4.4
(`validateNumbersFromEngine`, `k_complete`, `k3_max3`, `k4_horizon`, `evidence_link`,
`confidence_honest`, `no_filler`, `len_limits`, `lang`, `title_is_thesis`, …).
`grep` konsumentów poza katalogiem `conclusions/`: **jeden** —
`financeReportConclusion.ts:224`. Trzy mosty wniosków (`reportConclusionBridge`,
`auditReportConclusionBridge`, `toolConclusionBridge`), realnie podpięte do tras
(`assessment-reports.routes.ts:1157`, `audits/reports.routes.ts:19`, `ToolController.ts:19`),
**nie wołają go wcale**. Biblioteka istnieje, standard istnieje, egzekucja jest w 1/4 miejsc.

---

## 4. Wzorzec kontraktu pracy konsultanta (propozycja jednolitego szablonu)

**Podstawa:** `docs/standards/CONCLUSION_LAYER_STANDARD.md` §4 (najlepszy istniejący przykład —
kontrakt „prompt-ready" z walidatorami), zrealizowany 1:1 w `server/src/services/report/
drdLlmNarrator.ts` i drugi raz, w innym medium, w `Harvard/wdrozenie-100/
_DOKTRYNA_TRESCI_EXCEL_2026-07-27.md` + `WorkbookGeneratorService.ts`.
Poniższy szablon = uogólnienie tych dwóch, uzupełnione o to, czego oba nie mają:
akcept człowieka i test kontraktowy.

Proponowana nazwa gatunku: **KONTRAKT PRACY (KP)**, jeden plik na rodzinę,
`docs/ssot/kontrakty-pracy/KP-<rodzina>.md`, z obowiązkowym bliźniakiem w kodzie
(`server/src/contracts/kp/<rodzina>.ts`) i jednym testem kontraktowym.

```
# KP-<RODZINA> — kontrakt pracy konsultanta
id: kp-<rodzina>            wersja: <semver>       checksum promptu: sha256:…
właściciel treści: <rola>   ostatni przegląd: <data>   status: PROJEKT | OBOWIĄZUJĄCY

§1 CEL — jedno zdanie: co klient ma dostać i jaką decyzję ma dzięki temu podjąć.
   Test: usuń ten wynik z produktu — co klient traci? Jeśli „nic" — kontrakt jest zbędny.

§2 ROLA I STANDARD BRANŻOWY — kim jest autor (partner firmy doradczej / analityk PE /
   audytor wiodący) i wg jakiej metodyki pracuje (Minto · MECE · issue tree · K1→K4 ·
   5 faz modelu finansowego). Zakaz „jesteś pomocnym asystentem".
   Miara nadrzędna (z CONCLUSION_LAYER §0): „czy podpisałby to własnym nazwiskiem
   przed zarządem klienta".

§3 WEJŚCIE — dokładna lista, co wolno podać modelowi i skąd to pochodzi:
   facts   — liczby WYŁĄCZNIE z silnika/bazy, nigdy z modelu (nazwa pola : serwis : linia)
   org     — profil organizacji: branża, wielkość, cele, ograniczenia, słownik klienta
   canon   — kanon metodyki modułu, jeśli istnieje (skala, poziomy, graf zależności)
   module  — dane modułu w zasięgu uprawnień użytkownika (U1/U2)
   Bramka wejścia: brak kompletu = generacja się NIE zaczyna (CARD_CONTENT_FORMULA §B2).

§4 WYJŚCIE — struktura i długość, jako schemat maszynowy (zod/JSON), nie jako opis:
   pola obowiązkowe · pola warunkowe z regułą pustki („— Pominięto: <powód>")
   minima i maksima ilościowe per pole (liczba pozycji, zakres słów)
   „renderer składa dokument, model nie formatuje" — zero markdown w polach treści.

§5 ZASADY I LISTA KONTROLNA JAKOŚCI — reguły, które przekładają się na walidator:
   answer-first · zakaz ogólnika pasującego do każdej firmy · falsyfikowalność ·
   kwantyfikacja z jawnym założeniem · uczciwa niepewność · MECE · zero wypełniaczy.
   Każda reguła ma numer i anty-wzorzec (przykład FAIL), żeby recenzent nie interpretował.

§6 ŹRÓDŁA I „DLACZEGO" — każda teza wskazuje dowód (`factRefs[]` / `evidence_refs[]`);
   „high confidence" wymaga triangulacji z 2+ źródeł; brak danych → „do ustalenia
   (gdzie/kiedy)", nigdy liczba. Grounding ZAMKNIĘTY: nic spoza §3.
   Zakaz „badań branżowych" i statystyk spoza wsadu — wprost w treści promptu.

§7 JĘZYK — jeden mechanizm dla całej aplikacji (`services/ai/responseLanguage.ts`),
   nie lokalne `isPl`. Polski domyślny; słownik terminów nietłumaczonych przez odwołanie
   do CARD_CONTENT_FORMULA §A5; kontrola sprawdza TREŚĆ, nie obecność klucza.

§8 WALIDACJA AUTOMATYCZNA — tabela `walidator | warunek | twardy/doradczy`.
   Minimum obowiązkowe dla każdej rodziny: numbers_from_engine · evidence_link ·
   no_filler · lang · struktura wg §4. Twardy = blokuje publikację, nie tylko loguje.
   Po porażce: JEDNA pętla auto-naprawy z listą braków (wzór:
   `insightMaterializationService.ts:571`), potem odmowa z czytelnym powodem.

§9 ŚLAD AKCEPTU CZŁOWIEKA — propozycja → podgląd → „Zatwierdź" → Historia + Cofnij.
   Zero auto-zapisu (ZASADY_AI_TERESA §3 klasa „NIGDY").
   Pola wypełnione przez człowieka są pomijane i widać to jako wiersz „pominięto".
   Wpis w `ai_run_ledger`: kto, co, na jakiej podstawie, model/wersja, wynik.

§10 TESTY KONTRAKTOWE (bez LLM, deterministyczne — wzór:
   `workbook/__tests__/workbookGeneratorPromptContract.test.ts`):
   T1 prompt zawiera reguły §5 i §6 dosłownie (assert na źródle promptu);
   T2 wyjście niezgodne ze schematem §4 → odrzucone;
   T3 liczba spoza `facts` → `numbers_from_engine` FAIL;
   T4 teza bez `factRefs` → `evidence_link` FAIL;
   T5 mutacja usuwająca warunek „Zatwierdź" → test pada (§9);
   T6 checksum promptu = wartość z nagłówka (wykrywanie dryfu — mechanizm istnieje:
      `server/src/ai/promptRegistry.ts:verifyPromptChecksum`, dziś użyty 2×).

§11 ODBIÓR — jeden zrzut z realnej trasy i realnego rekordu (nie harness), po polsku,
   z rozwiniętymi sekcjami; akcept właściciela zapisany w rejestrze.
```

**Co ten szablon zmienia względem dzisiejszego stanu:** dziś najlepsze miejsca mają §2–§6
(doktryna w promptcie), ale §7–§10 są rozproszone albo puste. Najsłabsze mają tylko §2
(„You are a senior consultant") i nic więcej. Szablon wymusza, żeby **każda rodzina miała
komplet albo jawny wpis „nie dotyczy, bo …"**.

---

## 5. Plan etapu 2 (dla Codexa)

**Zasada kolejności:** najpierw to, co klient zobaczy w pilotażu na demo i co dziś jest
**puste albo sprzeczne**, potem to, co jest słabe. Rodziny z oceną 3 nie są ruszane —
są materiałem źródłowym dla szablonu.

### Fala 1 — MVP/pilotaż (7 paczek, ~9 dni)

| # | paczka | co robi | dni | zmiany UI? |
|---:|---|---|---:|---|
| P1 | **Deck — usuń instrukcję fabrykacji** | `deckBriefContentPack.ts:81` — zamień „do NOT reply «brak danych»" na regułę §6 (grounding zamknięty, brak danych → „do ustalenia"); zostaw znacznik „(założenie)" wyłącznie dla wartości z jawnym założeniem w briefie; test T3 | 1 | **NIE** |
| P2 | **Wyniki — treść zamiast szablonu** | KP-WYNIKI (KPI RCA · OKR reflection · ROI PIR): prawdziwy generator serwerowy na istniejącym pipeline P08, `facts` z danych okresu, walidatory K1–K4; trzy pliki `*TeresaDraft.ts` przestają być literałami | 3 | **NIE** (panel bez zmian) |
| P3 | **Raport zarządczy — z 3 zdań na wniosek** | KP-RAPORT-ZARZ.: `aiExecutiveReporting.ts` na szkielet `CONCLUSION_LAYER` §4.2 (K1→K4, PL, `factRefs`), zdjęcie `@ts-nocheck`, `validateConclusion` przed zapisem | 1,5 | **NIE** |
| P4 | **Język — jedna reguła zamiast 40 lokalnych** | `responseLanguage.ts` jako jedyne wejście; podłączyć `InterviewInsightService`, `aiExecutiveReporting`, `meetingIntelligenceService`, `deckBriefContentPack`; przetłumaczyć `BCG_P10_PROMPT_DOCTRINE` + `PROMPT_TEMPLATES_BASE` na parę PL/EN | 1,5 | **NIE** |
| P5 | **Mosty wniosków → walidator** | `reportConclusionBridge`, `auditReportConclusionBridge`, `toolConclusionBridge` wołają `validateConclusion` (najpierw doradczo z logiem, po 1 tygodniu twardo) | 1 | **NIE** |
| P6 | **Realizacja — analiza tygodnia** | KP-REALIZACJA: serwis analizy odchylenia (wejście: plan + KPI wykonania + ryzyka) zamiast `Callout` z linkiem do czatu | 1 | **TAK — mały** (miejsce na wynik) |
| P7 | **Rubryka 21 typów** | `cardAnalysisRubric.ts`: rozbić `STRUCTURAL_COMPLETENESS` na kryteria per rodzina (deck · dokument · arkusz · raport · KPI/OKR/ROI · finanse · realizacja); wypełnić tabelę K24 dla 23 brakujących typów | 2 | **NIE** |

### Fala 2 — F2 (6 paczek, ~8 dni)

| # | paczka | dni | UI? |
|---:|---|---:|---|
| P8 | **Bramka karty — poszerzyć listę blokującą** (`kpi_baseline_target`, `raid_mix`, `hypothesis_format`, `lang_pl` z doradczych na twarde; usunąć fail-open) | 1,5 | NIE |
| P9 | **KP-PORTFEL**: warstwa wniosku nad `portfolioAnalysisService` (liczby zostają, dochodzi K2–K4) | 1,5 | TAK — mały |
| P10 | **KP-AUDYT**: spisać standard obok najlepszego promptu (`aiProposalService.ts:524`) i dodać walidatory + test — najtańsze podniesienie 2→3 | 1 | NIE |
| P11 | **KP-DOKUMENT**: jedna doktryna dla 5 promptów Document Studio; `documentFabricationCheck` z doradczego na bramkę | 1,5 | NIE |
| P12 | **KP-IDEA**: konsolidacja 81 promptów `ideaAIGeneratorService.ts` do rejestru z wersjonowaniem; zakaz „benchmarków" bez źródła | 1,5 | NIE |
| P13 | **Rejestr promptów — dryf**: `resolve`+`checksum` dla wszystkich promptów rodzin KP; `verifyAllPromptChecksums` w CI | 1 | NIE |

### Fala 3 — F3 (~4 dni)
Spotkania · Megatrendy/Radar · Tabela (poziom metodyczny) · Sędziowie benchmarku ·
karta `capacity_analysis` · karta `interview`.

**Suma etapu 2: ~21 dni roboczych. 17 z 19 paczek nie dotyka UI** — to jest praca
kontraktowo-serwerowa, którą można prowadzić bez procedury odbioru wizualnego
(P6 i P9 wymagają jednego zrzutu każda).

**Kolejność wydawania robotnikom:** P1 → P4 → P5 (trzy najtańsze, każda zamyka sprzeczność,
nie dodaje funkcji) → P3 → P2 → P7 → P6 → fala 2.
Każda paczka: świeża gałąź z `origin/demo`, worktree, commit per krok, bez push.

---

## 6. Czego NIE zmierzyłem (uczciwie)

1. **Żywego runtime.** Wszystko powyżej pochodzi ze statycznego odczytu kodu i dokumentów
   w worktree `kandydat-20260913`. Nie uruchamiałem serwera, nie pytałem bazy demo ani
   stagingu. Flagi ocenione z kodu (`ENABLE_V8_GLOBAL`, `requireInternalToolsAccess`,
   `drdHttpSourceOfTruth`) mogą mieć inne wartości na środowisku — to trzeba sprawdzić
   na żywo przed każdą paczką dotykającą modułu za flagą.
2. **Promptów trzymanych w bazie.** `initiative_section_types.ai_prompt_template`
   (migracje 529/530/539–542) to realna treść promptów per typ sekcji inicjatywy, której
   **nie widziałem** — jest w bazie, nie w repo. Wiersz 3 inwentarza oceniłem na 1 na
   podstawie braku kontraktu wokół niej, nie na podstawie jej treści. To może być
   niedoszacowanie albo przeszacowanie.
3. **V8 Prompt OS.** `server/src/services/v8/promptOsRuntimeService.ts` (presety, bundle
   wydań, canary, bramki ewaluacyjne) to osobna warstwa ładu promptów, którą
   `promptRegistry.ts` jawnie wskazuje jako „governed elsewhere". Nie audytowałem jej —
   jeśli działa, część paczki P13 może być zbędna.
4. **Jakości wyjścia.** Nie uruchomiłem ani jednej generacji. Oceny 0–3 mierzą
   **istnienie i egzekwowalność kontraktu**, nie to, czy model faktycznie pisze dobrze.
   Miejsce z oceną 1 może produkować przyzwoity tekst, a miejsce z oceną 3 słaby —
   pomiar jakości to `consultify-test` i panel adwersaryjny, osobna robota.
5. **Ekranów.** Zbieżność „kontrakt ↔ kod ↔ ekran" (§2) sprawdzałem przez czytanie
   komponentów i tras, **nie przez zrzuty**. Twierdzenia o tym, co widzi klient
   (zwłaszcza wiersze 35–37 i 42), są wnioskiem z kodu i wymagają potwierdzenia okiem
   przed pokazaniem właścicielowi.
6. **Kompletności inwentarza.** 42 miejsca to wynik greptowania po `server/src`
   (`systemPrompt|buildPrompt|You are|Jesteś|role: 'system'`) i po katalogach kontraktów.
   `grep` zliczył **145 wywołań LLM** w `server/src/services` — część z nich to warstwy
   pomocnicze (memory, routing, klasyfikacja), ale **nie wykluczam, że ~5–10 miejsc
   produkujących treść dla klienta umknęło**, zwłaszcza w `server/src/routes/*` z promptem
   inline (wzór: `notebook.routes.ts:1641`). Pierwsza czynność etapu 2 powinna być
   domknięciem inwentarza tym jednym wzorcem: prompt w routerze.
