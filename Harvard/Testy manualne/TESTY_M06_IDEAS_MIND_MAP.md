# TESTY — M06 Ideas · Mind Map

> **Moduł:** M06 Ideas Mind Map (`/my-work/ideas/workspace/mindmap`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Inwentarz:** `Harvard/podzial/ideas/MODULE_02B_mind-map.md` + `Harvard/podzial/ideas/_INDEX_IDEAS_SPLIT.md`
> **Teczka:** `Harvard/wdrozenie-100/M06-ideas-mind-map.md`
> **Zakres tej paczki:** pełen editor Mind Map — persystencja wersjonowana, edycja węzłów i krawędzi, gramatyka klawiaturowa, AI-assist (expand / suggestions / gap-analysis), AI overlays (sentiment, clustering, dependency — oznaczone jako pseudo-AI), import/eksport, collab WS, snapshoty, komentarze do węzłów, konwersja węzłów → Inicjatywy/Decyzje, sidebar Teresa, typy widoków, optymalizacja dużych map.
> **Cel:** dogłębna weryfikacja E2E — każda akcja potwierdzona w Network (UI-zmiana bez żądania = FAIL), payload zawiera `baseVersion`, brak silent-overwrite, stan przeżywa reload.
> **Beta-gating:** `MYWORK_IDEAS: 'closed'` — Ideas jest zamknięte dla WSZYSTKICH ról (łącznie z adminami, `BETA_ADMINS_EXEMPT = false`). Testy prowadzone po tymczasowym ominięciu gate'a na dev albo na org z aktywowanym dostępem. Potwierdź stan gate'a przed testem.
> **Data:** 2026-06-16

---

## 0. Kontekst architektoniczny

### 0.1 Mapa komponent ↔ plik ↔ stan

| Obszar | Komponent / plik | Stan / store |
|---|---|---|
| **Główny kanvas** | `IdeaRecommendationMap.tsx` (6349 linii) | ReactFlow state (`nodes`, `edges`, `viewport`) — canonical owner |
| **Deprecated shim** | `src/components/MyWork/IdeasMindMap.tsx` (33 l.) | tylko redirect → `/my-work/ideas`; nie renderuje mapy |
| **Workspace host** | `IdeaMapWorkspace.tsx` | `workspaceGraphRuntime`, lazy IdeaRecommendationMap |
| **Hub / routing** | `MyWorkHub.tsx` — lazy `IdeaMapWorkspace` | `parseMyWorkPathIntent`, `sessionStorage`, beta-gate |
| **Persystencja** | `mindmap/useMindMapPersistence.ts` | `PersistenceStatus`, `localVersionRef`, `undoStackRef` / `redoStackRef` |
| **Sync** | `canvas/useIdeaMapSync.ts` | queue, `baseVersion`, draft-localStorage, konflikt 409 |
| **Graf runtime** | `canvas/workspaceGraphRuntime.ts` | `captureToolGraph`, `flushGraph`, `version` |
| **Węzły** | `mindmap/useMindMapNodes.tsx` | `addChildNode`, `addSiblingNode`, `drag-reparent` |
| **Klawiatura** | `canvas/useIdeasToolKeyboard.ts` + inline w IRM | Space=pan, Alt+arrows, fold levels |
| **Layouty** | `mindmap/useAutoLayout.ts` + `RadialTreeLayout.tsx` + `ForceDirectedLayout.tsx` + `StructureLayouts.ts` | `layoutMode: 'tree' \| 'radial' \| 'force'` |
| **Collab WS** | `mindmap/CollaborationOverlay.tsx` → WS `/ws/collab/:ideaId` | `ideaCollabWs.gateway.ts` (442 l.) |
| **Drawer węzła (canonical)** | `mindmap/NodeDetailDrawer.tsx` (1042 l.) | `drawerNodeId`, `nodeMetaMap` |
| **Drawer węzła (workspace)** | `IdeaNodeDetailDrawer.tsx` (1374 l.) | montowany przez `IdeaMapWorkspace` |
| **Ghost Cards AI** | `IdeaGhostCards.tsx` | realne AI (oddzielny endpoint) |
| **Eksport** | `mindmap/useMapExport.ts` + `useMapExportPdf.ts` | plik Blob / print |
| **Import** | `mindmap/ImportExternalMap.tsx` | parsery FreeMind .mm / XMind ZIP / OPML |
| **Konwersja** | `mindmap/BatchConvertModal.tsx` | `convert_initiative` / `convert_decision` |
| **Komentarze** | `mindmap/NodeCommentThread.tsx` | `nodeComments[nodeId]` → `idea_node_comments` |
| **Snapshoty** | `mindmap/SnapshotHistory.tsx` | `my_idea_map_snapshots` |
| **Activity** | `mindmap/ActivityFeed.tsx` | `my_idea_activity` |
| **Paleta poleceń** | `mindmap/MindmapCommandPalette.tsx` | `commandPaletteOpen` |
| **Voice to Node** | `mindmap/VoiceToNode.tsx` | Web Speech API |
| **Duże mapy** | `mindmap/LargeMapOptimizer.tsx` | progi 150/300/500 węzłów + `simplifiedMode` |
| **Prezentacja** | `mindmap/PresentationMode.tsx` | `showPresentation` |
| **Timeline** | `mindmap/TimelineView.tsx` | `showTimeline` |
| **Heatmapa** | `mindmap/TimeHeatmap.tsx` | `showTimeHeatmap` |
| **Widok 3D** | `mindmap/MindMap3DView.tsx` | `showMindMap3D` — CSS perspective, pseudo-3D |

### 0.2 Kluczowe endpointy (wszystkie w `server/src/routes/my-work.routes.ts`)

| Endpoint | Metoda | Linia | Status |
|---|---|---|---|
| `/my-ideas/:id/map` | GET | :3482 | REALNE |
| `/my-ideas/:id/map` | PUT (legacy) | :3729 | REALNE |
| `/my-ideas/:id/map/sync` | POST | :3994 | REALNE — `baseVersion`, 409, empty-reset guard |
| `/my-ideas/:id/map/expand` | POST | :4194 | REALNE LLM |
| `/my-ideas/:id/map/ai-suggestions` | POST | :4409 | REALNE LLM (generyczny prompt) |
| `/my-ideas/:id/map/gap-analysis` | POST | :4505 | REALNE LLM |
| `/my-ideas/:id/map/snapshots` | GET/POST/DELETE | :4629-4761 | REALNE → `my_idea_map_snapshots` |
| `/my-ideas/:id/map/nodes/:nodeId/comments` | GET/POST/DELETE | :4776-4899 | REALNE → `idea_node_comments` |
| `/my-ideas/:id/activity` | GET | :4917+ | REALNE → `my_idea_activity` |
| `/ws/collab/:ideaId` | WS upgrade | `ideaCollabWs.gateway.ts` | REALNE — auth + org-scope |
| `/my-ideas/metrics/map` | GET | :3651 | REALNE |

### 0.3 Zasada E2E (obowiązkowa, każdy test)

Każda akcja modyfikująca stan węzłów, krawędzi lub metadanych **MUSI** zostać potwierdzona:
1. **Network:** żądanie `POST /my-ideas/:id/map/sync` z `baseVersion` w body.
2. **Payload:** payload zawiera pole `graph` z węzłami i krawędziami.
3. **Reload:** odświeżenie strony → stan identyczny ze stanem po akcji.
4. **Bez 409 przy normalnym użyciu:** toast konfliktu to FAIL jeśli nie było równoległego zapisu.

AI-endpointy (`expand`, `ai-suggestions`, `gap-analysis`) weryfikujemy osobno: żądanie lecące + realność odpowiedzi (nie ma stałego JSON).

### 0.4 Znane ograniczenia i flagi

- **Beta zamknięta** — `MYWORK_IDEAS: 'closed'` (frontendowy gate; API dostępne mimo bety). `[FLAG]`
- **AISentimentOverlay / AIAutoClustering** — pseudo-AI (klienckie heurystyki). Oznaczone w testach `[PSEUDO-AI]` — weryfikujemy czy UI tego nie ukrywa.
- **ExportPowerPoint** — pobiera plik HTML (`.html`), NIE `.pptx`. `[KNOWN-MOCK]`
- **WebhookSettings** — localStorage per przeglądarka, nie server-side. `[KNOWN-MOCK]`
- **Sidekick Teresa** — event `idea-mindmap-sidekick-context` wysyłany, ale `useOpenChatWithContext.ts` go nie konsumuje. Integracja jest jednostronna. `[KNOWN-GAP]`
- **Dwa drawery węzła** — `NodeDetailDrawer.tsx` (canonical, montowany przez IRM) + `IdeaNodeDetailDrawer.tsx` (montowany przez IdeaMapWorkspace) — ~2400 l. duplikacji.
- **Placeholder `?` w WS gateway** — `ideaCollabWs.gateway.ts:237` — potwierdzić że PG-adapter tłumaczy na runtime. `[DB]`

---

## Setup środowiska testowego

1. **Dev server:** `npm run dev` (port `:3000` + `:3001`). Upewnij się że `src/components/MyWork/IdeasMindMap.tsx` kieruje do poprawnej ścieżki Ideas.
2. **Konto OWNER:** DBR77 (pełne uprawnienia). Drugie konto do testów collab (`user-B`) — inna org dla testów cross-org, ta sama org dla testów cooperacji.
3. **Beta gate:** zweryfikuj czy Ideas jest dostępne — jeśli `isBetaLockedForRole` = true, zakładka jest zablokowana. Odblokuj na czas testów (dev flag lub SQL).
4. **Dane testowe:** co najmniej jedna idea z nazwą np. „TEST_MINDMAP_2026"; pusta mapa (tylko root) + mapa z 5-10 węzłami dla testów edycji.
5. **DevTools:** Network (filtr `my-ideas` + `map` + `sync`), Console (zero błędów = wymóg).
6. **Drugie okno przeglądarki:** do testów collab (ten sam ideaId, inny user tej samej org).
7. **Narzędzie inspektora DB:** dostęp do `my_idea_maps`, `my_idea_map_snapshots`, `idea_node_comments` na staging (nie prod).

---

## §1. Routing, gating i ładowanie modułu

### 1.1 Beta gate [FLAG]
- Wejdź na `/my-work/ideas` jako zwykły user (nie admin) → zakładka „Pomysły" ma być zablokowana (badge `Beta`, klik → komunikat `closed`).
- Potwierdź, że `/api/my-work/my-ideas` JEST dostępne mimo bety (gate tylko frontendowy).
- Po odlokowaniu gate: zakładka „Pomysły" staje się klikalna, routing działa.

### 1.2 Routing do workspace
- `/my-work/ideas` → lista idei (M05, poza zakresem M06) z przyciskiem „Otwórz mapę" lub klik wiersza.
- Klik „Open Mind Map" dla idei X → URL zmienia się na `/my-work/ideas/workspace/mindmap` (lub `?ideaId=X`).
- `IdeaMapWorkspace` ładuje się (lazy + Suspense); spinner widoczny podczas ładowania; brak crash.
- **Deprecated shim** `IdeasMindMap.tsx`: wejście bezpośrednio na starym URL (jeśli istnieje) → redirect do `/my-work/ideas`, NIE renderuje mapy.

### 1.3 Stan ładowania mapy
- `GET /my-ideas/:id/map` → 200; mapa hydruje się ze stanu serwera.
- Pusta mapa (nowa idea) → **starter graph** z węzłem `root` + gałęzie domyślne (`Problem`, `Rozwiązanie`, itd.) — potwierdź w Network i UI.
- Jeśli mapa ma istniejące węzły → wyświetlają się; viewport przywracany z `extensions.mindmap.viewState.viewport`.
- **Edge:** brak mapy / 404 → łagodny błąd z komunikatem, brak white-screen.

---

## §2. Tworzenie węzłów (F-epik: edycja i interakcja)

### 2.1 Nowy węzeł dziecko — klawisz `Tab`
- Zaznacz węzeł → `Tab` → nowy węzeł-dziecko pojawia się podłączony do zaznaczonego; kursor w trybie edycji inline (F2).
- Wpisz tekst → Enter → zapis inline.
- **E2E:** w Network pojawia się `POST /map/sync` z `baseVersion` i nowym węzłem w `graph`.
- Reload strony → nowy węzeł jest tam.
- **Edge:** `Tab` na węźle `root` → dziecko korzenia.
- **Edge:** `Tab` bez żadnego zaznaczenia → nic się nie dzieje lub toast informacyjny.

### 2.2 Nowy węzeł rodzeństwo — klawisz `Enter`
- Zaznacz węzeł (nie root) → `Enter` → nowy węzeł-rodzeństwo dodany na tym samym poziomie.
- Wzajemne wykluczanie: `Tab` tworzy dziecko, `Enter` tworzy rodzeństwo — potwierdź różnicę w strukturze grafu.
- **E2E:** jak §2.1.

### 2.3 Dodanie węzła przez floating toolbar
- Klik węzła → pojawia się `FloatingNodeToolbar`; przyciski „Dodaj gałąź (Tab)" i „Dodaj sąsiada (Shift+Enter)".
- Klik „Dodaj gałąź" → efekt identyczny jak `Tab`; klik „Dodaj sąsiada" → efekt jak `Enter`.
- **E2E:** sync przez Network.

### 2.4 Dodanie węzła przez menu kontekstowe (prawoklik / `NodeContextMenu`)
- Prawoklik na węźle → menu kontekstowe; opcje: dodaj dziecko, dodaj rodzeństwo, zmień typ, konwersja, AI-expand, komentarze, usuń.
- Klik każdej opcji → odpowiednia akcja + zamknięcie menu.
- Prawoklik na pustej kanwie (`PaneContextMenu`) → opcje: dodaj węzeł, auto-layout, zoom in/out, fit-to-screen.

### 2.5 Tworzenie węzła przez AI Ghost Cards (`IdeaGhostCards`) [REAL-AI]
- Jeśli Ghost Cards są widoczne (sugestie AI): klik na karcie-sugestii → węzeł zostaje dodany do mapy.
- Sprawdź czy po kliknięciu pojawia się `POST /map/sync` (realne dodanie, nie tylko UI).
- Odróżnij od AI overlays (pseudo-AI — §11).

### 2.6 Import FreeMind / XMind / OPML
- Otwórz `ImportExternalMap` (przycisk importu w toolbarze lub menu More).
- Importuj plik `.mm` (FreeMind) → węzły pojawiają się na kanwie; struktura zgodna z plikiem.
- Importuj `.xmind` (ZIP) → analogicznie.
- Importuj `.opml` → analogicznie.
- **E2E:** po imporcie pojawia się `POST /map/sync` — dane z importu lądują w DB.
- **Edge:** plik uszkodzony → komunikat błędu, brak crash; plik pusty → pusta mapa lub komunikat.

### 2.7 Voice to Node (`VoiceToNode`) [MANUAL]
- Otwórz `VoiceToNode` (przycisk w toolbarze).
- Udziel uprawnienia mikrofonu → nagrywanie aktywne (wskaźnik).
- Powiedz słowo/zdanie → transkrypcja pojawia się w polu; zatwierdź → nowy węzeł z tą treścią.
- `[MANUAL]` — wymaga mikrofonu i obsługi Web Speech API w przeglądarce (Chrome).
- **Edge:** brak uprawnień mikrofonu → graceful error, brak crash; przeglądarka bez Web Speech API → komunikat.

### 2.8 Dodanie węzła przez Paletę Poleceń (`Cmd+K`)
- `Cmd+K` → `MindmapCommandPalette` otwiera się.
- Wpisz „dodaj" lub szukaj akcji → znajdź „Dodaj węzeł"; klik/Enter → efekt.
- `Esc` → zamknięcie palety.

---

## §3. Edycja węzłów

### 3.1 Edycja inline (`F2`)
- Zaznacz węzeł → `F2` → węzeł przechodzi w tryb edycji inline (textarea/input).
- Zmień tekst → `Enter` (bez Shift) → zatwierdź.
- `Shift+Enter` → nowa linia wewnątrz etykiety (jeśli obsługiwane) lub zatwierdź rodzeństwo.
- `Escape` → anuluj (tekst wraca do poprzedniego).
- Klik na węźle poza editingiem → edycja inline lub zaznaczenie (sprawdź zachowanie).
- **E2E:** `POST /map/sync` po zatwierdzeniu; reload → nowy tekst.

### 3.2 Edycja przez drawer szczegółów węzła (`NodeDetailDrawer`)
- Klik węzła → `NodeDetailDrawer` otwiera się po prawej stronie.
- Zmień label, dodaj notatki, zmień kolor, zmień status (`NodeStatus`), zmień typ semantyczny.
- Każda zmiana → `POST /map/sync` (sprawdź debounce — drawer może buforować zmiany przez chwilę).
- Zamknij drawer → zmiany widoczne na kanwie + przeżywają reload.
- **Uwaga architektoniczna:** `IdeaNodeDetailDrawer` (1374 l.) montowany przez `IdeaMapWorkspace` to drugi drawer. Sprawdź, który z nich pojawia się przy kliku — odnotuj który jest aktywny.

### 3.3 Edycja przez `QuickEditPopovers` (floating toolbar)
- Zaznacz węzeł → floating toolbar; klik ikon (FontSize, BranchTheme, Color, SemanticType) → popovery.
- Każda zmiana koloru (ColorPickerPopover) → węzeł zmienia kolor natychmiastowo (optimistic) + `POST /map/sync`.
- **Znany bug:** `ColorPickerPopover` — React duplicate-key warning w konsoli. Odnotuj.
- `BranchThemeDropdown` → zmiana tematu gałęzi; `SemanticTypeDropdown` → zmiana typu semantycznego.

### 3.4 Zmiana koloru węzła — brak artefaktów po korupcji codemodu „rose" [EPIK 3]
- Sprawdź że w ŻADNYM miejscu UI nie pojawia się tekst `'Cost roseuction'` ani `'Recoverose previous debug session'`.
- Sprawdź że identyfikatory undo/redo stack są poprawne (nie `roseoStackRef`).
- `grep -n "roseo\|roseuction\|Recoverose\|focusFiltrose"` na `src/components/MyWork/mindmap/` oraz `IdeaRecommendationMap.tsx` → wynik 0. [EPIK 3 — NAPRAWIONY wg L-03, zweryfikuj na żywo]

### 3.5 Bulk edycja / multi-selekcja
- `Ctrl+A` → zaznacza wszystkie węzły poza `root`.
- `Ctrl+D` → odznacza wszystkie.
- Box-select (LPM drag po kanwie) → zaznacza węzły w prostokącie (partial selection).
- Na zaznaczeniu wielokrotnym: `Delete` → usuwa wszystkie zaznaczone; `Ctrl+C`/`Ctrl+V` → kopiuje/wkleja grupę.
- **Uwaga:** floating toolbar pojawia się per węzeł, brak toolbar dla grupy → odnotuj jako delta do Miro.

---

## §4. Usuwanie węzłów i krawędzi

### 4.1 Usuwanie węzła (`Delete` / `Backspace`)
- Zaznacz węzeł → `Delete` → węzeł usunięty; krawędzie do usuniętego węzła usunięte.
- Węzeł z dziećmi: usunięcie rodzica → zachowanie dzieci (orphaned? cascade?). Sprawdź i odnotuj.
- Próba usunięcia `root` → blokada (root nie może być usunięty) lub toast informacyjny.
- **E2E:** `POST /map/sync`; reload → węzeł zniknął.

### 4.2 Usuwanie przez menu kontekstowe
- Prawoklik → „Usuń" → węzeł usunięty; potwierdzenie (dialog?) lub bezpośrednie usunięcie.
- **E2E:** jak §4.1.

### 4.3 Usuwanie krawędzi (`EdgeContextMenu`)
- Prawoklik na krawędzi → `EdgeContextMenu`; opcja „Usuń" → krawędź usunięta, węzły rozłączone.
- **E2E:** `POST /map/sync` z zaktualizowaną listą krawędzi.

---

## §5. Krawędzie i relacje (`EdgeContextMenu`)

### 5.1 Tryb Connect — rysowanie nowej krawędzi
- Przełącz na tryb `connect` (przycisk w toolbarze lub `getMindmapConnectToolbarAction`).
- Kursor zmienia się na `cursor-crosshair`.
- Przeciągnij od węzła A do węzła B → nowa krawędź; powrót do trybu `select`.
- Próba połączenia węzła ze sobą → brak pętli (blocked).
- **E2E:** `POST /map/sync`.

### 5.2 Edycja krawędzi przez `EdgeContextMenu`
- Prawoklik na krawędzi → menu z opcjami: etykieta, wstaw węzeł na krawędzi, odwróć kierunek, styl linii, zmień relację, usuń.
- **Etykieta:** dodaj etykietę → widoczna na krawędzi; `POST /map/sync`.
- **Wstaw węzeł na krawędzi:** klik → nowy węzeł dodany w środku krawędzi; A→nowy→B.
- **Odwróć kierunek:** strzałka zmienia orientację; `POST /map/sync`.
- **Styl linii:** zmiana (solid/dashed/dotted) → widoczna zmiana na krawędzi.
- **Relacja:** zmiana semantyki relacji (zależność, wpływ, itp.) → `POST /map/sync`.

### 5.3 Krawędzie w layoutach kierunkowych (tree H/V) vs. swobodnych
- W layoutach `tree` krawędzie są hierarchiczne (parent→child). Sprawdź czy krawędź poprzeczna (cross-edge) jest dozwolona czy blokowana.
- W layoutach `free` — dowolne krawędzie.

---

## §6. Drag & drop [MANUAL]

### 6.1 Drag węzła (swobodne przesuwanie) [MANUAL]
- Złap węzeł LPM → przesuń w nowe miejsce → puść.
- Węzeł zostaje w nowej pozycji; nie powraca do auto-layoutu (manual drag **disables** auto-relayout na tę sesję — `IdeaRecommendationMap.tsx` śledzi `manualDragActive`).
- **E2E:** `POST /map/sync` z nową pozycją węzła.

### 6.2 Drag-reparent [MANUAL]
- Złap węzeł i przesuń nad innego rodzica → podświetlenie `_dropTarget` na potencjalnym rodzicu.
- Puść → węzeł zmienia rodzica (nowa krawędź parent→child, stara usunięta).
- **E2E:** `POST /map/sync`; reload → zmieniona hierarchia.
- **Edge:** próba reparent na `root` → powinno działać (root staje się rodzicem).
- **Edge:** próba reparent węzła na jego własne potomstwo → blokada lub niespójność (sprawdź i odnotuj).

### 6.3 Drag kanwy (pan) [MANUAL]
- MPM (środkowy przycisk myszy) + drag → przesuwanie kanwy.
- PPM (prawy przycisk myszy) + drag → przesuwanie kanwy lub menu kontekstowe (zależy od `panOnDrag=[1,2]`).
- `Space` (przytrzymaj) → czasowy tryb pan; zwolnij → powrót do select.
- Touch/trackpad: two-finger pan → kanwa przesuwa się [MANUAL].

---

## §7. Zoom, viewport i fit-to-screen

### 7.1 Zoom klawiaturowy i gestami
- `Ctrl+0` / `Cmd+0` → `fitView` z paddingiem 0.3 i animacją 300ms.
- `Shift+1` (bez Ctrl/Meta) → `fitView` (FigJam-style; nie działa jeśli kursor jest w INPUT/TEXTAREA).
- Scroll myszy → zoom in/out; pinch touchpad [MANUAL].
- `CanvasZoomControls` (guziki +/-/fit): klik + → zoom in; klik − → zoom out; klik Fit → `fitView`.

### 7.2 Persistencja viewportu
- Ustaw viewport (przybliż + przesuń) → `onMoveEnd` → zapisuje do `extensions.mindmap.viewState.viewport`.
- Reload strony → viewport przywrócony z serwera (nie do domyślnego). Sprawdź `extensions.mindmap.viewState.viewport` w payload `GET /my-ideas/:id/map`.

### 7.3 Minimap
- Domyślnie minimap jest **off** (`IdeaRecommendationMap.tsx:1900`).
- Przycisk toggle minimapy w toolbarze → pojawia się/chowa.
- Klik na minimapie → nawigacja do danego obszaru.

---

## §8. Layouty (auto-layout i ręczne)

### 8.1 Layout Tree (domyślny)
- Przycisk „Tree" w toolbarze layout-switch → `setLayoutMode('tree')` → `autoLayout` przeorganizowuje węzły w drzewo poziome.
- `POST /map/sync` po layoutowaniu.

### 8.2 Layout Radial
- Przycisk „Radial" → `setLayoutMode('radial')` → węzły układają się radialnie (root w centrum).
- Sprawdź że krawędzie są poprawne po przejściu.

### 8.3 Layout Force-directed
- Przycisk „Force" → `setLayoutMode('force')` → `ForceDirectedLayout` rozciąga węzły.
- Animacja layoutowania powinna być widoczna (nie skokowa).

### 8.4 Auto-layout z menu kontekstowego kanwy
- Prawoklik na kanwie → `PaneContextMenu` → „Auto-layout" → `pane_auto_layout` event → `autoLayout(nodes, edges)`.
- Porównaj z layoutem Tree — powinny dawać ten sam wynik.

### 8.5 Structure layouts (`StructureLayouts.ts`)
- W palecie poleceń lub toolbarze: opcje strukturalne (fishbone, timeline, matrix). Klik → `applyStructureLayout`.
- Sprawdź że węzły przyjmują oczekowaną strukturę; `POST /map/sync`.

### 8.6 Brak align/distribute i snap-to-grid [DELTA do Miro]
- Zweryfikuj przez inspekcję toolbara że NIE ma przycisków align/distribute.
- Zweryfikuj że canvas nie ma snap-to-grid (`useIdeasToolDefaults.ts` nie ustawia `snapGrid`).
- Odnotuj jako P2-delta (zgodnie z kartą audytu).

---

## §9. Gramatyka klawiaturowa (pełna tabela)

Przed każdym testem: zaznacz odpowiedni węzeł (nie `root` jeśli nie zaznaczono), wyjdź z trybu edycji.

| Klawisz | Efekt | Weryfikacja |
|---|---|---|
| `Tab` | dodaj węzeł-dziecko | §2.1 |
| `Enter` | dodaj węzeł-rodzeństwo | §2.2 |
| `Shift+Enter` | dodaj węzeł-rodzeństwo (alt) | jak §2.2 |
| `F2` | edycja inline | §3.1 |
| `Delete` / `Backspace` | usuń zaznaczone | §4.1 |
| `Space` (na węźle) | zwiń/rozwiń gałąź | §10.1 |
| `ArrowUp` / `ArrowDown` | nawigacja między rodzeństwem | Sprawdź focus na sąsiednim węźle |
| `ArrowLeft` | nawigacja do rodzica | Focus przenosi się na rodzica |
| `ArrowRight` | nawigacja do pierwszego dziecka | Focus przenosi się na dziecko |
| `Alt+ArrowUp` | przesuń węzeł wyżej w rodzeństwie | reparent-sort; `POST /map/sync` |
| `Alt+ArrowDown` | przesuń węzeł niżej w rodzeństwie | j.w. |
| `Alt+ArrowLeft` | przesuń węzeł do rodzica-rodzica | wyjście o poziom wyżej |
| `Alt+ArrowRight` | przesuń węzeł do dziecka poprzedniego rodzeństwa | zagłębienie o poziom |
| `Alt+0` | zwiń wszystko (fold level 0) | toast „Widok: poziom 0"; tylko root widoczny |
| `Alt+1` | fold level 1 | toast „Widok: poziom 1" |
| `Alt+2` | fold level 2 | toast „Widok: poziom 2" |
| `Alt+3` | fold level 3 | toast „Widok: poziom 3" |
| `Alt+9` | rozwiń wszystko | toast „Wszystko rozwinięte" |
| `Cmd+Z` | undo (50 kroków) | §10.3 |
| `Cmd+Shift+Z` | redo | §10.3 |
| `Cmd+S` | wymuszony save (manual flush) | `POST /map/sync` z `reason:'manual'` |
| `Cmd+A` | zaznacz wszystko (poza root) | wszystkie węzły zaznaczone |
| `Cmd+D` | odznacz wszystko | zero zaznaczonych |
| `Cmd+C` | kopiuj zaznaczone | węzły trafiają do clipboard-state |
| `Cmd+V` | wklej | nowe węzły z kopii; `POST /map/sync` |
| `Cmd+X` | wytnij | kopiuj + usuń; `POST /map/sync` |
| `Cmd+K` | otwórz paletę poleceń | `MindmapCommandPalette` otwiera się |
| `Cmd+Shift+H` | toggle SnapshotHistory | §13 |
| `Shift+1` | fit-to-screen (nie w INPUT) | `fitView` |
| `Cmd+0` | fit-to-screen | j.w. |
| `Esc` | zamknij dialog/popover/paletę | test w każdym trybie |

**Testy negatywne:**
- Skróty NIE działają gdy kursor jest w INPUT/TEXTAREA/contentEditable — zweryfikuj że wpisywanie tekstu w edytorze inline nie triggeruje skrótów.
- Skróty działają gdy kursor jest na kanwie (nie w elemencie formularza).

---

## §10. Zwijanie gałęzi, undo/redo, fold levels

### 10.1 Zwijanie i rozwijanie gałęzi
- Klik przycisku `<ChevronDown>` / `<ChevronRight>` na węźle → `mm-toggle-collapse` event → `toggleCollapseNode`.
- Gałąź zwinięta: potomkowie ukryci, węzeł pokazuje `…` i licznik dzieci.
- `Space` na zaznaczonym węźle → toggle collapse.
- Nawigacja do zwiniętego węzła: focus przenosi się na węzeł rodzica (wg kodu — `IdeaRecommendationMap.tsx:2061`).
- **E2E:** stan zwinięcia zapisywany w `extensions.mindmap.collapsedNodeIds` → `POST /map/sync`; reload → stan zwinięcia przywrócony.

### 10.2 Fold levels (`Alt+0–3`, `Alt+9`)
- `Alt+0` → wszystkie gałęzie zwinięte poza root; toast „Widok: poziom 0".
- `Alt+1` → tylko poziom 1 widoczny.
- `Alt+2` → do poziom 2 widoczny.
- `Alt+3` → do poziom 3 widoczny.
- `Alt+9` → wszystko rozwinięte; toast „Wszystko rozwinięte".
- Sprawdź że po `Alt+0` i `Alt+9` wraca się do stanu pełnego.
- **E2E:** `POST /map/sync` z zaktualizowanym `collapsedNodeIds`.

### 10.3 Undo / Redo (50 kroków)
- Wykonaj serię 5 operacji (dodaj węzeł A, B, zmień kolor C, usuń D, edytuj E).
- `Cmd+Z` pięć razy → cofanie w kolejności odwrotnej; każde cofnięcie przywraca poprzedni stan.
- `Cmd+Shift+Z` → redo → odtwarzanie.
- Po nowej akcji po undo → redo stack kasowany (redo staje się niemożliwe).
- **Limit 50 kroków:** wykonaj 51 operacji; sprawdź że krok 1 (najstarszy) jest utracony, a step 51 jest w historii.
- Stan `canUndo` / `canRedo` odnotuj w toolbarze (czy przyciski undo/redo są disabled poprawnie).
- **Uwaga:** undo/redo to **lokalny** stan (w pamięci). Reload kasuje historię undo. `POST /map/sync` nie cofnie redo.
- Stan zwinięcia (`collapsedNodeIds`) jest uwzględniany w undo/redo (`MapSnapshot` zawiera `collapsedNodeIds`).

---

## §11. AI-assist — realne endpointy

### 11.1 AI Expand (`POST /map/expand`) [REAL-AI]
- Zaznacz węzeł → klik „AI Expand" w floating toolbar lub `FloatingAIPopover` lub prawoklik → „ctx_ai_expand".
- Loader widoczny podczas żądania.
- `POST /my-ideas/:id/map/expand` z payload zawierającym kontekst węzła.
- Odpowiedź: nowe węzły-propozycje dodane do kanwy (lub modal z propozycjami do zaakceptowania).
- Zaakceptuj propozycję → `POST /map/sync` z nowymi węzłami.
- **Edge:** brak odpowiedzi LLM (timeout) → toast błędu, brak crash.
- **E2E:** confirm ze żądanie trafia do LLM (`llmService`), NIE do lokalnej heurystyki.

### 11.2 AI Suggestions (`POST /map/ai-suggestions`) [REAL-AI]
- Przycisk „AI Suggestions" w toolbarze AI panelu (prawy panel lub `AIActionsPopover`).
- `POST /my-ideas/:id/map/ai-suggestions` → odpowiedź zawiera `topics` / `findings` / `next_steps`.
- Sugestie wyświetlają się jako lista propozycji; klik jednej → `POST /map/sync`.
- **Uwaga:** to jest generyczny prompt — każda z rodziny AI paneli (AIDependencyDetector, AIPriorityRecommender, AICompetitiveLandscape, AIWhatIfScenarios, BranchSummaryPanel, DocumentToMap, InterviewToMap) używa **tego samego** endpointu i dorabia semantykę po stronie klienta. Odnotuj że wyniki mogą być losowe semantycznie.

### 11.3 Gap Analysis (`POST /map/gap-analysis`) [REAL-AI]
- Przycisk „Gap Analysis" → `POST /my-ideas/:id/map/gap-analysis` z kontekstem mapy.
- Wynik: lista luk / obszarów do uzupełnienia wyświetlona w panelu.
- Klik sugestii → opcja dodania jako węzeł.

### 11.4 AI Expand Branch z panelu AI Sidebar
- Użyj `BranchSummaryPanel` → „Podsumuj gałąź" → żądanie AI → wynik text.
- Sprawdź że żądanie leci na backend (nie lokalna logika).

---

## §12. AI Overlays — pseudo-AI [PSEUDO-AI]

Wszystkie poniższe overlaye używają **klienckich heurystyk**, nie realnych wywołań LLM. Wyniki są semantycznie niereliable. Testy weryfikują:
1. Czy UI wchodzi bez crash.
2. Czy nie ma dezorientacji użytkownika (overlay nie udaje realnego AI).
3. Etykieta „heurystyki" lub ukrycie za flagą (wg decyzji D-02 = DP-5).

### 12.1 AISentimentOverlay [PSEUDO-AI]
- Włącz overlay → węzły dostają nakładki z „sentymentem" (positive/negative/neutral).
- Sprawdź w kodzie `AISentimentOverlay.tsx:56-81` że sentyment jest przypisywany pozycyjnie po `confidence` indeksie — wynik semantycznie losowy.
- Czy overlay jest oznaczony jako „heurystyka" w UI? Czy jest za flagą? Odnotuj.

### 12.2 AIAutoClustering [PSEUDO-AI]
- Włącz → węzły grupowane w klastry na podstawie 10-znakowych substringów + `slice(idx*2, idx*2+2)`.
- Sprawdź `AIAutoClustering.tsx:73-92`.
- Jak §12.1 — czy oznaczony jako heurystyka?

### 12.3 AIDependencyDetector, AIPriorityRecommender, AICompetitiveLandscape, AIWhatIfScenarios
- Każdy używa generycznego prompta `getMyIdeaAISuggestions` + klienckie mapowanie wyników.
- Otwórz każdy panel → sprawdź że nie crashuje; sprawdź że w Network leci żądanie do `/map/ai-suggestions` (NIE dedykowanego endpointu).
- Odnotuj że wyniki mogą być nieadekwatne semantycznie.

### 12.4 AIBlindSpotsDetector, AIBranchBalancer, AIGovernancePanel
- Analogicznie: test na brak crash + sprawdzenie żądania Network.

### 12.5 IdeaFunnelAnalytics
- Otwórz → wyświetla statystyki węzłów (ile na każdym poziomie lejka).
- Sprawdź czy dane są dynamiczne (z mapy) czy hardcoded.

---

## §13. Snapshoty historii (`SnapshotHistory`)

### 13.1 Tworzenie snapshotu (`POST /map/snapshots`) [DB]
- Przycisk „Utwórz snapshot" lub `Cmd+Shift+H` → otwiera `SnapshotHistory`.
- Wpisz etykietę → „Zapisz" → `POST /my-ideas/:id/map/snapshots` z `label`, `node_count`, `edge_count`, `data_json`.
- **E2E:** 201 w Network; wiersz w `my_idea_map_snapshots` (sprawdź DB). [DB]
- Migracja `my_idea_map_snapshots` musi być zaaplikowana — jeśli tabela nie istnieje → 503. Odnotuj.

### 13.2 Lista snapshotów (`GET /map/snapshots`)
- Otwórz `SnapshotHistory` → lista snapshotów posortowana wg daty.
- Każdy snapshot: etykieta, data, liczba węzłów/krawędzi.

### 13.3 Przywracanie snapshotu
- Klik „Przywróć" na snapsocie → mapa powraca do stanu z snapshotu.
- **E2E:** `POST /map/sync` z danymi z snapshotu.

### 13.4 Usunięcie snapshotu (`DELETE /map/snapshots/:snapshotId`)
- Klik „Usuń" → `DELETE /my-ideas/:id/map/snapshots/:snapshotId`; snapshot znika z listy.
- Usunięcie własnego snapshotu OK; próba usunięcia cudzego → 403 lub brak opcji.

---

## §14. Komentarze do węzłów (`NodeCommentThread`) [DB]

### 14.1 Dodanie komentarza (`POST /map/nodes/:nodeId/comments`)
- Prawoklik na węźle → „Komentarze" (akcja `ctx_comments`) → `NodeCommentThread` otwiera się.
- Wpisz tekst → „Wyślij" → `POST /my-ideas/:id/map/nodes/:nodeId/comments` z `text`, `user_name`, `mentions`.
- Komentarz pojawia się w wątku.
- **E2E:** 201 w Network; wiersz w `idea_node_comments`. [DB]
- Migracja `idea_node_comments` musi być zaaplikowana.

### 14.2 Lista komentarzy (`GET /map/nodes/:nodeId/comments`)
- Otwórz komentarze do węzła z istniejącymi komentarzami → lista pobrana z serwera.
- Każdy komentarz: autor, data, treść.

### 14.3 Usunięcie komentarza (`DELETE /map/nodes/:nodeId/comments/:commentId`)
- Klik „Usuń" na własnym komentarzu → `DELETE`; znika z listy. [DB]
- Próba usunięcia komentarza innego użytkownika → 403 lub brak opcji (org-scope).

---

## §15. Persystencja i konflikt wersji

### 15.1 Happy path — normalny zapis
- Dodaj węzeł → po debounce `POST /map/sync` z `baseVersion` = aktualny `localVersionRef`.
- Odpowiedź 200 z nowym `version` → `localVersionRef` zaktualizowany.
- Reload → stan identyczny.

### 15.2 Conflict 409 — rehydracja
- W dwóch oknach otwórz tę samą mapę (ten sam user lub różni użytkownicy tej samej org).
- W oknie A: dodaj węzeł → `POST /map/sync` → 200 (wersja n→n+1).
- W oknie B: dodaj inny węzeł z **stałą** `baseVersion=n` (nieaktualna) → `POST /map/sync` → 409.
- Okno B: toast konfliktu + `externalRuntime.refresh()` → mapa w oknie B rehydruje się z serwera.
- Sprawdź że po rehydracji `baseVersion` w oknie B = n+1; następny zapis przez B z `baseVersion=n+1` → 200.
- **Krytyczne:** `[FLAG]` Wg `_INDEX_IDEAS_SPLIT.md §2`: w innych narzędziach (Process Flow, Table, Whiteboard) 409 prowadzi do silent overwrite. Mindmap jako jedyne ma działający refresh. Potwierdź brak silent overwrite.

### 15.3 Offline / draft
- Odetnij sieć (`DevTools → Network → Offline`) → `PersistenceStatus` zmienia się na `'offline'`.
- Dodaj węzły → zmiany trafią do lokalnego draft w `localStorage` (klucz z `pending`).
- Przywróć sieć → draft flush: `POST /map/sync` wysyłany automatycznie (visibilitychange / online event).
- Sprawdź że draft przeżywa reload strony (localStorage) i wysyłany jest przy powrocie online.

### 15.4 Stany persystencji
| Status | Co sprawdzić |
|---|---|
| `'online'` | normalne zapisywanie; `POST /map/sync` → 200 |
| `'no_route'` | server zwraca 404/501; toast z informacją; edycja NOT saved |
| `'missing_table'` | server zwraca 503; toast; edycja NOT saved |
| `'offline'` | brak sieci; draft w localStorage |

Dla każdego stanu: sprawdź czy UI komunikuje użytkownikowi stan (toast / badge).

### 15.5 Flush przy Cmd+S
- `Cmd+S` → natychmiastowy `flushGraph({ reason: 'manual' })` → `POST /map/sync`.
- Spinner lub toast „Zapisano".

### 15.6 Flush przy zamknięciu karty (beforeunload)
- Dodaj węzeł → natychmiast zamknij kartę (bez czekania na auto-sync).
- Otwórz ponownie → **czy węzeł jest?**
- Wg kodu: `useIdeaMapSync.ts:350-354` używa `fetch` bez `keepalive`/`sendBeacon` → **ryzyko utraty danych przy szybkim zamknięciu**. [L-05 — KNOWN ISSUE] Odnotuj w raporcie.

---

## §16. Kolaboracja real-time (WS `/ws/collab/:ideaId`) [EPIK 1]

### 16.1 Join room (ten sam org) [MANUAL]
- User A (org X) i User B (org X) otwierają tę samą mapę.
- WS upgrade `/ws/collab/:ideaId` dla obu → oba łączą się do rooma.
- Awatary użytkowników widoczne w `CollaborationOverlay` (presence strip).

### 16.2 Live cursory [MANUAL]
- User A porusza myszą → kursor User A widoczny u User B na kanwie.
- User B porusza myszą → kursor User B widoczny u User A.

### 16.3 Graph patch — synchronizacja edycji [MANUAL]
- User A dodaje węzeł → `collabSendRef.current({ type: 'graph_patch', operations })` → przez WS gateway broadcast do rooma.
- User B widzi nowy węzeł **bez reload**.
- Event `idea-collab-graph-patch` odbierany przez `IdeaRecommendationMap.tsx:2810` → aktualizacja stanu.

### 16.4 Node lock (concurrent edit) [MANUAL]
- User A otwiera drawer węzła X (edit mode) → węzeł X blokowany (`remoteLockedNodeIds`).
- User B próbuje edytować węzeł X → komunikat „This node is currently locked by another collaborator".
- User A zamyka drawer → lock zwolniony; User B może edytować.

### 16.5 Cross-org reject — BEZPIECZEŃSTWO [EPIK 1] [DB]
- User B (org Y) próbuje otworzyć mapę należącą do org X.
- `ideaCollabWs.gateway.ts:237-238` DB-check: `SELECT id FROM my_ideas WHERE id=? AND organization_id=?`.
- Wynik: 403 + `socket.destroy()` **przed** `room.set` (`:240-242`).
- **Ryzyko:** placeholder `?` w zapytaniu — zweryfikuj że PG-adapter tłumaczy na `$1` w runtime. [DB]
- Potwierdź że user B NIE dołączył do rooma, NIE widzi danych org X.
- **E2E:** w logach serwera widoczny log 403 cross-org.

### 16.6 Reconnect i heartbeat
- Symuluj krótką utratę połączenia WS (DevTools → Network → blokada WS na 3s).
- Klient powinien automatycznie się zreconnectować.
- Presence po reconnect — czy awatary wracają?

### 16.7 Conflict 409 a collab [FLAG]
- W collab wieloosobowym: User A i User B zapisują jednocześnie.
- Jeden z nich dostaje 409 → rehydracja. Sprawdź że merge jest poprawny.
- Odnotuj: wg `_INDEX_IDEAS_SPLIT.md §2` każde narzędzie ma własną instancję `useIdeaMapSync` z własnym licznikiem wersji; tylko mindmap ma współdzielony runtime. Zmierz ryzyko race condition.

---

## §17. Import / eksport

### 17.1 Eksport Markdown (`useMapExport.ts`)
- Przycisk eksport → wybierz „Markdown" → plik `.md` pobierany.
- Zawartość: hierarchia węzłów jako lista zagnieżdżona `#`/`-`.
- Sprawdź że wszystkie węzły z mapy są w pliku.

### 17.2 Eksport JSON
- Jak §17.1 dla JSON → plik `.json` z pełnym grafem (węzły + krawędzie + metadane).
- Zaimportuj ponownie (o ile import JSON jest wspierany) i sprawdź zgodność.

### 17.3 Eksport CSV
- Plik `.csv` z kolumnami (id, label, parent, itp.).
- Otwórz w Excelu/Numbers → sprawdź poprawność struktury.

### 17.4 Eksport SVG
- Plik `.svg` — poprawny SVG renderujący się w przeglądarce.
- Wszystkie węzły i krawędzie widoczne w pliku SVG.

### 17.5 Eksport PNG
- Plik `.png` — raster screenshot kanwy.
- Sprawdź rozdzielczość (nie tiny).

### 17.6 Eksport Mermaid / PlantUML (`ExportDiagramCode.tsx`)
- „Mermaid" → kod diagramu Mermaid (składnia `graph TD / flowchart`).
- Wklej kod na [mermaid.live](https://mermaid.live) → diagram renderuje się poprawnie.
- „PlantUML" analogicznie.

### 17.7 Eksport „PowerPoint" [KNOWN-MOCK]
- Klik „Export PowerPoint" → plik `*-presentation.html` (NIE .pptx — known mock: `ExportPowerPoint.tsx:91-95`).
- Sprawdź etykietę przycisku: czy mówi „HTML" czy nadal „PowerPoint"? Jeśli nadal „PowerPoint" → FAIL (misleading label).
- Toast sukcesu widoczny po pobraniu.

### 17.8 Eksport PDF (`useMapExportPdf.ts`)
- Eksport PDF = PNG → drukowanie (`useMapExportPdf.ts:14-25`).
- Sprawdź że otwiera okno drukowania z widokiem mapy jako obraz.

### 17.9 Embed in Reports (`EmbedInReports.tsx`) [KNOWN-MOCK]
- Klik „Embed in Reports" → kopiuje snippet HTML do schowka.
- Sprawdź że snippet jest sensowny (nie pusty string).
- **Znane ograniczenie:** brak pipeline'u osadzania — snippet jest statycznym HTML. Odnotuj.

### 17.10 Webhook Settings (`WebhookSettings.tsx`) [KNOWN-MOCK]
- Otwórz ustawienia webhooka → URL webhooka zapisany w `localStorage` (nie na serwerze).
- Sprawdź że po reload lokalna konfiguracja przeżywa (localStorage OK).
- Sprawdź że NIE pojawia się żadne żądanie do serwera przy konfiguracji.
- Odnotuj jako known-mock.

---

## §18. Import zewnętrznych map

### 18.1 FreeMind (.mm)
- `ImportExternalMap` → wybierz plik FreeMind → import → węzły z pliku pojawiają się na mapie.
- Sprawdź hierarchię i etykiety.
- **E2E:** `POST /map/sync`.

### 18.2 XMind (ZIP)
- Analogicznie z plikiem `.xmind`.

### 18.3 OPML
- Analogicznie z plikiem `.opml`.

### 18.4 Document to Map (`DocumentToMap`) [REAL-AI]
- Otwórz `DocumentToMap` → wgraj/wklej tekst dokumentu → AI ekstrahuje strukturę.
- Sprawdź że żądanie leci na `/map/ai-suggestions` lub dedykowany endpoint (odnotuj który).
- Wynik: węzły na mapie odpowiadające strukturze dokumentu.

### 18.5 Interview to Map (`InterviewToMap`) [REAL-AI]
- Otwórz `InterviewToMap` → wybierz wywiad (M10) lub wklej transkrypt.
- AI ekstrahuje tematy → węzły na mapie.
- **E2E:** żądanie + nowe węzły + `POST /map/sync`.

---

## §19. Konwersja węzłów → Inicjatywy / Decyzje (cross-module)

### 19.1 Konwersja pojedynczego węzła → Inicjatywa (przez NodeContextMenu)
- Prawoklik na węźle → „Konwertuj na Inicjatywę" (`ctx_convert_initiative`).
- `convertBranch('initiative', ctxNode.id)` → wywoływana.
- Sprawdź co dokładnie robi `convertBranch`: czy leci żądanie do API inicjatyw? Potwierdź w Network.
- Nawigacja do inicjatywy po konwersji lub komunikat sukcesu.

### 19.2 Konwersja gałęzi → Inicjatywa (subtree)
- Prawoklik → „Konwertuj gałąź" (`ctx_subtree_convert_initiative`) → cała gałąź konwertowana.
- Sprawdź że węzły-dzieci są powiązane z inicjatywą (jako podzadania/sekcje).

### 19.3 Batch Convert (`BatchConvertModal`)
- Zaznacz wiele węzłów → toolbar → „Batch Convert".
- `BatchConvertModal` otwiera się z listą eligble nodes (bez statusu `converted`, bez węzłów `branch-*` i `root`).
- Toggle All → zaznacza / odznacza wszystkie.
- Wybierz kilka → target: `initiative` lub `decision`.
- Klik „Konwertuj" → `onConvert(nodeIds, target)`.
- Sprawdź Network — żądania do API inicjatyw/decyzji.
- Toast sukcesu; status węzłów zmienia się na `converted`.
- **Edge:** locked mapa → przycisk disabled.

### 19.4 Konwersja → Prezentacja
- Akcja `convert_presentation` (`IdeaRecommendationMap.tsx:4378`) → otwiera flow prezentacji (M17/M19).
- Sprawdź że nawigacja odbywa się do właściwego modułu.

---

## §20. Tryby widoku (Presentation, Timeline, 3D, Heatmap)

### 20.1 Tryb prezentacji (`PresentationMode`)
- Przycisk prezentacji → pełnoekranowy slideshow z węzłami mapy.
- Nawigacja: strzałki → przejście do kolejnych węzłów.
- `Esc` → wyjście z prezentacji.
- Sprawdź że nie ma crash dla map z >20 węzłami.

### 20.2 Timeline View (`TimelineView`)
- Przycisk timeline → widok osi czasu z węzłami.
- Węzły z datami → wyświetlane w odpowiednim miejscu osi.
- Sprawdź że widok zamknąć (`Esc` lub X).

### 20.3 3D View (`MindMap3DView`) [KNOWN-MOCK]
- Przycisk 3D → `MindMap3DView` otwiera się — CSS perspective (pseudo-3D, nie WebGL).
- Sprawdź że renderuje się bez błędów.
- Odnotuj: „pseudo-3D na CSS perspective" — nie mylić z WebGL.
- Zamknij → powrót do normalnego widoku.

### 20.4 Time Heatmap (`TimeHeatmap`)
- Przycisk heatmapy → `TimeHeatmap` overlay.
- Węzły oznaczone kolorem wg aktywności.
- Zamknij.

### 20.5 Health Score (`MapHealthScore`)
- Przycisk health score → `showHealthScore` toggle → `<MapHealthScore nodes={nodes} edges={edges} visible={...}>`.
- Wynik: score 0-100 na podstawie struktury mapy.
- Sprawdź dla pustej mapy vs. mapy z 10 węzłami.

---

## §21. Optymalizacja dużych map (`LargeMapOptimizer`)

### 21.1 Simplified mode (automatyczny)
- Progi aktywacji: 150 węzłów (etap 1), 300 węzłów (etap 2), 500 węzłów (etap 3 — `LargeMapOptimizer.tsx:11-40`).
- Zaimportuj lub stwórz mapę z >150 węzłami (np. przez Import OPML z dużym plikiem).
- Sprawdź że `simplifiedMode = true` — węzły wyświetlają się w uproszczonej formie (mniejsze, bez dekoracji).
- Sprawdź że krawędzie są uproszczone (`reactFlowEdgeTypes = {}` gdy `simplifiedMode`).
- Toast lub banner informujący o trybie simplified.

### 21.2 Performance na dużej mapie [MANUAL]
- Drag & drop na mapie 200 węzłów → sprawdź płynność (brak freeze).
- Zoom in/out → sprawdź płynność.
- Uwaga: brak wirtualizacji (occlusion culling) powyżej ~300 węzłów — odnotuj jako P2.

---

## §22. Activity Feed (`ActivityFeed`)

### 22.1 Wyświetlanie aktywności (`GET /my-ideas/:id/activity`)
- Otwórz `ActivityFeed` (przycisk w toolbarze lub menu) → lista zdarzeń.
- Zdarzenia: dodanie węzła, edycja, usunięcie, komentarz, snapshot.
- Każde zdarzenie ma autora, datę, opis.

### 22.2 Logowanie aktywności [DB]
- Dodaj węzeł → sprawdź że `pushActivity` dodało wpis.
- Odnotuj: migracja `my_idea_activity` (`20260611_…sql`) musi być zaaplikowana. Jeśli tabela nie istnieje → 503 lub silent fail. [DB]

---

## §23. Integracja Teresa — Sidekick (known gap)

### 23.1 Event sidekick [KNOWN-GAP]
- `IdeaRecommendationMap.tsx:2534` dispatchuje event `idea-mindmap-sidekick-context` co zmianę mapy.
- Sprawdź w Console czy event jest dispatchwany (`debugLog`).
- Otwórz panel czatu Teresa (sidebar/button) → sprawdź czy Teresa ma kontekst mapy w swoich odpowiedziach.
- **Spodziewany wynik wg L-04:** NIE ma kontekstu — `useOpenChatWithContext.ts` nie konsumuje tego eventu. Teresa nie wie o mapie. Odnotuj jako `[KNOWN-GAP]`.

### 23.2 Sidekick hint banner
- `IdeaRecommendationMap.tsx:5296-5300`: jeśli `sidekickCtx` istnieje i `nodes.length > 1` → hint banner z `sidekickCtx.promptHint` (PL/EN).
- Sprawdź czy banner jest widoczny i czytelny.
- Klik w banner → co się dzieje? Czy otwiera chat? Sprawdź.

---

## §24. Ścieżki cross-module

### 24.1 Mind Map → Canvas (AI Chat z kontekstem)
- W sidekick bannerze (§23.2) klik → powinno otworzyć chat z kontekstem mapy.
- Wg aktualnego stanu: integracja nie działa. Sprawdź i odnotuj wynik.

### 24.2 Mind Map → Inicjatywy (§19)
- Skonwertuj 3 węzły (§19.3 BatchConvert) → przejdź do `/initiatives`.
- Sprawdź że inicjatywy zostały utworzone z tytułami z węzłów.
- Sprawdź że inicjatywy mają powiązanie (`ideaId`) z oryginalną ideą.

### 24.3 Mind Map → Decyzje (§19.3 BatchConvert target=decision)
- Analogicznie jak §24.2 dla decyzji (`/my-work/decisions`).

### 24.4 Ideas lista (M05) → Mind Map
- Z listy idei (M05) klik „Otwórz mapę" dla idei X → `IdeaMapWorkspace` z `ideaId=X` ładuje się.
- Powrót: przycisk „Wróć do listy" lub nawigacja back → lista idei.

### 24.5 Mind Map → Eksport do Outputs (M17)
- Aksja `convert_presentation` → otwiera Presentation Studio (M19) z węzłami jako slajdami.
- Sprawdź nawigację i czy treść węzłów trafia do slajdów.

---

## §25. Testy przekrojowe

### 25.1 Persistencja po reload (obowiązkowe po każdym §)
- Po każdej sekcji (dodanie węzłów, zmiana kolorów, zwinięcie gałęzi, snapshot): reload strony i sprawdź że stan jest identyczny z oczekiwanym.

### 25.2 Stany disabled (async in-flight)
- Podczas `POST /map/sync` (loader widoczny): sprawdź które przyciski są disabled (nie dopuścić do równoległych zapisów z różnymi `baseVersion`).
- Podczas AI expand (loader): toolbar AI disabled?
- Podczas collab node-lock: przycisk edycji zablokowanego węzła disabled.

### 25.3 Viewport — małe okno [MANUAL]
- Zmień rozmiar okna do 1024×768 → sprawdź że kanwa jest używalna.
- Toolbar nie wychodzi poza ekran.
- Kontekstowe menu (NodeContextMenu, EdgeContextMenu) nie wychodzą poza viewport.
- Zmień do 768×600 → sprawdź minimum viable experience.

### 25.4 Touch [MANUAL]
- Na urządzeniu touch (tablet/iPhone z DevTools touch simulation): pinch-to-zoom działa.
- Tap na węźle → zaznaczenie.
- Long press → menu kontekstowe (jeśli obsługiwane).
- Pan dwoma palcami → przesunięcie kanwy.

### 25.5 i18n — PL/EN
- Przełącz język na PL (`i18n.language='pl'`): etykiety toolbara, tooltips, toasty, menu kontekstowe — wszystkie po polsku.
- Przełącz na EN: wszystkie po angielsku.
- Sprawdź czy `buildLocalDefaultIdeaMap` tworzy starter graph z poprawnymi etykietami (PL: „Problem", EN: „Problem"; PL: „Mój pomysł", EN: „My idea").
- `[UWAGA i18n]`: `mindmap/` ma **0/872** `isPolish`/inline tłumaczeń wg karty audytu (G §3). Sprawdź czy wszystkie stringi używają `t(key, fallback)` — znajdź gołe polskie stringi bez `t()` i odnotuj.

### 25.6 Dark mode
- Przełącz na dark mode → wszystkie komponenty mapy czytelne: węzły, krawędzie, overlaye, drawery, modale.
- Sprawdź kontrast tekstu w toolbarach i menu kontekstowych.
- Sprawdź floating toolbar na węźle w dark mode.

### 25.7 A11y — klawiatura
- `Tab` (przeglądarkowy) nawiguje przez przyciski toolbara.
- `Enter`/`Space` aktywuje przyciski toolbara.
- Drawery i modale mają `aria-label` i `role` (sprawdź w DevTools → Accessibility tree).
- Skróty klawiaturowe mapy (§9) działają tylko gdy fokus jest na kanwie, nie w polach formularza.
- Focus trap w modalach (BatchConvert, SnapshotHistory, NodeCommentThread).

### 25.8 Zero błędów w konsoli
- Podczas całej sesji testowej: **zero** `ERROR` i `WARN` w Console (wyjątek: znany React duplicate-key w ColorPickerPopover — odnotuj jako known).
- Sprawdź że `debugLog` nie powoduje niezamkniętych Promise rejection.

### 25.9 Paleta poleceń (`MindmapCommandPalette`) — kompletność
- `Cmd+K` → lista dostępnych akcji.
- Sprawdź że akcje z §9 (undo, redo, layout, eksport, import) są dostępne przez paletę.
- Filtrowanie: wpisz fragment nazwy akcji → lista zawęża się.

---

## §26. Mapa epików → sekcje (ZERO niepokrytych)

| F-Epik | Opis | Sekcja testów |
|---|---|---|
| EPIK 1 | WS org-scope szczelny (P1) | §16.5 |
| EPIK 2 | Persystencja snapshots/activity (P0) | §13.1, §22.2 |
| EPIK 3 | Korupcja „rose" zamknięta (P1) | §3.4 |
| EPIK 4 | Uczciwe afordancje (PPT label, sidekick, AI overlays, webhooks) | §17.7, §23.1, §12, §17.10 |
| EPIK 5 | Flush keepalive/sendBeacon (P1) | §15.6 |
| EPIK 6 | Szlif (drawery, align/distribute, dup-key) | §3.2, §8.6, §25.8 |
| EPIK 7 | Testy BE map/sync + WS + E2E CI | §26 (regresja niżej) |

---

## §27. Testy regresji / jednostkowe

### 27.1 Istniejące testy jednostkowe (run before smoke)
Uruchom: `npx vitest run tests/unit/mindmap/`

| Plik | Co testuje |
|---|---|
| `branchColor.test.ts` | logika kolorów gałęzi |
| `canvasLeftToolbar.test.tsx` | renderowanie toolbara + akcje |
| `colorPickerPopover.test.tsx` | picker kolorów; sprawdź duplicate-key warning |
| `extensionsMerge.test.ts` | merge extensions (wersjonowanie) |
| `floatingNodeToolbar.test.tsx` | floating toolbar |
| `floatingToolbarDropdowns.test.tsx` | dropdowny toolbara |
| `mindMapNodeModel.test.ts` | model węzła |
| `mindmapInteractionGrammar.test.ts` | gramatyka interakcji |
| `modals.test.tsx` | modale (BatchConvert, etc.) |
| `moreToolsPanel.test.tsx` | panel więcej narzędzi |

Wszystkie muszą PASS. Odnotuj każdy FAIL z plikiem i linią.

### 27.2 Test smoke E2E Playwright
Uruchom: `npx playwright test tests/e2e/smoke/qa-idea-mindmap-checklist.spec.ts`

- 361 linii, pełny checklist.
- **Uwaga:** test NIE jest w CI (`.github/workflows/test-suite.yml` go nie listuje — [L-07 OPEN]).
- Uruchom lokalnie i potwierdź wynik; zarejestruj jako propozycję do CI.

### 27.3 Testy integracyjne backendu (brak — luka L-07)
- `tests/integration/p12-mindmap-builder.contract.test.ts` — dotyczy innego modułu (v8 mindmap-builder), NIE naszego `/map/sync`.
- Brak testów integracyjnych dla: `POST /map/sync` (konflikt, empty-reset, merge extensions), WS gateway cross-org.
- Odnotuj jako L-07 (OPEN) — propozycja: dodaj testy integracyjne przed wejściem do prod.

### 27.4 Test redirect deprecated shim
`src/components/MyWork/__tests__/IdeasMindMap.redirect.test.tsx` — sprawdź że shim NIE renderuje mapy, tylko redirect.

### 27.5 Test sync persistence smoke
`src/components/MyWork/canvas/__tests__/ideaMapSyncPersistence.smoke.test.ts` — smoke test sync; uruchom i potwierdź PASS.

---

## §28. Format raportu i Definition of Done

### Format każdego punktu
```
| Sekcja | Krok | Oczekiwane | Faktyczne | Status | Dowód |
|--------|------|-----------|-----------|--------|-------|
| §2.1   | Tab na węźle A | dziecko B dodane + POST /map/sync z baseVersion | ... | PASS/FAIL | screenshot + Network payload |
```

Dla **FAIL**: podaj `plik:linia`, opis przyczyny, propozycję fixa, pilność (P0/P1/P2).

### Definition of Done (M06)
1. Wszystkie sekcje §1–§27 przetestowane; każda pozycja z wynikiem PASS lub FAIL+opis.
2. Zero P0 FAIL bez naprawy lub zaakceptowanego backlogu.
3. Kluczowe E2E potwierdzone w Network: `POST /map/sync` z `baseVersion` widoczny dla każdej operacji modyfikującej graf.
4. Konflikt 409 → rehydracja zweryfikowana (brak silent overwrite).
5. Cross-org WS reject → 403 + destroy zweryfikowany.
6. Zero nowych błędów w Console (duplikat-key w ColorPicker = known, odnotowany).
7. PL i EN przetestowane (§25.5).
8. Dark mode zweryfikowany (§25.6).
9. `npx vitest run tests/unit/mindmap/` → wszystkie PASS.
10. `npx playwright test tests/e2e/smoke/qa-idea-mindmap-checklist.spec.ts` → wynik zaraportowany.
11. Znane ograniczenia (ExportPPT=HTML, WebhookSettings=localStorage, sidekick w próżnię, pseudo-AI overlays, brak align/distribute, flush bez keepalive) — udokumentowane jako KNOWN, nie jako FAIL.
12. Decyzja D-01 (canonical drawer) — odnotowany stan (dwa drawery aktywne); nie blokuje DoD.
