---
doc_id: kontrakty-narzedzi-ai
truth_type: product-target
status: canonical
established: 2026-09-05
decided_by: CTO (Fable) — domknięcie luki przekrojowej nr 5 z `docs/program/AUDYT_FORMULY_PRACY_20260905.md`
zasady: docs/ssot/ZASADY_AI_TERESA_SSOT.md
pomiar: HEAD gałęzi `codex/m03-admin-20260824` (= `origin/staging`), 2026-09-05, katalog `/private/tmp/m03`
---

# Kontrakty Teresy — co asystent robi w każdym module i narzędziu

Zasady ogólne (rola, klasy akcji, ślad, granice): `ZASADY_AI_TERESA_SSOT.md`.
Ta strona mówi, **co Teresa robi konkretnie tu** — i ile z tego realnie działa.

Kolumna „stan" pochodzi z **pomiaru kodu** (import → użycie w JSX → trasa → endpoint), nie z dokumentów.

| Znacznik | Znaczenie |
|---|---|
| **DZIAŁA** | komponent renderowany w trasie modułu **i** woła istniejący, zamontowany endpoint |
| **ZA FLAGĄ** | pełna ścieżka istnieje, ale bramka (flaga / allowlist / gate) domyślnie ją zamyka |
| **WOŁACZ BEZ EKRANU** | endpoint/serwis żyje, żaden renderowany komponent go nie woła |
| **EKRAN BEZ WOŁACZA** | UI mówi „Teresa", ale nic nie wywołuje AI |
| **BRAK** | nic — ani ekranu modułowego, ani wołacza |

## 0. Warstwa zerowa: dok globalny (to trzeba wiedzieć przed czytaniem tabeli)

Teresa jest obecna **w każdym widoku** jako dokowany czat: `src/layouts/MainLayout.tsx:509`
renderuje `<UnifiedChatPanel mode="split">` dla wszystkich widoków poza czarną listą
`VIEWS_WITHOUT_CHAT_PANEL` (`MainLayout.tsx:102–119`). Endpoint: `POST /api/ai/chat/stream`
(`src/services/api.ts:2707` → `server/src/routes/ai.routes.ts:1627`).

**Dwa fakty, które zmieniają odczyt całej tabeli:**
1. Dok jest **domyślnie zwinięty** — `src/store/slices/uiSlice.ts:170` `isChatCollapsed: true`; warunek renderu to `shouldMountChatPanel && !isChatCollapsed` (`MainLayout.tsx:488`). Użytkownik musi go otworzyć z Menu 1 (`MainLayout.tsx:444–458`).
2. Dok **nie wie nic o module** poza `workspaceContext`. Dlatego kolumna „stan" niżej ocenia **integrację modułową**, nie obecność doku. Moduł oznaczony BRAK ma Teresę na ekranie, ale nie ma z nią o czym rozmawiać o swoich danych.

`SETTINGS_*` (9 widoków, `MainLayout.tsx:107–118`) są na czarnej liście — tam doku nie ma wcale.

## 1. Moduły (16)

