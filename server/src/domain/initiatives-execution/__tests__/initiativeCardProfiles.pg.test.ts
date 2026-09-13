import { DEFINITION_REQUIRED_CARD_KEYS } from '../definitionReadiness.js';
import { reviewInitiativeCard } from '../reviewInitiativeCard';
import { publishInitiativeCard } from '../publishInitiativeCard';
/** @vitest-environment node */
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureInitiativeCards as configureWithAuthority, configuredCardProfile, CARD_PROFILE_KEYS } from '../configureInitiativeCards';
import { PostgresMaterialCommandUnitOfWork } from '../postgresMaterialCommandUnitOfWork';
import { MaterialCommandRuleError, type MaterialCommandUnitOfWork } from '../materialCommand';

const url = new URL(process.env.DATABASE_URL || 'postgresql://localhost/UNASSIGNED');
if (url.hostname !== '127.0.0.1' || url.port !== '6459' || url.pathname !== '/cx8_e0') throw new Error('IE01_ASSIGNED_LOCAL_DATABASE_REQUIRED');
const pool = new Pool({ connectionString: url.toString(), max: 3 });
const uow = new PostgresMaterialCommandUnitOfWork(pool);
const org = 'f5eef749-9b5e-42a0-9be7-f93246cc9675';
const owner = '86f18e03-9180-4646-8203-5e90813cdd7a';
const ids: Array<{ initiativeId: string; templateId: string }> = [];
let initiativeId: string, templateId: string;
let keys: string[];
const readbacks: unknown[] = [];
let profile: ReturnType<typeof configuredCardProfile>;
const authority = async () => {};
// Domain fixtures isolate the transaction checks; route tests must prove real reviewer resolution.
const configureInitiativeCards = (uow: MaterialCommandUnitOfWork, envelope: any, check: any) => configureWithAuthority(uow,envelope,check,async()=>{});
const templateConfig = (profileKey: typeof CARD_PROFILE_KEYS[number]) => ({ initiativeCardProfile: {
  profileKey, version: 1, policy:{policyId:'local-test-policy',policyVersion:1}, cards: keys.map((cardKey, position) => ({ cardKey, position, included: true, requiredness: cardKey === 'summary-scope' ? 'REQUIRED' : 'OPTIONAL', requiredFields: cardKey === 'summary-scope' ? ['problem'] : [], reviewRequired: DEFINITION_REQUIRED_CARD_KEYS.includes(cardKey), reviewerIds:DEFINITION_REQUIRED_CARD_KEYS.includes(cardKey) ? ['local-profile-reviewer'] : [] }))
} });
const command = () => ({ organizationId: org, actorId: owner, aggregateType: 'initiative', aggregateId: initiativeId, expectedVersion: 1, clientRequestId: randomUUID(), correlationId: randomUUID(), policyId: 'local-test-policy', policyVersion: 1, commandType: 'initiative.cards.configure', payload: { registryVersion: 1, cards: profile.cards.map(card => ({ cardKey: card.cardKey, position: card.position, included: card.included, requiredness: card.requiredness, waiverDecisionId: null as string | null })), profile: { templateId, version: profile.version, contentHash: profile.contentHash } } });
async function unchanged() {
 expect((await pool.query('SELECT version FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type=$2 AND aggregate_id=$3', [org,'initiative',initiativeId])).rows[0].version).toBe(1);
 expect((await pool.query('SELECT * FROM ie_command_receipts WHERE organization_id=$1 AND aggregate_id=$2', [org,initiativeId])).rowCount).toBe(0);
}
beforeAll(async () => { keys=(await pool.query('SELECT card_key FROM ie_initiative_card_catalog WHERE active=TRUE ORDER BY card_key')).rows.map(r=>r.card_key); expect(keys).toHaveLength(26); });
beforeEach(async () => {
 initiativeId=`ie01-profile-${randomUUID()}`; templateId=`ie01-template-${randomUUID()}`; ids.push({initiativeId,templateId});
 await pool.query("INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES($1,'initiative',$2,1,$3)",[org,initiativeId,JSON.stringify({initiativeId,projectId:'local-profile-test-project',initiativeOwnerId:owner,lifecycleState:'REGISTERED_DRAFT'})]);
 await pool.query('INSERT INTO initiative_templates(id,name,category,organization_id,section_config,updated_at) VALUES($1,$2,$3,$4,$5,$6)',[templateId,'IE01 own profile fixture','local-review',org,JSON.stringify(templateConfig('quick-improvement')),'2026-09-12T00:00:00Z']);
 const read=await uow.transaction(tx=>tx.getInitiativeTemplateForShare!({organizationId:org,templateId})); profile=configuredCardProfile(read!);
});
afterEach(async () => {
 readbacks.push({ initiativeId, templateId,
  aggregate: (await pool.query('SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2',[org,initiativeId])).rows,
  selection: (await pool.query('SELECT card_key,included,position,requiredness,waiver_decision_id FROM ie_initiative_card_selection WHERE organization_id=$1 AND initiative_id=$2 ORDER BY card_key',[org,initiativeId])).rows,
  receipts: (await pool.query('SELECT client_request_id,aggregate_id FROM ie_command_receipts WHERE organization_id=$1 AND aggregate_id=$2',[org,initiativeId])).rows,
 });
});
afterAll(async () => {
 if(process.env.IE01_PROFILE_READBACK) writeFileSync(process.env.IE01_PROFILE_READBACK,JSON.stringify(readbacks,null,2),{flag:'wx'});
 for(const id of ids) {
  await pool.query('DELETE FROM ie_initiative_card_selection WHERE organization_id=$1 AND initiative_id=$2',[org,id.initiativeId]);
  await pool.query('DELETE FROM ie_initiative_card_versions WHERE organization_id=$1 AND initiative_id=$2',[org,id.initiativeId]);
  for(const table of ['ie_command_receipts','ie_audit_events','ie_outbox_events','ie_aggregate_state']) await pool.query(`DELETE FROM ${table} WHERE organization_id=$1 AND aggregate_id=$2`,[org,id.initiativeId]);
  await pool.query('DELETE FROM initiative_templates WHERE organization_id=$1 AND id=$2',[org,id.templateId]);
 }
 await pool.end();
});
describe('IE01 configured card profiles real PG',()=>{
 it.each(CARD_PROFILE_KEYS)('applies configured %s on the same 26-card catalog without inventing governance authority',async profileKey=>{
  await pool.query('UPDATE initiative_templates SET section_config=$2 WHERE id=$1',[templateId,JSON.stringify(templateConfig(profileKey))]);
  profile=configuredCardProfile((await uow.transaction(tx=>tx.getInitiativeTemplateForShare!({organizationId:org,templateId})))!);
  await configureInitiativeCards(uow,command(),authority);
  const state=(await pool.query('SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2',[org,initiativeId])).rows[0].payload_json;
  expect(state.cardSelection.profile.profileKey).toBe(profileKey); expect(state.cardSelection.cards).toHaveLength(26); expect(state.initiativeOwnerId).toBe(owner);
 });
 it('denies unauthorized profile apply before any receipt or selection mutation',async()=>{
  await expect(configureInitiativeCards(uow,command(),async()=>{throw new MaterialCommandRuleError('FORBIDDEN',403);})).rejects.toThrow('FORBIDDEN'); await unchanged();
 });
 it('denies stale template content hash and preserves aggregate state',async()=>{
  await pool.query("UPDATE initiative_templates SET updated_at=updated_at+interval '1 second' WHERE id=$1",[templateId]);
  await expect(configureInitiativeCards(uow,command(),authority)).rejects.toThrow('CARD_PROFILE_VERSION_CONFLICT'); await unchanged();
 });
 it('denies an arbitrary waiver Decision string without writing a profile',async()=>{
  const c=command();c.payload.cards[0].waiverDecisionId='not-an-approved-decision';
  await expect(configureInitiativeCards(uow,c,authority)).rejects.toThrow('AUTHORIZED_CARD_WAIVER_REQUIRED'); await unchanged();
 });
 it('preserves old requiredness stored only in selection, absent from aggregate payload',async()=>{
  const key=keys.find(k=>k!=='summary-scope')!;
  await pool.query("INSERT INTO ie_initiative_card_selection(organization_id,initiative_id,card_key,included,position,requiredness) VALUES($1,$2,$3,true,0,'REQUIRED')",[org,initiativeId,key]);
  await expect(configureInitiativeCards(uow,command(),authority)).rejects.toThrow('AUTHORIZED_CARD_WAIVER_REQUIRED');await unchanged();
  expect((await pool.query('SELECT requiredness FROM ie_initiative_card_selection WHERE organization_id=$1 AND initiative_id=$2 AND card_key=$3',[org,initiativeId,key])).rows[0].requiredness).toBe('REQUIRED');
 });
 it('holds the real template lock across apply, blocking a concurrent template UPDATE',async()=>{
  let reached!:()=>void,release!:()=>void;const locked=new Promise<void>(r=>{reached=r;});const resume=new Promise<void>(r=>{release=r;});
  const observed:MaterialCommandUnitOfWork={transaction:work=>uow.transaction(tx=>work(new Proxy(tx,{get(target,key){if(key==='getInitiativeTemplateForShare')return async(input:any)=>{const row=await target.getInitiativeTemplateForShare!(input);reached();await resume;return row;};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}})))};
  const applying=configureInitiativeCards(observed,command(),authority); await locked;
  const competitor=await pool.connect();try {await competitor.query("SET lock_timeout='150ms'");await expect(competitor.query('UPDATE initiative_templates SET name=$2 WHERE id=$1',[templateId,'Concurrent changed template'])).rejects.toMatchObject({code:'55P03'});}finally{await competitor.query('RESET lock_timeout');competitor.release();release();}
  await applying;
  expect((await pool.query('SELECT version FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2',[org,initiativeId])).rows[0].version).toBe(2);
 });
 it.each(['REGISTERED_DRAFT','DEFINED'])('denies profile-less selection changes on a configured %s initiative',async lifecycleState=>{
  await configureInitiativeCards(uow,command(),authority);
  await pool.query("UPDATE ie_aggregate_state SET payload_json=jsonb_set(payload_json,'{lifecycleState}',to_jsonb($3::text)) WHERE organization_id=$1 AND aggregate_id=$2",[org,initiativeId,lifecycleState]);
  const before=(await pool.query('SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2',[org,initiativeId])).rows;
  const original=command();const noProfile={...original,expectedVersion:2,payload:{registryVersion:1,cards:original.payload.cards}};
  await expect(configureInitiativeCards(uow,noProfile,authority)).rejects.toThrow(lifecycleState==='DEFINED'?'CARD_PROFILE_CHANGE_REQUIRES_GOVERNED_DECISION':'CARD_PROFILE_REFERENCE_REQUIRED');
  expect((await pool.query('SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2',[org,initiativeId])).rows).toEqual(before);
  expect((await pool.query('SELECT * FROM ie_command_receipts WHERE organization_id=$1 AND aggregate_id=$2',[org,initiativeId])).rowCount).toBe(1);
 });

 it('replays the identical profile command only while current authority and configuration remain valid',async()=>{
  const c=command();const first=await configureInitiativeCards(uow,c,authority);
  let checks=0;const replay=await configureInitiativeCards(uow,c,async()=>{checks++;});
  expect(replay.status).toBe('REPLAYED');expect(replay.response).toEqual(first.response);expect(checks).toBe(1);
  await expect(configureInitiativeCards(uow,c,async()=>{throw new MaterialCommandRuleError('REVOKED',403);})).rejects.toThrow('REVOKED');
  expect((await pool.query('SELECT count(*)::int AS n FROM ie_command_receipts WHERE organization_id=$1 AND aggregate_id=$2',[org,initiativeId])).rows[0].n).toBe(1);
 });
 it.each(['template','lifecycle'])('refuses an old profile receipt after %s advances, without another write',async change=>{
  const c=command();await configureInitiativeCards(uow,c,authority);
  if(change==='template')await pool.query("UPDATE initiative_templates SET updated_at=updated_at+interval '1 second' WHERE id=$1",[templateId]);
  else await pool.query("UPDATE ie_aggregate_state SET payload_json=jsonb_set(payload_json,'{lifecycleState}','\"DEFINED\"') WHERE organization_id=$1 AND aggregate_id=$2",[org,initiativeId]);
  const before=(await pool.query('SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2',[org,initiativeId])).rows;
  let checks=0;await expect(configureInitiativeCards(uow,c,async()=>{checks++;})).rejects.toThrow(change==='template'?'CARD_PROFILE_VERSION_CONFLICT':'CARD_PROFILE_CHANGE_REQUIRES_GOVERNED_DECISION');expect(checks).toBe(1);
  expect((await pool.query('SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2',[org,initiativeId])).rows).toEqual(before);
  expect((await pool.query('SELECT count(*)::int AS n FROM ie_command_receipts WHERE organization_id=$1 AND aggregate_id=$2',[org,initiativeId])).rows[0].n).toBe(1);
 });

 it('denies missing configuration and a nonpublic template outside the tenant before creating a receipt',async()=>{
  await pool.query("UPDATE initiative_templates SET section_config='{}' WHERE id=$1",[templateId]);
  await expect(configureInitiativeCards(uow,command(),authority)).rejects.toThrow('CARD_PROFILE_CONFIGURATION_MISSING');await unchanged();
  await pool.query("UPDATE initiative_templates SET section_config=$2,organization_id=NULL,is_public=0 WHERE id=$1",[templateId,JSON.stringify(templateConfig('quick-improvement'))]);
  try {await expect(configureInitiativeCards(uow,command(),authority)).rejects.toThrow('NOT_FOUND');await unchanged();}
  finally {await pool.query('UPDATE initiative_templates SET organization_id=$2 WHERE id=$1',[templateId,org]);}
 });

 it('rejects a configured policy version that differs from the effective command policy',async()=>{
  const c=command();c.policyVersion=2;
  await expect(configureInitiativeCards(uow,c,authority)).rejects.toThrow('CARD_PROFILE_POLICY_CONFLICT');await unchanged();
 });

 it('only lets a currently authorized named reviewer review and replay a configured card',async()=>{
  await configureInitiativeCards(uow,command(),authority);
  await publishInitiativeCard(uow,{...command(),expectedVersion:2,commandType:'initiative.card.publish',payload:{cardKey:'summary-scope',expectedCardVersion:0,applicability:'REQUIRED',completion:'COMPLETE',quality:'SUFFICIENT',freshness:'CURRENT',reviewState:'REQUESTED',content:{problem:'Measured setup losses'},evidenceRefs:['local:observed'],waiverDecisionId:null}});
  const c={...command(),actorId:'unlisted-reviewer',expectedVersion:3,commandType:'initiative.card.review',payload:{cardKey:'summary-scope',expectedCardVersion:1,outcome:'ACCEPTED' as const,rationale:'Evidence inspected',selfApprovalAllowed:false}};
  await expect(reviewInitiativeCard(uow,c,async()=>{})).rejects.toThrow('CARD_PROFILE_REVIEWER_NOT_NAMED');
  c.actorId='local-profile-reviewer';const first=await reviewInitiativeCard(uow,c,async()=>{});expect(first.status).toBe('APPLIED');
  const replay=await reviewInitiativeCard(uow,c,async()=>{});expect(replay.status).toBe('REPLAYED');
  await expect(reviewInitiativeCard(uow,c,async()=>{throw new MaterialCommandRuleError('REVOKED_REVIEWER',403);})).rejects.toThrow('REVOKED_REVIEWER');
  const card=await uow.transaction(tx=>tx.getLatestInitiativeCardForUpdate(org,initiativeId,'summary-scope'));
  expect(card?.reviewedBy).toBe('local-profile-reviewer');expect(card?.reviewState).toBe('ACCEPTED');expect(card?.cardVersion).toBe(2);
 });

});
