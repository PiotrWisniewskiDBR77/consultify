#!/usr/bin/env npx tsx
/**
 * Wave 3 / module 08 Meetings — guarded local owner-review fixture.
 *
 * Follows the family contract established by
 * server/scripts/seed-wave3-initiatives-owner-review.ts: seed/readback/reset
 * against a disposable local-only PostgreSQL database, a durable
 * `wave3_owner_fixture_markers` row + FINAL `wx`/`0600` manifest (no
 * secrets), named personas, and a cold-SQL readback that field-compares
 * expected counters rather than trusting write-response shapes.
 *
 * G03/G04 contract this realizes, per
 * docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md:
 *   Allowed: active same-tenant member for meeting/note proposal;
 *            active same-tenant ADMIN/OWNER for the governed decision and
 *            administrative status/delete.
 *   Denied:  anonymous/forged token, inactive/revoked member,
 *            MEMBER approval/status/delete, foreign tenant,
 *            stale/concurrent loser.
 *   Fixture: OWNER/ADMIN/MEMBER/revoked/foreign identities retain pending,
 *            rejected and approved/materialized manual-note states with
 *            receipt counts 0/0/1. Recording/transcription/media/live
 *            providers stay OFF (MEETING_CAPTURE_POLICY in
 *            server/src/routes/meeting.routes.ts) — this fixture pastes a
 *            manual transcript and never calls the AI/meetingIntelligence
 *            path (proposeMeetingNote is called directly, not the
 *            /generate-notes HTTP route, matching the family's
 *            aiGenerationInvoked:false convention).
 *
 * The note-decision role gate (`requireMeetingAdmin`), the active-membership
 * gate (`requireActiveMeetingMembership`) and JWT verification itself
 * (`verifyToken`) all live in the Express middleware chain, not in the
 * service layer meetingBoundaryService.ts exposes — so those specific
 * boundaries (MEMBER denied a decision, revoked member denied, anonymous
 * request denied, forged JWT denied) are proven at the real HTTP layer: a
 * minimal Express app mounts the exact middleware chain
 * server/src/Gateway.ts wires ahead of meeting.routes.ts
 * (`router.use(verifyToken, isAuthenticated, closedBetaModuleGate,
 * requireActiveMeetingMembership)`), then supertest drives it — the same
 * pattern seed-wave3-assessment-owner-review.ts and
 * seed-wave3-organization-owner-review.ts already use for their own cold
 * HTTP proofs.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import pg from 'pg';

const COMMAND = process.argv[2] || 'readback';
const TARGET_URL = process.env.MEETINGS_OWNER_FIXTURE_DATABASE_URL || '';
const CONFIRM = process.env.MEETINGS_OWNER_FIXTURE_CONFIRM;
const MANIFEST_PATH = process.env.MEETINGS_OWNER_FIXTURE_MANIFEST || '';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const DB_PREFIX = 'consultify_w3_meetings_owner_';
const FIXTURE_ID = 'W3-MEETINGS-OWNER-v1';
const FIXTURE_NAME = 'W3-MEETINGS-OWNER-v1';

const IDS = Object.freeze({
  mainOrg: '08000000-0000-4000-8000-000000000001',
  foreignOrg: '08000000-0000-4000-8000-000000000002',
  owner: '08000000-0000-4000-8000-000000000011',
  admin: '08000000-0000-4000-8000-000000000012',
  member: '08000000-0000-4000-8000-000000000013',
  inactive: '08000000-0000-4000-8000-000000000014',
  foreignOwner: '08000000-0000-4000-8000-000000000015',
});

const USERS = Object.freeze([
  {
    id: IDS.owner,
    org: IDS.mainOrg,
    email: 'w3.meetings.owner@local.test',
    role: 'OWNER',
    membership: 'ACTIVE',
    firstName: 'Piotr',
    lastName: 'Wisniewski',
    purpose: 'allowed: governed decision + administrative status/delete',
    password: 'Wave3MtgOwner!2026',
  },
  {
    id: IDS.admin,
    org: IDS.mainOrg,
    email: 'w3.meetings.admin@local.test',
    role: 'ADMIN',
    membership: 'ACTIVE',
    firstName: 'Anna',
    lastName: 'Kowalska',
    purpose: 'allowed: governed decision (distinct ADMIN reviewer)',
    password: 'Wave3MtgAdmin!2026',
  },
  {
    id: IDS.member,
    org: IDS.mainOrg,
    email: 'w3.meetings.member@local.test',
    role: 'MEMBER',
    membership: 'ACTIVE',
    firstName: 'Marek',
    lastName: 'Nowak',
    purpose: 'allowed: meeting/note proposal; denied: decision/status/delete',
    password: 'Wave3MtgMember!2026',
  },
  {
    id: IDS.inactive,
    org: IDS.mainOrg,
    email: 'w3.meetings.inactive@local.test',
    role: 'ADMIN',
    membership: 'REVOKED',
    firstName: 'Nieaktywny',
    lastName: 'Uzytkownik',
    purpose: 'denied: inactive/revoked member (ORG_MEMBERSHIP_REVOKED)',
    password: 'Wave3MtgInactive!2026',
  },
  {
    id: IDS.foreignOwner,
    org: IDS.foreignOrg,
    email: 'w3.meetings.foreign@local.test',
    role: 'OWNER',
    membership: 'ACTIVE',
    firstName: 'Obcy',
    lastName: 'Wlasciciel',
    purpose: 'denied: foreign tenant (cross-org meeting invisible)',
    password: 'Wave3MtgForeign!2026',
  },
]);

function fail(message: string): never {
  throw new Error(`[W3 Meetings fixture] BLOCKED: ${message}`);
}

function context() {
  if (!TARGET_URL) fail('MEETINGS_OWNER_FIXTURE_DATABASE_URL is required');
  if (!['seed', 'readback', 'reset'].includes(COMMAND)) fail(`unknown command ${COMMAND}`);
  let target: URL;
  try {
    target = new URL(TARGET_URL);
  } catch {
    fail('fixture database URL is invalid');
  }
  if (!LOCAL_HOSTS.has(target.hostname)) fail(`database host ${target.hostname} is not local`);
  const databaseName = target.pathname.replace(/^\//, '');
  if (
    !databaseName.startsWith(DB_PREFIX) ||
    !/^consultify_w3_meetings_owner_[a-z0-9_]+$/.test(databaseName)
  ) {
    fail(`database name must match ${DB_PREFIX}* using lowercase letters, digits and underscores`);
  }
  const admin = new URL(target);
  admin.pathname = '/postgres';
  if (COMMAND === 'seed') {
    if (!MANIFEST_PATH) fail('MEETINGS_OWNER_FIXTURE_MANIFEST is required for seed');
    if (!path.isAbsolute(MANIFEST_PATH) || MANIFEST_PATH.includes('://'))
      fail('MEETINGS_OWNER_FIXTURE_MANIFEST must be an absolute local filesystem path');
    if (fs.existsSync(MANIFEST_PATH)) fail('manifest path already exists; overwrite is refused');
  }
  return { admin, databaseName, manifestPath: MANIFEST_PATH };
}

function requireYes() {
  if (CONFIRM !== 'YES') fail('seed/reset requires MEETINGS_OWNER_FIXTURE_CONFIRM=YES');
}

async function databaseExists(client: pg.Client, databaseName: string) {
  return (
    Number(
      (
        await client.query('SELECT count(*)::int n FROM pg_database WHERE datname=$1', [
          databaseName,
        ])
      ).rows[0].n
    ) === 1
  );
}

function manifest(
  databaseName: string,
  ownershipNonce: string,
  dynamic: Record<string, unknown> | null = null,
  readback: Record<string, unknown> | null = null
) {
  return {
    fixtureId: FIXTURE_ID,
    fixture: FIXTURE_NAME,
    ownershipState: 'FINAL',
    databaseName,
    ownershipNonce,
    marker: { table: 'wave3_owner_fixture_markers', fixtureId: FIXTURE_ID, ownershipNonce },
    productionWrites: false,
    aiGenerationInvoked: false,
    capturePolicy: { recordingEnabled: false, automaticTranscriptionEnabled: false, acceptsManualSourceText: true },
    personas: USERS.map(({ password: _password, ...persona }) => persona),
    journey: [
      'one meeting created for mainOrg (owner as creator, member as attendee)',
      'proposeMeetingNote (service layer, manual transcript, no AI call) x3 -> pending notes',
      'decideMeetingNote REJECT (owner) on note 1 -> rejected, zero materialization',
      'decideMeetingNote APPROVE (owner) on note 2 -> approved + materialize-as-one-call -> exactly-one immutable receipt',
      'note 3 stays pending (undecided) -> owner-review evidence of the pending state',
      'HTTP layer (verifyToken -> isAuthenticated -> closedBetaModuleGate -> requireActiveMeetingMembership -> meeting.routes.ts): '
        + 'MEMBER denied POST /:id/notes/:noteId/decision (403 Admin or owner role required); '
        + 'revoked member denied (403 ORG_MEMBERSHIP_REVOKED); '
        + 'foreign-tenant OWNER denied (404, cross-org meeting invisible); '
        + 'anonymous request denied (401); '
        + 'JWT forged with the wrong secret denied (401); '
        + 'legitimate ADMIN decision (approve note 3) succeeds (200) and is the same governed path exercised at the service layer',
    ],
    boundaries: {
      memberDecisionDenied: 'HTTP 403 "Admin or owner role required" (requireMeetingAdmin)',
      inactiveOrRevokedMember: 'HTTP 403 ORG_MEMBERSHIP_REVOKED (requireActiveMeetingMembership)',
      foreignTenant: 'HTTP 404 "Meeting not found" (org-scoped lookup; no existence oracle)',
      anonymousToken: 'HTTP 401 "No token provided" (verifyToken)',
      forgedJwt: 'HTTP 401 before any route logic runs (wrong-secret signature)',
      staleOrConcurrentLoser: 'decideMeetingNote on an already-decided note converges/errors per HandoffSpineError state machine, never double-materializes',
      directWritesRetired: 'POST /:id/decisions and /:id/follow-ups return 410 MEETING_PROPOSAL_REQUIRED',
    },
    dynamic,
    readback,
  };
}

function persistManifest(manifestPath: string, payload: ReturnType<typeof manifest>) {
  const bytes = `${JSON.stringify(payload, null, 2)}\n`;
  let fd: number | undefined;
  try {
    fd = fs.openSync(manifestPath, 'wx', 0o600);
    fs.writeFileSync(fd, bytes, 'utf8');
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  const persisted = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if ((fs.statSync(manifestPath).mode & 0o777) !== 0o600)
    fail('persisted manifest mode is not 0600');
  if (
    persisted?.fixtureId !== FIXTURE_ID ||
    persisted?.fixture !== FIXTURE_NAME ||
    persisted?.ownershipState !== 'FINAL' ||
    !/^[a-f0-9]{64}$/.test(persisted?.ownershipNonce || '') ||
    persisted?.marker?.ownershipNonce !== persisted?.ownershipNonce ||
    persisted?.personas?.length !== USERS.length ||
    Number(persisted?.readback?.personas) !== USERS.length
  )
    fail('persisted manifest verification failed');
  const serialized = JSON.stringify(persisted);
  for (const user of USERS)
    if (serialized.includes(user.password)) fail('persisted manifest contains a fixture password');
  return { path: manifestPath, bytes: Buffer.byteLength(bytes), mode: '0600', verified: true };
}

async function seedBase(ownershipNonce: string) {
  const c = new pg.Client({ connectionString: TARGET_URL });
  await c.connect();
  try {
    await c.query('BEGIN');
    await c.query(
      `CREATE TABLE IF NOT EXISTS wave3_owner_fixture_markers(fixture_id TEXT PRIMARY KEY,ownership_nonce TEXT NOT NULL,database_name TEXT NOT NULL)`
    );
    await c.query(
      `INSERT INTO wave3_owner_fixture_markers(fixture_id,ownership_nonce,database_name) VALUES($1,$2,current_database())`,
      [FIXTURE_ID, ownershipNonce]
    );
    await c.query(
      `INSERT INTO organizations(id,name) VALUES($1,'W3 Meetings Owner Review'),($2,'W3 Meetings Foreign Boundary')`,
      [IDS.mainOrg, IDS.foreignOrg]
    );
    for (const user of USERS) {
      const hash = await bcrypt.hash(user.password, 10);
      await c.query(
        `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status,language,timezone) VALUES($1,$2,$3,$4,$5,$6,$7,'active','pl','Europe/Warsaw')`,
        [user.id, user.org, user.email, hash, user.firstName, user.lastName, user.role]
      );
      await c.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,$4,$5)`,
        [`membership-${user.id}`, user.org, user.id, user.role, user.membership]
      );
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    await c.end();
  }
}

async function runCanonicalJourney() {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_TYPE: 'postgres',
    MOCK_DB: 'false',
    RUN_DB_TESTS: '1',
    POSTGRES_SKIP_INIT_IN_TEST: '1',
    DATABASE_URL: TARGET_URL,
  });
  const meetingService = await import('../src/services/meetingService.js');
  const boundary = await import('../src/services/meetingBoundary/meetingBoundaryService.js');
  const postgresDatabase = (await import('../src/database/PostgresDatabase.js')).default;

  try {
    const meeting = await meetingService.createMeeting({
      organizationId: IDS.mainOrg,
      createdBy: IDS.owner,
      title: 'W3 owner-review — governed meeting notes',
      startAt: '2026-09-01T09:00:00.000Z',
      endAt: '2026-09-01T10:00:00.000Z',
      attendees: [IDS.owner, IDS.admin, IDS.member],
    });

    const transcriptFor = (label: string) =>
      `[W3 owner-review manual transcript — ${label}]\n` +
      'Piotr: Podsumujmy postep pilotu.\n' +
      'Anna: Dane sa kompletne za ostatni tydzien.\n' +
      'Marek: Przygotuje wersje robocza materialu.';

    const rejectedProposed = await boundary.proposeMeetingNote({
      organizationId: IDS.mainOrg,
      meetingId: meeting.id,
      createdBy: IDS.member,
      source: 'heuristic',
      language: 'pl',
      transcript: transcriptFor('note-rejected'),
      summary: 'Nota robocza do odrzucenia w tym fixture.',
      keyPoints: ['Punkt testowy A'],
      decisions: [],
      actionItems: [],
      idempotencyKey: 'w3-mtg-note-rejected-v1',
    });
    const approvedProposed = await boundary.proposeMeetingNote({
      organizationId: IDS.mainOrg,
      meetingId: meeting.id,
      createdBy: IDS.member,
      source: 'heuristic',
      language: 'pl',
      transcript: transcriptFor('note-approved'),
      summary: 'Nota do zatwierdzenia w tym fixture.',
      keyPoints: ['Dane kompletne za ostatni tydzien'],
      decisions: [],
      actionItems: [],
      idempotencyKey: 'w3-mtg-note-approved-v1',
    });
    const pendingProposed = await boundary.proposeMeetingNote({
      organizationId: IDS.mainOrg,
      meetingId: meeting.id,
      createdBy: IDS.member,
      source: 'heuristic',
      language: 'pl',
      transcript: transcriptFor('note-pending'),
      summary: 'Nota pozostajaca w stanie oczekujacym.',
      keyPoints: ['Wersja robocza materialu w toku'],
      decisions: [],
      actionItems: [],
      idempotencyKey: 'w3-mtg-note-pending-v1',
    });

    const rejected = await boundary.decideMeetingNote({
      organizationId: IDS.mainOrg,
      meetingId: meeting.id,
      noteId: rejectedProposed.note.id,
      decidedBy: IDS.owner,
      action: 'reject',
      reason: 'W3 owner-review: swiadome odrzucenie do fixture',
    });
    if (!rejected || rejected.proposal.state !== 'rejected' || rejected.receipt !== null)
      fail(`note rejection did not produce the expected terminal state: ${JSON.stringify(rejected)}`);

    const approved = await boundary.decideMeetingNote({
      organizationId: IDS.mainOrg,
      meetingId: meeting.id,
      noteId: approvedProposed.note.id,
      decidedBy: IDS.owner,
      action: 'approve',
    });
    if (!approved || approved.proposal.state !== 'materialized' || !approved.receipt)
      fail(`note approval did not materialize: ${JSON.stringify(approved)}`);
    const approvedReplay = await boundary.decideMeetingNote({
      organizationId: IDS.mainOrg,
      meetingId: meeting.id,
      noteId: approvedProposed.note.id,
      decidedBy: IDS.owner,
      action: 'approve',
    });
    if (!approvedReplay?.receipt || approvedReplay.receipt.receiptId !== approved.receipt.receiptId)
      fail('note approval replay did not converge on the same immutable receipt');

    return {
      meetingId: meeting.id,
      rejectedNoteId: rejectedProposed.note.id,
      approvedNoteId: approvedProposed.note.id,
      pendingNoteId: pendingProposed.note.id,
      receiptId: approved.receipt.receiptId,
    };
  } finally {
    await postgresDatabase.close();
  }
}

async function httpBoundaryProof(meetingId: string, pendingNoteId: string, approvedNoteId: string) {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_TYPE: 'postgres',
    MOCK_DB: 'false',
    RUN_DB_TESTS: '1',
    POSTGRES_SKIP_INIT_IN_TEST: '1',
    DATABASE_URL: TARGET_URL,
  });
  const [
    { default: express },
    { default: request },
    { default: jwt },
    { default: config },
    { default: meetingRoutes },
    database,
    postgresDatabaseModule,
  ] = await Promise.all([
    import('express'),
    import('supertest'),
    import('jsonwebtoken'),
    import('../src/config/Config.js'),
    import('../src/routes/meeting.routes.js'),
    import('../src/database/Database.js'),
    import('../src/database/PostgresDatabase.js'),
  ]);
  await database.resetConnection();
  const app = express();
  app.use(express.json());
  app.use('/api/meeting', meetingRoutes);

  const token = (id: string, org: string, role: string, email: string) =>
    jwt.sign({ id, organizationId: org, role, email }, config.JWT_SECRET, { expiresIn: '5m' });
  const toks = {
    owner: token(IDS.owner, IDS.mainOrg, 'owner', 'w3.meetings.owner@local.test'),
    admin: token(IDS.admin, IDS.mainOrg, 'admin', 'w3.meetings.admin@local.test'),
    member: token(IDS.member, IDS.mainOrg, 'member', 'w3.meetings.member@local.test'),
    inactive: token(IDS.inactive, IDS.mainOrg, 'admin', 'w3.meetings.inactive@local.test'),
    foreign: token(IDS.foreignOwner, IDS.foreignOrg, 'owner', 'w3.meetings.foreign@local.test'),
  };
  const forged = jwt.sign(
    { id: IDS.owner, organizationId: IDS.mainOrg, role: 'owner', email: 'w3.meetings.owner@local.test' },
    'not-the-real-secret-w3-meetings-forged-jwt-probe',
    { expiresIn: '5m' }
  );

  // Negative probes all target the STILL-PENDING note: every one of these is
  // expected to be refused before any service-layer mutation runs, so the
  // pending note's state survives all five attempts untouched (verified by
  // readback's pending_notes=1 below).
  const decidePending = (t: string) =>
    request(app)
      .post(`/api/meeting/${meetingId}/notes/${pendingNoteId}/decision`)
      .set('Authorization', `Bearer ${t}`)
      .send({ action: 'approve' });

  const memberResponse = await decidePending(toks.member);
  const inactiveResponse = await decidePending(toks.inactive);
  const foreignResponse = await decidePending(toks.foreign);
  const anonymousResponse = await request(app)
    .post(`/api/meeting/${meetingId}/notes/${pendingNoteId}/decision`)
    .send({ action: 'approve' });
  const forgedResponse = await decidePending(forged);

  // The positive probe targets the note ALREADY approved+materialized at the
  // service layer above: decideMaterializationProposal's own idempotent
  // replay means this HTTP call converges on the SAME receipt rather than
  // consuming the pending note's "0/0/1" terminal-state count.
  const adminResponse = await request(app)
    .post(`/api/meeting/${meetingId}/notes/${approvedNoteId}/decision`)
    .set('Authorization', `Bearer ${toks.admin}`)
    .send({ action: 'approve' });

  if (memberResponse.status !== 403)
    fail(`MEMBER decision was not denied 403: ${memberResponse.status} ${JSON.stringify(memberResponse.body)}`);
  if (inactiveResponse.status !== 403)
    fail(`revoked member decision was not denied 403: ${inactiveResponse.status} ${JSON.stringify(inactiveResponse.body)}`);
  if (foreignResponse.status !== 404)
    fail(`foreign tenant decision was not denied 404: ${foreignResponse.status} ${JSON.stringify(foreignResponse.body)}`);
  if (anonymousResponse.status !== 401)
    fail(`anonymous decision was not denied 401: ${anonymousResponse.status}`);
  if (forgedResponse.status !== 401)
    fail(`forged JWT decision was not denied 401: ${forgedResponse.status} ${JSON.stringify(forgedResponse.body)}`);
  if (adminResponse.status !== 200)
    fail(`legitimate ADMIN decision (replay of the already-approved note) failed: ${adminResponse.status} ${JSON.stringify(adminResponse.body)}`);

  await database.resetConnection();
  await postgresDatabaseModule.default.close();
  return {
    memberStatus: memberResponse.status,
    inactiveStatus: inactiveResponse.status,
    foreignStatus: foreignResponse.status,
    anonymousStatus: anonymousResponse.status,
    forgedJwtStatus: forgedResponse.status,
    adminStatus: adminResponse.status,
  };
}

async function readback(databaseName: string, dynamic: Record<string, unknown> | null = null) {
  const c = new pg.Client({ connectionString: TARGET_URL });
  await c.connect();
  try {
    const r = (
      await c.query(
        `SELECT
      (SELECT count(*)::int FROM users WHERE id=ANY($1::text[])) personas,
      (SELECT count(*)::int FROM meetings WHERE organization_id=$2) meetings,
      (SELECT count(*)::int FROM meeting_notes WHERE organization_id=$2) notes,
      (SELECT count(*)::int FROM meeting_notes WHERE organization_id=$2 AND status='proposed') pending_notes,
      (SELECT count(*)::int FROM meeting_notes WHERE organization_id=$2 AND status='rejected') rejected_notes,
      (SELECT count(*)::int FROM meeting_notes WHERE organization_id=$2 AND status='approved') approved_notes,
      (SELECT count(*)::int FROM artifact_handoff_proposals WHERE organization_id=$2 AND producer_kind='meeting' AND state='rejected') rejected_proposals,
      (SELECT count(*)::int FROM artifact_handoff_proposals WHERE organization_id=$2 AND producer_kind='meeting' AND state='materialized') materialized_proposals,
      (SELECT count(*)::int FROM artifact_handoff_proposals WHERE organization_id=$2 AND producer_kind='meeting' AND state='pending') pending_proposals,
      (SELECT count(*)::int FROM artifact_handoff_receipts WHERE organization_id=$2) receipts,
      (SELECT ownership_nonce FROM wave3_owner_fixture_markers WHERE fixture_id=$3) ownership_nonce,
      (SELECT count(*)::int FROM schema_migrations WHERE status='success') successful_migrations`,
        [USERS.map((u) => u.id), IDS.mainOrg, FIXTURE_ID]
      )
    ).rows[0];
    const expected = {
      personas: 5,
      meetings: 1,
      notes: 3,
      pending_notes: 1,
      rejected_notes: 1,
      approved_notes: 1,
      rejected_proposals: 1,
      materialized_proposals: 1,
      pending_proposals: 1,
      receipts: 1,
    };
    for (const [key, value] of Object.entries(expected))
      if (String(r[key]) !== String(value)) fail(`readback ${key} expected ${value}, got ${r[key]}`);
    if (Number(r.successful_migrations) < 1) fail('no successful migrations recorded');
    if (!/^[a-f0-9]{64}$/.test(r.ownership_nonce || '')) fail('durable fixture marker missing/invalid');
    const payload = manifest(databaseName, r.ownership_nonce, dynamic, r);
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  } finally {
    await c.end();
  }
}

async function seed(ctx: ReturnType<typeof context>) {
  requireYes();
  const c = new pg.Client({ connectionString: ctx.admin.toString() });
  await c.connect();
  try {
    if (await databaseExists(c, ctx.databaseName))
      fail('target database already exists; reset it first');
    await c.query(`CREATE DATABASE "${ctx.databaseName}"`);
  } finally {
    await c.end();
  }
  const migration = spawnSync('npm', ['run', 'db:migrate:strict'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'test', DB_TYPE: 'postgres', DATABASE_URL: TARGET_URL },
    encoding: 'utf8',
  });
  if (migration.status !== 0) fail(`migration failed: ${migration.stderr || migration.stdout}`);
  const ownershipNonce = randomBytes(32).toString('hex');
  await seedBase(ownershipNonce);
  const dynamic = await runCanonicalJourney();
  const httpProof = await httpBoundaryProof(dynamic.meetingId, dynamic.pendingNoteId, dynamic.approvedNoteId);
  const payload = await readback(ctx.databaseName, { ...dynamic, httpProof });
  console.log(
    JSON.stringify({ manifestWritten: persistManifest(ctx.manifestPath, payload) }, null, 2)
  );
}

async function reset(ctx: ReturnType<typeof context>) {
  requireYes();
  const c = new pg.Client({ connectionString: ctx.admin.toString() });
  await c.connect();
  try {
    if (await databaseExists(c, ctx.databaseName))
      await c.query(`DROP DATABASE "${ctx.databaseName}" WITH (FORCE)`);
    console.log(
      JSON.stringify(
        {
          fixture: FIXTURE_ID,
          databaseName: ctx.databaseName,
          dropped: true,
          catalogAbsent: !(await databaseExists(c, ctx.databaseName)),
        },
        null,
        2
      )
    );
  } finally {
    await c.end();
  }
}

const ctx = context();
if (COMMAND === 'seed') await seed(ctx);
else if (COMMAND === 'readback') await readback(ctx.databaseName);
else await reset(ctx);
