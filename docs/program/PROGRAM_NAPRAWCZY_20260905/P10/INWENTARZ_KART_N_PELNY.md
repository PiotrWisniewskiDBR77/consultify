# P10-I — pełny inwentarz kart N (DEC-430)

Punkt kodu: gałąź `mvp/p10i-inwentarz-kart-n` z bazy `codex/m03-admin-20260824`,
HEAD `f9184a1f3f`. Pomiar 06.09.2026, wyłącznie z kodu (grep + odczyt plików),
zero zrzutów, zero zmian w produkcie.

## 0. Po co ten dokument i jak liczyłem

Właściciel 06.09 (DEC-430): *„tych kart we wszystkich artefaktach jest więcej niż
21. 21 to może być w inicjatywie, ale jeśli policzysz wszystkie inne narzędzia,
które mają N-type karty, może ich być 140. Wszystkie musimy przeanalizować
i opisać dla nich kontrakty."*

Definicja karty N (`Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` §13,
`_SPEC_N_KARTY_2026-07-21.md`): **ekran-obiekt otwierany z tożsamością**
(trasa z `:id`, `?artifact=`/`?open=`, albo pełny widok po wybraniu wiersza
z listy) — nie lista i nie sam panel podglądu. Archetypy: **A** Canvas ·
**B** Dokument · **C** Rekord · **D** Matryca · **E** Deck.

Cztery metody pomiaru (wszystkie przeprowadzone, potem scalone i zdeduplikowane):

| # | metoda | co dała |
|---|---|---|
| 1 | trasy `src/routes/AppRoutes.tsx` + `src/routes/routeConfig.ts` z `:id`/`:xxxId`, plus `getArtifactPath` (`src/utils/artifactLinks.ts:336`) i `ARTIFACT_IDENTITY` (`:63`) | **44** unikalne wzorce tras z parametrem (w tym publiczne `:token`/`:slug`); **28** zadeklarowanych typów artefaktu |
| 2 | konsumenci powłok (pliki `src/`, bez `__tests__`): `StandardArtifactShell` **16**, `NModeShell` **39**, `ExecutiveModuleShell` **43**, `ArtifactRightPanel` **61**, `KartaWynikowChrome` **4**, `useJedenPanel`/`JedenPrawyPanel` **29** (to podglądy list, nie karty) | po odsianiu plików wewnętrznych powłok i paneli: **29** kart na powłoce standardu |
| 3 | harness `dev-render/main.tsx` — ekrany `karta-*` | **14** ekranów (`karta-tool` … `karta-task-pelna`, linie 1226–1305) |
| 4 | rejestr `src/components/standard/registry.ts` + `registry.kompletnosc.test.ts` + `cardAnalysisRubric.ts` + `P10/00_INWENTARZ.md` | 13 w rejestrze + 9 jawnych wyjątków = 22 |

**Dwie liczby, obie prawdziwe — nie mieszać:**

* **72 TYPY kart** = 72 różne ekrany-obiekty w kodzie (72 kontrakty do napisania).
* **≈140 EGZEMPLARZY w bibliotece** = te 72 typy rozmnożone przez katalogi:
  31 narzędzi × 2 karty (biblioteka + dokument sesji) i 5 metodyk oceny × 2
  (sesja + raport). Rachunek w §5 — i to jest dokładnie liczba właściciela.

## 1. Liczba per moduł

Nazwy modułów wg `docs/program/MVP_FINAL_ZAMROZONE.json`. „Wyniki", „Finanse",
„Wnioski" i „Zlecenia" nie mają własnego klucza w tym pliku — wpisane pod nazwą
z menu, z adnotacją.

| moduł | kart (typów) | egz. w bibliotece | w rejestrze `registry.ts` | kontrakt w kodzie | „Pracuj z AI" | archetypy |
|---|---:|---:|---:|---:|---:|---|
| 07_MY_WORK_AGENT — Moja praca / Agent | 10 | 10 | 4 (`task`,`decision`,`notification`,`action`) | 3 | 3 | C×4, B×1, A×3, D×1, C(S)×1 |
| 02_INTERVIEW — Wywiad | 3 | 3 | 2 (`interview`,`insight`) | 2 | 1 | D×2, B×1 |
| 03_TOOLS — Narzędzia | 7 | **67** | 1 (`tool`) | 1 | 1 | C×2, B×3, A×1, D×1 |
| 04_ASSESSMENT — Ocena | 7 | **15** | 0 | 0 | 1 | D×3, B×3, E×1 |
| 05_INITIATIVES — Inicjatywy | 3 | 3 | 3 (`initiative`,`plan`,`capacity_analysis`) | 1 | 1 | C×3 |
| 06_EXECUTION — Realizacja | 6 | 6 | 0 | 0 | 0 | B×5, C×1 |
| Wyniki (P7K; poza kluczami MVP) | 8 | 8 | 3 (`metric`,`objective`,`roi_case`) | 2 | 3 | C×4, D×4 |
| Finanse (poza MVP, DEC-2026-08-28-177) | 7 | 7 | 0 | 0 | 0 | D×6, C×1 |
| 11_MATERIALS — Materiały (+ Prezentacje) | 12 | 12 | 0 | 0 | 0 | B×6, D×3, E×3 |
| 12_AUDITS — Audyty | 3 | 3 | 0 | 0 | 0 | C×2, B×1 |
| 08_MEETINGS — Spotkania | 1 | 1 | 0 | 0 | 0 | C×1 |
| 01_ORGANIZATION — Organizacja | 1 | 1 | 0 | 0 | 0 | D×1 |
| 13_CHAT — Czat | 2 | 2 | 0 | 0 | 0 | B×1, A×1 |
| Wnioski (`/conclusions`, poza menu 16) | 1 | 1 | 0 | 0 | 0 | B×1 |
| Zlecenia (`/zlecenia`, podwójna bramka OFF) | 1 | 1 | 0 | 0 | 0 | C×1 |
| **RAZEM** | **72** | **140** | **13** | **9** | **10** | — |

Kolumny liczbowe — dowód:

* **w rejestrze** = 13 kluczy `KartaNKey` (`src/components/standard/registry.ts:32`–`52`).
* **kontrakt w kodzie** = 7 plików z deskryptorami `KanonicznaKarta`
  (`toolCards.contract.ts`, `initiativeCardContract.ts`, `insightCardContract.ts`,
  `interviewCardContract.ts`, `decisionCardContract.ts`, `notificationCardContract.ts`,
  `taskCardContract.ts`) + 3 pliki sekcji Wyników (`OkrObjectiveCardSections.ts`,
  `RoiCaseCardSections.ts`, `RoiCardSections.tsx`) — te trzy pliki opisują DWIE
  karty (`objective`, `roi_case`), więc kart z kontraktem jest **9 z 72**.
