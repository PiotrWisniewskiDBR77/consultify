# Results i Finance dzień 4 — raport dyżuru 2026-08-25

Baza: `codex/m03-admin-20260824 @ ca292730ff2585297a345cec551d8420eb005b21`
Marker: `ca292730ff2585297a345cec551d8420eb005b21` — POTWIERDZONY
Gałąź robocza: `codex/results-finance-day4-20260825`
Worktree: `/private/tmp/consultify-results-finance-day4`
Porty użyte: żadne
Czas pracy: 2026-08-25 11:27–11:57 CEST

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

| Pozycja                                    | Status           | Commit         | Testy                    | Uwagi                                                                                                        |
| ------------------------------------------ | ---------------- | -------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| R.1 strażnik `forbiddenCanonicalComponent` | DONE_CURRENT_SHA | `e832c813bf`   | 5/5 PASS + manifest PASS | Generyczna pętla, walidacja pola, przypadek ostatniej trasy, komenda npm                                     |
| R.2 blokada tylnych drzwi sampleData       | DONE_CURRENT_SHA | `e2ccad0771`   | 8/8 PASS                 | Siedem gałęzi prefiksowych usuniętych, host produkcyjny fail-closed, banner jawny, puste API pozostaje puste |
| R.3 jawna ścieżka flag + obejścia          | PARTIAL / STOP   | `d3c429e1a3`   | 22/22 PASS               | Produkcja fail-closed i enumeracja bramek gotowe; istniejący test wymaga bypassu                             |
| R.4 RES-OWN-002 trzy formuły               | STOP_DEPENDENCY  | —              | —                        | R.3 jest wymaganym fundamentem DEC-04                                                                        |
| R.5 RES-OWN-007 karta KPI                  | STOP_DEPENDENCY  | —              | —                        | jw.                                                                                                          |
| R.6 RES-OWN-007 karta OKR                  | STOP_DEPENDENCY  | —              | —                        | jw.                                                                                                          |
| R.7 RES-OWN-007 karta ROI                  | STOP_DEPENDENCY  | —              | —                        | jw.                                                                                                          |
| R.8 testy zbiorcze i i18n                  | PARTIAL / STOP   | raport końcowy | 1066 PASS, 5 FAIL        | 99 plików RealPG bez właściwego schematu; pochodzenie 5 FAIL `NOT PROVEN`                                    |

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

| Pozycja                               | Status           | Commit                        | Testy          | Uwagi                                                         |
| ------------------------------------- | ---------------- | ----------------------------- | -------------- | ------------------------------------------------------------- |
| F.1 inwentarz FIN-REC-001             | DONE_CURRENT_SHA | `4ab7a61403`                  | audyt źródłowy | Sześć gałęzi i pięć flag zamrożone poniżej                    |
| F.2 resolver FIN-REC-002              | DONE_CURRENT_SHA | `5502e8fdb2` + fixy sceptyków | 108/108 PASS   | Identity fail-closed; complete OFF zachowuje legacy           |
| F.3 wspólny shell FIN-REC-003         | PARTIAL / STOP   | `b284ca6e43`                  | 10/10 PASS     | Mechaniczne luki zamknięte; cold Back nie utrwala filtrów     |
| F.4 `financeOwnerSampleData`          | DONE_CURRENT_SHA | `207124e9e9`                  | 5/5 PASS       | Host produkcyjny fail-closed, jawny banner, licznik zamrożony |
| F.5 ochrona danych i ufności          | PARTIAL / STOP   | `1cc0724847`                  | 4/4 PASS       | Brak testu 6 mountów z POST/PUT-throwing mockiem              |
| F.6 stany brzegowe FIN-REC-011        | STOP             | `3a9e2f625f`                  | audyt 5×8      | Brak jednolitych capability/error contracts                   |
| F.7 testy FIN-REC-014                 | PARTIAL / STOP   | `e0e97da8d1`                  | 3/3 PASS       | Statusy udowodnione; RealPG/runtime/E2E niezweryfikowane      |
| F.8 przygotowanie odłączenia Benefits | DONE_CURRENT_SHA | `fd9fb22245`                  | 1/1 PASS       | Dokładnie 3 importy; zero zmian importów                      |

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
- Integracja gałęzi odróżnia brak identity od błędu resolvera. Błąd i mismatch `kind↔artifactType` blokują zarówno V3, jak i legacy; 13/13 kontrprzypadków PASS. Asynchroniczny błąd direct path nie aktualizuje stanu po unmount.
- Adapter listy i URL traktuje obecność dowolnego z trzech pól canonical jako próbę tożsamości. Brak artifact ID, business-version ID albo typu nie może już zostać sprowadzony do `identity=undefined`; 4/4 testy partial/no-signal PASS.

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

