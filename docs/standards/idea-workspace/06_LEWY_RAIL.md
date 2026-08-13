# 06 — Lewy rail

> **Zastąpienie kierunku 2026-08-09:** narzędzia opisane w tym rozdziale
> migrują na prawy `CanvasToolRail`; lewa strona jest jednym panelem informacji.
> Kontrakt migracji: [rozdział 13](13_MIGRACJA_NAWIGACJI_2026-08-09.md).

Lewy rail to pionowy, wąski, ikonowy pasek narzędzi edycji bieżącej reprezentacji. Ten rozdział ustala jego rolę, twarde zakazy, wspólny szkielet dla trzech narzędzi-płócien (Mind Map, Whiteboard, Process Flow) oraz osobną treść dla Table, która nie jest płótnem. Warstwa i jej miejsce na ekranie: `03_ARCHITEKTURA_EKRANU.md` §1 (warstwa 3) i §2.

## 1. Rola

Rail służy **wyłącznie szybkiej edycji tego, co jest aktualnie na ekranie**: zaznaczanie, tworzenie elementów, budowanie relacji, drobne akcje kontekstowe na zaznaczeniu, cofanie/ponawianie. To jest jego jedyna odpowiedzialność — nie tożsamość Idei (Menu 1), nie zarządzanie całą reprezentacją (Menu 3), nie informacja (prawy panel).

## 2. Czego lewy rail nie wolno zawierać

