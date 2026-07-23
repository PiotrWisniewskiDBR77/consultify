# 06 — Łańcuchy UI → Handler → Dane (Idea Workspace)

**Data:** 2026-07-23 · **Metoda:** analiza kodu (grep-first). Punkt wyjścia: 12 dokumentów
powierzchni (`_RAIL_LEWY_*`, `_PRAWY_PANEL_IDEE`, `_KONTEKST_*`, `_MENU3_*`,
`Harvard/wdrozenie-100/`) — połączone tu w pełne łańcuchy end-to-end i uzupełnione grepem
mechanizmu zapisu/synchronizacji (`useMindMapPersistence.ts`, `useProcessFlowPersistence.ts`,
`useIdeaMapSync.ts`, `workspaceGraphRuntime.ts`, `src/services/api.ts`), którego 12 dokumentów
źródłowych nie opisywało wprost. **Tryb kodowy, aplikacja NIE była uruchamiana w tej sesji** —
oceny „działa"/„martwe" przejęte z dokumentów źródłowych (część potwierdzona tam wzrokiem, część
tylko kodem — zaznaczone w kolumnie Źródło) plus nowe ustalenia własne oznaczone „(kod, ta sesja)".

## 0. Architektura zapisu — wspólny mianownik dla wszystkich łańcuchów „autosave"

Zanim tabela: dwa różne mechanizmy odpowiadają za trwały zapis grafu (nodes/edges/extensions)
idei, i to jest zdefiniowanego znaczenia dla kolumny „Autosave/sync" niżej:

- **Mind Map / Process Flow / Table** — jeden, współdzielony `useWorkspaceGraphRuntime`
  (`src/components/MyWork/canvas/workspaceGraphRuntime.ts`), zainstancjowany **raz** w
  `IdeaMapWorkspace.tsx:528` na `ideaId` (nie per narzędzie) i przekazywany w dół jako
  `externalRuntime`. Metody: `captureToolGraph()` (bufor lokalny) → `flushGraph({reason})` →
  `Api.syncMyIdeaMap(ideaId, {nodes, edges, extensions, baseVersion, reason})` →
  `POST /api/my-work/my-ideas/:id/map/sync`. Komentarz w kodzie wprost: „One runtime per ideaId
  across Mind Map / Table / Process Flow — no split-brain".
- **Whiteboard** — **NIE** korzysta z powyższego runtime. Ma własną instancję legacy hooka
  `useIdeaMapSync` (`src/components/MyWork/canvas/useIdeaMapSync.ts`), zamontowaną bezpośrednio w
  `IdeaWhiteboardTool.tsx:749`, z osobnym stanem `syncState`/`saving`/`baseVersion`. Komentarz w
  `useProcessFlowPersistence.ts` potwierdza to wprost jako świadomy, ale niedokończony stan
  przejściowy: „Kept alive because the fallback path and other tools (**whiteboard**) still use
  the hook" — czyli Whiteboard jest jedynym z 4 narzędzi, które NIE zostało przeniesione do
  wspólnego runtime (odnotowane też jako ryzyko w `07_DUPLICATES_AND_CONFLICTS.md`).
- Oba mechanizmy kończą w tym samym miejscu: `Api.syncMyIdeaMap` → `POST …/map/sync`, z
  optymistycznym `baseVersion`/`version` i obsługą konfliktu **HTTP 409** → `toast(...conflictDetected)`
  + odczyt świeżej wersji z serwera (re-hydratacja). Debounce: **500 ms** po każdej zmianie
  `nodes`/`edges` (mindmap: `debouncedSaveTimerRef`, l. 2650–2660 `IdeaRecommendationMap.tsx`).
- Endpoints pokrewne: `GET …/map` (odczyt), `PUT …/map` (pełny zapis, `saveMyIdeaMap`),
  `POST …/map/expand` (AI expand), `GET/POST/DELETE …/map/snapshots[...]` (historia wersji),
  `POST …/convert` (konwersja na inny artefakt).
