# CODEX DAY 233 — FINANSE

Data: 2026-09-01  
Gałąź: `codex/day233-finanse-20260901`  
Marker nadrzędny użytkownika: `e99e81301ac8c9cc9b945eb44b7365fa7ff055d6`  
Stan: `PARTIAL / CORE EVIDENCE DELIVERED`

## Wynik wykonawczy

- R1: pięć rejestrów realnego `FinanceHub` zamontowane przez `dev-render`; wykonano 10 zrzutów light/dark oraz dwa uczciwe stany puste paneli. Fixture w harnessie napędza prawdziwy komponent, nie ręcznie odtworzoną powłokę.
- R2: realna `FinanceValuePanelsSurface` pokazuje 21 zakładek. Pięć paneli wynikowych ma zrzuty z policzonym wynikiem; dwa reprezentatywne stany puste mają osobne pary light/dark.
- R3: dopisano korektę do `modules/10_FINANCE/MODULE_ACCEPTANCE.md` bez zmiany istniejących wpisów.
- R4: pytanie „Management report w MVP czy poza” pozostaje otwarte.
- R5: raport i artefakty poza repo dostarczone.

## Pierwszy pomiar — sporna liczba paneli

Warstwa pomiaru: pełny `ApiGateway.getInstance().initializeRoutes(app)`, podpisany JWT bez auth bypassu, `ENABLE_V8_GLOBAL=true`, realny PostgreSQL `cx233` na `127.0.0.1:6181`, pełne migracje. Klasyfikacja `DANE` oznacza odpowiedź `2xx` z niepustym `body.data`; nie jest to grep ani samo istnienie pliku.

| Panel | Wołany adres | HTTP | Treść |
| --- | --- | ---: | --- |
| BankingValuePanel | `POST /api/v8/finance/value-tracking/banking/bank` | 200 | DANE |
| CashForecastPanel | `POST /api/v8/finance-planning/cash-forecast` | 200 | DANE |
| DriverPlannerPanel | BRAK — obliczenia lokalne | N/D | N/D |
| DriverTreePanel | `POST /api/v8/finance-planning/driver-tree/evaluate` | 200 | DANE |
| EfficientFrontierPanel | `POST /api/v8/finance-valuation/efficient-frontier` | 200 | DANE |
| EvBasketFootballField | BRAK — render z propsów | N/D | N/D |
| ExtendedRatiosPanel | `POST /api/v8/finance/value-tracking/ratios/extended` | 200 | DANE |
| HeadcountPlannerPanel | `POST /api/v8/finance-planning/headcount/opex` | 200 | DANE |
| InvestmentAppraisalPanel | `POST /api/v8/finance/value/appraise` | 200 | DANE |
| MonteCarloNpvPanel | `POST /api/v8/finance-valuation/monte-carlo-npv` | 200 | DANE |
| RealOptionsPanel | `POST /api/v8/finance-valuation/real-options/defer` | 200 | DANE |
| RollingForecastPanel | `POST /api/v8/finance-planning/rolling-forecast/reforecast` | 200 | DANE |
| ScenarioComputePanel | `POST /api/v8/finance-valuation/scenarios/apply` | 200 | DANE |
| ValuationVisualsPanel | BRAK — render z propsów | N/D | N/D |
| ValueAttributionPanel | `POST /api/v8/finance/value-tracking/attribution/rollup` | 200 | DANE |
| ValueCapturePipelinePanel | `GET /api/v8/finance/value-tracking/capture/funnel` | 200 | DANE |
| ValueLedgerPanel | `GET /api/v8/finance/value-tracking/ledger/current-value?initiativeId=init-001&kpiId=kpi-margin` | 200 | DANE |
| ValueOfficePanel | `POST /api/v8/finance/value/value-bridge` | 200 | DANE |
| VarianceBridgePanel | `POST /api/v8/finance/value/variance-bridge` | 200 | DANE |
| VarianceNarrationPanel | `POST /api/v8/finance-intelligence/variance/narrate` | 200 | DANE |
| WhatIfSensitivityPanel | `POST /api/v8/finance-valuation/sensitivity/tornado` | 200 | DANE |

Werdykt: **18 z 21** paneli woła backend i w tym pomiarze wszystkie 18 dostało dane. Trzy pozostałe są celowo lokalne/prop-driven. Teza instrukcji `5 z 21` jest obalona na aktualnym markerze; twierdzenie nadzorcy `18 z 21` zostało niezależnie potwierdzone dopiero powyższą sondą. Pełne requesty i odpowiedzi: `/private/tmp/cx-day233-finanse-artefakty/panel-probe.json`, SHA-256 `e33662056fb3655c5be99c924e7efcf7c0a363fdd4f8dd21179910decbb64002`.

## Środowisko i wejście

`df -h /` wykazało 22 GiB wolnego. Porty `6181`, `5150`, `5151` były wolne. Wynik markera i sanity dosłownie:

```text
MARKER OK
e99e81301ac8c9cc9b945eb44b7365fa7ff055d6
```

Pierwsze migracje zakończyły się `✅ Postgres migrations complete`; replay zakończył się:

```text
Applying migrations: 0
✅ Postgres migrations complete
```

Zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło `0 rows`; grep drenaży w `Gateway.ts` zwrócił 0 trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Flagi i bramki

Front `VITE_FINANCE_VALUE_PANELS` jest niezależny od backendowego `ENABLE_V8_GLOBAL`; pierwszy pozostaje default OFF (`src/utils/financeValuePanelsFlag.ts:1-30`), drugi zwraca `404 V8_DISABLED` przed dalszą obsługą (`server/src/middleware/v8FeatureGate.middleware.ts:10-20`). Harness używa wyłącznie query `ff_financeValuePanels=1` i `ff_wave3FinanceOwnerReview=1`; wartości domyślne nie zostały zmienione. Istniejący pakiet 126 testów obejmuje fail-closed public production host w `financeOwnerSampleData.contract.test.tsx`.

Pułapki dowodowe: (a) wyłączona przez jawne `ENABLE_V8_GLOBAL=true`; (b) jawne `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) jawne `MOCK_DB=false DB_TYPE=postgres` i realny readback migracji; (d) jawne `ENABLE_TEST_AUTH_BYPASS=false`, 401 przy błędnie podpisanej pierwszej sondzie oraz 200 po podpisie `config.JWT_SECRET` dowodzą realnej weryfikacji; (e) frontowa flaga była ustawiana osobno przez query tylko dla zrzutów.

## Zrzuty i pomiar motywów

Artefakty leżą wyłącznie w `/private/tmp/cx-day233-finanse-artefakty`. Wykonano 10 zrzutów rejestrów, listę 21 paneli, pięć wyników oraz dwa stany puste w obu motywach. Przykładowe luma: rejestr statements `246.1/24.6`, Monte Carlo `249.2/26.0`, lista 21 paneli `248.0/24.4`; każda para ma różnicę większą niż 150. Pełne sumy: `SHA256SUMS.txt`.

## Mianownik testów

Komenda przed i po: `RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/components/Economics/__tests__ dev-render/screens --retry=0 --reporter=json`. Przed: 126 pełnych nazw. Po: 126 pełnych nazw. `diff przed-nazwy.txt po-nazwy.txt`: pusty, 0 nazw dodanych i 0 znikniętych. Pliki: `przed-nazwy.txt`, `po-nazwy.txt`, `nazwy.diff` w artefaktach.

## Korekty wobec instrukcji

1. Użytkownik podał marker `e99e81301a`, podczas gdy instrukcja wewnątrz podawała `142686b772`; zastosowano nadrzędny marker użytkownika. Jest on przodkiem tipa, a tip był równy markerowi.
2. Korekta nadzorcy wskazała nieistniejący `server/src/routes/finance-valuation.routes.ts`; realny plik jest w `server/src/routes/v8/finance-valuation.routes.ts`, a router montuje wszystkie cztery rodziny w `server/src/routes/v8/index.ts:108-121`.
3. `dev-render/main.tsx` na markerze miał dwa zastane brakujące domknięcia wpisów (`day221-audyty-warsztat`, `day230-przepelnienie`), które blokowały parser całego harnessu. Dodano wyłącznie dwa brakujące `},` w licencjonowanym rejestrze.
4. `npx tsc --project dev-render/tsconfig.json` jest niewykonalne, bo taki config nie istnieje; zamiast uznać to za PASS, użyto realnego Vite renderu i pakietu Vitest z pełnymi nazwami.

## Management report — decyzja otwarta

**W MVP:** potrzebne są decyzja PDF/DOCX, kontrakt eksportu Wyceny produkujący istniejący typ `REPORT_EXPORT`, nowa trasa, implementacja kroku UI zamiast dzisiejszego placeholdera oraz ocena, czy `documentPdfRenderer` z Materiałów można bezpiecznie reużyć. To osobny pion backend + renderer + UI + dowód realnego pliku.

**Poza MVP:** `ExportStep.tsx` pozostaje uczciwym placeholderem, bez pracy implementacyjnej teraz. Ryzyko produktowe jest jawne: właściciel zobaczy brak eksportu na ekranach Finansów i może uznać go za lukę MVP.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano pełnego realnego przebiegu wyceny R1c z EV `-6 422 709,196 PLN`; pozycja była opcjonalna, a priorytetem był pełny pomiar 21 paneli i zrzuty.
- Nie udowodniono osobną symulacją hostname, że override owner-review gaśnie na `consultify.ai`; istniejący test kontraktowy jest zielony, a logika jest w `src/utils/financeOwnerReviewMode.ts:18`, lecz nie uruchamiano publicznego hosta.
