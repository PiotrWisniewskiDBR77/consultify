/**
 * A14 (2026-08-13) regression coverage — see index.ts and testModeGates.ts.
 *
 * Reproduces the exact defect from the boot investigation: the server was
 * started with
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false npx tsx src/index.ts
 * (the project's documented way to run against a REAL database under test
 * mode) and never became ready. `/api/ready` reported
 * `{"status":"not_ready","error":null}` forever, and even after the
 * readiness gate was understood to be the culprit, `/api/method/packs`
 * still 404'd because a SECOND, independent gate skipped mounting the full
 * API Gateway under the same env combination.
 *
 * Both gates are pure functions of `process.env` now, so this is tested
 * directly with no live server, no database, and no vitest-hangs-forever
 * risk.
 */
import { describe, expect, it } from 'vitest';

import {
  isTestMode,
  runsRealDbInTestMode,
  shouldMountTestGatewayRoutes,
  shouldInitializeTestDatabase,
  shouldStartPersistentBackgroundWorkers,
} from '../testModeGates.js';

const REAL_DB_TEST_ENV = {
  NODE_ENV: 'test',
  RUN_DB_TESTS: '1',
  MOCK_DB: 'false',
};

describe('A14 — testModeGates (server boot readiness)', () => {
  describe('runsRealDbInTestMode', () => {
    it('is true for the documented real-DB test-mode combination', () => {
      expect(runsRealDbInTestMode(REAL_DB_TEST_ENV)).toBe(true);
    });

    it('is false when MOCK_DB=true even with RUN_DB_TESTS=1', () => {
      expect(runsRealDbInTestMode({ RUN_DB_TESTS: '1', MOCK_DB: 'true' })).toBe(false);
    });

    it('is false when RUN_DB_TESTS is unset (the default, silently-mocked mode)', () => {
      expect(runsRealDbInTestMode({ MOCK_DB: 'false' })).toBe(false);
    });
  });

  describe('shouldInitializeTestDatabase — the flag that used to strand dbReady=false forever', () => {
    it('REGRESSION: opens under NODE_ENV=test + RUN_DB_TESTS=1 + MOCK_DB=false', () => {
      // Before the fix this was `false`, so the async IIFE that sets
      // `dbReady = true` / `dbInitError` in index.ts never ran at all —
      // dbReady stayed false and dbInitError stayed null indefinitely, which
      // is indistinguishable from "still starting" on /api/ready.
      expect(shouldInitializeTestDatabase(REAL_DB_TEST_ENV)).toBe(true);
    });

    it('still opens for E2E_MODE=true (pre-existing behavior preserved)', () => {
      expect(shouldInitializeTestDatabase({ NODE_ENV: 'test', E2E_MODE: 'true' })).toBe(true);
    });

    it('still opens for ENABLE_TEST_GATEWAY=true (pre-existing behavior preserved)', () => {
      expect(shouldInitializeTestDatabase({ NODE_ENV: 'test', ENABLE_TEST_GATEWAY: 'true' })).toBe(
        true
      );
    });

    it('still opens outside test mode entirely (production/dev, pre-existing behavior preserved)', () => {
      expect(shouldInitializeTestDatabase({ NODE_ENV: 'production' })).toBe(true);
      expect(shouldInitializeTestDatabase({ NODE_ENV: 'development' })).toBe(true);
    });

    it('stays CLOSED for the plain Vitest unit-test default (no regression: still mocks quietly)', () => {
      // NODE_ENV=test with none of E2E_MODE / ENABLE_TEST_GATEWAY /
      // RUN_DB_TESTS=1 set is the ordinary `vitest run` case, which must
      // keep mocking the database rather than opening a real connection.
      expect(shouldInitializeTestDatabase({ NODE_ENV: 'test' })).toBe(false);
    });

    it('stays CLOSED when RUN_DB_TESTS=1 but MOCK_DB=true (explicit mock wins)', () => {
      expect(
        shouldInitializeTestDatabase({ NODE_ENV: 'test', RUN_DB_TESTS: '1', MOCK_DB: 'true' })
      ).toBe(false);
    });
  });

  describe('shouldMountTestGatewayRoutes — the flag that left /api/method/packs 404ing', () => {
    it('REGRESSION: opens under NODE_ENV=test + RUN_DB_TESTS=1 + MOCK_DB=false', () => {
      // Before the fix this was `false`, so index.ts mounted only the
      // `/api/management-reports` stub router instead of
      // `apiGateway.initializeRoutes(app)` — every other route, including
      // /api/method/*, was simply never registered (404, not 503).
      expect(shouldMountTestGatewayRoutes(REAL_DB_TEST_ENV)).toBe(true);
    });

    it('stays CLOSED for the plain Vitest unit-test default (no regression: gateway load stays cheap)', () => {
      expect(shouldMountTestGatewayRoutes({ NODE_ENV: 'test' })).toBe(false);
    });

    it('still opens for ENABLE_TEST_GATEWAY=true (pre-existing behavior preserved)', () => {
      expect(shouldMountTestGatewayRoutes({ NODE_ENV: 'test', ENABLE_TEST_GATEWAY: 'true' })).toBe(
        true
      );
    });

    it('still opens outside test mode entirely (pre-existing behavior preserved)', () => {
      expect(shouldMountTestGatewayRoutes({ NODE_ENV: 'production' })).toBe(true);
    });
  });

  describe('isTestMode', () => {
    it('is true for NODE_ENV=test', () => {
      expect(isTestMode({ NODE_ENV: 'test' })).toBe(true);
    });
    it('is true when VITEST is set regardless of NODE_ENV', () => {
      expect(isTestMode({ NODE_ENV: 'production', VITEST: 'true' })).toBe(true);
    });
    it('is false otherwise', () => {
      expect(isTestMode({ NODE_ENV: 'production' })).toBe(false);
    });
  });

  describe('shouldStartPersistentBackgroundWorkers', () => {
    it('disables durable workers for an explicit local MOCK_DB runtime', () => {
      expect(shouldStartPersistentBackgroundWorkers({ NODE_ENV: 'test', MOCK_DB: 'true' })).toBe(
        false
      );
    });

    it('keeps durable workers enabled for real-DB test and normal runtimes', () => {
      expect(shouldStartPersistentBackgroundWorkers(REAL_DB_TEST_ENV)).toBe(true);
      expect(shouldStartPersistentBackgroundWorkers({ NODE_ENV: 'development' })).toBe(true);
      expect(
        shouldStartPersistentBackgroundWorkers({ NODE_ENV: 'production', MOCK_DB: 'true' })
      ).toBe(true);
    });
  });
});
