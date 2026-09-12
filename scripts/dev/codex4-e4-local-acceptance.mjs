#!/usr/bin/env node
/** Local acceptance harness; never starts an API or touches a live environment.
 * node scripts/dev/codex4-e4-local-acceptance.mjs --phase=prepare --repo=/absolute/worktree --out=/absolute/private/new-run-dir
 * Start your reviewed local API against cx4_pilot (no mail/cron/bypass), then --phase=pilot --api=http://127.0.0.1:4214 ...
 * Restart that local API against cx4_cleanup, then --phase=cleanup --api=http://127.0.0.1:4214 ...
 * Use --phase=mutations after cleanup for source-mutant guard probes in freshly cloned owned databases.
 * Optional follow-ups: initiative-probe (cleanup API), pilot-security and pilot-faults (pilot API).
 * Each phase has distinct artifacts; no automatic retry/overwrite or prepare repeat.
 * --source-dump defaults to ../codex4-scratch/staging-local.dump relative to codex4 worktree.
 * All database writes occur ONLY when the operator executes this harness, on localhost6455/cx4_*.
 * No automatic DROP; databases and private evidence remain for independent review.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const i=a.indexOf('='); if(!a.startsWith('--')||i<3) throw Error('Use --key=value'); return [a.slice(2,i),a.slice(i+1)]; }));
const PHASE=args.phase;
if(!['prepare','pilot','cleanup','mutations','initiative-probe','pilot-security','pilot-faults','pilot-membership-guard'].includes(PHASE)||!args.repo||!args.out) throw Error('PHASE_REPO_OUT_REQUIRED');
const ROOT=fs.realpathSync(args.repo), OUT=path.resolve(args.out);
if(!path.isAbsolute(args.out)||OUT===ROOT||OUT.startsWith(ROOT+path.sep)) throw Error('PRIVATE_OUTPUT_OUTSIDE_REPO_REQUIRED');
if(PHASE==='prepare') fs.mkdirSync(OUT,{mode:0o700});
else if(!fs.statSync(OUT).isDirectory()) throw Error('PREPARE_FIRST');
const SOURCE=args['source-dump']||path.resolve(ROOT,'../codex4-scratch/staging-local.dump');
const CONTAINER='cx-codex4-pg';
const DBR='a3e05d4a-5397-419d-b486-8e44366c0063';
const PILOTS=['tomasz.jankowski@dbr77.com','justyna.laskowska@dbr77.com','katarzyna.marszalkiewicz@dbr77.com','irina.lebedjuk@dbr77.com'];
const FILE=path.join(OUT,'state.json');
const results=[];
const localDb=d=>{if(!/^cx4_[a-z0-9_]+$/.test(d)) throw Error('FOREIGN_DB');return `postgresql://postgres:postgres@127.0.0.1:6455/${d}`;};
const pool=d=>new Pool({connectionString:localDb(d),max:1});
const qid=s=>'"'+s.replaceAll('"','""')+'"';
const safe=(p,o)=>{ const fd=fs.openSync(p,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(o,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);} };
const hash=async p=>{const h=crypto.createHash('sha256');for await(const c of fs.createReadStream(p))h.update(c);return h.digest('hex');};
const check=(v,code)=>{if(!v)throw Error(code);};
function result(name,status,details={}){results.push({name,status,...details});console.log(`${status} ${name}`);}
const env=d=>({PATH:process.env.PATH,DOCKER_HOST:'unix:///Users/piotrwisniewski/.colima/default/docker.sock',NODE_ENV:'test',DATABASE_URL:localDb(d),DB_TYPE:'postgres',MOCK_DB:'false',RUN_DB_TESTS:'1',ENABLE_TEST_AUTH_BYPASS:'false',DISABLE_SCHEDULER:'true',LOG_LEVEL:'error',LOG_TO_FILE:'false'});
async function run(cmd,argv,{database='cx4_pilot',input,output,log}={}) {
  let infd=input?fs.openSync(input,'r'):null;
  let outfd=output?fs.openSync(output,'wx',0o600):null;
  const errfd=fs.openSync(log||path.join(OUT,`process-${crypto.randomUUID()}.log`),'wx',0o600);
  try{return await new Promise((resolve,reject)=>{
    const child=spawn(cmd,argv,{cwd:ROOT,env:env(database),stdio:[infd??'ignore',outfd??errfd,errfd]});
    child.once('error',reject);child.once('close',code=>resolve(code));
  });}finally{if(infd!=null)fs.closeSync(infd);if(outfd!=null){fs.fsyncSync(outfd);fs.closeSync(outfd);}fs.closeSync(errfd);}
}
async function createDb(d,template) {
  localDb(d);if(template)localDb(template);
  const admin=new Pool({connectionString:'postgresql://postgres:postgres@127.0.0.1:6455/postgres',max:1});
  try {const found=await admin.query('SELECT datname FROM pg_database WHERE datname=$1',[d]);check(!found.rowCount,'OWNED_DATABASE_ALREADY_EXISTS');
    // Cluster-level CREATE only for exact owned cx4_* names. Never terminate other connections.
    await admin.query(`CREATE DATABASE ${qid(d)}${template?' TEMPLATE '+qid(template):''}`);
  }finally{await admin.end();}
}
async function restore(d,dump,label) {
  await createDb(d);
  const log=path.join(OUT,`${label}-restore.log`);
  const exit=await run('docker',['exec','-i',CONTAINER,'pg_restore','-U','postgres','--no-owner','--no-acl','--exit-on-error','-d',d],{input:dump,log,database:d});
  check(exit===0,'RESTORE_NONZERO');return log;
}
async function fingerprint(db,tables) {
  const p=pool(db);const full=!tables;try{
    if(!tables) tables=(await p.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
    const out={};for(const t of tables){const r=await p.query(`SELECT count(*)::text AS n,md5(COALESCE(string_agg(h,'' ORDER BY h),'')) AS digest FROM (SELECT md5(row_to_json(x)::text) AS h FROM public.${qid(t)} x) snapshot_rows`);out[t]=r.rows[0];}
    if(full){
      const seqs=await p.query("SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename");
      for(const {sequencename} of seqs.rows)out[`sequence:${sequencename}`]=(await p.query(`SELECT last_value::text,is_called FROM public.${qid(sequencename)}`)).rows[0];
      out.largeObjects=(await p.query("SELECT count(*)::text AS n,md5(COALESCE(string_agg(h,'' ORDER BY h),'')) AS digest FROM (SELECT md5(row_to_json(x)::text) h FROM pg_catalog.pg_largeobject x) l")).rows[0];
      out.largeObjectMetadata=(await p.query("SELECT count(*)::text AS n,md5(COALESCE(string_agg(h,'' ORDER BY h),'')) AS digest FROM (SELECT md5(row_to_json(x)::text) h FROM pg_catalog.pg_largeobject_metadata x) l")).rows[0];
    }
    return out;
  }finally{await p.end();}
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function backup(db,label) {
  const dump=path.join(OUT,`${label}.dump`), log=path.join(OUT,`${label}-dump.log`);
  check(await run('docker',['exec',CONTAINER,'pg_dump','-U','postgres','-Fc',db],{output:dump,log,database:db})===0,'DUMP_NONZERO');
  const digest=await hash(dump), restored=`${db}_restore_${label.replace(/[^a-z0-9]/g,'_').slice(-20)}`;
  const before=await fingerprint(db);const restoreLog=await restore(restored,dump,label);
  const after=await fingerprint(restored);check(same(before,after),'FULL_RESTORE_ROWS_DIFFER');
  const evidence=path.join(OUT,`${label}-restore-evidence.json`);
  safe(evidence,{source:{host:'127.0.0.1',port:6455,database:db},dumpSha256:digest,restoredDatabase:restored,restoreProcess:{exitCode:0,log:restoreLog,logSha256:await hash(restoreLog)},tablesBefore:before,tablesRestored:after,comparison:'All public-table row counts and sorted row hashes, sequence last_value/is_called and large-object rows/metadata equal. Restore exit status and private logs preserved for review.'});
  result(`${label}:full_dump_restore_rows`,'PASS',{restored});
  return {kind:'pg_dump-custom-full',path:dump,sha256:digest,host:'127.0.0.1',port:6455,database:db,createdAt:new Date().toISOString(),restoreEvidence:{path:evidence,sha256:await hash(evidence)}};
}
function target(db,operation,ids,b){return {version:1,operation,intendedEnvironment:'staging',executionEnvironment:'local-copy',host:'127.0.0.1',port:6455,database:db,organizationIds:ids,backup:b};}
async function cli(db,script,t,label,apply=false,repo=ROOT) {
  const tf=path.join(OUT,`${label}-target.json`),mf=path.join(OUT,`${label}-manifest.json`);
  safe(tf,t);const argv=[path.join(repo,'scripts/dane',script),`--target-manifest=${tf}`,`--manifest=${mf}`];
  let credentials;
  if(apply){argv.push('--apply',`--backup=${t.backup.path}`);if(script.startsWith('pilotaz')){credentials=path.join(OUT,`${label}-credentials.json`);argv.push(`--out=${credentials}`);}}
  const log=path.join(OUT,`${label}-cli.log`);
  const code=await run(process.execPath,argv,{database:db,log});
  return {code,manifest:mf,credentials,log};
}
const PS='pilotaz-demo-konta-20260912.mjs',CS='sprzatanie-klonow-demo-session-20260912.mjs';
async function http(base,method,route,body,token) {
  const u=new URL(base);check(['127.0.0.1','localhost','[::1]'].includes(u.hostname)&&u.port==='4214'&&u.protocol==='http:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/','LOCAL_API_4214_REQUIRED');
  const r=await fetch(new URL(route,u),{method,redirect:'error',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  let data;try{data=await r.json();}catch{data=null;}return {status:r.status,data};
}
async function login(base,email,password,expectedId,expectedOrg,expectedRole) {
  const r=await http(base,'POST','/api/auth/login',{email,password});
  check(r.status===200&&r.data?.token&&r.data?.user?.id===expectedId,'REAL_LOGIN_NOT_PROVEN');
  const u=r.data.user;check((u.organizationId||u.organization_id)===expectedOrg,'LOGIN_WRONG_ORGANIZATION');if(expectedRole)check(String(u.role).toUpperCase()===expectedRole,'LOGIN_EFFECTIVE_ROLE_CHANGED');return r.data.token;
}
let state=PHASE==='prepare'?{runId:crypto.randomUUID(),startedAt:new Date().toISOString()}:JSON.parse(fs.readFileSync(FILE,'utf8'));
const BASEID='cx4-e4-demo';
async function prepare() {
  await restore('cx4_pilot',SOURCE,'pilot-source');await restore('cx4_cleanup',SOURCE,'cleanup-source');
  const pp=pool('cx4_pilot');state.pilotExisting=[];state.oldPasswords={};
  try{for(const email of PILOTS){const r=await pp.query('SELECT id,organization_id FROM users WHERE lower(trim(email))=$1',[email]);check(r.rowCount<=1,'PILOT_DUPLICATE_PRECONDITION');if(r.rowCount){check(r.rows[0].organization_id===DBR,'PILOT_ORG_PRECONDITION');const pw=crypto.randomBytes(18).toString('base64url');state.oldPasswords[email]=pw;state.pilotExisting.push(r.rows[0].id);await pp.query('UPDATE users SET password=$1 WHERE id=$2',[await bcrypt.hash(pw,10),r.rows[0].id]);}}
  }finally{await pp.end();}
  const p=pool('cx4_cleanup');
  state.controlOrg=crypto.randomUUID();state.controlUser=crypto.randomUUID();state.controlProject=crypto.randomUUID();state.controlEmail=`cx4-e4-${state.runId}@consultify.local`;state.controlPassword=crypto.randomBytes(18).toString('base64url');
  state.clones={};
  try{
    await p.query("INSERT INTO organizations(id,name,organization_type,billing_status,status,plan) VALUES($1,'E4 preserved control','PAID','paid','active','enterprise'),($2,'E4 base template','DEMO','trial','active','free')",[state.controlOrg,BASEID]);
    await p.query("INSERT INTO users(id,organization_id,email,password,role,status,email_verified,onboarding_completed,language) VALUES($1,$2,$3,$4,'OWNER','active',1,true,'en')",[state.controlUser,state.controlOrg,state.controlEmail,await bcrypt.hash(state.controlPassword,10)]);
    await p.query("INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')",[crypto.randomUUID(),state.controlOrg,state.controlUser]);
    await p.query("INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,'E4 preserved project',$3)",[state.controlProject,state.controlOrg,state.controlUser]);
    await p.query("INSERT INTO project_members(id,project_id,user_id,project_role) VALUES($1,$2,$3,'PROJECT_LEADER')",[crypto.randomUUID(),state.controlProject,state.controlUser]);
    for(const kind of ['valid','human_primary','human_member','logged_seed','logged_seed_at','held','active_session','paid','named_customer','template']){
      const id=kind==='named_customer'?crypto.randomUUID():`${BASEID}-session-${kind}-${state.runId}`;state.clones[kind]=id;
      await p.query("INSERT INTO organizations(id,name,organization_type,billing_status,created_at) VALUES($1,'Atelier Toys','DEMO',$2,'2020-01-01')",[id,kind==='paid'?'paid':'trial']);
      if(['human_primary','logged_seed','logged_seed_at'].includes(kind)){const uid=crypto.randomUUID();await p.query("INSERT INTO users(id,organization_id,email,password,role,status,last_login) VALUES($1,$2,$3,'unused','MEMBER','active',$4)",[uid,id,kind.startsWith('logged_seed')?`${kind}@demo.ateliertoys.com`:'real-human@dbr77.com',kind==='logged_seed'?'2021-01-01':null]);}
      if(kind==='logged_seed_at')await p.query("UPDATE users SET last_login_at='2021-01-01' WHERE organization_id=$1",[id]);
      if(kind==='human_member')await p.query("INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'MEMBER','ACTIVE')",[crypto.randomUUID(),id,state.controlUser]);
      if(kind==='held')await p.query('INSERT INTO org_policies(id,organization_id,legal_hold_enabled) VALUES($1,$2,1)',[crypto.randomUUID(),id]);
      if(kind==='active_session')await p.query("INSERT INTO demo_sessions(id,user_id,base_org_id,session_org_id,status,anchor_date,expires_at) VALUES($1,$2,$3,$4,'active',NOW(),NOW()+INTERVAL '1 day')",[crypto.randomUUID(),state.controlUser,BASEID,id]);
    }
    state.cascadeTask=crypto.randomUUID();state.cascadeComment=crypto.randomUUID();
    await p.query("INSERT INTO tasks(id,organization_id,title,status) VALUES($1,$2,'E4 CASCADE preservation proof','todo')",[state.cascadeTask,state.clones.valid]);
    await p.query("INSERT INTO task_comments(id,task_id,user_id,content) VALUES($1,$2,$3,'E4 child without organization_id')",[state.cascadeComment,state.cascadeTask,state.controlUser]);
  }finally{await p.end();}
  state.pilotBackup=await backup('cx4_pilot','pilot_before');state.cleanupBackup=await backup('cx4_cleanup','cleanup_before');
  safe(FILE,state);result('prepare_owned_databases','PASS');
}
async function pilot() {
  const tables=['users','organization_members','password_resets','refresh_tokens','user_onboarding_status','organizations'];
  const rolePool=pool('cx4_pilot');let originalRoles;try{originalRoles=(await rolePool.query('SELECT u.id,u.role AS user_role,m.role AS membership_role FROM users u JOIN organization_members m ON m.user_id=u.id AND m.organization_id=u.organization_id WHERE lower(trim(u.email))=ANY($1::text[])',[PILOTS])).rows;}finally{await rolePool.end();}
  const before=await fingerprint('cx4_pilot',tables);const t=target('cx4_pilot','pilot-accounts',[DBR],state.pilotBackup);
  const dry=await cli('cx4_pilot',PS,t,'pilot_dry');check(dry.code===0,'PILOT_DRY_FAILED');check(same(before,await fingerprint('cx4_pilot',tables)),'DRY_RUN_CHANGED_DATA');result('pilot_dry_zero_writes','PASS');
  const a=await cli('cx4_pilot',PS,t,'pilot_apply',true);check(a.code===0,'PILOT_APPLY_FAILED');const credentials=JSON.parse(fs.readFileSync(a.credentials,'utf8')).credentials;
  const p=pool('cx4_pilot');let identities=[];
  try{for(const c of credentials){const r=await p.query('SELECT id,organization_id,role,email_verified,onboarding_completed FROM users WHERE lower(trim(email))=$1',[c.email]);check(r.rowCount===1,'PILOT_IDENTITY_COUNT');const u=r.rows[0];check(u.organization_id===DBR&&u.email_verified===1&&u.onboarding_completed===true,'PILOT_USER_FLAGS');if(!state.pilotExisting.includes(u.id))check(u.role==='MEMBER','NEW_USER_ROLE_ESCALATION');const m=await p.query('SELECT role,status FROM organization_members WHERE user_id=$1 AND organization_id=$2',[u.id,DBR]);check(m.rowCount===1&&m.rows[0].status==='ACTIVE','PILOT_MEMBERSHIP');const prior=originalRoles.find(x=>x.id===u.id);check(prior?u.role===prior.user_role&&m.rows[0].role===prior.membership_role:m.rows[0].role==='MEMBER','PILOT_EXISTING_ROLE_CHANGED');identities.push({email:c.email,id:u.id});if(args.api){await login(args.api,c.email,c.temporaryPassword,u.id,DBR,m.rows[0].role);if(state.oldPasswords[c.email]){const old=await http(args.api,'POST','/api/auth/login',{email:c.email,password:state.oldPasswords[c.email]});check(old.status===401&&!old.data?.token,'OLD_PASSWORD_REFUSAL_NOT_PROVEN');}}}}
  finally{await p.end();}
  result('pilot_4_http_logins',args.api?'PASS':'NOT_PROVEN',{reason:args.api?undefined:'Provide local --api after starting API against cx4_pilot'});
  const b=await cli('cx4_pilot',PS,t,'pilot_apply_second',true);check(b.code===0,'PILOT_SECOND_APPLY_FAILED');const second=JSON.parse(fs.readFileSync(b.credentials,'utf8')).credentials;
  const p2=pool('cx4_pilot');try{for(const c of second){const r=await p2.query('SELECT id FROM users WHERE lower(trim(email))=$1',[c.email]);check(r.rowCount===1&&r.rows[0].id===identities.find(x=>x.email===c.email).id,'PILOT_SECOND_DUPLICATE');if(args.api)await login(args.api,c.email,c.temporaryPassword,r.rows[0].id,DBR);}}finally{await p2.end();}
  result('pilot_repeat_identity_stable_passwords_rotate','PASS');
  const restored='cx4_pilot_rollback';await restore(restored,state.pilotBackup.path,'pilot_rollback');check(same(before,await fingerprint(restored,tables)),'PILOT_RESTORE_DIFFERENCE');result('pilot_full_dump_rollback_readback','PASS');
  result('pilot_refresh_reset_revocation_and_failure_injection','NOT_PROVEN',{reason:'This harness version does not yet create usable old refresh/reset tokens or inject COMMIT failure.'});
}
async function pilotSecurity(){
  check(Boolean(args.api),'PILOT_API_REQUIRED');
  const old=JSON.parse(fs.readFileSync(path.join(OUT,'pilot_apply_second-credentials.json'),'utf8')).credentials[0];
  const authenticated=await http(args.api,'POST','/api/auth/login',{email:old.email,password:old.temporaryPassword});
  check(authenticated.status===200&&authenticated.data?.refreshToken,'REFRESH_ISSUANCE_NOT_PROVEN');
  const refreshed=await http(args.api,'POST','/api/auth/refresh',{refreshToken:authenticated.data.refreshToken});
  check(refreshed.status===200&&refreshed.data?.refreshToken,'REFRESH_VALID_BEFORE_NOT_PROVEN');
  const id=authenticated.data.user.id,resetToken=crypto.randomBytes(32).toString('hex');
  const p=pool('cx4_pilot');try{
    await p.query("INSERT INTO password_resets(id,user_id,token,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '30 minutes')",[crypto.randomUUID(),id,resetToken]);
  }finally{await p.end();}
  const resetBefore=await http(args.api,'POST','/api/auth/reset-password',{token:resetToken,newPassword:old.temporaryPassword});
  check(resetBefore.status===400&&resetBefore.data?.code==='PASSWORD_REUSE_NOT_ALLOWED','RESET_VALID_BEFORE_NOT_PROVEN');
  const b=await backup('cx4_pilot','pilot_security_before');
  const applied=await cli('cx4_pilot',PS,target('cx4_pilot','pilot-accounts',[DBR],b),'pilot_security_apply',true);
  check(applied.code===0,'SECURITY_APPLY_FAILED');
  const deniedRefresh=await http(args.api,'POST','/api/auth/refresh',{refreshToken:refreshed.data.refreshToken});
  check(deniedRefresh.status===401&&!deniedRefresh.data?.token,'OLD_REFRESH_REPLAY_ACCEPTED');
  const deniedReset=await http(args.api,'POST','/api/auth/reset-password',{token:resetToken,newPassword:crypto.randomBytes(18).toString('base64url')});
  check(deniedReset.status===400&&deniedReset.data?.code==='PASSWORD_RESET_INVALID','OLD_RESET_REPLAY_ACCEPTED');
  const q=pool('cx4_pilot');try{
    check((await q.query('SELECT id FROM password_resets WHERE user_id=$1',[id])).rowCount===0,'RESET_ROWS_REMAIN');
    check((await q.query('SELECT id FROM refresh_tokens WHERE user_id=$1 AND revoked_at IS NULL',[id])).rowCount===0,'REFRESH_ROWS_REMAIN_ACTIVE');
  }finally{await q.end();}
  result('pilot_real_refresh_reset_valid_before_revoked_after','PASS');
  const credentials=JSON.parse(fs.readFileSync(applied.credentials,'utf8')).credentials;
  for(const c of credentials){const rowPool=pool('cx4_pilot');let row;try{row=(await rowPool.query('SELECT u.id,m.role FROM users u JOIN organization_members m ON m.user_id=u.id AND m.organization_id=u.organization_id WHERE u.email=$1',[c.email])).rows[0];}finally{await rowPool.end();}await login(args.api,c.email,c.temporaryPassword,row.id,DBR,row.role);}
  result('pilot_final_credentials_four_real_logins','PASS');
}
async function pilotFaults(){
  check(Boolean(args.api),'PILOT_API_REQUIRED');
  const b=await backup('cx4_pilot','pilot_fault_before');
  const t=target('cx4_pilot','pilot-accounts',[DBR],b);
  const tables=['users','organization_members','password_resets','refresh_tokens','user_onboarding_status','organizations'];
  const before=await fingerprint('cx4_pilot',tables);
  // EEXIST at credential write occurs after SQL updates but before COMMIT.
  safe(path.join(OUT,'pilot_output_fault-credentials.json'),{sentinel:'never overwrite'});
  const refused=await cli('cx4_pilot',PS,t,'pilot_output_fault',true);
  check(refused.code!==0,'OUTPUT_COLLISION_NOT_REFUSED');
  check(same(before,await fingerprint('cx4_pilot',tables)),'OUTPUT_FAILURE_DID_NOT_ROLL_BACK');
  check(!fs.existsSync(path.join(OUT,'pilot_output_fault-credentials.json.commit.json')),'OUTPUT_FAILURE_RECEIPT_WRITTEN');
  result('pilot_real_sql_rollback_on_credential_output_failure','PASS');
  const mirror=path.join(OUT,'post_commit_fault');fs.mkdirSync(path.join(mirror,'scripts/dane'),{recursive:true});
  for(const name of ['codex4-ops-safety.mjs',PS])fs.copyFileSync(path.join(ROOT,'scripts/dane',name),path.join(mirror,'scripts/dane',name));
  fs.symlinkSync(path.join(ROOT,'node_modules'),path.join(mirror,'node_modules'),'dir');
  const safety=path.join(mirror,'scripts/dane/codex4-ops-safety.mjs');
  const anchor="await context.client.query(commit ? 'COMMIT' : 'ROLLBACK');";
  const source=fs.readFileSync(safety,'utf8');check(source.split(anchor).length===2,'COMMIT_FAULT_ANCHOR_NOT_UNIQUE');
  fs.writeFileSync(safety,source.replace(anchor,anchor+" if (commit) throw new Error('injected client acknowledgement loss');"));
  const unknown=await cli('cx4_pilot',PS,t,'pilot_commit_unknown',true,mirror);
  check(unknown.code!==0&&fs.readFileSync(unknown.log,'utf8').includes('E4_STOP COMMIT_OUTCOME_UNKNOWN'),'COMMIT_UNKNOWN_NOT_CLASSIFIED');
  check(!fs.existsSync(unknown.credentials+'.commit.json'),'UNKNOWN_COMMIT_HAS_SUCCESS_RECEIPT');
  check(!same(before,await fingerprint('cx4_pilot',tables)),'POST_COMMIT_MUTATION_NOT_OBSERVED');
  const credentials=JSON.parse(fs.readFileSync(unknown.credentials,'utf8')).credentials;
  const readback=pool('cx4_pilot');try{for(const c of credentials){const row=(await readback.query('SELECT u.id,u.password,m.role FROM users u JOIN organization_members m ON m.user_id=u.id AND m.organization_id=u.organization_id WHERE u.email=$1',[c.email])).rows[0];check(await bcrypt.compare(c.temporaryPassword,row.password),'UNKNOWN_CREDENTIAL_HASH_MISMATCH');await login(args.api,c.email,c.temporaryPassword,row.id,DBR,row.role);}}finally{await readback.end();}
  result('pilot_post_commit_client_fault_fresh_pg_four_logins','PASS',{limit:'Deterministic client exception after real COMMIT; not a real network outage. No retry; separate readback proves committed outcome.',credentialFile:unknown.credentials});
}
async function pilotMembershipGuard(){
  const db='cx4_pilot_membership_guard';
  // Clone the completed, quiescent restore proof; do not alter its evidence database.
  await createDb(db,'cx4_pilot_restore_pilot_fault_before');
  const p=pool(db);try{
    const r=await p.query('SELECT id FROM users WHERE lower(trim(email))=$1',[PILOTS[0]]);check(r.rowCount===1,'MEMBERSHIP_GUARD_USER_MISSING');
    const changed=await p.query('DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2',[DBR,r.rows[0].id]);check(changed.rowCount===1,'MEMBERSHIP_GUARD_FIXTURE_NOT_REVOKED');
  }finally{await p.end();}
  const tables=['users','organization_members','password_resets','refresh_tokens','user_onboarding_status','organizations'];
  const before=await fingerprint(db,tables);
  const refused=await cli(db,PS,target(db,'pilot-accounts',[DBR]),'pilot_missing_membership_dry');
  check(refused.code!==0&&fs.readFileSync(refused.log,'utf8').includes('E4_STOP EXISTING_MEMBERSHIP_REQUIRES_REVIEW'),'MISSING_MEMBERSHIP_WRONG_REFUSAL');
  check(same(before,await fingerprint(db,tables)),'MISSING_MEMBERSHIP_REINSTATED_OR_PASSWORD_CHANGED');
  result('pilot_real_missing_membership_preflight_zero_changes','PASS',{limit:'Real dry-run preflight on separate owned template clone; no authorization restored. Apply-mode refusal additionally covered by shared source guard/pure tests, not this negative run.'});
}
function cleanupTarget(db,b,ids){return {...target(db,'cleanup-demo-clones',ids,b),baseDemoOrganizationIds:[BASEID],protectedOrganizationIds:[state.clones.template,state.controlOrg],seedEmails:['logged_seed@demo.ateliertoys.com','logged_seed_at@demo.ateliertoys.com'],expiryCutoff:'2022-01-01T00:00:00.000Z'};}
async function initiativeProbe(){
  if(!args.api){result('post_cleanup_canonical_initiative','NOT_PROVEN',{reason:'Local API against cx4_cleanup not provided'});return;}
  try{
    const token=await login(args.api,state.controlEmail,state.controlPassword,state.controlUser,state.controlOrg);
    const proposalId=crypto.randomUUID(),initiativeId=crypto.randomUUID();const title=`E4 post-cleanup ${state.runId}`;
    const common={expectedVersion:0,sourceType:'MANUAL_HUB',sourceId:crypto.randomUUID(),sourceVersion:1,title,problem:'Local cleanup sentinel',proposedOutcome:'Canonical creation survives cleanup',priority:'MEDIUM',projectId:state.controlProject,initiativeOwnerId:state.controlUser,visibility:'PROJECT'};
    const a=await http(args.api,'POST','/api/initiatives/runtime-v1/source-proposals',{...common,proposalId,clientRequestId:crypto.randomUUID(),provenance:{system:'consultify.initiatives-hub',recordType:'manual-initiative-proposal',capturedAt:new Date().toISOString(),evidenceRefs:[`consultify://initiatives/source-proposals/${proposalId}`]}},token);
    check(a.status===201,'CANONICAL_PROPOSAL_REFUSED');
    const b=await http(args.api,'POST','/api/initiatives/runtime-v1/registrations',{...common,initiativeId,proposalId,proposalVersion:1,clientRequestId:crypto.randomUUID()},token);check(b.status===201,'CANONICAL_REGISTRATION_REFUSED');
    const c=await http(args.api,'GET',`/api/initiatives/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}`,undefined,token);check(c.status===200,'CANONICAL_HTTP_READBACK_FAILED');
    const p=pool('cx4_cleanup');try{const r=await p.query("SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2",[state.controlOrg,initiativeId]);check(r.rowCount===1&&JSON.stringify(r.rows[0].payload_json).includes(title),'CANONICAL_PG_READBACK_FAILED');}finally{await p.end();}
    result('post_cleanup_canonical_initiative','PASS',{initiativeId,proposalId,note:'Records retained only in owned disposable cx4_cleanup; no SQL substitute for app creation.'});
  }catch(error){result('post_cleanup_canonical_initiative','NOT_PROVEN',{reason:/^[A-Z0-9_]+$/.test(error.message)?error.message:'Real app path refused or SQL readback failed; inspect local API logs. No gate weakened.'});}
}
async function preservedSentinels(){
  const p=pool('cx4_cleanup');const ids=[BASEID,DBR,state.controlOrg,'*','__system__','__global__','',...Object.entries(state.clones).filter(([k])=>k!=='valid').map(([,v])=>v)];
  try{const tables=(await p.query("SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='organization_id' ORDER BY table_name")).rows;const saved={};
    for(const {table_name:t} of [...tables,{table_name:'organizations'}]){const col=t==='organizations'?'id':'organization_id';saved[t]=(await p.query(`SELECT count(*)::text n,md5(COALESCE(string_agg(h,'' ORDER BY h),'')) digest FROM (SELECT md5(row_to_json(x)::text) h FROM public.${qid(t)} x WHERE ${qid(col)}::text=ANY($1::text[])) sentinel_rows`,[ids])).rows[0];}return saved;
  }finally{await p.end();}
}
async function cleanup(){
  const before=await fingerprint('cx4_cleanup');const sentinelsBefore=await preservedSentinels();
  for(const [kind,id] of Object.entries(state.clones).filter(([k])=>k!=='valid')){
    const r=await cli('cx4_cleanup',CS,cleanupTarget('cx4_cleanup',state.cleanupBackup,[state.clones.valid,id]),`guard_${kind}`,true);
    const expected={human_primary:'HUMAN_MEMBER_PRESENT',human_member:'HUMAN_MEMBER_PRESENT',logged_seed:'HUMAN_MEMBER_PRESENT',logged_seed_at:'HUMAN_MEMBER_PRESENT',held:'LEGAL_HOLD',active_session:'ACTIVE_DEMO_SESSION',paid:'NOT_NONPAYING_DEMO',named_customer:'NOT_EXACT_EPHEMERAL_CLONE',template:'NOT_EXACT_EPHEMERAL_CLONE'}[kind];
    check(r.code!==0&&fs.readFileSync(r.log,'utf8').includes(`E4_STOP ${expected}`),`GUARD_${kind}_WRONG_REFUSAL`);check(same(before,await fingerprint('cx4_cleanup')),'GUARD_PARTIAL_COMMIT');result(`guard_${kind}_whole_batch_unchanged`,'PASS');
  }
  const t=cleanupTarget('cx4_cleanup',state.cleanupBackup,[state.clones.valid]);const d=await cli('cx4_cleanup',CS,t,'cleanup_dry');check(d.code===0,'CLEANUP_DRY_FAILED');check(same(before,await fingerprint('cx4_cleanup')),'CLEANUP_DRY_WRITES');
  const a=await cli('cx4_cleanup',CS,t,'cleanup_apply',true);check(a.code===0,'CLEANUP_APPLY_FAILED');
  const p=pool('cx4_cleanup');try{
    check((await p.query('SELECT id FROM organizations WHERE id=$1',[state.clones.valid])).rowCount===0,'TARGET_NOT_DELETED');
    check((await p.query('SELECT id FROM task_comments WHERE id=$1',[state.cascadeComment])).rowCount===0,'CASCADE_CHILD_NOT_REMOVED');
    for(const id of [BASEID,DBR,state.controlOrg,...Object.entries(state.clones).filter(([k])=>k!=='valid').map(([,v])=>v)])check((await p.query('SELECT id FROM organizations WHERE id=$1',[id])).rowCount===1,'PROTECTED_SENTINEL_LOST');
  }finally{await p.end();}
  check(same(sentinelsBefore,await preservedSentinels()),'PROTECTED_SENTINEL_ROWS_CHANGED');result('protected_and_global_rows_exactly_preserved','PASS');
  const after=await fingerprint('cx4_cleanup');const again=await cli('cx4_cleanup',CS,t,'cleanup_second',true);check(again.code===0,'CLEANUP_IDEMPOTENCE_FAILED');check(same(after,await fingerprint('cx4_cleanup')),'CLEANUP_REPEAT_CHANGED_DATA');result('cleanup_apply_second_zero_change','PASS');
  const restored='cx4_cleanup_rollback';await restore(restored,state.cleanupBackup.path,'cleanup_rollback');check(same(before,await fingerprint(restored)),'CLEANUP_FULL_RESTORE_DIFFERENCE');result('cleanup_full_restore_including_cascade_child','PASS');
  await initiativeProbe();result('concurrent_membership_legalhold_race','NOT_PROVEN',{reason:'Needs two-session timing probe; this harness does not emulate that race.'});
}
async function mutations(){
  const source=fs.readFileSync(path.join(ROOT,'scripts/dane/sprzatanie-klonow-demo-session-20260912.mjs'),'utf8');
  const mutations=[
    {name:'membership',kind:'human_member',from:' OR EXISTS (SELECT 1 FROM organization_members m WHERE m.user_id=u.id AND m.organization_id=$1)',to:''},
    {name:'legalhold',kind:'held',from:'if (legalHold) fail(\'LEGAL_HOLD\');',to:'/* local mutation: removed legal-hold guard */'},
    {name:'lastlogin',kind:'logged_seed',from:'u.last_login != null || ',to:''},
    {name:'lastloginat',kind:'logged_seed_at',from:'u.last_login_at != null || ',to:''},
  ];
  for(const m of mutations){
    check(source.split(m.from).length===2,'MUTATION_ANCHOR_NOT_UNIQUE');
    const db=`cx4_cleanup_mut_${m.name}`;await restore(db,state.cleanupBackup.path,`mut_${m.name}_source`);const b=await backup(db,`mut_${m.name}_before`);
    const mirror=path.join(OUT,`mutant_${m.name}`);fs.mkdirSync(path.join(mirror,'scripts/dane'),{recursive:true});
    for(const name of ['codex4-ops-safety.mjs',CS])fs.copyFileSync(path.join(ROOT,'scripts/dane',name),path.join(mirror,'scripts/dane',name));
    fs.writeFileSync(path.join(mirror,'scripts/dane',CS),source.replace(m.from,m.to));
    fs.symlinkSync(path.join(ROOT,'server'),path.join(mirror,'server'),'dir');fs.symlinkSync(path.join(ROOT,'node_modules'),path.join(mirror,'node_modules'),'dir');
    const t=cleanupTarget(db,b,[state.clones[m.kind]]);const r=await cli(db,CS,t,`mut_${m.name}_apply`,true,mirror);
    const p=pool(db);let gone;try{gone=(await p.query('SELECT id FROM organizations WHERE id=$1',[state.clones[m.kind]])).rowCount===0;}finally{await p.end();}
    check(r.code===0&&gone,'MUTANT_NOT_KILLED_BEHAVIOR_NOT_REACHED');
    result(`mutation_${m.name}`,'PASS',{meaning:'Removing guard allowed forbidden deletion in disposable clone; corresponding unmutated guard test rejects and preserves row.'});
  }
  result('org_predicate_template_failure_injection_mutations','NOT_PROVEN',{reason:'Additional canonical-engine mutant and rollback injection not implemented.'});
}
try{
  await ({prepare,pilot,cleanup,mutations,'initiative-probe':initiativeProbe,'pilot-security':pilotSecurity,'pilot-faults':pilotFaults,'pilot-membership-guard':pilotMembershipGuard})[PHASE]();
}catch(error){result('phase_aborted','FAIL',{reason: /^[A-Z0-9_]+$/.test(error.message)?error.message:'Inspect private logs; raw DB/auth errors are not printed'});process.exitCode=1;}
finally{safe(path.join(OUT,`${PHASE}-results-${Date.now()}.json`),{phase:PHASE,completedAt:new Date().toISOString(),results,readiness:results.some(r=>r.status==='FAIL')?'FAIL':results.some(r=>r.status==='NOT_PROVEN')?'PARTIAL':'PHASE_PASS_ONLY'});}
