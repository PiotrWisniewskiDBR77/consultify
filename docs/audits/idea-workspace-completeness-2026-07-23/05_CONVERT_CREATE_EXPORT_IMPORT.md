# 05 — Convert / Create / Export / Import / Templates (Idea Workspace)

**Data:** 2026-07-23 · **Zakres:** Menu 1 Convert (`IdeaConvertMenu`) · prawy panel Convert (`IdeaWorkspaceTools`) · menu kontekstowe per narzędzie · „Utwórz z mapy" (Menu 3) · `IdeaExportMenu` (export + import wklejany) · CSV import (Table) · `IdeaTemplateGallery` · konwersja poza workspace (M05 lista — `ConvertToOutputMenu`/`conversionService.ts`).
**Metoda:** analiza kodu (grep-first), read-only, brak uruchomienia aplikacji. Cytaty ścieżek/linii z `/private/tmp/odbior-4` (gałąź `odbior/lokalny-2026-07-23`).

---

## 0. Model mentalny (do czytania tabel poniżej)

Idea Workspace trzyma **jeden graf** (`nodes`/`edges`/`extensions`) w `workspaceGraphRuntime.ts`, renderowany na przemian przez 4 narzędzia (Mind Map / Whiteboard / Process Flow / Table). Na tym jednym grafie działają cztery **odrębne mechanizmy**, które w UI i w kodzie noszą pokrewne/identyczne nazwy, ale robią zupełnie różne rzeczy:

| Mechanizm | Co faktycznie robi | Funkcja/plik-kotwica |
|---|---|---|
| **Przełączenie widoku** | Zmienia który komponent renderuje TEN SAM graf. Zero I/O, zero mutacji danych. | `setActiveTool` (`IdeaMapWorkspace.tsx:414`) |
| **Import** | ZASTĘPUJE cały graf (nodes+edges) danymi z pliku/wklejenia (draw.io/BPMN/pakiet) **lub** DOKŁADA wiersze (CSV, tylko Table) | `handleImportGraph` → `captureToolGraph` (destrukcyjne) vs `handleCSVImport` (addytywne) |
| **Templates** | ZASTĘPUJE cały graf gotową strukturą węzłów/krawędzi | `applyIdeaTemplate` → `Api.syncMyIdeaMap` |
| **Convert (workspace)** | NIE rusza grafu Idei. Woła backend, który CZYTA (całość lub `nodeIds`) i TWORZY nowy, osobny rekord w innym module (Initiative/Task/Decision/Report/Deck/Team Chat) + zapisuje link zwrotny | `handleConvert` → `Api.convertMyIdea` |
| **Convert (M05 — lista Idei, POZA workspace)** | Inny pipeline: materializuje sesję MyWork, potem POSTuje bezpośrednio do modułu docelowego | `ConvertToOutputMenu` → `conversionService.ts` |

---

## 1. Przełączenie widoku (4 narzędzia = 4 widoki jednego grafu)

| Element | Wartość |
|---|---|
| Gdzie widoczne | Lewy pionowy rail (`CanvasLeftToolbar.tsx`), skróty `1-4` |
| Kod | `setActiveTool` — zwykły `useState` setter + zapis `?tool=` w URL (`IdeaMapWorkspace.tsx:414-1719`) |
| Co tworzy | NIC. Zmienia tylko który z 4 komponentów (`IdeaRecommendationMap` / whiteboard / `IdeaProcessFlowTool` / `IdeaTableTool`) montuje się pod tym samym `graphNodes`/`graphEdges` z `graphRuntime` |
| Nowy rekord? | Nie |
| Nadpisuje dane? | Nie |
| Link do źródła | N/D (to nie jest konwersja) |
| Synchronizacja z oryginałem | Zawsze — to jest ten sam stan, nie kopia |
| Preview | N/D |
| Cofnięcie | N/D (nie ma czego cofać) |

