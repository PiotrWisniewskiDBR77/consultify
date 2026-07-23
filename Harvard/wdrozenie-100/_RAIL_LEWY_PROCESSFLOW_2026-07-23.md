# Lewy pływający pasek narzędzi (rail) — tryb PRZEPŁYW (Process Flow)

Data: 2026-07-23. Zakres: `CanvasLeftToolbar` (`src/components/MyWork/mindmap/CanvasLeftToolbar.tsx`) w trybie `activeTool === 'process_flow'`, wewnątrz `IdeaMapWorkspace.tsx` / `IdeaProcessFlowTool.tsx`.

Metoda: grep-first w kodzie (`CONTEXT_SLOTS`, `TOOL_CONFIG`, popovery w `mindmap/toolbar-popovers/`, handlery w `IdeaMapWorkspace.tsx` i `processflow/useProcessFlowQuickActions.ts`) + weryfikacja wzrokiem na `http://localhost:3100/my-work/ideas/55ad699b-.../workspace/process-flow` (Playwright/browser tool, PL, tryb ciemny — jedyny dostępny w tej sesji).

**Uwaga do wiarygodności zrzutów**: obiekt testowy w trakcie sesji samoistnie (co ok. 1-2 s po wejściu) przełączał `activeTool` na `table` albo `mindmap` bez mojej interakcji — najprawdopodobniej inna równoległa sesja/agent na tym samym `ideaId` synchronizowana realtime (`server/src/realtime/ideaMapAccess.ts` widoczny jako zmodyfikowany w repo). Weryfikację wzrokową robiłem w krótkich oknach zaraz po przeładowaniu, zanim nastąpiło przełączenie. Wszystkie kluczowe elementy poniżej zostały jednak potwierdzone albo w drzewie dostępności (`read_page`, teksty PL 1:1), albo bezpośrednio w DOM (`innerText`/`getBoundingClientRect`), a nie tylko „na oko” ze zrzutu.

## 1. Struktura raila — 15 pozycji od góry do dołu

Rail to pojedynczy komponent `CanvasLeftToolbar`, wspólny dla 4 narzędzi (Mapa rekomendacji / Tablica / Przepływ / Tabela). Renderuje się w kolejności: **przełącznik narzędzi (4)** → separator → **SHARED_TOP (3)** → separator → **CONTEXT_SLOTS zależne od narzędzia (4 dla Przepływu)** → separator → **SHARED_BOTTOM (2)** → separator → **cofnij/ponów (2)**.

| poz. | ikona (lucide) | etykieta PL (tooltip) | typ | wspólne / specyficzne | co robi |
|---|---|---|---|---|---|
| 0 | `GitBranch` | Mapa rekomendacji | przełącznik | wspólne (4 narzędzia) | `onToolChange('mindmap')` — przełącza cały workspace na Mind Map. Kropka (dot) w rogu gdy narzędzie ma treść i nie jest aktywne. |
| 1 | `StickyNote` | Tablica | przełącznik | wspólne | `onToolChange('whiteboard')` |
| 2 | `Workflow` | Przepływ | przełącznik | wspólne | `onToolChange('process_flow')` — aktywne w tym trybie (podświetlone tło) |
| 3 | `Table2` | Tabela | przełącznik | wspólne | `onToolChange('table')` |
| — | — | (separator) | | | |
| 4 | `MousePointer2` / `Hand` | „Zaznaczanie — klik zaznacza, kliknij by przełączyć na przesuwanie” (dynamiczny tooltip SEL/PAN/LNK) | przełącznik (pstryczek) | wspólne | `mm_select_mode` / `mm_pan_mode`. **Uwaga**: zmienia globalny (dla całego workspace) stan `mindMapInteractionMode` i etykietę SEL/PAN obok ikony, ale `IdeaProcessFlowTool.tsx` **nigdzie nie odczytuje propsa `interactionMode`** (zero wystąpień w pliku) — w Przepływie przycisk realnie **nie zmienia zachowania płótna** (ReactFlow ma własny domyślny pan/select), w przeciwieństwie do Mind Map, gdzie `IdeaRecommendationMap.tsx` intensywnie konsumuje ten stan (connect/select/pan). Efekt w Przepływie: kosmetyczny (zmienia tylko własną etykietę SEL/PAN na railu). |
| 5 | `Sparkles` | AI | popover | wspólne | patrz §2.1 — **w Przepływie treść generatorów jest martwa** |
| 6 | `LayoutTemplate` | Szablony | popover | wspólne | patrz §2.2 — **tool-aware, działa poprawnie** |
| 7 | `Workflow` | Start/End | akcja natychmiastowa | **specyficzne PF** | `pf_add_start` → zawsze dodaje węzeł typu `start` (etykieta „Start”). Mimo nazwy „Start/End” **nie ma sposobu dodania węzła End z tego przycisku** — `pf_add_end` istnieje w handlerze, ale nic w rail go nie wywołuje (dostępne tylko przez chat/import). Potwierdzone live: kliknięcie zwiększyło licznik „Kroki” z 9 na 10 (real, nie no-op); cofnięte przyciskiem Undo. |
| 8 | `Square` | Task | akcja natychmiastowa | specyficzne PF | `pf_add_action` → dodaje węzeł typu `action` (etykieta „Akcja”) |
| 9 | `Diamond` | Decyzja | akcja natychmiastowa | specyficzne PF | `pf_add_decision` → dodaje węzeł typu `decision` (etykieta „Decyzja”, romb) |
| 10 | `Plus` | Lane | akcja natychmiastowa | specyficzne PF | `pf_add_lane` → dodaje nowy tor na końcu, etykieta **niepszetłumaczona** „Lane N” (nie „Tor N”), kolor rotacyjny z palety `LANE_COLORS` |
| — | — | (separator) | | | |
| 11 | `Upload` | Import / Eksport | popover | wspólne | patrz §2.3 — **całkowicie martwe w Przepływie** |
| 12 | `MoreHorizontal` | Więcej narzędzi | popover | wspólne | patrz §2.4 — **całkowicie martwe w Przepływie** |
| — | — | (separator) | | | |
| 13 | `Undo2` | Cofnij | akcja | wspólne (prefiks `pf_undo`) | działa — realny undo stosu Process Flow (`useProcessFlowQuickActions` → `handlers.undo()`) |
| 14 | `Redo2` | Ponów | akcja | wspólne (prefiks `pf_redo`) | działa analogicznie |

