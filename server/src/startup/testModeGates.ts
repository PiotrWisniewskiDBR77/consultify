/**
 * Pure, unit-testable gates for the two boot-time branches that decide
 * whether the server behaves like a "real" instance under `NODE_ENV=test`.
 *
 * Extracted from `index.ts` (A14, 2026-08-13) after both branches were found
 * to check ONLY `E2E_MODE`/`ENABLE_TEST_GATEWAY` and ignore `RUN_DB_TESTS=1`
 * — the documented, project-wide signal (see DatabaseInitializer.ts
 * `skipPostgresInitInTest`, and CLAUDE.md/MEMORY "NODE_ENV=test bez
 * RUN_DB_TESTS=1 = cichy mock bazy") for "NODE_ENV=test, but run against a
 * REAL database, not a mock."
 *
 * Concretely, running:
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false npx tsx src/index.ts
 * used to:
 *   1. never run the async IIFE that sets `dbReady = true` (the ONLY place
 *      that does), so `/api/ready` stayed 503 with `error: null` forever —
 *      not because anything failed or hung, but because that code never ran;
 *   2. even after (1) is fixed, mount only the `/api/management-reports`
 *      stub instead of the full API Gateway, so every other route (including
 *      `/api/method/*`) 404'd rather than being gated by readiness.
 *
 * Both gates now also open on `runsRealDbInTestMode(env)`.
 */
export interface TestModeGateEnv {
  [key: string]: string | undefined;
  NODE_ENV?: string;
  VITEST?: string;
  E2E_MODE?: string;
  ENABLE_TEST_GATEWAY?: string;
  RUN_DB_TESTS?: string;
  MOCK_DB?: string;
}

export function isTestMode(env: TestModeGateEnv): boolean {
  return env.NODE_ENV === 'test' || !!env.VITEST;
}

/** The project-wide "real database under NODE_ENV=test" signal. */
export function runsRealDbInTestMode(env: TestModeGateEnv): boolean {
  return env.RUN_DB_TESTS === '1' && env.MOCK_DB !== 'true';
}

/**
 * Whether the database-init IIFE in index.ts should use the in-process
 * MOCK_DB path instead of a real connection.
 *
 * P0A (2026-08-13): extracted from an inline `const mockDbEnabled = ...`
 * expression in index.ts specifically so the "does `RUN_DB_TESTS=1` ever
 * cause production to silently mock its database" production guarantee is
 * a pure, testable function instead of something only verifiable by reading
 * index.ts. In production (`NODE_ENV !== 'test'`) the second disjunct is
 * always false regardless of `RUN_DB_TESTS`, so this can only be `true` in
 * production via an explicit, unrelated `MOCK_DB=true` — never as a side
 * effect of `RUN_DB_TESTS`.
 */
export function shouldUseMockDatabase(env: TestModeGateEnv): boolean {
  // ★ Bramka produkcyjna (Opus, odbiór P0A).
  //
  // Ścieżka mocka jest JEDYNĄ, która ustawia `dbReady = true` z pominięciem
  // weryfikacji schematu i migracji (`server/src/index.ts`). Bez tego strażnika
  // `MOCK_DB=true` na produkcji dawał serwer ogłaszający gotowość na atrapie
  // bazy — dokładnie ten stan, przed którym ma chronić bramka readiness.
  //
  // Gwarancja koordynatora brzmi „w produkcji nie wolno ustawić dbReady przed
  // sukcesem migracji" i nie jest ograniczona do jednej zmiennej: żadna flaga,
  // łącznie z jawnym `MOCK_DB=true`, nie może jej złamać.
  if (env.NODE_ENV === 'production') return false;

  return (
    env.MOCK_DB === 'true' ||
    (env.NODE_ENV === 'test' && env.RUN_DB_TESTS !== '1' && env.MOCK_DB !== 'false')
  );
}

/**
 * True when the database-init sequence — schema verification, Table
 * Platform migrations, seeding, and the only code path that ever sets
 * `dbReady = true` or a non-null `dbInitError` — must run at all.
 *
 * P0A (2026-08-13) rename note: this answers "should the DB init sequence
 * run AT ALL", not "are we in a test". The first disjunct
 * (`!isTestMode(env)`) means it is unconditionally `true` in production and
 * development — the "Test" in the name refers to this module (testModeGates),
 * not to the scope of what the function governs. Named `...TestDatabase` per
 * the P0A/P0B/P0C shared naming convention for this gate file; do not read it
 * as "only matters in test mode".
 *
 * This is a SEPARATE concern from `shouldMountTestGatewayRoutes` below —
 * whether the DB gets initialized has nothing to do with which HTTP routes
 * get mounted. Do not collapse the two into one condition (that collapse is
 * exactly what caused the A14 incident: one gate covered both meanings and
 * disagreed with itself under `RUN_DB_TESTS=1`).
 */
export function shouldInitializeTestDatabase(env: TestModeGateEnv): boolean {
  return (
    !isTestMode(env) ||
    env.E2E_MODE === 'true' ||
    env.ENABLE_TEST_GATEWAY === 'true' ||
    runsRealDbInTestMode(env)
  );
}

/**
 * True when the full API Gateway (hundreds of business routes, including
 * `/api/method/*`) must be mounted, instead of the lightweight
 * `/api/management-reports`-only stub used by the plain Vitest unit suite.
 *
 * P0A (2026-08-13) rename note: same naming convention as
 * `shouldInitializeTestDatabase` above — unconditionally `true` outside test
 * mode (`!isTestMode(env)`), so production/development always mount the real
 * router. This is a DIFFERENT decision from "should the DB init run" — a
 * caller must not assume they move together (e.g. `ENABLE_TEST_GATEWAY=true`
 * alone opens routes without opening DB init).
 */
export function shouldMountTestGatewayRoutes(env: TestModeGateEnv): boolean {
  return !isTestMode(env) || env.ENABLE_TEST_GATEWAY === 'true' || runsRealDbInTestMode(env);
}
