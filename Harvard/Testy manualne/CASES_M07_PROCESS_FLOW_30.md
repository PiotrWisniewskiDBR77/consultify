# CASES — M07 Ideas · Process Flow · 30 bogatych case'ów

> **Moduł:** M07 Ideas – Process Flow (`/my-work/ideas/workspace/process_flow`)
> **Cel:** 30 realistycznych scenariuszy konsultanta mapującego procesy biznesowe (BPMN / VSM / org / automation), eksploatujących PEŁNE możliwości narzędzia. Każdy case z 4 atrybutami: **Co się dzieje**, **Efekty pracy**, **Grafika**, **Funkcjonalność**.
> **Bazuje na kodzie (zweryfikowane 2026-06-21):**
> - `src/components/MyWork/IdeaProcessFlowTool.tsx` (2754 l.) — główny canvas, stan, hydrate/autosave, skróty
> - `src/components/MyWork/processflow/*` — Toolbar, FlowNode/FlowEdge, LaneSystem, PropertiesPanel, ContextMenu, FloatingToolbar, AIProposalPanel, ReadbackPanel, ValidationResultsPanel, ExportDialog + hooki (validation/aiProposal/readback/export/CRUD/undoRedo/nodes/quickActions/degraded)
> - `src/components/MyWork/ProcessKPIDashboard.tsx`, `VSMTimelineBar.tsx`, `VSMNodeComponent.tsx`
> - `src/components/MyWork/canvas/useIdeaMapSync.ts` (blob-sync `PUT /api/my-work/my-ideas/:id/map`)
> - Backend V8: `/api/v8/process-flow/:id/{validate,ai-proposals,readback,export/:fmt,health,nodes,edges}`
>
> **Legenda:** `[REAL-AI]` = wywołuje realny LLM (`ideaAIGenerator`); `[STUB-AI]` = endpoint V8 stubowy (`useProcessFlowAIProposal`, bez LLM); `[MULTIPLAYER]` = dotyka `CollaborationOverlay` / org-scope; `[MANUAL]` = wymaga myszy (drag/draw); `[DB]` = dowód = blob w bazie po `F5`.
>
> **Zasada dowodu E2E:** każdy create/save/delete potwierdź w Network → `PUT /api/my-work/my-ideas/:id/map` (payload: `nodes[]`, `edges[]`, `extensions.processFlow.{lanes,flowMode,semanticKit,viewState}`; odp. 200 + `version`). Po operacji `F5` → stan przetrwał przez hydratację (`hydrate()` IdeaProcessFlowTool.tsx:921).

---

## Mapa funkcji → najgłębiej pokryte case'y

| Obszar | Case'y |
|---|---|
| Tworzenie kształtów (24 `FlowShape`, kity) | MC-07-01..05 |
| Połączenia / krawędzie / warunki / reconnect | MC-07-06..10 |
| Tryby flow + swim-lanes (VSM / org / BPMN) | MC-07-11..16 |
| Metryki kroków + agregaty (KPI / VSM timeline / savings) | MC-07-17..21 |
| Walidacja (front `validateFlow` + backend V8) | MC-07-22..24 |
| AI (Coach / Summary / next-step ghost / Proposal / Readback) | MC-07-25..28 |
| Eksport / persystencja / konwersja | MC-07-29..30 |

---

# Tworzenie kształtów

### MC-07-01 · Onboarding pracownika — szkielet classic od Start do End · [Tworzenie kształtów]
**Co się dzieje:** Konsultant otwiera pusty process_flow dla idei „Onboarding nowego pracownika". Z pustego stanu klika „Dodaj start", potem z paska BUDOWANIE PROCESU dodaje kolejno Akcja („Podpisanie umowy"), Akcja („Konto IT"), Decyzja („Czy sprzęt gotowy?"), End („Koniec onboardingu"). Etykiety edytuje dwuklikiem w węźle.
**Efekty pracy:** 5 węzłów `flowNode` w stanie + autosave `queueSync` → `PUT /map` z `nodes[]` i `extensions.processFlow.{lanes,flowMode:'classic',semanticKit:'classic'}`. Liczniki w toolbarze: `Kroki 5`, `Lanes 1`. Po `F5` graf wraca z bloba.
**Grafika:** Start = zielone koło, Akcja = biały zaokrąglony prostokąt z 4px lewą krawędzią w kolorze lane'u, Decyzja = bursztynowy romb (obrót 45°, tekst kontr-obrócony `-rotate-45`), End = czerwone koło. Wszystkie w jednym torze „Main Process".
**Funkcjonalność:** `addNode` (IdeaProcessFlowTool.tsx:1059), empty-state „Dodaj start" (:2293), `SHAPE_CONFIG` start/action/decision/end (FlowNodeComponent.tsx:64-67), inline-edit `commitEdit` (FlowNodeComponent.tsx:112), autosave effect (:1607).

