# TESTY — M09 Ideas · Whiteboard (tablica warsztatowa)

> **Moduł:** M09 Ideas — Whiteboard (`/my-work/ideas/workspace/whiteboard`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`, inwentarz `Harvard/podzial/inventory/INV_B_my-work.md`
> **Zakres tej paczki:** pełna tablica warsztatowa — 11 typów węzłów, tryb rysowania, facilitation API (12 endpointów), AI-assist (5+ generatorów), eksport, undo/redo, obecność, ustawienia tła, skróty klawiszowe, flow do Inicjatyw i Czatu.
> **Cel:** agent wykonujący testy weryfikuje każdy epik (F·EPIKI z teczki M09) end-to-end — UI + Network payload + DB, ze szczególnym naciskiem na P0-strukturalny (per-user document, multiplayer fasada), P1 (realtime sync nieobecny), fasady facilitation i zestandaryzowaną integrację cross-module.
> **Podstawa:** `Harvard/wdrozenie-100/M09-ideas-whiteboard.md` (teczka) · `Harvard/modules/M09-ideas-whiteboard/KARTA_AUDYTU.md` · `Harvard/podzial/ideas/MODULE_02E_whiteboard.md`
> **Legenda:** `[MANUAL]` = ręczna weryfikacja (gesty trackpad / drag & drop / audio / dwa okna); `[FLAG]` = zależne od flagi/gating/roli; `[DB]` = dowód obejmuje kolumnę w bazie; `[P0]` / `[P1]` / `[P2]` = klasa defektu ze znanych luk L-01…L-06.
> **Data:** 2026-06-16

---

## §0 · Kontekst architektoniczny (przeczytaj przed testami)

### Mapa komponent ↔ plik ↔ stan

| Warstwa | Komponent | Plik | Stan / store |
|---|---|---|---|
| Główny edytor | `IdeaWhiteboardTool` | `src/components/MyWork/IdeaWhiteboardTool.tsx` (2922+ l.) | lokalny: `nodes/edges/historyStack/sessionState/presenceUsers` |
| Canvas (ReactFlow) | `WhiteboardCanvas` | `IdeaWhiteboardTool.tsx` (inner) | `ReactFlowProvider` |
| Toolbar | `WhiteboardToolbar` | `whiteboard/WhiteboardToolbar.tsx` | props z `IdeaWhiteboardTool` |
| Pasek selekcji | `WhiteboardSelectionBar` | `whiteboard/WhiteboardSelectionBar.tsx` | zaznaczone węzły |
| Panel facilitation | `WhiteboardSessionPanel` | `whiteboard/WhiteboardSessionPanel.tsx` | `sessionState` |
| Pasek fazy | `WhiteboardPhaseBar` | `whiteboard/WhiteboardPhaseBar.tsx` | `facilitationPhase` |
| Pusty stan | `WhiteboardEmptyState` | `whiteboard/WhiteboardEmptyState.tsx` | — |
| Rysowanie | `IdeaDrawingLayer` | `IdeaDrawingLayer.tsx` | `drawingPaths` (w `extensions.whiteboard`) |
| Sceny | `IdeaScenesManager` | `IdeaScenesManager.tsx` | `scenes` (w `extensions.whiteboard`) |
| AI propozycje | `IdeaProposalReview` | `IdeaProposalReview.tsx` | `proposalBatch` |
| AI nudge | `IdeaAINudgeStrip` | `IdeaAINudgeStrip.tsx` | — |
| Slash-menu | `IdeaSlashCommandMenu` | `IdeaSlashCommandMenu.tsx` | `slashMenuOpen` |
| Eksport | `IdeaExportMenu` | `IdeaExportMenu.tsx` | przez `IdeaMapWorkspace` |
| Współpraca | `CollaborationOverlay` | `mindmap/CollaborationOverlay.tsx` | WS + `presenceUsers` |
| Persystencja | `useIdeaMapSync` | `canvas/useIdeaMapSync.ts` | `syncState`; draft w `localStorage` |
| Węzły | `StickyNoteNode`, `TextBlockNode`, `ShapeNode`, `FrameNode`, `GroupNode`, `ImageNode`, `LinkNode`, `SummaryCardNode`, `KPIBadgeNode`, `ScoreNode`, `ProgressNode` | `whiteboard/nodes/` | dane per-węzeł |
| Typy krawędzi | `LabeledEdge` | `whiteboard/nodes/LabeledEdge.tsx` | dane per-krawędź |
| Operacje na węzłach | `useWhiteboardNodes` | `whiteboard/useWhiteboardNodes.ts` | `setNodes/setEdges` |
| Skróty quick-actions | `useWhiteboardQuickActions` | `whiteboard/useWhiteboardQuickActions.ts` | CustomEvent dispatcher |
| Backend — mapa | `PUT/GET /api/my-work/my-ideas/:id/map` | `server/src/routes/my-work.routes.ts` `:3612–3866` | tabela `my_idea_maps` |
| Backend — facilitation | 12 endpointów `/api/realtime-v4/facilitation/*` | `server/src/routes/realtime-platform.routes.ts` `:457–849` | tabele `tool_facilitation_sessions`, `tool_facilitation_votes`, `tool_facilitation_roles`, `tool_facilitation_outcomes` |
| Backend — presence | `/api/realtime-v4/tool-sessions/:id/presence|heartbeat|disconnect|locks` | `realtime-platform.routes.ts` `:855–1060` | tabela `tool_session_presence` |
| WS gateway | `ideaCollabWs.gateway.ts` `:195–443` | wspólny z M06/M07 | `collab_sessions`, WS room `ideaId` |

### E2E zasada weryfikacji (obowiązkowa)

Każda akcja zmieniająca dane (dodanie węzła, zapis, facilitation) **MUSI być potwierdzona w zakładce Network** — żądanie HTTP do `/api/my-work/my-ideas/:id/map` (PUT) lub do odpowiedniego endpointu facilitation/presence. Sama zmiana w UI = **nie dowód** (optimistic update bez persystencji jest realnym ryzykiem). Po każdej akcji odśwież stronę i sprawdź, że stan przetrwał reload.

### Gating beta — KRYTYCZNE

`MYWORK_IDEAS: 'open'` (`betaAccess.ts:58`) — na branch `Londyn` sekcja Ideas jest **otwarta** (`'open'`). Mimo to `MyWorkHub.tsx:609` wywołuje `isBetaSubareaClosed('MYWORK_IDEAS') && isBetaLockedForRole(currentUser?.role)` — sprawdź zachowanie per-rola (owner DBR77, member, superadmin). Jeśli status `'closed'`, zakładka Ideas musi być zablokowana dla non-adminów.

### Znane P0/P1 blokery (testuj jako znane defekty — udokumentuj, nie naprawiaj)

| ID | Opis | Plik:linia | Klasa |
|---|---|---|---|
| L-01 | Per-user document — `my_idea_maps` keyed `(idea_id, user_id, org_id)` → 2. uczestnik tej samej org dostaje 404 | `my-work.routes.ts:3752,3897,4175` | P0-struct |
| L-02 | Whiteboard nie nadaje/odbiera `graph_patch` → realtime sync treści = brak | `IdeaMapWorkspace.tsx:2361` (tylko workspace/mindmap) | P1 |
| L-03 | 5 facilitation GET-ów bez org-scope (votes/:id, votes/summary, roles/:id, outcomes/:id, PUT outcomes/:id/export) | `realtime-platform.routes.ts:686,696,750,807,816` | P0/P1 |
| L-04 | `facilitationGetSession` ma 0 call-sites → uczestnik nigdy nie widzi timera/fazy facylitatora | `api.ts:18483` | P1 |
| L-05 | Kształty circle/diamond/hexagon zablokowane w UI (toolbar emituje tylko `shape_rectangle`) | `WhiteboardToolbar.tsx:127–129` | P2 |

---

## §setup · Środowisko testowe

### Dev server

1. Uruchom `npm run dev` (port `:3000` FE + `:3001` BE).
2. Zaloguj się jako **OWNER organizacji DBR77** (dostęp do Ideas).
3. Przejdź na `/my-work/ideas` → wybierz lub utwórz ideę → zakładka **Whiteboard**.
4. Otwórz **DevTools → Network** (filtr: `my-ideas` lub `realtime-v4`). Otwórz **Console** (zero błędów = wymóg).
5. Przygotuj **dwa konta** w tej samej organizacji: `ownerA` i `memberB` (do testów multiplayer/P0).
6. Przygotuj plik testowy do wklejenia: PNG ≤1 MB, PNG ~8 MB (do testu base64 limitu), tekst wieloliniowy.
7. Miej otwarte dwa okna przeglądarki (lub dwa profile) — konto ownerA i konto memberB.

### Dane testowe

- Idea z co najmniej 5 węzłami (lub utwórz ją podczas testu §1).
- Idea bez węzłów (do testu pustego stanu).

---

## §1 · EPIK 1 — Shared board model (P0-strukturalne, L-01)

> **Cel:** dokumentacja zachowania „per-user document" i weryfikacja, że defekt L-01 jest dokładnie taki jak opisany w teczce. Testy MUSZĄ FAIL — mają to potwierdzić i dostarczyć dowód.

### 1.1 Właściciel otwiera własną tablicę [DB]

**Kroki:**
1. Zaloguj się jako ownerA.
2. Przejdź do `/my-work/ideas`, otwórz ideę X, zakładka Whiteboard.
3. Dodaj węzeł sticky (Sticky Note). Zapisz (`Cmd/Ctrl+S`).
4. Sprawdź Network: `PUT /api/my-work/my-ideas/:id/map` → status 200, body zawiera `nodes` z nowym węzłem, pole `version` jest liczbą.
5. Odśwież stronę. Tablica wczytuje węzeł.

**Oczekiwane:** PASS — właściciel widzi własną tablicę.
**Asercja DB [DB]:** `SELECT nodes_json FROM my_idea_maps WHERE idea_id=? AND user_id=ownerA` — zawiera węzeł.

### 1.2 Drugi uczestnik tej samej organizacji otwiera tę samą tablicę [P0] [DB]

**Kroki:**
1. Zaloguj się jako memberB (ta sama org co ownerA, nie właściciel idei X).
2. Przejdź do `/my-work/ideas`. Sprawdź, czy idea X jest widoczna na liście.
3. Otwórz ideę X → zakładka Whiteboard.
4. Sprawdź Network: `GET /api/my-work/my-ideas/:id/map` → jaki status?

**Oczekiwane (zgodnie z DP-3, docelowo):** 200 z węzłami ownerA.
**Rzeczywiste (defekt L-01):** OCZEKIWANY FAIL → **404** (brak wiersza w `my_idea_maps` dla `user_id=memberB`).
**Dowód:** Network: `GET /my-ideas/X/map` → `404 Not Found` lub pusta tablica bez węzłów ownerA. Screenshot + payload.
**Kwalifikacja:** KNOWN BUG L-01 — opisać w raporcie z dowodem, NIE blokuje pozostałych testów single-player.

### 1.3 Beta gating per rola [FLAG]

**Kroki:**
1. Sprawdź `betaAccess.ts:58`: `MYWORK_IDEAS: 'open'` — zakładka Ideas widoczna dla wszystkich?
2. Zaloguj się jako zwykły member (rola `member`, nie admin/owner).
3. Przejdź na `/my-work/ideas`.
4. Sprawdź, czy zakładka Ideas pojawia się w hub i czy whiteboard jest dostępny.
5. Zaloguj się jako superadmin → sprawdź to samo.

**Oczekiwane:** jeśli `'open'` — zakładka widoczna dla wszystkich ról; jeśli `'closed'` — zablokowana z komunikatem beta.
**Odnotuj faktyczny stan** (może się różnić od kodu — weryfikuj live).

---

## §2 · EPIK 2 — Narzędzia rysowania (toolbar: 11 typów węzłów)

> **Źródło:** `WhiteboardToolbar.tsx` · `useWhiteboardQuickActions.ts` · `whiteboard/nodes/nodeTypes.ts`

### 2.1 Sticky Note (stickyNote) — węzeł podstawowy

**Kroki:**
1. Otwórz Whiteboard z pustą tablicą.
2. Klik na przycisk **+** (Utwórz) w toolbar → wybierz „Sticky Note".
3. Sprawdź, że node pojawia się na canvas w domyślnym kolorze z etykietą placeholder.
4. Zmień kolor: toolbar → dropdown ze swatchami kolorów — klik swatch #2 (żółty/inny).
5. Dwuklik na sticky → edycja inline; wpisz tekst „Test sticky".
6. Klik poza sticky → zapisanie tekstu.
7. Sprawdź badge komentarzy (widoczny gdy komentarze istnieją) i badge autora.

**Asercja Network [DB]:** po kroku 6 (lub autosave ≤60 s) pojawia się `PUT /api/my-work/my-ideas/:id/map` z `nodes` zawierającym `type: "stickyNote"` i `data.label: "Test sticky"`.
**Edge:** tworzenie sticky z każdym kolorem swatch (7 kolorów wg `STICKY_COLORS`) — każdy tworzy węzeł z innym `data.colorIndex`.

### 2.2 Text Block (textBlock)

**Kroki:**
1. Toolbar → **+** → „Text" (`wb_add_text`).
2. Node tekstowy pojawia się; dblclick → edycja; wpisz wieloliniowy tekst.
3. Sprawdź `type: "textBlock"` w payloadzie PUT.

### 2.3 Shape — prostokąt (shapeNode, shape_rectangle) — jedyny dostępny z UI

**Kroki:**
1. Toolbar → **+** → „Shape" → klik.
2. Kształt prostokąta pojawia się.
3. Sprawdź `type: "shapeNode"`, `data.shapeType: "rectangle"` w payloadzie.

**[P2] Kształty circle/diamond/hexagon — znany defekt L-05:**
4. Sprawdź, że przycisk „Shape" w toolbar wysyła **tylko** `shape_rectangle` (`WhiteboardToolbar.tsx:129`).
5. Potwierdzenie L-05: brak opcji circle/diamond/hexagon w dropdown toolbar. Odnotuj jako KNOWN BUG.
6. Weryfikacja quick-actions: sprawdź, że `useWhiteboardQuickActions.ts:45-47` ma handlery `wb_add_shape_circle/diamond/hexagon` — handlery są, ale UI ich nie wywołuje. Dokumentuj rozbieżność.

### 2.4 Frame (frameNode)

**Kroki:**
1. Toolbar → **+** → „Frame".
2. Frame pojawia się (kontener z etykietą, `childCount=0`).
3. Przeciągnij sticky note WEWNĄTRZ frame'a. Sprawdź, czy `childCount` wzrasta (auto-parentowanie) [MANUAL].
4. Klik na przycisk collapse/expand frame'a → dzieci (węzły wewnątrz) chowają się/pokazują.
5. Sprawdź payload: `type: "frameNode"`, `data.collapsed` (po toggle).

**Znany brak — auto-parentowanie przy drop:** dokumentacja teczki mówi, że drop na frame NIE auto-parentuje (delta L-05). Zweryfikuj to i odnotuj.

### 2.5 Image Node (imageNode) — wklejenie obrazu

**Kroki:**
1. Skopiuj plik PNG ≤1 MB do schowka.
2. Wklej na canvas (`Ctrl/Cmd+V`).
3. Sprawdź, że pojawia się `imageNode` z base64 w danych.
4. Sprawdź `type: "imageNode"`, `data.src` zaczyna się od `data:image/` w payloadzie PUT.

**[P2] Test limitu 10 MB:**
5. Wklej PNG ~8 MB. Sprawdź, czy PUT `/map` zwraca 413 lub inny błąd ciała żądania (`server/src/index.ts:923` — limit 10 MB body). Odnotuj zachowanie (crash zapisu / error toast / degradacja).

### 2.6 Link Node (linkNode)

**Kroki:**
1. Toolbar → **+** → „Link".
2. Wpisz URL `https://example.com`.
3. Sprawdź `type: "linkNode"`, `data.url` w payloadzie.

### 2.7 Metric Nodes: KPI Badge, Score, Progress

**Kroki:**
1. Slash-menu (`/`) → wyszukaj `kpi`, `score`, `progress` → dodaj każdy.
2. Sprawdź `type: "kpiBadge"`, `type: "scoreNode"`, `type: "progressNode"` w payloadzie.
3. Sprawdź, że węzły metryczne renderują dane (`KPIBadgeNode`, `ScoreNode`, `ProgressNode` z `IdeaMetricNodes.tsx`).

### 2.8 Summary Card (summaryCard)

**Kroki:**
1. Slash-menu (`/`) → `wb_add_summary` lub `wb_add_theme` / `wb_add_outcome`.
2. Sprawdź `type: "summaryCard"`, `data.semanticType` (`theme`/`outcome`/`table`) w payloadzie.

### 2.9 Group Node (groupNode) — przez Cmd+G

**Kroki:**
1. Zaznacz 2–3 sticky notes (Ctrl/Cmd+click lub lasso).
2. `Cmd/Ctrl+G` → nodes grupują się w `groupNode`.
3. Sprawdź, że `type: "groupNode"` pojawia się w payloadzie (lub że parent-child relationship jest zakodowana).
4. `Cmd/Ctrl+Shift+G` → rozgrupowanie. Sprawdź, że nodes wracają jako samodzielne.

### 2.10 Krawędzie (LabeledEdge) — połączenia między węzłami

**Kroki:**
1. Najedź na węzeł A → pojawia się punkt łączenia (handle).
2. Przeciągnij z handle węzła A do węzła B — tworzy się krawędź.
3. Dwuklik na krawędź → edycja etykiety.
4. Sprawdź `type: "labeled"` w `edges` payloadu PUT.
5. Klik krawędź + Delete → krawędź usunięta, payload nie zawiera jej w `edges`.

---

## §3 · EPIK 3 — Tryb rysowania (IdeaDrawingLayer)

> **Źródło:** `IdeaDrawingLayer.tsx:76–145` · `WhiteboardToolbar.tsx` (przycisk Pen)

### 3.1 Przełączanie tryb board ↔ draw

**Kroki:**
1. Klik przycisk **Pen** w toolbar → tryb rysowania aktywny (`whiteboardMode === 'draw'`).
2. Sprawdź, że przycisk jest podświetlony (`active=true`, `ariaPressed=true`).
3. Sprawdź, że wszystkie węzły tablicy są zablokowane (`locked` w ReactFlow) — nie można ich przesuwać.
4. `Esc` → wraca do trybu board. Węzły odblokowane.
5. Ponowny klik Pen lub przycisk Canvas w toolbar → powrót do board.

### 3.2 Rysowanie pen [MANUAL]

**Kroki:**
1. Wejdź w tryb draw.
2. Narysuj linię odręczną na canvas (przytrzymaj LPM i przeciągnij).
3. Sprawdź, że ścieżka rysowania pojawia się nad canvas (SVG overlay).
4. Autosave / ręczny save → sprawdź, że `extensions.whiteboard.drawingPaths` w payloadzie zawiera tablicę ze ścieżkami.
5. Odśwież → ścieżki wczytywane z serwera.

### 3.3 Highlighter i gumka [MANUAL]

**Kroki:**
1. W trybie draw zmień narzędzie na **highlighter** (jeśli dostępne w UI).
2. Narysuj ślad highlightera — grubsza, półprzezroczysta linia.
3. Zmień na **gumkę** → przeciągnij po ścieżce → część ścieżki znika.
4. Sprawdź payload po save: `drawingPaths` zaktualizowane.

### 3.4 Zmiana koloru i grubości pędzla [MANUAL]

**Kroki:**
1. W trybie draw — zmień kolor (jeśli UI na to pozwala; sprawdź czy `IdeaDrawingLayer` eksponuje picker).
2. Zmień grubość linii.
3. Narysuj i sprawdź, że nowa ścieżka ma inne właściwości w payloadzie.

### 3.5 Czyszczenie rysunków

**Kroki:**
1. Narysuj coś w trybie draw.
2. Wróć do trybu board — pojawia się przycisk **Trash** (Wyczyść rysunki) obok Pen (widoczny tylko gdy `drawingPathCount > 0`).
3. Klik Trash → dialog potwierdzenia lub natychmiastowe czyszczenie.
4. Sprawdź, że `drawingPaths` = pusta tablica w payloadzie PUT po save.

---

## §4 · EPIK 4 — Undo / Redo (stos historii)

> **Źródło:** `IdeaWhiteboardTool.tsx:652–700` · `undoStackRef` / `redoStackRef` (stos maks. 25)

### 4.1 Undo pojedynczej operacji

**Kroki:**
1. Dodaj węzeł sticky (operacja 1).
2. `Cmd/Ctrl+Z` → sticky znika. Toolbar: przycisk Undo wyszarzony lub jeszcze aktywny?
3. Sprawdź, że `undoStackRef.current.length` zmniejszył się (przez DevTools → Source paused lub logowanie).
4. Sprawdź, że canvas wrócił do stanu sprzed dodania.

### 4.2 Redo po Undo

**Kroki:**
1. Kontynuacja od 4.1 — po Undo klik **Redo** (Ctrl+Shift+Z lub przycisk w toolbar).
2. Sticky wraca. `redoStackRef` pusty.
3. Wykonaj kolejną operację po Undo → Redo powinno być niedostępne (stos redo czyszczony po nowej akcji).

### 4.3 Wielopoziomowe Undo (do 25 kroków)

**Kroki:**
1. Dodaj 30 węzłów jeden po drugim.
2. Wykonaj Undo 25 razy (`Cmd+Z` x25).
3. Po 25. Undo przycisk Undo powinien być wyszarzony (`canUndo=false`).
4. Sprawdź, że nie ma możliwości cofnięcia więcej niż 25 kroków (klip stos).

### 4.4 Undo w trybie rysowania

**Kroki:**
1. Narysuj 3 ścieżki w trybie draw.
2. `Cmd/Ctrl+Z` trzykrotnie — sprawdź, czy undo działa na `drawingPaths` tak samo jak na węzłach.
3. Odnotuj zachowanie (undo może nie obejmować warstwy rysowania — weryfikuj i dokumentuj).

### 4.5 Disabled podczas zapisu

**Kroki:**
1. Wyzwól ręczny save (`Ctrl+S`).
2. W trakcie zapisu (stan `saving=true`) sprawdź, że przyciski Undo/Redo mają `disabled` i klawisze `Cmd+Z` / `Cmd+Shift+Z` są ignorowane.

---

## §5 · EPIK 5 — Selekcja i operacje na grupach węzłów

> **Źródło:** `getIdeasToolInteractionProps` · `IdeaWhiteboardTool.tsx:2558–2560` (Ctrl+A)

### 5.1 Pojedyncza selekcja

**Kroki:**
1. Klik na węzeł → pojawia się obramowanie selekcji, `WhiteboardSelectionBar` widoczny.
2. Klik w puste miejsce canvas → deselect.
3. Sprawdź `ariaLabel` selekcji dla a11y.

### 5.2 Selekcja wielokrotna — Ctrl+click [MANUAL]

**Kroki:**
1. Klik węzeł A → zaznaczony.
2. `Ctrl+click` (lub `Cmd+click` Mac) węzeł B → obydwa zaznaczone (nie deselect A).
3. `Ctrl+click` ponownie węzeł A → odznaczony, B pozostaje.
4. `WhiteboardSelectionBar` pokazuje liczbę zaznaczonych.

### 5.3 Selekcja lasso (marquee) [MANUAL]

**Kroki:**
1. W pustym miejscu canvas (bez węzła) — przytrzymaj LPM i przeciągnij — pojawia się prostokąt lasso.
2. Węzły wewnątrz prostokąta stają się zaznaczone po puszczeniu.
3. Sprawdź, że węzły częściowo wewnątrz lasso: czy są zaznaczone (zależy od trybu intersection/containment ReactFlow — odnotuj zachowanie).

### 5.4 Zaznacz wszystko — Ctrl+A

**Kroki:**
1. `Ctrl/Cmd+A` → wszystkie węzły zaznaczone (`setNodes` z `selected: true`).
2. Sprawdź, że `WhiteboardSelectionBar` pokazuje całkowitą liczbę węzłów.

### 5.5 Grupowanie / odgrupowywanie

**Kroki:**
1. Zaznacz 2 sticky notes → `Cmd+G` → `groupNode` pojawia się, sticky są jego dziećmi.
2. Sprawdź payload: `type: "groupNode"` w `nodes`.
3. Zaznacz group → `Cmd+Shift+G` → nodes wracają jako samodzielne, `groupNode` znika z payloadu.
4. Edge: grupowanie 1 węzła → co się dzieje? Sprawdź czy guard istnieje.

### 5.6 Duplicate (duplikowanie zaznaczonych)

**Kroki:**
1. Zaznacz 2 węzły.
2. `WhiteboardSelectionBar` → przycisk Duplicate lub quick-action `wb_duplicate`.
3. Sprawdź, że 2 nowe węzły pojawiają się z offset pozycją.
4. Edge: `useWhiteboardNodes.ts` — zablokowane węzły (`locked=true`) NIE są duplikowane (zweryfikuj w kodzie `:42–65`).

### 5.7 Delete (usuwanie zaznaczonych)

**Kroki:**
1. Zaznacz węzeł → `Delete` lub `Backspace`.
2. Węzeł i wszystkie krawędzie do niego znikają.
3. Sprawdź payload PUT — węzeł NIE pojawia się w `nodes`.
4. Edge: usunięcie `frameNode` z dziećmi — co się dzieje z dziećmi? Odnotuj.

### 5.8 Wyrównanie (alignment) — 6 kierunków + distribute

**Kroki:**
1. Zaznacz 3+ węzły.
2. `WhiteboardSelectionBar` → przyciski wyrównania: Left, Center, Right, Top, Middle, Bottom.
3. Klik „Align Left" → wszystkie węzły mają tę samą `position.x`.
4. Klik „Distribute Horizontal" → równe odstępy.
5. Sprawdź payload po autosave — pozycje zaktualizowane.

### 5.9 Lock / Unlock węzła

**Kroki:**
1. Zaznacz węzeł → `WhiteboardSelectionBar` → przycisk Lock.
2. Zablokowany węzeł: cursor `not-allowed`, nie można przesunąć [MANUAL], nie duplikuje się.
3. Unlock → węzeł znowu edytowalny.
4. Sprawdź `data.locked: true/false` w payloadzie PUT.

---

## §6 · EPIK 6 — Edycja treści węzłów

### 6.1 Edycja etykiety sticky note (dblclick)

**Kroki:**
1. Dwuklik na StickyNoteNode → inline textarea aktywna.
2. Wpisz tekst. Klik poza → zapis do `data.label`.
3. Sprawdź, że `data.label` zaktualizowany w payloadzie PUT.

### 6.2 Edycja TextBlock — formatowanie

**Kroki:**
1. Dwuklik na TextBlock → edytowalny.
2. Sprawdź dostępne opcje formatowania (bold/italic/underline — jeśli komponent je obsługuje).
3. Zapisz, sprawdź payload.

### 6.3 Zmiana koloru / stylu węzła

**Kroki:**
1. Zaznacz StickyNote → `WhiteboardSelectionBar` → picker koloru.
2. Zmień kolor → `data.colorIndex` lub `data.bg` zaktualizowane.
3. Zaznacz ShapeNode → zmień wypełnienie/obramowanie (jeśli dostępne).
4. Sprawdź payload.

### 6.4 Zmiana rozmiaru węzła (resize) [P2]

**Kroki:**
1. Zaznacz dowolny węzeł — sprawdź, czy handles resize pojawiają się na rogach/krawędziach.
2. Przeciągnij handle resize [MANUAL].
3. Sprawdź, czy `width`/`height` zmieniają się w danych węzła.

**Znany brak L-05:** `NodeResizer` nie istnieje w module whiteboard. Oczekiwany: handles NIE pojawiają się. Odnotuj jako KNOWN BUG L-05.

### 6.5 Semantic type node'a

**Kroki:**
1. Dodaj StickyNote przez `wb_add_action` (slash-menu) → `data.semanticType: "action"`.
2. Sprawdź, że label semantyczny jest widoczny na karcie (badge lub podkreślenie).
3. Sprawdź `getSemanticTypeLabel` w payloadzie.

---

## §7 · EPIK 7 — Zoom, pan, nawigacja na canvas

> **Źródło:** `getIdeasToolInteractionProps` (`canvas/useIdeasToolDefaults.ts:30–58`) · skróty klawiszowe

### 7.1 Zoom kółkiem myszy [MANUAL]

**Kroki:**
1. Kółko myszy w górę → przybliżenie canvas.
2. Kółko myszy w dół → oddalenie.
3. Minimap aktualizuje się synchronicznie.
4. Sprawdź, że viewport `{ x, y, zoom }` zmienia się (callback `onViewportChange`).

### 7.2 Zoom gestem trackpad (pinch) [MANUAL]

**Kroki:**
1. Pinch-to-zoom na trackpadzie Mac → powiększenie/pomniejszenie.
2. Gesty dwóch palców (pan) → przesunięcie canvas.
3. Sprawdź, że elementy tablicy nie przesuwają się (tylko viewport).

### 7.3 Fit-to-screen (Shift+1 / Cmd+0) [MANUAL]

**Kroki:**
1. Przesuń widok daleko od węzłów.
2. `Shift+1` → canvas dopasowuje się do wszystkich węzłów (`fitView`).
3. `Cmd/Ctrl+0` → ta sama akcja.
4. Sprawdź, że wszystkie węzły są widoczne.

### 7.4 Pan prawym przyciskiem / środkowym [MANUAL]

**Kroki:**
1. PPM przytrzymane + ruch myszy → pan canvas.
2. Środkowy przycisk myszy + ruch → pan.
3. `Space` + LPM → pan (zgodnie z `useIdeasToolDefaults`).

### 7.5 CanvasZoomControls (przyciski +/−/fit)

**Kroki:**
1. Sprawdź, że komponent `CanvasZoomControls` jest wyrenderowany na canvas.
2. Przycisk `+` → przybliżenie.
3. Przycisk `−` → oddalenie.
4. Przycisk `fit` → `fitView`.

### 7.6 MiniMap

**Kroki:**
1. Sprawdź, że `MiniMap` (ReactFlow) pojawia się w rogu canvas.
2. Klik na minimap → viewport przesuwa się do klikniętego obszaru [MANUAL].

---

## §8 · EPIK 8 — Kopiuj / wklej (copy/paste)

> **Źródło:** `IdeaWhiteboardTool.tsx:213–335` (`handlePaste`, `handleDrop`)

### 8.1 Wklejanie obrazu ze schowka (Ctrl+V) [MANUAL]

**Kroki:**
1. Skopiuj PNG do schowka (przeglądarkowe `navigator.clipboard` lub `Ctrl+C` w Finder).
2. Klik na canvas → `Ctrl+V`.
3. Handler `handlePaste` → `file.type.startsWith('image/')` → tworzy `imageNode` z base64.
4. Sprawdź `type: "imageNode"` w payloadzie PUT.

### 8.2 Wklejanie tekstu ze schowka (Ctrl+V)

**Kroki:**
1. Skopiuj tekst „Hello Whiteboard" do schowka.
2. `Ctrl+V` na canvas.
3. Handler sprawdza `e.clipboardData.getData('text/plain')` → tworzy StickyNote lub TextBlock z tym tekstem.
4. Sprawdź payload.

### 8.3 Drag & drop pliku obrazu na canvas [MANUAL]

**Kroki:**
1. Przeciągnij plik PNG z Findera na canvas.
2. `handleDrop` → `e.dataTransfer.files` → tworzy `imageNode`.
3. Sprawdź `dropEffect: 'copy'` na `dragover`.
4. Sprawdź payload PUT.

### 8.4 Wklejenie URL jako link node

**Kroki:**
1. Skopiuj URL `https://consultify.app` do schowka.
2. `Ctrl+V` na canvas.
3. Handler sprawdza, czy text jest URL → tworzy `linkNode` zamiast StickyNote.
4. Sprawdź `type: "linkNode"`, `data.url` w payloadzie.

### 8.5 Edge: anulowanie dropu poza canvasem [MANUAL]

**Kroki:**
1. Przeciągnij plik PNG na inne miejsce strony (poza canvas ReactFlow).
2. Sprawdź, że drop na poza-canvas NIE tworzy węzła.

---

## §9 · EPIK 9 — Persystencja i autosave

> **Źródło:** `useIdeaMapSync.ts` · `IdeaWhiteboardTool.tsx:943–959` (hydration) · `localStorage` klucz `idea-map-draft-:id`

### 9.1 Autosave (idle 60s + dirty-flush)

**Kroki:**
1. Dodaj węzeł, NIE zapisuj ręcznie.
2. Poczekaj 60 sekund (lub sprawdź `DEFAULT_DRAFT_MS` i `DEFAULT_IDLE_MS` w `useIdeaMapSync`).
3. W Network: pojawia się `PUT /api/my-work/my-ideas/:id/map` automatycznie.
4. Sprawdź pole `version` — rośnie z każdym zapisem.

### 9.2 Ręczny save (Cmd/Ctrl+S)

**Kroki:**
1. Dodaj węzeł.
2. `Cmd/Ctrl+S` lub przycisk Save w toolbar.
3. Natychmiastowy `PUT /api/my-work/my-ideas/:id/map`. Status 200.
4. Payload: `{ nodes, edges, extensions, baseVersion: N }`.
5. Sprawdź `saveStatusLabel` w toolbar — zmienia się na „Saved" lub datę zapisu.

### 9.3 Zapis przy zmianie vidoczności (visibilitychange)

**Kroki:**
1. Dodaj węzeł (brudny stan).
2. Przełącz na inną zakładkę przeglądarki.
3. `visibilitychange` → `useIdeaMapSync` wyzwala flush.
4. Wróć na zakładkę → sprawdź Network, że PUT wystrzelił.

### 9.4 Draft lokalny w localStorage (offline fallback)

**Kroki:**
1. Dodaj węzeł.
2. Sprawdź `localStorage` → klucz `idea-map-draft-:id` zawiera JSON z `nodes`, `baseVersion`, `updatedAt`.
3. Zasymuluj offline: DevTools → Network → Offline.
4. Dodaj kolejny węzeł — `syncState` zmienia się na `'offline'`, toast lub etykieta informuje o trybie offline.
5. Wróć do online → `useIdeaMapSync` wyzwala flush z queued change.
6. Sprawdź, że draft localStorage jest czyszczony po udanym syncu.

### 9.5 Hydracja przy wejściu (draft vs server)

**Kroki:**
1. Zapisz tablicę (wersja N). Następnie: wymuś crash przez odświeżenie w trakcie edycji.
2. Sprawdź `resolveIdeaMapHydration` (`useIdeaMapSync.ts:138–171`): jeśli `draft.baseVersion < serverVersion` → serwer wygrywa; jeśli draft świeższy → draft wczytywany.
3. Sprawdź toast informujący o użyciu draftu (jeśli zaimplementowany).

### 9.6 Konflikt 409 (wersjonowanie optymistyczne) [FLAG]

**Kroki:**
1. Otwórz tę samą tablicę w dwóch oknach (ta sama sesja, ownerA).
2. W oknie A dodaj węzeł, zapisz (wersja N).
3. W oknie B (wciąż w wersji N-1) dodaj inny węzeł, zapisz.
4. Okno B powinno dostać 409 w Network (`err.status === 409`).
5. `syncState` zmienia się na `'conflict'` — toolbar/etykieta pokazuje „Konflikt zmian" / „Change conflict".
6. Sprawdź `onConflict` callback — co dostaje użytkownik? Toast? Prompt do reload?

**Asercja kodu:** `useIdeaMapSync.ts:264–268` obsługuje 409.

---

## §10 · EPIK 10 — AI-assist (generatory whiteboard)

> **Źródło:** endpoint `POST /api/my-work/my-ideas/:id/ai-generate` · `IdeaAISuggestionsPanel.tsx` · `IdeaProposalReview.tsx` · `IdeaAINudgeStrip.tsx`

### 10.1 Generator „Dodaj notatki (AI)" — wb_add_sticky / whiteboard_brainstorm

**Kroki:**
1. Na tablicy z kilkoma sticky notes otwórz panel AI suggestions.
2. Klik „Dodaj notatki (AI)" (`wb_add_sticky` action).
3. Sprawdź Network: `POST /api/my-work/my-ideas/:id/ai-generate` z `generatorType: "whiteboard_brainstorm"` (lub podobnym).
4. Pojawia się `proposalBatch` — nakładka z ghost-cards propozycji (`IdeaProposalReview`).
5. **Accept pojedynczej propozycji:** klik „✓" przy jednej ghost-card → węzeł materializuje się na canvas.
6. **Reject:** klik „✗" → ghost-card znika.
7. **Accept All:** klik „Akceptuj wszystkie" → wszystkie ghost-cards materializują się.
8. **Reject All:** klik „Odrzuć wszystkie".
9. Sprawdź payload PUT po akceptacji — nowe węzły są w `nodes`.

**Esc:** naciśnięcie Esc podczas `proposalBatch` → zamknięcie review (`setProposalBatch(null)`) — żadna propozycja nie jest akceptowana.

### 10.2 Generator „Auto-klasteryzacja" — wb_add_cluster

**Kroki:**
1. Utwórz 6–8 sticky notes z różnymi tekstami.
2. AI suggestions → „Auto-klasteryzacja".
3. Propozycje: frame-klastry grupujące tematycznie.
4. Akceptuj → `frameNode` z `semanticType: "cluster"` pojawia się, sticky notes przypisane.

### 10.3 Generator „Wyodrębnij tematy" — wb_add_theme

**Kroki:**
1. AI suggestions → „Wyodrębnij tematy".
2. Propozycje: `summaryCard` z `semanticType: "theme"`.
3. Akceptuj → sprawdź payload.

### 10.4 Generator „Zidentyfikuj wyniki" — wb_add_outcome

**Kroki:**
1. AI suggestions → „Zidentyfikuj wyniki".
2. `summaryCard` z `semanticType: "outcome"`.
3. Akceptuj → sprawdź payload.

### 10.5 Generator „Zapisz decyzję" — wb_add_decision

**Kroki:**
1. AI suggestions → „Zapisz decyzję".
2. `textBlock` z `semanticType: "decision"`.
3. Akceptuj → sprawdź payload.

### 10.6 Generator „Dodaj akcję" — wb_add_action

**Kroki:**
1. AI suggestions → „Dodaj akcję".
2. `stickyNote` z `semanticType: "action"`.
3. Akceptuj → sprawdź payload.

### 10.7 Nudge strip (IdeaAINudgeStrip)

**Kroki:**
1. Sprawdź, że pasek nudge AI pojawia się na dole/górze canvas gdy AI sugestia jest dostępna.
2. Klik przycisk w nudge strip → otwiera AI suggestions lub wyzwala generację.
3. Zamknięcie nudge strip — czy zapamiętuje, żeby nie pokazywać ponownie?

### 10.8 Slash-menu (/) — komendy AI i dodawanie elementów

**Kroki:**
1. Na canvas wpisz `/` (klawisz forward slash).
2. Sprawdź, że `IdeaSlashCommandMenu` pojawia się.
3. Wyszukaj `sticky` → wybierz → node pojawia się.
4. Wyszukaj `theme` → `wb_add_theme`.
5. Wyszukaj `cluster`, `outcome`, `decision`, `action`, `kpi`, `score`, `progress`.
6. `Esc` → menu zamknięte, brak akcji.
7. Klik poza menu → zamknięte.

### 10.9 E2E weryfikacja generatora (Network)

**Obowiązek:** dla dowolnego generatora (np. brainstorm):
- Sprawdź request `POST /api/my-work/my-ideas/:id/ai-generate` z body `{ generatorType, nodes: <kontekst tablicy> }`.
- Response: JSON z `proposals` lub streaming.
- Po akceptacji: `PUT /api/my-work/my-ideas/:id/map` zawiera zaakceptowane nodes.

---

## §11 · EPIK 11 — Sceny i tryb prezentacji (IdeaScenesManager)

> **Źródło:** `IdeaScenesManager.tsx` · persystowane w `extensions.whiteboard.scenes`

### 11.1 Tworzenie sceny

**Kroki:**
1. Przejdź do managera scen (`IdeaScenesManager` w UI — sprawdź gdzie jest dostępny, prawdopodobnie przycisk toolbar lub panel boczny).
2. Klik „Dodaj scenę" / „Add scene".
3. Wpisz nazwę sceny. Scena zapisuje viewport `{ x, y, zoom }` lub zaznaczone węzły.
4. Sprawdź, że `extensions.whiteboard.scenes` zawiera nową scenę w payloadzie PUT.

### 11.2 Przejście między scenami

**Kroki:**
1. Utwórz 2 sceny z różnymi viewportami.
2. Klik na scenę 1 → canvas przesuwa się/zoom do zapisanego viewportu.
3. Klik na scenę 2 → inny widok.

### 11.3 Tryb prezentacji (presentation mode)

**Kroki:**
1. Wejdź w tryb prezentacji (przycisk lub F-key — sprawdź UI).
2. Strzałki lub klik → przemieszczanie między scenami.
3. Sprawdź, że UI jest uproszczone (ukryty toolbar, pełnoekranowy canvas).
4. `Esc` → wyjście z trybu prezentacji.

### 11.4 Usunięcie sceny

**Kroki:**
1. Usuń scenę z managera.
2. Sprawdź, że `extensions.whiteboard.scenes` nie zawiera usuniętej sceny.

---

## §12 · EPIK 12 — Quick-starty (szablony burzy mózgów)

> **Źródło:** `IdeaWhiteboardTool.tsx:1726–1831` · `WhiteboardEmptyState.tsx`

### 12.1 Pusty stan — wyświetlanie

**Kroki:**
1. Otwórz Whiteboard z pustą tablicą (0 węzłów).
2. Sprawdź, że `WhiteboardEmptyState` jest widoczny z opcjami quick-start.
3. Sprawdź komunikat i przyciski: „Burza mózgów" / „Brainstorm", „Mapa afinizacji" / „Affinity map", „Warsztat" / „Workshop" oraz importowanie outline.

### 12.2 Quick-start: Brainstorm

**Kroki:**
1. Klik „Burza mózgów" → tryb `brainstorm`.
2. Modal/prompt o temacie sesji?
3. Na canvas pojawia się węzeł tytułowy „Temat sesji" + 4 sticky notes (sticky 1–4).
4. Sprawdź `type: "stickyNote"` × 5 (1 tytuł + 4 ideas) w payloadzie.
5. `rememberSnapshot` wyzwolone → undo cofa cały quick-start jednym krokiem.

### 12.3 Quick-start: Affinity map

**Kroki:**
1. Klik „Mapa afinizacji" → tryb `affinity`.
2. Na canvas pojawia się zestaw frame'ów z etykietami kategorii + sticky notes.
3. Sprawdź payload — `type: "frameNode"` dla frame'ów.

### 12.4 Quick-start: Workshop

**Kroki:**
1. Klik „Warsztat" → tryb `workshop`.
2. Sprawdź strukturę szablonu na canvas.

### 12.5 Import outline

**Kroki:**
1. Sprawdź przycisk importu outline w `WhiteboardEmptyState` lub toolbar.
2. Wklej outline tekstowy (np. `- Temat 1\n  - Podtemat 1.1\n  - Podtemat 1.2`).
3. `IdeaWhiteboardTool.tsx:1641–1669` — outline parsowany, sticky notes/nodes tworzone hierarchicznie.
4. Sprawdź payload.

---

## §13 · EPIK 13 — Eksport (IdeaExportMenu)

> **Źródło:** `IdeaExportMenu.tsx` · payload eksportu przez `IdeaMapWorkspace.tsx:2530` (listener eventu `idea-workspace-open-export-menu`)

### 13.1 Otwarcie menu eksportu

**Kroki:**
1. Klik przycisk **Export** (ExternalLink icon) w toolbar.
2. Sprawdź, że CustomEvent `idea-workspace-open-export-menu` jest dispatch'owany z `{ ideaId }`.
3. `IdeaMapWorkspace` odbiera event → otwiera `IdeaExportMenu` (`exportMenuOpen=true`).

### 13.2 Eksport do PNG

**Kroki:**
1. W `IdeaExportMenu` wybierz PNG.
2. Klik Eksportuj → `html-to-image` generuje PNG z canvasa.
3. Plik pobiera się (dialog save lub automatyczny download).
4. Sprawdź, że watermark jest widoczny na obrazie (jeśli `exportFooter` ustawiony).

### 13.3 Eksport do SVG

**Kroki:**
1. `IdeaExportMenu` → SVG.
2. Pobiera się plik `.svg`.
3. Otwórz w przeglądarce → wszystkie węzły widoczne.

### 13.4 Eksport do Markdown

**Kroki:**
1. `IdeaExportMenu` → Markdown.
2. Sprawdź format: nagłówki, listy, linki do artefaktów.

### 13.5 Eksport do JSON

**Kroki:**
1. `IdeaExportMenu` → JSON.
2. Pobiera się JSON z pełną strukturą `nodes/edges/extensions`.

### 13.6 Governance — blokada eksportu [FLAG]

**Kroki:**
1. Sprawdź `whiteboardPolicy.exportAllowed` (`IdeaExportMenu.tsx:177`).
2. Jeśli `exportAllowed=false` → baner „Eksport zablokowany przez governance whiteboard."
3. Przyciski eksportu mają `disabled`.
4. Sprawdź, że governance jest **FE-only** (BE nie weryfikuje — KNOWN GAP, L-04 klasa P2).

### 13.7 Eksport jako artefakt do Inicjatyw

**Kroki:**
1. W `IdeaExportMenu` wybierz „Eksportuj do Inicjatyw" (jeśli opcja dostępna).
2. Sprawdź payload PUT `/map` zawiera `exportedToType: "initiative"`, `exportedToId: <id>`.
3. Przejdź do modułu Inicjatyw → sprawdź, czy artefakt jest tam widoczny (test §18 — ścieżka cross-module).

---

## §14 · EPIK 14 — Facilitation API (12 endpointów) [DB]

> **Źródło:** `realtime-platform.routes.ts:457–849` · `realtimePlatformService.ts` · `IdeaWhiteboardTool.tsx:1035–1200`

### 14.1 Tworzenie sesji facilitation (createFacilitationSession)

**Kroki:**
1. Klik **Voting** w toolbar (`onToggleVoting`) lub **Role** (`onCycleRole`).
2. Handler `ensureFacilitationSession` wyzwala `POST /api/realtime-v4/facilitation/sessions`.
3. Sprawdź Network: body `{ orgId, ideaId, toolSessionId, language }`.
4. Response: `{ id, ... }` — `sessionId` zapisywany w `sessionState.sessionId`.
5. Sprawdź `data.sessionId` w payloadzie PUT `/map` (sessionState persystowany w extensions.whiteboard).

**[DB]:** `SELECT * FROM tool_facilitation_sessions WHERE id=:sessionId` — wiersz istnieje.

### 14.2 Role — cykl roli (facilitator → participant → observer)

**Kroki:**
1. Klik **Role** (Workflow icon) w toolbar → `cycleSessionRole()`.
2. Rola przechodzi `facilitator → participant → observer → facilitator`.
3. Network: `POST /api/realtime-v4/facilitation/sessions/:id/roles` z `{ userId, roleName, permissions }`.
4. Sprawdź, że `sessionState.role` aktualizuje się w stanie i payloadzie PUT `/map`.

**[FLAG] Known mock:** role są samonadawane bez enforcement serwerowego. Odnotuj jako FASADA.

### 14.3 Timer facilitation — uruchomienie i zatrzymanie

**Kroki:**
1. Klik timer w `WhiteboardSessionPanel` → `toggleSessionTimer()`.
2. Network: `PUT /api/realtime-v4/facilitation/sessions/:id/timer` z `{ timerEndsAt, timerSeconds }`.
3. Timer odlicza w UI.
4. Zatrzymaj timer → payload z `timerEndsAt: null`.
5. Sprawdź `timerEndsAt` w extensions whiteboard po `PUT /map`.

### 14.4 Głosowanie — tryb voting (castVote) [DB]

**Kroki:**
1. Klik **Voting** w toolbar → `votingOpen: true`.
2. Network: `PUT /api/realtime-v4/facilitation/sessions/:id/timer` lub faza? Sprawdź dokładnie jakie żądania.
3. Klik węzeł — cast vote (`facilitationCastVote`).
4. Network: `POST /api/realtime-v4/facilitation/sessions/:id/votes` z `{ userId, nodeId }`.
5. Sprawdź response → `sessionVotes` aktualizuje się.
6. **[DB]:** `SELECT * FROM tool_facilitation_votes WHERE session_id=:sessionId AND node_id=:nodeId` — 1 wiersz per user/node (upsert).

### 14.5 Pobranie wyników głosowania (getVoteSummary) — [P0] znana luka L-03

**Kroki:**
1. Zrób głosowania (kroki 14.4).
2. Sprawdź czy UI pobiera `GET /api/realtime-v4/facilitation/votes/summary`.
3. Network: `GET /facilitation/votes/summary?sessionId=:id`.
4. **[P0] KNOWN BUG L-03:** endpoint nie sprawdza org-scope (`realtime-platform.routes.ts:696`). Dokumentuj: można podać dowolny `sessionId` bez autoryzacji organizacji.
5. Sprawdź, że wyniki głosowania są wyświetlane w UI.

### 14.6 Emoji-reakcje w głosowaniu [FASADA]

**Kroki:**
1. W trybie voting spróbuj dodać emoji-reakcję.
2. **KNOWN MOCK:** `IdeaVotingMode.tsx:53,147–153` — emoji są lokalnym stanem, NIE są persystowane.
3. Odśwież stronę → emoji-reakcje zniknęły. Odnotuj jako FASADA.

### 14.7 Faza facilitation (updatePhase)

**Kroki:**
1. `WhiteboardPhaseBar` (jeśli widoczny) → zmień fazę: `start → organize → converge → handoff`.
2. Network: `PUT /api/realtime-v4/facilitation/sessions/:id/phase` z `{ phase }`.
3. Sprawdź `FACILITATION_TRANSITIONS` — przejście `handoff → *` jest niemożliwe (brak forward transitions).
4. Przetestuj niedozwolone przejście (np. `start → handoff`) — sprawdź, czy UI blokuje.

### 14.8 Stan sesji przez uczestników — [P1] FASADA L-04

**Kroki:**
1. Jako ownerA ustaw fazę, uruchom timer.
2. Zaloguj jako memberB na tej samej tablicy.
3. **KNOWN BUG L-04:** `facilitationGetSession` (`api.ts:18483`) ma **0 call-sites** w komponentach. memberB NIE widzi timera ani fazy ownerA bez reloadu.
4. Dokumentuj: brak pollingu `GET /api/realtime-v4/facilitation/sessions/:id` przez uczestników.

### 14.9 Outcomes — tworzenie (createOutcome)

**Kroki:**
1. Zaznacz węzeł z `semanticType: "outcome"` lub `"decision"`.
2. Sprawdź przycisk „Utwórz outcome" w `WhiteboardSelectionBar` lub menu kontekstowym.
3. Network: `POST /api/realtime-v4/facilitation/sessions/:id/outcomes` z `{ type, title, nodeId, sourceNodeIds }`.
4. **[DB]:** `SELECT * FROM tool_facilitation_outcomes WHERE session_id=:id` — wiersz istnieje.

### 14.10 Eksport wyniku (exportOutcome) — [P0] FASADA L-03

**Kroki:**
1. W panelu outcomes → przycisk eksportu wyniku.
2. Network: `PUT /api/realtime-v4/facilitation/outcomes/:id/export` z `{ exportedToType, exportedToId }`.
3. **[P0] KNOWN BUG L-03:** endpoint nie sprawdza org-scope. Dokumentuj.

---

## §15 · EPIK 15 — Presence i WebSocket (CollaborationOverlay)

> **Źródło:** `IdeaWhiteboardTool.tsx:2012–2058` (polling 5s) · `ideaCollabWs.gateway.ts:195–443` · `CollaborationOverlay`

### 15.1 Dołączenie do presence

**Kroki:**
1. Wejdź na whiteboard.
2. Network: `POST /api/realtime-v4/tool-sessions/:id/presence` z `{ userId, userName, role }`.
3. Co 5 sekund: `POST .../heartbeat`.
4. Sprawdź, że `presenceUsers` zawiera ownerA.

### 15.2 Obecność drugiego użytkownika [MANUAL]

**Kroki:**
1. ownerA na tablicy.
2. memberB wchodzi na tę samą tablicę (jeśli L-01 nie blokuje — teraz blokuje, więc ten test jest blokowany przez L-01).
3. **Odnotuj:** ze względu na L-01 memberB dostaje 404 przy `/map`. Presence może mimo to zadziałać.
4. Sprawdź `CollaborationOverlay` — czy avatary drugiego usera są widoczne.
5. `GET /api/realtime-v4/tool-sessions/:id/presence` → lista uczestników.

### 15.3 Heartbeat i duchy-awatary [P1]

**Kroki:**
1. Otwórz tablicę, poczekaj, zamknij zakładkę bez `disconnect`.
2. Po 30+ sekundach sprawdź `GET .../presence` → czy duchawa sesja jest filtrowana po TTL.
3. **KNOWN BUG (naprawiony w kodzie per teczka):** `cleanStalePresence` i TTL-filter powinny działać po fixie `0b81310448`. Zweryfikuj live na staging.

### 15.4 Disconnect przy zamknięciu

**Kroki:**
1. Otwórz tablicę.
2. Zamknij zakładkę lub przejdź do innego modułu.
3. Network (przed zamknięciem): `POST .../disconnect` — sprawdź czy jest wysyłane.
4. Sprawdź `presence` — ownerA usunięty z listy.

### 15.5 WS — resource authorization [DB]

**Kroki:**
1. Spróbuj otworzyć WS connection `/ws/collab/:ideaId` z tokenem obcej org (można symulować przez modyfikację tokena w DevTools).
2. **Oczekiwane (fix `b9f2dee9d2`):** `ideaCollabWs.gateway.ts:237–242` → 403.
3. Sprawdź kod: DB-check `WHERE id=? AND organization_id=?` — potwierdzony.
4. Odnotuj jako PASS (zweryfikowany w kodzie).

### 15.6 Kursory innych użytkowników [FLAG] [MANUAL]

**Kroki:**
1. Dwa okna (ownerA i memberB, o ile L-01 naprawione lub testowane po-DP3).
2. Ruch myszy ownerA → kursor pojawia się u memberB.
3. Sprawdź `CollaborationOverlay` renderuje kursorowy avatar.
4. Bez L-01 fix ten test jest FASADĄ — dokumentuj.

---

## §16 · EPIK 16 — Tło (background pattern)

> **Źródło:** `WhiteboardToolbar.tsx:219–260` · `CanvasBgPattern` enum

### 16.1 Zmiana wzoru tła

**Kroki:**
1. Toolbar → dropdown tła (Grid3x3 icon).
2. Wybierz kolejno: `dots`, `grid`, `lines`, `blank`.
3. Canvas zmienia wzór tła natychmiastowo.
4. Sprawdź, że zmiana jest persystowana: `extensions.whiteboard.bgPattern` w payloadzie PUT po save.
5. Odśwież stronę → tło wczytane z serwera.

### 16.2 Cykl przez tło klikiem głównego przycisku

**Kroki:**
1. Klik główny przycisku tła (nie dropdown) → cykl `dots → grid → lines → blank → dots`.

---

## §17 · EPIK 17 — Skróty klawiszowe i pomoc (?)

> **Źródło:** `whiteboardInteractionGrammar.ts` · `IdeaWhiteboardTool.tsx:2482–2570`

### 17.1 Pełna tabela skrótów

| Skrót | Akcja | Sekcja testu |
|---|---|---|
| `?` | Pokaż/ukryj pomoc | §17.2 |
| `Esc` | Zamknij pomoc / wyjdź z draw / zamknij menu | §17.3 |
| `Ctrl/Cmd+S` | Zapis | §9.2 |
| `Ctrl/Cmd+Z` | Undo | §4.1 |
| `Ctrl/Cmd+Shift+Z` | Redo | §4.2 |
| `Ctrl/Cmd+G` | Grupuj | §5.5 |
| `Ctrl/Cmd+Shift+G` | Rozgrupuj | §5.5 |
| `Ctrl/Cmd+A` | Zaznacz wszystko | §5.4 |
| `Delete` / `Backspace` | Usuń zaznaczone | §5.7 |
| `/` | Slash-menu | §10.8 |
| `Shift+1` / `Cmd+0` | Fit-to-screen | §7.3 |

### 17.2 Pomoc klawiszowa (KeyboardShortcutsHelp)

**Kroki:**
1. `?` na canvas → modal/panel `KeyboardShortcutsHelp` otwiera się.
2. Sprawdź, że wszystkie skróty z `getWhiteboardShortcuts(isPl)` są wyświetlone.
3. PL: etykiety w języku polskim; EN: angielskim.
4. `?` ponownie lub `Esc` → modal zamknięty.

### 17.3 Priorytety Esc (hierarchia zamykania)

**Kroki:**
1. Otwórz context menu → `Esc` zamyka context menu.
2. Otwórz slash-menu → `Esc` zamyka slash-menu.
3. Otwórz proposal review → `Esc` zamyka proposal.
4. Otwórz shortcuts help → `Esc` zamyka help.
5. Wejdź w tryb draw → `Esc` wychodzi z draw.
6. Sprawdź, że priorytety są zgodne z `IdeaWhiteboardTool.tsx:2500–2526`.

### 17.4 Izolacja skrótów podczas edycji tekstu

**Kroki:**
1. Dwuklik na sticky note → textarea aktywna.
2. Wpisz `?`, `/`, `a` — sprawdź, że skróty globalne NIE są wyzwalane gdy `isEditing()=true`.

---

## §18 · EPIK 18 — Ścieżki cross-module

### 18.1 Whiteboard → Inicjatywy (eksport wyniku)

**Kroki:**
1. Na whiteboard utwórz węzeł z `semanticType: "outcome"`.
2. Eksportuj go jako Inicjatywę (przycisk w `WhiteboardSelectionBar` lub `IdeaExportMenu`).
3. Sprawdź Network: `POST /api/initiatives` (lub odpowiedni endpoint) z danymi z węzła, ORAZ `PUT /map` z `exportedToType: "initiative"`, `exportedToId: <id>`.
4. Przejdź do `/initiatives` → sprawdź, że inicjatywa istnieje z tytułem z węzła.
5. Wróć na whiteboard → węzeł ma badge „converted" (wg `StickyNoteNode:30–130`).

### 18.2 Whiteboard → Czat Teresa

**Kroki:**
1. Sprawdź, czy na whiteboard jest przycisk „Zapytaj Teresę" lub czy AI suggestions panel powiązany jest z czatem.
2. Klik (jeśli dostępny) → czat otwiera się z kontekstem tablicy.
3. Sprawdź, czy payload do Teresy zawiera `context: <węzły tablicy>`.

### 18.3 Whiteboard → Canvas (eksport jako dokument)

**Kroki:**
1. Sprawdź `IdeaExportMenu` → opcja „Do Canvas" / „Export to Canvas document".
2. Klik → tworzy dokument Canvas z zawartością tablicy.
3. Sprawdź payload `POST /api/...` tworzący dokument.
4. Sprawdź nawigację do Canvas z nowym dokumentem.

### 18.4 Ideas List → Whiteboard (deep-link)

**Kroki:**
1. Z listy idei (`/my-work/ideas`) klik na ideę z aktywnym whiteboard (preferredSystem = 'whiteboard').
2. Sprawdź, że `/my-work/ideas/workspace/whiteboard` otwiera się z właściwą ideą.
3. URL zawiera `ideaId` jako parametr lub w stanie.

### 18.5 Library — wstawianie z biblioteki

**Kroki:**
1. Sprawdź akcję `insertLatestLibraryItem` / `saveSelectionToLibrary` w `useWhiteboardQuickActions`.
2. Zapisz selection do biblioteki → `libraryItems` w stanie.
3. Wstaw z biblioteki → nodes pojawiają się. Sprawdź `IdeaWhiteboardTool.tsx:1302–1351` — wstawia `libraryItems[0]` (KNOWN MOCK — tylko pierwszy element).
4. Odnotuj, że biblioteka jest lokalna (`localStorage` lub pamięć sesji), NIE persystowana do DB.

---

## §19 · Testy przekrojowe

### 19.1 Persistencja — pełny cykl

**Kroki:**
1. Dodaj węzły wszystkich 11 typów.
2. Zapisz (`Cmd+S`).
3. Zamknij zakładkę.
4. Otwórz ponownie → sprawdź, że wszystkie węzły wczytały się z serwera.
5. Sprawdź `version` w `my_idea_maps` — rośnie.

### 19.2 Disabled states podczas zapisu / ładowania

**Kroki:**
1. Podczas `saving=true`: przyciski Undo/Redo/Save są `disabled`.
2. Podczas `loading=true`: toolbar zablokowany, canvas w stanie ładowania.
3. Podczas `locked=true` (np. draw mode): operacje edycji zablokowane — nie można dodawać/przesuwać węzłów.

### 19.3 Viewport responsywny [MANUAL]

**Kroki:**
1. Zmień rozmiar okna przeglądarki do 1280px, 768px, 1440px.
2. Toolbar powinien być scrollowalny poziomo (`overflow-x: auto`) zamiast wypadać poza ekran.
3. Panel boczny facilitation nie zasłania toolbar.
4. Minimap nie wychodzi poza viewport.

### 19.4 Touch / tablet [MANUAL]

**Kroki:**
1. Otwórz na tablecie lub zasymuluj touch w DevTools.
2. Pan dwoma palcami, pinch-to-zoom → canvas reaguje.
3. Tap na węzeł → selekcja.
4. Dlugi tap na węzeł → context menu (jeśli zaimplementowane).

### 19.5 i18n — PL / EN

**Kroki:**
1. Przełącz język na PL (`/settings` lub URL param).
2. Sprawdź etykiety w toolbar, empty state, shortcutsHelp, toasty — wszystkie po polsku.
3. Przełącz na EN → wszystkie po angielsku.
4. Sprawdź, że `getWhiteboardShortcuts(isPolish)` zwraca właściwe etykiety.
5. Odnotuj: 149 kluczy `myWork.whiteboard.*` PL/EN powinno być kompletnych (wzorcowy moduł i18n).

### 19.6 Dark mode

**Kroki:**
1. Przełącz na ciemny motyw (toggle w UI / `useIsDark`).
2. Sprawdź czytelność: toolbar (`bg-navy-900/80`), węzły StickyNote (kolorowe tła), modal eksportu, `WhiteboardSessionPanel`.
3. Sprawdź, że obramowania i separatory są widoczne (`border-navy-700/60`).
4. Zero klas tekstowych white-on-white lub dark-on-dark.

### 19.7 A11y (dostępność)

**Kroki:**
1. `role="toolbar"` na `WhiteboardToolbar` z `aria-label`.
2. Przyciski toolbar mają `aria-label` (przez `ariaLabel` prop w `ToolbarBtn`).
3. `aria-pressed` na toggle'ach (Pen, Voting, Follow).
4. Save button: `aria-busy={saving}`.
5. Sprawdź fokus klawiaturą: Tab przez toolbar przyciski, Enter/Space aktywuje.
6. Modal shortcuts help: focus trap, `Esc` zamyka.
7. Sprawdź kontrast kolorów (szczególnie szary tekst na jasnym/ciemnym tle).

### 19.8 Zero błędów w konsoli

**Kroki:**
1. Przez całą sesję testową (§1–§18) sprawdzaj DevTools Console.
2. Zero czerwonych błędów `ERROR`.
3. Zero niezłapanych `unhandledrejection` (szczególnie przy autosave).
4. Ostrzeżenia ReactFlow (np. o zduplikowanych `nodeId`) = FAIL.

### 19.9 Degradacja offline i błędy sieci

**Kroki:**
1. Symuluj 502 na `PUT /map` → sprawdź, że toast błędu pojawia się, tablica NIE znika.
2. Symuluj timeout → draft w localStorage jako fallback.
3. Symuluj 500 na `POST /ai-generate` → toast błędu, UI pozostaje stabilne, bez białego ekranu.
4. Brak połączenia przy wejściu → `syncState: 'offline'`, etykieta „Tryb offline, zmiany lokalne" (wg spec B stany ekranu).

---

## §20 · Testy regresji i istniejące testy automatyczne

### 20.1 Uruchomienie istniejących testów

**Polecenia:**
```bash
# Testy specyfikacji kanonicznej whiteboardu (57 — stałe, nie runtime)
npx vitest run server/src/routes/v8/__tests__/p13-whiteboard-canon.test.ts

# Testy kontraktów facilitation (8 — zod walidacja, serwis zmockowany)
npx vitest run tests/unit/backend/realtime-platform.facilitation.contracts.test.ts

# Testy syncu mapy (8 — hook persystencji)
npx vitest run tests/unit/mywork/ideaMapSyncPersistence.smoke.test.ts

# Testy integracji whiteboard (operacje na węzłach, fazy facilitation)
npx vitest run tests/unit/mywork/whiteboardIntegration.test.ts

# Testy węzłów (duplikowanie, locked nodes)
npx vitest run tests/unit/mywork/whiteboardNodes.test.ts

# Testy gramatyki interakcji (skróty, tryby)
npx vitest run tests/unit/mywork/whiteboardInteractionGrammar.test.ts

# Testy formaterów AI (generatory whiteboard)
npx vitest run tests/unit/backend/services/ideaAIGeneratorService.whiteboardFormatters.test.ts
```

**Oczekiwane:** wszystkie PASS (73 testów wg karty audytu). FAIL któregokolwiek = blokada.

### 20.2 Znane luki testowe (KNOWN GAPS — nie blokują testu manualnego)

- Brak testów komponentów (węzły, undo, grupowanie, hydracja extensions) — ryzyko regresji.
- Brak testów WS gateway (resource-auth, 403 dla obcej org) na realnej bazie.
- Brak testów integracyjnych facilitation na realnej DB (serwis zmockowany).
- Brak E2E (Playwright/Cypress) dla whiteboard.

---

## §21 · Format raportu + Definition of Done

### Format raportu (dla każdego punktu testu)

```
**Punkt:** §N.M — [Nazwa]
**Kroki wykonane:** [lista kroków]
**Oczekiwane:** [opis]
**Faktyczne:** [opis]
**Status:** PASS / FAIL / KNOWN BUG / FASADA / SKIP
**Dowód:** [screenshot URL + Network payload (zrzut) + ewentualnie SELECT z DB]
**Przy FAIL:** plik:linia · przyczyna · propozycja fixu
```

### Luki dokumentacyjne (odnotuj w raporcie)

W każdym punkcie gdzie stwierdzasz **FASADA** lub **KNOWN BUG**: podaj ID luki (L-01…L-06), powtórz plik:linia, opis.

### Definition of Done M09 (testy manualne zaliczone)

- [ ] §1 Shared board: L-01 udokumentowana z dowodem Network 404 (memberB) lub 200 (po DP-3)
- [ ] §2 Wszystkie 11 typów węzłów PASS lub KNOWN BUG (L-05 kształty)
- [ ] §3 Tryb rysowania: pen/highlighter/gumka PASS [MANUAL]
- [ ] §4 Undo/redo: wielopoziomowe (25), Redo-po-nowej-akcji PASS
- [ ] §5 Selekcja: lasso, Ctrl+click, Ctrl+A, group/ungroup, align/distribute PASS
- [ ] §6 Edycja treści: dblclick, zmiana koloru PASS; resize KNOWN BUG L-05
- [ ] §7 Zoom/pan: kółko myszy, trackpad, fit-to-screen PASS [MANUAL]
- [ ] §8 Copy/paste: obraz, tekst, URL, drag-drop PASS [MANUAL]
- [ ] §9 Persystencja: autosave, ręczny save, localStorage draft, 409 PASS/KNOWN BUG
- [ ] §10 AI-assist: min. 3 generatory, propose→accept/reject, slash-menu PASS
- [ ] §11 Sceny: tworzenie, przejście, prezentacja PASS
- [ ] §12 Quick-starty: brainstorm PASS; affinity/workshop zweryfikowane
- [ ] §13 Eksport: PNG, Markdown, JSON PASS; governance FASADA odnotowana
- [ ] §14 Facilitation: create, vote, timer, phase PASS; L-03/L-04 FASADY odnotowane [DB]
- [ ] §15 Presence: join, heartbeat, disconnect PASS; L-01 blokuje multiplayer [odnotuj]
- [ ] §16 Tło: 4 wzory PASS
- [ ] §17 Skróty: wszystkie z tabeli §17.1 PASS
- [ ] §18 Cross-module: Whiteboard→Inicjatywy PASS lub SKIP z uzasadnieniem
- [ ] §19 Przekrojowe: i18n PL+EN, dark mode, A11y, zero błędów konsoli PASS
- [ ] §20 Testy auto: 73 PASS (nie więcej niż 0 FAIL)
- [ ] Raport końcowy z listą: `N_PASS / N_FAIL / N_KNOWN_BUG / N_FASADA / N_SKIP`

**Blokery wejścia do prod:** każdy nieudokumentowany FAIL (tj. nie sklasyfikowany jako KNOWN BUG lub FASADA z ID luki) = blokada releasu.
