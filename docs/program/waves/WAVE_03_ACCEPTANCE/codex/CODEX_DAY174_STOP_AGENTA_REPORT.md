# CODEX — DYŻUR 174 — RAPORT

Data: 2026-08-30  
Gałąź: `codex/day174-stop-agenta-20260830`  
Marker: `d3d36cd5f5`  
Commit rdzenia: `8be3c25870`  
Werdykt: **PARTIAL — rdzeń R1, R2 i R3 zaimplementowany; dowody mutacyjne są czerwone, ale nie wszystkie zamówione warianty runtime zostały zmierzone.**

## Wejście i baza

Wynik §0.1 (2):

```text
MARKER OK
```

Wynik §0.1 (7):

```text
d3d36cd5f51ed9db796bb350c1109ebc2e4b705c
```

`git status --short | head -3` nie wypisał nic. Dysk: 26 GiB wolne. Porty `6074`, `5018`, `5019`, `6404` były wolne. Tip `github-backup/codex/m03-admin-20260824` był 7 commitów przed markerem; zgodnie z DEC-2026-08-26-95 praca zaczęła się dokładnie z markera. Lista rozjazdu obejmowała dokumenty dyżurów 174–179 oraz niezwiązane zmiany produktu; scalanie pozostawiam nadzorcy.

Pełne migracje na `cx-day174-pg` (`pgvector/pgvector:pg16`, `127.0.0.1:6074`, baza `cx174`): pierwszy przebieg `Applying migrations: 869`, drugi `Applying migrations: 0`; oba zakończyły się `✅ Postgres migrations complete`. Redis: `cx-day174-redis`, `127.0.0.1:6404`.

## Z30 — brak wysyłki