| Zakazane | Gdzie mieszka docelowo | Dlaczego |
|---|---|---|
| **Przełącznik reprezentacji** | prawy dolny róg (D2) | decyzja właściciela wprost — rail przestaje być miejscem przełączania; patrz `03` §7 |
| **Konwersja (Convert)** | Menu 1 (całość) / menu zaznaczenia (fragment) | Convert ≠ Export (D6); to akcja na całej Idei albo jawnie nazwanym fragmencie, nie „szybka edycja" |
| **Eksport** | Menu 1 / Menu 3 / kebab | tworzy plik poza systemem — to nie edycja, to wyjście z systemu |
| **Historia / Snapshoty** | Menu 1 kebab (skrót) / prawy panel, zakładka Historia (`07_PRAWY_PANEL.md` §8) | historia to informacja o przeszłości, nie narzędzie edycji bieżącego stanu |
| **Ustawienia Idei** | Menu 1 | dotyczy całej Idei, nie bieżącego widoku |
| **Szablony** | Menu 3 (i „Więcej" widoku) | zakres akcji to `current_view` — `01_MODEL_I_ZASADY.md` §3 przypisuje ten zakres do Menu 3/„Więcej"/prawego dolnego rogu, nie do lewego raila |
| **Import / Eksport plików** | Menu 3 / Menu 1 | ingestia i wyprowadzanie danych z systemu — nie „szybka edycja"; dziś to i tak martwy popover poza Mind Mapą (§5) |
| **Generatory AI o zakresie całej reprezentacji** (np. „Rozwiń mapę", „Podsumowanie mapy", „Auto-linki") | Menu 3 / Teresa | zakres `workspace`/`current_view` — rail dostaje wyłącznie AI **na zaznaczeniu** (§3, tier „niżej") |

## 3. Wspólny rdzeń — Mind Map / Whiteboard / Process Flow

Te trzy reprezentacje mają płótno i dzielą **jeden szkielet czterowarstwowy**, od góry do dołu. Treść tier „środek" jest w całości specyficzna per narzędzie (Z1 — jawnie wymieniona różnica); reszta szkieletu jest wspólna.

| Tier | Rola | Wspólne dla 3 narzędzi |
|---|---|---|
| **Góra** | tryb interakcji z płótnem | Zaznaczanie ⇄ Przesuwanie (⇄ Rysuj/Łączenie, gdzie dotyczy) |
| **Środek** | tworzenie / relacje / struktura | **specyficzne — patrz §4, §5, §6** |
| **Niżej** | akcje na zaznaczeniu, niezależne od typu narzędzia | Komentarz · Załącznik · AI (na zaznaczeniu) |
| **Dół** | zarządzanie i historia bieżącego widoku | Więcej (treść specyficzna) · Cofnij · Ponów |

**Zasada ID:** docelowe identyfikatory akcji są przestrzenne, nie prefiksowane narzędziem — `idea.node.add_child`, nie `mm_add_child` (mechanizm: `_RDZEN_STANDARDU_4_ZASADY_2026-07-23.md`). Tabele niżej podają **dzisiejszy literał** w kolumnie „Handler dziś", żeby dokument był użyteczny od razu w kodzie.

### Tier „góra" — tryb interakcji (wspólny wzorzec, handler dziś rozjechany)

| Ikona | Etykieta PL | Zakres | Efekt | Handler dziś (stan) |
|---|---|---|---|---|
| `MousePointer2`/`Hand` | Zaznaczanie ⇄ Przesuwanie (⇄ Łączenie) | `current_view` | przełącza tryb kursora płótna | **Mind Map:** `mm_select_mode`/`mm_pan_mode` — działa, canvas realnie odczytuje `interactionMode`. **Whiteboard:** ten sam event, ale `IdeaWhiteboardTool` nie odbiera propsa — **dekoracyjne**, canvas ma osobny, niepowiązany stan (`whiteboardMode`: board/draw) sterowany wyłącznie przyciskiem Rysuj. **Process Flow:** canvas (ReactFlow) nie odczytuje `interactionMode` — **kosmetyczne**, zmienia tylko własną etykietę na railu |

⚠ **Naprawa wymagana (nie propozycja):** Whiteboard i Process Flow muszą **realnie** sterować trybem kursora płótna. Dodatkowo w Whiteboardzie dziś istnieją **dwa niezależne stany trybu** (`interactionMode` z raila + `whiteboardMode` z przycisku Rysuj) — docelowo to ma być **jeden** stan (select/pan/draw/connect), nie dwa równoległe przełączniki.

## 4. Mind Map — sekcja specyficzna

| Tier | Ikona | Etykieta PL | Zakres | Efekt | Handler dziś (stan) | Undo |
|---|---|---|---|---|---|---|
| środek | `GitBranch` | Dodaj węzeł (Gałąź dziecko `Tab` · Gałąź sąsiad `Enter` · Root · 6× wstaw specjalny: Temat/Hipoteza/Ryzyko/Akcja/Decyzja/Opcja) | `single_item`/`workspace` | dodaje węzeł jako dziecko zaznaczenia (albo root), tryb edycji etykiety od razu | `mm_add_child`/`mm_add_sibling`/`mm_add_root`/`mm_insert_*` — **działa**, potwierdzone na żywo | tak |
| środek | `FileText` | Wiedza (Karta wiedzy · Notatka · Dowód) | `single_item` | dodaje kartę wiedzy jako dziecko zaznaczenia; wymaga zaznaczenia | `mm_add_knowledge`/`mm_add_note`/`mm_add_evidence` — **działa**, potwierdzone na żywo | tak |
| środek | `Frame` | Ramka | `workspace`/`single_item` | dodaje węzeł typu `group` (ramka grupująca) obok zaznaczenia | `mm_add_frame` — **działa** | tak |
| środek | `Link2` | Połącz | `selected_items` | tryb rysowania połączeń przeciąganiem między uchwytami węzłów | `mm_connect_mode` — **działa** | n/d |
| niżej | `MessageSquare` | Komentarze | `single_item` | otwiera wątek komentarza do zaznaczonego węzła | `mm_comments` — **działa, ale zawężone**: tylko dla węzłów typu `idea` — Frame/Knowledge/branch dostają toast „zaznacz węzeł" zamiast otwarcia | n/d |
| niżej | `Sparkles` | AI dla zaznaczenia (Rozwiń ten węzeł · Pogłęb temat · Podsumuj gałąź · What-if) | `single_item`/`selected_items` | akcje AI na zaznaczeniu, nie na całej mapie | `mm_ai_expand_node`/`mm_ai_deepen`/`mm_ai_summarize_branch`/`mm_ai_what_if` — **działa** | zależnie od akcji (mutujące mają preview) |
| dół | `MoreHorizontal` | Więcej (tryby widoku · workflow · współpraca · analityka) | `current_view` | drugorzędne narzędzia Mind Mapy | `mm_change_layout`/`mm_structure_picker`/`mm_fit_view`/`mm_fold_*`/`mm_branch_analysis`/`mm_share`/`mm_embed` + **Prezentacja** (przeniesiona tu z osobnego przycisku raila, kończy duplikat — patrz `07_DUPLICATES_AND_CONFLICTS.md` §16) — **działa** | zależnie od akcji |
| dół | `Undo2`/`Redo2` | Cofnij / Ponów | `current_view` | historia edycji Mind Mapy | `mm_undo`/`mm_redo` — **działa**, poprawnie raportuje stan (`mm-undo-state`) | — |

⟦DO USTALENIA⟧ — sekcja „Z platformy" popovera Wiedza (Wstaw z Notebook / Wstaw z Interview) dziś realnie działa, ale żadne dostępne źródło nie rozstrzyga, czy w standardzie docelowym zostaje na railu jako tworzenie, czy przenosi się pod zakładkę Powiązania (`07` §6) jako import danych z innego modułu.

**Usunięte z raila Mind Mapy względem stanu dzisiejszego** (banowane per §2, przeniesione gdzie indziej): 4 przełączniki narzędzi, Szablony, Import/Eksport, „Generatory AI" o zakresie całej mapy (Rozwiń mapę/Zasugeruj gałęzie/Analiza luk/Auto-klasteryzacja/Podsumowanie mapy/Auto-linki), Historia wersji/Snapshoty.

## 5. Whiteboard — sekcja specyficzna

| Tier | Ikona | Etykieta PL | Zakres | Efekt | Handler dziś (stan) | Undo |
|---|---|---|---|---|---|---|
| góra | `Pen` | Rysuj | `current_view` | tryb rysowania odręcznego | `wb_mode_draw` — **działa**, ale stan osobny od Zaznaczanie/Przesuwanie (patrz §3 naprawa) | n/d |
| środek | `StickyNote` | Karteczka | `workspace` | dodaje karteczkę na płótnie | `wb_add_sticky` — **działa** | tak |
| środek | `Type` | Tekst | `workspace` | dodaje pole tekstowe | `wb_add_text` — **działa** | tak |
| środek | `Square` | Kształt | `workspace` | dodaje kształt | `wb_add_shape_rectangle` — **działa, ale niekompletne**: wstawia tylko prostokąt; warianty koło/romb/sześciokąt istnieją w kodzie (`wb_add_shape_circle/diamond/hexagon`) bez przycisku/popovera na railu — docelowo: popover wyboru kształtu zamiast pojedynczego przycisku | tak |
| środek | `Frame` | Ramka | `workspace` | dodaje ramkę grupującą | `wb_add_frame` — **działa** | tak |
| niżej | `MessageSquare` | Komentarze | `single_item`/`selected_items` | otwiera wątek komentarza do zaznaczenia | **dziś: brak na railu** — dodać dla spójności Z1 (dziś komentarze do elementu, jeśli w ogóle, tylko przez inną powierzchnię) | n/d |
| niżej | `Paperclip` | Załącznik | `single_item` | dołącza plik/dowód do zaznaczonego elementu | **dziś: brak na railu** — dodać | tak |
| niżej | `Sparkles` | AI dla zaznaczenia | `selected_items` | AI na zaznaczonych elementach (temat/klaster/nazwa/wyciągnij akcje) | **dziś: martwe w popoverze wspólnym** (`mm_ai_*` bez odbiorcy w Whiteboardzie) — Whiteboard MA własny, działający zestaw (`wb_ai_find_themes`/`wb_ai_name_clusters`/`wb_ai_extract_actions`), dziś dostępny gdzie indziej (skróty/prawy panel), nie z raila — docelowo: zmapować na tę ikonę | zależnie od akcji |
| dół | `MoreHorizontal` | Więcej (sceny/zapisany widok · wyrównaj/rozłóż/grupuj globalnie · tryb warsztatowy) | `current_view` | drugorzędne narzędzia Tablicy | **dziś: martwe** (statyczna mindmapowa treść, 0/13 pozycji ma sens w Whiteboardzie) | zależnie od akcji |
| dół | `Undo2`/`Redo2` | Cofnij / Ponów | `current_view` | historia edycji Tablicy | `wb_undo`/`wb_redo` — **realnie cofa/ponawia**, ale stan enabled/disabled czerpany z cudzego źródła (brak zdarzenia `wb-undo-state`) — przycisk bywa błędnie wyszarzony lub aktywny | — |

**Usunięte z raila Whiteboardu względem stanu dzisiejszego:** 4 przełączniki narzędzi, popover AI wspólny (zastąpiony realnym AI na zaznaczeniu), Import/Eksport (i tak całkowicie martwy dziś), Prezentacja (nie dotyczy Whiteboardu). **Szablony pozostaje wyjątkiem godnym odnotowania:** to jedyny dziś w pełni działający, tool-aware popover wspólny — przenosi się do Menu 3 razem z resztą (§2), ale bez żadnej naprawy funkcjonalnej, tylko zmiana miejsca.

## 6. Process Flow — sekcja specyficzna

| Tier | Ikona | Etykieta PL | Zakres | Efekt | Handler dziś (stan) | Undo |
|---|---|---|---|---|---|---|
| środek | `Workflow` | Start | `workspace` | dodaje węzeł startowy | `pf_add_start` — **działa** | tak |
| środek | `Workflow`/inna | Koniec | `workspace` | dodaje węzeł końcowy | **dziś: handler `pf_add_end` istnieje, ale żaden przycisk go nie wywołuje** — przycisk raila nazywa się „Start/End", ale End jest nieosiągalny z UI; naprawa: osobny przycisk albo popover Start▾/Koniec | tak |
| środek | `Square` | Aktywność | `single_item`/`workspace` | dodaje węzeł typu `action` | `pf_add_action` — **działa** | tak |
| środek | `Diamond` | Decyzja | `workspace` | dodaje węzeł typu `decision` | `pf_add_decision` — **działa** | tak |
| środek | `Plus` | Tor | `workspace` | dodaje nowy tor (lane) | `pf_add_lane` — **działa, ale etykieta nieprzetłumaczona** („Lane N" zamiast „Tor N") — naprawić tłumaczenie | tak |
| dół | `Grid3x3` | Siatka (pokaż kratkę pomocniczą na płótnie) | `current_view` | rysuje/chowa kratkę pod procesem | `pf_toggle_grid` — **działa** (2026-07-28: przeniesione z bezpodpisowej nakładki `absolute top-2 left-2` nad płótnem, która zasłaniała pstryczek zwijania pierwszego toru — zmierzone 58/225 punktów pstryczka klikalnych); stan włączenia wraca do raila zdarzeniem `process-flow-grid-state` | — |
| dół | `Magnet` | Przyciąganie (równaj przesuwane kroki do siatki) | `current_view` | `snapToGrid` płótna, siatka 16 px | `pf_toggle_snap` — **działa**, jak wyżej | — |
| niżej | `MessageSquare` | Komentarze | `single_item` | komentarz do zaznaczonego kroku | **dziś: brak na railu** — dodać | n/d |
| niżej | `Paperclip` | Załącznik | `single_item` | dołącza plik do kroku | **dziś: brak na railu** — dodać | tak |
| niżej | `Sparkles` | AI dla zaznaczenia | `single_item` | AI na zaznaczonym kroku | **dziś: martwe w popoverze wspólnym** — realne AI Process Flow (AI Coach, Propozycja AI) dziś dostępne tylko z natywnego „Więcej akcji" paska, nie z raila — docelowo: zmapować na tę ikonę | zależnie od akcji |
| dół | `MoreHorizontal` | Więcej (Waliduj · KPI · Podsumuj · Auto-układ całości) | `current_view` | drugorzędne narzędzia Procesu | **dziś: martwe na railu** (statyczna mindmapowa treść); te same funkcje realnie działają w NATYWNYM pasku „Więcej akcji" Process Flow, poza railem — docelowo: jeden mechanizm „Więcej", nie dwa równoległe (patrz `07_DUPLICATES_AND_CONFLICTS.md` §14) | zależnie od akcji |
| dół | `Undo2`/`Redo2` | Cofnij / Ponów | `current_view` | historia edycji Procesu | `pf_undo`/`pf_redo` — **realnie działa**, ale brak zdarzenia `pf-undo-state` — ten sam wzorzec ryzyka co w Whiteboardzie | — |

⚠ **Dodatkowy defekt do naprawy razem z tym rozdziałem:** dodanie kroku (Task/Decision/Start) dziś automatycznie odpytuje AI i pokazuje „ghost nodes" na 15 sekund, bez żadnej informacji o tym w UI raila — jeśli to zachowanie zostaje, musi mieć widoczny stan (np. subtelny wskaźnik „AI podpowiada" przy przycisku), zgodnie z zasadą, że żadna akcja nie ma niewidocznych efektów ubocznych.

