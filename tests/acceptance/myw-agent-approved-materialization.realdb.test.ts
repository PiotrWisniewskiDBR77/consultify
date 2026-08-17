/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = process.env.RUN_DB_TESTS === '1';

describe.skipIf(!enabled)('MYW-AGT mounted signed-JWT acceptance', () => {
  const tag=randomUUID(), org=`org-${tag}`, requester=`requester-${tag}`, approver=`approver-${tag}`, revoked=`revoked-${tag}`, foreign=`foreign-${tag}`, plan=`plan-${tag}`;
  let pool:Pool, app:any, requesterToken:string, approverToken:string, revokedToken:string, foreignToken:string;
  beforeAll(async()=>{
    pool=new Pool({connectionString:process.env.DATABASE_URL});
    for(const [id,name] of [[org,'MYW Mounted'],[foreign,'Foreign']]) await pool.query(`INSERT INTO organizations(id,name,plan,status) VALUES($1,$2,'enterprise','active')`,[id,name]);
    for(const [user,tenant,status] of [[requester,org,'ACTIVE'],[approver,org,'ACTIVE'],[revoked,org,'INACTIVE'],[foreign,foreign,'ACTIVE']]){
      await pool.query(`INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'unused','OWNER','active')`,[user,tenant,`${user}@test.local`]);
      await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER',$4)`,[randomUUID(),tenant,user,status]);
    }
    await pool.query(`INSERT INTO ai_agent_plans(id,organization_id,user_id,title,plan_json,updated_at) VALUES($1,$2,$3,'Mounted source','[]',date_trunc('milliseconds',now()))`,[plan,org,requester]);
    const secret=process.env.JWT_SECRET!;
    const sign=(id:string,organizationId:string)=>jwt.sign({id,organizationId,role:'OWNER',email:`${id}@test.local`},secret,{expiresIn:'10m'});
    requesterToken=sign(requester,org); approverToken=sign(approver,org); revokedToken=sign(revoked,org); foreignToken=sign(foreign,foreign);
    const {default:router}=await import('../../server/src/routes/my-work.routes.js');
    app=express(); app.use(express.json()); app.use('/api/my-work',router);
  });
  afterAll(async()=>{
    await pool.query(`ALTER TABLE myw_agent_materialization_receipts DISABLE TRIGGER trg_myw_agent_receipt_append_only`);
    await pool.query(`ALTER TABLE myw_agent_materialization_approvals DISABLE TRIGGER trg_myw_agent_approval_append_only`);
    await pool.query(`ALTER TABLE myw_agent_materialization_proposals DISABLE TRIGGER trg_myw_agent_proposal_guard`);
    await pool.query(`DELETE FROM myw_agent_materialization_receipts WHERE organization_id=$1`,[org]);
    await pool.query(`DELETE FROM myw_agent_materialization_approvals WHERE organization_id=$1`,[org]);
    await pool.query(`DELETE FROM myw_agent_materialization_proposals WHERE organization_id=$1`,[org]);
    await pool.query(`ALTER TABLE myw_agent_materialization_receipts ENABLE TRIGGER trg_myw_agent_receipt_append_only`);
    await pool.query(`ALTER TABLE myw_agent_materialization_approvals ENABLE TRIGGER trg_myw_agent_approval_append_only`);
    await pool.query(`ALTER TABLE myw_agent_materialization_proposals ENABLE TRIGGER trg_myw_agent_proposal_guard`);
    await pool.query(`DELETE FROM tasks WHERE organization_id=$1`,[org]);
    await pool.query(`DELETE FROM decisions WHERE organization_id=$1`,[org]);
    await pool.query(`DELETE FROM notebook_pages WHERE organization_id=$1`,[org]);
    await pool.query(`DELETE FROM ai_agent_plans WHERE id=$1`,[plan]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=ANY($1)`,[[org,foreign]]);
    await pool.query(`DELETE FROM users WHERE organization_id=ANY($1)`,[[org,foreign]]);
    await pool.query(`DELETE FROM organizations WHERE id=ANY($1)`,[[org,foreign]]);
    await pool.end();
  });
  const auth=(token:string)=>({Authorization:`Bearer ${token}`});
  it('mounts all three canonical writers and blocks spoof, foreign, revoked, self-approval, stale and collision',async()=>{
    const source=await request(app).get(`/api/my-work/agent-materialization/source/${plan}`).set(auth(requesterToken));
    expect(source.status).toBe(200);
    const proposed=await request(app).post('/api/my-work/agent-materialization/proposals').set(auth(requesterToken)).send({
      organizationId:foreign,requesterId:foreign,sourcePlanId:plan,sourceVersion:source.body.sourceVersion,sourceHash:source.body.sourceHash,
      targetKind:'task',content:{title:'Human approved mounted task'},idempotencyKey:`mounted-${tag}`,expiresAt:new Date(Date.now()+60_000).toISOString()
    });
    expect(proposed.status).toBe(400);
    for (const kind of ['task','decision','notebook'] as const) {
      const payload={sourcePlanId:plan,sourceVersion:source.body.sourceVersion,sourceHash:source.body.sourceHash,targetKind:kind,
        content:{title:`Human approved mounted ${kind}`},idempotencyKey:`mounted-${kind}-${tag}`,expiresAt:new Date(Date.now()+60_000).toISOString()};
      const clean=await request(app).post('/api/my-work/agent-materialization/proposals').set(auth(requesterToken)).send(payload);
      expect(clean.status).toBe(201);
      const collision=await request(app).post('/api/my-work/agent-materialization/proposals').set(auth(requesterToken))
        .send({...payload,content:{title:'collision'}});
      expect(collision.status).toBe(409);
      const proposalId=clean.body.proposal.proposal_id;
      expect((await request(app).post(`/api/my-work/agent-materialization/proposals/${proposalId}/decision`).set(auth(requesterToken))
        .send({decision:'APPROVE',expectedStateVersion:1,sourceHash:source.body.sourceHash})).status).toBe(409);
      expect((await request(app).post(`/api/my-work/agent-materialization/proposals/${proposalId}/decision`).set(auth(revokedToken))
        .send({decision:'APPROVE',expectedStateVersion:1,sourceHash:source.body.sourceHash})).status).toBe(403);
      expect((await request(app).post(`/api/my-work/agent-materialization/proposals/${proposalId}/decision`).set(auth(foreignToken))
        .send({decision:'APPROVE',expectedStateVersion:1,sourceHash:source.body.sourceHash})).status).toBe(404);
      const approved=await request(app).post(`/api/my-work/agent-materialization/proposals/${proposalId}/decision`)
        .set(auth(approverToken)).send({decision:'APPROVE',expectedStateVersion:1,sourceHash:source.body.sourceHash});
      expect(approved.status).toBe(200);
      expect((await request(app).post(`/api/my-work/agent-materialization/proposals/${proposalId}/decision`).set(auth(approverToken))
        .send({decision:'APPROVE',expectedStateVersion:1,sourceHash:source.body.sourceHash})).status).toBe(409);
      const materialized=await request(app).post(`/api/my-work/agent-materialization/proposals/${proposalId}/materialize`)
        .set(auth(approverToken)).send({expectedStateVersion:2});
      expect(materialized.status).toBe(200);
      const table=kind==='task'?'tasks':kind==='decision'?'decisions':'notebook_pages';
      expect((await pool.query(`SELECT title FROM ${table} WHERE id=$1`,[materialized.body.receipt.target_id])).rows[0].title)
        .toBe(`Human approved mounted ${kind}`);
      expect(materialized.body.receipt).toMatchObject({status:'SUCCEEDED',command_version:1});
      expect(materialized.body.receipt.output_digest).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