### F.5 — ochrona danych, ufności i tenanta

- `confidencePolicy.guard.test.ts`: 4/4 PASS.
- Diff migracji jest pusty; historyczne `overall_confidence` i `mapping_confidence` nie są dotykane.
- Fallback ufności pozostaje dokładnie `mapping_confidence ?? confidence ?? (isDerived ? 1 : 0)`.
- Dwa progi `0.85` w `FinancialStatementMappingEditor.tsx` pozostają niezmienione.
- `financeV2Router.use(requireActiveMembership)` i `requireCanonicalFinanceMutation` występują przed pierwszym podrouterem.
- Odczyt bez automatycznego zapisu rozliczono per gałąź w F.2.
- Role `preparer` są zaszyte w sześciu miejscach `FinanceHub.tsx:332,346,352,3330,3394,3424`; nie zmieniono ich bez realnego checku capability.
- `STOP`: §F.5 pkt 2 wymaga komponentowego testu sześciu gałęzi z mockiem rzucającym przy POST/PUT. Kandydat ma audyt źródłowy, ale nie ten dowód montażowy, dlatego F.5 nie jest `DONE`.

### F.6 — macierz stanów brzegowych (5 kart × 8 stanów)

| Karta      | loading               | brak danych     | brak uprawnień | niezgodne ID           | błąd API               | konflikt wersji         | błąd obliczeń                  | dane częściowe                      |
| ---------- | --------------------- | --------------- | -------------- | ---------------------- | ---------------------- | ----------------------- | ------------------------------ | ----------------------------------- |
| Statements | JEST `:201,282`       | JEST `:625,664` | NIEODRÓŻNIALNY | JEST przez resolver    | JEST `:615`            | NIEODRÓŻNIALNY          | JEST jako reconciliation error | JEST, niezależne lines/lineage/runs |
| Baseline   | JEST `:134,172`       | JEST_CZĘŚCIOWO  | NIEODRÓŻNIALNY | JEST resolver/bridge   | JEST `:175`            | NIEODRÓŻNIALNY          | JEST w compute hook            | JEST_CZĘŚCIOWO                      |
| Analysis   | JEST `:138,511`       | JEST_CZĘŚCIOWO  | NIEODRÓŻNIALNY | JEST resolver/bridge   | JEST `:206,512`        | NIEODRÓŻNIALNY          | JEST jako compute error        | JEST_CZĘŚCIOWO                      |
| Prediction | JEST `:113,458`       | JEST_CZĘŚCIOWO  | NIEODRÓŻNIALNY | JEST `:441` + resolver | JEST `:465`            | JEST w save path `:286` | NIEODRÓŻNIALNY                 | JEST_CZĘŚCIOWO                      |
| Valuation  | JEST przez hooki/step | JEST_CZĘŚCIOWO  | NIEODRÓŻNIALNY | JEST resolver/bridge   | JEST boundary + `:462` | NIEODRÓŻNIALNY          | JEST `valuation-variant-error` | JEST_CZĘŚCIOWO                      |

Każdy znaleziony stan ma tekst, nie tylko kolor. Nie dodano Retry dla mutacji bez potwierdzonego klucza idempotencji i nie ujawniono treści odpowiedzi serwera w nowym UI.

### F.7 — siedem punktów dowodowych i poziomy ukończenia

