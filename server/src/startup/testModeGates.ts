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
 * True when the database-init sequence — schema verification, Table
 * Platform migrations, seeding, and the only code path that ever sets
 * `dbReady = true` or a non-null `dbInitError` — must run at all.
 */
export function shouldRunDatabaseInit(env: TestModeGateEnv): boolean {
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
 */
export function shouldMountFullGateway(env: TestModeGateEnv): boolean {
  return !isTestMode(env) || env.ENABLE_TEST_GATEWAY === 'true' || runsRealDbInTestMode(env);
}