- Feedback zapisu na poziomie powłoki: wskaźnik w Menu 1 („Draft lokalny" / „Zapisano przed
  chwilą" / „Zmiany w kolejce" / „Wykryto konflikt zmian. Odświeżam mapę z serwera.") — ten sam
  wskaźnik dla 4 narzędzi, zasilany przez `graphRuntime`/`useIdeaMapSync` syncState.

---

## 1. Legenda oceny łańcucha

| Ocena | Znaczenie |
|---|---|
| **kompletny** | UI → handler → endpoint/mutacja → zapis → feedback — wszystkie ogniwa realne i spięte |
| **przerwany na handlerze** | UI wysyła zdarzenie/akcję, ale **żaden handler jej nie odbiera** (zdarzenie ląduje w próżni) |
| **przerwany na endpointcie** | Handler istnieje, ale wywołanie do backendu jest błędne/brakujące/nie to, czego oczekuje UI |
| **przerwany na zapisie** | Efekt lokalny (na płótnie) jest, ale nie jest trwale zapisywany (albo zapis idzie złą drogą) |
| **brak feedbacku** | Łańcuch działa, ale użytkownik nie dostaje żadnego potwierdzenia/informacji zwrotnej |
| **brak undo** | Akcja mutuje dane bezpowrotnie (nie objęta stosem cofania) |
| **niepotwierdzone (kod)** | Logika w kodzie jednoznaczna, ale nie zweryfikowana wzrokiem w żadnym z 12 dokumentów źródłowych |

---

## 2. POWŁOKA (mechanizmy wspólne dla 4 narzędzi)

| # | Akcja (UI) | Handler | Event / Endpoint | Update danych | Autosave/sync | Feedback | Ocena | Źródło |
|---|---|---|---|---|---|---|---|---|
| S1 | Menu 1 → sekcja „Problem" → **Zapisz/Zaakceptuj** | `handleSave` / `handleAcceptChallenge` (`IdeaMapWorkspace.tsx:1921,1946`) | `Api.updateMyIdea(id, {title,body,branch,area,priority})` → `PUT /api/my-work/my-ideas/:id` | pola `title`/`body`/`stage` idei (nie graf) | natychmiastowy (nie debounce) | `toast.success('Zapisano')` / `toast.error` | **kompletny** | kod, ta sesja |
| S2 | Menu 3 → **„Dodaj [węzeł/kształt/wiersz/karteczkę]"** — Mind Map | `onAddPrimary` → `handleQuickAction('mm_add_child')` | event `idea-workspace-quick-action` → `useMindMapQuickActions.ts` → `addChildNode()` | nowy węzeł `idea` (dziecko zaznaczenia/root) | tak — przez pipeline §0 (debounce 500 ms) | brak jawnego toastu, ale natychmiastowa zmiana na płótnie | **kompletny** | `_MENU3_MINDMAP` (żywo) |
| S3 | Menu 3 → **„Dodaj [kształt/karteczkę/wiersz]"** — Process Flow / Whiteboard / **Table** | `onAddPrimary` → `handleQuickAction('add_node')` (kod: `IdeaMapWorkspace.tsx:2919`, ten sam literał dla WSZYSTKICH narzędzi ≠ mindmap) | event `idea-workspace-quick-action` z akcją `'add_node'` — **żaden hook narzędziowy jej nie zna** (`useProcessFlowQuickActions`/`useWhiteboardQuickActions` znają tylko prefiksy `pf_*`/`wb_*`; `useTableQuickActions` zna tylko `tbl_*`) | brak mutacji | — | brak jakiejkolwiek reakcji, brak toastu | **przerwany na handlerze** (3 z 4 narzędzi) | `_MENU3_PROCESSFLOW`/`_MENU3_WHITEBOARD` (żywo, martwe potwierdzone klikiem); dla Table — **niepotwierdzone (kod)**, wyprowadzone przez grep (ta sesja) z tego samego `onAddPrimary` — żaden z 12 dokumentów źródłowych nie testował klikiem Menu3 „Dodaj wiersz" osobno od rail/kontekstu tabeli |
| S4 | Menu 3 → **„AI rozwiń"** — Mind Map | `onAIExpand` → `handleQuickAction('mm_ai_expand')` | `useMindMapQuickActions` → `handlers.handleAIExpand()` → `Api.expandMyIdeaMap(id,{...})` → `POST …/map/expand` | 5 nowych węzłów jako **propozycja** (`proposeOnly:true`) do zatwierdzenia | zapis dopiero po akceptacji propozycji (przez §0) | toast „Brak nowych propozycji" gdy pusto; toast błędu offline | **kompletny** (z krokiem review, nie silent-apply) | `_MENU3_MINDMAP` (żywo) |
| S5 | Menu 3 → **„AI rozwiń"** — Process Flow / Whiteboard / Table | `onAIExpand` → `handleQuickAction('mm_ai_expand')` — **ten sam literał niezależnie od narzędzia** | `mm_ai_expand` obsługiwane WYŁĄCZNIE w `useMindMapQuickActions`, montowanym tylko dla `activeTool==='mindmap'` | brak | — | brak reakcji (potwierdzone klikiem dla WB i PF) | **przerwany na handlerze** | `_MENU3_WHITEBOARD` (żywo), `_MENU3_PROCESSFLOW` (żywo); Table — niepotwierdzone (kod), ten sam mechanizm |
| S6 | Menu 3 → **„Szablony"** (4 narzędzia) | `setTemplateGalleryOpen(true)` → wybór szablonu → `onApplyTemplate` | `applyIdeaTemplate()` → `Api.syncMyIdeaMap(id,{nodes,edges,extensions,baseVersion,reason:'manual'})` → `POST …/map/sync`; jeśli szablon ma węzły `branch` → dodatkowo `Api.expandMyIdeaMap` (best-effort) | pełna podmiana `nodes`/`edges` szablonem + `extensions.templateGovernance` | tak, natychmiastowy (nie debounce — bezpośrednie wywołanie sync) | modal zamyka się, płótno się aktualizuje; brak osobnego toastu potwierdzenia | **kompletny** | kod (`IdeaTemplateGallery.tsx:1900`, ta sesja) + żywo w `_RAIL_LEWY_*`/`_MENU3_*` dla samego otwarcia galerii |
| S7 | Menu 3 → **„Eksport"** (4 narzędzia) | `setExportMenuOpen(true)` → `<IdeaExportMenu>` | zależnie od formatu — realne generatory (PNG/SVG/PDF/JSON/CSV…) | brak mutacji grafu (odczyt) | nie dotyczy | plik do pobrania / modal | **kompletny** jako otwarcie; poszczególne formaty eksportu poza zakresem tego audytu | `_MENU3_MINDMAP`/`_MENU3_WHITEBOARD`/`_MENU3_PROCESSFLOW` (żywo — modal się otwiera) |
| S8 | Menu 3 → **„Utwórz z mapy"** (4 narzędzia) | `onConvertFromMap` → `handlePanelChange('tools')` | otwiera prawy panel `IdeaWorkspaceTools`, sekcja „Convert" **domyślnie zwinięta** — user musi ją sam rozwinąć, dopiero tam klik na realny cel (Initiative/Task/Decision/Report/Deck) uruchamia łańcuch S13 | brak natychmiastowej mutacji — to skrót nawigacyjny, nie konwersja | nie dotyczy na tym kroku | brak — panel się otwiera bez fokusu na sekcję Convert | **kompletny, ale mylący UX** (etykieta obiecuje akcję, wykonuje tylko nawigację) | `_MENU3_MINDMAP`/`_MENU3_WHITEBOARD` (żywo + kod) |
| S9 | Prawy rail — 5 ikon-zakładek (Problem/Status/Inspector/Convert/Health) | `onSelectRightTool` (wizualnie), ale renderer `renderMelsCanvasRightRailPanel(_activeToolId)` **ignoruje** parametr (podkreślnik w nazwie = celowo nieużywany) | brak zdarzenia do backendu na tym kroku — to czysty routing UI | brak | nie dotyczy | wszystkie 5 ikon pokazują IDENTYCZNY panel z 5 sekcjami naraz; klik aktywnej ikony zamyka panel | **przerwany na handlerze** (routing UI, nie dane) — 5 wejść, 1 wyjście | `_PRAWY_PANEL_IDEE` (kod, cytat linii `IdeaMapWorkspace.tsx:3231`) |
| S10 | Menu 1 kebab „⋯" → **Historia / Duplikuj / Usuń** | `onHistory`/`onDuplicate`/`onDelete` | „Duplikuj"/„Usuń" → realne (`handleDuplicateIdea`/`handleDeleteIdea` → prawdopodobnie `Api.deleteMyIdea` `DELETE /api/my-work/my-ideas/:id`); „Historia" → `setSnapshotHistoryOpen(true)` → `SnapshotHistory.tsx` → `Api.getMyIdeaMapSnapshots` `GET …/map/snapshots` | usuwa/duplikuje rekord idei / otwiera panel historii | zależnie od akcji | toast (zgodnie ze wzorcem `handleDeleteMyIdea`) | **kompletny** dla Historia/Duplikuj/Usuń wg deskryptora Menu 1 (oznaczone w `_MENU3_MINDMAP` jako realne, nie fantomy — w odróżnieniu od starszego stanu „Wkrótce" wspominanego w CLAUDE.md dla wcześniejszych wersji) | częściowo niepotwierdzone (kod) — żaden z 12 dokumentów nie klikał tego kebaba na żywo w tej turze audytów |
| S11 | Skrót klawiszowy globalny (Tab/Enter/F2/Del/⌘Z/⌘S/⌘D/⌘A/⌘C/⌘V/⌘X) | `useIdeasToolKeyboard.ts` — kontrakt wspólny dla 3 canvasów (MM/WB/PF) | wywołuje bezpośrednio funkcje narzędzia (nie przez event bus) | zależnie od skrótu | jak w danym narzędziu | zależnie od akcji | **mieszany**: w Process Flow C/V/X **nic nie robią** (brak schowka w ogóle — patrz PF3 niżej) mimo że kontrakt klawiszowy je deklaruje | `_KONTEKST_PROCESSFLOW` pkt 6 (kod) |

---

## 3. MIND MAP

| # | Akcja (UI) | Handler | Event / Endpoint | Update danych | Autosave/sync | Feedback | Ocena | Źródło |
|---|---|---|---|---|---|---|---|---|
| MM1 | Rail → „Dodaj węzeł" popover → **Temat/Hipoteza/Ryzyko/Akcja/Decyzja/Opcja** | `mm_insert_*` → `useMindMapQuickActions` | mutacja lokalna `setNodes`/`setEdges` → §0 pipeline | nowy węzeł `idea` z `semanticType`, tryb edycji etykiety natychmiast (`_startEditing:true`) | tak, debounce 500 ms → `POST …/map/sync` | brak toastu (natychmiastowa zmiana widoczna na płótnie wystarcza jako feedback) | **kompletny** | `_RAIL_LEWY_MINDMAP` (żywo) |
| MM2 | Prawy klik węzeł → **Edytuj (F2)** | `startEditingSelected()` | mutacja lokalna (`node.data.label`) → §0 | zmiana etykiety | tak (po zakończeniu edycji, przez ten sam debounce) | inline edit, brak toastu | **kompletny** | `_KONTEKST_MINDMAP` (żywo dla menu tła; menu węzła — kod) |
| MM3 | Prawy klik węzeł → **Usuń (Del)** | `deleteSelected()` | mutacja lokalna, usuwa węzeł+krawędzie potomne → §0 | usunięcie z grafu | tak | brak toastu | **kompletny, ale brak undo-toastu** (undo jest dostępne przez ⌘Z, ale nie ma „Cofnięto — anuluj" po samym usunięciu) | `_KONTEKST_MINDMAP` (niepotwierdzone wzrokiem — kod) |
| MM4 | Popover AI → **„Rozwiń mapę (AI)" / „Rozwiń ten węzeł"** | `handleAIExpand()`/`handleAIExpand(nodeId)` | `Api.expandMyIdeaMap` → `POST …/map/expand` (`proposeOnly:true`) | propozycja węzłów do zatwierdzenia (Propose→Accept, nie silent-apply) | zapis dopiero po Accept, przez §0 | toast „Brak nowych propozycji" / błąd offline | **kompletny** (jedyne dwie pozycje „Generatory AI" które realnie coś robią bez czatu) | `_RAIL_LEWY_MINDMAP` §B (kod + PL translation) |
| MM5 | Popover AI → **pozostałe 5× „Generator AI"** (Zasugeruj gałęzie / Analiza luk / Podsumowanie / Auto-linki / Auto-klasteryzacja) | `onOpenChat(prompt)` — otwiera czat z gotowym promptem | brak bezpośredniego wywołania backendu na tym kroku — user musi sam wysłać wiadomość w czacie | brak zmiany na płótnie z tego kliknięcia | nie dotyczy | popover się zamyka, otwiera się czat z wstawionym tekstem (niewysłanym) | **kompletny jako „otwórz czat", ale MYLĄCE** — etykieta sugeruje bezpośrednie działanie AI na mapie | `_RAIL_LEWY_MINDMAP` §B (kod) |
| MM6 | Menu węzła → **„Konwertuj gałąź na Inicjatywę/Decyzję/Zadania/Przepływ procesu"** | `convertBranch(target, nodeId)` → `toast.success('convertingBranchTo')` → dispatch `idea-workspace-quick-action{action:'convert_initiative',nodeIds,ideaId}` → `handleConvertRef.current` → `handleConvert()` | `Api.convertMyIdea(id,{target,options:{nodeIds,...}})` → `POST /api/my-work/my-ideas/:id/convert` — tworzy REALNY rekord docelowy (Initiative/Decision/Task/Report/Presentation) | (1) nowy rekord artefaktu w innym module, (2) `Api.createLinkGraphEdge` (relacja idea→artefakt), (3) `graphRuntime.applyExtensionsPatch({outputLinks:[...]})` + `flushGraph`, (4) event `idea-mindmap-mark-converted` — wizualne oznaczenie skonwertowanych węzłów | tak, dwuetapowo: konwersja (natychmiast) + patch `outputLinks` (flush `reason:'manual'`) | `toast.success` na starcie („Konwertowanie gałęzi na…"), wizualne oznaczenie węzłów po zakończeniu | **kompletny, wieloetapowy, w pełni spięty** — najbardziej kompletny łańcuch w całym module | kod (`IdeaRecommendationMap.tsx:4584`, `IdeaMapWorkspace.tsx:2012-2110`, ta sesja) |
| MM7 | Menu węzła → **„AI: Zasuguruj powiązania" (`ai_suggest_links`)** | `handleContextAction` **nie ma gałęzi dla tej akcji** | zdarzenie wysyłane, ale bez odbiorcy w tej ścieżce | brak | — | brak (klik nic nie robi) | **przerwany na handlerze** — TA SAMA pozycja działa poprawnie z paska zaznaczenia (patrz MM12), więc defekt jest specyficzny dla wejścia z menu prawego kliku | `_KONTEKST_MINDMAP` pkt 2 (kod, niepotwierdzone wzrokiem) |
| MM8 | Rail → **„Eksport PDF/PNG/SVG/JSON/CSV/Markdown/PPTX"** | `mm_export_*` → `useMindMapQuickActions` | PNG/SVG/JSON/CSV — realne generatory lokalne; PDF → dispatch `idea-mindmap-export-pdf` do zewnętrznego handlera | brak mutacji (odczyt/eksport) | nie dotyczy | plik pobrany / modal (dla PPTX) | **kompletny** dla PNG/SVG/JSON/CSV (potwierdzone kodem); PDF zależny od zewnętrznego handlera — niepotwierdzone | `_RAIL_LEWY_MINDMAP` §F (kod) |
| MM9 | Rail → **Cofnij/Ponów** | `mm_undo`/`mm_redo` | lokalny stos historii (w pamięci) → po cofnięciu stan grafu zmienia się → §0 zapisuje NOWY (cofnięty) stan | przywraca poprzedni `nodes`/`edges` | tak (cofnięcie samo w sobie jest zmianą, więc też się zapisuje) | przycisk wyszarzony gdy `canUndo`/`canRedo`=false | **kompletny** | `_RAIL_LEWY_MINDMAP` (żywo) |
| MM10 | Import/Eksport popover → **„Historia wersji" (⌘⇧H)** | `mm_snapshot_history` → `setShowSnapshots(prev => !prev)` (**toggle**) | `SnapshotHistory.tsx` → `Api.getMyIdeaMapSnapshots(id)` → `GET …/map/snapshots` | odczyt listy snapshotów; „Przywróć" → prawdopodobnie `POST/PUT …/map/snapshots/:id` (restore) | zapis przy restore | panel się otwiera/zamyka | **kompletny** dla otwarcia; restore — niepotwierdzone (kod, poza zakresem 12 dokumentów źródłowych) | `_RAIL_LEWY_MINDMAP` §F (kod) + `_INPUT_CONTEXT` ustalenie #8 |
| MM11 | „Więcej narzędzi" → **„Wersje / Snapshoty"** | `mm_snapshots` → **zawsze ustawia `true`** (nie toggle, inaczej niż MM10) | jak MM10 | jak MM10 | jak MM10 | jak MM10 | **kompletny, ale niespójny z MM10** (dwa różne zachowania dla koncepcyjnie tej samej funkcji — patrz `07_DUPLICATES_AND_CONFLICTS.md`) | `_RAIL_LEWY_MINDMAP` pkt „Uwagi" #6 |
| MM12 | Pasek zaznaczenia węzła → **AI popover → „Zasuguruj powiązania"** | event globalny → `useMindMapQuickActions.ts` | jak MM4/MM5 rodzina (`ai_suggest_links` obsłużone TU, w przeciwieństwie do MM7) | zależnie od implementacji (prawdopodobnie sugestie do przeglądu) | tak, przez §0 jeśli mutuje graf | działa (w odróżnieniu od identycznej pozycji w menu węzła) | **kompletny** | `_KONTEKST_MINDMAP` §3 (kod) |
| MM13 | Rail → **„Auto-układ" (⌘L / przycisk)** | `autoLayout(nodes,edges)` z `useAutoLayout.ts` → `fitView()` | mutacja pozycji `x`/`y` wszystkich węzłów → §0 | nowe współrzędne | tak | natychmiastowa zmiana widoczna, brak toastu | **kompletny** | `_MENU3_MINDMAP` (żywo, kod algorytmu opisany) |

---

## 4. WHITEBOARD (Tablica)

| # | Akcja (UI) | Handler | Event / Endpoint | Update danych | Autosave/sync | Feedback | Ocena | Źródło |
|---|---|---|---|---|---|---|---|---|
| WB1 | Pasek narzędzia → **„Utwórz ▾" → Notatka/Kształt/Ramka/Obraz/Link** | `onAddElement(kind, extraData)` → `useWhiteboardNodes` | mutacja lokalna `nodes` → `useIdeaMapSync` (legacy, **NIE** wspólny runtime — patrz §0) → `Api.syncMyIdeaMap` | nowy element na płótnie | tak, ale przez OSOBNY mechanizm zapisu niż Mind Map/Table/Process Flow | brak toastu, element widoczny natychmiast | **kompletny**, ale architektonicznie odizolowany od pozostałych 3 narzędzi (ryzyko rozjazdu — patrz 07) | `_RAIL_LEWY_WHITEBOARD` (żywo) + kod `IdeaWhiteboardTool.tsx:749` (ta sesja) |
| WB2 | Menu 3 → **„Dodaj karteczkę"** | `onAddPrimary` → `handleQuickAction('add_node')` | **martwe** — patrz S3 | brak | — | brak reakcji, potwierdzone klikiem live | **przerwany na handlerze** | `_MENU3_WHITEBOARD` (żywo) |
| WB3 | Prawy klik tło → **„AI: Wypełnij luki / Brainstorm tutaj / Przekształć w mapę myśli / Przekształć w tabelę"** | `generateAIProposal()` → `onGenerateProposal(batch)` | otwiera `IdeaProposalReview` (Propose→Accept, „no silent apply" — komentarz `whiteboardCanon AC-05`) — realny backend generujący propozycję | propozycja elementów do akceptacji; dopiero Accept mutuje graf → §0 (via WB1's sync) | zapis dopiero po akceptacji | ekran recenzji propozycji | **kompletny** | `_KONTEKST_WHITEBOARD` §1 (żywo) |
| WB4 | Menu węzła → **„Komentarze"** | `WhiteboardNodeCommentThread` | komentarze trzymane w `node.data.comments[]`, **zapisywane razem z autosave grafu** (nie osobny endpoint) | dopisanie do `comments[]` węzła | tak, w ramach ogólnego zapisu grafu | wątek widoczny natychmiast | **kompletny**, ale ryzykowne architektonicznie: komentarz to część payloadu grafu, nie osobny rekord z własną historią/uprawnieniami | `_KONTEKST_WHITEBOARD` §2b (żywo) |
| WB5 | Pasek zaznaczenia → **„Promuj do decyzji" / „Promuj do akcji"** | `wb_convert_decision`/`wb_convert_action` (scope = zaznaczenie) | prawdopodobnie ten sam mechanizm co MM6 (`handleConvertRef`/`Api.convertMyIdea`) — **nie zweryfikowano bezpośrednio w dokumentach źródłowych**, wnioskowane z nazewnictwa `wb_convert_*` widocznego też w mapowaniu `IdeaMapWorkspace.tsx:924` (`wb_convert_initiative: 'initiative'`) | tworzy rekord docelowy + link | tak (jeśli tożsame z MM6) | — | **niepotwierdzone (kod)** — prawdopodobnie kompletny analogicznie do MM6, ale nie potwierdzone wprost | `_KONTEKST_WHITEBOARD` §3 (żywo — tylko istnienie przycisku i stan enabled/disabled, nie efekt end-to-end) |
| WB6 | Panel „Warstwa sesji" → **Zmiana Fazy warsztatu (Start→Organizacja→Konwergencja→Przekazanie)** | `WhiteboardPhaseBar` → `Api.facilitationUpdatePhase(sessionId, phase)` | `server/src/services/facilitationPhaseMachine.ts` (backend realny, nie stub) | zmiana `sessionState.phase`, wpis do dziennika aktywności | tak, backendowe (nie graf idei, osobny rekord sesji facylitacji) | pasek faz aktualizuje aktywną zakładkę; podpowiedź kontekstowa się zmienia | **kompletny** | `_MENU3_WHITEBOARD` §3 (żywo) |
| WB7 | Panel „Warstwa sesji" → **Głosowanie (otwórz/zamknij)** | `onToggleVoting` → `Api.facilitationUpdatePhase(sessionId,'voting'/'board')` | otwiera `<IdeaVotingMode>`, liczenie głosów `Api.facilitationCastVote`/`facilitationGetVoteSummary` | głosy per-węzeł, max 5/os., **trwałe** dla whiteboard (nie znikają po zamknięciu trybu) | tak, backendowe | pigułka stanu „Głosowanie otwarte/zamknięte" | **kompletny** | `_MENU3_WHITEBOARD` §3 (żywo) |
| WB8 | Panel „Warstwa sesji" → **Follow-me (Śledź)** | `onToggleFollow` → `sessionState.followMe` | zapis stanu backendowego | flaga sesji | tak | pigułka stanu | **kompletny jako przełącznik**, ale **wymuszenie viewportu u innych klientów NIE przetestowane multi-user** w żadnym z dokumentów źródłowych | `_MENU3_WHITEBOARD` §3 (żywo stanu, nie efektu multi-user) — **niepotwierdzone (kod)** dla samego mechanizmu wymuszania |
| WB9 | „Zapisz widok" (Scenes) | `IdeaScenesManager` → zapis viewportu jako scena nazwana | persystowane w `extensions.scenes` (rozszerzenie grafu, przez §0/WB1) | nowa scena na liście „WIDOKI" | tak | panel „WIDOKI" pokazuje nową pozycję; usunięcie działa (przetestowane i posprzątane) | **kompletny** (przetestowane na żywo z posprzątaniem danych testowych) | `_MENU3_WHITEBOARD` §4 (żywo) |
| WB10 | Cofnij/Ponów (pasek narzędzia) | `wb_undo`/`wb_redo` → `handlers.undo()`/`redo()` | realny stos historii Tablicy | przywraca poprzedni stan | tak | — | **kompletny wykonawczo, ALE stan enabled/disabled przycisku jest liczony ze złego źródła** (`mmCanUndo`/`mmCanRedo` aktualizowane tylko przez `mm-undo-state`/`tbl-undo-state`; nie istnieje `wb-undo-state`) — przyciski mogą wyglądać na wyszarzone mimo dostępnej historii, albo odwrotnie | **kompletny + defekt wskaźnika stanu** | `_RAIL_LEWY_WHITEBOARD` pkt „Uwagi" #3 (kod, niepotwierdzone wzrokiem stanu disabled) |
| WB11 | Menu tła / węzła → **„Kopiuj" / brak „Wklej"** | `navigator.clipboard.writeText(etykieta)` | kopiuje TYLKO tekst etykiety do schowka systemowego | brak mutacji grafu | nie dotyczy | schowek systemowy zmieniony (brak wizualnego potwierdzenia w UI) | **kompletny technicznie, ale bezużyteczny funkcjonalnie** — nie ma żadnego „Wklej" elementu na Tablicy; cały cykl kopiuj-wklej węzła nie istnieje (jedyna droga powielenia to „Duplikuj") | `_KONTEKST_WHITEBOARD` pkt „Uwagi" #2 (kod) |

