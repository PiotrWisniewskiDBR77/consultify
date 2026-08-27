/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_PG)('declared goal perspective migration', () => {
  const organizationId = `day33-perspective-${randomUUID()}`;
  const ids: string[] = [];
  let client: Client;

  beforeAll(async () => {
    // FIX-5 (odbior dyzuru 33) — DRUGI ZAMEK, niezbedny: vitest 4.1.8 URUCHAMIA hooki
    // beforeAll/afterAll suity oznaczonej `describe.skipIf(true)`. Sam warunek przy `describe`
    // NIE chroni polaczenia ani sprzatania. Zweryfikowane empirycznie na tej gałęzi:
    // z pustym DATABASE_URL hooki laczyly sie przez domyslne libpq do CUDZEJ bazy
    // (/private/tmp/.s.PGSQL.5432) i wykonywaly tam DELETE.
    if (!REAL_PG) return;
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,$1)`, [organizationId]);
  });

  afterAll(async () => {
    // FIX-5: patrz komentarz w beforeAll — hooki skipnietej suity i tak sie wykonuja,
    // a ponizej sa DELETE-y. Bez tego zamka sprzatanie leci w cudza baze.
    if (!REAL_PG || !client) return;
    await client.query(`DELETE FROM goals WHERE organization_id=$1`, [organizationId]);
    await client.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await client.end();
  });

  it.each(['financial', 'customer', 'process', 'learning', 'governance_data_quality'])(
    'accepts the declared perspective %s',
    async (perspective) => {
      const id = `goal-${randomUUID()}`;
      ids.push(id);
      await expect(
        client.query(
          `INSERT INTO goals(id,organization_id,title,perspective) VALUES($1,$2,$3,$4)`,
          [id, organizationId, id, perspective]
        )
      ).resolves.toMatchObject({ rowCount: 1 });
    }
  );

  it('preserves NULL as the unassigned product state', async () => {
    const id = `goal-${randomUUID()}`;
    ids.push(id);
    await client.query(
      `INSERT INTO goals(id,organization_id,title,perspective) VALUES($1,$2,$3,NULL)`,
      [id, organizationId, id]
    );
    const read = await client.query(`SELECT perspective FROM goals WHERE id=$1`, [id]);
    expect(read.rows[0]?.perspective).toBeNull();
  });

  it('rejects a sixth, undeclared perspective at the database boundary', async () => {
    const id = `goal-${randomUUID()}`;
    await expect(
      client.query(`INSERT INTO goals(id,organization_id,title,perspective) VALUES($1,$2,$3,$4)`, [
        id,
        organizationId,
        id,
        'guessed_from_name',
      ])
    ).rejects.toMatchObject({ code: '23514' });
  });
});
