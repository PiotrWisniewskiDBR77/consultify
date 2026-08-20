import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import express from 'express';
import request from 'supertest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_PG)('valuationRegistrationService (real PostgreSQL)', () => {
  const orgId = `org-valuation-registration-${randomUUID()}`;
  const foreignOrgId = `org-valuation-registration-foreign-${randomUUID()}`;
  const userId = `user-valuation-registration-${randomUUID()}`;
  const foreignBudgetId = `budget-valuation-registration-${randomUUID()}`;
  let client: Client;
  let createRegisteredValuation: typeof import('../valuationRegistrationService.js').createRegisteredValuation;

  const counts = async () =>
    (
      await client.query(
        `SELECT
           (SELECT count(*)::int FROM valuations WHERE organization_id=$1) legacy,
           (SELECT count(*)::int FROM finance_artifacts WHERE organization_id=$1 AND artifact_type='VALUATION_CASE') artifacts,
           (SELECT count(*)::int FROM finance_business_versions WHERE organization_id=$1 AND artifact_id IN
              (SELECT artifact_id FROM finance_artifacts WHERE organization_id=$1 AND artifact_type='VALUATION_CASE')) versions,
           (SELECT count(*)::int FROM finance_working_revisions WHERE organization_id=$1 AND artifact_id IN
              (SELECT artifact_id FROM finance_artifacts WHERE organization_id=$1 AND artifact_type='VALUATION_CASE')) revisions,
           (SELECT count(*)::int FROM finance_valuation_cases WHERE organization_id=$1) cases,
           (SELECT count(*)::int FROM finance_valuation_variants WHERE organization_id=$1) variants,
           (SELECT count(*)::int FROM finance_artifact_aliases WHERE organization_id=$1 AND legacy_table='valuations') aliases,
           (SELECT count(*)::int FROM finance_valuation_registration_command_receipts WHERE organization_id=$1) receipts,
           (SELECT count(*)::int FROM artifact_lifecycle_events WHERE organization_id=$1) lifecycle_events`,
        [orgId]
      )
    ).rows[0];

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    ({ createRegisteredValuation } = await import('../valuationRegistrationService.js'));
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,$2),($3,$4)`, [
      orgId,
      'Valuation registration proof',
      foreignOrgId,
      'Foreign valuation registration proof',
    ]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role)
       VALUES($1,$2,$3,'Valuation','Proof','ADMIN')`,
      [userId, orgId, `${userId}@test.local`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,[randomUUID(),orgId,userId]
    );
    await client.query(
      `INSERT INTO budgets(id,organization_id,title,status,period_start,period_end,currency)
       VALUES($1,$2,'Foreign approved budget','APPROVED','2026-01-01','2026-12-31','PLN')`,
      [foreignBudgetId, foreignOrgId]
    );
  });

  afterAll(async () => {
    if (!client) return;
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL session_replication_role=replica`);
      await client.query(`DELETE FROM finance_valuation_registration_command_receipts WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM artifact_lifecycle_events WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM finance_valuation_variants WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM finance_valuation_cases WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM finance_artifact_aliases WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM finance_working_revisions WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM finance_business_versions WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM finance_artifacts WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM valuations WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM organization_members WHERE organization_id=$1`, [orgId]);
      await client.query(`DELETE FROM budgets WHERE id=$1`, [foreignBudgetId]);
      await client.query(`DELETE FROM users WHERE id=$1`, [userId]);
      await client.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [orgId, foreignOrgId]);
      await client.query(`SET LOCAL session_replication_role=origin`);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    expect(await counts()).toEqual({
      legacy: 0,
      artifacts: 0,
      versions: 0,
      revisions: 0,
      cases: 0,
      variants: 0,
      aliases: 0,
      receipts: 0,
      lifecycle_events: 0,
    });
    const locks = await client.query<{ count: number }>(
      `SELECT count(*)::int count FROM pg_locks WHERE locktype='advisory' AND granted`
    );
    expect(locks.rows[0].count).toBe(0);
    await client.end();
  });

  it('registers one legacy and canonical valuation with stable shared identities', async () => {
    const result = await createRegisteredValuation({
      organizationId: orgId,
      userId,
      title: 'Atomic valuation proof',
      sourceType: 'manual',
      idempotencyKey: `registration-${randomUUID()}`,
    });
    const identity = (
      await client.query(
        `SELECT v.id legacy_id,a.artifact_id,bv.business_version_id,wr.working_revision_id,
                vc.case_id,vv.id variant_id,al.legacy_id alias_legacy_id,
                al.artifact_id alias_artifact_id,al.business_version_id alias_version_id
           FROM valuations v
           JOIN finance_artifact_aliases al
             ON al.organization_id=v.organization_id AND al.legacy_table='valuations' AND al.legacy_id=v.id
           JOIN finance_artifacts a
             ON a.organization_id=al.organization_id AND a.artifact_id=al.artifact_id
           JOIN finance_business_versions bv
             ON bv.organization_id=a.organization_id AND bv.business_version_id=al.business_version_id
           JOIN finance_working_revisions wr
             ON wr.organization_id=bv.organization_id AND wr.business_version_id=bv.business_version_id AND wr.is_current=true
           JOIN finance_valuation_variants vv
             ON vv.organization_id=bv.organization_id AND vv.business_version_id=bv.business_version_id
           JOIN finance_valuation_cases vc
             ON vc.organization_id=vv.organization_id AND vc.case_id=vv.case_id
          WHERE v.organization_id=$1 AND v.id=$2`,
        [orgId, result.id]
      )
    ).rows;
    expect(identity).toHaveLength(1);
    expect(identity[0]).toMatchObject({
      legacy_id: result.id,
      artifact_id: result.artifactId,
      business_version_id: result.businessVersionId,
      working_revision_id: result.workingRevisionId,
      alias_legacy_id: result.id,
      alias_artifact_id: result.artifactId,
      alias_version_id: result.businessVersionId,
    });
  });

  it('rolls every domain back when alias registration fails', async () => {
    const before = await counts();
    const functionName = `reject_valuation_alias_${randomUUID().replaceAll('-', '')}`;
    const triggerName = `reject_valuation_alias_${randomUUID().replaceAll('-', '')}`;
    await client.query(
      `CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
       BEGIN
         IF NEW.organization_id='${orgId}' AND NEW.legacy_table='valuations' THEN
           RAISE EXCEPTION 'injected valuation alias failure';
         END IF;
         RETURN NEW;
       END $$`
    );
    await client.query(
      `CREATE TRIGGER ${triggerName} BEFORE INSERT ON finance_artifact_aliases
       FOR EACH ROW EXECUTE FUNCTION ${functionName}()`
    );
    try {
      await expect(
        createRegisteredValuation({
          organizationId: orgId,
          userId,
          title: 'Must roll back',
          sourceType: 'manual',
          idempotencyKey: `rollback-${randomUUID()}`,
        })
      ).rejects.toThrow(/injected valuation alias failure/);
      expect(await counts()).toEqual(before);
    } finally {
      await client.query(`DROP TRIGGER IF EXISTS ${triggerName} ON finance_artifact_aliases`);
      await client.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
  });

  it('rejects a foreign source without writing any registration domain', async () => {
    const before = await counts();
    await expect(
      createRegisteredValuation({
        organizationId: orgId,
        userId,
        title: 'Foreign source must fail',
        sourceType: 'budget',
        sourceId: foreignBudgetId,
        idempotencyKey: `foreign-${randomUUID()}`,
      })
    ).rejects.toThrow(/Source budget not found/);
    expect(await counts()).toEqual(before);
  });

  it('replays the same command once and rejects a changed payload for the key', async () => {
    const key = `replay-${randomUUID()}`;
    const first = await createRegisteredValuation({
      organizationId: orgId,userId,title: 'Replay-safe valuation',sourceType: 'manual',idempotencyKey:key,
    });
    const replay = await createRegisteredValuation({
      organizationId: orgId,userId,title: 'Replay-safe valuation',sourceType: 'manual',idempotencyKey:key,
    });
    expect(replay).toEqual({ ...first, replay: true });
    await expect(createRegisteredValuation({
      organizationId: orgId,userId,title: 'Changed valuation',sourceType: 'manual',idempotencyKey:key,
    })).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_COLLISION', status: 409 });
    const receipt = await client.query(
      `SELECT count(*)::int count FROM finance_valuation_registration_command_receipts
        WHERE organization_id=$1 AND idempotency_key=$2`,[orgId,key]
    );
    expect(receipt.rows[0].count).toBe(1);
  });

  it('mounts the canonical HTTP command with 201, replay 200 and collision 409', async () => {
    const router = (await import('../../../../routes/v8/finance-v2/valuation.routes.js')).default;
    const app = express();
    app.use(express.json());
    app.use((req:any,_res,next)=>{
      req.user={id:userId,organizationId:orgId,email:`${userId}@test.local`};
      req.v8Context={organizationId:orgId,userId,userRole:'ADMIN'};
      next();
    });
    app.use('/api/v8/finance-v2',router);
    app.use((error:any,_req:any,res:any,_next:any)=>res.status(500).json({error:String(error?.message||error)}));
    const key=`http-${randomUUID()}`;
    const body={title:'Mounted registration',sourceType:'manual',currency:'EUR'};
    const first=await request(app).post('/api/v8/finance-v2/valuation/registrations').set('Idempotency-Key',key).send(body);
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({replay:false});
    const replay=await request(app).post('/api/v8/finance-v2/valuation/registrations').set('Idempotency-Key',key).send(body);
    expect(replay.status).toBe(200);
    expect(replay.body.data).toMatchObject({id:first.body.data.id,replay:true});
    const collision=await request(app).post('/api/v8/finance-v2/valuation/registrations').set('Idempotency-Key',key).send({...body,title:'Changed'});
    expect(collision.status).toBe(409);
    expect(collision.body.code).toBe('IDEMPOTENCY_PAYLOAD_COLLISION');
    const malformed=await request(app).post('/api/v8/finance-v2/valuation/registrations').set('Idempotency-Key',`invalid-${randomUUID()}`).send({...body,horizonYears:21,unknown:true});
    expect(malformed.status).toBe(400);
    expect(malformed.body.code).toBe('INVALID_BODY');
    const foreign=await request(app).post('/api/v8/finance-v2/valuation/registrations').set('Idempotency-Key',`foreign-http-${randomUUID()}`).send({title:'Foreign source',sourceType:'budget',sourceId:foreignBudgetId});
    expect(foreign.status).toBe(404);
    expect(foreign.body).toMatchObject({code:'SOURCE_NOT_FOUND',error:'Valuation source not found'});
  });

  it('rechecks live Finance authority before a winning receipt replay', async () => {
    const key=`authority-${randomUUID()}`;
    const body={organizationId:orgId,userId,title:'Authority-bound registration',sourceType:'manual' as const,idempotencyKey:key};
    const first=await createRegisteredValuation(body);
    expect(first.replay).toBe(false);
    await client.query(`UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,[orgId,userId]);
    await expect(createRegisteredValuation(body)).rejects.toMatchObject({code:'ORG_MEMBERSHIP_REVOKED',status:403});
    await client.query(`UPDATE organization_members SET status='ACTIVE',role='MEMBER' WHERE organization_id=$1 AND user_id=$2`,[orgId,userId]);
    await expect(createRegisteredValuation(body)).rejects.toMatchObject({code:'FINANCE_EDIT_FORBIDDEN',status:403});
    await client.query(`UPDATE organization_members SET role='OWNER' WHERE organization_id=$1 AND user_id=$2`,[orgId,userId]);
    const replay=await createRegisteredValuation(body);
    expect(replay).toEqual({...first,replay:true});
  });

  it('converges concurrent same-key commands to one identity and an immutable receipt', async () => {
    const key=`concurrent-${randomUUID()}`;
    const before=await counts();
    const command={organizationId:orgId,userId,title:'Concurrent registration',sourceType:'manual' as const,idempotencyKey:key};
    const results=await Promise.all(Array.from({length:8},()=>createRegisteredValuation(command)));
    expect(new Set(results.map(result=>result.id))).toEqual(new Set([results[0].id]));
    expect(results.filter(result=>!result.replay)).toHaveLength(1);
    expect(results.filter(result=>result.replay)).toHaveLength(7);
    const after=await counts();
    for(const field of ['legacy','artifacts','versions','revisions','cases','variants','aliases','receipts','lifecycle_events'] as const){
      expect(Number(after[field])-Number(before[field]),field).toBe(1);
    }
    await expect(client.query(
      `UPDATE finance_valuation_registration_command_receipts SET request_hash=request_hash
        WHERE organization_id=$1 AND idempotency_key=$2`,[orgId,key]
    )).rejects.toThrow(/immutable/);
    await expect(client.query(
      `DELETE FROM finance_valuation_registration_command_receipts
        WHERE organization_id=$1 AND idempotency_key=$2`,[orgId,key]
    )).rejects.toThrow(/immutable/);
  });
});
