# Assessment / method-core migracje + pełna regresja — S4, 2026-08-13

Robotnik S4. Worktree: `/Users/piotrwisniewski/consultify-wt/s4` (gałąź `codex/asm-s4`).

- **Candidate (HEAD):** `0f4a1a53a6e00baeda3de59378cd6bf4a3fecbb4` (2026-08-13 15:23:48 +0200)
- **Baseline:** `origin/demo` = `e45904dc7940f259b9cf017c283264d5c166c9ab` (2026-08-13 14:01:34 +0200)
- `git rev-list --left-right --count origin/demo...HEAD` → `47	78` (demo ma 47 commitów, których HEAD nie ma; HEAD ma 78 commitów, których demo nie ma — spójne z programem Method Assessment Core, nie tylko z pracą tej sesji).

---

## CEL A — 7 bramek migracyjnych dla Assessment / method-core

### Zakres (ustalony grepem, nie z pamięci)

`grep -rl "method_sessions\|method_outputs\|method_packs\|..." server/migrations/*.sql` zwraca
**dokładnie te same 4 pliki**, które je tworzą — potwierdzone, że nic innego w repo nie
deklaruje ani nie konsumuje tabel `method_*`:

- `server/migrations/20260813_method_core_1_kernel.sql` — `method_packs`, `method_sessions`,
  `method_session_roles`, `method_events`, `method_evidence`, `method_teresa_previews`,
  `method_snapshots`
- `server/migrations/20260813_method_core_2_outputs.sql` — `method_outputs`, `method_findings`,
  `method_report_snapshots`, `method_initiative_drafts`
- `server/migrations/20260813_method_core_3_http_idempotency.sql` — `method_session_create_idempotency`
- `server/migrations/20260813_method_core_4_bypass_status.sql` — `ALTER TABLE` (kolumny
  `demo_bypass_active` na `method_sessions`/`method_outputs`/`method_report_snapshots`, kolumna
  `kind` na `method_report_snapshots`)

Te cztery pliki już niosą udokumentowaną historię DWÓCH defektów cichego wykluczenia (nagłówek
w każdym pliku + `docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/EVIDENCE_LEDGER.md` §G13),
znalezionych i naprawionych PRZED tą sesją:

- **G13.A** — sortowanie leksykalne plików z tą samą datą postawiło konsumenta
  (`..._http_idempotency`, FK do `method_sessions`) przed producentem (`..._kernel`). Naprawa:
  jawna numeracja `1_/2_/3_/4_`.
- **G13.B** — plik nazwany `..._demo_status.sql` był **cicho wykluczany** przez
  `isSqliteOnlyMigration()` (każda nazwa zawierająca `demo`/`seed`/`mock` = "dane demo", pomijana
  bez błędu, `exit 0`). Naprawa: zmiana nazwy na `4_bypass_status.sql`.

S4 nie musiał tych defektów naprawiać — były już naprawione. Zadanie S4: **zamienić ręczny,
jednorazowy dowód kontenerowy (G13.C, manualny `docker run` + `psql`) w automatyczny,
powtarzalny test.**

### Test

`tests/integration/method-core-migrations.realdb.test.ts` — **15 testów, wszystkie PASS**
(uruchomione realnie, nie tylko napisane — log poniżej).

**Miejsce — wybór empiryczny.** Zadanie sugerowało `server/src/**/__tests__/` lub
`tests/migration/`. Sprawdziłem obie opcje faktycznie zbierane przez vitest:
- `tests/migration/**` jest zbierane WYŁĄCZNIE przez osobny, wąski `vitest.migration.config.ts`
  — nie wchodzi do głównego przepływu (`npm run test:integration`, korzeń `vitest.config.ts`).
- `tests/integration/**/*.{test,spec}.ts` jest w `include` głównego `vitest.config.ts` ORAZ
  w `npm run test:integration` — i to jest już miejsce wszystkich siostrzanych testów
  migracyjnych tego typu (`schema-migration-completeness.realdb.test.ts`,
  `m02b-migration-runner.realdb.test.ts`, `new-migrations.test.ts`).

Wybrałem `tests/integration/` i zweryfikowałem to poleceniem `npx vitest list
tests/integration/method-core-migrations.realdb.test.ts` (bez `--config`, czyli na domyślnym
korzeniowym configu) — plik jest kolekcjonowany.

