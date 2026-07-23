# 05 — Menu 3 (akcje aktualnej reprezentacji)

Menu 3 to drugi pasek, tuż pod Menu 1, i odpowiada wyłącznie za akcje na **aktualnej
reprezentacji** — w przeciwieństwie do Menu 1 (cała Idea) i prawego dolnego rogu (przełącznik
reprezentacji, D2). To ognisko root-cause #1 z audytu: mechanizm dziś jest wspólny
(`buildIdeaMenu3Actions` w `ideaCanvasMelsChips.ts`), ale napisany pod Mind Map i tylko
częściowo dostosowany do pozostałych 3 narzędzi — część przycisków wygląda identycznie
dostosowana (inna etykieta, inna ikona), a pod spodem woła handler, którego dane narzędzie nie
rozumie. Ten rozdział ustala docelowy układ per reprezentacja i wprost nazywa, co dziś jest
martwe.

## 1. Rola

Menu 3 pokazuje akcje, które mają sens **tylko w kontekście tego, co jest teraz na płótnie/w
tabeli** — dodawanie elementów, układ, AI dla widoku, szablony, import/eksport pliku. Zmiana
reprezentacji nie zmienia Menu 1 (identyczne), ale całkowicie zmienia zawartość Menu 3.

## 2. Co wolno / czego NIE

| Wolno | Czego NIE |
|---|---|
| Akcje o zakresie `current_view` / `selected_items` operujące na treści aktywnej reprezentacji | Akcje o zakresie `workspace` dotyczące CAŁEJ Idei (Usuń Ideę, Duplikuj Ideę) — to Menu 1 |
| Dodawanie elementów specyficznych dla narzędzia | Convert całej Idei jako primary — to ma własne miejsce w Menu 1 (§04 §6); Convert fragmentu ma scope węższy i żyje w menu zaznaczenia/węzła, nie w Menu 3 (D6 — „Create from map"/„Utwórz z mapy" jako skrót do Convert jest ZAKAZANE, patrz §4.1) |
| AI dla widoku/zaznaczenia | Przełącznik reprezentacji (D2 — prawy dolny róg, nie tu) |
| Szablony filtrowane po aktywnym narzędziu | Zakładka „Akcje" prawego panelu (D1 — ta zawartość jest w Menu 1/kebab, nie w Menu 3) |
| Import/Eksport pliku dla aktualnej reprezentacji | Duplikowanie akcji już obecnych w lewym railu bez jasnego uzasadnienia (ryzyko z audytu 07 — dublowanie ma być świadome, nie przypadkowe) |

## 3. Wspólny szkielet

| Strona | Sloty (w kolejności) |
|---|---|
| Lewa | tryb → tworzenie → układ → AI → Szablony |
| Prawa | Import → Eksport → Więcej |

Nie każda reprezentacja wypełnia każdy slot — „tryb" istnieje tam, gdzie reprezentacja ma
rzeczywiście tryby pracy (Process Flow: Classic/Automation/VSM; Whiteboard: warsztat/board); Mind
Map i Table nie mają odpowiednika „trybu" w tym sensie, więc zaczynają od „tworzenie". Różnice
per narzędzie muszą być jawnie wymienione (Z1) — tabela niżej to robi dla każdej reprezentacji, w
zgodzie z tabelą „Specyficzne" rdzenia standardu (`_RDZEN_STANDARDU_4_ZASADY_2026-07-23.md`):
Mind Map = poziomy/gałąź/auto-układ drzewa; Whiteboard = tryb warsztatowy; Process Flow = typ
przepływu + semantyka + walidacja; Table = widoki/pola/filtr-sort-grupowanie.

