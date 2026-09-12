import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import { withOrganizationExportSnapshot } from '../organizationExportSnapshot.js';

const databaseUrl = process.env.DATABASE_URL || '';
const expectedDatabase = process.env.C6_EXPORT_TEST_DATABASE || '';
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const pool = new Pool({ connectionString: databaseUrl, max: 6 });
const orgIds: string[] = [];
async function organization() {
  const id = randomUUID();
  orgIds.push(id);
  await pool.query('INSERT INTO organizations(id,name) VALUES ($1,$2)', [
    id,
    `Export snapshot ${id}`,
  ]);
  return id;
}
async function waitForLock(pid: number) {
  for (let i = 0; i < 100; i++) {
    const result = await pool.query(
      "SELECT 1 FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND granted=false",
      [pid]
    );
    if (result.rowCount) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('export did not wait on advisory lock');
}
beforeAll(async () => {
  expect(expectedDatabase.startsWith('cx6_')).toBe(true);
  const identity = await assertRealPostgresTestEnvironment({ expectedDatabase });
  expect(identity.host).toBe('127.0.0.1');
  expect(identity.port).toBe('6457');
});
afterAll(async () => {
  await pool.query('DELETE FROM org_policies WHERE organization_id=ANY($1::text[])', [orgIds]);
  await pool.query('DELETE FROM organizations WHERE id=ANY($1::text[])', [orgIds]);
  await pool.end();
  const db = await import('../../database/PostgresDatabase.js');
  await db.default.close();
});

describe('real PostgreSQL export session lock and connection lifecycle', () => {
  it.each(['absent', 'existing'])(
    'canonical policy writer first (%s) blocks snapshot until committed legal hold',
    async (mode) => {
      const orgId = await organization();
      const db = await import('../../database/PostgresDatabase.js');
      const policy = await import('../OrgPoliciesService.js');
      if (mode === 'existing') await policy.upsertOrgPolicy(orgId, { legalHoldEnabled: false });
      const writer = await pool.connect();
      const original = writer.query.bind(writer);
      const atCommit = deferred();
      const releaseCommit = deferred();
      writer.query = (async (sql: string, ...args: unknown[]) => {
        if (sql === 'COMMIT') {
          atCommit.resolve();
          await releaseCommit.promise;
        }
        return (original as any)(sql, ...args);
      }) as typeof writer.query;
      const acquire = vi.spyOn(db, 'acquirePgClient').mockResolvedValueOnce(writer);
      const writing = policy.upsertOrgPolicy(orgId, { legalHoldEnabled: true });
      await atCommit.promise;
      acquire.mockRestore();
      const exporting = await pool.connect();
      const pid = (await exporting.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const read = vi.fn(async () => 'file');
      // Attach rejection handling before deliberately releasing the writer.
      const outcome = withOrganizationExportSnapshot(exporting, orgId, read).then(
        (value) => ({ value, error: null }),
        (error) => ({ value: null, error })
      );
      try {
        await waitForLock(pid);
      } finally {
        releaseCommit.resolve();
      }
      await writing;
      const result = await outcome;
      expect(result.error?.code).toBe('LEGAL_HOLD');
      expect(result.value).toBeNull();
      expect(read).not.toHaveBeenCalled();
    }
  );
  it('export-first blocks canonical policy writer until snapshot commit and unlock', async () => {
    const orgId = await organization();
    const policy = await import('../OrgPoliciesService.js');
    const entered = deferred();
    const finish = deferred();
    const exporting = await pool.connect();
    const read = withOrganizationExportSnapshot(exporting, orgId, async () => {
      entered.resolve();
      await finish.promise;
      return 'file';
    });
    await entered.promise;
    let writerDone = false;
    const write = policy.upsertOrgPolicy(orgId, { legalHoldEnabled: true }).then(() => {
      writerDone = true;
    });
    try {
      for (let i = 0; i < 100; i++) {
        const locks = await pool.query(
          "SELECT 1 FROM pg_locks WHERE locktype='advisory' AND granted=false"
        );
        if (locks.rowCount) break;
        if (i === 99) throw new Error('policy writer never waited');
        await new Promise((r) => setTimeout(r, 20));
      }
      expect(writerDone).toBe(false);
    } finally {
      finish.resolve();
    }
    expect(await read).toBe('file');
    await write;
    expect(writerDone).toBe(true);
  });
  it('read-only export snapshot rejects accidental writes and releases the lock after rollback', async () => {
    const orgId = await organization();
    const client = await pool.connect();
    await expect(
      withOrganizationExportSnapshot(client, orgId, (pinned) =>
        pinned.query('UPDATE organizations SET name=$1 WHERE id=$2', ['forbidden', orgId])
      )
    ).rejects.toMatchObject({ code: '25006' });
    const next = await pool.connect();
    try {
      expect(
        (
          await next.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired', [
            orgId,
          ])
        ).rows[0].acquired
      ).toBe(true);
      await next.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [orgId]);
    } finally {
      next.release();
    }
    expect(
      (await pool.query('SELECT name FROM organizations WHERE id=$1', [orgId])).rows[0].name
    ).not.toBe('forbidden');
  });
  it('lost lock acquisition ACK destroys locked backend and next checkout is a different healthy backend', async () => {
    const orgId = await organization();
    const isolated = new Pool({ connectionString: databaseUrl, max: 1 });
    const client = await isolated.connect();
    const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const original = client.query.bind(client);
    client.query = (async (sql: string, ...args: unknown[]) => {
      const result = await (original as any)(sql, ...args);
      if (sql.includes('pg_advisory_lock('))
        throw new Error('simulated lost ACK after actual acquisition');
      return result;
    }) as typeof client.query;
    await expect(withOrganizationExportSnapshot(client, orgId, async () => 'file')).rejects.toThrow(
      'simulated lost ACK'
    );
    const next = await isolated.connect();
    try {
      expect((await next.query('SELECT pg_backend_pid() AS pid')).rows[0].pid).not.toBe(pid);
      expect(
        (
          await next.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired', [
            orgId,
          ])
        ).rows[0].acquired
      ).toBe(true);
      await next.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [orgId]);
    } finally {
      next.release();
      await isolated.end();
    }
  });
  it.each(['false', 'throw'])(
    'unconfirmed unlock %s discards client from real pool',
    async (mode) => {
      const orgId = await organization();
      const isolated = new Pool({ connectionString: databaseUrl, max: 1 });
      const client = await isolated.connect();
      const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const original = client.query.bind(client);
      client.query = (async (sql: string, ...args: unknown[]) => {
        if (sql.includes('pg_advisory_unlock(')) {
          if (mode === 'throw') throw new Error('unlock socket lost');
          return { rows: [{ unlocked: false }] };
        }
        return (original as any)(sql, ...args);
      }) as typeof client.query;
      await withOrganizationExportSnapshot(client, orgId, async () => 'file');
      const next = await isolated.connect();
      try {
        expect((await next.query('SELECT pg_backend_pid() AS pid')).rows[0].pid).not.toBe(pid);
      } finally {
        next.release();
        await isolated.end();
      }
    }
  );
});
