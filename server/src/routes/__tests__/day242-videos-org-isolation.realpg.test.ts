/** @vitest-environment node */
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

describe('Day 242 videos organization isolation schema prerequisite', NO_RETRY, () => {
  it('has the migrated videos table required before an ApiGateway mutation proof can run', async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name='videos' AND column_name='organization_id'`
      );
      expect(result.rows).toEqual([{ column_name: 'organization_id' }]);
    } finally {
      await pool.end();
    }
  });
});
