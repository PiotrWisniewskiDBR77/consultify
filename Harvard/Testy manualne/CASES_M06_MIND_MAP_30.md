# CASES — M06 Ideas · Mind Map · 30 bogatych case'ów testowych

> **Moduł:** M06 Ideas Mind Map (`/my-work/ideas/workspace/mindmap`)
> **Główny plik:** `src/components/MyWork/IdeaRecommendationMap.tsx` (6433 lin.) + katalog `src/components/MyWork/mindmap/`
> **Inwentarz funkcji (SSOT):** `Harvard/Testy manualne/TESTY_M06_IDEAS_MIND_MAP.md`
> **Cel paczki:** 30 realistycznych scenariuszy pracy konsultanta, które eksploatują PEŁNE możliwości narzędzia — nie smoke'i, lecz bogate przepływy diagnozy / mapy strategii / drzew decyzyjnych, eksploatujące każdą funkcję Mind Mapy.
> **Data:** 2026-06-21
> **Autor:** sesja projektowa (czytanie kodu, bez uruchamiania serwerów/testów)

---

## Legenda znaczników

- **[REAL-AI]** — wymaga żywego LLM (`/map/expand`, `/map/ai-suggestions`, `/map/gap-analysis`). Weryfikuj żądanie w Network + realność (zmienna) odpowiedzi.
- **[PSEUDO-AI]** — overlay na klienckich heurystykach (NIE realny LLM). Weryfikuj brak crash + uczciwą etykietę „heurystyka".
- **[MULTIPLAYER]** — wymaga 2 sesji/okien (collab WS `/ws/collab/:ideaId`).
- **[EXPORT-ARTIFACT]** — produkuje pobierany plik / snippet do schowka; sprawdź artefakt.
- **[DB]** — utrwalenie w tabeli (`my_idea_map_snapshots`, `idea_node_comments`, `my_idea_activity`).

**Zasada E2E (każdy case):** każda zmiana grafu → `POST /my-ideas/:id/map/sync` z `baseVersion` w body (my-work.routes.ts:3994) → 200 → reload strony = stan identyczny. UI-zmiana bez żądania = FAIL.

---

## Spis 30 case'ów

### A. Tworzenie i budowa struktury (MC-06-01 … MC-06-06)
- **MC-06-01** · Diagnoza Ishikawa — budowa drzewa przyczynowo-skutkowego klawiaturą Tab/Enter
- **MC-06-02** · Mapa strategii 3-horyzontowa — floating toolbar + paleta poleceń (Cmd+K)
- **MC-06-03** · Drzewo decyzyjne „make-or-buy" — krawędzie etykietowane + wstaw węzeł na krawędzi
- **MC-06-04** · Import strategii z FreeMind/XMind/OPML i scalenie z istniejącą mapą
- **MC-06-05** · Voice-to-Node — burza mózgów głosowa w trakcie warsztatu
- **MC-06-06** · Reorganizacja struktury — Alt+strzałki, drag-reparent, kopiuj/wklej gałąź

### B. Layouty i tryby strukturalne (MC-06-07 … MC-06-10)
- **MC-06-07** · Przełączanie Tree → Radial → Force-directed na żywej mapie 40 węzłów
- **MC-06-08** · Structure layouts — Fishbone / Org-chart / Timeline / Tree-right
- **MC-06-09** · Fold levels (Alt+0–3, Alt+9) — prezentacja warsztatowa „od ogółu do szczegółu"
- **MC-06-10** · Manual drag + viewport persistence — ręczna kompozycja „board" konsultanta

### C. AI-assist realny (MC-06-11 … MC-06-15)
- **MC-06-11** · AI Expand gałęzi „bariery wdrożenia" z akceptacją propozycji [REAL-AI]
- **MC-06-12** · Gap Analysis mapy transformacji — wykrycie luk i dodanie węzłów [REAL-AI]
- **MC-06-13** · AI Suggestions + Branch Summary — synteza gałęzi do akapitu [REAL-AI]
- **MC-06-14** · Document-to-Map — wgranie raportu i ekstrakcja struktury [REAL-AI]
- **MC-06-15** · Interview-to-Map — transkrypt wywiadu (M10) → mapa tematów [REAL-AI]

### D. AI Overlays — pseudo-AI (MC-06-16 … MC-06-19)
- **MC-06-16** · Sentiment overlay + Auto-clustering na mapie głosów klienta [PSEUDO-AI]
- **MC-06-17** · Dependency Detector + Priority Recommender — czytanie zależności [PSEUDO-AI]
- **MC-06-18** · What-If Scenarios + Competitive Landscape + Blind Spots [PSEUDO-AI]
- **MC-06-19** · Map Health Score + Funnel Analytics + Branch Balancer — audyt jakości mapy [PSEUDO-AI]

### E. Eksport, konwersja, embed (MC-06-20 … MC-06-24)
- **MC-06-20** · Eksport multi-format — PNG / SVG / Markdown / JSON / CSV [EXPORT-ARTIFACT]
- **MC-06-21** · Eksport diagram-code (Mermaid/PlantUML) + PDF (print) [EXPORT-ARTIFACT]
- **MC-06-22** · Eksport PowerPoint (HTML) + Embed-in-Reports snippet [EXPORT-ARTIFACT]
- **MC-06-23** · Batch Convert wielu węzłów → Inicjatywy + Decyzje (cross-module)
- **MC-06-24** · Konwersja gałęzi → Prezentacja (Presentation Studio M19)

### F. Tryby widoku i duże mapy (MC-06-25 … MC-06-27)
- **MC-06-25** · Presentation Mode + Timeline View + Time Heatmap + 3D View
- **MC-06-26** · Snapshoty historii — checkpoint → edycja → przywrócenie [DB]
- **MC-06-27** · Duża mapa 200+ węzłów — simplified mode + wydajność + minimap

### G. Współpraca, persystencja, paleta (MC-06-28 … MC-06-30)
- **MC-06-28** · Collab realtime — 2 konsultantów, live cursory, graph-patch, node-lock [MULTIPLAYER]
- **MC-06-29** · Cross-org reject + conflict 409 rehydracja + offline draft [MULTIPLAYER]
- **MC-06-30** · Komentarze/wątki + tagi + evidence/artifact/person + sub-mapy + Activity Feed [DB]

---

# A. Tworzenie i budowa struktury

---

### MC-06-01 · Diagnoza Ishikawa — budowa drzewa przyczynowo-skutkowego klawiaturą · [Tworzenie / gramatyka klawiaturowa]

**Co się dzieje**
Konsultant prowadzi diagnozę „Spadek marży w Q2" w VTS Group. Na pustej mapie (starter graph z węzłem root „Mój pomysł") zmienia root na „Spadek marży 18% → 12%" (F2, Enter). Następnie buduje 6 kategorii przyczyn metodą 6M (Ludzie, Maszyny, Metody, Materiały, Pomiar, Środowisko): zaznacza root → `Tab` (dziecko) → wpisuje nazwę kategorii → `Enter` (rodzeństwo dla następnej). Pod każdą kategorią zagłębia 2-3 przyczyny szczegółowe znów przez `Tab`/`Enter`. Łącznie ~22 węzły w 3 poziomach. Po drodze nawiguje strzałkami (`ArrowUp/Down` między rodzeństwem, `ArrowLeft` do rodzica, `ArrowRight` do pierwszego dziecka) zamiast myszy, żeby zweryfikować płynność gramatyki.

**Efekty pracy**
22-węzłowy graf przyczynowo-skutkowy utrwalony w `my_idea_maps` poprzez serię `POST /map/sync` z rosnącym `version` (debounce ~auto). Każdy `Tab` tworzy krawędź parent→child (`useMindMapNodes.tsx addChildNode`), każdy `Enter` — węzeł na poziomie rodzeństwa (`addSiblingNode`). Po reloadzie cała struktura + viewport odtwarzana z `extensions.mindmap.viewState.viewport`. Brak żadnego 409 przy sekwencyjnej pracy jednego usera.

