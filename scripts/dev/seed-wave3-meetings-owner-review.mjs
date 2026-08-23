#!/usr/bin/env -S node --import=tsx
/**
 * Wave 3 / module 08 Meetings — deterministic provider-free owner fixture.
 *
 * Commands: provision | seed | readback | reset | drop. Mutations require
 * MTG_OWNER_FIXTURE_CONFIRM=YES, loopback PostgreSQL and an exact disposable
 * `consultify_w3_meetings_owner_*` database. Seed additionally requires a
 * new MTG_OWNER_FIXTURE_MANIFEST and, on first seed, a local password.
 * Manifests are exclusive wx/0600 and retained by reset/drop.
 *
 * Recording, transcription, media upload and live providers remain OFF. The
 * three manually supplied text notes go through canonical meetingBoundary
 * services: pending, rejected, and approved/materialized with one receipt.
 * Invoke directly, or with `npx tsx`, because seeding imports canonical
 * TypeScript services after the relational fixture has been written.
 */

import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const COMMAND=process.argv[2]||'readback';
const DATABASE_URL=process.env.DATABASE_URL||'';
const CONFIRM=process.env.MTG_OWNER_FIXTURE_CONFIRM;
const PASSWORD=process.env.MTG_OWNER_FIXTURE_PASSWORD;
const MANIFEST_PATH=process.env.MTG_OWNER_FIXTURE_MANIFEST||'';
const PREFIX='consultify_w3_meetings_owner_';
const FIXTURE_ID='W3-MEETINGS-OWNER-v1';
const FIXTURE_NAME='wave3-meetings-owner-review-v1';
const LOCAL_HOSTS=new Set(['127.0.0.1','localhost','::1']);
const MUTATING=new Set(['provision','seed','reset','drop']);

const IDS=Object.freeze({
  org:'w3-mtg-owner-org-v1', foreignOrg:'w3-mtg-foreign-org-v1',
  owner:'w3-mtg-owner-user-v1', admin:'w3-mtg-admin-user-v1', member:'w3-mtg-member-user-v1',
  revoked:'w3-mtg-revoked-user-v1', foreignOwner:'w3-mtg-foreign-owner-v1',
  pendingMeeting:'w3-mtg-pending-meeting-v1', rejectedMeeting:'w3-mtg-rejected-meeting-v1', approvedMeeting:'w3-mtg-approved-meeting-v1',
  pendingKey:'w3-mtg-pending-note-v1', rejectedKey:'w3-mtg-rejected-note-v1', approvedKey:'w3-mtg-approved-note-v1',
});
const TEXTS=Object.freeze({
  pending:'Manual note: the team proposes a September customer pilot; owner review is still required.',
  rejected:'Manual note: move the release forward without readiness evidence. This proposal should be rejected.',
  approved:'Manual note: run the customer pilot after readiness evidence is attached and the administrator approves the minutes.',
});

