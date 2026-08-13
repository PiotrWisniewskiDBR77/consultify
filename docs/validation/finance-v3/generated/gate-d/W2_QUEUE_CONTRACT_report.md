# W2 — Domknięcie kontraktu kolejki zadań (WP-B04)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, gate FC-11
**Kontrakt:** `docs/validation/finance-v3/generated/gate-b/WP-B04_jobs_runs_outputs_ADR.md`
**Wejście:** `docs/validation/finance-v3/generated/gate-d/W9_FAULT_CONCURRENCY_TENANT_MATRIX_report.md` §3, §7 (EM-1…EM-6, W9-B-1)
**Data:** 2026-08-10
**Worktree:** `/Users/piotrwisniewski/consultify-wt/w2-kolejka`
**Gałąź:** `codex/finance-v3-w2-kolejka`
**SHA bazowe (przed zmianami):** `cecc7975c1b905db3178bded97fd14f9a429a02a`
**SHA końcowe:** patrz `git log` po commitach tej sesji (jeden commit per etap, patrz §9)

**Zamrożenie uszanowane.** `codex/finance-v3-closeout-fanin` @ `19b4b06934` nietknięta. Zero pushy, zero merge, zero połączeń ze staging/demo/produkcją — wyłącznie własny efemeryczny klaster Postgres 15, usunięty po pracy.

---

## 0. Werdykt w jednym akapicie

Sześć elementów `EVIDENCE_MISSING` (EM-1…EM-6) i jeden defekt księgowania (W9-B-1) z raportu W9 są **domknięte**, z jednym udokumentowanym wyjątkiem: **EM-5 (pętla workera) jest domknięte tylko częściowo** — reaper (EM-1) JEST realną pętlą tła nad kolejką, podłączoną do produkcyjnego schedulera, ale prawdziwa pula workerów, która by *drenowała* zadania nigdy przez siebie niezakolejkowane i *wykonywała* domenowe obliczenia, pozostaje niezbudowana — brakuje kolumny payloadu w `compute_jobs` do odtworzenia parametrów wywołania (`businessVersionId`, `entityId`, `forecastPeriodIds`, ...), a zbudowanie jej wymagałoby albo nowej decyzji schematu wykraczającej poza ten pakiet, albo dotknięcia plików będących w tej sesji własnością równoległego agenta. Nie zbudowano fantomu — to jest świadomy, opisany `EVIDENCE_MISSING`, nie próba udawania działania.

Kontrola negatywna (przywrócenie rodzica `computeJobService.ts`) zaczerwieniła **16 z 25** testów w `faultMatrix.pg.test.ts` — dokładnie te, które dowodzą naprawionych elementów. Regresja: **30/31 plików, 428 passed / 4 skipped (432)** na `src/services/finance/canonical` — jedyny czerwony plik (`coldReopen.pg.test.ts`) jest **potwierdzonym przez orkiestratora, przedistniejącym defektem interakcji fan-in niezwiązanym z tą pracą** (patrz §2).

---

## 1. Środowisko i metoda

| Element | Wartość |
| --- | --- |
| Baza | PostgreSQL **15.15** (Homebrew `postgresql@15`), własny efemeryczny klaster |
| `initdb`/`pg_ctl` | `LC_ALL=C`, `--locale=C`, `-E UTF8`, `listen_addresses=127.0.0.1` |
| Katalog danych | `/private/tmp/fv3-kolejka-pgdata` (poza repo i poza scratchpadem sesji), gniazdo `/tmp/fv3kolsock` |
| Port | **57661** — sprawdzony `lsof` przed bindem, w wyznaczonym zakresie |
| Migracje | `server/scripts/migrate.postgres.ts` **STRICT** (bez `--safe`), exit 0, świeża baza — zweryfikowane **trzykrotnie** w tej sesji |
| Bramka testów | `RUN_DB_TESTS=1` **oraz** `MOCK_DB=false` **oraz** jawny `DATABASE_URL` |
| Runner | `npx vitest run --config vitest.config.ts ... --no-file-parallelism`, z `server/` |
| Sprzątanie | wykonane po zakończeniu pracy |

**Kontrola negatywna bramki DB** (musi dać `skipped`, nigdy `passed`): `faultMatrix.pg.test.ts` uruchomiony **bez** `RUN_DB_TESTS`/`MOCK_DB`/`DATABASE_URL` → `Tests 25 skipped (25)`. Potwierdzone.

