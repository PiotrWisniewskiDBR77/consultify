# CODEX DAY 160 — BRAMA ZAPISU ZADAŃ

Status: **POMIAR W TOKU — rdzeń R1/R3 wykonany, bez zmian produktu**  
Marker: `218d020958`  
Gałąź: `codex/day160-brama-zadania-20260830`  
Zasoby: PostgreSQL `cx-day160-pg` na `127.0.0.1:6048`, runtime testowy przez `ApiGateway` (bez `server/src/index.ts`)

## Wejście §0.1

Wynik kroku (2), dosłownie:

```text
MARKER OK
```

Tip `github-backup/codex/m03-admin-20260824` był przed rozpoczęciem pracy nowszy od markera. Zgodnie z `DEC-2026-08-26-95` worktree powstał dokładnie z markera; nie wykonano rebase. Pełne wyniki wymaganych `log` i `diff --name-only` zostaną zachowane w artefakcie końcowym.

Wynik kroku (7), dosłownie:

```text
218d020958a0470e043ce5be9537a1b15f351884
```

`git status --short | head -3` nie zwrócił żadnej linii.

Wolne miejsce przed pracą: `38 GiB`. Porty `6048`, `4988`, `4989`: `WOLNY`.

## Korekty wobec instrukcji

### Port PostgreSQL

- `§0.1/Z7/§0.2c/§0.5`: „Twój JEDYNY port bazy to `6048`”; `6047` jest imiennie zakazany jako „odbiór nadzorcy 159”.
- `§4/B7`: „baza na porcie `6047`”.

Konflikt rozstrzygnięto na rzecz `6048`, ponieważ wskazują go procedura uruchomieniowa, reguła STOP, wklejka właściciela i zakaz zajmowania `6047`.

### Ścieżka wyjątku budżetowego

R1 podaje `DELETE /api/budget/entries/:id`, lecz wyjątek bramy jest zamontowany na produkcyjnej trasie `DELETE /api/execution-control/budget/entries/:entryId` (`server/src/Gateway.ts:1384-1391`, `server/src/routes/executionControl.routes.ts:600-601`). Pomiar wykonano na rzeczywiście bramowanej trasie. Instrukcyjny prefiks `/api/budget` wskazuje inny router i nie mierzy wyjątku `requireCanonicalExecutionWriter`.

### Konfiguracja Vitest

Komenda uruchomiona z roota z `--config server/vitest.config.ts` utworzyła JSON z `numTotalTests: 0`; nie została uznana za PASS. Konfiguracja ma `include: src/**`, więc właściwy przebieg wykonano z katalogu `server/`, na tym samym pliku i z tym samym kompletem env.

## Z30 — brak wysyłki

```text
BRAK ZMIENNYCH POCZTY
```

Grep `startNotificationOutboxDrainCron|outboxWorker|platformOutboxDrainCron` w `server/src/Gateway.ts`: 0 trafień.

Po migracjach:

