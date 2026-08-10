# P0 tenant-isolation fix — naprawa dwóch P0 i czterech P1/P2 tej samej klasy

**Program:** Finance v3 — kontynuacja `W9_FAULT_CONCURRENCY_TENANT_MATRIX_report.md` (część C).
**Worktree:** `/Users/piotrwisniewski/consultify-wt/fv3-p0tenant`
**Gałąź:** `codex/finance-v3-p0tenant`
**Baza:** `cc874cc5e7` (merge `codex/finance-v3-w9-faultmatrix` + `codex/finance-v3-w10-testisolation` do `codex/finance-v3-p0tenant`)
**Data:** 2026-08-10
**Charakter pracy:** naprawa produkcyjnego kodu + jedna addytywna migracja + odwrócenie asercji w istniejącym pliku testowym. Zero pushy, zero połączeń ze staging/demo/produkcją — wszystko zmierzone na własnym efemerycznym klastrze Postgres 15, usuniętym po pracy.

---

## 0. Commity (w kolejności)

| SHA | Zawartość |
| --- | --- |
| `32a9087755` | P0 W9-C-5 — `computeJobService.getJob/cancelJob/failJob` wymagają `organizationId` |
| `1421d499bf` | P0 W9-C-4 — `writeSensitivityGrid()` weryfikuje właściciela metody + predykaty org |
| `a551db7f7f` | W9-C-7 strukturalne — nowa migracja, złożone FK `(rodzic, organization_id)` |
| `2e2274f52f` | P1 W9-C-1/C-2/C-3 — `loadContext`/`runPreflight`/`findOrCreateMethod` org-scoped + typowana odmowa; odwrócenie asercji tenantMatrix (rodziny 2/5/6/8 + STRUCTURAL) |
| `4edfa9239a` | P2 W9-C-6 — `computeAnalysisKpis()` typowana odmowa zamiast gołego `Error` |

Końcowy SHA drzewa (po tej pracy): **`4edfa9239a`**.

---

## 1. Środowisko pomiaru

