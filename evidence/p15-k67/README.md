# P15-K6/K7 — dowód na ekranie [ODMROZENIE 05_INITIATIVES DEC-421]

Środowisko: własne API **4163** (`DB_MANAGED_SCHEMA=off`) na KOPII bazy
`consultify_p15k67` (`pg_dump consultify_fable | psql`) + migracja K1
`20262107_p15_k1_ie_relations_identity.sql` + seed stanowisk/FTE
`evidence/p15-k5/seed.sql`; własny vite **3183**; konto ADMIN `audyt@dbr77.local`.
Zrzuty 1440×900, motyw JASNY, `.png.json` obok każdego (url, błędy konsoli, czas).
Demo, staging i produkcja NIETKNIĘTE. Rekordy `proba-k67-*` skasowane po dowodzie.

Skrypt: `scripts/dev/plan-obciazenie/dowod-wariant-i-tryb.mjs <przed|po> <BASE> <AUTH> <ZNACZNIK>`.

## przed/ — kod SPRZED paczki (commit rodzic, przywrócony na czas zrzutów)
| # | Co widać |
|---|---|
| 01 | Karta planu → „Obciążenie ról": bez arkusza z analizy |
| 02 | Karta analizy → „Luki i presja" |
| 03 | Trzy warianty doradcy — „Zmień kolejność" z terminem **UNKNOWN** (solver nie znajdował przesunięcia) |
| 04 | Po wybraniu wariantu: sam kontrolowany wniosek |
| 05 | „Decyzje" karty analizy: **tylko „Opublikowano"** — ani śladu wyboru, ani linku do planu |

Krok 4 skryptu (szkic v+1 w Planie) w fazie `przed` **kończy się timeoutem** —
plan nie powstawał. To jest zmierzony stan wyjściowy, nie awaria narzędzia.

## po/ — kod paczki
| # | Co widać |
|---|---|
| 01 | Karta planu → „Obciążenie ról": ARKUSZ okres × rola (popyt/podaż/luka) z powiązanej opublikowanej analizy + „Otwórz analizę" |
| 02 | Karta analizy → luka roli Controls Engineer |
| 03 | Trzy warianty; „Zmień kolejność" z policzonym przesunięciem |
| 04 | Po wyborze: komunikat o zapisie |
| 05 | „Decyzje": **„Wybrano wariant: Przesuń kolejność o 2 okres(y) — propozycja do planu. → plan v3 (szkic)"** z linkiem |
| 06 | Karta planu (szkic v3): propozycja solvera, 5 inicjatyw przesuniętych na 28.09.2026, uzasadnienie po polsku, „Zatwierdź/Odrzuć" |
| 07 | Propozycja zatwierdzona |
| 08 | „Kolejność i okna" po przesunięciu |
| 09 | Nowa wersja planu opublikowana |
| 10 | Po odświeżeniu strony: przesunięte okna TRWAŁE (wersja 5, opublikowany) |
| 11 | Plan bez analizy: „Nieznane — brak opublikowanej analizy obciążenia." + „Nowa analiza z tego planu" |
| 12 | Generator na tym planie: tryb wg obciążenia ról **NIEAKTYWNY** z powodem po polsku |

`api-log.txt` (faza po): 121 wywołań `runtime-v1`, **0 odpowiedzi 4xx/5xx**,
`konsola.txt` pusta (0 błędów konsoli na wszystkich 12 zrzutach).

Para negatywna na trasie (poza przeglądarką, ten sam przebieg co test (d)):
`POST /plan-scenarios/:id/analysis-proposals/:pid` z `useCapacity: true` na planie
bez opublikowanej analizy → **400 `{"error":{"code":"VALIDATION_FAILED","rule":"CAPACITY_SCENARIO_REQUIRED"}}`**.

Mutacje (RED) — `mutacje.txt`.
