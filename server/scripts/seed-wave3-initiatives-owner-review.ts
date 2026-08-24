#!/usr/bin/env npx tsx
/** Wave 3 / module 05 Initiatives — guarded local owner-review fixture. */

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import pg from 'pg';

const COMMAND = process.argv[2] || 'readback';
const TARGET_URL = process.env.INITIATIVES_OWNER_FIXTURE_DATABASE_URL || '';
const CONFIRM = process.env.INITIATIVES_OWNER_FIXTURE_CONFIRM;
const MANIFEST_PATH = process.env.INITIATIVES_OWNER_FIXTURE_MANIFEST || '';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const DB_PREFIX = 'consultify_w3_initiatives_owner_';
const FIXTURE_ID = 'W3-INITIATIVES-OWNER-v1';
const FIXTURE_NAME = 'W3-INITIATIVES-OWNER-v1';

const IDS = Object.freeze({
  mainOrg: '05000000-0000-4000-8000-000000000001',
  foreignOrg: '05000000-0000-4000-8000-000000000002',
  owner: '05000000-0000-4000-8000-000000000011',
  admin: '05000000-0000-4000-8000-000000000012',
  projectActor: '05000000-0000-4000-8000-000000000013',
  member: '05000000-0000-4000-8000-000000000014',
  inactive: '05000000-0000-4000-8000-000000000015',
  foreignOwner: '05000000-0000-4000-8000-000000000016',
  candidate: '05000000-0000-4000-8000-000000000021',
  alternateCandidate: '05000000-0000-4000-8000-000000000022',
  executionCase: '05000000-0000-4000-8000-000000000031',
  executionTaskOpen: '05000000-0000-4000-8000-000000000041',
  executionTaskBlocked: '05000000-0000-4000-8000-000000000042',
  executionDecision: '05000000-0000-4000-8000-000000000043',
  allocationOwner: '05000000-0000-4000-8000-000000000051',
  allocationMember: '05000000-0000-4000-8000-000000000052',
  managementSignal: '05000000-0000-4000-8000-000000000061',
  intervention: '05000000-0000-4000-8000-000000000062',
  reportDefinition: '05000000-0000-4000-8000-000000000071',
  reportRun: '05000000-0000-4000-8000-000000000072',
});

const USERS = Object.freeze([
  {
    id: IDS.owner,
    org: IDS.mainOrg,
    email: 'w3.initiatives.owner@local.test',
    role: 'OWNER',
    membership: 'ACTIVE',
    purpose: 'owner candidate acceptance and governed profile command',
    password: 'Wave3IniOwner!2026',
  },
  {
    id: IDS.admin,
    org: IDS.mainOrg,
    email: 'w3.initiatives.admin@local.test',
    role: 'ADMIN',
    membership: 'ACTIVE',
    purpose: 'allowed same-tenant admin alternate',
    password: 'Wave3IniAdmin!2026',
  },
  {
    id: IDS.projectActor,
    org: IDS.mainOrg,
    email: 'w3.initiatives.project.actor@local.test',
    role: 'MEMBER',
    membership: 'ACTIVE',
    purpose: 'system-portfolio PROJECT_MANAGER for capability-bound review',
    password: 'Wave3IniProject!2026',
  },
  {
    id: IDS.member,
    org: IDS.mainOrg,
    email: 'w3.initiatives.member@local.test',
    role: 'MEMBER',
    membership: 'ACTIVE',
    purpose: 'role-denied profile command',
    password: 'Wave3IniMember!2026',
  },
  {
    id: IDS.inactive,
    org: IDS.mainOrg,
    email: 'w3.initiatives.inactive@local.test',
    role: 'ADMIN',
    membership: 'REVOKED',
    purpose: 'inactive membership denial',
    password: 'Wave3IniInactive!2026',
  },
  {
    id: IDS.foreignOwner,
    org: IDS.foreignOrg,
    email: 'w3.initiatives.foreign@local.test',
    role: 'OWNER',
    membership: 'ACTIVE',
    purpose: 'foreign-tenant non-disclosure',
    password: 'Wave3IniForeign!2026',
  },
]);

function fail(message: string): never {
  throw new Error(`[W3 Initiatives fixture] BLOCKED: ${message}`);
}