**Bazy jednorazowe.** Test NIE dotyka `consultify_asm_s4` (bazy roboczej S4) — każdy scenariusz
tworzy własną bazę `method_core_gate_<uuid>` przez `createdb`/`dropdb` (binarki
`/opt/homebrew/opt/postgresql@17/bin`, `LC_ALL=C`), z `CREATE EXTENSION IF NOT EXISTS vector;`
przed migracją, i sprząta w `afterAll` (potwierdzone `SELECT datname FROM pg_database WHERE
datname LIKE 'method_core_gate_%'` = 0 wierszy po biegu).

**Runner pod testem jest URUCHAMIANY, nie importowany.** `server/scripts/migrate.postgres.ts` ma
`main().catch(...)` na końcu modułu — import w procesie testowym uruchomiłby go natychmiast.
Test spawnuje go jako **subprocess** (`npx tsx server/scripts/migrate.postgres.ts [args]`), tak
jak robi to `npm run db:migrate:strict` naprawdę.

### Wyniki siedmiu bramek

| # | Bramka | Test(y) | Wynik |
|---|---|---|---|
| 1 | Fresh install | `Gate 1 — fresh install exits 0 and applies all 4 method_core files` | PASS — pusta baza → migracja → `exit 0`, wszystkie 4 pliki w stdout w kolejności `1→2→3→4` |
| 2 | Upgrade | `Gate 2` (4 testy: precondition, upgrade run, post-upgrade schema, dane nietknięte) | PASS — baza zbudowana z `--only <wszystko oprócz 4 plików method_core>` (lista policzona z REALNEGO `--dry-run` runnera, nie z reimplementacji filtra), potem upgrade dodaje 4 pliki, marker-organizacja przeżywa bez zmian |
| 3 | Idempotent rerun | `Gate 3 — idempotent rerun: second run is a no-op, exit 0, ledger unchanged` | PASS — drugi bieg: `Applying migrations: 0`, brak duplikatów w `schema_migrations` |
| 4 | Schema assertion | `Gate 4 — schema assertion: all 12 method_* tables exist in information_schema` | PASS — odpytanie `information_schema.tables`/`.columns`, nie założenie; potwierdzone też `demo_bypass_active` (×3 tabele) i `kind` (regresja G13.B wprost) |
| 5 | Migration ledger | `Gate 5 — migration ledger: exactly one success row per method_core file` | PASS — `schema_migrations` ma dokładnie 1 wiersz `status='success'` na plik |
| 6 | Kontrola negatywna | `Gate 6` (2 testy: reprodukcja G13.A, "control-on-the-control") | PASS — celowe pominięcie `..._1_kernel.sql` przy uruchomieniu `..._2_outputs.sql` **PADA** na `relation "method_sessions" does not exist` (dokładnie błąd z G13.A), `method_outputs` NIE powstaje (rollback całego wielo-instrukcyjnego zapytania), brak fałszywego `success` w `schema_migrations`; ta sama baza **goi się** po ponownym biegu w poprawnej kolejności |
| 7 | Brak cichego wykluczenia | `Gate 7` (4 testy, statyczne, bez bazy) | PASS — wszystkie 4 pliki leżą bezpośrednio w `server/migrations/` (nie w `never-ran/`/`ops/`); prefiks wersji to 8-cyfrowa data > 500 (heurystyka `<500` numerowanych plików ich nie dotyczy); żadna nazwa nie zawiera `demo`/`seed`/`mock`; grep po całym katalogu potwierdza, że tabele `method_*` deklarują WYŁĄCZNIE te 4 pliki |

Bramka 6 jest jednocześnie dowodem, że bramki 1-5 **potrafią wykryć** dokładnie tę klasę błędu,
którą już raz ten kod miał (G13.A) — nie tylko "przechodzą", tylko realnie łapią regresję, gdy się
ją wstrzyknie.

Uruchomienie: 15/15 PASS, ~25.7s (`npx vitest run
tests/integration/method-core-migrations.realdb.test.ts --no-file-parallelism`), zero baz
pozostawionych po sobie.

---

## CEL B — dowód, że test bazy nie kłamie (fail-closed)

### Helper

`server/src/testing/assertRealDatabase.ts` — eksportuje:
- `isRealDatabaseTestModeRequested(env)` — sam gate env (`RUN_DB_TESTS==='1' && MOCK_DB==='false'`).
- `assertRealDatabase(runner, env)` — **rzuca**, jeśli gate env nie jest spełniony ALBO realne
  zapytanie `SELECT current_database(), current_schema()` się nie powiedzie / zwróci pusty wiersz.
  Nigdy nie zwraca sygnału "skip" — jeśli suita chce zachowanie skip-gdy-brak-bazy, to decyduje o
  tym PRZED wywołaniem tej funkcji (`describe.skipIf`), a nie po.
