#!/usr/bin/env node
/** Wave 3 / module 06 Execution deterministic local owner fixture.
 * Commands: provision|seed|readback|reset|drop. Mutations require
 * EXE_OWNER_FIXTURE_CONFIRM=YES and exact loopback DB
 * `consultify_w3_execution_owner_*`. Seed requires a new wx/0600 manifest.
 * No cw-local/shared DB, browser, remote provider or production runtime.
 */
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const COMMAND = process.argv[2] || 'readback',
  DATABASE_URL = process.env.DATABASE_URL || '',
  CONFIRM = process.env.EXE_OWNER_FIXTURE_CONFIRM,
  PASSWORD = process.env.EXE_OWNER_FIXTURE_PASSWORD,
  MANIFEST_PATH = process.env.EXE_OWNER_FIXTURE_MANIFEST || '';
const PREFIX = 'consultify_w3_execution_owner_',
  FIXTURE_ID = 'W3-EXECUTION-OWNER-v1',
  FIXTURE_NAME = 'wave3-execution-owner-review-v1',
  LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']),
  MUTATING = new Set(['provision', 'seed', 'reset', 'drop']);
const IDS = Object.freeze({
  org: 'w3-exe-owner-org-v1',
  foreignOrg: 'w3-exe-foreign-org-v1',
  owner: 'w3-exe-owner-user-v1',
  admin: 'w3-exe-admin-user-v1',
  member: 'w3-exe-member-user-v1',
  approver: 'w3-exe-approver-user-v1',
  revoked: 'w3-exe-revoked-user-v1',
  foreignOwner: 'w3-exe-foreign-owner-v1',
  project: 'w3-exe-project-v1',
  initiative: 'w3-exe-initiative-v1',
  case: 'w3-exe-case-v1',
  handoff: 'w3-exe-handoff-v1',
  artifact: 'w3-exe-artifact-v1',
  budget: 'w3-exe-budget-v1',
  intakeKey: 'w3-exe-intake-v1',
  evidenceKey: 'w3-exe-evidence-v1',
  signalKey: 'w3-exe-signal-v1',
  v8Flag: 'w3-exe-owner-v8-workspace-v1',
});
const DIGEST = createHash('sha256')
  .update('Owner-review delivery evidence: pilot completed within approved PLN 120000 budget.')
  .digest('hex');
