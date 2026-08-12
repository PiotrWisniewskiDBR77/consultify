# PKG_FIX_CANONICAL — niezależna weryfikacja (kontr-audyt)

Data: 2026-08-12
Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-j-security`
Gałąź: `codex/fv3p-fix-canonical` @ `4e9de4153b` (bez zmian od startu weryfikacji)
Baza (tip przed pracą autora): `aa4948b1d1`
Weryfikator: niezależny od autora paczki, zerowe zaufanie do własnych asercji autora — wszystkie
kluczowe twierdzenia zmierzone samodzielnie, częściowo własnymi próbami/testami spoza dostarczonego
diffu.

Środowisko: klaster efemeryczny `127.0.0.1:54330` (`newdb.sh`), bazy robocze `fixverify` i
`fixverify2` (obie utworzone i **usunięte na koniec sesji**, `dropdb` potwierdzony pustym wynikiem
`psql -l | grep fix`). Bramka DB: `RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=...`,
zawsze z jawnym `echo $?` po każdym przebiegu (nigdy „brak czerwonego = sukces"). Zero połączeń do
demo/staging/prod.

---

## Tabela: twierdzenie autora vs mój niezależny pomiar

| # | Twierdzenie autora | Mój niezależny pomiar | Werdykt |
|---|---|---|---|
| 1 | Wszystkie 5 miejsc (`valuationComputeService`, `baselineComputeService`, `kpiComputeService`, `predictionComputeService`×2) używają `claimForCompute()`, nie gołego `claimById()` | `grep -rn "claimForCompute\|claimById"` w `server/src/services/finance/canonical/*.ts` (poza `__tests__`): dokładnie 5 wywołań `claimForCompute(` w 4 plikach serwisowych; `claimById(` występuje wyłącznie jako WŁASNA definicja i jej JEDNO wewnętrzne wywołanie wewnątrz `claimForCompute()` samego siebie (linia 426) — zero bezpośrednich wywołań `claimById()` z serwisów domenowych | **POTWIERDZONE** |
| 2 (★) | Po powtórzonym żądaniu w `compute_job_outputs` jest DOKŁADNIE JEDEN wiersz — niezależny odczyt SQL | Uruchomiłem cały pakiet DB-testów autora (30 testów, świeża baza `fixverify`) i osobno napisaną własną sondę z DWOMA prawdziwie równoległymi (`Promise.all`) żądaniami do `baselineComputeService`. Po każdym z nich odpytałem bazę **surowym `psql`** (nie przez `pg.Client` aplikacji w moim probe'ie, i osobno jeszcze raz czystym `psql -c`): `SELECT job_id, count(*) FROM compute_job_outputs GROUP BY job_id HAVING count(*)>1` → **0 wierszy**, `count(*) = count(DISTINCT job_id) = 17` po pierwszym runie, `22` po dodaniu sondy. Zero duplikatów w całej bazie testowej, nie tylko dla jednego scenariusza. | **POTWIERDZONE (silnie — surowy SQL, nie asercja autora)** |
| 3 | Rozróżnienie `running`→twardy błąd vs `succeeded`→idempotentny sukces zachowane, nieodwrócone | Przeczytałem `claimForCompute()` linia po linii (`computeJobService.ts:401-436`): `status==='succeeded'` + istnieje output → `already_committed`; `status==='running'`/`'failed'`/`'cancelled'` → `hard_error NOT_RUNNING`. Zgodne z deklaracją, kolejność nieodwrócona. Potwierdzone też empirycznie: mój race-probe pokazał jeden call `ok:true` (succeeded), drugi `ok:false, code:'JOB_NOT_RUNNING'` — nigdy odwrotnie. | **POTWIERDZONE** |
| 4 (★) | WYŚCIG — autor testował tylko sekwencyjnie + jeden przypadek z `vi.spyOn`-interleaving | Napisałem własny plik `_verifierRaceProbe.pg.test.ts` (usunięty po użyciu, nie wchodzi do dostawy) — **prawdziwe** `Promise.all([call1, call2])`, bez żadnej interwencji/spy, na tym samym `businessVersionId`/identycznych parametrach. Uruchomione 3× niezależnie: za każdym razem dokładnie 1 `compute_jobs` i 1 `compute_job_outputs` wiersz (potwierdzone surowym `pg.Client`, osobne połączenie TCP od warstwy aplikacji), drugie wywołanie zawsze `ok:false, code:'JOB_NOT_RUNNING'`, nigdy throw, nigdy drugi output. Bezpieczeństwo wynika z atomowego `UPDATE ... WHERE status='queued' ... FOR UPDATE SKIP LOCKED` w `claimById()` + z UNIQUE `compute_jobs_idempotency_uq (organization_id, job_type, idempotency_key)` w `enqueue()` — realny mechanizm DB, nie tylko dyscyplina w kodzie aplikacji. | **POTWIERDZONE (3/3 przebiegów, prawdziwa współbieżność)** |
| 5 | Kontrola negatywna: cofnij naprawę (4 pliki serwisowe) → czerwone (dokładnie ten sam błąd) → przywróć → zielone | Wykonałem SAM: `git show aa4948b1d1:<plik> > <plik>` dla 4 plików serwisowych (bez stash/reset/clean) → `idempotentComputeRetry.pg.test.ts`: **6/6 czerwone**, exit code **1**, identyczny komunikat `"...row is no longer 'queued' (concurrent claim or already terminal)"` we wszystkich 4 serwisach → `git checkout HEAD -- <4 pliki>` → drzewo dokładnie `git diff aa4948b1d1..HEAD` bez zmian → **6/6 zielone**, exit **0** | **POTWIERDZONE** |

**Defekt 1 — ogólny werdykt: POTWIERDZONE, bez zastrzeżeń.** To najsilniejsza część paczki: zabezpieczenie
działa na poziomie bazy (UNIQUE + atomowy UPDATE), nie tylko dyscypliny aplikacyjnej, i przechodzi
zarówno sekwencyjny, jak i prawdziwie równoległy test wyścigu wykonany przeze mnie niezależnie.

---

## DEFEKT 2 — stan `NA`

| # | Twierdzenie autora | Mój niezależny pomiar | Werdykt |
|---|---|---|---|
| 6 (★) | `statementMappingService.ts` świadomie NIE naprawiony — czysty passthrough, „nie dotyczy" już żyje w `ReconciliationBucket='EXCLUDED'` + `excludeKind`/`reasonCode`, poza mandatem tej paczki | Przeczytałem `statementMappingService.ts` linia po linii. `valueStatusFor()` (linia 179-183) rzeczywiście ma tylko 3 gałęzie (MISSING/PRESENT_ZERO/PRESENT_NONZERO) — prawda, że nie ma tam „dzielenia" i defekt 2 (NA) faktycznie się tu nie stosuje. **ALE**: prześledziłem, co się dzieje z wierszem `bucket='EXCLUDED'` (np. `excludeKind='ANALYST_DECISION'` — świadoma decyzja, że dana linia NIE dotyczy podmiotu) — taki wiersz NIGDY nie trafia do `finance_stmt_lines` (funkcja `emptyResult`, bez zapisu). Sprawdziłem PRODUKCYJNY `cellResolver` używany przez `kpiComputeService.ts` (`makeCellResolver`, linia 410): `if (!cell || cell.status === 'MISSING' || cell.value === null) return { ok: true, status: 'MISSING' }`. Czyli linia świadomie wykluczona jako „nie dotyczy" i linia po prostu jeszcze nie wprowadzona wyglądają dla silnika KPI **identycznie** — obie jako `MISSING`. Rozróżnienie `ANALYST_DECISION` vs `NO_CANONICAL_TARGET` istnieje wyłącznie w rejestrze uzgodnienia (audit trail), nie propaguje się do `value_status` żadnej analitycznej komórki ani KPI. | **CZĘŚCIOWO — merytorycznie połowiczne.** Formalnie autor ma rację: to nie jest przypadek dzielenia, więc `NA` faktycznie się nie stosuje, i decyzja by NIE ruszać tego pliku w RAMACH TEJ paczki (zakres = wyłącznie mianownik/dzielenie) jest broniona. Ale sformułowanie „NOT_APPLICABLE już istnieje jako osobny mechanizm" w raporcie sugeruje, że temat jest zamknięty — **nie jest**: użytkownik patrzący na wynik KPI lub pustą komórkę nie odróżni dziś „to pole nie dotyczy tej spółki (decyzja analityka)" od „dane jeszcze nie wprowadzone", bo obie ścieżki kończą się jako `MISSING` na poziomie `finance_stmt_lines`/`finance_analysis_kpi_values`. To jest realny, nazwany, PRZEDISTNIEJĄCY (nie wprowadzony przez tę paczkę) gap architektoniczny — poprawnie POZA zakresem tego konkretnego P1-fixu, ale raport powinien nazwać go jako „otwarty temat na przyszłość", nie jako „nie dotyczy tego mandatu, koniec tematu". |
| 7 | `NA` osiągalne PRZEZ ŻYWĄ ŚCIEŻKĘ SERWISOWĄ, nie tylko unit test ewaluatora | `kpiComputeService.pg.test.ts` (real Postgres, świeża baza `fixverify`): 10/10 PASS, w tym 3 nowe testy `computeAnalysisKpis()` → real DB write z `value_status='NA'`, `interpretation_text` zawiera `DENOMINATOR_MISSING`/`DIVISION_BY_ZERO`, weryfikowane NIEZALEŻNYM odczytem SQL (nie tylko zwrotką serwisu) w tym samym pliku testowym. Uruchomiłem to sam, nie na słowo autora. | **POTWIERDZONE — droga: `computeAnalysisKpis()` → `evaluateFormula()` → INSERT/UPDATE `finance_analysis_kpi_values` → przeszedł przez realny CHECK constraint bazy.** |
| 8 | 4 stany rozróżnialne: `MISSING`/`NA`/`NOT_APPLICABLE`/`PRESENT_ZERO` | Zweryfikowałem kodem (`isUnusable`, `propagateUnusable`, gałąź `divide`/`ratio`) + testami: `PRESENT_ZERO` (realne policzone zero) explicite `not.toBe('NA')`; `MISSING` numerator ≠ `NA` nawet z `MISSING` denominator (priorytet `MISSING>NA>NOT_APPLICABLE`); `NOT_APPLICABLE` (INSUFFICIENT_HISTORY) nietknięty, osobna gałąź. Własny dodatkowy test (patrz punkt 9) potwierdza granicę. | **POTWIERDZONE** |
| 9 (★) | Regresja-strażnik: pusta Analiza (blank-slate) ma dawać `MISSING`, nie `NA` — poprawka trzyma | Zbisekowałem historię: `faf5025bc9` (pierwsza, „naiwna" wersja fixu) vs `77b10b107e` (finalna, z guardem). Wyciągnąłem SAM `formulaAstEvaluator.ts` z `faf5025bc9` (naiwna wersja bez guardu) i uruchomiłem `kpiComputeService.determinism.pg.test.ts` (fixture: 18 P0 KPI, ZERO danych źródłowych, jeden okres) → **czerwone**, `expected 'NA' to be 'MISSING'` — **realnie odtworzona regresja**, nie deklaracja. Przywróciłem HEAD → zielone. Dodatkowo napisałem WŁASNY, niezależny unit test (`_verifierNaEdgeCase.test.ts`, usunięty po użyciu) z ręcznie skonstruowanym `cellResolver` (licznik `AVERAGE_BALANCE` → `INSUFFICIENT_HISTORY`/`NOT_APPLICABLE`, mianownik `MISSING`) — wynik: `status==='MISSING'`, nigdy `'NA'`; plus dwa kontrolne przypadki (realny policzony ratio, oraz realny licznik + `MISSING` mianownik → `NA`) pokazujące, że to DWIE różne gałęzie kodu, nie przypadek. | **POTWIERDZONE (dwukrotnie: bisekcja historii + własny test jednostkowy)** |

### Kontrole negatywne (Defekt 2) — wykonane samodzielnie

| Cofnięte | Wynik cofnięcia (mój pomiar) | Zgodność z raportem autora |
|---|---|---|
| `formulaAstEvaluator.ts` → `aa4948b1d1` | `formulaAstEvaluator.test.ts`: **3 testy czerwone** (nie 4, patrz niżej), exit 1 | **ROZBIEŻNOŚĆ DROBNA** |
| jw. | `kpiComputeService.pg.test.ts`: **3 testy czerwone**, exit 1 | zgodne z raportem |
| Przywrócenie `git checkout HEAD --` | `formulaAstEvaluator.test.ts` 14/14 zielone, `kpiComputeService.pg.test.ts` 10/10 zielone, oba exit 0 | zgodne |

**Znaleziona nieścisłość w raporcie autora**: raport twierdzi „`formulaAstEvaluator.test.ts` → 4 testy
CZERWONE" po cofnięciu. Zmierzyłem **3 testy czerwone** (grep potwierdza dokładnie 3 asercje
`toBe('NA')` w tym pliku — nie ma czwartej). To nie podważa samej naprawy (kontrola negatywna nadal
przechodzi poprawnie, 3/3 realnie czerwone → 14/14 zielone po przywróceniu), ale to jest faktograficzny
błąd w liczbach raportu — drobny, ale dokładnie tego typu pomyłkę CLAUDE.md każe łapać, więc go nazywam.

---

## WSPÓLNE — punkty 10-14

### 10. Pełny przebieg regresyjny + `tsc`

- Uruchomiłem SAM dokładnie te same 10 plików co raport (świeża baza `fixverify2`, żeby wykluczyć
  zanieczyszczenie stanu z moich wcześniejszych sond): **`Test Files 10 passed (10)`, `Tests 76
  passed (76)`, exit code `0`** — identyczne liczby jak w raporcie.
- `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit -p tsconfig.json` z `server/`: **exit
  code `0`, zero linii outputu** (nie „cisza = zakładam sukces" — jawnie sprawdzony `$?`, różny od
  134/SIGABRT-OOM). **POTWIERDZONE.**

### 11. Sygnatury bez ochrony typów (test pliki poza `tsc`)

- `server/tsconfig.json` faktycznie wyklucza `**/*.test.ts` (wzorzec dopasowuje też `*.pg.test.ts`
  — sufiks `.test.ts`) — **potwierdzone, dokładnie jak ostrzegał brief**.
- `grep -rn "claimById(\|claimForCompute("` w `server/src` (produkcja + testy): jedyne wywołania
  `claimForCompute()` to 5 miejsc produkcyjnych + wzmianki w komentarzach nowego pliku testowego
  (nie realne wywołanie). Jedyne wywołanie `claimById()` jest wewnątrz samej definicji
  `claimForCompute()`. **Zero callerów z niedopasowaną sygnaturą** — nowa funkcja nie ma ukrytych,
  niepokrytych przez `tsc` wywołań gdzie indziej w drzewie.

### 12. Osłabione testy?

- `grep` po dodanych liniach (`^+`) za `.skip(`/`.only(`/`xit(`/`xdescribe(` w całym diffie testów:
  **zero trafień**.
- Usunięte asercje (`^-.*expect(`): 5 linii, wszystkie w kontekście świadomej, opisanej zmiany
  oczekiwanej wartości (`NOT_APPLICABLE`→`NA`, `qualityFlag='DIVISION_BY_ZERO'`→`null`,
  `DEBT_TO_EBITDA` `MISSING`→`NA`) — każda ma bezpośrednie uzasadnienie w diffie i w raporcie, żadna
  nie zdejmuje rygoru bez zamiany na inną, równoważną lub silniejszą asercję. Przejrzałem pełny diff
  `kpiComputeService.pg.test.ts` — nowe testy DODAJĄ niezależne odczyty SQL, nie usuwają istniejących
  sprawdzeń. **Brak osłabienia.**

### 13. Allowlist

`git diff --stat aa4948b1d1..HEAD`: 10 plików, wszystkie w `server/src/services/finance/canonical/**`
(4 pliki produkcyjne, 1 nowy plik testowy + 2 rozszerzone, plus raport `.md`). **Zero dotknięć**
frontendu, `financeV2.api.ts`, `.types.ts`, `server/migrations/`. **POTWIERDZONE.**

### 14. `.gitignore` i `git add -f`

- `.gitignore:121` ma regułę `*_FIX*.md`. `git check-ignore -v --no-index
  docs/validation/finance-v3/generated/gate-e/PKG_FIX_CANONICAL_report.md` → **dopasowuje regułę
  121** (bez `--no-index` zwraca "nie ignorowany" tylko dlatego, że plik jest już śledzony w
  indeksie — co samo w sobie dowodzi, że MUSIAŁ być dodany `-f`, bo zwykłe `git add` odmówiłoby).
- `git show --stat` obu commitów autora (`faf5025bc9`, `77b10b107e`, `4e9de4153b`): każdy zawiera
  WYŁĄCZNIE pliki z allowlisty — **żaden `-f` nie wciągnął przy okazji nic innego**.

---

## Dodatkowe ustalenie (nowe, nie w raporcie autora) — drobna niespójność w ścieżce `kpiComputeService.ts`

Raport autora sam nazywa wariant `kpiComputeService.ts` „minimalnym" (nie short-circituje na
`already_committed`, tylko pozwala kodowi lecieć dalej przez `evaluateAllRows`/`persistResults` z
`runningJob.status !== 'running'`). To poprawnie NIE tworzy drugiego wiersza w `compute_job_outputs`
(potwierdzone empirycznie — zero duplikatów w całej bazie testowej po wszystkich przebiegach). Ale
zauważyłem coś, czego raport nie omawia: dalej w tej samej funkcji (linia ~728, blok „Readiness gate
+ optional DRAFT -> READY_FOR_REVIEW transition") kod NIE jest zabezpieczony żadnym `if
(runningJob.status === 'running')` — więc na duplikat z `attemptReadinessTransition=true` funkcja
PRÓBUJE wywołać `artifactVersionService.transition({action:'submit_for_review', expectedVersion,
...})` DRUGI RAZ. Sprawdziłem `transition()`: przy niezgodnym `expectedVersion` zwraca gracefully
`{ok:false, message:'Version conflict: ...'}`, NIE rzuca wyjątku — więc to nie jest „false success"
w sensie kanonu (nie crashuje, nie podwaja stanu, wynik `ok:false` jest widoczny dla wołającego w
`readiness.transitionResult`). To PRZEDISTNIEJĄCY kod (nie zmieniony w tym diffie — before this fix
retry NIGDY nie docierał tak daleko, bo zawsze rzucał wcześniej), więc paczka go nie "psuje", ale
przez fakt, że TERAZ retry w ogóle dochodzi do tego bloku, ujawnia nieco szorstsze zachowanie:
duplikat z `attemptReadinessTransition=true` zwraca `ok:true` na poziomie całego computu, ale
`readiness.transitionResult.ok=false` — wołający musi to sam zinterpretować jako "transition już się
wydarzyła przy pierwszym wywołaniu". Nie jest to P1, ale warto to nazwać jako obserwację do przyszłej
paczki o idempotencji na poziomie warstwy readiness/transition (dotyczy tylko `kpiComputeService.ts`,
bo tylko ten serwis NIE short-circituje przy `already_committed`).

---

## Podsumowanie

| Wymaganie | Status |
|---|---|
| Defekt 1 — 5/5 miejsc, wspólny helper, DB-poziom bezpieczeństwa | **PASS** |
| Defekt 1 — dokładnie 1 wiersz `compute_job_outputs` (surowy SQL, sekwencyjnie I równolegle) | **PASS** |
| Defekt 1 — kontrola negatywna (własna, cofnij→czerwone→przywróć→zielone) | **PASS** |
| Defekt 1 — prawdziwy wyścig `Promise.all` (własna sonda, 3/3 przebiegów) | **PASS** |
| Defekt 2 — `NA` osiągalny żywą ścieżką serwisową, real Postgres | **PASS** |
| Defekt 2 — 4 stany rozróżnialne | **PASS** |
| Defekt 2 — regresja blank-slate złapana i naprawiona, potwierdzona bisekcją + własnym testem | **PASS** |
| Defekt 2 — decyzja o `statementMappingService.ts` | **CZĘŚCIOWO (formalnie broniona, ale realny gap UX/produktowy pozostaje nienazwany wprost w raporcie jako otwarty temat)** |
| Regresja: 10 plików / 76 testów, exit 0 | **PASS (identyczne liczby)** |
| `tsc --noEmit`, exit 0, cały `server/` | **PASS** |
| Sygnatury `claimForCompute`/`claimById` bez sierocych callerów w `tests/` | **PASS** |
| Brak osłabionych testów (skip/only/usunięte asercje bez uzasadnienia) | **PASS** |
| Allowlist | **PASS** |
| `.gitignore`/`git add -f` | **PASS** |
| Dokładność liczb w raporcie autora | **1 drobna nieścisłość** (4 vs 3 czerwone testy w kontroli negatywnej defektu 2, unit-poziom) |
| Nowa obserwacja (nie P1, do zanotowania) | Readiness/transition block w `kpiComputeService.ts` nie jest osłonięty na `already_committed`, ale degraduje gracefully (`ok:false`, nie throw) |

## WERDYKT KOŃCOWY: **PASS** (z dwoma nazwanymi zastrzeżeniami, żadne nie blokujące)

Obie naprawy są realne, zweryfikowane niezależnie na poziomie bazy danych, z prawdziwym testem
wyścigu wykraczającym poza to, co dostarczył autor, i z odtworzoną bisekcją historii dla regresji
blank-slate. Paczka NIE jest zawyżona w sensie „testy przeszły ale mechanizm nie działa" — mechanizm
faktycznie działa, sprawdzony surowym SQL i prawdziwą współbieżnością, nie tylko słowem autora.
Dwa zastrzeżenia do odnotowania w rejestrze, żadne nie uzasadnia cofnięcia:
1. Drobna nieścisłość liczbowa w oryginalnym raporcie (4 vs 3 czerwone testy) — kosmetyczna, nie
   podważa substancji kontroli negatywnej.
2. `statementMappingService.ts`/„NOT_APPLICABLE nieosiągalne na poziomie `finance_stmt_lines`" to
   realny, nienazwany wprost jako "otwarty" temat produktowy — poprawnie poza mandatem TEJ paczki,
   ale warto przenieść do rejestru jako osobny, przyszły punkt (nie blokuje promocji tego fixu).

## Sprzątanie

Obie efemeryczne bazy testowe (`fixverify`, `fixverify2` na `127.0.0.1:54330`) usunięte
(`dropdb`, potwierdzone: `psql -l | grep fix` → pusty wynik). Wszystkie własne pliki sond
(`_verifierRaceProbe.pg.test.ts`, `_verifierNaEdgeCase.test.ts`) utworzone w
`server/src/services/finance/canonical/__tests__/`, użyte, i **usunięte** przed commitem — nie
wchodzą do dostawy. `git status` na koniec sesji: czysty, drzewo identyczne z `4e9de4153b`.
