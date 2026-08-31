# CODEX DAY 200 — panele finansów

Data: 2026-08-31  
Marker: `60581ed6b5`  
Gałąź: `codex/day200-panele-finansow-20260831`

## Wynik

- **R1: ZROBIONE** — własny inwentarz 21/21 poniżej.
- **R2: ZROBIONE w zakresie osiągalności; wrappery 10/19 → runda polerowania** — istniejący rejestr rozszerzony z 5 do 21 paneli; jedna istniejąca flaga `ff.finance_value_panels`, domyślnie OFF; bez zmian wyglądu paneli i bez zmian backendu. 10 z 19 endpointów `finance-valuation` nadal bez typed clienta (patrz sekcja TWIERDZENIA NIEZWERYFIKOWANE) — domknięcie tego zakresu to osobna runda polerowania, nie blokuje osiągalności UI.
- **R3: CZĘŚCIOWO / EVIDENCE_MISSING** — pakiet render/test jest zielony i wykonano 14 zrzutów (7 obsługiwanych ekranów × 2 motywy), ale wydany harness nie obejmuje pozostałych 14 paneli, a tabela licencji nie pozwala zmienić `dev-render/**`. Nie deklaruję 42 zrzutów ani dwóch testów realnego API jako wykonanych.

## Baza pracy i marker — wynik dosłowny

```text
60581ed6b5054e3218f7bc33d6e2a32794fb2af8
MARKER OK
```

`git status --short | head -3` po utworzeniu worktree: brak wyjścia. Tip gałęzi bazowej był przed markerem; log i lista zmienionych plików zostały zmierzone przed pracą. Scalenie pozostaje po stronie nadzorcy.

## R1 — inwentarz 21 paneli

Stan wołacza oznacza stan **przed** zmianą. `typed client` dotyczy wyłącznie `src/services/financeValuationApi.ts`, nie innych klientów Finance używanych przez część paneli.

