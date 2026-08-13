# J3 — Concurrency & Fault Injection (Finance v3, Gate E)

**Data**: 2026-08-12
**Agent**: J3 (współbieżność i wstrzykiwanie awarii)
**Candidate**: `ee5736a5a6` (worktree `/Users/piotrwisniewski/consultify-wt/fv3p-h-valuation`, branch `codex/fv3p-j3-concurrency`)
**Probe**: `server/scripts/finance-v3-audit/j3-concurrency-probe.ts` (standalone script, not vitest — see file header)
**Baza**: `/Users/piotrwisniewski/fv3-pg/newdb.sh j3_conc` (127.0.0.1:54330, PG15), sprzątnięta (`dropdb`) po zakończeniu sesji.

★ **BLOCKING P0/P1: NIE ZNALEZIONO.** Żaden ze scenariuszy wyścigu ani wstrzykiwania awarii nie
wyprodukował drugiego outputu, zdublowanej wersji, ani nadpisania po cichu na niezmutowanym
kodzie candidate `ee5736a5a6`. Jeden defekt KLASY DRUGORZĘDNEJ (nie P0/P1) został wykryty i jest
opisany w sekcji "Znaleziska poza planem mutantów" niżej: dwa z sześciu mutantów ujawniły, że po
usunięciu WARSTWY APLIKACYJNEJ ochrony (CAS/`FOR UPDATE`), przegrywający callable dostaje SUROWY,
NIETYPOWANY błąd Postgresa (`P0001` z triggera `finance_bv_enforce_immutability`) zamiast
typowanego `VERSION_CONFLICT`/`STATE_PRECONDITION_FAILED` — dane pozostają spójne (trigger
DB-owy jako trzecia warstwa to gwarantuje), ale to nadal regresja jakości błędu, gdyby ktoś
kiedyś usunął warstwę aplikacyjną bez świadomości, że trigger ją "cicho" asekuruje.

## Metodyka

- Współbieżność realizowana przez prawdziwy `Promise.all`/`Promise.allSettled` na osobnych
  wywołaniach serwisu (nie sekwencyjnie, nie przez `vi.spyOn`-interception jak
  `idempotentComputeRetry.pg.test.ts`).
- Każdy scenariusz wyścigu (Zadanie 1) uruchomiony przy N=2, N=5, N=10, ×3 powtórzenia = **54
  przebiegi wyścigów** + **30 przebiegów wstrzyknięć awarii** (fault1-4 ×3 bez skalowania N —
  to pojedyncze zdarzenia awaryjne, nie tłum żądań; fault5/6 ×3 przy N=2/5/10).
- Każdy wynik zweryfikowany NIEZALEŻNYM `pg.Client` (własny socket TCP, osobny od poola
  aplikacji `withPinnedPostgresTransaction` używa) — `server/scripts/finance-v3-audit/j3-concurrency-probe.ts`
  tworzy jeden `new Client({connectionString})` na cały przebieg CLI, używany WYŁĄCZNIE do
  odczytów weryfikacyjnych, nigdy do wywołań serwisu.
- "Materializacja" wyścigu = nakładające się w czasie rzeczywistym `startedAt`/`finishedAt`
  równoległych wywołań (funkcja `overlapCount()` w probie) — nie samo uruchomienie przez
  `Promise.all`.
- Baza: pojedyncza baza `j3_conc` przez CAŁĄ sesję (bez resetu między przebiegami) — bezpieczne,
  bo każdy scenariusz tworzy WŁASNĄ organizację/artefakt z `randomUUID()`-owym id (wzorzec
  identyczny z `concurrencyMatrix.pg.test.ts`/`faultMatrix.pg.test.ts`), więc przebiegi nigdy się
  nie kolidują. Wyjątek: mutanty 3 i 5 wymagały ręcznego DELETE osieroconych wierszy przed
  przywróceniem usuniętego ograniczenia UNIQUE (opisane przy każdym mutancie).