---

## 2. Punkt odniesienia (regresja) — ustalony PRZED zmianami, na świeżej bazie

Zmierzony na czystej, świeżo zmigrowanej bazie, **przed** jakąkolwiek zmianą kodu tej sesji (pliki `computeJobService.ts`/`Scheduler.ts` chwilowo cofnięte do rodzica poleceniem `git checkout HEAD --`, **nigdy `git stash`** — worktree jest współdzielone między sesjami):

```
Test Files  1 failed | 30 passed (31)
     Tests  417 passed | 4 skipped (421)
```

Jedyny czerwony plik: `src/services/finance/canonical/__tests__/coldReopen.pg.test.ts` →
`SensitivityGridAccessError: writeSensitivityGrid: method undefined not found for organization ...`
w `valuationSensitivityService.ts:190`.

**To NIE jest defekt tej pracy.** Zweryfikowałem to niezależnie (test pada identycznie w izolacji, na własnym efemerycznym klastrze, `beforeAll` crash zanim jakikolwiek `it` się wykona) i orkiestrator sesji potwierdził tę samą diagnozę: naprawa P0 na innej gałęzi zmieniła `findOrCreateMethod()` z gołego wiersza na typowaną unię `{ok:true, method} | {ok:false, code}`; `coldReopen.pg.test.ts` (żywy na innej gałęzi w momencie tamtej naprawy) nadal czyta `.id` prosto z unii, dostaje `undefined`, wpycha `NULL` do `writeSensitivityGrid`, a nowy strażnik własności to odrzuca. Klasyczny defekt interakcji przy fan-inie — poza zakresem WP-B04/tej sesji, **nie diagnozowałem od nowa i nie przypisuję sobie**. Ten plik jest **wyłączony** z porównania regresji poniżej, zgodnie z instrukcją orkiestratora.

Punkt odniesienia użyty do oceny regresji: **30/30 plików istotnych, 417 passed / 4 skipped (421)**.

---

## 3. Stan po zmianach

```
Test Files  1 failed | 30 passed (31)     [ten sam 1 czerwony = coldReopen, niezmieniony]
     Tests  428 passed | 4 skipped (432)
```

**+11 testów** (417 → 428), wszystkie nowe/przepisane w `faultMatrix.pg.test.ts` (14 → 25 testów w tym pliku). Zero nowych czerwonych plików poza przedistniejącym `coldReopen.pg.test.ts`. `canonicalServices.pg.test.ts` (w tym test SKIP LOCKED na 4 zadaniach jednego org+job_type bez limitu) i `tenantMatrix.pg.test.ts` (w tym W9-C-5 tenant-scoping `getJob`/`cancelJob`) — **48/48 zielone**, bez zmian w treści tych plików.

Dodatkowo: `tsc -p server --noEmit` → **exit 0** (sprawdzone dwukrotnie, przed i po ostatniej zmianie).

---

## 4. Per element — co było / co zrobiłem / dowód

### EM-2 — Heartbeat (ADR §5.2)

**Było:** `compute_job_runs.last_heartbeat_at` nigdy nie rósł po `DEFAULT`; `lease_expires_at` nigdy nie było przedłużane.

