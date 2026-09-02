# Zamknięcie modułów Wave 3 — 2026-09-02

Wykonawca: sesja nadzorcza (agent). Katalog roboczy `/private/tmp/m03`, gałąź `codex/m03-admin-20260824`,
linia grafiki SHA `316bce9dd9aeff1bde71e368968b851467e93411`.

## Na czym stoi to zamknięcie

1. Właściciel przeklikał stronę odbioru i rozstrzygnął **260 kart pojedynczo**, a **5 ekranów sprzed
   zalogowania objął akceptem zbiorowym** („wszystkie są ok”), bez oglądania każdego z osobna.
   Razem **265 decyzji: 262 „ok”, 2 „nie”, 1 „poprawka”** — trwały eksport
   `docs/program/grafika/ODBIOR_DECYZJE.json`, baza `docs/program/grafika/odbior.sqlite`,
   opis akceptu zbiorowego `docs/program/grafika/AKCEPT_ZBIOROWY_20260902.md`.
2. Zapytany wprost, czy przegląd kart ma zastąpić osobny przegląd każdego modułu, właściciel wybrał
   **„Uznaj przegląd kart za odbyty przegląd modułów”**. To jest podstawa wpisów `PASS` w G07–G12.
3. **Piątka z akceptu zbiorowego nie podpiera żadnego zamknięcia modułu** — `auth-login`, `auth-register`,
   `auth-code-entry`, `auth-forgot-password`, `auth-reset-password` to ekrany sprzed zalogowania, leżą poza
   wszystkimi 16 modułami Wave 3 (kategoria POZA16 w mapie). Sprawdzone maszynowo, nie z pamięci.

## Co zmierzyłem przed wpisaniem czegokolwiek

Mapa ekran→moduł: `MAPA_GRAFIKA_MODULY_20260902.md` (reguła mapowania wypisana jawnie, 319 wierszy).
Rejestr grafiki ma **319 ekranów w 19 katalogach** (opis pliku mówi o 18 — 2026-09-02 doszedł `19-logowanie`),
a katalogi NIE odpowiadają 1:1 modułom: 14 ekranów zmieniło przynależność na podstawie pola `gdzie`
(np. `karta-insight` z katalogu Moja praca → Wywiad, `calendar-sync-settings` ze Spotkań → Ustawienia,
`prompt-registry-tab` z Narzędzi → Administracja), 15 ekranów jest wielomodułowych (kategoria WSPOLNE,
nie liczą się żadnemu modułowi), 14 leży poza 16 modułami (AI OS + ekrany sprzed zalogowania).

Pomiar kontrolny (maszynowy, powtarzalny z dwóch plików):

- 265 decyzji + 54 ekrany bez decyzji = 319 ekranów rejestru; 0 decyzji bez ekranu w rejestrze;
- ekranów o ocenie A/B (mianownik odbioru): **258 — wszystkie mają decyzję**;
- **wszystkie 54 ekrany bez decyzji mają ocenę C („nie pokazujemy”) albo D („odłożone”)** — nigdy nie szły do odbioru;
- ekranów zamkniętych jako „ok”, ale niosących merytoryczną uwagę właściciela: **87** w całym rejestrze, z czego
  **78 w obrębie 16 modułów** (reszta w kategoriach WSPOLNE/POZA16); rozbicie per moduł niżej.

## Tabela 16 modułów