- `fromPgPool(pool)` / `fromAppDb(db)` — adaptery, żeby helper działał zarówno z `pg.Pool` (rowsy w
  `{ rows }`) jak i z app-owym `getDatabaseAsync()` (rowsy wprost z `.all()`).

### Dowód kontrolą negatywną (bez bazy — deterministyczny, powtarzalny)

`server/src/testing/__tests__/assertRealDatabase.test.ts` — **13 testów, wszystkie PASS**:
- ★ `MOCK_DB=true` **zatrzymuje helper, nawet gdy runner ZWRÓCIŁBY poprawny wiersz** — dowód, że
  bramka env jest sprawdzana PRZED dotknięciem połączenia (`runner` nigdy nie jest wołany).
- brak `RUN_DB_TESTS` → to samo.
- gate env spełniony, ale połączenie rzuca (np. ECONNREFUSED) → helper rzuca, nie połyka błędu.
- gate env spełniony, ale zapytanie zwraca 0 wierszy (atrapa/mock udający klienta) → helper rzuca.
- gate env spełniony, `current_database` = pusty string → helper rzuca.
- ścieżka pozytywna: oba warunki spełnione → helper zwraca `{ currentDatabase, currentSchema }`.
- adaptery `fromPgPool`/`fromAppDb` przetestowane osobno (unwrapping `{ rows }`, przepuszczanie
  rowsów wprost, tolerancja na `undefined` z `.all()`).

### Podłączenie do trzech istniejących suit Assessment/method-core

1. `server/src/method-core/__tests__/http.integration.test.ts` — `assertRealDatabase(fromPgPool(pool))`
   w `beforeAll`, przed jakimkolwiek insertem.
2. `server/src/method-core/__tests__/freezeOutputFlow.integration.test.ts` — to samo.
3. `server/src/routes/v8/__tests__/assessment.accepted-freeze.pg.test.ts` — użycie
   `fromAppDb(db)` (ta suita idzie przez `getDatabaseAsync()`, nie przez surowy `pg.Pool`).
   Przy okazji zaostrzyłem komunikat błędu strażnika (`MOCK_DB=false` teraz wymienione explicit) —
   ta suita wcześniej w ogóle nie sprawdzała `MOCK_DB`, tylko `RUN_DB_TESTS` (działało przypadkiem,
   bo logika mockowania w `Database.ts` i tak wybiera realną bazę przy `RUN_DB_TESTS=1`, ale suita
   NIE dowodziła tego sama — teraz dowodzi).

**Żywy przebieg wszystkich trzech suit razem, z realnym Postgresem** (`consultify_asm_s4`,
`RUN_DB_TESTS=1 MOCK_DB=false`): **40/40 PASS** — helper nie zepsuł istniejącego zachowania.

```
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL="postgresql://<user>@127.0.0.1:5439/consultify_asm_s4" \
  npx vitest run server/src/method-core/__tests__/http.integration.test.ts \
    server/src/method-core/__tests__/freezeOutputFlow.integration.test.ts \
    server/src/routes/v8/__tests__/assessment.accepted-freeze.pg.test.ts \
    --no-file-parallelism
# Test Files  3 passed (3)
#      Tests  40 passed (40)
```

---

## CEL C — pełna regresja baseline vs candidate

**STATUS: W TOKU, przerwane do zapisu przed końcem sesji nadzorcy. Poniżej — uczciwy stan
częściowy. NIE ekstrapoluj z partii zmierzonych na niezmierzone.**

### Metodyka

- Baseline worktree: `git worktree add --detach /Users/piotrwisniewski/consultify-wt/s4-baseline origin/demo`
  (`e45904dc79`), `node_modules` podlinkowany symlinkiem do tego samego katalogu co worktree S4.
