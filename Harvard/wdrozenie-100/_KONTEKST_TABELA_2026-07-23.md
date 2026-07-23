# Audyt menu kontekstowych — Tabela (Ideas Table Platform), narzędzie IDEE, Consultify

Data: 2026-07-23. Zakres: WYŁĄCZNIE menu kontekstowe/pasek zaznaczenia w widoku **Tabela** narzędzia Idee. Dokument pisany tak, by zewnętrzne AI bez znajomości projektu Consultify zrozumiało strukturę i stan każdej pozycji.

## Kontekst — co to jest

**Tabela** to jeden z kilku "widoków-narzędzi" osadzonych w rekordzie **Idea** modułu *My Work → Idee* aplikacji Consultify (AI-native platforma do realizacji doradztwa). Ten sam rekord Idea ma siostrzane widoki — Mapa myśli, Tablica (Whiteboard), Przepływ (Process Flow) — przełączane ikonami w lewym pionowym pasku; nie są one przedmiotem tego audytu.

**Ważne dla czytającego bez kontekstu:** Tabela to **siatka danych (data-grid, jak Airtable)**, nie płótno. Nie ma tu pojedynczego "pustego płótna" do kliknięcia prawym przyciskiem — obszar poza wierszami po prostu nic nie robi. Interakcje kontekstowe grupują się wokół **wiersza**, **nagłówka kolumny** i **zaznaczenia wielu wierszy**; **nie ma** menu na pojedynczej komórce (patrz sekcja 2).

### ★ Odkrycie architektoniczne: DWIE równoległe implementacje tabeli

Kod ma **dwie kompletne, osobne implementacje** widoku Tabela w tym samym komponencie `IdeaTableTool.tsx`, przełączane flagą `usePlatform` (linia 437: `const usePlatform = platformActive && !(platformLooksEmpty && legacyLooksPopulated)`):

- **`usePlatform = false` → tabela „legacy"** — kod renderowany bezpośrednio wewnątrz `IdeaTableTool.tsx` (własny `<table>`, własne menu kontekstowe wiersza/kolumny wpisane inline w tym samym pliku). **To jest wersja, która realnie wyrenderowała się dla obiektu testowego w tej sesji** (potwierdzone porównaniem DOM na żywo — patrz „Metoda" niżej).
- **`usePlatform = true` → tabela „platformowa" (P15)** — komponent `<P15ViewRouter>` z pliku `src/components/MyWork/table/ViewRouter.tsx` (`PlatformGridView`) + osobny toolbar `<P15TableToolbar>` z `src/components/MyWork/table/TableToolbar.tsx`. Uruchamia się tylko, gdy Idea ma podpiętą prawdziwą "bazę platformową" (Table Platform / Airtable-parity backend). Ma **inny, bogatszy** zestaw pozycji menu wiersza i **całkowicie inny (uboższy)** mechanizm nagłówka kolumny — różnice opisane w sekcjach niżej i podsumowane w tabeli na końcu.

Obiekt testowy w tym audycie (`TEST 2026-07-23 — Tabela`, 8 wierszy) renderuje się w trybie **legacy** (`usePlatform=false`). Poniższy opis dotyczy głównie tego trybu; różnice trybu platformowego są odnotowane osobno wszędzie, gdzie występują.

## Metoda i co faktycznie zweryfikowano