**Usunięte z raila Process Flow względem stanu dzisiejszego:** 4 przełączniki narzędzi, popover AI wspólny (zastąpiony realnym AI na zaznaczeniu), Import/Eksport (i tak martwy — realny eksport Process Flow istnieje w górnym pasku narzędzia, poza railem, patrz `07_DUPLICATES_AND_CONFLICTS.md` §4).

## 7. Table — data-rail (nie canvasowy)

Table nie jest płótnem — nie ma pan/zoom, węzłów ani gałęzi. Rail w trybie Tabela **nie dziedziczy szkieletu z §3**. Jeśli rail zostaje w tym trybie w ogóle, jego zawartość to wyłącznie akcje na danych:

| Ikona | Etykieta PL | Zakres | Efekt | Handler dziś (stan) | Undo |
|---|---|---|---|---|---|
| `Sparkles` | AI | `table_column`/`table_row`/`selected_items` | asystent AI tabeli (kategoryzacja, scoring, pipeline, framework) | **dziś: dublet** — rail pokazuje martwy popover mindmapowy (`mm_ai_*`, brak odbiorcy w `useTableQuickActions`), podczas gdy Tabela ma WŁASNY, w pełni działający zestaw w natywnym pasku (`tbl_ai_assistant`/`tbl_copilot`/`tbl_categorize`/`tbl_scoring`/`tbl_pipeline`/`tbl_framework`) — docelowo: ikona AI na railu prowadzi do TEGO zestawu, nie do drugiego, martwego wejścia | zależnie od akcji |
| `Plus` | Nowy wiersz | `workspace`/`table_row` | dodaje pusty wiersz na końcu | `tbl_add_row` — **działa** | tak |
| `Columns3` | Pola | `table_column` | dialog dodania kolumny + zarządzanie polami | `tbl_add_column` — **działa** | tak |
| `Filter` | Filtruj | `current_view` | otwiera panel filtrów | `tbl_filter` — **działa** | n/d |
| — | Sortuj | `table_column`/`current_view` | sortowanie wg kolumny | ⟦DO USTALENIA⟧ — dziś osiągalne z nagłówka kolumny/paska P15, nie potwierdzone jako pozycja raila w żadnym źródle | n/d |
| — | Grupuj | `current_view` | grupowanie wierszy wg pola | ⟦DO USTALENIA⟧ — analogicznie do Sortuj, brak potwierdzenia źródłowego dla pozycji na railu | n/d |
| — | Widoki | `current_view` | przełącznik 6 widoków (Grid/Kanban/Timeline/Kalendarz/Macierz/Galeria) | **dziś: myląca etykieta „Widok"** (`tbl_grid`) — to twardy reset do widoku Grid, NIE przełącznik; prawdziwy przełącznik 6 widoków istnieje, ale we własnym pasku tabeli, nie na railu — docelowo: ta pozycja ma otwierać/cyklować ten sam, realny przełącznik, nie duplikować martwą etykietę | n/d |
| `Undo2`/`Redo2` | Cofnij / Ponów | `current_view` | historia edycji tabeli | `tbl_undo`/`tbl_redo` — **działa, ale dwa niezależne silniki** (`nodesUndo` legacy vs `onPlatformUndo` P15) — zgodnie z D5 (Table → P15 docelowy, legacy wygaszany) docelowo zostaje **jeden** silnik | — |

