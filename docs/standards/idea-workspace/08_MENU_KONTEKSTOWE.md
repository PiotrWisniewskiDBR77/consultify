# 08 — Menu kontekstowe i pasek zaznaczenia

Ten rozdział ustala JEDNĄ zasadę rozstrzygającą, co pokazuje się po prawym kliku a co na pasku pływającym, kanoniczną kolejność pozycji w menu elementu, oraz domyka lukę, którą audyt znalazł niezależnie w 4 reprezentacjach: menu krawędzi i menu komórki tabeli albo nie istnieją, albo istnieją tylko w jednej reprezentacji. Standard opisuje stan DOCELOWY; różnice względem dzisiejszego kodu są zapisane wprost jako „dziś: … → docelowo: …".

Wszystkie pozycje menu poniżej są wpisami w **rejestrze akcji** (`_RDZEN_STANDARDU_4_ZASADY_2026-07-23.md`) — menu je tylko renderuje, filtrując po `tools` i `surfaces: ['context']` / `['floating']`. Menu kontekstowe samo w sobie nie ma logiki poza tym filtrowaniem.

## 1. Zasada nadrzędna: MIEJSCE vs ZAZNACZENIE

| | Menu kontekstowe | Pasek zaznaczenia |
|---|---|---|
| Co decyduje o treści | **miejsce kliknięcia** (tło / element / krawędź / kontener) | **co jest aktualnie zaznaczone** (0 / 1 / wiele / krawędź) |
| Wyzwalacz | prawy klik (lub „⋮" na elemencie, otwiera TO SAMO menu co prawy klik na tym elemencie) | automatyczny, natychmiast po zaznaczeniu — bez kliku |
| Znika | po kliku poza menu / Escape / wyborze pozycji | po odznaczeniu (Escape, klik na puste tło) |
| Scope akcji wewnątrz | zależny od miejsca: `current_view` (tło) · `single_item` (element) · `edge` · `lane_frame` (kontener) | zależny od liczby zaznaczonych: `single_item` · `selected_items` · `edge` |

**Zakaz mieszania:** menu kontekstowe NIE wolno warunkować stanem zaznaczenia sprzed kliknięcia (np. prawy klik na tle nie może pokazać akcji dla „tego, co było zaznaczone wcześniej” — to błąd, dziś obecny w Process Flow, patrz defekt D1 w §8). Pasek zaznaczenia NIE wolno otwierać prawym klikiem — pojawia się wyłącznie z zaznaczenia.

**Korekta nazewnicza (na podstawie audytu Mind Map):** przycisk „⋮" na pasku zaznaczenia elementu otwiera dokładnie to samo `NodeContextMenu`, co prawy klik na tym elemencie. To nie jest trzecia, osobna lista — to alternatywny wyzwalacz tego samego menu elementu. Standard tego wymaga we wszystkich 4 reprezentacjach (Z1).

## 2. Menu tła canvasu (prawy klik na pustym obszarze)

### Wspólne minimum (musi być identyczne we wszystkich reprezentacjach z płótnem — MM/WB/Process)

| Pozycja | Skrót | Zakres | Handler docelowy | Stan dziś |
|---|---|---|---|---|
| Dodaj element (podstawowy typ narzędzia) | N | `current_view` | `canvas.add_primary` | ✅ MM (`pane_add_node`) · ✅ WB (przez rail, nie menu tła) · ✅ Process (`Dodaj akcję`/`Dodaj decyzję`) |
| Kopiuj zaznaczenie | ⌘C | `selected_items` | `canvas.copy` | ✅ MM · ✖ WB (brak schowka, patrz D3) · ✖ Process (brak schowka) |
| Wytnij zaznaczenie | ⌘X | `selected_items` | `canvas.cut` | ✅ MM · ✖ WB · ✖ Process |
| **Wklej** | ⌘V | `current_view` | `canvas.paste` (wkleja w miejscu kliknięcia) | ✅ MM · ✖ WB (**brak pozycji w ogóle**) · ✖ Process (**etykieta „Wklej" realnie duplikuje zaznaczenie — defekt D1**) |
| **Zaznacz wszystko** | ⌘A | `current_view` | `canvas.select_all` | ✅ MM · ✖ WB (**brak**) · ⟦DO USTALENIA⟧ Process (nie potwierdzone w audycie) |
| **Dopasuj widok** | ⌘0 | `current_view` | `canvas.fit_view` | ✅ MM · ✖ WB (**brak w menu** — istnieje tylko jako ikona w rogu zoom) · ⟦DO USTALENIA⟧ Process |
| Auto-układ | ⌘L | `current_view` | `canvas.auto_layout` | ✅ MM · ✖ WB (nie dotyczy — brak układu drzewa) · ✅ Process |

**Defekt do naprawy — WHITEBOARD:** menu tła Whiteboardu ma dziś WYŁĄCZNIE 4 pozycje AI („AI: Wypełnij luki”, „AI: Brainstorm tutaj”, „AI: Przekształć w mapę myśli”, „AI: Przekształć w tabelę” — `src/components/MyWork/IdeaCanvasContextMenu.tsx`, zestaw `EMPTY_ACTIONS` filtrowany po `tools`). Brakuje całego wspólnego minimum: Wklej, Zaznacz wszystko, Dopasuj widok. Docelowo Whiteboard MUSI dostać te 3 pozycje nad sekcją AI, w tej samej kolejności co reszta menu tła (wspólne → specyficzne).

### Specyficzne per reprezentacja (dopisane do minimum, nie zamiast niego)

| Reprezentacja | Pozycje specyficzne w menu tła | Uzasadnienie (Z1) |
|---|---|---|
| Mind Map | Automatyczny układ (⌘L) · Auto-grupowanie · Zwiń wszystko/Pokaż poziom 1/2/Rozwiń wszystko (Alt+0/1/2/9) · AI: Zasugeruj węzły | hierarchia = istota mapy |
| Whiteboard | AI: Wypełnij luki · AI: Brainstorm tutaj · AI: Przekształć w mapę myśli · AI: Przekształć w tabelę | facylitacja/generatywność = istota tablicy |
| Process Flow | Dodaj akcję · Dodaj decyzję · Auto-układ | semantyka BPMN = istota procesu |
| Table | — (nie dotyczy, patrz §7 — Table nie ma „pustego płótna") | dane, nie płótno |

## 3. Menu elementu — stała kolejność (Z1, wiąże wszystkie reprezentacje)

Kolejność grup jest KANONICZNA i identyczna we wszystkich 4 reprezentacjach. Reprezentacja pomija grupę, której nie dotyczy — nie wolno zmieniać kolejności pozostałych.

**otwórz → edytuj → duplikuj → kopiuj/wytnij/wklej → struktura → AI → konwersja → wygląd → usuń**

| # | Grupa | Przykład MM | Przykład Process | Przykład Whiteboard | Przykład Table (wiersz) |
|---|---|---|---|---|---|
| 1 | Otwórz | Otwórz szczegóły | Otwórz właściwości | ⟦DO USTALENIA⟧ (brak dziś) | Edytuj (otwiera `RowDetailPanel`/`RecordExpandModal`) |
| 2 | Edytuj | Edytuj (F2) | Edytuj etykietę | Edytuj (`window.prompt`, docelowo inline) | — (patrz „otwórz”, dziś scalone) |
| 3 | Duplikuj | Duplikuj (⌘D) | Duplikuj | Duplikuj | Duplikuj wiersz |
| 4 | Kopiuj/Wytnij/Wklej | Kopiuj/Wytnij/Wklej | ✖ brak (D3) | ✖ brak, tylko „Kopiuj" tekstu etykiety (D4) | Kopiuj wiersz (tylko P15, patrz §7) |
| 5 | Struktura | Zwiń/rozwiń · Skup poddrzewo · Połącz z zaznaczonym · Odłącz/Duplikuj gałąź | Wstaw między (na krawędzi, nie tu — patrz §4) | Warstwa: na wierzch/pod spód · Zablokuj/Odblokuj | Wstaw wiersz nad/pod (tylko P15) |
| 6 | AI | Przeredaguj węzeł · Rozbuduj temat · Co jeśli · Podsumuj gałąź · Wykryj zależności · Priorytetyzacja · Konkurencja · Zasuguruj powiązania | AI: rewrite step | AI: Rozbuduj · AI: Kwestionuj · AI: Znajdź dowody · AI: Sugeruj połączenia · AI: Znajdź tematy · AI: Nazwij klastry · AI: Wyodrębnij akcje | ⟦DO USTALENIA⟧ (brak menu komórki/wiersza z AI dziś, patrz §7) |
| 7 | Konwersja | → Inicjatywa/Decyzja/Zadania (+ warianty „gałąź na…") | Konwertuj na inicjatywę | Promuj do decyzji/akcji (dziś na pasku zaznaczenia, nie w menu elementu — do ujednolicenia) | Convert ▾ (dziś tylko na pasku zaznaczenia bulk, §7) |
| 8 | Wygląd i dane | Zmień kształt · Kolor · Dodaj obraz · Głosuj · Komentarze · Notatki/Tagi · Dołącz artefakt/wiedzę · Kopiuj link | ⟦DO USTALENIA⟧ | Komentarze | ⟦DO USTALENIA⟧ |
| 9 | Usuń | Usuń (Del) | Usuń | Usuń | Usuń wiersz |

**Uwaga o duplikatach funkcjonalnych (Mind Map, do sprzątnięcia, nie do skopiowania w innych narzędziach):** „Rozbuduj temat" i „Pogłęb" wołają ten sam handler; „Skup poddrzewo" i „Drill down" — to samo; „→ Zadania (gałąź)" i „→ Zestaw zadań (gałąź)" — to samo; „Notatki" i „Tagi" otwierają ten sam drawer. Standard: jedna funkcja = jedna pozycja menu. Konsolidacja to osobne zadanie porządkowe, nie treść tego rozdziału.

## 4. Menu krawędzi — luka do zamknięcia (KAŻDA reprezentacja z połączeniami musi je mieć)

| Reprezentacja | Stan dziś | Docelowo |
|---|---|---|
| Mind Map | ✅ `EdgeContextMenu.tsx` — pełne menu prawego kliku | wzorzec |
| Process Flow | ◑ **tylko popover stylu przez LEWY klik** (`EdgeStylePopover`: etykieta, kolor, styl linii, kierunek strzałki) — **brak prawego kliku na krawędzi w ogóle** (`onEdgeContextMenu` nie zarejestrowane), **brak pozycji „Usuń krawędź"** w popoverze | dodać `EdgeContextMenu` analogiczny do Mind Map: Dodaj/edytuj etykietę · Wstaw węzeł na połączeniu · Odwróć kierunek · Zmień styl · Usuń połączenie. Popover stylu może zostać jako skrót z lewego kliku, ale prawy klik musi dawać pełne menu z Usuń |
| Whiteboard | ✖ **brak wszystkiego** — zero `onEdgeContextMenu`, zero popovera stylu; kliknięcie w okolicy łącznika trafia w element pod spodem albo nic nie robi | dodać pełne menu krawędzi (jak MM): edytuj etykietę, styl, kierunek, usuń |

**Docelowy wspólny zestaw pozycji menu krawędzi (kanon, wzorowany na Mind Map §2b `EdgeContextMenu.tsx`):**

| Pozycja | Zakres | Handler docelowy | Warunek dostępności |
|---|---|---|---|
| Dodaj/edytuj etykietę | `edge` | `edge.set_label` | zawsze (poza `locked`) |
| Wstaw węzeł na połączeniu | `edge` | `edge.insert_node` | tylko gdy scope to faktycznie zaznaczona krawędź (patrz defekt D2 §8 — dziś w Process to działanie wisi przy WĘŹLE) |
| Odwróć kierunek | `edge` | `edge.reverse` | tam gdzie kierunek ma znaczenie (relacja/strzałka), nie dla krawędzi strukturalnej drzewa |
| Zmień styl linii | `edge` | `edge.set_style` | zawsze |
| Usuń połączenie | `edge` | `edge.delete` | zawsze poza `locked`; w Mind Mapie dziś ograniczone do `isUserCreated` — do potwierdzenia czy to zostaje regułą docelową ⟦DO USTALENIA⟧ |

## 5. Menu kontenera (tor / ramka)

| Reprezentacja | Kontener | Stan dziś | Docelowo |
|---|---|---|---|
| Process Flow | Tor (lane) | Brak menu kontekstowego — operacje żyją jako stałe przyciski w nagłówku toru (`LaneSystem.tsx`: zwiń/rozwiń, przesuń góra/dół, kolor, usuń, resize-uchwyt). Prawy klik na pustym obszarze toru trafia w menu tła (§2), bez żadnej pozycji specyficznej dla toru | Zachować przyciski stałe w nagłówku (szybszy dostęp niż menu) JAKO WZORZEC; **dopisać** te same akcje (zwiń/kolor/usuń/przesuń) też do menu kontekstowego przy prawym kliku na nagłówku toru — dla spójności z resztą standardu (wszystko dostępne też z prawego kliku) |
| Whiteboard | Ramka (frame) | Grupuj/Rozgrupuj tylko z paska zaznaczenia (wymaga ≥2 zaznaczonych); brak dedykowanego menu prawego kliku „na ramce jako kontenerze” (dziś ramka dostaje to samo menu co każdy element, §3) | Dodać do menu elementu ramki pozycje kontenerowe: Rozgrupuj (gdy zaznaczenie zawiera ramkę), Zmień kolor obszaru, Usuń ramkę (zachowując zawartość) |
| Mind Map | — (nie ma kontenera w tym sensie; gałąź pełni rolę strukturalną, obsłużona w §3) | n/d | n/d |
| Table | — (moduły/widoki pełnią inną rolę, poza zakresem menu kontekstowego) | n/d | n/d |

## 6. Pasek zaznaczenia — 1 element / wiele / krawędź

| Tryb zaznaczenia | Co pokazuje pasek (wspólne) | Co dochodzi tylko przy wielu | Co dochodzi tylko dla krawędzi |
|---|---|---|---|
| **1 element** | edit · duplicate · comment · link · AI · style · convert selected · delete (kanon §01 kontraktu) | — | n/d |
| **Wiele (selected_items)** | duplicate · style (wspólne właściwości) · delete | Wyrównaj (lewo/środek/prawo/góra/środek-pion/dół, aktywne od 2) · Rozłóż (poziomo/pionowo, aktywne od 3) · Grupuj (od 2) · Rozgrupuj (gdy zaznaczenie zawiera kontener) | n/d |
| **Krawędź** | style · delete | n/d | edytuj etykietę, kierunek — patrz §4, dziś ten pasek nie istnieje dla krawędzi w żadnej reprezentacji poza pośrednio przez zaznaczenie w Mind Mapie ⟦DO USTALENIA⟧ dokładna treść paska dla zaznaczonej samej krawędzi |

**Stan dziś (referencja, żywo zweryfikowane w Whiteboard):** `WhiteboardSelectionBar` — Dołącz · Powiązane · Promuj do decyzji · Promuj do akcji · Wyrównaj (disabled przy 1) · Rozłóż (disabled <3) · Grupuj (disabled przy 1) · Rozgrupuj (disabled gdy brak ramki w zaznaczeniu) · Duplikuj · Zablokuj · Usuń — to najbliższy dzisiejszy wzorzec docelowego paska „wiele”, zgodny z tabelą powyżej.

**Mind Map — pasek 1 elementu (`FloatingNodeToolbar`), referencja bogatego wzorca:** Gałąź/Sąsiad → Edytuj → Zwiń/Rozwiń → Typ węzła/Semantyka/Styl linii/Auto-układ/Kolor/Czcionka/Pogrubienie → Powiązane artefakty/Szybkie zadanie → Konwertuj gałąź na… → Zablokuj → Szybka notatka/Tagi/Link → AI → „⋮" (otwiera menu elementu pełne, §1). Kolejność tego paska = ta sama logika co kolejność menu elementu (edytuj→struktura/wygląd→konwersja→AI→więcej), tylko spłaszczona do ikon zamiast listy.

## 7. Table — osobno (Rekord/Matryca, nie płótno)

Table nie ma „pustego płótna” do kliknięcia — nie dotyczy jej §2 i §5. Interakcje grupują się wokół wiersza, komórki, nagłówka kolumny i zaznaczenia wielu wierszy. **Kanon docelowy = P15** (decyzja D5 kontraktu: „Table: kierunek P15, legacy wygaszany"); poniżej opisany stan legacy tylko jako punkt odniesienia do migracji.

### 7a. Menu wiersza

| Pozycja | Legacy (dziś żywe) | P15 (docelowy kanon) |
|---|---|---|
| Edytuj | ✅ | ✅ (tryb edycji pierwszej edytowalnej komórki) |
| Dodaj notatkę | ✅ | ✅ (disabled z powodem, gdy brak pola long-text) |
| Wstaw wiersz nad/pod | ✖ brak | ✅ |
| Duplikuj wiersz | ✅ | ✅ |
| Kopiuj wiersz | ✖ brak | ✅ |
| Rozwiń rekord | ✖ brak | ✅ |
| Usuń wiersz | ✅ | ✅ |

Docelowo: zestaw P15 (bogatszy) obowiązuje jako JEDYNY. Migracja legacy→P15 dla istniejących tabel jest osobnym zadaniem danych (`⟦DO USTALENIA⟧` — luka L8 z `_CROSSCHECK_OPENAI_VS_AUDYT_2026-07-23.md`), nie treścią tego rozdziału.

### 7b. Menu komórki — DZIŚ NIE ISTNIEJE (luka)

Żadna z dwóch implementacji (legacy, P15) nie ma `onContextMenu` na pojedynczej komórce. Jedyne zastępniki: kopiowanie całej tabeli (legacy) albo `Ctrl/Cmd+V` + nawigacja klawiaturą po zaznaczeniu zakresu (P15). Docelowo menu komórki musi istnieć — minimalny zestaw:

| Pozycja | Zakres | Handler docelowy |
|---|---|---|
| Kopiuj | `table_cell` | `cell.copy` |
| Wklej | `table_cell` | `cell.paste` |
| Wyczyść wartość | `table_cell` | `cell.clear` |
| Wklej specjalnie (bez formatowania/tylko wartość) | `table_cell` | `cell.paste_special` |
| AI: uzupełnij (gdy kolumna typu generowanego) | `table_cell` | `cell.ai_fill` — **musi przejść przez propozycję**, patrz rozdział 09 |

### 7c. Menu nagłówka kolumny

| Pozycja | Legacy (dziś żywe, prawy klik) | P15 (dziś: brak prawego kliku w ogóle — wszystko przez toolbar/`FieldManager`) |
|---|---|---|
| Rename | ✅ | przez `FieldManager` |
| Sort | ✅ (duplikuje zwykły lewy klik) | przez klik ikony sortowania w nagłówku |
| Hide | ✅ | przez dropdown „Kolumny” |
| Delete | ✅ | przez `FieldManager` |
| Zmień typ pola | ✖ brak w obu trybach | ⟦DO USTALENIA⟧ — brak w źródłach, zaznaczone w audycie jako oczekiwana funkcja „Airtable parity”, nierozstrzygnięte |
| Zamroź kolumnę | ✖ brak w obu trybach | ⟦DO USTALENIA⟧ — jw. |

Docelowo: przywrócić prawy klik na nagłówku również w P15 (dziś regresja względem legacy — użytkownik traci funkcję bez ostrzeżenia przy przełączeniu Idei z legacy na platformową), z tym samym zestawem co legacy plus Zmień typ/Zamroź po rozstrzygnięciu.

### 7d. Zaznaczenie wierszy (pasek akcji masowych)

| Pozycja | Legacy | P15 |
|---|---|---|
| Licznik „N selected” | ✅ | ✅ |
| Convert ▾ (Initiative/Task/Decision) | ✅ | ✅ (kod zduplikowany — ryzyko rozjazdu, do konsolidacji w jedną implementację) |
| Delete | ✅ | ✅ |

Docelowo brak innych akcji masowych niż konwersja i usuwanie nie jest wystarczający wg audytu porównawczego z Airtable — ⟦DO USTALENIA⟧ czy dochodzi „ustaw wartość pola dla zaznaczonych” / „eksportuj zaznaczone” / „duplikuj zaznaczone”.

## 8. ⚠ Defekty do naprawy — zapisane wprost (nie tylko „stan dziś”, to są BUGI)

| ID | Defekt | Reprezentacja | Dowód (plik) | Naprawa wymagana |
|---|---|---|---|---|
| D1 | „Wklej" w menu tła realnie woła `duplicateSelected()` — duplikuje zaznaczenie zamiast wklejać ze schowka; brak schowka w ogóle (Ctrl+C/X/V niepodpięte) | Process Flow | `ProcessFlowContextMenu.tsx`, handler w `IdeaProcessFlowTool.tsx` (`getCanvasContextActions({onPaste: () => duplicateSelected()})`) | zaimplementować realny schowek (`canvas.copy`/`canvas.cut`/`canvas.paste`) zgodnie z wspólnym minimum §2; do czasu naprawy etykieta nie może brzmieć „Wklej” |
| D2 | „Wstaw między" wisi przy zaznaczonym WĘŹLE na pasku, ale funkcja wymaga zaznaczonej KRAWĘDZI — w typowym użyciu zawsze kończy się toastem błędu | Process Flow | `ProcessFlowFloatingToolbar.tsx` → `insertBetween()` sprawdza `edges.find(e => e.selected)` | przenieść przycisk na pasek zaznaczenia KRAWĘDZI (po dodaniu menu krawędzi §4) albo rozszerzyć `insertBetween` o działanie z zaznaczonego węzła (na jego wychodzącej krawędzi) |
| D3 | Delete na zaznaczonej krawędzi (bez zaznaczonego węzła) nic nie robi — `deleteSelected()` liczy `selectedCount` wyłącznie po węzłach i robi wczesny `return` przy 0 | Process Flow | `useProcessFlowNodes.ts` | rozszerzyć `deleteSelected` o gałąź dla zaznaczonych krawędzi |
| D4 | „AI: Sugeruj powiązania" (`ai_suggest_links`) w menu elementu (prawy klik/⋮) nic nie robi — `handleContextAction` nie ma tej gałęzi; ta sama pozycja DZIAŁA z paska AI (inny event) | Mind Map | `NodeContextMenu.tsx` akcja bez odpowiednika w `IdeaRecommendationMap.tsx handleContextAction` | dopisać brakującą gałąź w `handleContextAction`, jedna implementacja zamiast dwóch ścieżek do tej samej etykiety |
| D5 | Whiteboard „Kopiuj” na elemencie kopiuje wyłącznie tekst etykiety do schowka systemowego — nie tworzy schowka aplikacji do wklejenia całego elementu; brak „Wklej” w menu tła (patrz §2) sprawia że cykl kopiuj→wklej elementu na Whiteboardzie de facto nie istnieje | Whiteboard | `IdeaCanvasContextMenu.tsx` (`navigator.clipboard.writeText(etykieta)`) | zaimplementować realny schowek aplikacji analogiczny do Mind Map |
| D6 | Menu tła Whiteboardu ma tylko 4 pozycje AI, brak wspólnego minimum (Wklej/Zaznacz wszystko/Dopasuj widok) | Whiteboard | `IdeaCanvasContextMenu.tsx` `EMPTY_ACTIONS` filtr `tools` | patrz §2 |
| D7 | Brak menu krawędzi w Whiteboard i brak prawego kliku na krawędzi w Process Flow (tylko lewoklikowy popover stylu, bez „Usuń") | Whiteboard, Process Flow | brak `onEdgeContextMenu` w obu plikach narzędzi | patrz §4 |
| D8 | Brak menu komórki w Table (oba tryby) | Table | brak `onContextMenu` w `PlatformCellRenderer.tsx`/`GridView.tsx`/`CellEditor.tsx`/legacy | patrz §7b |
| D9 | P15 nie ma prawego kliku na nagłówku kolumny w ogóle — regresja funkcjonalna względem legacy przy przełączeniu Idei między trybami | Table (P15) | `ViewRouter.tsx`/`PlatformGridView` — brak `onContextMenu` na `<th>` | patrz §7c |
| D10 | Menu tła w P15 zablokowane (`locked`) daje `preventDefault()` bez otwarcia menu — brak informacji zwrotnej, że akcja jest niedostępna | Table (legacy nagłówek kolumny) | `IdeaTableTool.tsx:2922` | zamiast cichego braku menu, otworzyć menu ze wszystkimi pozycjami `disabled` + `disabledReason` (Z3) |

## Kryteria odbioru

- [ ] Menu tła każdej z 3 reprezentacji canvasowych (MM/WB/Process) zawiera wspólne minimum: Wklej, Zaznacz wszystko, Dopasuj widok — w tej kolejności, nad sekcją specyficzną.
- [ ] Whiteboard ma realny schowek aplikacji (kopiuj/wytnij/wklej elementu), nie tylko kopię tekstu etykiety.
- [ ] Menu elementu w każdej reprezentacji zachowuje kolejność: otwórz→edytuj→duplikuj→kopiuj/wytnij/wklej→struktura→AI→konwersja→wygląd→usuń (pomijając grupy, które nie dotyczą tej reprezentacji, bez zmiany kolejności pozostałych).
- [ ] Każda z 3 reprezentacji z krawędziami (MM/WB/Process) ma pełne menu krawędzi z prawego kliku: etykieta, wstaw węzeł, kierunek, styl, usuń.
- [ ] Delete na zaznaczonej krawędzi w Process Flow usuwa krawędź (D3 naprawiony).
- [ ] „Wklej" w Process Flow wkleja ze schowka, nie duplikuje zaznaczenia (D1 naprawiony).
- [ ] „Wstaw między" działa z sensownej powierzchni zaznaczenia, bez domyślnego toastu błędu przy typowym użyciu (D2 naprawiony).
- [ ] „AI: Sugeruj powiązania" działa identycznie z menu elementu i z paska AI w Mind Mapie (D4 naprawiony).
- [ ] Menu kontenera (tor Process Flow, ramka Whiteboard) dostępne też z prawego kliku, nie tylko z przycisków stałych/paska zaznaczenia.
- [ ] Pasek zaznaczenia rozróżnia poprawnie tryb 1/wiele/krawędź, z regułami `disabled` zgodnymi z §6.
- [ ] Table ma menu komórki (kopiuj/wklej/wyczyść/wklej specjalnie/AI uzupełnij z propozycją) w kanonie P15.
- [ ] Table P15 ma prawy klik na nagłówku kolumny (D9 naprawiony), z zestawem ≥ legacy.
- [ ] Żadna pozycja menu nie jest cichym no-op — każda ma albo działający handler, albo widoczny `disabledReason` (Z3).
- [ ] Weryfikacja wzrokiem (zrzuty), light i dark, dla każdej z 4 reprezentacji — nie tylko „kod wygląda poprawnie”.
