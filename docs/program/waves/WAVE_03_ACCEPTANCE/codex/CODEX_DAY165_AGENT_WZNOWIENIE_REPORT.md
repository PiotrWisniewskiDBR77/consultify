# CODEX DAY165 — wznowienie agenta po akceptacji

Data: 2026-08-30  
Marker: `22124537f7`  
Gałąź: `codex/day165-wznowienie-agenta-20260830`  
Werdykt wykonawcy: **PARTIAL / RDZEŃ R0–R4 DZIAŁA, jeden zastany test wymaga aktualizacji poza licencją**.

## §0.1 — wejście

Wolne miejsce: `32Gi` (powyżej bramki 5 GB).

```text
22124537f7 merge: dyzur 161 (lancuch migracji od pustej bazy przechodzi 868/868 — A; bramka niewpieta — C) — odbior adwersaryjny
MARKER OK
22124537f7c4e5ac523dc97ada2291f955721e3c
```

Sanity `git status --short | head -3`: pusty wynik. Tip gałęzi administracyjnej uciekł do `18ba1bd3cf`; zgodnie z instrukcją praca zaczęła się dokładnie z markera. Worktree dyżuru 164 początkowo nadal istniał, więc wykonawca zatrzymał się. Po potwierdzeniu nadzorcy: brak wpisu worktree, brak katalogu i `a33a7bcb3a` jest przodkiem tipa.

## BLOK 0 i Z30

- PostgreSQL: własny `pgvector/pgvector:pg16`, kontener `cx-day165-pg`, `127.0.0.1:6056`, baza `cx165`.
- Migracje: pierwszy pełny przebieg zakończony `✅ Postgres migrations complete`; drugi: `Applying migrations: 0`, `✅ Postgres migrations complete`.
- Redis `6379` był zajęty przez obcy `redis-server` PID 2165. Użyto własnego `cx-day165-redis` na `127.0.0.1:6390`; `PONG`.
- Runtime `4998` i `4999`: oba wolne; pełnego `server/src/index.ts` nie uruchamiano.

```text
BRAK ZMIENNYCH POCZTY
 key | left
-----+------
(0 rows)
BRAK DRENAZY W GATEWAY
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Zmiany

### R0 — źródło fałszywego sukcesu

W `server/src/workers/aiWorker.ts` zmieniono wyłącznie licencjonowane zamknięcie zadania: `finishAgentTask(..., true)` jest wołane tylko dla `result.status` równego `completed` albo `completed_with_errors`. Checkpoint zgody kończy job BullMQ normalnie, bez retry, ale receipt nie dostaje fałszywego `SUCCEEDED`.

Mutacja do starego bezwarunkowego zamknięcia dała czerwień:

```text
expected 'SUCCEEDED' not to be 'SUCCEEDED'
day165.agent-plan-resume.pg.redis.test.ts:84
```

### R2 — klucz idempotencji

Wybrano `route:<planId>:approval:<approvalCount>`, gdzie `approvalCount` jest liczbą kroków z `approvedAt` w aktualnym planie. `currentStepIndex` odrzucono: `approveStep` go nie zmienia, zatem nie odróżniłby run od resume. Licznik akceptacji jest stały dla podwójnego kliknięcia tego samego stanu i rośnie dokładnie po akceptacji.

Realny readback dla jednego planu:

```text
route:199716c2-4483-45d5-adb7-bdb6d4742cdb:approval:0  RUNNING
route:199716c2-4483-45d5-adb7-bdb6d4742cdb:approval:1  ENQUEUED
```

Mutacja do `route:${planId}` dała czerwień:

```text
expected 'replayed' to be 'enqueued'
day165.agent-plan-resume.pg.redis.test.ts:88
```

Po obu mutacjach pliki odtworzono z kopii w scratch; finalny przebieg jest zielony.

### R3 — koniec maskowania REPLAY

`tryDispatchBackgroundExecution` zwraca `replayed` dla `REPLAY/governed.replayed`, `enqueued` wyłącznie dla realnego `ENQUEUED`, a w pozostałych przypadkach `unavailable`. Wszystkie trzy call site'y korzystają z tej samej funkcji. `AgentPlanPanel.tsx` na ścieżkach run i approve odczytuje `dispatch`; gdy wartość nie jest `enqueued`, pokazuje jeden komunikat: `Nie zakolejkowano nowego wykonania planu.`

Nie zmieniono `src/services/api/agentPlan.api.ts`, ponieważ tabela licencji daje tylko odczyt. Jego unie nadal nie wymieniają `replayed`; jest to dług typów do osobnej licencji.

### R1/R4 — realny HTTP, PG, Redis i worker

Config dowodowy: `/private/tmp/cx-day165-wznowienie-agenta-scratch/day165.vitest.config.ts`. Dziedziczy `server/vitest.config.ts`, ustawia root `/private/tmp/cx-day165-wznowienie-agenta/server` i jawnie nadpisuje zastane `test.env.DB_TYPE='sqlite'` na `postgres`. Bez tego configu pierwszy przebieg poprawnie był czerwony: `expected 'sqlite' to be 'postgres'`. Pierwsze dwa selektory z niewłaściwym cwd dały `0` testów i nie są liczone jako PASS.

Finalna komenda zawierała w tej samej linii: `RUN_DB_TESTS=1 RUN_REDIS_TESTS=1 MOCK_DB=false MOCK_REDIS=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce ENABLE_AI_TASKS_WORKER=true DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6056/cx165 REDIS_URL=redis://127.0.0.1:6390 JWT_SECRET=<lokalny sekret testowy>`, `--retry=0` i wskazany wyżej config.

