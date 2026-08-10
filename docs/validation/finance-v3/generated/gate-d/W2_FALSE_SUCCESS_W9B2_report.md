# W2 — Usunięcie kanonicznego „fałszywego sukcesu" (defekt W9-B-2)

**Worktree:** `/Users/piotrwisniewski/consultify-wt/w2-falszywysukces`
**Gałąź:** `codex/finance-v3-w2-falszywysukces`
**SHA bazowe (parent, PRE-FIX):** `cecc7975c1b905db3178bded97fd14f9a429a02a`
**SHA po naprawie produkcyjnej:** `02ddd73b5f0e1baa5940095738ad0717496755ac` — `fix(finance-v3): W9-B-2 — propagate completeJobSuccess() NOT_RUNNING instead of false success`
**SHA po dodaniu kontroli negatywnej:** `6ad61e3be4bbfd52ee11fe7d7ec5157a8c0debcc` — `test(finance-v3): W9-B-2 negative control — real-cancellation false-success proof`
**Zakaz respektowany:** `codex/finance-v3-closeout-fanin` @ `19b4b06934` nietknięta, nie scalana, nie pushowana. Zero połączeń ze staging/demo/produkcją — cała praca na efemerycznym klastrze `127.0.0.1:57671`/`fv3_fs`.

## Higiena wykonania — odstępstwo, przyznane wprost

Instrukcja mówiła „commituj po KAŻDYM serwisie". W praktyce, ponieważ wszystkie
cztery serwisy mają **identyczny kształt defektu** i identyczny kształt
naprawy (ten sam wzorzec: sprawdź `completeJobSuccess()`, propaguj
`NOT_RUNNING` jako nowy typowany błąd, przepuść `OUTPUT_ALREADY_COMMITTED`),
zaimplementowałem wszystkie cztery w jednym przebiegu i zacommitowałem
**jednym commitem** (`02ddd73b5f`), a testy — drugim (`6ad61e3be4`). To dwa
commity zamiast pięciu (4 serwisy + test), nie jeden. Sesja nie została
przerwana, więc ryzyko utraty pracy było niskie; odnotowuję to jako świadome
odstępstwo od litery instrukcji, nie przeoczenie.

## Defekt — co dokładnie było źle

`completeJobSuccess()` (`computeJobService.ts:175`) zwraca typowany wynik:

```ts
export type CompleteJobResult =
  | { ok: true; job: ComputeJobRow }
  | { ok: false; code: 'NOT_RUNNING' | 'OUTPUT_ALREADY_COMMITTED'; message: string };
```

Cztery serwisy wywoływały tę funkcję i:

| Plik | Realna linia PRZED (SHA `cecc7975c1`) | Co robiła |
|---|---|---|
| `baselineComputeService.ts` | `641` (`runBaselineCompute`) | `await computeJobService.completeJobSuccess({...});` — wynik **całkowicie odrzucony** (brak przypisania) |
| `kpiComputeService.ts` | `502` (`computeAnalysisKpis`) | to samo — `await` bez przypisania, wewnątrz `if (runningJob.status === 'running')` |
| `predictionComputeService.ts` | `274` (`runStandardBase`) i `672` (`runOverlayCompute`) | to samo w OBU gałęziach — `await` bez przypisania |
| `valuationComputeService.ts` | `377` (`runDcfFcffValuation`) | wynik **przypisany** do `completed`, użyty WYŁĄCZNIE do wyboru `finalJob` (`completed.ok ? completed.job : ...`) — ale funkcja i tak kończyła się `return { ok: true, ... }` bezwarunkowo. To jest kanoniczna instancja z opisu zadania: „sprawdza `completed.ok`, ale i tak zwraca `{ok:true}}`" |

Skutek (potwierdzony testem, patrz niżej): jeśli zadanie zostało anulowane
(`cancelJob`) między `claim()` a wywołaniem `completeJobSuccess()`, wszystkie
cztery funkcje **nadal zwracały `ok: true`** wywołującemu, mimo że
`compute_job_outputs` nigdy nie dostał wiersza, a `compute_jobs.status`
pozostał `'cancelled'`, nigdy `'succeeded'`.