1. Resolver: 53/53 przypadki tabelaryczne PASS; przejścia statusów `DRAFT→DRAFT`, `REVIEW→IN_REVIEW`, `APPROVED→APPROVED`: 3/3 PASS.
2. Pięć workspace'ów/list/preview/błędów: dowody komponentowe F.2–F.6 istnieją, ale macierz F.6 pozostaje niepełna — `PARTIAL`.
3. Real PostgreSQL: `STOP / NOT VERIFIED`. Docker działa, lecz żaden zastany kontener nie został utworzony dla tego dyżuru ani potwierdzony jako bezpieczny, rekonstruowalny schemat Finance. Nie użyto SQLite ani cudzej bazy jako substytutu.
4. Browser E2E pięciu przepływów: `NOT VERIFIED`; E2E odblokowane dopiero po akcepcie flag przez właściciela.
5. Cold restart/readback bez fixture: `NOT VERIFIED`; wymaga autoryzowanego runtime'u z flagami.
6. Negatywny tenant/permission: kolejność router guardów udowodniona źródłowo i testem; realny 403 per karta pozostaje `NOT VERIFIED` z powodu braku capability contract.
7. Console/network: `NOT VERIFIED`; runtime nie został uruchomiony.

Poziom per karta: Statements `CODE_PRESENT`; Baseline `CODE_PRESENT`; Analysis `CODE_PRESENT`; Prediction `CODE_PRESENT`; Valuation `CODE_PRESENT`. Żadna karta nie osiąga `TECHNICAL_PASS`, ponieważ brakuje pełnego F.6, RealPG, cold readback i dowodu runtime. Nie zgłoszono `READY_FOR_OWNER_REVIEW` ani `OWNER_ACCEPTED`.

### F.8 — plan odłączenia Benefits, bez wykonania

- `BudgetWorkspace`: usunąć lazy import i gałąź ternary dopiero po osobnej decyzji produktowej. `isBudgetPrediction` (`prediction` + `budget`) nie ma odpowiednika V3 — samo przełączenie flag nie wystarcza.
- `FinancialAnalysisWorkspace`: po owner-accepted włączeniu `analysis` usunąć lazy import i wyłącznie gałąź OFF w szczególe Analysis.
- `ValuationWorkspace`: po owner-accepted włączeniu `valuation` i potwierdzeniu pełnego cutover usunąć lazy import i wyłącznie gałąź OFF w szczególe Valuation.
- Użycia komponentów `Benefits/*` poza `FinanceHub` z inwentarza F.1 nie są kasowane. Usunięcie dotyczy wyłącznie montażu w `FinanceHub`.
- Strażnik `financeHubBenefitsImports.contract.test.ts`: 1/1 PASS; dokładnie trzy symbole i denominator 3. Test czerwieni się po dodaniu lub cichym usunięciu importu.
- Diff importów Benefits względem bazy: pusty. Nie utworzono patcha, `.diff` ani gałęzi-ducha.

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

### STOP — F.6 rozróżnienie stanów

Powód: brak uprawnień oraz część konfliktów/błędów obliczeń nie mają jednolitego, typowanego kontraktu we wszystkich pięciu workspace'ach; role są dodatkowo zaszyte jako `preparer`.
Dowód: macierz 5×8 powyżej oraz `FinanceHub.tsx:332,346,352,3330,3394,3424`.
Co zrobiłbym po udostępnieniu realnego checku capability i wspólnej taksonomii błędów: dodałbym osobne stany per workspace i wymagane 15 testów 403/409/compute bez zmiany globalnych mocków.
Stan: NIE ZACOMMITOWANO w kodzie produkcyjnym; audyt w raporcie.

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

### Testy własne i regresyjne

| Zakres                                    | Wynik                                              | Interpretacja                                                           |
| ----------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| Zmienione testy Results + canonical guard | 26/26 Vitest + 5/5 `node:test` PASS                | sample backdoors, flagi, produkcja fail-closed i strażnik               |
| Nowe testy F.2–F.8                        | PASS                                               | resolver, OFF regression, shell, sample, confidence, status i Benefits  |
| Pięć testów stanu wyjściowego po zmianach | 15/15 PASS + 6/6 PASS `node:test`                  | identyczny zielony baseline; test release trwał 99,1 s                  |
| Results — katalogi konsumentów            | 98 plików PASS; 1066 testów PASS, 5 FAIL, 412 SKIP | 99 plików RealPG FAIL na brak schematu; pochodzenie 5 FAIL `NOT PROVEN` |
| Finance — komponenty                      | 55 plików PASS; 384 testy PASS, 17 FAIL            | 4 baseline-known `useFinanceData`; pochodzenie pozostałych `NOT PROVEN` |
| Finance — unit                            | 62 pliki PASS; 795 testów PASS, 2 FAIL             | znany baseline `financeFallbackGating`, poza zakresem                   |

