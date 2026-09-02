# Wysokość panelu podglądu — pomiar, przyczyna, naprawa (2026-09-02)

Uwaga właściciela (02.09, zrzut zakładki **Zasoby** w module Realizacja), dosłownie:

> „to jest ciągle ten sam kłopot w zakładce zasoby — Preview nie jest wysokie na wysokość
> przestrzeni od menu 3 do dołu strony. — reszta jest super ok"

Słowo „ciągle" jest tu najważniejsze i okazało się uzasadnione co do liczby.

---

## 1. Ile razy właściciel to zgłaszał

Źródła: `docs/program/grafika/KORPUS_UWAG_20260902.md`, `KANON_Z_ODBIOROW.md`,
`STAN_LISTY_POPRAWEK.md` oraz tabela `historia` w `odbior.sqlite` (2473 wiersze;
kopia tylko do odczytu — bazy nie ruszano).

**Uwaga o WYSOKOŚCI podglądu — 3 różne zgłoszenia:**

| # | data i godzina | ekran | słowa właściciela (skrót) |
| :-: | --- | --- | --- |
| 1 | 2026-08-30 09:45 | `idea-table` | „podgląd… nie jest zgodny ze standardem. **Układ od góry do dołu również nie spełnia wymagań**" |
| 2 | 2026-09-02 14:16 | `execution-tab-resources` | „karta podglądu **nie zajmuje całej wysokości**… musi mieć wysokość **od trzeciego menu do dolnej części ekranu**" |
| 3 | 2026-09-02 16:35 | `execution-tab-resources` | „**ciągle** ten sam kłopot… nie jest wysokie na wysokość przestrzeni od menu 3 do dołu strony" |

Na **tym samym ekranie (Zasoby) to drugie zgłoszenie tego samego dnia** — odstęp 2 h 19 min.