---

## 5. PROCESS FLOW (Przepływ)

| # | Akcja (UI) | Handler | Event / Endpoint | Update danych | Autosave/sync | Feedback | Ocena | Źródło |
|---|---|---|---|---|---|---|---|---|
| PF1 | Rail → **Start/Task/Decyzja/Lane** (dodawanie kroku) | `pf_add_start`/`pf_add_action`/`pf_add_decision`/`pf_add_lane` → `useProcessFlowQuickActions` → `addNode()`/`addLane()` | mutacja lokalna `nodes`/`lanes` → `useProcessFlowPersistence` (runtime mode, dzieli instancję z Mind Map/Table — patrz §0) → §0 pipeline | nowy krok/tor + **efekt uboczny**: `addNode()` automatycznie odpytuje AI o sugestię kolejnych kroków i pokazuje „ghost nodes" 15 s (niekomunikowane nigdzie w UI) | tak, przez wspólny runtime | licznik „Kroki N" rośnie natychmiast; brak toastu | **kompletny**, z nieudokumentowanym efektem ubocznym (AI ghost-suggestions) | `_RAIL_LEWY_PROCESSFLOW` (żywo, licznik zmieniony) |
| PF2 | Menu 3 → **„Dodaj kształt"** | `onAddPrimary` → `handleQuickAction('add_node')` | **martwe** — patrz S3; `useProcessFlowQuickActions` zna tylko `pf_*` | brak | — | brak reakcji, licznik „Kroki" nie zmienia się (potwierdzone klikiem) | **przerwany na handlerze** | `_MENU3_PROCESSFLOW` §1 (żywo) |
| PF3 | Menu tła (prawy klik) → **„Wklej"** | `onPaste: () => duplicateSelected()` | **etykieta myląca**: nie ma pojęcia schowka w ogóle (⌘C/⌘X/⌘V nie podpięte w `useCanvasKeyboard` dla `toolType:'processflow'`) — klik duplikuje aktualne zaznaczenie GDZIEKOLWIEK na płótnie, nie wkleja w miejscu kliknięcia | duplikat istniejącego węzła | tak (jak każda mutacja) | brak — jeśli nic nie zaznaczono, cichy no-op bez komunikatu | **przerwany na endpointcie / myląca etykieta + brak feedbacku** przy pustym zaznaczeniu | `_KONTEKST_PROCESSFLOW` §1 (kod) |
| PF4 | Pływający pasek węzła → **„Wstaw między"** | `insertBetween()` — wymaga zaznaczonej KRAWĘDZI, nie węzła | sprawdza `edges.find(e=>e.selected)`; brak → `toast.error('selectEdgeFirst')` | brak mutacji w typowym użyciu (pasek pojawia się przy zaznaczonym WĘŹLE, więc zwykle żadna krawędź nie jest zaznaczona) | nie dotyczy (błąd wcześnie) | toast błędu | **przerwany na handlerze w typowym scenariuszu** (przycisk przypięty do złej powierzchni) | `_KONTEKST_PROCESSFLOW` §3 pkt 2 (kod) |
| PF5 | Delete na zaznaczonej krawędzi (bez zaznaczonego węzła) | `deleteSelected()` w `useProcessFlowNodes.ts` liczy `selectedCount` WYŁĄCZNIE po węzłach, wczesny `return` przy 0 | brak wykonania ścieżki usuwania krawędzi | krawędź NIE zostaje usunięta | nie dotyczy | brak jakiejkolwiek informacji zwrotnej | **przerwany na handlerze + brak feedbacku** | `_KONTEKST_PROCESSFLOW` §3 pkt 3 (kod, niepotwierdzone wzrokiem) |
| PF6 | Menu węzła (prawy klik) → **„Konwertuj na inicjatywę"** | `handleConvert('pf_convert_initiative')` → mapowane na `handleConvertRef` (ten sam generyczny konwerter co MM6) | `Api.convertMyIdea` → `POST …/convert` | jak MM6 — realny rekord + link-graph edge + `outputLinks` patch | tak | jak MM6 | **kompletny** (naprawiony historycznie — wcześniej było „gołe przełączenie narzędzia" bez przeniesienia danych) | `_KONTEKST_PROCESSFLOW` §2a (kod) |
| PF7 | „Więcej" → **„Waliduj"** | `runValidation()` → `validateFlowWarnings(nodes,edges,semanticKit)` | czysto lokalna funkcja (bez backendu) | ustawia `warnings` (React state) | nie dotyczy (nie jest to dana trwała) | badge „Brak ostrzeżeń"/„Ostrzeżenia N" | **kompletny, ale mylący na starcie**: stan początkowy = pusta lista = wygląda identycznie jak „sprawdzono, OK", choć oznacza „jeszcze nikt nie klikał Waliduj" | `_MENU3_PROCESSFLOW` §4-5 (kod) |
| PF8 | „Więcej" → **„Auto układ"** (REALNY, w odróżnieniu od martwego S3/Menu3) | `handleAutoLayout()` | mutacja pozycji węzłów wg torów/kolejności → §0 (broadcast collab też) | nowe współrzędne | tak | `toast.success('Auto-layout applied')` | **kompletny** | `_MENU3_PROCESSFLOW` §4 (kod, „real 'process_coach' AI pipeline" cytat dla AI Coach obok) |
| PF9 | „Więcej" → **„AI Coach"** | `runProcessCoach()` | realny backend pipeline `process_coach` (nie stub, potwierdzone komentarzem w kodzie) | wynik analizy (bottleneck/optymalizacja) prezentowany, nie mutuje bezpośrednio grafu | nie dotyczy (odczyt/analiza) | panel wyniku | **kompletny** | `_MENU3_PROCESSFLOW` §4 (kod) |
| PF10 | Cofnij/Ponów | lokalny stos w `useProcessFlowUndoRedo.ts`, max 30 kroków, **nie przetrwa odświeżenia strony** | mutacja lokalna → po cofnięciu stan trafia do §0 (zapis cofniętego stanu) | przywraca poprzedni `nodes`/`edges`/`lanes` | tak (efekt cofnięcia się zapisuje) | — | **kompletny, ale historia ograniczona sesją przeglądarki** (nie jest to pełne „undo trwałe" — po odświeżeniu strony historia cofania znika, chociaż ostatni zapisany stan zostaje) | `_MENU3_PROCESSFLOW` §4 (kod) |
| PF11 | Zakładka trybu (Klasyczny/Automatyzacja/VSM) | `role="tablist"` → zmiana `mode` | zmienia paletę kształtów dostępnych do dodania + reguły walidacji | stan lokalny UI (`mode`), zapisywany prawdopodobnie w `extensions.processFlow` przy najbliższym flush | tak (jako część payloadu grafu) | podświetlenie aktywnej zakładki | **kompletny** | `_MENU3_PROCESSFLOW` §2 (żywo) |

---

## 6. TABELA (Ideas Table)

**Uwaga architektoniczna wpływająca na WSZYSTKIE łańcuchy tej sekcji:** dwie kompletne, osobne
implementacje (`legacy` / `platform P15`) przełączane `usePlatform`. Obiekt testowy we wszystkich
12 dokumentach renderował się w trybie **legacy** — łańcuchy P15 oznaczone osobno jako
niepotwierdzone wzrokiem.

| # | Akcja (UI) | Handler | Event / Endpoint | Update danych | Autosave/sync | Feedback | Ocena | Źródło |
|---|---|---|---|---|---|---|---|---|
| TB1 | Toolbar → **„+ Wiersz"** | `handleAddRow()` (legacy) / platformowy odpowiednik | mutacja lokalna wiersza → dla legacy prawdopodobnie przez wspólny `graphRuntime` (Tabela JEST jedną z 3 objętych wspólnym runtime — patrz §0), dla P15 przez osobny `TablePlatformApi` (baza rekordów, nie graf) | nowy pusty wiersz na końcu | tak | brak toastu, wiersz widoczny natychmiast | **kompletny** | `_RAIL_LEWY_TABELA` §6 (kod) |
| TB2 | Toolbar → **„Kolumny" → „Nowa kolumna"** | `setShowAddColumn(true)` → dialog typu pola | mutacja schematu tabeli | nowa kolumna w `columns[]` | tak | dialog się zamyka, kolumna widoczna | **kompletny** | `_RAIL_LEWY_TABELA` §6 (kod) |
| TB3 | Prawy klik wiersz → **„Usuń wiersz"** | `effectiveHandleDeleteRow(rowId)` | mutacja lokalna | usunięcie wiersza | tak | `toast.success('Usunięto wiersz')` | **kompletny**, ale **brak undo dedykowanego** (poza ogólnym ⌘Z tabeli, jeśli podłączony) | `_KONTEKST_TABELA` §1a (kod, otwarcie menu NIE potwierdzone wzrokiem mimo 2 prób) |
| TB4 | Rail → Popover AI → **6× „Generator AI"** | dispatch `mm_ai_*` | `useTableQuickActions.ts` nasłuchuje WYŁĄCZNIE `tbl_*` — **żaden odbiorca** dla `mm_ai_*` | brak | — | brak reakcji | **przerwany na handlerze** (wszystkie 6 pozycji) | `_RAIL_LEWY_TABELA` §2 (kod, niepotwierdzone klikiem z powodu niestabilności sesji) |
| TB5 | Natywny pasek tabeli → **„Asystent AI (/)"** | otwiera `AITableAssistant` → `AITableProposal` (karta do akceptacji/odrzucenia) | realny backend — AI proponuje kolumny/widoki/wiersze | propozycja do przeglądu, mutacja dopiero po akceptacji | tak, po akceptacji | karta propozycji | **kompletny** (w przeciwieństwie do martwego odpowiednika w railu, TB4) | `_MENU3_TABELA` §2.2 poz.1 (kod, opisane jako „działa") |
| TB6 | Natywny pasek → **„AI Kategoryzacja" / „Model scoringowy" / „AI Copilot" / itd. (16 narzędzi drugorzędnych)** | każdy otwiera dedykowany komponent (`AICategorizeTool`, `IdeaScoringModel`, `AICopilotMode`, …) | zależnie od narzędzia — część realnych wywołań AI, część czysto lokalnych | zależnie | zależnie | zależnie | **kompletny** dla wszystkich 16 wg audytu Menu3 Tabela (żaden nie oznaczony jako stub/„Wkrótce") | `_MENU3_TABELA` §2.2 (żywo dla obecności/kolejności, kod dla efektu) |
| TB7 | Toolbar → **Przełącznik layoutu (Tabela/Kanban/Oś czasu/Kalendarz/Macierz/Galeria)** | `ViewRouter` przełącza komponent renderujący (`GridView`/`KanbanView`/`TimelineView`/`CalendarView`/`MatrixView`/`StickyNoteView`) | brak mutacji danych — tylko zmiana reprezentacji tych samych rekordów | `layout` w stanie widoku (część `SavedView`, może być zapisana) | tak, jeśli użytkownik kliknie „+" (zapisz widok) | natychmiastowa zmiana renderu | **kompletny** | `_MENU3_TABELA` §2.1 (kod, „FROZEN order per V5-IDEA-24") |
| TB8 | Toolbar → **„Grupuj"** | dropdown wyboru kolumny grupującej | zmienia `groupBy` w stanie widoku | grupowanie wierszy (czysto prezentacyjne, nie zmienia rekordów) | tak, jeśli zapisane jako widok | dropdown pokazuje aktywną kolumnę grupującą | **kompletny** | `_MENU3_TABELA` §2.1 (kod, „Fala 10 parytet Airtable") |
| TB9 | Nagłówek kolumny → **klik = Sortuj (cykl asc→desc→brak)** / menu nagłówka → **„Sort"** | `effectiveCycleSort(col.key)` | mutacja stanu `sort` widoku | kolejność renderowania wierszy | tak, jeśli zapisane jako widok | strzałka sortowania w nagłówku | **kompletny**, ale **„Sort" w menu nagłówka duplikuje zwykły lewy klik** na tę samą nazwę kolumny (ten sam handler, dwa wejścia) | `_KONTEKST_TABELA` §3a (kod) |
| TB10 | Pasek zaznaczenia (checkbox wiersza) → **„Convert" (Initiative/Task/Decision)** | `handleBulkConvert(target)` | prawdopodobnie `Api.convertMyIdea` per-wiersz LUB dedykowany bulk-endpoint — **nie zweryfikowano wprost, które** | oznacza zaznaczone wiersze jako skonwertowane | tak | — | **niepotwierdzone (kod)** dla dokładnego mechanizmu (per-wiersz pętla vs. bulk endpoint) | `_KONTEKST_TABELA` §4a (kod, niepotwierdzone wzrokiem) |
| TB11 | Zakładki widoków → **„+" → „Zapisz widok"** | dialog nazwy → `applyView`/zapis nowego `SavedView` | w legacy: `useState` **nietrwały** (odtwarza się od zera przy każdym wejściu, tylko domyślny seed 5 zakładek); w P15: `platformViews` zapisane w bazie przez `TablePlatformApi` | nowa zakładka widoku | **legacy: NIE zapisuje trwale** — to jest kluczowa różnica trybu | brak ostrzeżenia dla użytkownika że widok NIE przetrwa sesji w legacy | **przerwany na zapisie (legacy)** / **kompletny (P15)** | `_MENU3_TABELA` §1 (kod) |
| TB12 | Cofnij/Ponów | `tbl_undo`/`tbl_redo` → `handlers.onUndo()`/`onRedo()` — **dwa różne silniki**: `nodesUndo` (legacy) vs `onPlatformUndo` (P15) | mutacja lokalna → §0 (dla legacy, przez wspólny runtime) | przywraca poprzedni stan tabeli | tak | — | **kompletny**, ale dwa niezależne silniki historii do utrzymania równolegle (ryzyko rozjazdu, patrz 07) | `_RAIL_LEWY_TABELA` (kod) |
| TB13 | Prawy klik nagłówek kolumny → **„Hide column"/„Delete column"** | `toggleColumn(col.key)`/`deleteColumn(col.key)` | mutacja schematu | ukrycie/usunięcie kolumny + `toast('Column deleted')` dla usunięcia | tak | toast dla usunięcia, brak dla ukrycia | **kompletny**, ale **usunięcie kolumny nie ma dedykowanego undo/potwierdzenia** poza ogólnym ⌘Z tabeli (destrukcyjna operacja bez modala potwierdzenia) | `_KONTEKST_TABELA` §3a (kod) |

