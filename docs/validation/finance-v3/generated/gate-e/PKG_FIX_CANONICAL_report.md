# PKG_FIX_CANONICAL — naprawa dwóch defektów przekrojowych w serwisach kanonicznych Finance v3

Data: 2026-08-12
Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-j-security`
Gałąź: `codex/fv3p-fix-canonical`
Baza (tip integracji, przed pracą): `aa4948b1d1`
SHA końcowy (po obu naprawach): **`77b10b107eedc5be503c23960397851203c86daa`**

Commity tej sesji:
- `faf5025bc9` — fix(finance-v3/canonical): idempotent compute retry + NA reachability (P1 defects)
- `77b10b107e` — fix(finance-v3/canonical): NA-for-missing-denominator regression guard (blank-slate Analysis)

## `git diff --stat aa4948b1d1..HEAD`

```
 .../__tests__/formulaAstEvaluator.test.ts          |  73 ++-
 .../__tests__/idempotentComputeRetry.pg.test.ts    | 608 +++++++++++++++++++++
 .../__tests__/kpiComputeService.pg.test.ts         | 172 +++++-
 .../finance/canonical/baselineComputeService.ts    |  44 +-
 .../finance/canonical/computeJobService.ts         |  98 ++++
 .../finance/canonical/formulaAstEvaluator.ts       |  97 +++-
 .../finance/canonical/kpiComputeService.ts         |  29 +-
 .../finance/canonical/predictionComputeService.ts  |  75 ++-
 .../finance/canonical/valuationComputeService.ts   |  41 +-
 9 files changed, 1172 insertions(+), 65 deletions(-)
