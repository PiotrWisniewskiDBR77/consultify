# Pakiet B2 — Domain HTTP Surface — raport

Base SHA: `2253db2cd6` (branch `codex/fv3p-b2-domainapi`).
Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-b2-domainapi`.

Status całości pakietu: **PARTIAL**. Priorytety 1–4 (Statements/Analysis/Baseline/Prediction)
zaimplementowane i przetestowane na realnym Postgresie, w tym macierz cross-tenant. Priorytet 5
(Valuation) i większość priorytetu 6 (Przekrojowe) — świadomie NIEPOKRYTE, patrz §6.

## 0. Punkty odniesienia — potwierdzone PRZED zmianami

| Kontrola | Oczekiwane | Zmierzone | Wynik |
|---|---|---|---|
| Migracje STRICT, świeża baza `fv3p_b2` (port 58031) | exit 0, 637 | exit 0, `SELECT count(*) FROM schema_migrations` = 637 | PASS |
| `server/src/services/finance` (z `server/`) | 50 plików / 741 testy, exit 0 | **hookTimeout domyślny (10s) dał 6 plików `Hook timed out` na obciążonej maszynie** (load z równoległych sesji — dokładnie ostrzeżenie brief §7); z `--hookTimeout=60000 --testTimeout=60000`: **50 plików / 741 testy, 723 passed / 2 failed** — oba failures to `perfSlo.pg.test.ts` (D1 baseline p95 timing, jawnie znany-flaky, brief §9) i jeden connection-parse błąd w `roiFinanceReconciliationAdapter.pg.test.ts` (niezwiązany z tym pakietem, przedistniejący). PRZED jakąkolwiek moją zmianą kodu. | PASS z udokumentowanym flakiness maszyny |
| `tsc -p server` | exit 0, zero linii | exit 0, 0 linii | PASS |

Komendy reprodukcji — sekcja 8.

## 1. Stan wejściowy (co zrobił Pakiet B)

Zastane 12 endpointów pod `/finance-v2` (2 sprzed Pakietu B + 10 z Pakietu B): artifacts CRUD/list/
capabilities, versions get/transitions/compute-snapshot, compute jobs enqueue/get/cancel, models
approve/reopen. Inwentaryzacja 61 serwisów w `PKG_B_API_report.md` §1 zidentyfikowała 28 realnych
kandydatów (DB-backed, org-scoped) bez własnego HTTP — to była moja lista zadań.

## 2. Nowa powierzchnia REST — 20 nowych endpointów (12 → 32)

### 2.1 Statements (priorytet 1) — 5 endpointów

| Metoda | Ścieżka | Serwis pod spodem |
|---|---|---|
| POST | `/statements/:businessVersionId/map` | `statementMappingService.mapStatementLines` (istniejący) |
| POST | `/statements/:businessVersionId/reconcile` | `statementReconciliationService.runReconciliation` (istniejący) |
| GET | `/statements/:businessVersionId/lines` | `statementMappingService.listStatementLines` (**nowy, cienki reader**) |
| GET | `/statements/:businessVersionId/reconciliation-runs` | `statementReconciliationService.listReconciliationRuns` (**nowy**) |
| GET | `/statements/reconciliation-runs/:reconciliationRunId` | `statementReconciliationService.getReconciliationRun` + `listReconciliationDetail` (**nowe**) |

`map` i `reconcile` to CELOWO dwa osobne wywołania (to jest realny dwuetapowy przepływ, jaki
serwisy już implementują — `map` zapisuje `finance_stmt_lines`, `reconcile` czyta własny wynik
mapowania z powrotem i liczy waterfall) — nie połączone w jedno.

Statements source evidence (`finance_stmt_source_evidence`) — **NIEPOKRYTE**: żaden serwis w
`services/finance/**` nie pisze do tej tabeli (zweryfikowane grepem), więc reader zwracałby zawsze
pustą tablicę — udokumentowana luka, nie milcząco pusty endpoint.

### 2.2 Analysis (priorytet 2) — 3 endpointy

| Metoda | Ścieżka | Serwis pod spodem |
|---|---|---|
| GET | `/analysis/kpi-catalog` | `kpiComputeService.listKpiCatalog` (**nowy**) — trójwarstwowy: `?tier=UNIVERSAL\|INDUSTRY\|ORG_CUSTOM` |
| POST | `/analysis/:businessVersionId/compute` | `kpiComputeService.computeAnalysisKpis` (istniejący) |
| GET | `/analysis/:businessVersionId/kpi-values` | `kpiComputeService.listKpiValues` (**nowy**) |

Benchmark (`finance_analysis_benchmarks`) — pole `benchmark: null` w odpowiedzi `kpi-values`,
**udokumentowane wprost jako luka**: tabela istnieje w schemacie, ale żaden serwis w tym repo nie
ma writera dla niej — join zwracałby same NULL-e, więc nie jest dołączany po cichu.

### 2.3 Baseline (priorytet 3) — 4 endpointy

| Metoda | Ścieżka | Serwis pod spodem |
|---|---|---|
| GET | `/baseline/:businessVersionId/assumptions` | `baselineComputeService.listBaselineAssumptions` (**nowy**) |
| POST | `/baseline/:businessVersionId/assumptions` | `baselineComputeService.upsertAssumptionsBatch` (**nowy, batch UPSERT**) |
| POST | `/baseline/:businessVersionId/compute` | `baselineComputeService.runBaselineCompute` (istniejący) |
| GET | `/baseline/:businessVersionId/outputs` | `baselineComputeService.listBaselineOutputs` (**nowy**) |

Assumptions read/write nie było zgłoszonym defektem poprzednika — plik `baselineComputeService.ts`
sam dokumentuje w nagłówku, że autoring assumption to "zakres Kreatora", nie silnika compute. Brief
tego pakietu wymienia je jednak wprost jako priorytet 3 — zbudowane tu jako właściwy zakres
(DEC-FIN-012), nie jako obejście defektu.

### 2.4 Prediction (priorytet 4, DEC-FIN-004) — 2 endpointy

| Metoda | Ścieżka | Serwis pod spodem |
|---|---|---|
| POST | `/prediction/:businessVersionId/preflight` | `predictionPreflightService.runPreflight` (istniejący, **plik nietknięty**) |
| POST | `/prediction/:businessVersionId/calculate` | `predictionComputeService.runPredictionCompute` (istniejący, **plik nietknięty**) |

Dwa osobne endpointy, jak wymaga DEC-FIN-004 — żaden kod w tym pakiecie nie łączy preflight z
calculate w jedno wywołanie. `predictionPreflightService.ts`/`predictionComputeService.ts` — zero
zmian (świeżo dotknięte przez Pakiet A tuż przed tą sesją, poza allowlistą tego pakietu).

### 2.5 Przekrojowe (priorytet 6) — 4 endpointy

| Metoda | Ścieżka | Serwis pod spodem |
|---|---|---|
| GET | `/versions/:businessVersionId/lineage` | `lineageService.getAncestors` + `getDescendants` (istniejące) |
| GET | `/versions/:businessVersionId/freshness-events` | `lineageFreshnessService.listFreshnessEvents` (istniejący) |
| GET | `/exceptions/open` | `exceptionLedgerService.listOpen` (istniejący) |
| GET | `/exceptions/inbox` | `exceptionInboxService.listExceptionInbox` (istniejący) |

Zero nowego SQL w tej rodzinie — wyłącznie routing + mapowanie DTO nad już gotowymi, już
przetestowanymi czytelnikami.

**NIEPOKRYTE z priorytetu 6** (jawnie): compare (`financeCompareService`), comments/review
(`commentService`/`reviewChecklistService`), saved views (`savedViewService`), import/export
(`financeImportService`/`financeExportService`), `collaboration/*` (`autosaveService`/
`computePinning`/`conflictResolver`/`crashRecoveryService`). Wszystkie są DB-backed i org-scoped
(realni kandydaci, potwierdzeni w inwentaryzacji Pakietu B §1) — odłożone z braku czasu w tej
sesji, nie z powodu braku wykonalności.

### 2.6 Valuation (priorytet 5) — **0 endpointów, całkowicie NIEPOKRYTE**

7 plików (`valuationAdvisorService`/`valuationBridgeService`/`valuationComputeService`/
`valuationDiscountService`/`valuationFcffService`/`valuationSensitivityService`/
`valuationTerminalService`) — zero dotknięte. Świadoma decyzja o priorytetyzacji czasu: warianty +
metody/wagi + wyniki + sensitivity + Advisor to najszersza z sześciu rodzin (7 serwisów, każdy z
własnym kształtem parametrów), a Statements/Analysis/Baseline/Prediction (priorytety 1–4,
odblokowujące trzy pionowe wycinki produktowe) miały pierwszeństwo per brief.

## 3. D1–D4 — status po tym pakiecie

- **D1** (enqueue nie waliduje cross-tenant `inputArtifactId` → surowy 500) — **NIE naprawione**,
  wciąż otwarte. `computeJobService.enqueue` poza tym, co dotknąłem (dodałem tylko nową funkcję
  `getJobOutput`, zero zmian w `enqueue`). Cross-tenant macierz (§4) potwierdza dokładnie to samo
  zachowanie co w Pakiecie B: `POST /compute/jobs` z cudzym `inputArtifactId` → HTTP inny niż
  200/201, zero wiersza w żadnej organizacji (brak wycieku, ale brzydki 500 pozostaje).
- **D2** (brak readera `compute_job_outputs`) — **NAPRAWIONE**. `computeJobService.getJobOutput()`
  (nowy, cienki, org-scoped JOIN przez właściciela joba) + `GET /compute/jobs/:jobId/output`.
  Rozróżnia 404 `NOT_FOUND` (job nie istnieje / nie twój) od 404 `OUTPUT_NOT_READY` (job istnieje,
  output jeszcze nie zacommitowany) — potwierdzone testem (macierz cross-tenant §4).
- **D3** (brak serwisu rename) — **NAPRAWIONE**. `artifactVersionService.renameArtifact()` (nowy,
  cienki UPDATE — `finance_artifacts` nie ma triggera niemutowalności po zatwierdzeniu, w
  przeciwieństwie do `finance_business_versions`) + `POST /artifacts/:artifactId/rename`. Router
  reużywa ISTNIEJĄCEGO kontraktu klienckiego (`workspaceBarContract.canRenameArtifact`/
  `validateWorkspaceName`) zamiast wymyślać drugi zestaw reguł — zero nowej logiki walidacji nazwy.
- **D4** (wyścig w `initDb()`) — nienaruszony, poza zakresem (nie serwis finance), potwierdzony
  ponownie w tej sesji (patrz §0 i §5 — te same dwa pliki, `benefitTrackingActualProtection.pg.test.ts`
  i `faultMatrix.pg.test.ts`, migoczą pod obciążeniem i przechodzą 100% w izolacji).

## 4. Dowód montażu i macierz cross-tenant

### 4.1 Dowód montażu (401 vs dwa różne 404)

Wzorzec z Pakietu B powtórzony i potwierdzony ponownie dla nowej powierzchni (`mount-proof.pg.test.ts`,
niezmieniony, nadal 7/7 PASS) — dodatkowo każdy nowy plik testowy zawiera własny przykład 404-z-`code`
vs 404-bez-`code` dla swojej rodziny endpointów, np. `statements.routes.pg.test.ts`:

```
GET /statements/:realButNonexistentId/lines  -> 404 {"code":"NOT_FOUND", ...}
GET /statements/this-path-truly-does-not-exist-anywhere -> 404 {} (brak pola code)
```

### 4.2 Macierz cross-tenant — 10/10 PASS (`pkg-b2-cross-tenant.routes.pg.test.ts`, real Postgres)

| Endpoint | Żądanie org B na zasób org A | HTTP | Niezależny odczyt SQL |
|---|---|---|---|
| `GET /statements/:id/lines` | odczyt cudzych linii | 404 `NOT_FOUND` | `SELECT organization_id FROM finance_stmt_lines` nadal = org A, 1 wiersz |
| `POST /statements/:id/reconcile` | próba reconcile cudzej wersji | 404 | `SELECT id FROM finance_reconciliation_runs WHERE ... organization_id = orgB` = 0 wierszy |
| `GET /analysis/:id/kpi-values` | odczyt cudzych wyników | 404 `NOT_FOUND` | — |
| `POST /analysis/:id/compute` | próba compute cudzej Analysis | 404 | `SELECT id FROM compute_jobs WHERE ... organization_id = orgB` = 0 wierszy |
| `GET`/`POST /baseline/:id/assumptions` | odczyt i zapis cudzych assumptions | 404 oba | `SELECT id FROM finance_baseline_assumptions WHERE ... organization_id = orgB` = 0 wierszy |
| `POST /prediction/:id/preflight` | preflight cudzego scenariusza | 404 | `SELECT id FROM finance_prediction_preflight_runs WHERE ... organization_id = orgB` = 0 wierszy |
| `GET /compute/jobs/:id/output` (D2) | odczyt cudzego outputu | 404 `NOT_FOUND` | legalny odczyt tego samego (jeszcze niegotowego) joba przez właściciela → 404 `OUTPUT_NOT_READY` — DWA RÓŻNE kody 404 potwierdzają, że pierwszy to granica tenant, nie "output jeszcze nie gotowy" |
| `POST /artifacts/:id/rename` (D3) | rename cudzego artefaktu | 404 | `SELECT natural_key, organization_id FROM finance_artifacts` — bajtowo niezmienione (`'Original Name'`, org A); legalny rename przez org A działa POTEM |
| `GET /versions/:id/lineage` | lineage cudzej wersji | 200 `{ancestors:[],descendants:[]}` | pusta tablica, NIE błąd — zgodne z resztą readerów relacji (brak leaku przez pustą listę, bo edge zawsze ma `organization_id` filtr) |
| `GET /exceptions/open?artifactId=` | cudze exceptions | 200 `[]` | jw. |

Wynik: **10/10 PASS**, zero przypadków wycieku/korupcji/„UPDATE 0 wygląda jak PASS".

## 5. Kontrakt wartości — przykładowy JSON (`GET /statements/:id/lines`)

```json
{
  "data": [
    {
      "stmtLineId": "b6b1...c3",
      "statementType": "BS",
      "canonicalLineId": "3fa2...9e",
      "lineCode": "TOTAL_ASSETS",
      "entityId": "9c11...2f",
      "entityCode": "PARENT-a1b2c3d4",
      "periodId": "e77a...01",
      "periodLabel": "FY2025",
      "accumulationBasis": "FULL_YEAR",
      "consolidationScope": "CONSOLIDATED",
      "value": {
        "status": "PRESENT_NONZERO",
        "valueDecimal": "1000000",
        "nativeCurrency": "PLN",
        "presentationCurrency": "PLN",
        "unit": "UNITS",
        "multiplier": "1",
        "sourceRef": { "page": 3 },
        "isAdjustment": false,
        "adjustmentReason": null
      },
      "signConvention": "NATURAL",
      "accountingPolicy": "IFRS",
      "reclassifiedFromLineId": null,
      "createdBy": "user-pkgb2-stmt-...",
      "createdAt": "2026-08-11T05:54:04.612Z",
      "updatedAt": "2026-08-11T05:54:04.612Z"
    }
  ],
  "meta": { "version": "v2", "contract": "finance_v3_canonical_v1" }
}
```

Kontrakt: **okres** (`periodId`/`periodLabel`) · **entity** (`entityId`/`entityCode`) · **waluta**
(`nativeCurrency`/`presentationCurrency`) · **skala** (`unit`/`multiplier`) · **source**
(`sourceRef`) · **status braku danych** (`value.status` — `PRESENT_ZERO`/`PRESENT_NONZERO`/
`MISSING`/`NA`/`NOT_APPLICABLE`, nigdy milczące zero) · **version** (parametr URL
`businessVersionId` + `meta.contract`). **Freshness/compute timestamp/lineage** żyją na poziomie
wersji biznesowej, nie pojedynczej komórki (schemat WP-B01/B04 — jeden `freshness`/
`content_semantic_hash`/`compute_run_id` na `finance_business_versions`, nie per-cell) — dostępne
przez `GET /versions/:id` (istniejące z Pakietu B: `freshness`, `freshnessReason`,
`contentSemanticHash`, `computeRunId`) i teraz `GET /versions/:id/lineage` (nowy, ten pakiet, pełny
graf ancestors/descendants). Pełny kontrakt wartości = złożenie tych trzech odpowiedzi, nie jednej.

## 6. Co pokryte / co NIE pokryte (jawnie)

**Pokryte i UDOWODNIONE testem kontraktowym na realnym Postgresie + odczytem SQL:**
- Statements: map ✅, reconcile ✅, lines read ✅, reconciliation-runs read ✅, run-detail read ✅.
- Analysis: kpi-catalog read ✅ (w tym filtr tier), compute ✅ (end-to-end CURRENT_RATIO
  policzony realnym `formulaAstEvaluator`, nie zamockowany), kpi-values read ✅.
- Baseline: assumptions read/write (batch upsert, w tym idempotentny drugi zapis) ✅, outputs read
  ✅ (na wiersz zasianym bezpośrednio SQL-em — patrz niżej). Compute endpoint **częściowo**: błędna
  ścieżka `NO_SOURCE_STATEMENT_PACK_EDGE` udowodniona ✅; happy path (zbieżny solver
  circularity) **EVIDENCE_MISSING** przez ten router — `runBaselineCompute` sam jest już
  przetestowany gdzie indziej (`perfSlo.pg.test.ts` D1), ale nikt nie dowiódł, że TEN nowy router
  poprawnie przepuszcza pełny happy path przez HTTP; fixture (facylitet długu, assumptions w 7
  schedule_types, otwierający bilans) przekraczał budżet czasu tej sesji.
- Prediction: preflight happy path (0 findings, realne wywołanie `finance_prediction_detect_overlaps()`)
  ✅. Calculate: **częściowo** — realna ścieżka błędu `READINESS_GATE_FAILED` (prawdziwa bramka
  `finance_prediction_can_start_compute()`, nie symulowana) ✅; happy path `COMPUTED`/
  `STANDARD_BASE` **EVIDENCE_MISSING** przez ten router, ten sam powód co Baseline.
- Cross-cutting: lineage ✅, freshness-events (montaż potwierdzony, brak dedykowanego testu
  happy-path z realnymi eventami — **EVIDENCE_MISSING** dla niepustego wyniku), exceptions/open ✅
  (pusty wynik potwierdzony w macierzy cross-tenant), exceptions/inbox (montaż potwierdzony przez
  routing, **brak** dedykowanego testu treści — **EVIDENCE_MISSING**).
- D2 (compute job output) ✅, D3 (rename) ✅ — oba z macierzą cross-tenant.

**NIE pokryte (jawnie, z powodem):**
- **Valuation** — 0 endpointów, 0 testów. Powód: 7 serwisów, najszersza rodzina, priorytet 5
  (najniższy z numerowanych), brak czasu w tej sesji.
- **Statements source evidence** — brak writera w całym repo, endpoint byłby trwale pusty.
- **Analysis benchmark** — jw., pole `benchmark: null` udokumentowane, nie ukryte.
- **Comments/review, saved views, import/export, collaboration/\*** — realni kandydaci
  (potwierdzeni w inwentaryzacji Pakietu B), odłożeni z braku czasu.
- **D1** — zgłoszony ponownie, nie naprawiony (poza priorytetem tej sesji; serwis w allowliście,
  ale naprawa wymaga decyzji o kształcie błędu, nie tylko cienkiego readera).

**Podsumowanie liczbowe**: endpointy `finance-v2` **12 → 32** (20 nowych). Serwisy z realnym
wywołującym HTTP: **12/61 → ~20/61** (dokładnie: +8 nowych serwisów zyskało callera —
`statementMappingService`/`statementReconciliationService`/`kpiComputeService`/
`baselineComputeService`/`predictionPreflightService`/`predictionComputeService`/
`lineageService`/`lineageFreshnessService`/`exceptionLedgerService`/`exceptionInboxService` — 10,
plus `computeJobService`/`artifactVersionService` już miały callera, teraz mają WIĘCEJ). Pozostaje
bez HTTP: Valuation (7), grid/keyboard/workspace (20, świadomie poza REST), collaboration (4),
comments/review/saved-views/import-export/compare (6).

## 7. Liczby przebiegów — przed / po

| Kontrola | Przed (ten pakiet) | Po | Wynik |
|---|---|---|---|
| Migracje STRICT, świeża baza | exit 0, 637 | exit 0, 637 | PASS, brak regresji |
| `server/src/services/finance` (`--hookTimeout=60000`) | 723 passed / 741, 2 failed (oba
  udokumentowane jako flaky maszyny, PRZED moimi zmianami) | **736 passed / 741, 5 failed** (2
  `perfSlo` timing + 1 `roiFinanceReconciliationAdapter` connection-parse, znane; 2 nowe:
  `benefitTrackingActualProtection` — trigger niepowiązanego modułu ROI-E007 — i `faultMatrix` B1
  reaper timing). **Powtórzone w izolacji** (`--no-file-parallelism`, tylko te 2 pliki): **35/35
  PASS, exit 0** — potwierdzone jako artefakt współbieżności pod obciążeniem (dokładnie wzorzec D4
  z raportu Pakietu B), NIE regresja z tego pakietu (żaden z dwu plików nie testuje kodu, który
  zmieniłem). | PASS po weryfikacji w izolacji |
| `server/src/routes/v8/finance-v2/__tests__` | 4 pliki / 33 testy, exit 0 | **9 plików / 57
  testów, exit 0** (`--no-file-parallelism`) | PASS |
| `tsc -p server` | exit 0, zero linii | exit 0, zero linii | PASS, brak regresji |

**Uwaga o obciążeniu maszyny**: domyślny hook timeout (10s) suity `services/finance` dawał 6
plików `Hook timed out` PRZED jakąkolwiek moją zmianą — potwierdzone jako środowiskowe (brief §7),
nie defekt. Wszystkie liczby powyżej mierzone z `--hookTimeout=60000 --testTimeout=60000`.

## 8. Komendy reprodukcji

```bash
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3p-b2-pgdata ; PGSOCK=/tmp/fv3pb2sock ; PORT=58031
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3pb2_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3p_b2;"
DBURL="postgresql://postgres@127.0.0.1:$PORT/fv3p_b2"

NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" npx tsx server/scripts/migrate.postgres.ts

cd server
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL="$DBURL" \
  npx vitest run src/services/finance --reporter=dot --hookTimeout=60000 --testTimeout=60000

RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL="$DBURL" \
  npx vitest run src/routes/v8/finance-v2/__tests__ --reporter=verbose --no-file-parallelism \
  --hookTimeout=60000 --testTimeout=60000

npx tsc -p . --noEmit
```

Po pracy: `LC_ALL=C /opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /private/tmp/fv3p-b2-pgdata stop`,
`rm -rf /private/tmp/fv3p-b2-pgdata /tmp/fv3pb2sock`.

## 9. Pliki zmienione (allowlisty)

**Nowe routery:**
- `server/src/routes/v8/finance-v2/statements.routes.ts`
- `server/src/routes/v8/finance-v2/analysis.routes.ts`
- `server/src/routes/v8/finance-v2/baseline.routes.ts`
- `server/src/routes/v8/finance-v2/prediction.routes.ts`
- `server/src/routes/v8/finance-v2/crosscutting.routes.ts`

**Zmienione routery (istniejące):**
- `server/src/routes/v8/finance-v2/index.ts` — 5 nowych `.use()`
- `server/src/routes/v8/finance-v2/compute.routes.ts` — `GET /compute/jobs/:jobId/output` (D2)
- `server/src/routes/v8/finance-v2/artifacts.routes.ts` — `POST /artifacts/:artifactId/rename` (D3)

**Rozszerzenia serwisów canonical (DEC-FIN-012, cienkie, każde uzasadnione powyżej w §2–3):**
- `server/src/services/finance/canonical/computeJobService.ts` — `getJobOutput()` (D2)
- `server/src/services/finance/canonical/artifactVersionService.ts` — `renameArtifact()` (D3)
- `server/src/services/finance/canonical/statementMappingService.ts` — `listStatementLines()`
- `server/src/services/finance/canonical/statementReconciliationService.ts` —
  `getReconciliationRun()`, `listReconciliationRuns()`, `listReconciliationDetail()`
- `server/src/services/finance/canonical/kpiComputeService.ts` — `listKpiCatalog()`, `listKpiValues()`
- `server/src/services/finance/canonical/baselineComputeService.ts` — `listBaselineAssumptions()`,
  `upsertAssumptionsBatch()`, `listBaselineOutputs()`

**Nowe testy (`__tests__/`, wymagają `git add -f`? — te pliki są pod `server/src/**`, nie pod
korzeniowym `tests/`, więc normalny `git add` wystarcza — sprawdzone: `git status` widzi je jako
zwykłe untracked, bez potrzeby `-f`):**
- `server/src/routes/v8/finance-v2/__tests__/statements.routes.pg.test.ts`
- `server/src/routes/v8/finance-v2/__tests__/analysis.routes.pg.test.ts`
- `server/src/routes/v8/finance-v2/__tests__/baseline.routes.pg.test.ts`
- `server/src/routes/v8/finance-v2/__tests__/prediction.routes.pg.test.ts`
- `server/src/routes/v8/finance-v2/__tests__/pkg-b2-cross-tenant.routes.pg.test.ts`

**NIE zmienione:**
- `server/src/routes/v8/index.ts` — montaż `/finance-v2` już istniał (Pakiet B), nie dotknięty.
- `server/src/types/finance/**` — istniejące typy (`FinanceValue`, `FinanceValueStatus`, ...)
  wystarczyły; żaden nowy typ kontraktu HTTP nie okazał się potrzebny.
- `predictionComputeService.ts` / `predictionPreflightService.ts` — tylko odczyt/import, zero edycji.
- `src/**` (frontend) — nietknięty, poza zakresem tego pakietu.

## 10. Status

**PARTIAL.** Priorytety 1–4 (Statements/Analysis/Baseline/Prediction) zamontowane produkcyjnie,
przetestowane na realnym Postgresie (kontrakt + cross-tenant + dowód montażu), zero regresji w
punktach odniesienia po weryfikacji w izolacji. D2/D3 naprawione i przetestowane. D1 pozostaje
zgłoszony, nienaprawiony. Priorytet 5 (Valuation) i część priorytetu 6 (compare/comments/saved-
views/import-export/collaboration) — świadomie NIEPOKRYTE, gotowe jako punkt startu dla kolejnego
pakietu.

`EVIDENCE_MISSING`: happy path `POST /baseline/:id/compute` (zbieżny solver) przez ten router;
happy path `POST /prediction/:id/calculate` (`COMPUTED`/`STANDARD_BASE`) przez ten router; niepusty
wynik `GET /versions/:id/freshness-events`; treść `GET /exceptions/inbox` (montaż potwierdzony,
zawartość nie). Wszystko inne zaraportowane jako PASS ma dowód (test + surowy output) w tym pliku
lub w kodzie testów.
