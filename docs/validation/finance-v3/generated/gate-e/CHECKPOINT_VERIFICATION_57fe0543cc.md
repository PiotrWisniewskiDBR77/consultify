# Checkpoint Verification — 57fe0543cc

Zadanie: wyłącznie pomiarowe (TRYB ZAMROŻENIA). Zero zmian w kodzie produkcyjnym.

- Worktree: `/Users/piotrwisniewski/consultify-wt/fv3-product`
- Gałąź: `codex/finance-v3-complete-product-integration`
- HEAD kodu (potwierdzony na starcie i na końcu): `57fe0543cc2b8a026d137451a65b18da67d8bd1e`
  (na końcu sesji `HEAD` gałęzi jest dwa commity DALEJ — `930151fce4` — ale to WYŁĄCZNIE
  commity tego raportu (`docs/validation/finance-v3/generated/gate-e/**`); potwierdzone:
  `git diff --stat 57fe0543cc..HEAD -- . ':!docs/validation/finance-v3/generated/gate-e/**'`
  jest pusty. Kod mierzony w tym raporcie to dokładnie `57fe0543cc2b8a026d137451a65b18da67d8bd1e`.)
- Baseline sesji: `ee5736a5a62ebd19442ed63e897c0bf890102ab6`
- `git rev-list --left-right --count ee5736a5a6...57fe0543cc` → `0  71` (0 commitów za baseline,
  71 commitów ponad baseline — HEAD jest potomkiem baseline, brak rozjazdu)
- Data pomiaru: 2026-08-12, sesja ciągła ok. 21:29–22:05 (Europe/Warsaw, maszyna lokalna)

Status raportu: **KOMPLETNY** — wszystkie 12 punktów zmierzone. Zero `EVIDENCE_MISSING`.

---

## 1. Testy jednostkowe i komponentowe (Finance/Economics)

Zakres złożony z dwóch środowisk (frontend = korzeń repo, backend = `server/`), bo `Finance`/
`Economics` mają kod po obu stronach.

### 1a. Frontend (korzeń repo, vitest, jsdom) — 155 plików

Zakres: `src/components/Finance/**/__tests__`, `src/components/Economics/**/__tests__`,
`src/hooks/__tests__/*Finance*`, `src/services/api/__tests__/*finance*`,
`src/services/api/v8/__tests__/client.test.ts`, `tests/unit/finance/**`,
`tests/unit/backend/economics*/**`, `tests/unit/backend/{financeBoundaryMath,v4-smoke/r1-finance,
scripts/financeImportTarget}`, `tests/unit/services/v8-finance-api.test.ts`,
`tests/unit/results/{financeLinkService,resultsFinanceReconciliationService.postmortem}.test.ts`.

**Komenda:** `VITEST_HEAP_MB=8192 npx vitest run <155 plików> --maxWorkers=1 --maxConcurrency=2 --reporter=verbose`
**Kod wyjścia:** `1`
**Czas trwania:** 222 s (mierzone `date +%s` przed/po uruchomienie w tle, odczyt kodu z pliku, nie z potoku)
**SHA:** `57fe0543cc2b8a026d137451a65b18da67d8bd1e`

**Wynik:** `152/155` plików PASS, `1587/1593` testów PASS, **6 testów FAIL w 3 plikach**:

