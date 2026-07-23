# 10 — Konwersja, Eksport, Import, Szablony

Ten rozdział kończy z myleniem czterech operacji, które dziś noszą pokrewne nazwy, ale robią zupełnie różne rzeczy: Konwersja tworzy artefakt, Eksport tworzy plik, Import wprowadza dane z zewnątrz, Szablon aplikuje gotową strukturę. Standard opisuje docelowe rozróżnienie, zakresy, wymogi bezpieczeństwa (podgląd/potwierdzenie/cofnięcie) i likwiduje etykiety, które dziś kłamią o tym, co robią.

## 1. Twarde definicje i rozróżnienia

Sześć pojęć, które w dzisiejszym kodzie i UI się mieszają. Standard wymaga, żeby każde miało jedno, niezamienne znaczenie.

| Pojęcie | Definicja | Zmienia dane Idei? | Tworzy nowy byt poza Ideą? | NIE mylić z |
|---|---|---|---|---|
| **Przełączenie reprezentacji** | Pokazanie TEGO SAMEGO grafu innym narzędziem (`setActiveTool`) | Nie — zero I/O | Nie | Konwersją, generowaniem reprezentacji |
| **Generowanie reprezentacji** | Wygenerowanie treści JEDNEJ reprezentacji na bazie innej (np. proces z mapy) — `⟦DO USTALENIA⟧`, poza tym standardem (D3: osobny projekt „mapowanie semantyczne") | Docelowo: tak, ale w ramach TEJ SAMEJ Idei | Nie | Przełączeniem (to nie jest zmiana widoku, to nowa treść), Konwersją (artefakt zostaje w Idei, nie wychodzi z niej) |
| **Nowy obiekt Idea** | Utworzenie NOWEJ Idei — z draftu, z notatnika, z czatu/Teresy, z innego typu obiektu MyWork | — (Idea jest CELEM, nie źródłem) | Tak — nowy wiersz `my_ideas` | Konwersją Idei DO artefaktu (kierunek odwrotny) |
| **Konwersja do artefaktu** | Czyta graf Idei (całość lub fragment) i TWORZY trwały, osobny rekord w innym module (Initiative/Task/Decision/Report/Presentation/Team Chat) + zapisuje link zwrotny | Nie (Idea zostaje, dostaje wpis w historii konwersji) | Tak | Eksportem (nie tworzy pliku), Przełączeniem (tworzy nowy byt) |
| **Eksport pliku** | Renderuje reprezentację do PLIKU poza systemem (PNG/SVG/PDF/Markdown/JSON/BPMN/draw.io/CSV) | Nie | Tak, ale POZA Consultify (plik na dysku użytkownika) | Konwersją (Konwersja NIE produkuje pliku do pobrania, tworzy rekord w Consultify) |
| **Import** | Wprowadza dane do Idei z zewnętrznego źródła (plik wklejony/wgrany) | Tak — może zastąpić lub dołożyć do grafu | Nie | Szablonem (źródło zewnętrzne vs biblioteka wewnętrzna) |
| **Szablon** | Stosuje gotową, wewnętrzną strukturę węzłów/krawędzi jako punkt startowy lub uzupełnienie | Tak — może zastąpić lub dołożyć do grafu | Nie | Importem (źródło to biblioteka Consultify, nie plik użytkownika) |

**Reguła rozstrzygająca:** jeśli operacja nie tworzy pliku i nie tworzy trwałego rekordu POZA Ideą — to nie jest ani Eksport, ani Konwersja. Jeśli tworzy plik — to zawsze Eksport, niezależnie od tego, jak ładnie wygląda wynik (Raport/Prezentacja jako PDF to nadal Eksport TYLKO jeśli plik jest jedynym skutkiem; jeśli tworzy też rekord w module Reports/Presentations — to jest Konwersja, patrz §3).

---

## 2. Konwersja

### 2.1 Zakresy

Convert musi zawsze jawnie pokazać, na czym działa. Sześć nazw zakresu używanych w tym rozdziale, zmapowanych na kanoniczny `ActionScope` (§01 — 10 wartości, `_RDZEN_STANDARDU_4_ZASADY`):

| Nazwa zakresu (Convert) | `ActionScope` | Co obejmuje | Gdzie występuje |
|---|---|---|---|
| **Cała Idea** | `workspace` | Cały graf, niezależnie od aktywnego narzędzia | Menu 1 „Konwertuj ▾" bez zaznaczenia |
| **Widok** | `current_view` | Treść aktywnej reprezentacji jako źródło (np. tylko pola tabeli, tylko hierarchia mapy) — inna serializacja niż cały graf, ta sama dana | Konwersja „Raport z tego widoku" / „Prezentacja z tego widoku” |
| **Zaznaczenie** | `selected_items` | Wielokrotne zaznaczenie w aktywnym narzędziu (multi-node Mind Map/Whiteboard, multi-row Table) | Pasek zaznaczenia, prawy panel „Konwertuj zaznaczenie (N)" |
| **Element** | `single_item` | Jeden węzeł/karteczka/krok/wiersz, BEZ potomków | Menu kontekstowe pojedynczego elementu |
| **Gałąź** ⚠ modyfikator specyficzny Mind Map | `single_item` + cascade (opisany w §Z1 tabeli specyficznej rozdziału 11) | Węzeł + WSZYSCY potomkowie | Menu kontekstowe węzła Mind Map, pozycja jawnie nazwana „gałąź” |
| **Wiersze** | `table_row` (jeden) / `selected_items` (wiele) | Zaznaczone wiersze Tabeli | Pasek zaznaczenia wierszy |

**Zakaz:** żadna etykieta Convert nie może być gołym słowem „Convert"/„Konwertuj" bez dopisania zakresu. Przykłady poprawnych etykiet: `Konwertuj całą Ideę`, `Konwertuj zaznaczone wiersze (3)`, `Konwertuj węzeł`, `Konwertuj gałąź`.

### 2.2 Wymóg podglądu i zapisu źródła

Każde wejście Convert musi pokazać, PRZED wykonaniem:
1. co konwertuje (zakres — patrz §2.1),
2. jaki target (Initiative/Task/Decision/Report/Presentation/…),
3. co konkretnie powstanie (podgląd treści, nie tylko nazwa targetu — dziś: brak podglądu treści docelowego artefaktu w żadnym z trzech wejść, tylko toast po fakcie → docelowo: wymagane),
4. link do źródła — zachowany po konwersji (`sourceIdeaId`, `sourceNodeIds`), widoczny w zakładce Powiązania obu stron.

### 2.3 Backend: historia wielu konwersji, nie pojedyncze `promoted_to` (D6 + P0)

**Dziś:** endpoint `POST /api/my-work/my-ideas/:id/convert` kończy każdą gałąź bezwarunkowym `UPDATE my_ideas SET promoted_to=?, promoted_entity_id=?, stage='promoted'`. Efekt: konwersja 2 z 40 węzłów nadpisuje status CAŁEJ Idei; druga konwersja innej gałęzi kasuje ślad pierwszej; `stage` przeskakuje na `promoted` po konwersji fragmentu, fałszywie sugerując zamknięcie całej Idei w widokach filtrujących po etapie.

**Docelowo:**
- Zamiast pojedynczych kolumn `promoted_to`/`promoted_entity_id` — tabela/lista `conversions[]` z wpisem PER konwersja: `{target, entityId, scope, nodeIds, createdAt, createdBy, sourceLink}`. Każda konwersja DOPISUJE wpis, nigdy nie nadpisuje poprzedniego.
- `stage` Idei zmienia się na `promoted` WYŁĄCZNIE przy konwersji zakresu `workspace` (cała Idea), z jawnym potwierdzeniem tej konkretnej konsekwencji w dialogu („To oznaczy całą Ideę jako Promowaną").
- Konwersja zakresu innego niż `workspace` NIE rusza `stage` — Idea zostaje w swoim etapie, dostaje tylko nowy wpis w `conversions[]`.
- Mechanizm `outputLinks` w `extensions` grafu (dziś już addytywny) staje się JEDYNYM miejscem pamiętania historii linków — likwiduje się drugi, sprzeczny mechanizm (kolumna nadpisująca).

### 2.4 Jeden mechanizm zamiast trzech

**Dziś** istnieją TRZY niezależne, różnie nazwane pipeline'y pod nazwą „Convert": workspace (`Api.convertMyIdea`, czyta graf), lista Idei M05 (`conversionService.ts`, materializuje sesję MyWork, POSTuje tytuł/opis bez treści grafu), i martwy `shared/ConvertToMenu.tsx` (zero importów). Ten sam target (np. „Analiza") jest jednocześnie `status:'soon'` w workspace i w pełni działający w liście.

**Docelowo:** jeden backend, jedna lista targetów ze spójnym statusem `live`/`soon` widoczna z KAŻDEGO wejścia (workspace i lista Idei wołają ten sam `idea.convert`). Martwy `shared/ConvertToMenu.tsx` — usunięty.

---

## 3. Eksport

Eksport zawiera WYŁĄCZNIE pliki. Pełna lista formatów:

| Format | Rodzaj pliku | Reprezentacje |
|---|---|---|
| PNG | obraz rastrowy | wszystkie (canvas) |
| SVG | obraz wektorowy | wszystkie (canvas) |
| PDF | dokument | wszystkie |
| Markdown | tekst | wszystkie (outline) |
| JSON | dane strukturalne | wszystkie |
| BPMN | notacja procesu | Process Flow |
| draw.io | diagram | Mind Map, Whiteboard, Process Flow |
| CSV / TSV | dane tabelaryczne | Table |

Dopuszczalne dodatkowe pozycje eksportu (zachowane z dzisiejszego stanu, o ile realnie produkują plik): pakiet diagramu (interop), raport mapowania fidelity, manifest share/embed.

**Zakaz nadrzędny:** „Raport" i „Prezentacja" znikają z dropdownu Eksport. Dziś kliknięcie tych pozycji dispatchuje `convert_report`/`convert_presentation` i tworzy trwały rekord w module Reports/Presentations — zero pliku do pobrania. To jest Konwersja (§2), nie Eksport, i przenosi się do listy targetów Convert (`idea.convert.report`, `idea.convert.presentation`, zakres `workspace` lub `current_view`).

**Serwerowy eksport (do pliku, generowany backendem):** flaga `IDEA_SERVER_EXPORT_ENABLED` musi mieć realny generator dla KAŻDEGO formatu, który deklaruje jako dostępny — zero „pure stub" zwracającego fałszywy sukces. Formaty bez generatora zwracają jawny błąd (501), nie fałszywy plik.

---

## 4. Import

### 4.1 Import destrukcyjny (zastępuje graf) — draw.io / BPMN / pakiet diagramu

**Dziś:** `handleImportGraph` zastępuje CAŁY graf Idei (`captureToolGraph` ustawia `nodes`/`edges` bez merge) BEZ pytania o potwierdzenie — jedyny mechanizm w całym rozdziale, który robi operację tego kalibru bez guard-rail. Ma podgląd (`importPreview`) i tworzy snapshot w Historii, ale nie potwierdzono czy snapshot łapie stan sprzed czy po imporcie.

**Docelowo, wymagane w tej kolejności:**
1. pokazać co zostanie zastąpione (liczba węzłów/krawędzi tracona),
2. pokazać źródło importu,
3. wymagać jawnego potwierdzenia,
4. utworzyć snapshot PRZED zmianą (jawnie „przed", nie domniemane),
5. wykonać import,
6. pokazać podsumowanie po imporcie,
7. dać możliwość cofnięcia (przywrócenie snapshotu z Historii, jeden klik).

### 4.2 Import CSV (Table) — osobna ścieżka, addytywna z natury

**Dziś:** dokłada wiersze (`csvToNodes`, addytywne), z lokalnym undo (Ctrl+Z), ale BEZ podglądu przed wykonaniem — parsuje i wykonuje natychmiast po wyborze pliku.

**Docelowo:**
- podgląd wierszy przed zatwierdzeniem,
- mapowanie kolumn CSV → pola tabeli, z widocznymi konfliktami typów,
- wybór trybu: **append** (dołóż), **update** (nadpisz istniejące po kluczu), **replace** (zastąp całość),
- `replace` wymaga jawnego potwierdzenia (jedyny z trzech trybów, który jest destrukcyjny na poziomie całej tabeli),
- `append`/`update` nie wymagają potwierdzenia (nie kasują istniejących danych),
- po każdym trybie: podsumowanie (N dodanych / M zaktualizowanych / K usuniętych) + cofnięcie.

### 4.3 Tabela zbiorcza — dziś vs docelowo

| Wymóg | Import diagramu (draw.io/BPMN/pakiet) dziś | Import CSV dziś | Docelowo (oba) |
|---|---|---|---|
| Podgląd przed wykonaniem | Tak | **Brak** | Tak |
| Mapowanie pól | N/D (struktura 1:1) | **Brak** | Tak (CSV) |
| Potwierdzenie | **Brak** | N/D (addytywne) | Tak, gdy destrukcyjne (diagram zawsze; CSV tylko `replace`) |
| Snapshot PRZED zmianą | Częściowo (nie potwierdzono „przed" vs „po") | N/D | Tak, jawnie „przed" |
| Cofnięcie | Pośrednio (Historia) | Tak (`nodesUndo`) | Tak, jeden klik z podsumowania |

---

## 5. Szablony

Szablony są dziś JEDYNYM miejscem z prawidłowym guard-railem: `handleApply` pokazuje `confirm()` gdy graf niepusty, zanim `syncMyIdeaMap` nadpisze całość. Ten wzorzec jest wymagany, nie tylko zachowany:

- **Świadomość reprezentacji:** szablony są przypisane do konkretnego narzędzia (Mind Map/Whiteboard/Process Flow/Table) i galeria pokazuje WYŁĄCZNIE szablony pasujące do aktywnego narzędzia — zakaz pokazywania niepasujących bez jawnego filtra „pokaż wszystkie".
- **Potwierdzenie przy zastąpieniu:** wymagane zawsze, gdy graf ma istniejącą treść — bez wyjątków, bez flag wyłączających.
- Ten sam wzorzec (confirm-before-overwrite) rozciąga się na Import destrukcyjny (§4.1), który go dziś nie ma.

---

## 6. Zakaz etykiety „Utwórz z mapy"

**Dziś:** przycisk w Menu 3 (`onConvertFromMap`) tylko otwiera panel Convert (`handlePanelChange('tools')`) — to nie jest osobna funkcja „wygeneruj inną reprezentację z mapy", tylko zamaskowany alias do Convert. Pod domyślną flagą `ff_melsCanvas` (ON) jest to dziś **martwy klik**: ustawia stan, którego nic nie odczytuje.

**Docelowo:** etykieta „Utwórz z mapy" / „Create from map" jest ZAKAZANA w całym UI — jest niejednoznaczna, bo mogłaby znaczyć trzy różne rzeczy (przełączenie widoku / generowanie innej reprezentacji / konwersję do artefaktu). Zastępuje się konkretnymi, jednoznacznymi nazwami:

| Zamiast (zakazane) | Konkretna nazwa docelowa | Co robi | Zakres |
|---|---|---|---|
| „Utwórz z mapy" | „Konwertuj całą Ideę" | Konwersja do artefaktu | `workspace` |
| „Utwórz z mapy" | „Konwertuj zaznaczenie" | Konwersja do artefaktu | `selected_items` |
| „Utwórz z mapy" | „Przełącz na Tabelę" / „Przełącz na Proces" itd. | Przełączenie reprezentacji (jeśli o to chodziło użytkownikowi) | N/D — nie mutuje |
| „Utwórz z mapy" | „Wygeneruj propozycję procesu z mapy" | Generowanie reprezentacji — `⟦DO USTALENIA⟧`, poza zakresem tego standardu (D3) | N/D |

Każda z tych funkcji ma inny skutek i nie wolno jej opisywać jednym wspólnym skrótem.

---

## 7. Tabela zbiorcza — ta sama nazwa dziś → co realnie robi → docelowa nazwa i zakres

| Nazwa dziś | Co realnie robi dziś | Docelowa nazwa | Docelowy zakres |
|---|---|---|---|
| „Utwórz z mapy" (Menu 3) | Martwy klik pod domyślną flagą; gdy flaga off — otwiera panel Convert ogólny | USUNIĘTE — patrz §6 | — |
| „Konwertuj ▾" (Menu 1, bez zaznaczenia) | Konwertuje CAŁOŚĆ, fallback na `selection.ids` zwykle pusty | „Konwertuj całą Ideę" | `workspace`, zawsze jawne, bez cichego fallbacku |
| „Convert" (prawy panel, sekcja Convert) | Konwertuje zaznaczenie JEŚLI coś zaznaczone, inaczej całość — niejawny fallback | „Konwertuj zaznaczenie (N)" / „Konwertuj całą Ideę" | Etykieta pokazuje faktyczny zakres na przycisku, zero cichego przełączania |
| „Convert" (bez sufiksu, węzeł Mind Map) | Zawsze konwertuje CAŁĄ gałąź (`collectDescendants`), mimo etykiety sugerującej element | „Konwertuj węzeł" | `single_item`, BEZ potomków (wymaga nowego handlera) |
| „Convert branch to…" (węzeł Mind Map) | To samo co wyżej — identyczny handler | „Konwertuj gałąź" | `single_item` + cascade (zachowuje dzisiejsze `convertBranch`) |
| Convert (lista Idei M05, `ConvertToOutputMenu`) | Osobny pipeline (`conversionService.ts`), tworzy pusty rekord z tytułem, bez treści grafu | „Konwertuj" (to samo co workspace) | Ten sam mechanizm co §2.4 — jeden backend |
| „Analiza"/„Model finansowy"/„Budżet"/„Wycena" (workspace) | `status:'soon'`, wyłączone | Spójny status z listą Idei | Jeden rejestr targetów, jeden status wszędzie |
| „Raport"/„Prezentacja" (dropdown Eksport) | Tworzą trwały rekord — de facto Konwersja, zero pliku | „Konwertuj na Raport" / „Konwertuj na Prezentację" (przeniesione do Konwersji) | `workspace` lub `current_view` |
| Import draw.io/BPMN/pakiet | Zastępuje cały graf BEZ potwierdzenia | Bez zmiany nazwy — dodać potwierdzenie | `workspace`, destrukcyjne z guard-railem (§4.1) |
| `promoted_to`/`stage` po konwersji częściowej | Nadpisuje pole na CAŁEJ Idei niezależnie od zakresu | Historia `conversions[]` | Patrz §2.3 |
| `shared/ConvertToMenu.tsx` | Martwy komponent, zero importów, inny zestaw targetów niż oba żywe pipeline'y | USUNIĘTE (dead code) | — |

---

## 8. Akcje tego rozdziału (rejestr)

| id akcji | etykieta PL | ikona | zakres | reprezentacje | handler | efekt | undo |
|---|---|---|---|---|---|---|---|
| `idea.convert.whole` | Konwertuj całą Ideę | `Workflow` | `workspace` | all | `POST /my-work/my-ideas/:id/convert {target}` | tworzy rekord w module docelowym + dopisuje `conversions[]` | brak automatycznego cofnięcia rekordu docelowego — `⟦DO USTALENIA⟧` |
| `idea.convert.selection` | Konwertuj zaznaczenie (N) | `Workflow` | `selected_items` | all | jw. + `nodeIds=selection.ids` wymagane, zero fallbacku | jw., źródło = tylko zaznaczone | jw. |
| `idea.convert.element` | Konwertuj węzeł | `Workflow` | `single_item` | all | jw. + `nodeIds=[nodeId]` BEZ potomków | jw. | jw. |
| `idea.convert.branch` | Konwertuj gałąź | `GitBranch` | `single_item`+cascade | mind_map | jw. + `nodeIds=[nodeId,...collectDescendants(nodeId)]` | jw. | jw. |
| `idea.export.file` | Eksportuj (PNG/SVG/PDF/MD/JSON/BPMN/draw.io) | `Download` | `current_view` | all | render lokalny → plik | plik na dysk, zero zmian w Idei | n/d (nie mutuje) |
| `idea.export.table_csv` | Eksportuj CSV | `Download` | `current_view` | table | serializacja widocznych wierszy/kolumn | plik | n/d |
| `idea.import.graph` | Importuj diagram | `Upload` | `workspace` | mind_map, process_flow, whiteboard | parsuj → podgląd → potwierdź → snapshot → zastąp graf | zastępuje graf | tak — przywróć snapshot |
| `idea.import.csv.append` | Importuj CSV — dołóż | `Upload` | `table_row` (wiele) | table | `csvToNodes` → dołóż wiersze | dodaje wiersze | tak — lokalny Ctrl+Z |
| `idea.import.csv.replace` | Importuj CSV — zastąp | `Upload` | `workspace` | table | jw. + potwierdzenie | zastępuje wiersze | tak — snapshot przed zmianą |
| `idea.template.apply` | Zastosuj szablon | `LayoutTemplate` | `workspace` | filtrowane po aktywnym narzędziu | `applyIdeaTemplate` → `syncMyIdeaMap`, confirm gdy graf niepusty | zastępuje graf | tak — snapshot |

### Teresa (Z4)

| Polecenie przykładowe | Akcja | `confirmBeforeRun` |
|---|---|---|
| „Skonwertuj to na inicjatywę" | `idea.convert.whole` / `.selection` (zależnie od kontekstu rozmowy) | tak |
| „Wyeksportuj to jako PDF" | `idea.export.file` | nie (niedestrukcyjne) |
| „Zaimportuj ten plik draw.io" | `idea.import.graph` | tak (destrukcyjne) |
| „Dołóż te wiersze z CSV" | `idea.import.csv.append` | nie |
| „Zastąp dane tym CSV" | `idea.import.csv.replace` | tak |
| „Zastosuj szablon Workflow zatwierdzania" | `idea.template.apply` | tak, gdy graf niepusty |

---

## Kryteria odbioru

- [ ] „Utwórz z mapy" nie istnieje nigdzie w UI (Menu 3, prawy panel, kebab, menu kontekstowe).
- [ ] Dropdown „Eksport" zawiera WYŁĄCZNIE pozycje tworzące plik do pobrania — brak „Raport"/„Prezentacja".
- [ ] „Raport"/„Prezentacja" dostępne wyłącznie z Konwersji (Menu 1 „Konwertuj ▾" lub odpowiednik).
- [ ] Każde wejście do Convert pokazuje jawnie swój zakres w etykiecie przycisku (np. „Konwertuj zaznaczenie (3)").
- [ ] Konwersja pojedynczego węzła Mind Map (bez potomków) i konwersja gałęzi (z potomkami) to dwie różne, poprawnie nazwane i zaimplementowane akcje.
- [ ] Backend zapisuje KAŻDĄ konwersję jako osobny wpis w historii, nigdy nie nadpisuje pojedynczego pola `promoted_to`.
- [ ] `stage` Idei zmienia się tylko przy konwersji całości (`workspace`) z jawnym potwierdzeniem, nie przy konwersji fragmentu.
- [ ] Import niszczący graf (draw.io/BPMN/pakiet) pokazuje podgląd + wymaga potwierdzenia + tworzy snapshot PRZED zmianą + daje jednoklikowe cofnięcie.
- [ ] Import CSV pozwala wybrać append/update/replace; `replace` wymaga potwierdzenia, `append`/`update` nie.
- [ ] Szablon nadal pyta o potwierdzenie, gdy zastępuje niepusty graf (stan już spełniony — nie regresować).
- [ ] Galeria szablonów pokazuje wyłącznie szablony pasujące do aktywnego narzędzia, bez jawnego filtra „pokaż wszystkie".
- [ ] Martwy komponent `shared/ConvertToMenu.tsx` usunięty z repozytorium.
- [ ] Lista Idei (M05) i workspace Convert używają JEDNEGO mechanizmu backendowego i jednej listy targetów ze spójnym statusem `live`/`soon`.
