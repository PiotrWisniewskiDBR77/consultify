# M1b — popyt Capacity z zadań

Status: **READY FOR CTO REVIEW**. Paczka podłącza zaakceptowany czytnik M1a do `POST /capacity-scenarios/:scenarioId/compute` za flagą `CAPACITY_DEMAND_FROM_TASKS`. Flaga jest domyślnie OFF i włącza się wyłącznie dla dokładnej wartości `true`. Zmiennej staging ani Railway nie zmieniano; jej ustawienie pozostaje po stronie CTO.

## Zachowanie

- Przy fladze OFF `buildRoleSheet` zachowuje dotychczasowy kontrakt FTE i `demandSource: PLAN`.
- Przy fladze ON endpoint czyta zadania w scope organizacji i inicjatyw planu. `demand` oraz `supply` są godzinami; `demandFte` i `supplyFte` są pochodnymi liczonymi przez `40 h × liczba tygodni okresu`.
- Popyt zadaniowy zapisuje `demandSource: TASKS`, `taskDemandHours` i komplet `contributions` z identyfikatorami zadań, osób, godzinami, źródłem startu i brakami.
- `roleDemand` opublikowanego planu jest jawnym ręcznym nadpisaniem: `demandSource: MANUAL`, `manualDemandHours`, etykieta `Ręczne nadpisanie popytu z planu`; pierwotne `taskDemandHours` i wkłady zadań pozostają w agregacie.
- Ekran Capacity pokazuje godziny jako wartość główną, FTE pomocniczo oraz osobną kolumnę źródła popytu. Stare scenariusze bez `unit: HOURS` nadal pokazują FTE.
- Awaria odczytu scenariusza z bazy jest propagowana. Test regresyjny potwierdza, że nie staje się `scenario not found`.
- Oba skrypty M1 readback używają bezpośrednio `pg`; nie importują `DbPromise` i nie uruchamiają inicjalizacji schematu.

## RealPG Northwind

Źródło: lokalne odtworzenie dumpu `staging-pre-wdrozenie16-20260916T1709.dump` w jednorazowym PostgreSQL 18. Zero połączeń do stagingu i zero zapisu poza lokalną kopią.

Scenariusz `6696c99d-22ff-50e5-a6aa-dfcde4e20336`, organizacja `468b234c-66c4-54e1-b626-5e0fb3a92f6a`:

- plan: 8 inicjatyw, 8 okresów, 16 komórek, 30 zadań, **1440 h** znanego popytu;
- globalny stan **UNKNOWN** jest poprawny: zadanie testera `d6ef7f66-89e5-4fb2-a9a4-75eb4c3a7ee7` nie ma osoby, roli, estymaty ani terminu; odbiór opiera się na liczbach komórek i provenance, nie na globalnym `KNOWN`;
- forecast: 9 osób, **338 h** mocy tygodniowo; popyt **219,3 / 154,4 / 72,6 / 70,8 h**, z odpowiednio 11 / 8 / 5 / 4 zadaniami;
- przed M1b arkusz tego samego planu zapisuje 80 linii `PLAN` w FTE; po M1b zapisuje 64 linie `TASKS` i 16 jawnych `MANUAL` w godzinach. Wszystkie linie zadaniowe zachowują `contributions`.

Receipt `northwind-capacity-before-after.json` pokazuje także duże wartości ręcznych nadpisań dla okresów kwartalnych. To oczekiwany skutek istniejącego `roleDemand` wyrażonego w tygodniowym FTE i przeliczenia na godziny całego okresu; nie jest ono mieszane z bazą zadaniową bez etykiety.

## Walidacja

- focused: **5 plików / 36 PASS**, exit 0;
- server TSC: exit 0;
- frontend TSC: exit 2, **169 zastanych diagnostyk**, dokładnie baseline M1a/W156, delta 0;
- frontend build z `NODE_OPTIONS=--max-old-space-size=8192`: exit 0;
- ESLint zmienionych plików z wyłączonymi zastanymi regułami pełnego formatowania i sortowania całych bloków importów: exit 0;
- EN/PL JSON parse: exit 0;
- `git diff --check`, obejmujący `evidence/*.txt`: PASS.

Pierwszy build bez jawnego limitu pamięci zakończył się exit 134; powtórzenie z repozytoryjnym limitem 8 GB przeszło. Nie jest to defekt produktu.

## Ryzyka i granice

`getUserForecast` ma jeden produkcyjny wołacz i od M1a zmienia podstawę mocy na `users.weekly_capacity_hours × availability_percent`; frontend nie ma konsumenta tego endpointu. Ryzyko zostało zaakceptowane przez CTO w W156 i pozostaje jawne.

Dowód M1b jest read-only preview na świeżym lokalnym dumpie oraz test endpointowego kontraktu. Nie ustawiono `CAPACITY_DEMAND_FROM_TASKS=true` na stagingu, nie wykonano deployu ani zapisu scenariusza stagingowego. Po integracji CTO musi ustawić flagę na stagingu i wykonać live write/readback tego samego scenariusza.