function context() {
  if (!TARGET_URL) fail('INITIATIVES_OWNER_FIXTURE_DATABASE_URL is required');
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
    !/^consultify_w3_initiatives_owner_[a-z0-9_]+$/.test(databaseName)
  ) {
    fail(`database name must match ${DB_PREFIX}* using lowercase letters, digits and underscores`);
  }
  const admin = new URL(target);
  admin.pathname = '/postgres';
  if (COMMAND === 'seed') {
    if (!MANIFEST_PATH) fail('INITIATIVES_OWNER_FIXTURE_MANIFEST is required for seed');
    if (!path.isAbsolute(MANIFEST_PATH) || MANIFEST_PATH.includes('://'))
      fail('INITIATIVES_OWNER_FIXTURE_MANIFEST must be an absolute local filesystem path');
    if (fs.existsSync(MANIFEST_PATH)) fail('manifest path already exists; overwrite is refused');
  }
  return { admin, databaseName, manifestPath: MANIFEST_PATH };
}

function requireYes() {
  if (CONFIRM !== 'YES') fail('seed/reset requires INITIATIVES_OWNER_FIXTURE_CONFIRM=YES');
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
    deepLinks: {
      list: '/initiatives',
      candidateId: IDS.candidate,
      initiativeId: dynamic?.initiativeId ?? null,
      executionCaseId: IDS.executionCase,
      verified: false,
    },
    productionWrites: false,
    legacyWritersInvoked: false,
    aiGenerationInvoked: false,
    personas: USERS.map(({ password: _password, ...persona }) => persona),
    journey: [
      'pending candidate -> canonical acceptCandidate(fill=false)',
      'exactly one DRAFT initiative -> system portfolio project',
      'canonical versioned profile update plus immutable receipt',
      'runtime-v1 initiative/execution read models -> canonical execution_case_links command',
      'cold SQL readback of candidate, initiative, portfolio, receipt and Execution authority',
    ],
    boundaries: {
      candidateReplay: 'same initiative, no duplicate',
      profileReplay: 'same receipt',
      profileCollision: 'IDEMPOTENCY_PAYLOAD_COLLISION',
      staleProfile: 'PROFILE_VERSION_CONFLICT',
      foreignCandidate: 'not found / zero write',
      foreignProfile: 'INITIATIVE_NOT_FOUND',
      memberProfile: 'INITIATIVE_PROFILE_ROLE_REQUIRED',
      inactiveProfile: 'INITIATIVE_PROFILE_ROLE_REQUIRED',
      executionReplay: 'same link',
      executionCollision: 'execution_idempotency_payload_conflict',
      staleExecution: 'execution_runtime_initiative_stale_or_not_found',
      foreignExecution: 'execution_runtime_initiative_stale_or_not_found',
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
      `INSERT INTO organizations(id,name) VALUES($1,'W3 Initiatives Owner Review'),($2,'W3 Initiatives Foreign Boundary')`,
      [IDS.mainOrg, IDS.foreignOrg]
    );
    for (const user of USERS) {
      const hash = await bcrypt.hash(user.password, 10);
      await c.query(
        `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status,language,timezone) VALUES($1,$2,$3,$4,'Initiatives','Fixture',$5,'active','pl','Europe/Warsaw')`,
        [user.id, user.org, user.email, hash, user.role]
      );
      await c.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,$4,$5)`,
        [`membership-${user.id}`, user.org, user.id, user.role, user.membership]
      );
    }
    await c.query(
      `INSERT INTO initiative_candidates(id,organization_id,source_type,source_id,title,rationale,fit_score,status,created_by,problem,proposed_outcome,evidence_state,duplicate_state,provenance_json)
       VALUES($1,$2,'assessment-finding','w3-ini-assessment-output-v1','Automatyzacja planowania przezbrojeń','Skrócić czas planowania i ustabilizować terminowość produkcji.',0.92,'pending',$3,'Ręczne planowanie powoduje opóźnienia','Planowanie krótsze o 30%','READY','CLEAR',$4),
             ($5,$2,'assessment-finding','w3-ini-assessment-output-alt','Alternatywny kandydat graniczny','Nieprzyjęty wariant do kontroli tenant/stale.',0.42,'pending',$3,'Granica testowa','Brak materializacji','UNKNOWN','UNKNOWN',$4)`,
      [
        IDS.candidate,
        IDS.mainOrg,
        IDS.owner,
        JSON.stringify({ fixture: 'W3-INITIATIVES-OWNER-v1' }),
        IDS.alternateCandidate,
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
  const profiles = await import('../src/services/initiative/initiativeProfileService.js');
  const execution = await import('../src/services/executionBvpService.js');
  const postgresDatabase = (await import('../src/database/PostgresDatabase.js')).default;

  const accepted = await candidates.acceptCandidate(undefined, IDS.candidate, {
    orgId: IDS.mainOrg,
    userId: IDS.owner,
    fill: false,
  });
  if (!accepted?.receiptPersisted || !accepted.initiativeId)
    fail(`candidate acceptance failed: ${JSON.stringify(accepted)}`);
  const initiativeId = accepted.initiativeId;
  const replay = await candidates.acceptCandidate(undefined, IDS.candidate, {
    orgId: IDS.mainOrg,
    userId: IDS.owner,
    fill: false,
  });
  if (!replay?.receiptPersisted || replay.initiativeId !== initiativeId)
    fail('candidate replay did not return the durable initiative');
  const foreignCandidate = await candidates.acceptCandidate(undefined, IDS.candidate, {
    orgId: IDS.foreignOrg,
    userId: IDS.foreignOwner,
    fill: false,
  });
  if (foreignCandidate !== null) fail('foreign candidate acceptance did not fail closed');

  const profileInput = {
    summary: 'Owner-reviewed plan: pilot na jednej linii, KPI czasu planowania i terminowości.',
    expectedVersion: 1,
    idempotencyKey: 'w3-ini-profile-v1',
  };
  const profile = (await profiles.updateInitiativeProfile(
    IDS.mainOrg,
    initiativeId,
    IDS.owner,
    profileInput
  )) as { version: number; idempotentReplay: boolean };
  if (profile.version !== 2 || profile.idempotentReplay) fail('canonical profile update failed');
  const profileReplay = (await profiles.updateInitiativeProfile(
    IDS.mainOrg,
    initiativeId,
    IDS.owner,
    profileInput
  )) as { version: number; idempotentReplay: boolean };
  if (profileReplay.version !== 2 || !profileReplay.idempotentReplay) fail('profile replay failed');

  const expectedErrors: Array<[() => Promise<unknown>, string]> = [
    [
      () =>
        profiles.updateInitiativeProfile(IDS.mainOrg, initiativeId, IDS.owner, {
          ...profileInput,
          summary: 'Collision payload',
        }),
      'IDEMPOTENCY_PAYLOAD_COLLISION',
    ],
    [
      () =>
        profiles.updateInitiativeProfile(IDS.mainOrg, initiativeId, IDS.owner, {
          summary: 'Stale payload',
          expectedVersion: 1,
          idempotencyKey: 'w3-ini-profile-stale-v1',
        }),
      'PROFILE_VERSION_CONFLICT',
    ],
    [
      () =>
        profiles.updateInitiativeProfile(IDS.foreignOrg, initiativeId, IDS.foreignOwner, {
          summary: 'Foreign payload',
          expectedVersion: 2,
          idempotencyKey: 'w3-ini-profile-foreign-v1',
        }),
      'INITIATIVE_NOT_FOUND',
    ],
    [
      () =>
        profiles.updateInitiativeProfile(IDS.mainOrg, initiativeId, IDS.member, {
          summary: 'Member payload',
          expectedVersion: 2,
          idempotencyKey: 'w3-ini-profile-member-v1',
        }),
      'INITIATIVE_PROFILE_ROLE_REQUIRED',
    ],
    [
      () =>
        profiles.updateInitiativeProfile(IDS.mainOrg, initiativeId, IDS.inactive, {
          summary: 'Inactive payload',
          expectedVersion: 2,
          idempotencyKey: 'w3-ini-profile-inactive-v1',
        }),
      'INITIATIVE_PROFILE_ROLE_REQUIRED',
    ],
  ];
  for (const [operation, code] of expectedErrors) {
    try {
      await operation();
      fail(`boundary ${code} unexpectedly succeeded`);
    } catch (error) {
      if ((error as { code?: string }).code !== code) throw error;
    }
  }

  const c = new pg.Client({ connectionString: TARGET_URL });
  await c.connect();
  let projectId = '';
  try {
    projectId = String(
      (
        await c.query(`SELECT project_id FROM initiatives WHERE id=$1 AND organization_id=$2`, [
          initiativeId,
          IDS.mainOrg,
        ])
      ).rows[0]?.project_id || ''
    );
    if (!projectId) fail('canonical candidate initiative has no system portfolio project');
    await c.query('BEGIN');
    await c.query(
      `INSERT INTO project_members(id,project_id,user_id,project_role,allocation_percent,permissions,added_by_id) VALUES('w3-ini-project-actor-membership',$1,$2,'PROJECT_MANAGER',100,$3,$4)`,
      [
        projectId,
        IDS.projectActor,
        JSON.stringify({ initiativeRead: true, initiativeContribute: true }),
        IDS.owner,
      ]
    );
    await c.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES($1,'initiative',$2,1,$3),($1,'execution_case',$4,1,$5)`,
      [
        IDS.mainOrg,
        initiativeId,
        JSON.stringify({
          initiativeId,
          projectId,
          lifecycleState: 'IN_EXECUTION',
          title: accepted.title,
          problem: 'Ręczne planowanie powoduje opóźnienia',
          proposedOutcome: 'Planowanie krótsze o 30%',
          initiativeOwnerId: IDS.owner,
          readiness: 'NOT_EVALUATED',
          source: {
            proposalId: IDS.candidate,
            proposalVersion: 1,
            sourceType: 'assessment-finding',
            sourceId: 'w3-ini-assessment-output-v1',
            sourceVersion: 1,
            freshness: 'CURRENT',
          },
        }),
        IDS.executionCase,
        JSON.stringify({
          executionCaseId: IDS.executionCase,
          initiativeId,
          projectId,
          state: 'ACTIVE',
          title: 'Pilot przezbrojeń — wykonanie',
        }),
      ]
    );
    await c.query(
      `INSERT INTO ie_aggregate_relations(organization_id,relation_type,source_type,source_id,source_version,target_type,target_id,payload_json) VALUES($1,'INITIATIVE_EXECUTION_CASE','initiative',$2,1,'execution_case',$3,$4)`,
      [IDS.mainOrg, initiativeId, IDS.executionCase, JSON.stringify({ fixture: true })]
    );
    const executionReviewAggregates: Array<[string, string, Record<string, unknown>]> = [
      [
        'execution_task',
        IDS.executionTaskOpen,
        {
          taskId: IDS.executionTaskOpen,
          executionCaseId: IDS.executionCase,
          initiativeId,
          title: 'Zweryfikować kompletność danych dla 20 kluczowych zleceń',
          description: 'Potwierdzić właścicieli, terminy i jakość danych źródłowych.',
          status: 'OPEN',
          assigneeId: IDS.member,
          ownerId: IDS.owner,
          dueAt: '2026-08-27T15:00:00.000Z',
          slaAt: '2026-08-26T15:00:00.000Z',
          evidenceRefs: ['w3-ini-order-data-snapshot@1'],
          blockers: [],
          dependencies: [],
          milestoneIds: [],
        },
      ],
      [
        'execution_task',
        IDS.executionTaskBlocked,
        {
          taskId: IDS.executionTaskBlocked,
          executionCaseId: IDS.executionCase,
          initiativeId,
          title: 'Skalibrować model prognozowania kolejności przezbrojeń',
          description: 'Przeliczyć model na potwierdzonym zbiorze danych pilotażowych.',
          status: 'BLOCKED',
          assigneeId: IDS.projectActor,
          ownerId: IDS.owner,
          dueAt: '2026-08-22T12:00:00.000Z',
          slaAt: '2026-08-21T12:00:00.000Z',
          evidenceRefs: [],
          blockers: ['Brak zatwierdzonego źródła prognozy'],
          dependencies: [IDS.executionDecision],
          milestoneIds: [],
        },
      ],
      [
        'execution_decision',
        IDS.executionDecision,
        {
          decisionId: IDS.executionDecision,
          executionCaseId: IDS.executionCase,
          initiativeId,
          title: 'Wybór kanonicznego źródła prognozy popytu',
          status: 'PENDING',
          authorityId: IDS.owner,
          requestedById: IDS.projectActor,
          dueAt: '2026-08-25T10:00:00.000Z',
          rationale: 'Decyzja odblokowuje kalibrację modelu oraz pilotaż.',
          evidenceRefs: ['w3-ini-source-comparison@1'],
        },
      ],
      [
        'operational_allocation',
        IDS.allocationOwner,
        {
          allocationId: IDS.allocationOwner,
          executionCaseId: IDS.executionCase,
          initiativeId,
          taskId: IDS.executionTaskOpen,
          assigneeId: IDS.member,
          assigneeName: 'Właściciel danych pilotażowych',
          teamId: 'operations-data',
          status: 'CONFIRMED',
          timeBasis: { window: '24–30 sie 2026', windowUnit: 'WEEK' },
          availability: { knowledgeState: 'KNOWN', value: 32 },
          demand: { knowledgeState: 'KNOWN', value: 24 },
          remainingDemand: { knowledgeState: 'KNOWN', value: 8 },
          load: { knowledgeState: 'KNOWN', low: 0.72, high: 0.78 },
          skillMatch: { state: 'MATCH', label: 'Bardzo dobre' },
          cost: { knowledgeState: 'KNOWN', value: '6 400 PLN' },
          conflict: { state: 'NONE' },
          freshness: 'CURRENT',
          nextAction: 'Monitoruj realizację',
        },
      ],
      [
        'operational_allocation',
        IDS.allocationMember,
        {
          allocationId: IDS.allocationMember,
          executionCaseId: IDS.executionCase,
          initiativeId,
          taskId: IDS.executionTaskBlocked,
          assigneeId: IDS.projectActor,
          assigneeName: 'Analityk planowania',
          teamId: 'transformation-office',
          status: 'REQUESTED',
          timeBasis: { window: '24–30 sie 2026', windowUnit: 'WEEK' },
          availability: { knowledgeState: 'KNOWN', value: 28 },
          demand: { knowledgeState: 'KNOWN', value: 38 },
          remainingDemand: { knowledgeState: 'KNOWN', value: -10 },
          load: { knowledgeState: 'KNOWN', low: 1.28, high: 1.42 },
          skillMatch: { state: 'MATCH', label: 'Dobre' },
          cost: { knowledgeState: 'PARTIAL' },
          conflict: { state: 'CAPACITY_CONFLICT' },
          freshness: 'CURRENT',
          nextAction: 'Podejmij decyzję o przesunięciu 10 h',
        },
      ],
      [
        'management_signal',
        IDS.managementSignal,
        {
          signalId: IDS.managementSignal,
          initiativeId,
          executionCaseId: IDS.executionCase,
          ruleId: 'CAPACITY_CONFLICT',
          sourceType: 'operational_allocation',
          sourceId: IDS.allocationMember,
          sourceVersions: { allocationVersion: 1 },
          severity: 'CRITICAL',
          occurrences: [{ occurredAt: '2026-08-24T08:00:00.000Z' }],
          updatedAt: '2026-08-24T08:00:00.000Z',
        },
      ],
      [
        'intervention_case',
        IDS.intervention,
        {
          interventionId: IDS.intervention,
          initiativeId,
          executionCaseId: IDS.executionCase,
          title: 'Odciążenie analityka w tygodniu 35',
          status: 'PENDING_DECISION',
          ownerId: IDS.projectActor,
          authorityId: IDS.owner,
          slaAt: '2026-08-26T12:00:00.000Z',
          hypotheses: ['Przeniesienie 10 h odblokuje kalibrację modelu'],
          evidenceRefs: [`${IDS.managementSignal}@1`],
          options: [{ optionId: 'resequence', label: 'Przesuń pracę niekrytyczną', impacts: [] }],
        },
      ],
      [
        'report_definition',
        IDS.reportDefinition,
        {
          currentVersion: 1,
          updatedAt: '2026-08-24T09:00:00.000Z',
          versions: [
            {
              definitionVersion: 1,
              state: 'PUBLISHED',
              name: 'Weekly Execution Pack',
              purpose: 'Tygodniowy przegląd realizacji, obciążenia i decyzji.',
              audience: ['Sponsor', 'Transformation Office'],
              cadence: 'WEEKLY',
              ownerId: IDS.owner,
              approverId: IDS.admin,
              scope: { projectIds: [projectId], generalBacklogAllowed: false },
            },
          ],
        },
      ],
      [
        'report_run',
        IDS.reportRun,
        {
          reportRunId: IDS.reportRun,
          initiativeId,
          status: 'PUBLISHED',
          definitionRef: { definitionId: IDS.reportDefinition, version: 1 },
          audience: ['Sponsor', 'Transformation Office'],
          scopeRefs: [`initiative:${initiativeId}`],
          period: { start: '2026-08-17T00:00:00.000Z', end: '2026-08-23T23:59:59.999Z' },
          asOf: '2026-08-24T09:00:00.000Z',
          sources: [
            { type: 'execution_case', id: IDS.executionCase, version: 1 },
            { type: 'execution_task', id: IDS.executionTaskOpen, version: 1 },
            { type: 'operational_allocation', id: IDS.allocationMember, version: 1 },
            { type: 'intervention_case', id: IDS.intervention, version: 1 },
          ],
        },
      ],
    ];
    for (const [aggregateType, aggregateId, payload] of executionReviewAggregates) {
      await c.query(
        `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES($1,$2,$3,1,$4)`,
        [IDS.mainOrg, aggregateType, aggregateId, JSON.stringify(payload)]
      );
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    await c.end();
  }

  const linkInput = {
    organizationId: IDS.mainOrg,
    initiativeId,
    caseId: IDS.executionCase,
    sourceVersion: 1,
    actorId: IDS.owner,
    idempotencyKey: 'w3-ini-execution-link-v1',
  };
  const link = await execution.linkRuntimeInitiativeToExecutionCase(linkInput);
  const linkReplay = await execution.linkRuntimeInitiativeToExecutionCase(linkInput);
  if (linkReplay.link_id !== link.link_id) fail('execution link replay did not converge');
  const executionErrors: Array<[() => Promise<unknown>, string]> = [
    [
      () =>
        execution.linkRuntimeInitiativeToExecutionCase({
          ...linkInput,
          caseId: '05000000-0000-4000-8000-000000000099',
        }),
      'execution_idempotency_payload_conflict',
    ],
    [
      () =>
        execution.linkRuntimeInitiativeToExecutionCase({
          ...linkInput,
          sourceVersion: 2,
          idempotencyKey: 'w3-ini-execution-stale-v1',
        }),
      'execution_runtime_initiative_stale_or_not_found',
    ],
    [
      () =>
        execution.linkRuntimeInitiativeToExecutionCase({
          ...linkInput,
          organizationId: IDS.foreignOrg,
          actorId: IDS.foreignOwner,
          idempotencyKey: 'w3-ini-execution-foreign-v1',
        }),
      'execution_runtime_initiative_stale_or_not_found',
    ],
  ];
  for (const [operation, message] of executionErrors) {
    try {
      await operation();
      fail(`boundary ${message} unexpectedly succeeded`);
    } catch (error) {
      if ((error as Error).message !== message) throw error;
    }
  }
  await postgresDatabase.close();
  return { initiativeId, projectId, executionLinkId: link.link_id };
}