* **„Pracuj z AI"** = 10 wystąpień `<PracujZAI` w `src/` (lista w §2, kolumna AI).
* **„Analizuj z AI"** (`useCardAIAnalysis`) = 10 kart; suma kart z JAKIMKOLWIEK
  silnikiem AI = **11** (część wspólna = 9).

## 2. Pełna lista kart (72 pozycje)

Legenda kolumny „AI": `P` = „Pracuj z AI" (`<PracujZAI`), `A` = „Analizuj z AI"
(`useCardAIAnalysis` + `NCardAIAnalysisPanel`), `—` = brak.
Kolumna „Teresa poza Menu 1": czy karta osadza własne wejście do Teresy wbrew
DEC-404/DEC-419 (jedyne wejście ma być w Menu 1).

### 07_MY_WORK_AGENT — Moja praca / Agent

| # | id-slug | nazwa PL | arch. | otwarcie (z jakiej listy) | komponent (plik:linia) | powłoka | kontrakt | AI | Teresa poza Menu 1 | uwagi |
|---:|---|---|:--:|---|---|---|---|:--:|:--:|---|
| 1 | `task` | Zadanie | C | `/my-work` → Zadania → wiersz → „Otwórz" | `src/components/MyWork/TaskDetailView.tsx:464` (9015 linii) | `StandardArtifactShell` | `src/components/MyWork/taskCardContract.ts` (import l.162) | P:5876 A:5254 | nie | rejestr `task`, klasa L (korekta K1) |
| 2 | `decision` | Decyzja | C | `/my-work` → Decyzje → wiersz → „Otwórz" | `src/components/MyWork/DecisionDetailView.tsx:1160` (10003) | `StandardArtifactShell` | `decisionCardContract.ts` (l.134) | P:6317 A:6083 | nie | rejestr `decision` |
| 3 | `notification` | Powiadomienie | C | `/my-work` → Skrzynka → wiersz → „Otwórz" | `src/components/MyWork/NotificationDetailView.tsx:300` (4059) | `NModeShell` (surowy) | `notificationCardContract.ts` (l.100) | P:3299 A:2464 | nie | rejestr `notification`, `statusMigracji: 'przed'` |
| 4 | `note` | Notatka (strona notatnika) | B | `/my-work` → Notatnik → strona | `src/components/MyWork/NotebookContent.tsx:732` (4399) | brak (własny rail `notebook/NotebookRightRail.tsx`) | brak | — | nie (DEC-404 wykonane, l.177) | wyjątek rejestru |
| 5 | `idea-mindmap` | Mapa myśli | A | `/my-work` → Pomysły → pomysł → narzędzie „mindmap" | `src/components/MyWork/IdeaMapWorkspace.tsx:357` + `mindmap/` | `ExecutiveModuleShell` | brak | — | **tak** — `<IdeaTeresaSection>` w `IdeaMapWorkspace.tsx:5507` | jedna powłoka, cztery centra (`CanvasToolType`, `ideaSelectionTypes.ts:8`) |
| 6 | `idea-processflow` | Proces (process flow) | A | jw., narzędzie „process_flow" | `src/components/MyWork/IdeaProcessFlowTool.tsx:406` (4405) przez `IdeaMapWorkspace.tsx:357` | `ExecutiveModuleShell` | brak | — | tak (wspólna powłoka) | — |
| 7 | `idea-whiteboard` | Tablica (whiteboard) | A | jw., narzędzie „whiteboard" | `src/components/MyWork/IdeaWhiteboardTool.tsx:912` (4894) przez `IdeaMapWorkspace.tsx:357` | `ExecutiveModuleShell` | brak | — | tak (wspólna powłoka) | — |
| 8 | `idea-table` | Tabela pomysłów | D | jw., narzędzie „table" | `src/components/MyWork/IdeaTableTool.tsx:268` (5401) przez `IdeaMapWorkspace.tsx:357` | `ExecutiveModuleShell` | brak | — | tak (wspólna powłoka) | — |
| 9 | `action` | Karta działania | C (klasa S) | lista kart działania (Skrzynka `InboxActionCards.tsx:137`, Wyniki `ResultsActionCards.tsx:8`, KPI `KpiToolPage.tsx:1627`) | `src/components/standard/ActionCard.tsx:33` (123 linie) | brak — renderowana inline w liście | `ActionCard.types.ts` (model, nie kontrakt sekcji) | — | nie | rejestr `action`, `statusMigracji:'zmigrowana'`; **do rozstrzygnięcia**: to kafel w liście, nie ekran otwierany z tożsamością |
| 10 | `agent-plan` | Plan agenta | C | `/agent-plan` (flaga `agentPlanFlag`, domyślnie OFF) | `src/components/AIChat/AgentPlanWorkspace.tsx:29` (63 linie) | tylko `ArtifactRightPanel`, bez powłoki | brak | — | nie | montowany z `src/views/AgentPlanView.tsx:60` |

### 02_INTERVIEW — Wywiad

| # | id-slug | nazwa PL | arch. | otwarcie | komponent | powłoka | kontrakt | AI | Teresa poza Menu 1 | uwagi |
|---:|---|---|:--:|---|---|---|---|:--:|:--:|---|
| 11 | `interview` | Sesja wywiadu | D | `/interview` → Sesje → wiersz | `src/components/Interview/InterviewWorkspace.tsx:235` (3649) | `NModeShell` | `interviewCardContract.ts` (l.95) | — | nie | rejestr `interview`; jedyna karta z kontraktem i BEZ żadnego AI |
| 12 | `insight` | Wniosek z wywiadu | B | `/interview` → Wnioski → wiersz | `src/components/Interview/InsightViewer.tsx:1224` (9993) | `NModeShell` | `insightCardContract.ts` (l.152) | P:9283 A:8690 | nie | rejestr `insight` |
| 13 | `interview-template` | Wzorzec wywiadu | D | `/interview` → Szablony → wiersz (`InterviewHub.tsx:6011`) | `src/components/Interview/TemplateBuilder.tsx:421` (3248) | brak | brak | — | nie | nie w rejestrze, nie w P10 r1 |

### 03_TOOLS — Narzędzia