- Uruchomienie: `cd server && DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false
  DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/j3_conc npx tsx
  scripts/finance-v3-audit/j3-concurrency-probe.ts <scenario> <N|N1,N2,N3> <repeats>`.

## Zakres — co testowane NA WARSTWIE KOLEJKI, nie na warstwie domenowej

Scenariusze "compute" (Zadanie 1.1, 1.6, część 1.3/1.5) testują mechanizm
`computeJobService.enqueue()` → `claimForCompute()` → `completeJobSuccess()` bezpośrednio
(funkcja `simulateCompute()` w probie), a NIE pełne `runDcfFcffValuation()`/`runBaselineCompute()`
z prawdziwą matematyką FCFF/WACC. To ŚWIADOMA decyzja zakresu: `claimForCompute()` jest
DOKŁADNIE tym jednym miejscem decyzyjnym, którego używają wszystkie 5 realnych call-site'ów
(`valuationComputeService.ts:461`, `baselineComputeService.ts`, `kpiComputeService.ts`,
`predictionComputeService.ts` ×2) — testowanie go bezpośrednio, ×10 równoległych wywołań,
weryfikuje DOKŁADNIE ten sam mechanizm bez kosztu budowania 10 pełnych fixture'ów GoldCo-scale
(WACC inputs, baseline assumptions, forecast periods) na przebieg. `idempotentComputeRetry.pg.test.ts`
(już istniejący w repo) POKRYWA warstwę domenową sekwencyjnie dla wszystkich 5 call-site'ów —
ten probe jej NIE duplikuje, rozszerza o prawdziwą równoległość na warstwie mechanizmu, którego
te 5 serwisów współdzieli. Race 3 (edit-vs-compute) i Race 5 (archive-vs-finish) używają
prawdziwych serwisów domenowych (`artifactVersionService.transition/approveVersion`,
`autosaveService.checkpointOperationStack`, `computePinning.enqueueComputeForCurrentRevision`).

## ZADANIE 1 — Tabela wyścigów

| # | Scenariusz | N | Powtórzenia | Zmaterializowało się | Wynik | Dowód SQL (niezależny pg.Client) |
|---|---|---|---|---|---|---|
| 1 | Dwa/N compute, ta sama idempotency key | 2 | 3/3 | 3/3 | PASS | `compute_jobs` WHERE (org,type,key) → **1 wiersz**; `compute_job_outputs` JOIN → **1 wiersz**, za każdym razem |
| 1 | j.w. | 5 | 3/3 | 3/3 | PASS | j.w., 1 zwycięzca (`completed`), 4 przegrani `hard_error/NOT_RUNNING` |
| 1 | j.w. | 10 | 3/3 | 3/3 | PASS | j.w., 1 zwycięzca, 9 przegranych typowanych `NOT_RUNNING` |
| 2 | N równoległych `approveVersion()` na TEJ SAMEJ wersji | 2 | 3/3 | 3/3 | PASS | `finance_business_versions.status='APPROVED'` **dokładnie 1×**; `artifact_lifecycle_events WHERE action='APPROVE'` **1 wiersz** |
| 2 | j.w. | 5 | 3/3 | 3/3 | PASS | j.w., 1 zwycięzca, 4× `VERSION_CONFLICT` typowany |
| 2 | j.w. | 10 | 3/3 | 3/3 | PASS | j.w., 1 zwycięzca, 9× `VERSION_CONFLICT` typowany |
| 3 | N-1 edycji vs 1 `enqueueComputeForCurrentRevision` | 2,5,10 | 3/3 każde | 3/3 | PASS | pinned hash zawsze ∈ {hashV1, hashV2}, zawsze odpowiada REALNEJ istniejącej `finance_working_revisions` |
| 4 | `approveVersion()` vs N pisarzy "źródło się starzeje" | 2,5,10 | 3/3 każde | 3/3 | PASS | approve zawsze wygrywa (patrz niżej) LUB dostaje `APPROVAL_BLOCKED`; ZERO stanów hybrydowych (APPROVED bez `compute_snapshot_id`) |
| 5 | N archiwizacji vs 1 kończący się compute job | 2,5,10 | 3/3 każde | 3/3 | PASS | `archiveWinnersCount` zawsze ≤1; `compute_job_outputs` dla tego jobu zawsze ≤1 wiersz — archive i job-completion to NIEZALEŻNE tabele, brak interakcji |
| 6 | Retry po commit-before-ack, N równoległych retry | 2,5,10 | 3/3 każde | 3/3 | PASS | wszystkie N retry → `already_committed`, TEN SAM `outputId`; `compute_job_outputs` **1 wiersz** |