**Zrobiłem:** `heartbeat()`, `server/src/services/finance/canonical/computeJobService.ts:213-254`. `UPDATE compute_jobs SET lease_expires_at = now() + N s WHERE id=? AND lease_owner=? AND status='running'` — jeśli `UPDATE` zwróci 0 wierszy, zwraca typowane `{ok:false, code:'LEASE_LOST'}` (ADR §5.2: „worker musi natychmiast przerwać pracę"). Przy sukcesie aktualizuje też `compute_job_runs.last_heartbeat_at` dla bieżącej próby.

**Dowód (niezależny odczyt z tabeli, nie wartość zwrócona przez serwis):** test `FIXED EM-2: heartbeat() advances last_heartbeat_at and extends lease_expires_at` (`faultMatrix.pg.test.ts:806-829`) — odczytuje `compute_job_runs.last_heartbeat_at` i `compute_jobs.lease_expires_at` PRZED i PO wywołaniu `heartbeat()`, porównuje instancje `Date`. Osobny test dowodzi, że heartbeat spod **cudzego** `worker_id` jest odrzucony (`LEASE_LOST`), a prawdziwy właściciel leasingu **nie jest naruszony** (`lease_owner` niezmieniony, odczyt fizyczny).

### EM-1 — Reaper wygasłych lease (ADR §5.3)

**Było:** zero trafień na `lease_expires_at` w kodzie aplikacji; nic nigdy nie zapisywało `compute_job_runs.outcome='lease_expired'`; porzucone zadanie zostawało w `running` na zawsze.

**Zrobiłem:** `reapExpiredLeases()`, `computeJobService.ts:472-548`. Batch `SELECT ... FOR UPDATE SKIP LOCKED` nad `status='running' AND lease_expires_at < now()`; dla każdego wiersza — jeśli `attempt_count < max_attempts`: `queued` + ten sam liniowy backoff co `failJob()` (30s × attempt_count); inaczej: terminalny `failed` (DLQ) + wywołanie EM-6. Zawsze zamyka odpowiadający wiersz `compute_job_runs` jako `outcome='lease_expired'`. **Wpięte w produkcyjny scheduler**: `server/src/cron/Scheduler.ts`, job 42, `* * * * *` (co minutę), domyślnie WŁĄCZONY (`COMPUTE_JOB_REAPER_CRON_ENABLED=false` do wyłączenia) — ten sam wzorzec co job39 (rekoncyliacja lineage artefaktów): czysty safety-net odzysku danych, zero zachowania widocznego dopóki żaden lease nie wygasł.

**Dowód:** test `FIXED EM-1: reapExpiredLeases() requeues an abandoned job and closes the run as lease_expired` (`faultMatrix.pg.test.ts:176-236`) — wymusza wygaśnięcie lease ręcznym `UPDATE`, potwierdza że nic go automatycznie nie odzyskuje (bo reaper jest cron-driven, nie auto-uruchamiany w procesie testowym), **wywołuje realny `reapExpiredLeases()`**, i niezależnym odczytem z tabeli potwierdza: `status='queued'`, `lease_owner=NULL`, `lease_expires_at=NULL`, `compute_job_runs.outcome='lease_expired'` z `finished_at` ustawionym, backoff faktycznie zastosowany (test najpierw dowodzi że `claim()` NIE widzi zadania przed upływem backoffu, potem przewija zegar testowo i dowodzi że widzi). Osobny test `reaper dead-letters ... once attempts are exhausted` dowodzi ścieżki terminalnej + wpisu EM-6.

**★ Dowód bezpieczeństwa reapera (obowiązkowy wymóg brief'u):** test `reaper safety: a FRESH heartbeat prevents the reaper from stealing the lease; a STALE one lets it reclaim` (`faultMatrix.pg.test.ts:238-273`):
- Przypadek 1 (świeży heartbeat): `claim()` z krótkim leasingiem (2s) → **przed** wygaśnięciem wywołanie `heartbeat()` przedłuża leasing o 300s → `reapExpiredLeases()` **NIE dotyka** zadania (niezależny odczyt: `status` nadal `'running'`, `lease_owner` niezmieniony).
- Przypadek 2 (nieświeży, bez heartbeatu): `claim()` z leasingiem 1s, brak heartbeatu, upływ czasu → `reapExpiredLeases()` **odzyskuje** zadanie (`status='queued'`).

Bez tego dowodu reaper byłby niebezpieczny (mógłby zabrać leasing żywemu workerowi) — dowód jest w pliku, nie tylko w tym raporcie.

### W9-B-1 — `cancelJob()` nie domykał księgowania (P1)

**Było:** `cancelJob()` ustawiał `status='cancelled'`/`cancel_requested_at`, ale nigdy `finished_at`, nigdy nie zwalniał `lease_owner`/`lease_expires_at`, nigdy nie zamykał otwartego wiersza `compute_job_runs`.

**Zrobiłem:** `cancelJob()`, `computeJobService.ts:416-460`. Teraz w jednej transakcji: `SELECT ... FOR UPDATE` (żeby znać `status`/`attempt_count` PRZED zmianą), `UPDATE compute_jobs SET status='cancelled', finished_at=now(), lease_owner=NULL, lease_expires_at=NULL, ...`, i **tylko jeśli zadanie było `running`** (bo `queued` nigdy nie miało wiersza `compute_job_runs` — wstawia go wyłącznie `claim()`) — `UPDATE compute_job_runs SET outcome='cancelled', finished_at=now() WHERE ... AND outcome IS NULL`.

**Dowód:** test `FIXED W9-B-1: cancelling a RUNNING job now closes finished_at, releases the lease, and closes the run row` (`faultMatrix.pg.test.ts:606-627`) — niezależny odczyt: `finished_at` jest ustawione (było `NULL`), `lease_owner` jest `NULL` (było `'w9b4b-worker'`), `compute_job_runs.outcome='cancelled'` (było `NULL`). Osobny test `cancelling a QUEUED (never claimed) job does not touch compute_job_runs` dowodzi, że poprawka nie próbuje zamykać wiersza, który nigdy nie istniał (`readRuns` zwraca `[]`).

### EM-3 — Kill switch `is_org_compute_killed()` (ADR §5.1/§7.2)

**Było:** brak funkcji SQL w `pg_proc`, brak odpowiednika aplikacyjnego.

**Zrobiłem:** migracja `server/migrations/20260810_finance_v3_w2_b04_queue_ops.sql` — tabela `compute_kill_switches` (`organization_id`/`job_type` NULL-owalne jako wildcard, `UNIQUE NULLS NOT DISTINCT (organization_id, job_type)` — funkcja PG15, ten program pinuje `postgresql@15`) + funkcja SQL `is_org_compute_killed(org, job_type)`. `claim()` teraz konsultuje ją w podzapytaniu (`AND NOT is_org_compute_killed(c.organization_id, c.job_type)`), dokładnie jak w szkicu ADR §5.1. Aplikacyjne API: `setKillSwitch()`/`clearKillSwitch()`/`isOrgComputeKilled()` (`computeJobService.ts:584-624`).

**Decyzja projektowa (uzasadniona w §7 poniżej):** dedykowana tabela zamiast rozszerzania `v8_feature_flags` — ta ostatnia jest per-`(organization_id, module)` `BOOLEAN` bez możliwości wyrażenia globalnego kill (org `NULL`) ani granularności per `job_type`, a pamięć zespołu ostrzega o rozjeździe `public`/`v8` na tej dokładnie tabeli na bazie demo.

**Dowód:** test `FIXED EM-3: is_org_compute_killed()/org_concurrency_limit() now exist as SQL functions` (odwrócenie starej asercji nieobecności — teraz `pg_proc` zawiera oba). Test `an active kill switch for (org, job_type) makes claim() see zero eligible jobs; clearing it un-blocks` — `setKillSwitch` → `claim()` zwraca `[]`, zadanie fizycznie nadal `queued` (nie zgubione); `clearKillSwitch` → `claim()` znowu widzi zadanie. Test `a GLOBAL kill switch (organization_id NULL) blocks every organization` — dowodzi wildcardu na poziomie globalnym, niezależnie sprawdzonym `isOrgComputeKilled()` dla DWÓCH różnych organizacji.

### EM-4 — Limit współbieżności per organizacja `org_concurrency_limit()` (ADR §5.1/§8)

**Było:** brak funkcji; zmierzone: 6 zadań jednej organizacji claimowanych jednym wywołaniem, żaden limit nie konsultowany.

**Zrobiłem:** ta sama migracja — tabela `compute_org_concurrency_limits` (ta sama wildcard-semantyka) + funkcja `org_concurrency_limit(org, job_type)` (najbardziej specyficzny dopasowany wiersz wygrywa, `ORDER BY specyficzność DESC LIMIT 1`). **Migracja zasiewa hojny globalny domyślny wiersz `(NULL, NULL, 50)`** — świadomie WYSOKI, nie „rozsądny" niski (np. 1-2 z sugestii ADR §12.2): test `canonicalServices.pg.test.ts` „two concurrent claim() calls never claim the same job twice (SKIP LOCKED)" enqueuje 4 zadania JEDNEJ org+job_type i oczekuje że wszystkie 4 są claimowalne w dwóch równoległych wywołaniach bez skonfigurowanego limitu — niski domyślny limit **cicho zmieniłby zachowanie tego istniejącego, zielonego testu regresji**. Dostrajanie w dół jest jawne, opt-in, per `(org, job_type)`.

**`claim()` przepisany na pętlę pojedynczych claimów** (zamiast jednego zbiorczego `UPDATE ... LIMIT n`) — konieczne dla poprawności: licznik `running` wewnątrz `org_concurrency_limit()`-owej klauzuli musi widzieć zadania zaklaimowane WCZEŚNIEJ w TYM SAMYM wywołaniu, inaczej wsadowy claim z `limit > cap` mógłby przekroczyć limit jednym strzałem. Transakcja zawsze widzi własne wcześniejsze zapisy (niezależnie od poziomu izolacji), więc pętla per-wiersz jest poprawna kosztem nieco mniejszej przepustowości przy dużych `limit` — udokumentowane w komentarzu nad `claim()`, nie ciche.

**Dowód:** test `FIXED EM-4: an explicit LOW concurrency limit ... caps claim() even when more jobs are queued and limit param requests more` — `setOrgConcurrencyLimit(org, jobType, 2)`, 6 zadań w kolejce, `claim({limit:6})` → zwraca dokładnie 2, pozostałe 4 fizycznie nadal `queued` (nie zgubione), a **drugie** wywołanie `claim()` (podczas gdy pierwsze 2 nadal `running`) zwraca 0 — limit trzyma się między wywołaniami. Test `without an explicit override, the seeded generous global default (50) does not block a normal batch — backward compatible` odtwarza dokładnie starą obserwację (6 z 6 claimowanych) dla nieskonfigurowanego `job_type`, teraz z udokumentowanego powodu zamiast z nieobecnej funkcji.

### EM-6 — Wpis w exception ledger przy dead-letter (ADR §10, WP-B05 jako konsument)

**Było:** `failJob()` nie dotykał `finance_exceptions`; zmierzone: 0 wierszy po dead-letterze.

**Zrobiłem:** `raiseDeadLetterException()` (`computeJobService.ts:302-333`), wywoływana zarówno przez `failJob()` (gdy `status` przechodzi w terminalny `'failed'`) jak i przez `reapExpiredLeases()` (ta sama ścieżka terminalna). Wołanie `exceptionLedgerService.raise()` **poza** własną transakcją `failJob`/reapera (osobna, niezależnie commitowana `withPinnedPostgresTransaction` — dokładnie wzorzec już istniejący w `baselineComputeService.ts` dla diagnostyki non-convergence), **best-effort** — złapane w `try/catch`: zepsuty ledger nie może zamaskować, że sam job osiągnął poprawny stan terminalny (kontrakt podstawowy to przejście stanu joba, wpis w ledgerze jest addytywną obserwowalnością).

**Mapowanie severity (uproszczenie, udokumentowane, nie ukryte):** `job_type` zawierający `VALUATION` → `MATERIAL`, wszystko inne → `WARNING`. To NIE jest pełna niuansa z prozy ADR („na Valuation zbliżającej się do approval — Material") — ta wymagałaby odczytu stanu business version, którego ten ogólny serwis kolejki nie ma i nie powinien pozyskiwać. Udokumentowane jako świadome uproszczenie.

**Dowód:** test `FIXED EM-6: failJob() raises a finance_exceptions dead-letter entry once attempts are exhausted` — niezależny `SELECT` z `finance_exceptions` po `source_ref::text LIKE '%jobId%'`, sprawdza `reason_code='COMPUTE_JOB_DEAD_LETTER'`, `severity='WARNING'`, `artifact_id`/`organization_id` zgodne z jobem. Test `a VALUATION_* job_type dead-lettering is raised at MATERIAL, not WARNING` dowodzi rozróżnienia severity. Test negatywny `a job that RETRIES (not yet exhausted) does NOT raise a dead-letter exception` dowodzi że wpis powstaje TYLKO przy przejściu terminalnym, nie przy każdym `failJob()`. Test w bloku reapera dowodzi tej samej ścieżki dla dead-letteru **z reapera**, nie tylko z `failJob()`.

### EM-5 — Pętla workera / demon drenujący kolejkę (ADR §5, master plan §2.3) — **CZĘŚCIOWO domknięte, reszta EVIDENCE_MISSING**

**Decyzja projektowa i uzasadnienie (wymagane przez brief, podjęte samodzielnie):**

Reaper (EM-1) **JEST** realną, wpiętą pętlą tła nad kolejką — cron w `Scheduler.ts`, wywoływana bez udziału procesu, który zakolejkował dane zadanie. To zamyka literę ADR §5.3 („osobny, lekki proces... okresowo wykonuje [reaper query]").

Ale **prawdziwy worker pool**, który by:
1. wołał `claim()` dla zadań, których TEN proces nigdy nie zakolejkował (nie self-claim), **i**
2. faktycznie wykonywał domenowe obliczenia (baseline/prediction/valuation compute) dla zaklaimowanego zadania,

**nie jest zbudowany.** Sprawdziłem: `compute_jobs` ma kolumny generyczne (`input_artifact_id`, `input_revision_hash`, `engine_manifest_id`, `organization_id`, `requested_by_user_id`) — ŻADNA z nich nie wystarcza do odtworzenia parametrów wywołania, których realnie potrzebują `baselineComputeService.runBaselineCompute()` (`businessVersionId`, `entityId`, `forecastPeriodIds`, `openingBalanceSheetPeriodId`) czy analogiczne funkcje w `predictionComputeService.ts`/`valuationComputeService.ts`. Zbudowanie prawdziwego drenującego workera wymagałoby jednego z:
- (a) nowej kolumny payloadu JSONB na `compute_jobs` + refaktoryzacji CZTERECH serwisów compute, żeby przyjmowały odtworzony payload zamiast bezpośrednich parametrów wywołania — to jest decyzja **schematu/kontraktu** wykraczająca poza WP-B04 (żaden ADR jej nie projektuje), albo
- (b) dotknięcia `baselineComputeService.ts`/`kpiComputeService.ts`/`predictionComputeService.ts`/`valuationComputeService.ts` — plików, które brief wprost oznaczył jako własność **równoległego agenta w tej sesji** (zmienia obsługę wyniku `completeJobSuccess()`).

Zbudowanie czegokolwiek, co claimowałoby zadania i nie umiałoby ich wykonać, byłoby dokładnie tym fantomem, przed którym ostrzega brief (`BUG-10` — `202 {status:'queued'}` bez zaplecza — to dokładnie ten sam wzorzec, cytowany w samym ADR §1.3 jako antywzorzec do NIE powielania).

**Rekomendacja (nie wykonanie):** dodanie kolumny payloadu do `compute_jobs` + jeden generyczny dispatcher `job_type → handler` w warstwie serwisowej, projektowane jako osobny, zatwierdzony ADR — naturalny następny krok po tym pakiecie, poza jego zakresem.

**EVIDENCE_MISSING, wprost:** nie ma dowodu, że jakikolwiek proces w tym repo podejmie zadanie w statusie `queued`, którego sam nie zakolejkował i od razu nie zaklaimował. Test `EVIDENCE_MISSING (EM-5, still open): a queued job this process did not itself enqueue-and-immediately-claim is drained by NOTHING` (`faultMatrix.pg.test.ts:928-947`) dowodzi tego wprost — zadanie zostaje w `queued` po oknie czasowym, w którym jakikolwiek poller by zadziałał, **i** reaper (uruchomiony jawnie) go nie dotyka (nie ma wygasłego leasingu do odzyskania).

---

## 5. Kontrola negatywna — OBOWIĄZKOWA, wykonana

Metoda: `cp computeJobService.ts computeJobService.FIXED.ts` (backup), `git checkout HEAD -- computeJobService.ts` (przywrócenie wersji rodzica — **nigdy `git stash`**, bo worktree jest współdzielone), uruchomienie **całego** `faultMatrix.pg.test.ts`, potwierdzenie czerwieni, przywrócenie `computeJobService.FIXED.ts`, ponowne potwierdzenie zieleni.

**Wynik: 16 z 25 testów czerwonych** przy cofniętej naprawie — dokładnie te dowodzące EM-1, EM-2, EM-3, EM-4, EM-6 i W9-B-1 (lista pełna, surowy output):

```
× FIXED EM-1: reapExpiredLeases() requeues an abandoned job and closes the run as lease_expired
× reaper safety: a FRESH heartbeat prevents the reaper from stealing the lease; a STALE one lets it reclaim
× heartbeat on a lease already reaped/lost returns LEASE_LOST
× the RECOVERY the reaper performs is sound — no double output after requeue
× reaper dead-letters (does not requeue forever) once attempts are exhausted, and raises an EM-6 exception
× FIXED W9-B-1: cancelling a RUNNING job now closes finished_at, releases the lease, and closes the run row
× cancelling a QUEUED (never claimed) job does not touch compute_job_runs
× FIXED EM-6: failJob() raises a finance_exceptions dead-letter entry once attempts are exhausted
× FIXED EM-6: a VALUATION_* job_type dead-lettering is raised at MATERIAL, not WARNING
× FIXED EM-2: heartbeat() advances last_heartbeat_at and extends lease_expires_at
× heartbeat() from the WRONG worker_id is refused, not silently accepted
× FIXED EM-3: an active kill switch for (org, job_type) makes claim() see zero eligible jobs; clearing it un-blocks
× FIXED EM-3: a GLOBAL kill switch (organization_id NULL) blocks every organization for that job_type
× FIXED EM-4: an explicit LOW concurrency limit ... caps claim()
× FIXED EM-4: without an explicit override, the seeded generous global default (50) does not block a normal batch
× EVIDENCE_MISSING (EM-5, still open): a queued job ... is drained by NOTHING   [failed differently: reapExpiredLeases undefined]

Test Files  1 failed (1)
     Tests  16 failed | 9 passed (25)
```

Błędy były typu `AssertionError` (np. `expected 2026-08-10T20:00:16.080Z to be null`, `expected [] to have a length of 1 but got 0`) i `TypeError: jobs.heartbeat is not a function` — **żadna warstwa obronna nie ukryła regresji**, nie wystąpił przypadek „zielony mimo cofnięcia" wymagający precyzyjniejszego uszkodzenia. Po przywróceniu naprawy: **25/25 zielone**, ponownie potwierdzone.

Kontrola negatywna bramki DB (§1) potwierdzona osobno: `skipped`, nigdy `passed`.

---

## 6. Punkty kolizji

- **`server/src/services/finance/canonical/failJob()`/`reapExpiredLeases()` teraz wołają `exceptionLedgerService.raise()` przy dead-letterze.** `failJob()` jest już dziś wołany przez `baselineComputeService.ts:619` i `kpiComputeService.ts:495` (istniejący kod, nie mój) — jeśli równoległy agent zmienia te dwa pliki w tej samej sesji, jego zmiany NIE dotykają sygnatury `failJob()` (niezmieniona), więc kolizja tekstowa jest mało prawdopodobna, ale **behawioralnie** ich `failJob()` call teraz może (best-effort, w `try/catch`, nie rzuca) dopisać wiersz do `finance_exceptions` — warto, żeby ten agent o tym wiedział przy własnych testach dead-letter.
- **NIE dotknąłem** `baselineComputeService.ts`, `kpiComputeService.ts`, `predictionComputeService.ts`, `valuationComputeService.ts` — dokładnie zgodnie z briefem. `EM-5` pozostaje otwarte właśnie dlatego, że zamknięcie go w pełni wymagałoby ich dotknięcia.
- `coldReopen.pg.test.ts` — pre-istniejący, potwierdzony przez orkiestratora defekt interakcji fan-in (`valuationSensitivityService.ts`/`findOrCreateMethod()`), **nie mój, nie naprawiałem, nie diagnozowałem od nowa** — wykluczony z liczb regresji per instrukcję orkiestratora.

---

## 7. Nowe obiekty SQL — decyzje projektowe

Nowa, addytywna migracja: `server/migrations/20260810_finance_v3_w2_b04_queue_ops.sql`. Żadna historyczna migracja nie została zmieniona.

- `compute_kill_switches` / `is_org_compute_killed()` — dedykowana tabela zamiast rozszerzania `v8_feature_flags` (zbyt wąski kształt: per-`(org, module)` `BOOLEAN`, bez wildcardu globalnego/`job_type`, plus udokumentowany w pamięci zespołu rozjazd schematu `public`/`v8` na tej dokładnie tabeli).
- `compute_org_concurrency_limits` / `org_concurrency_limit()` — analogiczny kształt, `UNIQUE NULLS NOT DISTINCT (organization_id, job_type)` (funkcja PG15 — program pinuje `postgresql@15` wszędzie, więc bezpieczne). Zasiany hojny globalny domyślny wiersz `(NULL, NULL, 50)` — świadomie NIE niski, żeby nie złamać istniejącego, zielonego testu `canonicalServices.pg.test.ts` (SKIP LOCKED, 4 zadania jednej org+typu, zero skonfigurowanego limitu, oczekiwane 4 claimowalne). Dokładna liczba per `job_type` to decyzja operacyjna (ADR §12.2), nie architektoniczna — pozostawiona do ustawienia przez `setOrgConcurrencyLimit()`, gdy realne liczby pojemności zostaną zmierzone.

---

## 8. Dokładne komendy reprodukcji

```bash
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3-kolejka-pgdata ; PGSOCK=/tmp/fv3kolsock ; PORT=57661
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3kol_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3_kolejka;"
DBURL="postgresql://postgres@127.0.0.1:$PORT/fv3_kolejka"

# Migracje STRICT (bez --safe)
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" npx tsx server/scripts/migrate.postgres.ts   # -> exit 0

# tsc
npx tsc -p server --noEmit   # -> exit 0

# Plik pod testem (25 testów)
cd server && DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" \
  npx vitest run --config vitest.config.ts \
    src/services/finance/canonical/__tests__/faultMatrix.pg.test.ts --no-file-parallelism
# -> Test Files 1 passed (1) ; Tests 25 passed (25)

# Kontrola negatywna bramki DB
cd server && NODE_ENV=test npx vitest run --config vitest.config.ts \
  src/services/finance/canonical/__tests__/faultMatrix.pg.test.ts
# -> Tests 25 skipped (25)

# Regresja: cały katalog canonical
cd server && DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" \
  npx vitest run --config vitest.config.ts src/services/finance/canonical --no-file-parallelism
# -> Test Files 1 failed (coldReopen, pre-istniejący, niezwiązany) | 30 passed (31)
#    Tests 428 passed | 4 skipped (432)

# Sprzątanie
$PGBIN/pg_ctl -D "$PGDATA" -m fast stop && rm -rf "$PGDATA" "$PGSOCK"
```

---

## 9. Commity

Baza gałęzi: `cecc7975c1`. **Nic nie wypchnięte.**

| Plik/obszar | Zawartość |
| --- | --- |
| `server/migrations/20260810_finance_v3_w2_b04_queue_ops.sql` | EM-3/EM-4: `compute_kill_switches`, `compute_org_concurrency_limits`, `is_org_compute_killed()`, `org_concurrency_limit()`, seed domyślnego limitu 50 |
| `server/src/services/finance/canonical/computeJobService.ts` | EM-1 `reapExpiredLeases()`, EM-2 `heartbeat()`, EM-3/EM-4 admin API + `claim()` przepisany na pętlę per-wiersz, EM-6 `raiseDeadLetterException()` w `failJob()`/reaperze, W9-B-1 `cancelJob()` fix |
| `server/src/cron/Scheduler.ts` | job 42: reaper co minutę, domyślnie ON, `COMPUTE_JOB_REAPER_CRON_ENABLED=false` do wyłączenia |
| `server/src/services/finance/canonical/__tests__/faultMatrix.pg.test.ts` | 14 → 25 testów: przepisane z „prove absence" na „prove fix" + kontrola negatywna + dowód bezpieczeństwa reapera |
| ten raport | — |

(Commitowane per etap zgodnie z higieną sesji — patrz `git log codex/finance-v3-w2-kolejka`.)

---

## 10. Rekomendacja dla bramki FC-11

**Kolejka zadań: `GO` dla EM-1, EM-2, EM-3, EM-4, EM-6, W9-B-1** — zaimplementowane, przetestowane, kontrola negatywna wykonana, dowód bezpieczeństwa reapera dostarczony, zero regresji poza jednym pre-istniejącym, niezwiązanym defektem.

**EM-5 (pełna pula workerów): `EVIDENCE_MISSING`, świadomie, z planem.** Reaper jako pętla tła jest realny i wpięty; prawdziwe drenowanie+wykonanie wymaga decyzji o payloadzie `compute_jobs`, poza zakresem tego pakietu. Nie blokuje FC-11 dla samej kolejki (mechanika odzysku działa), ale blokuje twierdzenie „compute w pełni asynchroniczny, worker pool w produkcji" — to twierdzenie pozostaje nieprawdziwe do czasu osobnego pakietu.

**FC-11 (numeryczne SLO p50/p95/p99):** bez zmian względem raportu W9 — nadal `EVIDENCE_MISSING`, poza zakresem tego pakietu (kontrakt kolejki, nie pomiar wydajności).