Roster narzędzi: **31** pozycji (`TOOLS_CANONICAL_ROSTER.md` §1, `ToolType`
w `src/store/useToolStore.ts:28-59`, `DEDICATED_TOOL_TYPES`
w `src/components/DiscoveryTools/dedicatedToolTypes.ts:8-38`). Ekran Library
pokazuje **36** kafelków = 31 narzędzi + 5 szablonów metodyk Assessment
(DRD/SIRI/ADMA/CMMI/LEAN) — te 5 należy do modułu Ocena, nie do Narzędzi.
**Żadne narzędzie nie ma własnego ekranu-artefaktu**: wszystkie 31 dzielą jedną
kartę biblioteki i jeden dokument sesji. 16 z 31 ma dedykowaną gałąź kroków
w `ToolCanvas.tsx`, 15 leci na fallbacku; 12 jest uczciwie oznaczonych
„już wkrótce", a 3 (`rpa-scanner`, `ai-discovery`, `pain-explorer`) obiecują
więcej, niż dowożą (`TOOLS_CANONICAL_ROSTER.md` §3 L4).

| # | id-slug | nazwa PL | arch. | otwarcie | komponent | powłoka | kontrakt | AI | Teresa poza Menu 1 | uwagi |
|---:|---|---|:--:|---|---|---|---|:--:|:--:|---|
| 14 | `tool` | Karta narzędzia (biblioteka) | C | `/discovery-tools` → Biblioteka → kafelek (`DiscoveryToolsHub.tsx:3948`) | `src/components/DiscoveryTools/KnownToolDetailView.tsx:155` (2649) | `NModeShell` | `toolCards.contract.ts` (l.63) | A:2119 | nie | rejestr `tool`; **×31 egzemplarzy** |
| 15 | `tool-document` | Dokument sesji narzędzia | B | `/discovery-tools` → Sesje/Wyniki → wiersz (`DiscoveryToolsHub.tsx:4016`, `StrategicToolsView.tsx:312`) | `src/components/DiscoveryTools/ToolDocumentView.tsx:261` (2740) | `NModeShell` | brak | P:2545 A:2449 | nie (usunięte, l.2520) | wyjątek rejestru; **×31 egzemplarzy** |
| 16 | `tool-document-generic` | Dokument sesji — wariant generyczny | B | jw., dla typów bez dedykowanego widoku (`DiscoveryToolsHub.tsx:4065`) | `src/components/DiscoveryTools/GenericToolDocumentView.tsx:27` (283) | brak | brak | — | nie | drugi renderer tej samej treści — patrz §3 |
| 17 | `tool-trace` | Ślad „Moje biuro" | B | `DiscoveryToolsHub.tsx:4054` | `src/components/DiscoveryTools/MyWorkTraceDocumentView.tsx:72` (210) | brak | brak | — | nie | dokument sesji o `tool_type` spoza rosteru (skażenie danych, L5) |
| 18 | `tool-workspace` | Warsztat narzędzia (operacyjne) | A | `/discovery-tools/operational` → narzędzie (`OperationalToolsView.tsx:223`) | `src/components/DiscoveryTools/ToolWorkspace.tsx:156` (953) | brak | brak | — | nie | równoległa ścieżka do `ToolDocumentView` — patrz §3 |
| 19 | `megatrends` | Warsztat megatrendów | D | `/discovery-tools/strategic/megatrends` (`AppRoutes.tsx:2112`) | `src/components/Megatrend/MegatrendsWorkspace.tsx:33` (208) | brak | brak | — | nie | — |
| 20 | `trend` | Karta trendu | C | warsztat megatrendów → trend (`MegatrendsWorkspace.tsx:176`) | `src/components/Megatrend/TrendDetailCard.tsx:45` (313) | brak | brak | — | nie | drugi wołacz: `MegatrendScannerModule.tsx:139` |

### 04_ASSESSMENT — Ocena

Pięć metodyk (DRD, SIRI, ADMA, CMMI, LEAN) dzieli te same ekrany — stąd
15 egzemplarzy przy 7 typach.

| # | id-slug | nazwa PL | arch. | otwarcie | komponent | powłoka | kontrakt | AI | Teresa poza Menu 1 | uwagi |
|---:|---|---|:--:|---|---|---|---|:--:|:--:|---|
| 21 | `assessment-session` | Sesja oceny | D | `/assessment/:framework/:assessmentId` (`AppRoutes.tsx:2299`) | `src/views/AssessmentSessionEditorView.tsx:358` (2907) | brak | brak | — | nie | **×5 metodyk** |
| 22 | `drd-workspace-http` | Warsztat metody (wariant HTTP) | D | z sesji oceny, bramka `shouldMountDrdMethodWorkspace` | `src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx:414` (1799) | brak (własny `MethodWorkspaceShell`) | brak | P:1282 | nie | jedyna karta poza rejestrem z „Pracuj z AI" |
| 23 | `drd-workspace-local` | Warsztat metody (wariant lokalny) | D | jw., druga gałąź bramki | `src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx:946` (959) | brak | brak | — | nie | dubel funkcjonalny #22 — patrz §3 |
| 24 | `assessment-report` | Raport oceny | B | z warsztatu metody (`DrdHttpMethodWorkspaceScreen.tsx:1410`) | `src/components/assessment/report/AssessmentReportContractView.tsx:295` (548) | `NModeShell` | kontrakt raportu w komponencie, nie `KanonicznaKarta` | — | nie | wyjątek rejestru; **×5** |
| 25 | `assessment-output-report` | Raport wyjścia oceny | B | `/assessment/outputs/:outputId/report` (`AppRoutes.tsx:871`, flaga `isAssessmentOutputArtifactsEnabled`) | `src/components/assessment/report/AssessmentReportView.tsx:45` (146) | brak | brak | — | nie | druga droga do tej samej treści — patrz §3 |
| 26 | `assessment-presentation` | Prezentacja oceny | E | `/assessment/outputs/:outputId/presentation` (`AppRoutes.tsx:885`) | `src/components/assessment/presentation/AssessmentPresentationView.tsx:95` (283) | brak | brak | — | nie | — |
| 27 | `imported-report` | Zaimportowany raport | B | `/assessment` → Raporty → wiersz (`AssessmentHub.tsx:2360`) | `src/components/assessment/ImportedReportDetailView.tsx:132` (622) | brak | brak | — | nie | — |

### 05_INITIATIVES — Inicjatywy