Dodatkowo dziś obecne na railu Tabeli, poza rdzeniem wskazanym w tym rozdziale: **Dashboard** (`tbl_summary`, działa) — koncepcyjnie pasuje do zakładki Przegląd prawego panelu (statystyki, `07_PRAWY_PANEL.md` §4 pkt 3), nie do „szybkiej edycji"; ⟦DO USTALENIA⟧ czy zostaje na data-railu, czy przenosi się wyłącznie do Przeglądu.

### Zakaz — pojęcia canvasowe bez sensu w Tabeli

| Zakazane | Dlaczego |
|---|---|
| Ręka / tryb przesuwania | Tabela to siatka ze scrollem, nie płótno do panningu |
| Połącz (rysowanie krawędzi) | dane relacyjne w tabeli to pola/linki, nie swobodne krawędzie |
| Minimapa | nie ma przestrzeni canvasowej do miniaturyzacji |
| Gałąź jako jednostka | Tabela nie ma hierarchii gałęzi — jej jednostką jest wiersz |
| Tor (lane) | pojęcie procesowe, bez odpowiednika w danych tabelarycznych |

**Usunięte z raila Tabeli względem stanu dzisiejszego:** 4 przełączniki narzędzi, popover AI mindmapowy (zastąpiony realnym), popover Import/Eksport (martwy i dublujący realny „Importuj CSV"/„Eksportuj CSV" natywnego paska), popover Więcej narzędzi (13 pozycji semantycznie bez sensu w danych — fold-to-level, branch analysis), tryb kursora Zaznaczanie/Przesuwanie (semantycznie sierota w siatce danych).

