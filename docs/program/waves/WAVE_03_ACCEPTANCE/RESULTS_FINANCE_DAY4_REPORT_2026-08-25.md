# Results i Finance dzień 4 — raport dyżuru 2026-08-25

Baza: `codex/m03-admin-20260824 @ ca292730ff2585297a345cec551d8420eb005b21`  
Marker: `ca292730ff2585297a345cec551d8420eb005b21` — POTWIERDZONY  
Gałąź robocza: `codex/results-finance-day4-20260825`  
Worktree: `/private/tmp/consultify-results-finance-day4`  
Porty użyte: żadne  
Czas pracy: 2026-08-25 11:27 CEST–w toku

## Warunki wstępne — wynik sprawdzenia

| Sprawdzenie                                  | Wynik                         | Dowód                                                                                                                               |
| -------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Marker jest przodkiem tipa                   | TAK                           | `git merge-base --is-ancestor ...` → exit 0                                                                                         |
| `FinanceHub.tsx` = 3922 linie                | TAK                           | `wc -l` → 3922                                                                                                                      |
| `forbiddenCanonicalComponent` martwe         | TAK                           | `grep -c` → 0 przed R.1                                                                                                             |
| Pięć gałęzi `startsWith('sample-')` istnieje | TAK                           | `rg` → KPI 3, ROI 1, OKR 1                                                                                                          |
| 4 flagi Finance OFF + Valuation ON           | TAK                           | definicje hooków: cztery `false`, valuation `true`                                                                                  |
| RES-OWN-002 przełącznik domeny już zrobiony  | TAK_CZĘŚCIOWO                 | `RESULTS_DOMAIN_TABS` użyte w KPI/OKR/ROI; braki rozlicza R.4                                                                       |
| pięć testów stanu wyjściowego                | 15/15 PASS w 4 plikach Vitest | komenda Bloku 0; plik `.mjs` nie jest zbierany przez konfigurację Vitest i zostanie rozliczony przez `node --test`                  |
| Strażnik kanoniczny przed                    | PASS                          | `node scripts/dev/verify-canonical-16-module-bindings.mjs` → `ok: true`, denominator 16                                             |
| `git fetch --all --prune`                    | PARTIAL                       | `origin` odświeżony; zepsuty lokalny remote `icloud-source` wskazuje na nieistniejący `/private/tmp/consultify-staging-deploy-e6ca` |

## Sekcja R — Results (DEC-2026-08-24-04)

| Pozycja                                    | Status           | Commit                      | Testy                    | Uwagi                                                                                                        |
| ------------------------------------------ | ---------------- | --------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| R.1 strażnik `forbiddenCanonicalComponent` | DONE_CURRENT_SHA | `e832c813bf`                | 5/5 PASS + manifest PASS | Generyczna pętla, walidacja pola, przypadek ostatniej trasy, komenda npm                                     |
| R.2 blokada tylnych drzwi sampleData       | DONE_CURRENT_SHA | `e2ccad0771`                | 8/8 PASS                 | Siedem gałęzi prefiksowych usuniętych, host produkcyjny fail-closed, banner jawny, puste API pozostaje puste |
| R.3 jawna ścieżka flag + obejścia          | PARTIAL / STOP   | do uzupełnienia po commicie | 22/22 PASS               | Produkcja fail-closed i enumeracja bramek gotowe; istniejący test wymaga bypassu                             |
| R.4 RES-OWN-002 trzy formuły               | STOP_DEPENDENCY  | —                           | —                        | R.3 jest wymaganym fundamentem DEC-04                                                                        |
| R.5 RES-OWN-007 karta KPI                  | STOP_DEPENDENCY  | —                           | —                        | jw.                                                                                                          |
| R.6 RES-OWN-007 karta OKR                  | STOP_DEPENDENCY  | —                           | —                        | jw.                                                                                                          |
| R.7 RES-OWN-007 karta ROI                  | STOP_DEPENDENCY  | —                           | —                        | jw.                                                                                                          |
| R.8 testy zbiorcze i i18n                  | PENDING          | —                           | —                        | —                                                                                                            |

### R.1 — dowód działania strażnika

