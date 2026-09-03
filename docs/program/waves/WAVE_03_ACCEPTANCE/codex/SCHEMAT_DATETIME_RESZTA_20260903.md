# SCHEMAT DATETIME — reszta plików, dyżur agent/schemat-datetime-20260903

Worktree: `/private/tmp/ag-schemat-datetime`, gałąź `agent/schemat-datetime-20260903`
(z `HEAD` = `9929c8cae8`, main worktree `/private/tmp/m03` nietknięty).
Artefakty (logi, poza repo): `/private/tmp/ag-schemat-datetime-artefakty/`.

## Wejście — korekta wobec instrukcji

Instrukcja zakładała, że pozostałe pliki z `DATETIME` reprodukują ten sam błąd
`42704: type "datetime" does not exist`, co `emailVerificationService` przed
dyżurem 281. **To się nie potwierdziło dla żadnego z pozostałych plików.**

Zmierzony mechanizm: `server/src/database/PostgresDatabase.ts`'s `adaptQuery()`
tłumaczy `DATETIME` (jako typ kolumny) → `TIMESTAMP` w locie, i jest wołane
przez `.run()`, `.get()`, `.all()` i `.prepare()`. Jedyna metoda, która tego
NIE robi, to `.exec()` (linia 1406) — i to właśnie przez `DbPromise.exec()`
przechodził oryginalny bug w `emailVerificationService` (patrz commit
`5b5c0e3849`). Zmierzone grepem: żaden z pozostałych plików z `DATETIME` w
`server/src` nie używa `.exec()` — wszystkie idą przez `.run()`/`dbRun`, które
już adaptują typ. Więc dla nich runtime DDL **nie crashuje** na Postgresie
dzisiaj — potwierdzone empirycznie harnessem (patrz R2 niżej).

To, co jednak zostaje prawdziwym P0 dla tych plików, to węższy wariant tego
samego ryzyka: **tabela istnieje tylko dlatego, że jakiś serwis ją kiedyś
stworzył w locie — nie dlatego, że jest w łańcuchu migracji.** Świeża baza,
na której nikt nigdy nie wywołał tej funkcji serwisu (np. odtworzenie po
awarii, nowe środowisko, audyt `to_regclass`), NIE będzie miała tej tabeli.

## R1 — zakres, zmierzony samodzielnie