```text
 key | left
-----+------
(0 rows)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## PostgreSQL i migracje

Kontener: `pgvector/pgvector:pg16`, nazwa `cx-day160-pg`, mapowanie wyłącznie `127.0.0.1:6048:5432`, baza `cx160`.

- pierwszy pełny przebieg: `✅ Postgres migrations complete`;
- drugi przebieg: `Applying migrations: 0`, `✅ Postgres migrations complete`.

## R1 — realny HTTP dla `/api/tasks`

Test: `server/src/routes/__tests__/day160.task-write-gate.pg.test.ts`. Montaż: `ApiGateway.getInstance().initializeRoutes(app)`. Token: JWT podpisany `JWT_SECRET` przebiegu. DB: realny PostgreSQL, strażnik `assertRealPostgresTestEnvironment()` bez argumentów. Retry: `--retry=0` oraz `{ retry: 0 }`.

| Operacja | HTTP | Dosłowne ciało | DB przed → po |
|---|---:|---|---|
| `POST /api/tasks` | 409 | `{"error":"Legacy execution writes are retired. Use the canonical Runtime-v1 execution API.","code":"EXECUTION_RUNTIME_V1_WRITE_REQUIRED","canonicalWriter":"/api/initiatives/runtime-v1"}` | `tasks 0→0`, `comments 0→0` |
| `PUT /api/tasks/:id` | 409 | jak wyżej | `tasks 0→0`, `comments 0→0` |
| `DELETE /api/tasks/:id` | 409 | jak wyżej | `tasks 0→0`, `comments 0→0` |
| `POST /api/tasks/:taskId/comments` | 409 | jak wyżej | `tasks 0→0`, `comments 0→0` |

Wniosek R1: brama runtime blokuje wszystkie cztery zmierzone mutacje przed handlerami i nie zmienia tabel `tasks`/`task_comments`.

### Wyjątek budżetowy

`DELETE /api/execution-control/budget/entries/:entryId?initiativeId=:id&expectedVersion=1`, z `X-Idempotency-Key`, zwrócił `404` (nie 409) i ciało z trwałym receipt o `outcome: "NOT_FOUND"`, `reasonCode: "budget_entry_not_found"`; `budget_entries 0→0`. To dowodzi dotarcia przez wyjątek bramy do kanonicznego handlera. Receipt jest z definicji niemutowalny; zostanie usunięty razem z wolumenem efemerycznego kontenera.

## R3 — realna ścieżka personal task

`POST /api/my-work/personal-tasks` zwrócił `201`. Surowy readback SQL potwierdził dokładnie jeden nowy wiersz:

```text
task_type      = personal
initiative_id  = NULL
project_id     = NULL
organization_id = organizacja JWT
assignee_id     = użytkownik JWT
```

`tasks 0→1`. Odpowiedzi na dwa osobne pytania:

1. Czy da się utworzyć jakiekolwiek zadanie? **TAK — zadanie osobiste.**
2. Czy zmierzona działająca ścieżka tworzy zadanie powiązane z inicjatywą/projektem? **NIE — oba klucze są `NULL`.**

Nie jest to funkcjonalny zamiennik kanonicznej ścieżki zadania inicjatywy/projektu.

## Pułapki środowiska Z33

- `DB_TYPE`: konfiguracja serwerowa wpisuje `sqlite`; test ustawia i asertuje `postgres` przed inicjalizacją Gateway/DB.
- `ENABLE_TEST_AUTH_BYPASS=false`: prawdziwy `verifyToken`, JWT podpisany sekretem przebiegu.
- `ENABLE_V8_GLOBAL=true` i `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`: ustawione w tej samej linii; badane trasy nie opierają wyniku na wcześniejszym fałszywym 404 ani testowym bypassie visibility.
- Kanoniczne polecenie i legacy `tasks` nie zostały utożsamione: pomiar sprawdza rzeczywistą tabelę `tasks`.
- Brak repliki routera: użyto realnego `ApiGateway`.

## Wynik testu dowodowego

JSON: `success=true`, `numTotalTests=3`, `numPassedTests=3`, `numFailedTests=0`.

Pełne nazwy PASS:

1. `Day 160 task write gate through the real ApiGateway and PostgreSQL R1 records POST, PUT, DELETE and comment writes as 409 with unchanged database`
2. `Day 160 task write gate through the real ApiGateway and PostgreSQL R1 records the governed budget-delete exception reaching its handler`
3. `Day 160 task write gate through the real ApiGateway and PostgreSQL R3 creates a personal task and reads its exact storage coordinates`

## R2 — inwentarz obsługi 409

W toku. Do raportu końcowego wejdą wszystkie zmierzone wołacze mutacji `/tasks`, nie tylko siedem przykładów.

## R3 — inwentarz pisarzy `tasks`

W toku. Pomiar bez `__tests__` znalazł 28 tekstowych trafień `INSERT INTO tasks`; jedno jest komentarzem (`chatHandoffService.ts`), jedno skryptem dowodowym. Klasyfikacja realnych pisarzy i miejsc montowania zostanie dopisana.

## R4 — materiał do decyzji właściciela

W toku; raport końcowy przedstawi oba warianty bez wyboru za właściciela.

## Artefakty poza repo

| Artefakt | SHA-256 |
|---|---|
| `/private/tmp/cx-day160-brama-zadania-artefakty/day160-http-db-evidence.json` | `090c2c02206cd6029b411d68c700d09e475e1786c2176a1eea6dc6015ec16a72` |
| `/private/tmp/cx-day160-brama-zadania-artefakty/day160-vitest.json` | `fd06e785df7265828644223f97060e446475ae514d69780a708514ed05f1c6ee` |
| `/private/tmp/cx-day160-brama-zadania-artefakty/day160-migrate-first.log` | `6440828e95cffc197b0323c27a0abc0fb5ff717e467d70feebe357ab55dc1be9` |
| `/private/tmp/cx-day160-brama-zadania-artefakty/day160-migrate-second.log` | `3c544f9bb72e1aba0bd0877cbf9fe3fc5cf30cf2242cf910f51b44a5f9ec1563` |

## TWIERDZENIA NIEZWERYFIKOWANE

- Pełna klasyfikacja R2 i R3 jest jeszcze w toku.
- Nie uruchamiano UI ani `server/src/index.ts`; dyżur nie wymaga nowego wizualium.
- Nie wykonano pomiaru na demo/staging/produkcji — celowo i zgodnie z Z28.

