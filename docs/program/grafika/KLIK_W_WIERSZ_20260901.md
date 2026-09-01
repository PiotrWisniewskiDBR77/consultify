# Klik w wiersz — domyślne otwieranie podglądu w przelocie zrzutów (dyżur 192, 2026-09-01)

## Kontekst zlecenia

Pomiar: na 12 obejrzanych zrzutów z 12 różnych modułów — 12 pokazywało samą
tabelę, zero z otwartym podglądem. Właściciel oceniał dwie trzecie ekranu
(tabela bez prawego panelu). Spis
`docs/program/grafika/SPIS_PARAMETROW_ZRZUTOW.json` miał 29 wpisów `klik` na
253 ekrany — dług, który rośnie z każdym nowym ekranem listowym.

## Zadanie 1 — wspólny selektor wiersza: JEST

`StandardTable` (`src/components/standard/StandardTable.tsx`) deleguje CAŁĄ
mechanikę wiersza do `FilterableTable`
(`src/components/shared/ModuleHub/FilterableTable.tsx`) — jedynego miejsca w
kodzie, które renderuje `<table>`/`<tbody>`/`<tr>` dla list encji. Dwa fakty
razem dają stabilny, uniwersalny selektor:

1. `<table>` niesie atrybut `data-min-table-width`
   (`FilterableTable.tsx:1091`) — jedyne miejsce w repo, które go nadaje
   (`grep -rn "data-min-table-width"` → tylko `FilterableTable.tsx`).
2. Wiersze to PRAWDZIWE `<tr>` w PRAWDZIWYM `<tbody>` (żadnego
   div-jako-tabeli, żadnego nadpisanego `role`) — więc mają niesione przez
   HTML implicit `role="row"`, bez potrzeby dodawania czegokolwiek.

Selektor: **`table[data-min-table-width] tbody tr`** — klikamy `.first()`.

Nie trzeba nic dodawać do `StandardTable`/`FilterableTable`. Element ZAWSZE
ma `onClick={() => onRowClick?.(row)}` (`FilterableTable.tsx:1440`), więc
kliknięcie jest bezpieczne nawet na ekranie, który `onRowClick` nie podał —
to wtedy no-op, nie wyjątek.

Zasięg zweryfikowany grepem:
- `<StandardTable` — 146 plików `.tsx` (bez testów).
- `<FilterableTable` bezpośrednio (z pominięciem `StandardTable`) — 22
  kolejne pliki.
- Razem: **~168 plików** korzysta z tego selektora bez żadnej zmiany kodu
  produkcyjnego.

### Znany wyjątek (zmierzony, nie zgadywany)

`IdeasTableContent.tsx` (My Work → Ideas → widok Tabela, ekran
`idea-table`/`idea-table-production` w SCREENS) renderuje WŁASNY,
bespoke `<table>` przez `ResizableTable`
(`src/components/ui/ResizableTable`), z komentarzem wprost w kodzie:

> `§27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon
> §2); swiadomie oznaczona, nie przepisana w tej sesji`

Zmierzone bezpośrednio w DOM (Playwright, `?screen=idea-table`):
`table[data-min-table-width]` = 0 sztuk, `<table class="w-full table-fixed
bg-c-surface">` bez tego atrybutu. To udokumentowany dług migracyjny, nie coś
do naprawienia w tym dyżurze — narzędzie NIE crashuje na nim, tylko liczy go
jako „bez podglądu" (patrz Zadanie 3, dowód #2).

Nie przeprowadzono wyczerpującego audytu WSZYSTKICH 253 ekranów pod kątem
tego wyjątku (poza budżetem dyżuru) — tor grafiki dostaje teraz za darmo
dokładną liczbę przez licznik wbudowany w narzędzie (Zadanie 3): każde
uruchomienie na pełnym zestawie 253 ekranów wypisze, ile z nich nie ma
pasującego wiersza.

## Zadanie 2 — panel boczny czy nakładka: rozstrzygnięte mechanicznie

`StandardPreview` → `PreviewPaneShell`
(`src/components/ui/ResizableTable/PreviewPaneShell.tsx`) potwierdzone: ZERO
`fixed`/`absolute`/`inset-0` we własnym kodzie — wymiar/pozycję dyktuje
rodzic (`h-full flex flex-col`).

