# Dyżur 360 — R2: 01_ORGANIZATION

Data: `2026-09-04`. Marker: `2a7273e087cbd3e44344725b524f6ddd79d5badc`.

## Środowisko

- PostgreSQL `pgvector/pgvector:pg16`, kontener `cx-day360-pg`, `127.0.0.1:6431/cx360`.
- Migracje na bazie od zera: pierwszy przebieg `Applying migrations: 894`, drugi `Applying migrations: 0`; oba zakończone `Postgres migrations complete`.
- Seeder `scripts/dev/seed-day307-crossorg.mjs` skopiowano poza repo z zachowaniem układu; jedyna zmiana guardu: `6314/cx307` → `6431/cx360`. Źródło w repo nietknięte.
- `DB_TYPE=postgres`, `ENABLE_TEST_AUTH_BYPASS=false`, `ENABLE_V8_GLOBAL=true`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; `assertRealPostgresTestEnvironment()` bez argumentów.
- Trasa uruchomiona przez `ApiGateway.getInstance().initializeRoutes(app)` z podpisanymi JWT.

## Para izolacyjna

Pełna nazwa: `Day 360 G19 01 Organization cross-org workload isolation through ApiGateway denies a foreign organization while the owner reads the same seeded workload user`.

Ten sam cel: `GET /api/pmo/tasks/workload/day307-user-owner`.

| Aktor | Kod | Bajty JSON | Treść rozstrzygająca |
| --- | ---: | ---: | --- |
| obca organizacja | 404 | 64 | `TASK_WORKLOAD_USER_NOT_FOUND` |
| właściciel | 200 | 243 | `userId=day307-user-owner`, `total=1`, `day307-project-owner` |

Ważny przebieg: `numTotalTests=1`, `numPassedTests=1`, `numFailedTests=0`, `--retry=0`.

## Mutacja zabezpieczenia

Strażnik: `server/src/controllers/TaskController.ts`, `TaskController.getUserWorkload`, precheck `SELECT id FROM users WHERE id = ? AND organization_id = ?` (marker: okolice linii 2690).

1. GREEN: 1/1.
2. Usunięto tymczasowo `AND organization_id = ?` i parametr `orgId`: RED 0/1, komunikat `expected 200 to be 404`.
3. Przywrócono przez `cp`: GREEN 1/1.
4. `git diff -- server/src/controllers/TaskController.ts`: pusty.

Pierwsza próba nowego kontraktu na głównym `vitest.config.ts` dała 401/401, ponieważ zastany globalny `tests/setup.ts` nadpisuje `JWT_SECRET`; nie uznano jej za dowód. Ważny przebieg używa istniejącego `vitest.acceptance.config.ts`, który nie ładuje globalnych mocków.

## Z30 i granica

Brak zmiennych SMTP, zero wierszy `smtp%` w tabeli `settings`, zero drenaży w `Gateway.ts`; nie uruchomiono `server/src/index.ts`. Żaden e-mail ani zaproszenie nie zostały wysłane.

Dowód pokrywa jedną izolację, nie cały wpisany mianownik 49 ani artefakt dryfu 106. Dlatego wiersz nie zawiera słowa `PASS`.