- **Kod (grep-first, źródło prawdy):**
  - Legacy (żywa wersja): `src/components/MyWork/IdeaTableTool.tsx` — `onContextMenu` na wierszu (linia 1304), na nagłówku kolumny (linia 2922), render menu wiersza (linia ~3187-3253), render menu kolumny (linia ~3137-3184), pasek zaznaczenia/bulk actions (linia ~2438-2483), dropdown widoczności kolumn „Kolumny" (linia ~2376-2410).
  - Platformowa (P15, nie zweryfikowana wzrokiem — brak żywej bazy platformowej dla tego obiektu): `src/components/MyWork/table/ViewRouter.tsx` (`PlatformGridView`, menu wiersza linia ~966-1105, nagłówek linia ~915-957 — **bez** `onContextMenu`), `src/components/MyWork/table/TableToolbar.tsx` (pasek zaznaczenia linia ~1276-1316, dropdown „Kolumny" linia ~1209-1225, przycisk „Manage Fields” linia ~1236-1247), `src/components/MyWork/table/FieldManager.tsx` (panel zarządzania polami — osobny slide-over, nie context-menu).
  - Potwierdzono też, że wspólny hak menu kontekstowego płótna `src/components/MyWork/canvas/useIdeasToolContextMenu.ts` (używany przez Mapę myśli/Whiteboard/Process Flow) **nie jest w ogóle importowany** w żadnym pliku tabeli (`grep` zero wyników) — Tabela ma **własny, niezależny** mechanizm menu, zero współdzielenia z canvasami.
- **Żywy podgląd:** `http://localhost:3100/my-work/ideas/5b0000c2-c7aa-4bb2-88bb-7b522627d8b0/workspace/table`. **Ekran tabeli (8 wierszy × kolumny Typ/Etykieta/Status/Priorytet/Obszar/Właściciel/Koszt/Oszczędność) potwierdzony wzrokiem** i dopasowany DOM-em 1:1 do implementacji legacy (`data-node-id`, klasy `group/row`, `tabular-nums` na numerze wiersza — wzorzec unikalny dla `IdeaTableTool.tsx`, nieobecny w `PlatformGridView`).
- **Prawy klik na wierszu — NIE potwierdzony wzrokiem mimo dwóch prób.** Dwukrotny `right_click` na komórce kolumny „Etykieta" w wierszu 1 (poza obszarem nakładającego się lewego paska narzędzi) nie otworzył widocznego menu na zrzucie ekranu, choć kod (`onContextMenu` na `<tr>`, linia 1304, bez warunku `locked`) powinien je otworzyć bezwarunkowo. W trakcie tej samej sesji obiekt testowy **samoistnie zmieniał aktywny widok** (Tabela → Mapa myśli → Whiteboard innej Idei) bez świadomej akcji w tej przeglądarce — ten sam zjawisko odnotowane równolegle w audycie Mapy myśli (`_KONTEKST_MINDMAP_2026-07-23.md`), silny sygnał współdzielonej sesji/kolaboracji live na tym samym fixture. Menu nagłówka kolumny i pasek zaznaczenia **nie zostały przetestowane na żywo** z tego samego powodu (przerwano dalsze próby, by nie pogłębiać zamieszania na współdzielonym obiekcie) — treść poniżej pochodzi z analizy kodu, oznaczona jawnie jako **kod potwierdzony / interakcja nie potwierdzona wzrokiem**.

---

## 1. Prawy klik / kebab na WIERSZU

### 1a. Tryb legacy (żywy dla obiektu testowego) — kod potwierdzony, otwarcie menu NIE potwierdzone wzrokiem

Trigger: `onContextMenu` na `<tr>` (IdeaTableTool.tsx:1304) — `e.preventDefault()` + `setRowContextMenu({rowId, x, y})`, **bez warunku `locked`** (menu zawsze może się otworzyć; poszczególne pozycje wewnątrz są potem gated osobno). **Brak widocznej ikony „⋮" (kebab) w wierszu** — jedyny trigger to prawy klik; `grep` za `MoreVertical`/`MoreHorizontal`/`⋮` w plikach tabeli nie znalazł żadnego kebab-przycisku per wiersz.

| Pozycja (PL) | Skrót | Co robi | Stan |
|---|---|---|---|
| Edytuj | — | `usePlatform` → otwiera `RecordExpandModal` (`expandedRecordId`); w przeciwnym razie `RowDetailPanel` w trybie pełnym, zakładka „properties" | **Działa** (kod bezwarunkowy) |
| Dodaj notatkę | — | Otwiera `RowDetailPanel` na zakładce „comments" (zawsze przez `RowDetailPanel`, nawet w trybie platformowym — komentarz w kodzie tłumaczy, że `RecordExpandModal` nie ma wątku komentarzy) | **Działa** |
| Duplikuj wiersz | — | `effectiveHandleDuplicateRow(rowId)` | **Działa**. Ukryte całkowicie (nie disabled — usunięte z DOM), gdy `locked` |
| Usuń wiersz | — | `effectiveHandleDeleteRow(rowId)` + toast „Usunięto wiersz" | **Działa**. Ukryte całkowicie, gdy `locked` |

Uwaga: w trybie `locked` menu nadal się otwiera, ale pokazuje tylko „Edytuj" i „Dodaj notatkę" — separator i dwie ostatnie pozycje znikają z DOM (nie disabled z dopiskiem, tylko nieobecne).

### 1b. Tryb platformowy P15 (kod istnieje, nie zweryfikowany wzrokiem — brak żywej bazy platformowej w tym demie)

Trigger: `onContextMenu` na `<tr>` (`ViewRouter.tsx` / `PlatformGridView`, linia 742), gated `if (locked) return`. Zestaw pozycji jest **szerszy** niż legacy — komentarz w kodzie nazywa to wprost „K1/Airtable parity":

| Pozycja (PL) | Co robi | Stan |
|---|---|---|
| Edytuj | Wchodzi w tryb edycji pierwszej nie-obliczanej komórki wiersza (`setEditingCellId`) | Działa |
| Dodaj notatkę | Otwiera mini-edytor tekstowy nad pierwszym polem typu `longText` | **Disabled** z dopiskiem „Brak pola tekstowego w tej tabeli", gdy tabela nie ma żadnego pola long-text |
| Wstaw wiersz nad | `handleInsertRow(rowId, 'above')` | Działa |
| Wstaw wiersz pod | `handleInsertRow(rowId, 'below')` | Działa |
| Duplikuj wiersz | `handleDuplicateRow` + toast | Działa |
| Kopiuj wiersz | Kopiuje wiersz do schowka (`copyRowToClipboard`) | Działa |
| Rozwiń rekord | `onExpandRecord(rowId)` → w `IdeaTableTool.tsx` faktycznie podpięte (`setExpandedRecordId`) | **Disabled** z dopiskiem „Panel szczegółów niedostępny" tylko wtedy, gdy rodzic nie przekaże handlera (w praktyce w IdeaTableTool jest przekazany) |
| Usuń wiersz | `handleDeleteRow` + toast (czerwony wariant) | Działa |

Różnica kluczowa vs legacy: P15 ma **Wstaw wiersz nad/pod** i **Kopiuj wiersz** (schowek), których **nie ma** w trybie legacy; legacy nie ma osobnej pozycji „Kopiuj" (jest tylko globalny „Copy to clipboard" w toolbarze, kopiujący całą tabelę, nie pojedynczy wiersz).

