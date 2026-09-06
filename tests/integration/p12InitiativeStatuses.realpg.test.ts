import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const connectionString = process.env.DATABASE_URL;
const configured = Boolean(connectionString || process.env.PGHOST);
const orgId = `p12-test-${randomUUID()}`;
const initiativeId = `p12-test-${randomUUID()}`;
const statuses = ['PROPOSED', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_EXECUTION', 'CLOSED', 'REJECTED'];
const client = new Client(process.env.PGHOST ? undefined : { connectionString });

describe.runIf(configured)('P12 status dictionary on RealPG', () => {
  beforeAll(async () => {
    await client.connect();
    await client.query('INSERT INTO organizations (id, name, status) VALUES ($1, $2, $3)', [orgId, 'P12 isolated fixture', 'active']);
    await client.query('INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)', [initiativeId, orgId, 'P12 isolated initiative', 'PROPOSED']);
  });

  afterAll(async () => {
    await client.query('DELETE FROM initiatives WHERE organization_id = $1', [orgId]);
    const remaining = await client.query<{ count: string }>('SELECT count(*)::text AS count FROM initiatives WHERE organization_id = $1', [orgId]);
    expect(remaining.rows[0]?.count).toBe('0');
    await client.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    await client.end();
  });

  it('accepts every and only the seven DEC-424 statuses', async () => {
    for (const status of statuses) {
      const result = await client.query('UPDATE initiatives SET status = $1 WHERE id = $2 AND organization_id = $3 RETURNING status', [status, initiativeId, orgId]);
      expect(result.rows[0]?.status).toBe(status);
    }
    await expect(client.query('UPDATE initiatives SET status = $1 WHERE id = $2 AND organization_id = $3', ['EXECUTING', initiativeId, orgId])).rejects.toMatchObject({ code: '23514' });
  });

  it('persists on_hold and archived independently from status', async () => {
    const result = await client.query('UPDATE initiatives SET status = $1, on_hold = true, archived = true WHERE id = $2 AND organization_id = $3 RETURNING status, on_hold, archived', ['CLOSED', initiativeId, orgId]);
    expect(result.rows[0]).toEqual({ status: 'CLOSED', on_hold: true, archived: true });
  });
});
