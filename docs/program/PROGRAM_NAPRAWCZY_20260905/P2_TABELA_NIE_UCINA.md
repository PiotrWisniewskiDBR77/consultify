# P2 — Tabela nie ucina

## 1. Cel dla użytkownika

Na żadnej liście w produkcie nagłówek kolumny ani wartość komórki nie kończy się „…" bez sposobu
zobaczenia pełnej treści — a tam, gdzie mimo wszystko coś się nie mieści, hover pokazuje dymek z
całym tekstem od razu, nie po sekundzie natywnego tooltipa przeglądarki.

## 2. Zakres

Wspólny komponent `FilterableTable` obsługuje (wg `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md:74`)
**24 ekrany** (grep `<FilterableTable\b`, stan 2026-08-02 w kanonie; nie przemierzałem tego grepa
ponownie na HEAD m03 w ramach tej paczki — do potwierdzenia w kroku 0 wykonania). Audyt
`AUDYT_AWARD_20260905` opisuje ten sam defekt na konkretnych ekranach, z dowodem zrzutowym:

| Moduł | Ekran | Dowód | Cytat audytu |
| --- | --- | --- | --- |
| Moja Praca | Skrzynka — lista | `evidence/audyt-award-20260905/moja-praca/01-skrzynka-lista.png` | „ucięte nagłówki kolumn („STA…", „PILN…")" (A, linia 27) |
| Moja Praca | Sejf — lista | `evidence/audyt-award-20260905/moja-praca/25-sejf-lista.png` | ten sam komponent, ten sam defekt nagłówków (A, §MP2 „Nagłówki kolumn ucinane do 3–4 znaków", linia 64/426) |
| Inicjatywy | Realizacje — lista | (cyt. B, linia 78) | „STATUS i TERMIN systematycznie obcięte […] „W reali...", „Zaplan...", „5.05.2...", „4.06.2..." — ten sam defekt co w Inicjatywach, wspólny komponent `FilterableTable.tsx` (domyślny `minWidth: 90"… linia 789)" |
| Ocena | DRD → Raport (hover) | `evidence/audyt-award-20260905/ocena/ocena-09-drd-raport-hover-trunc.png` | „Komórki macierzy w wąskim widoku obcinają etykiety […] **bez tooltipa przy hover**" (B, linia 27) |
| Ocena | listy narzędziowe | `evidence/ocena-narzedzia-20260905/ocena-lista-kolumny-PO.png` (kontrola po innej naprawie — nadal ten sam mechanizm źródłowy) | — |
| Wywiad | Lista główna / „Skrzynka" | `evidence/audyt-award-20260905/wywiad/01-lista-glowna.png`, zoom przelewu wiersza `03b-zoom-overflow-row.png`, zoom kolumny nazwy `03c-zoom-name-col.png` | moduł wymieniony wprost w wierszu przyczyny #2 (D_SYNTEZA, linia 51: „~25 (wszystkie moduły z tabelą)") |
| Finanse | Sprawozdania — lista | (cyt. C, linia 32/59) | „kolumny STATUS/Waluta obcięte przez stały panel Teresy" — nakładający się z przyczyną #1, ale bazowy floor 90 px nadal winny |
| Audyty | Biblioteka — lista | (cyt. C, linia 102/146) | „tytuły wierszy obcięte bez tooltipa" |
| Spotkania | Lista spotkań | (cyt. C, linia 180) | „status „Po terminie — wy..." obcięty w komórce" |
| Materiały | Dokumenty/Arkusze | (cyt. C, linia 118) | „Nagłówki kolumn „FOR..." i „WIDOCZNO..." obcięte bez tooltipa" |

**Liczba dotkniętych ekranów: ~25** (wartość z tabeli przyczyn D_SYNTEZA_I_PLAN.md, wiersz #2, linia 51 —
to jest HIPOTEZA autorów audytu z 05.09, nie policzone przeze mnie 1:1 na HEAD m03; krok 0 wykonania
musi ją zweryfikować grepem, patrz §5 krok 0). Wspólny mianownik wszystkich wierszy: renderują przez
`FilterableTable`, więc jedna naprawa u źródła naprawia je wszystkie naraz — bez dotykania 24 ekranów
osobno.

## 3. Przyczyna źródłowa

Plik `src/components/shared/ModuleHub/FilterableTable.tsx`, zweryfikowane `rg`/`sed -n` na HEAD m03
(branch `codex/m03-admin-20260824`):

- **L788–789** (`defaultColumnConfigs`): każda kolumna inna niż `title`/`name` dostaje
  `width: parsePx(c.width, 140)` i **`minWidth: 90`** — stała, niezależna od typu treści (status,
  data, liczba, nazwisko) i niezależna od długości polskiej etykiety nagłówka. „STA…", „PILN…",
  „5.05.2…" to bezpośredni skutek tej jednej liczby.
- **L793–811** (`mergePersisted`): jeśli w `localStorage` (`persistKey`) leży zapisana szerokość
  węższa niż nowy, bezpieczny floor — **wygrywa zapisana wartość** (`width = w > 0 ? w : c.width`).
  Sama zmiana stałej `90` w kodzie nic nie da użytkownikom z istniejącym zapisanym układem, dopóki
  odczyt nie przepuści zapisanej wartości przez ten sam floor.
- **L899–959** (`columnFit`, komentarz L900–928 pisany explicite jako przyznanie się do winy):
  mechanizm skaluje kolumny **w dół**, gdy suma szerokości przekracza kontener (`FIT_MIN_COLUMN_WIDTH
  = 112`, `FIT_MIN_PRIMARY_COLUMN_WIDTH = 180`, L226–227) — ale nie ma odwrotnego mechanizmu: nic nie
  rośnie, gdy zadeklarowana szerokość jest za mała na treść. Cytat z komentarza w pliku (L907–917):
  „Poprzednia próba łatania szerokości per wywołanie odrosła po ośmiu tygodniach w kilkunastu
  plikach; `min-width` przy `table-fixed` niczego nie ratuje". To jest dokładnie ten sam wzorzec
  ostrzegawczy co w notatce właściciela „naprawa per-wywołanie odrasta" — poprzednia łatka była per
  ekran, nie u źródła, i defekt wrócił.
- **L1352/1361/1712/1741**: nagłówek i komórki polegają wyłącznie na natywnym atrybucie HTML
  `title={...}` do pokazania pełnej treści przy obcięciu. Audyt A, §MP2 (linia 64): „oparte wyłącznie
  o natywny `title` (wolny tooltip przeglądarki)" — i audyt B, linia 27, pokazuje przypadek, gdzie
  nawet to nie działa (macierz DRD w trybie „wpisany w panel" nie ma `title` w ogóle, zero dymka na
  hover — zrzut `ocena-09-drd-raport-hover-trunc.png`).
- **122 pliki wywołujące `FilterableTable`/`columns` z jawnym `width: 'NNpx'`** (`rg "width: '[0-9]"
  --include="*.tsx" src/`, 781 wystąpień, z czego 390 < 150px) obchodzą floor kompletnie — jeśli
  ekran zadeklarował `'110px'`, dzisiejszy kod użyje 110, nie 90, ale to i tak za mało na polskie
  „PILNOŚĆ"/„TERMIN". To jest właśnie populacja, która „odrośnie" ponownie, jeśli naprawimy tylko
  stałą `90` i zostawimy te 390 jawnych, węższych deklaracji bez zmiany.

Uczciwa korekta wobec zlecenia: `docs/ui-standards/TRIADA_KANON.md` **nie ma** sekcji „§19.1 budżet
szerokości" w znaczeniu liczbowego budżetu kolumn — sprawdziłem `rg -n "19\.1"` w obu plikach kanonu.
`§19.1` w `TABLE_AND_PREVIEW_CANON.md` (linia 886) to „Geometria kontrolek (stała)" — wysokości
chipów/ikon/kebaba, nie szerokości kolumn. Reguła o obcinaniu, którą faktycznie mamy, to linia 944:
„Truncacja i18n: tytuł/nazwa `truncate` + tooltip pełnej wartości; kolumny nie łamią się przy
dłuższych łańcuchach" oraz zakaz **RC‑8** (linia 928): „`MUST NOT` wstrzykiwać `max-w-[…]` ad-hoc na
komórkę […]; szerokość wyłącznie z modelu kolumn (`width/minWidth/maxWidth`)" — czyli kanon już dziś
każe trzymać się modelu kolumn, ale nie mówi, jakie liczby ten model ma mieć. Ta paczka dopisuje
brakujące liczby i mechanizm tooltipa, nie zmienia already-istniejącej reguły.

`priority`/hide-on-narrow: sprawdzone `rg -n "priority" FilterableTable.tsx` — **nie istnieje** taka
kolumna w `TableColumn`. Jest tylko `defaultVisible?: boolean` (L62), czyli statyczna decyzja „widoczna
domyślnie tak/nie", ustawiana raz przez moduł, nie responsywna na szerokość ekranu. Projekt w §4 nie
dodaje automatycznego chowania kolumn — patrz uzasadnienie tam.

## 4. Projekt rozwiązania

**Jeden wzorzec, jedno miejsce: `FilterableTable.tsx`.** Zero zmian w 24 ekranach na starcie (krok 1–4
poniżej). Ekrany z jawnym `width:` dostają efekt naprawy za darmo, bo floor działa niezależnie od tego,
co deklarują — patrz „obowiązujący floor" niżej. Usunięcie zbędnych już jawnych `width:` to osobny,
opcjonalny krok 5, bo dotyka plików w zamrożonych modułach (wymaga `[ODMROZENIE]`, patrz §5).

### 4.1 Nowe pole modelu kolumny: `dataType`

```ts
dataType?: 'text' | 'status' | 'date' | 'owner' | 'number';
```

Opcjonalne, domyślnie `'text'` — zero zmian w istniejących wywołaniach, które go nie ustawią (dostają
dzisiejsze zachowanie tekstowe, tylko z podniesionym floorem tekstowym). Moduły migrują stopniowo,
oznaczając kolumny statusu/daty/liczby, żeby dostać precyzyjniejszy (czyli często niższy niż
uniwersalny tekstowy) floor tam, gdzie treść jest krótka i przewidywalna (np. `5.05.2026` nie
potrzebuje floora 150 px).

### 4.2 Minimalne szerokości per typ (floor, nie sugestia)

| `dataType` | Floor (px) | Uzasadnienie |
| --- | :-: | --- |
| `text` (domyślny) | **140** | dotychczasowy fallback `width` (140, L787) staje się też floorem — bez tego np. jednowyrazowe angielskie nagłówki nadal by się mieściły, ale polskie złożone słowa („OCZEKIWANY EFEKT") nie |
| `status` | **130** | najkrótszy polski status z korpusu audytu to nadal 6–9 znaków + chip ma własny padding (`ChipBase`, `h-6/h-7 px-2/px-2.5`) — 130 mieści „Zaplanowane" w jednej linii chipa bez zawijania |
| `date` | **110** | `5.05.2026` w locale-formacie (`localeListy`) + margines na sort ikonę — nagłówek „TERMIN"/„DATA" mieści się, wartość też |
| `owner` | **150** | avatar `AssigneeCell` (`h-6 w-6`, L… w kanonie 19.1) + imię i nazwisko jednym słowem obciętym truncate+tooltip (nie floor na całe nazwisko — nazwiska bywają długie, floor tylko gwarantuje avatar + pierwsze ~10 znaków) |
| `number` | **90** | liczby są krótkie i wyrównane do prawej; to jedyny typ, który zostaje przy dotychczasowej wartości 90 |
| `title`/`name` (bez zmian) | **200/max 520** | już dziś ma osobną, szerszą ścieżkę (L788) — nie ruszane |

Floor **nagłówka** dodatkowo musi zmieścić: etykietę + ikonę sortu (`ChevronDown`, 14px + `gap-1`) +
ikonę filtra (`FilterDropdown`, gdy `filterable`) — dlatego tabela wyżej to nie „szerokość napisu", tylko
zaokrąglony w górę budżet z zapasem na te dwie ikony (typowe realne wartości z audytu — „PILNOŚĆ" +
sort + filtr = ok. 118 px przy 11px uppercase tracking-wider; floor 130 dla `status` ma margines).

### 4.3 Content-aware pomiar nagłówka (opcjonalne wzmocnienie floora, nie zamiennik)

Floor z tabeli w §4.2 jest liczbą stałą — wystarczy dla ~90% przypadków i jest tanie (bez pomiaru w
DOM). Dla kolumn, gdzie etykieta jest wyjątkowo długa (np. „OCZEKIWANY EFEKT", „KOSZT OPÓŹNIENIA" —
oba już cytowane w audycie jako ucięte mimo floora 90), dokładamy pomiar realnej szerokości etykiety
`canvas.measureText()` — **wzorzec już istnieje w repo**: `src/components/MyWork/canvas/mapExportRender.ts:588-591`
(`measureCanvas.getContext('2d')` → `measureCtx.measureText(text).width`). Reużywamy dokładnie ten
wzorzec (font: `11px` + `font-semibold` + `uppercase` — czcionka nagłówka z §19.1 kanonu, linia 892) w
jednym `useMemo` w `defaultColumnConfigs`:

```
default = Math.max(typeFloor[dataType], measuredHeaderPx + iconsBudgetPx, parsePx(c.width, fallback))
```

Efekt: floor per typ chroni przed „nie zmierzyliśmy jeszcze", pomiar chroni przed „zmierzyliśmy, ale
etykieta i tak jest dłuższa niż typowy floor". `canvas.measureText` jest tani (jeden `<canvas>` w
pamięci, reużywany, żadnego layout thrashing) i nie wymaga zmiany API — liczony raz per zestaw kolumn
(`useMemo` z zależnością na `columns`), nie per render wiersza.

### 4.4 Obowiązujący floor nad jawnym `width:` z wywołania

Kluczowa zmiana zachowania: **floor z §4.2/4.3 wygrywa z jawną, za wąską wartością `width` podaną w
module**, zamiast być tylko fallbackiem gdy `width` jest puste. Dziś (L787): `width: parsePx(c.width,
fallback)` — jawne 110px zostaje 110px. Po zmianie: `width: Math.max(parsePx(c.width, fallback),
floor)`. To jest **jedyny sposób**, żeby naprawić 390 istniejących wywołań z `width < 150px` bez
dotykania 122 plików — w tym plików w modułach już zamrożonych (`01_ORGANIZATION`,
`07_MY_WORK_AGENT`, patrz §5). Jawny `width` szerszy niż floor nadal wygrywa bez zmian (moduł, który
świadomie chce szerzej, nie jest tym ograniczony).

Symetrycznie **`mergePersisted`** (L793–811) musi przepuszczać zapisaną w `localStorage` szerokość
przez ten sam floor: `width = Math.max(typeof w === 'number' && w > 0 ? w : (c.width ?? fallback),
floor)`. Bez tego użytkownik, który już zawęził kolumnę ręcznie do np. 95px przed tą naprawą, nadal
widziałby ucięcie po wdrożeniu — bo zapisana wartość ma dziś pierwszeństwo nad wszystkim. To jest
migracja **bez** wersjonowania klucza (`filterableTable.cols.*` zostaje tą samą nazwą) — czysty
`Math.max` przy odczycie jest bezpieczny, bo nigdy nie zawęża tego, co użytkownik już miał, tylko
podnosi to, co było za wąskie. Zero utraty danych, zero migracji schematu.

### 4.5 Zawsze‑włączony dymek zamiast natywnego `title`

Zamiast `title={label}` (L1352, 1361, 1712, 1741) — komponent-primitve `Tooltip` z
`src/components/ui/primitives/Tooltip.tsx` (jedyny kandydat: `src/components/ui/tooltip.tsx` to
osobna, radix-owa rodzina używana w 1 miejscu w repo — nie jest to dziś przyjęty standard dla tabel;
`primitives/Tooltip.tsx` ma już 2 callerów i jest częścią `primitives/index.ts`, czyli tej samej
rodziny co `ChipBase`/`EntityStatusChip` cytowane w kanonie). Owijamy:

- nagłówek: `<span className={CELL_TEXT_CLAMP_CLASS}>{column.label}</span>` → ten sam span **wewnątrz**
  `<Tooltip content={column.label}>`, dymek renderuje się **tylko gdy** `scrollWidth > clientWidth`
  zmierzone na realnym elemencie (ref + `ResizeObserver`, wzorzec zbliżony do `useScrollEdges.ts` już
  istniejącego w `src/components/MyWork/shared/`) — nie chcemy dymka na każdym, niesortowalnym, w pełni
  mieszczącym się nagłówku (szum wizualny, zaprzecza „dymek TYLKO gdy ucięty" z kryterium odbioru).
- komórki tekstowe (`title`/`name` `truncate`, reszta `CELL_TEXT_CLAMP_CLASS`): identyczny wzorzec —
  `Tooltip` warunkowany zmierzonym przepełnieniem, nie zawsze‑obecny.
- macierz DRD (`ocena-09-drd-raport-hover-trunc.png` — **poza** `FilterableTable`, osobny komponent
  „wpisany w panel") — **NIE** w zakresie tej paczki (inny komponent, inny plik); flagowane jako
  powiązany dług w §8, nie naprawiane tutaj, żeby nie rozmywać zakresu P2.

### 4.6 Pozioma przewijalność vs chowanie kolumn — decyzja

**Nie wprowadzamy** automatycznego chowania kolumn przy wąskim viewport w tej paczce. Powody:
1. Nie istnieje dziś pole `priority` (zweryfikowane `rg`, §3) — trzeba by je dodać do `TableColumn` I
   do **każdego** z 122 wywołań, żeby miało sens (kolejność ważności per moduł jest wiedzą modułu, nie
   komponentu) — to jest osobny, znacznie większy projekt niż P2.
2. Istniejący mechanizm `columnFit` (L899-959) już skaluje kolumny w dół proporcjonalnie z podłogą
   `FIT_MIN_COLUMN_WIDTH`/`FIT_MIN_PRIMARY_COLUMN_WIDTH`, a gdy nawet podłogi się nie mieszczą, oddaje
   **uczciwe przewijanie poziome** (`overflow-x-auto`) zamiast chowania. To jest już zgodne z kanonem
   (RC‑1: jeden kontener scrolla) i z zasadą „nie chowaj po cichu" z komentarza w pliku (L924: „bez
   cichego chowania treści").
3. Podnosimy tylko podłogę `columnFit` z L942 tak, żeby `FIT_MIN_COLUMN_WIDTH`/`FIT_MIN_PRIMARY_COLUMN_WIDTH`
   nie schodziły poniżej nowych floorów per typ z §4.2 — inaczej `columnFit` mógłby ponownie ścisnąć
   kolumnę do 112px przy bardzo wąskim kontenerze i defekt wróci przez tylne drzwi. To jedna linijka
   zmiany (`FIT_MIN_COLUMN_WIDTH` per typ zamiast stałej `112`), nie nowa architektura.

Wniosek: przy skrajnie wąskim ekranie użytkownik dostanie poziomy scroll tabeli (uczciwy, już
zbudowany), nie ucięty tekst i nie znikające kolumny. To jest zgodne z kryterium odbioru w D_SYNTEZA
(„Na żadnym ekranie listowym nie ma „STA…" ani „5.05.2…" bez dymka" — nie mówi nic o chowaniu kolumn).

### 4.7 Zakazy (kanon)

- Zero `primary-*`/crimson — ta paczka nie dotyka kolorów, tylko geometrii i tooltipa; przy review
  upewnić się, że `Tooltip` z `primitives/` nie wnosi żadnego twardego hex (sprawdzić jego źródło przy
  implementacji — poza zakresem tego dokumentu projektowego, ale to jest warunek wejścia do kroku 2).
- Zero nowej tabeli/nagłówka poza `FilterableTable`/`StandardTable` — ta paczka **nie tworzy** nowego
  komponentu, tylko rozszerza istniejący.
- RC‑8 (zakaz `max-w-[…]` ad-hoc) pozostaje w mocy — floor per typ i pomiar canvas żyją WYŁĄCZNIE w
  modelu kolumn (`width`/`minWidth`/`maxWidth`), nigdy jako inline `style`/`className` na pojedynczej
  komórce ekranu.
- i18n pl+en: etykiety kolumn już dziś idą przez `column.label` ustawiane per moduł (`t(...)`) — ta
  paczka nic tu nie zmienia, tylko jak długa etykieta jest traktowana geometrycznie.

## 5. Kroki wykonania

| # | Krok | Pliki | Szacunek | Uwaga zamrożenia |
| :-: | --- | --- | :-: | --- |
| 0 | Weryfikacja zakresu na HEAD wykonania: `rg -rlP "<FilterableTable\b(?!Props)" src/` (potwierdzić „24"), `rg -n "width: '[0-9]" --include="*.tsx" src/ \| wc -l` (potwierdzić „781"/„390 < 150px" — te liczby policzyłem 05.09 na `codex/m03-admin-20260824`, mogły się zmienić) | — | S | — |
| 1 | Dodać `dataType?: 'text'\|'status'\|'date'\|'owner'\|'number'` do `TableColumn` (typ, zero logiki) | `FilterableTable.tsx` | S | brak (plik shared, nie jest w żadnej liście `pliki` w `MVP_FINAL_ZAMROZONE.json` — zweryfikowane) |
| 2 | Floor per typ (§4.2) + `Math.max(declared, floor)` w `defaultColumnConfigs` i w `mergePersisted` (§4.4) | `FilterableTable.tsx` | M | brak |
| 3 | Pomiar `canvas.measureText` dla etykiety nagłówka + budżet ikon sort/filter (§4.3), `useMemo` cache | `FilterableTable.tsx` | M | brak, zależy od kroku 2 |
| 4 | Zamiana natywnego `title` na `Tooltip` z `primitives/Tooltip.tsx`, warunkowane realnym przepełnieniem (`ResizeObserver`/ref), 4 miejsca (L1352, 1361, 1712, 1741) | `FilterableTable.tsx` | M | brak, niezależne od 2–3, można równolegle |
| 5 | Podniesienie `FIT_MIN_COLUMN_WIDTH`/`FIT_MIN_PRIMARY_COLUMN_WIDTH` tak, by nie schodziły poniżej floora typu (§4.6 pkt 3) | `FilterableTable.tsx` | S | brak, zależy od kroku 2 |
| 6 (opcjonalny, osobna paczka/PR) | Usunięcie jawnych `width: 'NNpx'` < floor tam, gdzie stały się zbędne — **tylko** w modułach niezamrożonych bez markera; w zamrożonych wymaga `[ODMROZENIE <MODUL> DEC-<nr>]` per plik | 122 pliki, w tym `Organization/CompetencyCatalog.tsx`, `Organization/OrganizationAdminPanel.tsx` (moduł **01_ORGANIZATION**, zamrożony), `MyWork/MyProjects.tsx`, `MyWork/InboxContent.tsx`, `MyWork/DecisionsPanelContent.tsx`, `MyWork/*Queue.tsx` (moduł **07_MY_WORK_AGENT**, zamrożony); `ResultsVNext/*` (moduł 09_RESULTS — **nie jest** w rejestrze zamrożonych, wolno bez markera) | L | **TAK dla Organization i MyWork** — nie robić w tym samym kroku co 1–5; krok 6 jest czystym porządkowaniem (usuwa martwy, teraz-nieskuteczny kod), nie wymaganym do naprawy widoku, bo floor z kroku 2 działa niezależnie od tego, czy jawny `width` zostanie w pliku |

Kolejność 1→2→3→4→5 jest wymuszona: krok 2 potrzebuje pola z kroku 1; krok 3 nakłada się na
`defaultColumnConfigs` z kroku 2 (ta sama funkcja); krok 4 jest niezależny i może iść równolegle z 2–3
(inny fragment JSX); krok 5 potrzebuje stałych floorów z kroku 2, żeby wiedzieć, do czego nie schodzić.
Krok 6 jest świadomie odłożony poza commit tej naprawy — patrz uzasadnienie w kolumnie „Uwaga
zamrożenia" i w §4.4 („floor wygrywa nad jawnym width" oznacza, że krok 6 jest kosmetyką, nie
warunkiem działania).

## 6. Testy

### Jednostkowe
- `FilterableTable.columnWidth.test.tsx` (już istnieje w repo jako plik dodany w tej samej sesji roboczej — `git status` główny worktree pokazuje `AM src/components/shared/ModuleHub/__tests__/FilterableTable.columnWidth.test.tsx` — **do przejrzenia i rozszerzenia, nie tworzenia od zera**, zanim ta paczka wejdzie do wykonania): dopisać asercje —
  1. Dla `dataType: 'status'` z etykietą „PILNOŚĆ" i deklarowanym `width: '90px'` → wyrenderowana
     szerokość kolumny (i `minWidth`) ≥ 130px (floor wygrywa), nie 90px (dowód mutacyjny: zmienić floor
     na 90 w mutancie i sprawdzić, że test faktycznie failuje — nie tylko że przechodzi na dobrym
     kodzie).
  2. Dla nagłówka „OCZEKIWANY EFEKT" (najdłuższa etykieta z korpusu audytu, moduł Inicjatywy) →
     zmierzona `canvas.measureText` szerokość + budżet ikon ≤ finalna szerokość kolumny (asercja na
     wynik `useMemo`, nie na piksele w DOM — jsdom nie ma realnego layoutu canvas, więc mockować
     `measureText` deterministyczną wartością i asertować arytmetykę `Math.max`).
  3. `mergePersisted`: zapisana w mocku `localStorage` szerokość `95` dla kolumny `dataType: 'owner'`
     (floor 150) → odczytana szerokość = 150, nie 95 (dowód, że floor działa też na ścieżce
     persystencji, nie tylko na defaultach).
  4. Dla najgorszych 5 tabel z audytu (Skrzynka Moja Praca, Sejf, Realizacje-lista, Sprawozdania
     Finanse, Biblioteka Audyty) — snapshot konfiguracji kolumn przy `viewport: 1440`: **żadna** kolumna
     inna niż wynik świadomego, szerszego `width` z modułu nie ma finalnej szerokości < floora dla
     swojego typu.

### Wizualne
Przed/po, viewport **1280 / 1440 / 1920**, jasny + ciemny, dla:
1. Moja Praca — Skrzynka (`evidence/audyt-award-20260905/moja-praca/01-skrzynka-lista.png` = PRZED)
2. Moja Praca — Sejf (`evidence/audyt-award-20260905/moja-praca/25-sejf-lista.png` = PRZED)
3. Ocena — lista (biblioteka/DRD raport, tabela, nie macierz — macierz poza zakresem §4.5)
4. Wywiad — lista główna / „Skrzynka" (`evidence/audyt-award-20260905/wywiad/01-lista-glowna.png` = PRZED)

Kryterium PO na zrzucie: żaden nagłówek nie kończy się „…"/nie jest obcięty w połowie znaku (wzrokiem,
zgodnie z listą czekowania część B z `CLAUDE.md` — „testy przeszły" nie wystarcza), hover na
najdłuższej wartości w kolumnie pokazuje dymek `Tooltip` (nie natywny, biały prostokąt przeglądarki —
odróżnialne na zrzucie po stylu/cieniu), dark mode ma realne separatory (nie wyprany).

### Przepływ klikany (Playwright, szkic kroków)
1. Otwórz `/my-work` (zakładka Skrzynka), viewport 1280×900.
2. Odczytaj `scrollWidth`/`clientWidth` każdej komórki `<thead th span>` — asercja: delta ≤ 0 dla
   wszystkich domyślnie widocznych kolumn.
3. Zwęź okno do 1024×900 (poniżej progu, gdzie `columnFit` zaczyna skalować) → sprawdź, że pojawia się
   poziomy scroll (`overflow-x-auto` scrollWidth > clientWidth na **kontenerze**, nie na komórce), nie
   że którakolwiek kolumna spadła poniżej floora dla swojego typu.
4. Hover na komórce z najdłuższą wartością w kolumnie `status` → oczekiwać elementu z rolą/atrybutem
   dymka `Tooltip` (nie `title` — assert `getAttribute('title')` jest `null` lub pusty, bo tooltip
   idzie teraz przez komponent, nie natywny atrybut).
5. Powtórzyć kroki 1–4 dla `/interview` (Skrzynka) i `/my-work?tab=vault` (Sejf).

### Skrypt-strażnik (pomysł, do zaimplementowania jako osobny krok, nie część tej paczki)
Rozszerzyć istniejący wzorzec z `scripts/dev/audyt-award-20260905/audyt.mjs:96-98` (już dziś liczy
`el.scrollWidth - el.clientWidth > 24`, ale ogólnie na dowolnym elemencie) o wariant **scoped do
nagłówka tabeli**: selektor `thead th span` (etykieta kolumny, klasa `CELL_TEXT_CLAMP_CLASS`), próg
`delta > 0` (nie `> 24` — dla nagłówka nawet 1px ucięcia = defekt, inaczej niż ogólny przelew strony),
uruchamiany w harnessie akceptacyjnym przy 1280/1440/1920 na liście 24 ekranów z `<FilterableTable>`.
Zero trafień = bramka przechodzi. To NIE jest test jednostkowy (potrzebuje realnego renderu +
przeglądarki/jsdom z layoutem), więc żyje w tym samym miejscu co dzisiejszy `audyt.mjs`, nie w
`vitest`.

## 7. Kryterium odbioru właściciela

Na 3000 (żywy runtime): otwierasz Skrzynkę w Mojej Pracy, Sejf, listę w Ocenie i Skrzynkę w Wywiadzie —
na żadnym nagłówku ani wartości nie ma ucięcia typu „STA…"/„5.05.2…"; najedź myszą na cokolwiek, co się
nie mieści — dymek pokazuje całość natychmiast, bez migotania i bez czekania na wolny tooltip
przeglądarki.

## 8. Ryzyka i cofanie

- **Ryzyko A — regresja szerokości na ekranach, które dziś „ledwo się mieszczą" przy węższym oknie.**
  Podniesienie floora może wypchnąć niektóre tabele w tryb `columnFit`/scroll poziomy tam, gdzie dziś
  mieszczą się bez scrolla (kosztem ucięcia — dziś to „działa" tylko dlatego, że tnie tekst). To jest
  zamierzony trade-off tej paczki (czytelność > brak scrolla), ale wymaga przejrzenia na 1280px
  wszystkich 24 ekranów, nie tylko 4 z listy testów wizualnych — stąd krok testowy „5 najgorszych" w
  jednostkowych to podłoga, nie sufit weryfikacji.
- **Ryzyko B — `canvas.measureText` w środowisku bez realnej czcionki (headless test bez fontów
  systemowych)** może zwrócić inny wynik niż w przeglądarce użytkownika → fallback: gdy pomiar zwróci
  `0`/`NaN`/rzuci wyjątek, użyć WYŁĄCZNIE floora z §4.2 (nigdy nie failować renderu z powodu pomiaru).
- **Ryzyko C — 390 wywołań z jawnym `width` < floor przestaje mieć efekt wizualny**, co może zaskoczyć
  autora ekranu, który świadomie chciał wąskiej kolumny z krótką treścią (np. ikona-only). Mitigacja:
  `dataType` opcjonalny pozwala modułowi zejść poniżej uniwersalnego `text` floora przez jawny,
  świadomy typ (`number` floor 90) zamiast być zawsze podbitym do 140.
- **Cofanie:** zmiana żyje w jednym pliku (`FilterableTable.tsx`), krok 6 nie jest częścią tego
  commitu → `git revert` jednego commitu przywraca dokładny stan sprzed naprawy, zero migracji bazy,
  zero zmiany schematu `localStorage` (klucz `filterableTable.cols.*` niezmieniony, tylko odczyt
  przepuszcza wynik przez `Math.max`). Bezpieczny punkt: tag `demo-safe-<data>` sprzed wdrożenia,
  zgodnie z `_RUNBOOK_COFANIA.md`.
- **Dług powiązany, świadomie POZA zakresem P2:** macierz DRD w Ocenie (nie `FilterableTable`, inny
  komponent renderujący komórki „wpisany w panel") ma ten sam objaw (obcięcie bez tooltipa,
  `ocena-09-drd-raport-hover-trunc.png`) z innej przyczyny źródłowej — wymaga osobnej paczki, bo dotyka
  innego pliku.

## 9. Nakład

| Krok | Model | Osobodni |
| --- | --- | :-: |
| 0 (weryfikacja zakresu) | Sonnet | 0,25 |
| 1 (pole `dataType`) | Sonnet | 0,25 |
| 2 (floor + `Math.max` w default + persisted) | Sonnet/Opus (logika merge z persystencją — ryzyko subtelnego buga w kolejności `Math.max`, wart przeglądu Opusa) | 0,5–1 |
| 3 (pomiar canvas + cache) | Sonnet | 0,5 |
| 4 (Tooltip zamiast `title`, 4 miejsca) | Sonnet | 0,5 |
| 5 (podniesienie `FIT_MIN_*`) | Sonnet | 0,25 |
| Testy jednostkowe (rozszerzenie istniejącego pliku) | Sonnet | 0,5 |
| Testy wizualne (4 ekrany × 3 viewporty × 2 motywy = 24 zrzuty, dev-render harness) | Sonnet (renderuje, robi zrzuty) | 0,5 |
| Skrypt-strażnik (rozszerzenie `audyt.mjs`) | Sonnet | 0,5 |
| Krok 6 (opcjonalny, osobna paczka, wymaga DEC dla 2 modułów) | Sonnet, per plik | osobna wycena — nie wliczona tutaj |
| **RAZEM (bez kroku 6)** | | **~3,25–3,75 osobodnia** |

**Co można zrównoleglić:** krok 4 (Tooltip) jest niezależny od 2–3 (floor/pomiar) — dwóch robotników
naraz na tym samym pliku to konflikt merge, więc realistycznie **sekwencyjnie w jednym worktree**, nie
równolegle na dwóch gałęziach tego samego pliku. Testy wizualne i skrypt-strażnik mogą iść równolegle
z krokiem 5, bo nie modyfikują `FilterableTable.tsx`.