| Plik | Props wejściowe z sygnatury TS | Endpoint `finance-valuation` | Typed client | Stan wołacza przed zmianą |
|---|---|---|---|---|
| `BankingValuePanel.tsx` | opcjonalny `fetcher { bank, status, portfolio }` | brak dopasowania; osobna usługa banking | NIE / nie dotyczy | zero importów komponentu |
| `CashForecastPanel.tsx` | brak props komponentu | **KOREKTA:** `POST /finance-planning/cash-forecast` — REALNY wołacz (poza `finance-valuation.routes.ts`, w `finance-planning.routes.ts`), wywoływany `onClick` (przycisk „Oblicz"/`cash-forecast-run`), NIE lokalne obliczenia | TAK `postCashForecast` (`src/services/api/v8/financePlanning.ts` — poza wąskim zakresem `financeValuationApi.ts` z przypisu na początku tabeli) | zero importów komponentu |
| `DriverPlannerPanel.tsx` | `driverTree?`, `formatValue?` | brak dopasowania; obliczenia lokalne | NIE / nie dotyczy | zero importów komponentu |
| `DriverTreePanel.tsx` | opcjonalny `fetcher { evaluate, chart }` | brak dopasowania | NIE / nie dotyczy | zero importów komponentu |
| `EfficientFrontierPanel.tsx` | opcjonalny `fetcher` | `POST /efficient-frontier` | TAK `runEfficientFrontier` | importer za flagą OFF |
| `EvBasketFootballField.tsx` | `basket?`, `unitLabel?`, `subjectLabel?`, `formatValue?`, `t?` | brak dopasowania; komponent prezentacyjny | NIE / nie dotyczy | zamontowany bezwarunkowo w Benefits |
| `ExtendedRatiosPanel.tsx` | opcjonalny `fetcher { extended, dupont, benchmark }` | brak dopasowania | NIE / nie dotyczy | zero importów komponentu |
| `HeadcountPlannerPanel.tsx` | opcjonalny `fetcher { opex, summary }` | brak dopasowania | NIE / nie dotyczy | zero importów komponentu |
| `InvestmentAppraisalPanel.tsx` | `initialCashFlows?`, `discountRatePct?`, `fetcher?`, `modelId?`, `modelFetcher?` | najbliższe: capital-decision, ale brak kontraktu 1:1 | NIE; nie fabrykowano wrappera | zero importów komponentu poza testami |
| `MonteCarloNpvPanel.tsx` | opcjonalny `fetcher(req)` | `POST /monte-carlo-npv` | TAK `runMonteCarloNpv` | importer za flagą OFF |
| `RealOptionsPanel.tsx` | opcjonalny `fetcher { defer, abandon, staged }` | `POST /real-options/defer`, `/abandon`, `/staged` | TAK, 3 wrappery | importer za flagą OFF |
| `RollingForecastPanel.tsx` | opcjonalny `fetcher { reforecast, rollForward }` | brak dopasowania | NIE / nie dotyczy | zero importów komponentu |
| `ScenarioComputePanel.tsx` | opcjonalny `fetcher { apply, fan }` | `POST /scenarios/apply`, `/fan` | TAK, 2 wrappery | importer za flagą OFF |
| `ValuationVisualsPanel.tsx` | `valuation?` | brak kontraktu 1:1; komponent prezentacyjny | NIE; uczciwy stan pusty | zero importów komponentu |
| `ValueAttributionPanel.tsx` | opcjonalny `fetcher` | brak dopasowania | NIE / nie dotyczy | zero importów komponentu |
| `ValueCapturePipelinePanel.tsx` | opcjonalny `fetcher { funnel, gates, createGate, advanceGate }` | brak dopasowania | NIE / nie dotyczy | zero importów komponentu |
| `ValueLedgerPanel.tsx` | opcjonalny `fetcher { freezeBaseline, appendEntry, currentValue }` | brak dopasowania | NIE / nie dotyczy | zero importów komponentu |
| `ValueOfficePanel.tsx` | `initiatives?`, `valueBridgeFetcher?`, `portfolioFetcher?` | brak dopasowania; korzysta z `/api/v8/finance/value/**` | NIE / nie dotyczy | zero importów komponentu |
| `VarianceBridgePanel.tsx` | `lines?`, `fetcher?` | brak dopasowania; korzysta z `/api/v8/finance/value/variance-bridge` | NIE / nie dotyczy | zero importów komponentu |
| `VarianceNarrationPanel.tsx` | brak props komponentu | brak dopasowania; osobna usługa variance | NIE / nie dotyczy | zero importów komponentu |
| `WhatIfSensitivityPanel.tsx` | opcjonalny `fetcher { tornado, dataTable }` | `POST /sensitivity/tornado`, `/data-table` | TAK, 2 wrappery | importer za flagą OFF |

Pomiar plików: `ls src/components/Economics/panels/*.tsx | grep -v __tests__ | wc -l` → `21`. Pomiar handlerów: `grep -n "router.post\|router.get" server/src/routes/v8/finance-valuation.routes.ts | wc -l` → `19`.

## R2 — implementacja

Rozszerzono `PANELS` i `LABELS` w `FinanceValuePanelsSurface.tsx` do 21 pozycji. Zachowano wzorzec `role="tab"`, jeden aktywny panel oraz dotychczasowy panel startowy Monte Carlo. `FinanceHub.tsx`, wnętrza 21 paneli, `financeValuationApi.ts`, backend V8 i `ENABLE_V8_GLOBAL` pozostały bajtowo nietknięte.

Nie utworzono nowej flagi, ponieważ istniejąca `isFinanceValuePanelsEnabled()` dokładnie obejmuje tę powierzchnię i ma bezpieczny fallback `false`. Przy OFF powierzchnia zwraca `null`, więc żaden panel z niej nie może wykonać żądania. Backend pozostaje niezależnie zamknięty za `ENABLE_V8_GLOBAL === 'true'`.

## Testy i pomiar nazw

Przed: 128/128. Po: 130/130. Oba przebiegi: `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0`, reporter JSON. To jest dowód jednostkowy/render, nie dowód egzekucji realnego API.

Diff pełnych nazw:

```diff
+day200 Finance value panels registry > exposes exactly 21 panel tabs behind the explicit flag and preserves Monte Carlo as active
+day200 Finance value panels registry > keeps all 21 panels unreachable while the existing front flag is OFF
```

Zniknięte nazwy: brak. Artefakty: `/private/tmp/cx-day200-panele-finansow-artefakty/przed.json`, `po.json`, `przed-nazwy.txt`, `po-nazwy.txt`, `nazwy.diff`.

Manifest SHA-256 wszystkich 22 plików dowodowych: `/private/tmp/cx-day200-panele-finansow-artefakty/artefakty-sha256.txt`.

Pułapki Z33: pakiet jest czysto jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`), więc nie dowodzi `ApiGateway`, JWT ani Postgresa. Dowodzi jedynie 21 tabów i fail-closed flagi frontowej. `ENABLE_V8_GLOBAL`, auth bypass i strażnik beta nie leżą na ścieżce tego renderu; realne API pozostaje `EVIDENCE_MISSING`.

## RealPostgres i Z30

Kontener: `cx-day200-pg`, wyłącznie `127.0.0.1:6131`, baza `consultify_w3_finance_owner_cx200`. Pierwszy przebieg migracji: zakończony `Postgres migrations complete`. Drugi: `Applying migrations: 0`.

```text
BRAK ZMIENNYCH POCZTY
SELECT ... FROM settings WHERE key LIKE 'smtp%'; -> (0 rows)
grep drenów w server/src/Gateway.ts -> 0 trafień
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Korekty wobec instrukcji

1. Komenda T4 opisana jako dowód „15 paneli bez żadnego importera” wyszukuje dowolne wystąpienie nazwy, nie import komponentu. Dla `InvestmentAppraisalPanel`, `ValueOfficePanel` i `VarianceBridgePanel` zwróciła trafienia w usługach lub innych panelach. Werdykt importu wymagał osobnego pomiaru konstrukcji importowych. Nie jest to STOP; stan komponentów zweryfikowano osobno.
2. §0.2b wymaga dowodu z tabeli `settings` przed pierwszą operacją zapisującą, lecz ten dowód jest możliwy dopiero po migracjach tworzących tabelę, a §0.2c nakazuje migracje przed jakimkolwiek pomiarem. Wybrano bezpieczną interpretację: migracje na nowej lokalnej bazie, następnie natychmiastowy protokół Z30 przed testami/runtime. Runtime nie został uruchomiony.
3. R3 mówi w nagłówku „19 paneli × 2”, a kryterium i dalszy tekst mówią `21×2=42`. Wiążący bezpieczniejszy mianownik to 21. Nie został zadeklarowany jako wykonany.

## R3 — ograniczenie dowodowe

Wydany `dev-render/screens/finance-value-panels.tsx` obsługuje tylko: `value`, `driver`, `monte-carlo`, `real-options`, `frontier`, `sensitivity`, `scenarios` (7 paneli). `dev-render/**` nie znajduje się w tabeli licencji zapisu. Zgodnie z regułą „plik poza licencją = tylko odczyt” nie rozszerzono harnessu. Dostarczony czerwony kontrakt: R3 nie może otrzymać werdyktu PASS bez 42 plików PNG i dwóch realnych testów przez `ApiGateway`.

Na istniejącym harnessie uruchomionym lokalnie na przydzielonym porcie `5072` wykonano 14 zrzutów: każdy z 7 obsługiwanych paneli w motywie jasnym i ciemnym. Kontrola wzrokowa próbek `value-light.png` i `scenarios-dark.png` potwierdziła realny render komponentów. Pełny manifest SHA-256: `/private/tmp/cx-day200-panele-finansow-artefakty/zrzuty-sha256.txt` (14 wierszy). Harness nie uruchamiał `server/src/index.ts` ani połączenia bazodanowego.

KOORDYNACJA toru grafiki: materiał częściowy dla flagi `ff.finance_value_panels` leży w `/private/tmp/cx-day200-panele-finansow-artefakty/*.png`; **nie jest kompletem właścicielskim**, ponieważ obejmuje 7/21 paneli.

Rekomendacja nadzorcy: wydać wąską licencję na dedykowany harness Day 200 poza produktem albo zaakceptować pełny runtime na portach 5072/5073 po dostarczeniu fixture organizacji i wskazaniu dwóch endpointów rzeczywiście konsumowanych przez dwa panele. Bez tej decyzji nie wolno fabrykować danych ani nazywać renderu 7/21 kompletem.

## TWIERDZENIA NIEZWERYFIKOWANE

- 42 zrzuty (21 paneli × jasny/ciemny): **14/42 WYKONANO; komplet EVIDENCE_MISSING**.
- Dwa zielone testy realnego API przez `ApiGateway`, podpisany JWT i Postgres: **NIE WYKONANO / EVIDENCE_MISSING**.
- Panele osiągalne z rozszerzonego rejestru mają różny stan integracji danych. `ValuationVisualsPanel`, `EvBasketFootballField`, `DriverPlannerPanel` oraz `VarianceBridgePanel` bez props wejściowych renderują uczciwy stan pusty/ograniczony; nie podstawiono fikcyjnych fetcherów.
- Spośród 19 endpointów `finance-valuation` nadal bez typed clienta pozostaje 10: `/value-at-risk`, `/value-at-risk/portfolio`, `/efficient-frontier/portfolio`, `/sensitivity/one-way`, `/sensitivity/break-even`, `/scenarios/compare` oraz cztery `/capital-decision/*`. Pomiar klienta wykazał 9 obsługiwanych endpointów, a nie opisane w instrukcji 5.

## Pliki produktu

Dozwolone zmiany: `FinanceValuePanelsSurface.tsx`, test `day200.FinanceValuePanelsSurface.test.tsx`, ten raport. Lista końcowa jest mierzona przez `git diff --name-only 60581ed6b5..HEAD`.

## DOPISEK — dyżur 200-b (FIX-200, wąska licencja na dedykowany harness)

Nadzorca wydał licencję rozszerzoną: dedykowany harness `dev-render/screens/day200-finance-panels.tsx`
(nowy plik, obok istniejącego `finance-value-panels.tsx` — TEN plik pozostał bajtowo
nietknięty) plus 2 nowe testy realnego API. Zero zmian w panelach, `FinanceHub`, flagach.

**R3 domknięte:**

- **42/42 zrzuty** (21 paneli × jasny/ciemny): 14 z pierwotnego dyżuru 200 (`finance-value-panels.tsx`,
  7 paneli) + 28 nowych z dedykowanego harnessu (pozostałych 14 paneli). Manifesty SHA-256:
  `/private/tmp/cx-day200-panele-finansow-artefakty/artefakty-sha256.txt` (pierwotne 7) i
  `zrzuty-day200-14paneli-sha256.txt` (nowe 14). Własny przegląd wzrokowy 8/28 nowych zrzutów
  (oba motywy, różne archetypy: formularz+KPI, wykres słupkowy, heatmapa, football-field) —
  zero crimson poza semantyką, zero NaN. Przy przeglądzie znaleziono i naprawiono w harnessie
  (nie w produkcie) dwa błędy skali mock-danych: `InvestmentAppraisalPanel.irr/mirr` i
  `VarianceNarrationPanel`/`VarianceBridgePanel` `pct`/`sharePct` oczekują liczby już w
  procentach (0–100), nie ułamka (0–1) — pierwsza wersja renderowała „0.2%" zamiast „18.4%".
- **Dwa zielone testy realnego API przez `ApiGateway`, podpisany JWT i Postgres: WYKONANE.**
  `server/src/routes/v8/__tests__/day200.driver-tree-evaluate.pg.test.ts` (3 testy: 401 bez
  tokenu, 200 z realnym wynikiem `POST /api/v8/finance-planning/driver-tree/evaluate` — kształt
  i wartości dokładnie takie, jakie wysyła/konsumuje `DriverTreePanel.tsx`, 400 na cyklu) i
  `day200.monte-carlo-npv.pg.test.ts` (3 testy: 404 `V8_DISABLED` gdy `ENABLE_V8_GLOBAL` OFF,
  200 z deterministycznym realnym wynikiem `POST /api/v8/finance-valuation/monte-carlo-npv` —
  kształt trójkątnych rozkładów dokładnie taki, jaki wysyła `MonteCarloNpvPanel.tsx`, 400 na
  pustej mapie driverów). Oba testy montują TEN SAM stos co `Gateway.ts:1481-1482`
  (`app.use('/api/v8', v8FeatureGate, v8Router)`) — realny `verifyToken`, realny `v8OrgGate`,
  `ENABLE_V8_GLOBAL='true'` ustawiane w `beforeAll`, nie omijane. Postgres: kontener
  `cx-fix200-pg` (`pgvector/pgvector:pg16`, wyłącznie `127.0.0.1:6141`), migracje
  `DB_TYPE=postgres tsx server/scripts/migrate.postgres.ts` — 870 migracji, `Postgres migrations
  complete`. 6/6 testów PASS; zero-residue po `afterAll` (sprawdzone bezpośrednio w bazie).
  **Mutacja obu ścieżek potwierdzona czerwona**, potem odtworzona zielona: `driverTreeService.ts`
  operator `'*'` tymczasowo zamieniony na dodawanie → test złapał (`AssertionError`, wartość
  120000 vs zmutowana), zrewertowane (`diff` przeciw kopii zapasowej = brak różnic);
  `finance-valuation.routes.ts` handler `/monte-carlo-npv` tymczasowo ignorował `iterations`
  z żądania (twardy `100`) → test złapał (`expected length 2000, got 100`), zrewertowane.
  Logi: `/private/tmp/cx-day200-panele-finansow-artefakty/mutacje/` (green-1, MUTATED-red ×2,
  green-final), SHA-256 w `mutacje-sha256.txt`.

**Endpointy zgodne z sekcją TWIERDZENIA NIEZWERYFIKOWANE** pozostają bez zmian — 10/19
`finance-valuation` endpointów nadal bez typed clienta (nie w zakresie tego dyżuru).

Sprzątnięcie: kontener `cx-fix200-pg` usunięty (`docker rm -f -v`) po zebraniu dowodów.
