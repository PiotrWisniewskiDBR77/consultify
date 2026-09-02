# CODEX DAY 233 — FINANSE

Data: 2026-09-01  
Gałąź: `codex/day233-finanse-20260901`  
Marker nadrzędny użytkownika: `e99e81301ac8c9cc9b945eb44b7365fa7ff055d6`  
Stan: `PARTIAL / CORE EVIDENCE DELIVERED`

## Wynik wykonawczy

- R1: pięć rejestrów realnego `FinanceHub` zamontowane przez `dev-render`; wykonano 10 zrzutów light/dark oraz dwa uczciwe stany puste paneli. Fixture w harnessie napędza prawdziwy komponent, nie ręcznie odtworzoną powłokę.
- R2: **KOREKTA 2026-09-01 (odbiór, ocena B → FIX).** Ten wpis pierwotnie meldował „pięć paneli wynikowych ma zrzuty z policzonym wynikiem" — **nieprawda w chwili odbioru**. Rzeczywisty stan wtedy: **3 z 5**. Dwie pary (`panel-monte-carlo-populated-*`, `panel-scenarios-populated-*`) miały wariant **light** przechwycony PRZED wynikiem (sam formularz / sam przycisk „Uruchom") wskutek wyścigu klik→zrzut w jednorazowym, nigdy nie zacommitowanym skrypcie przechwytywania; wariant **dark** tych samych par pokazywał już policzony wynik. Bezpiecznik różnicy jasności to przepuścił (różnica > 200 przy progu 150) — zjawisko opisane jako `docs/program/funkcje/KSZTALT_19_PARA_ZGODNA_ROZNE_STANY.md`. **Naprawiono** w `fix/day233-zrzuty-jasne-20260901` (na bazie tego samego markera): nowy, zacommitowany skrypt `scripts/dev/day233-finanse-panele-zrzuty-jasne.mjs` czeka na selektor DOM wyniku (nie na czas) przed każdym zrzutem, dokładnie jak już poprawnie robiły pary Real Options / Efficient Frontier / What-if Sensitivity. Po naprawie: **5 z 5** paneli wynikowych ma zrzuty z policzonym wynikiem w OBU motywach, potwierdzone wzrokiem i automatyczną kontrolą pary (`scripts/dev/lib/checkScreenshotPairState.mjs`, dowód mutacyjny w `scripts/dev/__tests__/checkScreenshotPairState.test.mjs`). Dwa reprezentatywne stany puste (driver, value) nadal mają osobne, poprawne pary light/dark — nie były dotknięte tym defektem (brak klik/AutoRun w tych stanach).
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

## KOREKTA 2026-09-01 — naprawa wyścigu klik→zrzut (odbiór, ocena B → FIX)

Gałąź naprawy: `fix/day233-zrzuty-jasne-20260901` (na tipie `b94515af72231c2a3dc5cd676b7a70bd15db6e92`, ten sam marker rodzica jak wyżej).

**Gdzie naprawdę leżał defekt.** NIE w `dev-render/screens/finance-value-panels.tsx` (komponent `AutoRun`, linie 245-251) — ten mechanizm jest jednakowy dla wszystkich pięciu paneli wynikowych (Monte Carlo, Real Options, Efficient Frontier, What-if Sensitivity, Scenariusze) i sam w sobie poprawny: klika button na mount, panel liczy wynik asynchronicznie. NIE w produkcyjnych komponentach paneli (`MonteCarloNpvPanel.tsx`, `ScenarioComputePanel.tsx` itd.) — mają zdrowe `data-testid` na kontenerze wyniku (`mc-histogram`, `scenario-fan-chart`). Defekt leżał w **jednorazowym skrypcie przechwytywania zrzutów użytym przy odbiorze** — nigdy niezacommitowanym, nieobecnym w repo — który robił zrzut po stałym czasie/`networkidle` zamiast czekać na pojawienie się wyniku w DOM. Dlatego naprawa NIE dotyka kodu produkcyjnego paneli ani `finance-value-panels.tsx`.