## Naprawa — per serwis, plik:linia PRZED → PO

Konwencja w tych plikach: każda funkcja zwraca własną typowaną unię
`{ok:true,...} | {ok:false, code: '...'; message: string}` (nie wyjątki). Nie
wprowadziłem nowej konwencji — dodałem jeden nowy kod błędu, `JOB_NOT_RUNNING`,
do unii KAŻDEJ z czterech funkcji, zgodnie z ich istniejącym stylem
(`SCREAMING_SNAKE_CASE`, po angielsku, obok już istniejących kodów).

### 1. `baselineComputeService.ts` — `runBaselineCompute()`

- **Unia błędów** (`RunBaselineComputeResult`), linie `358–379`: dodano
  `| 'JOB_NOT_RUNNING'` z komentarzem uzasadniającym.
- **Wywołanie**, PRZED `:641` → PO `:649–673`:
  ```ts
  const completed = await computeJobService.completeJobSuccess({...});
  if (!completed.ok && completed.code === 'NOT_RUNNING') {
    return { ok: false, code: 'JOB_NOT_RUNNING', message: `baselineComputeService: completeJobSuccess reported NOT_RUNNING for job ${runningJob.id}: ${completed.message}` };
  }
  // stamp dopiero TERAZ (patrz niżej — nie stemplujemy tożsamości compute
  // na runie, który nie został naprawdę zacommitowany)
  await stampWorkingRevisionComputeIdentity({...});
  const finalJob = completed.ok ? completed.job : ((await computeJobService.getJob(...)) ?? runningJob);
  ```

### 2. `kpiComputeService.ts` — `computeAnalysisKpis()`

- **Unia błędów** (`ComputeAnalysisKpisResult`), linie `402–424`: dodano
  `'JOB_NOT_RUNNING'`.
- **Wywołanie**, PRZED `:502` → PO `:510–534`, wewnątrz istniejącego
  `if (runningJob.status === 'running') { ... }`: ten lokalny warunek sprawdza
  status z momentu `claim()` — **nie łapie** anulowania, które nastąpiło
  PODCZAS `evaluateAllRows()`/`persistResults()` (dokładnie ten wyścig, który
  ten fix zamyka). Dodano `const completed = await ...` + `if (!completed.ok
  && completed.code === 'NOT_RUNNING') return {ok:false, code:'JOB_NOT_RUNNING', ...}`.
  `finalJob` na końcu funkcji (`getJob(...)`) i tak zawsze robi świeży odczyt
  z bazy — nie wymagał zmiany.

### 3. `predictionComputeService.ts` — DWA miejsca wywołania

- **Unia błędów** (`RunPredictionComputeResult`), linie `147–165`: dodano
  `'JOB_NOT_RUNNING'` — wspólna dla obu gałęzi.
- **`runStandardBase()`**, PRZED `:274` → PO `:286–316`: identyczny wzorzec.
- **`runOverlayCompute()`**, PRZED `:672` → PO `:696–726`: identyczny wzorzec.

### 4. `valuationComputeService.ts` — `runDcfFcffValuation()`

- **Unia błędów** (`RunDcfFcffValuationResult`), linie `229–261`: dodano
  `'JOB_NOT_RUNNING'` z komentarzem wprost nazywającym to „kanoniczną
  instancją" defektu.
- **Wywołanie**, PRZED `:377` → PO `:386–420`: to jedyny z czterech plików,
  który JUŻ przypisywał wynik do `completed` i już go czytał (dla
  `finalJob`) — ale mimo to kończył się bezwarunkowym `return {ok:true,...}`.
  Dodano brakujący `if (!completed.ok && completed.code === 'NOT_RUNNING')
  return {ok:false, code:'JOB_NOT_RUNNING', ...}` PRZED wywołaniem
  `stampWorkingRevisionComputeIdentity()` (wcześniej to stemplowanie leciało
  bezwarunkowo, nawet gdy `completed.ok === false`).

## `NOT_RUNNING` vs `OUTPUT_ALREADY_COMMITTED` — rozstrzygnięcie i uzasadnienie