| # | id-slug | nazwa PL | arch. | otwarcie | komponent | powłoka | kontrakt | AI | Teresa poza Menu 1 | uwagi |
|---:|---|---|:--:|---|---|---|---|:--:|:--:|---|
| 28 | `initiative` | Inicjatywa | C | `/initiatives?open=<id>&mode=doc` (`getArtifactPath`, `artifactLinks.ts:281`), lista/kanban | `src/components/Initiatives/InitiativeDocumentView.tsx:494` (12109 — najcięższa karta) | `NModeShell` | `sections/initiativeCardContract.ts` (l.221) | P:11560 A:10818 | nie (DEC-419) | rejestr `initiative`; **26 sekcji** — to jest te „21 kart", o których mówi właściciel |
| 29 | `plan` | Plan | C | `/initiatives` → Plan → scenariusz (`PlanScenarioSurface.tsx:925`) | `src/components/Initiatives/cards/PlanCard.tsx:10` (26 linii — sam spec + `CardBlockRenderer`) | `StandardArtifactShell` | brak (spec w `cardSpecBuilders.ts`) | — | nie | rejestr `plan`, `zmigrowana`; **kolizja nazw** z `src/components/billing/PlanCard.tsx:28` — patrz §3 |
| 30 | `capacity-analysis` | Analiza obciążenia | C | `/initiatives` → Obciążenie → scenariusz (`CapacityScenarioSurface.tsx:856`) | `src/components/Initiatives/cards/CapacityAnalysisCard.tsx:11` (23) | `StandardArtifactShell` | brak (spec w `cardSpecBuilders.ts`) | — | nie | rejestr `capacity_analysis`, `zmigrowana` |

### 06_EXECUTION — Realizacja

| # | id-slug | nazwa PL | arch. | otwarcie | komponent | powłoka | kontrakt | AI | Teresa poza Menu 1 | uwagi |
|---:|---|---|:--:|---|---|---|---|:--:|:--:|---|
| 31 | `execution-report` | Raport realizacji | B | `/execution` → Raporty → wiersz (`ExecutionHub.tsx:5769`) | `src/components/Execution/ReportDocumentView.tsx:1698` (1929) | brak | brak | — | nie | — |
| 32 | `execution-work-doc` | Karta pracy (dokument) | C | `/execution` → Praca → wiersz (`ExecutionHub.tsx:2865` buduje `work:<caseId>:<id>`, mount `:5941`) | `src/components/Execution/ExecutionWorkSurface.tsx:408` (1354; tryb `documentId`) | brak | brak | — | nie | **do rozstrzygnięcia**: tryb dokumentu wewnątrz powierzchni listy, nie osobny komponent |
| 33 | `execution-control-loop` | Raport pętli sterowania | B | `/execution`, `activeDocumentId='execution-intelligence:control'` (`ExecutionHub.tsx:5756`) | `src/components/Execution/reports-intelligence/ControlLoopReport.tsx:32` (238) | brak | brak | — | nie | **do rozstrzygnięcia**: tożsamość stała (jeden egzemplarz), nie per rekord |
| 34 | `execution-work-intelligence` | Raport inteligencji pracy | B | `ExecutionHub.tsx:5747` | `src/components/Execution/reports-intelligence/WorkIntelligenceReport.tsx:122` (535) | brak | brak | — | nie | jw. |
| 35 | `execution-resources-capacity` | Raport zasobów i obciążenia | B | `ExecutionHub.tsx:5753` | `src/components/Execution/reports-intelligence/ResourcesCapacityReport.tsx:38` (303) | brak | brak | — | nie | jw. |
| 36 | `execution-report-generator` | Generator raportu realizacji | B | `ExecutionHub.tsx:5762` | `src/components/Execution/reports-intelligence/UnifiedExecutionReportGenerator.tsx:25` (371) | brak | brak | — | nie | jw. |

### Wyniki (P7K — brak własnego klucza w `MVP_FINAL_ZAMROZONE.json`)

| # | id-slug | nazwa PL | arch. | otwarcie | komponent | powłoka | kontrakt | AI | Teresa poza Menu 1 | uwagi |
|---:|---|---|:--:|---|---|---|---|:--:|:--:|---|
| 37 | `metric` | Miernik (KPI) | C | `/results/kpi/:kpiId` (`routeConfig.ts:166`) | `src/components/ResultsVNext/kpiTool/KpiToolPage.tsx:296` (1933) | `StandardArtifactShell` + `KartaWynikowChrome` | brak (`ZrodloUzupelnienia` inline) | P:1868 A:807 | nie | rejestr `metric` (DEC-422) |
| 38 | `kpi-scorecard` | Raport KPI (karta wyników) | D | `/results/kpi/scorecards/:scorecardId` (`routeConfig.ts:158`) | `src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage.tsx:145` (1054) | `StandardArtifactShell` | brak | — | nie | poza rejestrem |
| 39 | `kpi-deviation` | Karta odchylenia | C | `/results/kpi/:kpiId/deviation-cases/:caseId` (`routeConfig.ts:167`) | `src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview.tsx:191` (1284) | `NModeShell` | brak | — | nie | poza rejestrem |
| 40 | `okr-report` | Raport OKR | D | `/results/okr/:setId` (`routeConfig.ts:220`) | `src/components/ResultsVNext/okr/p7k/OkrReportPage.tsx:155` (645) | brak | brak | — | nie | poza rejestrem |
| 41 | `objective` | Cel OKR | C | `/results/okr/:setId/objectives/:objectiveId` i `/results/okr/objectives/:objectiveId` (`routeConfig.ts:222,224`) | `src/components/ResultsVNext/okr/OkrObjectiveCardPage.tsx:205` (1532) | `NModeShell` + `KartaWynikowChrome` | `OkrObjectiveCardSections.ts` (l.134) | P:1455 A:560 | nie | rejestr `objective`; dwie trasy = jedna karta (§3) |
| 42 | `okr-set-tool` | Narzędzie zestawu OKR | D | `/results/okr/sets/:okrSetId` (`routeConfig.ts:200`) | `src/components/ResultsVNext/okr/OkrSetToolPage.tsx:42` → `OkrSetWorkspace.tsx:80` | brak | brak | — | nie | poza rejestrem |
| 43 | `roi-case-card` | Karta analizy ROI | C | `/results/roi/:roiCaseId` (`routeConfig.ts:196`) | `src/components/ResultsVNext/roi/card/RoiCaseCardPage.tsx:103` (759) | `StandardArtifactShell` + `KartaWynikowChrome` | `RoiCaseCardSections.ts` / `RoiCardSections.tsx` (l.97) | P:705 A:494 | nie | rejestr `roi_case` (DEC-422) |
| 44 | `roi-case-tool` | Narzędzie ROI (pełne) | D | `/results/roi/cases/:roiCaseId` (`routeConfig.ts:181`) | `src/components/ResultsVNext/roi/RoiCaseToolPage.tsx:47` → `RoiCaseFullTool.tsx:139` (456) | `NModeShell` | brak | — | nie | 17 podwidoków CRUD; osobny byt niż #43 (decyzja P7K) |