**Ważne zastrzeżenie architektoniczne (dziś):** to, co user widzi jako „pasek pod Menu 1", to
często DWA niezależne komponenty ułożone jeden pod drugim — pasek powłoki (`IdeaCanvasSecondBar`,
wspólny mechanizm, przedmiot tego rozdziału) i wewnętrzny pasek narzędzia (np.
`ProcessFlowToolbar.tsx`, `WhiteboardToolbar.tsx`), który dziś niesie większość realnie działających
akcji. Tabele niżej pokazują OBIE warstwy tam, gdzie to konieczne do zrozumienia, gdzie dana
funkcja dziś naprawdę mieszka — standard docelowy konsoliduje je w jeden pasek Menu 3 zgodny ze
wspólnym szkieletem powyżej.

## 4. Mind Map

Docelowy układ: **Dodaj węzeł | Układ | Poziomy | AI | Szablony** + **Eksport | Więcej**

| Pozycja | Slot | Co robi | Zakres | Handler docelowy | Stan dzisiejszy |
|---|---|---|---|---|---|
| Dodaj węzeł | tworzenie | Dodaje węzeł-dziecko do zaznaczonego węzła (lub do korzenia) | `single_item`/`workspace` | `map.add_child` (dziś: `mm_add_child` → `handlers.addChildNode`) | ✅ działa |
| Układ | układ | Rekurencyjny auto-układ drzewa (korzeń lewo, dzieci wachlarzem) | `current_view` | `map.auto_layout` (dziś: event `pane_auto_layout` na kanale `idea-mindmap-node-quick-action`) | ✅ działa |
| Poziomy | specyficzne MM | Zwiń/rozwiń poziomy hierarchii — dziś rozproszone: „Pokaż poziom" w menu tła (`mm_pane_show_level`), zwijanie per-węzeł w menu węzła | `current_view` | `map.toggle_levels` — ⟦DO USTALENIA⟧ dokładna interakcja (dropdown poziom 1–N czy proste rozwiń/zwiń wszystko) | dziś: rozproszone (menu tła + menu węzła), NIE w Menu 3 → docelowo: scalone w jednym przycisku Menu 3 |
| AI | AI | AI rozwija zaznaczoną gałąź (lub korzeń) o 5 nowych podwęzłów, jako propozycja do akceptacji | `selected_items`/`workspace` | `map.ai_expand` (dziś: `mm_ai_expand` → `Api.expandMyIdeaMap`, `proposeOnly:true`) | ✅ działa, proposal-first |
| Szablony | Szablony | Otwiera galerię szablonów filtrowaną po `tool='mindmap'` | `current_view` | `templates.open` (dziś: `setTemplateGalleryOpen`) | ✅ działa |
| Eksport | prawa: Eksport | Eksport mapy do pliku (PNG/SVG/PDF/…) | `workspace` | `export.open` (dziś: `IdeaExportMenu`, disabled gdy pusta) | ✅ działa |
| Więcej | prawa: Więcej | Rzadsze akcje mapy (importy specjalizowane, itd.) | `current_view` | ⟦DO USTALENIA⟧ zawartość | dziś: NIE ISTNIEJE jako osobna pozycja — miejsce zajmuje „Utwórz z mapy" (patrz §4.1) |

### 4.1. „Utwórz z mapy" znika z Menu 3

Dziś: przycisk „Utwórz z mapy" (`GitBranch`) zajmuje prawy slot zamiast „Więcej". Klika →
`handlePanelChange('tools')`, co jedynie otwiera prawy panel inspektora na akordeonie, w którym
sekcja „Convert" jest domyślnie zwinięta — etykieta obiecuje akcję („utwórz"), a wykonuje tylko
nawigację. Pod domyślną flagą (`ff_melsCanvas` ON) prowadzi dziś do panelu, który i tak nie
przełącza sekcji (patrz `_PRAWY_PANEL_IDEE`) — **martwe w praktyce**.

