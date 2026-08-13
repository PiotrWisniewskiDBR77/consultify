import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';
import { createInitiativesAnalysisGoldenThread } from '../../integration/initiatives-execution/helpers/goldenThreadFixture';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const organizationId = process.env.IE_SEED_ORGANIZATION_ID?.trim() || 'nordwerk-browser';
const projectId = process.env.IE_SEED_PROJECT_ID?.trim() || 'operations-transformation-2027';
const ownerId = process.env.IE_SEED_OWNER_ID?.trim() || 'manual-aco-ready-owner';
const reviewerId = process.env.IE_SEED_REVIEWER_ID?.trim() || 'manual-aco-ready-reviewer';
const authorityId =
  process.env.IE_SEED_AUTHORITY_ID?.trim() || 'manual-aco-ready-gate-authority';
const readyPrefix = process.env.IE_SEED_READY_PREFIX?.trim() || 'manual-aco-ready';
const draftPrefix = process.env.IE_SEED_DRAFT_PREFIX?.trim() || 'manual-energy-draft';
const policy = {
  policyId: 'standard-industrial',
  version: 3,
  baseline: 'STANDARD' as const,
  strictness: 3,
  source: 'PROJECT' as const,
  config: {
    selfApproval: false,
    enforceGateGovernance: true,
    gates: {
      DEFINITION: {
        quorum: 1,
        requiredRoles: ['GATE_AUTHORITY'],
        separation: true,
        slaHours: 48,
      },
      ANALYSIS: {
        quorum: 1,
        requiredRoles: ['GATE_AUTHORITY'],
        separation: true,
        slaHours: 48,
      },
    },
    roleBindings: [{ roleKey: 'GATE_AUTHORITY', principalId: authorityId }],
  },
};

const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as express.Request & { user: Record<string, string | undefined> }).user = {
    id: req.header('x-test-user') ?? undefined,
    organizationId: req.header('x-test-org') ?? undefined,
    role: 'USER',
  };
  next();
});
app.use(
  '/runtime-v1',
  createInitiativesExecutionRuntimeRouter({
    unitOfWork: new PostgresMaterialCommandUnitOfWork(pool),
    reader: new PostgresInitiativeReader(pool),
    authorize: async (actor, requestedProjectId) =>
      actor.organizationId === organizationId && requestedProjectId === projectId,
    resolvePolicy: async () => policy,
  })
);

const api = (actor: string) => ({
  get: (path: string) =>
    request(app).get(path).set('x-test-user', actor).set('x-test-org', organizationId),
  post: (path: string) =>
    request(app).post(path).set('x-test-user', actor).set('x-test-org', organizationId),
});

const initiativeExists = async (initiativeId: string, actor: string) =>
  (await api(actor).get(`/runtime-v1/initiatives/${encodeURIComponent(initiativeId)}`)).status ===
  200;

try {
  await pool.query(
    `INSERT INTO ie_governance_policies
      (organization_id,scope_type,scope_id,policy_id,version,baseline,strictness,config_json,status)
     VALUES($1,'PROJECT',$2,$3,$4,'STANDARD',3,$5::jsonb,'ACTIVE')
     ON CONFLICT (organization_id,scope_type,scope_id,policy_id,version)
     DO UPDATE SET config_json=EXCLUDED.config_json,status='ACTIVE'`,
    [
      organizationId,
      projectId,
      policy.policyId,
      policy.version,
      JSON.stringify({ ...policy.config, roleBindings: undefined }),
    ]
  );
  await pool.query(
    `INSERT INTO ie_governance_role_bindings
      (organization_id,policy_id,policy_version,role_key,principal_id,project_id)
     VALUES($1,$2,$3,'GATE_AUTHORITY',$4,$5)
     ON CONFLICT DO NOTHING`,
    [organizationId, policy.policyId, policy.version, authorityId, projectId]
  );

  const readyInitiativeId = `${readyPrefix}-initiative`;
  const readyExists = await initiativeExists(readyInitiativeId, ownerId);
  const ready = readyExists
    ? { initiativeId: readyInitiativeId }
    : await createInitiativesAnalysisGoldenThread(app, {
        prefix: readyPrefix,
        organizationId,
        projectId,
        title: 'Automated Changeover Optimization — decision candidate',
        problem: 'Median changeover is 95 minutes and constrains Line 4 throughput.',
        proposedOutcome: 'Reduce median changeover to 60 minutes with governed evidence.',
        ownerId,
        reviewerId,
        authorityId,
      });

  const draftOwner = ownerId;
  const proposalId = `${draftPrefix}-proposal`;
  const initiativeId = `${draftPrefix}-initiative`;
  if (!(await initiativeExists(initiativeId, draftOwner))) {
    await api(draftOwner)
      .post('/runtime-v1/source-proposals')
      .send({
        proposalId,
        expectedVersion: 0,
        clientRequestId: `${draftPrefix}-submit`,
        sourceType: 'assessment-finding',
        sourceId: `${draftPrefix}-source`,
        sourceVersion: 1,
        provenance: {
          system: 'manual-acceptance',
          recordType: 'assessment-finding',
          capturedAt: '2026-08-11T08:00:00.000Z',
          evidenceRefs: [`evidence:${draftPrefix}:v1`],
        },
        title: 'Energy Reduction Programme',
        problem: 'Energy consumption varies without an accepted operating baseline.',
        proposedOutcome: 'Establish a measurable reduction programme.',
        projectId,
        initiativeOwnerId: draftOwner,
        visibility: 'PROJECT',
      })
      .expect(201);
    await api(draftOwner)
      .post('/runtime-v1/registrations')
      .send({
        initiativeId,
        expectedVersion: 0,
        clientRequestId: `${draftPrefix}-register`,
        proposalId,
        proposalVersion: 1,
        sourceType: 'assessment-finding',
        sourceId: `${draftPrefix}-source`,
        sourceVersion: 1,
        title: 'Energy Reduction Programme',
        problem: 'Energy consumption varies without an accepted operating baseline.',
        proposedOutcome: 'Establish a measurable reduction programme.',
        projectId,
        visibility: 'PROJECT',
        initiativeOwnerId: draftOwner,
      })
      .expect(201);
  }

  process.stdout.write(
    `${JSON.stringify({ ready: ready.initiativeId, registeredDraft: initiativeId }, null, 2)}\n`
  );
} finally {
  await pool.end();
}
