#!/usr/bin/env npx tsx
/**
 * Wave 3 / module 06 Execution — guarded local owner-review fixture.
 *
 * Follows the family contract established by
 * server/scripts/seed-wave3-initiatives-owner-review.ts: seed/readback/reset
 * against a disposable local-only PostgreSQL database, a durable
 * `wave3_owner_fixture_markers` row + FINAL `wx`/`0600` manifest (no
 * secrets), named personas, and a cold-SQL readback that field-compares
 * expected counters rather than trusting write-response shapes.
 *
 * G03 (named allowed/denied personas) and G04 (reproducible realistic +
 * boundary fixtures) contract this realizes, per
 * docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md:
 *   Allowed: active same-tenant OWNER/ADMIN plus a distinct evidence approver.
 *   Denied:  MEMBER for a governed mutation, inactive/revoked member,
 *            foreign tenant, forged JWT, stale CAS writer,
 *            hidden/unregistered action caller.
 *
 * Two execution lineages are seeded, deliberately kept separate rather than
 * forced onto one initiative:
 *   - initiativeA/caseA: the canonical RUNTIME_V1 handoff (Initiative ->
 *     Execution Case, via executionBvpService.linkRuntimeInitiativeToExecutionCase)
 *     — this is the "deterministic accepted runtime-v1 Initiative/Handoff/
 *     Execution Case snapshot" G04 asks for.
 *   - initiativeB/caseB: a legacy case_core Case (executionBvpService.
 *     linkInitiativeToExecutionCase — NOT retired; execution_legacy_writer_retired
 *     only fires when a RUNTIME_V1 alias already exists for that exact
 *     legacy (initiativeId,caseId) pair, which this fixture never creates)
 *     carried through work/resource/control refs, one evidence artifact,
 *     distinct-approver evidence approval and governed close, which emits
 *     the immutable Results signal receipt. This split exists because
 *     submitDeliveryEvidence() joins evidence artifacts to a Case through
 *     execution_case_links.case_id, which the RUNTIME_V1 source_identity
 *     check constraint forces to NULL — evidence submission is not
 *     structurally reachable on a pure RUNTIME_V1 link today. Recording
 *     this honestly here rather than papering over it with a single
 *     artificial link.
 *
 * Governed action policy (execution_action_registry, seeded by
 * server/migrations/20260908_execution_bvp_spine.sql) backs the
 * budget-delete governed action and the hidden/unregistered-action denial.
 *
 * Forged JWT is exercised at the real HTTP layer: a minimal Express app
 * mounts verifyToken -> validateOrgMembership -> attachV8Context ->
 * executionBvp.routes.ts (the same middleware chain
 * server/src/routes/caseWorkspace/index.ts requires upstream), and a token
 * signed with the WRONG secret is rejected with 401 before any route logic
 * runs — mirrors seed-wave3-assessment-owner-review.ts's coldApiProof
 * pattern (supertest + a real router, not a hand-rolled stub).
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import pg from 'pg';

const COMMAND = process.argv[2] || 'readback';
const TARGET_URL = process.env.EXECUTION_OWNER_FIXTURE_DATABASE_URL || '';
const CONFIRM = process.env.EXECUTION_OWNER_FIXTURE_CONFIRM;
const MANIFEST_PATH = process.env.EXECUTION_OWNER_FIXTURE_MANIFEST || '';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const DB_PREFIX = 'consultify_w3_execution_owner_';
const FIXTURE_ID = 'W3-EXECUTION-OWNER-v1';
const FIXTURE_NAME = 'W3-EXECUTION-OWNER-v1';

const IDS = Object.freeze({
  mainOrg: '06000000-0000-4000-8000-000000000001',
  foreignOrg: '06000000-0000-4000-8000-000000000002',
  owner: '06000000-0000-4000-8000-000000000011',
  admin: '06000000-0000-4000-8000-000000000012',
  member: '06000000-0000-4000-8000-000000000013',
  inactive: '06000000-0000-4000-8000-000000000014',
  foreignOwner: '06000000-0000-4000-8000-000000000015',
  candidateA: '06000000-0000-4000-8000-000000000021',
  candidateB: '06000000-0000-4000-8000-000000000022',
  executionCaseA: '06000000-0000-4000-8000-000000000031',
});

const USERS = Object.freeze([
  {
    id: IDS.owner,
    org: IDS.mainOrg,
    email: 'w3.execution.owner@local.test',
    role: 'OWNER',
    membership: 'ACTIVE',
    firstName: 'Piotr',
    lastName: 'Wisniewski',
    purpose: 'allowed: governed close, distinct evidence submitter',
    password: 'Wave3ExeOwner!2026',
  },
  {
    id: IDS.admin,
    org: IDS.mainOrg,
    email: 'w3.execution.admin@local.test',
    role: 'ADMIN',
    membership: 'ACTIVE',
    firstName: 'Anna',
    lastName: 'Kowalska',
    purpose: 'allowed: distinct evidence approver, budget delete actor',
    password: 'Wave3ExeAdmin!2026',
  },
  {
    id: IDS.member,
    org: IDS.mainOrg,
    email: 'w3.execution.member@local.test',
    role: 'MEMBER',
    membership: 'ACTIVE',
    firstName: 'Marek',
    lastName: 'Nowak',
    purpose: 'denied: MEMBER for governed mutation (insufficient_org_role)',
    password: 'Wave3ExeMember!2026',
  },
  {
    id: IDS.inactive,
    org: IDS.mainOrg,
    email: 'w3.execution.inactive@local.test',
    role: 'ADMIN',
    membership: 'REVOKED',
    firstName: 'Nieaktywny',
    lastName: 'Uzytkownik',
    purpose: 'denied: inactive/revoked member (not_org_member)',
    password: 'Wave3ExeInactive!2026',
  },
  {
    id: IDS.foreignOwner,
    org: IDS.foreignOrg,
    email: 'w3.execution.foreign@local.test',
    role: 'OWNER',
    membership: 'ACTIVE',
    firstName: 'Obcy',
    lastName: 'Wlasciciel',
    purpose: 'denied: foreign tenant (stale_or_not_found / not_org_member)',
    password: 'Wave3ExeForeign!2026',
  },
]);

function fail(message: string): never {
  throw new Error(`[W3 Execution fixture] BLOCKED: ${message}`);
}

function context() {
  if (!TARGET_URL) fail('EXECUTION_OWNER_FIXTURE_DATABASE_URL is required');
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
    !/^consultify_w3_execution_owner_[a-z0-9_]+$/.test(databaseName)
  ) {
    fail(`database name must match ${DB_PREFIX}* using lowercase letters, digits and underscores`);
  }
  const admin = new URL(target);
  admin.pathname = '/postgres';
  if (COMMAND === 'seed') {
    if (!MANIFEST_PATH) fail('EXECUTION_OWNER_FIXTURE_MANIFEST is required for seed');
    if (!path.isAbsolute(MANIFEST_PATH) || MANIFEST_PATH.includes('://'))
      fail('EXECUTION_OWNER_FIXTURE_MANIFEST must be an absolute local filesystem path');
    if (fs.existsSync(MANIFEST_PATH)) fail('manifest path already exists; overwrite is refused');
  }
  return { admin, databaseName, manifestPath: MANIFEST_PATH };
}

function requireYes() {
  if (CONFIRM !== 'YES') fail('seed/reset requires EXECUTION_OWNER_FIXTURE_CONFIRM=YES');
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
    legacyWritersInvoked: 'linkInitiativeToExecutionCase (not retired; no RUNTIME_V1 alias exists for the legacy pair used here)',
    aiGenerationInvoked: false,
    personas: USERS.map(({ password: _password, ...persona }) => persona),
    journey: [
      'lineage A: accept candidateA -> canonical DRAFT initiative (runtime-v1 read model IN_EXECUTION)',
      'lineage A: ie_aggregate_state execution_case ACTIVE + INITIATIVE_EXECUTION_CASE relation',
      'lineage A: linkRuntimeInitiativeToExecutionCase -> RUNTIME_V1 execution_case_links (replay + collision + stale + foreign boundaries)',
      'lineage B: accept candidateB -> canonical DRAFT initiative',
      'lineage B: caseCoreService.createCase on the same project -> case_core row',
      'lineage B: linkInitiativeToExecutionCase -> LEGACY_CASE_CORE execution_case_links',
      'lineage B: recordExecutionSpine (work/resource/control/report refs, CAS)',
      'lineage B: linkArtifactToCase (EVIDENCE) + pinArtifactRevision',
      'lineage B: submitDeliveryEvidence (owner) -> approveDeliveryEvidence (admin, distinct approver)',
      'lineage B: closeExecutionAndEmitResultsSignal -> immutable execution_results_signal_outbox row (replay converges)',
      'lineage B: executeBudgetDeleteCommand governed action (MEMBER denied, inactive denied, foreign denied, stale CAS denied, then SUCCEEDED; receipt append-only)',
      'requireImplementedExecutionAction: HIDDEN action + unregistered action both denied execution_action_hidden_or_unregistered',
      'HTTP layer: GET /execution-bvp/links/:linkId with a real owner JWT succeeds; a JWT forged with the wrong secret is rejected 401 before any route logic runs',
    ],
    boundaries: {
      memberGovernedMutation: 'insufficient_org_role (budget delete DENIED receipt)',
      inactiveMember: 'not_org_member (CaseWorkspaceAuthError)',
      foreignTenant: 'not_org_member / execution_runtime_initiative_stale_or_not_found',
      forgedJwt: 'HTTP 401 before route logic runs (wrong-secret signature)',
      staleCasWriter: 'execution_link_stale_or_not_found / budget_entry_version_conflict / execution_authority_version_conflict',
      hiddenOrUnregisteredAction: 'execution_action_hidden_or_unregistered',
      linkReplayCollision: 'execution_idempotency_payload_conflict',
      evidenceSelfApproveNotModeled: 'approveDeliveryEvidence enforces submitted_by<>approved_by structurally (owner submits, admin approves)',
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
      `INSERT INTO organizations(id,name) VALUES($1,'W3 Execution Owner Review'),($2,'W3 Execution Foreign Boundary')`,
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
    await c.query(
      `INSERT INTO initiative_candidates(id,organization_id,source_type,source_id,title,rationale,fit_score,status,created_by,problem,proposed_outcome,evidence_state,duplicate_state,provenance_json)
       VALUES($1,$2,'assessment-finding','w3-exe-assessment-output-a','Skrocenie przezbrojen linii A','Pilot skracajacy czas przezbrojen.',0.9,'pending',$3,'Dlugie przezbrojenia','Przezbrojenia krotsze o 25%','READY','CLEAR',$4),
             ($5,$2,'assessment-finding','w3-exe-assessment-output-b','Konsolidacja dostawcow komponentow','Governed case do zamkniecia z dowodem dostawy.',0.85,'pending',$3,'Rozproszeni dostawcy','Jeden governed dostawca kluczowy','READY','CLEAR',$4)`,
      [
        IDS.candidateA,
        IDS.mainOrg,
        IDS.owner,
        JSON.stringify({ fixture: FIXTURE_ID }),
        IDS.candidateB,
      ]
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
    REQUIRE_INITIATIVE_PROJECT: 'true',
  });
  const candidates = await import('../src/services/initiative/initiativeCandidateService.js');
  const execution = await import('../src/services/executionBvpService.js');
  const caseCoreService = await import('../src/services/caseWorkspace/caseCoreService.js');
  const artifactLinkService = await import('../src/services/caseWorkspace/artifactLinkService.js');
  const registry = await import('../src/services/executionActionRegistryService.js');
  const budgetDelete = await import('../src/services/executionBudgetDeleteCommandService.js');
  const { CaseWorkspaceAuthError } = await import(
    '../src/services/caseWorkspace/caseWorkspaceAuthContext.js'
  );
  const postgresDatabase = (await import('../src/database/PostgresDatabase.js')).default;
  const pgClient = new pg.Client({ connectionString: TARGET_URL });
  await pgClient.connect();

  async function expectError(op: () => Promise<unknown>, matcher: (error: unknown) => boolean, label: string) {
    try {
      await op();
      fail(`boundary ${label} unexpectedly succeeded`);
    } catch (error) {
      if (!matcher(error)) throw error;
    }
  }

  try {
    // ---- Lineage A: candidate -> initiative -> RUNTIME_V1 handoff ----
    const acceptedA = await candidates.acceptCandidate(undefined, IDS.candidateA, {
      orgId: IDS.mainOrg,
      userId: IDS.owner,
      fill: false,
    });
    if (!acceptedA?.receiptPersisted || !acceptedA.initiativeId)
      fail(`candidateA acceptance failed: ${JSON.stringify(acceptedA)}`);
    const initiativeA = acceptedA.initiativeId;
    const projectARow = await pgClient.query<{ project_id: string }>(
      `SELECT project_id FROM initiatives WHERE id=$1 AND organization_id=$2`,
      [initiativeA, IDS.mainOrg]
    );
    const projectA = String(projectARow.rows[0]?.project_id || '');
    if (!projectA) fail('lineage A initiative has no system portfolio project');

    await pgClient.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES($1,'initiative',$2,1,$3),($1,'execution_case',$4,1,$5)`,
      [
        IDS.mainOrg,
        initiativeA,
        JSON.stringify({
          initiativeId: initiativeA,
          projectId: projectA,
          lifecycleState: 'IN_EXECUTION',
          title: acceptedA.title,
          initiativeOwnerId: IDS.owner,
        }),
        IDS.executionCaseA,
        JSON.stringify({
          executionCaseId: IDS.executionCaseA,
          initiativeId: initiativeA,
          projectId: projectA,
          state: 'ACTIVE',
          title: 'Pilot przezbrojen linii A — wykonanie',
        }),
      ]
    );
    await pgClient.query(
      `INSERT INTO ie_aggregate_relations(organization_id,relation_type,source_type,source_id,source_version,target_type,target_id,payload_json) VALUES($1,'INITIATIVE_EXECUTION_CASE','initiative',$2,1,'execution_case',$3,$4)`,
      [IDS.mainOrg, initiativeA, IDS.executionCaseA, JSON.stringify({ fixture: true })]
    );

    const handoffInput = {
      organizationId: IDS.mainOrg,
      initiativeId: initiativeA,
      caseId: IDS.executionCaseA,
      sourceVersion: 1,
      actorId: IDS.owner,
      idempotencyKey: 'w3-exe-handoff-a-v1',
    };
    const link = await execution.linkRuntimeInitiativeToExecutionCase(handoffInput);
    const linkReplay = await execution.linkRuntimeInitiativeToExecutionCase(handoffInput);
    if (linkReplay.link_id !== link.link_id) fail('handoff replay did not converge');

    await expectError(
      () =>
        execution.linkRuntimeInitiativeToExecutionCase({
          ...handoffInput,
          caseId: '06000000-0000-4000-8000-000000000099',
        }),
      (e) => (e as Error).message === 'execution_idempotency_payload_conflict',
      'handoff idempotency collision'
    );
    await expectError(
      () =>
        execution.linkRuntimeInitiativeToExecutionCase({
          ...handoffInput,
          sourceVersion: 2,
          idempotencyKey: 'w3-exe-handoff-a-stale-v1',
        }),
      (e) => (e as Error).message === 'execution_runtime_initiative_stale_or_not_found',
      'stale CAS handoff writer'
    );
    await expectError(
      () =>
        execution.linkRuntimeInitiativeToExecutionCase({
          ...handoffInput,
          organizationId: IDS.foreignOrg,
          actorId: IDS.foreignOwner,
          idempotencyKey: 'w3-exe-handoff-a-foreign-v1',
        }),
      (e) => (e as Error).message === 'execution_runtime_initiative_stale_or_not_found',
      'foreign tenant handoff'
    );

    // ---- Lineage B: candidate -> initiative -> legacy case -> BVP journey ----
    const acceptedB = await candidates.acceptCandidate(undefined, IDS.candidateB, {
      orgId: IDS.mainOrg,
      userId: IDS.owner,
      fill: false,
    });
    if (!acceptedB?.receiptPersisted || !acceptedB.initiativeId)
      fail(`candidateB acceptance failed: ${JSON.stringify(acceptedB)}`);
    const initiativeB = acceptedB.initiativeId;
    const projectBRow = await pgClient.query<{ project_id: string }>(
      `SELECT project_id FROM initiatives WHERE id=$1 AND organization_id=$2`,
      [initiativeB, IDS.mainOrg]
    );
    const projectB = String(projectBRow.rows[0]?.project_id || '');
    if (!projectB) fail('lineage B initiative has no system portfolio project');

    const caseB = await caseCoreService.createCase({
      projectId: projectB,
      organizationId: IDS.mainOrg,
      caseName: 'W3 Execution owner-review — legacy case',
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: IDS.owner,
    });

    const legacyLinkInput = {
      organizationId: IDS.mainOrg,
      initiativeId: initiativeB,
      caseId: caseB.caseId,
      actorId: IDS.owner,
      idempotencyKey: 'w3-exe-legacy-link-b-v1',
    };
    const legacyLink = await execution.linkInitiativeToExecutionCase(legacyLinkInput);

    const spineInput = {
      organizationId: IDS.mainOrg,
      linkId: legacyLink.link_id,
      workRef: 'w3-exe-work-b-v1',
      resourceRef: 'w3-exe-resource-b-v1',
      controlRef: 'w3-exe-control-b-v1',
      reportRef: 'w3-exe-report-b-v1',
      expectedVersion: legacyLink.version,
    };
    await expectError(
      () => execution.recordExecutionSpine({ ...spineInput, expectedVersion: 999 }),
      (e) => (e as Error).message === 'execution_link_stale_or_not_found',
      'stale CAS spine writer'
    );
    const spined = await execution.recordExecutionSpine(spineInput);

    const artifactLink = await artifactLinkService.linkArtifactToCase({
      caseId: caseB.caseId,
      artifactType: 'document',
      artifactId: `w3-exe-deliverable-${caseB.caseId}`,
      relation: 'EVIDENCE',
      linkedByActorId: IDS.owner,
    });
    await artifactLinkService.pinArtifactRevision(
      artifactLink.linkId,
      'rev-1',
      { actorUserId: IDS.owner },
      'w3-exe owner-review fixture pin'
    );

    const evidence = await execution.submitDeliveryEvidence({
      organizationId: IDS.mainOrg,
      linkId: spined.link_id,
      artifactLinkId: artifactLink.linkId,
      contentDigest: 'a'.repeat(64),
      submittedBy: IDS.owner,
      idempotencyKey: 'w3-exe-evidence-b-v1',
    });
    const approvedEvidence = await execution.approveDeliveryEvidence({
      organizationId: IDS.mainOrg,
      evidenceId: evidence.evidence_id,
      approvedBy: IDS.admin,
      expectedVersion: evidence.version,
    });

    const closeInput = {
      organizationId: IDS.mainOrg,
      linkId: spined.link_id,
      evidenceId: approvedEvidence.evidence_id,
      expectedVersion: spined.version,
      idempotencyKey: 'w3-exe-close-b-v1',
    };
    const closed = await execution.closeExecutionAndEmitResultsSignal(closeInput);
    const closedReplay = await execution.closeExecutionAndEmitResultsSignal(closeInput);
    if (closedReplay.signalId !== closed.signalId || !closedReplay.replay)
      fail('close replay did not converge on the same Results signal');

    // ---- Governed budget-delete action on lineage B's initiative ----
    const budgetEntry = await pgClient.query<{ id: string; version: number }>(
      `INSERT INTO budget_entries(organization_id,initiative_id,entry_type,cost_type,category,amount,currency,description,created_by)
       VALUES($1,$2,'FORECAST','OPEX','Pilot',12000,'PLN','W3 owner-review governed delete target',$3)
       RETURNING id,version`,
      [IDS.mainOrg, initiativeB, IDS.owner]
    );
    const entryId = budgetEntry.rows[0].id;
    const entryVersion = Number(budgetEntry.rows[0].version);

    const deniedMember = await budgetDelete.executeBudgetDeleteCommand({
      organizationId: IDS.mainOrg,
      actorId: IDS.member,
      entryId,
      initiativeId: initiativeB,
      expectedVersion: entryVersion,
      idempotencyKey: 'w3-exe-budget-delete-member-v1',
    });
    if (deniedMember.outcome !== 'DENIED' || deniedMember.reasonCode !== 'insufficient_org_role')
      fail(`MEMBER governed budget delete was not denied: ${JSON.stringify(deniedMember)}`);

    await expectError(
      () =>
        budgetDelete.executeBudgetDeleteCommand({
          organizationId: IDS.mainOrg,
          actorId: IDS.inactive,
          entryId,
          initiativeId: initiativeB,
          expectedVersion: entryVersion,
          idempotencyKey: 'w3-exe-budget-delete-inactive-v1',
        }),
      (e) => e instanceof CaseWorkspaceAuthError && e.code === 'not_org_member',
      'inactive member governed budget delete'
    );
    await expectError(
      () =>
        budgetDelete.executeBudgetDeleteCommand({
          organizationId: IDS.mainOrg,
          actorId: IDS.foreignOwner,
          entryId,
          initiativeId: initiativeB,
          expectedVersion: entryVersion,
          idempotencyKey: 'w3-exe-budget-delete-foreign-v1',
        }),
      (e) => e instanceof CaseWorkspaceAuthError && e.code === 'not_org_member',
      'foreign tenant governed budget delete'
    );

    const staleDelete = await budgetDelete.executeBudgetDeleteCommand({
      organizationId: IDS.mainOrg,
      actorId: IDS.admin,
      entryId,
      initiativeId: initiativeB,
      expectedVersion: entryVersion + 7,
      idempotencyKey: 'w3-exe-budget-delete-stale-v1',
    });
    if (staleDelete.outcome !== 'CONFLICT' || staleDelete.reasonCode !== 'budget_entry_version_conflict')
      fail(`stale CAS budget delete was not a CONFLICT: ${JSON.stringify(staleDelete)}`);

    const succeededDelete = await budgetDelete.executeBudgetDeleteCommand({
      organizationId: IDS.mainOrg,
      actorId: IDS.admin,
      entryId,
      initiativeId: initiativeB,
      expectedVersion: entryVersion,
      idempotencyKey: 'w3-exe-budget-delete-succeed-v1',
    });
    if (succeededDelete.outcome !== 'SUCCEEDED' || !succeededDelete.result.deleted)
      fail(`governed budget delete did not succeed: ${JSON.stringify(succeededDelete)}`);

    await expectError(
      () =>
        pgClient.query(`UPDATE execution_budget_delete_receipts SET reason_code='tampered' WHERE receipt_id=$1`, [
          succeededDelete.receiptId,
        ]),
      (e) => /append-only/i.test(String((e as Error).message)),
      'immutable budget-delete receipt mutation'
    );

    // ---- Hidden / unregistered governed action caller ----
    await expectError(
      () => registry.requireImplementedExecutionAction('execution.initiative.archive'),
      (e) => (e as Error).message === 'execution_action_hidden_or_unregistered',
      'HIDDEN registered action caller'
    );
    await expectError(
      () => registry.requireImplementedExecutionAction('w3-exe-totally-unregistered-action'),
      (e) => (e as Error).message === 'execution_action_hidden_or_unregistered',
      'unregistered action caller'
    );

    return {
      initiativeA,
      projectA,
      handoffLinkId: link.link_id,
      initiativeB,
      projectB,
      caseB: caseB.caseId,
      legacyLinkId: legacyLink.link_id,
      evidenceId: approvedEvidence.evidence_id,
      resultsSignalId: closed.signalId,
      budgetEntryId: entryId,
      budgetDeleteReceiptId: succeededDelete.receiptId,
    };
  } finally {
    await pgClient.end();
    await postgresDatabase.close();
  }
}

async function forgedJwtHttpProof(linkId: string) {
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
    verifyTokenModule,
    { validateOrgMembership },
    { attachV8Context },
    { default: executionBvpRoutes },
    database,
    postgresDatabaseModule,
  ] = await Promise.all([
    import('express'),
    import('supertest'),
    import('jsonwebtoken'),
    import('../src/config/Config.js'),
    import('../src/middleware/auth.middleware.js'),
    import('../src/middleware/auth.middleware.js'),
    import('../src/middleware/v8Auth.middleware.js'),
    import('../src/routes/caseWorkspace/executionBvp.routes.js'),
    import('../src/database/Database.js'),
    import('../src/database/PostgresDatabase.js'),
  ]);
  await database.resetConnection();
  const verifyToken = verifyTokenModule.default;
  const app = express();
  app.use(express.json());
  app.use(verifyToken);
  app.use(validateOrgMembership);
  app.use(attachV8Context);
  app.use('/', executionBvpRoutes);

  const validToken = jwt.sign(
    { id: IDS.owner, organizationId: IDS.mainOrg, role: 'OWNER', email: 'w3.execution.owner@local.test' },
    config.JWT_SECRET,
    { expiresIn: '5m' }
  );
  const forgedToken = jwt.sign(
    { id: IDS.owner, organizationId: IDS.mainOrg, role: 'OWNER', email: 'w3.execution.owner@local.test' },
    'not-the-real-secret-w3-execution-forged-jwt-probe',
    { expiresIn: '5m' }
  );

  const okResponse = await request(app)
    .get(`/execution-bvp/links/${linkId}`)
    .set('Authorization', `Bearer ${validToken}`);
  const forgedResponse = await request(app)
    .get(`/execution-bvp/links/${linkId}`)
    .set('Authorization', `Bearer ${forgedToken}`);
  const anonymousResponse = await request(app).get(`/execution-bvp/links/${linkId}`);

  if (okResponse.status !== 200 || okResponse.body?.data?.link?.link_id !== linkId)
    fail(`cold HTTP owner readback failed: ${okResponse.status} ${JSON.stringify(okResponse.body)}`);
  if (forgedResponse.status !== 401)
    fail(`forged JWT was not rejected 401: ${forgedResponse.status} ${JSON.stringify(forgedResponse.body)}`);
  if (anonymousResponse.status !== 401)
    fail(`anonymous request was not rejected 401: ${anonymousResponse.status}`);

  await database.resetConnection();
  await postgresDatabaseModule.default.close();
  return {
    ownerStatus: okResponse.status,
    forgedJwtStatus: forgedResponse.status,
    anonymousStatus: anonymousResponse.status,
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
      (SELECT count(*)::int FROM execution_case_links WHERE organization_id=$2 AND source_kind='RUNTIME_V1') runtime_handoff_links,
      (SELECT count(*)::int FROM execution_case_links WHERE organization_id=$2 AND source_kind='LEGACY_CASE_CORE' AND status='CLOSED') closed_legacy_links,
      (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='initiative' AND payload_json->>'lifecycleState'='IN_EXECUTION') runtime_initiatives,
      (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='execution_case' AND payload_json->>'state'='ACTIVE') runtime_execution_cases,
      (SELECT count(*)::int FROM ie_aggregate_relations WHERE organization_id=$2 AND relation_type='INITIATIVE_EXECUTION_CASE') runtime_relations,
      (SELECT count(*)::int FROM execution_delivery_evidence WHERE organization_id=$2 AND approval_status='APPROVED' AND submitted_by<>approved_by) distinct_approved_evidence,
      (SELECT count(*)::int FROM execution_results_signal_outbox WHERE organization_id=$2) results_signals,
      (SELECT count(*)::int FROM execution_budget_delete_receipts WHERE organization_id=$2 AND outcome='SUCCEEDED') succeeded_budget_deletes,
      (SELECT count(*)::int FROM execution_budget_delete_receipts WHERE organization_id=$2 AND outcome='DENIED') denied_budget_deletes,
      (SELECT count(*)::int FROM execution_budget_delete_receipts WHERE organization_id=$2 AND outcome='CONFLICT') conflict_budget_deletes,
      (SELECT count(*)::int FROM budget_entries WHERE organization_id=$2) remaining_budget_entries,
      (SELECT count(*)::int FROM execution_action_registry WHERE runtime_state='HIDDEN') hidden_actions,
      (SELECT count(*)::int FROM execution_action_registry WHERE action_id='execution.budget.delete' AND minimum_role='ADMIN' AND runtime_state='IMPLEMENTED') budget_delete_policy,
      (SELECT ownership_nonce FROM wave3_owner_fixture_markers WHERE fixture_id=$3) ownership_nonce,
      (SELECT count(*)::int FROM schema_migrations WHERE status='success') successful_migrations`,
        [USERS.map((u) => u.id), IDS.mainOrg, FIXTURE_ID]
      )
    ).rows[0];
    const expected = {
      personas: 5,
      runtime_handoff_links: 1,
      closed_legacy_links: 1,
      runtime_initiatives: 1,
      runtime_execution_cases: 1,
      runtime_relations: 1,
      distinct_approved_evidence: 1,
      results_signals: 1,
      succeeded_budget_deletes: 1,
      denied_budget_deletes: 1,
      conflict_budget_deletes: 1,
      remaining_budget_entries: 0,
      hidden_actions: 4,
      budget_delete_policy: 1,
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
  const httpProof = await forgedJwtHttpProof(dynamic.handoffLinkId);
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
