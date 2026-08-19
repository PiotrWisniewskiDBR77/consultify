import { readFile } from 'node:fs/promises';
import path from 'node:path';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';

const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;

real('Initiatives/Execution project authorization boundary HTTP realDB', () => {
  const pool = new Pool({ connectionString: url, max: 1 });
  const app = express();
  const org = 'org-auth-boundary';
  const project = 'project-authorized';
  let capabilityActive = true;

  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-test-user') || 'viewer',
      organizationId: req.header('x-test-org') || org,
      role: req.header('x-test-role') || 'USER',
    };
    next();
  });
  app.use(
    '/runtime-v1',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: new PostgresMaterialCommandUnitOfWork(pool),
      reader: new PostgresInitiativeReader(pool),
      authorize: async (actor, projectId) =>
        capabilityActive && actor.userId === 'bound-owner' && projectId === project,
      resolvePolicy: async () => ({
        policyId: 'auth-boundary',
        version: 1,
        baseline: 'STANDARD',
        strictness: 2,
        source: 'PROJECT',
        config: {
          selfApproval: false,
          enforceGateGovernance: true,
          roleBindings: [
            {
              roleKey: 'GATE_AUTHORITY',
              principalId: 'direct-authority',
              delegates: [
                {
                  principalId: 'expired-delegate',
                  gates: ['DEFINITION'],
                  expiresAt: '2020-01-01T00:00:00.000Z',
                  delegationRef: 'expired-proof',
                  version: 1,
                },
              ],
            },
          ],
        },
      }),
    })
  );
  app.use(
    (error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res
        .status(error.message.includes('Authorized signer') ? 403 : 500)
        .json({ error: error.message });
    }
  );

  beforeAll(async () => {
    for (const migration of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
      '934_organization_governance_profiles.sql',
    ])
      await pool.query(await readFile(path.resolve('server/migrations', migration), 'utf8'));
  });

  beforeEach(async () => {
    capabilityActive = true;
    for (const table of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [org]);
    const aggregates: Array<[string, string, Record<string, unknown>]> = [
      [
        'initiative',
        'initiative-1',
        { initiativeId: 'initiative-1', projectId: project, lifecycleState: 'DEFINED' },
      ],
      [
        'portfolio_scenario',
        'portfolio-1',
        { scenarioId: 'portfolio-1', scope: { portfolioId: project } },
      ],
      [
        'plan_scenario',
        'plan-1',
        {
          scenarioId: 'plan-1',
          portfolioScenarioId: 'portfolio-1',
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [
            { periodId: 'w1', start: '2026-08-10T00:00:00.000Z', end: '2026-08-17T00:00:00.000Z' },
          ],
          windows: [],
        },
      ],
      [
        'capacity_scenario',
        'capacity-1',
        {
          scenarioId: 'capacity-1',
          planScenarioId: 'plan-1',
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [],
          constraints: [],
          proposedAssignments: [],
        },
      ],
      [
        'execution_case',
        'execution-1',
        { executionCaseId: 'execution-1', initiativeId: 'initiative-1', state: 'ACTIVE' },
      ],
      [
        'management_signal',
        'signal-1',
        { signalId: 'signal-1', projectId: project, state: 'OPEN' },
      ],
      [
        'intervention_case',
        'intervention-1',
        { interventionId: 'intervention-1', projectId: project, state: 'DRAFT' },
      ],
      [
        'report_definition',
        'definition-1',
        {
          currentVersion: 1,
          versions: [
            {
              definitionVersion: 1,
              state: 'PUBLISHED',
              name: 'Scoped report',
              scope: {
                type: 'PROJECTS',
                refs: [],
                projectIds: [project],
                generalBacklogAllowed: false,
              },
            },
          ],
        },
      ],
      [
        'report_run',
        'run-1',
        {
          reportRunId: 'run-1',
          definitionRef: { definitionId: 'definition-1', definitionVersion: 1 },
          status: 'DRAFT',
        },
      ],
      [
        'delivery_acceptance',
        'delivery-1',
        { decisionId: 'delivery-1', initiativeId: 'initiative-1', status: 'PENDING' },
      ],
      [
        'results_acceptance',
        'results-1',
        { resultsCaseId: 'results-1', initiativeId: 'initiative-1', status: 'ACCEPTED' },
      ],
      [
        'results_kpi_observation',
        'observation-1',
        {
          observationId: 'observation-1',
          resultsCaseRef: { resultsCaseId: 'results-1', version: 1 },
        },
      ],
      [
        'finance_reconciliation',
        'finance-1',
        { reconciliationId: 'finance-1', projectId: project, status: 'AVAILABLE' },
      ],
      [
        'effectiveness_case',
        'effectiveness-1',
        {
          effectivenessCaseId: 'effectiveness-1',
          initiativeId: 'initiative-1',
          status: 'TRACKING',
        },
      ],
      [
        'closure_case',
        'closure-1',
        { closureCaseId: 'closure-1', initiativeId: 'initiative-1', status: 'PENDING' },
      ],
      ['archive_manifest', 'archive-1', { archiveId: 'archive-1', initiativeId: 'initiative-1' }],
      [
        'material_change',
        'change-1',
        { proposalId: 'change-1', target: { initiativeId: 'initiative-1' }, status: 'DRAFT' },
      ],
      ['report_definition', 'legacy-unknown-scope', { currentVersion: 0, versions: [] }],
    ];
    for (const [type, id, payload] of aggregates)
      await pool.query(
        `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
         VALUES($1,$2,$3,1,$4::jsonb)`,
        [org, type, id, JSON.stringify(payload)]
      );
  });

  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, 'org-auth-boundary');
    await pool.end();
  });

  const headers = (user: string, organizationId = org, role = 'USER') => ({
    'x-test-user': user,
    'x-test-org': organizationId,
    'x-test-role': role,
  });
  const mutationProof = async () =>
    (
      await pool.query(
        `SELECT
           (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$1) aggregates,
           (SELECT count(*)::int FROM ie_audit_events WHERE organization_id=$1) audits,
           (SELECT count(*)::int FROM ie_outbox_events WHERE organization_id=$1) outbox,
           (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id=$1) receipts,
           md5(string_agg(aggregate_type||':'||aggregate_id||':'||version||':'||payload_json::text,'|' ORDER BY aggregate_type,aggregate_id)) hash
         FROM ie_aggregate_state WHERE organization_id=$1`,
        [org]
      )
    ).rows[0];

  it('filters tenant-wide lists and conceals scoped details from viewer, unrelated project, Admin and foreign tenant', async () => {
    const listPaths = [
      '/portfolio-scenarios',
      '/plan-scenarios',
      '/capacity-scenarios',
      '/execution-cases',
      '/management-signals',
      '/interventions',
      '/report-definitions',
      '/report-runs',
      '/delivery-acceptances',
      '/results-acceptances',
      '/results-observations',
      '/effectiveness',
      '/closures',
      '/archives',
      '/material-changes',
    ];
    for (const actor of [
      headers('viewer'),
      headers('unrelated-project-owner'),
      headers('admin-without-business-binding', org, 'ADMIN'),
      headers('bound-owner', 'foreign-tenant'),
    ])
      for (const route of listPaths) {
        const response = await request(app).get(`/runtime-v1${route}`).set(actor);
        expect(response.status, `${actor['x-test-user']} ${route}`).toBe(200);
        expect(
          response.body.items ??
            response.body.scenarios ??
            response.body.executionCases ??
            response.body.cases ??
            response.body,
          `${actor['x-test-user']} ${route}`
        ).toEqual([]);
      }

    for (const route of [
      '/report-definitions/definition-1',
      '/finance-reconciliations/finance-1',
      '/results-observations/observation-1',
    ])
      expect((await request(app).get(`/runtime-v1${route}`).set(headers('viewer'))).status).toBe(
        404
      );

    for (const route of listPaths) {
      const response = await request(app).get(`/runtime-v1${route}`).set(headers('bound-owner'));
      expect(response.status, route).toBe(200);
      expect(
        (
          response.body.items ??
          response.body.scenarios ??
          response.body.executionCases ??
          response.body.cases ??
          response.body
        ).length,
        route
      ).toBeGreaterThan(0);
    }
    const definitions = await request(app)
      .get('/runtime-v1/report-definitions')
      .set(headers('bound-owner'));
    expect(definitions.body.items.map((item: any) => item.definitionId)).toEqual(['definition-1']);
  });

  it('denies representative material writes before domain mutation, including Admin without business binding', async () => {
    const before = await mutationProof();
    const denied = [
      () => request(app)
        .post('/runtime-v1/source-proposals')
        .set(headers('viewer'))
        .send({
          proposalId: 'source-1',
          expectedVersion: 0,
          clientRequestId: 'source-1',
          sourceType: 'manual',
          sourceId: 'manual-1',
          sourceVersion: 1,
          provenance: {
            system: 'test',
            recordType: 'idea',
            capturedAt: '2026-08-10T00:00:00.000Z',
            evidenceRefs: [],
          },
          title: 'Blocked source',
          problem: 'No authority',
          proposedOutcome: null,
          projectId: project,
          initiativeOwnerId: 'owner',
          visibility: 'PROJECT',
        }),
      () => request(app)
        .post('/runtime-v1/execution-cases/execution-1/tasks/task-new')
        .set(headers('viewer'))
        .send({
          expectedVersion: 0,
          expectedCaseVersion: 1,
          clientRequestId: 'task-1',
          executionCaseId: 'execution-1',
          initiativeId: 'initiative-1',
          title: 'Blocked task',
          description: '',
          assigneeId: 'assignee',
          ownerId: 'owner',
          dueAt: '2026-08-11T00:00:00.000Z',
          slaAt: '2026-08-11T00:00:00.000Z',
          evidenceRefs: [],
          blockerDecisionIds: [],
          dependencyTaskIds: [],
          milestoneIds: [],
        }),
      () => request(app)
        .post('/runtime-v1/report-definitions/new-definition')
        .set(headers('admin-without-business-binding', org, 'ADMIN'))
        .send({ scope: { projectIds: [project], generalBacklogAllowed: false } }),
      () => request(app)
        .post('/runtime-v1/material-changes/change-1/transitions')
        .set(headers('unrelated-project-owner'))
        .send({}),
      () => request(app)
        .post('/runtime-v1/archives/new-archive')
        .set(headers('viewer'))
        .send({ initiativeId: 'initiative-1' }),
      () => request(app)
        .post('/runtime-v1/results-observations/new-observation')
        .set(headers('viewer'))
        .send({ resultsCaseRef: { resultsCaseId: 'results-1' } }),
      () => request(app)
        .post('/runtime-v1/finance-reconciliations/new-finance')
        .set(headers('viewer'))
        .send({ projectId: project }),
    ];
    for (const makeRequest of denied) {
      const response = await makeRequest();
      expect([403, 404]).toContain(response.status);
    }
    expect(await mutationProof()).toEqual(before);
  });

  it('rechecks capability at write time after an authorized list and preserves exact state on loss', async () => {
    const listed = await request(app)
      .get('/runtime-v1/material-changes')
      .set(headers('bound-owner'));
    expect(listed.body.items).toHaveLength(1);
    const before = await mutationProof();
    capabilityActive = false;
    const denied = await request(app)
      .post('/runtime-v1/material-changes/change-1/transitions')
      .set(headers('bound-owner'))
      .send({});
    expect(denied.status).toBe(404);
    expect(await mutationProof()).toEqual(before);
  });

  it('conceals Execution Work and denies Task, Decision and Allocation writes without project binding', async () => {
    const before = await mutationProof();
    const deniedRead = await request(app)
      .get('/runtime-v1/execution-cases/execution-1/work')
      .set(headers('viewer'));
    expect(deniedRead.status).toBe(404);

    const authorizedRead = await request(app)
      .get('/runtime-v1/execution-cases/execution-1/work')
      .set(headers('bound-owner'));
    expect(authorizedRead.status).toBe(200);
    expect(authorizedRead.body).toEqual({ tasks: [], decisions: [] });

    const deniedAllocationsRead = await request(app)
      .get('/runtime-v1/execution-cases/execution-1/allocations')
      .set(headers('viewer'));
    expect(deniedAllocationsRead.status).toBe(404);
    const authorizedAllocationsRead = await request(app)
      .get('/runtime-v1/execution-cases/execution-1/allocations')
      .set(headers('bound-owner'));
    expect(authorizedAllocationsRead.status).toBe(200);
    expect(authorizedAllocationsRead.body).toEqual({ items: [] });

    for (const route of [
      '/execution-cases/execution-1/tasks/task-guess/transitions',
      '/execution-cases/execution-1/decisions/decision-guess/transitions',
      '/execution-cases/execution-1/tasks/task-guess/allocations/allocation-guess',
    ]) {
      const denied = await request(app).post(`/runtime-v1${route}`).set(headers('viewer')).send({});
      expect(denied.status, route).toBe(404);

      const authorizedValidation = await request(app)
        .post(`/runtime-v1${route}`)
        .set(headers('bound-owner'))
        .send({});
      expect(authorizedValidation.status, route).toBe(400);
    }
    expect(await mutationProof()).toEqual(before);
  });

  it('rejects an expired delegated gate signoff with zero mutation', async () => {
    const before = await mutationProof();
    const response = await request(app)
      .post('/runtime-v1/initiatives/initiative-1/gate-signoffs')
      .set(headers('expired-delegate'))
      .send({
        expectedVersion: 0,
        expectedQuorumVersion: 0,
        clientRequestId: 'expired-signoff',
        gate: 'DEFINITION',
        decisionId: 'definition-decision-1',
        requesterId: 'requester',
        roleKey: 'GATE_AUTHORITY',
        outcome: 'APPROVE',
        delegationProof: {
          delegatedFrom: 'direct-authority',
          delegationRef: 'expired-proof',
          version: 1,
        },
        rationale: 'Expired proof must fail',
      });
    expect(response.status, JSON.stringify(response.body)).toBe(403);
    expect(await mutationProof()).toEqual(before);
  });
});