### Finanse (pełny zakres MVP wg DEC-2026-08-28-177; brak klucza w pliku zamrożeń)

| # | id-slug | nazwa PL | arch. | otwarcie | komponent | powłoka | kontrakt | AI | Teresa poza Menu 1 | uwagi |
|---:|---|---|:--:|---|---|---|---|:--:|:--:|---|
| 45 | `finance-statement-pack` | Sprawozdanie finansowe (pakiet) | D | `/finance/statements/:id` (`AppRoutes.tsx:2437`) → `FinanceHub.tsx:320` | `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx:223` (801) | brak (`FinanceWorkspaceBar`) | brak | — | nie | za flagą `useFinanceStatementPackWorkspaceV2Flag` |
| 46 | `finance-baseline` | Baza finansowa | D | `FinanceHub.tsx:337` | `src/components/Finance/BaselineWorkspace.tsx:120` (650) | brak | brak | — | nie | flaga `useFinanceBaselineWorkspaceFlag` |
| 47 | `finance-prediction` | Prognoza | D | `/finance/predictions/:id` (`AppRoutes.tsx:2488`) → `FinanceHub.tsx:349` | `src/components/Finance/Prediction/PredictionWorkspace.tsx:98` (561) | brak | brak | — | nie | — |
| 48 | `finance-analysis` | Analiza finansowa | D | `/finance/analyses/:id` (`AppRoutes.tsx:2471`) → `FinanceHub.tsx:355` | `src/components/Finance/Analysis/AnalysisWorkspace.tsx:128` (626) | brak | brak | — | nie | — |
| 49 | `finance-valuation` | Wycena | D | `/finance/valuations/:id` (`AppRoutes.tsx:2505`) → `FinanceHub.tsx:363` | `src/components/Finance/Valuation/ValuationWorkspace.tsx:218` (837) | brak | brak | — | nie | **kolizja nazw** z `Benefits/ValuationWorkspace.tsx` — §3 |
| 50 | `finance-model` | Model finansowy | D | `/finance/models/:id` (`AppRoutes.tsx:2454`) | `src/components/Finance/FinancialModelWorkspace.tsx:412` (2152) | brak | brak | — | nie | — |
| 51 | `finance-kpi-card` | Karta KPI analizy finansowej | C | z analizy finansowej (`AnalysisWorkspace.tsx:569`) | `src/components/Finance/Analysis/AnalysisKpiDetailCard.tsx:78` (199) | tylko `ArtifactRightPanel` | brak | — | nie | jedyna karta Finansów, która dotyka standardu |

### 11_MATERIALS — Materiały (z podobszarem Prezentacje)

| # | id-slug | nazwa PL | arch. | otwarcie | komponent | powłoka | kontrakt | AI | Teresa poza Menu 1 | uwagi |
|---:|---|---|:--:|---|---|---|---|:--:|:--:|---|
| 52 | `document` | Dokument (Word / Document Studio) | B | `/document-studio/:artifactId` (`AppRoutes.tsx:2976`), alias `/wordy?artifactId=` | `src/components/DocumentStudio/DocumentStudioView.tsx:172` (1255) | `ExecutiveModuleShell` | brak | — | nie | — |
| 53 | `sheet-excele` | Arkusz (Excele) | D | `/excele?artifactId=` (`ExceleView.tsx:555`) | `src/components/AIChat/KimiWorkspace/SpreadsheetArtifactStudio.tsx:150` (2570) | `ExecutiveModuleShell` | brak | — | nie | — |
| 54 | `sheet-tabele` | Tabela (Tabele) | D | `/tabele?artifactId=` (`TabeleView.tsx:55`) | `src/components/AIChat/KimiWorkspace/tabeleShell/TabeleMelsView.tsx:135` (przez `TabeleView.tsx:55`) | `ExecutiveModuleShell` | brak | — | nie | druga rodzina arkuszy obok #53 — §3 |
| 55 | `presentation` | Prezentacja (Deck) | E | `/presentations/builder/:deckId` (`AppRoutes.tsx:2917`) | `src/components/Presentations/DeckBuilder/DeckBuilder.tsx:330` (2507) | `ExecutiveModuleShell` (za flagą `melsDeckBuilderFlag`) | brak | — | nie | wyjątek rejestru |
| 56 | `presentation-shared` | Prezentacja udostępniona | E | `/presentations/shared/:shareToken`, `/presentations/embed/:shareToken` (`AppRoutes.tsx:3001,3009`) | `src/components/Presentations/SharedPresentationView.tsx:23` (202) | brak | brak | — | nie | widok publiczny, bez logowania |
| 57 | `template` | Wzorzec (szablon) | B | Materiały → Szablony → wiersz (`TemplateBuilder.tsx:329`) | `src/components/TemplateBuilder/TemplateBuilderShell.tsx:82` (310) | `ExecutiveModuleShell` | brak | — | nie | — |
| 58 | `template-architect-doc` | Architekt wzorca dokumentu | B | `DocumentStudioView.tsx:1046` | `src/components/DocumentStudio/DocumentStudioTemplateArchitectView.tsx:150` (1381) | brak | brak | — | nie | — |
| 59 | `template-architect-deck` | Architekt wzorca prezentacji | E | `ReportsAndPresentationsHub.tsx:1341` | `src/components/Presentations/PresentationTemplateArchitectView.tsx:206` (1853) | brak | brak | — | nie | — |
| 60 | `vault-document` | Dokument sejfu klienta | B | `/vault` → sejf → dokument (`VaultDocumentsView.tsx:1448`) | `src/views/vault/VaultDocumentPanel.tsx:101` (899) | brak | brak | — | nie | wyjątek rejestru; wejście z Menu 2 „Moja praca" |
| 61 | `report-builder` | Raport (kreator) | B | `/reports/builder/:reportId` (`AppRoutes.tsx:2620`) | `src/views/ReportBuilderView.tsx:541` → `ReportBuilder/ReportsComposer.tsx:178` | brak | brak | — | nie | — |
| 62 | `management-report` | Raport zarządczy | B | `/reports/management` → wiersz | `src/components/Reports/Management/ManagementReportsView.tsx:76` (685) | brak | brak | — | nie | — |
| 63 | `reporting-automation` | Automatyzacja raportowania | D | `ReportsHub.tsx:983` | `src/components/Reports/Management/ReportingAutomationWorkspace.tsx:130` (1113) | brak | brak | — | nie | **do rozstrzygnięcia**: konfiguracja, nie artefakt |

