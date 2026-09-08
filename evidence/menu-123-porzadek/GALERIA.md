# Porządek Menu 1/2/3 — Inicjatywy i Realizacja (08.09.2026)

Uwaga właściciela (staging, Realizacja → Praca, ekran 2000 px):
> „tutaj w menu też chaos — zrób to zgodnie z kanonem Menu 1, 2, 3; generalnie zrób porządek
> we wszystkich funkcjach tych dwóch modułów (Inicjatywy i Realizacja)"

Na jego zrzucie pasek funkcjonalny łamał się na **trzy linie**: baner „⚠ Niepełne dane:
1 realizacja bez odpowiedzi", pod nim select „Wszystkie realizacje", pod nim przycisk
„Nowe zadanie".

SSOT wyglądu: `docs/ui-standards/TRIADA_KANON.md` §A1–A3, C4–C5 + lista czekowania część B
(punkty 1–4: pigułki, kolejność CTA → segment → filtry, brak liczników w Menu 2, chipy Menu 3).

---

## Stanowisko i sposób pomiaru

- Gałąź `mvp/menu-123-porzadek`, baza `f8b9e9d057`; katalog `/private/tmp/wt-menu`.
- Realne trasy `/initiatives` i `/execution` na własnym Vite (3192) + API (4172),
  kopia bazy stagingu z danymi DBR77, konto ADMIN `audyt@dbr77.local`, język `pl`.
- Skrypt: `scripts/dev/menu-123-porzadek-zrzuty.mjs`. Poza PNG zapisuje `.png.json`
  z **pomiarem paska Menu 2**: liczba linii (wykryte zawinięcie), etykiety przycisków
  prawego klastra, liczba liczników, liczba banerów, liczba selectów, błędy konsoli.
- Zero błędów konsoli i zero HTTP ≥ 400 na wszystkich 8 zakładkach, PRZED i PO.

Warianty: **PRZED** 1440×900 jasny · **PO** 1440×900 jasny, 1920×1080 jasny, 1440×900 ciemny.

---

## Tabela: zakładka → przed → po → co zmienione

| # | Zakładka | PRZED (Menu 2) | PO (Menu 2) | Co zmienione |
|---|---|---|---|---|
| 01 | Inicjatywy › **Inicjatywy** | `Status: Wszystkie 97` · priorytety · segment · „Nowa inicjatywa" — **licznik w Menu 2**; kebab Menu 3 tuż przy chipach | `Status` · priorytety · segment · „Nowa inicjatywa"; kebab na prawym skraju Menu 3 | dropdown `compact` (znika licznik); select priorytetu w kanonicznym kształcie; kebab → `commandRowRightContent`; segment z SSOT |
| 02 | Inicjatywy › **Plan** | `Status: Wszystkie 0` · „Nowy plan" | `Status` · „Nowy plan" | dropdown `compact` |
| 03 | Inicjatywy › **Obciążenie** | `Status: Wszystkie 0` · „Nowa analiza" | `Status` · „Nowa analiza" | dropdown `compact` |
| 04 | Realizacja › **Kokpit** | pusto (bez odstępstw) | pusto | bez zmian — zakładka „chromeless", Menu 2 celowo puste |
| 05 | Realizacja › **Realizacje** | segment Aktywne/Wszystkie (własny kształt `h-8`) | segment z SSOT (`h-9`) | segment ujednolicony z Inicjatywami; plakietka „exec v2" z 4 licznikami usunięta (pokazywała się na sąsiednich zakładkach) |
| 06 | Realizacja › **Praca** | baner „Niepełne dane…" + select + „Nowe zadanie" (`btn-secondary`) + „New Decision" + „New milestone` w **slocie filtrów**, `flex-wrap` → zawijanie | select realizacji · **„Nowe zadanie" jako ciemny primary CTA** na prawym skraju | baner → nad tabelę (`Banner variant="degraded"`); CTA → `primaryCta`; „New Decision" **usunięty** (duplikat CTA zakładki Decyzje i ryzyka); „New milestone" → kebab Menu 3; `flex-wrap` usunięty |
| 07 | Realizacja › **Zasoby** | select + „Dodaj dostępność" + „Propose allocation" (oba `btn-secondary`) w slocie filtrów, `flex-wrap` | select realizacji · **„Dodaj dostępność" jako ciemny primary CTA** | CTA → `primaryCta`; „Propose allocation" → kebab Menu 3; `flex-wrap` usunięty |
| 08 | Realizacja › **Decyzje i ryzyka** | dropdown „Termin" + „Nowa decyzja"/„Nowa pozycja RAID" (`btn-secondary`) w slocie filtrów, `flex-wrap` | dropdown „Termin" · **„Nowa decyzja" / „Nowa pozycja RAID" jako ciemny primary CTA** | CTA → `primaryCta` (rozłącznie per preset, reguła `canDecide` zachowana); `flex-wrap` usunięty |