```text
BRAK ZMIENNYCH POCZTY
 key | left
-----+------
(0 rows)
BRAK DRENAZY W GATEWAY
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Pomiar wejściowy T1–T5

Pomiar potwierdził wszystkie tezy bez korekty: `cancelPlan` miał trzy zapisy i nie dotykał receipt/lease; `finalizePlan` mógł nadpisać anulowanie; worker nie zamykał receipt dla `cancelled`; `estimatedCostUsd: 0` występował w liniach 157 i 1058; polityka miała jednego czytelnika produkcyjnego, sześć piszących skryptów dowodowych i zero pisarzy produktowych.

## R1 — anulowanie

Wybrany kształt:

- przed każdym z maksymalnie 12 kroków jest jeden dodatkowy `SELECT status`;
- `cancelled` powoduje kontrolowane zwolnienie lease bez zmiany statusu i zwrot aktualnego planu;
- `finalizePlan` zapisuje wyłącznie przy `status = 'executing'`, więc nie nadpisze późnego anulowania;
- worker domyka świadome anulowanie przez `finishAgentTask(..., true)`, czyli receipt `SUCCEEDED` oznacza obsłużenie żądania, nie wykonanie wszystkich kroków;
- nie wprowadzono nowego stanu receipt i nie zmieniono `dispatchKey`, replay ani redrive.

Test real PG+Redis: skutek kroku 1 wystąpił; skutki kroków 2 i 3 nie wystąpiły (`[1]`); plan pozostał `cancelled`; lease został wyczyszczony; receipt był `SUCCEEDED`, nie `RUNNING`; `redriveAgentTask` zwrócił `AGENT_DISPATCH_NOT_REDRIVABLE` zgodnie z przyjętą semantyką terminalnego receipt.

Mutacja: usunięcie wyłącznie kontroli statusu z pętli dało 0/1 PASS; rzeczywiste skutki wyniosły `[1,2,3]` zamiast `[1]`.

## R2 — koszt

Nowy deterministyczny cennik per `toolName`:

- `search_web`: USD 0.02 (zewnętrzny lookup);
- `query_structured_data`: USD 0.01 (modelowe text-to-SQL);
- pozostałe zarejestrowane narzędzia i nieznane nazwy: USD 0.00, ponieważ na markerze wykonują pracę lokalną, zwracają proposal/no-op JSON albo kopertę `Unknown tool`.

Koszt enqueue pozostaje 0: rezerwuje tylko przyjęcie do kolejki, nie zewnętrzne wykonanie narzędzia. Default polityki USD 0.25 jest wyższy od maksymalnego kosztu 12 kroków `search_web`: `12 × 0.02 = 0.24`, więc domyślnie nie blokuje poprawnego planu. Jawna polityka USD 0.01 odmówiła kroku USD 0.02 z `resource_estimated_cost_limit_exceeded`.

Mutacja `search_web: 0` dała 1/3 PASS: asercja kosztu i odmowa niskiego limitu były czerwone. Zastany defekt retry pozostaje poza zakresem: released reservation wraca jako niedozwolony idempotent replay.

Semantyka `continue-on-error` nie została zmieniona: po odmowie kosztowej pętla próbuje pozostałe kroki i może wygenerować kolejne odmowy.

## R3 — pisarz polityki

Wybrano leniwy zapis pod istniejącym `pg_advisory_xact_lock`: po braku aktywnej polityki kod robi `INSERT ... ON CONFLICT (organization_id, project_id) DO NOTHING`, następnie ponowny `SELECT ... enabled = 1 FOR UPDATE`. Defaults: concurrency 4, cost USD 0.25, lease 300 s. Nie dodano env ani migracji.

Konflikt z wyłączonym wierszem nie zmienia ustawienia operatora: `ON CONFLICT DO NOTHING`, ponowny odczyt nadal nie znajduje aktywnej polityki i rzuca `resource_policy_not_found`. Test potwierdził oba przypadki. Wariant migracyjny odrzucono: nie pokrywa par org/projekt utworzonych po migracji. Fallback bez wiersza odrzucono przez FK `policy_id NOT NULL`.

Mutacja usuwająca leniwy INSERT dała 1/3 PASS, a dwa przypadki padły na `resource_policy_not_found`.

## Dowody i pułapki

Komenda backendowa była uruchomiona z katalogu `server/` i `--config vitest.config.ts`; pierwsza próba z root-relative ścieżkami dała 0 testów i nie jest dowodem. Każdy test integracyjny asertuje `DB_TYPE=postgres`, `MOCK_REDIS=false`, `ENABLE_AI_TASKS_WORKER=true`. Pełny env PG/Redis, bramki i auth był w tej samej linii; `--retry=0` w każdej komendzie. Test nie używa HTTP/auth, więc pułapki `ENABLE_V8_GLOBAL`, auth bypass i internal-beta nie leżą na mierzonej ścieżce; wartości mimo to ustawiono fail-closed. Dowód R1 używa realnego BullMQ workera i realnego receipt, dowód R2/R3 realnej transakcji PG z advisory lock.

Final green: 4/4 PASS, 0 FAIL, 0 pending. Nazwy:

1. `DAY174 cancellation — real PG + Redis stops after step one, preserves cancelled, and closes the receipt`
2. `DAY174 resource policy and cost — real PG + Redis creates an enabled default policy on first use and charges deterministic tool cost`
3. `DAY174 resource policy and cost — real PG + Redis makes a low cost limit visibly deny the priced tool`
4. `DAY174 resource policy and cost — real PG + Redis does not replace an explicitly disabled policy`

Regresja worker unit: 5/5 PASS, 0 pending, porównane po `fullName`. `tsc --noEmit --project server/tsconfig.json` i `git diff --check` zakończyły się bez komunikatu błędu.

Artefakty:

- `/private/tmp/cx-day174-stop-agenta-artefakty/day174-final-green.json` — `aa7d4fa60501b31fad3b57f36b17975f30dff976df102f325a1daf43e1551cb0`
- `/private/tmp/cx-day174-stop-agenta-artefakty/day174-r1-mutant-red.json` — `1a8a1d8c58313c5f72a39bb02f57675e02b09262760298b0c8f6aee733d28f7e`
- `/private/tmp/cx-day174-stop-agenta-artefakty/day174-r2-mutant-red.json` — `857667a1952eb48f2387cdc0e84c2b710b2b459a6aac07bc154ed915b0f7fdeb`
- `/private/tmp/cx-day174-stop-agenta-artefakty/day174-r3-mutant-red.json` — `673631091c172b2cef3709aafca4c76a3adf64e72950c7a88b5dc28ffa601c75`
- `/private/tmp/cx-day174-stop-agenta-artefakty/day174-unit-regression.json` — `a50c68f61d36dd1a3845bee51d0a6364960e04c5cd445a55cd15a73476f0bc8d`

## Pomiar zasięgu §0.4a

Instrukcja odwołuje się do `§0.4a`, ale nie zawiera takiej sekcji ani pełnej komendy selekcji. Nie zgaduję denominatora. Zmierzyłem wszystkie dwa nowe testy integracyjne (4 przypadki) oraz dwa istniejące pakiety worker obejmujące zmieniony dispatch (5 przypadków). To jest **PARTIAL**, nie pełny denominator katalogów. Lista plików po commitach jest mierzona przez `git diff --name-only d3d36cd5f5..HEAD`.

## Korekty wobec instrukcji

- Backendowy config ma root `server/`; ścieżki z roota dały 0 testów. Wiążący przebieg został wykonany z `server/` ze ścieżkami `src/...`.
- W dokumencie istnieją odwołania do `§0.4a`, ale brak samej sekcji. Nie przepisałem obcego denominatora.
- Nie dodano migracji, więc `npm run test:migrations:day161:fresh` nie był wymagany. Pełne 869+0 migracji wykonano przed pomiarami.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zmierzyłem wyścigu scheduler ↔ anulowanie z `listWaitStepsDue`/`beforeEnqueue`.
- Z trzech wariantów anulowania zmierzyłem end-to-end szybkie anulowanie podczas pierwszego kroku. Nie zmierzyłem osobno kroku >60 s ani anulowania przed claimem; warunek workera dla zwróconego `cancelled` jest pokryty tym samym realnym workerem, ale nie osobnym timingiem.
- Nie wykonałem pełnego HTTP przez `ApiGateway` dla `/cancel`; frontowego konsumenta nie zmieniono.
- R2 zmierzył prawdziwą odmowę w `reserveAgentResource`, ale nie plan-level `error_message` po `executeBackgroundPlan` z pełną canonical-run fixture. Dlatego R2 nie dostaje statusu pełnego DoD.
- Ścieżki bez `canonicalRunId` nie zmieniłem: nie ma `projectId` ani `runId`, wymaganych przez `reserveAgentResource`; jej domknięcie wymaga osobnej decyzji o tożsamości zakresu.
- `redriveAgentTask` dla przyjętego terminalnego `SUCCEEDED` pozostaje świadomie niedozwolony i został zmierzony.
- Nie włączono `ENABLE_AI_TASKS_WORKER` w repo ani w środowisku trwałym; użyto go wyłącznie w liniach komend testowych.

## Pliki

```text
server/src/services/ai/__tests__/day174.agent-plan-cancel.pg.redis.test.ts
server/src/services/ai/__tests__/day174.agent-resource-policy.pg.redis.test.ts
server/src/services/ai/agentPlannerService.ts
server/src/services/ai/toolCostEstimates.ts
server/src/services/v8/agentResourceGovernanceService.ts
server/src/workers/aiWorker.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY174_STOP_AGENTA_REPORT.md
```