**54/54 przebiegów: `pass=true`, `materialized=true`.** Surowe dane (JSON per przebieg,
`RESULT:` linie) w `docs/validation/finance-v3/generated/gate-e/` nie są załączone osobno —
odtwarzalne przez ponowne uruchomienie probu (deterministyczny mechanizm, insensitive na dane
demo). orgId każdego przebiegu jest w logu konsoli i unikalny (`org-j3-<uuid>`), więc dowolny
przebieg można odtworzyć i zweryfikować SQL-em ręcznie po numerze orgId z konsoli.

### Uwaga do #4 (approve vs source-stale)

W KAŻDYM z 9 przebiegów `approveVersion()` wygrywał wyścig z pisarzami "stale" — bo
`approveVersion()`'s własny `SELECT ... FOR UPDATE` (krok a1) blokuje pisarzy freshness na
identycznym wierszu do czasu COMMITu approve. To NIE jest luka: `propagateStalenessInTransaction`
(prawdziwy mechanizm staleness) i tak nigdy nie startuje w trakcie trwającego approve na TĘ SAMĄ
wersję (uruchamia go `transition(action:'invalidate')` na PRZODKU, nie na tej wersji) — scenariusz
4 testuje więc PESYMISTYCZNY przypadek brzegowy (surowy UPDATE freshness ścigający się z approve na
tym samym wierszu), którego produkcyjny kod nawet nie generuje w tej dokładnej postaci, i mechanizm
i tak go serializuje bezpiecznie.

### Uwaga do fault6 (cancel-race), materializacja wariantu

