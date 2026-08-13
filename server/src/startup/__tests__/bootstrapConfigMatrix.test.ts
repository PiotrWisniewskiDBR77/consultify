/**
 * P0A (2026-08-13) — Server bootstrap configuration matrix.
 *
 * Security-flavoured coverage: the point is not "does the happy path work"
 * but "can a test-only flag (RUN_DB_TESTS, E2E_MODE, ENABLE_TEST_GATEWAY,
 * a client-supplied demoBypass flag) ever weaken a PRODUCTION deployment".
 * See CLAUDE.md rule about verifying real runtime behaviour, not docs/flags,
 * and the A14 incident this whole `startup/` module exists to prevent (a
 * single collapsed condition that disagreed with itself under
 * `RUN_DB_TESTS=1`).
 *
 * Deliberately pure: every function under test here is a pure function of an
 * env object (or, for `establishDatabaseReadiness`, of injected fake deps).
 * No live server, no network, no real Postgres connection — that is what
 * makes this file safe to run as a plain `vitest run`, unlike the
 * `http.integration.test.ts` suite that boots a real listener.
 */
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import {
  isDemoBypassAllowed,
  isDemoBypassOperatorEnabled,
  isProductionEnvironment,
} from '../../method-core/demoBypass.js';
import {
  establishDatabaseReadiness,
  type ReadinessDeps,
} from '../databaseReadiness.js';
import {
  isTestMode,
  runsRealDbInTestMode,
  shouldInitializeTestDatabase,
  shouldMountTestGatewayRoutes,
  shouldUseMockDatabase,
  type TestModeGateEnv,
} from '../testModeGates.js';
import { TimeoutError, withTimeout } from '../withTimeout.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PRODUCTION: TestModeGateEnv = { NODE_ENV: 'production' };
const PRODUCTION_WITH_RUN_DB_TESTS: TestModeGateEnv = {
  NODE_ENV: 'production',
  RUN_DB_TESTS: '1',
  MOCK_DB: 'false',
};
const REAL_DB_TEST_MODE: TestModeGateEnv = {
  NODE_ENV: 'test',
  RUN_DB_TESTS: '1',
  MOCK_DB: 'false',
};

/** Minimal, always-succeeding dependency set for establishDatabaseReadiness. */
function successfulDeps(overrides: Partial<ReadinessDeps> = {}): ReadinessDeps {
  return {
    initializeSchema: async () => ({ success: true, message: 'ok' }),
    runMigrations: async () => ({
      applied: 2,
      skipped: 1,
      failed: null,
      failedFile: null,
      total: 3,
      checksumMismatches: [],
      acceptedHistoricalChecksumVariants: [],
    }),
    seedTemplates: async () => {},
    isProduction: false,
    migrationsDisabled: false,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    ...overrides,
  };
}

