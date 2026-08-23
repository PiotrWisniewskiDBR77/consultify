#!/usr/bin/env npx tsx
/** Wave 3 / module 04 Assessment — isolated DRD owner-review fixture. */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import request from 'supertest';

const COMMAND = process.argv[2] || 'readback';
const URL = process.env.ASSESSMENT_OWNER_FIXTURE_DATABASE_URL || '';
const YES = process.env.ASSESSMENT_OWNER_FIXTURE_CONFIRM;
const MANIFEST = process.env.ASSESSMENT_OWNER_FIXTURE_MANIFEST || '';
const PREFIX = 'consultify_w3_assessment_owner_';
const FIXTURE_ID = 'W3-ASSESSMENT-OWNER-v1';
const ownershipNonce = crypto.randomBytes(32).toString('hex');
const IDS = Object.freeze({
  mainOrg: '04000000-0000-4000-8000-000000000001',
  foreignOrg: '04000000-0000-4000-8000-000000000002',
  owner: '04000000-0000-4000-8000-000000000011',
  approver: '04000000-0000-4000-8000-000000000012',
  reader: '04000000-0000-4000-8000-000000000013',
  inactive: '04000000-0000-4000-8000-000000000014',
  foreign: '04000000-0000-4000-8000-000000000015',
});
const USERS = Object.freeze([
  {
    id: IDS.owner,
    org: IDS.mainOrg,
    email: 'w3.assessment.owner@local.test',
    role: 'OWNER',
    membership: 'ACTIVE',
    purpose: 'session owner/editor',
    password: 'Wave3AsmOwner!2026',
  },
  {
    id: IDS.approver,
    org: IDS.mainOrg,
    email: 'w3.assessment.approver@local.test',
    role: 'ADMIN',
    membership: 'ACTIVE',
    purpose: 'distinct approver',
    password: 'Wave3AsmApprover!2026',
  },
  {
    id: IDS.reader,
    org: IDS.mainOrg,
    email: 'w3.assessment.reader@local.test',
    role: 'MEMBER',
    membership: 'ACTIVE',
    purpose: 'same-tenant reader and denied writer',
    password: 'Wave3AsmReader!2026',
  },
  {
    id: IDS.inactive,
    org: IDS.mainOrg,
    email: 'w3.assessment.inactive@local.test',
    role: 'ADMIN',
    membership: 'REVOKED',
    purpose: 'inactive denial',
    password: 'Wave3AsmInactive!2026',
  },
  {
    id: IDS.foreign,
    org: IDS.foreignOrg,
    email: 'w3.assessment.foreign@local.test',
    role: 'OWNER',
    membership: 'ACTIVE',
    purpose: 'foreign-tenant denial',
    password: 'Wave3AsmForeign!2026',
  },
]);
function fail(m: string): never {
  throw new Error(`[W3 Assessment fixture] BLOCKED: ${m}`);
}
function ctx() {
  if (!URL) fail('ASSESSMENT_OWNER_FIXTURE_DATABASE_URL is required');
  if (!['seed', 'readback', 'reset'].includes(COMMAND)) fail(`unknown command ${COMMAND}`);
  let u: globalThis.URL;
  try {
    u = new globalThis.URL(URL);
  } catch {
    fail('fixture database URL is invalid');
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(u.hostname))
    fail(`database host ${u.hostname} is not local`);
  const db = u.pathname.slice(1);
  if (!/^consultify_w3_assessment_owner_[a-z0-9_]+$/.test(db))
    fail(`database name must match ${PREFIX}* using lowercase letters, digits and underscores`);
  const admin = new globalThis.URL(u);
  admin.pathname = '/postgres';
  if (COMMAND === 'seed') {
    if (!MANIFEST) fail('ASSESSMENT_OWNER_FIXTURE_MANIFEST is required for seed');
    if (!path.isAbsolute(MANIFEST) || MANIFEST.includes('://'))
      fail('ASSESSMENT_OWNER_FIXTURE_MANIFEST must be an absolute local filesystem path');
    if (fs.existsSync(MANIFEST)) fail('manifest path already exists; overwrite is refused');
  }
  return { admin, db };
}
function requireYes() {
  if (YES !== 'YES') fail('seed/reset requires ASSESSMENT_OWNER_FIXTURE_CONFIRM=YES');
}
async function exists(c: pg.Client, db: string) {
  return (
    Number(
      (await c.query('select count(*)::int n from pg_database where datname=$1', [db])).rows[0].n
    ) === 1
  );
}
function payload(db: string, d: any = null, r: any = null) {
  return {
    fixture: FIXTURE_ID,
    fixtureId: FIXTURE_ID,
    ownershipState: 'FINAL',
    ownershipNonce,
    marker: { table: 'wave3_owner_fixture_markers', fixtureId: FIXTURE_ID, ownershipNonce },
    databaseName: db,
    deepLinks: {
      hub: '/assessment',
      guidedSessionId: d?.guidedSessionId ?? null,
      frozenSessionId: d?.frozenSessionId ?? null,
      outputId: d?.outputId ?? null,
      verified: false,
    },
    productionWrites: false,
    sourceGatesChanged: false,
    personas: USERS.map(({ password: _p, ...u }) => u),
    journeys: [
      'DRD bootstrap -> guided active session with six meaningful events',
      'distinct approver -> in_review -> stale/role/tenant boundaries -> frozen immutable Output',
      'Output findings -> one governed Initiative Draft when findings are available',
      'cold HTTP/SQL readback and whole-database reset',
    ],
    boundaries: {
      ownerCannotApprove: 'missing_permission',
      staleFreeze: 'version_conflict',
      foreignRead: 'tenant non-disclosure',
      readerMutation: 'missing_permission',
      freezeReplay: 'same Output, zero duplicate',
      frozenOutput: 'content hash unchanged',
    },
    dynamic: d,
    readback: r,
  };
}
function persist(p: any) {
  const b = `${JSON.stringify(p, null, 2)}\n`;
  let fd: number | undefined;
  try {
    fd = fs.openSync(MANIFEST, 'wx', 0o600);
    fs.writeFileSync(fd, b, 'utf8');
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  const q = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (
    (fs.statSync(MANIFEST).mode & 0o777) !== 0o600 ||
    q.fixture !== 'W3-ASSESSMENT-OWNER-v1' ||
    q.personas?.length !== USERS.length ||
    Number(q.readback?.personas) !== USERS.length
  )
    fail('persisted manifest verification failed');
  const s = JSON.stringify(q);
  for (const u of USERS)
    if (s.includes(u.password)) fail('persisted manifest contains a fixture password');
  return { path: MANIFEST, bytes: Buffer.byteLength(b), mode: '0600', verified: true };
}
async function base() {
  const c = new pg.Client({ connectionString: URL });
  await c.connect();
  try {
    await c.query('begin');
    await c.query(
      `create table if not exists public.wave3_owner_fixture_markers(fixture_id text primary key,ownership_nonce text not null,database_name text not null)`
    );
    await c.query(
      `insert into public.wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name) values($1,$2,current_database())`,
      [FIXTURE_ID, ownershipNonce]
    );
    await c.query(
      `insert into organizations(id,name) values($1,'W3 Assessment Owner Review'),($2,'W3 Assessment Foreign')`,
      [IDS.mainOrg, IDS.foreignOrg]
    );
    for (const u of USERS) {
      await c.query(
        `insert into users(id,organization_id,email,password,first_name,last_name,role,status,language,timezone) values($1,$2,$3,$4,'Assessment','Fixture',$5,'active','pl','Europe/Warsaw')`,
        [u.id, u.org, u.email, await bcrypt.hash(u.password, 10), u.role]
      );
      await c.query(
        `insert into organization_members(id,organization_id,user_id,role,status) values($1,$2,$3,$4,$5)`,
        [`membership-${u.id}`, u.org, u.id, u.role, u.membership]
      );
    }
    await c.query('commit');
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    await c.end();
  }
}
async function journey() {
  Object.assign(process.env, {
    DATABASE_URL: URL,
    DB_TYPE: 'postgres',
    MOCK_DB: 'false',
    NODE_ENV: 'test',
    RUN_DB_TESTS: '1',
    CI: 'true',
    POSTGRES_SKIP_INIT_IN_TEST: '1',
  });
  const [{ default: typedConfig }, { default: routes }, registry, { default: postgresDb }] =
    await Promise.all([
      import('../src/config/Config.js'),
      import('../src/routes/method-core.routes.js'),
      import('../src/method-core/MethodPackRegistry.js'),
      import('../src/database/PostgresDatabase.js'),
    ]);
  const config = typedConfig as typeof typedConfig & { JWT_ISSUER?: string; JWT_AUDIENCE?: string };
  const token = (id: string, org: string, role: string, email: string) =>
    jwt.sign({ id, email, organizationId: org, role }, config.JWT_SECRET, {
      expiresIn: '15m',
      ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
      ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
    });
  const toks = {
    owner: token(IDS.owner, IDS.mainOrg, 'OWNER', USERS[0].email),
    approver: token(IDS.approver, IDS.mainOrg, 'ADMIN', USERS[1].email),
    reader: token(IDS.reader, IDS.mainOrg, 'MEMBER', USERS[2].email),
    foreign: token(IDS.foreign, IDS.foreignOrg, 'OWNER', USERS[4].email),
  };
  const app = express();
  app.use(express.json());
  app.use('/api/method', routes);
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const create = async (key: string) => {
    const x = await request(app)
      .post('/api/method/sessions')
      .set(auth(toks.owner))
      .set('Idempotency-Key', key)
      .send({
        module: 'assessment',
        methodPackId: registry.DRD_METHOD_PACK_ID,
        methodPackVersion: registry.DRD_METHOD_PACK_VERSION,
        mode: 'guided_manual',
        projectId: null,
      });
    if (![200, 201].includes(x.status)) fail(`create failed ${x.status} ${JSON.stringify(x.body)}`);
    return String(x.body.session.id);
  };
  const role = async (s: string, user: string, r: string) => {
    const x = await request(app)
      .post(`/api/method/sessions/${s}/roles`)
      .set(auth(toks.owner))
      .send({ userId: user, role: r });
    if (![200, 201].includes(x.status))
      fail(`role ${r} failed ${x.status} ${JSON.stringify(x.body)}`);
  };
  const transition = async (s: string, to: string, key: string, t = toks.owner, extra: any = {}) =>
    request(app)
      .post(`/api/method/sessions/${s}/transition`)
      .set(auth(t))
      .set('Idempotency-Key', key)
      .send({ to, ...extra });
  const events = [
    [
      'customer-draft',
      'ANSWER_DRAFTED',
      '1A',
      2,
      {
        questionId: '1A-L2-Q1',
        answerState: 'draft',
        answerText: 'Brakuje jednego standardu kompletności danych klienta.',
      },
    ],
    [
      'customer-evidence',
      'EVIDENCE_ATTACHED',
      '1A',
      null,
      {
        evidenceId: 'w3-asm-customer-v1',
        evidenceType: 'interview',
        strength: 'E2',
        summary: 'Start wdrożenia opóźniony o dziewięć dni.',
      },
    ],
    [
      'customer-confirmed',
      'ANSWER_CONFIRMED',
      '1A',
      2,
      { questionId: '1A-L2-Q1', answerState: 'confirmed' },
    ],
    [
      'governance-draft',
      'ANSWER_DRAFTED',
      '1B',
      1,
      {
        questionId: '1B-L1-Q1',
        answerState: 'draft',
        answerText: 'Decyzja gotowości jest rozproszona.',
      },
    ],
    [
      'governance-evidence',
      'EVIDENCE_ATTACHED',
      '1B',
      null,
      {
        evidenceId: 'w3-asm-governance-v1',
        evidenceType: 'document',
        strength: 'E1',
        summary: 'Brak wspólnej checklisty gotowości.',
      },
    ],
    [
      'governance-confirmed',
      'ANSWER_CONFIRMED',
      '1B',
      1,
      { questionId: '1B-L1-Q1', answerState: 'confirmed' },
    ],
  ] as const;
  const addEvents = async (s: string, prefix: string) => {
    for (const [key, type, unitId, level, p] of events) {
      const x = await request(app)
        .post(`/api/method/sessions/${s}/events`)
        .set(auth(toks.owner))
        .set('Idempotency-Key', `${prefix}:${key}`)
        .send({ type, unitId, ...(level ? { level } : {}), payload: p });
      if (![200, 201].includes(x.status))
        fail(`event failed ${x.status} ${JSON.stringify(x.body)}`);
    }
  };
  const guided = await create('w3-asm-guided:create');
  await role(guided, IDS.owner, 'lead_assessor');
  for (const to of ['prepared', 'active']) {
    const x = await transition(guided, to, `w3-asm-guided:${to}`);
    if (x.status !== 200) fail(`guided ${to} failed`);
  }
  await addEvents(guided, 'w3-asm-guided');
  const frozen = await create('w3-asm-frozen:create');
  await role(frozen, IDS.owner, 'lead_assessor');
  await role(frozen, IDS.approver, 'approver');
  for (const to of ['prepared', 'active']) {
    const x = await transition(frozen, to, `w3-asm-frozen:${to}`);
    if (x.status !== 200) fail(`frozen ${to} failed`);
  }
  await addEvents(frozen, 'w3-asm-frozen');
  {
    const x = await transition(frozen, 'in_review', 'w3-asm-frozen:review');
    if (x.status !== 200) fail(`review failed ${x.status}`);
  }
  const stale = await request(app)
    .post(`/api/method/sessions/${frozen}/freeze`)
    .set(auth(toks.approver))
    .set('Idempotency-Key', 'w3-asm-freeze-stale')
    .send({ expectedVersion: 999 });
  if (stale.status !== 409 || stale.body.error !== 'version_conflict')
    fail('stale freeze did not fail closed');
  const ownerDeny = await request(app)
    .post(`/api/method/sessions/${frozen}/freeze`)
    .set(auth(toks.owner))
    .set('Idempotency-Key', 'w3-asm-freeze-owner-deny')
    .send({});
  if (ownerDeny.status !== 403 || ownerDeny.body.error !== 'missing_permission')
    fail('owner freeze denial failed');
  const readerDeny = await transition(frozen, 'active', 'w3-asm-reader-deny', toks.reader);
  if (readerDeny.status !== 403) fail('reader mutation denial failed');
  const foreign = await request(app).get(`/api/method/sessions/${frozen}`).set(auth(toks.foreign));
  if (![403, 404].includes(foreign.status)) fail('foreign read did not fail closed');
  const approval = await request(app)
    .post(`/api/method/sessions/${frozen}/approvals`)
    .set(auth(toks.approver))
    .set('Idempotency-Key', 'w3-asm-approval-v1')
    .send({ decision: 'approved', comment: 'Niezależna akceptacja gotowości i dowodów.' });
  if (approval.status !== 201 || approval.body.session?.state !== 'frozen')
    fail(`approval failed ${approval.status} ${JSON.stringify(approval.body)}`);
  const freezeKey = 'w3-asm-freeze-v1';
  const first = await request(app)
    .post(`/api/method/sessions/${frozen}/freeze`)
    .set(auth(toks.approver))
    .set('Idempotency-Key', freezeKey)
    .send({});
  if (first.status !== 200)
    fail(`freeze readback failed ${first.status} ${JSON.stringify(first.body)}`);
  const replay = await request(app)
    .post(`/api/method/sessions/${frozen}/freeze`)
    .set(auth(toks.approver))
    .set('Idempotency-Key', freezeKey)
    .send({});
  if (replay.status !== 200 || replay.body.output.id !== first.body.output.id)
    fail('freeze replay diverged');
  const output = first.body.output;
  let draftId: null | string = null;
  if (Array.isArray(output.findings) && output.findings.length) {
    const d = await request(app)
      .post(`/api/method/outputs/${output.id}/initiative-drafts`)
      .set(auth(toks.owner))
      .send({
        findingIds: output.findings.map((f: any) => f.id),
        title: 'Standard gotowości klienta',
        rationale: 'Zamknąć luki danych i decyzji przed startem.',
        expectedOutcome: 'Jedna jawna bramka gotowości i krótszy czas startu.',
        confidence: 'medium',
      });
    if (d.status !== 201) fail(`initiative draft failed ${d.status} ${JSON.stringify(d.body)}`);
    draftId = String(d.body.draft.id);
  }
  const after = await request(app).get(`/api/method/outputs/${output.id}`).set(auth(toks.owner));
  if (after.status !== 200 || String(after.body.output.contentHash) !== String(output.contentHash))
    fail('frozen output changed on cold read');
  await postgresDb.close();
  return {
    guidedSessionId: guided,
    frozenSessionId: frozen,
    outputId: String(output.id),
    initiativeDraftId: draftId,
    outputContentHash: String(output.contentHash),
  };
}
async function readback(db: string, d: any = null) {
  const c = new pg.Client({ connectionString: URL });
  await c.connect();
  try {
    const guided =
      d?.guidedSessionId ??
      (
        await c.query(
          `select id from method_sessions where organization_id=$1 and state='active' order by created_at limit 1`,
          [IDS.mainOrg]
        )
      ).rows[0]?.id;
    const frozen =
      d?.frozenSessionId ??
      (
        await c.query(
          `select id from method_sessions where organization_id=$1 and state='frozen' order by created_at limit 1`,
          [IDS.mainOrg]
        )
      ).rows[0]?.id;
    const output =
      d?.outputId ??
      (await c.query(`select id from method_outputs where session_id=$1`, [frozen])).rows[0]?.id;
    const r = (
      await c.query(
        `select (select count(*)::int from users where id=any($1::text[])) personas,(select count(*)::int from method_sessions where id=$2 and state='active') guided_active,(select count(*)::int from method_events where session_id=$2) guided_events,(select count(*)::int from method_sessions where id=$3 and state='frozen') frozen_sessions,(select count(*)::int from method_outputs where session_id=$3) frozen_outputs,(select count(*)::int from method_snapshots where session_id=$3) frozen_snapshots,(select count(*)::int from method_approvals where session_id=$3 and decision='approved' and actor_user_id=$4) distinct_approvals,(select count(*)::int from method_initiative_drafts where session_id=$3) initiative_drafts,(select count(*)::int from schema_migrations where status='success') successful_migrations`,
        [USERS.map((u) => u.id), guided, frozen, IDS.approver]
      )
    ).rows[0];
    const exp: any = {
      personas: 5,
      guided_active: 1,
      guided_events: 6,
      frozen_sessions: 1,
      frozen_outputs: 1,
      frozen_snapshots: 1,
      distinct_approvals: 1,
      initiative_drafts: 1,
      successful_migrations: 831,
    };
    for (const [k, v] of Object.entries(exp))
      if (String(r[k]) !== String(v)) fail(`readback ${k} expected ${v}, got ${r[k]}`);
    const p = payload(
      db,
      { ...d, guidedSessionId: guided, frozenSessionId: frozen, outputId: output },
      r
    );
    console.log(JSON.stringify(p, null, 2));
    return p;
  } finally {
    await c.end();
  }
}
async function seed(x: ReturnType<typeof ctx>) {
  requireYes();
  let created = false;
  const a = new pg.Client({ connectionString: x.admin.toString() });
  await a.connect();
  try {
    if (await exists(a, x.db)) fail('target database already exists; reset it first');
    await a.query(`create database "${x.db}"`);
    created = true;
  } finally {
    await a.end();
  }
  try {
    const m = spawnSync('npm', ['run', 'db:migrate:strict'], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test', DB_TYPE: 'postgres', DATABASE_URL: URL },
      encoding: 'utf8',
    });
    if (m.status !== 0) fail(`migration failed: ${m.stderr || m.stdout}`);
    await base();
    const d = await journey();
    const p = await readback(x.db, d);
    console.log(JSON.stringify({ manifestWritten: persist(p) }, null, 2));
  } catch (error) {
    if (created && !fs.existsSync(MANIFEST)) {
      const cleanup = new pg.Client({ connectionString: x.admin.toString() });
      await cleanup.connect();
      try {
        if (await exists(cleanup, x.db))
          await cleanup.query(`drop database "${x.db}" with (force)`);
      } finally {
        await cleanup.end();
      }
    }
    throw error;
  }
}
async function reset(x: ReturnType<typeof ctx>) {
  requireYes();
  if (!MANIFEST || !path.isAbsolute(MANIFEST) || !fs.existsSync(MANIFEST))
    fail('reset requires the exact existing manifest');
  const stat = fs.lstatSync(MANIFEST);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600)
    fail('reset manifest must be a regular non-symlink 0600 file');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (
    manifest.databaseName !== x.db ||
    manifest.fixtureId !== FIXTURE_ID ||
    manifest.ownershipState !== 'FINAL' ||
    !manifest.ownershipNonce
  )
    fail('reset manifest identity is invalid');
  const target = new pg.Client({ connectionString: URL });
  await target.connect();
  try {
    const marker = await target.query(
      `select fixture_id,ownership_nonce,database_name from public.wave3_owner_fixture_markers where fixture_id=$1`,
      [FIXTURE_ID]
    );
    if (
      marker.rowCount !== 1 ||
      marker.rows[0].ownership_nonce !== manifest.ownershipNonce ||
      marker.rows[0].database_name !== x.db
    )
      fail('reset marker does not match manifest');
  } finally {
    await target.end();
  }
  const a = new pg.Client({ connectionString: x.admin.toString() });
  await a.connect();
  try {
    if (await exists(a, x.db)) await a.query(`drop database "${x.db}" with (force)`);
    console.log(
      JSON.stringify(
        {
          fixture: FIXTURE_ID,
          databaseName: x.db,
          dropped: true,
          catalogAbsent: !(await exists(a, x.db)),
        },
        null,
        2
      )
    );
  } finally {
    await a.end();
  }
}
const x = ctx();
if (COMMAND === 'seed') await seed(x);
else if (COMMAND === 'readback') await readback(x.db);
else await reset(x);
process.exit(0);