Finalny JSON: 2/2 PASS po pełnych nazwach:

```text
DAY165 agent plan resumes after approval — real PG + Redis keeps checkpoint receipt non-SUCCEEDED and enqueues a distinct approval generation
DAY165 agent plan resumes after approval — real PG + Redis resumes through real ApiGateway HTTP and records the escape paths
```

Drugi przypadek idzie przez `ApiGateway.getInstance().initializeRoutes(app)`, realny `verifyToken`, HTTP, realny Postgres, realny Redis i realny worker. Dosłowny przebieg:

1. create: HTTP `201`, `dispatch=deferred`, plan `planning`;
2. run: HTTP `200`, `dispatch=enqueued`;
3. checkpoint: plan `awaiting_approval`, `currentStepIndex=0`, krok `awaiting_approval`, receipt `RUNNING`, klucz `approval:0`;
4. approve: HTTP `200`, `dispatch=enqueued`, krok `pending`, drugi receipt `ENQUEUED`, klucz `approval:1`;
5. ponowny run: HTTP `409`, `Plan not runnable in status 'completed' (only 'planning')`;
6. ponowne approve: HTTP `409`, `Step not awaiting approval`; redrive starego receipt: `AGENT_DISPATCH_NOT_REDRIVABLE`.

W teście wykonanie zatwierdzonego kroku przechodzi przez realny silnik `executePlan`, ale executor narzędzia jest deterministyczną funkcją lokalną. Nie wykonano LLM ani zewnętrznego side effectu; realne wykonanie produkcyjnego `create_task` pozostaje **NOT_PROVEN**.

## Artefakty

```text
5daf7c5522510e8ad9f7105ff8a7e698b23efa5b3dcf9feef1d603fa660e85b8  day165-final.json
f4a1d1035583753675377f2d34c1a24711cac3226d4becd888e5bd1956ff53a5  day165-http-evidence.json
243ff3dea385febe117578828bcab99d708c1e810eaf825f369b2e1d85028722  day165-red-old-key.json
5414c9c340ca563b766e1b7a4cb590ac2678d3886fc17758d8009d06a26fcd88  day165-red-r0-unconditional-success.json
1747405f87e2150e50fee703b7d05a7399fcf8642adeca1fc3acaba089dd64bf  day165.vitest.config.ts
```

Artefakty leżą w `/private/tmp/cx-day165-wznowienie-agenta-artefakty`, config w `/private/tmp/cx-day165-wznowienie-agenta-scratch`.

## Pomiar zasięgu i regresje

Wydana instrukcja odwołuje się do `§0.4a`, ale nie zawiera takiej sekcji (nagłówki przechodzą z `0.2d` do `0.5`). W zastępstwie zmierzono listę diffu względem markera i uruchomiono pakiet istniejący `agentTaskDispatchService.pg.redis.test.ts`: 6/7 PASS. Czerwony pełny przypadek: `links Bull exhaustion to durable FAILED, explicit redrive and terminal success`. Test mockuje `executeBackgroundPlan` jako `{ id }` bez `status`; po R0 taki wynik nie może już zostać oznaczony `SUCCEEDED`. Plik testu jest poza licencją; nie zmieniono go. To jest przyczyna werdyktu `PARTIAL`.

ESLint nowego testu: 0 błędów, 5 ostrzeżeń o non-null assertions. `git diff --check`: PASS. Zastane błędy formatowania w pozostałej części `aiWorker.ts` nie zostały naprawione poza licencjonowaną linią.

## Korekty wobec instrukcji

1. R0 i tabela licencji jawnie zezwalają zmienić jedną linię `aiWorker.ts`; Z40/B8 mówią o zerowym diffie w `workers/**`. Po imiennym potwierdzeniu nadzorcy zastosowano nowszą, węższą licencję R0. Nie dotknięto żadnej innej linii semantycznej w `workers/**` ani `server/src/cron/Scheduler.ts`.
2. `§0.4a` nie istnieje w wydanym dokumencie. Nie przepisano cudzej liczby; podano własny zakres diffu i pełne nazwy testów.
3. Instrukcja oczekiwała reprodukcji starego defektu przed naprawą. Chronologicznie pełny HTTP uruchomiono po zmianie; stary mechanizm odtworzono mutacyjnie na tym samym PG/Redis i teście. Dlatego dowód starego stanu jest **RECONSTRUCTED**, nie „przed naprawą”.

## TWIERDZENIA NIEZWERYFIKOWANE

- Produkcyjny `create_task` nie został wykonany; użyto lokalnego deterministycznego executora, aby nie uruchamiać LLM ani zewnętrznych efektów ubocznych.
- Nie uruchomiono pełnego `server/src/index.ts`, przeglądarki ani runtime na `4998/4999`; zmiana UI jest statyczna, bez zrzutu właścicielskiego.
- Unia `dispatch` w odczytowym `src/services/api/agentPlan.api.ts` nadal nie deklaruje `replayed`.
- Receipt checkpointu pozostaje `RUNNING` po normalnym zakończeniu joba BullMQ; jest to uczciwsze niż `SUCCEEDED` i nie uruchamia retry, ale schemat nie ma stanu `CHECKPOINTED`. Decyzja o nowym stanie/migracji jest poza zakresem.
- `ENABLE_AI_TASKS_WORKER` nadal nie występuje w `server/src/config/FeatureFlags.ts`; zgodnie z Z40 nie dopisano go.

