# M1a — mechanika obciążenia z realnych zadań

Status: **FROZEN / QUEUED dla rdzenia M1a w torze B / pełne M1 PARTIAL**. Czytnik planu i publiczny forecast są gotowe oraz ponownie sprawdzone na realnym PostgreSQL, a paczka została przeniesiona przed freeze na aktualną linię `7ec4e0b213`. Podłączenie do zapisu `capacity_scenario` pozostaje poza tą paczką, ponieważ wymaga plików Inicjatyw współdzielonych z torem A i kontraktu PLAN-1.

## Zmiana zachowania

`getUserForecast`:

- używa mocy osoby z `users.weekly_capacity_hours × availability_percent`; `NULL` zachowuje istniejącą politykę 40 h × 100%, a jawne `0 h` pozostaje zerem;
- przyjmuje jawny tenant, opcjonalny scope inicjatyw i `asOf/weekCount`; ponad 100 inicjatyw kończy się `M1_INITIATIVE_SCOPE_INVALID`, bez cichego obcięcia;
- traktuje `task_allocations` jako nadrzędne per zadanie i tydzień, zachowując `taskIds`; zapytanie nie zależy od postgresowego `ARRAY_AGG`;
- toleruje wyłącznie brak opcjonalnej relacji `task_allocations`; błąd uprawnień, kolumny lub połączenia jest zwracany, a nie zamieniany na fallback;
- bez jawnej alokacji rozkłada godziny zadania po dniach roboczych między `started_at`, tymczasowym fallbackiem `created_at`, a terminem;
- zachowuje lokalny dzień kalendarzowy wartości `timestamp without time zone`; godzina 17:00 w piątek nie przechodzi przez UTC na sobotę;
- zwraca `UNKNOWN` i `unknownTaskIds` dla braku estymaty lub terminu; osoba spoza organizacji kończy się `M1_USER_NOT_FOUND`.

Nowy `planTaskDemandService` przyjmuje dokładny scope inicjatyw i niepokrywające się okresy planu. Zwraca godziny per okres × rola wraz z wkładem każdego zadania, źródłem daty startu i czterema rodzajami braków: assignee, rola, estymata, termin. Końce okresów `23:59:59` są inkluzywne; obiekty `Date` zachowują lokalny dzień.

## RealPG Northwind — dowód v2

Źródło: lokalne odtworzenie dumpu `staging-thomas-przed-wdrozeniem-linii-20260911-2036.dump`, SHA-256 `85f0d5aafcd479b1b89b25b7fad3e46e3a147937f4f68ea47bbdd1a5c2f61531`. Zero odczytu lub zapisu na stagingu.

- plan `6696c99d-22ff-50e5-a6aa-dfcde4e20336`: 8 inicjatyw, 8 okresów;
- 31 otwartych zadań, 16 komórek okres × rola, `KNOWN`, suma **1520 h**, 0 incomplete;
- forecast: 9 osób, tygodnie 14.09 / 21.09 / 28.09 / 05.10;
- popyt: **219,3 / 154,4 / 72,6 / 70,8 h**, odpowiednio 11 / 8 / 5 / 4 źródłowe zadania, 0 unknown;
- moc organizacji: **338 h/tydz.**; profile 40 / 37 / 40 / 36 / 35 / 32 / 38 / 40 / 40 h;
- obcy `organizationId`: exit 1, `plan scenario not found in organization scope`.

Autorytatywne wyniki po poprawkach są w `evidence/northwind-plan-demand-v2.json`, `northwind-user-forecast-v2.json` i `northwind-summary-v2.json`.

## Testy i bramki

- focused workload: **6 plików / 42 PASS**, exit 0;
- mutacje jawnego 0 h, scope >100, fail-closed błędu alokacji i lokalnego dnia kalendarzowego: każda **RED / exit 1**;
- wcześniejsze mutacje `UNKNOWN → 0` i stałej mocy 40 h: RED;
- server TSC: **0**, exit 0;
- root/frontend TSC: **169 zastanych diagnostyk**, exit 2; linia `7ec4e0b213` ma 169 według odbioru W144 i bieżącego rejestru, delta 0;
- build frontend: **exit 0**; ostrzeżenia są zastane, bez plików wyjściowych w diffie;
- ESLint quiet zmienionego kodu, Prettier i `git diff --check`: PASS;
- delta plików frontu i migracji: 0/0. Brak nowego ekranu, więc zrzuty i Playwright UI nie mają zastosowania.

## Świadomie otwarte

`planTaskDemandService` nie jest wołany przez `/capacity-scenarios/:scenarioId/compute`. Ten endpoint i `capacityRoleSheet` należą do mechaniki Inicjatyw współdzielonej z torem A. Wpięcie wymaga godzin jako jednostki bazowej, ręcznego popytu jako jawnego nadpisania oraz zachowania task provenance w agregacie. Zgodnie z zakresem Codex-2 paczka nie dotyka tych plików, ekranów ani migracji i nie deklaruje pełnego M1 jako ukończonego.

Niezależny review pozostaje bramką CTO przy odbiorze; w tym wykonaniu obowiązuje pojedynczy agent Codex-2. Zero plików toru A, danych testowych w produkcie, staging write, deployu, Railway i chronionych refów.