### 12_AUDITS — Audyty

| # | id-slug | nazwa PL | arch. | otwarcie | komponent | powłoka | kontrakt | AI | Teresa poza Menu 1 | uwagi |
|---:|---|---|:--:|---|---|---|---|:--:|:--:|---|
| 64 | `audit-criterion` | Kryterium audytu (v2) | C | `/audit-programs/:programId/criteria/:criterionId` (`AppRoutes.tsx:1762`) przez `CriterionWorkspaceGate.tsx:22` | `src/components/Audit/method/workspace/v2/CriterionWorkspaceV2.tsx:385` (1823) | tylko `ArtifactRightPanel` | brak | — | nie | wyjątek rejestru; flaga `isCriterionWorkspaceV2Enabled` |
| 65 | `audit-criterion-v1` | Kryterium audytu (v1) | C | ta sama trasa, druga gałąź bramki | `src/components/Audit/method/workspace/CriterionWorkspace.tsx:52` (523) | brak | brak | — | nie | dubel #64 przy fladze OFF — §3 |
| 66 | `audit-report` | Raport audytu | B | `/audit-programs/reports/:reportId` (`AppRoutes.tsx:1738`, mount `:855`) | `src/components/Audit/method/AuditReportDocumentView.tsx:530` (1462) | `NModeShell` | brak | — | nie | wyjątek rejestru |

### 08_MEETINGS — Spotkania

| # | id-slug | nazwa PL | arch. | otwarcie | komponent | powłoka | kontrakt | AI | Teresa poza Menu 1 | uwagi |
|---:|---|---|:--:|---|---|---|---|:--:|:--:|---|
| 67 | `meeting` | Spotkanie | C | `/meetings/:meetingId` + `/minutes` + `/decisions` + `/notes/:noteId` (`routeConfig.ts:140-143`) | `src/components/Meeting/MeetingObjectPage.tsx:222` (1365) | `StandardArtifactShell` | brak | — | nie | wyjątek rejestru; **4 trasy = 1 karta** (sekcje `details|minutes|decisions`, l.108) — §3 |

### 01_ORGANIZATION — Organizacja

| # | id-slug | nazwa PL | arch. | otwarcie | komponent | powłoka | kontrakt | AI | Teresa poza Menu 1 | uwagi |
|---:|---|---|:--:|---|---|---|---|:--:|:--:|---|
| 68 | `governed-context` | Kontekst zarządzany (źródła i twierdzenia) | D | `/organization` → sekcja (`OrganizationView.tsx:296,299`, `OrganizationSourcesClaimsScreen.tsx:54`) | `src/components/Organization/GovernedContextWorkspace.tsx:107` (816) | brak | brak | — | nie | **do rozstrzygnięcia**: obiekt-organizacja czy ekran ustawień |

### 13_CHAT — Czat

| # | id-slug | nazwa PL | arch. | otwarcie | komponent | powłoka | kontrakt | AI | Teresa poza Menu 1 | uwagi |
|---:|---|---|:--:|---|---|---|---|:--:|:--:|---|
| 69 | `chat-artifact` | Artefakt czatu | B | panel artefaktów czatu (`ArtifactsPanel.tsx:270`, `ArtifactEditor.tsx:166`) | `src/components/AIChat/Artifacts/ArtifactViewer.tsx:37` (115) | brak | brak | — | nie | — |
| 70 | `teresa-v10-runtime` | Warsztat runtime Teresy (v10) | A | `/ai` → AIOSHub (`AIOSHub.tsx:168`) | `src/components/v10/V10TeresaRuntimeWorkspace.tsx:6` (74) | brak | brak | — | nie | **do rozstrzygnięcia**: 74 linie, prawdopodobnie szkielet |

### Poza menu 16 modułów

| # | id-slug | nazwa PL | arch. | otwarcie | komponent | powłoka | kontrakt | AI | Teresa poza Menu 1 | uwagi |
|---:|---|---|:--:|---|---|---|---|:--:|:--:|---|
| 71 | `conclusion` | Wniosek | B | `/conclusions` → kafelek → `openDetail` (`ConclusionsHub.tsx:184,288`) | `src/components/Conclusions/ConclusionReadout.tsx:40` (189) | brak | brak | — | nie | — |
| 72 | `case` | Zlecenie | C | `/zlecenia/:caseId` (`CaseWorkspaceHub.tsx:28`) | `src/components/CaseWorkspace/CaseDetailScreen.tsx:587` (2474) | `StandardArtifactShell` | brak | — | nie | podwójna bramka: `BetaGate MODULE_CASE_WORKSPACE` + `isCaseWorkspaceEnabled()` (OFF) |

### Komponenty-karty BEZ ANI JEDNEGO WOŁACZA (nie liczone do 72)

| komponent | linie | dowód martwoty |
|---|---:|---|
| `src/components/AIChat/AgentHubShell.tsx:415` | 1801 | zero `<AgentHubShell` w `src/`; `MyWorkHub.tsx:222-223` mówi wprost: *„Sam komponent … zostaje w drzewie, nieużywany"*. Używa `StandardArtifactShell` — czyli martwa karta na standardzie. |
| `src/components/Discovery/InsightDetailView.tsx:225` | 605 | zero `<InsightDetailView` w `src/`; żywym wnioskiem jest `Interview/InsightViewer.tsx` |
| `src/components/Initiatives/InitiativeFullView.tsx:275` | 1281 | jeden wołacz (`MyWorkHub.tsx:4025`) — **nie martwy**, ale to druga powłoka inicjatywy poza `InitiativeDocumentView`; patrz §3 |

## 3. Duplikaty i aliasy (policzone raz)