**Grafika**
Domyślny layout tree poziomy: root po lewej, kategorie 6M jako gałęzie, przyczyny jako liście. Węzły w kolorach gałęzi (branch theme — każda kategoria dziedziczy odrębny kolor z `branchColor`). Inline-edit pokazuje textarea z kursorem w trybie F2. Floating toolbar pojawia się nad zaznaczonym węzłem. Krawędzie hierarchiczne (`GradientEdge`).

**Funkcjonalność**
`IdeaRecommendationMap.tsx` (gramatyka inline: Tab/Enter/F2/Arrows), `useMindMapNodes.tsx` (`addChildNode`/`addSiblingNode`), `mindmapInteractionGrammar.ts`, persystencja `useMindMapPersistence.ts` + `canvas/useIdeaMapSync.ts` → `POST /my-ideas/:id/map/sync` (my-work.routes.ts:3994). Starter graph: `buildLocalDefaultIdeaMap`.

---

### MC-06-02 · Mapa strategii 3-horyzontowa — floating toolbar + paleta poleceń · [Tworzenie / Cmd+K / toolbar]

**Co się dzieje**
Konsultant buduje mapę strategii wg modelu McKinsey „Three Horizons" dla Apator. Tym razem NIE używa klawiatury — testuje afordancje myszowe. Tworzy 3 gałęzie horyzontów: klika węzeł → z `FloatingNodeToolbar` używa „Dodaj gałąź (Tab)" i „Dodaj sąsiada (Shift+Enter)". Otwiera `Cmd+K` (paleta poleceń), wpisuje „dodaj" → wybiera akcję dodania węzła, potem filtruje „layout" i „eksport" by zweryfikować kompletność palety. Pod horyzontem H1 dodaje 4 inicjatywy, koloruje je przez ColorPickerPopover z floating toolbar, zmienia typ semantyczny przez SemanticTypeDropdown.

**Efekty pracy**
~15-węzłowa mapa strategii utrwalona przez `POST /map/sync`. Zmiany koloru (optimistic UI + sync) i typu semantycznego zapisane w `nodeMetaMap`/`extensions`. Paleta poleceń dowodzi dostępności akcji bez znajomości skrótów. Reload → kolory i typy semantyczne przetrwają.

**Grafika**
Floating toolbar (`FloatingNodeToolbar.tsx`, 20 KB) z ikonami: dodaj gałąź, sąsiad, FontSize, BranchTheme, Color, SemanticType. Paleta poleceń (`MindmapCommandPalette.tsx`) — modal centralny z polem wyszukiwania i listą akcji z ikonami, filtrowanie na żywo. Węzły H1/H2/H3 w trzech odrębnych kolorach. **Znany bug do odnotowania:** ColorPickerPopover może generować React duplicate-key warning w konsoli.

**Funkcjonalność**
`FloatingNodeToolbar.tsx` + `floating-toolbar/`, `toolbar-popovers/` (ColorPickerPopover, BranchThemeDropdown, SemanticTypeDropdown), `MindmapCommandPalette.tsx` (`Cmd+K`, `commandPaletteOpen`), `useMindMapQuickActions.ts`. Sync per zmiana.

---

### MC-06-03 · Drzewo decyzyjne „make-or-buy" — krawędzie etykietowane + wstaw węzeł na krawędzi · [Tworzenie / krawędzie / tryb connect]

**Co się dzieje**
Konsultant modeluje decyzję „Make or Buy systemu CRM". Buduje drzewo: węzeł decyzyjny → 2 opcje (Make / Buy) → pod każdą konsekwencje. Przełącza na tryb `connect` (kursor crosshair) i ręcznie rysuje krawędzie poprzeczne między konsekwencjami a wspólnym węzłem „Ryzyko integracji". Prawoklik na krawędzi „Make → Koszt" → `EdgeContextMenu`: dodaje etykietę „24 mc, 800k", zmienia styl linii na dashed, odwraca kierunek testowej krawędzi, potem używa „wstaw węzeł na krawędzi" by dodać węzeł pośredni „Faza pilotażowa" w środku krawędzi A→B. Próbuje połączyć węzeł sam ze sobą (oczekiwana blokada pętli).

**Efekty pracy**
Drzewo decyzyjne z etykietowanymi, stylizowanymi i skierowanymi krawędziami. Wstawiony węzeł rozbija krawędź A→B na A→nowy→B. Wszystko utrwalone: `POST /map/sync` z zaktualizowaną listą `edges` (etykiety, style, kierunki) i nowym węzłem. Pętla self-loop zablokowana. Reload → etykiety i style krawędzi przetrwają.

**Grafika**
Tryb connect: `cursor-crosshair` na kanwie. Krawędzie z etykietami (`LabeledEdge.tsx`) i stylami (solid/dashed/dotted). `EdgeContextMenu.tsx` jako menu kontekstowe nad krawędzią. Strzałki kierunkowe odwracają orientację. Drzewo w layout tree.

**Funkcjonalność**
Tryb connect (`getMindmapConnectToolbarAction`), `EdgeContextMenu.tsx`, `LabeledEdge.tsx`, `GradientEdge.tsx`, walidacja self-loop. Sync krawędzi przez `POST /map/sync`.

---

### MC-06-04 · Import strategii z FreeMind/XMind/OPML i scalenie z istniejącą mapą · [Tworzenie / import]

**Co się dzieje**
Konsultant ma starą mapę strategii klienta w MindManager (eksport `.opml`) oraz załącznik warsztatowy w FreeMind (`.mm`) i XMind (`.xmind`). Otwiera `ImportExternalMap` (przycisk import / menu More). Najpierw importuje `.mm` → węzły FreeMind pojawiają się na kanwie, weryfikuje zgodność hierarchii i etykiet. Następnie do tej samej mapy importuje `.opml` (scalenie). Na koniec testuje plik uszkodzony (obcięty XML) i plik pusty — oczekuje graceful error bez crash i bez white-screen.

**Efekty pracy**
Węzły z 3 formatów zewnętrznych wpływają na kanwę i są utrwalane przez `POST /map/sync` (dane importu lądują w `my_idea_maps`). Parsery: FreeMind `.mm` (XML), XMind ZIP (rozpakowanie + content.xml), OPML (outline). Po reloadzie zaimportowana struktura przetrwa. Plik uszkodzony → toast błędu, mapa nienaruszona.

**Grafika**
Modal `ImportExternalMap.tsx` (13 KB) z dropzone / file picker, wskaźnikiem formatu i podglądem liczby węzłów. Po imporcie auto-layout rozkłada nowe węzły (tree). Toast sukcesu z liczbą zaimportowanych węzłów.

**Funkcjonalność**
`ImportExternalMap.tsx` (parsery .mm / .xmind ZIP / .opml), auto-layout po imporcie (`useAutoLayout.ts`), `POST /map/sync`. Edge: walidacja uszkodzonego/pustego pliku.

---

### MC-06-05 · Voice-to-Node — burza mózgów głosowa w trakcie warsztatu · [Tworzenie / voice] [MANUAL]

**Co się dzieje**
Podczas warsztatu strategicznego konsultant prowadzi szybką burzę mózgów bez odrywania rąk od flipchartu. Otwiera `VoiceToNode` (przycisk w toolbarze), udziela uprawnienia mikrofonu (Chrome / Web Speech API). Dyktuje kolejno 5 pomysłów („zwiększyć retencję klientów premium", „automatyzacja onboardingu", ...) — każda fraza transkrybowana w polu, zatwierdzenie tworzy nowy węzeł z tą treścią podłączony do zaznaczonego rodzica. Testuje edge: cofa uprawnienie mikrofonu (graceful error) i sprawdza zachowanie w przeglądarce bez Web Speech API.

**Efekty pracy**
5 węzłów utworzonych głosowo, każdy utrwalony przez `POST /map/sync`. Transkrypcja → label węzła. Brak uprawnień mikrofonu → komunikat, brak crash. Reload → węzły głosowe przetrwają jak zwykłe węzły.