- `node --test scripts/dev/__tests__/verifyCanonical16Bindings.test.mjs` → 5/5 PASS.
- `npm run verify:canonical-16` → `ok: true`, denominator 16.
- Znalezisko naprawione: poprzednie wycinanie ostatniego bloku używało `slice(a, -1)`; pętla danych używa teraz końca pliku dla `nextRouteAt === -1`.
- Skrypt ma jawny wpis `verify:canonical-16`; podpięcie do CI/pre-commit pozostaje decyzją nadzorcy.

### R.2 — dowód uczciwości próbek

- `npx vitest run tests/resultsVnext/ownerSampleDataBackdoor.test.ts tests/components/ResultsVNext/registryShell.sampleBanner.test.tsx` → 8/8 PASS.
- `rg -n "startsWith\\('sample-" src/components/ResultsVNext` → wynik pusty.
- Bez parametru klient wykonuje odczyt sieciowy także dla ID z prefiksem `sample-*`; jawny parametr nadal działa poza hostem produkcyjnym.
- `{ kpis: [] }` daje `[]`, bez podmiany na fixture.
- Banner jest opcjonalnym propem wspólnej powłoki i jest przekazywany jawnie przez rejestry KPI/OKR/ROI.

### R.3 — ścieżka włączania flag rejestrów (DO PRZEKAZANIA WŁAŚCICIELOWI)

| Flaga         | Parametr URL           | localStorage                    | env                              | Profil zbiorczy                |
| ------------- | ---------------------- | ------------------------------- | -------------------------------- | ------------------------------ |
| `kpiRegistry` | `ff_resultsVNextKpi=1` | `ff.results_vnext_kpi_registry` | `VITE_RESULTS_VNEXT_KPI_ENABLED` | `ff_wave3ResultsOwnerReview=1` |
| `okrRegistry` | `ff_resultsVNextOkr=1` | `ff.results_vnext_okr_registry` | `VITE_RESULTS_VNEXT_OKR_ENABLED` | `ff_wave3ResultsOwnerReview=1` |
| `roiRegistry` | `ff_resultsVNextRoi=1` | `ff.results_vnext_roi_registry` | `VITE_RESULTS_VNEXT_ROI_ENABLED` | `ff_wave3ResultsOwnerReview=1` |

Właściciel poza publiczną produkcją wpisuje `/results?ff_wave3ResultsOwnerReview=1`. Profil zbiorczy zapisuje jawny wybór pod `ff.wave3_results_owner_review`. Na `consultify.ai` i `www.consultify.ai` profil zawsze zwraca `false`. Nie włączyłem żadnej flagi ani nie zmieniłem żadnej wartości domyślnej.

## Sekcja F — Finance (DEC-2026-08-24-05)

| Pozycja                               | Status           | Commit                      | Testy          | Uwagi                                                         |
| ------------------------------------- | ---------------- | --------------------------- | -------------- | ------------------------------------------------------------- |
| F.1 inwentarz FIN-REC-001             | DONE_CURRENT_SHA | `4ab7a61403`                | audyt źródłowy | Sześć gałęzi i pięć flag zamrożone poniżej                    |
| F.2 resolver FIN-REC-002              | DONE_CURRENT_SHA | `5502e8fdb2`                | 81/81 PASS     | 53-case table + OFF regression + stare testy                  |
| F.3 wspólny shell FIN-REC-003         | PARTIAL / STOP   | `b284ca6e43`                | 10/10 PASS     | Mechaniczne luki zamknięte; cold Back nie utrwala filtrów     |
| F.4 `financeOwnerSampleData`          | DONE_CURRENT_SHA | do uzupełnienia po commicie | 5/5 PASS       | Host produkcyjny fail-closed, jawny banner, licznik zamrożony |
| F.5 ochrona danych i ufności          | PENDING          | —                           | —              | —                                                             |
| F.6 stany brzegowe FIN-REC-011        | PENDING          | —                           | —              | —                                                             |
| F.7 testy FIN-REC-014                 | PENDING          | —                           | —              | —                                                             |
| F.8 przygotowanie odłączenia Benefits | PENDING          | —                           | —              | —                                                             |

### F.1 — manifest runtime i zamrożenie

- Baza `ca292730ff`, gałąź `codex/results-finance-day4-20260825`, runtime nieuruchomiony, porty 4280/4281 nieużyte.
- Tenant i źródło danych: `NOT VERIFIED / runtime not started`; żadnej bazy ani fixture'u nie użyto.
- Flagi: Analysis OFF, Baseline OFF, Prediction OFF, Statement Pack V2 OFF, Valuation ON. Wartości niezmienione.