**Naprawa.** Nowy, zacommitowany skrypt `scripts/dev/day233-finanse-panele-zrzuty-jasne.mjs` czeka Playwrightowym `waitForSelector` na selektor DOM wyniku KAŻDEGO panelu przed zrzutem (`mc-histogram`, `ro-defer-result`, `frontier-chart`, `sens-tornado-chart`+`sens-heatmap-chart`, `scenario-fan-chart`) — dokładnie ten wzorzec, którego Real Options/Efficient Frontier/What-if Sensitivity już używały poprawnie w oryginalnym przebiegu.

**Pięć zrzutów jasnych po naprawie, opisane wzrokiem (nie „przeszło"):**
- `panel-monte-carlo-populated-light.png` — panel „Symulacja Monte Carlo NPV": dwa wiersze driverów (Revenue/Cost), sześć kafli metryk (Średnie NPV 1 140 000, P10, P50/mediana, P90, P(NPV>0) 94%, VaR 5%) i histogram słupkowy z liniami P10/P50/P90. Wynik obecny.
- `panel-scenarios-populated-light.png` — panel „Obliczenie scenariuszy": wykres wachlarzowy z TRZEMA seriami (Bazowy/Optymistyczny/Konserwatywny), pasmo cieniowane między optymistycznym a konserwatywnym, legenda pod wykresem. Wynik obecny.
- `panel-real-options-populated-light.png` — panel „Opcje realne", zakładka „Odroczenie": trzy kafle wyniku (Wartość opcji 285 000, Rozszerzone NPV 385 000, Rekomendacja „Odrocz"). Bez zmian względem oryginału — był poprawny.
- `panel-frontier-populated-light.png` — panel „Granica efektywna": trzy kafle (Optymalne-wartość 940 000, Optymalne-ryzyko 29%, Optymalny mix) i wykres punktowy z linią granicy oraz zaznaczonym optymalnym punktem (zielona kropka). Bez zmian względem oryginału — był poprawny.
- `panel-sensitivity-populated-light.png` — panel „Analiza wrażliwości what-if": wykres tornado (3 paski Revenue growth/Gross margin/Operating costs, czerwono-zielone, wokół bazy 1.1M) ORAZ heatmapa 5×5 (price × wacc) z kolorowanymi komórkami. Bez zmian względem oryginału — był poprawny.

Warianty dark wszystkich pięciu par obejrzano również — identyczny stan (wynik obecny), inny tylko motyw kolorystyczny.

**Luma par (average mean luma, Rec.601, `scripts/dev/lib/meanLuma.mjs`, próg bezpiecznika 150):**

| Panel | Luma PRZED (light/dark/diff) | Luma PO (light/dark/diff) | Stan PRZED → PO |
| --- | --- | --- | --- |
| Monte Carlo | 249.1 / 26.3 / 222.7 | 243.7 / 24.1 / 219.5 | **BŁĘDNY** (light=sam formularz) → poprawny (light=histogram) |
| Scenariusze | 248.7 / 23.0 / 225.7 | 246.8 / 20.2 / 226.6 | **BŁĘDNY** (light=sam przycisk) → poprawny (light=wykres wachlarzowy) |
| Real Options | (niezmierzone osobno w tym przebiegu — obraz niezmieniony) | 248.7 / 18.1 / 230.6 | poprawny → poprawny (bez zmian) |
| Efficient Frontier | (jw.) | 248.5 / 21.4 / 227.1 | poprawny → poprawny (bez zmian) |
| What-if Sensitivity | (jw.) | 245.7 / 26.8 / 218.9 | poprawny → poprawny (bez zmian) |

Wszystkie pięć par PO naprawie ma różnicę jasności > 150 **oraz** wynik obecny w DOM w obu wariantach — potwierdzone przez `checkScreenshotPairState()` (PASS na wszystkich 8 parach, w tym dwóch stanów pustych i listy 21 paneli, `node scripts/dev/day233-finanse-panele-zrzuty-jasne.mjs`, kod wyjścia 0).

**Zabezpieczenie przed nawrotem — `scripts/dev/lib/checkScreenshotPairState.mjs`.** Do istniejącego wymiaru (różnica jasności ≥ 150) dodano drugi, niezależny wymiar: obecność selektora DOM wyniku w OBU wariantach w chwili przechwycenia zrzutu (nie w obrazie — w DOM, bo to jedyne miejsce, gdzie ta informacja jest tania i pewna). Para przechodzi tylko, gdy przechodzi oba wymiary.

**Dowód mutacyjny (dosłowne wyjścia, `node --test scripts/dev/__tests__/checkScreenshotPairState.test.mjs`):**

Z aktywnym zabezpieczeniem (stan repo) — 6/6 PASS, kod wyjścia 0:
```
✔ WYŚCIG PRZYWRÓCONY (kształt 19): light bez wyniku, dark z wynikiem -> kontrola CZERWIENI SIĘ mimo ogromnej różnicy jasności (0.496875ms)
✔ KONTROLA ISTNIEJĄCEGO WYMIARU nadal działa: para-duplikat (kształt 13) też czerwienieje (0.092375ms)
✔ NAPRAWIONE (po fix233): oba warianty mają wynik w DOM -> kontrola ZIELENIEJE (0.337416ms)
✔ Pary bez wymogu wyniku (np. stan pusty) ignorują wymiar stanu — liczy się tylko jasność (0.059584ms)
✔ WYŚCIG (wariant: gubi wynik w OBU wariantach naraz) -> kontrola też CZERWIENI SIĘ, nie tylko przy niezgodności (0.450375ms)
✔ Brak pomiaru markera przy requiresResultMarker=true jest sam w sobie błędem (nie milcząco OK) (0.0685ms)
ℹ tests 6
ℹ pass 6
ℹ fail 0
EXIT: 0
```

Z RĘCZNIE USUNIĘTYM wymiarem 2 (kod zakomentowany w `checkScreenshotPairState.mjs`, symulacja „usuń zabezpieczenie") — 3/6 FAIL, kod wyjścia 1:
```
✖ WYŚCIG PRZYWRÓCONY (kształt 19): light bez wyniku, dark z wynikiem -> kontrola CZERWIENI SIĘ mimo ogromnej różnicy jasności
  AssertionError [ERR_ASSERTION]: stary bezpiecznik (tylko luma) przepuściłby tę parę — nowy MUSI ją odrzucić
  true !== false
✖ WYŚCIG (wariant: gubi wynik w OBU wariantach naraz) -> kontrola też CZERWIENI SIĘ, nie tylko przy niezgodności
  AssertionError: true !== false
✖ Brak pomiaru markera przy requiresResultMarker=true jest sam w sobie błędem (nie milcząco OK)
  AssertionError: true !== false
ℹ tests 6
ℹ pass 3
ℹ fail 3
EXIT: 1
```
Po przywróceniu kodu (`git checkout` / ręczne cofnięcie mutacji) — z powrotem 6/6 PASS, kod wyjścia 0 (identyczne z pierwszym wydrukiem powyżej).

To dowodzi, że test faktycznie broni bezpiecznika (metodyka repo: „test scenariusza nie broni zabezpieczenia" — mutacja celowała w SAM bezpiecznik, nie tylko w scenariusz zewnętrzny), zgodnie z zasadą programu: *zabezpieczenie bez testu, który czerwienieje po jego usunięciu, jest nieudowodnione.*

**Uczciwie niewykonane / ograniczenia:**
- Próbowano dodatkowo odtworzyć oryginalny wyścig NA ŻYWO w przeglądarce (Playwright, ten sam harness, `DAY233_SIMULATE_RACE=1` w `day233-finanse-panele-zrzuty-jasne.mjs`, zrzut natychmiast po `networkidle` z minimalnym opóźnieniem). Na tej maszynie NIE udało się deterministycznie odtworzyć błędu — mockowany fetcher (`async () => MOCK_RESULT`) rozwiązuje się na tyle szybko, że nawet 20 ms opóźnienia wystarczało na poprawny render w obu wariantach. To nie podważa naprawy (przyczyna — wyścig w skrypcie odbioru, którego już nie ma — jest ustalona z artefaktów PRZED naprawą, cytowanych w tabeli luma powyżej) ani dowodu mutacyjnego (który celuje bezpośrednio w logikę bezpiecznika na zmierzonych, prawdziwych danych defektu, nie w symulację czasową). Zgłaszane wprost, żeby nie zacierać śladu niepewności.
- Skrypt naprawczy nie został jeszcze wpięty jako gate pre-commit/pre-push (`check-list-canon.sh` itp.) — na razie działa jako narzędzie deweloperskie uruchamiane ręcznie przy każdym odbiorze zrzutów tego ekranu. Wpięcie do automatycznego gate'u to osobna decyzja spoza zakresu tego FIX-u.