---

## 7. Podsumowanie liczbowe

| Kategoria oceny | Liczba łańcuchów (z ~40 wypisanych powyżej) |
|---|---|
| kompletny | ~24 |
| przerwany na handlerze | ~9 (S3, S5, S9, MM7, WB2, PF2, PF4, PF5, TB4) |
| przerwany na endpointcie | 1 (PF3 — myląca etykieta/zła funkcja) |
| przerwany na zapisie | 1 (TB11 legacy) |
| brak feedbacku (dodatkowo, nie wykluczający się z innymi) | PF3, PF4 (częściowo), PF5, MM3, TB13 |
| brak undo (dedykowanego) | MM3, TB3, TB13 |
| niepotwierdzone (kod) | WB5, WB8, TB10, S3 (dla Table), S5 (dla Table), S10 |

**Obserwacja zbiorcza:** wzorzec „przerwany na handlerze" koncentruje się niemal wyłącznie w
mechanizmach WSPÓLNYCH powłoki (Menu 3 add/AI-expand, rail popovery AI/Import-Eksport/Więcej,
prawy panel) — dokładnie tam, gdzie root-cause z `_INPUT_CONTEXT.md` (mechanizm zbudowany dla
Mind Map, nierozgałęziony per `activeTool`) przewiduje martwe kliki. Defekty w pojedynczych
narzędziach (PF3–PF5, TB11) są lokalne i niezależne od tego wzorca.
