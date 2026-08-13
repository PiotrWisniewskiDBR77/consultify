# WP-B04 — Persisted Compute Jobs Architecture (ADR)

**Program:** `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md` (sekcja 2.3 „Compute jobs”, Gate B WP-B04)
**Work package:** WP-B04 Jobs/runs/outputs — Owner: Platform/SRE — P0
**Data:** 2026-08-09
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`
**Branch:** `codex/finance-v3-gate-a-20260809`
**Status dokumentu:** `ADR — DECYZJA PROJEKTOWA, NIE IMPLEMENTACJA`. Zero migracji, zero kodu runtime, zero połączenia z bazą danych powstało przy pisaniu tego dokumentu — zgodnie z twardym zakazem z briefu. Realizacja (migracje, worker, endpointy) należy do Gate C (WP-C01 Additive migrations, WP-C02 Compatibility services) i do implementacyjnej fazy WP-B04 po zatwierdzeniu tego ADR.

Wejście: `OWNER_REVIEW_REGISTER_2026-08-09.md` (OWN-FIN-018), `generated/gate-a/WP-A01_inventory_manifest.md`, `generated/gate-a/WP-A02_api_freeze.md`.

---

## 1. Kontekst — stan dzisiejszy (zweryfikowany statycznie, bez bazy)

Zgodnie z zakazem z briefu nie łączono się z żywą bazą. Ustalenia poniżej pochodzą wyłącznie z `grep`/lektury `server/src/services/finance*` i `server/src/routes/**/*financ*` na `origin/demo` (ten worktree, zero rozjazdu — patrz WP-A01 §0).

### 1.1 Nie istnieje dziś ŻADEN mechanizm async job/queue/worker dla Finance compute

`grep -rniE "queue|job_id|worker|bullmq|pgboss|pg-boss" server/src/services/finance*` nie zwraca ani jednego trafienia poza komentarzem niezwiązanym z kolejkowaniem (`financeAggregateScopeService.ts:215`, „worker tests” w sensie test-runnera, nie job workera). Nie ma tabeli jobs/queue w inwentarzu WP-A01 (60 tabel, zero z nazwą/rolą queue/job/lease). Nie ma żadnego pliku `*Queue*.ts`, `*Worker*.ts` ani zależności typu BullMQ/pg-boss w drzewie Finance.

### 1.2 Compute jest dziś w pełni synchroniczne w request-response

`POST /models/:modelId/compute` (`server/src/routes/v8/finance.routes.ts:718-747`) woła `computeModel(modelId)` (`server/src/services/financialModelingService.ts:760`) **bezpośrednio wewnątrz handlera HTTP**, `await`-uje wynik, zapisuje go (`persistComputeResult`) i dopiero wtedy odpowiada `res.json(...)` — jeden request, jeden proces, jedna transakcja czasu życia równa czasowi liczenia:

```ts
// server/src/routes/v8/finance.routes.ts:718-746
router.post('/models/:modelId/compute', asyncHandler(async (req, res) => {
  ...
  const result = await computeModel(modelId);                     // synchroniczne, w handlerze HTTP
  await persistComputeResult(modelId, result, model.scenario || 'base');
  return res.json({ data: { success: true, overallStatus: result.overallStatus, ... } });
}));
```

Nie ma tu enqueue, nie ma `job_id`, nie ma żadnego stanu pośredniego. Klient dostaje albo pełny wynik w jednej odpowiedzi, albo nic (timeout/connection drop) — dokładnie mechanizm opisany w OWN-FIN-018: „`Compute/Wylicz` kończy się timeoutem bez wyniku” i „mechanizm globalnego timeoutu 20 s został wcześniej potwierdzony technicznie”. Ten globalny 20 s **nie jest widoczny w kodzie aplikacji** (żadnego `setTimeout(20000` ani konfiguracji Express na trasie compute) — jest to potwierdzenie owner-side (POTWIERDZONE w rejestrze), więc najprawdopodobniej limit warstwy infrastruktury (reverse proxy / Railway edge), nie limit świadomie ustawiony w kodzie serwera. To jest dokładnie ryzyko, które WP-A02 oznaczył jako `EVIDENCE_MISSING` dla problemu #8 „Compute timeout” (`generated/gate-a/WP-A01_inventory_manifest.md:65`) — wymaga runtime/DB do pełnego potwierdzenia źródła, ale **brak kodu app-level timeout nie zmienia wniosku programowego**: dziś nie ma żadnego mechanizmu, który przetrwałby zerwanie połączenia HTTP w trakcie liczenia. Model po timeout/crash pozostaje w dowolnym stanie sprzed liczenia, bez żadnego rekordu „liczenie się nie udało” — UI może dalej pokazywać ostatni znany wynik jako aktualny.

### 1.3 Istnieje już fasada „job” — bez backendu (ostrzeżenie, nie wzorzec do powielenia)

`POST /models/:modelId/analyze` (`server/src/routes/v8/finance.routes.ts:1196-1219`, BUG-10 z WP-A02) zwraca `202 { analysisId: uuid(), status: 'queued' }` **bez żadnej tabeli, żadnego workera i żadnego `GET /analyses/:id` do pollingu** — to czysty losowy UUID i statyczny napis, zero realnego przetwarzania. Traktuję to jako negatywny przykład: dowód, że sama forma odpowiedzi `202 { id, status: 'queued' }` nie jest wystarczająca — musi istnieć trwały rekord, worker i endpoint statusu, inaczej to iluzja asynchroniczności identyczna z BUG-10.

### 1.4 Wzorce w repo warte ponownego użycia (nie projektowane od zera)

- **Idempotentny lock + receipt na jednej transakcji pinned**: `server/src/services/finance/financeCandidateHandoffCore.ts` — `withPinnedPostgresTransaction`, `UNIQUE(organization_id, source_type, source_id)` jako twardy klucz idempotencji, retry zwraca ten sam wynik bez ponownego wykonania efektu ubocznego. WP-A01 (`generated/gate-a/WP-A01_inventory_manifest.md:75`) rekomenduje ten plik jako referencję dla WP-B02/WP-B04 — ADR poniżej stosuje się do tej rekomendacji.
- **Advisory lock per org+operacja**: `server/src/services/financialModelingService.ts:1696-1704` — `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))` z kluczem `` `${organizationId}:${operation}` `` i `idempotencyKey`. Wzorzec transakcyjny (`_xact_`, zwalniany automatycznie na COMMIT/ROLLBACK, nigdy nie przecieka po awarii procesu) — ADR §6 stosuje ten sam prymityw do checka idempotencji przy enqueue, a NIE do trzymania locka przez cały czas trwania joba (patrz §8, uzasadnienie).

### 1.5 Wniosek

Odpowiedź na pytanie z briefu: **dziś nie istnieje żaden mechanizm async job/queue/worker dla Finance compute.** Compute jest w 100% synchroniczne w cyklu request-response HTTP, stąd globalny (najprawdopodobniej infrastrukturalny) timeout ok. 20 s jest jedynym „limitem” — i przy przekroczeniu nie zostawia żadnego trwałego śladu, więc UI może pokazywać dane, które wyglądają na aktualne, mimo że liczenie nigdy się nie zakończyło (dokładnie treść OWN-FIN-018). Jedyny istniejący „job” (`/models/:modelId/analyze`) jest fasadą bez implementacji i służy tu wyłącznie jako przykład antywzorca.

---

## 2. Decyzja

Pierwsza implementacja compute jobs to **persisted PostgreSQL queue** oparta o `FOR UPDATE SKIP LOCKED`, bez nowej infrastruktury (bez Redis/BullMQ/pg-boss/SQS). Uzasadnienie:

1. Master plan §2.3 przesądza to wprost: „Pierwsza implementacja: persisted PostgreSQL queue z `FOR UPDATE SKIP LOCKED`, leases/heartbeat, at-least-once execution i idempotentnym commitem.”
2. Zasada §1.5 master planu: migracje są addytywne, program unika nowych ruchomych części infrastruktury tam, gdzie Postgres wystarcza.
3. Ten sam silnik bazy, który trzyma `business_versions`/`working_revisions` (WP-B01) i exception ledger (WP-B05), może w jednej transakcji commitować output joba obok efektu biznesowego — nie ma problemu dual-write między dwoma systemami (queue osobno, dane osobno).
4. Wzorce pinned-transaction + advisory lock już istnieją w Finance (§1.4) — spójne rozszerzenie, nie nowy paradygmat.

Kolejka zewnętrzna (broker) pozostaje otwartą opcją **na później**, jeśli wolumen/opóźnienie tego wymuszą — nie jest to przedmiotem tego ADR (patrz §12).

---

## 3. DDL sketch

Trzy tabele: `compute_jobs` (kolejka + stan), `compute_job_runs` (log prób/heartbeatów, append-only), `compute_job_outputs` (idempotentny commit wyniku, dokładnie jeden na job).

### 3.1 `compute_jobs`

```sql
CREATE TABLE compute_jobs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL,
  job_type             text NOT NULL,               -- 'model_compute' | 'prediction_compute' | 'valuation_compute' | ...
  status               text NOT NULL DEFAULT 'queued'
                         CHECK (status IN ('queued','running','succeeded','failed','cancelled')),

  -- input identity (immutable per master plan §2.1/§2.3)
  input_artifact_id      uuid NOT NULL,              -- ref. do artifact z WP-B01
  input_revision_hash    text NOT NULL,              -- content_semantic_hash pinowany w momencie enqueue
  engine_manifest_id     uuid NOT NULL,               -- ref. engine_manifests z WP-B01/WP-B06

  -- idempotency (caller-scoped, nie output-scoped — patrz §6 dla output-scoped klucza)
  idempotency_key      text NOT NULL,

  -- lease / heartbeat (§5)
  lease_owner          text,                         -- '<hostname>:<pid>:<worker_uuid>'
  lease_expires_at     timestamptz,

  -- retry (§10)
  attempt_count        integer NOT NULL DEFAULT 0,
  max_attempts          integer NOT NULL DEFAULT 5,
  next_attempt_at        timestamptz NOT NULL DEFAULT now(),

  -- cancel / kill switch (§7)
  cancel_requested_at    timestamptz,
  cancel_reason         text,

  -- czas
  created_at            timestamptz NOT NULL DEFAULT now(),
  started_at            timestamptz,
  finished_at           timestamptz,

  -- błąd (ostatniej próby, pełna historia w compute_job_runs)
  error                text,

  -- kto/skąd
  requested_by_user_id    uuid NOT NULL,
  request_id            text,                        -- correlation id z warstwy HTTP (WP-B07)

  CONSTRAINT compute_jobs_idempotency_uq
    UNIQUE (organization_id, job_type, idempotency_key)
);