| Moduł | Co Teresa tu robi (≤3 czasowniki) | Wejście | Wyjście | Akcje dozwolone | Akcje zakazane | Ślad | Stan (pomiar 05.09) |
|---|---|---|---|---|---|---|---|
| 01 Organizacja | wyjaśnia profil · sygnalizuje luki | profil, dokumenty, wywiady | odpowiedź + wskazanie braków | czytaj, proponuj | tworzyć faktów o firmie bez źródła | `ai_run_ledger` | **EKRAN BEZ WOŁACZA** — `Organization/OrgContextSummaryBanner.tsx` (renderowany z `views/OrganizationView.tsx:607`) mówi „Teresa context: N claims", ale w całym module **zero** `useOpenChatWithContext`; baner nie prowadzi do Teresy |
| 02 Wywiad | redaguje transkrypt · wyciąga wnioski · zasiewa rozmowę | transkrypcja, kontekst organizacji | wnioski jako propozycje | czytaj, proponuj, szkic | zamykać wywiadu, uznawać wniosku za ustalenie | `ai_run_ledger` + Historia sesji | **DZIAŁA** — `Interview/InsightViewer.tsx:3026` `seedTeresaPrompt`, `:3098` `openChatWithContext`; `InterviewWorkspace.tsx:252`; `POST /api/interview/sessions/:id/ai-parse` |
| 03 Narzędzia (Discovery) | proponuje elementy analizy · nazywa · porządkuje | dane sesji + kontekst organizacji | propozycje do akceptu per element | czytaj, proponuj, szkic z podglądem | zapis bez akceptu, ocena za konsultanta | propozycja → akcept → Historia | **DZIAŁA** — `DiscoveryTools/shared/ToolPhaseAiActions.tsx` renderowany z `ToolDocumentView.tsx:2261,2503`; szczegóły per narzędzie w §2 |
| 04 Ocena | wyjaśnia kryterium · proponuje uzasadnienie · wskazuje luki DRD | macierz, odpowiedzi, dokumenty | wyjaśnienie + propozycja opisu | czytaj, proponuj | **wystawiać ocen i poziomu dojrzałości** (R2) | podgląd + commit | **ZA FLAGĄ** — działająca ścieżka `assessment/drd/DrdHttpMethodWorkspaceScreen.tsx:179 createTeresaPreview`, `:679 handleAskTeresa`, renderowana z `DrdMethodWorkspaceScreen.tsx:935` za `drdHttpSourceOfTruth` = **OFF** (decyzja właściciela 05.09, opcja A). Ścieżka domyślna jest gorsza: `method-workspace/MethodWorkspaceShell.tsx:67` przyjmuje `teresaProps` i **nigdy ich nie renderuje** — `<TeresaPreviewPanel` występuje wyłącznie w testach |
| 05 Inicjatywy | redaguje sekcje karty · proponuje treść · wyjaśnia | karta (24 sekcje), ocena, wywiad | szkic sekcji do akceptu | czytaj, proponuj, szkic | zmieniać bramek cyklu, zatwierdzać przejść | Historia karty | **DZIAŁA** — `TeresaEntryButton` renderowany w sekcji „Akcje": `Initiatives/InitiativeDocumentView.tsx:10139,10157`; generator `server/src/services/initiativeGenerationService.ts` (polski domyślny) |
| 06 Realizacja | wyjaśnia odchylenie · proponuje kartę działania | plan, KPI wykonania, ryzyka | opis problemu + projekt działań | czytaj, proponuj | **wyznaczać odpowiedzialnego i terminu** (D3) | karta działania + Historia | **DZIAŁA** — `Execution/RolloutTab.tsx:1005` `teresaCallout` → `:1098` → `ExecutionHub.tsx:5838`; `useOpenChatWithContext` → `/api/ai/chat/stream` |
| 07 Moja Praca | redaguje notatkę · rozbudowuje ideę · proponuje zmiany na płótnie | idea/notatka/tabela + zaznaczenie | propozycja z podglądem (diff) | wszystkie klasy do „wykonaj z potwierdzeniem" | auto-apply (C6), zadania bez akceptu | Historia + Cofnij | **DZIAŁA** — `MyWork/IdeaTeresaSection.tsx` renderowany z `IdeaMapWorkspace.tsx:5467` jako **zakładka** w `panel/IdeaElementInspector.tsx:412–421`; `useIdeasTeresaBridge`; artefakty w §3 |
| 08 Spotkania | streszcza · wyciąga zadania i decyzje | notatki/transkrypcja | brief + propozycje zadań | czytaj, proponuj | tworzyć zadań bez akceptu | `ai_run_ledger` | **ZA FLAGĄ** — `Meeting/MeetingHub.tsx:265` → `/api/ai-operator/*` za `requireInternalToolsAccess`; front: `src/utils/internalToolsAccess.ts:43` `VITE_INTERNAL_TOOLS_ENABLED !== 'true'` → **default OFF**; blok podpowiedzi po angielsku |
| 09 Wyniki | wyjaśnia odchylenie · proponuje przyczynę · szkicuje definicję miernika | KPI/OKR/ROI, limity, historia okresów | propozycja + karta działania | czytaj, proponuj, szkic | **tworzyć wartości pomiaru** (R2), zamykać karty (R3) | `/api/v8/teresa/proposal*` + `ai_run_ledger` | **DZIAŁA** — `ResultsVNext/teresa/TeresaProposalPanel.tsx` renderowany z `okr/OkrReviewReflectionView.tsx:625`, `roi/RoiCaseLearnWorkspace.tsx:368`, `kpiTool/KpiDeviationCaseSubview.tsx:1239` (trasa `AppRoutes:3135`); backend `routes/v8/teresa.routes.ts:65,211,238`. **Zastrzeżenie runtime:** cały `/api/v8` stoi za `ENABLE_V8_GLOBAL !== 'true'` → 404 **przed** uwierzytelnieniem (`middleware/v8FeatureGate.middleware.ts:15`) — do zmierzenia na żywym środowisku, nie z kodu |
| 10 Finanse | (poza MVP) rozmowa ogólna | kontekst modułu | odpowiedź | czytaj | wszystko poza czytaniem | `ai_run_ledger` | **BRAK integracji** — `Economics/FinanceHub.tsx` woła tylko dok (`useOpenChatWithContext`), zero komponentu Teresy; moduł zdjęty z MVP decyzją właściciela 05.09 |
| 11 Materiały | tworzy szkic dokumentu/prezentacji · redaguje · przepisuje sekcję | polecenie + źródła | artefakt w stanie szkic | do „wykonaj z potwierdzeniem" | publikować, wysyłać, podawać liczb bez rodowodu | Historia artefaktu + wersja | **DZIAŁA** — hub `AppRoutes:2708`; studia (Document Studio, DeckBuilder) **wyłączają dok** (`MainLayout.tsx:134–139`) i osadzają własny czat = wyjątek P5. Zastrzeżenie: ścieżka „Z AI" w Document Studio za `src/utils/zaiTeresaFlag.ts` → **default OFF**. Artefakty w §3 |
| 12 Audyty | wyjaśnia kryterium · proponuje ustalenie | program, kryteria, dowody | propozycja z podglądem pole-po-polu | czytaj, proponuj, wykonaj z potwierdzeniem | wydawać ustalenia/wniosku/zamknięcia samodzielnie | `aiProposalService` + `requireCapability` | **DZIAŁA — wzorzec odniesienia.** `Audit/method/workspace/TeresaProposalCard.tsx` renderowany z `v2/CriterionWorkspaceV2.tsx:1682`, `CriterionWorkspace.tsx:462`, `FindingPanel.tsx:392`; `criterionWorkspaceV2Flag` **default ON**; propozycja bez źródeł nie ma aktywnego „Zastosuj"; bramka `ai.propose`/`ai.commit` po obu stronach |
| 13 Czat | rozmawia · wyjaśnia · tworzy szkice | historia rozmowy + kontekst modułu | odpowiedź / artefakt / karta akcji | wszystkie poza „NIGDY" | działanie bez potwierdzenia przy zapisie | `ai_run_ledger`, `ai_run_events` | **DZIAŁA** — `AIChat/UnifiedChatPanel.tsx` (`AppRoutes:1799`), `TeresaProposalCard` w `MessageRenderer.tsx:866`; moduł zamrożony 05.09 |
| 14 Administracja | — (nadzór **nad** AI, nie asystent) | polityki, budżety, ślad | raporty zużycia i zgodności | czytaj | jakiekolwiek działanie asystenta tutaj | `ai_governance` | **BRAK — zamierzony.** Zero komponentów Teresy w `src/views/admin/` i `src/components/Admin/`; są ekrany `/api/ai-governance`, `/api/ai-budgets` |
| 15 Ustawienia | — (wybór modelu i zgód) | ustawienia organizacji | konfiguracja | czytaj | rozmowa | `ai_settings` | **BRAK** — 9 widoków `SETTINGS_*` jest na czarnej liście `VIEWS_WITHOUT_CHAT_PANEL` (`MainLayout.tsx:107–118`); Teresy tam nie ma wcale. `settings/ai/AIModelSelectionSettings.tsx` to konfiguracja modelu, nie asystent |
| 16 Partner | — (poza rdzeniem doradczym) | — | — | — | — | — | **BRAK integracji** — 11 plików `components/Partner/` + 6 `views/partner/`, zero trafień na Teresę; model komercyjny nierozstrzygnięty (fala 2) |