**Grafika**
Modal/panel `VoiceToNode.tsx` (8 KB) ze wskaźnikiem nagrywania (pulsująca ikona mic), polem transkrypcji na żywo i przyciskiem „Dodaj jako węzeł". Nowe węzły dołączane do drzewa, kolor gałęzi rodzica.

**Funkcjonalność**
`VoiceToNode.tsx` (Web Speech API), dodanie węzła → `addChildNode` → `POST /map/sync`. `[MANUAL]` — wymaga mikrofonu + Chrome. Edge: brak permission / brak API.

---

### MC-06-06 · Reorganizacja struktury — Alt+strzałki, drag-reparent, kopiuj/wklej gałąź · [Tworzenie / edycja struktury]

**Co się dzieje**
Po warsztacie konsultant porządkuje mapę 30-węzłową. Używa `Alt+ArrowUp/Down` by przesunąć węzeł w kolejności rodzeństwa (resort), `Alt+ArrowLeft` by wypchnąć węzeł o poziom wyżej (do rodzica-rodzica), `Alt+ArrowRight` by zagłębić węzeł pod poprzednie rodzeństwo. Następnie drag-reparent: chwyta całą gałąź „Marketing" i przeciąga nad węzeł „Wzrost" (podświetlenie `_dropTarget`) → zmienia rodzica. Zaznacza gałąź (`Ctrl+A` lub box-select), `Ctrl+C` → `Ctrl+V` duplikuje strukturę jako szablon dla drugiego scenariusza. Testuje edge: reparent węzła na własne potomstwo (oczekiwana blokada/niespójność — odnotować).

**Efekty pracy**
Zreorganizowana hierarchia: zmienione krawędzie parent→child po reparent, przesunięcia kolejności w rodzeństwie, wklejona kopia gałęzi z nowymi id węzłów. Każda operacja → `POST /map/sync`. Reload → nowa struktura przetrwa. Manual drag wyłącza auto-relayout na sesję (`manualDragActive`).

**Grafika**
Podczas drag-reparent potencjalny rodzic dostaje podświetlenie `_dropTarget`. Multi-selekcja: zaznaczone węzły z obwódką. Box-select rysuje prostokąt zaznaczenia. Layout tree przelicza pozycje po reparent (chyba że manual drag aktywny).

**Funkcjonalność**
Gramatyka Alt+arrows (reparent-sort, IdeaRecommendationMap.tsx), drag-reparent (`useMindMapNodes.tsx`, `_dropTarget`, `manualDragActive`), `Ctrl+A`/`Ctrl+C`/`Ctrl+V`/`Ctrl+X` clipboard-state. Sync per operacja.

---

# B. Layouty i tryby strukturalne

---

### MC-06-07 · Przełączanie Tree → Radial → Force-directed na żywej mapie 40 węzłów · [Layouty]

**Co się dzieje**
Konsultant ma gęstą mapę audytu (40 węzłów, 4 poziomy). Eksploruje 3 layouty by znaleźć najczytelniejszy do prezentacji zarządowi. Klika „Tree" (domyślny, poziomy) → „Radial" (root w centrum, gałęzie promieniście) → „Force" (rozluźnienie siłowe z animacją). Przy każdym przełączeniu weryfikuje, że krawędzie pozostają poprawne (parent→child niezmienione), tylko pozycje się zmieniają. Sprawdza animację force-directed (płynna, nie skokowa). Następnie prawoklik na pustej kanwie → `PaneContextMenu` → „Auto-layout" i porównuje z Tree (powinien dać ten sam wynik).