CREATE INDEX compute_jobs_claim_idx
  ON compute_jobs (job_type, next_attempt_at)
  WHERE status = 'queued';

CREATE INDEX compute_jobs_org_running_idx
  ON compute_jobs (organization_id, job_type)
  WHERE status = 'running';

CREATE INDEX compute_jobs_lease_reaper_idx
  ON compute_jobs (lease_expires_at)
  WHERE status = 'running';
```

Uwagi do kolumn względem specyfikacji z briefu: `org_id`→`organization_id` i `id` na `uuid` dla spójności z resztą schematu Finance (`organization_id` to nazwa kolumny używana wszędzie indziej w inwentarzu WP-A01). Dodano `max_attempts`, `next_attempt_at`, `cancel_requested_at`/`cancel_reason`, `input_artifact_id`, `requested_by_user_id`, `request_id` — niezbędne dla §7/§9/§10, nie zmieniają rdzenia z briefu.

### 3.2 `compute_job_runs` — append-only log prób

Jeden wiersz per próba (attempt) — oddziela „ile razy próbowaliśmy i co się działo” od stanu bieżącego joba. Kluczowe dla debugowania at-least-once (ile razy faktycznie uruchomił się worker) i dla odróżnienia lease-expiry od realnego błędu silnika.

```sql
CREATE TABLE compute_job_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES compute_jobs(id),
  attempt_number   integer NOT NULL,
  worker_id       text NOT NULL,                    -- = lease_owner tej próby
  claimed_at      timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  outcome         text CHECK (outcome IN
                    ('succeeded','failed','cancelled','lease_expired','killed')),
  error           text,

  CONSTRAINT compute_job_runs_job_attempt_uq UNIQUE (job_id, attempt_number)
);

