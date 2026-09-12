/** @vitest-environment node */
// Populated read-path proof only. Direct SQL fixtures do not prove creation/handoff.
import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

describe('integrated execution bulk populated readback', { retry: 0, sequential: true }, () => {
 const run=randomUUID(), org=`cx-root-bulk-${run}`, other=`cx-root-other-${run}`;
 const user=`user-${run}`, otherUser=`other-${run}`, project=`project-${run}`;
 const initiative=`initiative-${run}`, execution=`execution-${run}`, orphan=`orphan-${run}`;
 const task=`task-${run}`, decision=`decision-${run}`, allocation=`allocation-${run}`;
 let pool:Pool, app:Express, token:string, foreign:string;
 const endpoint='/api/initiatives/runtime-v1/execution-cases/bulk';
 const aggregate=async(type:string,id:string,payload:unknown)=>pool.query(
  'INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES($1,$2,$3,1,$4::jsonb)',
  [org,type,id,JSON.stringify(payload)]);
 beforeAll(async()=>{
  await assertRealPostgresTestEnvironment();
  expect(process.env.MOCK_DB).toBe('false');
  expect(process.env.ENABLE_TEST_AUTH_BYPASS).not.toBe('true');
  pool=new Pool({connectionString:process.env.DATABASE_URL});
  expect((await pool.query('select current_database() as db')).rows[0].db).toBe('codex2b_kopia_1009');
  for(const [o,u] of [[org,user],[other,otherUser]]) {
   await pool.query("INSERT INTO organizations(id,name) VALUES($1,'Integrator read fixture')",[o]);
   await pool.query("INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'unused','ADMIN','active')",[u,o,`${u}@example.test`]);
   await pool.query("INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')",[randomUUID(),o,u]);
  }
  await pool.query("INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,'Integrator read project',$3)",[project,org,user]);
  await aggregate('initiative',initiative,{initiativeId:initiative,projectId:project,initiativeOwnerId:user});
  await aggregate('execution_case',execution,{executionCaseId:execution,initiativeId:initiative});
  await aggregate('execution_case',orphan,{executionCaseId:orphan});
  await aggregate('execution_task',task,{executionCaseId:execution,title:'Readback task',status:'OPEN',dueAt:'2026-09-15T12:00:00Z'});
  await aggregate('execution_decision',decision,{executionCaseId:execution,title:'Readback decision',status:'PENDING',dueAt:'2026-09-16T12:00:00Z'});
  await aggregate('operational_allocation',allocation,{executionCaseId:execution,assigneeId:user,hours:7,status:'ASSIGNEE_ACCEPTED'});
  const {default:config}=await import('../../../config/Config.js');
  const sign=(id:string,organizationId:string)=>jwt.sign({id,organizationId,role:'ADMIN'},config.JWT_SECRET,{expiresIn:'10m'});
  token=sign(user,org);foreign=sign(otherUser,other);
  const {ApiGateway}=await import('../../../Gateway.js');
  app=express();app.use(express.json());ApiGateway.getInstance().initializeRoutes(app);
 },180000);
 afterAll(async()=>{
  if(!pool)return;
  await pool.query('DELETE FROM ie_aggregate_state WHERE organization_id=$1',[org]);
  await pool.query('DELETE FROM project_members WHERE project_id=$1',[project]);
  for(const table of ['organization_members','projects','users'])
   await pool.query(`DELETE FROM ${table} WHERE organization_id=ANY($1::text[])`,[[org,other]]);
  await pool.query('DELETE FROM organizations WHERE id=ANY($1::text[])',[[org,other]]);
  await pool.end();
 });
 it('returns populated task decision and allocation through real lineage and Gateway',async()=>{
  const r=await request(app).get(endpoint).query({ids:`${execution},${orphan}`}).set('Authorization',`Bearer ${token}`);
  expect(r.status,JSON.stringify(r.body)).toBe(200);
  expect(r.body.missingIds).toEqual([orphan]);expect(r.body.cases).toHaveLength(1);
  const c=r.body.cases[0];expect(c.executionCaseId).toBe(execution);
  expect(c.work.tasks).toEqual([expect.objectContaining({taskId:task,title:'Readback task',version:1})]);
  expect(c.work.decisions).toEqual([expect.objectContaining({decisionId:decision,title:'Readback decision',version:1})]);
  expect(c.allocations.items).toEqual([expect.objectContaining({allocationId:allocation,hours:7,version:1})]);
 });
 it('denies the same populated case to a foreign tenant without leaking children',async()=>{
  const r=await request(app).get(endpoint).query({ids:execution}).set('Authorization',`Bearer ${foreign}`);
  expect(r.status).toBe(200);expect(r.body.cases).toEqual([]);expect(r.body.missingIds).toEqual([execution]);
  for(const id of [task,decision,allocation])expect(JSON.stringify(r.body)).not.toContain(id);
 });
 it('fails closed when the real initiative lineage is removed',async()=>{
  await pool.query("DELETE FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2",[org,initiative]);
  const r=await request(app).get(endpoint).query({ids:execution}).set('Authorization',`Bearer ${token}`);
  expect(r.status).toBe(200);expect(r.body.cases).toEqual([]);expect(r.body.missingIds).toEqual([execution]);
 });
});