function fail(message){throw new Error(`[W3-MTG fixture] BLOCKED: ${message}`);}
function sha(value){return createHash('sha256').update(value).digest('hex');}
function qualifiedUrl(){
  if(!DATABASE_URL)fail('DATABASE_URL is required'); let url; try{url=new URL(DATABASE_URL);}catch{fail('DATABASE_URL must be valid');}
  if(!LOCAL_HOSTS.has(url.hostname))fail(`database host ${url.hostname} is not loopback`); const dbName=decodeURIComponent(url.pathname.slice(1));
  if(!dbName.startsWith(PREFIX)||!/^consultify_w3_meetings_owner_[a-z0-9_]+$/.test(dbName))fail(`database name must match ${PREFIX}[a-z0-9_]+`);
  if(!['provision','seed','readback','reset','drop'].includes(COMMAND))fail(`unknown command ${COMMAND}`);
  if(MUTATING.has(COMMAND)&&CONFIRM!=='YES')fail(`${COMMAND} requires MTG_OWNER_FIXTURE_CONFIRM=YES`);
  if(COMMAND==='seed'){if(!MANIFEST_PATH)fail('seed requires MTG_OWNER_FIXTURE_MANIFEST pointing to a new file');if(existsSync(MANIFEST_PATH))fail('MTG_OWNER_FIXTURE_MANIFEST exists; refusing overwrite');}
  return{url,dbName};
}
async function maintenance(url){const u=new URL(url);u.pathname='/postgres';const c=new pg.Client({connectionString:u.toString()});await c.connect();return c;}
async function provision(url,dbName){
  const a=await maintenance(url);try{if((await a.query('SELECT 1 FROM pg_database WHERE datname=$1',[dbName])).rowCount)fail('database already exists');await a.query(`CREATE DATABASE ${dbName}`);}finally{await a.end();}
  const r=spawnSync(process.execPath,['node_modules/.bin/tsx','server/scripts/migrate.postgres.ts'],{cwd:process.cwd(),stdio:'inherit',env:{...process.env,NODE_ENV:'test',DB_TYPE:'postgres',DATABASE_URL:url.toString(),DOTENV_IGNORE_LOCAL:'1'}});if(r.status!==0)fail('fresh migration chain failed');
  console.log(JSON.stringify({command:'provision',database:dbName,freshMigrations:true}));
}
async function reset(client){await client.query('BEGIN');try{await client.query(`CREATE TABLE IF NOT EXISTS wave3_owner_fixture_markers(fixture_id TEXT PRIMARY KEY,ownership_nonce TEXT NOT NULL,database_name TEXT NOT NULL)`);await client.query('DELETE FROM wave3_owner_fixture_markers WHERE fixture_id=$1',[FIXTURE_ID]);await client.query('DELETE FROM artifact_handoff_receipts WHERE organization_id=ANY($1)',[[IDS.org,IDS.foreignOrg]]);await client.query("DELETE FROM artifact_handoff_proposals WHERE organization_id=ANY($1) AND producer_kind='meeting'",[[IDS.org,IDS.foreignOrg]]);await client.query('DELETE FROM meeting_notes WHERE organization_id=ANY($1)',[[IDS.org,IDS.foreignOrg]]);await client.query('DELETE FROM meeting_follow_ups WHERE meeting_id=ANY($1)',[[IDS.pendingMeeting,IDS.rejectedMeeting,IDS.approvedMeeting]]);await client.query('DELETE FROM meetings WHERE organization_id=ANY($1)',[[IDS.org,IDS.foreignOrg]]);await client.query('DELETE FROM organization_members WHERE organization_id=ANY($1)',[[IDS.org,IDS.foreignOrg]]);await client.query('DELETE FROM users WHERE id=ANY($1)',[[IDS.owner,IDS.admin,IDS.member,IDS.revoked,IDS.foreignOwner]]);await client.query('DELETE FROM organizations WHERE id=ANY($1)',[[IDS.org,IDS.foreignOrg]]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}}

async function seed(client){
  const existing=await client.query('SELECT count(*)::int n FROM meeting_notes WHERE organization_id=$1 AND idempotency_key=ANY($2)',[IDS.org,[IDS.pendingKey,IDS.rejectedKey,IDS.approvedKey]]);
  if(existing.rows[0].n===3)return persist(await readback(client,false));
  if(!PASSWORD||PASSWORD.length<12)fail('first seed requires MTG_OWNER_FIXTURE_PASSWORD of at least 12 characters');
  await reset(client);const passwordHash=await bcrypt.hash(PASSWORD,10);await client.query('BEGIN');try{
    await client.query(`INSERT INTO organizations(id,name,plan,status) VALUES($1,'Wave 3 Meetings Owner Review','enterprise','active'),($2,'Wave 3 Meetings Foreign Boundary','enterprise','active')`,[IDS.org,IDS.foreignOrg]);
    for(const [id,org,email,role,status] of [[IDS.owner,IDS.org,'w3.mtg.owner@local.test','OWNER','ACTIVE'],[IDS.admin,IDS.org,'w3.mtg.admin@local.test','ADMIN','ACTIVE'],[IDS.member,IDS.org,'w3.mtg.member@local.test','USER','ACTIVE'],[IDS.revoked,IDS.org,'w3.mtg.revoked@local.test','USER','INACTIVE'],[IDS.foreignOwner,IDS.foreignOrg,'w3.mtg.foreign@local.test','OWNER','ACTIVE']]){await client.query(`INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,$4,$5,'active')`,[id,org,email,passwordHash,role]);await client.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,$4,$5)`,[`membership-${id}`,org,id,role==='USER'?'MEMBER':role,status]);}
    for(const [id,title,start] of [[IDS.pendingMeeting,'Customer pilot — pending minutes','2026-09-10T09:00:00Z'],[IDS.rejectedMeeting,'Release acceleration — rejected minutes','2026-09-11T09:00:00Z'],[IDS.approvedMeeting,'Customer pilot readiness — approved minutes','2026-09-12T09:00:00Z']])await client.query(`INSERT INTO meetings(id,organization_id,title,start_at,end_at,location,attendees_json,agenda_json,status,created_by) VALUES($1,$2,$3,$4,$5,'Local owner review',$6,$7,'completed',$8)`,[id,IDS.org,title,start,new Date(Date.parse(start)+3600000).toISOString(),JSON.stringify([IDS.owner,IDS.admin,IDS.member]),JSON.stringify(['Review manual note','Governed decision']),IDS.member]);
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}
  process.env.NODE_ENV='test';process.env.RUN_DB_TESTS='1';process.env.MOCK_DB='false';process.env.DB_TYPE='postgres';process.env.DOTENV_IGNORE_LOCAL='1';
  const {proposeMeetingNote,decideMeetingNote}=await import('../../server/src/services/meetingBoundary/meetingBoundaryService.ts');
  const make=(meetingId,text,key,summary)=>proposeMeetingNote({organizationId:IDS.org,meetingId,createdBy:IDS.member,source:'heuristic',language:'en',transcript:text,summary,keyPoints:['Manually supplied source text','Human decision required'],decisions:[{decision:summary}],actionItems:[],idempotencyKey:key});
  await make(IDS.pendingMeeting,TEXTS.pending,IDS.pendingKey,'Pilot proposal remains pending');
  const rejected=await make(IDS.rejectedMeeting,TEXTS.rejected,IDS.rejectedKey,'Unsafe acceleration proposal');
  await decideMeetingNote({organizationId:IDS.org,meetingId:IDS.rejectedMeeting,noteId:rejected.note.id,decidedBy:IDS.owner,action:'reject',reason:'Readiness evidence is absent'});
  const approved=await make(IDS.approvedMeeting,TEXTS.approved,IDS.approvedKey,'Pilot after readiness evidence');
  await decideMeetingNote({organizationId:IDS.org,meetingId:IDS.approvedMeeting,noteId:approved.note.id,decidedBy:IDS.admin,action:'approve',reason:'Manual note and readiness condition reviewed'});
  const ownershipNonce=randomBytes(32).toString('hex');await client.query(`INSERT INTO wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name) VALUES($1,$2,current_database())`,[FIXTURE_ID,ownershipNonce]);
  return persist(await readback(client,false));
}

async function readback(client,emit=true){
  const rows=await client.query(`SELECT n.meeting_id,n.source,n.transcript_hash,n.status note_status,n.idempotency_key,n.created_by,p.state proposal_state,p.source_content_hash,p.decided_by,p.decision_reason,r.receipt_id,r.target_record_id,r.output_content_hash
    FROM meeting_notes n JOIN artifact_handoff_proposals p ON p.proposal_id=n.proposal_id AND p.organization_id=n.organization_id LEFT JOIN artifact_handoff_receipts r ON r.proposal_id=p.proposal_id AND r.organization_id=p.organization_id
    WHERE n.organization_id=$1 AND n.idempotency_key=ANY($2) ORDER BY n.idempotency_key`,[IDS.org,[IDS.pendingKey,IDS.rejectedKey,IDS.approvedKey]]);
  if(rows.rowCount!==3)fail(`expected three governed notes, found ${rows.rowCount}`);const byKey=Object.fromEntries(rows.rows.map(r=>[r.idempotency_key,r]));
  const personas=await client.query(`SELECT u.id,u.organization_id,m.role,m.status FROM users u JOIN organization_members m ON m.user_id=u.id AND m.organization_id=u.organization_id WHERE u.id=ANY($1) ORDER BY u.id`,[[IDS.owner,IDS.admin,IDS.member,IDS.revoked,IDS.foreignOwner]]);
  const marker=(await client.query('SELECT fixture_id,ownership_nonce,database_name FROM wave3_owner_fixture_markers WHERE fixture_id=$1',[FIXTURE_ID])).rows[0];if(!marker)fail('durable ownership marker missing');
  const manifest={schemaVersion:'w3-meetings-owner-v1',fixtureId:FIXTURE_ID,fixture:FIXTURE_NAME,ownershipState:'FINAL',databaseName:marker.database_name,ownershipNonce:marker.ownership_nonce,marker:{table:'wave3_owner_fixture_markers',fixtureId:FIXTURE_ID,ownershipNonce:marker.ownership_nonce},deepLink:'/meeting',deepLinkVerified:false,capture:{mode:'manual_text',recording:'OFF',transcription:'OFF',media:'OFF',liveProvider:'OFF'},ids:{...IDS},expected:{pending:{meetingId:IDS.pendingMeeting,noteStatus:byKey[IDS.pendingKey]?.note_status,proposalState:byKey[IDS.pendingKey]?.proposal_state,transcriptHash:byKey[IDS.pendingKey]?.transcript_hash,receiptCount:byKey[IDS.pendingKey]?.receipt_id?1:0},rejected:{meetingId:IDS.rejectedMeeting,noteStatus:byKey[IDS.rejectedKey]?.note_status,proposalState:byKey[IDS.rejectedKey]?.proposal_state,transcriptHash:byKey[IDS.rejectedKey]?.transcript_hash,decidedBy:byKey[IDS.rejectedKey]?.decided_by,receiptCount:byKey[IDS.rejectedKey]?.receipt_id?1:0},approved:{meetingId:IDS.approvedMeeting,noteStatus:byKey[IDS.approvedKey]?.note_status,proposalState:byKey[IDS.approvedKey]?.proposal_state,transcriptHash:byKey[IDS.approvedKey]?.transcript_hash,decidedBy:byKey[IDS.approvedKey]?.decided_by,receiptCount:byKey[IDS.approvedKey]?.receipt_id?1:0,receiptTargetIsNote:Boolean(byKey[IDS.approvedKey]?.receipt_id&&byKey[IDS.approvedKey]?.target_record_id)}} ,personas:personas.rows};
  if(byKey[IDS.pendingKey].source!=='heuristic'||byKey[IDS.pendingKey].proposal_state!=='pending'||byKey[IDS.pendingKey].note_status!=='proposed'||byKey[IDS.pendingKey].receipt_id||byKey[IDS.rejectedKey].proposal_state!=='rejected'||byKey[IDS.rejectedKey].note_status!=='rejected'||byKey[IDS.rejectedKey].decided_by!==IDS.owner||byKey[IDS.rejectedKey].receipt_id||byKey[IDS.approvedKey].proposal_state!=='materialized'||byKey[IDS.approvedKey].note_status!=='approved'||byKey[IDS.approvedKey].decided_by!==IDS.admin||!byKey[IDS.approvedKey].receipt_id||!byKey[IDS.approvedKey].target_record_id||byKey[IDS.pendingKey].transcript_hash!==sha(TEXTS.pending)||byKey[IDS.rejectedKey].transcript_hash!==sha(TEXTS.rejected)||byKey[IDS.approvedKey].transcript_hash!==sha(TEXTS.approved)||personas.rowCount!==5)fail('canonical meeting state/readback contract failed');
  if(emit)console.log(JSON.stringify(manifest,null,2));return manifest;
}
function persist(manifest){const s=`${JSON.stringify(manifest,null,2)}\n`;if((DATABASE_URL&&s.includes(DATABASE_URL))||(PASSWORD&&s.includes(PASSWORD))||/postgres(?:ql)?:\/\//i.test(s))fail('manifest secret scan failed');try{writeFileSync(MANIFEST_PATH,s,{flag:'wx',mode:0o600});}catch(e){if(e?.code==='EEXIST')fail('MTG_OWNER_FIXTURE_MANIFEST exists; refusing overwrite');throw e;}const mode=statSync(MANIFEST_PATH).mode&0o777;if(mode!==0o600)fail(`manifest mode must be 0600, got 0${mode.toString(8)}`);console.log(JSON.stringify(manifest,null,2));return manifest;}
async function drop(url,dbName){const a=await maintenance(url);try{await a.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[dbName]);await a.query(`DROP DATABASE IF EXISTS ${dbName}`);const r=await a.query('SELECT count(*)::int n FROM pg_database WHERE datname=$1',[dbName]);if(r.rows[0].n!==0)fail('catalog absence failed');console.log(JSON.stringify({command:'drop',database:dbName,catalogMatches:0}));}finally{await a.end();}}
async function main(){const{url,dbName}=qualifiedUrl();if(COMMAND==='provision')return provision(url,dbName);if(COMMAND==='drop')return drop(url,dbName);const c=new pg.Client({connectionString:url.toString()});await c.connect();try{if(COMMAND==='seed')await seed(c);else if(COMMAND==='reset'){await reset(c);console.log(JSON.stringify({command:'reset',fixtureRows:0}));}else await readback(c);}finally{await c.end();}}
main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exit(1);});
