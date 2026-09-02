#!/usr/bin/env npx tsx
/**
 * Wave 3 / module 07 My Work — guarded local owner-review fixture.
 *
 * Follows the family contract established by
 * server/scripts/seed-wave3-initiatives-owner-review.ts: seed/readback/reset
 * against a disposable local-only PostgreSQL database, a durable
 * `wave3_owner_fixture_markers` row + FINAL `wx`/`0600` manifest (no
 * secrets), named personas, and a cold-SQL readback that field-compares
 * expected counters rather than trusting write-response shapes.
 *
 * G03/G04 contract this realizes, per
 * docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md:
 *   Allowed: active same-tenant inbox owner; an active requester plus a
 *            DIFFERENT active OWNER approver for restricted materialization.
 *   Denied:  inactive/revoked membership, foreign tenant, requester
 *            self-approval, body-identity spoof, stale/colliding caller,
 *            tenant-invalid worker job.
 *
 * ★ My Work shares its write engine with Execution (Runtime-v1); the legacy
 * `POST /api/tasks` route is deliberately retired (returns 409, not a
 * failure). This fixture never calls it. The only canonical write path for
 * agent-approved materialization is
 * server/src/services/myWork/agentApprovedMaterializationService.ts
 * (createMaterializationProposal / decideMaterializationProposal /
 * materializeApprovedProposal), which itself calls TaskService.createTask /
 * decisionService.createDecision / notebookService.createNotebookNote — the
 * SAME canonical writers the rest of the product uses, never the retired
 * legacy route. Calling the service directly (not the HTTP route) is
 * legitimate here for the same reason seed-wave3-initiatives-owner-review.ts
 * calls initiativeCandidateService directly: `requireUser`
 * (server/src/routes/my-work/_helpers.ts) does no more than what this
 * fixture reproduces explicitly — organizationId/requesterId always come
 * from the caller's own resolved identity, never from a request body, and
 * the service's OWN ownership/membership checks are exactly what "body
 * identity spoof" below exercises.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import pg from 'pg';

const COMMAND = process.argv[2] || 'readback';
const TARGET_URL = process.env.MYWORK_OWNER_FIXTURE_DATABASE_URL || '';
const CONFIRM = process.env.MYWORK_OWNER_FIXTURE_CONFIRM;
const MANIFEST_PATH = process.env.MYWORK_OWNER_FIXTURE_MANIFEST || '';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const DB_PREFIX = 'consultify_w3_my_work_owner_';
const FIXTURE_ID = 'W3-MY-WORK-OWNER-v1';
const FIXTURE_NAME = 'W3-MY-WORK-OWNER-v1';

const IDS = Object.freeze({
  mainOrg: '07000000-0000-4000-8000-000000000001',
  foreignOrg: '07000000-0000-4000-8000-000000000002',
  owner: '07000000-0000-4000-8000-000000000011',
  requester: '07000000-0000-4000-8000-000000000012',
  colleague: '07000000-0000-4000-8000-000000000013',
  inactive: '07000000-0000-4000-8000-000000000014',
  foreignOwner: '07000000-0000-4000-8000-000000000015',
  plan: '07000000-0000-4000-8000-000000000021',
});

const USERS = Object.freeze([
  {
    id: IDS.owner,
    org: IDS.mainOrg,
    email: 'w3.mywork.owner@local.test',
    role: 'OWNER',
    membership: 'ACTIVE',
    firstName: 'Piotr',
    lastName: 'Wisniewski',
    purpose: 'allowed: inbox owner; distinct OWNER approver for restricted materialization',
    password: 'Wave3MywOwner!2026',
  },
  {
    id: IDS.requester,
    org: IDS.mainOrg,
    email: 'w3.mywork.requester@local.test',
    // ADMIN (not MEMBER): reviewer-role rank is checked BEFORE self-approval
    // in decideMaterializationProposal (server/src/services/myWork/
    // agentApprovedMaterializationService.ts:140-148) — a MEMBER requester
    // would hit MYW_AGENT_REVIEWER_FORBIDDEN before ever reaching the
    // self-approval check, masking the boundary this fixture exists to
    // prove. The requester must itself rank OWNER/ADMIN to demonstrate that
    // even a privileged actor cannot approve their own proposal.
    role: 'ADMIN',
    membership: 'ACTIVE',
    firstName: 'Ewa',
    lastName: 'Nowicka',
    purpose: 'allowed: active requester owning the source Agent plan (ADMIN, so the self-approval boundary is reachable)',
    password: 'Wave3MywRequester!2026',
  },
  {
    id: IDS.colleague,
    org: IDS.mainOrg,
    email: 'w3.mywork.colleague@local.test',
    role: 'MEMBER',
    membership: 'ACTIVE',
    firstName: 'Marek',
    lastName: 'Nowak',
    purpose: 'denied: body-identity spoof (active, but does not own the source plan)',
    password: 'Wave3MywColleague!2026',
  },
  {
    id: IDS.inactive,
    org: IDS.mainOrg,
    email: 'w3.mywork.inactive@local.test',
    role: 'ADMIN',
    membership: 'REVOKED',
    firstName: 'Nieaktywny',
    lastName: 'Uzytkownik',
    purpose: 'denied: inactive/revoked membership',
    password: 'Wave3MywInactive!2026',
  },
  {
    id: IDS.foreignOwner,
    org: IDS.foreignOrg,
    email: 'w3.mywork.foreign@local.test',
    role: 'OWNER',
    membership: 'ACTIVE',
    firstName: 'Obcy',
    lastName: 'Wlasciciel',
    purpose: 'denied: foreign tenant / tenant-invalid worker job',
    password: 'Wave3MywForeign!2026',
  },
]);

function fail(message: string): never {
  throw new Error(`[W3 My Work fixture] BLOCKED: ${message}`);
}

function context() {
  if (!TARGET_URL) fail('MYWORK_OWNER_FIXTURE_DATABASE_URL is required');
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
    !/^consultify_w3_my_work_owner_[a-z0-9_]+$/.test(databaseName)
  ) {
    fail(`database name must match ${DB_PREFIX}* using lowercase letters, digits and underscores`);
  }
  const admin = new URL(target);
  admin.pathname = '/postgres';
  if (COMMAND === 'seed') {
    if (!MANIFEST_PATH) fail('MYWORK_OWNER_FIXTURE_MANIFEST is required for seed');
    if (!path.isAbsolute(MANIFEST_PATH) || MANIFEST_PATH.includes('://'))
      fail('MYWORK_OWNER_FIXTURE_MANIFEST must be an absolute local filesystem path');
    if (fs.existsSync(MANIFEST_PATH)) fail('manifest path already exists; overwrite is refused');
  }
  return { admin, databaseName, manifestPath: MANIFEST_PATH };
}

function requireYes() {
  if (CONFIRM !== 'YES') fail('seed/reset requires MYWORK_OWNER_FIXTURE_CONFIRM=YES');
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
    legacyWritersInvoked: false,
    legacyTasksRouteRetired: 'POST /api/tasks returns 409; this fixture never calls it',
    aiGenerationInvoked: false,
    personas: USERS.map(({ password: _password, ...persona }) => persona),
    journey: [
      'requester owns one Agent plan (ai_agent_plans, deterministic plan_json)',
      'createMaterializationProposal x3 (task/decision/notebook targets) by requester',
      'boundary: idempotency replay, idempotency payload collision, source drift',
      'boundary: body-identity spoof (colleague claims a plan they do not own)',
      'boundary: inactive/revoked requester, foreign-tenant requester',
      'boundary: stale/colliding decision (wrong expectedStateVersion)',
      'boundary: requester self-approval forbidden',
      'decideMaterializationProposal: owner APPROVEs task+decision proposals, REJECTs the notebook proposal',
      'materializeApprovedProposal: task -> TaskService.createTask, decision -> decisionService.createDecision (canonical writers, not the retired /api/tasks route)',
      'boundary: materialize replay converges on the same receipt',
      'boundary: tenant-invalid worker job (materialize called with the wrong organizationId)',
      'boundary: reviewer-forbidden materialize (actor is not the recorded approver)',
    ],
    boundaries: {
      inactiveOrRevokedMembership: 'MYW_AGENT_ACTIVE_MEMBERSHIP_REQUIRED',
      foreignTenant: 'MYW_AGENT_SOURCE_NOT_FOUND (cross-org plan invisible) / MYW_AGENT_PROPOSAL_NOT_FOUND (cross-org materialize)',
      requesterSelfApproval: 'MYW_AGENT_SELF_APPROVAL_FORBIDDEN',
      bodyIdentitySpoof: 'MYW_AGENT_SOURCE_NOT_FOUND (claimed plan not owned by the calling identity)',
      staleOrCollidingCaller: 'MYW_AGENT_PROPOSAL_STALE / MYW_AGENT_MATERIALIZATION_STALE / MYW_AGENT_IDEMPOTENCY_COLLISION',
      tenantInvalidWorkerJob: 'MYW_AGENT_PROPOSAL_NOT_FOUND (materialize scoped to the wrong organization)',
      reviewerForbidden: 'MYW_AGENT_REVIEWER_FORBIDDEN',
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
      `INSERT INTO organizations(id,name) VALUES($1,'W3 My Work Owner Review'),($2,'W3 My Work Foreign Boundary')`,
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
    const planJson = JSON.stringify([
      { step: 1, action: 'gather_evidence', status: 'done' },
      { step: 2, action: 'draft_summary', status: 'done' },
    ]);
    await c.query(
      `INSERT INTO ai_agent_plans(id,organization_id,user_id,title,description,status,total_steps,completed_steps,current_step_index,plan_json,result_summary,is_background)
       VALUES($1,$2,$3,'W3 owner-review agent plan','Deterministic plan backing the My Work materialization fixture','completed',2,2,2,$4,'Plan finished; two candidate outputs ready for governed materialization',FALSE)`,
      [IDS.plan, IDS.mainOrg, IDS.requester, planJson]
    );
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
  const svc = await import('../src/services/myWork/agentApprovedMaterializationService.js');
  const postgresDatabase = (await import('../src/database/PostgresDatabase.js')).default;

  async function expectError(op: () => Promise<unknown>, code: string, label: string) {
    try {
      await op();
      fail(`boundary ${label} unexpectedly succeeded`);
    } catch (error) {
      if ((error as Error).message !== code)
        fail(`boundary ${label} expected ${code}, got ${(error as Error).message}`);
    }
  }

  try {
    const identity = await svc.getAgentPlanSourceIdentity(IDS.mainOrg, IDS.plan, IDS.requester);

    const taskContent = { title: 'W3 owner-review: potwierdz dane pilotazowe', description: 'Materializacja z Agent plan (task).' };
    const decisionContent = { title: 'W3 owner-review: zatwierdz zrodlo prognozy', description: 'Materializacja z Agent plan (decision).' };
    const notebookContent = { title: 'W3 owner-review: notatka odrzucona', description: 'Materializacja z Agent plan (notebook, odrzucona).' };

    const taskProposalInput = {
      organizationId: IDS.mainOrg,
      requesterId: IDS.requester,
      sourcePlanId: IDS.plan,
      sourceVersion: identity.sourceVersion,
      sourceHash: identity.sourceHash,
      targetKind: 'task' as const,
      content: taskContent,
      idempotencyKey: 'w3-myw-proposal-task-v1',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    };
    const taskCreated = await svc.createMaterializationProposal(taskProposalInput);
    if (taskCreated.replayed) fail('first task proposal creation reported a replay');
    const taskReplay = await svc.createMaterializationProposal(taskProposalInput);
    if (!taskReplay.replayed || taskReplay.proposal.proposal_id !== taskCreated.proposal.proposal_id)
      fail('task proposal replay did not converge');

    await expectError(
      () =>
        svc.createMaterializationProposal({
          ...taskProposalInput,
          content: { ...taskContent, title: 'Collision payload' },
        }),
      'MYW_AGENT_IDEMPOTENCY_COLLISION',
      'idempotency collision'
    );
    await expectError(
      () =>
        svc.createMaterializationProposal({
          ...taskProposalInput,
          idempotencyKey: 'w3-myw-proposal-drift-v1',
          sourceVersion: identity.sourceVersion + 999,
        }),
      'MYW_AGENT_SOURCE_DRIFT',
      'source drift'
    );
    await expectError(
      () =>
        svc.createMaterializationProposal({
          ...taskProposalInput,
          requesterId: IDS.colleague,
          idempotencyKey: 'w3-myw-proposal-spoof-v1',
        }),
      'MYW_AGENT_SOURCE_NOT_FOUND',
      'body-identity spoof'
    );
    await expectError(
      () =>
        svc.createMaterializationProposal({
          ...taskProposalInput,
          requesterId: IDS.inactive,
          idempotencyKey: 'w3-myw-proposal-inactive-v1',
        }),
      'MYW_AGENT_ACTIVE_MEMBERSHIP_REQUIRED',
      'inactive/revoked requester'
    );
    await expectError(
      () =>
        svc.createMaterializationProposal({
          ...taskProposalInput,
          organizationId: IDS.foreignOrg,
          requesterId: IDS.foreignOwner,
          idempotencyKey: 'w3-myw-proposal-foreign-v1',
        }),
      'MYW_AGENT_SOURCE_NOT_FOUND',
      'foreign tenant requester'
    );

    const decisionCreated = await svc.createMaterializationProposal({
      ...taskProposalInput,
      targetKind: 'decision',
      content: decisionContent,
      idempotencyKey: 'w3-myw-proposal-decision-v1',
    });
    const notebookCreated = await svc.createMaterializationProposal({
      ...taskProposalInput,
      targetKind: 'notebook',
      content: notebookContent,
      idempotencyKey: 'w3-myw-proposal-notebook-v1',
    });

    await expectError(
      () =>
        svc.decideMaterializationProposal({
          proposalId: taskCreated.proposal.proposal_id,
          organizationId: IDS.mainOrg,
          approverId: IDS.owner,
          decision: 'APPROVE',
          expectedStateVersion: 999,
          sourceHash: identity.sourceHash,
        }),
      'MYW_AGENT_PROPOSAL_STALE',
      'stale/colliding decide caller'
    );
    await expectError(
      () =>
        svc.decideMaterializationProposal({
          proposalId: taskCreated.proposal.proposal_id,
          organizationId: IDS.mainOrg,
          approverId: IDS.requester,
          decision: 'APPROVE',
          expectedStateVersion: taskCreated.proposal.state_version,
          sourceHash: identity.sourceHash,
        }),
      'MYW_AGENT_SELF_APPROVAL_FORBIDDEN',
      'requester self-approval'
    );

    const taskDecided = await svc.decideMaterializationProposal({
      proposalId: taskCreated.proposal.proposal_id,
      organizationId: IDS.mainOrg,
      approverId: IDS.owner,
      decision: 'APPROVE',
      expectedStateVersion: taskCreated.proposal.state_version,
      sourceHash: identity.sourceHash,
    });
    if (taskDecided.proposal.state !== 'APPROVED') fail('task proposal was not approved');

    const decisionDecided = await svc.decideMaterializationProposal({
      proposalId: decisionCreated.proposal.proposal_id,
      organizationId: IDS.mainOrg,
      approverId: IDS.owner,
      decision: 'APPROVE',
      expectedStateVersion: decisionCreated.proposal.state_version,
      sourceHash: identity.sourceHash,
    });
    if (decisionDecided.proposal.state !== 'APPROVED') fail('decision proposal was not approved');

    const notebookDecided = await svc.decideMaterializationProposal({
      proposalId: notebookCreated.proposal.proposal_id,
      organizationId: IDS.mainOrg,
      approverId: IDS.owner,
      decision: 'REJECT',
      expectedStateVersion: notebookCreated.proposal.state_version,
      sourceHash: identity.sourceHash,
    });
    if (notebookDecided.proposal.state !== 'REJECTED') fail('notebook proposal was not rejected');

    await expectError(
      () =>
        svc.materializeApprovedProposal({
          proposalId: taskDecided.proposal.proposal_id,
          organizationId: IDS.mainOrg,
          actorId: IDS.owner,
          expectedStateVersion: 999,
        }),
      'MYW_AGENT_MATERIALIZATION_STALE',
      'stale materialize caller'
    );
    await expectError(
      () =>
        svc.materializeApprovedProposal({
          proposalId: taskDecided.proposal.proposal_id,
          organizationId: IDS.foreignOrg,
          actorId: IDS.foreignOwner,
          expectedStateVersion: taskDecided.proposal.state_version,
        }),
      'MYW_AGENT_PROPOSAL_NOT_FOUND',
      'tenant-invalid worker job'
    );
    await expectError(
      () =>
        svc.materializeApprovedProposal({
          proposalId: taskDecided.proposal.proposal_id,
          organizationId: IDS.mainOrg,
          actorId: IDS.requester,
          expectedStateVersion: taskDecided.proposal.state_version,
        }),
      'MYW_AGENT_REVIEWER_FORBIDDEN',
      'reviewer-forbidden materialize'
    );

    const taskMaterialized = await svc.materializeApprovedProposal({
      proposalId: taskDecided.proposal.proposal_id,
      organizationId: IDS.mainOrg,
      actorId: IDS.owner,
      expectedStateVersion: taskDecided.proposal.state_version,
    });
    if (('replayed' in taskMaterialized && taskMaterialized.replayed) || taskMaterialized.receipt.status !== 'SUCCEEDED')
      fail(`task materialization did not succeed: ${JSON.stringify(taskMaterialized)}`);
    const taskReplayMaterialize = await svc.materializeApprovedProposal({
      proposalId: taskDecided.proposal.proposal_id,
      organizationId: IDS.mainOrg,
      actorId: IDS.owner,
      expectedStateVersion: taskDecided.proposal.state_version,
    });
    if (!taskReplayMaterialize.replayed || taskReplayMaterialize.receipt.receipt_id !== taskMaterialized.receipt.receipt_id)
      fail('task materialize replay did not converge on the same receipt');

    const decisionMaterialized = await svc.materializeApprovedProposal({
      proposalId: decisionDecided.proposal.proposal_id,
      organizationId: IDS.mainOrg,
      actorId: IDS.owner,
      expectedStateVersion: decisionDecided.proposal.state_version,
    });
    if (('replayed' in decisionMaterialized && decisionMaterialized.replayed) || decisionMaterialized.receipt.status !== 'SUCCEEDED')
      fail(`decision materialization did not succeed: ${JSON.stringify(decisionMaterialized)}`);

    return {
      planId: IDS.plan,
      taskProposalId: taskCreated.proposal.proposal_id,
      decisionProposalId: decisionCreated.proposal.proposal_id,
      notebookProposalId: notebookCreated.proposal.proposal_id,
      taskTargetId: taskMaterialized.receipt.target_id,
      decisionTargetId: decisionMaterialized.receipt.target_id,
    };
  } finally {
    await postgresDatabase.close();
  }
}

async function readback(databaseName: string, dynamic: Record<string, unknown> | null = null) {
  const c = new pg.Client({ connectionString: TARGET_URL });
  await c.connect();
  try {
    const r = (
      await c.query(
        `SELECT
      (SELECT count(*)::int FROM users WHERE id=ANY($1::text[])) personas,
      (SELECT count(*)::int FROM ai_agent_plans WHERE organization_id=$2 AND user_id=$3) source_plans,
      (SELECT count(*)::int FROM myw_agent_materialization_proposals WHERE organization_id=$2) proposals,
      (SELECT count(*)::int FROM myw_agent_materialization_proposals WHERE organization_id=$2 AND state='MATERIALIZED') materialized_proposals,
      (SELECT count(*)::int FROM myw_agent_materialization_proposals WHERE organization_id=$2 AND state='REJECTED') rejected_proposals,
      (SELECT count(*)::int FROM myw_agent_materialization_proposals WHERE organization_id=$2 AND state='PENDING') pending_proposals,
      (SELECT count(*)::int FROM myw_agent_materialization_approvals WHERE organization_id=$2) approvals,
      (SELECT count(*)::int FROM myw_agent_materialization_approvals a JOIN myw_agent_materialization_proposals p ON p.proposal_id=a.proposal_id WHERE a.organization_id=$2 AND a.approver_id<>p.requester_id) distinct_approver_approvals,
      (SELECT count(*)::int FROM myw_agent_materialization_receipts WHERE organization_id=$2 AND status='SUCCEEDED') succeeded_receipts,
      (SELECT count(*)::int FROM myw_agent_materialization_receipts r JOIN myw_agent_materialization_proposals p ON p.proposal_id=r.proposal_id WHERE r.organization_id=$2 AND p.target_kind='task' AND r.status='SUCCEEDED') task_receipts,
      (SELECT count(*)::int FROM myw_agent_materialization_receipts r JOIN myw_agent_materialization_proposals p ON p.proposal_id=r.proposal_id WHERE r.organization_id=$2 AND p.target_kind='decision' AND r.status='SUCCEEDED') decision_receipts,
      (SELECT count(*)::int FROM tasks WHERE organization_id=$2 AND source_type='myw_agent_proposal') materialized_tasks,
      (SELECT count(*)::int FROM decisions WHERE organization_id=$2 AND source_type='myw_agent_proposal') materialized_decisions,
      (SELECT count(*)::int FROM ai_agent_plans WHERE organization_id=$5 AND user_id=$6) foreign_plans_visible_cross_tenant,
      (SELECT ownership_nonce FROM wave3_owner_fixture_markers WHERE fixture_id=$4) ownership_nonce,
      (SELECT count(*)::int FROM schema_migrations WHERE status='success') successful_migrations`,
        [USERS.map((u) => u.id), IDS.mainOrg, IDS.requester, FIXTURE_ID, IDS.foreignOrg, IDS.foreignOwner]
      )
    ).rows[0];
    const expected = {
      personas: 5,
      source_plans: 1,
      proposals: 3,
      materialized_proposals: 2,
      rejected_proposals: 1,
      pending_proposals: 0,
      approvals: 3,
      distinct_approver_approvals: 3,
      succeeded_receipts: 2,
      task_receipts: 1,
      decision_receipts: 1,
      materialized_tasks: 1,
      materialized_decisions: 1,
      foreign_plans_visible_cross_tenant: 0,
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
  const payload = await readback(ctx.databaseName, dynamic);
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