**Sumy modułów (16):** DZIAŁA **9** (02, 03, 05, 06, 07, 09, 11, 12, 13) · ZA FLAGĄ **2** (04, 08) · EKRAN BEZ WOŁACZA **1** (01) · WOŁACZ BEZ EKRANU **0** · BRAK **4** (10, 14, 15, 16 — z czego 14 zamierzony, 10 i 16 poza MVP).

## 2. Narzędzia Discovery (12)

**Sprostowanie pomiarowe.** Pierwsza próba pomiaru (grep `/api/` wewnątrz `tools/<X>/`) dała „11 z 12 bez AI" i była **fałszywa** — cała warstwa AI mieszka piętro wyżej. Wszystkie 12 idą jedną ścieżką:
`hooks/discovery/toolAi/useToolAI.ts:208` → `useAIStream` → `Api.chatWithAIStream` → **`POST /api/ai/chat/stream`** (`server/src/routes/ai.routes.ts:1627`, zamontowany `Gateway.ts:606`).

Podwójna bramka merytoryczna: `toolAiActions.ts:87 getToolPhaseAiActions` zwraca `[]`, gdy typ nie jest w `TOOLS_WITH_APPLY_HANDLER` (`:57–78`), a `dedicatedToolTypes.ts:41` decyduje o `ToolDocumentView` vs `GenericToolDocumentView`.

