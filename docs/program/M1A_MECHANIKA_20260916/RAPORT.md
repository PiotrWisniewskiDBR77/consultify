# M1a — mechanika obciążenia z realnych zadań

Status: **WIP CHECKPOINT / pełne M1 PARTIAL**. Czytnik planu i publiczny forecast są naprawione oraz sprawdzone na realnym PostgreSQL, ale paczka nie jest zgłoszeniem do odbioru. Została zatrzymana po zmianie kolejności toru B we wpisie 128; przed M1 obowiązują teraz TEMPLATE-1 fix, EXPORT-1 1b, EXPORT-1 etap 2, DOCX i cleanup 96. Podłączenie nowego czytnika do zapisu `capacity_scenario` pozostaje za zależnością `PLAN-1` i poza plikami toru B.

## Zmiana zachowania

`getUserForecast` nie sumuje już członkostw projektowych i nie dzieli całego backlogu przez stałe cztery. Teraz:

- moc osoby pochodzi z `users.weekly_capacity_hours × availability_percent`;
- jawny `organizationId`, opcjonalny scope inicjatyw i jawny `asOf/weekCount` wyznaczają odczyt;
- istniejące `task_allocations` są nadrzędne per tydzień;
- bez alokacji godziny zadania rozkładają się po dniach roboczych między `started_at`, tymczasowym fallbackiem `created_at`, a terminem;
- wynik każdej komórki ma `taskIds`; brak estymaty lub terminu daje `UNKNOWN` i `unknownTaskIds`, nie znane zero;
- osoba spoza organizacji kończy odczyt błędem `M1_USER_NOT_FOUND`.

Nowy `planTaskDemandService` przyjmuje dokładny scope inicjatyw i okresy planu. Zwraca godziny per okres × rola wraz z wkładem każdego zadania. Wymaga niepokrywających się okresów, zachowuje pełny ślad zadania i rozpoznaje cztery braki: assignee, rola, estymata, termin. Końce okresów zapisane jako `23:59:59` są traktowane jako koniec dnia; data 30.09 nie wypada z Q3.

## RealPG Northwind

Źródło: lokalne odtworzenie dumpu `staging-thomas-przed-wdrozeniem-linii-20260911-2036.dump`, SHA-256 `85f0d5aafcd479b1b89b25b7fad3e46e3a147937f4f68ea47bbdd1a5c2f61531`. Zero zapisu do stagingu.

- plan `6696c99d-22ff-50e5-a6aa-dfcde4e20336`: 8 inicjatyw, 8 kwartałów;
- cztery inicjatywy mają 36 zadań / 1860 h, z czego 31 otwartych / **1520 h**;
- czytnik: `KNOWN`, 16 komórek okres × rola, 31 unikalnych `task_id`, suma **1520 h**, 0 incomplete;
- forecast: 9 osób, tygodnie 14.09 / 21.09 / 28.09 / 05.10;
- popyt: **219,3 / 154,4 / 72,6 / 70,8 h**, odpowiednio 11 / 8 / 5 / 4 źródłowe zadania, 0 unknown;
- moc organizacji: 338 h/tydz. Profile osób: 40 / 37 / 40 / 36 / 35 / 32 / 38 / 40 / 40 h. James ma 40 h, a nie dawne 80 h z dwóch członkostw;
- osobiste zadania Jamesa spoza scope nie weszły do wyniku;
- próba odczytu tego samego planu z obcego `organizationId` kończy się exit 1 i `plan scenario not found in organization scope`.

Pełne wyniki są w `evidence/northwind-plan-demand.json`, `evidence/northwind-user-forecast.json` i `evidence/northwind-summary.json`.

## Testy i bramki

- nowe testy: 2 pliki / 12 testów;
- cały focused zestaw workload: **6 plików / 37 PASS**;
- mutacja `UNKNOWN → 0`: RED, exit 1;
- mutacja mocy profilu do stałych 40 h: RED w 2 testach, exit 1;
- backend TSC: **0**, exit 0;
- root/frontend TSC na identycznym sparse checkout i tej samej współdzielonej instalacji: **169 → 169**, delta 0;
- ESLint zmienionego kodu: exit 0; Prettier i `git diff --check`: PASS;
- delta frontend testów i plików: 0/0; żadnego ekranu, więc nie tworzono pozornego screenshotu.

## Świadomie otwarte

`planTaskDemandService` nie jest jeszcze wołany przez `/capacity-scenarios/:scenarioId/compute`. Ten endpoint i `capacityRoleSheet` należą do mechaniki Inicjatyw współdzielonej z torem A, a `PLAN-1` nie znajduje się jeszcze na linii `258043df9f`. Wpięcie wymaga wspólnego kontraktu: godziny jako jednostka bazowa, ręczny popyt jako oznaczone nadpisanie oraz zachowanie task provenance w agregacie. Ta paczka nie zmienia ekranów, nie dodaje migracji i nie deklaruje pełnego M1 jako ukończonego.

Zero plików toru A, migracji, danych testowych w produkcie, staging write, deployu i Railway.