**Kontekst szerszy — ta sama rodzina wróciła po raz trzeci.** `KORPUS_UWAG_20260902.md`
(sekcja B, „Ten sam zarzut w trzech kolejnych rejestrach") notuje:

| zarzut | 30.08 | 01.09 | 02.09 | nawrotów |
| --- | --- | --- | --- | :-: |
| Podgląd nie trzyma się kanonu podglądu | K10 (4 ekrany) | R1 (6) — *już wtedy „ZGŁOSZONE DWA RAZY"* | 5 | **3×** |

Dodatkowo **01.09 05:47** właściciel napisał o `execution-tab-resources`:
„…tabela zaczyna się pod menu 3. **I dzięki temu też preview będzie wyglądało tak jak powinno**".
Zgłoszenie zamknięto jako `ZROBIONE` — usunięto pasek między Menu 3 a tabelą.
**Połowa dotycząca wysokości podglądu nie została wtedy zrobiona ani zmierzona.**
To jest bezpośrednia przyczyna słowa „ciągle": zamknęliśmy zgłoszenie po jego łatwiejszej połowie.

---

## 2. Pomiar PRZED

Narzędzie: `scripts/dev/measure-preview-canon.mjs --wysokosc` (tryb dołożony do **istniejącego**
narzędzia kanonu podglądu, opt-in, parametry ekranów zapisane na trwałe w pliku).
Warunki: viewport 1600×1000, `theme=light`, `uwagi=0`, tolerancja 2 px.

Kolumna **luka** = dół strony − dolna krawędź panelu, pomniejszony o sumę dolnych paddingów
przodków (padding strony dzieli z tabelą obok, więc nie jest dziurą). **Ma być 0.**

| ekran | obszar treści (menu3→dół) | panel | karta widoczna | luka | werdykt |
| --- | ---: | ---: | ---: | ---: | --- |
| Realizacja / **Zasoby** (ekran ze zrzutu) | 847px | 693px | 669px | **154px** | NIE SIĘGA DO DOŁU |
| Realizacja / Praca | 863px | 694px | 670px | **169px** | NIE SIĘGA DO DOŁU |
| Realizacja / Sterowanie | 829px | 639px | 615px | **190px** | NIE SIĘGA DO DOŁU |
| Realizacja / Raporty | 761px | 678px | 654px | **83px** | NIE SIĘGA DO DOŁU |
| Realizacja / Lista | — | — | — | — | **NIEWIDOCZNA DLA POMIARU** (patrz §3, źródło B) |
| Moja praca / Tabela idei | 1000px | 1000px | 976px | 0px | OK |
| Wywiad / Podgląd kanoniczny | 968px | 968px | 944px | 0px | OK |
| Ocena / Wpis biblioteki DRD | 845px | 845px | 821px | 0px | OK |

**Ekranów z podglądem, na których panel NIE sięgał do dołu: 4** (z 7 zmierzonych).
Piąty (Lista) był dla pomiaru **niewidoczny** — nie miał znacznika `data-preview-pane`.
Realizacja / Podsumowanie i / Wdrożenie nie mają panelu podglądu — nie należą do rodziny
i nie były mierzone (nie zaliczam ich jako „OK").

---

## 3. Przyczyna u źródła — są DWA źródła, nie jedno

Podejrzenie z zlecenia (`PreviewPaneShell` / `previewStyles.ts`) **nie potwierdziło się**.
`PreviewPaneShell` jest poprawny: ma `h-full flex flex-col overflow-hidden`, a jego treść
`flex-1 overflow-y-auto` — czyli wypełnia, ile dostanie, i ma własne przewijanie.
Pomiar potwierdza: karta jest zawsze dokładnie o 24 px (`p-3`) mniejsza od swojego kontenera.
**Panel nie dostawał wysokości — nie gubił jej.**

### Źródło A — przerwany łańcuch `height:100%` (4 ekrany)

`TableWithPreviewLayout` ma root `className="relative flex h-full …"`. `h-full` to
`height:100%`, a procent rozwiązuje się **tylko** względem rodzica o definitywnej wysokości.
Zmierzony łańcuch przodków na Zasobach (PRZED):

```
div[data-preview-pane]                                h=693
div.relative flex h-full overflow-hidden gap-1.5      h=693   <- h-full zdegradowane do auto
div.mt-4                                              h=693   <- wysokosc AUTO  (przerwanie)
section.p-4                                           h=741   <- wysokosc AUTO  (przerwanie)
div.flex-1 min-h-0 overflow-auto                      h=895   <- pierwsza definitywna
```

Dwa pudełka o wysokości `auto` (`<section className="p-4">` i `<div className="mt-4">`)
przerywały łańcuch, więc `h-full` po cichu degradowało do `auto` i panel przyjmował
wysokość własnej treści. Dokładnie to opisał właściciel.

### Źródło B — dwie własne powłoki z pominięciem kontenera kanonu (2 ekrany)

`ExecutionHub.tsx` w zakładkach **Lista** i **Raporty** miał własne
`<aside className="w-[400px] shrink-0 … p-3 overflow-hidden">` zamiast kanonicznego
`PreviewPaneAside`. Skutki były trzy, nie jeden:
* szerokość `w-[400px]` zamiast kanonicznego `clamp(340px, 28%, 480px)` — literał wymieniony
  z nazwy jako zakaz w `TABLE_AND_PREVIEW_CANON.md` §7.2;
* brak znacznika `data-preview-pane` — **te ekrany były niewidzialne dla pomiaru kanonu**,
  więc każdy dotychczasowy raport „podgląd zgodny" po prostu ich nie obejmował;
* własna geometria wysokości poza kontrolą komponentu.

### Źródło C — martwe `flex-1` (1 ekran, Sterowanie)

Zakładka `control` jako jedyna opakowywała swoją powierzchnię w
`<div className="min-h-0 flex-1 overflow-auto p-4">`. Rodzic tego diva ma `display:block`,
więc **`flex-1` było martwe** i pudełko zwijało się do wysokości treści (703 px przy 893 px
dostępnych). Do tego `p-4` dublowało `p-4` z samej powierzchni.

---

## 4. Czym różnią się ekrany, które BYŁY poprawne — to była wskazówka rozstrzygająca

`idea-table`, `interview-preview-canon` i `drd-library-entry` miały lukę **0 px od początku**.
Nie dlatego, że używają innej powłoki — używają **tej samej** (`TableWithPreviewLayout`
→ `PreviewPaneShell`). Różnica jest wyłącznie w **kształcie przodków**:

```
POPRAWNY (idea-table)                          ZEPSUTY (execution-tab-resources)
div.flex-1 min-h-0            <- flex item     div.mt-4        <- blok, wysokosc auto
div.flex flex-col flex-1 min-h-0               section.p-4     <- blok, wysokosc auto
```

Na ekranach poprawnych każde ogniwo nad powłoką jest **flex-itemem o definitywnej wysokości**.
Na zepsutych — zwykłym blokiem o wysokości treści.

**Wniosek dla kierunku naprawy: naprawa NIE idzie we wspólną powłokę.** Powłoka jest poprawna
i naprawianie jej byłoby zepsuciem działających ekranów. Naprawa idzie w te ekrany, które
powłokę zagłodziły z wysokości albo ją ominęły. Dlatego zamiast wymyślać nowy układ,
**odtworzono na zepsutych ekranach dokładnie ten kształt przodków, który ekrany poprawne
już mają** — i nigdzie nie wpisano wysokości w pikselach.

---

## 5. Co naprawiono

| plik | zmiana |
| --- | --- |
| `ExecutionResourcesSurface.tsx` | `<section>` → `flex h-full min-h-0 flex-col p-4`; wrapper tabeli → `flex-1 min-h-0` |
| `ExecutionWorkSurface.tsx` | jw. + powłoka opakowana w `flex min-h-0 flex-1 flex-col` |
| `ExecutionControlSurface.tsx` | jw. (sekcja zewnętrzna i wewnętrzna) |
| `ExecutionReportsSurface.tsx` | jw. |
| `ExecutionHub.tsx` | 2× własne `<aside className="w-[400px] …">` → kanoniczny `PreviewPaneAside`; usunięty zbędny wrapper zakładki `control` z martwym `flex-1` i podwójnym `p-4` |

Panel wypełnia dostępną przestrzeń i ma własne przewijanie treści (`flex-1 overflow-y-auto`
w `PreviewPaneShell`) — kolumna „własny scroll" w pomiarze potwierdza to na każdym ekranie.
Na ekranie z krótką treścią (Sterowanie, 2 wiersze) powstaje **pusty panel pełnej wysokości**,
a nie rozciągnięta treść — potwierdzone zrzutem.

**Efekt uboczny na plus:** zakładka Lista ma teraz kanoniczne **448 px** zamiast 400 px
i jest po raz pierwszy widoczna dla pomiaru kanonu podglądu.

---

## 6. Pomiar PO

| ekran | obszar treści | panel | karta | luka | własny scroll | werdykt |
| --- | ---: | ---: | ---: | ---: | :-: | --- |
| Realizacja / **Zasoby** | 847px | 847px | 823px | **0px** | tak | OK |
| Realizacja / Praca | 863px | 863px | 839px | **0px** | tak | OK |
| Realizacja / Lista | 939px | 939px | 915px | **0px** | tak | OK |
| Realizacja / Sterowanie | 861px | 861px | 837px | **0px** | tak | OK |
| Realizacja / Raporty | 761px | 761px | 737px | **0px** | tak | OK |
| Moja praca / Tabela idei | 1000px | 1000px | 976px | **0px** | tak | OK |
| Wywiad / Podgląd kanoniczny | 968px | 968px | 944px | **0px** | tak | OK |
| Ocena / Wpis biblioteki DRD | 845px | 845px | 821px | **0px** | tak | OK |

**Zmierzonych ekranów: 8. Panel nie sięga do dołu na: 0.** Kod wyjścia narzędzia: `0`.

**Tolerancja: 0 px** (próg w narzędziu to 2 px na zaokrąglenia subpikselowe
`getBoundingClientRect`, ale realnie wszystkie ekrany wychodzą równo 0 — progu nie trzeba było użyć).

### Dowód mutacyjny — narzędzie nie oślepło
Po cofnięciu samej naprawy na Zasobach (reszta bez zmian) narzędzie natychmiast melduje
`154px / NIE SIĘGA DO DOŁU` i kod wyjścia `1`. Zieleń pochodzi z naprawy, nie z tego,
że przyrząd przestał patrzeć.

---

## 7. Przyrząd skłamał trzy razy, zanim zaczął mówić prawdę

Zapisuję, bo to jest kontekst nie do odtworzenia z wyniku, a kosztował większość czasu.

1. **Kotwica = dół okna, bez paddingu.** Oblewała ekrany **poprawne**
   (`interview-preview-canon`: 16 px „dziury" tam, gdzie dziury nie ma — to był `p-4` ramki).
2. **Kotwica = najbliższy kontener przewijania.** Na Sterowaniu meldowała **0 px**, kiedy
   oko widziało panel kończący się 190 px nad dołem strony. Kontener kotwiczący **sam był
   zagłodzony**, a pomiar względem zagłodzonej kotwicy zawsze wychodzi równo.
   **To jest kłamstwo w kierunku najgroźniejszym — potwierdza sukces, którego nie ma.**
   Złapało to dopiero patrzenie na zrzut, nie liczba.
3. **Skan gałęzi po `git cat-file -e`** zameldował, że narzędzie pomiarowe jest na 26 gałęziach.
   Kontrola na celowo zmyślonej ścieżce pokazała, że pętla zwracała „znalezione" dla wszystkiego.
   Plik był w rzeczywistości na **jednej** gałęzi (`grafika/piec-rodzin-korpus-20260902`),
   a nie na gałęzi bazowej.

Wersja końcowa kotwicy: dół strony minus suma dolnych paddingów i obramowań **wszystkich**
przodków — dzięki temu każde zagłodzone pudełko po drodze **odejmuje się** od wyniku,
zamiast go maskować. Założenie (powłoka aplikacji przypięta do okna) zapisane w komentarzu.

---

## 8. Zrzuty PO — `evidence/grafika/220-wysokosc-podgladu/`

Wszystkie 1600×1000, `uwagi=0` (panel uwag harnessu wyłączony, żeby kontrolki przyrządu
nie zasłaniały produktu). Mechanicznie sprawdzone, że każda para light/dark to **dwa różne
obrazy** (skrypt kończy się błędem, gdyby były identyczne).

| zrzut | czy dolna krawędź panelu styka się z dolną krawędzią obszaru treści |
| --- | --- |
| `zasoby-light.png` / `zasoby-dark.png` | **Tak** — panel 984 px, tabela 984 px, krawędzie się stykają. |
| `praca-light.png` / `praca-dark.png` | **Tak** — panel 984 px, tabela 984 px, krawędzie się stykają. |
| `sterowanie-light.png` / `sterowanie-dark.png` | **Tak** — panel 984 px, tabela 984 px; tabela ma 2 wiersze, więc panel jest pusty na pełnej wysokości, a treść nierozciągnięta. |

Zrzut Zasobów porównano z `idea-table` (ekran od początku poprawny): układ karty jest
identyczny — treść u góry, stopka (Powiązania / pastylka akcji) przy dole. Naprawa
**wyrównuje Zasoby do wzorca, nie tworzy nowego wyglądu**.

---

## 9. Bramki

| bramka | wynik |
| --- | --- |
| `scripts/check-list-canon.sh` (na staged diff, 5 plików) | **EXIT 0** — naruszeń 0, baseline 0 |
| `npx vite build` (`NODE_OPTIONS=--max-old-space-size=8192`) | **EXIT 0** — zbudowane w 35,7 s |
| testy dotkniętych komponentów (`src/components/Execution/__tests__`) | **9 plików, wszystkie zielone** |
| `standardPreview.r03` + `tablePreviewGeometry.r03-2` | 3 testy czerwone — **dług zastany, nie z tej zmiany** |
| `measure-preview-canon.mjs --wysokosc` jako bramka | **EXIT 0** (kod wyjścia ≠ 0 przy jakimkolwiek odchyleniu) |

**Uczciwie o 3 czerwonych testach:** dotyczą plików, których ta gałąź **nie dotyka**
(`standardPreview.r03.test.tsx`, `tablePreviewGeometry.r03-2.test.tsx`). Zweryfikowane
odłożeniem całej pracy (`git stash`) i uruchomieniem tych samych plików na czystym kodzie
bazowym: **te same 3 testy padają identycznie przed moją zmianą**. To zastany dług
(pusty stan bloku Relations ×2 i powrót fokusa po zniknięciu elementu otwierającego),
nie regresja — ale ktoś powinien go wziąć osobno.

---

## 10. Co zostaje otwarte (nie zamykam sam)

1. **3 czerwone testy zastane** (wyżej) — osobne zadanie.
2. **`undefined:` w bloku Powiązania na Sterowaniu** — widoczne na zrzucie
   („undefined: Nie zmieniaj planu"). Defekt etykiety/danych, poza zakresem tej naprawy,
   ale właściciel to zobaczy przy odbiorze tego ekranu.
3. **Rodzina jest szersza niż 8 ekranów.** `TableWithPreviewLayout` ma **52 konsumentów
   nietestowych**; zmierzono 8. Bramka wysokości powinna dostać resztę rodziny w kolejnym
   kroku — inaczej naprawa per-wywołanie odrośnie, tak jak odrosła między 01.09 a 02.09.

## 11. Ekrany gotowe do zapalenia na stronie odbioru (decyzja nadzorcy, NIE zapalam sam)

`execution-tab-resources` · `execution-tab-work` · `execution-tab-control` —
zmierzone (luka 0 px) i udokumentowane zrzutem w obu motywach.

`execution-tab-list` i zakładka Raporty są zmierzone (0 px), ale **bez zrzutu w obu motywach** —
proponuję dorobić zrzuty przed zapaleniem.
