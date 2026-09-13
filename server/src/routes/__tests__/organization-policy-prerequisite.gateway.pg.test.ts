import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
const pool = new Pool({connectionString:process.env.DATABASE_URL,max:2});
const org=randomUUID(); let server:Server; let adminToken:string; let superToken:string; let staleToken:string;
const proof:unknown[]=[]; const url=`/api/superadmin/org-policies/${org}`;
const checks=async()=> (await pool.query("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.organization_members'::regclass AND contype='c' ORDER BY conname")).rows;
let beforeChecks:unknown;
const row=async()=> (await pool.query('SELECT * FROM org_policies WHERE organization_id=$1',[org])).rows[0];
beforeAll(async()=>{
 const expectedDatabase = process.env.C6_EXPORT_TEST_DATABASE || '';
  expect(expectedDatabase.startsWith('cx6_')).toBe(true);
 const identity=await assertRealPostgresTestEnvironment({expectedDatabase});
 expect(identity.host).toBe('127.0.0.1');expect(identity.port).toBe('6457');beforeChecks=await checks();
 await pool.query('INSERT INTO organizations(id,name) VALUES($1,$2)',[org,'Independent HTTP policy prerequisite']);
 const config=(await import('../../config/Config.js')).default;
 for(const role of ['ADMIN','SUPERADMIN']){
 const id=randomUUID();const email=`${id}@test.invalid`;
 await pool.query("INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'local-fixture-not-login',$4,'active')",[id,org,email,role]);
 await pool.query("INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'ADMIN','ACTIVE')",[randomUUID(),org,id]);
 const payload={id,organizationId:org,role,email};
 const token=jwt.sign(payload,config.JWT_SECRET,{expiresIn:'15m'});
 if(role==='SUPERADMIN')superToken=token;else{adminToken=token;staleToken=jwt.sign({...payload,role:'SUPERADMIN'},config.JWT_SECRET,{expiresIn:'15m'});}
 }
 const {ApiGateway}=await import('../../Gateway.js');const app=express();app.use(express.json());ApiGateway.getInstance().initializeRoutes(app);
 server=await new Promise<Server>((resolve,reject)=>{const s=app.listen(4216,'127.0.0.1',()=>resolve(s));s.once('error',reject);});
},60000);
afterAll(async()=>{
 const after=await checks();proof.push({organization:org,roleChecksBefore:beforeChecks,roleChecksAfter:after,checksUnchanged:JSON.stringify(beforeChecks)===JSON.stringify(after)});
 if(server)await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 await pool.end();await (await import('../../database/PostgresDatabase.js')).default.close();
 if(process.env.C6_POLICY_HTTP_PROOF_OUT)(await import('node:fs')).writeFileSync(process.env.C6_POLICY_HTTP_PROOF_OUT,JSON.stringify(proof,null,2));
 expect(after).toEqual(beforeChecks);
});
describe('Independent combined Gateway policy writer prerequisite',()=>{
 it('SUPERADMIN inserts and partial updates preserve omissions while explicit residency null and hold false persist',async()=>{
 const send=(body:unknown)=>request(server).put(url).set('Authorization',`Bearer ${superToken}`).send(body);
 const created=await send({retentionDays:30,residencyRegion:'EU',legalHoldEnabled:true});expect(created.status,created.text).toBe(200);
 const partial=await send({legalHoldEnabled:false});expect(partial.status,partial.text).toBe(200);expect(partial.body).toMatchObject({retention_days:30,residency_region:'EU',legal_hold_enabled:0});
 const cleared=await send({residencyRegion:null});expect(cleared.status,cleared.text).toBe(200);expect(cleared.body).toMatchObject({retention_days:30,residency_region:null,legal_hold_enabled:0});
 const read=await request(server).get(url).set('Authorization',`Bearer ${superToken}`);expect(read.status).toBe(200);const sqlReadback=await row();proof.push({case:'raw SQL HTTP readback',sql:sqlReadback,http:read.body});for(const key of Object.keys(sqlReadback)){if(['created_at','updated_at'].includes(key))expect(new Date(sqlReadback[key]).getTime()).toBe(new Date(read.body[key]).getTime());else expect(sqlReadback[key]).toEqual(read.body[key]);}
 proof.push({case:'HTTP partial patches',statuses:[created.status,partial.status,cleared.status,read.status],readback:read.body});
 });
 it('retention null retains existing value under inherited HTTP mapping instead of claiming clear',async()=>{
 const response=await request(server).put(url).set('Authorization',`Bearer ${superToken}`).send({retentionDays:null});
 expect(response.status,response.text).toBe(200);expect(response.body.retention_days).toBe(30);expect((await row()).retention_days).toBe(30);
 proof.push({case:'inherited retention null mapping',status:response.status,retention_days:response.body.retention_days});
 });
 it('ADMIN, stale SUPERADMIN claim and unauthenticated actors cannot read or alter policy',async()=>{
 const before=await row();const denials=[];
 for(const [name,token] of [['ADMIN',adminToken],['stale SUPERADMIN',staleToken],['anonymous','']]){
 for(const method of ['get','put'] as const){let req=request(server)[method](url);if(token)req=req.set('Authorization',`Bearer ${token}`);if(method==='put')req=req.send({retentionDays:99,legalHoldEnabled:true});const response=await req;
 expect([401,403]).toContain(response.status);expect(await row()).toEqual(before);denials.push({name,method,status:response.status});}
 }
 proof.push({case:'authority',denials,rowUnchanged:true});
 });
});