Layout, który OWIJA `StandardPreview` na desktopie, to
`TableWithPreviewLayout` (`src/components/shared/TableWithPreviewLayout.tsx`)
— ma prop `desktopPreviewOverlay` (linia 85/105/111), który przełącza panel
z flex-sibling na `absolute inset-y-0 right-0` floating overlay
(linia 428-433). Domyślnie `false`.

Grep `desktopPreviewOverlay` w całym `src/` (poza definicją) daje **JEDNEGO**
konsumenta:

- `src/components/MyWork/MyIdeasListContent.tsx:2024` —
  `desktopPreviewOverlay={isIdeasPreviewOverlayEnabled()}`, i to TYLKO w
  gałęzi `viewMode === 'grid'` (karty narzędzi) — widok `viewMode ===
  'table'` (który mountuje `IdeasTableContent`, patrz wyjątek wyżej) tej
  gałęzi nie dotyka.

Flaga `isIdeasPreviewOverlayEnabled()`
(`src/utils/ideasPreviewOverlayFlag.ts`) domyślnie **ON** (akcept właściciela
07-13, zrzuty light+dark).

**Wniosek: JEDEN ekran z wariantem nakładkowym na desktopie — My Work →
Ideas → widok kart (`MyIdeasListContent`, `viewMode==='grid'`).** W SCREENS
(`dev-render/main.tsx:1991`) ma już DEDYKOWANY harness
`ideas-preview-overlay` („IDEE — Idea: podgląd nakładkowy nad listą"), który
montuje podgląd bezpośrednio, bez potrzeby klikania (potwierdzone w
`_ograniczenia_tego_pomiaru` w `SPIS_PARAMETROW_ZRZUTOW.json` — jeden z 7
ekranów tam wymienionych).

Wszystkie pozostałe ~44 konsumenty `TableWithPreviewLayout` i 3 konsumenty
`PreviewPaneAside` (Assessment Hub/Outputs/Library —
`src/components/shared/PreviewPane/PreviewPaneAside.tsx`, `data-preview-pane`,
bez `fixed`/`absolute`) używają WYŁĄCZNIE panelu bocznego (flex-sibling) na
desktopie — potwierdzone brakiem `desktopPreviewOverlay` w ich wywołaniach.

Mobile (`isMobile`) renderuje `fixed inset-0` pełnoekranowy drawer
UNIWERSALNIE, niezależnie od `desktopPreviewOverlay` — to nie jest wybór per
ekran, tylko stała gałąź w `TableWithPreviewLayout` (linia 479/518), więc nie
wchodzi do listy „ekranów z nakładką" (to jest szerokość viewportu, nie
właściwość ekranu).

**Konsekwencja dla przelotu:** tylko `ideas-preview-overlay` potrzebuje
dwóch stanów/czterech zrzutów (ma już dedykowany harness z premontowanym
podglądem — nie wymaga zmiany w tym narzędziu). Każdy inny ekran listowy
dostaje jeden kadr po kliknięciu (dwa zrzuty: light/dark) — dokładnie
mechanizm dodany w Zadaniu 3.

## Zadanie 3 — wpięcie w `scripts/dev/grafika-zrzuty.mjs`

Dodano:
- `DOMYSLNY_KLIK_SELEKTOR = 'table[data-min-table-width] tbody tr'`.
- Gdy operator NIE poda `--klik`, narzędzie PRÓBUJE kliknąć `.first()` tym
  selektorem tuż przed zrzutem (ta sama pozycja w pipeline co dotychczasowy
  `--klik`).
- Jawny `--klik` (istniejące 29 wpisów w spisie) ma pierwszeństwo i
  CAŁKOWICIE wyłącza nową ścieżkę — zero zmiany zachowania (zweryfikowane,
  patrz dowód #3 niżej).
- Wyłącznik `--bez-klika-domyslnego=1` dla pojedynczych wywołań.
- Licznik `podgladDomyslnyProbowany`/`podgladDomyslnyBrak` PER ZRZUT,
  celowo POZA `status`/kodem wyjścia — „nie znaleziono wiersza do
  kliknięcia" jest POLICZONE i WYPISANE (per-wiersz nota + zbiorcza linia na
  końcu), ale nigdy nie ustawia `process.exitCode=1`. Jawny `--klik`, który
  się nie powiedzie, nadal blokuje jak dotąd (operator explicite oczekiwał
  tego elementu — inna pewność niż domyślna próba).