async function readback(databaseName: string, dynamic: Record<string, unknown> | null = null) {
  const c = new pg.Client({ connectionString: TARGET_URL });
  await c.connect();
  try {
    const initiativeId = String(
      dynamic?.initiativeId ||
        (
          await c.query(`SELECT initiative_id FROM initiative_candidates WHERE id=$1`, [
            IDS.candidate,
          ])
        ).rows[0]?.initiative_id ||
        ''
    );
    const r = (
      await c.query(
        `SELECT
      (SELECT count(*)::int FROM users WHERE id=ANY($1::text[])) personas,
      (SELECT count(*)::int FROM initiative_candidates WHERE organization_id=$2) candidates,
      (SELECT count(*)::int FROM initiative_candidates WHERE id=$3 AND status='accepted' AND initiative_id=$4) accepted_candidates,
      (SELECT count(*)::int FROM initiatives WHERE id=$4 AND organization_id=$2 AND status='DRAFT' AND profile_version=2) initiatives,
      (SELECT count(*)::int FROM projects WHERE organization_id=$2 AND is_system=TRUE) system_portfolios,
      (SELECT count(*)::int FROM project_members pm JOIN projects p ON p.id=pm.project_id WHERE p.organization_id=$2 AND pm.user_id=$6 AND pm.project_role='PROJECT_MANAGER') project_actor_memberships,
      (SELECT count(*)::int FROM initiative_profile_update_receipts WHERE initiative_id=$4 AND organization_id=$2) profile_receipts,
      (SELECT count(*)::int FROM execution_case_links WHERE organization_id=$2 AND runtime_initiative_id=$4 AND runtime_execution_case_id=$5) execution_links,
      (SELECT count(*)::int FROM ie_aggregate_relations WHERE organization_id=$2 AND source_id=$4 AND target_id=$5 AND relation_type='INITIATIVE_EXECUTION_CASE') execution_relations,
      (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='initiative' AND aggregate_id=$4 AND payload_json->'source'->>'sourceId'='w3-ini-assessment-output-v1' AND payload_json->>'initiativeOwnerId'=$7) complete_runtime_read_models,
      (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='execution_task' AND payload_json->>'initiativeId'=$4 AND payload_json->>'executionCaseId'=$5) execution_tasks,
      (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='execution_decision' AND payload_json->>'initiativeId'=$4 AND payload_json->>'executionCaseId'=$5) execution_decisions,
      (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='operational_allocation' AND payload_json->>'initiativeId'=$4 AND payload_json->>'executionCaseId'=$5) operational_allocations,
      (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='management_signal' AND payload_json->>'initiativeId'=$4 AND payload_json->>'executionCaseId'=$5) management_signals,
      (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='intervention_case' AND payload_json->>'initiativeId'=$4 AND payload_json->>'executionCaseId'=$5) interventions,
      (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='report_definition' AND aggregate_id=$8) report_definitions,
      (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='report_run' AND aggregate_id=$9 AND payload_json->>'initiativeId'=$4) report_runs,
      (SELECT count(*)::int FROM initiative_profile_update_receipts WHERE idempotency_key LIKE '%stale%' OR idempotency_key LIKE '%foreign%' OR idempotency_key LIKE '%member%' OR idempotency_key LIKE '%inactive%') negative_profile_receipts,
      (SELECT count(*)::int FROM execution_case_links WHERE intake_idempotency_key LIKE '%stale%' OR intake_idempotency_key LIKE '%foreign%') negative_execution_links,
      (SELECT count(*)::int FROM schema_migrations WHERE status='success') successful_migrations`,
        [
          USERS.map((u) => u.id),
          IDS.mainOrg,
          IDS.candidate,
          initiativeId,
          IDS.executionCase,
          IDS.projectActor,
          IDS.owner,
          IDS.reportDefinition,
          IDS.reportRun,
        ]
      )
    ).rows[0];
    const expected = {
      personas: 6,
      candidates: 2,
      accepted_candidates: 1,
      initiatives: 1,
      system_portfolios: 1,
      project_actor_memberships: 1,
      profile_receipts: 1,
      execution_links: 1,
      execution_relations: 1,
      complete_runtime_read_models: 1,
      execution_tasks: 2,
      execution_decisions: 1,
      operational_allocations: 2,
      management_signals: 1,
      interventions: 1,
      report_definitions: 1,
      report_runs: 1,
      negative_profile_receipts: 0,
      negative_execution_links: 0,
      successful_migrations: 834,
    };
    for (const [key, value] of Object.entries(expected))
      if (String(r[key]) !== String(value))
        fail(`readback ${key} expected ${value}, got ${r[key]}`);
    const marker = (
      await c.query(
        `SELECT ownership_nonce,database_name FROM wave3_owner_fixture_markers WHERE fixture_id=$1`,
        [FIXTURE_ID]
      )
    ).rows[0];
    if (
      !marker ||
      marker.database_name !== databaseName ||
      !/^[a-f0-9]{64}$/.test(marker.ownership_nonce || '')
    )
      fail('durable fixture marker mismatch');
    const payload = manifest(databaseName, marker.ownership_nonce, { ...dynamic, initiativeId }, r);
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
          fixture: 'W3-INITIATIVES-OWNER-v1',
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