| zjawisko | pozycje | rozstrzygnięcie |
|---|---|---|
| **Spotkanie pod 4 trasami** | `/meetings/:id`, `/minutes`, `/decisions`, `/notes/:noteId` | JEDNA karta (#67). `MeetingObjectPage.tsx:108` ma `type Section = 'details' \| 'minutes' \| 'decisions'` i wyprowadza sekcję z `location.pathname` (l.602-608). Aliasy: 3 dodatkowe trasy. |
| **Cel OKR pod 2 trasami** | `/results/okr/:setId/objectives/:objectiveId`, `/results/okr/objectives/:objectiveId` | JEDNA karta (#41). Dodatkowo 2 trasy przekierowań (`OBJECTIVE_KEY_RESULTS`, `OBJECTIVE_KEY_RESULT`, `routeConfig.ts:226,228`). |
| **Inicjatywa w trzech modułach** | Inicjatywy (`InitiativeDocumentView`), Realizacja (`ExecutionHub.tsx:177-181` lazy-importuje **ten sam** `InitiativeDocumentView` pod nazwą `ExecutionInitiativeDocumentView`), Moja praca (`InitiativeFullView` przez `MyWorkHub.tsx:4025`) | Karta #28 liczona RAZ. Alias 1: `ExecutionInitiativeDocumentView` = ten sam komponent. Alias 2: `InitiativeFullView.tsx:275` = **inna** powłoka tej samej encji (1281 linii, bez `NModeShell`) — to nie alias, to drugi produkt; do rozstrzygnięcia przez właściciela. |
| **Kryterium audytu w dwóch wersjach** | `CriterionWorkspaceV2` (#64) / `CriterionWorkspace` (#65) za `CriterionWorkspaceGate.tsx:22` | Dwa komponenty, jedna trasa. Docelowo jedna karta; do czasu zdjęcia flagi liczone jako 2 (kontrakt trzeba napisać dla wersji, która zostaje). |
| **Warsztat metody DRD w dwóch wariantach** | `DrdHttpMethodWorkspaceScreen` (#22) / `DrdMethodWorkspaceScreen` (#23) | jw. — bramka `shouldMountDrdMethodWorkspace` (`AssessmentSessionEditorView.tsx`). |
| **Raport oceny dwiema drogami** | `AssessmentReportContractView` (#24, z warsztatu) / `AssessmentReportView` (#25, z trasy `/assessment/outputs/:outputId/report`) | Dwa komponenty na tę samą treść; #25 (146 linii) jest cienką powłoką trasy. Do rozstrzygnięcia: scalić czy zostawić. |
| **Dokument sesji narzędzia — 3 renderery** | `ToolDocumentView` (#15), `GenericToolDocumentView` (#16), `MyWorkTraceDocumentView` (#17) + czwarta ścieżka `ToolWorkspace` (#18) | Jedna encja („sesja narzędzia"), cztery ekrany. Kontrakt piszemy RAZ, egzekwujemy na czterech. |
| **Arkusz w dwóch rodzinach** | `SpreadsheetArtifactStudio` (#53, `/excele`) i `TabeleMelsView` (#54, `/tabele`) | Dwie rodziny arkuszy; `EXCELE` w `routeConfig.ts:40` jest opisany jako „redirect-only alias to canonical Table Studio", ale komponent `#53` ma 2570 linii i żyje. Do rozstrzygnięcia. |
| **Kolizja nazwy `PlanCard`** | `Initiatives/cards/PlanCard.tsx:10` (karta N) vs `billing/PlanCard.tsx:28` (kafelek cennika) | Różne byty, ta sama nazwa pliku. Pułapka przy grepie — nie licz `BillingCore.tsx:517` i `BillingCenterView.tsx:859` jako kart N. |
| **Kolizja nazwy `ValuationWorkspace` / `FinancialAnalysisWorkspace`** | `Finance/Valuation/ValuationWorkspace.tsx` (#49) vs `Benefits/ValuationWorkspace.tsx` (stary system M16) | `FinanceHub.tsx:194-195` sam ostrzega przed tą kolizją. Stare `Benefits/*` nie liczone. |
| **`AuditLogViewer` ×2, `ArtifactViewer` ×1** | `AISettings/AuditLogViewer.tsx`, `governance/AuditLogViewer.tsx`, `superadmin/iam/AuditEventsViewer.tsx` | To dzienniki, nie karty N — odrzucone z inwentarza. |

## 4. Podział na partie do napisania kontraktów

Wzór partii: 10–15 kart jednego modułu (albo modułów pokrewnych), jeden wykonawca,
jeden dokument kontraktu na kartę w `docs/program/PROGRAM_NAPRAWCZY_20260905/P10/`
(taki jak istniejące `task.md`, `decision.md` …), plus wpis do `registry.ts`
tam, gdzie karta ma wołać silnik AI (`CardAnalysisArtifactType = KartaNKey`).

| partia | zakres | kart | wykonawca | rozmiar | uzasadnienie doboru |
|---|---|---:|---|---|---|
| **B1** | Wyniki: #37–#44 (miernik, raport KPI, odchylenie, raport OKR, cel OKR, zestaw OKR, karta ROI, narzędzie ROI) | 8 | **Codex** (Sonnet) | S | 3 z 8 mają już kontrakt sekcji i AI — reszta to dopisanie wzorem sąsiada w tym samym katalogu |
| **B2** | Narzędzia: #14–#20 + rozstrzygnięcie 31 egzemplarzy | 7 typów / 67 egz. | **Opus** | L | najtrudniejsza decyzja produktowa: jeden kontrakt dla 31 narzędzi czy 31 wariantów; dotyka `toolPacks/registry.ts` i `TOOLS_CANONICAL_ROSTER.md` |
| **B3** | Materiały + Prezentacje: #52–#63 | 12 | **Codex** (Sonnet) | L | zero kontraktów, zero rejestru, 5 różnych powłok — dużo mechaniki, mało decyzji |
| **B4** | Ocena: #21–#27 (+ mnożnik 5 metodyk) | 7 typów / 15 egz. | **Opus** | M | trzeba najpierw rozstrzygnąć dubel #22/#23 i #24/#25, dopiero potem pisać |
| **B5** | Realizacja + Audyty: #31–#36, #64–#66 | 10 | **Codex** (Sonnet) | M | wspólny wzorzec „raport-dokument"; 4 pozycje wymagają odpowiedzi „czy raport bez tożsamości rekordu to karta N" |
| **B6** | Moja praca — reszta: #4–#10 (notatka, 4 tryby warsztatu pomysłu, karta działania, plan agenta) | 7 | **Opus** | M | jedyna karta z Teresą poza Menu 1 (#5–#8) + rozstrzygnięcie, czy `ActionCard` jest kartą N |
| **B7** | Finanse: #45–#51 | 7 | **Codex** (Sonnet) | M | jednorodne, wszystkie za flagami, wszystkie bez powłoki — praca hurtowa |
| **B8** | Reszta: #13 (wzorzec wywiadu), #67 (spotkanie), #68 (organizacja), #69–#70 (czat), #71 (wniosek), #72 (zlecenie) | 6 | **Codex** (Sonnet) | S | ogony po jednej karcie na moduł |
| **B0** | Karty, które kontrakt JUŻ mają — audyt zgodności, nie pisanie: #1, #2, #3, #11, #12, #28 | 6 | **Codex** (Haiku/Sonnet) | S | sprawdzić, czy kontrakt pokrywa realne sekcje po zmianach DEC-419/DEC-422 |

Razem 8 partii pisania (63 karty) + 1 partia audytu (6 kart) + 3 pozycje
zamknięte razem z partiami (#65, #23, #25 — dublety do usunięcia albo scalenia).

Zalecana kolejność: **B1 → B6 → B5 → B4 → B2 → B7 → B3 → B8**, bo B1 i B6 są
w modułach, które właściciel ogląda najczęściej, a B2 (Narzędzia) wymaga jego
decyzji, więc nie może blokować startu.

## 5. Różnica wobec 19/21 z P10 r1 i wobec „140" właściciela

**Wobec 19 z `P10/00_INWENTARZ.md`.** Tamten inwentarz liczył 19 pozycji
(8 rejestr + 11 poza), a `registry.kompletnosc.test.ts` po DEC-421/DEC-422 liczy
22 (13 + 9). Ten pomiar daje **72**. Różnica **+50** ma trzy przyczyny, żadna
nie jest „ktoś się pomylił":

1. **Zakres.** P10 r1 mierzył tylko to, co dotyka rejestru albo było wcześniej
   nazwane kartą. Nie objął w ogóle: Finansów (7), Materiałów i Prezentacji (12),
   Realizacji (6), Wyników poza trzema (5 z 8), Czatu (2), Organizacji (1),
   Wniosków (1), Zleceń (1), Wywiadu poza dwoma (1), Oceny poza raportem (6).
   Razem 42 karty nigdy nie były policzone.
2. **Granulacja.** P10 r1 liczył `idea` jako jedną pozycję; w kodzie to jedna
   powłoka i **cztery** centra (`CanvasToolType`, `ideaSelectionTypes.ts:8`) —
   cztery kontrakty do napisania (+3).
3. **Dublety i warianty za flagą**, które r1 pomijał: #23, #25, #65, #16, #17,
   #18 (+5, licząc raz to, co §3 uznaje za osobny byt do rozstrzygnięcia).

**Wobec „21 w inicjatywie".** Właściciel ma rację: `InitiativeDocumentView`
deklaruje **26 sekcji** (`registry.ts:190`), a nie 21. To są sekcje JEDNEJ karty,
nie 26 kart — dlatego w inwentarzu inicjatywa to jedna pozycja (#28). Liczba
„21/26" opisuje objętość kontraktu inicjatywy, nie liczbę kart.

**Wobec „140".** Liczba właściciela jest **trafna**, tylko dotyczy egzemplarzy,
nie typów. Rachunek:

```
72 typy kart (§2)
+ 30 = karta biblioteki narzędzia ×31 (jeden typ, 31 egzemplarzy; #14)
+ 30 = dokument sesji narzędzia ×31 (jeden typ, 31 egzemplarzy; #15)
+  4 = sesja oceny ×5 metodyk (#21)
+  4 = raport oceny ×5 metodyk (#24)
──────
140 egzemplarzy
```

Roster 31 narzędzi jest zmierzony, nie wzięty z pamięci
(`TOOLS_CANONICAL_ROSTER.md` §0: 31 wierszy w `public.tools` = 31 wariantów
`ToolType` = 31 pozycji `DEDICATED_TOOL_TYPES`). „36" widoczne na ekranie
Biblioteki to 31 narzędzi + 5 szablonów metodyk Assessment — te 5 policzone jest
w module Ocena, żeby nie liczyć ich dwa razy.

**Uczciwie: ile naprawdę.** Kontraktów do napisania jest **72**, nie 140 —
bo 31 narzędzi dzieli jeden ekran, a 5 metodyk dzieli dwa. Ale ekranów, które
klient realnie zobaczy i które muszą wyglądać zgodnie z SPEC-A, jest **140**.
Obie liczby są potrzebne: 72 do planowania pracy, 140 do planowania odbioru.

**Stan pokrycia na dziś (mianowniki jawne):**

* kontrakt w kodzie: **9 / 72** (12,5 %),
* wpis w rejestrze: **13 / 72** (18 %),
* jakakolwiek powłoka standardu (`StandardArtifactShell` 9 + `NModeShell` 11 +
  `ExecutiveModuleShell` 9): **29 / 72** (40 %) — pozostałe 43 karty budują wygląd
  po swojemu; 3 z nich (#10, #51, #64) osadzają sam `ArtifactRightPanel` bez
  powłoki, więc standardu dotyka w jakikolwiek sposób **32 / 72**,
* `StandardArtifactShell` (docelowa powłoka SPEC-N): **9 / 72** (12,5 %),
* „Pracuj z AI": **10 / 72** (14 %),
* „Analizuj z AI": **10 / 72** (14 %); suma kart z jakimkolwiek AI: **11 / 72**,
* Teresa poza Menu 1 (naruszenie DEC-404): **4 / 72** (warsztat pomysłu, #5–#8,
  `IdeaMapWorkspace.tsx:5507`),
* karty martwe (komponent bez wołacza): **2** (`AgentHubShell`,
  `Discovery/InsightDetailView`) — jedna z nich stoi na `StandardArtifactShell`,
  czyli praca standaryzacyjna została włożona w ekran, którego nikt nie widzi.

**Pozycje „do rozstrzygnięcia" (7)** — nie zgaduję, wymagają decyzji właściciela
albo CTO przed napisaniem kontraktu: #9 (`action` — kafel w liście czy karta N),
#32 (tryb dokumentu wewnątrz powierzchni listy), #33–#36 (raporty realizacji
o stałej tożsamości, jeden egzemplarz na organizację), #63 (automatyzacja
raportowania — konfiguracja czy artefakt), #68 (kontekst organizacji), #70
(runtime Teresy v10 — 74 linie, prawdopodobnie szkielet).