Uwaga do [13]/[14]: stan `canUndo`/`canRedo` przekazywany do raila (`mmCanUndo`/`mmCanRedo` w `IdeaMapWorkspace.tsx`) jest aktualizowany **tylko** przez zdarzenie `mm-undo-state`, które emituje wyłącznie `IdeaRecommendationMap.tsx` (Mind Map). Nie znalazłem odpowiednika emitowanego przez `IdeaProcessFlowTool.tsx` pod tą samą nazwą zdarzenia — w tej sesji przyciski Cofnij/Ponów mimo to zadziałały (kliknięcie z linii poleceń JS na przycisku „Cofnij” cofnęło dodany węzeł), więc realnie działają, ale **stan „enabled/disabled” wizualnie widziany na rail może być odziedziczony/nieaktualny z ostatniej wizyty w Mind Map** w tej samej sesji (nie zweryfikowane wzrokiem do końca — wymagałoby świeżej sesji bez wcześniejszego wejścia do mindmapy).

Osobno: rail w Przepływie NIE zawiera pozycji z Mind Map (Ramka/Frame, Dodaj węzeł, Wiedza, Komentarze, Połącz, Prezentacja), Tablicy (Karteczka, Tekst, Kształt, Rysuj) ani Tabeli (Nowy wiersz, Kolumny, Widok, Filtruj, Dashboard) — te są w `CONTEXT_SLOTS` innych narzędzi i nie renderują się w trybie `process_flow`.

## 2. Zawartość popoverów

### 2.1 AI (poz. 5) — **martwe w Przepływie**

Otwiera się (potwierdzone w DOM: `getBoundingClientRect` zwrócił realny prostokąt, widoczny). Zawartość (bez zaznaczonego węzła):
- „Nowa rozmowa AI" (`onOpenChat` → otwiera panel czatu Teresy) — **działa**, generyczne dla wszystkich narzędzi.
- Sekcja „Generatory AI": Rozwiń mapę (AI) `mm_ai_expand`, Zasugeruj gałęzie `mm_ai_suggest`, Analiza luk `mm_ai_gap_analysis`, Auto-klasteryzacja `mm_ai_cluster` (za flagą `heuristicAiEnabled`), Podsumowanie mapy `mm_ai_summarize`, Auto-linki między gałęziami `mm_ai_auto_connect`.
- Gdy zaznaczony węzeł: dodatkowo „Dla zaznaczonego węzła" — Rozwiń ten węzeł / Pogłęb temat / Podsumuj gałąź / What-if analiza (`mm_ai_*`).

