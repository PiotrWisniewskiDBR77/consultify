#!/usr/bin/env node
/** Local, destructive acceptance ONLY on the explicitly owned review fixture database.
 * --out=/absolute/new/private/dir --source=/absolute/review-cleanup-race/before.dump
 * Restores that full synthetic dump before every case. Never touches pilot/cleanup/live.
 * No API/auth fixtures. Two real PostgreSQL connections; actual runCleanup + canonical delete.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Client, Pool } from 'pg';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');if(!a.startsWith('--')||i<3)throw Error('ARGS_REQUIRED');return[a.slice(2,i),a.slice(i+1)];}));
if(!args.out||!args.source||!path.isAbsolute(args.out)||!path.isAbsolute(args.source))throw Error('ABSOLUTE_PATHS_REQUIRED');
const OUT=path.resolve(args.out);
if(OUT===ROOT||OUT.startsWith(ROOT+path.sep))throw Error('PRIVATE_OUTPUT_REQUIRED');
const DB='cx4_review_cleanup_race', ID='review-demo-session-race';
const URL=`postgresql://postgres:postgres@127.0.0.1:6455/${DB}`;
const dockerEnv={PATH:process.env.PATH,DOCKER_HOST:'unix:///Users/piotrwisniewski/.colima/default/docker.sock'};
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const dump=fs.readFileSync(args.source);if(dump.subarray(0,5).toString()!=='PGDMP')throw Error('FULL_DUMP_REQUIRED');
fs.mkdirSync(OUT,{mode:0o700});
fs.writeFileSync(path.join(OUT,'before.dump'),dump,{flag:'wx',mode:0o600});
const pool=new Pool({connectionString:URL,max:2});
const identity=await pool.query('SELECT current_database() AS database,inet_server_addr()::text AS server_address,inet_server_port() AS server_port');
if(identity.rows[0].database!==DB)throw Error('LOCAL_DATABASE_MISMATCH');
// Do not inherit remote database configuration or secret file loading.
process.env.DATABASE_URL=URL;process.env.DB_TYPE='postgres';process.env.MOCK_DB='false';process.env.NODE_ENV='test';process.env.LOG_LEVEL='error';process.env.LOG_TO_FILE='false';
const {runCleanup}=await import('../dane/sprzatanie-klonow-demo-session-20260912.mjs');
const queries={
 hold:["INSERT INTO org_policies VALUES ('hold-1',$1,1)",[ID]],
 human_primary:["INSERT INTO users VALUES ('human',$1,'human@example.test',NULL,NULL)",[ID]],
 human_membership:["INSERT INTO users VALUES ('human','other','human@example.test',NULL,NULL); INSERT INTO organization_members VALUES ('member','human','review-demo-session-race')",[]],
 last_login:["INSERT INTO users VALUES ('seed',$1,'seed@consultify.local',NOW(),NULL)",[ID]],
 last_login_at:["INSERT INTO users VALUES ('seed',$1,'seed@consultify.local',NULL,NOW())",[ID]],
 orphan_member:["INSERT INTO organization_members VALUES ('orphan','absent',$1)",[ID]],
 external_member:["INSERT INTO users VALUES ('seed','review-demo-session-race','seed@consultify.local',NULL,NULL); INSERT INTO organization_members VALUES ('external','seed','other')",[]],
 active_session:["INSERT INTO demo_sessions VALUES ('active',$1,NOW()+INTERVAL '1 day','active')",[ID]],
 active_tenant:["INSERT INTO demo_session_tenants VALUES ($1,NOW()+INTERVAL '1 day')",[ID]],
 template:["UPDATE organizations SET is_template=true WHERE id=$1",[ID]],
 paid:["UPDATE organizations SET billing_status='paid' WHERE id=$1",[ID]],
};
const expected={hold:'LEGAL_HOLD',human_primary:'HUMAN_MEMBER_PRESENT',human_membership:'HUMAN_MEMBER_PRESENT',last_login:'HUMAN_MEMBER_PRESENT',last_login_at:'HUMAN_MEMBER_PRESENT',orphan_member:'UNRESOLVED_MEMBER',external_member:'SEED_HAS_EXTERNAL_MEMBERSHIP',active_session:'ACTIVE_DEMO_SESSION',active_tenant:'ACTIVE_DEMO_SESSION',template:'TEMPLATE_PROTECTED',paid:'NOT_NONPAYING_DEMO'};
const results=[];
async function fingerprint(){
 const values={};
 for(const table of ['organizations','users','organization_members','org_policies','demo_sessions','demo_session_tenants']){
  const r=await pool.query(`SELECT md5(COALESCE(string_agg(value,'' ORDER BY value),'')) AS hash FROM (SELECT row_to_json(t)::text AS value FROM ${table} t) rows`);
  values[table]=r.rows[0].hash;
 }
 return values;
}
async function restore(label){
 const r=spawnSync('docker',['exec','-i','cx-codex4-pg','pg_restore','-U','postgres','--clean','--if-exists','--no-owner','--exit-on-error','-d',DB],{env:dockerEnv,input:dump});
 fs.writeFileSync(path.join(OUT,`${label}-restore.log`),Buffer.concat([r.stdout||Buffer.alloc(0),r.stderr||Buffer.alloc(0)]),{flag:'wx',mode:0o600});
 if(r.status!==0)throw Error('RESTORE_FAILED');
 const before=await pool.query('SELECT id FROM organizations ORDER BY id');
 if(before.rowCount!==1||before.rows[0].id!==ID)throw Error('RESTORE_READBACK_FAILED');
 save(path.join(OUT,`${label}-restore.json`),{exitCode:r.status,log:path.join(OUT,`${label}-restore.log`),database:DB,organizationRows:before.rows,scope:'Real restore of full synthetic fixture. Not full staging schema.'});
}
const original=Client.prototype.query;
try{
 for(const label of [...Object.keys(queries),'post_lock_writers','valid_delete']){
  await restore(label);
  const target={version:1,operation:'cleanup-demo-clones',intendedEnvironment:'staging',executionEnvironment:'local-copy',host:'127.0.0.1',port:6455,database:DB,organizationIds:[ID],baseDemoOrganizationIds:['review-demo'],protectedOrganizationIds:[],seedEmails:['seed@consultify.local'],expiryCutoff:'2022-01-01T00:00:00Z',backup:{kind:'pg_dump-custom-full',path:path.join(OUT,'before.dump'),sha256:hash(path.join(OUT,'before.dump')),host:'127.0.0.1',port:6455,database:DB,createdAt:new Date().toISOString(),restoreEvidence:{path:path.join(OUT,`${label}-restore.json`),sha256:hash(path.join(OUT,`${label}-restore.json`))}}};
  const tf=path.join(OUT,`${label}-target.json`);save(tf,target);
  const events=[];let injected=false;let lockProbed=false;let guardedState;
  Client.prototype.query=async function(...queryArgs){
   const sql=typeof queryArgs[0]==='string'?queryArgs[0]:queryArgs[0]?.text;
   const result=await original.apply(this,queryArgs);
   if(sql?.includes('WITH z_fk AS')&&!injected){
    injected=true;events.push('catalog_read_completed');
    if(queries[label]){
     const other=await pool.connect();try{await original.call(other,'BEGIN');await original.call(other,...queries[label]);await original.call(other,'COMMIT');events.push('second_connection_guard_change_committed_before_lock');}finally{other.release();}
     guardedState=await fingerprint();
    }
   }
   if(sql?.startsWith('LOCK TABLE')){
    events.push('cleanup_table_lock_acquired');
    if(label==='post_lock_writers'&&!lockProbed){
     lockProbed=true;
     for(const guard of ['hold','human_primary','orphan_member','active_session','active_tenant','template']){
      const other=await pool.connect();let code;try{await original.call(other,'BEGIN');await original.call(other,"SET LOCAL lock_timeout='150ms'");await original.call(other,...queries[guard]);}catch(e){code=e.code;}finally{await original.call(other,'ROLLBACK');other.release();}
      events.push({guard,blocked:code==='55P03'});
     }
    }
   }
   if(sql?.startsWith('SELECT legal_hold_enabled'))events.push({holdRowsSeen:result.rowCount});
   return result;
  };
  let outcome,error;
  try{outcome=await runCleanup({apply:true,target:'local','target-manifest':tf,manifest:path.join(OUT,`${label}-manifest.json`),backup:target.backup.path});}
  catch(e){error={name:e.name,code:e.code||null};}
  finally{Client.prototype.query=original;}
  const after=await pool.query('SELECT id FROM organizations WHERE id=$1',[ID]);
  const guardCase=Boolean(queries[label]);
  const allGuardRowsUnchanged=guardCase?JSON.stringify(guardedState)===JSON.stringify(await fingerprint()):null;
  const noCommitReceipt=!fs.existsSync(path.join(OUT,`${label}-manifest.json.commit.json`));
  const passed=guardCase?after.rowCount===1&&error?.code===expected[label]&&allGuardRowsUnchanged&&noCommitReceipt:after.rowCount===0&&outcome?.deleted===1&&(label!=='post_lock_writers'||events.filter(e=>typeof e==='object'&&'blocked'in e).length===6&&events.filter(e=>typeof e==='object'&&'blocked'in e).every(e=>e.blocked));
  const row={label,passed,events,error,outcome,organizationRows:after.rowCount,allGuardRowsUnchanged,noCommitReceipt};results.push(row);save(path.join(OUT,`${label}-result.json`),row);console.log(`${passed?'PASS':'FAIL'} ${label}`);
 }
}finally{Client.prototype.query=original;await pool.end();save(path.join(OUT,'result.json'),{identity:identity.rows,results,allPassed:results.length===13&&results.every(r=>r.passed),limits:['Synthetic minimal schema, not full staging-schema acceptance','Real second connection committed between discovery and table lock','No API, login, live environment or pilot/cleanup database touched']});}
if(results.length!==13||results.some(r=>!r.passed))process.exitCode=1;