---

## 2. Prawy klik / menu na KOMÓRCE

**Nie istnieje w żadnym z dwóch trybów.** `grep` za `onContextMenu` w `PlatformCellRenderer.tsx`, `GridView.tsx` i `CellEditor.tsx` nie znalazł żadnego wyniku — jedyne trzy miejsca z `onContextMenu` w całym module Tabeli to: wiersz (sekcja 1), nagłówek kolumny (sekcja 3) i zakładka zapisanego widoku (poza zakresem tego audytu — to menu na przycisku widoku u góry ekranu, nie na komórce).

Mechanizmy komórki, które **istnieją, ale nie jako menu kontekstowe**:
- **Tryb legacy:** brak dedykowanego klawiszowego kopiuj/wklej dla zakresu komórek (`grep` za `metaKey`/`ctrlKey`/`handlePaste`/`handleCopy` w `IdeaTableTool.tsx` — zero wyników). Jedyna droga kopiowania danych to globalny przycisk „Copy to clipboard" w toolbarze, który serializuje **całą tabelę** (`copyTableToClipboard`), nie zaznaczenie.
- **Tryb platformowy P15:** `PlatformGridView` ma klawiszowe `pasteFromClipboard(row.id, col.key)` na `Ctrl/Cmd+V` oraz nawigację strzałkami/Tab między komórkami zaznaczenia (`moveFocus`, `extendSelection`) — to jest zaznaczenie-i-klawiatura, nie prawy klik.
- **Rozwijanie wartości komórki:** `CellExpandPopover` (linia ~3342 w `IdeaTableTool.tsx`) — otwiera się z poziomu edycji komórki (prawdopodobnie przycisk/ikona rozwinięcia przy długiej treści), nie z prawego kliku.

**Obserwacja do zapisania wprost:** Tabela w Consultify nie ma „menu na komórce" w rozumieniu Airtable/Excela (np. „ustaw wartość", „wyczyść", „wklej specjalnie") — jedyne dwie kotwice prawego kliku to poziom wiersza i poziom nagłówka kolumny.

---

## 3. Menu NAGŁÓWKA KOLUMNY

### 3a. Tryb legacy (żywy) — kod potwierdzony, interakcja nie potwierdzona wzrokiem

Trigger: `onContextMenu` na `<div>` wewnątrz `<th>` (IdeaTableTool.tsx:2922), gated `if (!locked) setColContextMenu(...)` — **w trybie `locked` prawy klik nic nie robi** (`preventDefault` się wykonuje, ale menu się nie otwiera — brak informacji zwrotnej dla użytkownika, że akcja jest zablokowana).