### F.1 — mapa route → artifactType → resolver → workspace → API

| Trasa / zakładka                          | artifactType             | Gałąź resolvera                            | Workspace ON                             | Workspace OFF                                    | Rodzina API                                                |
| ----------------------------------------- | ------------------------ | ------------------------------------------ | ---------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| `/finance/statements/:id`                 | `STATEMENT_PACK`         | `openStatement`, `FinanceHub.tsx:472,3210` | `StatementPackWorkspaceV2`, `:3210-3237` | `FinancialStatementPackWorkspace`, `:3238-3244`  | `/api/v8/finance-v2/statements`, `/api/finance-statements` |
| `/finance/models/:id`                     | `BASELINE_MODEL`         | `openV3Baseline`, `:477,3245`              | `FinanceV3BaselineWorkspace`, `:3264`    | `FinancialModelWorkspace`, `:3304-3316`          | `/api/v8/finance-v2/baseline`                              |
| `/finance/analyses/:id` oraz `investment` | `HISTORICAL_ANALYSIS`    | `openV3Analysis`, `:479,3317`              | `FinanceV3AnalysisWorkspace`, `:3332`    | `FinancialAnalysisWorkspace` z Benefits, `:3342` | `/api/v8/finance-v2/analysis`                              |
| `/finance/predictions/:id`, typ `model`   | `PREDICTION_SCENARIO`    | `openV3Prediction`, `:478,3278`            | `FinanceV3PredictionWorkspace`, `:3296`  | `FinancialModelWorkspace`, `:3304-3316`          | `/api/v8/finance-v2/prediction`                            |
| `/finance/predictions/:id`, typ `budget`  | `UNKNOWN / brak typu V3` | `isBudgetPrediction`, `:471,3204`          | brak odpowiednika V3                     | `BudgetWorkspace` z Benefits, `:3205`            | `/api/economics`                                           |
| `/finance/valuations/:id`                 | `VALUATION_CASE`         | `openV3Valuation`, `:480,3347`             | `FinanceV3ValuationWorkspace`, `:3362`   | `ValuationWorkspace` z Benefits, `:3372`         | `/api/v8/finance-v2/valuation`                             |

Pozycje UNKNOWN: budżet nie ma `artifactType` ani workspace'u V3. Nie ukrywam tej luki jako gotowej.

### F.1 — użycia Benefits poza FinanceHub

| Komponent                    | Kto go używa poza FinanceHub                                                                                       | Dowód                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `BudgetWorkspace`            | brak konsumenta poza definicją w `src/components/Benefits/`                                                        | pełny `rg` po `src`                    |
| `FinancialAnalysisWorkspace` | komentarze w `Finance/FinancialModelWorkspace.tsx`; brak montażu                                                   | `FinancialModelWorkspace.tsx:811,1230` |
| `ValuationWorkspace`         | testy i kanoniczny, odrębny `Finance/Valuation/ValuationWorkspace`; stary komponent Benefits nie ma innego montażu | pełny `rg` po `src`                    |

Komponenty Benefits nie są kasowane ani odłączane w tym dyżurze.

### F.2 — wynik resolvera i testu tabelarycznego

- Przypadków wymaganych w tabeli: 53; PASS 53; FAIL 0. Dodatkowy test braku Benefits: PASS.
- Pięć mapowań: `STATEMENT_PACK→statementPackV2`, `BASELINE_MODEL→baseline`, `HISTORICAL_ANALYSIS→analysis`, `PREDICTION_SCENARIO→prediction`, `VALUATION_CASE→valuation`.
- Powody błędu pokryte: `MISSING_ARTIFACT_ID`, `MISSING_BUSINESS_VERSION_ID`, `UNKNOWN_ARTIFACT_TYPE`, `ID_COLLISION`; stan fetch/readback dodaje `IDENTITY_MISMATCH` bez rzucania stringa.
- `financeDetailBranches.flagOff.test.ts`: 6/6 PASS; zachowanie przy wszystkich flagach OFF jest literalnie niezmienione.
- `resolveFinanceDetailBranches.test.ts`: istniejące 21/21 PASS.
- Resolver jest czysty, nie importuje Benefits i nie ma operacji sieciowych ani mutacji.
- Bezpośrednia ścieżka kanoniczna obsługuje teraz także `STATEMENT_PACK`; niezgodne ID/type renderują stan błędu z bezpiecznym powrotem do listy.