| Moduł | Ekranów | A/B z decyzją | ok / nie / poprawka | Otwartych uwag | G07–G12 | G17 | G18 | Tag |
| --- | ---: | ---: | --- | ---: | --- | --- | --- | --- |
| 01 Organizacja | 22 | 21 z 21 | 21 / 0 / 0 | 0 | `PASS` | `PASS` | `PASS` | `modul-01-organizacja-final-20260902` |
| 02 Wywiad | 7 | 6 z 6 | 6 / 0 / 0 | 3 | `PASS` | `PARTIAL` | `NOT_STARTED` | — |
| 03 Narzędzia | 9 | 7 z 7 | 8 / 0 / 0 | 3 | `PASS` | `PARTIAL` | `NOT_STARTED` | — |
| 04 Ocena | 19 | 17 z 17 | 17 / 0 / 0 | 9 | `PASS` | `PARTIAL` | `NOT_STARTED` | — |
| 05 Inicjatywy | 8 | 6 z 6 | 6 / 0 / 0 | 5 | `PASS` | `PARTIAL` | `NOT_STARTED` | — |
| 06 Realizacja | 11 | 8 z 8 | 8 / 0 / 0 | 4 | `PASS` | `PARTIAL` | `NOT_STARTED` | — |
| 07 Moja praca / Agent | 43 | 40 z 40 | 41 / 0 / 0 | 19 | `PASS` | `PARTIAL` | `NOT_STARTED` | — |
| 08 Spotkania | 2 | 2 z 2 | 2 / 0 / 0 | 0 | `PASS` | `PASS` | `PASS` | `modul-08-spotkania-final-20260902` |
| 09 Wyniki | 22 | 19 z 19 | 20 / 1 / 0 | 9 | `PASS` | `PARTIAL` | `NOT_STARTED` | — |
| 10 Finanse | 16 | 13 z 13 | 12 / 0 / 1 | 3 | `PASS` | `PARTIAL` | `NOT_STARTED` | — |
| 11 Materiały | 40 | 35 z 35 | 36 / 1 / 0 | 14 | `PASS` | `PARTIAL` | `NOT_STARTED` | — |
| 12 Audyty | 4 | 4 z 4 | 4 / 0 / 0 | 1 | `PASS` | `PARTIAL` | `NOT_STARTED` | — |
| 13 Czat | 7 | 7 z 7 | 7 / 0 / 0 | 4 | `PASS` | `PARTIAL` | `NOT_STARTED` | — |
| 14 Administracja | 68 | 42 z 42 | 42 / 0 / 0 | 3 | `PASS` | `PARTIAL` | `NOT_STARTED` | — |
| 15 Ustawienia | 12 | 9 z 9 | 9 / 0 / 0 | 1 | `PASS` | `PARTIAL` | `NOT_STARTED` | — |
| 16 Partner | 0 | 0 z 0 | — | — | `PARTIAL` | `NOT_STARTED` | `NOT_STARTED` | — |

Kolumna „Otwartych uwag” = karty rozstrzygnięte jako „ok”, przy których właściciel zostawił merytoryczną
treść (np. „Do powtórki”, „tutaj muszę to odrzucić”, „tabela nie trzyma standardu”) i do której nie ma
decyzji retestowej. To są otwarte znaleziska, mimo decyzji „ok” na samym ekranie.

## Co zostało otwarte i co je domyka

### Trzy pozycje spoza „ok” (własne rozstrzygnięcia właściciela)

- **Materiały — `gen-excel-templates-tab` („nie”)**: zakładka do wycofania; ocena D + ODLOZONE. Domyka: usunięcie pozycji z produktu i potwierdzenie właściciela.
- **Wyniki — `results-three-pairs` („nie”)**: historyczny ekran do wycofania; ocena D + ODLOZONE. Domyka: usunięcie martwej ścieżki i potwierdzenie.
- **Finanse — `finance-baseline-workspace` („poprawka”)**: ekran istnieje z dodawaniem/usuwaniem założeń za flagą `financeBaselineWorkspaceV1` (OFF); właściciel zdecydował włączyć ją domyślnie PO naprawie surowej wartości „per-2025-12” w kolumnie Okres bazowy. Domyka: naprawa etykiety okresu, zrzut, włączenie flagi domyślnie, potwierdzenie.

### 78 otwartych uwag przy decyzjach „ok” (główny powód, dla którego nie zamykam 14 modułów)

Brief przewidywał `PARTIAL` w G17 tylko dla Materiałów, Wyników i Finansów. Pomiar pokazał więcej:
w 13 z 16 modułów właściciel zostawił merytoryczne uwagi przy kartach, które rozstrzygnął jako „ok”.
G17 brzmi „decyzje retestowe do KAŻDEJ uwagi” — tych decyzji nie ma, więc `PASS` byłby nieprawdziwy.
Rozkład: Wywiad 3, Narzędzia 3, Ocena 9, Inicjatywy 5, Realizacja 4, Moja praca / Agent 19, Wyniki 9, Finanse 3, Materiały 14, Audyty 1, Czat 4, Administracja 3, Ustawienia 1.
Pełne listy z nazwami ekranów: w wierszach G17 każdego `MODULE_ACCEPTANCE.md` i w mapie.