| Element | Wartość |
| --- | --- |
| Baza | PostgreSQL 15.15 (Homebrew `postgresql@15`), własny efemeryczny klaster |
| `PGDATA` | `/private/tmp/fv3-p0tenant-pgdata` (poza scratchpadem sesji — reguła #9 z briefu) |
| Gniazdo / port | `/tmp/fv3p0sock` / **57601** (sprawdzony `lsof` przed bindem, wolny) |
| `initdb`/`pg_ctl` | `LC_ALL=C`, `--locale=C`, `-E UTF8`, `listen_addresses=127.0.0.1` |
| Migracje | `server/scripts/migrate.postgres.ts` **STRICT** (bez `--safe`) |
| Bramka testów | `RUN_DB_TESTS=1` **oraz** `MOCK_DB=false` **oraz** jawny `DATABASE_URL` |
| Runner | `npx vitest run --config vitest.config.ts ... --no-file-parallelism`, z `server/` |
| Sprzątanie | `pg_ctl -m fast stop` + `rm -rf` katalogu danych i gniazda — wykonane na końcu sesji |

---

## 2. Per defekt — co było, co zmieniono, dowód

### W9-C-5 (P0) — `computeJobService` nie znał pojęcia organizacji

**Plik:** `server/src/services/finance/canonical/computeJobService.ts`

**Przed:** `getJob(jobId)` (linia 265), `cancelJob(jobId, reason)` (255), `failJob({jobId, error})` (228/222) — żadna z trzech funkcji nie przyjmowała `organizationId` ani nie miała predykatu `organization_id` w SQL. Każdy, kto znał/zgadł `jobId`, mógł go odczytać i **anulować** cudzy compute job.

**Po:**
- `getJob(organizationId, jobId)` — `WHERE id = ? AND organization_id = ?`.
- `cancelJob(organizationId, jobId, reason)` — `WHERE id = ? AND organization_id = ? AND status IN (...)`.
- `failJob({jobId, organizationId, error})` — `SELECT ... WHERE id = ? AND organization_id = ? FOR UPDATE`.
- Odmowa = `null` — **ten sam** typowany kontrakt NOT_FOUND, jaki funkcje już miały dla nieistniejącego `jobId`; nigdy surowy błąd Postgresa.
- `claim()` **celowo bez zmian** — międzyorganizacyjny z założenia (WP-B04 ADR, `canonicalServices.pg.test.ts`).

Zaktualizowani wywołujący produkcyjni: `baselineComputeService.ts:610,649`, `predictionComputeService.ts:281,672`, `kpiComputeService.ts:480,536`, `valuationComputeService.ts:384` (wszystkie już miały `params.organizationId` w zasięgu — zero nowych parametrów potrzebnych na tym poziomie). Zaktualizowano też jednotenantowe wywołania w `faultMatrix.pg.test.ts` (7 miejsc, ta sama org przez cały plik).

**Dowód niezależnym odczytem** (nie wartością zwróconą przez serwis) — patrz `tenantMatrix.pg.test.ts`, testy `FIXED W9-C-5`:
```
independent read: SELECT status, cancel_reason, cancel_requested_at FROM compute_jobs WHERE id = ?
-> status='queued', cancel_reason=NULL, cancel_requested_at=NULL   (po próbie A.orgId anulować job B)
```

### W9-C-4 (P0) — `writeSensitivityGrid()` kasował i podmieniał siatkę cudzej organizacji

**Plik:** `server/src/services/finance/canonical/valuationSensitivityService.ts`

**Przed:** upsert po `(method_id, grid_label)` (~:167) i `DELETE FROM finance_valuation_sensitivity_cells WHERE grid_id = ?` (~:180) — zero predykatu `organization_id`. Organizacja A mogła podać `methodId` organizacji B i skasować + podmienić jej 25 komórek, bez śladu w audycie (tabele nie są append-only).

**Po (dwuwarstwowo):**
1. **Warstwa serwisu (główna obrona):** przed dotknięciem czegokolwiek `writeSensitivityGrid()` weryfikuje `SELECT id FROM finance_valuation_methods WHERE id = ? AND organization_id = ?` — jeśli metoda nie należy do wywołującej organizacji, rzuca typowany `SensitivityGridAccessError` (nowa klasa błędu, odróżnialna od istniejącego `Error` walidacji wejścia). Dodatkowo `organization_id` w `WHERE` upsertu (`ON CONFLICT ... DO UPDATE ... WHERE organization_id = ?`) i w `DELETE ... AND organization_id = ?` — obrona w głąb.
2. **Warstwa bazy (backstop, migracja W9-C-7 niżej):** złożony FK `(method_id, organization_id) → finance_valuation_methods(id, organization_id)` na `finance_valuation_sensitivity_grids` i `(grid_id, organization_id) → finance_valuation_sensitivity_grids(id, organization_id)` na `..._cells`.

**Dowód niezależnym odczytem:**
```
SELECT c.organization_id, count(*) FROM finance_valuation_sensitivity_cells c
  JOIN finance_valuation_sensitivity_grids g ON g.id=c.grid_id
 WHERE g.method_id=B.methodId AND g.grid_label='W9C_WACC_X_G' GROUP BY 1
-> [{organization_id: B.orgId, n: 25}]   (25/25, TE SAME wiersze co przed próbą A — porównane po id)
```

---

## 3. Naprawa strukturalna — W9-C-7

**Nowy plik:** `server/migrations/20260825_finance_v3_w9c7_valuation_child_tenant_fk.sql` (addytywna, `BEGIN`/`COMMIT`, zero DROP/RENAME/ALTER TYPE).

### 3.1 Tabele z DODANYM złożonym FK `(rodzic, organization_id)`

| Tabela dziecko | Rodzic | Nowy klucz na rodzicu | Nowy FK na dziecku |
| --- | --- | --- | --- |
| `finance_valuation_sensitivity_grids` | `finance_valuation_methods` | `uq_finance_valuation_methods_id_org UNIQUE(id, organization_id)` | `fk_finance_valuation_sensitivity_grids_method_org FOREIGN KEY (method_id, organization_id)` |
| `finance_valuation_terminal` | `finance_valuation_methods` | (jw., reużyty) | `fk_finance_valuation_terminal_method_org` |
| `finance_valuation_comps` | `finance_valuation_methods` | (jw., reużyty) | `fk_finance_valuation_comps_method_org` |
| `finance_valuation_sensitivity_cells` | `finance_valuation_sensitivity_grids` | `uq_finance_valuation_sensitivity_grids_id_org UNIQUE(id, organization_id)` | `fk_finance_valuation_sensitivity_cells_grid_org FOREIGN KEY (grid_id, organization_id)` |
| `finance_valuation_ev_equity_bridge_components` | `finance_valuation_ev_equity_bridge` | `uq_finance_valuation_ev_bridge_id_org UNIQUE(id, organization_id)` | `fk_finance_valuation_ev_bridge_components_bridge_org` |
| `finance_baseline_backtest_line_results` | `finance_baseline_backtest_runs` | `uq_finance_baseline_backtest_runs_id_org UNIQUE(id, organization_id)` | `fk_finance_baseline_backtest_line_results_run_org` |

### 3.2 Tabele świadomie pominięte i dlaczego

- **`finance_valuation_cases`** — była w oryginalnej liście 7 tabel w briefie, ale **strukturalnie NIE JEST dzieckiem** żadnej tabeli: `case_id` PK, `organization_id REFERENCES organizations(id)` bezpośrednio, zero kolumny `business_version_id`/`method_id`/`grid_id` własnej (patrz `20260809_finance_v3_d09_valuation_01_tables.sql` §1: „Deliberately NOT a finance_artifacts/finance_business_versions row"). Ta sama klasa co `finance_stmt_calendars`/`finance_stmt_periods`, które sam raport W9 nazywa „skalowane tylko org FK — poprawnie". Potwierdzone `grep`-em: **zero** produkcyjnych serwisów czyta/pisze `finance_valuation_cases` — nie ma tu żywego wektora wycieku do zamknięcia. Udokumentowane wprost w migracji i w odwróconej asercji STRUCTURAL W9-C-7 (patrz §5 niżej) — nie po cichu pominięte.
- **`finance_analysis_kpi_catalog`** — świadomie globalny katalog (nie ma `organization_id` w ogóle w sensie tenant-scoped — brief tak stwierdza, nie dotykane).
- **`finance_stmt_calendars`/`finance_stmt_periods`** — skalowane samym org FK poprawnie (brief tak stwierdza, nie dotykane).

### 3.3 Bezpieczeństwo migracji na istniejących danych

`ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` jest walidowany przez Postgresa względem KAŻDEGO istniejącego wiersza w tej samej transakcji — jeśli jakikolwiek wiersz łamałby nowy FK, cała migracja (jedna transakcja `BEGIN`/`COMMIT`) rolluje się z czytelnym błędem 23503/23505, zamiast cicho zastosować się częściowo. Na świeżej bazie (ten pakiet) nie ma istniejących danych, więc nie ma tu problemu — ale migracja jest napisana tak, by była bezpieczna również na populated DB (nigdy nie testowana na demo/staging — zakaz z briefu).

**Dowód idempotencji:** `migrate.postgres.ts` STRICT uruchomiony 3× na tym samym efemerycznym klastrze (raz po pierwszym zbudowaniu bazy, raz po odtworzeniu bazy od zera po kontroli negatywnej, raz na samym końcu) — za każdym razem `exit 0`, migracje idempotentne (`CREATE TABLE IF NOT EXISTS`/`ADD CONSTRAINT` bez duplikatów, runner śledzi już-zastosowane pliki).

---

## 4. P1 — trzy wycieki odczytu

### W9-C-1 — `baselineComputeService.loadContext()`

**Plik:** `server/src/services/finance/canonical/baselineComputeService.ts`

**Przed:** filtrowała `organization_id` TYLKO w `finance_stmt_periods`. Sześć innych odczytów szło po samym `business_version_id`/`entity_id`: `finance_baseline_models` (~:201), `finance_business_versions` (~:208), `finance_stmt_lines` — historia przychodu (~:231) i bilans otwarcia (~:241), `finance_baseline_schedules` (~:251), `finance_baseline_assumptions` (~:258).

**Po:** wszystkie sześć zapytań mają teraz `AND organization_id = ?`. Odmowa następuje na PIERWSZYM zapytaniu (`finance_baseline_models`) z istniejącym typowanym kodem `NO_BASELINE_MODEL_ROW` — funkcja nigdy nie dociera do reszty odczytów dla cudzej wersji.

**Dowód niezależnym odczytem:**
```
loaded = await loadContext({organizationId: A.orgId, businessVersionId: B.baselineBvId, ...})
-> loaded.ok === false, loaded.code === 'NO_BASELINE_MODEL_ROW'
niezależnie: SELECT organization_id FROM finance_baseline_models WHERE business_version_id = B.baselineBvId
-> organization_id = B.orgId   (wiersz B nietknięty, nigdy nie odczytany przez A)
```

### W9-C-2 — `predictionPreflightService.runPreflight()`

**Plik:** `server/src/services/finance/canonical/predictionPreflightService.ts:141`

**Przed:** `SELECT ... FROM finance_prediction_scenarios WHERE business_version_id = ?` bez `organization_id`. Serwis wchodził w dane B; jedyną obroną był surowy FK `fk_finance_prediction_preflight_runs_bv_org` (23503) na ewentualnym zapisie — ale to NASTĘPOWAŁO PO odczytaniu scenariusza/assumption setu B.

**Po:** predykat `AND organization_id = ?` na pierwszym (i jedynym potrzebnym) zapytaniu — odmowa natychmiast, typowany `NO_SCENARIO_ROW` (Promise się rozstrzyga, nie odrzuca), nigdy surowy błąd Postgresa.

**Dowód niezależnym odczytem:**
```
result = await runPreflight({organizationId: A.orgId, businessVersionId: B.predictionBvId, ...})
-> result.ok === false, result.code === 'NO_SCENARIO_ROW'
niezależnie: SELECT organization_id FROM finance_prediction_scenarios WHERE business_version_id = B.predictionBvId
-> organization_id = B.orgId   (nietknięty)
SELECT id FROM finance_prediction_preflight_runs WHERE business_version_id = B.predictionBvId -> 0 wierszy
```

### W9-C-3 — `valuationComputeService.findOrCreateMethod()`

**Plik:** `server/src/services/finance/canonical/valuationComputeService.ts:76` (było ~:70)

**Przed:** `SELECT * FROM finance_valuation_methods WHERE business_version_id = ? AND method_type = ?` bez `organization_id` → zwracała metodę B do wywołującego z org A. To był wektor wejścia do W9-C-4.

**Po:** funkcja NAJPIERW weryfikuje `SELECT business_version_id FROM finance_business_versions WHERE business_version_id = ? AND organization_id = ?`; jeśli para nie istnieje, zwraca `{ok:false, code:'BUSINESS_VERSION_NOT_FOUND'}`. Zmieniono sygnaturę zwrotną z gołego `MethodRow` na `{ok:true,method}|{ok:false,code,message}` — zaktualizowano jedynego produkcyjnego wywołującego (`runDcfFcffValuation`, nowy kod błędu `BUSINESS_VERSION_NOT_FOUND` w unii wyników) i fixture `seedOrg` w `tenantMatrix.pg.test.ts`.

**Dowód niezależnym odczytem:**
```
result = await findOrCreateMethod({organizationId: A.orgId, businessVersionId: B.valuationBvId, methodType:'DCF_FCFF', ...})
-> result.ok === false, result.code === 'BUSINESS_VERSION_NOT_FOUND'
niezależnie: SELECT id, organization_id FROM finance_valuation_methods
             WHERE business_version_id = B.valuationBvId AND method_type='DCF_FCFF'
-> dokładnie 1 wiersz, id=B.methodId, organization_id=B.orgId (żadnego nowego wiersza A nie powstało)
```

---

## 5. P2 (opcjonalny, wykonany) — W9-C-6

**Plik:** `server/src/services/finance/canonical/kpiComputeService.ts:439-446`

Izolacja i tak trzymała (`getBusinessVersion` jest org-scoped) — to dług sygnału, nie dziura. **Przed:** `throw new Error(...)` przy naruszeniu granicy → warstwa HTTP zmapowałaby to na 500 zamiast 404. **Po:** `{ok:false, code:'BUSINESS_VERSION_NOT_FOUND', message}` — nowy kod dodany do `ComputeAnalysisKpisResult`.

---

## 6. Kontrola negatywna — OBOWIĄZKOWA, wykonana dla obu P0

### 6.1 P0 #2 (`writeSensitivityGrid`, W9-C-4) — dwuwarstwowo

Plik podmieniony **wersją z commita rodzica `cc874cc5e7`** (`git show cc874cc5e7:...valuationSensitivityService.ts > ...`), NIE `git stash`. Przywrócony `git checkout HEAD -- ...`.

**Krok 1 — tylko serwis cofnięty, FK z migracji W9-C-7 zostaje (bo to osobny plik/commit, nietknięty):**
```
$ npx vitest run ... tenantMatrix.pg.test.ts -t "W9-C-4" --no-file-parallelism
FAIL  FIXED W9-C-4: ...
AssertionError: expected [Function] to throw error matching /method .* not found for organization/i
but got 'insert or update on table "finance_valuation_sensitivity_cells" violates
foreign key constraint "fk_finance_valuation_sensitivity_cells_grid_org"'
```
**CZERWONY** — ale odkrycie warte odnotowania: nawet bez własnej sprawdzki serwisu, złożony FK z migracji strukturalnej **sam w sobie** zatrzymuje operację w połowie transakcji, więc `DELETE` i nieudany `INSERT` cofają się razem — **niezależny odczyt fizyczny potwierdził, że 25 komórek B PRZETRWAŁO** (nietknięte, te same `id`) mimo cofniętej sprawdzki serwisu:
```sql
SELECT g.organization_id, count(c.id) FROM finance_valuation_sensitivity_grids g
  LEFT JOIN finance_valuation_sensitivity_cells c ON c.grid_id=g.id
 WHERE g.grid_label='W9C_WACC_X_G' GROUP BY 1 -> {org: B, n: 25}  (dla wszystkich seedów)
```
To jest **pozytywny efekt uboczny obrony w głąb**: sam FK strukturalny (bez sprawdzki w serwisie) już chroni dane przed utratą — ale komunikat błędu jest surowym 23503, nie typowaną odmową, więc test wciąż słusznie czerwienieje (asercja żąda konkretnego typowanego komunikatu).

**Krok 2 — dla wiernej reprodukcji ORYGINALNEGO defektu (bez ŻADNEJ z dwóch warstw obrony)** zdjęto tymczasowo oba FK z migracji W9-C-7 (`ALTER TABLE ... DROP CONSTRAINT`) na tej samej cofniętej wersji serwisu:
```
$ npx vitest run ... -t "W9-C-4"
FAIL — AssertionError: promise resolved {gridId:'...'} instead of rejecting
```
**CZERWONY** — i fizycznie zweryfikowano PRAWDZIWĄ utratę danych, 1:1 z oryginalnym raportem W9:
```sql
SELECT g.organization_id AS grid_org, c.organization_id AS cell_org, count(*) FROM ...
-> grid_org=B, cell_org=A, n=25   (25 komórek B ZASTĄPIONYCH przez A)
```
Baza następnie **usunięta i zbudowana od zera** (nie da się bezpiecznie przywrócić FK na już-uszkodzone dane w tej samej bazie), FK z migracji odtworzone przez pełną migrację STRICT, plik serwisu przywrócony `git checkout HEAD --`.

**Krok 3 — naprawa przywrócona, świeża baza:**
```
$ npx vitest run ... tenantMatrix.pg.test.ts --no-file-parallelism
Test Files  1 passed (1)
     Tests  24 passed (24)
```
**ZIELONY.**

### 6.2 P0 #1 (`computeJobService`, W9-C-5) — dedykowany probe, nie sam plik testowy

**Dlaczego nie prosty swap pliku:** naprawa zmieniła ARNOŚĆ `getJob`/`cancelJob` (dodała wymagany PIERWSZY parametr `organizationId`). Podmiana samego `computeJobService.ts` na wersję rodzica przy pozostawieniu already-zaktualizowanego pliku testowego (wywołania 2-argumentowe) dałaby MYLĄCY wynik — JS po cichu przesuwa argumenty pozycyjnie (`getJob(A.orgId, B.jobId)` na starej 1-argumentowej funkcji użyłoby `A.orgId` JAKO `jobId`, co przypadkiem zwróciłoby `null` z NIEWŁAŚCIWEGO powodu — dokładnie pułapka „UPDATE 0 wygląda jak PASS" z reguły złotej programu). Dlatego napisano osobny, jednorazowy probe (`__negctrl_w9c5_probe.ts`, usunięty po użyciu, NIE w `tests/`), wołający starą i nową funkcję DOKŁADNIE tak, jak wołał ją prawdziwy kod produkcyjny przed/po naprawie.

**Krok 1 — `computeJobService.ts` podmieniony wersją z `cc874cc5e7`, probe woła STARE API (`getJob(jobId)`, `cancelJob(jobId, reason)`):**
```
[seed] org B enqueued job 6cc49e43-..., status=queued
[probe] getJob(B.jobId) from org A context -> LEAKED row for org org-negctrl-B-...
[probe] cancelJob(B.jobId, reason) from org A context -> MUTATED, new status=cancelled
[probe] independent physical read of compute_jobs row -> status=cancelled, cancel_reason=cancelled by an actor from another tenant (negctrl probe)
[RESULT] VULNERABLE — cross-tenant read+cancel both succeeded (RED / defect reproduces)
```
**CZERWONY** — dokładna reprodukcja W9-C-5 z oryginalnego raportu.

**Krok 2 — plik przywrócony `git checkout HEAD --`, probe zmieniony na NOWE API (`getJob(orgA, jobId)`, `cancelJob(orgA, jobId, reason)`):**
```
[seed] org B enqueued job 63a046bc-..., status=queued
[probe] getJob(B.jobId) from org A context -> null
[probe] cancelJob(B.jobId, reason) from org A context -> null (no-op)
[probe] independent physical read of compute_jobs row -> status=queued, cancel_reason=null
[RESULT] NOT vulnerable — boundary held (GREEN)
```
**ZIELONY.** Oba pliki probe usunięte po użyciu (`rm`), nigdy nie zacommitowane.

**Wniosek kontroli negatywnej dla obu P0:** żaden test nie był zielony w obu stanach — oba dyskryminują poprawnie (P0#2 nawet ujawniło dodatkową, pozytywną warstwę obrony w głąb, o czym powyżej).

### 6.3 Kontrola negatywna bramki DB (obowiązkowa dodatkowo)

```
$ unset DATABASE_URL RUN_DB_TESTS MOCK_DB DB_TYPE
$ NODE_ENV=test npx vitest run --config vitest.config.ts src/services/finance/canonical/__tests__/tenantMatrix.pg.test.ts
Test Files  1 skipped (1)
     Tests  24 skipped (24)
```
`skipped`, nigdy `passed` — potwierdzone.

---

## 7. Odwrócone asercje — twierdzenie przed → twierdzenie po

Plik: `server/src/services/finance/canonical/__tests__/tenantMatrix.pg.test.ts`. Żadna asercja nie została usunięta ani oznaczona `skip` — każda odwrócona zachowuje opis w komentarzu tego, co dawniej dowodziła.

| Test (nazwa po naprawie) | PRZED (nazwa/twierdzenie) | PO (twierdzenie) |
| --- | --- | --- |
| `FIXED W9-C-1` (rodzina 2) | `DEFECT W9-C-1`: `loaded.ok === true`, zwraca pełny model B (assumptions/schedules ze znacznikiem B) | `loaded.ok === false`, `code === 'NO_BASELINE_MODEL_ROW'`; niezależny odczyt: wiersz B nietknięty |
| `FIXED W9-C-2` (rodzina 5) | `DEFECT W9-C-2`: `.rejects.toThrow(/foreign key constraint/)` — surowy 23503 PO odczytaniu B | `result.ok === false`, `code === 'NO_SCENARIO_ROW'` — resolved Promise, odmowa PRZED odczytem B |
| `FIXED W9-C-3` (rodzina 6) | `DEFECT W9-C-3`: `method.id === B.methodId`, `method.organization_id === B.orgId` | `result.ok === false`, `code === 'BUSINESS_VERSION_NOT_FOUND'`; niezależny odczyt: metod B nadal dokładnie 1, żaden nowy wiersz A nie powstał |
| `FIXED W9-C-4` (rodzina 6) | `DEFECT W9-C-4`: po zapisie A `ownership` = `[{org: A, n: 25}]`, `bCellsLeft.length === 0` (dane B SKASOWANE) | `.rejects.toThrow(/method .* not found/)`; niezależny odczyt: `ownership = [{org: B, n: 25}]`, te same `id` co przed próbą A (nie odtworzone) |
| `FIXED W9-C-5 getJob` (rodzina 8) | `DEFECT`: `jobsSvc.getJob(B.jobId)` (1 arg) zwraca wiersz B | `jobsSvc.getJob(A.orgId, B.jobId)` (2 args) zwraca `null`; `getJob(B.orgId, B.jobId)` nadal zwraca wiersz (sanity) |
| `FIXED W9-C-5 cancelJob` (rodzina 8) | `DEFECT`: `jobsSvc.cancelJob(B.jobId, reason)` (2 args starego API) anuluje job B | `jobsSvc.cancelJob(A.orgId, B.jobId, reason)` (3 args) zwraca `null`; niezależny odczyt: `status='queued'` nietknięty; `cancelJob(B.orgId, B.jobId, reason)` nadal działa (sanity) |
| `STRUCTURAL W9-C-7 FIXED` (rodzina 6) | Pinowana lista 6 tabel bez złożonego FK: `cases, comps, ev_equity_bridge_components, sensitivity_cells, sensitivity_grids, terminal` | Pinowana lista **`['finance_valuation_cases']`** — jedyny pozostały wpis, udokumentowany jako świadomy wyjątek (tabela-korzeń, brak kolumny-rodzica, zero produkcyjnych wywołujących) |
| `FIXED W9-C-6` (rodzina 3, P2) | `DEFECT`: `.rejects.toThrow(/business_version .* not found/)` — nietypowany throw | `result.ok === false`, `code === 'BUSINESS_VERSION_NOT_FOUND'` — resolved Promise |

Nagłówek pliku (komentarz metodologiczny na górze) również zaktualizowany — sekcja „STATUS" dodana, wyjaśniająca inwersję.

---

## 8. Surowe liczby przebiegów i komendy do reprodukcji

### 8.1 Przepis startowy

```bash
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3-p0tenant-pgdata ; PGSOCK=/tmp/fv3p0sock ; PORT=57601
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3p0_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3_p0tenant;"
DBURL="postgresql://postgres@127.0.0.1:$PORT/fv3_p0tenant"
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" npx tsx server/scripts/migrate.postgres.ts   # STRICT
```

### 8.2 Wyniki (baza świeża, ostatni przebieg — po commicie `4edfa9239a`)

| Komenda | Wynik |
| --- | --- |
| `npx tsx server/scripts/migrate.postgres.ts` STRICT (świeża baza) | **exit 0** |
| jw., drugi przebieg na tej samej bazie (idempotencja) | **exit 0** |
| `npx vitest run ... concurrencyMatrix.pg.test.ts faultMatrix.pg.test.ts tenantMatrix.pg.test.ts perfSlo.pg.test.ts --no-file-parallelism` | **Test Files 4 passed (4) / Tests 46 passed (46)** |
| `npx vitest run ... src/services/finance/canonical --no-file-parallelism` | **Test Files 30 passed (30) / Tests 416 passed (416)** |
| `npx vitest run ... src/services/finance --no-file-parallelism` | **Test Files 40 passed (40) / Tests 684 passed (684)** |
| `npx tsc -p server --noEmit` | **exit 0** |
| Bramka DB bez `RUN_DB_TESTS`/`MOCK_DB`/`DATABASE_URL`, `tenantMatrix.pg.test.ts` | **Test Files 1 skipped (1) / Tests 24 skipped (24)** — nigdy `passed` |

### 8.3 Uwaga o punkcie odniesienia z briefu

Brief podawał punkt odniesienia **30 plików / 416 testów** dla `src/services/finance/canonical` — dokładnie zgadza się z powyższym pomiarem (te 30/416 już zawierają w sobie 4 pliki W9 / 46 testów jako podzbiór, nie jako dodatek — potwierdzone: uruchomienie samych 4 plików W9 daje 46/46, a uruchomienie całego katalogu daje 416/416 z identycznym printem pomiarowym D1-D3b wewnątrz). Próg **osiągnięty dokładnie**.

Brief podawał też **638/638** dla `src/services/finance` z wcześniejszego raportu (`W10_TEST_ISOLATION_report.md`, 36 plików). Na tym drzewie (po scaleniu W9+W10 do `codex/finance-v3-p0tenant`, plus prace tej sesji) rzeczywisty wynik to **40 plików / 684 testy, 0 failed** — więcej plików/testów niż 36/638, bo to drzewo niesie dodatkowe testy (W9 4 pliki/46 testów) których nie było w bazie, na której liczono oryginalne 638. **100% zielono (684/684), zero regresji** — liczba bezwzględna różni się od starszego punktu odniesienia z przyczyn nie związanych z tą pracą (inny stan drzewa w chwili liczenia), nie z powodu jakiegokolwiek błędu wprowadzonego tutaj.

---

## 9. Rekomendacja bramek

**FC-01 (tenant isolation): `GO`** (zmiana z `NO-GO` w W9). Wszystkie 5 potwierdzonych naruszeń izolacji (W9-C-1 przez C-5) naprawione i zweryfikowane niezależnym odczytem fizycznym + kontrolą negatywną z realną reprodukcją czerwonego stanu. Klasa strukturalna (W9-C-7) zamknięta migracją z FK, nie punktową łatką — potwierdzone, że sam FK dodaje warstwę obrony niezależną od poprawek w serwisach (odkryte w kroku 1 kontroli negatywnej P0#2). Pozostaje: **brak RLS/`relrowsecurity`** na tabelach `finance*`/`compute*` (EM-9 z oryginalnego W9 raportu) — izolacja nadal wyłącznie aplikacyjna+FK, nie ma dolnej warstwy bazy danych jako ostatniej linii obrony dla przyszłych, jeszcze nienapisanych zapytań. To NIE jest w zakresie tego zadania (zadanie = naprawić 6 konkretnych defektów + klasę strukturalną, nie wdrożyć RLS) i zostaje jako rekomendacja na przyszłość, nie jako blocker tego GO.

**FC-11 (performance/operations): bez zmian, nadal `EVIDENCE_MISSING`** — ta praca nie dotykała pomiaru wydajności ani kolejki zadań (reaper/heartbeat/kill-switch/worker loop, EM-1 do EM-8 z oryginalnego raportu W9) — poza zakresem tego zadania.

---

## 10. `EVIDENCE_MISSING` / luki uczciwie zgłoszone

- **RLS na tabelach finance*/compute*** — nie wdrożone (poza zakresem tej naprawy; patrz §9).
- **W9-B-1/W9-B-2** (księgowanie `cancelJob`/ignorowany wynik `completeJobSuccess` w 3 z 4 serwisów) — z oryginalnego raportu W9, **nie w zakresie tego zadania** (dotyczy kolejki zadań/rachunkowości prób, nie granicy tenanta), nie dotknięte.
- **EM-1 do EM-8** (reaper/heartbeat/kill-switch/worker loop/SLO/dashboardy) — jak wyżej, poza zakresem.
- **Migracja W9-C-7 nie była testowana na bazie z rzeczywistymi, potencjalnie niespójnymi danymi** (np. demo/staging) — testowana wyłącznie na świeżej efemerycznej bazie (zero wierszy przed migracją) i na jednej celowo zabrudzonej bazie podczas kontroli negatywnej (którą następnie zniszczono i odtworzono, właśnie DLATEGO że retro-fit FK na niespójne dane nie przechodzi — to jest oczekiwane i bezpieczne zachowanie, nie luka, ale oznacza że rzeczywiste zastosowanie tej migracji na populated demo/staging wymagałoby najpierw audytu/czyszczenia istniejących niespójnych wierszy, czego ten pakiet nie wykonał i nie miał w zakresie robić — zakaz połączeń ze staging/demo/produkcją w briefie).
- **`finance_valuation_cases` pozostaje bez złożonego FK** — świadoma, udokumentowana decyzja (§3.2), nie przeoczenie, ale odnotowana tu wprost jako odstępstwo od dosłownej listy 7 tabel z briefu.

Wszystko inne w zakresie tego zadania ma dowód fizyczny powyżej — nic nie zaokrąglono w górę.
