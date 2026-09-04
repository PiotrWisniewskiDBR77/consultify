# Dyżur 353 — R2: day307 na markerze i orzeczenie 01/08

## Środowisko i migracje

- Realny PostgreSQL: `pgvector/pgvector:pg16`, kontener `cx-day353-pg`, `127.0.0.1:6412/cx353`.
- Pierwszy przebieg: `Applying migrations: 894`, exit 0.
- Drugi przebieg: `Applying migrations: 0`, exit 0.
- Seeder skopiowano poza repo z zachowaniem układu `scripts/dev`; jedyną zmianą treści guardu było `6314/cx307` → `6412/cx353`.
- Pierwsza płaska kopia seedera była nieważna (`Cannot find module 'pg'`), a dwa uruchomienia Vitest z niewłaściwego cwd wykonały 0 przypadków; nie są dowodem. Ważny przebieg wykonano z `server/` i `vitest.config.ts`.

## Z30

`env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)"` zwróciło `BRAK ZMIENNYCH POCZTY`. Zapytanie `SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';` zwróciło 0 wierszy. Grep drenaży w `server/src/Gateway.ts` zwrócił 0 trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Para i treść odpowiedzi

Trasa: `GET /api/pmo/tasks/workload/day307-user-owner`, ten sam `userId` dla obu tokenów, realny `ApiGateway`, podpisany JWT i PostgreSQL.

| Aktor | Kod | Bajty JSON | Niepuste | Treść rozstrzygająca |
| --- | ---: | ---: | --- | --- |
| obca organizacja | 404 | 64 | tak | `TASK_WORKLOAD_USER_NOT_FOUND` |
| właściciel | 200 | 243 | tak | `total=1`, projekt `day307-project-owner`, status `IN_PROGRESS` |

Ważny przebieg Vitest: `numTotalTests=2`, `numPassedTests=1`, `numFailedTests=0`; drugi przypadek był wybrany filtrem, pierwszy pozostał niewykonany. Pełna nazwa wykonanego przypadku: `Day 307 paired cross-org GET flight through ApiGateway denies foreign workload lookup while the owner reads the seeded task`.

## Mutacja zabezpieczenia

Cel: `server/src/controllers/TaskController.ts`, precheck `SELECT id FROM users WHERE id = ? AND organization_id = ?`.

1. GREEN: kod zastany, wybrany przypadek przeszedł.
2. RED: po usunięciu `AND organization_id = ?` i parametru `orgId`, Vitest exit 1, `numFailedTests=1`; komunikat: `expected 200 to be 404` w `day307-crossorg-read-flight.pg.test.ts:219`.
3. GREEN po przywróceniu przez `cp`: `numPassedTests=1`, `numFailedTests=0`.
4. `git diff -- server/src/controllers/TaskController.ts`: pusty.

Zabezpieczenie rozstrzygające tę parę stoi w prechecku `TaskController.getUserWorkload`; nie było potrzeby mutowania serwisu.

Artefakty JSON poza repo: `/private/tmp/cx-day353-g19-wznowienie-artefakty/day307-green.json`, `day307-mutation-red.json`, `day307-restored-green.json`.

## Pułapki dowodowe

- `ApiGateway.getInstance().initializeRoutes(app)` jest używany przez test i sondę; nie montowano gołego routera.
- Jawnie ustawiono w tej samej linii: `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, lokalny `DATABASE_URL`, testowy `JWT_SECRET`, `--retry=0`.
- Asercja środowiska w `beforeAll` sprawdziła `DB_TYPE=postgres`, brak bypassu auth i V8 global; `DB_IDENTITY` w sondzie wskazało `127.0.0.1:6412/cx353`.
- Para 404/200 z niepustym właścicielem wyklucza fałszywą zieleń 404/404, a mutacja dokładnie strażnika wyklucza test scenariusza niebroniący izolacji.

## Orzeczenie dla 01_ORGANIZATION

Dowód day307 zamyka konkretną lukę izolacji cross-org trasy workloadu: obcy nie odczytuje użytkownika właściciela, właściciel widzi niepuste dane, a usunięcie filtra organizacji czerwieni kontrakt. Nie zamyka jednak całego wiersza G19 modułu 01. Wiersz odwołuje się do wspólnego zbioru 49 plików na starej kotwicy, podczas gdy dzisiejszy artefakt ma 106 plików, z czego 90 bez testów; jedna trasa nie rozlicza całego mianownika ani przelotu właściciela.

## Orzeczenie dla 08_MEETINGS

Nie. Choć tekst obu wierszy wskazuje dosłownie ten sam wspólny zbiór 49 plików, test workloadu nie wykonuje żadnej trasy spotkań i nie dotyka `server/src/routes/meeting.routes.ts`; identyczny opis mianownika nie czyni dowodu workloadu dowodem modułu Meetings. Moduł 08 potrzebuje własnej pary na `GET /api/meetings/:id` dla istniejącego spotkania właściciela (obcy 404, uprawniony właściciel 200 z niepustym `{ meeting }`) oraz mutacji filtra `organization_id` w `getMeeting` albo strażnika `canAccessMeeting`, zależnie od tego, który rzeczywiście rozstrzyga cross-org.

Wniosek R2: `01` ma udowodnioną jedną izolację, ale pozostaje `NOT_PROVEN / OWNER_RETEST_PENDING`; `08` nie może dziedziczyć tego dowodu i również pozostaje bez zmiany.