CREATE INDEX compute_job_runs_job_idx ON compute_job_runs (job_id, attempt_number);
```

### 3.3 `compute_job_outputs` — dokładnie jeden committed output na job

To jest granica „exactly-once” z §6: niezależnie od tego, ile razy job faktycznie się wykonał (at-least-once execution), co najwyżej jeden wiersz tu powstaje.

```sql
CREATE TABLE compute_job_outputs (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                 uuid NOT NULL REFERENCES compute_jobs(id),
  organization_id        uuid NOT NULL,
  output_artifact_id       uuid NOT NULL,             -- artifact z WP-B01 do którego commitujemy
  output_business_version_id uuid,                    -- NULL dopóki output nie jest promowany do wersji biznesowej
  output_working_revision_id uuid NOT NULL,           -- zawsze — compute zawsze pisze najpierw do working revision
  committed_by_attempt_number integer NOT NULL,       -- która próba faktycznie skomitowała (audyt)
  content_semantic_hash    text NOT NULL,
  freshness               text NOT NULL DEFAULT 'CURRENT'
                            CHECK (freshness IN
                              ('CURRENT','STALE_SOURCE','STALE_ASSUMPTIONS','COMPUTE_FAILED')),
  committed_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT compute_job_outputs_job_uq UNIQUE (job_id),
  CONSTRAINT compute_job_outputs_idempotency_uq
    UNIQUE (organization_id, output_artifact_id, content_semantic_hash)
);
```

Dwa unikalne klucze celowo: `UNIQUE(job_id)` gwarantuje jeden output per job (ochrona przed dwoma równoległymi próbami tego samego joba); `UNIQUE(organization_id, output_artifact_id, content_semantic_hash)` gwarantuje, że deterministyczny wynik dla identycznego inputu nigdy nie powstanie dwa razy jako osobne wiersze, nawet z dwóch różnych jobów (np. użytkownik kliknął „Wylicz” dwa razy zanim dostał odpowiedź z pierwszego zapytania — patrz §6).

---

## 4. State diagram

```
                enqueue (POST /compute)
                       │
                       ▼
                 ┌───────────┐
        ┌───────▶│  queued   │◀────────────────────┐
        │        └─────┬─────┘                      │
        │              │ worker claims               │ lease expired
        │              │ (FOR UPDATE SKIP LOCKED)     │ (reaper requeues,
        │              ▼                              │  attempt_count++)
        │        ┌───────────┐                        │
        │        │  running  │────────────────────────┘
        │        └─────┬─────┘
        │              │
        │   ┌──────────┼──────────────┬─────────────────┐
        │   │ success  │ error         │ cancel_requested │ (attempts exhausted
        │   │ (commit) │ (retryable)   │ (cooperative)    │  after failure)
        │   ▼          ▼               ▼                  ▼
        │ ┌─────────┐ ┌─────────┐   ┌───────────┐    ┌────────┐
        │ │succeeded│ │ (retry) │   │ cancelled │    │ failed │
        │ └─────────┘ └────┬────┘   └───────────┘    └────────┘
        │                  │
        └──────────────────┘  (status→queued, next_attempt_at = backoff(attempt_count))