## 8. Z3 — popovery muszą być świadome reprezentacji

Dzisiejszy root-cause większości martwych kliknięć na railu: popovery **AI**, **Import/Eksport** i **Więcej narzędzi** to jeden, wspólny komponent dla 4 narzędzi, który nie przyjmuje `activeTool` — renderuje zawsze identyczną, mindmapową treść, a akcje pod spodem (`mm_*`) mają odbiorcę wyłącznie w hooku zamontowanym tylko dla Mind Mapy (`useMindMapQuickActions`). Efekt: w Whiteboardzie, Process Flow i Tabeli te popovery wyglądają identycznie jak w Mind Mapie, ale w 80–100% pozycji nic nie robią po kliknięciu — bez żadnego komunikatu o błędzie.

**Wymóg wprost:** żaden popover raila nie może pokazywać akcji, dla której aktywna reprezentacja nie ma handlera. To nie jest wybór stylistyczny — to konsekwencja Z3.

**Mechanizm, który to wymusza:** rejestr akcji (`ActionRegistry`, `_RDZEN_STANDARDU_4_ZASADY_2026-07-23.md`). Każda akcja deklaruje pole `tools: Tool[] | 'all'`. Powierzchnie (w tym rail i jego popovery) **renderują się z rejestru**, filtrując po `tools`. Skoro popover przestaje ręcznie wypisywać stałą listę i zamiast tego pyta rejestr „jakie akcje mam pokazać dla `activeTool === 'whiteboard'`", fizycznie nie może wyrenderować akcji bez handlera dla tego narzędzia — bo taka akcja nie zadeklarowałaby `whiteboard` w `tools`. Po wdrożeniu rejestru scenariusz „ikona wygląda tak samo, ale nic nie robi" **przestaje być możliwy do wprowadzenia**, nie tylko naprawiony raz.

