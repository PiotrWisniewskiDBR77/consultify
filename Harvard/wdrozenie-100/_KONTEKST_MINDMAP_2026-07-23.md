# Audyt menu kontekstowych — Mapa myśli (Mind Map), narzędzie IDEE, Consultify

Data: 2026-07-23. Zakres: WYŁĄCZNIE menu kontekstowe/pasek zaznaczenia w widoku **Mapa myśli** narzędzia Idee. Dokument pisany tak, by zewnętrzne AI bez znajomości projektu Consultify zrozumiało strukturę i stan każdej pozycji.

## Kontekst — co to jest

**Mapa myśli (Mind Map)** to jeden z kilku "widoków-narzędzi" osadzonych w rekordzie **Idea** modułu *My Work → Idee* aplikacji Consultify (AI-native platforma do realizacji doradztwa). Płótno zbudowane jest na bibliotece **React Flow**: węzły (nodes) = tematy/pomysły/gałęzie, krawędzie (edges) = powiązania strukturalne lub relacyjne. Ten sam rekord Idea ma też siostrzane widoki — Tablica (Whiteboard), Przepływ (Process Flow), Tabela — przełączane ikonami w lewym pionowym pasku płótna; nie są one przedmiotem tego audytu.

Trzy udokumentowane tu powierzchnie interakcji:
1. Prawy klik na **pustym płótnie** → `PaneContextMenu`.
2. Prawy klik na **elemencie** → `NodeContextMenu` (węzeł) albo `EdgeContextMenu` (krawędź).
3. Pływający poziomy pasek (`FloatingNodeToolbar`) pojawiający się po **zaznaczeniu węzła** kliknięciem — z przyciskiem „⋮" na końcu.

## Metoda i co faktycznie zweryfikowano

- **Kod (grep-first, źródło prawdy):** `src/components/MyWork/mindmap/PaneContextMenu.tsx`, `NodeContextMenu.tsx`, `EdgeContextMenu.tsx`, `ContextMenuPortal.tsx`, `contextMenuTypes.ts`, `FloatingNodeToolbar.tsx`, `floating-toolbar/FloatingAIPopover.tsx`; handlery w `src/components/MyWork/IdeaRecommendationMap.tsx` (`handlePaneContextAction`, `handleContextAction`, `handleEdgeContextAction`) oraz w `src/components/MyWork/mindmap/useMindMapQuickActions.ts` i `useMindMapNodes.tsx`; tłumaczenia PL w `public/locales/pl/translation.json` (klucze `myWorkMindmap.*`, `ideas.mindmap.*`).
- **Żywy podgląd:** `http://localhost:3100/my-work/ideas/8d97381d-5837-425a-a0d8-30d43c89f247/workspace/mindmap`. **Menu tła (sekcja 1) potwierdzone wzrokiem** — zrzut ekranu pokazał treść 1:1 zgodną z kodem, po polsku (patrz zrzut z prawym klikiem na pustym obszarze: „Dodaj temat (do korzenia)", „Kopiuj węzły" itd.).
- **Menu węzła, menu krawędzi i pasek zaznaczenia (sekcje 2 i 3) NIE zostały potwierdzone wzrokiem.** W trakcie sesji obiekt testowy samoistnie zmieniał aktywny widok (Mapa myśli → Tablica → Tabela) i układ węzłów **bez żadnej akcji z tej przeglądarki** (zdarzało się to nawet między dwoma kolejnymi odczytami strony, bez kliknięcia) — silny sygnał, że inny równoległy proces/agent operuje w czasie rzeczywistym na tym samym rekordzie Idea (współdzielony `origin/demo`-podobny fixture, kolaboracja live). Z uwagi na tę interferencję dalsze próby precyzyjnego prawego kliku na małych węzłach zostały przerwane, by nie pogłębiać zamieszania na współdzielonym obiekcie. Treść sekcji 2 i 3 pochodzi wyłącznie z analizy kodu — oznaczona poniżej jako **„nie zweryfikowane wzrokiem"**.

