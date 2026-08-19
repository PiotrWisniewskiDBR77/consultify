import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;

describeRealDb('Initiative Card PostgreSQL schema', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });

  beforeAll(async () => {
    for (const migrationName of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
    ]) {
      const migration = await readFile(
        path.resolve('server/migrations', migrationName),
        'utf8'
      );
      await pool.query(migration);
    }
  });

  it('contains exactly the closed 26-card catalog', async () => {
    const result = await pool.query<{ card_key: string }>(
      'SELECT card_key FROM ie_initiative_card_catalog WHERE active = TRUE ORDER BY card_key'
    );
    expect(result.rows).toHaveLength(26);
    expect(result.rows.map((row) => row.card_key)).toContain('summary-scope');
    expect(result.rows.map((row) => row.card_key)).toContain('comments-activity-history');
  });

  it('rejects an unknown card and omission of a required card without waiver', async () => {
    await expect(
      pool.query(`INSERT INTO ie_initiative_card_selection
        (organization_id, initiative_id, card_key, included, position, requiredness)
        VALUES ('org-schema','initiative-schema','invented-card',TRUE,0,'OPTIONAL')`)
    ).rejects.toThrow();
    await expect(
      pool.query(`INSERT INTO ie_initiative_card_selection
        (organization_id, initiative_id, card_key, included, position, requiredness)
        VALUES ('org-schema','initiative-schema','summary-scope',FALSE,0,'REQUIRED')`)
    ).rejects.toThrow();
  });

  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, 'org-schema');
    await pool.end();
  });
});