**Efekty pracy**
Pozycje węzłów przeliczone trzema algorytmami, każda zmiana layoutu utrwalona przez `POST /map/sync` (tylko `position`, struktura niezmieniona — layouty „never modify graph structure" wg StructureLayouts.ts:6). `layoutMode: 'tree'|'radial'|'force'`. Reload → ostatni layout przetrwa.

**Grafika**
Tree: hierarchia pozioma. Radial: root w centrum, koncentryczne pierścienie (`RadialTreeLayout.tsx`). Force: organiczny układ z odpychaniem (`ForceDirectedLayout.tsx`, animacja). Toolbar layout-switch z aktywnym stanem przycisku. Krawędzie `GradientEdge` przerysowane.

**Funkcjonalność**
`useAutoLayout.ts`, `RadialTreeLayout.tsx`, `ForceDirectedLayout.tsx`, `setLayoutMode`, `PaneContextMenu.tsx` (`pane_auto_layout`). Sync pozycji.

---

### MC-06-08 · Structure layouts — Fishbone / Org-chart / Timeline / Tree-right · [Layouty / structure]

**Co się dzieje**
Konsultant wykorzystuje mapę 6M z MC-06-01 i przekształca ją w różne reprezentacje strukturalne wg odbiorcy. Z palety poleceń / toolbara stosuje kolejno: **Fishbone (Ishikawa)** — diagram rybiej ości z kręgosłupem i gałęziami pod kątem 45° (idealny dla diagnozy 6M); **Org-chart** — top-down hierarchia dla raportu zarządowego; **Timeline** — pozioma oś dla roadmapy; **Tree-right** — left-to-right dla dokumentacji. Przy każdym sprawdza, że węzły przyjmują oczekiwaną geometrię, a struktura grafu (krawędzie) pozostaje nietknięta.

**Efekty pracy**
4 reprezentacje strukturalne tej samej mapy, każda zmiana pozycji przez `applyStructureLayout` → `POST /map/sync`. `MapStructureType` zmienia się, krawędzie bez zmian (layout tylko repozycjonuje — StructureLayouts.ts). Reload → ostatnia struktura przetrwa.

**Grafika**
Fishbone: poziomy kręgosłup + gałęzie pod 45° góra/dół (`applyFishboneLayout`, FISHBONE_ANGLE=π/4). Org-chart: prostokątna hierarchia top-down (`applyOrgChartLayout`). Timeline: węzły rozłożone poziomo wg kolejności. Tree-right: rozgałęzienie w prawo. Orphany rozmieszczane w siatce (`placeOrphans`).

**Funkcjonalność**
`StructureLayouts.ts` (`applyFishboneLayout`, `applyOrgChartLayout`, `applyTimelineLayout`, `applyTreeRightLayout`, `buildAdjacency`, `findRoot`), `applyStructureLayout`. Sync pozycji.

---

### MC-06-09 · Fold levels (Alt+0–3, Alt+9) — prezentacja warsztatowa „od ogółu do szczegółu" · [Layouty / fold / collapse]

**Co się dzieje**
Konsultant prezentuje 50-węzłową mapę transformacji na żywym spotkaniu. Zaczyna od `Alt+0` (wszystko zwinięte — widoczny tylko root: framing problemu). Stopniowo odsłania: `Alt+1` (kategorie główne), `Alt+2` (podkategorie), `Alt+3` (szczegóły operacyjne), na koniec `Alt+9` (wszystko rozwinięte). Ręcznie zwija pojedyncze gałęzie Chevronem/`Space` by skupić uwagę na jednym wątku. Sprawdza toasty informujące o poziomie i nawigację do zwiniętego węzła (focus → rodzic).

**Efekty pracy**
Stan zwinięcia każdej gałęzi zapisany w `extensions.mindmap.collapsedNodeIds` → `POST /map/sync`. Reload → stan zwinięcia przywrócony (gałęzie zwinięte przed reloadem nadal zwinięte). Toasty „Widok: poziom N" / „Wszystko rozwinięte".

**Grafika**
Zwinięta gałąź: węzeł z `…` i licznikiem dzieci, potomkowie ukryci. ChevronDown/ChevronRight na węzłach. Toast poziomu fold. Layout tree przelicza widoczne węzły. Płynne odsłanianie warstw.

**Funkcjonalność**
Fold levels `Alt+0/1/2/3/9` (IdeaRecommendationMap.tsx), `toggleCollapseNode` (`mm-toggle-collapse`, `Space`), `collapsedNodeIds` w `MapSnapshot` (uwzględniany w undo/redo). Sync collapsed state.

---

### MC-06-10 · Manual drag + viewport persistence — ręczna kompozycja „board" konsultanta · [Layouty / viewport / zoom]

**Co się dzieje**
Konsultant porzuca auto-layout i ręcznie komponuje mapę jak na tablicy: przeciąga węzły w przemyślane pozycje (klastry tematyczne), przybliża istotny obszar scrollem, przesuwa kanwę (Space+drag / MPM). Używa `CanvasZoomControls` (+/−/Fit), `Ctrl+0` (fitView z paddingiem 0.3, animacja 300ms) i `Shift+1` (FigJam-style fit). Włącza minimap (domyślnie off), nawiguje klikiem po minimapie. Zostawia mapę w konkretnym viewport, reloaduje stronę i sprawdza przywrócenie dokładnego kadru.

**Efekty pracy**
Ręczne pozycje węzłów (`manualDragActive` wyłącza auto-relayout) + viewport zapisany przez `onMoveEnd` do `extensions.mindmap.viewState.viewport` → `POST /map/sync`. Reload → węzły w ręcznych pozycjach + dokładny viewport (zoom + pan) przywrócony z serwera, nie domyślny.

**Grafika**
Ręcznie rozmieszczone węzły bez przebudowy. Minimap (toggle) w rogu z prostokątem viewportu. `CanvasZoomControls` (+/−/Fit). Płynna animacja fitView 300ms. Kursor pan (grab) podczas Space+drag.

**Funkcjonalność**
Manual drag (`manualDragActive`), viewport persistence (`onMoveEnd` → `extensions.mindmap.viewState.viewport`), `Ctrl+0`/`Shift+1` fitView, `CanvasZoomControls`, minimap toggle (default off, IdeaRecommendationMap.tsx:~1900). Sync pozycji + viewport.

---

# C. AI-assist realny

---

### MC-06-11 · AI Expand gałęzi „bariery wdrożenia" z akceptacją propozycji · [AI] [REAL-AI]

**Co się dzieje**
Konsultant ma węzeł „Bariery wdrożenia AI" i chce rozszerzyć go o czynniki, których nie pomyślał. Zaznacza węzeł → „AI Expand" (floating toolbar / `FloatingAIPopover` / prawoklik → `ctx_ai_expand`). Loader. LLM zwraca propozycje (np. „opór kulturowy", „dług techniczny", „braki kompetencyjne", „RODO/compliance"). Konsultant przegląda propozycje, akceptuje 3 z 5, odrzuca nieistotne. Powtarza Expand na nowo dodanym węźle (głębsze drążenie). Testuje edge: timeout LLM → toast błędu bez crash.

**Efekty pracy**
`POST /my-ideas/:id/map/expand` (my-work.routes.ts:4194) z kontekstem węzła → realne węzły-propozycje. Akceptacja → `POST /map/sync` z nowymi węzłami podpiętymi do rodzica. Realny LLM (`llmService`), NIE heurystyka — odpowiedź zmienna między uruchomieniami. Reload → zaakceptowane węzły przetrwają, odrzucone nie istnieją.

**Grafika**
Loader (spinner) na węźle/panelu podczas żądania. Propozycje jako ghost/preview nodes lub lista do zaznaczenia (`AIProposalDiffModal.tsx`). Zaakceptowane węzły wchodzą w kolorze gałęzi rodzica. Toast błędu przy timeout.

**Funkcjonalność**
`POST /map/expand` (REAL LLM, my-work.routes.ts:4194), `AIProposalDiffModal.tsx`, `ctx_ai_expand` (NodeContextMenu), akceptacja → `POST /map/sync`. Edge: timeout handling.

---

### MC-06-12 · Gap Analysis mapy transformacji — wykrycie luk i dodanie węzłów · [AI] [REAL-AI]

**Co się dzieje**
Konsultant zakończył mapę transformacji cyfrowej i przed oddaniem klientowi chce sprawdzić kompletność. Klika „Gap Analysis" → `POST /my-ideas/:id/map/gap-analysis` z kontekstem całej mapy. LLM analizuje strukturę i zwraca listę luk („brak wątku zarządzania zmianą", „nie uwzględniono KPI/mierników", „brak ścieżki finansowania"). Konsultant czyta luki w panelu, dla każdej istotnej klika „Dodaj jako węzeł" → luka staje się węzłem do dalszego opracowania.

**Efekty pracy**
`POST /map/gap-analysis` (my-work.routes.ts:4505, REAL LLM) → lista luk w panelu. Dodanie luki jako węzeł → `POST /map/sync`. Mapa wzbogacona o brakujące obszary. Reload → dodane węzły-luki przetrwają.

