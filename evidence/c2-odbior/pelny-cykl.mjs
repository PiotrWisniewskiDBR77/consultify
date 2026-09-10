// C2-ODBIÓR — pełny cykl na REALNYM nasłuchu HTTP (nie supertest):
// zakładam org/usera/projekt, tworzę inicjatywę ścieżką runtime-v1 (tą samą, którą woła kreator UI),
// po czym mierzę 7 powierzchni na 4231 (flaga ON) i 4241 (flaga OFF) dla TEGO SAMEGO rekordu.
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';

const orgId = randomUUID(), userId = randomUUID(), projectId = randomUUID();
const initiativeId = `initiative-${randomUUID()}`, proposalId = `proposal-${randomUUID()}`;
const title = `C2 ODBIOR ${randomUUID()}`;
const sql = new Client({ connectionString: process.env.DATABASE_URL });
await sql.connect();
await sql.query(`INSERT INTO organizations(id,name,status) VALUES($1,'C2 ODBIOR org','active')`, [orgId]);
await sql.query(`INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'local-only','OWNER','active')`, [userId, orgId, `${userId}@test.invalid`]);
await sql.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`, [randomUUID(), orgId, userId]);
await sql.query(`INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,'C2 ODBIOR project',$3)`, [projectId, orgId, userId]);
const token = jwt.sign({ id:userId, userId, email:`${userId}@test.invalid`, organizationId:orgId, organization_id:orgId, role:'OWNER' }, process.env.JWT_SECRET, { algorithm:'HS256', expiresIn:'20m' });
const H = { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' };
const post = async (port, path, body) => { const r = await fetch(`http://127.0.0.1:${port}${path}`, { method:'POST', headers:H, body:JSON.stringify(body) }); return { status:r.status, body:await r.text() }; };

const s1 = await post(4231, '/api/initiatives/runtime-v1/source-proposals', { proposalId, expectedVersion:0, clientRequestId:`s-${randomUUID()}`, sourceType:'MANUAL_HUB', sourceId:`manual-hub-${randomUUID()}`, sourceVersion:1, provenance:{ system:'consultify.initiatives-hub', recordType:'manual-initiative-proposal', capturedAt:new Date().toISOString(), evidenceRefs:[`consultify://initiatives/source-proposals/${proposalId}`] }, title, problem:'Dowod C2', proposedOutcome:null, priority:'MEDIUM', projectId, initiativeOwnerId:userId, visibility:'PROJECT' });
const s2 = await post(4231, '/api/initiatives/runtime-v1/registrations', { initiativeId, expectedVersion:0, clientRequestId:`r-${randomUUID()}`, proposalId, proposalVersion:1, sourceType:'MANUAL_HUB', sourceId:s1.body.match(/"sourceId":"([^"]+)"/)?.[1] || `manual-hub-fallback`, sourceVersion:1, title, problem:'Dowod C2', proposedOutcome:null, priority:'MEDIUM', projectId, visibility:'PROJECT', initiativeOwnerId:userId });
console.log(`TWORZENIE: proposal=${s1.status} registration=${s2.status}`);
if (s2.status !== 201) console.log('  body:', s2.body.slice(0,400));
const cnt = await sql.query(`SELECT (SELECT count(*)::int FROM ie_aggregate_state WHERE aggregate_type='initiative' AND aggregate_id=$1) kanon, (SELECT count(*)::int FROM initiatives WHERE id=$1) zastany`, [initiativeId]);
console.log('SQL:', JSON.stringify(cnt.rows[0]));

const routes = [['1 lista','/api/initiatives'],['2 karta',`/api/initiatives/${initiativeId}`],['3 KPI',`/api/initiatives/${initiativeId}/kpis`],['4 kokpit Realizacji',`/api/v8/execution-control/capacity/timeline?initiativeId=${initiativeId}`],['5 Moja Praca','/api/my-work/executive-analytics'],['6 Wyniki',`/api/v8/results/dashboard?initiativeId=${initiativeId}`],['7 raporty',`/api/report-builder/backlinks/initiative/${initiativeId}`]];
for (const port of [4231, 4241]) {
  console.log(`\n### ${port===4231?'ON (4231)':'OFF (4241)'} ###`);
  for (const [surface, route] of routes) {
    const r = await fetch(`http://127.0.0.1:${port}${route}`, { headers:{Authorization:H.Authorization} });
    const b = await r.text();
    const widoczny = surface==='3 KPI' ? (r.status===200 && !b.includes('INITIATIVE_NOT_FOUND')) : (r.status===200 && b.includes(title));
    console.log(`${surface.padEnd(20)} ${String(r.status).padStart(3)}  tytul=${b.includes(title)?'TAK':'NIE '} id=${b.includes(initiativeId)?'TAK':'NIE '}  WIDOCZNY=${widoczny?'TAK':'NIE'}  ${b.slice(0,90).replace(/\n/g,' ')}`);
  }
}
for (const t of ['ie_outbox_events','ie_audit_events','ie_command_receipts','ie_aggregate_state']) await sql.query(`DELETE FROM ${t} WHERE organization_id=$1`, [orgId]);
await sql.query(`DELETE FROM projects WHERE id=$1`,[projectId]);
await sql.query(`DELETE FROM organization_members WHERE organization_id=$1`,[orgId]);
await sql.query(`DELETE FROM users WHERE id=$1`,[userId]);
await sql.query(`DELETE FROM organizations WHERE id=$1`,[orgId]);
await sql.end();
console.log('\nSPRZATNIETE');