- Komunikat NIE zgaduje powodu: „nie znaleziono wiersza do kliknięcia" —
  nigdy „ekran nie jest listowy" (może być listowy z pustą tabelą, albo
  bespoke jak `idea-table`).

## Dowody (mutacyjne, `evidence/grafika/192-klik-w-wiersz/`)

1. **Ekran listowy z podglądem — PRZED/PO.**
   Ekran: `inicjatywy-lista` (montuje realny `InitiativesHub` →
   `StandardTable`, dane demo).
   - `inicjatywy-lista__PRZED__light.png` (`--bez-klika-domyslnego=1`,
     stare zachowanie): tabela na pełną szerokość, 9 kolumn widocznych,
     ŻADNEGO panelu po prawej.
   - `inicjatywy-lista__PO__light.png` (nowe domyślne zachowanie): tabela
     zwężona (reflow do 5 kolumn), po prawej otwarty `StandardPreview` —
     nagłówek „Post-Merger KPI Har…", karta meta (chipy „Pomiar efektów" /
     „Gotowe"), sekcja „KONTEKST INICJATYWY" z tabelą właściwości
     (Następna bramka / Gotowość / Właściciel / Oczekiwany efekt /
     Planowane okno / Źródło), „POWIĄZANIA", przyciski „Otwórz"/„Kopiuj
     link" — dokładnie kanon 6 bloków `StandardPreview`.
   - Konsola narzędzia: `Domyślny klik w wiersz (...): 1/1 zrzutów
     kliknęło wiersz przed zrzutem; 0 sfotografowano BEZ próby otwarcia
     podglądu.`

2. **Ekran bez pasującego selektora — sfotografowany bez błędu, policzony.**
   Ekran: `idea-table` (bespoke `ResizableTable`, patrz wyjątek w Zadaniu 1).
   - `idea-table__PO__light.png`: tabela, bez podglądu (oczekiwane — nie
     jest to defekt, tylko brak dopasowania selektora).
   - Konsola: `status: OK | podgląd: BRAK (nie znaleziono wiersza do
     kliknięcia)`, zbiorczo `Domyślny klik w wiersz (...): 0/1 zrzutów
     kliknęło wiersz przed zrzutem; 1 sfotografowano BEZ próby otwarcia
     podglądu (...)`.
   - Kod wyjścia: **0** (potwierdzone `echo $?` po osobnym uruchomieniu) —
     nie blokuje przelotu.

3. **Stare wywołanie z jawnym `--klik` — zero zmiany zachowania.**
   `--ekrany=inicjatywy-lista --klik="table tbody tr:nth-child(3)"` →
   `inicjatywy-lista__REGRESJA-jawny-klik-wiersz3__light.png`: podgląd
   otworzył się na WIERSZU 3 („Supply Chain Optimization…"), status
   pozostał czystym `OK` (BEZ noty „podgląd: …" — bo nowa ścieżka domyślna
   w ogóle się nie uruchomiła, `KLIK.length > 0`). To dokładnie
   dotychczasowe zachowanie 29 istniejących wpisów w spisie.

## Ile ekranów po zmianie nadal będzie sfotografowanych bez podglądu

Nie policzone wyczerpująco na wszystkich 253 (poza budżetem dyżuru — to
wymagałoby realnego przelotu całego zestawu, każdy z serwerem dev-render).
Zmierzone i pewne:
- **1 potwierdzony wyjątek** — `idea-table`/`idea-table-production`
  (`IdeasTableContent`, bespoke `ResizableTable`, `§27-todo` w kodzie).
- Ekrany BEZ tabeli w ogóle (artefakty, canvasy, dashboardy) — z definicji
  nie pasują do selektora i zostaną policzone jako „bez próby otwarcia
  podglądu"; to poprawne zachowanie, nie defekt (nie są ekranami listowymi).
- Rekomendacja: uruchomić przelot na pełnym zestawie 253 (bez `--klik`) —
  licznik z Zadania 3 poda dokładną liczbę za darmo, bez dodatkowej pracy
  analitycznej.

## SHA

Patrz commit w tej samej sesji — plik zmieniony:
`scripts/dev/grafika-zrzuty.mjs` (+ ten dokument).