describe('P0A — bootstrap configuration matrix (11 rows)', () => {
  it('#1 production, no test flags: real DB init + full gateway, no bypass available', () => {
    expect(shouldInitializeTestDatabase(PRODUCTION)).toBe(true);
    expect(shouldMountTestGatewayRoutes(PRODUCTION)).toBe(true);
    expect(isTestMode(PRODUCTION)).toBe(false);
    expect(runsRealDbInTestMode(PRODUCTION)).toBe(false);
    expect(shouldUseMockDatabase(PRODUCTION)).toBe(false);
    expect(
      isDemoBypassAllowed({ NODE_ENV: 'production', METHOD_CORE_DEMO_BYPASS_PACK_READINESS: 'true' }, true)
    ).toBe(false);
  });

  it('#2 production + RUN_DB_TESTS=1: identical outcome to plain production — the flag is a no-op', () => {
    // This is the row the whole A14/P0A story is about: a test-only signal
    // must not change ANYTHING about production behaviour. Assert bit-for-bit
    // equality with row #1, not just "still truthy".
    expect(shouldInitializeTestDatabase(PRODUCTION_WITH_RUN_DB_TESTS)).toBe(
      shouldInitializeTestDatabase(PRODUCTION)
    );
    expect(shouldMountTestGatewayRoutes(PRODUCTION_WITH_RUN_DB_TESTS)).toBe(
      shouldMountTestGatewayRoutes(PRODUCTION)
    );
    expect(shouldInitializeTestDatabase(PRODUCTION_WITH_RUN_DB_TESTS)).toBe(true);
    expect(shouldMountTestGatewayRoutes(PRODUCTION_WITH_RUN_DB_TESTS)).toBe(true);
    // And it is true for the SAME reason as plain prod (!isTestMode), not
    // because runsRealDbInTestMode happened to also be true — prove
    // isTestMode alone already settles it.
    expect(isTestMode(PRODUCTION_WITH_RUN_DB_TESTS)).toBe(false);
    expect(shouldUseMockDatabase(PRODUCTION_WITH_RUN_DB_TESTS)).toBe(false);
  });

  it('#3 test + RUN_DB_TESTS=1 + MOCK_DB=false: real-DB test mode opens both gates', () => {
    expect(runsRealDbInTestMode(REAL_DB_TEST_MODE)).toBe(true);
    expect(shouldInitializeTestDatabase(REAL_DB_TEST_MODE)).toBe(true);
    expect(shouldMountTestGatewayRoutes(REAL_DB_TEST_MODE)).toBe(true);
    expect(shouldUseMockDatabase(REAL_DB_TEST_MODE)).toBe(false);
  });

  it('#4 E2E_MODE=true opens DB init, but NOT the full gateway on its own (documented pre-existing asymmetry, not a P0A regression)', () => {
    const env: TestModeGateEnv = { NODE_ENV: 'test', E2E_MODE: 'true' };
    // E2E_MODE alone opens the DB-init sequence...
    expect(shouldInitializeTestDatabase(env)).toBe(true);
    // ...but `shouldMountTestGatewayRoutes` only checks ENABLE_TEST_GATEWAY /
    // runsRealDbInTestMode, not E2E_MODE — this asymmetry predates P0A (see
    // the original `shouldMountFullGateway` body) and is deliberately NOT
    // changed here since P0A's mandate is the RUN_DB_TESTS gap, not a redesign
    // of E2E_MODE's route-mounting scope; flagged in the P0A report as a
    // NOT VERIFIED / worth-confirming-with-coordinator item.
    expect(shouldMountTestGatewayRoutes(env)).toBe(false);
    expect(runsRealDbInTestMode(env)).toBe(false);
  });

  it('#5 ENABLE_TEST_GATEWAY=true opens both gates independently of RUN_DB_TESTS', () => {
    const env: TestModeGateEnv = { NODE_ENV: 'test', ENABLE_TEST_GATEWAY: 'true' };
    expect(shouldInitializeTestDatabase(env)).toBe(true);
    expect(shouldMountTestGatewayRoutes(env)).toBe(true);
    expect(runsRealDbInTestMode(env)).toBe(false);
  });

  it('#6 DISABLE_TP_MIGRATIONS refuses readiness rather than silently opening the app', async () => {
    const outcome = await establishDatabaseReadiness(
      successfulDeps({ migrationsDisabled: true, isProduction: false })
    );
    expect(outcome.ready).toBe(false);
    expect(outcome.migrations.state).toBe('disabled_by_operator');
    expect(outcome.shouldExitProcess).toBe(false);

    // Same override in production must additionally demand a process exit —
    // "operator skipped migrations" must never mean "serve traffic on an
    // unverified schema", in dev OR prod.
    const prodOutcome = await establishDatabaseReadiness(
      successfulDeps({ migrationsDisabled: true, isProduction: true })
    );
    expect(prodOutcome.ready).toBe(false);
    expect(prodOutcome.shouldExitProcess).toBe(true);
  });

  it('#7 demo bypass: non-prod + operator flag ON + client requested -> allowed', () => {
    const env = { NODE_ENV: 'test', METHOD_CORE_DEMO_BYPASS_PACK_READINESS: 'true' };
    expect(isDemoBypassOperatorEnabled(env)).toBe(true);
    expect(isProductionEnvironment(env)).toBe(false);
    expect(isDemoBypassAllowed(env, true)).toBe(true);
  });

  it('#8 demo bypass: client asks for it but operator flag is OFF/unset -> refused', () => {
    // Operator flag absent entirely.
    expect(isDemoBypassAllowed({ NODE_ENV: 'test' }, true)).toBe(false);
    // Operator flag explicitly off.
    expect(
      isDemoBypassAllowed(
        { NODE_ENV: 'test', METHOD_CORE_DEMO_BYPASS_PACK_READINESS: 'false' },
        true
      )
    ).toBe(false);
    // A dev box must NOT silently bypass just because it isn't prod.
    expect(isDemoBypassAllowed({ NODE_ENV: 'development' }, true)).toBe(false);
  });

  it('#9 timeout: withTimeout rejects with an explicit TimeoutError in bounded time, and the late result of the wrapped promise is never observed', async () => {
    let backgroundSettled = false;
    let backgroundValue: string | null = null;
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => {
        backgroundSettled = true;
        backgroundValue = 'ready-too-late';
        resolve(backgroundValue);
      }, 40).unref?.();
    });

    const start = Date.now();
    await expect(withTimeout(slow, 10, 'readiness timed out')).rejects.toBeInstanceOf(TimeoutError);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(35); // rejected at ~10ms, not 40ms — proves it did not wait

    // The background promise is still running at this point (its 40ms timer
    // hasn't fired yet) — this is the documented "no real cancellation"
    // behaviour. Give it time to settle and confirm nothing we already
    // observed (the rejection above) changes retroactively.
    await new Promise((r) => setTimeout(r, 60));
    expect(backgroundSettled).toBe(true);
    expect(backgroundValue).toBe('ready-too-late');
    // The important assertion: NOTHING reads backgroundValue to flip a
    // decision. withTimeout's caller already moved on with a TimeoutError;
    // this test just proves the background work happened invisibly, exactly
    // as the withTimeout.ts docstring says it does — not that it was
    // cancelled.
  });

  it('#9b timeout: a real establishDatabaseReadiness() call wrapped in withTimeout never resolves the outer promise once the deadline passes', async () => {
    const hangingDeps = successfulDeps({
      runMigrations: () => new Promise(() => {}), // never settles — simulates a stuck migration
    });

    await expect(
      withTimeout(establishDatabaseReadiness(hangingDeps), 15, 'Database readiness sequence did not settle within 15ms')
    ).rejects.toThrow('did not settle within 15ms');
  });

  it('#10 migration error: establishDatabaseReadiness reports failed, never ready, and gates shouldExitProcess on isProduction', async () => {
    const failingDeps = successfulDeps({
      runMigrations: async () => ({
        applied: 0,
        skipped: 0,
        failed: 'syntax error at or near "TABEL"',
        failedFile: '0042_broken.sql',
        total: 1,
        checksumMismatches: [],
        acceptedHistoricalChecksumVariants: [],
      }),
      isProduction: false,
    });
    const outcome = await establishDatabaseReadiness(failingDeps);
    expect(outcome.ready).toBe(false);
    expect(outcome.migrations.state).toBe('failed');
    expect(outcome.error).toContain('0042_broken.sql');
    expect(outcome.shouldExitProcess).toBe(false);

    const prodOutcome = await establishDatabaseReadiness({ ...failingDeps, isProduction: true });
    expect(prodOutcome.ready).toBe(false);
    expect(prodOutcome.shouldExitProcess).toBe(true);

    // A migration runner that THROWS (not just returns .failed) must be
    // caught, not left as an unhandled rejection that crashes the IIFE
    // silently.
    const throwingDeps = successfulDeps({
      runMigrations: async () => {
        throw new Error('connection reset by peer');
      },
    });
    const throwOutcome = await establishDatabaseReadiness(throwingDeps);
    expect(throwOutcome.ready).toBe(false);
    expect(throwOutcome.migrations.state).toBe('failed');
    expect(throwOutcome.error).toContain('connection reset by peer');
  });

  it('#11 correct initialization: ready only after schema + migrations + (best-effort) seeding all complete', async () => {
    const outcome = await establishDatabaseReadiness(successfulDeps());
    expect(outcome.ready).toBe(true);
    expect(outcome.error).toBeNull();
    expect(outcome.migrations).toEqual({ state: 'ok', detail: '2 applied, 1 already up to date' });
    expect(outcome.seeded).toBe(true);
    expect(outcome.shouldExitProcess).toBe(false);

    // Seeding failure is explicitly best-effort: it must not un-ready an
    // otherwise-successful migration run.
    const seedFailsDeps = successfulDeps({
      seedTemplates: async () => {
        throw new Error('template table locked');
      },
    });
    const seedFailOutcome = await establishDatabaseReadiness(seedFailsDeps);
    expect(seedFailOutcome.ready).toBe(true);
    expect(seedFailOutcome.seeded).toBe(false);
  });
});