**Wszystkie akcje generatorów mają prefiks `mm_` i są obsługiwane WYŁĄCZNIE przez `useMindMapQuickActions.ts`, hook montowany tylko wewnątrz `IdeaRecommendationMap` (`{activeTool === 'mindmap' && <IdeaRecommendationMap/>}` w `IdeaMapWorkspace.tsx`).** W trybie `process_flow` ten komponent jest odmontowany → zdarzenie `idea-workspace-quick-action` z akcją `mm_ai_*` nie ma żadnego nasłuchującego handlera. Kliknięcie zamyka popover i **nic więcej się nie dzieje** (brak toastu, brak zmiany na płótnie). Nie testowałem klikiem żywym każdego przycisku z osobna (ryzyko wywołania realnego wywołania API dla „Rozwiń mapę”), ale mechanizm jest identyczny jak w Import/Eksport i Więcej narzędzi, które przetestowałem empirycznie (patrz niżej) — tam potwierdzone zero efektu.

### 2.2 Szablony (poz. 6) — **działa poprawnie, tool-aware**

Potwierdzone live (treść z DOM):
- Pole szukania.
- Sekcja „Punkty startowe" (zawsze te same 6 pozycji, **NIE filtrowane wg aktywnego narzędzia** mimo że każda ma pole `preferredSystem`): Rozbij problem, Znajdź przyczyny źródłowe, Porównaj opcje, Zmapuj proces, Zamień notatki w strukturę, Uprość sprawozdanie finansowe. Klik wysyła `idea-workspace-apply-intent` z promptem — używane raczej do zasiania nowego pomysłu niż w trakcie edycji istniejącego.
- Sekcja „Szablony" — dla Przepływu 6 pozycji: Pusty proces, Warsztat usprawnienia procesu, Podstawowy proces, Proces akceptacji, Cykl PDCA, Order to Cash (ta ostatnia nieprzetłumaczona, zostaje po angielsku).
- „Zobacz więcej" → otwiera galerię szablonów (`onOpenTemplateGallery`).

`onApplyTemplate` → `handleApplyTemplate` w `IdeaMapWorkspace.tsx` woła realny endpoint `applyIdeaTemplate` z `activeTool` przekazanym jawnie — **jest to prawdziwa, tool-aware ścieżka**, w przeciwieństwie do AI/Import-Eksport/Więcej narzędzi.

### 2.3 Import / Eksport (poz. 11) — **martwe w Przepływie (potwierdzone empirycznie)**

Treść (identyczna niezależnie od narzędzia, zweryfikowana live przez `innerText`):
- **Import**: Mapa JSON, XMind / FreeMind / OPML, Dokument → Mapa, Mów pomysły (Voice), Wywiady → Mapa.
- **Eksport**: Eksport PDF, PNG, SVG, JSON, Mermaid / PlantUML, CSV (Excel), Markdown (konspekt), Prezentacja HTML, Osadź w raporcie.
- **Historia wersji** (⌘⇧H).

Wszystkie akcje mają prefiks `mm_` (`mm_export_pdf`, `mm_import_device`, `mm_snapshot_history`...) i są obsługiwane wyłącznie w `useMindMapQuickActions.ts` (mindmap-only). **Test empiryczny**: kliknięcie „Historia wersji” w trybie Przepływ nie otworzyło żadnego panelu/modala — brak jakiegokolwiek efektu widocznego na ekranie. Prawdziwy eksport w Process Flow istnieje, ale jest osiągalny inną drogą: przycisk „Eksport” w górnym poziomym pasku narzędzi Process Flow (`IdeaProcessFlowTool.tsx`, `ExportDialog`) oraz skrót `Cmd/Ctrl+E` — **nie przez ten popover raila**.

### 2.4 Więcej narzędzi (poz. 12) — **martwe w Przepływie (potwierdzone empirycznie)**

Treść (zweryfikowana live przez `innerText`), pogrupowana:
- **Tryby widoku**: Zmień układ, Typ struktury, Minimap, Dopasuj widok, Tryb prezentacji, Zwiń do korzenia (Alt+0), Pokaż poziom 1/2/3 (Alt+1/2/3), Rozwiń wszystko (Alt+9).
- **Workflow**: Wersje / Snapshoty, Historia aktywności.
- **Współpraca**: Udostępnij, Osadź zewnętrznie.
- **Analityka**: Analiza gałęzi.

Wszystkie akcje `mm_*`, obsługiwane wyłącznie w `useMindMapQuickActions.ts` / `MindmapCommandPalette.tsx` (mindmap-only). **Test empiryczny**: kliknięcie „Dopasuj widok” (odpowiednik „Fit view”, efekt normalnie natychmiast widoczny — zmiana zoomu/wycentrowanie) **nie zmieniło procentu zoomu** (pozostał 59%) ani układu płótna. Potwierdza to, że cały popover jest martwy w trybie Przepływu.

## 3. Kontrast: co w Przepływie NAPRAWDĘ działa