```

Allowlist respektowana: wyłącznie `server/src/services/finance/canonical/**` i nowy plik testowy
`server/src/services/finance/canonical/__tests__/idempotentComputeRetry.pg.test.ts` (dodany `git add -f`,
zgodnie z regułą). Frontend, `financeV2.api.ts`, `.types.ts` — nietknięte. Migracje — nietknięte (patrz
dyskusja pod Defektem 2, §"Dlaczego bez migracji").

---

## DEFEKT 1 — idempotencja compute (P1)

### Przyczyna (potwierdzona)

Pięć wywołań `computeJobService.claimById()` po `enqueue()` ignorowało `wasExisting`. `claimById()`
dopasowuje wyłącznie `status='queued'`. Powtórzone wywołanie z tym samym kluczem idempotencji trafiało
w wiersz już `succeeded` → `claimById()` zwracał `null` → nieobsłużony `throw new Error(...)` → 500.

### Naprawa

Nowy wspólny punkt decyzyjny `computeJobService.claimForCompute()` (98 nowych linii w
`computeJobService.ts`), używany we wszystkich pięciu miejscach zamiast gołego `claimById()`:

| # | Serwis | Linia (przed naprawą, wg brief) | Status | Zachowanie po naprawie |
|---|---|---|---|---|
| 1 | `valuationComputeService.ts` | :442/:455 | **NAPRAWIONE** | `wasExisting && status='succeeded' && output istnieje` → idempotentny sukces (ten sam `job.id`, wartości przeliczone deterministycznie ponownie w pamięci, ale bez drugiego `compute_job_outputs`) |
| 2 | `baselineComputeService.ts` | :429/:442 | **NAPRAWIONE** | jw.; `monthlyResults` NIE jest rekonstruowany (solver nie biegnie drugi raz), `periodsComputed` czytany uczciwie z `finance_baseline_outputs` |
| 3 | `kpiComputeService.ts` | :637/:650 | **NAPRAWIONE** | wariant minimalny: `runningJob` = już-`succeeded` wiersz (status≠`running`), istniejący guard `if (runningJob.status==='running')` naturalnie pomija powtórny zapis outputu; `evaluateAllRows`/`persistResults` bezpiecznie nadpisują te same wartości (idempotentny UPDATE) |
| 4 | `predictionComputeService.ts` (`runStandardBase`) | :322/:335 | **NAPRAWIONE** | jw.; `passthroughRowCount` czytany z `finance_prediction_outputs_effective` |
| 5 | `predictionComputeService.ts` (`runOverlayCompute`) | :549/:562 | **NAPRAWIONE** | jw.; `periodsComputed` czytany z `finance_prediction_outputs`, solver NIE biegnie drugi raz |

### Rozstrzygnięcie NOT_RUNNING vs OUTPUT_ALREADY_COMMITTED (świadome, zgodne z kanonem)

`claimForCompute()` zwraca trzy warianty:
- `claimed` — normalna ścieżka (nowy wiersz albo `queued`, konkurencyjny wyścig dwóch pierwszych żądań).
- `already_committed` — `wasExisting && status='succeeded' && istnieje compute_job_outputs` →
  **idempotentny sukces**, zwraca tożsamość ORYGINALNEGO joba.
- `hard_error (NOT_RUNNING)` — trzy różne sytuacje, świadomie scalone w jedną:
  1. `wasExisting && status='running'` — **pierwsze zadanie JESZCZE się liczy** (nie skończone) →
     twardy błąd `JOB_NOT_RUNNING`, NIGDY cichy powrót/oczekiwanie. To jest dokładnie rozróżnienie
     z brief-u: „to nie to samo co zadanie zakończone".
  2. `wasExisting && status='succeeded'` ale BRAK wiersza w `compute_job_outputs` — niespójność danych
     (nie powinno się zdarzyć — `completeJobSuccess()` pisze oba atomowo w jednej transakcji) — twardy
     błąd, nigdy ciche „sukces".
  3. `wasExisting && status IN ('failed','cancelled')` — zadanie terminalnie martwe, `claimById()` i tak
     nic by nie złapał — twardy błąd zamiast crasha.
  4. Świeże/`queued` żądanie, ale `claimById()` samo zwraca `null` (realny wyścig dwóch duplikatów) —
     twardy błąd.

To dokładnie mapuje na istniejący w `completeJobSuccess()` kanon `NOT_RUNNING` (twardy błąd) vs
`OUTPUT_ALREADY_COMMITTED` (idempotentny sukces) — `claimForCompute()` jest analogicznym punktem
decyzyjnym jeden poziom wyżej (przed próbą ponownego uruchomienia compute), `completeJobSuccess()`
sam pozostał NIETKNIĘTY (nadal łapie swój własny, niezależny wyścig przy INSERT).

### Dowód

1. **`server/src/services/finance/canonical/__tests__/idempotentComputeRetry.pg.test.ts`** (nowy plik,
   608 linii, `git add -f`) — dla KAŻDEGO z 4 serwisów (5 wywołań): woła compute DWA RAZY z identycznymi
   parametrami, sprawdza (a) brak błędu, (b) ten sam `job.id`, (c) NIEZALEŻNY odczyt SQL
   `SELECT ... FROM compute_job_outputs WHERE job_id = ?` → dokładnie 1 wiersz. Plus osobny test:
   duplikat podczas gdy pierwsze zadanie jest jeszcze `running` (prawdziwa przeplotka przez
   `vi.spyOn(computeJobService,'completeJobSuccess')`, ten sam wzorzec co
   `w2FalseSuccessW9B2.pg.test.ts`) → `JOB_NOT_RUNNING`, nie fałszywy sukces.

   **Wynik**: `Test Files 1 passed (1) / Tests 6 passed (6)`, exit code 0.

2. **Kontrola negatywna** (wykonana naprawdę, nie deklaratywnie): dla wszystkich 4 plików serwisowych
   `git show aa4948b1d1:<plik> > <plik>` (przywrócenie gołego `claimById()`), uruchomienie
   `idempotentComputeRetry.pg.test.ts` → **wszystkie 6 testów CZERWONE**, z dokładnie tym samym
   błędem co w produkcji: `Error: ...failed to self-claim just-enqueued job ... row is no longer
   'queued' (concurrent claim or already terminal)` — dla wszystkich pięciu miejsc. Następnie
   `git checkout HEAD -- <4 pliki>` → drzewo czyste, naprawa przywrócona → **wszystkie 6 testów
   ZIELONE**, exit code 0 (potwierdzone osobnym przebiegiem po wznowieniu sesji).

3. **Regresja**: `w2FalseSuccessW9B2.pg.test.ts` (5 testów, istniejąca ochrona NOT_RUNNING vs
   OUTPUT_ALREADY_COMMITTED, w tym prawdziwa przeplotka z anulowaniem) — **5/5 zielone**, niezmienione
   zachowanie.

---

## DEFEKT 2 — stan `NA` był nieosiągalny

### Ustalenie: POTWIERDZONE (niezależnie, dwukrotnie)

Własny pomiar (przed jakąkolwiek podpowiedzią) potwierdził dokładnie to, co ustalił oracle GoldCo i
niezależnie — inny weryfikator pakietu D:

- **`formulaAstEvaluator.ts`** (silnik KPI): typ `EvalValueStatus` miał komentarz wprost: *"never
  `'NA'` — that value_status is reserved for other domains/callers, not emitted by this evaluator"*.
  Gałąź `divide`/`ratio` mapowała ZARÓWNO zerowy, JAK I brakujący mianownik na `NOT_APPLICABLE`
  (z `quality_flag='DIVISION_BY_ZERO'` dla zera) — nigdy na `NA`.
- **`statementMappingService.ts`** (mapowanie wyciągów): `valueStatusFor(value)` (linia ~179) —
  ```ts
  function valueStatusFor(value: number | null | undefined): FinanceValueStatus {
    if (value === null || value === undefined) return 'MISSING';
    if (value === 0) return 'PRESENT_ZERO';
    return 'PRESENT_NONZERO';
  }
  ```
  Dokładnie 3 stany, `NA`/`NOT_APPLICABLE` strukturalnie nieosiągalne — potwierdza dosłownie to, co
  wskazał weryfikator pakietu D.

**Dlaczego to jest inny przypadek niż `formulaAstEvaluator.ts`**: `statementMappingService.ts` nie
wykonuje ŻADNEGO obliczenia — to czysty passthrough surowej wartości źródłowej na kanoniczną komórkę.
Nie ma tam „dzielenia", więc nie ma pojęcia „niezdefiniowana matematycznie". Wiersz, który „nie dotyczy"
(np. wykluczony przez regułę mapowania) NIGDY nie trafia do `finance_stmt_lines` w ogóle — ląduje w
completely innym mechanizmie: `ReconciliationBucket='EXCLUDED'` w warstwie uzgodnienia (z własnym
`reasonCode`/`excludeKind`), nie jako `value_status='NOT_APPLICABLE'` na zapisanym wierszu. Zbadano
świadomie i **NIE naprawiono** tego pliku — nieosiągalność `NA`/`NOT_APPLICABLE` tam jest zgodna z
architekturą modułu (brak operacji, którą można by uznać za "niewykonalną"), nie defektem wymagającym
kodu. Gdyby produkt kiedyś chciał osobnego stanu "ta pozycja nie dotyczy tego podmiotu" na poziomie
`finance_stmt_lines` (a nie tylko w ledgerze uzgodnienia), to osobna decyzja projektowa, poza mandatem
tego pakietu (który explicite wskazuje przypadek dzielenia/mianownika).

### Naprawa (`formulaAstEvaluator.ts`)

1. `EvalValueStatus` rozszerzony o `'NA'` (5 stanów: `PRESENT_ZERO · PRESENT_NONZERO · MISSING · NA ·
   NOT_APPLICABLE` — `NOT_APPLICABLE` był już osiągalny wcześniej, przez `INSUFFICIENT_HISTORY` i
   `negative_denominator_policy='FORCE_NA'`; ten pakiet dotyczy wyłącznie `NA`).
2. Gałąź `divide`/`ratio`:
   - **mianownik `MISSING`** i licznik jest realną, obecną wartością (`PRESENT_ZERO`/`PRESENT_NONZERO`)
     → `NA`, reason code `NA_REASON:DENOMINATOR_MISSING` w `detail` (→ `interpretation_text`).
   - **mianownik dokładnie `0`** (realna wartość, nie brak danych) → `NA`, reason code
     `NA_REASON:DIVISION_BY_ZERO`.
   - `quality_flag` zostaje `null` w obu przypadkach — NIE `'DIVISION_BY_ZERO'`. Powód: CHECK
     `chk_finance_analysis_kpi_values_division_by_zero_shape`
     (`20260809_finance_v3_d03_analysis_01_tables.sql`) wymusza `value_status='NOT_APPLICABLE'`
     ilekroć `quality_flag='DIVISION_BY_ZERO'` — kombinacja `NA`+`DIVISION_BY_ZERO` złamałaby ten
     CHECK przy zapisie. Flaga `DIVISION_BY_ZERO` po prostu nie jest już emitowana przez ten
     ewaluator (CHECK nigdy więcej nie jest wywoływany przez tę ścieżkę — nie złamany, tylko
     nieużywany z tego miejsca) — patrz „Dlaczego bez migracji" niżej.
   - **regresja-strażnik (świadome doprecyzowanie)**: gdy licznik SAM jest nieużywalny (`MISSING`/`NA`/
     `NOT_APPLICABLE` — np. `AVERAGE_BALANCE` bez wcześniejszego okresu, realny przypadek
     jednorazowej/świeżej Analizy), NIE wymuszamy `NA` — stosuje się standardowy priorytet
     `MISSING > NA > NOT_APPLICABLE` (patrz `propagateUnusable`). Inaczej pusta Analiza (zero danych
     źródłowych) czytałaby się jako „próbowaliśmy liczyć i się nie dało" zamiast uczciwego „nic jeszcze
     nie wpisano" — złapane przez `kpiComputeService.determinism.pg.test.ts` (patrz niżej).
3. `isUnusable()`/`propagateUnusable()` rozszerzone o `NA` (priorytet `MISSING > NA > NOT_APPLICABLE`)
   — inaczej `NA` z zagnieżdżonego dzielenia (np. wewnętrzne `REVENUE/DAYS_IN_PERIOD` w DSO) nie byłoby
   rozpoznane jako „nieużywalne" przez operator zewnętrzny i jego `value: null` cicho wpadłoby do
   arytmetyki jako liczba.
4. `evaluateFormula`'s check `negative_denominator_policy` — lista wykluczeń rozszerzona o `'NA'`
   (obok istniejących `'MISSING'`/`'NOT_APPLICABLE'`), żeby nie próbować `< 0` na `denom.value === null`.

### Dlaczego bez migracji

`NA` jest ogólnie legalny w schemacie (`finance_value_status` ENUM, CHECK kształtu wartości we
wszystkich tabelach) — problem był WYŁĄCZNIE w kodzie silnika, nie w schemacie. Jedyny CHECK, który
kolidowałby z naiwną naprawą (`chk_finance_analysis_kpi_values_division_by_zero_shape`), został
ominięty przez świadomą decyzję (reason code w `detail`, nie w `quality_flag`), więc żadna migracja nie
była potrzebna — zgodnie z allowlistą tego zadania (`server/migrations/` poza zakresem).

### Dowód

1. **`formulaAstEvaluator.test.ts`** (unit, bez DB) — zaktualizowane/nowe przypadki:
   - `DIVISION_BY_ZERO → NA` (nie `NOT_APPLICABLE`), `qualityFlag=null`, `detail` zawiera
     `DIVISION_BY_ZERO`.
   - **realne policzone zero** (licznik=0, zdrowy mianownik≠0) → `PRESENT_ZERO`, jawnie
     `expect(status).not.toBe('NA')` — dowód rozróżnialności.
   - mianownik `MISSING`, licznik obecny → `NA`, `detail` zawiera `DENOMINATOR_MISSING`.
   - licznik `MISSING`, mianownik obecny → nadal `MISSING` (nie `NA`) — rozróżnienie „numerator vs
     denominator" zachowane.
   - OBA `MISSING` → `MISSING` (nie `NA`) — regresja-strażnik.
   - zagnieżdżone dzielenie przez zero (DSO) → `NA` propagowane przez zewnętrzny węzeł.
   - **Wynik**: `14 passed (14)`, exit 0.

2. **`kpiComputeService.pg.test.ts`** (real Postgres, SERWIS nie prezentacja) — nowy blok `describe`
   „P1 fix — NA is reachable end-to-end":
   - `CURRENT_LIABILITIES` w ogóle niezapisane (brak komórki) → `computeAnalysisKpis()` zwraca
     `status='NA'`, `detail` zawiera `DENOMINATOR_MISSING`; NIEZALEŻNY SQL odczyt
     `finance_analysis_kpi_values` potwierdza `value_status='NA'`, `value_decimal=NULL`,
     `quality_flag=NULL`, `interpretation_text` zawiera `DENOMINATOR_MISSING` — przechodzi przez
     realny CHECK constraint bazy.
   - `CURRENT_LIABILITIES=0` (realne zero) → to samo dla `DIVISION_BY_ZERO`.
   - **`CURRENT_ASSETS=0` z realnym, zdrowym mianownikiem** → `status='PRESENT_ZERO'`,
     `value_decimal=0` w bazie — DOWÓD rozróżnialności między „policzone zero" a „NA z powodu zera w
     mianowniku", wymagany explicite przez brief.
   - Zaktualizowano istniejący test `DEBT_TO_EBITDA` (RC-09, LTM na danych rocznych) —
     `status` zmieniony z `'MISSING'` na `'NA'` z pełnym komentarzem uzasadniającym (to była dokładnie
     manifestacja tego samego defektu, nie osłabienie testu).
   - **Wynik**: `10 passed (10)`, exit 0.

3. **Kontrola negatywna** (real revert + rerun, real restore + rerun):
   - `git show aa4948b1d1:.../formulaAstEvaluator.ts > .../formulaAstEvaluator.ts`
   - `formulaAstEvaluator.test.ts` → **4 testy CZERWONE** (`expected 'NOT_APPLICABLE'/'MISSING' to be
     'NA'`, dokładnie na tych samych asercjach co miałyby dowodzić naprawy).
   - `kpiComputeService.pg.test.ts` → **3 testy CZERWONE** (DEBT_TO_EBITDA + oba nowe NA-testy).
   - `git checkout HEAD -- .../formulaAstEvaluator.ts` → drzewo czyste.
   - Ponowny przebieg obu plików → **14/14 i 10/10 ZIELONE**, exit 0 (potwierdzone dwukrotnie).

4. **Regresja-strażnik złapana i naprawiona w toku pracy** (nie ukryta): pierwsza wersja naprawy
   (mianownik `MISSING` → `NA` bezwarunkowo) zepsuła `kpiComputeService.determinism.pg.test.ts` — pusta
   Analiza (zero linii źródłowych, jeden okres bez poprzednika) dawała `NA` zamiast `MISSING` dla
   DSO/DIO/DPO/CASH_CONVERSION_CYCLE (bo ich licznik to `AVERAGE_BALANCE` bez historii →
   `NOT_APPLICABLE`, nie dosłownie `'MISSING'`, więc pierwszy wariant strażnika — `left.status===
   'MISSING'` — go nie łapał). Zdiagnozowane skryptem debugowym uruchamiającym `computeAnalysisKpis()`
   na żywej bazie dla wszystkich 18 katalogowych KPI naraz, naprawione doprecyzowaniem strażnika do
   `isUnusable(left)` (MISSING/NA/NOT_APPLICABLE), zacommitowane osobno (`77b10b107e`).

---

## Wyniki testów (exit code, nie „wygląda zielono")

Baza testowa: `fixcanon_j` na `127.0.0.1:54330` (utworzona `newdb.sh fixcanon`, klaster efemeryczny,
ZERO połączeń do demo/staging/prod). Cztery zmienne bramki: `RUN_DB_TESTS=1 MOCK_DB=false
NODE_ENV=test DATABASE_URL=postgresql://...`. Uruchamiane z `server/`, `--no-file-parallelism
--maxWorkers=2`.

| Plik | Testy | Wynik | Exit |
|---|---|---|---|
| `idempotentComputeRetry.pg.test.ts` (nowy) | 6 | **PASS** | 0 |
| `kpiComputeService.pg.test.ts` (rozszerzony) | 10 | **PASS** | 0 |
| `formulaAstEvaluator.test.ts` (rozszerzony) | 14 | **PASS** | 0 |
| `kpiComputeService.determinism.pg.test.ts` (regresja) | 1 | **PASS** | 0 |
| `w2FalseSuccessW9B2.pg.test.ts` (regresja) | 5 | **PASS** | 0 |
| `analysis.routes.pg.test.ts` (regresja) | — | **PASS** | 0 |
| `coldReopen.pg.test.ts` (regresja) | — | **PASS** | 0 |
| `tenantMatrix.pg.test.ts` (regresja) | — | **PASS** | 0 |
| `financeCompareService.pg.test.ts` (regresja) | — | **PASS** | 0 |
| `valuation-b3-review.routes.pg.test.ts` (regresja) | — | **PASS** | 0 |
| **Zbiorczy przebieg (10 plików razem)** | **76** | **PASS** | **0** |
| `tsc --noEmit -p tsconfig.json` (CAŁY `server/`, `NODE_OPTIONS=--max-old-space-size=12288`) | — | **0 błędów typów** | **0** |

`esbuild --bundle` (per-plik, szybka kontrola składni) — zielono na wszystkich 9 zmienionych plików
produkcyjnych/testowych przed każdym uruchomieniem vitest.

## Kontrole negatywne — podsumowanie

| Defekt | Co cofnięto | Rezultat cofnięcia | Co przywrócono | Rezultat po przywróceniu |
|---|---|---|---|---|
| 1 (idempotencja) | 4 pliki serwisowe → `aa4948b1d1` | 6/6 testów CZERWONE (dokładnie oryginalny błąd) | `git checkout HEAD --` | 6/6 ZIELONE |
| 2 (NA) | `formulaAstEvaluator.ts` → `aa4948b1d1` | 4/4 (unit) + 3/3 (pg) testów CZERWONE | `git checkout HEAD --` | 14/14 (unit) + 10/10 (pg) ZIELONE |

## Nie dostarczone / poza zakresem

| Pozycja | Status | Powód |
|---|---|---|
| Naprawa `statementMappingService.ts` (NA/NOT_APPLICABLE nieosiągalne) | **EVIDENCE_MISSING → NOT_A_DEFECT (uzasadnione)** | Zbadane świadomie (patrz wyżej): moduł to czysty passthrough bez operacji, która mogłaby być "niewykonalna matematycznie"; "nie dotyczy" już istnieje jako osobny mechanizm (`ReconciliationBucket='EXCLUDED'` + `excludeKind`/`reasonCode`), nie jako `value_status` na zapisanym wierszu. Dodanie `NOT_APPLICABLE` tam wymagałoby nowej decyzji projektowej (kiedy dokładnie mapowanie ma pisać `NOT_APPLICABLE` zamiast pomijać wiersz) — poza mandatem tego pakietu, który explicite wskazuje przypadek dzielenia/mianownika. |
| `perfSlo.pg.test.ts` (pełny przebieg) | **PARTIAL** | Test wydajnościowy z pełnymi (nie blank-slate) danymi źródłowymi — grep potwierdza brak asercji na `NOT_APPLICABLE`/`'NA'`, niskie ryzyko regresji; pominięty ze względu na czas/obciążenie maszyny (>15 równoległych `tsc` innych sesji w trakcie pracy). Nie jest to dowód „działa", tylko brak dowodu przeciwnego. |
| Migracja rozluźniająca `chk_finance_analysis_kpi_values_division_by_zero_shape` | **NIE DOTKNIĘTA (świadomie)** | Poza allowlistą (`server/migrations/`); naprawa nie wymagała tego — `quality_flag` po prostu nie jest już emitowany z tej ścieżki, CHECK pozostaje poprawny i nienaruszony. |

## Pułapki napotkane i jak je ominięto

- **Worktree bez `node_modules`** — świeży worktree nie miał w ogóle `node_modules` (ani symlinka).
  Naprawione symlinkiem do głównego repo (`ln -s ".../consultify/node_modules" node_modules`), wzorem
  innych worktree w `consultify-wt/`.
- **`tsc` bez `timeout`** na macOS ubił pierwszą próbę weryfikacji tła cicho (`command not found:
  timeout`) — poprawione: uruchomienie bez `timeout`, `NODE_OPTIONS=--max-old-space-size=12288`,
  sprawdzony exit code, nie „brak outputu = sukces".
- **Regresja-strażnik nr 2** (blank-slate Analysis → `NA` zamiast `MISSING`) — złapana przez ISTNIEJĄCY
  test regresyjny (`kpiComputeService.determinism.pg.test.ts`), nie przez własną intuicję — dokładnie
  ten wzorzec, który CLAUDE.md nakazuje: zmierz na żywej bazie, nie zakładaj.
- **Przerwa w sesji (ENOTFOUND) między kontrolą negatywną Defektu 1 a przywróceniem naprawy** —
  koordynator przywrócił naprawę (`git show HEAD:<plik> > <plik>` dla 4 serwisów) podczas przerwy;
  po wznowieniu zweryfikowano niezależnym przebiegiem (`idempotentComputeRetry.pg.test.ts`,
  6/6 PASS, exit 0), zanim przyjęto stan drzewa za pewnik.

## Podsumowanie stanu (PASS/PARTIAL/FAIL/EVIDENCE_MISSING)

| Wymaganie brief-u | Status |
|---|---|
| Defekt 1 — 5/5 miejsc naprawionych spójnie, wspólny helper | **PASS** |
| Defekt 1 — rozróżnienie NOT_RUNNING vs OUTPUT_ALREADY_COMMITTED zachowane i opisane | **PASS** |
| Defekt 1 — dowód: 2 wywołania, ten sam job id, dokładnie 1 output (SQL), na 4 serwisy | **PASS** |
| Defekt 1 — kontrola negatywna (cofnij→czerwone→przywróć→zielone) | **PASS** |
| Defekt 2 — potwierdzenie/obalenie ustalenia z dowodem ścieżki kodu | **PASS (potwierdzone, dwa niezależne miejsca zbadane)** |
| Defekt 2 — NA produkowany przy brakującym/zerowym mianowniku, z reason code | **PASS** |
| Defekt 2 — rozróżnienie MISSING/NA/NOT_APPLICABLE/PRESENT_ZERO zachowane | **PASS** |
| Defekt 2 — dowód na poziomie serwisu (nie prezentacji), real Postgres | **PASS** |
| Defekt 2 — kontrola negatywna | **PASS** |
| Wartości Decimal, determinizm (sort w pamięci) | **PASS (nie naruszono istniejącego wzorca `hashPayloadFor`/`canonicalPayloadHash`; żadna nowa suma/hash nie została dodana w tym pakiecie)** |
| Zero połączeń do demo/staging/prod | **PASS** |
| `tsc --noEmit` cały `server/`, exit code | **PASS (0 błędów)** |
| Sprzątnięcie bazy testowej (`dropdb`) | patrz niżej — do wykonania po zamknięciu sesji |

## Sprzątanie

Baza testowa `fixcanon_j` (klaster `127.0.0.1:54330`) pozostaje utworzona na czas trwania weryfikacji
niezależnej. Do usunięcia po akceptacji: `/opt/homebrew/opt/postgresql@15/bin/dropdb -h 127.0.0.1 -p
54330 -U piotrwisniewski fixcanon_j`.
