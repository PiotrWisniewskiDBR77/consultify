import { DEFINITION_REQUIRED_CARD_KEYS } from '../../../domain/initiatives-execution/definitionReadiness.js';
/** @vitest-environment node */
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import {Pool} from 'pg';
import {beforeAll,beforeEach,afterEach,afterAll,describe,it,expect} from 'vitest';
const url=new URL(process.env.DATABASE_URL||'postgresql://localhost/UNASSIGNED');
if(url.hostname!=='127.0.0.1'||url.port!=='6459'||url.pathname!=='/cx8_e0')throw Error('IE01_ASSIGNED_LOCAL_DATABASE_REQUIRED');
const pool=new Pool({connectionString:url.toString(),max:4});
const org=randomUUID(),foreignOrg=randomUUID(),owner=randomUUID(),reviewer=randomUUID(),foreign=randomUUID(),project=randomUUID(),policy=randomUUID();
let app: ReturnType<typeof express>;let keys:string[];let initiativeId:string,templateId:string;const tokens:Record<string,string>={};const ids:Array<{initiativeId:string,templateId:string}>=[];const evidence:unknown[]=[];
const base='/api/initiatives/runtime-v1';
const auth=(actor=owner)=>({Authorization:`Bearer ${tokens[actor]}`});
const profileConfig=()=>({initiativeCardProfile:{profileKey:'technology',version:1,policy:{policyId:policy,policyVersion:1},cards:keys.map((cardKey,position)=>({cardKey,position,included:true,requiredness:cardKey==='summary-scope'?'REQUIRED':'OPTIONAL',requiredFields:cardKey==='summary-scope'?['problem']:[],reviewRequired:DEFINITION_REQUIRED_CARD_KEYS.includes(cardKey),reviewerIds:DEFINITION_REQUIRED_CARD_KEYS.includes(cardKey)?[reviewer]:[]}))}});
async function preview(actor=owner){return request(app).get(`${base}/initiatives/${initiativeId}/card-profile-preview`).query({templateId}).set(auth(actor));}
const body=(p:any)=>({expectedVersion:1,clientRequestId:randomUUID(),registryVersion:1,profile:{templateId,version:p.profile.version,contentHash:p.profile.contentHash},cards:p.profile.cards.map((c:any)=>({cardKey:c.cardKey,included:c.included,position:c.position,requiredness:c.requiredness,waiverDecisionId:null}))});
const apply=(payload:any,actor=owner)=>request(app).post(`${base}/initiatives/${initiativeId}/card-selection`).set(auth(actor)).send(payload);
async function state(){return (await pool.query('SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2',[org,initiativeId])).rows;}
beforeAll(async()=>{
 process.env.ENABLE_INITIATIVE_APPROVAL_V2='true';process.env.ENABLE_V8_GLOBAL='true';
 keys=(await pool.query('SELECT card_key FROM ie_initiative_card_catalog WHERE active=true ORDER BY card_key')).rows.map(r=>r.card_key);expect(keys).toHaveLength(26);
 for(const o of [org,foreignOrg])await pool.query('INSERT INTO organizations(id,name) VALUES($1,$2)',[o,'IE01 isolated Gateway proof']);
 for(const [id,o,role] of [[owner,org,'OWNER'],[reviewer,org,'MEMBER'],[foreign,foreignOrg,'OWNER']]){
  await pool.query("INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'unused',$4,'active')",[id,o,id+'@example.test',role]);
  await pool.query("INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,$4,'ACTIVE')",[randomUUID(),o,id,role]);
 }
 await pool.query('INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$3)',[project,org,'IE01 own Gateway project']);
 for(const id of [owner,reviewer])await pool.query("INSERT INTO project_members(id,project_id,user_id,project_role,permissions) VALUES($1,$2,$3,'PROJECT_LEADER',$4)",[randomUUID(),project,id,JSON.stringify(['initiative.view'])]);
 await pool.query("INSERT INTO ie_governance_policies(organization_id,scope_type,scope_id,policy_id,version,baseline,strictness,config_json) VALUES($1,'PROJECT',$2,$3,1,'STANDARD',2,'{}')",[org,project,policy]);
 const {default:config}=await import('../../../config/Config.js');
 for(const [id,o,role] of [[owner,org,'OWNER'],[reviewer,org,'MEMBER'],[foreign,foreignOrg,'OWNER']])tokens[id]=jwt.sign({id,organizationId:o,role},config.JWT_SECRET,{expiresIn:'30m'});
 const {ApiGateway}=await import('../../../Gateway.js');app=express();app.use(express.json());ApiGateway.getInstance().initializeRoutes(app);
},180000);
beforeEach(async()=>{
 initiativeId='ie01-gateway-'+randomUUID();templateId=randomUUID();ids.push({initiativeId,templateId});
 await pool.query("INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES($1,'initiative',$2,1,$3)",[org,initiativeId,JSON.stringify({initiativeId,title:'Gateway own fixture',projectId:project,initiativeOwnerId:owner,lifecycleState:'REGISTERED_DRAFT',visibility:'PROJECT'})]);
 await pool.query('INSERT INTO initiative_templates(id,name,category,organization_id,section_config,updated_at) VALUES($1,$2,$3,$4,$5,$6)',[templateId,'Configured local technology','local-review',org,JSON.stringify(profileConfig()),'2026-09-12T00:00:00Z']);
});
afterEach(async()=>{evidence.push({initiativeId,templateId,state:await state(),selection:(await pool.query('SELECT card_key,requiredness,included FROM ie_initiative_card_selection WHERE organization_id=$1 AND initiative_id=$2',[org,initiativeId])).rows,receipts:(await pool.query('SELECT client_request_id,command_type,aggregate_version FROM ie_command_receipts WHERE organization_id=$1 AND aggregate_id=$2',[org,initiativeId])).rows});});
afterAll(async()=>{
 if(process.env.IE01_GATEWAY_READBACK)writeFileSync(process.env.IE01_GATEWAY_READBACK,JSON.stringify(evidence,null,2),{flag:'wx'});
 for(const {initiativeId,templateId} of ids){
  for(const table of ['ie_initiative_card_selection','ie_initiative_card_versions'])await pool.query(`DELETE FROM ${table} WHERE organization_id=$1 AND initiative_id=$2`,[org,initiativeId]);
  for(const table of ['ie_command_receipts','ie_audit_events','ie_outbox_events','ie_aggregate_state'])await pool.query(`DELETE FROM ${table} WHERE organization_id=$1 AND aggregate_id=$2`,[org,initiativeId]);
  await pool.query('DELETE FROM initiative_templates WHERE id=$1 AND organization_id=$2',[templateId,org]);
 }
 await pool.query('DELETE FROM ie_governance_policies WHERE organization_id=$1 AND scope_id=$2',[org,project]);
 await pool.query('DELETE FROM project_members WHERE project_id=$1',[project]);await pool.query('DELETE FROM projects WHERE id=$1 AND organization_id=$2',[project,org]);
 for(const o of [org,foreignOrg]){await pool.query('DELETE FROM organization_members WHERE organization_id=$1',[o]);await pool.query('DELETE FROM users WHERE organization_id=$1',[o]);await pool.query('DELETE FROM project_role_templates WHERE organization_id=$1',[o]);await pool.query('DELETE FROM organizations WHERE id=$1',[o]);}
 await pool.end();
});
describe('IE01 real Gateway JWT profile boundaries',()=>{
 it('previews and applies a configured profile with actual policy/member resolution, then replays exactly once',async()=>{const p=await preview();expect(p.status).toBe(200);const c=body(p.body);expect((await apply(c)).status).toBe(201);expect((await apply(c)).body.status).toBe('REPLAYED');expect((await state())[0].version).toBe(2);});
 it('denies foreign preview and apply with no mutation',async()=>{const p=await preview();const before=await state();expect((await preview(foreign)).status).toBe(404);expect((await apply(body(p.body),foreign)).status).toBe(404);expect(await state()).toEqual(before);});
 it('does not let a reviewer without initiative.update configure cards',async()=>{const p=await preview();const before=await state();expect((await apply(body(p.body),reviewer)).status).toBe(404);expect(await state()).toEqual(before);});
 it('refuses stale template hash after preview',async()=>{const p=await preview();const before=await state();await pool.query("UPDATE initiative_templates SET updated_at=updated_at+interval '1 second' WHERE id=$1",[templateId]);expect((await apply(body(p.body))).status).toBe(409);expect(await state()).toEqual(before);});
 it('refuses named reviewer membership revoked between preview and apply',async()=>{const p=await preview();const before=await state();await pool.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2',[project,reviewer]);try{expect((await apply(body(p.body))).status).toBe(403);expect(await state()).toEqual(before);}finally{await pool.query("INSERT INTO project_members(id,project_id,user_id,project_role,permissions) VALUES($1,$2,$3,'PROJECT_LEADER',$4)",[randomUUID(),project,reviewer,JSON.stringify(['initiative.view'])]);}});
 it('refuses stale effective policy after preview',async()=>{const p=await preview();const before=await state();await pool.query('UPDATE ie_governance_policies SET version=2 WHERE organization_id=$1 AND scope_id=$2',[org,project]);try{expect((await apply(body(p.body))).status).toBe(409);expect(await state()).toEqual(before);}finally{await pool.query('UPDATE ie_governance_policies SET version=1 WHERE organization_id=$1 AND scope_id=$2',[org,project]);}});
 it('reviews a configured published card only as its named active reviewer and rechecks membership before replay',async()=>{
  const p=await preview();expect((await apply(body(p.body))).status).toBe(201);
  const publish=await request(app).post(`${base}/initiatives/${initiativeId}/cards/summary-scope/publications`).set(auth()).send({expectedVersion:2,expectedCardVersion:0,clientRequestId:randomUUID(),applicability:'REQUIRED',completion:'COMPLETE',quality:'SUFFICIENT',freshness:'CURRENT',reviewState:'REQUESTED',content:{problem:'Observed setup loss'},evidenceRefs:['local:observation'],waiverDecisionId:null});expect(publish.status).toBe(201);
  const c={expectedVersion:3,expectedCardVersion:1,clientRequestId:randomUUID(),outcome:'ACCEPTED',rationale:'Reviewed actual published evidence'};
  const before=await state();const deny=await request(app).post(`${base}/initiatives/${initiativeId}/cards/summary-scope/reviews`).set(auth()).send(c);expect(deny.status).toBe(403);expect(deny.body.code).toBe('CARD_PROFILE_REVIEWER_NOT_NAMED');expect(await state()).toEqual(before);
  const path=`${base}/initiatives/${initiativeId}/cards/summary-scope/reviews`;expect((await request(app).post(path).set(auth(reviewer)).send(c)).status).toBe(201);
  const accepted=await state();await pool.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2',[project,reviewer]);
  try {
    expect((await request(app).post(path).set(auth(reviewer)).send(c)).status).toBe(404);
    const readiness=await request(app).get(`${base}/initiatives/${initiativeId}/gates/definition/readiness`).set(auth());expect(readiness.status).toBe(200);expect(readiness.body.findings).toEqual(expect.arrayContaining([expect.objectContaining({rule:'PROFILE_AUTHORITY_STALE'})]));expect(await state()).toEqual(accepted);
  } finally {await pool.query("INSERT INTO project_members(id,project_id,user_id,project_role,permissions) VALUES($1,$2,$3,'PROJECT_LEADER',$4)",[randomUUID(),project,reviewer,JSON.stringify(['initiative.view'])]);}
 });
 it('keeps validation400 and stale409 distinct from actual authority403',async()=>{const p=await preview();const invalid={...body(p.body),registryVersion:9};expect((await apply(invalid)).status).toBe(400);const stale={...body(p.body),expectedVersion:999};expect((await apply(stale)).status).toBe(409);expect((await state())[0].version).toBe(1);});

 it.each(DEFINITION_REQUIRED_CARD_KEYS)('rejects disabled mandatory review for %s before selection or receipt mutation', async cardKey => {
  const valid = await preview(); expect(valid.status).toBe(200);
  const command = body(valid.body); const before = await state();
  const invalid = profileConfig(); const card = invalid.initiativeCardProfile.cards.find(card => card.cardKey === cardKey)!;
  card.reviewRequired = false; card.reviewerIds = [];
  await pool.query('UPDATE initiative_templates SET section_config=$1 WHERE id=$2 AND organization_id=$3',[JSON.stringify(invalid),templateId,org]);
  const rejectedPreview = await preview(); expect(rejectedPreview.status).toBe(409);
  expect(rejectedPreview.body.code).toBe('CARD_PROFILE_BASELINE_REVIEW_REQUIRED');
  const rejectedApply = await apply(command); expect(rejectedApply.status).toBe(409);
  expect(rejectedApply.body.code).toBe('CARD_PROFILE_BASELINE_REVIEW_REQUIRED');
  expect(await state()).toEqual(before);
  expect((await pool.query('SELECT * FROM ie_initiative_card_selection WHERE organization_id=$1 AND initiative_id=$2',[org,initiativeId])).rows).toEqual([]);
  expect((await pool.query('SELECT * FROM ie_command_receipts WHERE organization_id=$1 AND aggregate_id=$2',[org,initiativeId])).rows).toEqual([]);
 });
});