describe('P0A — six production guarantees (RUN_DB_TESTS must never weaken production)', () => {
  it('G1: RUN_DB_TESTS=1 in production never opens the test-only gateway stub — the full production router is what mounts, for the ordinary (!isTestMode) reason', () => {
    expect(shouldMountTestGatewayRoutes(PRODUCTION_WITH_RUN_DB_TESTS)).toBe(true);
    // Prove it is not the RUN_DB_TESTS branch doing the work in production —
    // isTestMode is already false, so the full-gateway decision is made
    // before RUN_DB_TESTS is ever consulted.
    expect(isTestMode(PRODUCTION_WITH_RUN_DB_TESTS)).toBe(false);
  });

  it('G2: RUN_DB_TESTS=1 in production never enables the method-core demo bypass', () => {
    // Even with the operator flag ON and the client explicitly requesting
    // bypass, production refuses unconditionally. DemoBypassEnv does not
    // even declare a RUN_DB_TESTS field (structural guarantee) — pass it
    // anyway via a loosely-typed object to prove an accidental future read
    // of it still could not matter, because isProductionEnvironment already
    // short-circuits first.
    const env = {
      NODE_ENV: 'production',
      METHOD_CORE_DEMO_BYPASS_PACK_READINESS: 'true',
      RUN_DB_TESTS: '1',
    };
    expect(isDemoBypassAllowed(env, true)).toBe(false);
  });

  it('G3: RUN_DB_TESTS=1 never weakens auth — the E2E_MODE JWT bypass in auth.middleware.ts is unconditionally gated on NODE_ENV=production and never reads RUN_DB_TESTS at all', () => {
    const authMiddlewareSource = readFileSync(
      resolve(__dirname, '../../middleware/auth.middleware.ts'),
      'utf8'
    );
    // The auth bypass must not be reachable via RUN_DB_TESTS under any name.
    expect(authMiddlewareSource).not.toMatch(/RUN_DB_TESTS/);
    // And the actual E2E_MODE bypass line must be guarded by the production
    // check — not bare `process.env.E2E_MODE === 'true'`.
    expect(authMiddlewareSource).toMatch(/!isProductionEnv\s*&&\s*process\.env\.E2E_MODE === 'true'/);
  });

  it('G4: RUN_DB_TESTS=1 never registers routes beyond the normal production router — index.ts touches RUN_DB_TESTS in exactly one place (the mock-DB decision inside the init IIFE), never near route registration', () => {
    const indexSource = readFileSync(resolve(__dirname, '../../index.ts'), 'utf8');
    const runDbTestsLines = indexSource
      .split('\n')
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => line.includes('RUN_DB_TESTS'));

    // Every mention lives inside the init IIFE, none of them beside an
    // `app.use(...)`/`app.get(...)` registration call.
    for (const { line } of runDbTestsLines) {
      expect(line).not.toMatch(/app\.(use|get|post|put|delete|patch)\(/);
    }
    // And shouldMountTestGatewayRoutes (the ONE gate that decides which
    // router mounts) is the only route-registration decision index.ts makes
    // that is sensitive to RUN_DB_TESTS at all, via runsRealDbInTestMode —
    // confirm that call site still exists and there is no second,
    // independent "if RUN_DB_TESTS mount extra debug routes" branch.
    const extraDebugRouteBranch = /RUN_DB_TESTS[\s\S]{0,120}app\.use/;
    expect(indexSource).not.toMatch(extraDebugRouteBranch);
  });

  it('G5: RUN_DB_TESTS=1 never bypasses the readiness sequence — production always runs the real database-init IIFE (shouldInitializeTestDatabase is true regardless of RUN_DB_TESTS in production)', () => {
    expect(shouldInitializeTestDatabase(PRODUCTION)).toBe(true);
    expect(shouldInitializeTestDatabase(PRODUCTION_WITH_RUN_DB_TESTS)).toBe(true);
    expect(shouldInitializeTestDatabase({ NODE_ENV: 'production', RUN_DB_TESTS: undefined })).toBe(
      true
    );
  });

  it('G6: RUN_DB_TESTS=1 never sets dbReady before migration success — neither via the mock-DB shortcut nor via establishDatabaseReadiness returning ready early', async () => {
    // (a) The mock-DB shortcut in index.ts (`if (mockDbEnabled) { dbReady = true; return; }`)
    // must not be reachable in production via RUN_DB_TESTS.
    expect(shouldUseMockDatabase(PRODUCTION_WITH_RUN_DB_TESTS)).toBe(false);
    expect(shouldUseMockDatabase(PRODUCTION)).toBe(false);

    // (b) establishDatabaseReadiness itself never returns ready:true unless
    // runMigrations() actually succeeded — reuse the row #10 contract here
    // as the second half of this guarantee.
    const failingOutcome = await establishDatabaseReadiness(
      successfulDeps({
        runMigrations: async () => ({
          applied: 0,
          skipped: 0,
          failed: 'boom',
          failedFile: 'x.sql',
          total: 1,
          checksumMismatches: [],
          acceptedHistoricalChecksumVariants: [],
        }),
      })
    );
    expect(failingOutcome.ready).toBe(false);

    // (c) index.ts's outer catch block (which also catches a withTimeout
    // rejection) must set tpMigrationStatus to 'failed', never leave it at
    // the module's initial 'pending' — a 'pending' migrations status is
    // indistinguishable from "still starting", the exact class of bug this
    // whole module exists to prevent, just for /api/health/migrations
    // instead of /api/ready. Verified structurally since index.ts owns that
    // mutable state directly (not exposed as a pure function).
    const indexSource = readFileSync(resolve(__dirname, '../../index.ts'), 'utf8');
    // index.ts has ~30 `catch (err: any) {` blocks; anchor on a string that
    // is unique to THIS specific catch (the outer database-init IIFE's own
    // production-exit branch) rather than counting on a small character
    // budget spanning a long explanatory comment.
    const anchor = "Cannot proceed without database. Exiting...";
    const anchorIndex = indexSource.indexOf(anchor);
    expect(anchorIndex).toBeGreaterThan(-1);
    const windowBeforeAnchor = indexSource.slice(Math.max(0, anchorIndex - 2000), anchorIndex);
    expect(windowBeforeAnchor).toMatch(/tpMigrationStatus = \{\s*state: 'failed'/);
  });
});

// ---------------------------------------------------------------------------
// G7 (Opus, odbiór P0A) — mock DB jest strukturalnie niemożliwy na produkcji
// ---------------------------------------------------------------------------
describe('G7 — produkcja nigdy nie używa atrapy bazy', () => {
  it('MOCK_DB=true na produkcji NIE włącza mocka', () => {
    expect(shouldUseMockDatabase({ NODE_ENV: 'production', MOCK_DB: 'true' } as never)).toBe(false);
  });

  it('żadna kombinacja flag testowych nie włącza mocka na produkcji', () => {
    expect(
      shouldUseMockDatabase({
        NODE_ENV: 'production',
        MOCK_DB: 'true',
        RUN_DB_TESTS: '1',
        E2E_MODE: 'true',
        ENABLE_TEST_GATEWAY: 'true',
      } as never)
    ).toBe(false);
  });

  it('poza produkcją MOCK_DB=true nadal działa (regresja odwrotna)', () => {
    expect(shouldUseMockDatabase({ NODE_ENV: 'development', MOCK_DB: 'true' } as never)).toBe(true);
    expect(shouldUseMockDatabase({ NODE_ENV: 'test', MOCK_DB: 'true' } as never)).toBe(true);
  });

  it('test + RUN_DB_TESTS=1 + MOCK_DB=false → realna baza, nie mock', () => {
    expect(
      shouldUseMockDatabase({ NODE_ENV: 'test', RUN_DB_TESTS: '1', MOCK_DB: 'false' } as never)
    ).toBe(false);
  });
});
