#!/usr/bin/env node
/** Owned disposable successor for the retired shared cw-local fixture. */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import express from 'express';
import pg from 'pg';
import request from 'supertest';
const CMD = process.argv[2] || 'readback',
  DB = process.env.DATABASE_URL || '',
  YES = process.env.MYW_OWNER_FIXTURE_CONFIRM,
  PW = process.env.MYW_OWNER_FIXTURE_PASSWORD,
  MP = process.env.MYW_OWNER_FIXTURE_MANIFEST || '',
  PFX = 'consultify_w3_my_work_owner_',
  FIXTURE_ID = 'W3-MY-WORK-OWNER-v1';
const I = Object.freeze({
  org: 'w3-myw-owner-org-v2',
  foreignOrg: 'w3-myw-foreign-org-v2',
  owner: 'w3-myw-owner-user-v2',
  requester: 'w3-myw-requester-user-v2',
  member: 'w3-myw-member-user-v2',
  revoked: 'w3-myw-revoked-user-v2',
  foreign: 'w3-myw-foreign-user-v2',
  project: 'w3-myw-project-v2',
  task: 'w3-myw-task-v2',
  decision: 'w3-myw-decision-v2',
  plan: 'w3-myw-plan-v2',
  planStepSource: 'w3-myw-plan-step-source-v2',
  planStepApproval: 'w3-myw-plan-step-approval-v2',
  planStepMaterialize: 'w3-myw-plan-step-materialize-v2',
  key: 'w3-myw-proposal-v2',
});
let mounted = false;
function fail(m) {
  throw new Error(`[W3-MYW owned fixture] BLOCKED: ${m}`);
}
function qualify() {
  if (!DB) fail('DATABASE_URL required');
  let u;
  try {
    u = new URL(DB);
  } catch {
    fail('DATABASE_URL invalid');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(u.hostname)) fail('loopback DB required');
  const db = decodeURIComponent(u.pathname.slice(1));
  if (!db.startsWith(PFX) || !/^consultify_w3_my_work_owner_[a-z0-9_]+$/.test(db))
    fail(`DB must match ${PFX}[a-z0-9_]+`);
  if (!['provision', 'seed', 'readback', 'reset', 'drop'].includes(CMD))
    fail(`unknown command ${CMD}`);
  if (['provision', 'seed', 'reset', 'drop'].includes(CMD) && YES !== 'YES')
    fail(`${CMD} requires MYW_OWNER_FIXTURE_CONFIRM=YES`);
  if (CMD === 'seed' && (!MP || existsSync(MP)))
    fail(
      !MP ? 'seed requires new MYW_OWNER_FIXTURE_MANIFEST' : 'manifest exists; refusing overwrite'
    );
  return { u, db };
}
async function admin(u) {
  const a = new URL(u);
  a.pathname = '/postgres';
  const c = new pg.Client({ connectionString: a.toString() });
  await c.connect();
  return c;
}
async function provision(u, db) {
  const a = await admin(u);
  let created = false;
  try {
    if ((await a.query('select 1 from pg_database where datname=$1', [db])).rowCount)
      fail('database exists');
    await a.query(`create database ${db}`);
    created = true;
  } finally {
    await a.end();
  }
  const r = spawnSync('npm', ['run', 'db:migrate:strict'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: u.toString(), DB_TYPE: 'postgres', NODE_ENV: 'test' },
  });
  if (r.status) {
    if (created) {
      const cleanup = await admin(u);
      try {
        await cleanup.query(
          'select pg_terminate_backend(pid) from pg_stat_activity where datname=$1 and pid<>pg_backend_pid()',
          [db]
        );
        await cleanup.query(`drop database if exists ${db}`);
      } finally {
        await cleanup.end();
      }
    }
    fail('exact strict migration chain failed; new database removed');
  }
  const c = new pg.Client({ connectionString: u.toString() });
  await c.connect();
  try {
    const n = Number(
      (
        await c.query(
          "select count(*)::int n from schema_migrations where status in ('applied','success')"
        )
      ).rows[0].n
    );
    if (n !== 817) fail(`expected 817 successful migrations, got ${n}`);
  } finally {
    await c.end();
  }
  console.log(
    JSON.stringify({
      command: 'provision',
      database: db,
      migrations: 817,
      appendOnlyTriggers: 'ENABLED',
    })
  );
}
async function drop(u, db) {
  const a = await admin(u);
  try {
    await a.query(
      'select pg_terminate_backend(pid) from pg_stat_activity where datname=$1 and pid<>pg_backend_pid()',
      [db]
    );
    await a.query(`drop database if exists ${db}`);
    if ((await a.query('select count(*)::int n from pg_database where datname=$1', [db])).rows[0].n)
      fail('catalog absence failed');
    console.log(JSON.stringify({ command: 'drop', catalogMatches: 0 }));
  } finally {
    await a.end();
  }
}
async function reset(u, db) {
  await drop(u, db);
  await provision(u, db);
  console.log(
    JSON.stringify({
      command: 'reset',
      strategy: 'drop-reprovision',
      appendOnlyTriggersDisabled: false,
    })
  );
}
async function app() {
  process.env.NODE_ENV = 'test';
  process.env.RUN_DB_TESTS = '1';
  process.env.MOCK_DB = 'false';
  process.env.DB_TYPE = 'postgres';
  process.env.DOTENV_IGNORE_LOCAL = '1';
  const { default: r } =
    await import('../../server/src/routes/my-work/agent-materialization.routes.ts');
  mounted = true;
  const a = express();
  a.use(express.json());
  a.use((q, _s, n) => {
    const id = String(q.header('x-user') || ''),
      org = String(q.header('x-org') || I.org);
    q.userId = id;
    q.organizationId = org;
    q.user = { id, organizationId: org };
    n();
  });
  a.use('/api/my-work', r);
  a.use((e, _q, s, _n) =>
    s.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  );
  return a;
}
async function seed(c) {
  if (
    (
      await c.query(
        'select count(*)::int n from myw_agent_materialization_proposals where organization_id=$1 and idempotency_key=$2',
        [I.org, I.key]
      )
    ).rows[0].n === 1
  )
    return persist(await readback(c, false));
  if (!PW || PW.length < 12) fail('first seed requires password >=12');
  const ownershipNonce = randomBytes(32).toString('hex');
  const h = await bcrypt.hash(PW, 10);
  await c.query('begin');
  try {
    await c.query(
      'create table if not exists public.wave3_owner_fixture_markers(fixture_id text primary key,ownership_nonce text not null,database_name text not null)'
    );
    await c.query(
      'insert into public.wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name) values($1,$2,current_database())',
      [FIXTURE_ID, ownershipNonce]
    );
    await c.query(
      "insert into organizations(id,name,plan,status) values($1,'MYW owner review','enterprise','active'),($2,'MYW foreign','enterprise','active')",
      [I.org, I.foreignOrg]
    );
    for (const [id, org, role, status] of [
      [I.owner, I.org, 'OWNER', 'ACTIVE'],
      [I.requester, I.org, 'ADMIN', 'ACTIVE'],
      [I.member, I.org, 'USER', 'ACTIVE'],
      [I.revoked, I.org, 'USER', 'INACTIVE'],
      [I.foreign, I.foreignOrg, 'OWNER', 'ACTIVE'],
    ]) {
      await c.query(
        "insert into users(id,organization_id,email,password,role,status) values($1,$2,$1||'@local.test',$3,$4,'active')",
        [id, org, h, role]
      );
      await c.query(
        'insert into organization_members(id,organization_id,user_id,role,status) values($1,$2,$3,$4,$5)',
        [`m-${id}`, org, id, role === 'USER' ? 'MEMBER' : role, status]
      );
    }
    await c.query(
      "insert into projects(id,organization_id,name,status) values($1,$2,'Pilot','active')",
      [I.project, I.org]
    );
    await c.query(
      "insert into tasks(id,project_id,organization_id,title,status,priority,assignee_id,reporter_id,owner_id,task_type,idempotency_key,created_at,updated_at) values($1,$2,$3,'Review pilot','todo','high',$4,$5,$4,'personal','w3-myw-task-v2','2026-08-21T08:00:00Z','2026-08-21T08:00:00Z')",
      [I.task, I.project, I.org, I.owner, I.requester]
    );
    await c.query(
      "insert into decisions(id,organization_id,project_id,title,type,status,priority,decision_maker_id,decision_owner_id,created_by,source_type,source_id,idempotency_key) values($1,$2,$3,'Approve pilot','APPROVAL','pending','HIGH',$4,$4,$5,'my_work_owner_fixture',$6,'w3-myw-decision-v2')",
      [I.decision, I.org, I.project, I.owner, I.requester, I.task]
    );
    await c.query(
      "insert into ai_agent_plans(id,organization_id,user_id,title,status,total_steps,completed_steps,current_step_index,plan_json,created_at,updated_at) values($1,$2,$3,'Prepare pilot','planning',3,1,1,$4,'2026-08-21T08:05:00Z','2026-08-21T08:05:00Z')",
      [
        I.plan,
        I.org,
        I.requester,
        JSON.stringify([
          { title: 'Capture governed source', status: 'completed' },
          { title: 'Independent approval', status: 'awaiting_approval' },
          { title: 'Materialize canonical task', status: 'pending' },
        ]),
      ]
    );
    for (const [id, index, toolName, status, requiresApproval] of [
      [I.planStepSource, 0, 'capture_governed_source', 'completed', false],
      [I.planStepApproval, 1, 'independent_approval', 'awaiting_approval', true],
      [I.planStepMaterialize, 2, 'materialize_canonical_task', 'pending', false],
    ]) {
      await c.query(
        'insert into ai_agent_plan_steps(id,plan_id,step_index,tool_name,tool_input_json,status,requires_approval) values($1,$2,$3,$4,$5,$6,$7)',
        [id, I.plan, index, toolName, JSON.stringify({ ownerReviewFixture: true }), status, requiresApproval]
      );
    }
    await c.query('commit');
  } catch (e) {
    await c.query('rollback');
    throw e;
  }
  const a = await app(),
    H = (u, o = I.org) => ({ 'x-user': u, 'x-org': o }),
    src = await request(a)
      .get(`/api/my-work/agent-materialization/source/${I.plan}`)
      .set(H(I.requester));
  if (src.status !== 200) fail(`source ${src.status}`);
  const body = {
      sourcePlanId: I.plan,
      sourceVersion: src.body.sourceVersion,
      sourceHash: src.body.sourceHash,
      targetKind: 'task',
      content: { title: 'Agent-proposed pilot task', description: 'Independent approval required' },
      idempotencyKey: I.key,
      expiresAt: '2030-01-01T12:00:00.000Z',
    },
    created = await request(a)
      .post('/api/my-work/agent-materialization/proposals')
      .set(H(I.requester))
      .send(body),
    replay = await request(a)
      .post('/api/my-work/agent-materialization/proposals')
      .set(H(I.requester))
      .send(body);
  if (created.status !== 201 || replay.status !== 200 || !replay.body.replayed)
    fail('proposal/replay failed');
  const p = created.body.proposal,
    D = { decision: 'APPROVE', expectedStateVersion: 1, sourceHash: p.source_hash };
  for (const [who, org, status] of [
    [I.requester, I.org, 409],
    [I.member, I.org, 403],
    [I.revoked, I.org, 403],
    [I.foreign, I.foreignOrg, 404],
  ]) {
    const r = await request(a)
      .post(`/api/my-work/agent-materialization/proposals/${p.proposal_id}/decision`)
      .set(H(who, org))
      .send(D);
    if (r.status !== status) fail(`boundary ${who} expected ${status} got ${r.status}`);
  }
  let r = await request(a)
    .post(`/api/my-work/agent-materialization/proposals/${p.proposal_id}/decision`)
    .set(H(I.owner))
    .send({ ...D, expectedStateVersion: 99 });
  if (r.status !== 409) fail('stale proposal boundary failed');
  r = await request(a)
    .post(`/api/my-work/agent-materialization/proposals/${p.proposal_id}/decision`)
    .set(H(I.owner))
    .send(D);
  if (r.status !== 200) fail('approval failed');
  r = await request(a)
    .post(`/api/my-work/agent-materialization/proposals/${p.proposal_id}/materialize`)
    .set(H(I.owner))
    .send({ expectedStateVersion: 2 });
  if (r.status !== 200 || r.body.receipt.status !== 'SUCCEEDED') fail('materialization failed');
  r = await request(a)
    .post(`/api/my-work/agent-materialization/proposals/${p.proposal_id}/materialize`)
    .set(H(I.owner))
    .send({ expectedStateVersion: 2 });
  if (r.status !== 200 || !r.body.replayed) fail('materialization replay failed');
  const token = (await c.query('select updated_at::text t from tasks where id=$1', [I.task]))
    .rows[0].t;
  if (
    (
      await c.query(
        "update tasks set status='in_progress',updated_at='2026-08-21T08:10:00Z' where id=$1 and organization_id=$2 and updated_at::text=$3 returning id",
        [I.task, I.org, token]
      )
    ).rowCount !== 1
  )
    fail('task CAS failed');
  if (
    (
      await c.query(
        "update tasks set status='done' where id=$1 and organization_id=$2 and updated_at::text=$3 returning id",
        [I.task, I.org, token]
      )
    ).rowCount
  )
    fail('stale task CAS wrote');
  return persist(await readback(c, false));
}
async function readback(c, emit = true) {
  const r = await c.query(
    'select t.status task_status,d.status decision_status,p.source_hash,p.content_hash,p.state,p.state_version,a.approver_id,a.decision,r.status receipt_status,r.target_kind,mt.status target_status from tasks t join decisions d on d.id=$4 join myw_agent_materialization_proposals p on p.organization_id=t.organization_id and p.idempotency_key=$2 join myw_agent_materialization_approvals a on a.proposal_id=p.proposal_id join myw_agent_materialization_receipts r on r.proposal_id=p.proposal_id join tasks mt on mt.id=r.target_id where t.id=$3 and t.organization_id=$1',
    [I.org, I.key, I.task, I.decision]
  );
  if (r.rowCount !== 1) fail('complete chain absent');
  const x = r.rows[0],
    ps = await c.query(
      'select u.id,u.organization_id,m.role,m.status from users u join organization_members m on m.user_id=u.id and m.organization_id=u.organization_id where u.id=any($1) order by u.id',
      [[I.owner, I.requester, I.member, I.revoked, I.foreign]]
    );
  const marker = (
    await c.query(
      'select ownership_nonce,database_name from public.wave3_owner_fixture_markers where fixture_id=$1',
      [FIXTURE_ID]
    )
  ).rows[0];
  const currentDatabase = (await c.query('select current_database() name')).rows[0].name;
  if (!marker || marker.database_name !== currentDatabase)
    fail('FINAL ownership marker absent or mismatched');
  const m = {
    schemaVersion: 'w3-my-work-owner-v3',
    fixture: FIXTURE_ID,
    fixtureId: FIXTURE_ID,
    ownershipState: 'FINAL',
    ownershipNonce: marker.ownership_nonce,
    databaseName: marker.database_name,
    marker: {
      table: 'wave3_owner_fixture_markers',
      fixtureId: FIXTURE_ID,
      ownershipNonce: marker.ownership_nonce,
    },
    deepLink: '/my-work',
    deepLinkVerified: false,
    runtime: {
      database: 'owned-disposable-local',
      sharedCwLocal: false,
      mountedInProcess: true,
      providerExecution: 'OFF',
    },
    ids: { ...I },
    expected: {
      taskStatus: x.task_status,
      decisionStatus: x.decision_status,
      proposalState: x.state,
      stateVersion: x.state_version,
      sourceHash: x.source_hash,
      contentHash: x.content_hash,
      approver: x.approver_id,
      receiptStatus: x.receipt_status,
      targetKind: x.target_kind,
      targetStatus: x.target_status,
      boundaries: {
        selfApproval: 409,
        memberApproval: 403,
        foreignTenant: 404,
        staleProposal: 409,
        staleTaskCasWrites: 0,
      },
    },
    personas: ps.rows,
  };
  if (
    x.task_status !== 'in_progress' ||
    x.state !== 'MATERIALIZED' ||
    x.state_version !== 3 ||
    x.approver_id !== I.owner ||
    x.receipt_status !== 'SUCCEEDED' ||
    x.target_kind !== 'task' ||
    ps.rowCount !== 5
  )
    fail('readback contract failed');
  if (emit) console.log(JSON.stringify(m, null, 2));
  return m;
}
function persist(m) {
  m.expected.boundaries.revokedMembership = 403;
  const s = `${JSON.stringify(m, null, 2)}\n`;
  if (
    (DB && s.includes(DB)) ||
    (PW && s.includes(PW)) ||
    /postgres(?:ql)?:\/\//i.test(s) ||
    /cw-local/i.test(s)
  )
    fail('manifest scan failed');
  try {
    writeFileSync(MP, s, { flag: 'wx', mode: 0o600 });
  } catch (e) {
    if (e?.code === 'EEXIST') fail('manifest exists; refusing overwrite');
    throw e;
  }
  if ((statSync(MP).mode & 0o777) !== 0o600) fail('manifest mode not 0600');
  console.log(JSON.stringify(m, null, 2));
  return m;
}
async function main() {
  const { u, db } = qualify();
  if (CMD === 'provision') return provision(u, db);
  if (CMD === 'drop') return drop(u, db);
  if (CMD === 'reset') return reset(u, db);
  const c = new pg.Client({ connectionString: u.toString() });
  await c.connect();
  try {
    if (CMD === 'seed') await seed(c);
    else await readback(c);
  } finally {
    await c.end();
    if (mounted) {
      const { shutdownConnectionPool } = await import('../../server/src/database/index.ts');
      await shutdownConnectionPool();
    }
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