`git grep -n "DATETIME" -- server/src | grep -v migrations` → 6 plików
produkcyjnych (`_backup/ts-js-collisions` pominięty — potwierdzone grepem
zero importerów, martwy katalog, nie wchodzi do builda) + 2 dodatkowe pliki
tras (`help.routes.ts`, `module-access.routes.ts`, `SuperAdminController.ts`,
`jobs/aiWatchdog.ts`, `user-keyboard-shortcuts.routes.ts`, `DatabaseInitializer.ts`)
znalezione własnym grepem, których nie było w `REJESTR_SCHEMAT_OD_ZERA_20260902.md`
(rejestr był niekompletny — zgodnie z lekcją „Próbka zamiast zbioru").

Werdykt per plik/tabela (metoda: grep `create table` w `server/migrations`
z pominięciem `never-ran/`, `ops/`, `rollback/` — te katalogi runner
`migrate.postgres.ts` jawnie wyklucza, `KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS`):

| Plik | Tabela(e) | Migracja? | Werdykt |
| --- | --- | --- | --- |
| `integrationHubService.ts:688` | — | n/d | Komentarz w martwym kodzie, nie DDL |
| `notificationOutboxService.ts` | `notification_outbox` | TAK (`20260719_baseline_gap.sql`) | już naprawione |
| `demoTrialTelemetryService.ts` | `conversion_events` | TAK (`230_superadmin_overview_production.sql`) | już naprawione |
| `ai/llmConfigService.ts` | `llm_logs`, `llm_health_events`, `llm_providers`, `organization_llm_settings`, `llm_tier_assignments`, `ai_model_overrides`, `organization_provider_settings`, `tier_round_robin_state` | TAK (wszystkie, w tym 4 które rejestr z 2026-09-02 błędnie oznaczył `NIE`/`NIEZWERYFIKOWANA`) | już naprawione |
| `aiSettingsService.ts` | `ai_user_tiers` | **NIE** | **NAPRAWIONE w tym dyżurze** |
| `help.routes.ts` | `help_categories` | **NIE** | **NAPRAWIONE w tym dyżurze** |
| `help.routes.ts` | `help_articles`, `help_playbooks`, `help_events` | TAK | migracja jest, ALE kształt kolumn koliduje z kodem (patrz „Odkryte poza zakresem") |
| `module-access.routes.ts` | `module_access_grants` | TAK | już naprawione |
| `user-keyboard-shortcuts.routes.ts` | `user_preferences` | TAK | już naprawione |
| `SuperAdminController.ts` | `api_keys` (kolumny `created_at`/`revoked_at`) | TAK, kolumny już obecne | ALTER jest no-opem, nie dotyczy |
| `SuperAdminController.ts` | pozostałe tabele compliance/dsar/admin_approval | TAK (wszystkie) | już naprawione |
| `DatabaseInitializer.ts:3645` | `knowledge_docs.deleted_at` | TAK | już naprawione |
| `jobs/aiWatchdog.ts` | `watchdog_alerts`, `watchdog_runs` | NIE | martwy kod (0 importerów TS-modułu poza samym plikiem) — nie naprawiane |
| `formulaEngine.ts` | — | n/d | `DATETIME_FORMAT`/`DATETIME_PARSE` to nazwy funkcji formuł, nie SQL |

## R2 — czerwony dowód (mutacyjny, przed naprawą)

Kontener: `docker run -d --name ag-schemat-pg -p 55432:5432 -e POSTGRES_PASSWORD=pg pgvector/pgvector:pg16`.

Pełny runner (`DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts`,
z `NODE_ENV=test` żeby przejść strażnika `assertNoPrivateRailwayDbHostOutsideRailway`
— strażnik blokuje `localhost`/`127.0.0.1` poza testami; sam runner łączy się
bezpośrednio przez `pg.Pool`, nie przez `DbPromise`, więc `NODE_ENV=test` tu
NIE podstawia atrapy bazy, w przeciwieństwie do ryzyka opisanego dla
`DbPromise`) zgłosił **883 migracje**, `✅ Postgres migrations complete`,
zero błędów.

Po pełnym łańcuchu, na świeżej bazie:

```
$ docker exec ag-schemat-pg psql -U postgres -d postgres -c "select to_regclass('public.ai_user_tiers') as ai_user_tiers, to_regclass('public.help_categories') as help_categories;"
 ai_user_tiers | help_categories
---------------+-----------------
               |
(1 row)
```

Obie tabele — `NULL`. To jest czerwony dowód „schemat poza migracjami": pełny,
zielony łańcuch migracji NIE tworzy tych tabel.

Harness `npx tsx` (bez Vitest — global mock `fetch`/DB nie wchodzi w grę),
wołający realny `AISettingsService.getOrgUserTiers`/`assignUserTier` przez
realny Postgres (host `127.1` — literalnie różny string od `127.0.0.1`/`localhost`,
żeby ominąć strażnika lokalnego hosta w `databaseTargetResolver.ts` bez
ustawiania `NODE_ENV=test` na warstwie `DbPromise`, gdzie `NODE_ENV=test` bez
`RUN_DB_TESTS=1` podstawia atrapę bazy — env: `RUN_DB_TESTS=1 MOCK_DB=false
DB_TYPE=postgres DATABASE_URL=postgres://postgres:pg@127.1:55432/postgres`):

- `DB_IDENTITY role=app identity=127.1:55432/postgres` — potwierdzenie realnego
  połączenia z kontenerem, nie atrapy.
- `getOrgUserTiers` i `assignUserTier` **zwróciły wynik bez błędu** — bo
  `dbRun`/`.run()` adaptuje `DATETIME`→`TIMESTAMP` w locie i sam stworzył
  tabelę (`SLOW QUERY... CREATE TABLE IF NOT EXISTS ai_user_tiers (...
  TIMESTAMP DEFAU...`). To empirycznie obala hipotezę „ten sam 42704 co
  rejestracja" dla tego pliku — i jest to samo w sobie ważny wynik pomiaru,
  nie porażka naprawy: naprawiany problem to nieodtwarzalność schematu, nie
  crash.
- Weryfikacja `SELECT * FROM ai_user_tiers` w kontenerze: 1 wiersz, zgodny
  z wpisanym przez `assignUserTier`.

Artefakty: `migrate-before-01.log` (SHA-256
`7c6aabae58c0067ac4ba7fa2027ed90b789ca04fd43d7ec475e815bd6c40656b`),
`to_regclass-before.log` (SHA-256
`0dd71293021e55ab034eebe3e16b3722011f14c93806452dd4f30229f4d1f1e9`),
`aiSettingsService-before.log` (SHA-256
`34621720e0d4ee1dc0efce504ea3593e02a247f51611a5c9f745658f739c3412`).

## Naprawa

1. `server/migrations/20260903_ai_user_tiers.sql` — nowa migracja, dokładnie
   odzwierciedla kształt runtime (`organization_id`, `user_id`, `tier`,
   `created_at`/`updated_at` jako `TIMESTAMPTZ`, PK `(organization_id, user_id)`).
2. `server/src/services/aiSettingsService.ts` — `ensureUserTiersTable()`:
   `DATETIME` → `TIMESTAMPTZ` (jawnie, nie polegając wyłącznie na
   `adaptQuery`) + komentarz wyjaśniający dlaczego (obrona w głąb — gdyby
   kiedyś ktoś zamienił `dbRun` na `.exec()`, jak w oryginalnym buga).
3. `server/migrations/20260903_help_categories.sql` — nowa migracja, kształt
   zgodny z runtime (`id`, `name`, `sort_order`, `created_at TIMESTAMPTZ`).
4. `server/src/routes/help.routes.ts` — `ensureHelpSchema()`:
   - `DATETIME` → `TIMESTAMPTZ` we wszystkich 4 tabelach (defense-in-depth,
     jak wyżej);
   - naprawiony wzorzec „cicho wyłącza funkcję": `ensured = true` ustawiane
     TERAZ dopiero po sukcesie wszystkich czterech `CREATE TABLE` (każdy
     wynik `dbRun` sprawdzany przez `.success`, błąd rzucany dalej), błąd
     logowany jako `logger.error` zamiast `logger.warn` + „continuing" —
     dokładnie ten sam wzorzec naprawy co `emailVerificationService` w
     `5b5c0e3849`.

## R3 — zielony dowód (po naprawie)

Kontener usunięty i odtworzony od zera (`docker rm -fv` → nowy
`pgvector/pgvector:pg16`, świeży wolumen).

Pełny łańcuch migracji (pierwszy przebieg): **885 migracji** (883 + 2 nowe),
`✅ Postgres migrations complete`, zero błędów.

```
$ docker exec ag-schemat-pg psql -U postgres -d postgres -c "select to_regclass('public.ai_user_tiers'), to_regclass('public.help_categories');"
 ai_user_tiers | help_categories
---------------+-----------------
 ai_user_tiers | help_categories
(1 row)
```

`\d ai_user_tiers` / `\d help_categories` potwierdzają `created_at`/`updated_at`
jako `timestamp with time zone` (nie `datetime`, nie tekst).

Drugi pełny przebieg migracji: `Applying migrations: 0`, `✅ Postgres
migrations complete` — **idempotentne**.

Harness (ta sama funkcja serwisu, ten sam env) po naprawie: `getOrgUserTiers`
i `assignUserTier` zwracają wynik bez błędu, tym razem BEZ zapisu do dziennika
„SLOW QUERY... CREATE TABLE" — bo tabela już istnieje z migracji, `CREATE
TABLE IF NOT EXISTS` w runtime jest teraz no-opem, nie jedynym producentem.

Route-level harness (Express + realny `help.routes.ts` router, `GET
/api/help/categories` przez `fetch` na lokalnym porcie) po naprawie:
`STATUS 200`, `BODY {"success":true,"data":[]}`, **bez błędu DDL** dla
`help_categories` — potwierdza że naprawiona ścieżka działa end-to-end.

Artefakty: `migrate-after-01.log` (SHA-256
`e096414cb133fef91b91b59806020f21b945cf92d2bf3be3fdc82ec928e95500`),
`migrate-after-02-idempotent.log` (SHA-256
`85be8a2a81487876d4206c705a10575009e39cedff5264aebddea5e4613ff69e`),
`to_regclass-after.log` (SHA-256
`93b30c1f49a7cff1ec766c2ecb8792a4fcc303d788c86762fc1335c8eb1f53c2`),
`aiSettingsService-after.log` (SHA-256
`ffd7c121ccae6670d0ff4bdfe30494cf4ab8f6017aa4f52ddd4571f68d17c36b`),
`helpRoutes-after.log` (SHA-256
`588a157b7d79d4d46881e227b249a19fa0773814c75e316fa363d5b247b2dd38`).

## Odkryte poza zakresem tego dyżuru (zgłoszone osobno, nie naprawiane tu)

Podczas pomiaru `help.routes.ts` wykryto **żywy, potwierdzony empirycznie**
defekt niezwiązany z `DATETIME`: `help_articles` i `help_events` MAJĄ migrację,
ale w innym kształcie kolumn niż zakłada kod tras:

- migrowany `help_articles`: kolumny `category`, `content` (bez `status`);
  kod czyta `category_id`, `body`, `status`.
- migrowany `help_events` (`000_initdb_core_tables.sql`): kolumny `id`,
  `user_id`, `event_type`, `event_data`, `created_at` (bez `organization_id`,
  `article_id`, `metadata`); kod wstawia właśnie te brakujące kolumny.

Route-harness po mojej naprawie faktycznie zalogował:
`column "category_id" does not exist` przy liczeniu artykułów per kategoria —
złapane przez `.catch(() => [])`, więc `GET /api/help/categories` zwraca
`200` z pustymi danymi zamiast błędu. To osobny wariant „schemat poza
migracjami" (rozjazd KSZTAŁTU, nie typu DATETIME) — nie mieści się w zakresie
tego dyżuru i wymaga decyzji produktowej (czy dopisać kolumny migracją, czy
przepisać kod tras na istniejący kształt). Zgłoszone przez `spawn_task`.

`jobs/aiWatchdog.ts` (`watchdog_alerts`, `watchdog_runs`) też nie ma migracji,
ale zmierzone jako martwy kod — `git grep` nie znalazł ŻADNEGO importera
modułu TS poza samym plikiem (backup `.js` w `_backup/ts-js-collisions` też
nieużywany). Brak wołacza = brak P0 dziś; nieudokumentowane w rejestrze
2026-09-02 (był tylko o serwisach), nie naprawiane w tym dyżurze zgodnie z
zasadą „mierz zanim naprawisz" — naprawa martwego kodu nie zmieniłaby
żadnego mierzalnego ryzyka.

## Co NIE zostało zweryfikowane

- `SuperAdminController.ts`'s `PRAGMA table_info(api_keys)` (używane przez
  `ensureApiKeysSchema`'s `maybeAdd`) — czy to w ogóle działa na Postgresie,
  nie zmierzone w tym dyżurze (osobne ryzyko, nie DATETIME).
- Pozostałe „52 statycznie nazwane runtime DDL bez wykrytej migracji" i „12
  UNKNOWN" z rejestru 2026-09-02 — poza zakresem (to nie są instrukcje z
  `DATETIME`).

## SHA commitów

(uzupełnione po commitach — patrz `git log --oneline -5` na tej gałęzi)

## Ścieżka worktree

`/private/tmp/ag-schemat-datetime`, gałąź `agent/schemat-datetime-20260903`,
NIE pushowane.
