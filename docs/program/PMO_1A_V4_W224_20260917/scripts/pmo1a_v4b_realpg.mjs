import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const API='http://127.0.0.1:4214/api';
function readAccessFile(){
  const candidates=[
    process.env.PMO1A_DOSTEP_PATH,
    path.resolve(process.cwd(), 'DOSTEP.md'),
    '/Users/piotrwisniewski/Developer/cto-codex/irina-20260914/DOSTEP.md',
    '/Users/piotrwisniewski/Developer/DOSTEP.md',
  ].filter(Boolean);
  for(const candidate of candidates){
    try{
      if(fs.existsSync(candidate)) return fs.readFileSync(candidate,'utf8');
    }catch{}
  }
  return '';
}
function readAccessValue(name){
  const access=readAccessFile();
  const re=new RegExp(`(?:^|\n)\\s*(?:export\\s+)?${name}\\s*=\\s*["']?([^"'\\n]+)`, 'm');
  const match=access.match(re);
  return match?.[1]?.trim() || '';
}
const DB=process.env.PMO1A_REALPG_DATABASE_URL || process.env.DATABASE_URL || readAccessValue('PMO1A_REALPG_DATABASE_URL') || readAccessValue('DATABASE_URL');
const LOGIN_PASSWORD=process.env.PMO1A_REALPG_LOGIN_PASSWORD || readAccessValue('PMO1A_REALPG_LOGIN_PASSWORD') || readAccessValue('CODEX_LOCAL_PASSWORD') || readAccessValue('LOCAL_TEST_PASSWORD') || readAccessFile().match(/Hasło tymczasowe:\s*`([^`]+)`/)?.[1];
if(!DB) throw new Error('PMO1A_REALPG_DATABASE_URL or DATABASE_URL must be provided via env or DOSTEP.md');
if (DB && !['127.0.0.1','localhost','[::1]'].includes(new URL(DB).hostname)) throw new Error('Local copied database required');
if(!LOGIN_PASSWORD) throw new Error('PMO1A_REALPG_LOGIN_PASSWORD must be provided via env or DOSTEP.md');
const ORG='468b234c-66c4-54e1-b626-5e0fb3a92f6a';
const ENERGY='29b45f98-35d5-564c-a88e-ef917c3be2fb';
const JAMES='08c54d75-5260-57b1-9db6-a30aed89a587';
const SARAH='bf70ce19-b249-5c08-839f-449e1d5cddd8';
const CASE='codex-pmo1a-v4c-case-energy';
const PLAN='codex-pmo1a-v4c-plan-energy';
const RUN='codex-pmo1a-v4c-run-energy';
const LINEAGE='codex-pmo1a-v4c-lineage-energy';
const PROJECT='6174636d-c4f2-552d-9a5a-d2695738f9bc';
const TARGET_BY_STATUS={
  APPROVED_BACKLOG:'PLANNING', SCHEDULED:'SCHEDULED', IN_EXECUTION:'EXECUTING', DELIVERED:'DONE', EFFECTIVENESS_REVIEWED:'DONE', CLOSED:'DONE'
};

async function login(email){
  const r=await fetch(`${API}/auth/login`, {method:'POST', signal: AbortSignal.timeout(8000), headers:{'content-type':'application/json'}, body:JSON.stringify({email,password:LOGIN_PASSWORD})});
  const body=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(`login ${email} ${r.status} ${JSON.stringify(body)}`);
  return body.token;
}
async function api(token,path,opts={}){
  const r=await fetch(`${API}${path}`, { ...opts, signal: AbortSignal.timeout(10000), headers:{'authorization':`Bearer ${token}`,'content-type':'application/json',...(opts.headers||{})}});
  const text=await r.text();
  let body; try{ body=text?JSON.parse(text):null; }catch{ body=text; }
  return {status:r.status, body};
}
async function measure(client, token, label){
  console.error('MEASURE_START', label);
  const {rows}=await client.query(`SELECT id,name,status,sponsor_id FROM initiatives WHERE organization_id=$1 ORDER BY name`,[ORG]);
  const results=[]; const summary={total:rows.length, ready:0};
  for(const row of rows){
    const pre=await api(token,`/initiatives/${encodeURIComponent(row.id)}/transition-preflight`);
    const pf=pre.body||{};
    const primary=(pf.transitions||[]).find(t=>t.targetStatus && !['REJECT','CANCEL'].includes(t.gate) && t.roleAllowed);
    const target=primary?.targetStatus ? TARGET_BY_STATUS[primary.targetStatus] : null;
    const caseStatus=pf.transitionCase?.status || 'none';
    const ready=Boolean(target && row.sponsor_id && primary?.conditionSatisfied && caseStatus==='ready' && row.sponsor_id!==JAMES && primary?.proposalAllowed !== false);
    if(ready) summary.ready++;
    summary[`case:${caseStatus}`]=(summary[`case:${caseStatus}`]||0)+1;
    const reason=!primary?'NO_PRIMARY_OR_UNRECOGNIZED':!primary.conditionSatisfied?`PRIMARY_DISABLED:${primary.disabledRule||primary.blockingRule||primary.disabledReason||'UNKNOWN'}`:!row.sponsor_id?'NO_REVIEWER':row.sponsor_id===JAMES?'SELF_REVIEW':caseStatus!=='ready'?`TRANSITION_CASE_${caseStatus.toUpperCase()}`:'READY';
    summary[`reason:${reason}`]=(summary[`reason:${reason}`]||0)+1;
    results.push({preflight:pf,sponsorId:row.sponsor_id,id:row.id,title:row.name,status:row.status,sponsor:!!row.sponsor_id,http:pre.status,currentStatus:pf.currentStatus,transitionCaseStatus:caseStatus,primaryTarget:primary?.targetStatus||null,target,primaryDisabled:!primary?.conditionSatisfied,ready,reason});
  }
  console.error('MEASURE_DONE', label, JSON.stringify(summary));
  return {label, summary, results};
}

async function cleanupSeed(client){
  console.error('CLEANUP_SEED');
  await client.query('BEGIN');
  try{
    await client.query(`DELETE FROM initiative_lifecycle_gate_decisions WHERE transformation_case_id=$1`,[CASE]).catch(()=>{});
    await client.query(`DELETE FROM v8_agent_proposal_governance_events WHERE proposal_version_id IN (SELECT proposal_version_id FROM v8_agent_proposal_versions WHERE proposal_id LIKE 't01-lifecycle:${CASE}:%')`).catch(()=>{});
    await client.query(`DELETE FROM v8_agent_proposal_scope_reviews WHERE proposal_version_id IN (SELECT proposal_version_id FROM v8_agent_proposal_versions WHERE proposal_id LIKE 't01-lifecycle:${CASE}:%')`);
    await client.query(`DELETE FROM v8_agent_proposal_versions WHERE proposal_id LIKE 't01-lifecycle:${CASE}:%'`);
    await client.query(`DELETE FROM transformation_case_artifact_links WHERE transformation_case_id=$1`,[CASE]);
    await client.query(`DELETE FROM transformation_plans WHERE transformation_case_id=$1`,[CASE]);
    await client.query(`DELETE FROM v8_agent_run_identities WHERE canonical_run_id=$1 OR transformation_case_id=$2`,[RUN,CASE]);
    await client.query(`DELETE FROM v8_execution_runs WHERE run_id=$1`,[RUN]);
    await client.query(`DELETE FROM transformation_cases WHERE transformation_case_id=$1`,[CASE]);
    await client.query(`UPDATE initiatives SET status='APPROVED', schedule_baseline_id=NULL, baseline_version=0 WHERE id=$1 AND organization_id=$2`,[ENERGY,ORG]);
    await client.query(`UPDATE ie_aggregate_state SET payload_json=jsonb_set(payload_json, '{lifecycleState}', '"APPROVED_BACKLOG"'::jsonb), version=GREATEST(version,2) WHERE aggregate_type='initiative' AND aggregate_id=$1 AND organization_id=$2`,[ENERGY,ORG]);
    await client.query('COMMIT');
  }catch(e){ await client.query('ROLLBACK'); throw e; }
}

async function seedCase(client, withIdentity, scheduled=false){
  console.error('SEED_CASE', JSON.stringify({withIdentity,scheduled}));
  await cleanupSeed(client);
  await client.query('BEGIN');
  try{
    if(scheduled){
      await client.query(`UPDATE initiatives SET schedule_baseline_id='codex-pmo1a-v4c-baseline', baseline_version=1 WHERE id=$1 AND organization_id=$2`,[ENERGY,ORG]);
      await client.query(`UPDATE ie_aggregate_state SET payload_json=jsonb_set(payload_json, '{lifecycleState}', '"SCHEDULED"'::jsonb), version=GREATEST(version,3) WHERE aggregate_type='initiative' AND aggregate_id=$1 AND organization_id=$2`,[ENERGY,ORG]);
    }
    await client.query(`INSERT INTO transformation_cases
      (transformation_case_id,organization_id,project_id,conversation_id,context_snapshot_id,execution_run_id,initiated_by_user_id,mandate,desired_outcomes_json,status,lifecycle_stage,autonomy_level,source_refs_json,assumptions_json,missing_inputs_json,active_plan_id,lineage_id,idempotency_key,version,created_at,updated_at)
      VALUES ($1,$2,$3,NULL,'codex-pmo1a-v4c-context',$4,$5,'Codex local PMO-1a v4c positive-path probe','[]'::jsonb,'active','portfolio_decision','A1_prepare','[]'::jsonb,'[]'::jsonb,'[]'::jsonb,$6,$7,'codex-pmo1a-v4c-energy',1,NOW(),NOW())`,
      [CASE,ORG,PROJECT,withIdentity?RUN:null,SARAH,PLAN,LINEAGE]);
    await client.query(`INSERT INTO transformation_plans
      (plan_id,transformation_case_id,organization_id,version,status,methodology_key,summary,assumptions_json,risks_json,created_by_user_id,created_at,updated_at)
      VALUES ($1,$2,$3,1,'approved','pmo1a-v4c','Local PMO-1a v4c probe plan','[]'::jsonb,'[]'::jsonb,$4,NOW(),NOW())`,[PLAN,CASE,ORG,SARAH]);
    await client.query(`INSERT INTO transformation_case_artifact_links
      (link_id,transformation_case_id,organization_id,lifecycle_stage,artifact_type,artifact_id,source_proposal_id,lineage_role,created_by_user_id,created_at)
      VALUES ('codex-pmo1a-v4c-link-energy',$1,$2,'portfolio_decision','initiative',$3,NULL,'output',$4,NOW())`,[CASE,ORG,ENERGY,SARAH]);
    if(withIdentity){
      const now=new Date().toISOString();
      await client.query(`INSERT INTO v8_execution_runs
        (run_id,organization_id,context_snapshot_id,initiator_user_id,state,plan_version,goal,created_at,updated_at,metadata)
        VALUES ($1,$2,'codex-pmo1a-v4c-context',$3,'approved_for_apply',1,'Codex PMO-1a v4c local proof',$4,$4,'{}')`,[RUN,ORG,SARAH,now]);
      await client.query(`INSERT INTO v8_agent_run_identities
        (canonical_run_id,organization_id,transformation_case_id,conversation_id,lineage_id,created_at)
        VALUES ($1,$2,$3,NULL,$4,$5)`,[RUN,ORG,CASE,LINEAGE,now]);
    }
    await client.query('COMMIT');
  }catch(e){ await client.query('ROLLBACK'); throw e; }
}

async function positiveFlow(client, sarahToken, jamesToken){
  console.error('POSITIVE_FLOW_START');
  const before=(await client.query(`SELECT COUNT(*)::int n FROM initiative_status_history WHERE organization_id=$1 AND initiative_id=$2`,[ORG,ENERGY])).rows[0].n;
  const proposal=await api(sarahToken,`/initiatives/${ENERGY}/lifecycle-transition-proposals`,{method:'POST',body:JSON.stringify({reviewerUserId:JAMES,targetStatus:'EXECUTING',reason:'Codex local PMO-1a v4c proof'})});
  let review=null, exec=null;
  const proposalVersionId=proposal.body?.proposal?.proposalVersionId;
  const scopeKey=proposal.body?.proposal?.scopeKey;
  if(proposalVersionId && scopeKey){
    review=await api(jamesToken,`/v8/agent-proposals/${encodeURIComponent(proposalVersionId)}/scopes/${encodeURIComponent(scopeKey)}/review`,{method:'POST',body:JSON.stringify({decision:'approved',reason:'Codex local PMO-1a v4c proof approval'})});
    exec=await api(jamesToken,`/initiatives/${ENERGY}/lifecycle-transition-executions`,{method:'POST',body:JSON.stringify({proposalVersionId,reason:'Codex local PMO-1a v4c proof execution'})});
  }
  const after=(await client.query(`SELECT COUNT(*)::int n FROM initiative_status_history WHERE organization_id=$1 AND initiative_id=$2`,[ORG,ENERGY])).rows[0].n;
  const history=(await client.query(`SELECT * FROM initiative_status_history WHERE organization_id=$1 AND initiative_id=$2 ORDER BY changed_at DESC LIMIT 1`,[ORG,ENERGY])).rows;
  const status=(await client.query(`SELECT status FROM initiatives WHERE id=$1 AND organization_id=$2`,[ENERGY,ORG])).rows[0]?.status;
  return {initiativeId:ENERGY,before,after,status,proposal,review,exec,history};
}

const client=new Client({connectionString:DB});
await client.connect();
try{
 const jamesToken=await login('james.whitfield@northwind.example');
 const sarahToken=await login('sarah.mitchell@northwind.example');
 await cleanupSeed(client);
 const before=await measure(client,jamesToken,'before-seed');
 await seedCase(client,false);
 const withoutIdentity=await measure(client,jamesToken,'case-without-identity');
 await seedCase(client,true,false);
 const withIdentityNotScheduled=await measure(client,jamesToken,'case-with-identity-not-scheduled');
 await seedCase(client,true,true);
 const withIdentityScheduled=await measure(client,jamesToken,'case-with-identity-scheduled');
 const eligible=await api(sarahToken,`/initiatives/${ENERGY}/transition-preflight`);
 const selfDenied=await api(jamesToken,`/initiatives/${ENERGY}/lifecycle-transition-proposals`,{method:'POST',body:JSON.stringify({reviewerUserId:JAMES,targetStatus:'EXECUTING',reason:'Local self-review negative proof'})});
 await client.query('UPDATE initiatives SET sponsor_id=$1 WHERE id=$2 AND organization_id=$3',[SARAH,ENERGY,ORG]);
 const wrongAuthority=await api(jamesToken,`/initiatives/${ENERGY}/transition-preflight`);
 const authorityDenied=await api(jamesToken,`/initiatives/${ENERGY}/lifecycle-transition-proposals`,{method:'POST',body:JSON.stringify({reviewerUserId:SARAH,targetStatus:'EXECUTING',reason:'Local authority negative proof'})});
 await client.query('UPDATE initiatives SET sponsor_id=$1 WHERE id=$2 AND organization_id=$3',[JAMES,ENERGY,ORG]);
 const positive=await positiveFlow(client,sarahToken,jamesToken);
 const out={generatedAt:new Date().toISOString(), before, withoutIdentity, withIdentityNotScheduled, withIdentityScheduled, eligible, selfDenied, wrongAuthority, authorityDenied, positive};
 fs.writeFileSync('docs/program/PMO_1A_V4_W224_20260917/measure-v4d-realpg.json', JSON.stringify(out,null,2));
 console.log(JSON.stringify({before:before.summary, withoutIdentity:withoutIdentity.summary, withIdentityNotScheduled:withIdentityNotScheduled.summary, withIdentityScheduled:withIdentityScheduled.summary, positive:{before:positive.before,after:positive.after,status:positive.status,proposal:positive.proposal.status,proposalBody:positive.proposal.body,review:positive.review?.status,reviewBody:positive.review?.body,exec:positive.exec?.status,execBody:positive.exec?.body}},null,2));
} finally { await client.end(); }