- Zbiór plików: `find tests/unit -type f \( -name "*.test.ts" -o ... \)` w OBU worktree.
  Candidate (HEAD): **1574 plików**. Baseline (`origin/demo`): **1661 plików**.
  `comm -23 candidate baseline` = **0** — każdy plik candidate'a istnieje też w baseline (bezpieczny
  wspólny zbiór do diffowania). `comm -13` (tylko baseline) = **87 plików**, głównie
  `tests/unit/initiatives-execution/**` (~60 plików) + kilka w `finance/`, `i18n/`.
  Sprawdzone przez `git ls-tree -r --name-only $(git merge-base origin/demo HEAD) -- tests/unit/initiatives-execution`
  → **0 wyników**: ten katalog nie istniał we wspólnym przodku, więc to NIE jest usunięcie testów
  przez candidate — to funkcjonalność dodana do `demo` PO rozejściu gałęzi, której `codex/asm-s4`
  jeszcze nie ma (forward-port spoza zakresu tego zadania). Te 87 plików nie wchodzi do porównania
  regresji (nie da się regresować kodu, którego candidate nie ma) i nie są liczone jako
  `introduced`/`fixed`/`pre_existing` — są **poza zakresem candidate'a**, nie NOT_VERIFIED.
- Pierwsza próba: dosłowne `npm run test:unit` na candidate — **zawieszone na pojedynczym teście**
  (`tests/unit/backend/routes/workbook.routes.grounding-hydration.test.ts`, 60s timeout × 2 próby
  retry = 120s na JEDNYM tekście) po ~2 minutach, log w
  `.../scratchpad/s4-regression/candidate_full.log`. Przy 1574 plikach i losowej kolejności
  (`order: 'random'` w `vitest.config.ts`) to by dało bieg rzędu wielu godzin — zabite, nie
  dokończone.
- **Zmieniona metodyka (odnotowana jawnie, symetryczna dla obu stron):** pliki `tests/unit`
  podzielone na 27 partii po 60 (`split -l 60 -d -a 3`), każda partia uruchamiana jako
  `VITEST_HEAP_MB=8192 npx vitest run <60 plików> --maxWorkers=1 --maxConcurrency=2
  --testTimeout=15000 --retry=0` (zamiast domyślnego `testTimeout=60000, retry=1` z korzeniowego
  configu), z twardym limitem ściany czasu 280s/partię (macOS nie ma `timeout` — wrapper
  `sleep 280 && kill -9`). Skrypt: `.../scratchpad/s4-regression/run_batches.sh`.
  **Efekt uboczny do odnotowania:** pliki, które i tak by padły na 60s timeout, teraz padają na
  15s — klasyfikacja PASS/FAIL się nie zmienia dla prawdziwych zawieszeń (visible poniżej:
  `assessmentInitiativeService.test.ts` padał na 15001-15041ms, czyli uderzał w sam limit — przy
  60s prawdopodobnie też by padł, ale to NIE zostało zweryfikowane przy kanonicznym timeout i
  oznaczam to wprost jako zastrzeżenie, nie fakt).

### Postęp w momencie zapisu (przerwane na wyraźne polecenie nadzorcy)

| Strona | Partii zmierzonych | Plików zmierzonych | Log |
|---|---|---|---|
| Candidate (HEAD `0f4a1a53a6`) | 2/27 (batch_000, batch_001) | 120/1574 | `.../scratchpad/s4-regression/cand_logs/batch_000.log`, `batch_001.log`, postęp: `cand_progress.txt` |
| Baseline (`origin/demo` `e45904dc79`) | **0/27** | **0/1661** | nie uruchomiony — CEL C wymaga SEKWENCYJNEGO biegu (nigdy równolegle z candidate, żeby uniknąć zabicia przez system), a candidate jeszcze nie skończył |

**Klasyfikacja regresji (introduced/pre_existing/fixed) wymaga OBU stron. Skoro baseline ma 0
plików zmierzonych, ŻADEN plik nie może być dziś sklasyfikowany do żadnej z tych trzech
kategorii — to nie jest przybliżenie, to fakt: nie ma z czym porównać.**

### Surowe obserwacje candidate-only (batch_000 + batch_001, BEZ porównania do baseline — informacyjnie, nie klasyfikacja)

```
batch_000 (60 plików):  Test Files  4 failed | 55 passed | 1 skipped (60)
batch_001 (60 plików):  Test Files  2 failed | 57 passed | 1 skipped (60)
```

Padające testy (nazwa pliku > nazwa testu), candidate HEAD, `--testTimeout=15000 --retry=0`:

- `tests/unit/AIChat/agentPlanPanel.blocksToSteps.test.ts` — "FALLBACK: krok bez toolInput.phase dostaje CZYTELNĄ etykietę narzędzia, nie snake_case"
- `tests/unit/api.test.ts` — "should trigger circuit on 502 or Network Error"; "should clear circuit on clearGlobalTransportFailure"
- `tests/unit/backend/agentProductionBuildBoundary.test.ts` — "runs the packaged strict Postgres migrator before the Railway API starts"
- `tests/unit/auth/auth.middleware.private.test.ts` — "mapRole maps superadmin to owner"
- `tests/unit/backend/aiActionExecutor.wave3-runtime.test.ts` — "creates an AIRun proposal and does not mutate before explicit approve and execute"
- `tests/unit/backend/assessment/assessmentInitiativeService.test.ts` — 7 testów, wszystkie timeout ~15000ms (⚠ patrz zastrzeżenie o `--testTimeout=15000` wyżej — pod kanonicznym 60000ms/retry=1 NIE zweryfikowano czy też padają)

**Żaden z powyższych NIE jest jeszcze sklasyfikowany jako `introduced` — to wymaga uruchomienia
DOKŁADNIE tych samych plików na baseline i porównania nazw testów, co nie zostało zrobione.**

### Wszystko pozostałe: NOT_VERIFIED

- **Candidate, partie 002–026 (batch_002 … batch_026), tj. ~1454/1574 plików** —
  `NOT_VERIFIED`, powód: **partia nieuruchomiona przed końcem sesji** (batch_002 był w trakcie w
  momencie zapisu tego dokumentu).
- **Baseline, WSZYSTKIE partie (batch_000–batch_026), 1661/1661 plików** — `NOT_VERIFIED`, powód:
  **bieg baseline nieuruchomiony przed końcem sesji** (zgodnie z zasadą „nigdy równolegle z
  candidate", czekał na dokończenie strony candidate).
- **87 plików wyłącznie w baseline (`tests/unit/initiatives-execution/**` i in.)** — poza zakresem
  candidate'a (patrz metodyka wyżej), nie NOT_VERIFIED w sensie „nie zdążyliśmy", tylko
  strukturalnie nieporównywalne na tym branchu.

### Co dalej (jeśli sesja będzie kontynuowana)

1. Dokończyć 27 partii candidate (`run_batches.sh` na worktree `s4`, batche 002–026).
2. Uruchomić 27 partii baseline na worktree `s4-baseline` — DOPIERO PO zakończeniu strony
   candidate (nigdy równolegle).
3. Dla każdego pliku zmierzonego po OBU stronach: wyciągnąć nazwy padających testów (`grep -E
   "^ × "` z logu), porównać `diff`/`comm` między stronami, sklasyfikować
   `introduced`/`pre_existing`/`fixed`/`identical_pass`.
4. Zaktualizować tę sekcję kolejnym commitem (nie amendować).

---

## Komendy do odtworzenia (dokładne)

```bash
# CEL A — bramki migracyjne
cd /Users/piotrwisniewski/consultify-wt/s4
npx vitest run tests/integration/method-core-migrations.realdb.test.ts --no-file-parallelism

# CEL B — helper + kontrola negatywna (bez bazy)
npx vitest run server/src/testing/__tests__/assertRealDatabase.test.ts

# CEL B — trzy podłączone suity, real Postgres
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL="postgresql://<user>@127.0.0.1:5439/consultify_asm_s4" \
  npx vitest run server/src/method-core/__tests__/http.integration.test.ts \
    server/src/method-core/__tests__/freezeOutputFlow.integration.test.ts \
    server/src/routes/v8/__tests__/assessment.accepted-freeze.pg.test.ts \
    --no-file-parallelism

# CEL C — batch runner (candidate)
bash .../scratchpad/s4-regression/run_batches.sh \
  /Users/piotrwisniewski/consultify-wt/s4 /tmp/s4_batches \
  .../scratchpad/s4-regression/cand_logs .../scratchpad/s4-regression/cand_progress.txt

# CEL C — batch runner (baseline, TYLKO po zakończeniu candidate)
bash .../scratchpad/s4-regression/run_batches.sh \
  /Users/piotrwisniewski/consultify-wt/s4-baseline /tmp/s4_batches \
  .../scratchpad/s4-regression/base_logs .../scratchpad/s4-regression/base_progress.txt
```

SHA: candidate `0f4a1a53a6e00baeda3de59378cd6bf4a3fecbb4`, baseline (`origin/demo`)
`e45904dc7940f259b9cf017c283264d5c166c9ab`.
