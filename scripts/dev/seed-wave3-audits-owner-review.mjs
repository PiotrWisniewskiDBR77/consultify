#!/usr/bin/env node
/**
 * Wave 3 / module 12 Audits — deterministic owner-review fixture.
 *
 * Local-only commands:
 *   AUD_OWNER_FIXTURE_CONFIRM=YES DATABASE_URL=postgresql://.../consultify_w3_audits_owner_<name> node scripts/dev/seed-wave3-audits-owner-review.mjs provision
 *   AUD_OWNER_FIXTURE_CONFIRM=YES AUD_OWNER_FIXTURE_PASSWORD=<local-only> AUD_OWNER_FIXTURE_MANIFEST=/new/path.json DATABASE_URL=... npx tsx scripts/dev/seed-wave3-audits-owner-review.mjs seed
 *   DATABASE_URL=... node scripts/dev/seed-wave3-audits-owner-review.mjs readback
 *   AUD_OWNER_FIXTURE_CONFIRM=YES DATABASE_URL=... node scripts/dev/seed-wave3-audits-owner-review.mjs reset
 *   AUD_OWNER_FIXTURE_CONFIRM=YES DATABASE_URL=... node scripts/dev/seed-wave3-audits-owner-review.mjs drop
 *
 * `provision` clones only the fixed local baseline `consultify_audits_20260813`
 * and applies the two Audits method-core migrations. No external standard,
 * live provider, remote endpoint or production database is used. Each seed
 * requires a new manifest path; manifests are exclusive wx/0600 and retained.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const COMMAND = process.argv[2] || 'readback';
const DATABASE_URL = process.env.DATABASE_URL || '';
const CONFIRM = process.env.AUD_OWNER_FIXTURE_CONFIRM;
const PASSWORD = process.env.AUD_OWNER_FIXTURE_PASSWORD;
const MANIFEST_PATH = process.env.AUD_OWNER_FIXTURE_MANIFEST || '';
const PREFIX = 'consultify_w3_audits_owner_';
const TEMPLATE_DB = 'consultify_audits_20260813';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const MUTATING = new Set(['provision', 'seed', 'reset', 'drop']);

const IDS = Object.freeze({
  org: 'w3-aud-owner-org-v1', foreignOrg: 'w3-aud-foreign-org-v1',
  owner: 'w3-aud-owner-user-v1', lead: 'w3-aud-lead-user-v1',
  auditee: 'w3-aud-auditee-user-v1', reviewer: 'w3-aud-reviewer-user-v1',
  actionOwner: 'w3-aud-action-owner-user-v1', revoked: 'w3-aud-revoked-user-v1',
  foreignOwner: 'w3-aud-foreign-owner-v1', source: 'w3-aud-source-v1',
  pack: 'w3-aud-pack-v1', packCriterion: 'w3-aud-pack-criterion-v1',
  program: 'w3-aud-program-v1', criterion: 'w3-aud-criterion-v1',
  evidence: 'w3-aud-evidence-v1', finding: 'w3-aud-finding-v1',
  action: 'w3-aud-action-v1', report: 'w3-aud-report-v1', proposal: 'w3-aud-proposal-v1',
});

const PACK_TITLE = 'Transformation Audit Pack — internal operations';
const REQUIREMENT = 'Internal transformation decisions retain an accountable owner, dated evidence and independent review.';
const EVIDENCE_TEXT = 'Internal steering review sampled 12 decisions; 3 lacked a dated independent review record.';
const BANNED = /\b(?:ISO|SOC\s?2|NIST|IATF|VDA|HIPAA)\b/i;

function fail(message) { throw new Error(`[W3-AUD fixture] BLOCKED: ${message}`); }
function hash(value) { return createHash('sha256').update(value).digest('hex'); }

function qualifiedUrl() {
  if (!DATABASE_URL) fail('DATABASE_URL is required');
  let url;
  try { url = new URL(DATABASE_URL); } catch { fail('DATABASE_URL must be valid'); }
  if (!LOCAL_HOSTS.has(url.hostname)) fail(`database host ${url.hostname} is not loopback`);
  const dbName = decodeURIComponent(url.pathname.slice(1));
  if (!dbName.startsWith(PREFIX) || !/^consultify_w3_audits_owner_[a-z0-9_]+$/.test(dbName)) {
    fail(`database name must match ${PREFIX}[a-z0-9_]+`);
  }
  if (!['provision', 'seed', 'readback', 'reset', 'drop'].includes(COMMAND)) fail(`unknown command ${COMMAND}`);
  if (MUTATING.has(COMMAND) && CONFIRM !== 'YES') fail(`${COMMAND} requires AUD_OWNER_FIXTURE_CONFIRM=YES`);
  if (COMMAND === 'seed') {
    if (!MANIFEST_PATH) fail('seed requires AUD_OWNER_FIXTURE_MANIFEST pointing to a new file');
    if (existsSync(MANIFEST_PATH)) fail('AUD_OWNER_FIXTURE_MANIFEST exists; refusing overwrite');
  }
  return { url, dbName };
}

async function maintenance(url) {
  const adminUrl = new URL(url); adminUrl.pathname = '/postgres';
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect(); return client;
}

async function provision(url, dbName) {
  const admin = await maintenance(url);
  try {
    const template = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [TEMPLATE_DB]);
    if (!template.rowCount) fail(`fixed local template ${TEMPLATE_DB} is absent`);
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [dbName]);
    if (exists.rowCount) fail('database already exists');
    await admin.query(`CREATE DATABASE ${dbName} TEMPLATE ${TEMPLATE_DB}`);
  } finally { await admin.end(); }
  for (const migration of [
    'server/migrations/20260813_audits_method_core.sql',
    'server/migrations/20260813b_audits_source_classification_split.sql',
  ]) {
    const result = spawnSync('/opt/homebrew/opt/postgresql@15/bin/psql', ['-v', 'ON_ERROR_STOP=1', '-d', url.toString(), '-f', migration], {
      cwd: process.cwd(), stdio: 'inherit', env: { ...process.env, PGPASSWORD: url.password },
    });
    if (result.status !== 0) fail(`Audits schema migration failed: ${migration}`);
  }
  console.log(JSON.stringify({ command: 'provision', database: dbName, template: TEMPLATE_DB, auditMigrations: 2 }));
}

async function reset(client) {
  await client.query('BEGIN');
  try {
    for (const table of ['audit_initiative_proposals','audit_reports','audit_corrective_actions','audit_program_findings','audit_evidence','audit_program_criteria','audit_program_members','audit_programs']) {
      await client.query(`DELETE FROM ${table} WHERE organization_id=ANY($1)`, [[IDS.org, IDS.foreignOrg]]);
    }
    await client.query('DELETE FROM audit_pack_criteria WHERE pack_id=$1', [IDS.pack]);
    await client.query('DELETE FROM audit_packs WHERE organization_id=ANY($1)', [[IDS.org, IDS.foreignOrg]]);
    await client.query('DELETE FROM audit_norm_sources WHERE organization_id=ANY($1)', [[IDS.org, IDS.foreignOrg]]);
    await client.query('DELETE FROM organization_members WHERE organization_id=ANY($1)', [[IDS.org, IDS.foreignOrg]]);
    await client.query('DELETE FROM users WHERE id=ANY($1)', [[IDS.owner,IDS.lead,IDS.auditee,IDS.reviewer,IDS.actionOwner,IDS.revoked,IDS.foreignOwner]]);
    await client.query('DELETE FROM organizations WHERE id=ANY($1)', [[IDS.org, IDS.foreignOrg]]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}

async function seed(client) {
  const existing = await client.query('SELECT count(*)::int n FROM audit_programs WHERE id=$1 AND organization_id=$2', [IDS.program, IDS.org]);
  if (existing.rows[0].n === 1) return persist(await readback(client, false));
  if (!PASSWORD || PASSWORD.length < 12) fail('first seed requires AUD_OWNER_FIXTURE_PASSWORD of at least 12 characters');
  await reset(client);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await client.query('BEGIN');
  try {
    await client.query(`INSERT INTO organizations(id,name,plan,status) VALUES ($1,'Wave 3 Audits Owner Review','enterprise','active'),($2,'Wave 3 Audits Foreign Boundary','enterprise','active')`, [IDS.org, IDS.foreignOrg]);
    const users = [
      [IDS.owner,IDS.org,'w3.aud.owner@local.test','ADMIN'], [IDS.lead,IDS.org,'w3.aud.lead@local.test','USER'],
      [IDS.auditee,IDS.org,'w3.aud.auditee@local.test','USER'], [IDS.reviewer,IDS.org,'w3.aud.reviewer@local.test','USER'],
      [IDS.actionOwner,IDS.org,'w3.aud.action@local.test','USER'], [IDS.revoked,IDS.org,'w3.aud.revoked@local.test','USER'],
      [IDS.foreignOwner,IDS.foreignOrg,'w3.aud.foreign@local.test','OWNER'],
    ];
    for (const [id,org,email,role] of users) await client.query(`INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,$4,$5,'active')`, [id,org,email,passwordHash,role]);
    for (const [id,org,user,role,status] of users.map(([id,org,,role])=>[`membership-${id}`,org,id,role==='ADMIN'?'ADMIN':role==='OWNER'?'OWNER':'MEMBER',id===IDS.revoked?'INACTIVE':'ACTIVE'])) {
      await client.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,$4,$5)`, [id,org,user,role,status]);
    }
    await client.query(`INSERT INTO audit_norm_sources(id,organization_id,source_key,title,source_kind,rights_status,rights_note,verification_status,source_type,verification_state,created_by)
      VALUES($1,$2,'transformation-audit-internal-v1','Internal transformation operating procedure','internal_procedure','owned_internal','Consultify-authored; no external licensed content','INTERNAL_FRAMEWORK','INTERNAL_FRAMEWORK','VERIFIED',$3)`, [IDS.source,IDS.org,IDS.owner]);
    await client.query(`INSERT INTO audit_packs(id,organization_id,pack_key,version,title,summary,source_id,classification,publication_status,scope,objectives,required_roles,finding_taxonomy,source_type,verification_state,expert_approved_by,expert_approved_at,published_by,published_at,created_by)
      VALUES($1,$2,'transformation-audit-pack-internal',1,$3,'Internal owner-review pack',$4,'INTERNAL_FRAMEWORK','published','Internal transformation governance','Test evidence traceability and independent review',$5,$6,'INTERNAL_FRAMEWORK','VERIFIED',$7,'2026-08-21T08:00:00Z',$7,'2026-08-21T08:05:00Z',$7)`, [IDS.pack,IDS.org,PACK_TITLE,IDS.source,JSON.stringify(['program_owner','lead_auditor','auditee','reviewer','action_owner']),JSON.stringify([{key:'nonconforming',label:'Internal gap',nonConforming:true,requiresCorrectiveAction:true}]),IDS.owner]);
    await client.query(`INSERT INTO audit_pack_criteria(id,pack_id,ordinal,ref_code,node_kind,title,requirement_text,source_reference,audit_question,expected_evidence,audit_procedure,mandatory)
      VALUES($1,$2,1,'TA.1','criterion','Decision evidence and independent review',$3,'Internal transformation procedure, section TA.1','Is every sampled decision supported by dated evidence and independent review?',$4,'Sample 12 internal decisions and inspect evidence plus reviewer identity',true)`, [IDS.packCriterion,IDS.pack,REQUIREMENT,JSON.stringify([{kind:'document',description:'Internal decision register',mandatory:true}])]);
    await client.query(`INSERT INTO audit_programs(id,organization_id,name,objective,status,created_by,pack_id,pack_key,pack_version,lifecycle_state,scope_text,criteria_snapshot_at,program_owner_id,lead_auditor_id,kernel_session_state)
      VALUES($1,$2,'Transformation governance audit — owner review','Verify internal decision evidence and independent review','active',$3,$4,'transformation-audit-pack-internal',1,'findings_review','Internal steering decisions; synthetic local data only','2026-08-21T08:10:00Z',$3,$5,'in_review')`, [IDS.program,IDS.org,IDS.owner,IDS.pack,IDS.lead]);
    for (const [user,role,independent] of [[IDS.owner,'program_owner',true],[IDS.lead,'lead_auditor',true],[IDS.auditee,'auditee',false],[IDS.reviewer,'reviewer',true],[IDS.actionOwner,'action_owner',false]]) {
      await client.query(`INSERT INTO audit_program_members(id,program_id,organization_id,user_id,member_role,independence_declared,assigned_by) VALUES($1,$2,$3,$4,$5,$6,$7)`, [`aud-member-${role}`,IDS.program,IDS.org,user,role,independent,IDS.owner]);
    }
    await client.query(`INSERT INTO audit_program_criteria(id,program_id,organization_id,pack_criterion_id,ordinal,ref_code,node_kind,title,requirement_text,source_reference,audit_question,expected_evidence,audit_procedure,assigned_auditor_id,assigned_auditee_id,procedure_performed,sample_description,test_performed,test_result,auditor_note,auditor_conclusion,conformity_status,concluded_by,concluded_at,work_status)
      VALUES($1,$2,$3,$4,1,'TA.1','criterion','Decision evidence and independent review',$5,'Internal transformation procedure, section TA.1','Is every sampled decision supported?',$6,'Sample 12 internal decisions',$7,$8,'Inspected decision register and reviewer records','12 internal transformation decisions','Evidence and identity comparison','fail','3 records lacked dated independent review','The internal control is not consistently met','nonconforming',$7,'2026-08-21T09:00:00Z','concluded')`, [IDS.criterion,IDS.program,IDS.org,IDS.packCriterion,REQUIREMENT,JSON.stringify([{kind:'document',description:'Internal decision register',mandatory:true}]),IDS.lead,IDS.auditee]);
    await client.query(`INSERT INTO audit_evidence(id,program_id,organization_id,criterion_id,evidence_kind,title,description,content_snapshot,content_hash,source_system,provided_by,provided_at,captured_by,sufficiency,reliability,currency_status,supports_conformity,review_note,accepted,accepted_by,accepted_at)
      VALUES($1,$2,$3,$4,'document','Internal steering decision register — synthetic sample',$5,$5,$6,'fixture-local',$7,'2026-08-21T08:30:00Z',$8,'sufficient','reliable','current',false,'Accepted as evidence of the internal gap',true,$8,'2026-08-21T08:45:00Z')`, [IDS.evidence,IDS.program,IDS.org,IDS.criterion,EVIDENCE_TEXT,hash(EVIDENCE_TEXT),IDS.auditee,IDS.lead]);
    await client.query(`INSERT INTO audit_program_findings(id,program_id,organization_id,criterion_id,reference_code,statement,requirement_text,condition_text,source_reference,gap_text,objective_evidence,classification,severity,risk_text,recommendation,status,owner_user_id,author_id,reviewed_by,reviewed_at,review_note)
      VALUES($1,$2,$3,$4,'AUD-001','Independent review records are incomplete',$5,$6,'Internal transformation procedure, section TA.1','3 of 12 sampled decisions lack a dated independent review record',$7,'nonconforming','medium','Decision accountability cannot be reconstructed','Add a mandatory independent-review checkpoint','confirmed',$8,$9,$10,'2026-08-21T09:15:00Z','Confirmed by a reviewer distinct from author, auditee and action owner')`, [IDS.finding,IDS.program,IDS.org,IDS.criterion,REQUIREMENT,EVIDENCE_TEXT,JSON.stringify([IDS.evidence]),IDS.auditee,IDS.lead,IDS.reviewer]);
    await client.query(`INSERT INTO audit_corrective_actions(id,finding_id,program_id,organization_id,action_kind,title,description,owner_user_id,due_date,priority,status,approved_by,approved_at,created_by)
      VALUES($1,$2,$3,$4,'corrective_action','Require dated independent-review record','Add a workflow checkpoint without changing external standards policy',$5,'2026-10-15','medium','approved',$6,'2026-08-21T09:30:00Z',$7)`, [IDS.action,IDS.finding,IDS.program,IDS.org,IDS.actionOwner,IDS.reviewer,IDS.auditee]);
    const reportPayload = { schemaVersion:'aud-owner-v1', programId:IDS.program, findingIds:[IDS.finding], internalOnly:true };
    await client.query(`INSERT INTO audit_reports(id,program_id,organization_id,version,report_kind,title,status,payload,content_hash,language,audience,confidentiality,generated_at,created_by)
      VALUES($1,$2,$3,1,'audit_report','Transformation governance audit — draft owner report','draft',$4,$5,'en','internal owner review','internal','2026-08-21T09:40:00Z',$6)`, [IDS.report,IDS.program,IDS.org,JSON.stringify(reportPayload),hash(JSON.stringify(reportPayload)),IDS.lead]);
    await client.query(`INSERT INTO audit_initiative_proposals(id,program_id,organization_id,title,problem_statement,systemic_cause,intended_outcome,scope,priority,proposed_owner_id,timeframe,success_measures,source_finding_ids,verification_link,confidence,status,created_by)
      VALUES($1,$2,$3,'Independent review checkpoint','Three sampled decisions lacked dated independent review','Review is not a mandatory workflow step','Every internal transformation decision has a distinct dated reviewer','Internal workflow only','medium',$4,'Q4 2026',$5,$6,$7,0.85,'draft',$8)`, [IDS.proposal,IDS.program,IDS.org,IDS.actionOwner,JSON.stringify(['100% sampled decisions have a dated independent reviewer']),JSON.stringify([IDS.finding]),`/audit-programs/${IDS.program}?findingId=${IDS.finding}`,IDS.lead]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  return persist(await readback(client, false));
}

async function readback(client, emit = true) {
  const result = await client.query(`SELECT p.id program_id,p.lifecycle_state,p.pack_id,pk.title pack_title,pk.source_type,pk.verification_state,s.rights_status,
    c.id criterion_id,e.id evidence_id,e.content_hash,f.id finding_id,f.status finding_status,f.author_id,f.reviewed_by,f.owner_user_id,
    a.id action_id,a.status action_status,a.owner_user_id action_owner,a.approved_by,r.id report_id,r.status report_status,r.content_hash report_hash,
    ip.id proposal_id,ip.status proposal_status,ip.source_finding_ids
    FROM audit_programs p JOIN audit_packs pk ON pk.id=p.pack_id JOIN audit_norm_sources s ON s.id=pk.source_id
    JOIN audit_program_criteria c ON c.program_id=p.id JOIN audit_evidence e ON e.criterion_id=c.id
    JOIN audit_program_findings f ON f.criterion_id=c.id JOIN audit_corrective_actions a ON a.finding_id=f.id
    JOIN audit_reports r ON r.program_id=p.id JOIN audit_initiative_proposals ip ON ip.program_id=p.id
    WHERE p.organization_id=$1 AND p.id=$2`, [IDS.org, IDS.program]);
  if (result.rowCount !== 1) fail(`expected one complete chain, found ${result.rowCount}`);
  const row = result.rows[0];
  const members = await client.query(`SELECT user_id,member_role,independence_declared FROM audit_program_members WHERE organization_id=$1 AND program_id=$2 ORDER BY member_role`, [IDS.org,IDS.program]);
  const personas = await client.query(`SELECT u.id,u.organization_id,m.role,m.status FROM users u JOIN organization_members m ON m.user_id=u.id AND m.organization_id=u.organization_id WHERE u.id=ANY($1) ORDER BY u.id`, [[IDS.owner,IDS.lead,IDS.auditee,IDS.reviewer,IDS.actionOwner,IDS.revoked,IDS.foreignOwner]]);
  const manifest = { schemaVersion:'w3-audits-owner-v1', deepLinks:{ program:`/audit-programs/${IDS.program}`, finding:`/audit-programs/${IDS.program}?findingId=${IDS.finding}` }, deepLinkVerified:false, providerMode:'none-internal-fixture-only', policy:{ externalNamedStandards:'OFF', methodologyRightsDecision:'PENDING', ownerGate:'PENDING' }, ids:{...IDS}, expected:{ lifecycleState:row.lifecycle_state, packTitle:row.pack_title, sourceType:row.source_type, verificationState:row.verification_state, rightsStatus:row.rights_status, evidenceHash:row.content_hash, findingStatus:row.finding_status, actionStatus:row.action_status, reportStatus:row.report_status, reportHash:row.report_hash, proposalStatus:row.proposal_status, counts:{members:members.rowCount,citations:0,liveProviderCalls:0} }, sod:{findingAuthor:row.author_id,independentReviewer:row.reviewed_by,findingOwner:row.owner_user_id,actionOwner:row.action_owner,actionApprover:row.approved_by}, members:members.rows, personas:personas.rows };
  const sourceFindings = typeof row.source_finding_ids === 'string' ? JSON.parse(row.source_finding_ids) : row.source_finding_ids;
  if (BANNED.test(JSON.stringify(manifest)) || row.pack_title !== PACK_TITLE || row.source_type !== 'INTERNAL_FRAMEWORK' || row.rights_status !== 'owned_internal' || row.finding_status !== 'confirmed' || row.action_status !== 'approved' || row.report_status !== 'draft' || row.proposal_status !== 'draft' || row.content_hash !== hash(EVIDENCE_TEXT) || !sourceFindings.includes(IDS.finding) || members.rowCount !== 5 || row.author_id === row.reviewed_by || row.reviewed_by === row.owner_user_id || row.reviewed_by === row.action_owner || row.action_owner === row.approved_by) fail('canonical readback / SoD / internal-rights validation failed');
  if (emit) console.log(JSON.stringify(manifest,null,2));
  return manifest;
}

function persist(manifest) {
  const serialized = `${JSON.stringify(manifest,null,2)}\n`;
  if ((DATABASE_URL && serialized.includes(DATABASE_URL)) || (PASSWORD && serialized.includes(PASSWORD)) || /postgres(?:ql)?:\/\//i.test(serialized)) fail('manifest secret scan failed');
  try { writeFileSync(MANIFEST_PATH, serialized, { flag:'wx', mode:0o600 }); }
  catch (error) { if (error?.code === 'EEXIST') fail('AUD_OWNER_FIXTURE_MANIFEST exists; refusing overwrite'); throw error; }
  const mode = statSync(MANIFEST_PATH).mode & 0o777;
  if (mode !== 0o600) fail(`manifest mode must be 0600, got 0${mode.toString(8)}`);
  console.log(JSON.stringify(manifest,null,2)); return manifest;
}

async function drop(url, dbName) {
  const admin=await maintenance(url); try { await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[dbName]); await admin.query(`DROP DATABASE IF EXISTS ${dbName}`); const r=await admin.query('SELECT count(*)::int n FROM pg_database WHERE datname=$1',[dbName]); if(r.rows[0].n!==0) fail('catalog absence failed'); console.log(JSON.stringify({command:'drop',database:dbName,catalogMatches:0})); } finally { await admin.end(); }
}

async function main() {
  const {url,dbName}=qualifiedUrl(); if(COMMAND==='provision') return provision(url,dbName); if(COMMAND==='drop') return drop(url,dbName);
  const client=new pg.Client({connectionString:url.toString()}); await client.connect(); try { if(COMMAND==='seed') await seed(client); else if(COMMAND==='reset'){await reset(client);console.log(JSON.stringify({command:'reset',fixtureRows:0}));} else await readback(client); } finally { await client.end(); }
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exit(1);});