**Decyzja do podjęcia przez nadzorcę/właściciela:** jeśli „ok mimo uwagi” ma znaczyć „przyjęte, uwaga do
backlogu”, to G17 tych modułów można domknąć jedną decyzją właściciela o przeniesieniu 78 uwag do backlogu.
Sam tego nie zakładam — to jego decyzja, nie moja interpretacja.

### Partner (16) — jedyny moduł bez przedmiotu przeglądu

W rejestrze grafiki nie ma ANI JEDNEGO ekranu `/partner`. `partner-settlements-view` to SuperAdmin → Revenue
i został policzony w Administracji zgodnie ze swoim polem `gdzie`. Domyka: zrobienie zrzutów portalu partnera
i osobny przegląd — inaczej moduł nie ma jak przejść G07–G12.

## Licznik

**Zamkniętych ostatecznie: 2 z 16.**

Definicja użyta do liczenia (jawna): moduł jest zamknięty ostatecznie, gdy ma `PASS` w G07–G12 (przegląd
właściciela odbyty i zarejestrowany), `PASS` w G17 (zero otwartych uwag i zero pozycji „nie”/„poprawka”)
oraz `PASS` w G18 (akcept na dokładnym SHA + tag).

Wyliczenie:

- **01 Organizacja** — 21 kart A/B, 21× „ok”, 0 „nie”, 0 „poprawka”, 0 uwag → tag `modul-01-organizacja-final-20260902`;
- **08 Spotkania** — 2 karty A/B, 2× „ok”, 0 „nie”, 0 „poprawka”, 0 uwag → tag `modul-08-spotkania-final-20260902`;
- pozostałe 14: G07–G12 `PASS`, ale G17 otwarte (uwagi i/lub pozycje „nie”/„poprawka”), więc G18 `NOT_STARTED`.

Uczciwe zastrzeżenie do obu zamknięć: **08 Spotkania stoi na 2 kartach** — tyle ten moduł ma w rejestrze
grafiki (trzecia karta, `calendar-sync-settings`, należy do Ustawień). To jest cała reprezentacja modułu
w rejestrze, a nie pełny inwentarz jego ekranów w produkcie. Akcept dotyczy warstwy ekranowej;
bramek technicznych G05/G06 ani napraw G13–G16 ten wpis nie podnosi.

## Wpływ na licznik bramek

`node scripts/wave3/report-acceptance-gates.mjs`, stan przed → po:
bramek zamkniętych **31 → 125** z 336, nierozstrzygniętych **305 → 211**, modułów w pełni zamkniętych `0 → 0`
(pełne zamknięcie wymaga też G13–G16 i G19–G20). Per moduł: 01 Organizacja 5→13, 02 Wywiad 4→10, 03 Narzędzia 4→10,
04 Ocena 3→9, 05 Inicjatywy 3→9, 06 Realizacja 2→8, 07 Moja praca 2→8, 08 Spotkania 2→10, 09 Wyniki 2→8,
10 Finanse 2→8, 11 Materiały 1→7, 12 Audyty 0→6, 13 Czat 1→7, 14 Administracja 0→6, 15 Ustawienia 0→6, 16 Partner 0→0.

## Czego ten dokument NIE twierdzi

- G13–G16 (analiza, naprawa, self-QA, pakiet przed/po) i G19–G20 zostały nietknięte — zgodnie z poleceniem.
- Nie ruszałem `docs/program/grafika/status.json` ani `evidence/` (pracuje tam równolegle inny agent).
  W chwili pierwszego pomiaru `status.json` miał niezacommitowane zmiany tego agenta. Po jego commicie
  (`e6ba63c708`, plik z 14:18) powtórzyłem cały pomiar i porównałem oba przebiegi wiersz po wierszu:
  **0 różnic** w parach ekran/moduł/ocena/decyzja. Liczby powyżej są więc zgodne z drzewem commita.
- Żaden wpis `PASS` nie opiera się na pamięci rozmowy: każdy niesie liczbę, ścieżkę pliku i SHA.