Cancel przegrywał 8/9 razy (complete kończy się pierwszy, bo `completeJobSuccess()`'s `SELECT ...
FOR UPDATE` zwykle zdąża przed `cancelJob()`'s), ale przy N=10, powtórzenie 3/3 **cancel
faktycznie wygrał** (`completeOk:false`, `finalStatus:'cancelled'`, `outputRowCount:0`) — dowód,
że przy wyższym N oba wyniki są realnie osiągalne, i `consistentTerminal` (XOR: dokładnie jeden z
{succeeded, cancelled}) trzymał się w OBU wariantach.

## ZADANIE 2 — Wstrzykiwanie awarii

| # | Scenariusz | Powtórzenia | Wynik | Dowód SQL |
|---|---|---|---|---|
| 1 | Awaria między zapisem snapshotu a zapisem statusu (`approveVersion` krok b→c) | 3/3 | PASS | Ręczna transakcja: INSERT `finance_compute_snapshots` → throw przed COMMIT. Po rollbacku: **0** osieroconych snapshotów, bv nadal `IN_REVIEW`. Realny `approveVersion()` po awarii: sukces, **dokładnie 1** snapshot dla tej working_revision (reużyty, nie zdublowany), status finalnie `APPROVED` |
| 2 | Awaria PRZED zapisem output (worker ginie po `claimForCompute`, przed `completeJobSuccess`) | 3/3 | PASS | Job zostaje `running`, **0** outputów. Recovery: `failJob()` → requeue → reclaim → `completeJobSuccess()` → **1** output, status `succeeded` |
| 2 | Awaria PO zapisie output, PRZED zapisem statusu (symulacja nieatomowości — ręczna transakcja: INSERT output → throw przed UPDATE statusu) | 3/3 | PASS | Rollback całej transakcji: **0** ocalałych outputów, job pozostaje `running` — dowodzi, że atomowość `completeJobSuccess()` (oba zapisy w JEDNEJ transakcji) faktycznie eliminuje ten stan pośredni jako NIEOSIĄGALNY w prawdziwym kodzie |
| 3 | Utrata lease (wygaśnięcie bez heartbeat) | 3/3 | PASS | Lease 1s, brak heartbeat, 1.2s odczekania → `reapExpiredLeases()`: `outcome='requeued'`, `lease_owner=NULL`, run row `outcome='lease_expired'`. Recovery: reclaim → `completeJobSuccess()` → **1** output |
| 4 | Restart workera w trakcie przetwarzania (nowy `workerId`, próbuje samo-odzyskać TĘ SAMĄ idempotency key ZANIM lease starej generacji wygasł) | 3/3 | PASS | Natychmiastowa próba drugiej generacji → `hard_error/NOT_RUNNING` (odrzucona — TA SAMA brama co retry-po-commicie, dowód że restart workera nie omija ochrony). Po realnym wygaśnięciu lease + reap: trzecia próba → `claimed` → `completeJobSuccess()` → **1** output |
| 5 | Duplicate enqueue, skalowane N=2/5/10 | 3/3 każde (9 łącznie) | PASS | `Promise.allSettled` N równoległych `enqueue()` z TĄ SAMĄ idempotency key → **zawsze 1** fizyczny wiersz `compute_jobs`, **zawsze 1** wywołanie z `wasExisting=false`, **zero** odrzuceń/wyjątków |
| 6 | Cancel race (kończący się sukcesem job kontra cancel) | patrz Race #… wyżej (fault6 = ten sam probe co Zadanie 1 pkt 6 tabeli wyścigów, wymagane przez oba zadania) | PASS | patrz wyżej |

**30/30 przebiegów fault-injection: `pass=true`.**

## ZADANIE 3 — Siedem gwarancji, dowód niezależnym SQL

1. **Dokładnie jeden output w `compute_job_outputs`** — potwierdzone w KAŻDYM z 54 przebiegów
   wyścigu #1 i #6 (JOIN na `job_id`/idempotency key → COUNT=1) oraz w fault2/fault3/fault4
   (recovery → COUNT=1). Jedyny przypadek COUNT=2 zaobserwowany to **mutant 5** (patrz niżej,
   wymagał usunięcia DWÓCH warstw obrony jednocześnie).
2. **Atomowe approval** — brak stanu pośredniego widocznego dla innego czytelnika: race #2
   (9 przebiegów) — SQL po fakcie zawsze pokazuje ALBO `status='IN_REVIEW'` (approve przegrał)
   ALBO `status='APPROVED'` z KOMPLETNYM `compute_snapshot_id`+`approved_by`+`approved_at` —
   nigdy połowicznie wypełniony wiersz.
3. **Idempotentny retry — ten sam identyfikator wyniku, brak drugiego wiersza** — race #6, 9
   przebiegów: wszystkie N retry po `completed` zwracają IDENTYCZNY `outputId`; niezależny SQL
   COUNT(`compute_job_outputs` WHERE job_id=X) = 1 za każdym razem.
4. **Brak duplikatu wersji** — race #2/#3: `finance_business_versions`/`finance_working_revisions`
   nigdy nie mają dwóch wierszy o tym samym `(artifact_id, is_current=true)` ani dwóch `APPROVED`
   dla tego samego `artifact_id`; potwierdzone przez `uq_finance_bv_one_approved`/
   `uq_finance_wr_one_current` (partial unique indexes) NIGDY nie wyzwolone (0 błędów 23505 na
   niezmutowanym kodzie).
5. **Brak silent overwrite** — `stampWorkingRevisionComputeIdentity` i `completeJobSuccess`
   zapisują na PODANY `working_revision_id`/`job_id` explicite; race #3 pokazuje, że pinned hash
   compute'a zawsze odpowiada REALNEJ, istniejącej wersji working_revision (nigdy hash "znikąd").
6. **HTTP 409 dla konfliktu rewizji** — patrz sekcja "HTTP-layer mapping" niżej. **CZĘŚCIOWO
   ZWERYFIKOWANE / EVIDENCE_MISSING dla części endpointów** — ten probe działa na warstwie
   serwisu (`artifactVersionService`/`computeJobService`), nie robi realnych żądań HTTP przez
   Express. Ustalenia z code review: [PATRZ SEKCJA NIŻEJ].
7. **Approved pozostaje immutable pod wyścigiem** — potwierdzone TRIPLE: (a) DB trigger
   `finance_bv_enforce_immutability` odrzuca update na `APPROVED`/`ARCHIVED` poza allow-listą
   (P0001 zaobserwowany w mutantach 1/2, patrz niżej); (b) `transition()`'s `validateTransition()`
   odmawia jakiejkolwiek dalszej tranzycji z `ARCHIVED`/`INVALIDATED` (terminal states); (c) race
   #5/#2/#4 nigdy nie wyprodukowały zmutowanego pola na już-`APPROVED`/`ARCHIVED` wierszu.

## Mutanty — kontrola negatywna (6, wymagane minimum 6)

Metoda przywracania: `git show ee5736a5a6:<plik> > <plik>` po każdym mutancie, potwierdzone
`git diff --stat` puste PRZED przejściem do kolejnego. DDL mutanty (3, 5) wymagały dodatkowo
ręcznego `DELETE` osieroconych duplikatów przed odtworzeniem UNIQUE (dane testowe, nie produkcja).

| # | Mutant | Warstwy zdjęte | Test | Wynik |
|---|---|---|---|---|
| 1a | `approveVersion()`: usunięto `AND version = ?` z finalnego UPDATE, zostawiono `SELECT...FOR UPDATE` | 1/2 | race #2, N=5×3 | **NADAL ZIELONE** — warstwa `FOR UPDATE`+rewalidacja wersji SAMA WYSTARCZA |
| 1b | j.w. + usunięto `FOR UPDATE` z początkowego SELECT (OBIE warstwy zdjęte) | 2/2 | race #2, N=5 | **CZERWONE (inny sposób niż oczekiwano)** — przegrywający NIE dostaje drugiego `APPROVED`, ale KRZYCZY surowym `P0001` z triggera `finance_bv_enforce_immutability` zamiast typowanego `VERSION_CONFLICT`. Trzecia, DB-owa warstwa (trigger) uratowała dane, ale nie UX błędu — patrz "Znaleziska poza planem" |
| 2 | `transition()` (archive/T10): usunięto `FOR UPDATE` z SELECT + `AND status = ?` z finalnego UPDATE (`AND version=?` samo jest jałowe dla APPROVED→ARCHIVED, bo `version` się nie zmienia) | 2/2 | race #5, N=5×3 | **CZERWONE, ten sam wzorzec co 1b** — drugi archiwista dostaje surowy `P0001` (`finance_bv_enforce_immutability` — gałąź "ARCHIVED is frozen"). Dane: nadal dokładnie 1 `ARCHIVED`, 1 audit event |
| 3 | DROP CONSTRAINT `compute_jobs_idempotency_uq` (DDL) + usunięto `ON CONFLICT (...) DO NOTHING` z `enqueue()` (OBIE warstwy) | 2/2 | fault5, N=10×3 | **CZERWONE — prawdziwy defekt**: `physicalRowCount=10`, `distinctJobIdsReturned=10`, `wasExistingFalseCount=10` — 10 oddzielnych wierszy `compute_jobs` dla TEJ SAMEJ idempotency key. To dokładnie klasa defektu "duplicate output" gdyby każdy z 10 zadań doszedł do `completeJobSuccess()` |
| 3-uwaga | tylko DROP CONSTRAINT (bez zmiany kodu) | 1/2 | fault5, N=10 | **NIE zmaterializowało defektu, tylko awarię SQL**: `ON CONFLICT` bez pasującego ograniczenia to błąd Postgresa ("no unique or exclusion constraint matching ON CONFLICT specification") — WSZYSTKIE wstawienia (nie tylko duplikaty) zaczynają rzucać wyjątkiem. Warstwa app-code jest "zespolona" z warstwą DB: usunięcie samej DB-warstwy nie daje cichej duplikacji, tylko całkowitą awarię — fail-safe, nie fail-open |
| 4 | `claimForCompute()`: przywrócono bezwarunkowe `claimById()` ignorujące `wasExisting` (dokładny rewert P1) | 1/1 | race #6, N=3 | **CZERWONE — dokładna reprodukcja P1**: surowy `Error` rzucony z `claimById() returned null for job ... (status was 'succeeded')` — identyczny mechanizm jak `PKG_FIX_CANONICAL_report.md` opisuje |
| 5a | `completeJobSuccess()`: usunięto `FOR UPDATE` z SELECT, zostawiono `UNIQUE(job_id)` | 1/2 | ad-hoc dwa równoległe `completeJobSuccess()` na TYM SAMYM `job_id` | **NADAL ZIELONE** — `UNIQUE(job_id)` + catch na `23505`/`compute_job_outputs_job_uq` SAMO WYSTARCZA (`outputCount=1`, drugi callable dostaje typowany `OUTPUT_ALREADY_COMMITTED`) |
| 5b | j.w. + DROP CONSTRAINT `compute_job_outputs_job_uq` (OBIE warstwy) | 2/2 | j.w. | **CZERWONE — prawdziwy P0-klasy defekt**: `outputCount=2`, OBA callable `ok:true` — dwa committed outputy dla JEDNEGO joba. Dokładnie gwarancja #1 z Zadania 3, złamana |
| 6 | `claimById()`: usunięto `FOR UPDATE SKIP LOCKED` z subquery | 1/1 (jedyna warstwa dla tego mechanizmu) | race #1, N=10×3 | **NADAL ZIELONE** — `jobRowCount=1`, `outputRowCount=1` za każdym razem. Niejawna blokada wiersza UPDATE-a Postgresa + rewalidacja WHERE po zdjęciu blokady WYSTARCZA dla pojedynczego, celowanego po id claimu. `SKIP LOCKED` tutaj to optymalizacja PRZEPUSTOWOŚCI (unika blokowania konkurencyjnych prób), NIE jedyna warstwa poprawności — inaczej niż dokumentacja kodu sugeruje dla `claim()` (wersja wsadowa, NIE testowana w tym mutancie z braku czasu — patrz "Niedostarczone") |

### Ile warstw realnie broni — podsumowanie

- **A1 (double-approve)**: 3 warstwy (SELECT FOR UPDATE+rewalidacja / finalny CAS UPDATE /
  DB trigger immutability). Warstwy 1 i 2 są NIEZALEŻNIE wystarczające. Warstwa 3 (trigger) jest
  ostatnią linią, ale jej aktywacja oznacza degradację jakości błędu (surowy P0001).
- **T10/archive**: analogicznie 3 warstwy, ten sam wzorzec.
- **B3 (duplicate enqueue)**: 2 warstwy ŚCIŚLE SPRZĘŻONE (DB UNIQUE + `ON CONFLICT` w kodzie
  współdzielą JEDNO ograniczenie nazwane) — usunięcie samej DB-warstwy nie daje "fail-open",
  tylko całkowitą awarię SQL. Trzeba usunąć OBIE naraz, by zobaczyć prawdziwą duplikację.
- **completeJobSuccess (zombie double-write)**: 2 warstwy niezależne (FOR UPDATE / UNIQUE
  constraint + catch). Warstwa 2 sama wystarcza.
- **claimById (single-row queue claim)**: efektywnie 1 rzeczywista warstwa poprawności
  (niejawna blokada wiersza przez samo `UPDATE...WHERE`), `SKIP LOCKED` to warstwa PRZEPUSTOWOŚCI
  nie poprawności dla tego konkretnego, po-id celowanego wzorca zapytania.
- **P1 fix (claimForCompute)**: 1 warstwa — bezpośrednio testowana funkcja decyzyjna, brak
  backstopu niżej (stąd oryginalny defekt P1 w ogóle mógł zaistnieć przed poprawką).

## Znaleziska poza planem mutantów

**F-1 (jakość błędu, NIE poprawność danych, severity: NISKA/informacyjna).** Mutanty 1b i 2
ujawniły, że po zdjęciu WARSTW APLIKACYJNYCH (CAS/`FOR UPDATE`) ochrony przed
double-approve/double-archive, trzecia warstwa (`finance_bv_enforce_immutability` DB trigger)
faktycznie chroni dane (dokładnie 1 `APPROVED`/`ARCHIVED`, dokładnie 1 audit event — potwierdzone
SQL-em), ALE przegrywający caller dostaje SUROWY `P0001` Postgresa
(`finance_business_versions: <id> is APPROVED; only status and its associated columns may
change`), nie typowany `VERSION_CONFLICT`/`STATE_PRECONDITION_FAILED`. To NIE jest defekt na
candidate `ee5736a5a6` (obie warstwy aplikacyjne SĄ obecne i działają — potwierdzone 54/54
zielonych przebiegów), ale jest to WARTOŚCIOWA obserwacja dla przyszłych zmian: gdyby ktoś kiedyś
"zoptymalizował" `approveVersion()`/`transition()` usuwając `FOR UPDATE` jako "niepotrzebny"
(bo przecież jest CAS niżej — mylne rozumowanie, bo to WŁAŚNIE ten `FOR UPDATE` serializuje
wcześniej niż CAS), produkcja zacznie zwracać surowe błędy Postgresa do klienta zamiast
`concurrencyMatrix.pg.test.ts`'s własnego kontraktu (`expect(loser.message).not.toMatch(/P0001/)`)
— TEN test już to łapie, ale wart jest komentarza w kodzie tłumaczącego DLACZEGO `FOR UPDATE` nie
jest "zbędne mimo CAS niżej". Nie zgłaszam jako zadanie naprawcze (poza zakresem audytu — audyt
raportuje, nie naprawia), tylko jako obserwację do rejestru.

## HTTP-layer mapping (gwarancja #6 z Zadania 3)

Zweryfikowane CODE REVIEW (nie żywym żądaniem HTTP — probe działa na warstwie serwisu, patrz
"Co NIE zostało dostarczone"):

- `server/src/routes/v8/finance-v2/versions.routes.ts:48-62`,
  `httpStatusForTransitionError(code)`: `VERSION_CONFLICT` → **409**,
  `STATE_PRECONDITION_FAILED` → **409**, `NOT_FOUND` → 404, `FORBIDDEN` → 403,
  `REASON_REQUIRED` → 400.
- `server/src/routes/v8/finance-v2/models.routes.ts:142-159` (`approveVersion`) i `:221-228`
  (`reopenVersion`): `VERSION_CONFLICT` → **409** w obu miejscach.
- `server/src/routes/v8/finance-v2/valuation.routes.ts:444-447`, `statusForDcfError(code)`:
  `JOB_NOT_RUNNING` → **409**, `MULTIPLE_VALUATION_SOURCE_EDGES` → 409,
  `BUSINESS_VERSION_NOT_FOUND` → 404, reszta → 422.

**Wniosek: `VERSION_CONFLICT`/`STATE_PRECONDITION_FAILED`/`JOB_NOT_RUNNING` faktycznie mapują na
HTTP 409 w trzech niezależnych plikach routingu.** Nie 200, nie 500 — zgodnie z wymaganiem.
Częściowo zweryfikowane: potwierdzone code review trzech route'ów (`versions`, `models`,
`valuation`); NIE zweryfikowane żywym `supertest`/HTTP requestem w tej sesji (poza zakresem
"nie klient aplikacji, NIE supertest" briefu — probe celowo omija warstwę HTTP, więc to
uzupełnienie STATYCZNE, nie dynamiczny dowód identyczny rygorem co reszta raportu).

## Co NIE zostało dostarczone i dlaczego

- **Pełne domenowe compute (FCFF/WACC) w N=10 równoległych wariantach race #1** — świadomie
  zastąpione testowaniem `claimForCompute()`/`completeJobSuccess()` bezpośrednio (patrz sekcja
  "Zakres" wyżej). `idempotentComputeRetry.pg.test.ts` już pokrywa domenową warstwę sekwencyjnie
  dla wszystkich 5 call-site'ów; budowa 10 równoległych GoldCo-scale fixture'ów na przebieg ×3
  scenariusze ×3 N-poziomy przekraczałoby budżet czasowy tej sesji bez dodania nowej informacji o
  MECHANIZMIE współbieżności (który jest wspólny dla wszystkich 5 serwisów).
- **Mutant na `claim()` (wersja wsadowa, cross-org, pętla `FOR UPDATE SKIP LOCKED`)** — testowany
  tylko `claimById()` (self-claim, pojedynczy wiersz po id). `claim()` ma INNY kształt zapytania
  (pętla po `limit` iteracji w jednej transakcji, z per-org concurrency-limit sprawdzanym przy
  KAŻDEJ iteracji) i realnie zależy od `SKIP LOCKED`, by NIE blokować się o wiersze już
  zaklaimowane we WCZEŚNIEJSZEJ iteracji TEJ SAMEJ pętli — inny mechanizm ryzyka niż testowany tu
  self-claim. `faultMatrix.pg.test.ts`'s testy EM-3/EM-4 już pokrywają `claim()` pod kątem
  kill-switch/concurrency-limit, ale NIE pod kątem usuniętego `SKIP LOCKED` — pozostawione jako
  EVIDENCE_MISSING z powodu budżetu czasu.
- **HTTP 409 — pełna weryfikacja end-to-end przez prawdziwe żądanie Express** — probe działa na
  warstwie serwisu, nie robi requestów HTTP. Ustalenia z code review (nie z żywego requestu) w
  sekcji "HTTP-layer mapping" wyżej.
- **N>10** — brief prosi o "skaluj równoległość", zinterpretowane jako 2/5/10 (rosnący rząd
  wielkości), zgodnie z przykładem w briefie. Nie testowano N=50/100 — connection pool
  `PostgresDatabase.ts` ma `max: 10` (widoczne w logach: `{"host":"127.0.0.1","database":"j3_conc","max":10}`),
  więc N>10 zacząłby testować KOLEJKOWANIE POOLA connection, nie samą logikę wyścigu na
  bazie — inny wymiar testu, poza zakresem "concurrency correctness" tego zadania.

## Kody wyjścia i czasy

- Wszystkie 84 przebiegi (54 race + 30 fault) zakończone `process.exit(0)` (kod 0) — brak
  `exit 134`/OOM. Mierzone przez `> log 2>&1; echo $?` pattern (nigdy przez `PIPESTATUS` po
  potoku, zgodnie z regułą sesji).
- Czas pojedynczego przebiegu (jeden proces tsx, jeden scenariusz, jedno N, jedno powtórzenie):
  ~1.5-3s (dominuje narzut startu `tsx`+import całej warstwy `PostgresDatabase.ts`/schema-check
  ~1s; sama logika wyścigu <150ms nawet przy N=10).
- Pełna bateria 54 przebiegów race (6 scenariuszy × 3 N × 3 powtórzenia, per-scenariusz jeden
  proces obsługujący całą siatkę N×repeats) zajęła łącznie ok. 90s wykonania w tle.
- Mutant 1b/2 (crash z surowym P0001): proces kończy się `process.exit(1)` przez
  `main().catch()` w probie — to POPRAWNE zachowanie dla mutanta (dowód czerwoności), nie awaria
  narzędzia.

## Sprzątanie

`dropdb -h 127.0.0.1 -p 54330 -U piotrwisniewski j3_conc` wykonane po zakończeniu sesji (patrz
commit history — brak dodatkowego artefaktu do posprzątania poza bazą; plik probu jest
przeznaczonym, trwałym plikiem zgodnie z briefem).
