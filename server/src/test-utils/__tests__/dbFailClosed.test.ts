/**
 * @vitest-environment node
 *
 * dbFailClosed — unit-level proof that EVERY guard actually throws (CEL 10,
 * 2026-08-13). Uses a stub pool (no real database) so this file runs
 * unconditionally, complementing (not replacing) the live-Postgres proof
 * already logged by every `*.integration.test.ts` that calls
 * `assertRealPostgresTestDb` in its own `beforeAll` — see
 * `server/src/method-core/__tests__/{http,freezeOutputFlow,artifactsRecovery}.integration.test.ts`.
 *
 * The point of this file is narrow: prove `assertRealPostgresTestDb` is not
 * a no-op that always resolves — each of its five failure conditions must
 * independently throw `DbFailClosedError`, and the success path must
 * independently NOT throw and must return the parsed proof.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { assertRealPostgresTestDb, DbFailClosedError } from '../dbFailClosed.js';

const ORIGINAL_ENV = { ...process.env };

function makeStubPool(row: Record<string, unknown> | null, queryError?: Error) {
  return {
    query: async () => {
      if (queryError) throw queryError;
      return { rows: row ? [row] : [] };
    },
  };
}

const REAL_PG_ROW = {
  current_database: 'stub_db',
  current_schema: 'public',
  version: 'PostgreSQL 15.18 (Debian 15.18-1.pgdg12+1) on aarch64, stub',
};

describe('assertRealPostgresTestDb — every guard independently throws', () => {
  beforeEach(() => {
    process.env.RUN_DB_TESTS = '1';
    process.env.MOCK_DB = 'false';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('1. throws when RUN_DB_TESTS is not exactly "1" (missing)', async () => {
    delete process.env.RUN_DB_TESTS;
    await expect(assertRealPostgresTestDb(makeStubPool(REAL_PG_ROW))).rejects.toThrow(DbFailClosedError);
  });

  it("1b. throws when RUN_DB_TESTS is truthy but not exactly '1' (e.g. 'true')", async () => {
    process.env.RUN_DB_TESTS = 'true';
    await expect(assertRealPostgresTestDb(makeStubPool(REAL_PG_ROW))).rejects.toThrow(/RUN_DB_TESTS/);
  });

  it('2. throws when MOCK_DB is not exactly "false" (missing)', async () => {
    delete process.env.MOCK_DB;
    await expect(assertRealPostgresTestDb(makeStubPool(REAL_PG_ROW))).rejects.toThrow(DbFailClosedError);
  });

  it("2b. throws when MOCK_DB is 'true' (an explicit mock request)", async () => {
    process.env.MOCK_DB = 'true';
    await expect(assertRealPostgresTestDb(makeStubPool(REAL_PG_ROW))).rejects.toThrow(/MOCK_DB/);
  });

  it('3. throws when the pool cannot execute a query at all (connection failure)', async () => {
    await expect(
      assertRealPostgresTestDb(makeStubPool(null, new Error('ECONNREFUSED stub')))
    ).rejects.toThrow(/could not execute a query/);
  });

  it('4. throws when version() does not report PostgreSQL (e.g. a mock/sqlite stand-in)', async () => {
    await expect(
      assertRealPostgresTestDb(
        makeStubPool({ current_database: 'stub_db', current_schema: 'public', version: 'SQLite 3.42.0' })
      )
    ).rejects.toThrow(/did not report PostgreSQL/);
  });

  it('4b. throws when version() is entirely absent from the row', async () => {
    await expect(
      assertRealPostgresTestDb(makeStubPool({ current_database: 'stub_db', current_schema: 'public' }))
    ).rejects.toThrow(DbFailClosedError);
  });

  it('5. throws when current_database()/current_schema() come back empty despite a Postgres-looking version()', async () => {
    await expect(
      assertRealPostgresTestDb(
        makeStubPool({ current_database: '', current_schema: '', version: 'PostgreSQL 15.18' })
      )
    ).rejects.toThrow(/current_database\(\)\/current_schema\(\)/);
  });

  it('success: resolves with the exact parsed proof when every condition holds', async () => {
    const proof = await assertRealPostgresTestDb(makeStubPool(REAL_PG_ROW));
    expect(proof).toEqual({
      database: 'stub_db',
      schema: 'public',
      version: REAL_PG_ROW.version,
    });
  });
});