### F.2 — odczyt nie tworzy rekordu

| Gałąź               | Wynik audytu źródłowego                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Statements V3       | mount wykonuje odczyty przez fetchery; tworzenie jest wyłącznie jawną akcją `onCreateNew`                                                                     |
| Baseline V3         | brak mutacji w ścieżce otwarcia                                                                                                                               |
| Analysis V3         | brak mutacji w ścieżce otwarcia                                                                                                                               |
| Prediction V3       | brak mutacji w ścieżce otwarcia                                                                                                                               |
| Valuation V3        | brak mutacji w ścieżce otwarcia                                                                                                                               |
| Legacy OFF branches | jedyny znaleziony `Api.put` w `Benefits/FinancialAnalysisWorkspace.tsx:74` należy do jawnej funkcji `updateModelAssumptionsForBridge`, nie do efektu otwarcia |

### F.3 — audyt wspólnego shella (5 zakładek × 6 pytań)

| Zakładka             | 1 Menu2      | 2 Menu3/CTA  | 3 Menu3 karty                | 4 tabela pierwsza            | 5 preview pełny         | 6 Back                           |
| -------------------- | ------------ | ------------ | ---------------------------- | ---------------------------- | ----------------------- | -------------------------------- |
| Statements           | JEST `:1368` | JEST `:1822` | JEST_CZĘŚCIOWO, osobna karta | JEST `StandardTable`         | JEST po korekcie tokenu | JEST w pamięci; cold URL PARTIAL |
| Analysis             | JEST `:1374` | JEST `:1822` | JEST workspace               | JEST wspólny `StandardTable` | JEST po korekcie tokenu | jw.                              |
| Models               | JEST `:1380` | JEST `:1822` | JEST workspace               | JEST wspólny `StandardTable` | JEST po korekcie tokenu | jw.                              |
| Prediction           | JEST `:1386` | JEST `:1822` | JEST workspace               | JEST wspólny `StandardTable` | JEST po korekcie tokenu | jw.                              |
| Enterprise valuation | JEST `:1392` | JEST `:1822` | JEST workspace               | JEST wspólny `StandardTable` | JEST po korekcie tokenu | jw.                              |

Domknięta luka mechaniczna: własne `w-[400px]` zastąpione wspólnym `PREVIEW_PANE_WIDTH`, a panel dostał `h-full`. Test kontraktowy 4/4 PASS. `check-list-canon.sh` nie wykazał nowych naruszeń.

### F.4 — uczciwość owner sample data

- Potwierdzone cztery tablice: statements 1, models 2, analyses 2, valuations 1; wartości, w tym `overall_confidence: 0.98`, nietknięte.
- Potwierdzone cztery wcześniejsze wyjścia i zerowanie `loadError` w `useFinanceData.ts:123-243`.
- `isFinanceOwnerSampleDataEnabled` i zbiorczy `isFinanceOwnerReviewModeEnabled` odmawiają na `consultify.ai` / `www.consultify.ai`.
- Wspólny, informacyjny banner ma `data-testid="finance-sample-data-banner"` i renderuje się wyłącznie dla jawnego trybu próbki.
- `financeOwnerSampleData.contract.test.tsx`: 5/5 PASS, w tym zamrożony denominator. Nie dodano ani nie zmieniono żadnego rekordu próbki.
- Budżety nie mają próbki i pozostają niespójnością zastaną; nie rozszerzono mechanizmu.

## Pozycje STOP

### STOP — R.3 `canonicalCutoverMount`

Powód: preferowane usunięcie propa łamie istniejący test `ResultsKpiScorecardsView.visibility.test.tsx`, który literalnie wymaga `canonicalCutoverMount: true`; §0.5 zabrania zmiany istniejącego testu w celu przepuszczenia implementacji.  
Dowód: `src/components/Results/__tests__/ResultsKpiScorecardsView.visibility.test.tsx:36-46`; test bazowy i po zmianach przechodzi 1/1. Test enumerujący potwierdza, że bypass jest ograniczony do nieroutowanego adaptera historycznego.  
Co zrobiłbym, gdyby zapadła decyzja o zmianie kontraktu testu: usunąłbym prop z `ResultsKpiRegistryPage`, usunął przekazanie z `ResultsKpiScorecardsView`, a test zmienił na wymaganie respektowania `kpiRegistry`.  
Stan: zacommitowano częściowo; odmowa produkcyjna i enumeracja bramek są gotowe.

