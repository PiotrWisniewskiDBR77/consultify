# D-08 — Realizacja → Resources: PREMISA NIE POTWIERDZONA (obie części)

Zero zmian w kodzie. Raport opisał to, co było widać na PIERWSZYM ekranie
tabeli, i uogólnił na całą tabelę. Poniżej pomiar pełnego zbioru.

## Zarzut 1: „kolumna BACKLOG (H) ma «—» w każdym z 72 wierszy"

**Nieprawda.** `GET /api/execution-control/capacity/resource-plan?weeks=8`
oddaje 72 wiersze (9 osób × 8 tygodni) i **5 z nich ma `backlogHours > 0`**:

| osoba | zaległość |
|---|---|
| Emily Carter | 15 h |
| Priya Sharma | 28 h |
| Robert Chen | 10 h |
| Sarah Mitchell | 12 h |
| Thomas Baker | 8 h |
| **razem** | **73 h — dokładnie tyle, ile mówi podsumowanie** |

Zaległość jest z definicji liczbą NA OSOBĘ, nie na tydzień, więc kontrakt
(`src/services/execution/resourcePlanApi.ts`) stawia ją **tylko w wierszu
bieżącego tygodnia**: „Zaleglosc osoby (h) — TYLKO w wierszu biezacego
tygodnia, indziej 0". 67 wierszy z „—" to działanie zgodne z projektem,
a nie brak danych.

Dowód w zrzucie: `przed/jasny.txt` (ten sam przebieg, co obraz) zawiera
wiersz „Emily Carter · Production Planner | from 07/09/2026 | 14 h | 37 h |
38 % | +23 h | **15 h**". Pierwsze widoczne wiersze należą do Jamesa
Whitfielda (zaległość 0) — i to je zobaczył raport.

Filtr „With backlog 5" (Menu 3) pokazuje właśnie te pięć osób.

## Zarzut 2: „Chip «Overallocated 2» przy maks. wykorzystaniu 50 %"

**Nieprawda.** Najwyższe wykorzystania w pełnym zbiorze:
Daniel Osei **148 %** (tydzień 21/09), Laura Novak **133 %** (tydzień 07/09),
Emily Carter 86 %, Michael Grant 51 %, Daniel Osei 50 %.
Wierszy powyżej 100 % jest dokładnie **2** — tyle, ile mówi chip i tyle,
ile mówi `summary.overloadedCount`. „50 %" było najwyższą wartością na
pierwszym ekranie, nie w tabeli.

## Wniosek
Ekran Resources liczy poprawnie i zgadza się z API co do liczby. Nie ma tu
czego naprawiać. Lekcja jest o metodzie pomiaru („próbka zamiast zbioru"),
nie o produkcie.