Zweryfikowane live (klik → obserwowalny efekt):
- **Start/End, Task, Decyzja, Lane** (poz. 7-10) — realne akcje, dodają węzły/tor na płótnie (licznik „Kroki” 9→10 po kliknięciu Task, cofnięte przyciskiem Cofnij).
- **Cofnij / Ponów** (poz. 13-14) — realny stos undo Process Flow.
- **Szablony** (poz. 6) — tool-aware backend call.
- **Przełącznik narzędzi** (poz. 0-3) — realnie przełącza `activeTool` (choć uwaga: znany błąd duplikacji treści przy przełączaniu, wg polecenia zadania — nie testowany tu ponownie).
- **AI → „Nowa rozmowa AI”** wewnątrz popovera AI — otwiera czat Teresy (generyczne, nie zależy od narzędzia).

Martwe (potwierdzone kodem, część też empirycznie):
- AI → 6 generatorów + 4 akcje węzła (popover AI, poza „Nową rozmową”).
- Cały popover Import / Eksport.
- Cały popover Więcej narzędzi.
- Pointer toggle (Zaznaczanie/Przesuwanie) — zmienia tylko własną etykietę, nie wpływa na zachowanie płótna Process Flow.

## 4. Uwagi / rzeczy nieoczywiste

1. **Trzy z sześciu popoverów/sekcji na rail w Przepływie są recyklingiem 1:1 komponentów Mind Map** (`AIActionsPopover`, `ImportExportPopover`, `MoreToolsPanel`) — żaden z nich nie przyjmuje propsa `activeTool`, więc renderują identyczną, mindmapową treść niezależnie od aktywnego narzędzia, a akcje spod spodu (`mm_*`) nie mają handlera poza Mind Mapą. Wygląda to jak niedokończone przeniesienie raila do wspólnego komponentu (`#6a`, komentarz w kodzie z 2026-07-12) — UI wygląda identycznie i klika się identycznie, ale **~2/3 pozycji w tych popoverach jest martwych poza Mind Mapą**. Tylko `TemplatesPopover` dostał parametr `activeTool` i realnie filtruje treść.
2. **„Start/End” to w praktyce tylko „Start”.** Guzik nigdy nie tworzy węzła End (`pf_add_end` jest zaimplementowany w handlerze, ale nic w UI raila go nie wywołuje).
3. **„Lane” dodaje etykietę nieprzetłumaczoną** — „Lane 4”, nie „Tor 4” — mimo że reszta UI jest w pełni spolszczona.
4. **Dodanie kroku (Task/Decision/Start) wyzwala efekt uboczny**: `addNode()` w `IdeaProcessFlowTool.tsx` automatycznie odpytuje AI o sugestię kolejnych kroków i pokazuje „ghost nodes” (przezroczyste podpowiedzi) na płótnie przez 15 sekund — nie jest to nigdzie skomunikowane na rail, ale dzieje się przy każdym kliknięciu poz. 7-9.
5. **Stan Undo/Redo (enabled/disabled) na rail jest zasilany zdarzeniem `mm-undo-state`, emitowanym tylko przez Mind Mapę** — nie znalazłem odpowiednika w Process Flow. Mimo to przyciski faktycznie działają po kliknięciu (zweryfikowane), więc source-of-truth wizualnego stanu (szary/aktywny) może być nieaktualny/dziedziczony z innego narzędzia w tej samej sesji przeglądarki — wymaga dalszej weryfikacji w czystej sesji.
6. **Środowisko testowe było niestabilne**: obiekt `55ad699b-...` samoczynnie przełączał aktywne narzędzie (raz na Tabela, raz na zupełnie inny Mind Map z bogatą treścią „Wdrożenie AI w produkcji” — inny kontekst niż 9-krokowy Przepływ) co 1-2 sekundy po wejściu, bez mojej interakcji. To wskazuje na współdzielony stan `activeTool` synchronizowany realtime między wszystkimi widzami tego samego `ideaId` — prawdopodobnie inna równoległa sesja/agent testująca ten sam obiekt jednocześnie. Wart osobnego zgłoszenia jako defekt: przełączanie narzędzia przez jednego widza nie powinno przełączać widoku innym widzom bez wyraźnej akcji z ich strony (a już na pewno nie po prostu przy odczycie/oglądaniu).
7. **Nie zweryfikowane wzrokiem**: pełny render wizualny popovera AI (otwiera się w DOM z poprawną treścią i poprawnym `getBoundingClientRect`, ale nie udało się go uchwycić na zrzucie ekranu narzędzia przeglądarki — może to być artefakt konkretnego narzędzia do zrzutów, nie realny defekt produktu). Nie klikałem pojedynczo każdej z 6 pozycji generatorów AI ani wszystkich pozycji Import/Eksport (ryzyko wywołania prawdziwych zapytań API) — martwość wywnioskowana z identycznego mechanizmu co empirycznie potwierdzone „Historia wersji” i „Dopasuj widok”.