```

Uwagi:
- `queued → running` następuje wyłącznie przez atomowy claim (§5.1), nigdy przez zwykły `UPDATE ... SET status='running'` bez `FOR UPDATE SKIP LOCKED`.
- `running → queued` (retry) i `running → failed` (DLQ) są rozstrzygane przez `attempt_count` vs `max_attempts` — patrz §10.
- `queued → cancelled` i `running → cancelled` są jedynymi przejściami inicjowanymi przez użytkownika/kill switch — patrz §7.
- Nie ma przejścia `succeeded → *` ani `cancelled → *` ani `failed → *` (poza ręcznym re-enqueue jako **nowy** job, nigdy mutacją istniejącego wiersza — spójne z „Approved jest immutable” z master planu §1.6, tu: „terminalny job jest immutable”).

---

## 5. Leases i heartbeat

### 5.1 Claim (atomowy, `FOR UPDATE SKIP LOCKED`)

```sql
UPDATE compute_jobs
SET status = 'running',
    lease_owner = $1,                          -- '<hostname>:<pid>:<worker_uuid>'
    lease_expires_at = now() + interval '90 seconds',
    started_at = COALESCE(started_at, now()),
    attempt_count = attempt_count + 1
WHERE id = (
  SELECT id FROM compute_jobs
  WHERE status = 'queued'
    AND job_type = $2
    AND next_attempt_at <= now()
    AND NOT is_org_compute_killed(organization_id, job_type)          -- §7 kill switch, sprawdzony PRZED claimem
    AND (
      SELECT count(*) FROM compute_jobs r
      WHERE r.organization_id = compute_jobs.organization_id
        AND r.job_type = compute_jobs.job_type
        AND r.status = 'running'
    ) < org_concurrency_limit(organization_id, job_type)               -- §8 per-org concurrency
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

`SKIP LOCKED` gwarantuje, że N workerów pollujących równolegle nigdy nie weźmie tego samego wiersza — każdy pomija wiersze aktualnie zablokowane przez inną transakcję claimu. Po udanym claim worker wstawia odpowiadający wiersz `compute_job_runs` (attempt_number = nowy `attempt_count`).

### 5.2 Heartbeat

Worker w trakcie liczenia (np. co 15 s, przy naturalnych checkpointach silnika — patrz §7.2 dla tego samego mechanizmu użytego do kill switch) wykonuje:

```sql
UPDATE compute_jobs
SET lease_expires_at = now() + interval '90 seconds'
WHERE id = $1 AND lease_owner = $2 AND status = 'running'
RETURNING id;
```

oraz aktualizuje `compute_job_runs.last_heartbeat_at` dla bieżącej próby. **Jeśli `UPDATE` zwróci 0 wierszy, worker musi natychmiast przerwać pracę** — to znaczy, że reaper (§5.3) już uznał lease za wygasłą i oddał joba innemu workerowi (albo job został anulowany/killnięty w międzyczasie). Worker, który to zignoruje i mimo to skomituje wynik, jest zablokowany przez `UNIQUE(job_id)` na `compute_job_outputs` — druga próba (ta, która przejęła joba po reaperze) i tak wygra deterministycznie dzięki §6, więc nawet naruszenie tej zasady przez błąd workera nie psuje spójności danych, tylko marnuje pracę.

### 5.3 Awaria workera w trakcie pracy (reaper)

Osobny, lekki proces (albo idle-loop każdego workera przy pustej kolejce) okresowo (np. co 30 s) wykonuje:

```sql
UPDATE compute_jobs
SET status = 'queued',
    lease_owner = NULL,
    lease_expires_at = NULL,
    next_attempt_at = now() + backoff(attempt_count)   -- §10
WHERE status = 'running'
  AND lease_expires_at < now()
RETURNING id, lease_owner AS dead_worker, attempt_count;
```

Dla każdego zwróconego wiersza reaper zamyka odpowiadający `compute_job_runs` (`outcome = 'lease_expired'`, `finished_at = now()`). Job wraca do `queued` z podbitym `attempt_count` (już podbitym przy claimie — reaper nie podbija drugi raz) i nowym `next_attempt_at` wyliczonym z backoffu. Jeśli `attempt_count >= max_attempts`, ten sam UPDATE (przez `CASE`/dodatkowy branch albo osobny follow-up UPDATE w tej samej transakcji) ustawia `status = 'failed'` zamiast `queued` — patrz §10.

**Kluczowa własność**: żaden krok nie wymaga, żeby martwy worker cokolwiek zrobił. Cały recovery dzieje się z zewnątrz, na podstawie `lease_expires_at`, więc proces workera może zniknąć w dowolnym momencie (OOM, deploy, crash procesu) bez specjalnej obsługi sygnałów.

---

## 6. At-least-once execution + idempotentny commit (dokładnie jeden output)

Egzekucja jest **at-least-once**: ten sam job może faktycznie policzyć wynik więcej niż raz (np. worker A traci heartbeat tuż przed zakończeniem liczenia z powodu chwilowego zator sieciowego do Postgresa, reaper oddaje joba workerowi B, ale worker A i tak dokańcza liczenie i próbuje zapisać). System musi mimo to skomitować **dokładnie jeden** output version.

Mechanizm: **idempotencja jest na outpucie, nie tylko na inpucie.** Sam `idempotency_key` na `compute_jobs` (unikalny per `organization_id + job_type`) chroni tylko przed podwójnym **enqueue** tego samego żądania (np. użytkownik double-klika „Wylicz” — drugie żądanie z tym samym kluczem dostaje ten sam `job_id` zamiast tworzyć drugi job, `INSERT ... ON CONFLICT (organization_id, job_type, idempotency_key) DO NOTHING` + `SELECT` istniejącego wiersza). To NIE chroni przed podwójnym commitem z dwóch prawdziwych, równoległych wykonań tego samego joba (scenariusz worker A / worker B powyżej) — do tego służy `compute_job_outputs`.

Commit wykonywany przez worker po zakończeniu liczenia, w jednej transakcji:

```sql
BEGIN;

-- 1. Worker próbuje skomitować swój wynik. ON CONFLICT DO NOTHING na
--    UNIQUE(job_id) oznacza: jeśli JAKAKOLWIEK wcześniejsza próba tego joba
--    już skomitowała, ten INSERT nic nie robi i nie zwraca wiersza.
INSERT INTO compute_job_outputs (
  job_id, organization_id, output_artifact_id, output_working_revision_id,
  committed_by_attempt_number, content_semantic_hash, freshness
) VALUES ($1, $2, $3, $4, $5, $6, 'CURRENT')
ON CONFLICT (job_id) DO NOTHING
ON CONFLICT (organization_id, output_artifact_id, content_semantic_hash) DO NOTHING
RETURNING id;

-- 2. Jeśli krok 1 zwrócił wiersz (ten worker jest pierwszym committerem):
--    zapisz efekt biznesowy do working_revision (WP-B01 tabela), w TEJ SAMEJ
--    transakcji, żeby output i biznesowy zapis commitowały się atomowo razem.
--    (Szczegóły working_revision UPDATE/INSERT — poza zakresem WP-B04,
--    kontrakt WP-B01/WP-B02.)

-- 3. Zawsze (niezależnie czy krok 1 wstawił wiersz, czy trafił w conflict):
UPDATE compute_jobs
SET status = 'succeeded', finished_at = now(), lease_owner = NULL
WHERE id = $1 AND status = 'running';

UPDATE compute_job_runs
SET outcome = 'succeeded', finished_at = now()
WHERE job_id = $1 AND attempt_number = $5;

COMMIT;
```

**Efekt**: worker, który przegrywa wyścig (jego `INSERT` trafia w `ON CONFLICT`), i tak bezpiecznie oznacza swój `job`/`run` jako succeeded (bo wynik faktycznie istnieje — tylko skomitowany przez kogoś innego) i **nie duplikuje** efektu biznesowego, bo krok 2 jest warunkowy na tym, czy krok 1 faktycznie wstawił wiersz. To jest odpowiedź na wymaganie briefu „idempotency key na output, nie tylko na input” — `UNIQUE(job_id)` to idempotencja na poziomie joba (broni przed dwoma wykonaniami TEGO SAMEGO joba), `UNIQUE(organization_id, output_artifact_id, content_semantic_hash)` to idempotencja na poziomie treści (broni przed dwoma RÓŻNYMI jobami, które przez wyścig enqueue policzyły identyczny, deterministyczny wynik dla tego samego inputu).

### 6.1 Edycja w trakcie run (staleness, nie silent overwrite)

Jeśli `input_revision_hash` przypięty do joba przy enqueue różni się od aktualnego hasha working revision w momencie commitu (bo użytkownik edytował draft, gdy job jeszcze liczył), commit **nadal się wykonuje** (worker nie przerywa w połowie), ale `freshness` w `compute_job_outputs` jest ustawiane na `STALE_ASSUMPTIONS` zamiast `CURRENT` — dokładnie zgodnie z master planem §2.3: „po edycji w trakcie run zwraca wynik oznaczony jako stale wobec nowej rewizji”. UI musi czytać `freshness`, nie tylko obecność outputu, żeby nigdy nie pokazać stale wyniku jako aktualnego — to jest bezpośrednia naprawa OWN-FIN-018 („timeout nie może pozostawiać pozornie aktualnych danych”, tu uogólnione na „żadna ścieżka nie może”).

---

## 7. Cancel + kill switch

### 7.1 Per-job cancel

`POST /jobs/:id/cancel` (autoryzacja: ten sam org, rola co najmniej taka jak wymagana do uruchomienia compute):

```sql
UPDATE compute_jobs
SET cancel_requested_at = now(), cancel_reason = $2
WHERE id = $1 AND status IN ('queued','running')
RETURNING status;
```

- Jeśli job jest `queued`: reaper/claim-loop może od razu przestawić go na `cancelled` przy najbliższym cyklu (nigdy nie zostanie claimnięty, bo claim-query dodatkowo filtruje `cancel_requested_at IS NULL`).
- Jeśli job jest `running`: to jest **cooperative cancellation**, nie hard kill. Worker musi sam sprawdzać `cancel_requested_at` przy naturalnych checkpointach silnika (analogicznie do §7.2/heartbeatu — silnik `computeModel` już dziś ma naturalne iteracje: „Monthly compute resolution” per okres, `financialModelingService.ts:853` — checkpoint po każdym policzonym okresie jest naturalnym miejscem). Gdy worker wykryje `cancel_requested_at IS NOT NULL`, przerywa liczenie, NIE commituje outputu, i zamyka job: `status='cancelled'`, `compute_job_runs.outcome='cancelled'`.
- Fallback, gdyby silnik nie zdążył sprawdzić flagi (długi pojedynczy krok bez checkpointu): lease naturalnie wygasa (§5.3), job wraca do `queued`, i albo zostanie odrzucony przy następnym claimie (`cancel_requested_at IS NOT NULL` w warunku), albo — jeśli chcemy szybszego efektu niż pełny lease timeout — osobny sweep jak reaper, ale filtrujący `cancel_requested_at IS NOT NULL AND status='running' AND lease_expires_at > now()`, oznacza job jako `cancelled` bez czekania na wygaśnięcie lease (twardszy tryb, wymaga że worker fizycznie umrze/zostanie zabity przez orchestrator — poza zakresem czystego SQL, nota w §12).

### 7.2 Kill switch (per-org i globalny)

Feature flag sprawdzany **dwukrotnie**:

1. **Przed claimem** — `is_org_compute_killed(organization_id, job_type)` w warunku claim-query (§5.1). Nowe joby dla zabitego org/global nigdy nie zaczynają się wykonywać, nawet jeśli już czekają w `queued`.
2. **W trakcie pracy** — silnik sprawdza flagę przy tych samych checkpointach co `cancel_requested_at` (§7.1) i przy heartbeacie (§5.2). Jeśli flaga zmieni się na killed w trakcie długiego runu, worker przerywa tak samo jak przy cancel, ale `compute_job_runs.outcome='killed'` (odróżnione od `cancelled` w audycie — killed = operator/kill switch, cancelled = użytkownik/per-job).

Implementacja flagi: nowa tabela lub rozszerzenie istniejącego mechanizmu flag (`v8_feature_flags` — pamięć zespołu ostrzega, że demo ma `search_path` bez `v8`, więc każdy odczyt musi kwalifikować schemat jawnie, np. `v8.v8_feature_flags`, żeby nie trafić po cichu w pustą `public.*`). Granularność: `(organization_id NULL = global, job_type NULL = wszystkie typy)` — global kill switch to wiersz z `organization_id IS NULL`, sprawdzany zawsze dodatkowo do ewentualnego per-org wiersza.

---

## 8. Per-org concurrency limits

Wymuszone **jako semafor liczony wewnątrz tej samej transakcji claimu**, nie jako trzymany przez cały czas trwania joba advisory lock. Zobacz podzapytanie w §5.1:

```sql
(SELECT count(*) FROM compute_jobs r
 WHERE r.organization_id = compute_jobs.organization_id
   AND r.job_type = compute_jobs.job_type
   AND r.status = 'running') < org_concurrency_limit(organization_id, job_type)
```

**Uzasadnienie wyboru semafora-przez-COUNT zamiast trzymanego advisory locka:** advisory lock trzymany „przez cały czas trwania joba” (sesyjny, nie `_xact_`) wymagałby, żeby worker jawnie go zwolnił na końcu — a to dokładnie ten sam problem co lease: crash workera zostawiłby lock zawieszony, wymagając osobnego mechanizmu odzyskiwania identycznego do reapera. Skoro reaper (§5.3) już i tak odzyskuje zawieszone joby przez `lease_expires_at`, sam wiersz `status='running'` JEST tokenem współbieżności — nie trzeba go duplikować drugim mechanizmem blokad. To upraszcza system do jednego źródła prawdy o "ile jobów danego org+typu faktycznie się teraz liczy": `COUNT(*) WHERE status='running'`.

Advisory lock (`pg_advisory_xact_lock`, wzorzec z §1.4) jest nadal używany, ale **transakcyjnie i krótkotrwale** — wyłącznie do serializacji samego momentu enqueue/claimu, żeby dwa równoległe requesty nie policzyły `COUNT(*)` niespójnie (race na granicy limitu). To jest różne zastosowanie niż „trzymaj lock przez cały run”.

Domyślny limit (`org_concurrency_limit`) jest per `job_type` — konkretna liczba to decyzja operacyjna, nie architektoniczna (patrz §12), sugerowany start: mały (1-2) dla `job_type` klas ciężkich (valuation/prediction z pełnym DAG), wyższy dla lekkich.

---

## 9. Relacja do HTTP — dokładny kontrakt

To zastępuje dzisiejszy synchroniczny `POST /models/:modelId/compute` (§1.2) z globalnym timeoutem. Ścieżki poniżej są przykładem dla `job_type='model_compute'`; ten sam kontrakt generalizuje na `prediction_compute`/`valuation_compute` innym `job_type` i innym `input_artifact_id`.

### 9.1 `POST /api/v8/finance/models/:modelId/compute`

Zachowuje dzisiejszy URL (adapter warstwy WP-C02 może przekierować stary route na nowy job-based handler bez zmiany ścieżki widocznej dla FE — zgodnie z „API freeze” z WP-A02). Zmienia się kontrakt odpowiedzi.

**Request:**
```
Headers:
  Idempotency-Key: <opcjonalny, string> — jeśli brak, serwer generuje deterministyczny
                    klucz z (organizationId, modelId, inputRevisionHash) tak, żeby
                    dwa "Wylicz" na tym samym stanie draftu bez nagłówka i tak się
                    zdeduplikowały.
Body (opcjonalne):
  { "engineManifestId": "<uuid, opcjonalny>" }   -- domyślnie: aktualny aktywny manifest
```

**Response `202 Accepted`** (nowy job, albo istniejący `queued`/`running` znaleziony po idempotency key):
```json
{
  "data": {
    "jobId": "b3f1...uuid",
    "jobType": "model_compute",
    "status": "queued",
    "organizationId": "org-uuid",
    "inputArtifactId": "model-uuid",
    "inputRevisionHash": "sha256:...",
    "createdAt": "2026-08-09T12:00:00.000Z",
    "pollUrl": "/api/v8/finance/jobs/b3f1...uuid"
  },
  "meta": { "version": "v8", "contract": "finance_compute_job_v1" }
}
```

**Response `409 Conflict`** (org/global kill switch aktywny, ALBO per-org concurrency limit osiągnięty w momencie próby enqueue):
```json
{
  "error": "compute_unavailable",
  "reason": "org_kill_switch" ,           // albo "concurrency_limit_reached"
  "retryAfterSeconds": 30
}
```
z nagłówkiem `Retry-After: 30`.

**Response `404`**: model nie istnieje / nie należy do org — bez zmian względem dziś.

Kontrakt **nigdy** nie zwraca `200` z gotowym wynikiem z tego endpointu — to jest właśnie różnica względem dzisiejszego zachowania (§1.2). Wynik jest zawsze pobierany przez `GET /jobs/:id`.

### 9.2 `GET /api/v8/finance/jobs/:jobId`

**Response `200`** (przykład `running`):
```json
{
  "data": {
    "jobId": "b3f1...uuid",
    "jobType": "model_compute",
    "status": "running",
    "attemptCount": 1,
    "maxAttempts": 5,
    "createdAt": "2026-08-09T12:00:00.000Z",
    "startedAt": "2026-08-09T12:00:01.500Z",
    "finishedAt": null,
    "error": null,
    "output": null
  },
  "meta": { "version": "v8", "contract": "finance_compute_job_v1" }
}
```

**Response `200`** (przykład `succeeded`, świeży wynik):
```json
{
  "data": {
    "jobId": "b3f1...uuid",
    "jobType": "model_compute",
    "status": "succeeded",
    "attemptCount": 1,
    "maxAttempts": 5,
    "createdAt": "2026-08-09T12:00:00.000Z",
    "startedAt": "2026-08-09T12:00:01.500Z",
    "finishedAt": "2026-08-09T12:00:14.900Z",
    "error": null,
    "output": {
      "outputWorkingRevisionId": "rev-uuid",
      "outputBusinessVersionId": null,
      "contentSemanticHash": "sha256:...",
      "freshness": "CURRENT",
      "committedAt": "2026-08-09T12:00:14.800Z"
    }
  },
  "meta": { "version": "v8", "contract": "finance_compute_job_v1" }
}
```

**Response `200`** (przykład `succeeded`, ale wynik `STALE_ASSUMPTIONS` — patrz §6.1): identyczny kształt, `output.freshness = "STALE_ASSUMPTIONS"`. FE musi to jawnie oznaczyć w UI (np. banner „wynik nieaktualny — draft zmienił się od momentu liczenia”), nigdy nie renderować jako zwykły succeeded.

**Response `200`** (przykład `failed`, DLQ — patrz §10):
```json
{
  "data": {
    "jobId": "b3f1...uuid",
    "status": "failed",
    "attemptCount": 5,
    "maxAttempts": 5,
    "error": "circular reference in schedule X unresolved after deterministic solver limit",
    "deadLetter": true,
    "output": null
  },
  "meta": { "version": "v8", "contract": "finance_compute_job_v1" }
}
```

**Response `404`**: job nie istnieje albo `organization_id` joba nie zgadza się z kontekstem żądania (tenant isolation, spójne z WP-A04).

Kontrakt polling: FE odpytuje `GET /jobs/:id` w interwale (np. 1-2 s z backoffem), zatrzymuje się na dowolnym stanie terminalnym (`succeeded`/`failed`/`cancelled`). Brak WebSocket/SSE w tym ADR — to jest możliwe rozszerzenie AP-warstwy UX, nie część WP-B04 (patrz §12).

---

## 10. Retry / DLQ

- **Liczba prób**: `max_attempts` per `compute_jobs` (domyślnie 5, per `job_type` konfigurowalne — konkretna liczba dla każdego typu to decyzja operacyjna, nie część tego ADR).
- **Backoff**: wykładniczy z jitterem, liczony przy każdym requeue (reaper §5.3 albo jawny retry po `failed`-retryable błędzie zgłoszonym przez worker): `next_attempt_at = now() + LEAST(cap, base * 2^attempt_count) + random_jitter`, `base = 30s`, `cap = 15min`.
- **Rozróżnienie błędów retryable vs nie-retryable**: worker, który łapie wyjątek w trakcie liczenia, klasyfikuje go przed zapisem (`compute_job_runs.outcome='failed'`, `compute_jobs.error`). Błędy infrastrukturalne (utrata połączenia z DB, OOM) są retryable — job wraca do `queued` z backoffem, tak jak lease-expiry. Błędy deterministyczne (matematycznie nieokreślona operacja — cykl bez zbieżnego solvera, zgodnie z master planem §1.7 „Blokuje tylko security/tenant breach oraz matematycznie nieokreśloną operację”) są nie-retryable: job idzie od razu do `failed`/`deadLetter=true` niezależnie od `attempt_count`, bo ponawianie identycznego inputu da identyczny błąd.
- **DLQ**: nie jest osobnym statusem w enumie (enum z briefu ma tylko `queued/running/succeeded/failed/cancelled`) — DLQ to **`status='failed' AND (attempt_count >= max_attempts OR error_classified_as_non_retryable)`**, odróżnione od zwykłego pojedynczego failed przez `deadLetter` computed flag zwracany w API (§9.2), a nie osobną kolumnę stanu — utrzymuje to state machine z briefu dokładnie w pięciu stanach.
- **Kto widzi DLQ**: WP-B05 exception/reconciliation ledger jest kanonicznym konsumentem — każdy job, który trafia do DLQ, powinien wygenerować wpis w tym ledgerze (severity zależna od `job_type`: compute failure na Baseline Model to co najmniej `Warning`, na Valuation zbliżającej się do approval — `Material`). To jest **wyłącznie referencja** — projekt samego ledgera i UI „exception inbox” (AP-08) należy do WP-B05, nie jest tu projektowany, zgodnie z briefem.

---

## 11. Relacja do Gate C i istniejącego kodu (poza zakresem WP-B04)

Ten ADR jest kontraktem (Gate B). Fizyczne dodanie migracji (`server/migrations/...`), worker proces, oraz podpięcie `POST /models/:modelId/compute` pod nowy job-based handler (z zachowaniem starego URL przez adapter — spójne z WP-A02 „SUPPORTED_FROZEN”) należą do:

- **WP-C01** Additive migrations — trzy tabele z §3 jako nowe, sekwencyjne migracje, bez dotykania istniejących.
- **WP-C02** Compatibility services — `computeJob` jako nowy canonical service; stary handler `finance.routes.ts:718-747` staje się cienkim adapterem, który (a) w compat-window nadal może synchronicznie czekać na `succeeded`/`failed` z krótszym wewnętrznym pollingiem i zwracać stary kształt payloadu (zamrożone fixtures z WP-A02), (b) docelowo FE przechodzi na `202`+polling.
- Naprawa fasady BUG-10 (`/models/:modelId/analyze`) jest naturalnym pierwszym konsumentem tego mechanizmu przy realizacji — dziś zwraca fikcyjny `202 queued` bez backendu (§1.3); po WP-C01/C02 powinien albo faktycznie enqueue'ować `job_type='model_analyze'`, albo zostać usunięty, jeśli funkcja nie jest w zakresie MVP. Decyzja nie należy do WP-B04.

---

## 12. Otwarte pytania / decyzje operacyjne (nie blokują zatwierdzenia ADR, ale wymagają DEC-FIN-012 przed WP-C01)

1. Dokładny czas trwania lease (`interval` w §5.1) i interwał heartbeatu — zależy od realnego p95 czasu liczenia największego modelu (Enterprise Valuation z pełnym DAG); do zmierzenia na runtime, nie zgadywane tu.
2. Domyślne `org_concurrency_limit` per `job_type` — decyzja pojemnościowa/kosztowa.
3. Autorytatywna lista `job_type` (`model_compute`, `prediction_compute`, `valuation_compute`, ewentualnie `model_analyze` po naprawie BUG-10) — powstanie wraz z WP-D03/D04/D05.
4. Twardy kill workera przy `cancel`/kill switch (poza cooperative checkpointami) wymaga integracji z orchestratorem procesów (SIGTERM/restart), poza zakresem czystego SQL — do rozstrzygnięcia z SRE przy WP-C01.
5. WebSocket/SSE zamiast pollingu dla `GET /jobs/:id` — możliwa optymalizacja UX, nie blokuje MVP kontraktu z §9.
6. Zewnętrzny broker (pg-boss/BullMQ) jako krok 2, jeśli wolumen przekroczy to, co udźwignie pojedyncza tabela Postgres z rozsądną liczbą workerów — świadomie odroczone, nieprojektowane tutaj.

---

## 13. Definition of Done dla WP-B04 (wkład do „Exit Gate B”)

Zgodnie z master planem §„Exit Gate B” („Zatwierdzone ADR, ERD/DDL, API, lifecycle, permissions, job state machine, exception policy, retention/export contracts i wykonywalne test vectors”), WP-B04 dostarcza:

- [x] ADR (ten dokument) opisujący decyzję persisted PG queue i uzasadnienie względem alternatyw.
- [x] DDL sketch trzech tabel (`compute_jobs`, `compute_job_runs`, `compute_job_outputs`) z kluczami idempotencji na inpucie I na outpucie.
- [x] State diagram `queued→running→succeeded/failed/cancelled` z pełnym pokryciem przejść (włącznie z lease-expiry-requeue).
- [x] Dokładny kontrakt `POST /compute` (202 + job_id) i `GET /jobs/:id` (polling), zastępujący dzisiejszy synchroniczny endpoint z niewidocznym w kodzie ok. 20 s timeoutem (OWN-FIN-018).
- [x] Retry/backoff/DLQ policy z jawnym odróżnieniem retryable/non-retryable i referencją (nie projektem) do WP-B05 jako konsumenta DLQ.
- [ ] Wykonywalne test vectors (fault injection: crash workera w trakcie run, dwa równoległe committy, cancel w trakcie run, kill switch w trakcie run, wyczerpanie retry) — do dostarczenia przy implementacji w Gate C, nie w tym ADR.
- [ ] ERD diagram (wizualny) — opcjonalny dodatek do tego ADR, nie blokuje zatwierdzenia treści.

Status realizacji WP-B04 jako całości: **ADR gotowy do review; implementacja (migracje, worker, endpointy) czeka na Gate C zgodnie z kolejnością fal z master planu §7.**