| Pozycja (PL) | Co robi | Stan |
|---|---|---|
| Rename (Zmień nazwę) | `setEditingHeaderKey(col.key)` → nagłówek zamienia się w input tekstowy (ten sam efekt co podwójny klik na nagłówku) | Działa |
| Sort (Sortuj) | `effectiveCycleSort(col.key)` — identyczne z pojedynczym klikiem lewym na nazwę kolumny w nagłówku (cykl asc → desc → brak) | Działa, ale **duplikuje** zwykły lewy klik na nagłówek |
| Hide column (Ukryj kolumnę) | `toggleColumn(col.key)` | Działa |
| Delete column (Usuń kolumnę) | `deleteColumn(col.key)` + toast „Column deleted" (czerwony wariant) | Działa |

**Czego NIE ma** w tym menu, mimo że zadanie audytu pytało wprost: **brak „typ pola" (zmiana typu kolumny)**, **brak „zamroź kolumnę" (freeze)**. Zmiana typu pola nie jest dostępna nigdzie w trybie legacy z poziomu istniejącej kolumny (tylko przy tworzeniu nowej kolumny przez `AddColumnDialog`). Funkcji zamrażania kolumn nie ma w całym module Tabeli (żaden z dwóch trybów).

Dodatkowe mechanizmy nagłówka **poza menu kontekstowym** (ta sama sekcja `<th>`): przeciąganie do zmiany kolejności (`draggable`, uchwyt `GripVertical` widoczny na hover), uchwyt zmiany szerokości (drag na prawej krawędzi), podwójny klik = rename (skrót do tej samej akcji co „Rename" w menu).

Globalny substytut „hide/manage columns" **poza nagłówkiem**: przycisk „Kolumny" w toolbarze (ikona `Columns3`) otwiera dropdown z listą wszystkich kolumn + ikoną oko/przekreślone oko do show/hide + typ pola jako etykieta tekstowa (tylko podgląd, nie edycja typu).

### 3b. Tryb platformowy P15 (kod istnieje, nie zweryfikowany wzrokiem)

**Brak `onContextMenu` na nagłówku w ogóle** — `PlatformGridView` nie ma prawego kliku na `<th>`. Zamiast tego nagłówek ma: przycisk sortowania (klik = cykl sortowania), pole „Filtruj…" wbudowane pod każdą nazwą kolumny (quick-filter tekstowy, osobny mechanizm od zaawansowanego `FilterBuilder`), uchwyt zmiany szerokości (drag). **Rename/hide/delete kolumny nie istnieją z poziomu nagłówka w tym trybie** — są przeniesione do osobnego panelu `FieldManager` (slide-over otwierany przyciskiem „Manage Fields" w toolbarze) oraz do dropdownu „Kolumny" (identycznego mechanizmu show/hide jak w legacy, w `TableToolbar.tsx`).

**Różnica kluczowa do zapamiętania:** legacy = prawy klik na nagłówku działa i ma 4 pozycje; platformowy P15 = prawego kliku na nagłówku **nie ma wcale**, wszystko przez toolbar/FieldManager.

---

## 4. Pasek/menu po ZAZNACZENIU wiersza (akcje masowe)