Weryfikacja: `captureToolGraph` (linia 326-356 w `canvas/workspaceGraphRuntime.ts`) trzyma jeden `graph` state; żaden z 4 komponentów narzędzi nie ma własnej kopii nodes/edges — dostają je jako propsy z hosta i zapisują z powrotem przez `replaceRuntimeGraph`/`captureToolGraph`. To potwierdza doktrynę „4 narzędzia = 4 widoki jednego grafu" **na poziomie danych**. Wyjątek częściowy: Table (legacy `IdeaTableTool.tsx`) trzyma osobny wewnętrzny `nodes`-undo-stack (`nodesUndo`) i synchronizuje się przez `onGraphChange`/`refreshToken` — mechanicznie inaczej niż Mind Map, ale efekt końcowy ten sam współdzielony graf.

---

## 2. Generowanie reprezentacji z innej („Utwórz z mapy") — ★ NIE ROBI TEGO, CO SUGERUJE NAZWA

| Element | Wartość |
|---|---|
| Gdzie widoczne | Menu 3, prawy klaster, obok „Eksport" (`ideaCanvasMelsChips.ts:284-294`) |
| Etykieta | PL: „Utwórz z mapy" / EN: „Create from map” |
| Co POWINNO sugerować | Wygenerowanie innej reprezentacji (np. tabeli z mapy, procesu z mapy) |
| Co FAKTYCZNIE robi w kodzie | `onConvertFromMap: () => handlePanelChange('tools')` (`IdeaMapWorkspace.tsx:2938`) — otwiera stary panel „tools" (`activePanel === 'tools'`) |
| ★ Defekt na żywym demo | `toolsPanelOpen` (czyli treść tego panelu) renderuje się WYŁĄCZNIE gdy `!melsCanvasEnabled` (`IdeaMapWorkspace.tsx:3738`: `{!melsCanvasEnabled && (toolsPanelOpen ‖ ...) && (...)}`). Flaga `ff_melsCanvas` jest domyślnie ON (ustalenie #5 z `_INPUT_CONTEXT.md`) → w bieżącym domyślnym UI kliknięcie „Utwórz z mapy" ustawia stan, którego NIC nie odczytuje. **Martwy klik.** |
| Czy to w ogóle inna reprezentacja? | Nie — nawet gdyby panel się otwierał, otworzyłby ten sam `IdeaWorkspaceTools` co ikona „Convert” w prawym railu (ten sam kod renderujący, `renderMelsCanvasRightRailPanel`). Nazwa "Utwórz z mapy" to WYŁĄCZNIE alternatywne wejście do tego samego Convert (§4), nie osobna funkcja "generuj reprezentację" |
| Nowy rekord? | Tylko pośrednio — jeśli użytkownik dojdzie do panelu Convert i kliknie tam target |
| Cofnięcie | N/D (sam klik nic nie robi) |

**Wniosek:** w tym repo nie ma odrębnej funkcji „wygeneruj widok B z zawartości widoku A" (np. tabela-z-mapy w sensie strukturalnego przekształcenia). Jedyna rzecz nazwana w ten sposób to zamaskowane wejście do Convert, i to wejście jest aktualnie zepsute pod domyślną flagą.

---

## 3. Stworzenie nowego obiektu Idea (nie mylić z konwersją ISTNIEJĄCEJ idei)

| Ścieżka | Gdzie | Co robi | Nowy rekord `my_ideas`? |
|---|---|---|---|
| Draft → zapis | `IdeaMapWorkspace.tsx:1382` `Api.createMyIdea(...)` wołane przy pierwszym `handleSave` gdy `isDraft` | Otwarcie „+ nowa idea" tworzy DRAFT lokalny; dopiero pierwszy zapis materializuje wiersz w bazie | Tak — to jest jedyny moment powstania rekordu |
| Notebook → Idea | `NotebookContent.tsx:1703` `Api.createMyIdea({title, body: \`From ${sourceType}...\`})` | Konwersja notatnika NA nową ideę (odwrotny kierunek niż §4!) | Tak, nowy, niepusty `body` z treści notatnika, ale BEZ przenoszenia struktury grafu (tylko tekst) |
| Chat/Teresa → Idea | `AIChat/ChatSignalsPanel.tsx:75` `Api.createMyIdea(...)` | Sygnał z czatu materializuje nową ideę | Tak |
| `shared/ConvertToMenu.tsx:116` | target `'idea'` z menu ogólnego MyWork (task/decision/notebook → idea) | Tworzy pustą ideę z `body: "From {sourceType}: {title}"` | Tak, ale bez struktury źródła — tylko tytuł/opis tekstowy |

**Rozróżnienie kluczowe:** żadna z tych ścieżek nie jest tym samym co „konwersja Idei do artefaktu" (§4) — tu Idea jest CELEM (target), nie źródłem. I żadna nie przenosi struktury grafu 1:1 — zawsze spłaszczenie do tytuł+opis.

---

## 4. Konwersja Idei → artefakt (całość / zaznaczenie / element)

### 4.1 SSOT rejestru targetów

`src/components/MyWork/ideaConvertTargets.ts` — 12 targetów, 3 grupy (`work`/`docs`/`models`), `status: live|soon`. Serwer (`server/src/routes/my-work.routes.ts:6972-6979`) ma WŁASNĄ, osobną listę `LIVE_CONVERT_TARGETS` (initiative/task_set/decision/team_chat/report/presentation), którą komentarz każe trzymać w lock-stepie ręcznie z FE (asercja przez test vitest — nie uruchamiany w tym audycie). `financial_model`/`budget`/`valuation`/`analysis`/`action_plan`/`raid_log` mają status `soon` w workspace i backend je odrzuca 400 gdyby ktoś je wysłał (FE nigdy ich nie wysyła, bo `isLiveConvertTarget` gate'uje przed wywołaniem).

### 4.2 Trzy wejścia do TEGO SAMEGO `handleConvert`

| Wejście | Plik:linia | Nodeids przekazywane? | Efekt |
|---|---|---|---|
| Menu 1 „Konwertuj ▾" | `IdeaConvertMenu` → `IdeaMapWorkspace.tsx:3291` `onConvert={(target) => handleConvert(target)}` | Nie (brak drugiego argumentu) | Konwertuje **całą ideę** (fallback na `selection.ids`, zwykle pusty gdy user tylko co otworzył menu z paska) |
| Prawy panel, sekcja „Convert" | `IdeaWorkspaceTools.tsx:662` `onClick={() => onConvert(id)}`, gdzie `onConvert = handleConvert` (bundle, `IdeaMapWorkspace.tsx:3019`) | Nie explicite — ale panel POKAZUJE licznik `convertSelectionCount` (`selection.count`), sugerując że użyje aktualnego zaznaczenia z płótna | Jeśli coś jest zaznaczone na płótnie → konwertuje zaznaczenie (przez fallback `selection.ids`); jeśli nic → całość |
| Menu kontekstowe / pasek zaznaczenia per narzędzie | `CONVERT_PREFIX_MAP` (`IdeaMapWorkspace.tsx:918-936`) — zdarzenie `idea-workspace-quick-action` z `nodeIds` w `detail` | Tak, explicite (`eventDetail.nodeIds`) | Konwertuje dokładnie przekazane węzły |

Wszystkie trzy kończą w JEDNEJ funkcji `handleConvert` (`IdeaMapWorkspace.tsx:2012-2130`), która woła `Api.convertMyIdea(realId, {target, options: {nodeIds?}})`.

### 4.3 Konwersja CAŁOŚCI vs ZAZNACZENIA — co faktycznie różni backend

`server/src/routes/my-work.routes.ts:6985+`, endpoint `POST /api/my-work/my-ideas/:id/convert`:
- `nodeIds` z `options.nodeIds` — gdy obecne, backend UŻYWA etykiet wskazanych węzłów jako źródła treści (np. tytuły tasków z `task_set`, linia ~7079+166-175) zamiast całego `body`/`aiExpansion`/`nextSteps` idei.
- **★ Ale efekt uboczny na poziomie idei jest IDENTYCZNY niezależnie od zakresu**: każda gałąź (`initiative`/`task_set`/`decision`/`report`/`presentation`) kończy się bezwarunkowym `await promote(target, id)`, które robi:
  ```sql
  UPDATE my_ideas SET promoted_to=?, promoted_entity_id=?, stage='promoted' WHERE id=...
  ```
  To nadpisuje `promoted_to`/`promoted_entity_id`/`stage` CAŁEJ idei, **nawet gdy konwertowano tylko zaznaczenie 2 z 40 węzłów**. Konsekwencje:
  1. Idea, w której skonwertowano jedną gałąź do „decision”, a potem inną gałąź do „task_set” — traci ślad pierwszej konwersji w kolumnie `promoted_to` (nadpisanie, brak historii na poziomie tego pola).
  2. `stage` całej idei przeskakuje na `'promoted'` po konwersji NAWET FRAGMENTU — może fałszywie oznaczać ideę jako „zamkniętą”/„gotową” w widokach filtrujących po stage, mimo że reszta grafu jest wciąż otwarta/aktywna.
  3. Osobno, w warstwie FE, `outputLinks` w `extensions` grafu (via `graphRuntime.applyExtensionsPatch`, `IdeaMapWorkspace.tsx:2081-2087`) SĄ addytywne (`[...existingOutputLinks, newOutputLink]`) — więc historia linków wyjściowych na poziomie grafu NIE ginie, tylko kolumna `promoted_to`/`stage` w `my_ideas` nadpisuje się bez pamięci poprzedniego stanu. Dwa różne mechanizmy „pamiętania konwersji” z różną trwałością.

### 4.4 Konwersja POJEDYNCZEGO ELEMENTU — ★ etykieta „pojedynczy" ≠ zachowanie „pojedynczy" (Mind Map)

`mindmap/NodeContextMenu.tsx:286-348` ma DWIE grupy pozycji:
- „Convert” (bez sufiksu): `ctx_convert_initiative` / `ctx_convert_decision` / `ctx_convert_tasks` — sugeruje: **tylko ten węzeł**.
- „Convert branch to…” (z sufiksem, widoczna tylko gdy `hasChildren`): `ctx_subtree_convert_*` — sugeruje: **węzeł + potomkowie**.

Obsługa w `IdeaRecommendationMap.tsx:4735-4743` woła dla OBU grup identyczną funkcję `convertBranch(target, ctxNode?.id)` (linia 4584-4609), która **zawsze** liczy `collectDescendants(targetNodeId)` i wysyła `nodeIds: [targetNodeId, ...descendants]`. **Nie ma żadnego rozróżnienia w implementacji między "ctx_convert_initiative" i "ctx_subtree_convert_initiative" — oba zawsze konwertują całą gałąź (węzeł + wszyscy potomkowie), nigdy naprawdę pojedynczy węzeł w izolacji, jeśli ma dzieci.** Etykieta „→ Initiative" (bez „(branch)") jest myląca — użytkownik dostaje branch-convert, choć UI sugeruje element-convert.

Kontrast — **Whiteboard robi to poprawnie**: `WhiteboardSelectionBar.tsx:103-131` (`wb_convert_decision`/`wb_convert_action`) wysyła dokładnie `selectedNodeIds` z aktualnego zaznaczenia, bez żadnej sztucznej ekspansji do potomków — prawdziwa konwersja zaznaczenia 1:1.

### 4.5 Table — konwersja wiersza/wierszy (trzy różne wejścia w jednym pliku)

| Wejście | Plik:linia | Co robi lokalnie (kosmetyka) | Co idzie do backendu |
|---|---|---|---|
| Bulk convert (zaznaczone wiersze) | `IdeaTableTool.tsx:1125-1163` `handleBulkConvert` | Stempluje zaznaczone węzły `_convertedTo`/`_convertedAt`/`_sourceRowId` (undo-capable lokalnie, `nodesUndo.push`) | `onConvertProp(target)` **bez nodeIds** → `handleConvert(target)` w hoście → fallback na `selection.ids` (host-level). Zweryfikowano: `toggleRowSelection` (i legacy `useTableRows.ts:138-151`, i platform `useTablePlatformIntegration.ts:375-388`) **poprawnie** woła `onSelectionChange` przy każdym zaznaczeniu wiersza → `selection.ids` w hoście faktycznie odzwierciedla checkbox-selection. Mechanizm działa zgodnie z oczekiwaniem. |
| Row Detail Panel — convert pojedynczego wiersza | `IdeaTableTool.tsx:3273-3299`, `table/RowDetailPanel.tsx:106,1977-1986` | Stempluje TYLKO `detailNodeId` lokalnie | ★ `onConvertProp(target)` — **też bez nodeIds**, identyczny fallback na `selection.ids`. Ale `detailNodeId` (wiersz otwarty w panelu szczegółów) **nie musi pokrywać się** z checkbox-zaznaczeniem (`selectedRowIds`) — to dwa niezależne stany. Jeśli user otworzy wiersz X przez klik (bez zaznaczania checkboxa) i kliknie „Convert” w panelu szczegółów, lokalnie oznaczy X jako `_convertedTo`, ale backend dostanie `nodeIds` z `selection.ids`, które może być: puste (→ konwersja CAŁEJ idei, nie wiersza X) albo zawierać zupełnie INNE wiersze (jeśli były wcześniej zaznaczone checkboxem). **To rozjazd między tym, co UI pokazuje jako skonwertowane, a tym, co faktycznie trafia do backendu.** |
| `onConvertToInitiative` (osobny skrót) | `IdeaTableTool.tsx:3431-3432` | `onConvertProp('initiative')` | Ten sam fallback-na-selection mechanizm |

---

## 5. Convert POZA workspace (M05 — lista Idei) — ★ TRZECI, NIEZALEŻNY PIPELINE POD TĄ SAMĄ NAZWĄ

| Element | Wartość |
|---|---|
| Gdzie widoczne | Kebab/hover-bar wiersza w liście `MyIdeasListContent.tsx`, `IdeasTableContent.tsx`, oraz `NotebookContent.tsx` (notatki) |
| Komponent | `ConvertToOutputMenu` (`IdeaMapWorkspace` go NIE używa) |
| Backend | `services/conversionService.ts` — **NIE woła `Api.convertMyIdea`**. Zamiast tego: (1) `materializeMyWorkSession(sources)` tworzy sesję MyWork jako „kanoniczne źródło", (2) POST bezpośrednio do modułu docelowego: `/initiatives`, `/report-builder`, `/presentations/generate/outline`, `/financial-modeling/models`, `/economics/analyses`, `/economics/valuations`, `/economics/budgets` |
| ★ Sprzeczność statusów | `financial_model`/`budget`/`valuation`/`analysis` są `status:'soon'` (disabled) w workspace Convert (`ideaConvertTargets.ts`), ale w TYM pipeline mają PEŁNE, działające handlery (`conversionService.ts:122-159`) — kod POSTuje realnie do `/economics/analyses` itd. Ten sam human-readable target („Analiza”, „Budżet”) jest jednocześnie „wkrótce” (workspace) i „live” (lista) w zależności od tego, którym menu użytkownik trafi na tę samą nazwę. |
| Czy przenosi treść grafu? | NIE — payloady to wyłącznie `{name/title, description: "Converted from MyWork session", sourceType:'tool_session', sourceId}`. Tytuł/opis, ŻADNYCH danych z mapy/tabeli/procesu. Realnie tworzy PUSTY rekord z linkiem-wstecz, nie „konwersję treści”. |
| Preview przed utworzeniem | `ConvertToDialog.tsx` — dialog z wyborem targetu i potwierdzeniem NAZWY źródła, **nie jest to podgląd wygenerowanej treści** (nie renderuje docelowego dokumentu/decku) |
| Osobny, martwy trzeci wariant | `src/components/MyWork/shared/ConvertToMenu.tsx` — komponent o TEJ SAMEJ NAZWIE `ConvertToMenu`, eksportowany z `shared/index.ts:31`, ale **zero konsumentów w repo** poza samym plikiem-eksporterem (`grep` nie znajduje importu). Obsługuje sources `task/decision/idea/notebook` (jeszcze inny zestaw niż `idea`-workspace i M05-lista). Martwy kod, tak jak `useIdeasToolContextMenu.ts` (ustalenie #3). |

---

## 6. Export (`IdeaExportMenu.tsx`)

| Format | Rodzaj | Co faktycznie robi | Plik pobrany? |
|---|---|---|---|
| PNG / SVG / PDF | Klient-side (html-to-image/jsPDF) | Renderuje `.react-flow` kontener do obrazu/PDF | Tak |
| Markdown | Klient-side | Outline tekstowy grafu | Tak |
| JSON | Klient-side | Surowe `nodes`/`edges`/`extensions` | Tak |
| Diagram package | Klient-side | Strukturalny pakiet z metadanymi (interop) | Tak |
| Mapping report | Klient-side | Raport fidelity/degradacji (via `diagramInterop.ts::buildInteropMappingReport`) | Tak |
| Share manifest | Klient-side | Manifest permission-safe do embed/share | Tak |
| ★ **Raport** | **NIE jest eksportem** | `exportToReport()` (linia 488-497) dispatch'uje `idea-workspace-quick-action` z `action:'convert_report'` — **to jest Convert**, trafia do `CONVERT_PREFIX_MAP` → `handleConvert('report')` → tworzy prawdziwy rekord w module Reports. Zero pliku do pobrania. | **Nie** |
| ★ **Prezentacja (deck)** | **NIE jest eksportem** | Analogicznie `exportToPresentation()` → `action:'convert_presentation'` → Convert → tworzy deck | **Nie** |

**Pułapka nomenklatury**: w JEDNYM dropdownie „Export” 6 pozycji faktycznie eksportuje plik na dysk, a 2 pozycje („Raport”, „Prezentacja”) pod tą samą wizualną formą (przycisk w liście formatów eksportu) w rzeczywistości TWORZĄ nowy, trwały rekord w innym module — czyli są Convertem przebranym za Export. Brak jakiegokolwiek wizualnego rozróżnienia w UI między tymi dwiema kategoriami.

Serwerowy eksport (`POST /v4-final/ideas/:id/export`, `Api.ideaRequestExport`) jest jawnie oznaczony w kodzie jako historycznie fake (komentarz L-05/D-01/DP-5: „pure stub, no worker ever produced a file”), obecnie za flagą `IDEA_SERVER_EXPORT_ENABLED` (domyślnie OFF) — gdy OFF, żaden request nie leci (`recordExportRequest`, linia 519-532); gdy ON, generator realny istnieje TYLKO dla `json`/`markdown`, inne formaty zwracają 501 zamiast fałszywego sukcesu.

---

## 7. Import

### 7.1 draw.io / BPMN / diagram package (wklejany XML/JSON) — w `IdeaExportMenu.tsx`

| Element | Wartość |
|---|---|
| Gdzie widoczne | Ten sam panel co Export, sekcja „Import” (pole tekstowe + wybór formatu) |
| Parsery | `parseDrawIoXml` / `parseBpmnXml` / `parseDiagramPackage` (`canvas/diagramInterop.ts`) |
| Co tworzy | `handleImport` (linia 463-485) → `onImportGraph(parsed)` → `IdeaMapWorkspace.handleImportGraph` (linia 1296-1334) |
| ★ Nadpisuje obecne dane? | **TAK, całkowicie.** `graphRuntime.captureToolGraph({nodes: payload.nodes, edges: payload.edges, ...})` — `captureToolGraph` (linia 336-341 w `workspaceGraphRuntime.ts`) ustawia `merged.nodes = next.nodes` / `merged.edges = next.edges` bez żadnego mergowania z poprzednią zawartością. Import ZASTĘPUJE cały graf idei (a więc wpływa na wszystkie 4 widoki naraz — patrz §0), nie tylko aktywne narzędzie. |
| ★ Brak potwierdzenia | W przeciwieństwie do Templates (§8, które MAJĄ dialog potwierdzający nadpisanie), Import **nie pyta o potwierdzenie**, mimo że robi dokładnie tę samą destrukcyjną operację (`captureToolGraph`) |
| Czy zachowuje link do źródła | Częściowo — `extensions.interop` zapisuje `lastImportAt`/`lastImportFormat`/`lastImportTitle`/`mappingReport`, ale to metadane o samym imporcie, nie link do zewnętrznego pliku źródłowego |
| Cofnięcie | `flushGraph({reason:'manual', createSnapshot:true, snapshotLabel:'import-${format}'})` — tworzy wpis w Historii wersji (`SnapshotHistory`), więc TEORETYCZNIE można wrócić przez „Historia” → poprzednia wersja. Nie zweryfikowano w kodzie, czy snapshot łapie stan SPRZED czy PO imporcie (niepotwierdzone — zależy od `flushNow` w `workspaceGraphRuntime.ts`, nie doczytane w tym audycie) |
| Preview | Tak — `importPreview` (`useMemo`, linia 195-214) parsuje na bieżąco i pokazuje wynik przed kliknięciem „Importuj” |

### 7.2 CSV import — TYLKO w Table (`IdeaTableTool.tsx:1094-1120`)

| Element | Wartość |
|---|---|
| Gdzie widoczne | `TableToolbar.tsx` (P15) i legacy pasek, `onCSVImport` |
| Co robi | Parsuje CSV → `csvToNodes` → **DOKŁADA** nowe wiersze: `nodesUndo.push([...nodes, ...newNodes])` — addytywne, nie zastępuje |
| Nadpisuje? | Nie (dodaje) — kontrast z §7.1 |
| Nowe kolumny | Jeśli CSV ma nagłówki spoza istniejących kolumn, dokłada je też (`setColumns([...prev, ...newColumns])`) |
| Cofnięcie | `nodesUndo` — lokalny stos undo (Ctrl+Z), zweryfikowany jako używany przy tej operacji |
| Preview | Brak — import wykonuje się natychmiast po wyborze pliku, bez podglądu wierszy przed zatwierdzeniem |

**Pułapka nomenklatury**: „Import” w Idea Workspace oznacza DWIE skrajnie różne operacje pod względem bezpieczeństwa danych — jedna (draw.io/BPMN/pakiet) kasuje cały graf bez pytania, druga (CSV) tylko dokłada wiersze. Nazwa nie sygnalizuje tej różnicy.

---

## 8. Templates (`IdeaTemplateGallery.tsx`)

| Element | Wartość |
|---|---|
| Gdzie widoczne | Menu 3, lewy klaster („Szablony” / „Templates”, `ideaCanvasMelsChips.ts:263-271`) |
| Filtrowane per narzędzie | `templates = ALL_TEMPLATES.filter(t.tool === activeTool ...)` — szablony są przypisane do konkretnego narzędzia (mindmap/process_flow/…), nie uniwersalne |
| Co tworzy | `applyIdeaTemplate` (linia 1900-1948) → `Api.syncMyIdeaMap(ideaId, {nodes: template.nodes, edges: template.edges, ...})` |
| ★ Nadpisuje? | TAK — jawnie udokumentowane w kodzie: *„L-06: szablon nadpisuje cały graf (Api.syncMyIdeaMap zastępuje nodes/edges)”* (`IdeaTemplateGallery.tsx:1994`) |
| ★ Potwierdzenie przed nadpisaniem | **TAK, jest** (`handleApply`, linia 1992-2014): gdy `existingNodeCount > 0`, pokazuje `confirm()` dialog („zastąpi X elementów”) i czeka na świadome potwierdzenie. **To jest jedyne miejsce w całym audycie z prawidłowym guard-rail przed utratą danych** — kontrastuje z Importem (§7.1), który tej samej operacji (`syncMyIdeaMap`-podobne zastąpienie) nie zabezpiecza niczym. |
| Opcjonalny AI-fill | `withAIFill=true` → po zaaplikowaniu szablonu woła `generateAIProposal` i dispatch'uje `idea-workspace-ai-proposal` (propozycje, nie auto-apply — niepotwierdzone czy user musi je zaakceptować, poza zakresem tego audytu) |
| Link do źródła | `extensions.templateGovernance` zapisuje `templateId`/`templateName`/`appliedAt` — ślad, który szablon zastosowano |
| Cofnięcie | Nie zweryfikowano czy `syncMyIdeaMap` tworzy snapshot przed nadpisaniem (do sprawdzenia osobno — poza zakresem grep-first tego pliku) |

---

## 9. Tabela zbiorcza — pułapki nomenklatury („to samo słowo, różne rzeczy”)

| Słowo/etykieta | Znaczenie #1 | Znaczenie #2 | Dowód rozjazdu |
|---|---|---|---|
| **„Utwórz z mapy”** (Menu 3) | Sugeruje: wygeneruj inną reprezentację z zawartości mapy | Faktycznie: alias otwierający panel Convert; obecnie MARTWY KLIK pod domyślną flagą `ff_melsCanvas` | §2 |
| **„Convert”** | Workspace: `handleConvert`→`Api.convertMyIdea` (czyta graf, tworzy artefakt z linkiem `outputLinks`, nadpisuje `promoted_to` na CAŁEJ idei) | M05-lista: `ConvertToOutputMenu`→`conversionService.ts` (materializuje sesję, POSTuje bezpośrednio, treść = tylko tytuł) | §4 vs §5 |
| **„Analiza”/„Model finansowy”/„Budżet”/„Wycena”** | Workspace Convert: `status:'soon'`, disabled, „wkrótce” | M05-lista Convert: pełny, działający handler (`conversionService.ts:122-159`) | §5 |
| **„Convert” (bez sufiksu) vs „Convert branch to…” w menu węzła Mind Map** | Nazwa sugeruje: pojedynczy węzeł vs węzeł+gałąź | Kod: OBIE wołają identyczny `convertBranch()` z `collectDescendants` — zawsze cała gałąź | §4.4 |
| **„Export”** (dropdown) | 6 pozycji: realny plik na dysk | 2 pozycji („Raport”, „Prezentacja”): Convert bez pliku, tworzy trwały rekord w innym module | §6 |
| **„Import”** | draw.io/BPMN/pakiet: DESTRUKCYJNE zastąpienie całego grafu, bez potwierdzenia | CSV (tylko Table): addytywne dołożenie wierszy, z lokalnym undo | §7 |
| **`ConvertToMenu`** (nazwa komponentu) | `MyWork/ConvertToMenu.tsx` = re-export `ConvertToOutputMenu` (initiative/report/presentation/financial_model/budget/valuation/analysis) | `MyWork/shared/ConvertToMenu.tsx` = zupełnie inny komponent (task/decision/idea/notebook), MARTWY KOD (zero importów) | §5 |

## 10. Gdzie brakuje preview / undo (zbiorczo)

| Operacja | Preview przed wykonaniem? | Undo po wykonaniu? |
|---|---|---|
| Convert (workspace, dowolny wariant: całość/zaznaczenie/element) | **Brak** — klik = natychmiastowe wywołanie API, jedyny feedback to toast po fakcie | **Brak** — nie tworzy snapshotu; cofnięcie oznacza ręczne usunięcie utworzonego artefaktu w docelowym module + ręczne wyzerowanie `promoted_to` (brak przycisku do tego) |
| Convert (M05-lista, `ConvertToDialog`) | Częściowy — dialog z wyborem targetu i nazwą źródła, ale BEZ podglądu treści docelowego artefaktu | Brak |
| Import draw.io/BPMN/pakiet | **Tak** — `importPreview` pokazuje sparsowany wynik przed kliknięciem | Pośrednio — snapshot w Historii (`SnapshotHistory`), nieprzeanalizowany szczegółowo czy „przed” czy „po” |
| Import CSV | **Brak** — wykonuje się natychmiast po wyborze pliku | Tak — lokalny `nodesUndo` (Ctrl+Z) |
| Templates | Galeria pokazuje miniatury/opis szablonu PRZED aplikacją (uznane za preview na poziomie wyboru, nie treści finalnej) | **Guard-rail przed wykonaniem** (confirm dialog gdy canvas niepusty) zamiast undo po fakcie — mocniejsze zabezpieczenie niż reszta |
| „Utwórz z mapy” | N/D (martwy klik) | N/D |

---

## Podsumowanie jednym zdaniem

W Idea Workspace istnieją co najmniej **trzy niezależne, różnie nazwane mechanizmy „Convert”** (workspace/`Api.convertMyIdea`, M05-lista/`conversionService.ts`, martwy `shared/ConvertToMenu`), jeden z nich ma nieudokumentowany efekt uboczny nadpisujący status całej idei niezależnie od zakresu konwersji, dwie pozycje w menu „Export” wcale nie eksportują pliku, „Utwórz z mapy” jest obecnie martwym przyciskiem, a jedyne miejsce z prawidłowym zabezpieczeniem przed utratą danych (potwierdzenie przed nadpisaniem) to Templates — dokładnie ta sama operacja w Imporcie nie ma żadnego zabezpieczenia.
