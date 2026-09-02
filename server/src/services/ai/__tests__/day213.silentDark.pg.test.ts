import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import logger from '../../../utils/Logger.js';
import { EmbeddingService } from '../embeddingService.js';

const vector = Array.from({ length: 1536 }, (_, index) => (index === 0 ? 1 : 0));

class DeterministicEmbeddingService extends EmbeddingService {
  async generateEmbedding(): Promise<number[]> {
    return vector;
  }
}

// FIX-213-2: the day210 warning ("scope column is missing — retrieval is
// silently dark") sat in a branch that day213's refactor made unreachable
// except when the information_schema/PRAGMA lookup itself throws. In the
// scenario the log exists for — the lookup succeeds, `scope` is simply not
// there — the code used to return one line earlier and say nothing. This
// test does NOT assert on the log call in isolation (that would just prove
// the log statement is still text in the file); it physically drops
// `knowledge_docs.scope` on a real, migration-built Postgres container,
// calls the real (unmocked) `EmbeddingService.search()` dispatcher, and
// checks the log fired as a SIDE EFFECT of that real call — the same
// behavioral standard the day210 mutation gate used for the leak itself.
describe('Day 213 silently-dark regression: scope column missing must still warn', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const organizationId = 'day213-dark-org';
  let service: DeterministicEmbeddingService;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    expect(process.env.DB_TYPE).toBe('postgres');

    // Confirm the column exists before we remove it, so a failure here can
    // never be misread as "column was already missing for an unrelated
    // reason" — the drop below is the thing under test, not a given.
    const before = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'knowledge_docs' AND column_name = 'scope'`
    );
    expect(before.rows).toHaveLength(1);

    await pool.query('ALTER TABLE knowledge_docs DROP COLUMN scope');

    const after = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'knowledge_docs' AND column_name = 'scope'`
    );
    expect(after.rows).toHaveLength(0);

    await pool.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [organizationId, 'Day 213 silently-dark org']
    );

    service = new DeterministicEmbeddingService();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await pool.end();
  });

  it('logs the "retrieval is silently dark" warning when scope is genuinely missing (query succeeds, column absent)', async () => {
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => logger as any);
    try {
      const results = await service.search('anything', {
        organizationId,
        userId: 'day213-dark-user',
        limit: 10,
      });

      // Fail-closed behavior: with `scope` missing, the shared filter excludes
      // the entire knowledge base rather than silently ignoring the column.
      expect(results).toEqual([]);

      const loudCalls = errorSpy.mock.calls.filter((call) =>
        String(call[0] ?? '').includes('retrieval is silently dark')
      );
      expect(
        loudCalls.length,
        `Expected the FIX-210 "retrieval is silently dark" log to fire when knowledge_docs.scope ` +
          `is missing and the information_schema lookup SUCCEEDS (no exception). ` +
          `logger.error was called with: ${JSON.stringify(errorSpy.mock.calls)}`
      ).toBeGreaterThan(0);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