---

## 1. Prawy klik na pustym płótnie — `PaneContextMenu`

Plik: `PaneContextMenu.tsx` → akcje obsługiwane w `handlePaneContextAction` (`IdeaRecommendationMap.tsx`). **Potwierdzone wzrokiem** (zrzut 2026-07-23, treść identyczna).

| Pozycja (PL) | Skrót | Typ | Co robi | Stan |
|---|---|---|---|---|
| Dodaj temat (do korzenia) | N | wspólne z innymi narzędziami (wzorzec „dodaj element") | Tworzy nowy węzeł typu `idea` w miejscu kliknięcia i łączy go krawędzią z węzłem `root` | **Działa**. Disabled gdy mapa zablokowana (`isLocked`) |
| Kopiuj węzły | ⌘C | wspólne | `copySelected()` — kopiuje zaznaczenie do schowka wewnętrznego | **Działa**. Disabled gdy brak zaznaczenia |
| Wytnij węzły | ⌘X | wspólne | `cutSelected()` | **Działa**. Disabled gdy `isLocked` lub brak zaznaczenia |
| Wklej węzły | ⌘V | wspólne | `pasteNodes()` w pozycji kliknięcia (współrzędne canvas) | **Działa**. Disabled gdy `isLocked` lub `!canPaste` |
| Zaznacz wszystko | ⌘A | wspólne | Ustawia `selected:true` na wszystkich węzłach | **Działa** |
| Dopasuj widok | ⌘0 | wspólne (spotykane też w innych canvasach) | `fitView({padding:0.3})` | **Działa** |
| Automatyczny układ | ⌘L | specyficzne dla Mapy myśli | Przelicza pozycje węzłów funkcją `autoLayout()`, potem `fitView` | **Działa** |
| Auto-grupowanie | — | specyficzne | Dispatch `idea-workspace-quick-action` → `mm_auto_cluster` (klaster wg treści) | **Działa** (o ile listener zamontowany — patrz uwagi) |
| Zwiń wszystko | Alt+0 | specyficzne (struktura drzewa) | `setFoldLevel(0)` | **Działa** |
| Pokaż poziom 1 | Alt+1 | specyficzne | `setFoldLevel(1)` | **Działa** |
| Pokaż poziom 2 | Alt+2 | specyficzne | `setFoldLevel(2)` | **Działa** |
| Rozwiń wszystko | Alt+9 | specyficzne | `setFoldLevel(Infinity)` | **Działa** |
| AI: Zasugeruj węzły | — | specyficzne (AI) | `handleAIExpand()` bez id węzła (rozwija od aktualnego kontekstu/mapy) | **Działa**. Disabled gdy `isLocked` |

Uwaga: kod deklaruje też akcje `pane_add_topic`, `pane_undo`, `pane_redo`, `pane_center_root`, `pane_zoom_in`, `pane_zoom_out` w `handlePaneContextAction`, ale **żadna z nich nie ma odpowiadającej pozycji w `PaneContextMenu.tsx`** — to handlery przygotowane pod przyszłe/alternatywne wywołania (np. skróty klawiszowe), nie pod tę listę menu.

---

## 2. Prawy klik na elemencie

### 2a. Węzeł — `NodeContextMenu` (nie zweryfikowane wzrokiem)

Plik: `NodeContextMenu.tsx` → akcje w `handleContextAction` (`IdeaRecommendationMap.tsx`). Menu grupowane; ponieważ liczba grup (6–7) jest zawsze > 5, kod **zawsze** renderuje wariant z pod-menu (flyout) — grupy *Edycja* i *Struktura* płasko, grupy *AI / Konwersja / (Konwertuj gałąź) / Wygląd i dane* jako rozwijane w prawo pozycje, *Usuń* zawsze na dole. Wariant „płaski" (bez flyoutów) jest w kodzie martwy — nie da się go zobaczyć przy obecnej liczbie grup.

`isProtected` = `nodeId === 'root'` lub `nodeId` zaczyna się od `branch-` → blokuje edycję/usuwanie/duplikowanie węzłów-korzeni i węzłów-gałęzi.

**Grupa Edycja**

| Pozycja (PL) | Skrót | Co robi | Stan |
|---|---|---|---|
| Edytuj | F2 | `startEditingSelected()` | Działa. Disabled gdy `isProtected` |
| Otwórz szczegóły | — | Otwiera `NodeDetailDrawer` (tylko gdy `nodeType==='idea'`) | Działa dla typu `idea`; dla innych typów klik nic nie robi mimo aktywnej pozycji |
| Dodaj gałąź | Tab | `addChildNode()` | Działa. Disabled gdy `isLocked` |
| Dodaj sąsiada | Enter | `addSiblingNode()` | Działa. Disabled gdy `isLocked` lub `isProtected` |
| Duplikuj | ⌘D | `duplicateSelected()` | Działa. Disabled gdy `isLocked` lub `isProtected` |
| Kopiuj | ⌘C | `copySelected()` | Działa |
| Wytnij | ⌘X | `cutSelected()` | Działa. Disabled gdy `isLocked`/`isProtected` |
| Wklej | ⌘V | `pasteNodes()` | Działa. Disabled gdy `isLocked` lub `!canPasteNodes` |

**Grupa Struktura**

| Pozycja (PL) | Skrót | Co robi | Stan |
|---|---|---|---|
| Zwiń / rozwiń | Space | `toggleCollapse(nodeId)` | Działa |
| Skup poddrzewo | — | `handleDrillDown(nodeId)` | Działa |
| Drill down | — | `handleDrillDown(nodeId)` — **identyczny handler co „Skup poddrzewo"** | Działa, ale dubluje funkcję powyżej |
| Połącz z zaznaczonym | — | Tworzy nową krawędź typu `labeled`/`relation` między węzłem a wcześniej zaznaczonym | Działa, ale wymaga wcześniejszego drugiego zaznaczenia — bez niego pokazuje toast „wybierz inny węzeł" |
| Odłącz gałąź | — | `detachBranch()` — usuwa krawędź wchodzącą do węzła | Działa |
| Duplikuj gałąź | — | `duplicateBranch()` — klonuje węzeł + wszystkich potomków wraz z krawędziami | Działa |

**Grupa AI** (pod-menu flyout)

| Pozycja (PL) | Co robi | Stan |
|---|---|---|
| AI: Przeredaguj węzeł | Dispatch `idea-mindmap-rewrite-node` (ścieżka Propose→Accept) | Działa |
| Rozbuduj temat | `handleAIExpand(nodeId)` | Działa |
| Pogłęb | `handleAIExpand(nodeId)` — **ten sam handler co „Rozbuduj temat"** | Działa, ale efekt identyczny z pozycją wyżej |
| Co jeśli...? | `setShowWhatIf(true)` — otwiera panel AIWhatIfScenarios | Działa |
| Podsumuj gałąź | `summarizeBranch()` — wysyła prompt do czatu AI | Działa |
| Wykryj zależności | `setShowDependencyDetector(true)` | **Domyślnie disabled + badge „Wkrótce"** — pozycja jest w `comingSoonIds` dopóki flaga `mindmapHeuristicAiOverlays` (domyślnie **OFF**) nie zostanie włączona. Powód (z kodu): to nakładka heurystyczna (dopasowanie indeksów po stronie klienta), nie realna analiza AI — świadomie ukryta do czasu podpięcia prawdziwego backendu (bramka „DP-5") |
| Priorytetyzacja | `setShowPriorityRecommender(true)` | Działa (NIE objęte blokadą „Wkrótce" mimo że to też nakładka heurystyczna) |
| Konkurencja | `setShowCompetitiveLandscape(true)` | Działa |
| AI: Zasuguruj powiązania (`ai_suggest_links`) | — | **MARTWA pozycja z tego menu**: `handleContextAction` nie ma gałęzi `if (action==='ai_suggest_links')`, więc kliknięcie nic nie robi. Ta sama akcja **działa poprawnie**, gdy wywołana z paska zaznaczenia (patrz sekcja 3) — tam `onAction` leci innym torem (event globalny obsługiwany w `useMindMapQuickActions.ts`) |

**Grupa Konwersja** (pod-menu flyout)

| Pozycja (PL) | Co robi | Stan |
|---|---|---|
| → Inicjatywa | `convertBranch('initiative', nodeId)` — dispatch `convert_initiative` do warstwy konwersji | Działa |
| → Decyzja | `convertBranch('decision', nodeId)` | Działa |
| → Zadania | `convertBranch('task_set', nodeId)` | Działa |

**Grupa „Konwertuj gałąź na..."** (tylko gdy węzeł ma dzieci; pod-menu flyout)

| Pozycja (PL) | Co robi | Stan |
|---|---|---|
| → Decyzja (gałąź) | `convertBranch('decision', nodeId)` na całym poddrzewie | Działa |
| → Zadania (gałąź) | `convertBranch('task_set', nodeId)` | Działa |
| → Zestaw zadań (gałąź) | `convertBranch('task_set', nodeId)` — **identyczna akcja co „→ Zadania (gałąź)"** | Działa, duplikat funkcjonalny |
| → Inicjatywa (gałąź) | `convertBranch('initiative', nodeId)` | Działa |
| → Przepływ procesu (gałąź) | `convertBranch('process_flow', nodeId)` | Działa (naprawione — historycznie było „gołe przełączenie narzędzia" bez przeniesienia danych, teraz przechodzi przez `convertBranch`) |

**Grupa „Wygląd i dane"** (pod-menu flyout)

| Pozycja (PL) | Co robi | Stan |
|---|---|---|
| Zmień kształt | Cyklicznie zmienia `shape` (default→circle→diamond→hexagon) | Działa. Disabled gdy `isLocked`/`isProtected` |
| Dodaj obraz | Otwiera `ImageUrlModal` | Działa. Disabled gdy `isLocked`/`isProtected` |
| Kopiuj styl | Zapisuje styl węzła do schowka stylu | Działa |
| Wklej styl | Aplikuje skopiowany styl | Działa. Disabled gdy brak skopiowanego stylu lub `isLocked`/`isProtected` |
| Głosuj ↑ | Inkrementuje `votes` (cyklicznie 0–5) | Działa tylko dla `nodeType==='idea'` |
| Przypisz osobę | Otwiera `AssignPersonModal` | Działa tylko dla `nodeType==='idea'` |
| Komentarze | Otwiera wątek komentarzy węzła | Działa tylko dla `nodeType==='idea'` |
| Notatki | Otwiera `NodeDetailDrawer` | Działa tylko dla `nodeType==='idea'` |
| Tagi | Otwiera `NodeDetailDrawer` (ta sama akcja co „Notatki") | Działa tylko dla `nodeType==='idea'` — dwie różne pozycje menu prowadzą do tego samego drawera |
| Dołącz wiedzę | Dispatch `idea-workspace-attach-knowledge` | Działa |
| Dołącz artefakt | Otwiera `AttachArtifactModal` | Działa |
| Powiązane artefakty | Otwiera link (1 artefakt), listę w drawerze (2+) lub toast „brak" (0) | Działa |
| Kopiuj link | Kopiuje URL z `?focusNode=` do schowka | Działa |

**Na dole (bez nagłówka grupy)**

| Pozycja (PL) | Skrót | Co robi | Stan |
|---|---|---|---|
| Usuń | Del | `deleteSelected()` | Działa. Disabled gdy `isLocked` lub `isProtected` |

### 2b. Krawędź — `EdgeContextMenu` (nie zweryfikowane wzrokiem)

Plik: `EdgeContextMenu.tsx` → akcje w `handleEdgeContextAction`. Wszystkie pozycje mają realny handler — brak martwych pozycji.

| Pozycja (PL) | Co robi | Stan |
|---|---|---|
| Dodaj / edytuj etykietę | `window.prompt` → zapisuje `label` na krawędzi | Działa. Disabled gdy `isLocked` |
| Wstaw węzeł na połączeniu | Wstawia nowy pusty węzeł w połowie krawędzi relacyjnej, dzieląc krawędź na dwie | Działa **tylko dla krawędzi relacyjnej** (`isRelationEdge`); dla krawędzi strukturalnej (drzewo) klik nic nie robi mimo że pozycja jest aktywna |
| Odwróć kierunek | Zamienia `source`/`target` (i uchwyty) | Działa tylko dla krawędzi relacyjnej — analogicznie jw. |
| Zmień styl linii | Cyklicznie solid→dashed→dotted | Działa dla każdej krawędzi |
| Edytuj relację | `window.prompt` z listą typów (`related, depends_on, blocks, supports, contradicts`) | Działa tylko dla krawędzi relacyjnej |
| Usuń połączenie | Usuwa krawędź | Działa **tylko gdy `isUserCreated`** (krawędzie strukturalne wygenerowane automatycznie nie są usuwalne stąd — pozycja jest wtedy disabled) |

---

## 3. Pasek zaznaczenia węzła (`FloatingNodeToolbar`) i jego „⋮" (nie zweryfikowane wzrokiem)

Pojawia się po zaznaczeniu (kliknięciu) jednego węzła, tuż nad nim. **Ważna korekta względem założenia w briefie zadania:** przycisk „⋮" na końcu paska **nie otwiera własnej, odrębnej listy** (nie tej z pozycjami „Add topic / Copy / Paste / Select all / Fit view / Auto layout / Auto-cluster / Collapse…"). W kodzie `onOpenContextMenu` (wywoływane przez „⋮") ustawia ten sam stan `contextMenu`, który renderuje **dokładnie ten sam `NodeContextMenu` co prawy klik na węźle** (sekcja 2a) — czyli grupy Edycja/Struktura/AI/Konwersja/Wygląd i dane/Usuń, NIE listę paneMenu. Lista „Add topic (do korzenia) N · Copy/Cut/Paste ⌘C/X/V · Select all ⌘A · Fit view ⌘0 · Auto layout ⌘L · Auto-cluster · Collapse…" opisana w briefie to w rzeczywistości treść **`PaneContextMenu`** (sekcja 1 tego dokumentu) — możliwe pomylenie źródła podczas przygotowania briefu.

### Przyciski paska (tryb pojedynczego zaznaczenia, kolejność od lewej)

| Przycisk | Skrót/tooltip | Co robi | Stan |
|---|---|---|---|
| Child (Gałąź) | Tab | `addChildNode()` | Działa. Disabled gdy `disabled` |
| Sibling (Sąsiad) | Shift+Enter | `addSiblingNode()` | Działa. Ukryty dla `isProtected` |
| Edytuj (ikona ołówka) | F2 | `onAction('ctx_edit')` → `startEditingSelected()` | Działa. Disabled gdy `disabled`/`isProtected` |
| Zwiń/Rozwiń (ikona fold) | Space | `onAction('mm_toggle_collapse')` | Widoczny tylko gdy węzeł ma dzieci |
| Typ węzła (CircleDot) | — | Otwiera `SemanticTypeDropdown` (wybór typu semantycznego) | Działa |
| Semantyka i tagi (Tags) | — | Otwiera `SemanticControlsPopover` | Działa |
| Styl linii gałęzi (Waypoints) | — | Otwiera `BranchThemeDropdown` | Działa |
| Auto-układ gałęzi (ToggleRight) | — | Przełącza `autoLayout` dla gałęzi | Działa |
| Kolor | — | Otwiera `ColorPickerPopover` (kolor, krycie, styl linii) | Działa |
| Rozmiar czcionki (liczba, np. „14") | — | Otwiera `FontSizeDropdown` | Działa |
| B (Pogrubienie) | — | Przełącza `bold` | Działa |
| Powiązane artefakty (Paperclip/załącznik) | — | Otwiera `ArtifactLinksPopover` (podgląd/dołącz/otwórz/usuń powiązania) | Działa. Ukryty w trybie multi |
| Szybkie zadanie (CheckSquare) | — | Otwiera `QuickTaskPopover` | Działa. Ukryty w trybie multi |
| Konwertuj gałąź na... (GitPullRequest) | — | Rozwija listę: Decyzja / Zadania / Zestaw zadań / Inicjatywa / Przepływ procesu | Widoczny tylko gdy węzeł ma dzieci, nie jest chroniony i nie w trybie multi |
| Zablokuj/Odblokuj (Lock/Unlock) | — | Przełącza `locked` | Działa |
| Szybka notatka (StickyNote) | — | Otwiera `QuickNotesPopover` | Działa. Ukryty w trybie multi |
| Szybkie tagi (Hash) | — | Otwiera `QuickTagsPopover` | Działa. Ukryty w trybie multi |
| Szybki link (Link2) | — | Otwiera `QuickLinkPopover` (evidence link) | Działa. Ukryty w trybie multi |
| AI (Sparkles) | — | Otwiera `FloatingAIPopover` — patrz tabela niżej | Działa. Ukryty w trybie multi |
| ⋮ (MoreVertical, „More options") | — | Otwiera **`NodeContextMenu`** w pozycji kursora (patrz sekcja 2a) | Działa. Ukryty w trybie multi |

### Zawartość popovera AI (ikona Sparkles na pasku)

| Pozycja (PL) | Akcja (event) | Stan |
|---|---|---|
| Ask AI about this node / Zapytaj AI o ten węzeł | `onOpenChatAboutNode()` → otwiera czat z promptem | Działa |
| AI: Przeredaguj węzeł | `mm_ai_rewrite_node` | Działa |
| Rozwiń ten węzeł | `mm_ai_expand_node` | Działa |
| Pogłęb temat | `mm_ai_deepen` | Działa |
| Podsumuj gałąź | `mm_ai_summarize_branch` | Działa |
| What-if analiza | `mm_ai_what_if` | Działa |
| Zasuguruj powiązania | `ai_suggest_links` | **Działa** stąd (w przeciwieństwie do tej samej pozycji w `NodeContextMenu`, sekcja 2a, gdzie jest martwa) |

### Tryb wielokrotnego zaznaczenia (multi-select)

Za flagą `mindmapMultiToolbar` (domyślnie **OFF**): gdy włączona i zaznaczono >1 węzeł, pasek pokazuje tylko licznik „N selected" i wspólne kontrolki stylu (typ, semantyka, motyw gałęzi, auto-layout, kolor, czcionka, pogrubienie, blokada) — **bez** add child/sibling/rename/collapse/artefaktów/quick task-notes-tags-link/convert-branch/AI/„⋮". Dodatkowo, za osobną flagą `mindmapAlignSnap` (domyślnie **OFF**), w trybie multi doklejany jest klaster przycisków wyrównania/rozłożenia: Wyrównaj do lewej/prawej/góry/dołu, Wyśrodkuj w poziomie/pionie, Rozłóż poziomo/pionowo (te dwa ostatnie aktywne dopiero od 3 zaznaczonych węzłów).

---

## Wspólne vs specyficzne dla Mapy myśli

**Wspólne z innymi narzędziami/canvasami Consultify** (ten sam wzorzec spotykany też w Whiteboard/Process Flow): Kopiuj/Wytnij/Wklej węzły, Zaznacz wszystko, Dopasuj widok, Edytuj/F2, Duplikuj/⌘D, Usuń/Del, Kolor, Blokada, Komentarze, Notatki/Tagi, Dołącz artefakt/wiedzę, Kopiuj link.

**Specyficzne dla Mapy myśli** (logika drzewa/hierarchii i konwersji strukturalnej): Dodaj gałąź/sąsiad (Tab/Enter), Zwiń/rozwiń poziomami (Alt+0/1/2/9), Auto-układ, Auto-grupowanie, Skup poddrzewo/Drill down, Odłącz/Duplikuj gałąź, cała grupa „Konwertuj (gałąź) na Decyzja/Zadania/Inicjatywa/Przepływ procesu", Typ semantyczny węzła, Motyw linii gałęzi, Zmień kształt, Głosuj ↑, cała rodzina akcji AI kontekstowych (Rozbuduj/Pogłęb/Co jeśli/Podsumuj gałąź/Wykryj zależności/Priorytetyzacja/Konkurencja/Zasuguruj powiązania).

---

## Uwagi / plan / rzeczy nieoczywiste

1. **Korekta briefu (ważne):** „⋮" na pasku zaznaczenia otwiera `NodeContextMenu` (identyczny z prawym klikiem na węźle), NIE osobną listę z pozycjami typu „Add topic (do korzenia) / Select all / Fit view / Auto layout / Auto-cluster / Collapse…" — ta treść należy do `PaneContextMenu` (prawy klik na pustym płótnie, sekcja 1).
2. **Martwa pozycja:** `ai_suggest_links` („AI: Zasuguruj powiązania") w `NodeContextMenu.tsx` (prawy klik na węźle) nie ma odpowiadającej gałęzi w `handleContextAction` — kliknięcie nic nie robi. Identyczna pozycja pod tym samym id **działa poprawnie**, gdy wywołana z paska zaznaczenia (AI popover), bo tam trafia inną ścieżką (globalny event `idea-workspace-quick-action` → `useMindMapQuickActions.ts`). To rozjazd między dwoma wejściami do tej samej funkcji.
3. **Plan/„Wkrótce" (flaga `mindmapHeuristicAiOverlays`, domyślnie OFF):** pozycja „Wykryj zależności" jest świadomie zablokowana (badge „Wkrótce") dopóki backend nie dostarcza realnej analizy AI zamiast heurystyki po stronie klienta (dopasowanie indeksów). Z opisu flagi w kodzie wynika, że tym samym problemem („wynik heurystyczny udawany za AI") objęte są też `AIBranchBalancer`, `AISentimentOverlay`, `AIAutoClustering` — ale **nie** pozycje „Priorytetyzacja" ani „Konkurencja" w tym menu, które nie mają blokady mimo pokrewnego charakteru.
4. **Duplikaty funkcjonalne (nie błąd, ale warto wiedzieć):** „Rozbuduj temat" i „Pogłęb" wywołują dokładnie ten sam handler (`handleAIExpand`); „Skup poddrzewo" i „Drill down" — to samo (`handleDrillDown`); „→ Zadania (gałąź)" i „→ Zestaw zadań (gałąź)" — to samo (`convertBranch('task_set', …)`); „Notatki" i „Tagi" w grupie Wygląd i dane — obie otwierają ten sam `NodeDetailDrawer`.
5. **Warunek `nodeType==='idea'`:** kilka pozycji menu węzła (Otwórz szczegóły, Głosuj ↑, Przypisz osobę, Komentarze, Notatki, Tagi) działa tylko dla węzłów typu `idea`. Dla węzłów innego typu (np. syntetycznych węzłów-gałęzi z danych demo, patrz niżej) pozycja jest widoczna i nie-disabled, ale klik nic nie zmienia — brak jawnej informacji zwrotnej dla użytkownika.
6. **`isProtected` i dane demo:** kod uznaje węzeł za chroniony (`isProtected`), gdy `nodeId==='root'` lub zaczyna się od `branch-`. W obejrzanych danych testowych węzły-gałęzie mają jednak id w formacie `b-proc`, `b-ludzie`, `b-tech` itd. (nie `branch-…`) — możliwe, że dla danych generowanych tą konkretną ścieżką seed/AI ochrona `isProtected` nie łapie tych węzłów tak, jak łapałaby węzły tworzone naturalnie przez funkcję grupowania w aplikacji. Nie zweryfikowano wzrokiem (patrz sekcja Metoda) — do sprawdzenia osobno, poza zakresem tego audytu.
7. **Martwa gałąź w kodzie (kosmetyczne):** w `NodeContextMenu.tsx` warunek `hasSubmenuGroups = groups.length > 5` jest przy obecnej liczbie grup (6 lub 7) zawsze prawdziwy — wariant renderowania „płaskiego" menu bez pod-menu (linie ok. 486–510) jest więc nieosiągalny w praktyce.
8. **Zakłócenie środowiska podczas audytu:** obiekt testowy (idea `8d97381d-…`) był w trakcie sesji modyfikowany przez proces spoza tej przeglądarki (samoistne przełączenia widoku, przesunięcia węzłów, komunikaty „Reconnecting collaboration" / „Wykryto konflikt zmian. Odświeżam mapę z serwera"). To zjawisko środowiskowe, nie efekt uboczny czynności tego audytu — ale oznacza, że ponowna, spokojniejsza sesja z wyłącznym dostępem do tego obiektu byłaby potrzebna, by domknąć wzrokową weryfikację sekcji 2 i 3.

---

## ★ Weryfikacja wzrokiem (sesja główna, 2026-07-23) — rozstrzygnięcie „⋮"

Potwierdzone na żywo (Playwright, obiekt `8d97381d`, gdy inne sesje były ciche):

- Przycisk **„⋮" na pływającym pasku węzła** (`FloatingNodeToolbar`, ostatni po prawej) woła `onOpenContextMenu` i otwiera **`NodeContextMenu`** (menu węzła), zawartość zweryfikowana wzrokiem:
  - **EDYCJA:** Edytuj (F2) · Otwórz szczegóły · Dodaj gałąź (Tab) · Dodaj sąsiada (Enter) · Duplikuj (⌘D) · Kopiuj (⌘C) · Wytnij (⌘X) · Wklej (⌘V)
  - **STRUKTURA:** Zwiń/rozwiń (Space) · Skup poddrzewo · Drill down ▸ · Połącz z zaznaczonym · Odłącz gałąź · Duplikuj gałąź
  - **Podmenu:** AI ▸ · Konwersja ▸ · Konwertuj gałąź na… ▸ · Wygląd i dane ▸
- **Uwaga do zrzutu z zlecenia:** rozwijana lista „Add topic (to root) · Copy/Cut/Paste nodes · Select all · Fit view · Auto layout · Auto-cluster · Collapse all · Show level 1/2 · Expand all · AI: Suggest nodes" to **NIE** jest menu „⋮" — to **`PaneContextMenu`** (prawy-klik na PUSTYM płótnie). Zawartość 1:1 z kodem (`pane_add_node`, `pane_select_all`, `pane_fit_view`, `pane_auto_layout`, `pane_auto_cluster`, `pane_collapse_all`, `pane_expand_all`, `pane_ai_suggest`).
- Wniosek: to dwa RÓŻNE menu. „⋮" na pasku = menu węzła (bogate, z podmenu). Prawy-klik na tle = menu globalne mapy (dodaj do korzenia, zaznacz wszystko, dopasuj, auto-układ, poziomy widoczności, AI-sugestie).