| Narzędzie | `ToolType` | Co Teresa tu robi | Wyjście | Handler „zastosuj" | Stan |
|---|---|---|---|---|---|
| Dynamic SWOT | `dynamic-swot` | proponuje pozycje · uzasadnia · przekazuje kandydata dalej | propozycje per pozycja + handoff | `applyDynamicSwotPendingAction:1106` | **DZIAŁA** — jedyne z **własną** powierzchnią propozycji: `tools/DynamicSWOT/TeresaSwotProposals.tsx`, `Api.listSwotProposals/createSwotProposals/acceptSwotProposal` |
| Ambition Decomposer | `ambition-decomposer` | rozbija ambicję na cele cząstkowe | propozycja drzewa celów | `applyAmbitionDecomposerPendingAction:1025` | **DZIAŁA** (ścieżka wspólna) |
| Capability Mapper | `capability-mapper` | proponuje luki zdolności | propozycje luk | `applyCapabilityMapperPendingAction:1003` | **DZIAŁA** |
| Digital | `ai-discovery`, `pain-explorer`, `rpa-scanner`, `process-automation` | proponuje domeny i przypadki | propozycje | `applyOperationalPendingAction:1091` | **DZIAŁA** (4 typy) |
| Focus / Tradeoff | `focus-tradeoff` | nazywa kompromis · proponuje kryteria | propozycja kryteriów | `applyFocusTradeoffPendingAction:1047` | **DZIAŁA** — zakaz: wybierać za człowieka |
| Growth Paths | `growth-paths` | proponuje ścieżki wzrostu | propozycje ścieżek | `applyGrowthPathsPendingAction:932` | **DZIAŁA** |
| Market Forces | `market-forces` | proponuje siły i ich wagę | propozycje sił | `applyMarketForcesPendingAction:959` | **DZIAŁA** — zakaz: podawać wagi jako fakt |
| Narrative Engine | `narrative-engine` | redaguje narrację | szkic tekstu | `applyNarrativeEnginePendingAction:1069` | **DZIAŁA** |
| Operational | `sop-builder`, `a3-problem-solving`, `smed-planner`, `dms-builder`, `inventory-autopilot` | proponuje kroki i mierniki operacyjne | propozycje | `applyOperationalPendingAction:1091` | **DZIAŁA** (5 typów) — zakaz: wartości pomiaru (R2) |
| Portfolio Priority | `portfolio-priority` | proponuje kryteria priorytetu | propozycja rankingu | `applyPortfolioPendingAction:910` | **DZIAŁA** — zakaz: ustalać priorytetu |
| Risk & Uncertainty | `risk-uncertainty` | proponuje ryzyka i scenariusze | propozycje ryzyk | `applyRiskPendingAction:887` | **DZIAŁA** — zakaz: prawdopodobieństwa jako fakt |
| Value Chain | `value-chain` | proponuje ogniwa i luki | propozycje ogniw | `applyValueChainPendingAction:981` | **DZIAŁA** |