**Docelowo:** ten przycisk **znika z Menu 3 całkowicie** (D6 — „Create from map" zakazane jako
koncept; Convert ma jedno miejsce dla całej Idei — Menu 1 — i osobne, jawnie nazwane miejsca dla
zakresu węższego — menu węzła/gałęzi, pasek zaznaczenia). Prawy slot Menu 3 dla Mind Map przechodzi
na wspólny szkielet: Eksport + Więcej.

## 5. Whiteboard

Docelowy układ: **Warsztat | Dodaj | Rozmieść | AI | Szablony** + **Zapisz widok | Eksport | Więcej**

| Pozycja | Slot | Co robi | Zakres | Handler docelowy | Stan dzisiejszy |
|---|---|---|---|---|---|
| Warsztat | tryb | Otwiera/pokazuje panel sesji facylitacji (rola, faza, głosowanie, timer, follow-me) | `workspace` | `wb.workshop_panel` | dziś: NIE w Menu 3 — osobny pływający panel „WARSTWA SESJI" w lewym górnym rogu płótna (`WhiteboardSessionPanel`+`WhiteboardPhaseBar`), realny backend (`facilitationPhaseMachine.ts`), ale bez wejścia z Menu 3 |
| Dodaj | tworzenie | Dodaje domyślny element (notatkę) + dropdown pełnej listy (8 kolorów notatki, blok tekstowy, ramka, 4 kształty, obraz, karta linku) | `current_view` | `wb.add_element` (dziś realnie działa TYLKO przez „Utwórz ▾" w osobnym wewnętrznym pasku `WhiteboardToolbar.tsx`) | dziś w Menu 3: ✖ **MARTWE** — wysyła `add_node`, którego `useWhiteboardQuickActions` nie rozpoznaje (rozpoznaje tylko prefiks `wb_add_*`) |
| Rozmieść | układ | Wyrównaj/rozłóż zaznaczone elementy (align/distribute) | `selected_items` | `wb.arrange` (kod istnieje jako `wb_group`/`wb_distribute_*`, ale bez UI — audyt: „kod bez UI") | dziś: BRAK w Menu 3 i brak jakiegokolwiek przycisku — funkcja kompletna w kodzie, osierocona |
| AI | AI | Uruchamia domyślny generator AI Whiteboardu (np. „znajdź tematy") + dostęp do pozostałych | `selected_items`/`current_view` | `wb.ai_default` (dziś realne generatory: `wb_ai_find_themes`/`wb_ai_name_clusters`/`wb_ai_extract_actions`/`wb_ai_to_map`/`wb_ai_to_table`, dostępne tylko z prawego panelu/skrótów) | dziś w Menu 3: ✖ **MARTWE** — wysyła `mm_ai_expand`/`mm_ai_summarize`, których Whiteboard nie obsługuje |
| Szablony | Szablony | Otwiera galerię szablonów whiteboardowych (min. 6 pozycji z `tool:'whiteboard'`) | `current_view` | `templates.open` | ✅ działa |
| Zapisz widok | prawa (zastępuje Import — WB nie ma dedykowanego importu w Menu 3) | Zapisuje bieżący viewport jako nazwaną „scenę"; ≥2 sceny → tryb Prezentuj | `current_view` | `wb.save_view` (dziś: `IdeaScenesManager`, realnie działa, ale w prawym górnym rogu płótna, NIE w Menu 3) | dziś: działa, ale poza Menu 3 — docelowo wchodzi w prawy slot |
| Eksport | prawa: Eksport | Eksport tablicy do pliku | `workspace` | `export.open` | ✅ działa |
| Więcej | prawa: Więcej | Rzadsze akcje (wzór tła, głosowanie/rola/śledź jeśli nie zmieszczą się w Warsztat, skróty) | `current_view` | ⟦DO USTALENIA⟧ dokładny podział z wewnętrznym „…" paska narzędzia | dziś: NIE w Menu 3 — istnieje jako „…" More WEWNĄTRZ `WhiteboardToolbar.tsx` (osobny pasek pod Menu 3) |

**Uwaga architektoniczna:** cztery z ośmiu pozycji docelowych (Warsztat, Rozmieść, Zapisz widok,
Więcej) dziś w ogóle nie żyją w Menu 3 — żyją w trzech różnych miejscach (panel sesji pływający,
kod bez UI, prawy górny róg płótna, wewnętrzny pasek narzędzia). To większa konsolidacja niż samo
„naprawienie routingu" (jak w Mind Map/Process Flow) — wymaga przeniesienia UI, nie tylko zmiany
handlera.

## 6. Process Flow

Docelowy układ: **Typ przepływu | Dodaj element | Tor | Auto-układ | Waliduj | AI | Szablony** +
**Eksport | Więcej**

| Pozycja | Slot | Co robi | Zakres | Handler docelowy | Stan dzisiejszy |
|---|---|---|---|---|---|
| Typ przepływu | tryb | Przełącza paletę i reguły walidacji: Klasyczny przepływ / Automatyzacja / Strumień wartości (VSM) | `current_view` | `flow.set_mode` | dziś: działa, ale w WEWNĘTRZNYM pasku `ProcessFlowToolbar.tsx`, nie w Menu 3 powłoki |
| Dodaj element | tworzenie | Wstawia węzeł wybranego kształtu (Start/Koniec/Akcja/Decyzja, zależnie od typu przepływu) | `current_view` | `flow.add_element` (dziś realnie: `addNode(shape)` w wewnętrznym pasku) | dziś w Menu 3 powłoki: ✖ **MARTWE** — wysyła `add_node`, `useProcessFlowQuickActions` rozumie tylko prefiks `pf_*` |
| Tor | specyficzne PF | Dodaje nowy lane/tor odpowiedzialności | `lane_frame` | `flow.add_lane` (dziś: `addLane()`, wewnętrzny pasek) | dziś: działa, ale poza Menu 3 powłoki |
| Auto-układ | układ | Przelicza pozycje kroków algorytmem układu | `current_view` | `flow.auto_layout` (dziś realnie działa TYLKO w „Więcej → Auto układ" wewnętrznego paska — `handleAutoLayout()`, z `toast.success`) | dziś w Menu 3 powłoki: ✖ **MARTWE** — wysyła zdarzenie `idea-mindmap-node-quick-action` (zła nazwa kanału I zły prefiks), Process Flow nasłuchuje `idea-workspace-quick-action` |
| Waliduj | specyficzne PF | Uruchamia `validateFlow.ts`, aktualizuje wskaźnik ostrzeżeń | `current_view` | `flow.validate` (dziś: `runValidation()`, tylko w „Więcej" wewnętrznego paska) | dziś: NIE ISTNIEJE w Menu 3 powłoki wcale — działa wyłącznie z wewnętrznego dropdownu „Więcej" |
| AI | AI | AI analizuje/przepisuje proces (AI Coach lub Propozycja AI) | `current_view`/`single_item` | `flow.ai_default` (dziś realne: `runProcessCoach()`, `AIProposalPanel`, `pf_edit_step_ai` — rozrzucone po „Więcej"/menu węzła) | dziś w Menu 3 powłoki: ✖ **MARTWE** — wysyła `mm_ai_expand`, Process Flow tego nie zna |
| Szablony | Szablony | Bogata galeria (Pusty proces, PDCA, Order-to-Cash, VSM, BPMN Approval, ADKAR…) z filtrami | `current_view` | `templates.open` | ✅ działa |
| Eksport | prawa: Eksport | PNG/SVG/PDF/Markdown/pakiet diagramu/raport/manifest/prezentacja + import draw.io/BPMN | `workspace` | `export.open` (`IdeaExportMenu`) | ✅ działa, ALE równolegle istnieje osobny, starszy mechanizm `useProcessFlowExport`/`ExportDialog.tsx` (PNG/JSON) — **duplikat kodu do skonsolidowania**, docelowo tylko `IdeaExportMenu` |
| Więcej | prawa: Więcej | Reszta: KPI, Podsumuj, Odczyt, Duplikuj, Usuń, Zapytaj AI o proces | `current_view`/`selected_items` | `flow.more.*` | dziś: wewnętrzny dropdown „Więcej akcji" niesie WSZYSTKO (włącznie z Waliduj/Auto-układ/AI, które w docelowym układzie dostają własne miejsce w Menu 3 głównym) + martwą sekcję „Convert" (kod istnieje — `onConvert` prop — ale nie renderuje się w trybie MELS, bo Menu 1 przejęło Convert) |

**Naprawa root-cause #1 dla Process Flow (3 pozycje martwe w Menu 3 powłoki: Dodaj element,
Auto-układ, AI):** wszystkie trzy mają realny, działający odpowiednik gdzie indziej (paleta
kształtów, „Więcej → Auto układ", „Więcej → AI Coach/Propozycja AI"). Naprawa = rozgałęzić
`onAddPrimary`/`onAutoLayout`/`onAIExpand` w `melsMenu3Actions` (`IdeaMapWorkspace.tsx` ~l.2919) po
`activeTool==='process_flow'` na handlery `pf_*`, zamiast reużywać literały Mind Mapy.

### 6.1. Wskaźnik walidacji — stan początkowy „Niezwalidowane"

**Stan dzisiejszy — pułapka UX:** licznik obok „Waliduj" startuje z pustej listy ostrzeżeń
(`useState([])`) i pokazuje **„Brak ostrzeżeń"** (zielony badge) od momentu wejścia na ekran —
zanim ktokolwiek kliknął „Waliduj" choćby raz. Wygląda jak „sprawdzono, wszystko OK", a znaczy
„nikt jeszcze nie sprawdzał".

**Standard docelowy:** stan startowy wskaźnika to **neutralny badge „Niezwalidowane"** (nie
zielony, nie sugerujący wyniku). Dopiero po realnym uruchomieniu walidacji (klik „Waliduj", albo
— ⟦DO USTALENIA⟧ — automatyczne przeliczenie z debounce po każdej zmianie grafu, opcja wspomniana
w cross-checku jako do rozważenia, nie rozstrzygnięta) wskaźnik przechodzi na **„Brak ostrzeżeń"**
(zielony, realny wynik) albo **„Ostrzeżenia N"** (żółty/czerwony, z listą).

| Stan | Etykieta | Kolor | Kiedy |
|---|---|---|---|
| Początkowy | Niezwalidowane | neutralny | przed pierwszym uruchomieniem walidacji w tej sesji |
| Po walidacji, czysto | Brak ostrzeżeń | zielony (sukces) | po `runValidation()`, `warnings.length === 0` |
| Po walidacji, problemy | Ostrzeżenia N | ostrzegawczy | po `runValidation()`, `warnings.length > 0` |

## 7. Table

Docelowy układ: **Widoki | Dodaj wiersz | Pola | Organizuj | AI | Szablony** + **Import | Eksport | Więcej**

**Zastrzeżenie architektoniczne najważniejsze w tym rozdziale:** Table jest jedyną z 4
reprezentacji, która **NIE korzysta ze wspólnej powłoki Menu 3** (`IdeaCanvasSecondBar`) w ogóle —
ma całkowicie własny, dużo bogatszy pasek (`P15TableToolbar` w trybie platformowym /
JSX-legacy w `IdeaTableTool.tsx`), niezależny od `ideaCanvasMelsChips.ts`. To jest największe
odstępstwo od Z1 (analogiczność) w całym module — nie defekt routingu jak w WB/PF, tylko brak
wspólnego szkieletu od podstaw.

| Pozycja | Slot | Co robi | Zakres | Handler docelowy | Stan dzisiejszy |
|---|---|---|---|---|---|
| Widoki | specyficzne Table | Zakładki zapisanych widoków (Domyślny/Triażowanie/Scoring/Log decyzji/Timeline/+) — ustawia sort/filtr/grupowanie/layout naraz | `current_view` | `table.apply_view` | ✅ działa (`useTableViews.ts`); legacy: nietrwałe między sesjami, platforma: trwałe w bazie |
| Dodaj wiersz | tworzenie | Dodaje pusty wiersz na końcu | `current_view` | `table.add_row` (dziś realnie działa TYLKO we własnym pasku Table, nie przez powłokę) | dziś w Menu 3 powłoki (gdyby był użyty): ✖ martwe — `add_node`, Table zna tylko `tbl_*`; **w praktyce Table nie renderuje powłoki Menu 3**, więc to ryzyko teoretyczne, nie zaobserwowane na żywo |
| Pola | specyficzne Table | Pokaż/ukryj/dodaj kolumnę; w platformie: „Zarządzaj polami" (`FieldManager`) | `table_column` | `table.manage_fields` | ✅ działa |
| Organizuj | specyficzne Table | Filtr (szybki + zaawansowany), Grupuj, przełącznik 6 layoutów (Grid/Kanban/Timeline/Kalendarz/Macierz/Galeria) | `current_view` | `table.organize` | ✅ działa; **uwaga**: przycisk filtra zaawansowanego nie ma `title`/tooltipu — jedyny bez natywnego hover-hintu w całym pasku |
| AI | AI | Asystent AI schematu tabeli (propozycje kolumn/widoków/wierszy) + AI Fill (batch, gdy są puste komórki) | `current_view`/`table_column` | `table.ai_assistant` | ✅ działa, ale to **najsłabszy z 3 silników AI** w całym module — żadna operacja tabeli nie idzie przez pełny proposal-review jak Mind Map/Whiteboard/Process (luka M6 cross-checku) |
| Szablony | Szablony | Biblioteka szablonów wierszy/tabel | `current_view` | `templates.open` | ✅ działa |
| Import | prawa: Import | Import CSV + (legacy) Connector Wizard dla zewnętrznych źródeł | `current_view` | `table.import` | ✅ CSV działa obie wersje; Connector Wizard działa w legacy, **osierocone w P15** (`onShowConnectorWizard` w interfejsie, nigdy nierenderowane jako przycisk) |
| Eksport | prawa: Eksport | Eksport CSV | `workspace` | `export.open` | ✅ działa |
| Więcej | prawa: Więcej | Pozostałe ~16 „drugorzędnych narzędzi": AI Kategoryzacja, Model scoringowy, Eksport do prezentacji, Pipeline pomysłów, AI Copilot, Głos/Obraz, Relacje między tabelami, Heatmapa, Historia zmian, Aktywność, Skróty klawiszowe, Dystrybucja, Generator frameworków, Formatowanie warunkowe, Paleta kolorów | zależnie od pozycji | `table.more.*` | **P15: zwinięte pod „…"** (poprawny wzorzec — Doktryna Gęstości). **Legacy: stoją PŁASKO, bez kolapsu** — dokładnie zakazany przez kontrakt redakcyjny wzorzec „płaski rząd 20 ikon" (crosscheck, zakaz OpenAI potwierdzony 1:1 przez audyt) |

**Naprawa najpilniejsza dla Table:** ujednolicić z resztą — albo (a) Table dostaje wspólną powłokę
Menu 3 zgodną ze szkieletem §3, z własnym paskiem specyficznym niżej (analogicznie do „wewnętrzny
pasek narzędzia" WB/PF), albo (b) świadomie zostaje przy własnym, bogatszym paskiem, ale **legacy
musi przejąć kolaps „…" z P15** (D5 — Table: kierunek P15, legacy wygaszany — to samo rozstrzygnięcie
zamyka też ten problem: gdy legacy wygaśnie, „płaski rząd" znika sam).

## 8. Standard „Więcej" (overflow)

Zasady obowiązujące „Więcej"/„…" we wszystkich 4 reprezentacjach:

1. **Jeden wspólny mechanizm.** Dziś istnieją **3 niezależne implementacje** „More"/„…" (dropdown
   wewnętrzny Process Flow, kolaps P15 vs płaski rząd legacy w Table, popover „Więcej narzędzi"
   railа działający tylko w Mind Mapie) — to dług utrzymaniowy wysokiego ryzyka (audyt 07, sekcja
   14). Docelowo: jeden komponent overflow, reużywany przez wszystkie 4 Menu 3.
2. **Nigdy nie chowa najczęstszych akcji.** Overflow jest dla akcji RZADSZYCH — nie wolno w nim
   chować czegoś tak częstego jak Dodaj/AI/Auto-układ (to był błąd domyślnego układu, który
   doprowadził do mylącego dublowania w Process Flow — „Auto-układ" widoczne w Menu 3 martwe, a
   działający odpowiednik ukryty 2 kliknięcia głębiej w „Więcej").
3. **Zero pozycji bez efektu.** Każda pozycja w „Więcej" musi mieć realny handler (Z3) — martwe
   sekcje jak dzisiejsza „Convert" w Process Flow „Więcej" (kod istnieje, `onConvert` nie jest
   przekazywane w trybie MELS) znikają całkowicie, nie zostają jako martwy relikt.
4. **Dostępne Teresie.** Każda pozycja w overflow ma wpis w rejestrze akcji (Z4) — bycie „w
   overflow" to kwestia UI, nie powód do pominięcia w tool-manifeście Teresy.
5. **Etykieta i ikona spójne ze wszystkimi innymi wystąpieniami tej samej akcji** (Z1) — jeśli
   „Duplikuj" jest też dostępne z menu kontekstowego, oba wystąpienia mają identyczną etykietę i
   ikonę (rejestr akcji to gwarantuje z definicji).

## Kryteria odbioru

- [ ] Każda reprezentacja pokazuje dokładnie zestaw pozycji ze swojej tabeli (§4–§7) — bez pozycji nawiązujących do innego narzędzia (`mm_*` poza Mind Map, itd.).
- [ ] Zero martwych kliknięć: każdy przycisk lewej i prawej strony Menu 3 wywołuje realny, widoczny efekt (mutacja grafu, otwarcie modala, toast) — sprawdzone klikiem na żywo w każdej z 4 reprezentacji, oba motywy.
- [ ] „Utwórz z mapy"/„Create from map" nie istnieje nigdzie w Menu 3 żadnej reprezentacji (D6).
- [ ] Wskaźnik walidacji Process Flow pokazuje „Niezwalidowane" (neutralny) zanim ktokolwiek uruchomił „Waliduj" w danej sesji — nigdy zielone „Brak ostrzeżeń" jako stan startowy.
- [ ] Auto-układ w Menu 3 Process Flow daje ten sam efekt (i ten sam `toast.success`) co „Więcej → Auto układ" — jedno źródło prawdy, nie dwa niezależne wejścia z różnym rezultatem.
- [ ] AI w Menu 3 (wszystkie 4 reprezentacje) uruchamia realny silnik AI danego narzędzia — nigdy `mm_ai_expand` poza Mind Mapą.
- [ ] „Więcej" każdej reprezentacji zbudowane tym samym wspólnym komponentem overflow, nie trzema niezależnymi mechanizmami.
- [ ] Table: żaden tryb (legacy ani P15) nie pokazuje płaskiego rzędu >8 ikon bez kolapsu.
- [ ] Wszystkie pozycje tabel §4–§7 mają wpis `teresa.description` w rejestrze akcji.
- [ ] Rzeczy oznaczone `⟦DO USTALENIA⟧` w tym rozdziale mają właściciela decyzji zanim wejdą do implementacji — nie są domyślnie zgadywane przez wykonawcę.