---

## Pomiar Menu 2 po zmianie (1440×900, jasny)

| Zakładka | linie | liczniki | banery | prawy klaster |
|---|---|---|---|---|
| inicjatywy/list | 1 | 0 | 0 | Status · Aktywne · Wszystkie · **Nowa inicjatywa** |
| inicjatywy/plan | 1 | 0 | 0 | Status · **Nowy plan** |
| inicjatywy/obciążenie | 1 | 0 | 0 | Status · **Nowa analiza** |
| realizacja/kokpit | 1 | 0 | 0 | — |
| realizacja/realizacje | 1 | 0 | 0 | Aktywne · Wszystkie |
| realizacja/praca | 1 | 0 | 0 | **Nowe zadanie** |
| realizacja/zasoby | 1 | 0 | 0 | **Dodaj dostępność** |
| realizacja/decyzje-ryzyka | 1 | 0 | 0 | Termin · **Nowa decyzja** |

Wysokość paska: **60 px na każdej zakładce** (jedna linia: `py-3` + kontrolka `h-9`).
PRZED dwie zakładki miały 62 px — różnica brała się z kontrolek o niekanonicznej wysokości.

---

## Rozstrzygnięcia, które warto znać przy odbiorze

1. **„Pokaż panel" ma JEDNO miejsce w całej aplikacji** i nie trzeba było go przenosić:
   dokłada je `useStandardPanelControls()` do prawego klastra Menu 3, tym samym kodem
   w `StandardModuleBar` i w `MyWorkHub` (Moja Praca). Zmierzone: to jedyne dwa miejsca
   w `src/`, które tę pigułkę renderują.
2. **Komunikaty o stanie danych mają jeden wzorzec** — istniejący `shared/Banner`
   (wariant `degraded`/`warning`), ten sam, którego używają Finanse i Ustawienia.
   Renderowany nad tabelą, w treści zakładki, nigdy w Menu 2.
3. **Natywne `<select>` zostają natywne.** Wizualnie wyrównane do przycisku
   `Menu2PresetDropdown` przez wspólną stałą `MENU_2_FILTER_SELECT`, ale nie zamienione
   na komponent — sterują nimi 3 testy e2e (`selectOption`) i 3 jednostkowe
   (`fireEvent.change`). Zamiana to osobny dyżur z migracją tych testów.
4. **Rzadkie akcje tworzenia idą do kebaba Menu 3**, nie do drugiego CTA — tym samym
   kanałem (`onRegisterMenu3Control`) i tym samym komponentem (`RowActionsMenu`),
   którego Raporty używają od P16-R6/D6. To nie jest nowy wzorzec, tylko rozszerzenie
   istniejącego na Pracę i Zasoby.

## Poza zakresem (nie ruszane)

- **Raporty** (`ExecutionReportsSurface`) — równolegle robi je inny robotnik.
  Jedyna zmiana dotykająca tej zakładki: prawy slot Menu 3 gospodarza obsługuje teraz
  trzy zakładki zamiast jednej (`reports` bez zmian w zachowaniu; test źródłowy
  `ExecutionHub.reportsMenu.source.test.ts` zaktualizowany, bo sprawdzał literalny
  kształt tego jednego ternary).
- Treść i liczba chipów Menu 3, kolumny tabel, logika danych, kontrakty API.