**Sumy narzędzi (12):** DZIAŁA **12** · pozostałe 0.

**Dwa ryzyka, nie stan awarii:**
1. **Jakość promptu per narzędzie zależy od jednego pliku** — `hooks/discovery/toolAi/systemPrompts.ts`. Kontrakt „co Teresa robi tu" (kolumna 3) musi mieć odzwierciedlenie w tym pliku, inaczej 12 narzędzi dostaje jedną wspólną osobowość.
2. **Lista `TOOLS_WITH_APPLY_HANDLER` jest ręczna** — komentarz `toolAiActions.ts:51–54` przyznaje wprost, że poza listą przyciski „silently no-op" („Teresa-as-illusion"). Bramka chroni przed iluzją, ale jej zgodność z `useToolAI` nikt nie sprawdza mechanicznie.

## 3. Artefakty Materiałów (8)

| Artefakt | Co Teresa robi | Wejście | Wyjście | Wolno | Zakazane | Ślad | Stan |
|---|---|---|---|---|---|---|---|
| Dokument | pisze szkic · przepisuje sekcję · streszcza | polecenie + źródła | dokument w stanie szkic | do „wykonaj z potwierdzeniem" | publikować, wysyłać | wersja + Historia | **DZIAŁA (wyjątek P5)** — `document-studio.routes.ts` z `generate_deliverable`; studio wyłącza dok i prowadzi rozmowę na miejscu. Zastrzeżenie: ścieżka „Z AI" za `zaiTeresaFlag` = OFF |
| Prezentacja | proponuje strukturę · redaguje slajd | polecenie + dokument źródłowy | deck w stanie szkic | do „wykonaj z potwierdzeniem" | eksportować bez akceptu | Historia decku | **DZIAŁA** — `Presentations/DeckBuilder/AgentPanel.tsx`; `DeckBuilderMelsView.tsx` renderuje `TeresaEntryButton`; typy `deck`/`presentation` w `generate_deliverable` |
| Notatnik | redaguje zaznaczenie · streszcza · tworzy notatkę | notatka + zaznaczenie | zmiana z podglądem | do „wykonaj z potwierdzeniem" | zapis bez podglądu | Historia + Cofnij | **DZIAŁA** — `NotebookInlineAIMenu` + `NotebookRightRail` z `NotebookContent.tsx:93,106`. Flaga `ENABLE_TERESA_NOTE_CREATE` **domyślnie true** (`FeatureFlags.ts:65,276`) — dawny „fantom" z 07-07 ma dziś implementację |
| Mapa myśli | rozbudowuje gałąź · nazywa klaster | mapa + zaznaczenie | propozycja węzłów | szkic z podglądem | auto-apply | Historia + Cofnij | **DZIAŁA** — `useMindMapQuickActions` z `IdeaRecommendationMap.tsx:192,4555`; `ENABLE_TERESA_MINDMAP_SEARCH` = **OFF** (wyszukiwanie w mapie nieaktywne) |
| Tabela (Ideas) | wypełnia komórki · proponuje kolumny | tabela + zakres komórek | propozycja wartości | szkic z podglądem | zmiana schematu bez diff (V8 §1) | Historia | **DZIAŁA** — `useTableQuickActions` z `IdeaTableTool.tsx:206,1132`; `ENABLE_TABLE_AI_EDITOR` **domyślnie true** |
| Whiteboard | znajduje tematy · nazywa klastry | karteczki | propozycje grupowania | szkic z podglądem | nazywać „AI" heurystyki `if/else` | log aktywności AI | **DZIAŁA** — `useWhiteboardQuickActions` z `IdeaWhiteboardTool.tsx:145,2806`. Defekt etykiety: „Auto-clustering (AI)" bez LLM (`09_AI_I_TERESA.md` §2) |
| Process Flow | proponuje kroki · poprawia krok | proces + krok | propozycja before/after | szkic z podglądem | zapis bez walidacji | Historia | **DZIAŁA — wzorzec odniesienia dla podglądu** (`edit_step`); `AIProposalPanel` z `IdeaProcessFlowTool.tsx:127,3982` |
| Arkusz (Excel/Sheet) | wypełnia · przelicza · opisuje | arkusz + zakres | propozycja komórek | szkic z podglądem | liczby bez rodowodu | Historia | **DZIAŁA** — `AIChat/KimiWorkspace/{ExceleView,ExceleRightRail,SpreadsheetArtifactStudio}.tsx`; wspólne wejście przez `ArtifactRightRail` jest OFF, arkusz renderuje starą ścieżkę |