### MC-07-02 · Proces reklamacji w kicie BPMN — Event/Task/Gateway · [Tworzenie kształtów]
**Co się dzieje:** Konsultant przełącza semantyczny kit na BPMN (przez Teresa/quick-action lub event `IDEA_WORKSPACE_FLOW_SEMANTIC_EVENT`), pasek pokazuje `BPMN_SHAPES`. Buduje: BPMN Event (start „Zgłoszenie reklamacji"), BPMN Task („Weryfikacja zasadności"), BPMN Gateway („Zasadna?"), dwa Task'i na wyjściach, BPMN Event (koniec).
**Efekty pracy:** Węzły z `data.semanticKit:'bpmn'`; blob zapisuje `semanticKit:'bpmn'`. Walidacja front rozpoznaje start/end jako `bpmn_event` i wymaga ≥1 gateway + ≥1 task.
**Grafika:** Event = niebieskie (sky) koło, Task = niebieski zaokrąglony prostokąt z grubszą ramką, Gateway = romb sky. Badge w toolbarze „Kit bpmn".
**Funkcjonalność:** `SHAPES_BY_SEMANTIC_KIT.bpmn` (ProcessFlowToolbar.tsx:92), semantic-kit listener (IdeaProcessFlowTool.tsx:1857), `validateFlow` gałąź bpmn (:281-298), `shapeStyles.bpmn_*` (FlowNodeComponent.tsx:130-135).

### MC-07-03 · Architektura systemowa zakupów — kit System (Actor/Service/DB) · [Tworzenie kształtów]
**Co się dzieje:** Konsultant mapuje przepływ danych w procesie zakupowym używając kitu System: Actor („Zamawiający"), Service („Workflow zakupowy"), Data Store („ERP — zamówienia"), Decyzja („Limit budżetu?"), Service („Integracja z dostawcą").
**Efekty pracy:** Blob `semanticKit:'system'`; walidacja front wymaga obecności actora i serwisu (bez wymogu start/end w tym kicie).
**Grafika:** Actor = indygo prostokąt (ikona Users), Service = niebieski Box, Data Store = mocno zaokrąglony niebieski (ikona Database). Brak węzłów Start/End — kit nie wymaga granic.
**Funkcjonalność:** `SYSTEM_SHAPES` (ProcessFlowToolbar.tsx:59), `validateFlow` gałąź system — `startShapes=[]` (:300-317), `resolveSemanticInsertShape` system (:162-167).

### MC-07-04 · Łańcuch odpowiedzialności — kit Org (Role/Team/Handoff) · [Tworzenie kształtów]
**Co się dzieje:** Konsultant modeluje przepływ akceptacji faktury międzydziałowo w kicie Org: Rola („Księgowa"), Zespół („Kontroling"), Przekazanie („Handoff do Zarządu"), Decyzja, Rola („CFO"). Sprawdza, że Przekazanie traktowane jest jak punkt rozgałęzienia.
**Efekty pracy:** Blob `semanticKit:'org'`; walidacja wymaga ≥1 roli i ≥1 markera przekazania; `org_handoff` z <2 wyjściami daje ostrzeżenie „wymaga min. 2 wyjść".
**Grafika:** Rola = fioletowy (primary), Zespół = fuksja, Handoff = fioletowy zaokrąglony (ikona GitMerge). Granice działów czytelne kolorem ramki.
**Funkcjonalność:** `ORG_SHAPES` (:65), `validateFlow` org (:319-336) + `org_handoff` w regule ≥2 wyjść (:343), `resolveSemanticInsertShape` org (:168-172).

### MC-07-05 · Pełny VSM produkcji — Supplier→Process→Inventory→Customer · [Tworzenie kształtów]
**Co się dzieje:** Konsultant przełącza tryb flow na „Value Stream" (VSM). Pasek pokazuje `VSM_SHAPES`. Buduje strumień: Dostawca (Supplier), Push Arrow, Zapas (Inventory 1200 pcs), Proces VSM („Cięcie", C/T), Supermarket, Pull Arrow, Proces VSM („Montaż"), Klient (Customer), plus znacznik Kaizen na wąskim gardle.
**Efekty pracy:** Węzły renderowane przez bogate `vsmNodeTypes` (nie `flowNode`); blob `flowMode:'vsm', semanticKit:'vsm'`. Pojawia się dolny `VSMTimelineBar`.
**Grafika:** Supplier/Customer = prostokąty (Truck/Users), Inventory = trójkąt bursztynowy z „1200 pcs", Proces = niebieski z polami C/T, C/O, Up%, Ops, Kaizen = czerwone koło (Zap), Push/Pull = strzałki kierunkowe, Supermarket/FIFO = etykietowane.
**Funkcjonalność:** tryb VSM `nodeTypes` (:586), `addNode` resolvedType dla vsm (:1076), `VSM_SHAPES` (ProcessFlowToolbar.tsx:74), VSM data-fields render (FlowNodeComponent.tsx:300-318), `VSMTimelineBar` mount (:2377).

---

# Połączenia i krawędzie

### MC-07-06 · Spinanie kroków drag-to-connect · [Połączenia] [MANUAL]
**Co się dzieje:** Konsultant w procesie reklamacji łączy węzły przeciągając z prawego uchwytu (source handle) jednego węzła do lewego (target handle) kolejnego — Start→Weryfikacja→Gateway. Każde połączenie tworzy animowaną krawędź.
**Efekty pracy:** `onConnect` dodaje edge `type:'flowEdge'`; fire-and-forget `pfCrud.createEdge` (gdy V8 ON); edge trafia do `edges[]` w `PUT /map`. `pushUndo` przed dodaniem → cofalne.
**Grafika:** Krawędź = smooth-step z animowanym przerywanym ruchem (dash 8 4, `flowEdgeDash`), neutralny slate-400 stroke; przy zaznaczeniu — pulse + cząstka (`animateMotion`) wzdłuż ścieżki.
**Funkcjonalność:** `onConnect` (IdeaProcessFlowTool.tsx:1034), `FlowEdgeComponent` (FlowEdgeComponent.tsx:19), handle source/target (FlowNodeComponent.tsx:204,320), `getIdeasToolInteractionProps` connectMode (:2348).

### MC-07-07 · Etykiety i typy warunków na rozgałęzieniach decyzji · [Połączenia]
**Co się dzieje:** Na Gateway „Zasadna?" konsultant dwuklika krawędzie wychodzące i nadaje etykiety „Tak"/„Nie", a w selektorze typu warunku ustawia `yes` na gałęzi akceptacji i `no` na odrzuceniu. Trzecią ścieżkę oznacza `exception`.
**Efekty pracy:** Edge `data.conditionType` i `label` zapisane do bloba; `handleEdgeLabelChange`/`handleEdgeConditionChange` z `pushUndo`.
**Grafika:** Stroke krawędzi koloruje się semantycznie: `yes`=zielony (`--c-success`), `no`=czerwony (`--c-danger`), `exception`=bursztyn (`--c-warning`). Inline-input + dropdown warunku w `foreignObject` na środku krawędzi.
**Funkcjonalność:** `EDGE_CONDITION_COLORS` (FlowEdgeComponent.tsx:11), `CONDITION_TYPES` (:6), `handleEdgeLabelChange`/`handleEdgeConditionChange` (IdeaProcessFlowTool.tsx:757,770), edycja warunku też w PropertiesPanel (ProcessFlowPropertiesPanel.tsx:177-218).

### MC-07-08 · Reconnect — przepięcie istniejącej krawędzi · [Połączenia] [MANUAL]
**Co się dzieje:** Konsultant zmienia przebieg procesu: chwyta koniec krawędzi „Weryfikacja→Archiwum" i przeciąga go na nowy węzeł „Eskalacja", przepinając wyjście bez usuwania i ponownego rysowania.
**Efekty pracy:** `onEdgeUpdate` usuwa starą krawędź i dodaje nową (`addEdge`); `pushUndo` → cofalne; nowy `edges[]` w blobie.
**Grafika:** Podczas przeciągania końcówka odrywa się i podąża za kursorem; po upuszczeniu krawędź przebiega smooth-step do nowego targetu.
**Funkcjonalność:** `edgesUpdatable={!locked}` + `onEdgeUpdate` (IdeaProcessFlowTool.tsx:2328-2336) — UWAGA: świadomie użyto API react-flow v11 (`edgesUpdatable`/`onEdgeUpdate`), nie v12 (komentarz :2324).

### MC-07-09 · Wstaw krok między dwa połączone węzły (Insert) · [Połączenia]
**Co się dzieje:** W gotowym łańcuchu konsultant zaznacza krawędź „Konto IT→End" i klika „Wstaw". Narzędzie tworzy nowy węzeł na środku krawędzi i rozcina połączenie na dwa (source→nowy, nowy→target).
**Efekty pracy:** `insertBetween`: nowy węzeł w pozycji midX/midY w torze source'a, stara krawędź zastąpiona dwiema; toast „Wstawiono krok"; blob aktualizowany.
**Grafika:** Nowy węzeł „Nowy krok" pojawia się dokładnie pośrodku poprzedniej linii; dwie nowe krawędzie domykają łańcuch bez wizualnej luki.
**Funkcjonalność:** `insertBetween` (IdeaProcessFlowTool.tsx:1171), wymaga zaznaczonej krawędzi (toast „Zaznacz krawędź" gdy brak), kształt zależny od trybu (auto_api/vsm_process/action).

### MC-07-10 · Rozdziel ścieżkę — dodaj alternatywne wyjście decyzji (Split) · [Połączenia]
**Co się dzieje:** Konsultant zaznacza węzeł Decyzja „Limit budżetu?" i klika „Rozdziel". Narzędzie tworzy alternatywny węzeł poniżej i łączy go krawędzią z warunkiem „No".
**Efekty pracy:** `splitPath`: nowy węzeł „Alternatywna ścieżka" + krawędź `conditionType:'no'`, label „No"; toast „Ścieżka rozdzielona". Spełnia regułę „decyzja ≥2 wyjścia".
**Grafika:** Nowa gałąź odchodzi w dół-prawo (offset +250/+80) z czerwoną (no) krawędzią. Decyzja przestaje generować ostrzeżenie walidacji.
**Funkcjonalność:** `splitPath` (IdeaProcessFlowTool.tsx:1231), wymaga zaznaczonej decyzji (toast „Zaznacz decyzję" gdy brak), reguła ≥2 wyjść (validateFlow :342-351).

---

# Tryby flow i swim-lanes

### MC-07-11 · Swim-lanes wg ról — dodawanie i rename torów · [VSM/lanes]
**Co się dzieje:** Konsultant w procesie reklamacji tworzy 3 tory: „Klient", „Obsługa", „Kierownik". Dodaje lane przyciskiem „Lane", zmienia nazwy domyślnych torów dwuklikiem w nagłówku LaneSystem.
**Efekty pracy:** `addLane` (`pushUndo`), `handleLaneRename`; `extensions.processFlow.lanes[]` w blobie (id/label/color). Licznik `Lanes 3`.
**Grafika:** Poziome pasy o wysokości `LANE_HEIGHT=140` z półprzezroczystym tłem w kolorze lane'u, nagłówek po lewej z nazwą. Węzły dziedziczą `laneColor` (lewa krawędź / tło action).
**Funkcjonalność:** `addLane` (:1284), `LaneSystem` + `handleLaneRename` (useProcessFlowNodes), `DEFAULT_LANES` (LaneSystem.tsx:38), render LaneSystem (:2264).

### MC-07-12 · Przeciąganie węzła między torami — auto-reassign laneId · [VSM/lanes] [MANUAL]
**Co się dzieje:** Konsultant przeciąga węzeł „Eskalacja" z toru „Obsługa" do toru „Kierownik". Podczas przeciągania tor docelowy podświetla się; po upuszczeniu węzeł przejmuje laneId i kolor nowego toru.
**Efekty pracy:** `onNodesChange` po `dragging:false` wylicza `laneIdx = floor(y/LANE_HEIGHT)` i nadpisuje `data.laneId`+`laneColor`; `pushUndo` na starcie drag; blob aktualizuje pozycję i lane.
**Grafika:** `dragOverLaneId` podświetla docelowy pas w trakcie ruchu; lewa krawędź węzła zmienia kolor na kolor nowego toru po upuszczeniu.
**Funkcjonalność:** drag-between-lanes (IdeaProcessFlowTool.tsx:862-902), `dragOverLaneId` → LaneSystem highlight (:2273), `dragSnapshotTakenRef` jednorazowy undo na drag.

### MC-07-13 · Reorder torów (góra/dół) i zmiana kolejności procesu · [VSM/lanes]
**Co się dzieje:** Konsultant uznaje, że tor „Kierownik" powinien być na górze; używa strzałek przesunięcia toru w LaneSystem, zmieniając jego pozycję pionową.
**Efekty pracy:** `handleLaneMoveUp/Down` przestawia tablicę `lanes`; węzły pozostają przypisane logicznie po laneId. Blob zapisuje nową kolejność `lanes[]`.
**Grafika:** Pasy zamieniają się miejscami pionowo; nagłówki torów podążają za zmianą.
**Funkcjonalność:** `handleLaneMoveUp/Down` (useProcessFlowNodes), `onMoveUp/onMoveDown` props LaneSystem (:2271-2272).

### MC-07-14 · Kolorowanie torów i motyw palety (theme preset) · [VSM/lanes]
**Co się dzieje:** Konsultant zmienia kolor toru „Obsługa" przez color-picker w nagłówku, a następnie aplikuje globalny motyw palety (event `IDEA_WORKSPACE_THEME_EVENT`), który przemalowuje wszystkie tory wg presetu.
**Efekty pracy:** `handleLaneColorChange` na pojedynczym torze; theme-listener mapuje `FLOW_THEME_PRESETS[themeId]` na wszystkie lane'y (`pushUndo`), zapisuje `extensions.processFlow.themeId`.
**Grafika:** Tła pasów i lewe krawędzie węzłów zmieniają kolor spójnie wg palety; węzły action dostają tło `${laneColor}08`.
**Funkcjonalność:** `handleLaneColorChange` (useProcessFlowNodes), theme-event listener (IdeaProcessFlowTool.tsx:1884-1911), `FLOW_THEME_PRESETS`/`LANE_COLORS` (LaneSystem.tsx:32).

### MC-07-15 · Focus mode — izolacja jednego toru · [VSM/lanes]
**Co się dzieje:** W rozbudowanym procesie (3 tory, 15 węzłów) konsultant aktywuje focus na obiekcie z toru „Obsługa"; canvas pokazuje wyłącznie węzły i krawędzie tego toru, resztę chowa.
**Efekty pracy:** Brak zmian w blobie (filtr tylko widokowy); `filteredNodes/filteredEdges/filteredGhostNodes` zawężone do laneId obiektu fokusu.
**Grafika:** Pozostałe pasy/węzły znikają z widoku; krawędzie międzytorowe (handoff) są ukrywane bo target poza torem.
**Funkcjonalność:** focus-mode filtr (IdeaProcessFlowTool.tsx:804-839), prop `focusMode`/`focusObjectId`.

### MC-07-16 · Tryb Automation — trigger, API call, condition + kandydat automatyzacji · [VSM/lanes]
**Co się dzieje:** Konsultant przełącza tryb na „Automatyzacja", używa „Wstaw wyzwalacz" (`insertAutomationTrigger`), dodaje Wywołanie API i Warunek. Trigger od razu dostaje flagę `automationCandidate` z potencjałem „high".
**Efekty pracy:** Wymusza `flowMode:'automation'` + `semanticKit:'automation'`; węzeł trigger z `data.automationPotential:'high'`; blob z trybem automation.
**Grafika:** Trigger = przerywana ramka primary (ikona Zap), API Call = niebieski, Warunek = przerywany romb. Badge „A" na rogu (zielony=high, bursztyn=medium, szary=low).
**Funkcjonalność:** `insertAutomationTrigger` (IdeaProcessFlowTool.tsx:1296), `AUTOMATION_SHAPES` (ProcessFlowToolbar.tsx:66), automation badge render (FlowNodeComponent.tsx:278-291).

---

# Metryki kroków i agregaty

### MC-07-17 · Metryki kroku przez modal (czas/koszt/FTE/automatyzacja/oszczędności) · [Metryki]
**Co się dzieje:** Konsultant zaznacza krok „Weryfikacja zasadności" i otwiera edytor metryk (quick-action `openMetricsEditor`). Wpisuje czas 4 / jednostka „h", koszt 320, FTE 1.5, potencjał automatyzacji „high", oszczędności „12k PLN/rok".
**Efekty pracy:** `handleSaveMetrics` zapisuje na `data` (duration, durationUnit, cost:Number, fteCount:Number, automationCandidate=potencjał≠low, automationPotential, savingsEstimate); toast „Zapisano metryki kroku"; blob.
**Grafika:** Modal 2-kolumnowy z polami; po zapisie węzeł pokazuje badge'e: niebieski „4h", emerald „$320", primary „1.5 FTE", badge „A" zielony, pill oszczędności emerald.
**Funkcjonalność:** `openMetricsEditor` (IdeaProcessFlowTool.tsx:1309), `handleSaveMetrics` (:1330), modal (:2642-2747), badge render (FlowNodeComponent.tsx:255-298).

### MC-07-18 · Pełne właściwości węzła w PropertiesPanel (metadane + bramka XOR/AND + tor) · [Metryki]
**Co się dzieje:** Konsultant zaznacza Gateway, otwiera panel właściwości (Ctrl/Cmd+klawisz edycji lub FloatingToolbar „Rename"). Ustawia rodzaj bramki XOR vs AND, opis, przypisanego, system, zmienia przypisany tor z dropdown, dopisuje czas/koszt/FTE.
**Efekty pracy:** `onGatewayKindChange` (data.gatewayKind), `onNodeMetadataChange` (description/assignee/system), `onLaneChange` (laneId+laneColor), `onNodeMetricsChange`; wszystko commitowane on-blur do bloba.
**Grafika:** Prawy panel 320px: sekcje Typ węzła, Etykieta, Rodzaj bramki (radio XOR/AND, tylko dla decision/bpmn_gateway/auto_condition), Tor (select), Metadane (opis/assignee/system z ikonami), Metryki (czas+jednostka, koszt, FTE).
**Funkcjonalność:** `ProcessFlowPropertiesPanel` (cały plik), `GATEWAY_SHAPES` (:13), mount panelu (IdeaProcessFlowTool.tsx:2520-2576).

### MC-07-19 · KPI Dashboard — agregaty całego procesu (czas, koszt, handoffy, wąskie gardło) · [Metryki]
**Co się dzieje:** Po uzupełnieniu metryk konsultant otwiera „KPI" w toolbarze. Dashboard liczy sumy i wskazuje węzeł z największą liczbą wejść jako wąskie gardło.
**Efekty pracy:** Brak zapisu (widok pochodny). Liczy: kroki (action+vsm_process) / decyzje, lanes, suma czasu (`parseDuration`, d→8h, min→/60), suma kosztu, liczba handoffów (krawędzie między różnymi laneId), bottleneck (max incoming).
**Grafika:** Pływająca karta 220px prawy-góra: karty „Kroki/Decyzje", „Lanes", „Szac. czas", „Szac. koszt" (gdy >0), „Przekazania" (z ostrzeżeniem ⚠ gdy >3), „Wąskie gardło" (etykieta + liczba wejść).
**Funkcjonalność:** `ProcessKPIDashboard` (cały plik), `parseDuration`/`formatHours` (:32-48), bottleneck/handoff logic (:106-135), mount (IdeaProcessFlowTool.tsx:2384).

### MC-07-20 · VSM Timeline — Lead Time, VA Time, PCE z C/T i zapasów · [Metryki]
**Co się dzieje:** W procesie VSM (MC-07-05) konsultant wpisuje C/T procesom i ilości zapasów. Dolny pasek VSM przelicza Value-Added Time (suma C/T procesów), Wait Time (zapasy ×0.5), Lead Time i PCE.
**Efekty pracy:** Brak zapisu (pochodne). VA = Σ C/T procesów/action, Wait = Σ inventory×0.5, Lead = VA+Wait, PCE = VA/Lead×100.
**Grafika:** Dolny pasek z chipami KPI + dwukolorowy słupek: zielony segment (VA%) / czerwony (NVA%) proporcjonalnie. Formatowanie czasu min/h/d (`formatMinutes`).
**Funkcjonalność:** `VSMTimelineBar` (cały plik), `parseDuration` VSM (d→480, h→60), mount warunkowy gdy istnieją węzły vsm_ (IdeaProcessFlowTool.tsx:2377).

### MC-07-21 · Analiza oszczędności AI — process_savings batch · [Metryki] [REAL-AI]
**Co się dzieje:** Konsultant z wypełnionymi metrykami uruchamia analizę oszczędności (quick-action `runSavingsAnalysis`). AI dostaje istniejące węzły z czasami/kosztami/automationPotential i proponuje batch rekomendacji.
**Efekty pracy:** `generateAIProposal({generatorType:'process_savings'})`; emituje `idea-workspace-ai-proposal` z batch'em; brak węzłów → toast „Najpierw dodaj kroki"; karta `savingsAnalysis` w extensions (gdy zapisana) pokazuje `totalSavingsEstimate`+notes.
**Grafika:** Po wyniku — bursztynowa karta „Savings analysis" z sumarycznym estymatem (emerald) i listą notatek; gdy brak — toast „Brak nowych rekomendacji savings".
**Funkcjonalność:** `runSavingsAnalysis` (IdeaProcessFlowTool.tsx:1356), `savingsAnalysisData` memo (:663), karta savings (:2138-2158).

---

# Walidacja

### MC-07-22 · Walidacja front — wykrywanie błędów struktury (dangling / brak wyjścia / decyzja) · [Walidacja]
**Co się dzieje:** Konsultant celowo buduje wadliwy proces: węzeł bez połączenia wejściowego, akcja bez wyjścia, decyzja z 1 wyjściem, brak End. Klika „Waliduj".
**Efekty pracy:** `validateFlow` (front, synchroniczny) zwraca listę ostrzeżeń: `no-end`, `dangling-*`, `no-exit-*`, `decision-exits-*`; `setWarnings`+`setShowWarnings`. Badge w toolbarze „Ostrzeżenia N".
**Grafika:** Bursztynowy panel pod toolbarem z liczbą ostrzeżeń i listą (ikona AlertTriangle, tekst PL/EN). Badge stanu zmienia kolor emerald→amber.
**Funkcjonalność:** `validateFlow` (IdeaProcessFlowTool.tsx:247-422), `runValidation` (:1467), panel ostrzeżeń (:2007-2032).

### MC-07-23 · Walidacja VSM — brak Supplier/Customer/Process, brak Cycle Time · [Walidacja]
**Co się dzieje:** W trybie VSM konsultant zostawia proces bez węzła Customer i bez C/T na jednym z procesów. Uruchamia walidację.
**Efekty pracy:** `validateFlow` gałąź VSM zgłasza `vsm-no-customer`, `vsm-no-supplier`/`vsm-no-process` (gdy brak) oraz `vsm-no-ct-<id>` dla każdego vsm_process bez `cycleTime`.
**Grafika:** Panel ostrzeżeń wymienia braki VSM po nazwie węzła („VSM: „Montaż" brak Czasu Cyklu").
**Funkcjonalność:** `validateFlow` blok VSM (IdeaProcessFlowTool.tsx:370-419).

### MC-07-24 · Walidacja backendowa V8 — semantyczna + strukturalna z klikalnymi issue · [Walidacja]
**Co się dzieje:** Konsultant (org z V8) wywołuje backendową walidację skrótem Cmd/Ctrl+Shift+V; otwiera się panel walidacji z wynikami z serwera. Klika issue → narzędzie zaznacza powiązany węzeł.
**Efekty pracy:** `POST /api/v8/process-flow/:id/validate` → `ValidationResult{valid, issues[{layer:semantic_first|structural_bounded, severity, object_id, rule, message}], validated_at}`; klik issue zaznacza obiekt na canvasie.
**Grafika:** Prawy panel 320px „Walidacja" z listą issue (severity error/warning), `onClickIssue` zaznacza węzeł i zamyka panel.
**Funkcjonalność:** `useProcessFlowValidation` (cały hook), skrót Shift+V (IdeaProcessFlowTool.tsx:1736), `ValidationResultsPanel` mount (:2436-2461). UWAGA: tylko org z V8 (`requireV8OrgContext`).

---

# AI

### MC-07-25 · AI Coach — analiza procesu, wąskie gardła i rekomendacje · [AI] [REAL-AI]
**Co się dzieje:** Konsultant na gotowym procesie reklamacji klika „AI Coach". Teresa analizuje węzły/krawędzie/lanes i zwraca insights typu bottleneck/improvement z poziomem pewności.
**Efekty pracy:** `runProcessCoach` (ideaAIGenerator); `setCoachInsights`; insights z `type`, `message`, `suggestion`, `confidence`. Brak zapisu do bloba (panel analityczny).
**Grafika:** Indygo panel „AI Coach — Analiza procesu" (TeresaMark); każdy insight z ikoną (AlertTriangle czerwony dla bottleneck / Lightbulb dla improvement) + pill % pewności.
**Funkcjonalność:** `handleAICoach` (IdeaProcessFlowTool.tsx:1487), panel coach (:2035-2082), przycisk toolbar (ProcessFlowToolbar.tsx:352).

### MC-07-26 · Process Summary — totalSteps/decisions/lanes, ścieżka krytyczna, ryzyka · [AI] [REAL-AI]
**Co się dzieje:** Konsultant generuje podsumowanie procesu („Podsumuj"). AI zwraca metryki, szacowany czas, ścieżkę krytyczną, listę ryzyk i rekomendacji.
**Efekty pracy:** `generateProcessSummary`; `setSummaryData`; render totalSteps/decisions/lanes (z fallbackami totalDecisions/totalLanes), estimatedDuration, criticalPath (join „→"), risks[], recommendations[].
**Grafika:** Emerald panel „Podsumowanie procesu": 3 kafle liczbowe (Kroki/Decyzje/Ścieżki), wiersze czas i ścieżka krytyczna, sekcje Ryzyka (czerwone) i Rekomendacje (emerald) z ikonami.
**Funkcjonalność:** `handleProcessSummary` (IdeaProcessFlowTool.tsx:1530), panel summary (:2161-2254).

### MC-07-27 · Next-step ghost nodes — AI sugeruje kolejne kroki po dodaniu węzła · [AI] [REAL-AI]
**Co się dzieje:** Po dodaniu kroku „Konto IT" (shape ≠ end) narzędzie automatycznie w tle prosi AI o propozycję kolejnych kroków; pojawiają się półprzezroczyste węzły-duchy z przyciskiem „+".
**Efekty pracy:** `generateAIProposal({generatorType:'next_step'})` w tle; do 3 ghostów (opacity 0.4) na 15s; klik „+" (`acceptGhostNode`) konwertuje ducha w realny węzeł z nowym id, `pushUndo`, toast „Krok zaakceptowany".
**Grafika:** Ghosty na prawo od dodanego węzła (offset +200/+180), wyblakłe, z zielonym kółkiem „+" w rogu; znikają po 15s jeśli nieprzyjęte.
**Funkcjonalność:** ghost generation w `addNode` (IdeaProcessFlowTool.tsx:1110-1152), `acceptGhostNode` (:1559), render ghostów (:2312-2316), Accept button (FlowNodeComponent.tsx:221-233).

### MC-07-28 · AI Proposal + Semantic Readback (V8) — propozycja operacji i odczyt przejścia · [AI] [STUB-AI]
**Co się dzieje:** Konsultant otwiera panel AI Proposal, wpisuje prompt „dodaj krok kontroli jakości po montażu" → dostaje propozycję operacji z walidacją przed/po i readbackiem; akceptuje lub odrzuca. Osobno generuje Semantic Readback — drzewo przejścia procesu z gałęziami decyzji.
**Efekty pracy:** `POST /:id/ai-proposals` → `AIProposal{operations[], risk_flags, validation_before/after, readback_before/after}`; accept/reject → `POST /ai-proposals/:id/resolve`. Readback: `paths[]` z typami step/decision/parallel_split/join/start/end + warnings.
**Grafika:** Panel AIProposal 384px (akceptuj/odrzuć/edytuj prompt). ReadbackPanel: hierarchiczne wiersze z ikonami (Play start, Square end, GitBranch decyzja, Split/Merge parallel), klik wiersza zaznacza węzeł; sekcja Warnings.
**Funkcjonalność:** `useProcessFlowAIProposal` (cały hook — STUB, bez LLM), `AIProposalPanel`/`ReadbackPanel` mount (IdeaProcessFlowTool.tsx:2463-2518), `useProcessFlowReadback`. Wymaga org V8.

---

# Eksport, persystencja i konwersja

### MC-07-29 · Eksport — PNG (klient) / JSON / Readback (V8) · [Eksport]
**Co się dzieje:** Konsultant kończy mapę reklamacji i eksportuje: najpierw PNG całego canvasu (Cmd/Ctrl+E → dialog), potem JSON struktury i tekstowy readback z backendu.
**Efekty pracy:** PNG = `html-to-image` toPng z białym tłem, download `process-flow-:id.png`. JSON/readback = `GET /api/v8/process-flow/:id/export/:format`, pobranie pliku `.json`/`.txt`.
**Grafika:** Dialog eksportu z wyborem formatu; PNG renderuje aktualny widok canvasu (z lanes, węzłami, krawędziami, badge'ami metryk).
**Funkcjonalność:** `useProcessFlowExport` (cały hook), skrót Cmd+E (IdeaProcessFlowTool.tsx:1731), `ExportDialog` mount (:2578). UWAGA: JSON/readback wymaga V8.

### MC-07-30 · Persystencja, undo/redo, autosave-race i konwersja na inicjatywę/zadania · [Persystencja]
**Co się dzieje:** Konsultant buduje proces (5+ kroków), robi serię edycji (Ctrl+Z/Ctrl+Shift+Z), zapisuje ręcznie (Ctrl+S → snapshot „Process flow checkpoint"), odświeża stronę (F5) i weryfikuje, że wszystko wróciło. Na koniec przez menu „Konwertuj" tworzy z procesu inicjatywę / zestaw zadań / raport / analizę.
**Efekty pracy:** Autosave `queueSync` (debounce) + manualny `flushNow` z `createSnapshot`; undo/redo z `useProcessFlowUndoRedo` (stos w pamięci, `pushUndo` przed każdą mutacją). Po F5 `hydrate` wczytuje blob (loading=true broni przed pustym flush — fix data-loss 2026-06-20/21). Konwersja → `onQuickAction('pf_convert_*')` z selectedIds.
**Grafika:** Toolbar: status zapisu (`syncLabel`), przyciski Undo/Redo (disabled gdy brak historii), Save z spinnerem; menu „Konwertuj" (hover) z 4 pozycjami (Inicjatywa/Zadania/Raport/Analiza).
**Funkcjonalność:** `useIdeaMapSync` queueSync/flushNow, `handleSave` (IdeaProcessFlowTool.tsx:1592), autosave effect (:1607), hydrate + anti-race komentarz (:1004-1012), `useCanvasKeyboard` grammar (:1668), `handleConvert` (:1618), `onConvert` menu (ProcessFlowToolbar.tsx:473-514).

---

## Uwagi dla testera (z kodu, nie z domysłu)

- **V8-zależne funkcje** (walidacja backend MC-07-24, AI Proposal/Readback MC-07-28, JSON/readback export MC-07-29): działają tylko dla org z `isV8Enabled` + `requireV8OrgContext`. Bez V8 — blob jest jedynym źródłem prawdy, a `pfCrud` jest cicho wyłączony (IdeaProcessFlowTool.tsx:632).
- **AI Proposal jest STUB-em** (`useProcessFlowAIProposal` — czysty fetch do V8, brak realnego LLM); realne AI to Coach/Summary/Savings/Next-step (`ideaAIGenerator`).
- **Anti-data-loss:** `loading` startuje `true`, autosave gated `!loading`; eager preferredTool-stamp na hydrate USUNIĘTY (komentarz :1004) — pojedyncza ścieżka sync, brak 409-race.
- **Edge reconnect** używa API react-flow **v11** (`edgesUpdatable`/`onEdgeUpdate`) — nie mylić z v12 (`edgesReconnectable`/`onReconnect`), które na v11 są martwe (komentarz :2324).
- **EdgeRehydrateFix** (:221) re-mierzy uchwyty po hydracji (60/250/600/1200 ms) — bez tego krawędzie po F5 bywały niewidoczne.
- **[MULTIPLAYER]:** `CollaborationOverlay` (:2396) jest zamontowany na każdym procesie (org-scope, wspólny z M06/M09); pełny shared-write to v1.1.