**Grafika**
Panel AI po prawej z listą luk (każda z opisem i przyciskiem „Dodaj"). Loader podczas analizy. Nowe węzły-luki wyróżnione (np. status pill / inny kolor) jako „do opracowania".

**Funkcjonalność**
`POST /map/gap-analysis` (REAL LLM, my-work.routes.ts:4505), panel wyników, dodanie węzła → `POST /map/sync`.

---

### MC-06-13 · AI Suggestions + Branch Summary — synteza gałęzi do akapitu · [AI] [REAL-AI]

**Co się dzieje**
Konsultant pisze raport i potrzebuje syntezy. Najpierw „AI Suggestions" (toolbar AI / `AIActionsPopover`) → `POST /map/ai-suggestions` → odpowiedź `topics`/`findings`/`next_steps`; klika jedną sugestię → dodaje się jako węzeł. Następnie zaznacza gałąź „Rekomendacje" i otwiera `BranchSummaryPanel` → „Podsumuj gałąź" → AI zwraca zwięzły akapit syntezujący całą gałąź (gotowy do wklejenia w raport). Weryfikuje w Network, że żądanie leci na backend (nie lokalna logika).

**Efekty pracy**
`POST /map/ai-suggestions` (my-work.routes.ts:4409, REAL LLM, generyczny prompt) → sugestie; akceptacja → `POST /map/sync`. Branch Summary → tekst syntezy gałęzi (artefakt tekstowy do raportu). Odnotuj: wszystkie panele AI z rodziny używają TEGO SAMEGO endpointu ai-suggestions + dorabiają semantykę po stronie klienta (wyniki mogą być semantycznie zmienne).

**Grafika**
Panel sugestii z listą `topics`/`findings`/`next_steps`. `BranchSummaryPanel.tsx` — panel z tekstem podsumowania i przyciskiem kopiuj. Loader podczas żądania.

**Funkcjonalność**
`POST /map/ai-suggestions` (REAL LLM, my-work.routes.ts:4409), `BranchSummaryPanel.tsx`, `getMyIdeaAISuggestions`. Sync przy akceptacji.

---

### MC-06-14 · Document-to-Map — wgranie raportu i ekstrakcja struktury · [AI / import] [REAL-AI]

**Co się dzieje**
Konsultant dostał od klienta 5-stronicowy dokument strategii i chce go zwizualizować jako mapę. Otwiera `DocumentToMap` → wkleja/wgrywa tekst → AI ekstrahuje strukturę (nagłówki → gałęzie, akapity → liście). Po wygenerowaniu przegląda mapę, koryguje hierarchię ręcznie (drag-reparent), usuwa szum. Weryfikuje w Network, który endpoint obsługuje (`/map/ai-suggestions` lub dedykowany — odnotować).

**Efekty pracy**
Tekst dokumentu → strukturalna mapa węzłów. Żądanie AI (REAL LLM) → węzły na kanwie → `POST /map/sync`. Reload → wyekstrahowana struktura przetrwa. Mapa staje się podstawą dalszej pracy (Expand, konwersja na inicjatywy).

**Grafika**
Modal `DocumentToMap.tsx` (7.6 KB) z polem tekstowym / dropzone, przyciskiem „Generuj mapę", loaderem. Wygenerowane węzły rozłożone auto-layoutem (tree). Hierarchia odzwierciedla strukturę dokumentu.

**Funkcjonalność**
`DocumentToMap.tsx` → AI suggestions endpoint (REAL LLM), auto-layout, `POST /map/sync`. Odnotuj faktyczny endpoint.

---

### MC-06-15 · Interview-to-Map — transkrypt wywiadu (M10) → mapa tematów · [AI / import] [REAL-AI]

**Co się dzieje**
Po serii wywiadów diagnostycznych (M10) konsultant chce zwizualizować powtarzające się tematy. Otwiera `InterviewToMap` → wybiera istniejący wywiad z M10 lub wkleja transkrypt → AI ekstrahuje tematy/wątki → węzły na mapie pogrupowane tematycznie. Konsultant scala duplikaty (drag-reparent), tagi nadaje gałęziom (np. „pilne", „ryzyko"), uruchamia auto-clustering (MC-06-16) by potwierdzić grupowanie.

**Efekty pracy**
Transkrypt → mapa tematów wywiadu. Żądanie AI (REAL LLM) → węzły → `POST /map/sync`. Powiązanie z wywiadem M10 (cross-module). Reload → mapa tematów przetrwa.

**Grafika**
Modal `InterviewToMap.tsx` (8 KB) z selektorem wywiadu / polem transkryptu, loaderem. Węzły-tematy pogrupowane, kolory gałęzi per temat.

**Funkcjonalność**
`InterviewToMap.tsx` → AI endpoint (REAL LLM), integracja z M10 (wywiady), `POST /map/sync`.

---

# D. AI Overlays — pseudo-AI

---

### MC-06-16 · Sentiment overlay + Auto-clustering na mapie głosów klienta · [Overlays] [PSEUDO-AI]

**Co się dzieje**
Konsultant ma mapę „Głos klienta" (VoC) z 25 cytatami z wywiadów. Włącza `AISentimentOverlay` — węzły dostają nakładki sentymentu (positive/negative/neutral). KRYTYCZNE: konsultant weryfikuje, że to heurystyka kliencka, NIE realny LLM (sentyment przypisywany pozycyjnie wg indeksu `confidence`, AISentimentOverlay.tsx:56-81 — semantycznie losowy). Następnie `AIAutoClustering` grupuje węzły w klastry (na bazie 10-znakowych substringów, AIAutoClustering.tsx:73-92). Sprawdza, czy UI uczciwie oznacza oba jako „heurystyka" / czy są za flagą — czy nie udają realnego AI.

**Efekty pracy**
Brak realnego żądania LLM (heurystyki klienckie). Overlay sentymentu i klastry to warstwa wizualna — NIE muszą trafiać do `/map/sync` (czysto prezentacyjne). Wynik testu: weryfikacja braku crash + uczciwości etykiet (overlay nie ma udawać AI). Decyzja D-02/DP-5: etykieta „heurystyki" lub ukrycie za flagą.

**Grafika**
Sentiment: węzły z kolorowymi nakładkami (zielony/czerwony/szary) + ikona emocji. `ClusterBubbles.tsx` — półprzezroczyste bąble grupujące węzły w klastry. Banner/badge „heurystyka" (do weryfikacji obecności).

**Funkcjonalność**
`AISentimentOverlay.tsx` (heurystyka pozycyjna, :56-81), `AIAutoClustering.tsx` (substring clustering, :73-92), `ClusterBubbles.tsx`. PSEUDO-AI — brak żądania LLM. Weryfikacja etykiet.

---

### MC-06-17 · Dependency Detector + Priority Recommender — czytanie zależności · [Overlays] [PSEUDO-AI]

**Co się dzieje**
Konsultant ma mapę inicjatyw i chce zrozumieć zależności oraz priorytety. Otwiera `AIDependencyDetector` — narzędzie sugeruje krawędzie zależności między węzłami. Potem `AIPriorityRecommender` — ranking węzłów wg „priorytetu". KRYTYCZNE: weryfikuje, że oba używają generycznego prompta `getMyIdeaAISuggestions` (lub heurystyki) + klienckiego mapowania, NIE dedykowanych endpointów — w Network leci `/map/ai-suggestions` (nie dedykowany). Odnotowuje, że wyniki mogą być semantycznie nieadekwatne. Sprawdza brak crash.

**Efekty pracy**
Żądanie do `/map/ai-suggestions` (wspólny endpoint) + kliencka semantyka. Sugerowane zależności → opcjonalnie krawędzie (jeśli zaakceptowane → `POST /map/sync`). Priority ranking → wizualizacja (np. pole `priority` w node modelu, mindMapNodeModel.ts:23). Test: brak crash + Network potwierdza wspólny endpoint.

**Grafika**
DependencyDetector: linie/krawędzie sugerowane (przerywane, do akceptacji). PriorityRecommender: węzły z badge priorytetu / sortowanie / kolor wg rangi. Panele AI po prawej.

**Funkcjonalność**
`AIDependencyDetector.tsx`, `AIPriorityRecommender.tsx`, wspólny `getMyIdeaAISuggestions` → `/map/ai-suggestions`. `priority` w `mindMapNodeModel.ts`. PSEUDO/generic-AI. Weryfikacja endpointu.

---

### MC-06-18 · What-If Scenarios + Competitive Landscape + Blind Spots · [Overlays] [PSEUDO-AI]

**Co się dzieje**
Konsultant testuje 3 panele „strategiczne" na mapie wejścia na nowy rynek. `AIWhatIfScenarios` — generuje warianty scenariuszy. `AICompetitiveLandscape` — mapuje konkurencję. `AIBlindSpotsDetector` — wskazuje pominięte obszary. Dla każdego: otwiera panel, sprawdza brak crash, weryfikuje w Network że żądanie idzie do wspólnego `/map/ai-suggestions` (nie dedykowanego endpointu), odnotowuje że semantyka dorabiana po stronie klienta i wyniki mogą być nieadekwatne.

**Efekty pracy**
3 panele → żądania do wspólnego `/map/ai-suggestions` + kliencka interpretacja. Ewentualne dodanie węzłów scenariuszowych → `POST /map/sync`. Test: brak crash, potwierdzenie wspólnego endpointu, uczciwość prezentacji (nie udają dedykowanej analizy).

**Grafika**
WhatIfScenarios: lista wariantów scenariuszy w panelu. CompetitiveLandscape: macierz/lista konkurentów. BlindSpots: lista pominiętych obszarów z highlightem. Panele AI prawe, loadery.

**Funkcjonalność**
`AIWhatIfScenarios.tsx`, `AICompetitiveLandscape.tsx` (10 KB), `AIBlindSpotsDetector.tsx`, wszystkie → `/map/ai-suggestions`. PSEUDO/generic. Weryfikacja endpointu + brak crash.

---

### MC-06-19 · Map Health Score + Funnel Analytics + Branch Balancer — audyt jakości mapy · [Overlays / analityka] [PSEUDO-AI]

**Co się dzieje**
Przed oddaniem mapy konsultant uruchamia narzędzia jakości. `MapHealthScore` → score 0-100 na bazie struktury (głębokość, balans, sieroty). Sprawdza dla pustej mapy (niski score) vs mapy 30-węzłowej (wysoki). `IdeaFunnelAnalytics` → statystyki ile węzłów na każdym poziomie lejka (sprawdza, czy dane dynamiczne z mapy, nie hardcoded). `AIBranchBalancer` → wykrywa nierównomierne gałęzie (jedna przeładowana, inne puste) i sugeruje rebalans. `AIGovernancePanel` → przegląd governance.

**Efekty pracy**
Health score wyliczany klienckо ze struktury (`nodes`, `edges`). Funnel — statystyki dynamiczne z mapy. Branch balancer — sugestie rebalansu (ewentualny reparent → `POST /map/sync`). Test: poprawność liczb dla różnych map, brak crash, dynamiczność danych.

**Grafika**
`MapHealthScore.tsx` (11 KB) — gauge/score 0-100 z breakdownem kryteriów. `IdeaFunnelAnalytics.tsx` (8 KB) — wykres lejka / słupki per poziom. `AIBranchBalancer.tsx` — wizualizacja balansu gałęzi. `AIGovernancePanel.tsx` (29 KB) — rozbudowany panel governance.

**Funkcjonalność**
`MapHealthScore.tsx` (`showHealthScore`, `<MapHealthScore nodes edges visible>`), `IdeaFunnelAnalytics.tsx`, `AIBranchBalancer.tsx`, `AIGovernancePanel.tsx`. Kliencka analityka. Weryfikacja dynamiczności.

---

# E. Eksport, konwersja, embed

---

### MC-06-20 · Eksport multi-format — PNG / SVG / Markdown / JSON / CSV · [Eksport] [EXPORT-ARTIFACT]

**Co się dzieje**
Konsultant kończy mapę diagnozy i potrzebuje jej w wielu formatach do różnych odbiorców. Eksportuje kolejno: **Markdown** (hierarchia jako lista zagnieżdżona `#`/`-` — do dokumentacji), **JSON** (pełny graf węzły+krawędzie+metadane — do backupu/re-importu), **CSV** (id, label, parent — do Excela), **SVG** (wektor do prezentacji), **PNG** (raster do slajdu). Dla każdego pliku otwiera/weryfikuje zawartość: wszystkie węzły obecne, struktura poprawna, SVG renderuje się w przeglądarce, PNG ma sensowną rozdzielczość.

**Efekty pracy**
5 pobranych plików (Blob): `.md`, `.json`, `.csv`, `.svg`, `.png`. Markdown = pełna hierarchia, JSON = kompletny graf (re-importowalny), CSV = wiersze z parent, SVG = poprawny wektor, PNG = raster kanwy. Eksport NIE modyfikuje mapy (read-only artefakty).

**Grafika**
Menu eksportu z listą formatów. Toast sukcesu po pobraniu. Pliki pobierane przez przeglądarkę (download). SVG/PNG renderują cały widoczny graf z kolorami węzłów i krawędziami.

**Funkcjonalność**
`useMapExport.ts` (Markdown/JSON/CSV/SVG/PNG, Blob download), `useMapExportPdf.ts`. `[EXPORT-ARTIFACT]` — weryfikacja każdego pliku.

---

### MC-06-21 · Eksport diagram-code (Mermaid/PlantUML) + PDF (print) · [Eksport] [EXPORT-ARTIFACT]

**Co się dzieje**
Konsultant chce wkleić mapę do dokumentacji technicznej i do PDF. Otwiera `ExportDiagramCode` → „Mermaid" → kopiuje wygenerowany kod (`graph TD` / `flowchart`), wkleja na mermaid.live i weryfikuje poprawny render. Powtarza dla „PlantUML". Następnie eksport PDF (`useMapExportPdf.ts`) — który jest PNG→print: otwiera okno drukowania z mapą jako obrazem, sprawdza układ strony.

**Efekty pracy**
Kod Mermaid + PlantUML (tekstowy artefakt do schowka / pliku) — odzwierciedlający węzły i krawędzie. PDF przez okno print (PNG osadzony). Mermaid renderuje się na zewnętrznym viewerze (dowód poprawności składni).

**Grafika**
`ExportDiagramCode.tsx` (6 KB) — modal z polem kodu (Mermaid/PlantUML) i przyciskiem kopiuj. Okno drukowania przeglądarki z podglądem mapy. Toast.

**Funkcjonalność**
`ExportDiagramCode.tsx` (Mermaid + PlantUML generator), `useMapExportPdf.ts` (PNG→print, :14-25). `[EXPORT-ARTIFACT]`.

---

### MC-06-22 · Eksport PowerPoint (HTML) + Embed-in-Reports snippet · [Eksport] [EXPORT-ARTIFACT]

**Co się dzieje**
Konsultant testuje dwie „integracyjne" ścieżki eksportu i weryfikuje uczciwość etykiet. „Export PowerPoint" → pobiera plik `*-presentation.html` (NIE .pptx — known mock, ExportPowerPoint.tsx:91-95). KRYTYCZNE: sprawdza etykietę przycisku — jeśli nadal mówi „PowerPoint" zamiast „HTML" → FAIL (misleading). „Embed in Reports" → kopiuje snippet HTML do schowka; sprawdza, że snippet jest sensowny (nie pusty), odnotowuje brak realnego pipeline'u osadzania (statyczny HTML — known-mock).

**Efekty pracy**
Plik `.html` (prezentacja, NIE .pptx) + snippet HTML w schowku. Toast sukcesu. Wynik testu: ocena uczciwości etykiety „PowerPoint" (→ FAIL jeśli myli) i sensowności snippetu embed. Known-mock odnotowane, NIE jako blocker.

**Grafika**
Przycisk „Export PowerPoint" (sprawdź label). Modal/akcja Embed-in-Reports z polem snippetu. Toast po pobraniu/kopiowaniu.

**Funkcjonalność**
`ExportPowerPoint.tsx` (HTML, :91-95, `[KNOWN-MOCK]`), `EmbedInReports.tsx` (snippet do schowka, `[KNOWN-MOCK]`). Weryfikacja etykiet + treści.

---

### MC-06-23 · Batch Convert wielu węzłów → Inicjatywy + Decyzje (cross-module) · [Konwersja]

**Co się dzieje**
Po warsztacie konsultant ma mapę z 12 rekomendacjami i chce część przekuć w inicjatywy (M13), część w decyzje (M03). Najpierw pojedynczo: prawoklik na węźle → „Konwertuj na Inicjatywę" (`ctx_convert_initiative`, `convertBranch('initiative', id)`) — weryfikuje w Network żądanie do API inicjatyw i nawigację/toast. Potem masowo: zaznacza 6 węzłów → toolbar → „Batch Convert" → `BatchConvertModal` z listą eligible nodes (bez `converted`, bez `branch-*`/`root`). Toggle All, wybiera target `initiative` dla 4 i `decision` dla 2, klika „Konwertuj". Testuje edge: locked mapa → przycisk disabled.

**Efekty pracy**
Utworzone inicjatywy (M13) i decyzje (M03) z tytułami z węzłów, powiązane `ideaId` z oryginalną ideą. Status węzłów → `converted`. Żądania do API inicjatyw/decyzji w Network. Po przejściu do `/initiatives` i `/my-work/decisions` rekordy istnieją. Konwersja gałęzi (`ctx_subtree_convert_initiative`) wiąże węzły-dzieci jako podzadania/sekcje.

**Grafika**
`BatchConvertModal.tsx` (6 KB) — lista eligible nodes z checkboxami, Toggle All, selektor target (Inicjatywa/Decyzja), przycisk Konwertuj. Status pill `converted` na skonwertowanych węzłach. Toast sukcesu z licznikiem.

**Funkcjonalność**
`NodeContextMenu.tsx` (`ctx_convert_initiative`, `ctx_subtree_convert_initiative`), `convertBranch`, `BatchConvertModal.tsx` (`onConvert(nodeIds, target)`), API inicjatyw (M13) + decyzji (M03). Cross-module.

---

### MC-06-24 · Konwersja gałęzi → Prezentacja (Presentation Studio M19) · [Konwersja / cross-module]

**Co się dzieje**
Konsultant chce z gałęzi „Rekomendacje strategiczne" zrobić prezentację dla zarządu. Wybiera gałąź → akcja `convert_presentation` (IdeaRecommendationMap.tsx:4378) → otwiera flow Presentation Studio (M19/M17). Weryfikuje, że nawigacja prowadzi do właściwego modułu i że treść węzłów (każdy węzeł → slajd/sekcja) trafia do prezentacji.

**Efekty pracy**
Nawigacja do Presentation Studio (M19) z węzłami gałęzi jako slajdami/sekcjami. Treść węzłów (label + notatki) mapowana na zawartość slajdów. Cross-module powiązanie z oryginalną mapą.

**Grafika**
Akcja w menu/toolbar „Konwertuj na prezentację". Przejście (nawigacja) do edytora prezentacji M19 z prefill slajdów. Loader podczas przygotowania.

**Funkcjonalność**
`convert_presentation` (IdeaRecommendationMap.tsx:4378) → Presentation Studio M19 / Outputs M17. Cross-module nawigacja.

---

# F. Tryby widoku i duże mapy

---

### MC-06-25 · Presentation Mode + Timeline View + Time Heatmap + 3D View · [Tryby widoku]

**Co się dzieje**
Konsultant prezentuje mapę 25-węzłową na różne sposoby. **Presentation Mode** — pełnoekranowy slideshow, nawiguje strzałkami węzeł po węźle, `Esc` wychodzi (sprawdza brak crash >20 węzłów). **Timeline View** — węzły z datami na osi czasu (roadmapa). **Time Heatmap** — węzły kolorowane wg aktywności/czasu (które obszary „gorące"). **3D View** — pseudo-3D na CSS perspective (NIE WebGL — known mock, odnotować). Każdy tryb otwiera i zamyka (`Esc`/X), weryfikuje brak błędów renderu.

**Efekty pracy**
4 tryby prezentacji tej samej mapy (read-only, nie modyfikują grafu). Presentation = slideshow, Timeline = oś czasu, Heatmap = kolor wg aktywności, 3D = pseudo-przestrzeń CSS. Brak crash, czyste wejście/wyjście z każdego.

**Grafika**
`PresentationMode.tsx` (13 KB) — fullscreen slideshow, nawigacja strzałkami. `TimelineView.tsx` — pozioma oś z węzłami wg dat. `TimeHeatmap.tsx` (6 KB) — overlay kolor wg aktywności. `MindMap3DView.tsx` (8 KB) — CSS perspective pseudo-3D (`[KNOWN-MOCK]`). Toggle states: `showPresentation`/`showTimeline`/`showTimeHeatmap`/`showMindMap3D`.

**Funkcjonalność**
`PresentationMode.tsx`, `TimelineView.tsx`, `TimeHeatmap.tsx`, `MindMap3DView.tsx` (pseudo-3D). Read-only tryby. Esc/X exit.

---

### MC-06-26 · Snapshoty historii — checkpoint → edycja → przywrócenie · [Snapshoty] [DB]

**Co się dzieje**
Konsultant przed eksperymentalną reorganizacją robi checkpoint. `Cmd+Shift+H` / „Utwórz snapshot" → `SnapshotHistory` → etykieta „v1 — przed restrukturyzacją" → Zapisz. Wykonuje agresywne zmiany (usuwa 5 węzłów, reorganizuje gałęzie). Robi drugi snapshot „v2 — po restrukturyzacji". Klient woli wariant pierwszy — konsultant otwiera listę snapshotów (posortowana wg daty, każdy z liczbą węzłów/krawędzi), klika „Przywróć" na v1 → mapa wraca do stanu sprzed zmian. Usuwa testowy snapshot (`DELETE`). Testuje, że cudzego snapshotu nie da się usunąć (403 / brak opcji).

**Efekty pracy**
2 wiersze w `my_idea_map_snapshots` (`label`, `node_count`, `edge_count`, `data_json`) przez `POST /map/snapshots` (my-work.routes.ts:4629, 201). Przywrócenie → `POST /map/sync` z danymi snapshotu (mapa = stan v1). `DELETE /map/snapshots/:id` usuwa wiersz. Org-scope: cudzy snapshot chroniony. Reload → przywrócony stan przetrwa.

**Grafika**
`SnapshotHistory.tsx` (19 KB) — panel/drawer z listą snapshotów (etykieta, data, N węzłów/krawędzi), przyciski Przywróć/Usuń. Pole etykiety przy tworzeniu. Toast po zapisie/przywróceniu.

**Funkcjonalność**
`SnapshotHistory.tsx`, `Cmd+Shift+H`, `POST/GET/DELETE /map/snapshots` (my-work.routes.ts:4629-4761), tabela `my_idea_map_snapshots`. `[DB]` — migracja wymagana (brak → 503).

---

### MC-06-27 · Duża mapa 200+ węzłów — simplified mode + wydajność + minimap · [Duże mapy] [MANUAL]

**Co się dzieje**
Konsultant importuje OPML z dużej mapy korporacyjnej (>200 węzłów) lub rozbudowuje istniejącą do progu. Po przekroczeniu 150 węzłów aktywuje się `simplifiedMode` (etap 1; progi 150/300/500 — LargeMapOptimizer.tsx:11-40). Weryfikuje: węzły w uproszczonej formie (mniejsze, bez dekoracji), uproszczone krawędzie (`reactFlowEdgeTypes = {}` w simplified), banner/toast o trybie. Testuje wydajność: drag&drop węzła, zoom in/out, pan — sprawdza płynność (brak freeze). Używa minimap do nawigacji po dużej mapie. Odnotowuje brak wirtualizacji powyżej ~300 węzłów (P2).

**Efekty pracy**
`simplifiedMode = true` po przekroczeniu progu — automatyczne uproszczenie renderu. Mapa nadal edytowalna, `POST /map/sync` działa. Test wydajności: subiektywna płynność interakcji. Reload dużej mapy → odtworzenie z serwera.

**Grafika**
Simplified mode: węzły małe, bez floating dekoracji, krawędzie podstawowe. Banner/toast „tryb uproszczony — N węzłów". Minimap aktywna pomocna przy nawigacji. Stopniowa degradacja UI na progach 150/300/500.

**Funkcjonalność**
`LargeMapOptimizer.tsx` (progi 150/300/500, :11-40), `simplifiedMode`, uproszczone `reactFlowEdgeTypes`, minimap. `[MANUAL]` wydajność. P2: brak occlusion culling >300.

---

# G. Współpraca, persystencja, paleta

---

### MC-06-28 · Collab realtime — 2 konsultantów, live cursory, graph-patch, node-lock · [Collab] [MULTIPLAYER]

**Co się dzieje**
Dwóch konsultantów tej samej org (User A, User B) otwiera tę samą mapę warsztatową. WS upgrade `/ws/collab/:ideaId` dla obu → dołączają do rooma; awatary widoczne w presence strip (`CollaborationOverlay`). User A porusza myszą → kursor A widoczny u B i odwrotnie (live cursors). User A dodaje węzeł → przez `graph_patch` broadcast → User B widzi nowy węzeł BEZ reloadu. User A otwiera drawer węzła X (edit) → węzeł X zablokowany (`remoteLockedNodeIds`); User B próbuje edytować X → komunikat „node locked by another collaborator"; A zamyka drawer → lock zwolniony, B może edytować. Symuluje krótką utratę WS (3s) → auto-reconnect, awatary wracają.

**Efekty pracy**
Współdzielona sesja: presence (awatary), live cursory, `graph_patch` operations broadcast przez gateway, node-lock zapobiega kolizji edycji. Zmiany A widoczne u B na żywo. Reconnect + heartbeat odtwarza presence. Persystencja przez wspólny runtime + `POST /map/sync`.

**Grafika**
`CollaborationOverlay.tsx` (18 KB) — presence strip z awatarami, kolorowe kursory innych userów z etykietą nazwy. Zablokowany węzeł: wizualny lock badge / przyciemnienie + tooltip. Toast reconnect.

**Funkcjonalność**
`CollaborationOverlay.tsx` → WS `/ws/collab/:ideaId` (`ideaCollabWs.gateway.ts`), `graph_patch` (`collabSendRef`, event `idea-collab-graph-patch`, IdeaRecommendationMap.tsx:~2810), `remoteLockedNodeIds`, reconnect/heartbeat. `[MULTIPLAYER]`.

---

### MC-06-29 · Cross-org reject + conflict 409 rehydracja + offline draft · [Persystencja / bezpieczeństwo] [MULTIPLAYER]

**Co się dzieje**
Test odporności persystencji i bezpieczeństwa. **Cross-org reject:** User B z org Y próbuje otworzyć mapę org X → gateway DB-check (`SELECT id FROM my_ideas WHERE id=? AND organization_id=?`, ideaCollabWs.gateway.ts:237) → 403 + `socket.destroy()` PRZED `room.set` → B nie dołącza, nie widzi danych X (log 403 w serwerze). **Conflict 409:** dwa okna tej samej mapy; okno A zapisuje (version n→n+1); okno B zapisuje ze STARYM `baseVersion=n` → 409 → toast konfliktu + `externalRuntime.refresh()` → B rehydruje z serwera (baseVersion→n+1), następny zapis B → 200. KRYTYCZNE: brak silent overwrite (mindmap jako jedyne narzędzie ma działający refresh). **Offline draft:** DevTools→Offline → `PersistenceStatus='offline'` → dodaje węzły → draft do localStorage → przywraca sieć → auto-flush `POST /map/sync`; draft przeżywa reload.

**Efekty pracy**
Cross-org: 403 + destroy, zero wycieku danych org X. 409: rehydracja bez silent overwrite, `baseVersion` aktualizowany, kolejny zapis czysty. Offline: draft w localStorage, auto-flush przy online (visibilitychange/online event), przeżywa reload. Stany persystencji: online/no_route/missing_table/offline z komunikatem UI.

**Grafika**
Toast konfliktu 409. `PersistenceStatus` badge (online/offline/error). Rehydracja — mapa odświeża się z serwera. Offline banner/badge.

**Funkcjonalność**
`ideaCollabWs.gateway.ts:237-242` (cross-org 403+destroy), `useIdeaMapSync.ts` (`baseVersion`, 409, `externalRuntime.refresh()`, draft localStorage, online/visibilitychange flush), `PersistenceStatus`. `POST /map/sync` (my-work.routes.ts:3994, empty-reset guard). `[MULTIPLAYER]` `[DB]`.

---

### MC-06-30 · Komentarze/wątki + tagi + evidence/artifact/person + sub-mapy + Activity Feed · [Współpraca / metadane] [DB]

**Co się dzieje**
Konsultant wzbogaca mapę o pełną warstwę metadanych i współpracy. Prawoklik na węźle → „Komentarze" (`ctx_comments`) → `NodeCommentThread` → wpisuje komentarz z @wzmianką dla kolegi → wysyła. Otwiera drawer węzła (`NodeDetailDrawer`) i dodaje: **tagi** (np. „pilne", „ryzyko" — kolorowane wg `tagColorMapping.ts`), **evidence** (`AddEvidenceModal` — źródło/dowód), **artifact** (`AttachArtifactModal` — załącznik), **person** (`AssignPersonModal` — przypisanie właściciela). Dla rozbudowanej gałęzi tworzy **sub-mapę** (drill-down) i nawiguje breadcrumbem (`SubMapBreadcrumb`). Na koniec otwiera `ActivityFeed` i weryfikuje, że wszystkie akcje (dodanie węzła, komentarz, snapshot) są zalogowane z autorem i datą.

**Efekty pracy**
Komentarz w `idea_node_comments` przez `POST /map/nodes/:nodeId/comments` (my-work.routes.ts:4776, 201, z `text`/`user_name`/`mentions`). Tagi/evidence/artifact/person zapisane w metadanych węzła → `POST /map/sync`. Sub-mapa jako drill-down z breadcrumb. Activity Feed z `GET /my-ideas/:id/activity` (my-work.routes.ts:4917) → `my_idea_activity`. Reload → komentarze, tagi, metadane, sub-mapy przetrwają. Org-scope: cudzy komentarz chroniony (403/brak opcji usunięcia).

**Grafika**
`NodeCommentThread.tsx` (9 KB) — wątek z autorem/datą/treścią, pole z @mentions. Tagi kolorowane (`tagColorMapping.ts`, `TAG_COLOR_MAP`). Modale: `AddEvidenceModal`/`AttachArtifactModal`/`AssignPersonModal`. `SubMapBreadcrumb.tsx` — ścieżka drill-down. `ActivityFeed.tsx` (9 KB) — lista zdarzeń z autorem/datą/opisem. `NodeDetailDrawer.tsx` (42 KB) z sekcjami metadanych.

**Funkcjonalność**
`NodeCommentThread.tsx` + `POST/GET/DELETE /map/nodes/:nodeId/comments` (`idea_node_comments`), `tagColorMapping.ts`, `AddEvidenceModal.tsx`/`AttachArtifactModal.tsx`/`AssignPersonModal.tsx`, `SubMapBreadcrumb.tsx` (drill-down), `ActivityFeed.tsx` + `GET /activity` (`my_idea_activity`, `pushActivity`). `NodeDetailDrawer.tsx`. `[DB]` — migracje wymagane.

---

## Macierz pokrycia funkcji → case'y

| Obszar funkcji | Case'y |
|---|---|
| Tworzenie węzłów (Tab/Enter/toolbar/Cmd+K/context/voice) | MC-06-01, 02, 05 |
| Edycja inline/drawer/popovers + kolory/typy | MC-06-01, 02, 30 |
| Krawędzie/relacje/tryb connect/EdgeContextMenu | MC-06-03 |
| Reorganizacja (Alt+arrows, drag-reparent, copy/paste) | MC-06-06 |
| Layouty tree/radial/force + auto-layout | MC-06-07 |
| Structure layouts (fishbone/org-chart/timeline/tree-right) | MC-06-08 |
| Fold levels + collapse + nawigacja | MC-06-09 |
| Manual drag + viewport persistence + zoom + minimap | MC-06-10 |
| AI Expand (REAL) | MC-06-11 |
| Gap Analysis (REAL) | MC-06-12 |
| AI Suggestions + Branch Summary (REAL) | MC-06-13 |
| Document-to-Map / Interview-to-Map (REAL) | MC-06-14, 15 |
| Import FreeMind/XMind/OPML | MC-06-04 |
| Pseudo-AI overlays (sentiment/clustering/dependency/priority/what-if/competitive/blind-spots/balancer/governance/funnel/health) | MC-06-16, 17, 18, 19 |
| Eksport PNG/SVG/MD/JSON/CSV/Mermaid/PlantUML/PDF/PPT-HTML/embed | MC-06-20, 21, 22 |
| Konwersja → Inicjatywy/Decyzje/Prezentacja (+ Batch) | MC-06-23, 24 |
| Tryby widoku (Presentation/Timeline/Heatmap/3D) | MC-06-25 |
| Snapshoty/historia | MC-06-26 |
| Duże mapy / simplified mode | MC-06-27 |
| Collab realtime (cursory/graph-patch/node-lock) | MC-06-28 |
| Cross-org reject + 409 + offline draft | MC-06-29 |
| Komentarze/tagi/evidence/artifact/person/sub-mapy/Activity | MC-06-30 |

---

## Uwagi metodyczne

- **E2E jako wymóg:** każdy case z modyfikacją grafu musi pokazać `POST /map/sync` z `baseVersion` w Network + przeżyć reload. UI-zmiana bez żądania = FAIL.
- **REAL-AI vs PSEUDO-AI:** §C (11-15) to żywy LLM (`/expand`, `/ai-suggestions`, `/gap-analysis`); §D (16-19) to klienckie heurystyki — testy weryfikują brak crash + UCZCIWOŚĆ etykiet (overlay nie ma udawać AI; zob. AISentimentOverlay.tsx:56-81, AIAutoClustering.tsx:73-92).
- **Known-mocks do odnotowania (NIE jako FAIL):** Export PowerPoint = HTML (ExportPowerPoint.tsx:91-95), Embed-in-Reports = statyczny snippet, 3D View = CSS perspective (nie WebGL), WebhookSettings = localStorage, Teresa sidekick = event w próżnię.
- **Bezpieczeństwo (krytyczne):** MC-06-29 cross-org reject (ideaCollabWs.gateway.ts:237) musi dać 403 + destroy + zero wycieku danych.
