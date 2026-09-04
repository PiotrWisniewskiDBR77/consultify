# Dyżur 351 — R3: żywa trasa na realnym PostgreSQL

## Środowisko

- kontener: `cx-day351-pg`, obraz `pgvector/pgvector:pg16`, port `127.0.0.1:6410`, baza `cx351`;
- migracje 1: `Applying migrations: 894`, zakończone `Postgres migrations complete`;
- migracje 2: `Applying migrations: 0`, zakończone `Postgres migrations complete`;
- SMTP w środowisku: `BRAK ZMIENNYCH POCZTY`;
- `settings WHERE key LIKE 'smtp%'`: 0 wierszy;
- `Gateway.ts` nie zawiera startu drenaży outboxu; `server/src/index.ts` nie uruchomiono.

## GREEN

Pełna komenda miała w tej samej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6410/cx351 JWT_SECRET=...`, następnie `npx vitest run src/routes/__tests__/day351.assessment-progress.gateway.pg.test.ts --config vitest.config.ts --retry=0 --reporter=json` z cwd `server/`.

Wynik JSON: success true, 1/1 passed. Pełna nazwa:

`Day 351 — assessment progress through ApiGateway/JWT/PostgreSQL cold-reads zero completion_percent and reports 7/39 incomplete plus 39/39 complete`

Test przechodzi przez `ApiGateway.getInstance().initializeRoutes(app)`, podpisany JWT, `verifyToken`, zamontowaną trasę `/api/assessments`, handler i realny PostgreSQL. Zasiane identyfikatory: `day351-drd-7-of-39`, `day351-drd-39-of-39`, `day351-siri-target-only`, `day351-siri-full`, `day351-adma-target-only`, `day351-adma-full`. Dla wszystkich `completion_percent='0'`, więc mierzona jest derywacja osi, nie zwierająca kolumna.

Wyniki: DRD 7/39 ma `completedAxes > 0 && < 7` i `progress < 100`; DRD 39/39 ma `7/7` i 100%. SIRI target-only ma `0/8` i 0%, pełny `8/8` i 100%. ADMA target-only ma `0/12` i 0%, pełny `12/12` i 100%.

## Mutacja per miejsce trasy

Każda mutacja przywracała alternatywę z celem tylko w jednym miejscu, test biegł z tym samym pełnym env i `--retry=0`, a plik był cofany przez `cp`; `diff -u KOPIA PLIK` po cofnięciu zwracał exit 0.

- DRD `achievedLevel > 0 || targetLevel > 0`: RED, partial otrzymał `completedAxes=7`, oczekiwano `<7`, exit 1.
- SIRI `current > 0 || target > 0`: RED na `siriTargetId`, oczekiwano `completedAxes=0`, exit 1.
- ADMA `current > 0 || target > 0`: RED na `admaTargetId`, oczekiwano `completedAxes=0`, exit 1.
- Po przywróceniu: GREEN 1/1; route restore diff exit 0.

## Pułapki §0.2e

(a) `ENABLE_V8_GLOBAL=true`; (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) asercja w `beforeAll` wymaga `DB_TYPE=postgres`, a readback identyfikuje `127.0.0.1:6410/cx351`; (d) `ENABLE_TEST_AUTH_BYPASS=false`, a żądanie używa podpisanego JWT; (e)(3) kolumna `completion_percent` ma jawnie 0; (e)(4) `@ts-nocheck` nie jest dowodem — dowodem jest HTTP/PG; (e)(1) wszystkie trzy gałęzie wołają serwerową wspólną definicję.

Deklaracja Z30: Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.
