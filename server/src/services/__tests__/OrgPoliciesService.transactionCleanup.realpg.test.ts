import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import * as database from '../../database/PostgresDatabase.js';
import { upsertOrgPolicy } from '../OrgPoliciesService.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const observations: unknown[] = [];
beforeAll(async () => {
  const expectedDatabase = process.env.C6_EXPORT_TEST_DATABASE || '';
  expect(expectedDatabase.startsWith('cx6_')).toBe(true);
  const identity = await assertRealPostgresTestEnvironment({ expectedDatabase });
  expect(identity.host).toBe('127.0.0.1'); expect(identity.port).toBe('6457');
});
afterAll(async () => {
  vi.restoreAllMocks(); await pool.end(); await database.default.close();
  if (process.env.C6_POLICY_PROOF_OUT) {
    const fs = await import('node:fs'); fs.writeFileSync(process.env.C6_POLICY_PROOF_OUT, JSON.stringify(observations,null,2));
  }
});
async function seed() {
  const org = randomUUID();
  await pool.query('INSERT INTO organizations(id,name) VALUES ($1,$2)', [org, 'Independent policy cleanup fixture']);
  await upsertOrgPolicy(org, { retentionDays: 30, legalHoldEnabled: false, residencyRegion: 'EU' });
  return org;
}
describe('Independent real PostgreSQL policy writer cleanup', () => {
  it.each(['BEGIN ACK lost', 'UPDATE ACK lost'])('%s plus unsent rollback destroys backend and preserves committed row', async (point) => {
    const org = await seed();
    const before = (await pool.query('SELECT * FROM org_policies WHERE organization_id=$1',[org])).rows[0];
    const client = await pool.connect(); const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const original = client.query.bind(client); const failure = new Error(point); let rollbackAttempted = false;
    client.query = (async (sql: string, ...args: unknown[]) => {
      if(sql==='ROLLBACK') { rollbackAttempted=true; throw new Error('controlled rollback not sent'); }
      const result = await (original as any)(sql,...args);
      if ((point==='BEGIN ACK lost' && sql==='BEGIN') || (point==='UPDATE ACK lost' && sql.startsWith('UPDATE org_policies'))) throw failure;
      return result;
    }) as typeof client.query;
    const acquire = vi.spyOn(database,'acquirePgClient').mockResolvedValueOnce(client);
    try { await expect(upsertOrgPolicy(org,{legalHoldEnabled:true})).rejects.toBe(failure); }
    finally { acquire.mockRestore(); }
    expect(rollbackAttempted).toBe(true);
    const next = await pool.connect();
    try {
      const newPid = (await next.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      expect(newPid).not.toBe(pid);
      const locked = (await next.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS acquired',[org])).rows[0].acquired;
      expect(locked).toBe(true);
      await next.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[org]);
      const after = (await next.query('SELECT * FROM org_policies WHERE organization_id=$1',[org])).rows[0];
      expect(after).toEqual(before);
      observations.push({point,org,pid,newPid,rollbackAttempted,lockAcquired:locked,rowUnchanged:JSON.stringify(after)===JSON.stringify(before)});
    } finally { next.release(); }
  });
  it('canonical partial patches preserve omitted values and persist explicit null and false', async () => {
    const org = await seed();
    const hold = await upsertOrgPolicy(org,{legalHoldEnabled:true});
    expect(hold).toMatchObject({retention_days:30,residency_region:'EU',legal_hold_enabled:1});
    const cleared = await upsertOrgPolicy(org,{retentionDays:null,residencyRegion:null,legalHoldEnabled:false});
    expect(cleared).toMatchObject({retention_days:null,residency_region:null,legal_hold_enabled:0});
    const retained = await upsertOrgPolicy(org,{});
    expect(retained).toMatchObject({retention_days:null,residency_region:null,legal_hold_enabled:0});
    const row = (await pool.query('SELECT * FROM org_policies WHERE organization_id=$1',[org])).rows[0];
    expect(row).toEqual(retained);
    observations.push({point:'partial patches',org,readback:row});
  });
});