**Sumy artefaktów (8):** DZIAŁA **8**.

## 4. Powierzchnie wspólne — to jest realna dziura

| Komponent | Rola w kanonie | Konsumenci (pomiar) | Wniosek |
|---|---|---|---|
| `src/components/standard/TeresaEntryButton.tsx` | **kanoniczne, jedyne wejście do Teresy** z panelu (decyzja właściciela 01.09 „JEDNA TERESA, W SWOIM OKNIE") | deklaruje 5 plików; **realnie żywe w 2 modułach**: 05 Inicjatywy (`InitiativeDocumentView:10139,10157`) i 11 Materiały (`DeckBuilderMelsView`) | `NotebookRightRail:467`, `IdeaRightPanel:331`, `ExceleRightPanel:337` deklarują je **przez `ArtifactRightRail`**, który jest OFF → renderują starą ścieżkę |
| `src/components/standard/ArtifactRightRail.tsx:627` | wstrzykuje `TeresaEntryButton` w sekcję `actions` — mechanizm wspólny | 3 powierzchnie, **wszystkie przy OFF** | `src/utils/artifactRightRailFlag.ts:57` `export const ENABLE_ARTIFACT_RIGHT_RAIL = false`; plik mówi wprost „ZASTĄPIONE 2026-09-01 … nowe powierzchnie NIE powinny go włączać" — czyli mechanizm wspólny jest **porzucony bez następcy** |
| `src/components/standard/ArtifactRightPanel.tsx` | kanon prawego panelu (7 sekcji) | **9 modułów produktowych** (02, 03, 04, 05, 07, 09, 11, 12, 13); nie renderuje go 7 (01, 06, 08, 10, 14, 15, 16) | kanon panelu **nie ma wejścia do Teresy**: `ARTIFACT_PANEL_SECTION_ORDER` = `actions·properties·relations·evidence·results·comments·history` |
| `src/components/shared/Menu3/AIActionSlot.tsx` | kanoniczny wyzwalacz AI w Menu 3 (standard §3.4; przykład w pliku: `label="Ask Teresa"`) | **0** — jedyny import to własny barrel `Menu3/index.ts` | **biblioteka bez wywołania** |
| `src/components/shared/NModeLayout/AIConsultantPanel.tsx` | dawny panel konsultanta | **0** — wszystkie 17 trafień grepa to komentarze o jego **usunięciu** | martwy plik; do skasowania albo do jawnego wpisu „zachowany celowo" |
| `src/utils/canvas/canvasMutationRisk.ts:86` | `canAutoApply = actor === 'teresa' && risk === 'low'` | **0** | martwa reguła przyznająca Teresie cichy zapis — sprzeczna z zakazem auto-apply (C6) |
| `src/components/method-workspace/MethodWorkspaceShell.tsx:67` | powłoka warsztatu metody | przyjmuje `teresaProps` i **nigdy ich nie renderuje**; `<TeresaPreviewPanel` tylko w testach | props przyjęte i wyrzucone — najczystszy przypadek „ekran bez wołacza" w repo |

**Wniosek jednym zdaniem:** silnik Teresy jest zbudowany, zamontowany i w 29 z 36 pozycji realnie działa — brakuje **jednego wspólnego wejścia w panelu**: kanoniczny przycisk żyje w 2 modułach, wspólny mechanizm jego wstrzykiwania jest wyłączony i porzucony, a kanoniczny slot Menu 3 nie ma ani jednego użycia.

## 5. Sumy zbiorcze (36 wierszy: 16 modułów + 12 narzędzi + 8 artefaktów)

| Klasa | Liczba | Udział |
|---|---:|---:|
| DZIAŁA | 29 | 81 % |
| ZA FLAGĄ | 2 | 6 % |
| EKRAN BEZ WOŁACZA | 1 | 3 % |
| WOŁACZ BEZ EKRANU | 0 | 0 % |
| BRAK | 4 | 11 % |

Z 4 pozycji „BRAK" **trzy są świadome** (14 Administracja — nadzór, nie asystent; 10 Finanse i 16 Partner — poza MVP). Realny dług = **1 moduł BRAK niezamierzony (15 Ustawienia)** + 1 EKRAN BEZ WOŁACZA (01) + 2 ZA FLAGĄ (04, 08) + **cała warstwa wspólnego wejścia z §4**.

## 6. Jak powtórzyć ten pomiar

```bash
cd /private/tmp/m03
# 0. dok globalny i czarna lista widoków
grep -n "UnifiedChatPanel\|VIEWS_WITHOUT_CHAT_PANEL\|isChatCollapsed" src/layouts/MainLayout.tsx | head
# 1. żywe wejścia do Teresy (kanon)
grep -rn "<TeresaEntryButton" src --include='*.tsx' | grep -v __tests__
# 2. flaga wspólnego mechanizmu (dziś OFF)
grep -n "ENABLE_ARTIFACT_RIGHT_RAIL" src/utils/artifactRightRailFlag.ts
# 3. martwe powierzchnie
grep -rn "<AIActionSlot\|<AIConsultantPanel\|<TeresaPreviewPanel" src | grep -v __tests__   # oczekiwane: pusto
# 4. narzędzia Discovery — jedna ścieżka AI
grep -n "chatWithAIStream\|useAIStream" src/hooks/discovery/toolAi/useToolAI.ts | head
grep -n "TOOLS_WITH_APPLY_HANDLER" -A 24 src/components/DiscoveryTools/toolAiActions.ts | head -30
# 5. bramka runtime Wyników
grep -n "ENABLE_V8_GLOBAL" server/src/middleware/v8FeatureGate.middleware.ts
```

Dwie pułapki pomiaru, które trafiły ten dokument:
1. `grep -r --include=*.tsx` bez cudzysłowów w `zsh` zwraca `no matches found` — cytuj glob.
2. **Grep wewnątrz katalogu narzędzia dał „11 z 12 bez AI" i był fałszem** — warstwa AI mieszkała piętro wyżej (§2). Mierz od korzenia trasy, nie od katalogu, którego nazwa pasuje do pytania.