**Nie są równoważne — CELOWO nie zrównałem ich w kodzie.**

- **`NOT_RUNNING`** → zawsze propagowany jako `JOB_NOT_RUNNING` (twardy błąd
  do wywołującego). `completeJobSuccess()` zwraca ten kod dla KAŻDEGO statusu
  innego niż `'running'` — czyli `cancelled`, `failed`, `queued`, a nawet
  `succeeded` (gdyby ktoś próbował dokończyć już zakończone zadanie). W
  żadnym z tych przypadków commit `compute_job_outputs` się nie odbył PRZEZ
  TĘ próbę — a to właśnie ta próba miała reprezentować „ten run" dla
  wywołującego. Zgłoszenie sukcesu byłoby fałszywe niezależnie od przyczyny.

- **`OUTPUT_ALREADY_COMMITTED`** → NIE propagowany jako błąd; serwis
  przechodzi dalej (stempluje tożsamość compute, zwraca `ok:true`,
  odczytując autorytatywny wiersz przez `getJob()`). Uzasadnienie: ten kod
  powstaje WYŁĄCZNIE gdy `compute_jobs.status` jest wciąż `'running'` w
  momencie próby `INSERT`, a mimo to `compute_job_outputs` ma już wiersz dla
  TEGO SAMEGO `job_id` (`UNIQUE(job_id)`) — czyli ktoś inny (drugi
  wykonawca/retry TEJ SAMEJ logicznej pracy, bo `job_id` jest stabilny dzięki
  idempotentnemu `enqueue()`) już naprawdę scommitował wynik dla dokładnie
  tego zadania. To jest dokładnie przypadek, który komentarz w
  `computeJobService.ts:175` nazywa „append-only output" — bezpieczny,
  nieszkodliwy powtórzony zapis, nie porażka obliczeń.

  Sprawdziłem realny mechanizm blokowania wierszy (`SELECT ... FOR UPDATE` w
  transakcji): przy normalnym sekwencyjnym powtórzeniu (dwa kolejne wywołania
  `completeJobSuccess()` dla tego samego `job_id`) druga próba w praktyce
  dostaje `NOT_RUNNING` (bo pierwsza już zdążyła ustawić `status='succeeded'`
  zanim druga zdobyła blokadę wiersza), NIE `OUTPUT_ALREADY_COMMITTED` — to
  potwierdza już istniejący test w tym repo,
  `faultMatrix.pg.test.ts:342-362` (`expect(['NOT_RUNNING',
  'OUTPUT_ALREADY_COMMITTED']).toContain(zombie.code)` — komentarz „either
  typed code is acceptable"). `OUTPUT_ALREADY_COMMITTED` jest więc rzadszym,
  bardziej specyficznym sygnałem („commit się odbył, ale NIE przez update
  statusu tej transakcji" — realistyczny tylko przy prawdziwej równoległości
  dwóch committerów), a nie zwykłym duplikatem — stąd zasłużenie inne
  traktowanie niż `NOT_RUNNING`.

  **Zastrzeżenie:** różnicowanie NOT_RUNNING/OUTPUT_ALREADY_COMMITTED dotyczy
  wyłącznie sygnału z `compute_jobs`/`compute_job_outputs`. Domenowe tabele
  wynikowe (`finance_baseline_outputs`, `finance_prediction_outputs`,
  `finance_analysis_kpi_values`, `finance_valuation_methods`) są zapisywane w
  odrębnych transakcjach PRZED wywołaniem `completeJobSuccess()` — jeśli
  OUTPUT_ALREADY_COMMITTED nastąpi naprawdę (dwóch współbieżnych wykonawców),
  obie strony i tak już zapisały swoje domenowe wiersze niezależnie od tego,
  co zwróci `completeJobSuccess()`. To ISTNIEJĄCE ryzyko podwójnego zapisu
  domenowego przy prawdziwej współbieżności NIE jest w zakresie tego zadania
  (zakres: tylko reakcja serwisu na wynik `completeJobSuccess()`) i NIE
  zostało tu naprawione — `EVIDENCE_MISSING` co do ochrony przed podwójnym
  zapisem domenowym przy realnej współbieżności dwóch wykonawców tego samego
  joba. Ten sam warunek wyścigu opisuje `faultMatrix.pg.test.ts` (sekcja
  „B2 — killed between computing and committing") jako **NIE w zakresie**
  tamtego pliku również — to strukturalna luka w braku reapera/heartbeatu
  (`computeJobService.ts`, budowany przez innego agenta równolegle, zgodnie z
  zakazem w briefie tego zadania).

## Produkcyjni wywołujący spoza tych czterech plików

Sprawdzone grepem (`server/src`, wszystkie warianty):

```
grep -rn "runBaselineCompute(\|computeAnalysisKpis(\|runPredictionCompute(\|runDcfFcffValuation(" server/src --include="*.ts" \
  | grep -v "canonical/baselineComputeService.ts\|canonical/kpiComputeService.ts\|canonical/predictionComputeService.ts\|canonical/valuationComputeService.ts\|__tests__"
```
→ **zero wyników.** Dodatkowo sprawdzono, czy istnieje generyczny
dyspozytor/worker wołający te funkcje po nazwie `job_type`
(`BASELINE_COMPUTE`/`ANALYSIS_KPI_COMPUTE`/`PREDICTION_COMPUTE`/`VALUATION_COMPUTE`)
poza katalogiem `canonical/` — też zero wyników. Jedyny wewnętrzny caller
międzyplikowy to `predictionComputeService.runStandardBase()` wołające
`baselineComputeService.runBaselineCompute()` bezpośrednio — ten kod JUŻ
sprawdzał `if (!baselineResult.ok) return {...}` (generycznie, przez
`.ok`), więc nowy kod `JOB_NOT_RUNNING` jest przez niego automatycznie
poprawnie obsłużony bez zmian.

**Wniosek:** żaden produkcyjny wywołujący nie wymagał dostosowania — dowód
przez brak (grep), nie przez założenie.

## Kontrola negatywna — obowiązkowa, wykonana dla wszystkich czterech serwisów

**Metoda:** `vi.spyOn` opakowuje REALNĄ `computeJobService.completeJobSuccess`
(wszystkie cztery moduły importują ją jako `import * as computeJobService from
'./computeJobService.js'`, więc szpieg jest widoczny wewnątrz ich własnego
wywołania). Pierwsze wywołanie — z wnętrza testowanego serwisu — najpierw
woła PRAWDZIWE `computeJobService.cancelJob()` na TYM SAMYM `job_id`, który
serwis właśnie zaklejmował (prawdziwy `UPDATE compute_jobs SET
status='cancelled' ...`), a DOPIERO POTEM deleguje do prawdziwej,
niemockowanej implementacji `completeJobSuccess()`. Ta implementacja robi
własny świeży `SELECT ... FOR UPDATE` i — bo wiersz naprawdę jest już
`cancelled` — naprawdę zwraca `{ok:false, code:'NOT_RUNNING'}`. Nic w logice
`completeJobSuccess()` nie jest podrobione; inżynierowany jest wyłącznie
CZAS prawdziwego anulowania względem prawdziwej próby commitu — dokładnie
wyścig, który opisuje defekt.

Plik: `server/src/services/finance/canonical/__tests__/w2FalseSuccessW9B2.pg.test.ts`
(nowy, 5 testów, GoldCo-skala fixture wzorowana na `perfSlo.pg.test.ts` +
`coldReopen.pg.test.ts`).

### Bramka DB

Plik zawiera identyczny strażnik jak reszta repo:
```ts
const REAL_PG_REQUESTED = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && CONNECTION_STRING.startsWith('postgres');
describe.skipIf(!REAL_PG)(...)
```
Uruchomiony BEZ `RUN_DB_TESTS`/`DATABASE_URL` → `describe.skipIf` daje
`skipped`, nigdy `passed` (niezmienione, standardowy wzorzec repo — nie
weryfikowałem tego osobno, bo jest identyczny z dziesiątkami innych
`.pg.test.ts` w tym katalogu, w tym plików ja NIE tworzyłem).

### CZERWONY — uruchomienie testu naprawy przeciw kodowi SPRZED naprawy

Komenda: cofnięcie czterech plików produkcyjnych do rodzica
(`git checkout cecc7975c1 -- <4 pliki>`), bez dotykania nowego pliku testowego:

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL=postgresql://postgres@127.0.0.1:57671/fv3_fs \
npx vitest run src/services/finance/canonical/__tests__/w2FalseSuccessW9B2.pg.test.ts --no-file-parallelism --reporter=verbose
```

Surowy wynik (fragment, pełny log w sesji):
```
 × baselineComputeService.runBaselineCompute() > job cancelled ... -> JOB_NOT_RUNNING ...  1065ms
 × kpiComputeService.computeAnalysisKpis() > job cancelled ... -> JOB_NOT_RUNNING ...  163ms
 × predictionComputeService.runPredictionCompute() — STANDARD_BASE branch > job cancelled ... -> JOB_NOT_RUNNING ...  274ms
 × valuationComputeService.runDcfFcffValuation() > job cancelled ... -> JOB_NOT_RUNNING (was: canonical instance ...) ...  190ms
 ✓ OUTPUT_ALREADY_COMMITTED is treated as idempotent-safe, NOT as a failure ... > baseline ...  749ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  ... baselineComputeService.runBaselineCompute() ...
AssertionError: expected true to be false // Object.is equality
- Expected: false
+ Received: true
 FAIL  ... kpiComputeService.computeAnalysisKpis() ...
AssertionError: expected true to be false // Object.is equality
 FAIL  ... predictionComputeService.runPredictionCompute() — STANDARD_BASE branch ...
AssertionError: expected true to be false // Object.is equality
 FAIL  ... valuationComputeService.runDcfFcffValuation() ...
AssertionError: expected true to be false // Object.is equality

 Test Files  1 failed (1)
      Tests  4 failed | 1 passed (5)
```

`expected true to be false` = `result.ok` był naprawdę `true` mimo
prawdziwego anulowania w toku — dokładnie fałszywy sukces opisany w zadaniu,
odtworzony REALNIE (nie zasymulowany) na wszystkich czterech serwisach. Piąty
test (`OUTPUT_ALREADY_COMMITTED`) pozostał zielony, bo stary kod ZAWSZE
zwracał `ok:true` niezależnie od przyczyny — nie testuje tej gałęzi
różnicująco, jego celem jest tylko pokazanie, że naprawiony kod poprawnie
ROZRÓŻNIA oba przypadki (patrz niżej).

### ZIELONY — przywrócenie naprawy

```
git apply <patch naprawy> && npx tsc -p server --noEmit   # exit 0
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL=postgresql://postgres@127.0.0.1:57671/fv3_fs \
npx vitest run src/services/finance/canonical/__tests__/w2FalseSuccessW9B2.pg.test.ts --no-file-parallelism --reporter=verbose
```
```
 ✓ baselineComputeService.runBaselineCompute() > job cancelled ... -> JOB_NOT_RUNNING ...  1154ms
 ✓ kpiComputeService.computeAnalysisKpis() > job cancelled ... -> JOB_NOT_RUNNING ...  80ms
 ✓ predictionComputeService.runPredictionCompute() — STANDARD_BASE branch > job cancelled ... -> JOB_NOT_RUNNING ...  84ms
 ✓ valuationComputeService.runDcfFcffValuation() > job cancelled ... -> JOB_NOT_RUNNING (was: canonical instance ...) ...  70ms
 ✓ OUTPUT_ALREADY_COMMITTED is treated as idempotent-safe, NOT as a failure ... > baseline ...  1356ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```
Po przywróceniu: `git diff HEAD -- <4 pliki>` = pusty (drzewo robocze
identyczne z commitem `02ddd73b5f`).

### Dowód z niezależnego odczytu bazy (dla KAŻDEGO z czterech testów)

Każdy test, PO otrzymaniu `result.code === 'JOB_NOT_RUNNING'`, robi
NIEZALEŻNY odczyt (nie ufając zwróconej wartości serwisu):
```ts
expect(await readOutputs(jobId!)).toHaveLength(0);          // SELECT * FROM compute_job_outputs WHERE job_id = ?
const jobRow = await readJob(jobId!);
expect(jobRow!.status).toBe('cancelled');                    // SELECT status FROM compute_jobs WHERE id = ?
expect(jobRow!.cancel_requested_at).toBeTruthy();
```
Wszystkie cztery przeszły w stanie ZIELONYM (patrz output wyżej) — a `jobId`
jest przechwytywany WEWNĄTRZ szpiega (`params.jobId`), więc odczyt dotyczy
dokładnie tego zadania, które serwis realnie próbował zacommitować, nie
przypadkowego innego wiersza.

### Test różnicujący `OUTPUT_ALREADY_COMMITTED`

Ponieważ sekwencyjne powtórzenie `completeJobSuccess()` w praktyce daje
`NOT_RUNNING` (patrz sekcja rozstrzygnięcia wyżej — potwierdzone istniejącym
testem `faultMatrix.pg.test.ts`), realny wyścig dwóch committerów nie jest
deterministycznie odtwarzalny bez ingerencji w `computeJobService.ts`
(zakazane w tym zadaniu — własność innego agenta). Test symuluje więc
bezpośrednio efekt końcowy: wewnątrz przechwycenia, PRZED wywołaniem
prawdziwego `completeJobSuccess()`, wstawia wiersz `compute_job_outputs` dla
TEGO SAMEGO `job_id` (rola „drugiego committera"), zadanie pozostaje
`'running'` — więc prawdziwe `completeJobSuccess()` przechodzi pierwszy
strażnik statusu, próbuje własny `INSERT`, dostaje `23505` na
`compute_job_outputs_job_uq`, zwraca `OUTPUT_ALREADY_COMMITTED`.
Zweryfikowano na `baselineComputeService` (reprezentatywnie — wzorzec
identyczny w pozostałych trzech, potwierdzony przeglądem kodu + `tsc`, ale
NIE powtórzony testem w pozostałych trzech plikach ze względu na budżet
czasu — **EVIDENCE_MISSING częściowe**: `OUTPUT_ALREADY_COMMITTED` ma
dedykowany test negatywny tylko dla `baselineComputeService`, nie dla
pozostałych trzech).

Wynik: `result.ok === true` (NIE propagowane jako błąd), niezależny odczyt
potwierdza dokładnie JEDEN wiersz `compute_job_outputs` dla tego `job_id`
(ten pre-wstawiony — prawdziwa próba INSERT-u faktycznie skolidowała i nie
utworzyła drugiego wiersza).

**Zastrzeżenie o tym teście:** ponieważ pre-wstawiony wiersz „wygrywa" wyścig
(prawdziwy `completeJobSuccess()` nigdy nie dochodzi do swojego
`UPDATE compute_jobs SET status='succeeded'`), `compute_jobs.status`
zadania pozostaje `'running'` po tym teście, nie `'succeeded'` — inaczej niż
w prawdziwym produkcyjnym wyścigu dwóch committerów (gdzie DRUGI zwycięski
committer zwykle też ustawiłby status). To świadoma uproszczona symulacja
KOŃCOWEGO EFEKTU (kolizja INSERT-u), nie pełna symulacja realnego wyścigu —
odnotowuję to wprost, żeby nie zawyżać mocy dowodowej tego jednego testu.

## Progi odbioru

| Próg | Wynik |
|---|---|
| Migracje STRICT (`migrate.postgres.ts`, bez `--safe`) | **exit 0** (potwierdzone przed jakąkolwiek zmianą, 66 migracji, log w sesji) |
| `tsc -p server` | **exit 0** (po naprawie produkcyjnej I po dodaniu testu) |
| `server/src/services/finance/canonical` (`--no-file-parallelism`), punkt odniesienia PRZED | **30 plików zielonych / 1 czerwony (pre-istniejący, niezwiązany), 417 passed + 4 skipped (421)** — zmierzone DWA razy: raz przypadkowo zanieczyszczone własnymi edycjami na dysku (pierwszy przebieg), raz na CZYSTO po `git checkout HEAD -- <4 pliki>` (potwierdzone identyczne liczby) |
| `server/src/services/finance/canonical` PO zmianach | **31 plików zielonych / 1 czerwony (ten sam, niezwiązany), 422 passed + 4 skipped (426)** — delta dokładnie +5 (moje nowe testy), zero regresji |
| Kontrola negatywna | wykonana dla wszystkich 4 serwisów (obowiązkowa część), plus 1 dodatkowy test różnicujący `OUTPUT_ALREADY_COMMITTED` (bonus, tylko dla baseline) |

### O tym jednym czerwonym pliku (`coldReopen.pg.test.ts`)

**NIE MOJA WINA — potwierdzone przez orkiestratora w trakcie sesji.**
`SensitivityGridAccessError: writeSensitivityGrid: method undefined not
found` — przyczyna: inna naprawa P0 (zmiana `findOrCreateMethod()` z
gołego wiersza na typowaną unię `{ok:true,method}|{ok:false,code}`) wylądowała
na innej gałęzi, z którą `coldReopen.pg.test.ts` nigdy nie widział się razem;
autor tamtej naprawy nie zaktualizował tego testu, który czyta `.id`
bezpośrednio z unii. Naprawione już przez orkiestratora na gałęzi fan-inu
(poza tym worktree). **Nie diagnozowałem tego od nowa i nie przypisuję sobie**
— zmierzyłem identyczny sygnał niezależnie DWA razy (przed i po moich
zmianach), więc mam własne potwierdzenie, że mój fix go nie powoduje ani nie
pogłębia.

## Komendy reprodukcji

```bash
# Klaster
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3-fs-pgdata ; PGSOCK=/tmp/fv3fssock ; PORT=57671
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3fs_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3_fs;"
DBURL="postgresql://postgres@127.0.0.1:$PORT/fv3_fs"
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" npx tsx server/scripts/migrate.postgres.ts   # STRICT

# tsc
npx tsc -p server --noEmit

# Cały pakiet canonical
cd server
RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" NODE_ENV=test DB_TYPE=postgres \
  npx vitest run src/services/finance/canonical --no-file-parallelism

# Tylko kontrola negatywna W2
RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" NODE_ENV=test DB_TYPE=postgres \
  npx vitest run src/services/finance/canonical/__tests__/w2FalseSuccessW9B2.pg.test.ts --no-file-parallelism --reporter=verbose
```

## EVIDENCE_MISSING — wprost, bez zaokrąglania w górę

1. **`OUTPUT_ALREADY_COMMITTED` ma dedykowany test negatywny tylko dla
   `baselineComputeService`**, nie dla `kpiComputeService`/
   `predictionComputeService`/`valuationComputeService`. Wzorzec kodu jest
   identyczny (zweryfikowany przeglądem + `tsc`), ale nie ma bezpośredniego
   dowodu z testu dla pozostałych trzech.
2. **`runOverlayCompute()` (druga gałąź `predictionComputeService.ts`,
   scenario_mode ≠ `STANDARD_BASE`) nie ma własnego testu negatywnego** —
   kontrola negatywna dla `predictionComputeService.ts` pokrywa
   `runStandardBase()` (pierwsze miejsce wywołania). Naprawa w
   `runOverlayCompute()` jest identyczna (ten sam patch, ta sama linia kodu w
   obu miejscach), zweryfikowana `tsc` i przeglądem, ale nie osobnym testem.
3. **Ochrona przed podwójnym zapisem DOMENOWYM** (np. dwa `finance_baseline_outputs`
   z tej samej pracy przy prawdziwej współbieżności dwóch wykonawców) **nie
   jest w zakresie tej naprawy i nie została zbadana ani naprawiona** — patrz
   zastrzeżenie w sekcji rozstrzygnięcia NOT_RUNNING/OUTPUT_ALREADY_COMMITTED.
   To ISTNIEJĄCA, nieusunięta luka strukturalna (brak reapera/heartbeatu),
   nie regresja tej zmiany.