| Plik | Testy FAIL | Dotknięty przez tę gałąź? | Werdykt |
|---|---|---|---|
| `tests/unit/finance/financeFallbackGating.test.ts` | 2 | NIE — ostatni commit dotykający ten plik i `src/utils/betaAccess.ts` to `aa3d6e4d2e`, sprzed baseline `ee5736a5a6`; zero commitów tej gałęzi (`ee5736a5a6..HEAD`) dotyka `src/utils/betaAccess.ts` | **PRZEDISTNIEJĄCA** (MODULE_ECONOMICS jest `'closed'` w kodzie, test oczekuje `'open'` — dryf konfiguracji menu, niezwiązany z Finance v3) |
| `tests/unit/results/resultsFinanceReconciliationService.postmortem.test.ts` | 3 | NIE — ostatni commit dotykający ten plik i `server/src/services/v8/resultsFinanceReconciliationService.ts` to `a6eb619026`, sprzed baseline; zero commitów tej gałęzi dotyka ten serwis | **PRZEDISTNIEJĄCA** (postMortem wychodzi `null`/`undefined` zamiast wyliczonej wartości — defekt Results, poza zakresem tej gałęzi) |
| `tests/unit/finance/rawEnumLeakScanner.test.ts` | 1 | **TAK** — `git log -S'mountCheck.version.status' -- src/components/Finance/Prediction/PredictionWorkspace.tsx` wskazuje `2e61d2eeff` ("feat(finance-v3/id-bridge): wire FinanceHub through the bridge, fix Prediction silent-emptiness, kill raw error strings") jako commit tej gałęzi, który DODAŁ linię `{mountCheck.version.status}` | **REGRESJA W ZAKRESIE TEJ GAŁĘZI** — `PredictionWorkspace.tsx` interpoluje surowy SCREAMING_SNAKE_CASE enum (`version.status`) bezpośrednio w renderowanym tekście; scanner (też zmieniony tą gałęzią w `bd6e9f2ad5`, „widen … to all of Finance/**") to łapie. Plik/linia: `src/components/Finance/Prediction/PredictionWorkspace.tsx:250`. |

Log skondensowany: `evidence/point1-frontend-summary.txt` (podsumowanie liczbowe + pełny tekst 6
niezdanych testów ze stack trace).

### 1b. Backend (`server/`, vitest, node) — 36 plików non-DB (bez `.pg.test.ts`)

Zakres: wszystkie pliki `server/src/**/*finance*.test.ts` poza `*.pg.test.ts` (canonical, routes,
services, collaboration, workspace, keyboard, demo, scripts — pełna lista w
`evidence/point1-backend-summary.txt`).

**Uwaga metodologiczna:** przekazanie wszystkich 36 ścieżek w jednym wywołaniu `vitest run`
dawało deterministycznie `No test files found, exiting with code 1` mimo że wszystkie 36 plików
istnieją i każdy pojedynczo/w mniejszych grupach się uruchamia (potwierdzone powtórnie — nie
fluke uruchomienia, tylko limit/bug CLI vitest przy długiej liście pozycyjnych filtrów w tym
środowisku). Rozwiązanie: podział na 2 partie po 18 plików — obie uruchomiły się deterministycznie.

**Komenda (×2):** `npx vitest run <18 plików> --environment node --reporter=verbose`
**Kody wyjścia:** partia 1 = `1`, partia 2 = `0`
**Czas trwania:** partia 1 = 18 s, partia 2 = 5 s
**SHA:** `57fe0543cc2b8a026d137451a65b18da67d8bd1e`

**Wynik:** `35/36` plików PASS, `849/852` testów PASS, **3 testy FAIL w 1 pliku**:

| Plik | Testy FAIL | Dotknięty przez tę gałąź? | Werdykt |
|---|---|---|---|
| `server/src/routes/v8/__tests__/finance.routes.test.ts` (legacy V8 finance routes, NIE `finance-v2`) | 3 (extract/map zwraca 500 zamiast 200, initiatives zwraca 410 zamiast 201) | NIE — zero commitów `ee5736a5a6..HEAD` dotyka `server/src/routes/v8/finance.routes.ts` ani ten plik testowy | **PRZEDISTNIEJĄCA** — legacy V8 finance routes, poza zakresem `finance-v2`/`canonical` tej gałęzi |

Log skondensowany: `evidence/point1-backend-summary.txt`.

### Podsumowanie punktu 1

**191 plików, 2445 testów, 9 FAIL (8 przedistniejących poza zakresem gałęzi + 1 regresja w
zakresie gałęzi: `rawEnumLeakScanner.test.ts` łapiący prawdziwy raw-enum-leak w
`PredictionWorkspace.tsx:250`, wprowadzony commitem `2e61d2eeff` tej samej gałęzi).**

---

## 2. Testy kontraktowe/API/persistence — `finance-v2` + `canonical`, REALNA baza

Zakres dokładnie wg briefu: `server/src/routes/v8/finance-v2/__tests__/*.pg.test.ts` (21 plików)
+ `server/src/services/finance/canonical/__tests__/*.pg.test.ts` (28 plików) = **49 plików**.

**Uwaga metodologiczna:** identyczny problem CLI co w 1b — pełna lista 49 ścieżek w jednym
wywołaniu → `No test files found`. Podzielone na 7 partii ≤8 plików, uruchomione SEKWENCYJNIE
(nie równolegle) tym samym driver-skryptem.

**Komenda (×7, sekwencyjnie):**
```
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/checkpoint_verify \
npx vitest run <≤8 plików> --environment node --reporter=verbose --no-file-parallelism
```
**Kod wyjścia (wszystkie 7 partii):** `0`
**Czas trwania:** 50 s łącznie (7 partii sekwencyjnie)
**SHA:** `57fe0543cc2b8a026d137451a65b18da67d8bd1e`
**Baza:** `checkpoint_verify` @ `127.0.0.1:54330` (klon `fv3_template`, PG 15, lokalny, izolowany)

**Wynik: 49/49 plików PASS, 514/514 testów PASS, 0 FAIL.**

| Partia | Pliki | Testy | Wynik |
|---|---|---|---|
| a_aa | 8 | 99 | PASS |
| a_ab | 8 | 64 | PASS |
| a_ac | 5 | 36 | PASS |
| b_aa | 8 | 89 | PASS |
| b_ab | 8 | 67 | PASS |
| b_ac | 8 | 91 | PASS |
| b_ad | 4 | 68 | PASS |

Log skondensowany: `evidence/point2-financev2-canonical-realdb-summary.txt`.

## 3. Typecheck backendu — `tsc --noEmit -p server/tsconfig.json`

**Komenda:** `cd server && npx tsc --noEmit -p tsconfig.json`
**Kod wyjścia:** `0`
**Czas trwania:** 16 s
**SHA:** `57fe0543cc2b8a026d137451a65b18da67d8bd1e`
**Środowisko:** lokalny Node/TS z `server/node_modules`, brak połączenia z bazą (czysty typecheck).
**Wynik:** brak błędów — 0 linii wyjścia. Log: `evidence/point3-tsc-backend.txt` (pusty = czysto).

## 4. Typecheck frontendu — `npm run type-check`

**Komenda:** `NODE_OPTIONS=--max-old-space-size=8192 tsc --noEmit` (z korzenia repo, via `npm run type-check`)
**Kod wyjścia:** `0`
**Czas trwania:** 374 s (mierzone `date +%s` przed/po, nie przez potok — dowód pełnego przebiegu,
zgodnie z oczekiwaniem 100–300 s+ pod obciążeniem maszyny)
**SHA:** `57fe0543cc2b8a026d137451a65b18da67d8bd1e`
**Wynik:** brak błędów. Log: `evidence/point4-tsc-frontend.txt`.

## 5. Lint dla ZMIENIONYCH plików

**Zakres:** `git diff --name-only --diff-filter=ACMR ee5736a5a62ebd19442ed63e897c0bf890102ab6..HEAD`
przefiltrowane do `\.(ts|tsx|js|jsx)$` → **115 plików**. Wszystkie 115 istnieją na HEAD (zero
usuniętych/martwych ścieżek).

**Komenda:** `npx eslint --quiet <115 plików>`
**Kod wyjścia:** `1`
**Czas trwania:** 12 s
**SHA:** `57fe0543cc2b8a026d137451a65b18da67d8bd1e`

**Wynik:** `2749` błędów w `103` z 115 plików (12 plików czystych — zweryfikowane pojedynczo, bo
ESLint 9.x z `--quiet` pomija w JSON pliki z zerem pozostałych błędów, co początkowo wyglądało na
„nie polinotowane" — potwierdzone przez osobne uruchomienie na każdym z 12 plików).

Rozbicie reguł:
- `prettier/prettier`: 2712
- `simple-import-sort/imports`: 37

Zero błędów logicznych/bezpieczeństwa (np. `no-var`, `react-hooks/rules-of-hooks`,
`eqeqeq`) — wyłącznie formatowanie (prettier) i kolejność importów. Trzy najgorsze pliki:
`server/src/routes/v8/finance-v2/__tests__/compare.routes.pg.test.ts` (523),
`comments.routes.pg.test.ts` (413), `approveRbacGate.pg.test.ts` (279) — te trzy testy pg
odpowiadają za ~44% wszystkich błędów.

**Interpretacja (bez naprawy — zgodnie z trybem zamrożenia):** to dług formatowania w zakresie
zmian tej gałęzi, nie regresja logiki. Wszystkie błędy są automatycznie naprawialne przez
`eslint --fix` / `prettier --write`, ale NIE zostały naprawione w tym pomiarze.

Pełny log: `evidence/point5-lint-summary.txt` (skondensowany, z listą per-plik) — surowy log (1.3 MB)
NIE wchodzi do repo; do odtworzenia użyj dokładnej komendy powyżej.

## 6. `git diff --check ee5736a5a62ebd19442ed63e897c0bf890102ab6..HEAD`

**Komenda:** `git diff --check ee5736a5a62ebd19442ed63e897c0bf890102ab6..HEAD`
**Kod wyjścia:** `0`
**Czas trwania:** <1 s
**SHA:** `57fe0543cc2b8a026d137451a65b18da67d8bd1e`
**Wynik:** brak konfliktowych markerów, brak whitespace errors. Log: `evidence/point6-diffcheck.txt` (pusty).

## 7. realDB (zapis/odczyt)

Dowód nie jest osobnym uruchomieniem — jest wbudowany w punkt 2: WSZYSTKIE 49 plików `.pg.test.ts`
(finance-v2 + canonical) faktycznie zapisują i odczytują z prawdziwego PostgreSQL 15
(`checkpoint_verify`), zweryfikowane bezpośrednim odpytaniem bazy PO przebiegu testów:

**Komenda:**
```sql
select table_name, count(*) from information_schema.tables ... where table_name ilike '%finance%'
```
**Wynik (stan `checkpoint_verify` po punkcie 2, próbka):**

| Tabela | Wiersze |
|---|---|
| `finance_baseline_outputs` | 8224 |
| `finance_baseline_outputs_quarterly` | 2731 |
| `finance_prediction_outputs_effective` | 1504 |
| `finance_stmt_reconciliation` | 755 |
| `finance_baseline_outputs_annual` | 685 |
| `finance_stmt_lines` | 627 |
| `finance_valuation_sensitivity_cells` | 575 |
| `finance_working_revisions` | 380 |
| `finance_business_versions` | 379 |
| `finance_prediction_outputs` | 374 |

Realne dane, realne wiersze, realny PostgreSQL 15 na `127.0.0.1:54330` — nie mock, nie sqlite.
Dodatkowo `server/src/services/finance/canonical/__tests__/coldReopen.pg.test.ts` (część punktu 2,
partia `b_aa`, PASS) to wprost test zapis→zamknięcie→ponowne-otwarcie na żywej bazie (patrz też
punkt 11).

**Kod wyjścia / czas / SHA:** jak w punkcie 2 (ten sam przebieg).
**Werdykt: PASS.**

## 8. ★ Kontrola negatywna bramki bazy

Ten sam plik testowy (`server/src/services/finance/canonical/__tests__/canonicalServices.pg.test.ts`,
24 testy) uruchomiony DWA razy: raz z kompletem czterech zmiennych, raz BEZ `RUN_DB_TESTS`.

**Komenda A (z bramką):**
```
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/checkpoint_verify \
npx vitest run src/services/finance/canonical/__tests__/canonicalServices.pg.test.ts --environment node --reporter=verbose
```
**Kod wyjścia:** `0` · **Czas:** 4 s · **Wynik:** `Test Files 1 passed (1)` / `Tests 24 passed (24)`
— wszystkie 24 z markerem `✓`.

**Komenda B (bez `RUN_DB_TESTS`, tylko `MOCK_DB=false NODE_ENV=test DATABASE_URL=...`):**
```
MOCK_DB=false NODE_ENV=test \
DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/checkpoint_verify \
npx vitest run src/services/finance/canonical/__tests__/canonicalServices.pg.test.ts --environment node --reporter=verbose
```
**Kod wyjścia:** `0` · **Czas:** 2 s · **Wynik:** `Test Files 1 skipped (1)` / `Tests 24 skipped (24)`
— wszystkie 24 z markerem `↓` (skip), ZERO `✓`.

**SHA:** `57fe0543cc2b8a026d137451a65b18da67d8bd1e`

**Werdykt: PASS — bramka działa dokładnie jak udokumentowano.** Bez `RUN_DB_TESTS=1` testy są
jawnie `skipped` (kod wyjścia 0, bo vitest nie traktuje pominięcia jako błędu — ale treść wyniku,
nie kod wyjścia, jest tu dowodem), NIE `passed` po cichu. Różnica między A i B jest jakościowa
(24 zielone ptaszki kontra 24 strzałki-pominięcia), nie tylko liczbowa — wykluczone „ciche zero
testów wygląda jak sukces".

Logi: `evidence/point8-with-gate.txt`, `evidence/point8-without-gate.txt`.

## 9. ★ Autoryzacja i izolacja najemców — sondy J2/J3/J4

Każda sonda na WŁASNEJ świeżej bazie (klon `fv3_template`), żeby nie mieszać się z danymi z
punktu 2: `checkpoint_verify_j2`, `checkpoint_verify_j3`, `checkpoint_verify_j4`.

### J2 — cross-tenant matrix

**Komenda:**
```
DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/checkpoint_verify_j2 \
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
npx tsx scripts/finance-v3-audit/j2-crosstenant-probe.ts
```
**Kod wyjścia:** `0` · **Czas:** 13 s · **SHA:** `57fe0543cc2b8a026d137451a65b18da67d8bd1e`

**Wynik: `31` sond, `0 LEAKS`, `30` PASS + `1` ERR.**
Referencja z poprzedniego SHA: „J2 31 sond / 30 zablokowanych" — **dokładna zgodność** (31 sond
łącznie, 30 skutecznie zablokowanych cross-tenant, 0 wycieków w obu przebiegach). Ten 1 ERR to
`models :: approve (legit control, same org, different approver)` — sonda KONTROLNA (ten sam org,
inny approver — powinna przejść, nie test bezpieczeństwa cross-tenant) zwróciła `HTTP 422
APPROVAL_BLOCKED` zamiast oczekiwanego sukcesu. Nie jest to wyciek między najemcami (0 LEAKS),
tylko potknięcie fikstury kontrolnej — identyczna klasyfikacja jak w referencyjnym przebiegu
(„1/31 potknięcie fikstury, nie bezpieczeństwo").

Log: `evidence/point9-j2-crosstenant.txt`.

### J3 — współbieżność i wstrzykiwanie awarii

**Komendy** (z `server/`, ta sama baza `checkpoint_verify_j3` przez cały przebieg):
```
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres \
DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/checkpoint_verify_j3 \
npx tsx scripts/finance-v3-audit/j3-concurrency-probe.ts <race1..race6> 2,5,10 3   # 6×3×3=54
npx tsx scripts/finance-v3-audit/j3-concurrency-probe.ts <fault1..4> 1 3           # 4×3=12
npx tsx scripts/finance-v3-audit/j3-concurrency-probe.ts <fault5,fault6> 2,5,10 3  # 2×3×3=18
```
(Dokładna replikacja przepisu z `docs/validation/finance-v3/generated/gate-e/GATE_J_FINAL_REGRESSION_report.md`
§5, znalezionego w repo jako referencja z poprzedniego SHA.)

**Kody wyjścia:** wszystkie 12 wywołań scenariuszy = `0` (potwierdzone per-scenariusz, nie przez
potok — `EXIT[race1-compute]=0` itd., zapisane osobno do pliku)
**Czas trwania:** races 18 s, faults 5 s (54 s całkowity wallclock równoległej sesji z J2/J4)
**SHA:** `57fe0543cc2b8a026d137451a65b18da67d8bd1e`

**Wynik: `84/84` przebiegów `RESULT:` linii z `pass: true`, 0 podejrzanych (`ok:false`/
`pass:false`/`error`), zweryfikowane programowo (parsowanie JSON każdej linii `RESULT:`, nie samo
liczenie linii).**

| Scenariusz | Przebiegów | Pass |
|---|---|---|
| race1-compute | 9 | 9/9 |
| race2-approve | 9 | 9/9 |
| race3-edit-vs-compute | 9 | 9/9 |
| race4-approve-vs-stale | 9 | 9/9 |
| race5-archive-vs-finish | 9 | 9/9 |
| race6-retry-after-commit | 9 | 9/9 |
| fault1-snapshot-status | 3 | 3/3 |
| fault2-before-after-output | 3 | 3/3 |
| fault3-lease-loss | 3 | 3/3 |
| fault4-worker-restart | 3 | 3/3 |
| fault5-duplicate-enqueue | 9 | 9/9 |
| fault6-cancel-race | 9 | 9/9 |
| **RAZEM** | **84** | **84/84** |

Referencja z poprzedniego SHA: „J3 84/84" — **dokładna zgodność**.

Log: `evidence/point9-j3-concurrency-fault.txt` (173 KB, 84 linie `RESULT:` JSON).

### J4 — RBAC matrix / maker-checker / niemutowalność APPROVED

**Komenda:**
```
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/checkpoint_verify_j4 \
npx tsx scripts/finance-v3-audit/j4-rbac-probe.ts --json=/tmp/j4_results_checkpoint.json
```
**Kod wyjścia:** `0` · **Czas:** 44 s · **SHA:** `57fe0543cc2b8a026d137451a65b18da67d8bd1e`

**Wynik: `37 checks, 0 FAIL` — dokładna zgodność z referencją „J4 37/37".**

Uwaga: `server/scripts/finance-v3-audit/run_probe.sh` ma na sztywno wpisaną ścieżkę INNEGO
worktree'a (`/Users/piotrwisniewski/consultify-wt/fv3p-f-baseline/server`) i inną bazę
(`j4_rerun`) — pozostałość z wcześniejszej sesji na innym worktree. Zgodnie z zasadą „nie wchodź
w drogę" temu worktree'owi, probe uruchomiony BEZPOŚREDNIO przez `npx tsx` (skrypt jest
samowystarczalny, bez zależności od `run_probe.sh`), z identycznym rezultatem funkcjonalnym.

Log: `evidence/point9-j4-rbac.txt`.

### Podsumowanie punktu 9

J2 31/30 (1 kontrola, 0 wycieków), J3 84/84, J4 37/37 — **wszystkie trzy liczby identyczne z
referencją z poprzedniego SHA**. Zero regresji w izolacji najemców/współbieżności/RBAC.

## 10. Interakcja UI — 5 workspace'ów + 5 komponentów AP-CLIENT (w tym flagi OFF)

Dowód pochodzi z punktu 1a (ten sam przebieg, 155 plików, patrz `evidence/point1-frontend-summary.txt`
dla surowego logu) — wyodrębniony tu osobno na żądanie briefu.

**5 workspace'ów, testy `*.flag.test.tsx` (mount/OFF/ON + zero-network przy OFF):**

| Workspace | Test OFF (zero wywołań sieciowych) | Test ON |
|---|---|---|
| `BaselineWorkspace` | ✓ „renders nothing and calls zero baseline network functions" | ✓ |
| `PredictionWorkspace` | ✓ „renders nothing and calls zero Prediction network functions" (×2 warianty) | ✓ |
| `AnalysisWorkspace` | ✓ „renders nothing and calls zero of the four mount-time load functions" | ✓ |
| `ValuationWorkspace` | ✓ „renders nothing and never calls api.getValuationVariant" | ✓ |
| `StatementPackWorkspaceV2` | ✓ „renders nothing and never calls any injected fetcher" | ✓ |

Wszystkie 11 testów `.flag.test.tsx` (5×OFF + 5×ON + 1 dodatkowy wariant Prediction bez
`businessVersionId`) PASS — zero `×`.

**5 komponentów AP-CLIENT** (`FinanceCommentsPanel`, `FinanceComparePanel`,
`FinanceExportImportPanel`, `FinanceLineageNavigator`, `FinanceSavedViewsPanel`) + ich hooki flag
(`useFinanceCommentsFlag`, `useFinanceCompareFlag`, `useFinanceExportImportFlag`,
`useFinanceLineageNavigatorFlag`, `useFinanceSavedViewsFlag`): **73 testy, wszystkie PASS, zero `×`.**

Dodatkowo potwierdzone testy Focus Mode „zero dodatkowych wywołań sieciowych" dla 4 workspace'ów
(Analysis/Baseline/Prediction/StatementPackWorkspaceV2/Valuation) — wszystkie PASS.

**Kod wyjścia / czas / SHA:** jak w punkcie 1a.
**Werdykt: PASS — flaga OFF potwierdzona jako zero wywołań sieciowych w każdym z 5 workspace'ów;
5 komponentów AP-CLIENT w pełni pokryte, 0 FAIL.**

## 11. Persistence / cold reopen

Dwa niezależne dowody:

1. **Backend, realna baza:** `server/src/services/finance/canonical/__tests__/coldReopen.pg.test.ts`
   — część punktu 2 (partia `b_aa`), PASS, real PostgreSQL, testuje `FC-05.8 / FC-07.9 / FC-12.4`
   (zamknięcie i ponowne otwarcie wersji na żywej bazie).
2. **Frontend, mock API, 3 workspace'y:** `AnalysisWorkspace.persistence.test.tsx`,
   `BaselineWorkspace.persistence.test.tsx`, `StatementPackWorkspaceV2.persistence.test.tsx` —
   część punktu 1a, wszystkie PASS, scenariusz „a committed rename is sent to the real API, and a
   cold-reopened instance shows the persisted name".

**Kod wyjścia / czas / SHA:** jak w punktach 1a i 2 (te same przebiegi).
**Werdykt: PASS.**

## 12. Migracje STRICT na świeżej bazie (BEZ `--safe`)

Baza: `checkpoint_verify_strict`, utworzona `createdb -T template0` — **zero tabel przed startem**
(potwierdzone: `select count(*) from information_schema.tables where table_schema='public'` → `0`).

**Komenda:**
```
NODE_ENV=test DB_TYPE=postgres \
DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/checkpoint_verify_strict \
npx tsx server/scripts/migrate.postgres.ts
```
(Uwaga: `db:migrate:strict` w `package.json` woła dokładnie ten sam skrypt bez `--safe` — brak
flagi to sam „strict"; `--safe` zmienia padniętą migrację w `skipped`+exit 0, tu jej NIE użyto.)
**NODE_ENV=test wymagane** — bez tego `databaseTargetResolver` odrzuca `127.0.0.1` z komunikatem
„Selected DATABASE_URL points to local host … requires the external Postgres target outside
tests" (potwierdzone: pierwsza próba bez `NODE_ENV=test` zwróciła dokładnie ten błąd, exit 1).

### Pierwsza próba (ANOMALIA — udokumentowana, nie ukryta)

**Kod wyjścia:** `1` · **Czas:** 4 s · **SHA:** `57fe0543cc2b8a026d137451a65b18da67d8bd1e`

Log urywa się w połowie listy nazw plików migracji (bez komunikatu błędu, bez stack trace) — ale
sprawdzenie stanu bazy PO tej próbie pokazało `637/637` migracji zapisanych w `schema_migrations`
i `1459` tabel — czyli migracja **faktycznie się w całości wykonała**, mimo kodu wyjścia `1` i
urwanego logu. To wygląda na crash w fazie raportowania/sprzątania PO commit wszystkich migracji
(proces działał współbieżnie z sondami J2/J3/J4 z punktu 9 — maszyna była wtedy pod obciążeniem
kilku równoległych `tsx`/`vitest` procesów). Log: `evidence/point12-migrate-strict-FIRST-ATTEMPT-anomaly.txt`.

### Druga próba — czysta powtórka na SPRZĄTNIĘTEJ bazie (definitywna)

Baza `checkpoint_verify_strict` DROPNIĘTA i utworzona od zera (`createdb -T template0`,
potwierdzone `0` tabel przed startem), uruchomiona w izolacji (bez współbieżnych sond).

**Kod wyjścia:** `0` · **Czas:** 15 s · **SHA:** `57fe0543cc2b8a026d137451a65b18da67d8bd1e`

**Wynik: `637` migracji zastosowanych (`Applying migrations: 637`, lista każdej z osobna w logu),
zakończone `✅ Postgres migrations complete`. Stan bazy po migracji: `637` wierszy w
`schema_migrations`, `1459` tabel w schemacie `public`.** Liczba tabel identyczna jak w
`checkpoint_verify` (klon `fv3_template` użyty w punktach 2/7/8/9/11) — spójność potwierdzona: baza
migrowana strict od zera daje IDENTYCZNY kształt schematu co szablon używany w pozostałych
pomiarach.

Log: `evidence/point12-migrate-strict-clean.txt`.

**Werdykt: PASS (druga, czysta próba jest autorytatywna: exit 0, 637/637, 1459 tabel).** Pierwsza
próba raportowana jawnie jako obserwowana anomalia nieodtworzona przy powtórce — zgodnie z
instrukcją „powtórz pomiar, zanim zdiagnozujesz jako regresję": powtórzona, DB w obu przypadkach
osiągnęła identyczny finalny stan (637/1459), więc to nie regresja migracji, tylko niewyjaśniona
usterka raportowania procesu przy współbieżnym obciążeniu maszyny — zasługuje na osobną obserwację,
nie blokuje tego checkpointu.

---

## Środowisko

- Baza testowa: klaster PostgreSQL 15 lokalny, `127.0.0.1:54330`, użytkownik `piotrwisniewski`.
- Utworzone dedykowane bazy dla tego runu (wszystkie posprzątane na końcu sesji, patrz niżej):
  - `checkpoint_verify` (klon `fv3_template`) — punkty 2, 7, 8, 11.
  - `checkpoint_verify_j2`, `checkpoint_verify_j3`, `checkpoint_verify_j4` (klony `fv3_template`,
    po jednej na sondę, żeby nie mieszać efektów ubocznych) — punkt 9.
  - `checkpoint_verify_strict` (utworzona z `template0`, całkowicie pusta — zero tabel na starcie
    obu prób) — punkt 12.
- **Zero połączeń do demo/staging/produkcji** — potwierdzone: KAŻDY `DATABASE_URL` użyty w tym
  pomiarze wskazuje na `127.0.0.1:54330`; żadna komenda nie ustawiała innego hosta.
- Maszyna była obciążona współbieżnymi procesami tej samej sesji (kilka `tsx`/`vitest` naraz przy
  punktach 9/12) — prawdopodobne źródło anomalii w punkcie 12 (pierwsza próba); wszystkie czasy
  trwania mierzone jawnie `date +%s` przed/po, nigdy przez potok.

### Sprzątanie na końcu

```
dropdb -h 127.0.0.1 -p 54330 -U piotrwisniewski checkpoint_verify
dropdb -h 127.0.0.1 -p 54330 -U piotrwisniewski checkpoint_verify_j2
dropdb -h 127.0.0.1 -p 54330 -U piotrwisniewski checkpoint_verify_j3
dropdb -h 127.0.0.1 -p 54330 -U piotrwisniewski checkpoint_verify_j4
dropdb -h 127.0.0.1 -p 54330 -U piotrwisniewski checkpoint_verify_strict
```
Wykonane po zapisaniu tego raportu (patrz commit końcowy) — zero rekordów testowych pozostawionych
na klastrze.

---

## Tabela zbiorcza

| # | Punkt | Wynik | Kod wyjścia | Dowód |
|---|-------|-------|-------------|-------|
| 1 | Testy jednostkowe/komponentowe Finance/Economics | **9 FAIL / 2445** (8 przedistniejące poza zakresem, 1 regresja w zakresie gałęzi: `rawEnumLeakScanner` łapiący raw-enum-leak w `PredictionWorkspace.tsx:250`, commit `2e61d2eeff`) | frontend=1, backend p1=1/p2=0 | `evidence/point1-frontend-summary.txt`, `evidence/point1-backend-summary.txt` |
| 2 | Testy kontraktowe/API/persistence (finance-v2+canonical, realDB) | **PASS 49/49 plików, 514/514 testów** | 0 (×7 partii) | `evidence/point2-financev2-canonical-realdb-summary.txt` |
| 3 | Typecheck backend | PASS | 0 | `evidence/point3-tsc-backend.txt`, 16s |
| 4 | Typecheck frontend | PASS | 0 | `evidence/point4-tsc-frontend.txt`, 374s |
| 5 | Lint zmienionych plików | FAIL (wyłącznie formatowanie) | 1 | `evidence/point5-lint-summary.txt`, 2749 błędów/103 z 115 plików, 0 błędów logiki/bezpieczeństwa |
| 6 | git diff --check | PASS | 0 | `evidence/point6-diffcheck.txt` (pusty) |
| 7 | realDB zapis/odczyt | **PASS** (dane realne w `checkpoint_verify`, np. `finance_baseline_outputs`=8224 wierszy) | 0 | patrz punkt 2 (ten sam przebieg) |
| 8 | Kontrola negatywna bramki bazy | **PASS** (z bramką: 24 `passed`; bez `RUN_DB_TESTS`: 24 `skipped`, nie `passed`) | 0/0 | `evidence/point8-with-gate.txt`, `evidence/point8-without-gate.txt` |
| 9 | Autoryzacja/izolacja najemców (J2/J3/J4) | **PASS** — J2 31/30 (0 leaks), J3 84/84, J4 37/37 — dokładna zgodność z referencją poprzedniego SHA | 0/0/0 | `evidence/point9-j2-crosstenant.txt`, `evidence/point9-j3-concurrency-fault.txt`, `evidence/point9-j4-rbac.txt` |
| 10 | Interakcja UI (5 workspace'ów + 5 AP-CLIENT, flagi OFF=zero sieci) | **PASS** — 11/11 testów flag workspace'ów, 73/73 testów AP-CLIENT | 1 (ten sam przebieg co pkt 1a) | patrz punkt 1a |
| 11 | Persistence / cold reopen | **PASS** — backend `coldReopen.pg.test.ts` + 3× frontend `.persistence.test.tsx` | 0/1 (te same przebiegi co pkt 1a/2) | patrz punkty 1a i 2 |
| 12 | Migracje STRICT na świeżej bazie | **PASS** (druga, czysta próba autorytatywna) — 637/637 migracji, 1459 tabel; pierwsza próba dała identyczny stan bazy mimo exit 1 — udokumentowana anomalia, nieodtworzona | 1 (próba 1, anomalia) → 0 (próba 2, czysta) | `evidence/point12-migrate-strict-FIRST-ATTEMPT-anomaly.txt`, `evidence/point12-migrate-strict-clean.txt` |

### EVIDENCE_MISSING

**Brak.** Wszystkie 12 punktów zmierzone bezpośrednio na `57fe0543cc2b8a026d137451a65b18da67d8bd1e`
z zapisanymi logami/dowodami w `evidence/`.

### Do uwagi integratora (bez naprawy — zgodnie z trybem zamrożenia)

1. **Regresja w zakresie gałęzi:** `src/components/Finance/Prediction/PredictionWorkspace.tsx:250`
   interpoluje surowy enum `mountCheck.version.status` w renderowanym tekście — złapane przez
   `tests/unit/finance/rawEnumLeakScanner.test.ts`, wprowadzone commitem `2e61d2eeff`.
2. **Dług formatowania:** 2749 błędów prettier/import-sort w 103/115 zmienionych plików — zero
   logiki, w pełni auto-naprawialne, ale niezrobione (`eslint --fix`).
3. **8 przedistniejących FAIL** (poza zakresem tej gałęzi, potwierdzone przez `git log` per plik):
   `financeFallbackGating.test.ts` ×2 (dryf `MODULE_ECONOMICS` w `betaAccess.ts`),
   `resultsFinanceReconciliationService.postmortem.test.ts` ×3 (defekt Results, nie Finance v3),
   `finance.routes.test.ts` ×3 (legacy V8 routes, nie `finance-v2`).
4. **Vitest CLI flake:** przy >~20-30 pozycyjnych filtrach plików w jednym wywołaniu, `vitest run`
   w tym środowisku deterministycznie zwraca „No test files found" mimo istniejących plików;
   obejście = dzielenie na mniejsze partie (zastosowane w punktach 1b i 2). Warto to zgłosić jako
   osobny, niezależny od Finance v3 problem środowiska CI/lokalnego.
5. **Anomalia migracji (punkt 12, pierwsza próba):** exit 1 z urwanym logiem mimo że baza osiągnęła
   poprawny finalny stan (637/1459) — nieodtworzona przy czystej powtórce w izolacji od
   współbieżnego obciążenia. Warta osobnej obserwacji, nie blokuje tego checkpointu.