### STOP — R.4–R.7

Powód: instrukcja uznaje R.1–R.3 za niepodzielny fundament DEC-04 i zakazuje budowania kart po STOP-ie którejkolwiek z tych pozycji.  
Dowód: instrukcja §R „Reguła wejścia do sekcji R”.  
Co zrobiłbym po rozstrzygnięciu R.3: wróciłbym kolejno do R.4, R.5, R.6 i R.7, bez równoległego generowania trzecich implementacji kart.  
Stan: NIE ZACOMMITOWANO.

### STOP — F.3 cold Back

Powód: `tab` jest utrwalany w URL, ale wyszukiwanie, filtry, zaznaczenie i scroll istnieją wyłącznie w stanie komponentu; pełny cold reload nie może ich odtworzyć bez nowego kontraktu serializacji URL.  
Dowód: `FinanceHub.tsx:554-563,1315-1351,1047`; test kontraktowy potwierdza zachowanie in-memory.  
Co zrobiłbym po decyzji produktowej: zdefiniowałbym stabilny, wersjonowany format query dla search/filter/selection i osobno politykę odtwarzania scrolla.  
Stan: zacommitowano częściowo; geometria preview i audyt gotowe.

## Znaleziska

| #   | Plik:linia                                                       | Co znalazłem                                                                                                                       | Dlaczego nie naprawiłem                                                                                              |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | konfiguracja Git remote `icloud-source`                          | Remote wskazuje na usunięty lokalny worktree i powoduje częściowy błąd `git fetch --all --prune`.                                  | Naprawa konfiguracji remote jest poza Results/Finance i nie jest potrzebna do pracy na potwierdzonym lokalnym tipie. |
| 2   | `src/components/Results/resultsOwnerReviewMode.ts`               | Żywy profil odbiorowy ResultsVNext mieszka w katalogu generacji HISTORICAL.                                                        | R.3 pozwala wyłącznie dodać bezpiecznik produkcyjny; relokacja wymagałaby szerszej zmiany importów.                  |
| 3   | `tests/unit/finance/financeFallbackGating.test.ts`               | Baseline katalogu Finance ma 2 czerwone testy: oczekuje `MODULE_ECONOMICS=open`, zastany kod zwraca `closed`.                      | Test i gating należą do globalnej nawigacji; §0.5 i Z17 zabraniają naprawy w tym dyżurze.                            |
| 4   | `src/components/Economics/hooks/useFinanceData.ts:118`           | Budżety nie są objęte sample mode, podczas gdy cztery pozostałe listy są podmieniane.                                              | F.4 jawnie zakazuje dodania piątej tablicy próbek.                                                                   |
| 5   | `tests/components/Economics/useFinanceData.v8-analyses.test.tsx` | Cały plik ma 4 order-dependent czerwone przypadki valuation/budget po sześciu zielonych; mocki są czyszczone, lecz nie resetowane. | §0.5 zabrania zmiany istniejącego testu lub globalnych mocków; nowy kontrakt F.4 przechodzi 5/5 samodzielnie.        |

## Korekty wobec instrukcji

- `tests/unit/release/verify-release-candidate-bundle.test.mjs` używa `node:test` i nie jest zbierany przez bieżącą konfigurację Vitest; będzie uruchamiany właściwym runnerem `node --test`.
- Instrukcja wymieniała pięć gałęzi `startsWith('sample-')`; pełny grep wykazał jeszcze dwie w `roi/roiCaseDetailApi.ts` (baseline i calculation policy). Zostały objęte tą samą jawną bramą, aby spełnić nadrzędny cel „żaden identyfikator nie włącza próbki".

## Testy, dowody końcowe, migracje i flagi

Sekcje zostaną domknięte w Bloku 4. Do tego czasu status pozostaje `LOCAL WIP / NO PUSH / NO DEPLOY`.