Zaznaczenie odbywa się wyłącznie przez **checkbox w pierwszej kolumnie wiersza** (nie przez klik na sam wiersz — klik na wiersz w trybie legacy ustawia inny, niezwiązany stan `selectedNodeForLines` używany przez funkcję „linii powiązań", a nie zaznaczenie do akcji masowych). Nie jest to floating pasek nakładający się na ekran — to stały fragment **głównego toolbara**, który pojawia się/znika w zależności od `selectedRowIds.size > 0`.

### 4a. Tryb legacy (żywy) — kod potwierdzony, interakcja nie potwierdzona wzrokiem

Lokalizacja: `IdeaTableTool.tsx` liniowo w toolbarze, obok Undo/Redo, linia ~2438.

| Pozycja (PL) | Co robi | Stan |
|---|---|---|
| Licznik „N selected" | Czysto informacyjny badge | — |
| Convert ▾ (dropdown: Initiative / Task / Decision) | `handleBulkConvert(target)` — oznacza zaznaczone wiersze jako skonwertowane na inny typ artefaktu | Działa. Ukryte całkowicie, gdy `locked` |
| Delete (czerwony) | `_bulkDel()` (= `effectiveHandleBulkDelete`, wariant legacy albo platformowy zależnie od `usePlatform`) | Działa. Ukryte całkowicie, gdy `locked` |

### 4b. Tryb platformowy P15

Identyczny wzorzec (licznik + Convert dropdown + Delete), zaimplementowany osobno w `TableToolbar.tsx` (linia ~1276-1316) z tymi samymi trzema celami konwersji. Brak innych różnic funkcjonalnych — to jest jeden z niewielu fragmentów, gdzie legacy i P15 są praktycznie identyczne (skopiowany kod, dwa niezależne miejsca utrzymania — ryzyko rozjazdu przy przyszłych zmianach).

**Czego nie ma:** brak akcji masowych innych niż konwersja i usuwanie (np. brak „ustaw wartość pola dla zaznaczonych", brak masowego eksportu tylko zaznaczonych, brak masowego duplikowania) w żadnym z trybów.

---

## Podsumowanie różnic legacy vs P15 (tabela zbiorcza)

| Powierzchnia | Legacy (żywe dla obiektu testowego) | Platformowe P15 (kod, nie zweryfikowane wzrokiem) |
|---|---|---|
| Menu wiersza | 4 pozycje: Edytuj, Dodaj notatkę, Duplikuj, Usuń | 8 pozycji: + Wstaw nad/pod, Kopiuj wiersz, Rozwiń rekord |
| Menu komórki | brak | brak |
| Menu nagłówka (prawy klik) | 4 pozycje: Rename, Sort, Hide, Delete | **brak w ogóle** — zastąpione toolbarem + FieldManager |
| Filtr per-kolumna w nagłówku | brak | tak (pole tekstowe pod nazwą) |
| Zmiana typu pola z nagłówka | brak (tylko przy tworzeniu nowej kolumny) | brak |
| Zamrażanie kolumn | brak | brak |
| Pasek zaznaczenia (bulk) | Convert + Delete | Convert + Delete (kod zduplikowany, ta sama funkcja) |
| Widoczna ikona kebab na wierszu | brak (tylko prawy klik) | brak (tylko prawy klik) |

---

## Uwagi / plan

1. **Priorytet weryfikacji:** ktoś z dostępem do stabilnej, niewspółdzielonej sesji demo powinien potwierdzić wzrokiem, czy prawy klik na wierszu w trybie legacy faktycznie otwiera menu — w tej sesji dwie próby nie pokazały menu na zrzucie, ale nie da się wykluczyć, że przyczyną było nakładanie się pływającego lewego paska narzędzi (widoczny na każdym zrzucie, częściowo zasłaniający kolumny „#"/checkbox) albo interferencja współdzielonej sesji kolaboracyjnej (obiekt samoistnie zmieniał widok w trakcie audytu — to samo zjawisko odnotowane w równoległym audycie Mapy myśli). Kod jest poprawnie napisany i bezwarunkowy (`onContextMenu` bez `if (locked)` na wyzwalaczu), więc brak menu na żywo — jeśli się potwierdzi w czystszych warunkach — byłby realną usterką runtime, nie błędem projektu.
2. **Rozjazd legacy/P15 to realne ryzyko UX:** ten sam ekran "Tabela" zachowuje się różnie w zależności od tego, czy Idea ma podpiętą bazę platformową — użytkownik przełączający się między dwoma Ideami może stracić prawy klik na nagłówku bez ostrzeżenia (P15 go nie ma). Warto rozważyć: (a) ujednolicenie w stronę P15 (bogatszy zestaw wiersza, ale trzeba dodać z powrotem prawy klik nagłówka), albo (b) jawne udokumentowanie różnicy dla zespołu, żeby nikt nie „naprawiał" jednego trybu myśląc, że to jedyny.
3. **Brak zmiany typu pola i freeze kolumn z poziomu nagłówka** w obu trybach — jeśli to jest oczekiwana funkcja parytetu z Airtable (jak sugeruje komentarz „K1/Airtable parity" w kodzie P15), to menu nagłówka wymaga dwóch nowych pozycji w obu implementacjach.
4. **Menu komórki nie istnieje** — zgodnie z oczekiwaniem z briefu zadania (Tabela to siatka, nie płótno, może nie potrzebować menu na komórce), ale warto potwierdzić z właścicielem produktu, czy to świadoma decyzja, czy luka względem wzorca Airtable (np. „wyczyść komórkę", „wklej specjalnie" na pojedynczej komórce nie istnieją).
5. **Kebab wizualny nieobecny:** w obu trybach jedynym wejściem do menu wiersza jest prawy klik — nie ma widocznej ikony „⋮", co może być nieodkrywalne dla użytkownika myszy bez prawego przycisku (trackpad-only, niektóre konfiguracje). Warto rozważyć dodanie widocznej ikony kebab na hover wiersza, analogicznie do wzorca Airtable/Notion.