function fail(m) {
  throw new Error(`[W3-EXE fixture] BLOCKED: ${m}`);
}
function qualified() {
  if (!DATABASE_URL) fail('DATABASE_URL is required');
  let u;
  try {
    u = new URL(DATABASE_URL);
  } catch {
    fail('DATABASE_URL must be valid');
  }
  if (!LOCAL_HOSTS.has(u.hostname)) fail('database host must be loopback');
  const db = decodeURIComponent(u.pathname.slice(1));
  if (!db.startsWith(PREFIX) || !/^consultify_w3_execution_owner_[a-z0-9_]+$/.test(db))
    fail(`database name must match ${PREFIX}[a-z0-9_]+`);
  if (!['provision', 'seed', 'readback', 'reset', 'drop'].includes(COMMAND))
    fail(`unknown command ${COMMAND}`);
  if (MUTATING.has(COMMAND) && CONFIRM !== 'YES')
    fail(`${COMMAND} requires EXE_OWNER_FIXTURE_CONFIRM=YES`);
  if (COMMAND === 'seed') {
    if (!MANIFEST_PATH) fail('seed requires EXE_OWNER_FIXTURE_MANIFEST pointing to a new file');
    if (existsSync(MANIFEST_PATH)) fail('EXE_OWNER_FIXTURE_MANIFEST exists; refusing overwrite');
  }
  return { u, db };
}
async function maintenance(u) {
  const a = new URL(u);
  a.pathname = '/postgres';
  const c = new pg.Client({ connectionString: a.toString() });
  await c.connect();
  return c;
}
async function provision(u, db) {
  const a = await maintenance(u);
  try {
    if ((await a.query('SELECT 1 FROM pg_database WHERE datname=$1', [db])).rowCount)
      fail('database already exists');
    await a.query(`CREATE DATABASE ${db}`);
  } finally {
    await a.end();
  }
  const migrated=spawnSync('npm',['run','db:migrate:strict'],{cwd:process.cwd(),stdio:'inherit',env:{...process.env,DATABASE_URL:u.toString(),DB_TYPE:'postgres',NODE_ENV:'test'}});
  if(migrated.status!==0){const cleanup=await maintenance(u);try{await cleanup.query(`DROP DATABASE ${db}`);}finally{await cleanup.end();}fail('exact strict migration chain failed; new database removed');}
  console.log(JSON.stringify({command:'provision',database:db,migrationMode:'exact-current-strict'}));
}
async function reset(c) {
  const immutableReceipts = await c.query(
    'SELECT count(*)::int n FROM rvn_execution_signal_receipts WHERE organization_id=ANY($1)',
    [[IDS.org, IDS.foreignOrg]]
  );
  if (immutableReceipts.rows[0].n !== 0)
    fail('immutable Results receipts exist; preserve ledger and use manifest-bound drop + provision');
  await c.query('BEGIN');
  try {
    await c.query('DELETE FROM v8.v8_feature_flags WHERE flag_id=$1', [IDS.v8Flag]);
    await c.query(
      `DELETE FROM ie_aggregate_relations WHERE organization_id=$1
       AND (source_id=ANY($2) OR target_id=ANY($2))`,
      [IDS.org, [IDS.initiative, IDS.case, IDS.handoff]]
    );
    await c.query(
      `DELETE FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=ANY($2)`,
      [IDS.org, [IDS.initiative, IDS.case, IDS.handoff]]
    );
    for (const t of [
      'execution_results_signal_outbox',
      'execution_delivery_evidence',
      'execution_action_audit',
      'execution_link_reopen_receipts',
      'execution_identity_aliases',
      'execution_case_links',
    ])
      await c.query(`DELETE FROM ${t} WHERE organization_id=ANY($1)`, [[IDS.org, IDS.foreignOrg]]);
    await c.query('DELETE FROM case_workspace_artifact_links WHERE organization_id=ANY($1)', [
      [IDS.org, IDS.foreignOrg],
    ]);
    await c.query('DELETE FROM case_core WHERE organization_id=ANY($1)', [
      [IDS.org, IDS.foreignOrg],
    ]);
    await c.query('DELETE FROM budget_entries WHERE organization_id=ANY($1)', [
      [IDS.org, IDS.foreignOrg],
    ]);
    await c.query('DELETE FROM initiatives WHERE organization_id=ANY($1)', [
      [IDS.org, IDS.foreignOrg],
    ]);
    await c.query('DELETE FROM projects WHERE organization_id=ANY($1)', [
      [IDS.org, IDS.foreignOrg],
    ]);
    await c.query('DELETE FROM organization_members WHERE organization_id=ANY($1)', [
      [IDS.org, IDS.foreignOrg],
    ]);
    await c.query('DELETE FROM users WHERE id=ANY($1)', [
      [IDS.owner, IDS.admin, IDS.member, IDS.approver, IDS.revoked, IDS.foreignOwner],
    ]);
    await c.query('DELETE FROM organizations WHERE id=ANY($1)', [[IDS.org, IDS.foreignOrg]]);
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  }
}
async function seed(c) {
  await c.query(`CREATE TABLE IF NOT EXISTS wave3_owner_fixture_markers(fixture_id text PRIMARY KEY,ownership_nonce text NOT NULL,database_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`);
  const databaseName=qualified().db;
  const ownership=await c.query('SELECT ownership_nonce,database_name FROM wave3_owner_fixture_markers WHERE fixture_id=$1',[FIXTURE_ID]);
  if(ownership.rowCount&&ownership.rows[0].database_name!==databaseName) fail('durable marker database mismatch');
  if(!ownership.rowCount) await c.query('INSERT INTO wave3_owner_fixture_markers VALUES($1,$2,$3,now())',[FIXTURE_ID,randomBytes(32).toString('hex'),databaseName]);
  const e = await c.query(
    'SELECT count(*)::int n FROM execution_case_links WHERE organization_id=$1 AND intake_idempotency_key=$2',
    [IDS.org, IDS.intakeKey]
  );
  if (e.rows[0].n === 1) return persist(await readback(c, false));
  if (!PASSWORD || PASSWORD.length < 12)
    fail('first seed requires EXE_OWNER_FIXTURE_PASSWORD of at least 12 characters');
  await reset(c);
  const ph = await bcrypt.hash(PASSWORD, 10);
  await c.query('BEGIN');
  try {
    await c.query(
      `INSERT INTO organizations(id,name,plan,status) VALUES($1,'Wave 3 Execution Owner Review','enterprise','active'),($2,'Wave 3 Execution Foreign Boundary','enterprise','active')`,
      [IDS.org, IDS.foreignOrg]
    );
    for (const [id, org, email, role, status] of [
      [IDS.owner, IDS.org, 'w3.exe.owner@local.test', 'OWNER', 'ACTIVE'],
      [IDS.admin, IDS.org, 'w3.exe.admin@local.test', 'ADMIN', 'ACTIVE'],
      [IDS.member, IDS.org, 'w3.exe.member@local.test', 'USER', 'ACTIVE'],
      [IDS.approver, IDS.org, 'w3.exe.approver@local.test', 'ADMIN', 'ACTIVE'],
      [IDS.revoked, IDS.org, 'w3.exe.revoked@local.test', 'USER', 'INACTIVE'],
      [IDS.foreignOwner, IDS.foreignOrg, 'w3.exe.foreign@local.test', 'OWNER', 'ACTIVE'],
    ]) {
      await c.query(
        `INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,$4,$5,'active')`,
        [id, org, email, ph, role]
      );
      await c.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,$4,$5)`,
        [`membership-${id}`, org, id, role === 'USER' ? 'MEMBER' : role, status]
      );
    }
    await c.query(
      `INSERT INTO projects(id,organization_id,name,status) VALUES($1,$2,'Customer pilot execution','active')`,
      [IDS.project, IDS.org]
    );
    await c.query(
      `INSERT INTO initiatives(id,organization_id,project_id,name,status,owner_execution_id,planned_budget_total,actual_budget_total,budget_currency,created_by) VALUES($1,$2,$3,'Launch customer pilot','EXECUTING',$4,120000,40000,'PLN',$4)`,
      [IDS.initiative, IDS.org, IDS.project, IDS.owner]
    );
    await c.query(
      `INSERT INTO case_core(case_id,organization_id,project_id,case_name,contracted_closure_type,created_by_actor_id,case_status) VALUES($1,$2,$3,'Customer pilot execution case','DELIVERY_COMPLETED',$4,'ACTIVE')`,
      [IDS.case, IDS.org, IDS.project, IDS.owner]
    );
    await c.query(
      `INSERT INTO case_workspace_artifact_links(link_id,organization_id,project_id,case_id,artifact_type,artifact_id,artifact_revision,relation,linked_by_actor_id,linked_at) VALUES($1,$2,$3,$4,'document','w3-exe-evidence-document-v1','r1','DELIVERABLE',$5,now()::text)`,
      [IDS.artifact, IDS.org, IDS.project, IDS.case, IDS.member]
    );
    await c.query(
      `INSERT INTO budget_entries(id,organization_id,initiative_id,entry_type,cost_type,category,amount,currency,description,period_month,period_year,source,created_by,version) VALUES($1,$2,$3,'ACTUAL','OPEX','Pilot delivery',40000,'PLN','Approved pilot execution cost',9,2026,'manual',$4,1)`,
      [IDS.budget, IDS.org, IDS.initiative, IDS.admin]
    );
    await c.query(
      `INSERT INTO v8.v8_feature_flags(flag_id,organization_id,module,enabled,updated_by)
       VALUES($1,$2,'workspace',1,$3)`,
      [IDS.v8Flag, IDS.org, IDS.owner]
    );
    await c.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES
       ($1,'initiative',$2,3,$3::jsonb),
       ($1,'handoff_package',$4,1,$5::jsonb),
       ($1,'execution_case',$6,1,$7::jsonb)`,
      [
        IDS.org,
        IDS.initiative,
        JSON.stringify({
          initiativeId: IDS.initiative,
          projectId: IDS.project,
          title: 'Customer pilot delivery',
          problem: 'Deliver the approved customer pilot within the committed budget.',
          proposedOutcome: 'Pilot accepted with traceable evidence and Results lineage.',
          initiativeOwnerId: IDS.owner,
          lifecycleState: 'EXECUTING',
          handoffPackageId: IDS.handoff,
          executionState: 'ACTIVE',
          executionCaseId: IDS.case,
        }),
        IDS.handoff,
        JSON.stringify({
          handoffPackageId: IDS.handoff,
          version: 1,
          initiativeId: IDS.initiative,
          executionManagerId: IDS.owner,
          snapshot: {
            scope: {
              problem: 'Deliver the approved customer pilot within the committed budget.',
              outcome: 'Customer pilot delivery',
            },
            baseline: { milestones: { acceptance: 'Customer acceptance review' } },
            sourceVersions: { initiative: 3 },
          },
          createdAt: '2026-08-22T00:00:00.000Z',
        }),
        IDS.case,
        JSON.stringify({
          executionCaseId: IDS.case,
          initiativeId: IDS.initiative,
          projectId: IDS.project,
          state: 'ACTIVE',
          executionManagerId: IDS.owner,
          handoffPackageId: IDS.handoff,
          handoffPackageVersion: 1,
          acceptedBaseline: {
            scope: {
              problem: 'Deliver the approved customer pilot within the committed budget.',
              outcome: 'Customer pilot delivery',
            },
            baseline: { milestones: { acceptance: 'Customer acceptance review' } },
            sourceVersions: { initiative: 3 },
          },
          gaps: [],
          acceptedAt: '2026-08-22T00:00:00.000Z',
        }),
      ]
    );
    await c.query(
      `INSERT INTO ie_aggregate_relations
       (organization_id,relation_type,source_type,source_id,source_version,target_type,target_id,payload_json)
       VALUES($1,'INITIATIVE_EXECUTION_CASE','initiative',$2,3,'execution_case',$3,$4::jsonb)`,
      [IDS.org, IDS.initiative, IDS.case, JSON.stringify({ status: 'ACCEPT' })]
    );
    await c.query('COMMIT');
  } catch (err) {
    await c.query('ROLLBACK');
    throw err;
  }
  process.env.NODE_ENV = 'test';
  process.env.RUN_DB_TESTS = '1';
  process.env.MOCK_DB = 'false';
  process.env.DB_TYPE = 'postgres';
  process.env.DOTENV_IGNORE_LOCAL = '1';
  const svc = await import('../../server/src/services/executionBvpService.ts');
  const ingress =
    await import('../../server/src/services/resultsVnext/platform/executionSignalIngress.ts');
  const link = await svc.linkInitiativeToExecutionCase({
    organizationId: IDS.org,
    initiativeId: IDS.initiative,
    caseId: IDS.case,
    actorId: IDS.owner,
    idempotencyKey: IDS.intakeKey,
  });
  const replay = await svc.linkInitiativeToExecutionCase({
    organizationId: IDS.org,
    initiativeId: IDS.initiative,
    caseId: IDS.case,
    actorId: IDS.owner,
    idempotencyKey: IDS.intakeKey,
  });
  if (replay.link_id !== link.link_id) fail('intake idempotency replay diverged');
  const spined = await svc.recordExecutionSpine({
    organizationId: IDS.org,
    linkId: link.link_id,
    workRef: 'action:customer-pilot-delivery',
    resourceRef: `budget:${IDS.budget}`,
    controlRef: 'governed-status:owner-admin',
    reportRef: 'report:customer-pilot-closure',
    expectedVersion: 1,
  });
  const ev = await svc.submitDeliveryEvidence({
    organizationId: IDS.org,
    linkId: link.link_id,
    artifactLinkId: IDS.artifact,
    contentDigest: DIGEST,
    submittedBy: IDS.member,
    idempotencyKey: IDS.evidenceKey,
  });
  const evReplay = await svc.submitDeliveryEvidence({
    organizationId: IDS.org,
    linkId: link.link_id,
    artifactLinkId: IDS.artifact,
    contentDigest: DIGEST,
    submittedBy: IDS.member,
    idempotencyKey: IDS.evidenceKey,
  });
  if (evReplay.evidence_id !== ev.evidence_id) fail('evidence idempotency replay diverged');
  const approved = await svc.approveDeliveryEvidence({
    organizationId: IDS.org,
    evidenceId: ev.evidence_id,
    approvedBy: IDS.approver,
    expectedVersion: 1,
  });
  const closed = await svc.closeExecutionAndEmitResultsSignal({
    organizationId: IDS.org,
    linkId: link.link_id,
    evidenceId: approved.evidence_id,
    expectedVersion: spined.version,
    idempotencyKey: IDS.signalKey,
  });
  const closeReplay = await svc.closeExecutionAndEmitResultsSignal({
    organizationId: IDS.org,
    linkId: link.link_id,
    evidenceId: approved.evidence_id,
    expectedVersion: spined.version,
    idempotencyKey: IDS.signalKey,
  });
  if (!closeReplay.replay || closeReplay.signalId !== closed.signalId)
    fail('closure idempotency replay diverged');
  const consumed = await ingress.consumeNextExecutionSignal({ organizationId: IDS.org });
  if (!consumed) fail('Results signal ingress did not produce receipt');
  return persist(await readback(c, false));
}
async function readback(c, emit = true) {
  const ownership=await c.query('SELECT ownership_nonce,database_name FROM wave3_owner_fixture_markers WHERE fixture_id=$1',[FIXTURE_ID]);
  if(ownership.rowCount!==1) fail('durable ownership marker absent or ambiguous');
  const r = await c.query(
    `SELECT e.status,e.version,e.work_ref,e.resource_ref,e.control_ref,e.report_ref,d.approval_status,d.content_digest,d.submitted_by,d.approved_by,s.delivery_status,s.attempt_count,s.payload_json,rr.source_initiative_id,rr.source_case_id,rr.observation_payload,b.amount,b.currency,b.version budget_version,i.status initiative_status,cc.case_status FROM execution_case_links e JOIN execution_delivery_evidence d ON d.execution_link_id=e.link_id JOIN execution_results_signal_outbox s ON s.execution_link_id=e.link_id JOIN rvn_execution_signal_receipts rr ON rr.source_signal_id=s.signal_id JOIN budget_entries b ON b.id=$3 JOIN initiatives i ON i.id=e.initiative_id JOIN case_core cc ON cc.case_id=e.case_id WHERE e.organization_id=$1 AND e.intake_idempotency_key=$2`,
    [IDS.org, IDS.intakeKey, IDS.budget]
  );
  if (r.rowCount !== 1) fail(`expected one complete execution lineage, found ${r.rowCount}`);
  const x = r.rows[0];
  const personas = await c.query(
    `SELECT u.id,u.organization_id,m.role,m.status FROM users u JOIN organization_members m ON m.user_id=u.id AND m.organization_id=u.organization_id WHERE u.id=ANY($1) ORDER BY u.id`,
    [[IDS.owner, IDS.admin, IDS.member, IDS.approver, IDS.revoked, IDS.foreignOwner]]
  );
  const v8Flag = await c.query(
    `SELECT enabled FROM v8.v8_feature_flags
     WHERE flag_id=$1 AND organization_id=$2 AND module='workspace'`,
    [IDS.v8Flag, IDS.org]
  );
  const canonicalCase = await c.query(
    `SELECT version,payload_json FROM ie_aggregate_state
     WHERE organization_id=$1 AND aggregate_type='execution_case' AND aggregate_id=$2`,
    [IDS.org, IDS.case]
  );
  const manifest = {
    schemaVersion: 'w3-execution-owner-v1',
    fixture: FIXTURE_NAME,
    fixtureId: FIXTURE_ID,
    ownershipState: 'FINAL',
    ownershipNonce: ownership.rows[0].ownership_nonce,
    databaseName: ownership.rows[0].database_name,
    marker: {table:'wave3_owner_fixture_markers',fixtureId:FIXTURE_ID,ownershipNonce:ownership.rows[0].ownership_nonce},
    deepLinks: { list: '/execution', case: `/execution/${IDS.case}` },
    deepLinkVerified: false,
    runtime: {
      database: 'disposable-local-only',
      sharedCwLocal: false,
      production: false,
      policyBoundariesPreserved: true,
      canonicalUiSeedMode: 'deterministic-accepted-snapshot',
    },
    ids: { ...IDS },
    expected: {
      initiativeStatus: x.initiative_status,
      caseStatus: x.case_status,
      executionStatus: x.status,
      executionVersion: x.version,
      workRef: x.work_ref,
      resourceRef: x.resource_ref,
      controlRef: x.control_ref,
      budget: { amount: Number(x.amount), currency: x.currency, version: x.budget_version },
      evidence: {
        status: x.approval_status,
        digest: x.content_digest,
        submittedBy: x.submitted_by,
        approvedBy: x.approved_by,
      },
        resultsLineage: {
          deliveryStatus: x.delivery_status,
          attemptCount: x.attempt_count,
          initiativeId: x.source_initiative_id,
          caseId: x.source_case_id,
          reportRef: x.observation_payload?.reportRef,
          evidenceLinked: typeof x.observation_payload?.evidenceId === 'string',
        },
    },
    personas: personas.rows,
  };
  if (
    x.status !== 'CLOSED' ||
    x.version !== 3 ||
    x.approval_status !== 'APPROVED' ||
    x.content_digest !== DIGEST ||
    x.submitted_by !== IDS.member ||
    x.approved_by !== IDS.approver ||
    x.delivery_status !== 'DELIVERED' ||
    Number(x.attempt_count) !== 1 ||
    x.source_initiative_id !== IDS.initiative ||
    x.source_case_id !== IDS.case ||
    Number(x.amount) !== 40000 ||
    x.currency !== 'PLN' ||
    x.resource_ref !== `budget:${IDS.budget}` ||
    personas.rowCount !== 6 ||
    v8Flag.rowCount !== 1 ||
    Number(v8Flag.rows[0].enabled) !== 1
    || canonicalCase.rowCount !== 1
    || canonicalCase.rows[0].payload_json?.state !== 'ACTIVE'
  )
    fail('canonical CAS/idempotency/Results lineage readback failed');
  if (emit) console.log(JSON.stringify(manifest, null, 2));
  return manifest;
}
function persist(m) {
  const s = `${JSON.stringify(m, null, 2)}\n`;
  if (
    (DATABASE_URL && s.includes(DATABASE_URL)) ||
    (PASSWORD && s.includes(PASSWORD)) ||
    /postgres(?:ql)?:\/\//i.test(s)
  )
    fail('manifest secret scan failed');
  try {
    writeFileSync(MANIFEST_PATH, s, { flag: 'wx', mode: 0o600 });
  } catch (e) {
    if (e?.code === 'EEXIST') fail('EXE_OWNER_FIXTURE_MANIFEST exists; refusing overwrite');
    throw e;
  }
  const mode = statSync(MANIFEST_PATH).mode & 0o777;
  if (mode !== 0o600) fail('manifest mode is not 0600');
  console.log(JSON.stringify(m, null, 2));
  return m;
}
async function drop(u, db) {
  if (
    !MANIFEST_PATH ||
    !existsSync(MANIFEST_PATH) ||
    (statSync(MANIFEST_PATH).mode & 0o777) !== 0o600
  )
    fail('drop requires exact existing 0600 manifest');
  const receipt = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  if (
    receipt.fixtureId !== FIXTURE_ID ||
    receipt.fixture !== FIXTURE_NAME ||
    receipt.ownershipState !== 'FINAL' ||
    receipt.databaseName !== db ||
    receipt.marker?.ownershipNonce !== receipt.ownershipNonce
  )
    fail('drop manifest ownership binding mismatch');
  const owned = new pg.Client({ connectionString: u.toString() });
  await owned.connect();
  try {
    const marker = await owned.query(
      `SELECT database_name FROM wave3_owner_fixture_markers
       WHERE fixture_id=$1 AND ownership_nonce=$2`,
      [FIXTURE_ID, receipt.ownershipNonce]
    );
    if (marker.rowCount !== 1 || marker.rows[0].database_name !== db)
      fail('drop durable marker mismatch');
  } finally {
    await owned.end();
  }
  const a = await maintenance(u);
  try {
    await a.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',
      [db]
    );
    await a.query(`DROP DATABASE IF EXISTS ${db}`);
    const r = await a.query('SELECT count(*)::int n FROM pg_database WHERE datname=$1', [db]);
    if (r.rows[0].n) fail('catalog absence failed');
    console.log(JSON.stringify({ command: 'drop', database: db, catalogMatches: 0 }));
  } finally {
    await a.end();
  }
}
async function main() {
  const { u, db } = qualified();
  if (COMMAND === 'provision') return provision(u, db);
  if (COMMAND === 'drop') return drop(u, db);
  const c = new pg.Client({ connectionString: u.toString() });
  await c.connect();
  try {
    if (COMMAND === 'seed') await seed(c);
    else if (COMMAND === 'reset') {
      await reset(c);
      console.log(JSON.stringify({ command: 'reset', fixtureRows: 0 }));
    } else await readback(c);
  } finally {
    await c.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