## 9. Znany defekt: rail nachodzący na pasek reprezentacji

Rail jest pływający (`createPortal` + pozycjonowanie `fixed`, wysoki z-index), zakotwiczony do lewej krawędzi obszaru roboczego. Własny pasek narzędzi danej reprezentacji (np. natywny pasek Tabeli z „Framework"/„Import"/kolumnami) zaczyna się od tej samej lewej krawędzi — struktura pozycjonowania powoduje, że rail **nachodzi na początek tego paska**, w zależności od szerokości/skalowania viewportu.

**Wymóg standardu:** rail **nie może nachodzić** na pasek własny żadnej reprezentacji, w żadnej szerokości ekranu obsługiwanej przez produkt. To jest twardy wymóg layoutu, nie estetyczna sugestia — patrz `03_ARCHITEKTURA_EKRANU.md` §2 „Twardy wymóg nienachodzenia". Naprawa: pasek własny reprezentacji musi rezerwować margines odpowiadający szerokości raila (albo rail musi przesuwać, nie nakładać, treść paska), weryfikowane zrzutem przy co najmniej dwóch szerokościach viewportu (wąski laptop, szeroki monitor).

## Kryteria odbioru

- [ ] Rail nie zawiera żadnej pozycji z listy zakazanej w §2.
- [ ] Szkielet czterowarstwowy (góra/środek/niżej/dół) z §3 jest zachowany identycznie w Mind Map, Whiteboard i Process Flow.
- [ ] Tier „góra" realnie steruje trybem kursora we wszystkich trzech płótnach (nie tylko w Mind Mapie).
- [ ] Whiteboard ma jeden spójny stan trybu interakcji (nie dwa równoległe: `interactionMode` i `whiteboardMode`).
- [ ] Każda pozycja tier „niżej" (Komentarz/Załącznik/AI) istnieje i działa w Mind Map, Whiteboard i Process Flow — nie tylko w Mind Mapie.
- [ ] Żaden popover raila nie pokazuje akcji bez handlera dla aktywnej reprezentacji (§8).
- [ ] Cofnij/Ponów w każdej reprezentacji raportuje własny, prawdziwy stan historii (żadne narzędzie nie dziedziczy stanu z innego).
- [ ] Process Flow ma realny przycisk dodania węzła Koniec, nie tylko Start.
- [ ] Etykieta „Tor" jest przetłumaczona (nie „Lane N").
- [ ] Table: rail (jeśli istnieje) zawiera wyłącznie pozycje z §7, zero pozycji z listy zakazu canvasowego.
- [ ] Table: jeden silnik Cofnij/Ponów, zgodny z kierunkiem D5 (P15).
- [ ] Rail nie nachodzi na pasek własny żadnej reprezentacji, przy żadnej testowanej szerokości ekranu (§9).
- [ ] Weryfikacja wzrokiem (zrzuty), oba motywy, wszystkie 4 reprezentacje.