Nie zmieniono istniejących czerwonych testów ani globalnych mocków, aby sztucznie uzyskać zielony wynik.

### Pomiar zasięgu (§0.4a)

Deklaracja: **ZASIĘG CZĘŚCIOWY**.

- Dotknięte pliki współdzielone: `package.json`, tłumaczenia PL/EN, `FinanceHub.tsx`, profile owner-review/sample oraz skrypt kanoniczny.
- Uruchomiono wymagane katalogi Results i Finance oraz dedykowane testy wszystkich nowych kontraktów.
- Zakres nie jest pełny, ponieważ RealPG nie miał właściwego schematu, runtime/browser były zabronione przez stan flag, a pełne katalogi zawierają czerwone testy o pochodzeniu `NOT PROVEN` (poza dwoma zweryfikowanymi baseline'ami).
- `check-list-canon.sh` wykazał trzy zastane naruszenia poza diffem (`Initiatives`, `MyWork`, `method-workspace`); żaden z tych plików nie jest dotknięty przez kandydata.

### Dowody bezpieczeństwa Bloku 4

- Z18: diff dla `tests/setup`, `tests/helpers`, `tests/__mocks__`, `vitest*config` — pusty.
- Migracje: diff `server/migrations/` — pusty.
- Flagi: diff wartości domyślnych hooków Finance i `resultsVNextFeatureFlags.ts` — pusty. Stan pozostaje Results KPI/OKR/ROI OFF; Finance Analysis/Baseline/Prediction/Statement OFF, Valuation ON.
- Z17: brak plików `MyWork`, `Admin`, `superadmin` i `Benefits`; jedyny wynik literalnego filtra to test jednostkowy do dozwolonego strażnika, uzasadniony poniżej.
- Importy Benefits w `FinanceHub.tsx`: diff pusty; denominator nadal 3.
- `git diff --check`: PASS po formatowaniu raportu.
- Strażnik canonical-16: PASS, denominator 16, 9 reachable, 7 qualified gaps; bez zmiany owner verdictów.
- Porty 4280/4281: nieużyte. Runtime, Railway, push, deploy, merge i flag flips: niewykonane.

## Wynik dyżuru

### Appendix audytowy — literalne denominatory i komendy

**Licznik 16 pozycji:** `DONE_CURRENT_SHA` 6 (R.1, R.2, F.1, F.2, F.4, F.8) + `PARTIAL/STOP` 5 (R.3, R.8, F.3, F.5, F.7) + `STOP` 1 (F.6) + `STOP_DEPENDENCY` 4 (R.4–R.7) = **16/16 rozliczonych**, nie 16 ukończonych.

**Flagi przed i po — bez zmian:**

| Flaga                     | Przed | Po  |
| ------------------------- | ----- | --- |
| Results KPI registry      | OFF   | OFF |
| Results OKR registry      | OFF   | OFF |
| Results ROI registry      | OFF   | OFF |
| Finance Analysis          | OFF   | OFF |
| Finance Baseline          | OFF   | OFF |
| Finance Prediction        | OFF   | OFF |
| Finance Statement Pack V2 | OFF   | OFF |
| Finance Valuation         | ON    | ON  |

**Baseline przed/po:**

| Test                                                           | Przed    | Po       |
| -------------------------------------------------------------- | -------- | -------- |
| `resultsOwnerReviewMode.test.ts`                               | 3/3 PASS | 3/3 PASS |
| `ResultsKpiScorecardsView.visibility.test.tsx`                 | 1/1 PASS | 1/1 PASS |
| `demoAcceptanceFlags.test.ts`                                  | 4/4 PASS | 4/4 PASS |
| `resultsVNextFeatureFlags.navigationPersist.test.ts`           | 7/7 PASS | 7/7 PASS |
| `verify-release-candidate-bundle.test.mjs` przez `node --test` | 6/6 PASS | 6/6 PASS |

**Wszystkie dotknięte pliki (33):**

```text
docs/program/waves/WAVE_03_ACCEPTANCE/RESULTS_FINANCE_DAY4_REPORT_2026-08-25.md
package.json
public/locales/en/translation.json
public/locales/pl/translation.json
scripts/dev/__tests__/verifyCanonical16Bindings.test.mjs
scripts/dev/verify-canonical-16-module-bindings.mjs
src/components/Economics/FinanceHub.tsx
src/components/Economics/FinanceSampleDataBanner.tsx
src/components/Economics/__tests__/financeDetailBranches.flagOff.test.ts
src/components/Economics/__tests__/financeDetailBranches.identity.test.ts
src/components/Economics/__tests__/financeHubBenefitsImports.contract.test.ts
src/components/Economics/__tests__/financeHubShell.contract.test.ts
src/components/Economics/__tests__/financeOwnerSampleData.contract.test.tsx
src/components/Economics/__tests__/financeStatusMapping.test.ts
src/components/Economics/financeOwnerSampleData.ts
src/components/Finance/shared/__tests__/financeWorkspaceResolver.table.test.ts
src/components/Finance/shared/financeWorkspaceResolver.ts
src/components/Results/resultsOwnerReviewMode.ts
src/components/ResultsVNext/ResultsKpiRegistryPage.tsx
src/components/ResultsVNext/ResultsVNextRegistryShell.tsx
src/components/ResultsVNext/kpiApi.ts
src/components/ResultsVNext/okr/ResultsOkrHub.tsx
src/components/ResultsVNext/okr/okrApi.ts
src/components/ResultsVNext/resultsVNextOwnerSampleData.ts
src/components/ResultsVNext/roi/ResultsRoiHub.tsx
src/components/ResultsVNext/roi/roiApi.ts
src/components/ResultsVNext/roi/roiCaseDetailApi.ts
src/utils/financeOwnerReviewMode.ts
tests/components/ResultsVNext/registryShell.sampleBanner.test.tsx
tests/resultsVnext/flagGateEnumeration.test.ts
tests/resultsVnext/ownerSampleDataBackdoor.test.ts
tests/resultsVnext/resultsOwnerReviewProductionGate.test.ts
tests/unit/finance/confidencePolicy.guard.test.ts
```

**Pliki współdzielone → konsumenci i wykonany test:**

| Plik współdzielony                                        | Główni konsumenci                         | Dowód konsumentów                                               |
| --------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| `package.json` + canonical verifier                       | release/dev scripts                       | 5/5 guard + verifier denominator 16                             |
| tłumaczenia PL/EN                                         | cały frontend                             | dedykowane testy bannerów + Prettier; pełny build poza zakresem |
| `FinanceHub.tsx`                                          | EconomicsView, list/detail Finance, smoke | katalogi Economics/Finance + 13 identity cases                  |
| `financeOwnerSampleData.ts` / `financeOwnerReviewMode.ts` | hook i shell Finance                      | 5/5 sample contract + 4/4 security guard                        |
| Results owner/sample profile i wspólny shell              | KPI, OKR, ROI                             | 26/26 zmienione testy Results                                   |

**Komenda → wynik:**

| Komenda                                                                                                                                         | Wynik                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `node scripts/dev/verify-canonical-16-module-bindings.mjs`                                                                                      | PASS, denominator 16                                     |
| `npx vitest run` czterech bazowych plików Results                                                                                               | 15/15 PASS                                               |
| `node --test tests/unit/release/verify-release-candidate-bundle.test.mjs`                                                                       | 6/6 PASS, 99,1 s                                         |
| `npx vitest run tests/components/ResultsVNext tests/unit/results src/components/Results/__tests__ tests/resultsVnext`                           | 1066 PASS, 5 FAIL, 412 SKIP; 99 plików RealPG setup FAIL |
| `npx vitest run tests/components/Finance tests/components/Economics src/components/Finance/shared/__tests__ src/components/Economics/__tests__` | 384 PASS, 17 FAIL                                        |
| `npx vitest run tests/unit/finance`                                                                                                             | 795 PASS, 2 FAIL                                         |
| dedykowane zmienione/nowe testy kandydata                                                                                                       | 130/130 Vitest PASS + 5/5 node guard PASS                |

**Czerwone ścieżki z pełnych agregatów:**

- Results — 2 testy `ResultsKpiRegistryPage.uiStatePersistence.test.tsx`, 3 testy `resultsFinanceReconciliationService.postmortem.test.ts`; dodatkowo RealPG setup FAIL na brak tabel właściwego schematu. Dwa pliki RealPG widoczne bez frazy w tytule: `kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts`, `kpiScorecardRepositoryRoutesRealdb.test.ts`.
- Finance komponenty — `useFinanceData.v8-analyses.test.tsx` (4), `DriverPlannerPanelM16.test.tsx` (3), `FinancialStatementImportWizard.fin005-csv-reachability.test.tsx` (4), `FinancialStatementWorkspace.v8-read-seam.test.tsx` (3), `ValuationVisualsPanelM16.test.tsx` (3).
- Finance unit — `financeFallbackGating.test.ts` (2).
- Te wyniki są zgodne ze sprawdzonym baseline tylko tam, gdzie baseline wykonano identyczną komendą (`financeFallbackGating` i order-dependent `useFinanceData`). Dla pozostałych czerwonych agregatów pochodzenie od konkretnego wcześniejszego commitu jest `NOT PROVEN`; nie są przedstawiane jako udowodnione regresje zastane ani naprawiane poza zakresem.

**Cztery literalne dowody Bloku 4:**

```text
$ git diff --name-only ca292730...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|vitest.*config"
<PUSTO>
$ git diff --name-only ca292730...HEAD | grep -E "^server/migrations/"
<PUSTO>
$ git diff ca292730...HEAD -- src/hooks/useFinance*WorkspaceFlag*.ts src/components/ResultsVNext/resultsVNextFeatureFlags.ts | grep -E "^[+-].*defaultValue|^[+-].*return (true|false)"
<PUSTO>
$ git diff --name-only ca292730...HEAD | grep -vE "^(src/components/(ResultsVNext|Results|Economics|Finance)/|src/views/EconomicsView|src/hooks/useFinance|src/utils/(financeOwnerReviewMode|demoAcceptanceProfile)|server/src/routes/v8/finance-v2/|scripts/dev/verify-canonical-16|docs/program/waves/WAVE_03_ACCEPTANCE/|tests/(resultsVnext|components/(ResultsVNext|Results|Finance|Economics)|unit/(results|finance)|unit/release)/|public/locales/|package.json)"
scripts/dev/__tests__/verifyCanonical16Bindings.test.mjs
```

Wynik Z17 jest uzasadniony: to lokalny test dokładnie do `scripts/dev/verify-canonical-16-module-bindings.mjs`; nie dotyka runtime'u ani innego modułu. Nazwa katalogu testowego nie mieści się wyłącznie w literalnym regexie instrukcji.

**Jawnie nieuruchomione / nieudowodnione:** dedykowany Finance RealPG na nowym bezpiecznym schemacie, browser E2E, cold restart/readback, console/network, owner acceptance, staging/Railway, pełny globalny Vitest, pełny TSC/build. F.7 i F.8 zostały uzupełnione w końcowym commicie raportowym, a nie w commitach pozycji; to odstępstwo od „raport na bieżąco” jest jawne i nie zostało przepisane historycznie.

Status końcowy: `PARTIAL / STOP GATES PRESERVED` oraz `LOCAL COMMITS / NO PUSH / NO DEPLOY`.

F.2, priorytet instrukcji, jest zrealizowany i zacommitowany. R.4–R.7, pełny cold Back, jednolity kontrakt stanów Finance, RealPG i owner review pozostają jawnie nieodebrane. Żaden wynik techniczny nie jest przedstawiony jako akceptacja właściciela.
