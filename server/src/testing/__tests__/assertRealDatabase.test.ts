/**
 * assertRealDatabase — fail-closed unit tests (S4, CEL B).
 *
 * Deliberately pure/no-DB: uses fake SqlRunners so the negative control
 * ("MOCK_DB=true stops the helper") is deterministic and repeatable in CI
 * without needing a live Postgres. The live, wired-in usage is proven
 * separately by the three suites this helper is added to (see
 * server/src/method-core/__tests__/http.integration.test.ts,
 * server/src/method-core/__tests__/freezeOutputFlow.integration.test.ts,
 * server/src/routes/v8/__tests__/assessment.accepted-freeze.pg.test.ts).
 */
import { describe, expect, it, vi } from 'vitest';

import {
  assertRealDatabase,
  fromAppDb,
  fromPgPool,
  isRealDatabaseTestModeRequested,
  type SqlRunner,
} from '../assertRealDatabase.js';

function realRow(overrides: Partial<{ current_database: string; current_schema: string }> = {}) {
  return [{ current_database: 'consultify_test', current_schema: 'public', ...overrides }];
}

describe('assertRealDatabase', () => {
  describe('isRealDatabaseTestModeRequested — env gate', () => {
    it('true only when BOTH RUN_DB_TESTS=1 and MOCK_DB=false', () => {
      expect(isRealDatabaseTestModeRequested({ RUN_DB_TESTS: '1', MOCK_DB: 'false' } as any)).toBe(true);
    });
    it('false when RUN_DB_TESTS is missing', () => {
      expect(isRealDatabaseTestModeRequested({ MOCK_DB: 'false' } as any)).toBe(false);
    });
    it('false when MOCK_DB=true (the exact regression this helper guards)', () => {
      expect(isRealDatabaseTestModeRequested({ RUN_DB_TESTS: '1', MOCK_DB: 'true' } as any)).toBe(false);
    });
    it('false when MOCK_DB is unset entirely', () => {
      expect(isRealDatabaseTestModeRequested({ RUN_DB_TESTS: '1' } as any)).toBe(false);
    });
  });

  describe('assertRealDatabase — negative controls (fail-closed)', () => {
    it('★ MOCK_DB=true STOPS the helper even if the runner WOULD return a perfectly valid row', async () => {
      const runner: SqlRunner = vi.fn().mockResolvedValue(realRow());
      await expect(
        assertRealDatabase(runner, { RUN_DB_TESTS: '1', MOCK_DB: 'true' } as any)
      ).rejects.toThrow(/RUN_DB_TESTS=1 and MOCK_DB=false/);
      // The env gate must short-circuit BEFORE ever touching the connection.
      expect(runner).not.toHaveBeenCalled();
    });

    it('RUN_DB_TESTS unset stops the helper', async () => {
      const runner: SqlRunner = vi.fn().mockResolvedValue(realRow());
      await expect(assertRealDatabase(runner, { MOCK_DB: 'false' } as any)).rejects.toThrow(
        /RUN_DB_TESTS=1 and MOCK_DB=false/
      );
      expect(runner).not.toHaveBeenCalled();
    });

    it('env gate satisfied but the connection throws (unreachable host) => rejects, does not swallow', async () => {
      const runner: SqlRunner = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:1'));
      await expect(
        assertRealDatabase(runner, { RUN_DB_TESTS: '1', MOCK_DB: 'false' } as any)
      ).rejects.toThrow(/Could not execute a real round-trip query/);
    });

    it('env gate satisfied but the query returns zero rows (e.g. a stub/mock masquerading as a client) => rejects', async () => {
      const runner: SqlRunner = vi.fn().mockResolvedValue([]);
      await expect(
        assertRealDatabase(runner, { RUN_DB_TESTS: '1', MOCK_DB: 'false' } as any)
      ).rejects.toThrow(/no usable row/);
    });

    it('env gate satisfied but current_database is empty string => rejects', async () => {
      const runner: SqlRunner = vi.fn().mockResolvedValue(realRow({ current_database: '' }));
      await expect(
        assertRealDatabase(runner, { RUN_DB_TESTS: '1', MOCK_DB: 'false' } as any)
      ).rejects.toThrow(/no usable row/);
    });
  });

  describe('assertRealDatabase — positive path', () => {
    it('resolves with current_database/current_schema when the gate AND the query both succeed', async () => {
      const runner: SqlRunner = vi.fn().mockResolvedValue(realRow({ current_database: 'consultify_asm_s4' }));
      const proof = await assertRealDatabase(runner, { RUN_DB_TESTS: '1', MOCK_DB: 'false' } as any);
      expect(proof).toEqual({ currentDatabase: 'consultify_asm_s4', currentSchema: 'public' });
      expect(runner).toHaveBeenCalledWith(expect.stringContaining('current_database()'));
    });
  });

  describe('adapters', () => {
    it('fromPgPool unwraps { rows } from a pg.Pool-shaped client', async () => {
      const pool = { query: vi.fn().mockResolvedValue({ rows: realRow() }) };
      const runner = fromPgPool(pool);
      const rows = await runner('SELECT 1');
      expect(rows).toEqual(realRow());
      expect(pool.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('fromAppDb passes rows through directly (app db .all() has no { rows } envelope)', async () => {
      const db = { all: vi.fn().mockResolvedValue(realRow()) };
      const runner = fromAppDb(db);
      const rows = await runner('SELECT 1');
      expect(rows).toEqual(realRow());
    });

    it('fromAppDb tolerates a nullish .all() result (defensive — treated as zero rows, not a crash)', async () => {
      const db = { all: vi.fn().mockResolvedValue(undefined) };
      const runner = fromAppDb(db);
      const rows = await runner('SELECT 1');
      expect(rows).toEqual([]);
    });
  });
});
